import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import { ZipArchive } from 'archiver';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import db from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { getCurrentPassword, getTimeRemaining } from './db-viewer.js';

ffmpeg.setFfmpegPath(ffmpegPath.path);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const recordingsDir = path.join(__dirname, '../../uploads/recordings');

// 确保录制目录存在
if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir, { recursive: true });
}

// 配置 multer 用于录制文件上传
const recordingStorage = multer.diskStorage({
  destination: recordingsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `${Date.now()}-${uuid()}${ext}`);
  }
});
const recordingUpload = multer({
  storage: recordingStorage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

const router = Router();

// 简单的管理员中间件（检查 is_admin 字段）
function adminMiddleware(req, res, next) {
  const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.userId);
  if (!user || !user.is_admin) {
    return res.status(403).json({ error: '无管理员权限' });
  }
  next();
}

router.use(authMiddleware);
router.use(adminMiddleware);

// ========== 统计数据 ==========

router.get('/stats', (req, res) => {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const msgCount = db.prepare('SELECT COUNT(*) as count FROM messages').get().count;
  const convCount = db.prepare('SELECT COUNT(*) as count FROM conversations').get().count;
  const callCount = db.prepare("SELECT COUNT(*) as count FROM messages WHERE type IN ('voice', 'video')").get().count;
  const friendCount = db.prepare("SELECT COUNT(*) as count FROM friendships WHERE status = 'accepted'").get().count;
  const recordingCount = db.prepare('SELECT COUNT(*) as count FROM recordings').get().count;
  const feedbackCount = db.prepare('SELECT COUNT(*) as count FROM feedback').get().count;
  const imageCount = db.prepare("SELECT COUNT(*) as count FROM messages WHERE type = 'image'").get().count;
  const fileCount = db.prepare("SELECT COUNT(*) as count FROM messages WHERE type = 'file'").get().count;

  // 最近7天每天新增用户
  const userGrowth = db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as count 
    FROM users 
    WHERE created_at >= datetime('now', '-7 days')
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all();

  // 最近7天每天消息数
  const msgTrend = db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as count 
    FROM messages 
    WHERE created_at >= datetime('now', '-7 days')
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all();

  // 消息类型分布
  const msgTypeDist = db.prepare(`
    SELECT type, COUNT(*) as count FROM messages GROUP BY type
  `).all();

  // 通话类型分布
  const callTypeDist = db.prepare(`
    SELECT type as callType, COUNT(*) as count FROM messages WHERE type IN ('voice', 'video') GROUP BY type
  `).all();

  // 每日通话趋势
  const callTrend = db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as count 
    FROM messages 
    WHERE type IN ('voice', 'video') AND created_at >= datetime('now', '-7 days')
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all();

  // 会话类型分布
  const convTypeDist = db.prepare(`
    SELECT type, COUNT(*) as count FROM conversations GROUP BY type
  `).all();

  // 最近注册用户
  const recentUsers = db.prepare(`
    SELECT nickname, username, avatar, created_at FROM users ORDER BY created_at DESC LIMIT 5
  `).all();

  res.json({
    userCount, msgCount, convCount, callCount, friendCount, recordingCount, feedbackCount,
    imageCount, fileCount,
    userGrowth, msgTrend, msgTypeDist, callTypeDist, callTrend, convTypeDist, recentUsers,
    onlineCount: 0,
  });
});

// ========== 用户管理 ==========

router.get('/users', (req, res) => {
  const users = db.prepare(`
    SELECT id, pulse_id, username, nickname, avatar, signature, theme, is_admin, created_at
    FROM users ORDER BY created_at DESC
  `).all();
  res.json(users.map(u => ({
    id: u.id, pulseId: u.pulse_id, username: u.username, nickname: u.nickname,
    avatar: u.avatar, signature: u.signature, theme: u.theme, isAdmin: !!u.is_admin, createdAt: u.created_at
  })));
});

router.delete('/users/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ success: true });
});

router.put('/users/:id/admin', (req, res) => {
  const { id } = req.params;
  const { isAdmin } = req.body;
  db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(isAdmin ? 1 : 0, id);
  res.json({ success: true });
});

// ========== 聊天记录 ==========

router.get('/conversations', (req, res) => {
  const convs = db.prepare(`
    SELECT c.id, c.type, c.name, c.avatar, c.created_at,
      GROUP_CONCAT(u.nickname, ', ') as members
    FROM conversations c
    JOIN conversation_members cm ON cm.conversation_id = c.id
    JOIN users u ON u.id = cm.user_id
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `).all();
  res.json(convs);
});

router.get('/conversations/:id/messages', (req, res) => {
  const { id } = req.params;
  const { limit = 100, offset = 0 } = req.query;
  const messages = db.prepare(`
    SELECT m.*, u.nickname as sender_name, u.avatar as sender_avatar
    FROM messages m JOIN users u ON u.id = m.sender_id
    WHERE m.conversation_id = ?
    ORDER BY m.created_at ASC
    LIMIT ? OFFSET ?
  `).all(id, parseInt(limit), parseInt(offset));
  res.json(messages);
});

