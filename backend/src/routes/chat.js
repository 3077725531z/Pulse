import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { execSync } from 'child_process';
import db from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { notifyUser } from '../services/socket.js';

// ffmpeg 可选加载：优先用系统 ffmpeg，找不到则跳过（录制功能不可用，但服务能启动）
let ffmpegReady = false;
try {
  const sysPath = execSync('which ffmpeg 2>/dev/null', { encoding: 'utf8' }).trim();
  if (sysPath && fs.existsSync(sysPath)) {
    ffmpeg.setFfmpegPath(sysPath);
    ffmpegReady = true;
    console.log('[ffmpeg] Using system ffmpeg:', sysPath);
  } else {
    // 尝试 npm 包的 ffmpeg（直接用路径，不走 import）
    const candidates = [
      '/www/wwwroot/pulse/backend/node_modules/@ffmpeg-installer/linux-x64/ffmpeg',
      '/usr/local/bin/ffmpeg',
      '/usr/bin/ffmpeg',
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        ffmpeg.setFfmpegPath(p);
        ffmpegReady = true;
        console.log('[ffmpeg] Found ffmpeg at:', p);
        break;
      }
    }
  }
} catch (e) {
  console.warn('[ffmpeg] ffmpeg not found, recording feature will be disabled');
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 确保录制目录存在
const recordingsDir = path.join(__dirname, '../../uploads/recordings');
try {
  if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir, { recursive: true });
  }
} catch (e) {
  console.warn('[chat] Cannot create recordings dir:', e.message);
}

const router = Router();
router.use(authMiddleware);

