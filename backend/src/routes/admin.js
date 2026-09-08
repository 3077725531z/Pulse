import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import { ZipArchive } from 'archiver';
import AdmZip from 'adm-zip';
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import db from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { getCurrentPassword, getTimeRemaining } from './db-viewer.js';

// 优先使用系统 ffmpeg，找不到时录制功能不可用但服务能启动
let resolvedFfmpegPath = null;
try {
  const sysPath = execSync('which ffmpeg 2>/dev/null', { encoding: 'utf8' }).trim();
  if (sysPath && fs.existsSync(sysPath)) resolvedFfmpegPath = sysPath;
} catch {}
if (!resolvedFfmpegPath) {
  // 兜底：尝试 npm 包的 ffmpeg 路径（动态 import，失败不影响启动）
  try {
    const ffmpegInstaller = await import('@ffmpeg-installer/ffmpeg');
    if (ffmpegInstaller?.path && fs.existsSync(ffmpegInstaller.path)) {
      resolvedFfmpegPath = ffmpegInstaller.path;
    }
  } catch {}
}
if (resolvedFfmpegPath) {
  try {
    ffmpeg.setFfmpegPath(resolvedFfmpegPath);
    console.log('[admin] Using ffmpeg:', resolvedFfmpegPath);
  } catch (e) {
    console.warn('[admin] ffmpeg path set failed, recording disabled:', e.message);
  }
} else {
  console.warn('[admin] ffmpeg not found, recording feature disabled');
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const recordingsDir = path.join(__dirname, '../../uploads/recordings');

// 确保录制目录存在
try {
  if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir, { recursive: true });
  }
} catch (e) {
  console.warn('[admin] Cannot create recordings dir:', e.message);
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

// ========== 部署功能：代码包上传、App 安装包上传、重启 ==========
const updatesDir = path.join(__dirname, '../../uploads/updates');
const appsDir = path.join(__dirname, '../../uploads/apps');
try {
  if (!fs.existsSync(updatesDir)) fs.mkdirSync(updatesDir, { recursive: true });
  if (!fs.existsSync(appsDir)) fs.mkdirSync(appsDir, { recursive: true });
} catch (e) {
  console.warn('[admin] Cannot create upload dirs:', e.message);
}

// 代码包上传（zip）：保存到临时目录后解压替换
const codeUpload = multer({
  storage: multer.diskStorage({
    destination: updatesDir,
    filename: (req, file, cb) => {
      const safeBase = path.basename(file.originalname).replace(/[^\w.-]/g, '_');
      cb(null, `${Date.now()}-${safeBase}`);
    },
  }),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.zip') return cb(new Error('仅支持 .zip 文件'));
    cb(null, true);
  },
});

