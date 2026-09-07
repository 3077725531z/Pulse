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
