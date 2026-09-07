import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import db from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'pulse_secret_key_change_in_prod';

// 在线用户映射: userId -> Set<socketId>
const onlineUsers = new Map();
// 延迟离线定时器: userId -> timeout
const offlineTimers = new Map();

export function setupSocket(io) {
  // 认证中间件
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('未提供 token'));

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch {
      next(new Error('Token 无效'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`User connected: ${userId}`);

    // 加入在线列表
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);

    // 取消延迟离线定时器
    if (offlineTimers.has(userId)) {
      clearTimeout(offlineTimers.get(userId));
      offlineTimers.delete(userId);
    } else {
      // 首次连接才通知上线（重连时不重复通知）
      notifyFriendsOnlineStatus(io, userId, true);
      notifyConversationMembers(io, userId, true);
    }

    // 加入该用户所有会话的房间
    const convs = db.prepare(
      'SELECT conversation_id FROM conversation_members WHERE user_id = ?'
    ).all(userId);
    convs.forEach(c => socket.join(c.conversation_id));

    // 同步当前在线的好友/会话成员状态给刚连接的用户
    syncOnlineStatusToUser(socket, userId);

    // 重连时重新加入房间
    socket.on('rejoin', () => {
      const convs = db.prepare(
        'SELECT conversation_id FROM conversation_members WHERE user_id = ?'
      ).all(userId);
      convs.forEach(c => socket.join(c.conversation_id));
    });

    // ========== 消息事件 ==========

    // 发送消息
    socket.on('message:send', (data) => {
      const { conversationId, type = 'text', content } = data;
      if (!conversationId || !content) return;

      // 验证成员身份
      const member = db.prepare(
        'SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?'
      ).get(conversationId, userId);
      if (!member) return;

      const id = uuid();
      db.prepare(
        'INSERT INTO messages (id, conversation_id, sender_id, type, content) VALUES (?, ?, ?, ?, ?)'
      ).run(id, conversationId, userId, type, content);

      // 为会话中的其他成员创建 message_status
      const members = db.prepare(
        'SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ?'
      ).all(conversationId, userId);
      members.forEach(m => {
        db.prepare(
          'INSERT OR IGNORE INTO message_status (message_id, user_id, status) VALUES (?, ?, ?)'
        ).run(id, m.user_id, 'sent');
      });

      const message = db.prepare(`
        SELECT m.*, u.nickname as sender_name, u.avatar as sender_avatar
        FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?
      `).get(id);

      // 广播到会话房间
      io.to(conversationId).emit('message:new', message);
    });

    // 消息已读
    socket.on('message:read', (data) => {
      const { conversationId } = data;
      // 检查用户是否开启了已读回执
      const settings = db.prepare('SELECT show_read_receipts FROM user_settings WHERE user_id = ?').get(userId);
      if (settings && !settings.show_read_receipts) return; // 关闭了已读回执，不处理

      db.prepare(`
        UPDATE message_status SET status = 'read'
        WHERE user_id = ? AND message_id IN (
          SELECT id FROM messages WHERE conversation_id = ?
        )
      `).run(userId, conversationId);

      io.to(conversationId).emit('message:read', { userId, conversationId });
    });

    // 正在输入
    socket.on('typing:start', (data) => {
      // 检查用户是否开启了输入状态显示
      const settings = db.prepare('SELECT show_typing FROM user_settings WHERE user_id = ?').get(userId);
      if (settings && !settings.show_typing) return;
      socket.to(data.conversationId).emit('typing:start', { userId, conversationId: data.conversationId });
    });

    socket.on('typing:stop', (data) => {
      const settings = db.prepare('SELECT show_typing FROM user_settings WHERE user_id = ?').get(userId);
      if (settings && !settings.show_typing) return;
      socket.to(data.conversationId).emit('typing:stop', { userId, conversationId: data.conversationId });
    });

    // ========== 通话信令 ==========

    // 发起通话
    socket.on('call:offer', ({ to, callType, signal, conversationId }) => {
      const targetSockets = onlineUsers.get(to);
      if (targetSockets) {
        targetSockets.forEach(sid => {
          io.to(sid).emit('call:offer', { from: userId, callType, signal, conversationId });
        });
      }
    });

    // 接受通话
    socket.on('call:answer', ({ to, signal }) => {
      const targetSockets = onlineUsers.get(to);
      if (targetSockets) {
        targetSockets.forEach(sid => {
          io.to(sid).emit('call:answer', { from: userId, signal });
        });
      }
    });

    // ICE 候选
    socket.on('call:ice-candidate', ({ to, candidate }) => {
      const targetSockets = onlineUsers.get(to);
      if (targetSockets) {
        targetSockets.forEach(sid => {
          io.to(sid).emit('call:ice-candidate', { from: userId, candidate });
        });
      }
    });

    // 拒绝通话
    socket.on('call:reject', ({ to, conversationId }) => {
      const targetSockets = onlineUsers.get(to);
      if (targetSockets) {
        targetSockets.forEach(sid => {
          io.to(sid).emit('call:reject', { from: userId, conversationId });
        });
      }
    });

    // 结束通话
    socket.on('call:end', ({ to, conversationId }) => {
      const targetSockets = onlineUsers.get(to);
      if (targetSockets) {
        targetSockets.forEach(sid => {
          io.to(sid).emit('call:end', { from: userId, conversationId });
        });
      }
    });

    // ========== 断开连接 ==========

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${userId}`);
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          // 延迟 15 秒再标记离线，避免页面刷新/网络波动导致误判
          const timer = setTimeout(() => {
            offlineTimers.delete(userId);
            // 再次确认确实没有连接了
            if (!onlineUsers.has(userId) || onlineUsers.get(userId).size === 0) {
              onlineUsers.delete(userId);
              notifyFriendsOnlineStatus(io, userId, false);
              notifyConversationMembers(io, userId, false);
            }
          }, 15000);
          offlineTimers.set(userId, timer);
        }
      }
    });
  });
}

// 通知好友上线/下线状态（尊重在线状态可见性设置）
function notifyFriendsOnlineStatus(io, userId, isOnline) {
  // 获取用户的在线状态可见性设置
  const settings = db.prepare('SELECT online_visibility FROM user_settings WHERE user_id = ?').get(userId);
  const visibility = settings ? settings.online_visibility : 'friends';
  
  // 如果设置为"所有人不可见"，不通知任何人
  if (visibility === 'none') return;

  const friends = db.prepare(
    "SELECT friend_id FROM friendships WHERE user_id = ? AND status = 'accepted'"
  ).all(userId);

  friends.forEach(f => {
    const sockets = onlineUsers.get(f.friend_id);
    if (sockets) {
      sockets.forEach(sid => {
        io.to(sid).emit('user:status', { userId, online: isOnline });
      });
    }
  });
}

// 通知会话成员上线/下线状态（仅当 visibility 为 'all' 时通知非好友）
function notifyConversationMembers(io, userId, isOnline) {
  const settings = db.prepare('SELECT online_visibility FROM user_settings WHERE user_id = ?').get(userId);
  const visibility = settings ? settings.online_visibility : 'friends';
  
  // 如果不是"所有人可见"，只通知好友（已在 notifyFriendsOnlineStatus 中处理）
  if (visibility !== 'all') return;

  const members = db.prepare(
    'SELECT DISTINCT user_id FROM conversation_members WHERE conversation_id IN (SELECT conversation_id FROM conversation_members WHERE user_id = ?) AND user_id != ?'
  ).all(userId, userId);

  // 排除已在好友中的（避免重复通知）
  const friends = db.prepare(
    "SELECT friend_id FROM friendships WHERE user_id = ? AND status = 'accepted'"
  ).all(userId);
  const friendSet = new Set(friends.map(f => f.friend_id));

  members.forEach(m => {
    if (friendSet.has(m.user_id)) return; // 好友已通知过
    const sockets = onlineUsers.get(m.user_id);
    if (sockets) {
      sockets.forEach(sid => {
        io.to(sid).emit('user:status', { userId, online: isOnline });
      });
    }
  });
}

// 获取在线状态
export function isOnline(userId) {
  return onlineUsers.has(userId);
}

// 同步当前在线用户状态给刚连接的用户（尊重被查看者的在线状态可见性设置）
function syncOnlineStatusToUser(socket, userId) {
  // 获取好友列表中的在线用户
  const friends = db.prepare(
    "SELECT friend_id FROM friendships WHERE user_id = ? AND status = 'accepted'"
  ).all(userId);

  friends.forEach(f => {
    if (onlineUsers.has(f.friend_id)) {
      // 检查好友的在线状态可见性设置
      const fSettings = db.prepare('SELECT online_visibility FROM user_settings WHERE user_id = ?').get(f.friend_id);
      const fVisibility = fSettings ? fSettings.online_visibility : 'friends';
      if (fVisibility === 'none') return; // 好友设置了不可见
      // friends 可见或 all 可见，都能看到好友在线
      socket.emit('user:status', { userId: f.friend_id, online: true });
    }
  });

  // 获取会话成员中的在线用户（仅当对方设置为"所有人可见"时才同步非好友状态）
  const members = db.prepare(
    'SELECT DISTINCT user_id FROM conversation_members WHERE conversation_id IN (SELECT conversation_id FROM conversation_members WHERE user_id = ?) AND user_id != ?'
  ).all(userId, userId);

  const friendSet = new Set(friends.map(f => f.friend_id));
  members.forEach(m => {
    if (friendSet.has(m.user_id)) return; // 已在好友中处理
    if (!onlineUsers.has(m.user_id)) return;
    // 检查对方的在线状态可见性
    const mSettings = db.prepare('SELECT online_visibility FROM user_settings WHERE user_id = ?').get(m.user_id);
    const mVisibility = mSettings ? mSettings.online_visibility : 'friends';
    if (mVisibility === 'all') {
      socket.emit('user:status', { userId: m.user_id, online: true });
    }
  });
}
