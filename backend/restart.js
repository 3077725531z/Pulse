// Pulse 重启脚本：被 admin.js 的 /deploy/restart 路由以独立 detached 子进程方式启动
// 作用：等待旧进程退出，然后重新启动后端服务
// 跨平台支持：Windows 与 Linux 均通过 npm start 启动

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = __dirname; // backend/ 目录
const projectRoot = path.join(backendDir, '..');

async function restart() {
  // 等待父进程退出
  await new Promise(r => setTimeout(r, 1500));

  // 记录重启日志（便于排查）
  const logPath = path.join(projectRoot, 'uploads', 'restart.log');
  try {
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] Restart triggered by admin\n`);
  } catch {}

  // 在 backend 目录下执行 npm start
  const isWin = process.platform === 'win32';
  const child = spawn(isWin ? 'npm.cmd' : 'npm', ['start'], {
    cwd: backendDir,
    detached: true,
    stdio: 'inherit',
    shell: false,
    windowsHide: false,
  });

  child.unref();

  // 自身退出，让子进程接管
  setTimeout(() => process.exit(0), 500);
}

restart().catch(err => {
  console.error('[Restart] Failed:', err);
  process.exit(1);
});