// App 安装包上传（apk/ipa）
const appPackageUpload = multer({
  storage: multer.diskStorage({
    destination: appsDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.apk';
      const base = path.basename(file.originalname, ext).replace(/[^\w.-]/g, '_');
      cb(null, `${base}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.apk', '.ipa', '.zip'].includes(ext)) {
      return cb(new Error('仅支持 .apk / .ipa / .zip 文件'));
    }
    cb(null, true);
  },
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

// ========== 更新日志管理 ==========

function parseChangelog(row) {
  return {
    id: row.id,
    version: row.version,
    date: row.date,
    title: row.title,
    tags: JSON.parse(row.tags || '[]'),
    sections: JSON.parse(row.sections || '[]'),
    createdAt: row.created_at,
  };
}

router.get('/changelogs', (req, res) => {
  const rows = db.prepare('SELECT * FROM changelogs ORDER BY date DESC, created_at DESC').all();
  res.json(rows.map(parseChangelog));
});

router.post('/changelogs', (req, res) => {
  const { version, date, title, tags, sections } = req.body;
  if (!version || !date) return res.status(400).json({ error: '版本号和日期不能为空' });
  const id = uuid();
  db.prepare('INSERT INTO changelogs (id, version, date, title, tags, sections) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, version.trim(), date.trim(), (title || '').trim(),
         JSON.stringify(tags || []), JSON.stringify(sections || []));
  const row = db.prepare('SELECT * FROM changelogs WHERE id = ?').get(id);
  res.json(parseChangelog(row));
});

router.put('/changelogs/:id', (req, res) => {
  const { version, date, title, tags, sections } = req.body;
  const existing = db.prepare('SELECT id FROM changelogs WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '更新日志不存在' });
  db.prepare('UPDATE changelogs SET version = ?, date = ?, title = ?, tags = ?, sections = ? WHERE id = ?')
    .run((version || '').trim(), (date || '').trim(), (title || '').trim(),
         JSON.stringify(tags || []), JSON.stringify(sections || []), req.params.id);
  const row = db.prepare('SELECT * FROM changelogs WHERE id = ?').get(req.params.id);
  res.json(parseChangelog(row));
});

router.delete('/changelogs/:id', (req, res) => {
  db.prepare('DELETE FROM changelogs WHERE id = ?').run(req.params.id);
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

// ========== 部署功能 ==========

// 工具：安全地解析 zip 条目路径，防止路径穿越攻击
function safeJoinPath(baseDir, targetPath) {
  const normalized = path.normalize(targetPath).replace(/^([/\\]|\.\.\/|\.\.\\)+/, '');
  const resolved = path.resolve(baseDir, normalized);
  if (!resolved.startsWith(path.resolve(baseDir))) {
    throw new Error(`检测到路径穿越：${targetPath}`);
  }
  return resolved;
}

// 工具：递归删除目录
function rmrf(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  for (const entry of fs.readdirSync(dirPath)) {
    const full = path.join(dirPath, entry);
    if (fs.statSync(full).isDirectory()) {
      rmrf(full);
    } else {
      try { fs.unlinkSync(full); } catch {}
    }
  }
  try { fs.rmdirSync(dirPath); } catch {}
}

// 上传代码包并解压
// 接收字段：file（zip）、target（可选，'backend' | 'frontend' | 'root'，默认 root）
router.post('/deploy/code', codeUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未上传文件' });

  const target = (req.body.target || 'root').toLowerCase();
  const validTargets = { root: 'root', backend: 'backend', frontend: 'frontend' };
  if (!validTargets[target]) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'target 必须是 root / backend / frontend' });
  }

  const projectRoot = path.join(__dirname, '../../..');
  const targetDir = target === 'root'
    ? projectRoot
    : path.join(projectRoot, target);

  let tempExtractDir = null;
  try {
    const zip = new AdmZip(req.file.path);
    // 安全检查：每个条目路径都不能逃逸目标目录
    const entries = zip.getEntries();
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const resolved = safeJoinPath(targetDir, entry.entryName);
      // 检查解析后的路径是否在 targetDir 内
      if (!resolved.startsWith(path.resolve(targetDir))) {
        throw new Error(`非法的 zip 条目路径：${entry.entryName}`);
      }
    }

    // 创建临时解压目录，先解压到临时目录再原子替换
    tempExtractDir = path.join(updatesDir, `extract-${Date.now()}-${uuid()}`);
    fs.mkdirSync(tempExtractDir, { recursive: true });
    zip.extractAllTo(tempExtractDir, true);

    // 清空目标目录（保留 .git, node_modules, uploads）
    const preserve = new Set(['.git', 'node_modules', 'uploads', '.env']);
    for (const entry of fs.readdirSync(targetDir)) {
      if (preserve.has(entry)) continue;
      const full = path.join(targetDir, entry);
      if (fs.statSync(full).isDirectory()) {
        rmrf(full);
      } else {
        try { fs.unlinkSync(full); } catch {}
      }
    }

    // 将解压后的内容移动到目标目录
    // 如果 zip 内部有一个顶层文件夹（比如 Pulse-main/），需要进入一层
    let srcDir = tempExtractDir;
    const extractedEntries = fs.readdirSync(tempExtractDir);
    // 检查是否只有一个目录且没有 package.json 等标志性文件
    if (extractedEntries.length === 1) {
      const onlyEntry = path.join(tempExtractDir, extractedEntries[0]);
      if (fs.statSync(onlyEntry).isDirectory()) {
        srcDir = onlyEntry;
      }
    }

    for (const entry of fs.readdirSync(srcDir)) {
      if (preserve.has(entry)) continue;
      const src = path.join(srcDir, entry);
      const dst = path.join(targetDir, entry);
      try {
        fs.renameSync(src, dst);
      } catch {
        // 跨设备复制（move 跨分区时 fallback）
        fs.cpSync(src, dst, { recursive: true });
        rmrf(src);
      }
    }

    // 清理
    try { rmrf(tempExtractDir); } catch {}
    try { fs.unlinkSync(req.file.path); } catch {}

    res.json({
      success: true,
      message: `代码包已解压到 ${target} 目录，请重启系统使更改生效`,
      target,
      fileCount: entries.filter(e => !e.isDirectory).length,
    });
  } catch (err) {
    // 清理临时文件
    if (tempExtractDir) try { rmrf(tempExtractDir); } catch {}
    try { fs.unlinkSync(req.file.path); } catch {}
    console.error('[Deploy] code upload failed:', err);
    res.status(500).json({ error: err.message || '代码包解压失败' });
  }
});

// 上传 App 安装包
router.post('/deploy/app', appPackageUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未上传文件' });

  const { version, description, platform } = req.body;
  const ext = path.extname(req.file.originalname).toLowerCase();
  const detectedPlatform = platform || (ext === '.ipa' ? 'ios' : ext === '.apk' ? 'android' : 'unknown');

  res.json({
    success: true,
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    url: `/uploads/apps/${req.file.filename}`,
    platform: detectedPlatform,
    version: version || '',
    description: description || '',
    uploadedAt: new Date().toISOString(),
  });
});

// 获取 App 安装包列表
router.get('/deploy/apps', (req, res) => {
  try {
    const files = fs.readdirSync(appsDir).filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ['.apk', '.ipa', '.zip'].includes(ext);
    });

    const result = files.map(f => {
      const fullPath = path.join(appsDir, f);
      const stat = fs.statSync(fullPath);
      const ext = path.extname(f).toLowerCase();
      const platform = ext === '.ipa' ? 'ios' : ext === '.apk' ? 'android' : 'zip';
      return {
        filename: f,
        size: stat.size,
        platform,
        url: `/uploads/apps/${f}`,
        uploadedAt: stat.mtime.toISOString(),
      };
    }).sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: '获取列表失败' });
  }
});

// 删除 App 安装包
router.delete('/deploy/apps/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const fullPath = path.join(appsDir, filename);

  // 路径安全检查
  if (!fullPath.startsWith(path.resolve(appsDir))) {
    return res.status(400).json({ error: '非法的文件名' });
  }
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: '文件不存在' });
  }

  try {
    fs.unlinkSync(fullPath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '删除失败' });
  }
});

// 重启系统：触发后台进程，本进程将在 1 秒后退出
router.post('/deploy/restart', (req, res) => {
  try {
    const restartScript = path.join(__dirname, '../restart.js');

    // 启动一个独立的子进程执行重启，解耦父进程生命周期
    const child = spawn('node', [restartScript], {
      cwd: path.join(__dirname, '../..'),
      detached: true,
      stdio: 'ignore',
      shell: false,
      windowsHide: true,
    });
    child.unref();

    res.json({
      success: true,
      message: '系统将在约 1 秒后重启，期间服务会短暂中断',
      pid: child.pid,
    });

    // 1 秒后退出当前进程，让外部守护进程（或 PM2）拉起
    setTimeout(() => {
      console.log('[Deploy] Restarting server by admin request...');
      process.exit(0);
    }, 1000);
  } catch (err) {
    console.error('[Deploy] restart failed:', err);
    res.status(500).json({ error: '重启失败：' + (err.message || '未知错误') });
  }
});

// 构建前端：触发 npm run build，输出到 backend/public
// 通过 SSE（Server-Sent Events）实时推送构建日志
router.get('/deploy/build', (req, res) => {
  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // 禁用 Nginx 缓冲，确保实时推送

  const frontendDir = path.join(__dirname, '../../../frontend');
  const isWin = process.platform === 'win32';
  const npmCmd = isWin ? 'npm.cmd' : 'npm';

  const send = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  send('log', `>>> 开始构建前端（目录：${frontendDir}）\n`);
  send('log', `>>> 执行命令：npm run build\n`);

  const child = spawn(npmCmd, ['run', 'build'], {
    cwd: frontendDir,
    shell: true,
    stdio: 'pipe',
    windowsHide: false,
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    stdout += text;
    send('log', text);
  });

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    stderr += text;
    send('log', text);
  });

  child.on('error', (err) => {
    send('error', `进程启动失败：${err.message}`);
    send('done', JSON.stringify({ success: false, code: -1 }));
    res.end();
  });

  child.on('close', (code) => {
    if (code === 0) {
      send('log', `\n>>> 构建成功！产物已输出到 backend/public\n`);
      send('done', JSON.stringify({ success: true, code }));
    } else {
      send('log', `\n>>> 构建失败，退出码 ${code}\n`);
      send('done', JSON.stringify({ success: false, code }));
    }
    res.end();
  });

  // 客户端断开连接时清理
  req.on('close', () => {
    try { child.kill(); } catch {}
  });
});

// 获取部署状态（最近构建日志文件、应用版本等）
router.get('/deploy/status', (req, res) => {
  try {
    const publicDir = path.join(__dirname, '../../public');
    const indexPath = path.join(publicDir, 'index.html');

    let frontendBuilt = false;
    let buildTime = null;
    try {
      const stat = fs.statSync(indexPath);
      frontendBuilt = true;
      buildTime = stat.mtime.toISOString();
    } catch {}

    // 读取后端 package.json 版本
    let version = '';
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
      version = pkg.version || '';
    } catch {}

    // App 安装包统计
    let appCount = 0;
    let totalAppSize = 0;
    try {
      const files = fs.readdirSync(appsDir);
      for (const f of files) {
        const stat = fs.statSync(path.join(appsDir, f));
        totalAppSize += stat.size;
        appCount++;
      }
    } catch {}

    res.json({
      frontendBuilt,
      buildTime,
      version,
      appCount,
      totalAppSize,
      appsUrl: '/uploads/apps/',
    });
  } catch (err) {
    res.status(500).json({ error: '获取状态失败' });
  }
});

export default router;
