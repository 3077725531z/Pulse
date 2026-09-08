import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db, { initDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import userRoutes from './routes/user.js';
import adminRoutes from './routes/admin.js';
import dbViewerRoutes from './routes/db-viewer.js';
import { setupSocket } from './services/socket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });

  app.use(cors());
  app.use(express.json());
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

  // 初始化数据库
  await initDB();

  // 路由
  app.use('/api/auth', authRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/admin', adminRoutes);

  // 数据库可视化
  app.use('/api/db-viewer', dbViewerRoutes);

  // WebSocket
  setupSocket(io);

  // 健康检查
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // 公开接口：获取 App 安装包列表（无需登录，供下载页使用）
  app.get('/api/apps', (req, res) => {
    try {
      const appsDir = path.join(__dirname, '../uploads/apps');
      if (!fs.existsSync(appsDir)) return res.json([]);
      const files = fs.readdirSync(appsDir);
      const list = files.map(f => {
        const filePath = path.join(appsDir, f);
        const stat = fs.statSync(filePath);
        const ext = path.extname(f).toLowerCase();
        let platform = 'unknown';
        if (ext === '.apk') platform = 'android';
        else if (ext === '.ipa') platform = 'ios';
        else if (ext === '.zip') platform = 'zip';
        return {
          filename: f,
          platform,
          size: stat.size,
          uploadedAt: stat.mtime.toISOString(),
          url: `/uploads/apps/${encodeURIComponent(f)}`,
        };
      }).sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      res.json(list);
    } catch (err) {
      res.json([]);
    }
  });

  // 公开接口：获取更新日志（无需登录）
  app.get('/api/changelogs', (req, res) => {
    try {
      const rows = db.prepare('SELECT * FROM changelogs ORDER BY date DESC, created_at DESC').all();
      res.json(rows.map(r => ({
        id: r.id,
        version: r.version,
        date: r.date,
        title: r.title,
        tags: JSON.parse(r.tags || '[]'),
        sections: JSON.parse(r.sections || '[]'),
        createdAt: r.created_at,
      })));
    } catch (err) {
      res.json([]);
    }
  });

  // 公开接口：检查 App 更新（无需登录）
  app.get('/api/app/version/check', (req, res) => {
    try {
      const platform = (req.query.platform || 'android').toLowerCase();
      const currentVersion = (req.query.version || '0.0.0').trim();
      const channel = (req.query.channel || 'stable').toLowerCase();

      // 查询指定平台和渠道的最新版本
      const row = db.prepare(
        `SELECT * FROM app_versions WHERE platform = ? AND channel = ? ORDER BY created_at DESC LIMIT 1`
      ).get(platform, channel);

      if (!row) {
        return res.json({ has_update: false, latest: null });
      }

      // 语义化版本比较
      const compareVersion = (a, b) => {
        const pa = String(a).replace(/[^0-9.]/g, '').split('.').map(Number);
        const pb = String(b).replace(/[^0-9.]/g, '').split('.').map(Number);
        const len = Math.max(pa.length, pb.length);
        for (let i = 0; i < len; i++) {
          const na = pa[i] || 0;
          const nb = pb[i] || 0;
          if (na > nb) return 1;
          if (na < nb) return -1;
        }
        return 0;
      };

      const hasUpdate = compareVersion(row.version, currentVersion) > 0;

      res.json({
        has_update: hasUpdate,
        latest: {
          id: row.id,
          version: row.version,
          platform: row.platform,
          download_url: row.download_url,
          file_size: row.file_size,
          description: row.description,
          force_update: !!row.force_update,
          channel: row.channel,
          created_at: row.created_at,
        },
      });
    } catch (err) {
      console.error('[Version Check] error:', err);
      res.status(500).json({ error: '检查更新失败' });
    }
  });

  // 数据库可视化页面（放在 public 目录外，避免被 vite build 清空）
  const viewsDir = path.join(__dirname, '../views');
  app.get('/db-viewer', (req, res) => {
    res.sendFile(path.join(viewsDir, 'db-viewer.html'));
  });

  // 生产环境：服务前端静态文件
  const publicDir = path.join(__dirname, '../public');
  app.use(express.static(publicDir));

  app.get('*', (req, res) => {
    const indexPath = path.join(publicDir, 'index.html');
    res.sendFile(indexPath, (err) => {
      if (err) {
        res.status(200).send('<h2>Pulse</h2><p>前端尚未构建。请运行 <code>cd frontend && npm run build</code></p><p><a href="/db-viewer">数据库可视化</a></p>');
      }
    });
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Pulse server running on port ${PORT}`);
    console.log(`数据库可视化: http://localhost:${PORT}/db-viewer`);
    console.log(`数据库密码: 30秒刷新，请在管理员控制台查看`);
  });
}

startServer().catch(console.error);
