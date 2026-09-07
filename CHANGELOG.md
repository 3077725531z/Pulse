# Pulse 更新日志

## [0.3.0-beta.3] - 2026-09-07

**实时通知系统 + 群聊增强 + 扫码兼容性修复**

### ✨ 新功能

#### 好友请求实时通知
- 发送好友请求时通过 Socket.IO 定向推送通知到对方
- 接受好友请求时实时通知请求发起方
- 后端新增 `notifyUser(userId, event, data)` 函数支持定向通知
- 前端聊天导航栏联系人按钮显示未读请求计数红色徽章
- 收到请求时自动刷新请求列表并播放提示音
- 好友请求列表新增历史记录加载

#### 群聊增强
- 创建群聊时实时通知被邀请成员加入新 Socket 房间
  - 解决被邀请成员首条群消息收不到实时推送的问题
  - 前端 `onGroupJoined` action 自动 `rejoin` 并刷新会话列表
- 新增 `GET /chat/group/:conversationId/members` 群成员列表接口
- 会话列表 SQL 查询增加 `member_count` 和 `last_sender_name` 字段
- 群聊列表项正确显示最后发送人昵称（"张三: 你好"格式）
- 群聊名称为空时默认显示"群聊"

### 🐛 Bug 修复

#### 通话挂断重复消息
- **问题**：通话挂断时会发送 3 条通话结束消息
- **原因**：`handleEnd` 被 3 个来源同时触发
  1. A 方点击结束按钮
  2. B 方收到 socket `call:end` 事件后调用 `handleRemoteEnd`
  3. B 方 WebRTC 连接状态变为 `disconnected` 触发 `pc.onconnectionstatechange`
- **修复**：在 `handleEnd` 函数开头添加 `hasEndedRef` 守卫，确保只执行一次

#### 联系人页面发消息点不动
- **问题**：点击联系人卡片的"发消息"按钮无反应
- **原因**：`App.jsx` 渲染 `<ContactsPage />` 时未传 `onSelectUser` 回调
  `onSelectUser?.()` 可选链直接返回，什么都不做
- **修复**：`App.jsx` 正确传入 `onSelectUser` 回调，按 convId 查找会话并打开聊天详情