// 配置 multer 用于文件上传
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/files'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${uuid()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// 获取会话列表
router.get('/conversations', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, cm.role,
      (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_time,
      (SELECT sender_id FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_sender_id,
      (SELECT type FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_type,
      (SELECT u.nickname FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_sender_name,
      (SELECT COUNT(*) FROM conversation_members WHERE conversation_id = c.id) as member_count
    FROM conversation_members cm
    JOIN conversations c ON c.id = cm.conversation_id
    WHERE cm.user_id = ?
    ORDER BY last_time DESC
  `).all(req.userId);

  // 补充会话名称（私聊取对方昵称）
  const result = rows.map(conv => {
    if (conv.type === 'private') {
      const other = db.prepare(`
        SELECT u.id, u.nickname, u.avatar, u.signature
        FROM conversation_members cm JOIN users u ON u.id = cm.user_id
        WHERE cm.conversation_id = ? AND cm.user_id != ?
      `).get(conv.id, req.userId);
      return { ...conv, name: other?.nickname, avatar: other?.avatar, other };
    }
    return conv;
  });

  res.json(result);
});

// 获取消息
router.get('/messages/:conversationId', (req, res) => {
  const { conversationId } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const before = req.query.before;

  let query = `
    SELECT m.*, u.nickname as sender_name, u.avatar as sender_avatar
    FROM messages m JOIN users u ON u.id = m.sender_id
    WHERE m.conversation_id = ?
  `;
  const params = [conversationId];

  if (before) {
    query += ' AND m.created_at < ?';
    params.push(before);
  }

  query += ' ORDER BY m.created_at DESC LIMIT ?';
  params.push(limit);

  const messages = db.prepare(query).all(...params);
  res.json(messages.reverse());
});

// 发送消息
router.post('/messages', (req, res) => {
  const { conversationId, type = 'text', content } = req.body;
  if (!conversationId || !content) {
    return res.status(400).json({ error: '缺少参数' });
  }

  // 验证是否是会话成员
  const member = db.prepare(
    'SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?'
  ).get(conversationId, req.userId);
  if (!member) return res.status(403).json({ error: '无权访问该会话' });

  const id = uuid();
  db.prepare(
    'INSERT INTO messages (id, conversation_id, sender_id, type, content) VALUES (?, ?, ?, ?, ?)'
  ).run(id, conversationId, req.userId, type, content);

  // 为会话中的其他成员创建 message_status
  const members = db.prepare(
    'SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ?'
  ).all(conversationId, req.userId);
  members.forEach(m => {
    db.prepare(
      'INSERT OR IGNORE INTO message_status (message_id, user_id, status) VALUES (?, ?, ?)'
    ).run(id, m.user_id, 'sent');
  });

  const message = db.prepare(`
    SELECT m.*, u.nickname as sender_name, u.avatar as sender_avatar
    FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?
  `).get(id);

  res.json(message);
});

// 创建私聊
router.post('/private', (req, res) => {
  const { targetUserId } = req.body;

  // 检查是否已存在私聊
  const existing = db.prepare(`
    SELECT c.id FROM conversations c
    JOIN conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = ?
    JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = ?
    WHERE c.type = 'private'
  `).get(req.userId, targetUserId);

  if (existing) return res.json({ id: existing.id });

  const id = uuid();
  db.prepare("INSERT INTO conversations (id, type) VALUES (?, 'private')").run(id);
  db.prepare('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)').run(id, req.userId);
  db.prepare('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)').run(id, targetUserId);

  res.json({ id });
});

// 创建群聊
router.post('/group', (req, res) => {
  const { name, memberIds = [] } = req.body;
  if (!name) return res.status(400).json({ error: '群名不能为空' });

  const id = uuid();
  db.prepare("INSERT INTO conversations (id, type, name) VALUES (?, 'group', ?)").run(id, name);
  db.prepare("INSERT INTO conversation_members (conversation_id, user_id, role) VALUES (?, ?, 'owner')")
    .run(id, req.userId);

  for (const memberId of memberIds) {
    db.prepare('INSERT OR IGNORE INTO conversation_members (conversation_id, user_id) VALUES (?, ?)')
      .run(id, memberId);
  }

  // 实时通知被邀请的成员加入新群房间，避免他们错过群内首条消息
  const creator = db.prepare('SELECT id, pulse_id, username, nickname, avatar FROM users WHERE id = ?').get(req.userId);
  for (const memberId of memberIds) {
    if (memberId === req.userId) continue;
    notifyUser(memberId, 'group:joined', {
      conversationId: id,
      name,
      creator: creator && {
        id: creator.id,
        pulseId: creator.pulse_id,
        username: creator.username,
        nickname: creator.nickname,
        avatar: creator.avatar,
      },
    });
  }

  res.json({ id });
});

// 获取群成员列表
router.get('/group/:conversationId/members', (req, res) => {
  const { conversationId } = req.params;
  // 校验是否是群成员
  const me = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?')
    .get(conversationId, req.userId);
  if (!me) return res.status(403).json({ error: '无权访问该会话' });

  const members = db.prepare(`
    SELECT u.id, u.pulse_id, u.username, u.nickname, u.avatar, u.signature, cm.role, cm.joined_at
    FROM conversation_members cm JOIN users u ON u.id = cm.user_id
    WHERE cm.conversation_id = ?
    ORDER BY cm.role DESC, cm.joined_at
  `).all(conversationId);

  res.json(members.map(m => ({
    id: m.id,
    pulseId: m.pulse_id,
    username: m.username,
    nickname: m.nickname,
    avatar: m.avatar,
    signature: m.signature,
    role: m.role,
    joinedAt: m.joined_at,
  })));
});

// 文件上传
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未上传文件' });

  const fileUrl = `/uploads/files/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// 通话录制上传（普通用户也可以上传）
const recordingStorage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/recordings'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `${Date.now()}-${uuid()}${ext}`);
  }
});
const recordingUpload = multer({
  storage: recordingStorage,
  limits: { fileSize: 500 * 1024 * 1024 },
});

router.post('/recordings/upload', recordingUpload.single('recording'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未上传文件' });

  const { conversationId, callType, duration } = req.body;
  if (!conversationId || !callType) {
    return res.status(400).json({ error: '缺少参数' });
  }

  const webmPath = req.file.path;
  const isVideo = callType === 'video';
  const outputExt = isVideo ? '.mp4' : '.mp3';
  const outputFileName = req.file.filename.replace(/\.[^.]+$/, outputExt);
  const outputPath = path.join(path.dirname(webmPath), outputFileName);

  // 转码 WebM → MP4/MP3
  try {
    if (!ffmpegReady) throw new Error('ffmpeg not available');
    await new Promise((resolve, reject) => {
      const cmd = ffmpeg(webmPath);
      if (isVideo) {
        cmd
          .videoCodec('libx264')
          .audioCodec('aac')
          .videoBitrate('4000k')
          .audioBitrate('128k')
          .outputOptions(['-preset fast', '-crf 23', '-movflags +faststart']);
      } else {
        cmd
          .noVideo()
          .audioCodec('libmp3lame')
          .audioBitrate('128k');
      }
      cmd
        .format(isVideo ? 'mp4' : 'mp3')
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .save(outputPath);
    });

    // 删除原始 webm 文件
    fs.unlinkSync(webmPath);

    // 用转码后的文件信息更新数据库
    const stat = fs.statSync(outputPath);
    const finalPath = `/uploads/recordings/${outputFileName}`;
    const finalName = req.file.originalname.replace(/\.[^.]+$/, outputExt);

    const id = uuid();
    db.prepare(`
      INSERT INTO recordings (id, conversation_id, sender_id, call_type, file_path, file_name, file_size, duration, mime_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, conversationId, req.userId, callType,
      finalPath, finalName, stat.size,
      parseInt(duration) || 0, isVideo ? 'video/mp4' : 'audio/mp3'
    );

    // 同时更新通话消息中的 recordingUrl
    const lastCallMsg = db.prepare(`
      SELECT id, content FROM messages 
      WHERE conversation_id = ? AND sender_id = ? AND type IN ('voice', 'video')
      ORDER BY created_at DESC LIMIT 1
    `).get(conversationId, req.userId);

    if (lastCallMsg) {
      try {
        const meta = JSON.parse(lastCallMsg.content);
        meta.recordingId = id;
        meta.recordingUrl = finalPath;
        db.prepare('UPDATE messages SET content = ? WHERE id = ?').run(JSON.stringify(meta), lastCallMsg.id);
      } catch {}
    }

    res.json({ id, url: finalPath });
  } catch (err) {
    console.error('[Recording] Transcode failed:', err.message);
    // 转码失败，保留原始 webm 文件
    const id = uuid();
    const webmUrl = `/uploads/recordings/${req.file.filename}`;
    db.prepare(`
      INSERT INTO recordings (id, conversation_id, sender_id, call_type, file_path, file_name, file_size, duration, mime_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, conversationId, req.userId, callType,
      webmUrl, req.file.originalname, req.file.size,
      parseInt(duration) || 0, req.file.mimetype
    );
    res.json({ id, url: webmUrl });
  }
});

// 获取已读状态
router.get('/read-status/:conversationId', (req, res) => {
  const { conversationId } = req.params;

  // 检查我发的最后一条消息是否被其他成员已读
  const myLastMsg = db.prepare(`
    SELECT id FROM messages WHERE conversation_id = ? AND sender_id = ? ORDER BY created_at DESC LIMIT 1
  `).get(conversationId, req.userId);

  if (!myLastMsg) return res.json({ read: false });

  const readStatus = db.prepare(`
    SELECT status FROM message_status WHERE message_id = ? AND user_id != ?
  `).all(myLastMsg.id, req.userId);

  const allRead = readStatus.length > 0 && readStatus.every(s => s.status === 'read');

  // 检查对方发的最后一条消息是否已被我已读
  const theirLastMsg = db.prepare(`
    SELECT id FROM messages WHERE conversation_id = ? AND sender_id != ? ORDER BY created_at DESC LIMIT 1
  `).get(conversationId, req.userId);

  let theirRead = false;
  if (theirLastMsg) {
    const myStatus = db.prepare(`
      SELECT status FROM message_status WHERE message_id = ? AND user_id = ?
    `).get(theirLastMsg.id, req.userId);
    theirRead = myStatus?.status === 'read';
  }

  res.json({ read: allRead, theirRead });
});

// 系统公告（所有登录用户可读）
router.get('/announcements', (req, res) => {
  const announcements = db.prepare('SELECT * FROM announcements ORDER BY created_at DESC').all();
  res.json(announcements);
});

export default router;
