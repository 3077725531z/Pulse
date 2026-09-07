import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDB } from './config/db.js';
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