#### 用户主页发消息点不动
- **问题**：用户资料页"发消息"按钮点击无反应
- **原因**：[ContactsPage.jsx](file:///c:/Users/30777/Desktop/2026年毕业设计/聊天视频语音文字app/聊天视频语音文字app/frontend/src/pages/ContactsPage.jsx) 渲染 `<UserProfilePage>` 时只传了 `onBack`，
  但组件期望的是 `onClose` 和 `onStartChat`
- **修复**：正确传入 `onClose` 和 `onStartChat` 回调

#### 二维码扫码在 Safari/Firefox 无效
- **问题**：Safari 和 Firefox 浏览器扫码功能完全无效
- **原因**：扫码逻辑只依赖浏览器原生 `BarcodeDetector` API
  该 API 仅在 Chrome 83+ 和 Edge 中支持，其他浏览器完全不支持
- **修复**：集成 `jsQR` 库作为 `BarcodeDetector` 的 fallback
  - 优先使用原生 `BarcodeDetector`（Chrome/Edge 性能更好）
  - 不支持或解析失败时用 `jsQR` 解析 canvas 图像
  - 支持所有现代浏览器（Chrome、Edge、Safari、Firefox）

#### 拒绝好友请求路由状态错误
- **问题**：拒绝好友请求时 SQL 错误使用 `'accepted'` 状态
- **修复**：将更新语句中的 `'accepted'` 改为 `'rejected'`

#### 注销后默认主题为深色
- **问题**：注销后重新初始化时默认使用深色主题
- **原因**：`authStore.js` 中 `initTheme` 函数默认值为 `'dark'`
- **修复**：将默认主题改为 `'light'`，确保所有场景默认浅色主题

### 📦 依赖

#### 新增
- `jsqr` - 纯 JavaScript 二维码解析库，作为 `BarcodeDetector` 的 fallback
  支持所有现代浏览器识别二维码

---

## [0.2.0-beta.2] - 2026-09-07

**Pulse 内测二号版本 —— 全站清新 UI 改版**

### 🎨 UI 样式统一改版

#### 全局主题切换
- 默认主题从深色改为浅色清新风格
- 主色调统一为柔和蓝 `#6c9ce9`
- 背景渐变 `#f0f4f8` → `#e8ecf4`（与登录页一致）
- 文字色 `#2d3748` / `#8896ab` / `#b0bac9` 三级层次
- 卡片采用毛玻璃白色 `rgba(255,255,255,0.85)`
- 输入框背景 `#f2f5f9`
- 移除深色模式切换入口，固定浅色主题

#### 页面样式对标
- **ChatList**：聊天列表页按钮文字改为白色
- **ChatDetail**：聊天详情页发送按钮文字改为白色
- **ContactsPage**：联系人页所有按钮（添加好友、接受/拒绝请求、标签切换）文字改为白色
- **SettingsPage**：设置页 PulseID 修改按钮文字改为白色
- **SettingsSubPages**：公告发布、反馈提交按钮文字改为白色
- **AdminPage**：管理员端打包下载、发布公告、回复反馈按钮文字改为白色
- **UserProfilePage**：用户资料页发消息、添加好友按钮文字改为白色
- **EditProfilePage**：编辑资料页保存、头像更换按钮文字改为白色
- **CallModal**：通话模态框 SVG 图标颜色改为白色
- **App.jsx**：底部导航栏改为白色毛玻璃背景，错误页面改为浅色配色

#### 验证码优化
- 验证码从滑块拼图改为数字计算题（加减乘法随机）
- 点击「获取验证码」弹出居中遮罩弹窗
- 验证通过后自动发送邮箱验证码
- 支持回车提交、换一题、错误抖动反馈

### 🔧 技术优化
- `global.css` 重写浅色主题变量，深色主题保留但不再默认启用
- `authStore.js` 默认主题改为 `light`
- `index.html` 默认 `data-theme="light"`
- 所有页面移除硬编码 `#080808` 深色文字，统一改为 `#fff` 白色

---

## [0.1.0-beta.1] - 2026-09-06

**Pulse 内测一号版本**

> 毕业设计项目 —— 聊天视频语音文字 App

### ✨ 新增功能

#### 用户系统
- 用户注册（用户名、昵称、QQ邮箱、密码）
- 用户登录 / 登出
- 个人资料编辑（头像、昵称、签名、主题）
- 用户名实时查重
- QQ邮箱验证码注册验证
- 密码强度实时检测（弱/中/强）

#### 安全验证
- 数字计算验证码（加减乘法，点击获取验证码时弹出）
- 验证通过后自动发送邮箱验证码
- 60秒发送频率限制

#### 即时通讯
- 私聊文字消息
- 消息已读状态
- 在线状态显示
- 好友添加与管理
- 用户资料查看

#### 音视频通话
- 语音通话
- 视频通话
- 通话模态框界面

#### 管理员端
- 管理员总览页面
- 数据库动态密码（30秒刷新 + 复制功能）

#### 数据库可视化工具
- 独立 HTML 页面访问
- 密码认证登录
- 数据表增删改查
- SQL 命令行（全语句支持）
- 表描述动态管理（存储在 `_table_meta` 表）

### 🏗️ 技术架构

| 模块 | 技术栈 |
|------|--------|
| 前端 | React 18 + Vite + Tailwind CSS + Zustand |
| 后端 | Node.js + Express + Socket.IO |
| 数据库 | sql.js (SQLite) |
| 认证 | JWT |
| 邮件 | nodemailer (QQ邮箱 SMTP) |
| 实时通信 | Socket.IO |

### 🎨 UI 设计
- 清新风格配色，主色柔和蓝 `#6c9ce9`
- 页面加载动画（Logo 旋转 + 进度圆环）
- 光晕浮动背景装饰
- 响应式布局，支持移动端
