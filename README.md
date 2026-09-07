# Pulse

> 让对话有温度 —— 聊天视频语音文字 App

Pulse 是一个全功能即时通讯应用，支持文字聊天、语音通话、视频通话。采用清新简约的设计风格，注重用户体验和安全性。

## 功能特性

### 用户端
- **注册登录** — 用户名查重、QQ邮箱验证码、密码强度检测、数字计算验证码
- **即时聊天** — 私聊消息、已读状态、在线状态
- **音视频通话** — 语音/视频通话（WebRTC + Socket.IO）
- **个人中心** — 头像上传、资料编辑、主题切换
- **好友系统** — 添加好友、好友列表

### 管理员端
- 管理员总览面板
- 动态数据库密码（30秒自动刷新）

### 数据库可视化
- 独立访问页面，密码认证
- 表数据增删改查
- SQL 命令行
- 表描述动态管理

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + Vite + Tailwind CSS + Zustand |
| 后端 | Node.js + Express + Socket.IO |
| 数据库 | sql.js (SQLite) |
| 认证 | JWT |
| 邮件 | nodemailer (QQ邮箱 SMTP) |

## 快速开始

### 前置条件
- Node.js >= 18
- npm >= 9

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/3077725531z/Pulse.git
cd Pulse

# 安装后端依赖
cd backend
npm install

# 启动后端（默认端口 3000）
npm run dev

# 新终端，安装前端依赖
cd ../frontend
npm install

# 启动前端（默认端口 5173）
npm run dev
```

### 环境变量

在 `backend/.env` 中配置：

```env
# JWT 密钥
JWT_SECRET=your-secret-key

# QQ邮箱 SMTP（邮箱验证码功能）
SMTP_EMAIL=your-qq-email@qq.com
SMTP_PASS=your-qq-smtp-auth-code
```

## 生产部署

### 一键部署（推荐）

项目根目录提供了 `deploy.sh` 脚本，会自动构建前端、安装后端依赖、用 PM2 启动守护进程：

```bash
# 赋予执行权限（首次）
chmod +x deploy.sh

# 执行部署
./deploy.sh
```

脚本执行流程：
1. 构建前端（`vite.config.js` 已配置 `outDir: '../backend/public'`，产物直接输出到 `backend/public/`）
2. 安装后端依赖（production 模式）
3. 检测 PM2 是否安装，未安装则自动全局安装
4. 用 PM2 启动应用（首次）或零停机 reload（已存在）
5. 设置开机自启（root 用户自动，非 root 用户会输出提示命令）

### PM2 配置说明

部署脚本使用 PM2 作为 Node.js 进程守护器，关键作用：

| 功能 | 命令 | 说明 |
|------|------|------|
| 启动 | `pm2 start src/index.js --name pulse` | 首次启动应用 |
| 状态 | `pm2 status` | 查看所有进程运行状态 |
| 日志 | `pm2 logs pulse` | 实时查看应用日志（输出和错误） |
| 重启 | `pm2 restart pulse` | 强制重启（会断开当前所有连接） |
| 零停机重载 | `pm2 reload pulse` | cluster 模式下零停机重启 |
| 停止 | `pm2 stop pulse` | 停止应用（不删除配置） |
| 删除 | `pm2 delete pulse` | 从 PM2 进程列表中删除 |
| 开机自启 | `pm2 startup` + `pm2 save` | 服务器重启后自动拉起 |

**关键点**：管理员端「部署」标签的「重启系统」按钮依赖 PM2 守护进程。
当管理员触发重启时，应用进程会主动 `process.exit(0)` 退出，PM2 检测到进程退出后会自动重新拉起，
从而实现一键重启。**如果不使用 PM2（或宝塔 Node 进程管理器），手动 `node src/index.js` 启动无法自动恢复**。

### 宝塔面板部署

如果使用宝塔（BT Panel）部署，可以不使用 PM2 命令行，直接用宝塔自带的 Node 进程管理器：

1. 安装宝塔 Node.js 模块（软件商店 → Node 进程管理器）
2. 添加项目：
   - 项目目录：`/www/wwwroot/Pulse/backend`
   - 启动文件：`src/index.js`
   - 端口：`3000`
   - Node 版本：≥ 18
3. 启动项目（宝塔会自动守护进程）
4. 配置反向代理（站点 → 设置 → 反向代理 → 添加 `localhost:3000`）
5. 配置 SSL 证书（Let's Encrypt 免费证书，强制 HTTPS）

宝塔守护进程模式下，管理员端的「重启系统」按钮同样有效：宝塔 Node 进程管理器会检测到进程退出并自动拉起。

### HTTPS 配置（必需）

手机端扫码添加好友功能依赖 `getUserMedia` 摄像头权限，**必须通过 HTTPS 访问**。生产部署时请配置：

```nginx
# Nginx 反向代理配置示例
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # 前端静态文件
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket 透传（Socket.IO 必需）
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## 项目结构

```
Pulse/
├── backend/
│   ├── public/
│   │   └── db-viewer.html       # 数据库可视化页面
│   ├── src/
│   │   ├── config/db.js          # 数据库配置与初始化
│   │   ├── middleware/auth.js    # JWT 认证中间件
│   │   ├── routes/
│   │   │   ├── auth.js           # 注册/登录/验证码
│   │   │   ├── admin.js          # 管理员路由
│   │   │   ├── chat.js           # 聊天路由
│   │   │   ├── db-viewer.js      # 数据库可视化API
│   │   │   └── user.js           # 用户路由
│   │   ├── services/socket.js    # Socket.IO 服务
│   │   └── index.js              # 入口文件
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── SlideCaptcha.jsx  # 数字计算验证码组件
│   │   ├── pages/                # 页面组件
│   │   ├── store/                # Zustand 状态管理
│   │   ├── utils/                # 工具函数
│   │   ├── App.jsx               # 路由配置
│   │   └── main.jsx              # 入口文件
│   └── package.json
├── CHANGELOG.md                  # 版本更新日志
└── README.md
```

## 版本记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v0.1.0-beta.1 | 2026-09-06 | 内测一号版本，包含基础聊天、音视频通话、注册验证、管理后台、数据库可视化 |
| v0.2.0-beta.2 | 2026-09-07 | 内测二号版本，全站清新 UI 改版，默认浅色主题，按钮文字改白色，验证码改数字计算 |
| v0.3.0-beta.3 | 2026-09-07 | 实时通知系统、群聊增强（实时通知/群成员接口）、扫码 jsQR 兼容性修复、通话挂断重复消息修复 |
| v0.3.0-beta.3 | 2026-09-08 | 管理员端在线部署（代码包上传/构建/重启）、App 下载页、ffmpeg 系统级兼容、头像相对路径修复 |

## License

[MIT License](./LICENSE)

Copyright (c) 2026 Pulse

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
