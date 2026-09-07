import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import db from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { notifyUser } from '../services/socket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const router = Router();
router.use(authMiddleware);

// 配置 multer 用于头像上传
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/avatars'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.userId}-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('只允许上传图片'));
  }
});

// 生成唯一的8位pulse_id
function generatePulseId() {
  const chars = '0123456789';
  let pulseId;
  let existing;
  
  do {
    pulseId = '';
    for (let i = 0; i < 8; i++) {
      pulseId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    existing = db.prepare('SELECT id FROM users WHERE pulse_id = ?').get(pulseId);
  } while (existing);
  
  return pulseId;
}

// 获取当前用户信息
router.get('/me', (req, res) => {
  const user = db.prepare('SELECT id, pulse_id, username, nickname, avatar, signature, theme, pulse_id_changed_at, is_admin, created_at FROM users WHERE id = ?')
    .get(req.userId);
  res.json({
    id: user.id,
    pulseId: user.pulse_id,
    username: user.username,
    nickname: user.nickname,
    avatar: user.avatar,
    signature: user.signature,
    theme: user.theme,
    pulseIdChangedAt: user.pulse_id_changed_at,
    isAdmin: !!user.is_admin,
    createdAt: user.created_at
  });
});

// 更新个人信息
router.put('/me', (req, res) => {
  const { nickname, avatar, signature } = req.body;
  const updates = [];
  const params = [];

  if (nickname) { updates.push('nickname = ?'); params.push(nickname); }
  if (avatar !== undefined) { updates.push('avatar = ?'); params.push(avatar); }
  if (signature !== undefined) { updates.push('signature = ?'); params.push(signature); }

  if (updates.length === 0) return res.status(400).json({ error: '没有可更新的字段' });

  params.push(req.userId);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const user = db.prepare('SELECT id, pulse_id, username, nickname, avatar, signature, theme FROM users WHERE id = ?')
    .get(req.userId);
  res.json({
    id: user.id,
    pulseId: user.pulse_id,
    username: user.username,
    nickname: user.nickname,
    avatar: user.avatar,
    signature: user.signature,
    theme: user.theme
  });
});

// 更新主题
router.put('/theme', (req, res) => {
  const { theme } = req.body;
  if (!theme || !['dark', 'light'].includes(theme)) {
    return res.status(400).json({ error: '无效的主题' });
  }

  db.prepare('UPDATE users SET theme = ? WHERE id = ?').run(theme, req.userId);
  res.json({ theme });
});

// 修改 pulse_id（一个月只能改一次）
router.put('/pulse-id', (req, res) => {
  const { pulseId: newPulseId } = req.body;
  
  if (!newPulseId || !/^\d{8,}$/.test(newPulseId)) {
    return res.status(400).json({ error: 'PulseID 必须是8位以上数字' });
  }

  const user = db.prepare('SELECT pulse_id_changed_at FROM users WHERE id = ?').get(req.userId);
  
  // 检查一个月内是否修改过
  if (user.pulse_id_changed_at) {
    const lastChanged = new Date(user.pulse_id_changed_at);
    const now = new Date();
    const diffDays = Math.floor((now - lastChanged) / (1000 * 60 * 60 * 24));
    if (diffDays < 30) {
      return res.status(400).json({ error: `PulseID 每30天只能修改一次，还需等待 ${30 - diffDays} 天` });
    }
  }

  // 检查是否已被使用
  const existing = db.prepare('SELECT id FROM users WHERE pulse_id = ? AND id != ?').get(newPulseId, req.userId);
  if (existing) return res.status(409).json({ error: '该 PulseID 已被使用' });

  const now = new Date().toISOString();
  db.prepare('UPDATE users SET pulse_id = ?, pulse_id_changed_at = ? WHERE id = ?').run(newPulseId, now, req.userId);
  
  res.json({ pulseId: newPulseId, pulseIdChangedAt: now });
});

// 通过 pulse_id 查看用户主页
router.get('/profile/:pulseId', (req, res) => {
  const { pulseId } = req.params;
  const user = db.prepare(`
    SELECT u.id, u.pulse_id, u.username, u.nickname, u.avatar, u.signature, u.created_at,
      (SELECT status FROM friendships WHERE user_id = ? AND friend_id = u.id) as friend_status
    FROM users u WHERE u.pulse_id = ?
  `).get(req.userId, pulseId);

  if (!user) return res.status(404).json({ error: '用户不存在' });

  res.json({
    id: user.id,
    pulseId: user.pulse_id,
    username: user.username,
    nickname: user.nickname,
    avatar: user.avatar,
    signature: user.signature,
    createdAt: user.created_at,
    friendStatus: user.friend_status
  });
});

// 通过 PulseID 或用户名查找用户
router.get('/search', (req, res) => {
  const { q } = req.query;
  if (!q || !q.trim()) return res.json([]);

  const query = q.trim();

  // 先精确匹配 PulseID，再精确匹配用户名
  const user = db.prepare(`
    SELECT id, pulse_id, username, nickname, avatar, signature FROM users
    WHERE (pulse_id = ? OR username = ?) AND id != ?
    LIMIT 1
  `).get(query, query, req.userId);

  res.json(user ? [{
    id: user.id,
    pulseId: user.pulse_id,
    username: user.username,
    nickname: user.nickname,
    avatar: user.avatar,
    signature: user.signature
  }] : []);
});

// 获取好友列表
router.get('/friends', (req, res) => {
  const friends = db.prepare(`
    SELECT u.id, u.pulse_id, u.username, u.nickname, u.avatar, u.signature, f.created_at as friendsince
    FROM friendships f JOIN users u ON u.id = f.friend_id
    WHERE f.user_id = ? AND f.status = 'accepted'
    ORDER BY u.nickname
  `).all(req.userId);

  res.json(friends.map(f => ({
    id: f.id,
    pulseId: f.pulse_id,
    username: f.username,
    nickname: f.nickname,
    avatar: f.avatar,
    signature: f.signature,
    friendsince: f.friendsince
  })));
});

// 发送好友请求
router.post('/friends/request', (req, res) => {
  const { targetUserId } = req.body;
  if (targetUserId === req.userId) return res.status(400).json({ error: '不能添加自己' });

  const existing = db.prepare(
    'SELECT status FROM friendships WHERE user_id = ? AND friend_id = ?'
  ).get(req.userId, targetUserId);

  if (existing) {
    // 已是好友
    if (existing.status === 'accepted') return res.status(409).json({ error: '已经是好友了' });
    // 已有待处理请求
    if (existing.status === 'pending') return res.status(409).json({ error: '已发送过请求' });
    // 之前被拒绝了，允许重新发送：删除旧记录
    if (existing.status === 'rejected') {
      db.prepare('DELETE FROM friendships WHERE user_id = ? AND friend_id = ?').run(req.userId, targetUserId);
    }
  }

  db.prepare('INSERT INTO friendships (user_id, friend_id, status) VALUES (?, ?, ?)')
    .run(req.userId, targetUserId, 'pending');

  // 实时通知对方有新好友请求
  const sender = db.prepare('SELECT id, pulse_id, username, nickname, avatar FROM users WHERE id = ?').get(req.userId);
  notifyUser(targetUserId, 'friend:request', {
    id: sender.id,
    pulseId: sender.pulse_id,
    username: sender.username,
    nickname: sender.nickname,
    avatar: sender.avatar,
  });

  res.json({ success: true });
});

// 接受好友请求
router.post('/friends/accept', (req, res) => {
  const { fromUserId } = req.body;

  db.prepare("UPDATE friendships SET status = 'accepted' WHERE user_id = ? AND friend_id = ? AND status = 'pending'")
    .run(fromUserId, req.userId);

  // 双向建立关系
  db.prepare("INSERT OR REPLACE INTO friendships (user_id, friend_id, status) VALUES (?, ?, 'accepted')")
    .run(req.userId, fromUserId);

  // 通知请求方好友请求已接受
  notifyUser(fromUserId, 'friend:accepted', { userId: req.userId });

  res.json({ success: true });
});

// 拒绝好友请求
router.post('/friends/reject', (req, res) => {
  const { fromUserId } = req.body;

  db.prepare("UPDATE friendships SET status = 'rejected' WHERE user_id = ? AND friend_id = ? AND status = 'pending'")
    .run(fromUserId, req.userId);

  res.json({ success: true });
});

// 获取好友请求列表
router.get('/friends/requests', (req, res) => {
  const requests = db.prepare(`
    SELECT u.id, u.pulse_id, u.username, u.nickname, u.avatar, u.signature, f.created_at as request_time
    FROM friendships f JOIN users u ON u.id = f.user_id
    WHERE f.friend_id = ? AND f.status = 'pending'
    ORDER BY f.created_at DESC
  `).all(req.userId);

  res.json(requests.map(r => ({
    id: r.id,
    pulseId: r.pulse_id,
    username: r.username,
    nickname: r.nickname,
    avatar: r.avatar,
    signature: r.signature,
    requestTime: r.request_time
  })));
});

// 获取好友请求历史（包括已拒绝和已接受的）
router.get('/friends/requests/history', (req, res) => {
  const requests = db.prepare(`
    SELECT u.id, u.pulse_id, u.username, u.nickname, u.avatar, u.signature, f.status, f.created_at as request_time
    FROM friendships f JOIN users u ON u.id = f.user_id
    WHERE f.friend_id = ? AND f.status IN ('accepted', 'rejected')
    ORDER BY f.created_at DESC
  `).all(req.userId);

  res.json(requests.map(r => ({
    id: r.id,
    pulseId: r.pulse_id,
    username: r.username,
    nickname: r.nickname,
    avatar: r.avatar,
    signature: r.signature,
    status: r.status,
    requestTime: r.request_time
  })));
});

// 上传头像
router.post('/avatar', upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未上传文件' });

  const avatarUrl = `/uploads/avatars/${req.file.filename}`;
  
  // 更新数据库
  db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatarUrl, req.userId);

  res.json({ avatar: avatarUrl });
});