// ========== 好友关系 ==========

router.get('/friendships', (req, res) => {
  const friendships = db.prepare(`
    SELECT u1.nickname as user_name, u1.pulse_id as user_pulse_id,
           u2.nickname as friend_name, u2.pulse_id as friend_pulse_id,
           f.status, f.created_at
    FROM friendships f
    JOIN users u1 ON u1.id = f.user_id
    JOIN users u2 ON u2.id = f.friend_id
    ORDER BY f.created_at DESC
  `).all();
  res.json(friendships);
});

// ========== 通话记录 ==========

router.get('/calls', (req, res) => {
  // 通话记录存储在 messages 表中，type 为 'voice' 或 'video'，content 为 JSON
  const calls = db.prepare(`
    SELECT m.*, u.nickname as sender_name, u.avatar as sender_avatar,
           c.name as conv_name
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.type IN ('voice', 'video')
    ORDER BY m.created_at DESC
    LIMIT 200
  `).all();
  res.json(calls.map(c => {
    let meta = {};
    try { meta = JSON.parse(c.content); } catch {}
    return {
      id: c.id, conversationId: c.conversation_id, convName: c.conv_name,
      senderName: c.sender_name, senderAvatar: c.sender_avatar,
      callType: c.type, duration: meta.duration || 0,
      recordingUrl: meta.recordingUrl || null,
      createdAt: c.created_at
    };
  }));
});

// ========== 通话录制 ==========

// 上传录制文件（前端 CallModal 通话结束后调用）
router.post('/recordings/upload', recordingUpload.single('recording'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未上传文件' });

  const { conversationId, callType, duration } = req.body;
  if (!conversationId || !callType) {
    return res.status(400).json({ error: '缺少参数' });
  }

  const id = uuid();
  db.prepare(`
    INSERT INTO recordings (id, conversation_id, sender_id, call_type, file_path, file_name, file_size, duration, mime_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    conversationId,
    req.userId,
    callType,
    `/uploads/recordings/${req.file.filename}`,
    req.file.originalname,
    req.file.size,
    parseInt(duration) || 0,
    req.file.mimetype
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
      meta.recordingUrl = `/uploads/recordings/${req.file.filename}`;
      db.prepare('UPDATE messages SET content = ? WHERE id = ?').run(JSON.stringify(meta), lastCallMsg.id);
    } catch {}
  }

  res.json({ id, url: `/uploads/recordings/${req.file.filename}` });
});

// 通话录制文件列表
router.get('/recordings', (req, res) => {
  const recordings = db.prepare(`
    SELECT r.*, u.nickname as sender_name, u.avatar as sender_avatar,
           c.name as conv_name,
           (SELECT u2.nickname FROM conversation_members cm2 
            JOIN users u2 ON u2.id = cm2.user_id 
            WHERE cm2.conversation_id = r.conversation_id AND cm2.user_id != r.sender_id LIMIT 1) as peer_name
    FROM recordings r
    JOIN users u ON u.id = r.sender_id
    JOIN conversations c ON c.id = r.conversation_id
    ORDER BY r.created_at DESC
    LIMIT 200
  `).all();
  res.json(recordings.map(r => ({
    id: r.id,
    convName: r.conv_name,
    senderName: r.sender_name,
    peerName: r.peer_name,
    callType: r.call_type,
    filePath: r.file_path,
    fileName: r.file_name,
    fileSize: r.file_size,
    duration: r.duration,
    mimeType: r.mime_type,
    createdAt: r.created_at,
  })));
});

// 下载单个录制文件（支持 ?format=mp3|mp4|webm 转码下载）
router.get('/recordings/:id/download', (req, res) => {
  const recording = db.prepare('SELECT * FROM recordings WHERE id = ?').get(req.params.id);
  if (!recording) return res.status(404).json({ error: '录制文件不存在' });

  const filePath = path.join(__dirname, '../..', recording.file_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '文件已丢失' });

  const isVideo = recording.call_type === 'video';
  const currentExt = path.extname(recording.file_name).replace('.', '').toLowerCase();
  const format = req.query.format;

  // 如果没指定格式或格式和当前一样，直接下载
  if (!format || format === currentExt) {
    const downloadName = `${isVideo ? '视频通话' : '语音通话'}_${recording.created_at.replace(/[: ]/g, '-')}.${currentExt || 'webm'}`;
    return res.download(filePath, downloadName);
  }

  // 需要转码
  const tempFileName = `${uuid()}.${format}`;
  const tempPath = path.join(recordingsDir, tempFileName);
  const downloadName = `${isVideo ? '视频通话' : '语音通话'}_${recording.created_at.replace(/[: ]/g, '-')}.${format}`;

  const cmd = ffmpeg(filePath);
  if (format === 'mp4') {
    cmd.videoCodec('libx264').audioCodec('aac').outputOptions(['-preset fast', '-crf 23', '-movflags +faststart']);
  } else if (format === 'webm') {
    cmd.videoCodec('libvpx-vp9').audioCodec('libopus');
  } else if (format === 'mp3') {
    cmd.noVideo().audioCodec('libmp3lame').audioBitrate('128k');
  } else {
    return res.status(400).json({ error: '不支持的格式' });
  }

  cmd
    .format(format)
    .on('end', () => {
      res.download(tempPath, downloadName, () => {
        fs.unlink(tempPath, () => {});
      });
    })
    .on('error', (err) => {
      console.error('[Recording] Transcode error:', err.message);
      fs.unlink(tempPath, () => {});
      if (!res.headersSent) {
        res.status(500).json({ error: '转码失败' });
      }
    })
    .save(tempPath);
});

// 批量下载录制文件为 ZIP
router.post('/recordings/download-zip', (req, res) => {
  const { ids } = req.body; // 录制文件 ID 数组
  if (!ids || !ids.length) return res.status(400).json({ error: '请选择文件' });

  const placeholders = ids.map(() => '?').join(',');
  const recordings = db.prepare(`SELECT * FROM recordings WHERE id IN (${placeholders})`).all(...ids);
  if (recordings.length === 0) return res.status(404).json({ error: '未找到文件' });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="recordings_${Date.now()}.zip"`);

  const archive = new ZipArchive({ zlib: { level: 6 } });
  archive.pipe(res);

  recordings.forEach(r => {
    const filePath = path.join(__dirname, '../..', r.file_path);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(r.file_name) || '.webm';
      const callName = r.call_type === 'video' ? '视频通话' : '语音通话';
      const dateStr = r.created_at.replace(/[: ]/g, '-');
      archive.file(filePath, { name: `${callName}_${dateStr}${ext}` });
    }
  });

  archive.finalize();
});

// 删除录制文件
router.delete('/recordings/:id', (req, res) => {
  const recording = db.prepare('SELECT * FROM recordings WHERE id = ?').get(req.params.id);
  if (!recording) return res.status(404).json({ error: '录制文件不存在' });

  // 删除物理文件
  const filePath = path.join(__dirname, '../..', recording.file_path);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  db.prepare('DELETE FROM recordings WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ========== 系统公告 ==========

router.get('/announcements', (req, res) => {
  const announcements = db.prepare('SELECT * FROM announcements ORDER BY created_at DESC').all();
  res.json(announcements);
});

router.post('/announcements', (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: '标题和内容不能为空' });
  const id = uuid();
  db.prepare('INSERT INTO announcements (id, title, content) VALUES (?, ?, ?)').run(id, title.trim(), content.trim());
  res.json({ id, title: title.trim(), content: content.trim() });
});

router.put('/announcements/:id', (req, res) => {
  const { title, content } = req.body;
  const existing = db.prepare('SELECT id FROM announcements WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '公告不存在' });
  db.prepare('UPDATE announcements SET title = ?, content = ? WHERE id = ?').run(title.trim(), content.trim(), req.params.id);
  res.json({ success: true });
});

router.delete('/announcements/:id', (req, res) => {
  db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ========== 反馈管理 ==========

router.get('/feedback', (req, res) => {
  const feedbacks = db.prepare(`
    SELECT f.*, u.nickname, u.username, u.avatar 
    FROM feedback f JOIN users u ON u.id = f.user_id 
    ORDER BY f.created_at DESC
  `).all();
  res.json(feedbacks.map(f => ({
    id: f.id,
    userId: f.user_id,
    content: f.content,
    status: f.status,
    adminReply: f.admin_reply,
    createdAt: f.created_at,
    nickname: f.nickname,
    username: f.username,
    avatar: f.avatar,
  })));
});

router.put('/feedback/:id/reply', (req, res) => {
  const { adminReply } = req.body;
  if (!adminReply || !adminReply.trim()) return res.status(400).json({ error: '回复内容不能为空' });
  const existing = db.prepare('SELECT id FROM feedback WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '反馈不存在' });
  db.prepare("UPDATE feedback SET admin_reply = ?, status = 'replied' WHERE id = ?").run(adminReply.trim(), req.params.id);
  res.json({ success: true });
});

router.put('/feedback/:id/status', (req, res) => {
  const { status } = req.body;
  if (!['pending', 'read', 'replied'].includes(status)) return res.status(400).json({ error: '无效状态' });
  db.prepare('UPDATE feedback SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

router.delete('/feedback/:id', (req, res) => {
  db.prepare('DELETE FROM feedback WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// 获取数据库可视化密码（仅管理员，每30秒刷新）
router.get('/db-viewer-password', (req, res) => {
  res.json({ password: getCurrentPassword(), remaining: getTimeRemaining() });
});

export default router;