// ========== 用户设置 ==========

// 获取用户设置
router.get('/settings', (req, res) => {
  let settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.userId);
  if (!settings) {
    // 创建默认设置
    db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(req.userId);
    settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.userId);
  }
  res.json({
    onlineVisibility: settings.online_visibility,
    showReadReceipts: !!settings.show_read_receipts,
    showTyping: !!settings.show_typing,
    showLastSeen: !!settings.show_last_seen,
    notiSound: !!settings.noti_sound,
    notiPreview: !!settings.noti_preview,
  });
});

// 更新用户设置
router.put('/settings', (req, res) => {
  const { onlineVisibility, showReadReceipts, showTyping, showLastSeen, notiSound, notiPreview } = req.body;

  // 确保设置行存在
  const existing = db.prepare('SELECT user_id FROM user_settings WHERE user_id = ?').get(req.userId);
  if (!existing) {
    db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(req.userId);
  }

  const updates = [];
  const params = [];
  if (onlineVisibility !== undefined) { updates.push('online_visibility = ?'); params.push(onlineVisibility); }
  if (showReadReceipts !== undefined) { updates.push('show_read_receipts = ?'); params.push(showReadReceipts ? 1 : 0); }
  if (showTyping !== undefined) { updates.push('show_typing = ?'); params.push(showTyping ? 1 : 0); }
  if (showLastSeen !== undefined) { updates.push('show_last_seen = ?'); params.push(showLastSeen ? 1 : 0); }
  if (notiSound !== undefined) { updates.push('noti_sound = ?'); params.push(notiSound ? 1 : 0); }
  if (notiPreview !== undefined) { updates.push('noti_preview = ?'); params.push(notiPreview ? 1 : 0); }

  if (updates.length === 0) return res.status(400).json({ error: '没有可更新的字段' });

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(req.userId);
  db.prepare(`UPDATE user_settings SET ${updates.join(', ')} WHERE user_id = ?`).run(...params);

  // 返回更新后的完整设置
  const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.userId);
  res.json({
    onlineVisibility: settings.online_visibility,
    showReadReceipts: !!settings.show_read_receipts,
    showTyping: !!settings.show_typing,
    showLastSeen: !!settings.show_last_seen,
    notiSound: !!settings.noti_sound,
    notiPreview: !!settings.noti_preview,
  });
});

// ========== 意见反馈 ==========

// 提交反馈
router.post('/feedback', (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: '反馈内容不能为空' });

  const id = uuid();
  db.prepare('INSERT INTO feedback (id, user_id, content) VALUES (?, ?, ?)').run(id, req.userId, content.trim());
  res.json({ id, content: content.trim() });
});

// 获取当前用户的反馈列表
router.get('/feedback', (req, res) => {
  const feedbacks = db.prepare(
    'SELECT id, content, status, admin_reply, created_at FROM feedback WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.userId);
  res.json(feedbacks);
});

export default router;
