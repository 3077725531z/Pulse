import db, { initDB } from './src/config/db.js';

const changelogs = [
  {
    version: '0.3.0-beta.4',
    date: '2026-09-08',
    title: '更新日志数据库化 + 部署说明文档 + 服务稳定性增强',
    tags: ['更新日志', '部署文档', '稳定性'],
    sections: [
      {
        type: 'feat',
        title: '更新日志数据库化',
        items: [
          '更新日志从硬编码改为 SQLite changelogs 表存储',
          '管理员端新增「更新日志」标签页，支持增删改查',
          '用户端「关于 → 更新日志」改为动态拉取 /api/changelogs',
          '新增 seed-changelogs.mjs 种子脚本，一键写入默认版本日志',
        ],
      },
      {
        type: 'feat',
        title: '部署说明文档',
        items: [
          '管理员「部署」标签页底部新增详细部署说明',
          '两种部署方式说明 + 注意事项 + 常见问题',
        ],
      },
      {
        type: 'fix',
        title: '后端启动崩溃（502 根因）',
        items: [
          'admin.js 移除 @ffmpeg-installer/ffmpeg 静态 import',
          'chat.js / admin.js 顶层 fs.mkdirSync 加 try-catch',
        ],
      },
      {
        type: 'perf',
        title: '版本号统一',
        items: [
          'vite.config.js define __APP_VERSION__ 从 package.json 读取',
          '登录页、关于页、管理员端版本号自动同步',
        ],
      },
    ],
  },
  {
    version: '0.3.0-beta.3',
    date: '2026-09-08',
    title: '管理员端在线部署 + App 下载页 + 服务稳定性修复',
    tags: ['部署', 'Bug 修复', '稳定性'],
    sections: [
      {
        type: 'feat',
        title: '管理员端「部署」标签页',
        items: [
          '代码包上传：支持 .zip 代码包上传，自动解压到指定目录（backend / frontend / root）',
          '智能识别 zip 内顶层文件夹（如 Pulse-main/），安全检查防止路径穿越攻击',
          '上传时保留 .git / node_modules / uploads / .env 等关键目录',
          'App 安装包管理：上传 .apk / .ipa / .zip，自动识别平台，列表展示下载删除',
          '前端一键构建：通过 SSE 实时推送构建日志，进度条动态显示，支持取消构建',
          '系统安全重启：detached 子进程执行，依赖 PM2 / 宝塔守护拉起',
          '自动化选项：上传前端后自动构建（默认开启）、构建后自动重启（可选）',
        ],
      },
      {
        type: 'feat',
        title: 'App 下载页面',
        items: [
          '公开访问页面无需登录，登录页右上角 + 首页标题旁新增「App 下载」入口',
          '调用公开接口 /api/apps 获取安装包列表，按 Android / iOS / 其他分组展示',
          '空状态友好提示 + 安装说明（Android 未知来源、iOS 侧载、PWA 推荐）',
        ],
      },
      {
        type: 'fix',
        title: '服务启动崩溃修复（502 根因）',
        items: [
          'admin.js 移除 @ffmpeg-installer/ffmpeg 静态 import（该包 import 时找不到二进制会 throw 崩进程）',
          '改为优先使用系统 ffmpeg（which ffmpeg），找不到再动态 import 兜底',
          'chat.js / admin.js 顶层 fs.mkdirSync 加 try-catch，防止目录无权限导致进程崩溃',
          'ffmpeg.setFfmpegPath 加 try-catch，ffmpeg 缺失时仅禁用录制功能不影响启动',
        ],
      },
      {
        type: 'fix',
        title: '其他 Bug 修复',
        items: [
          '头像 URL 硬编码 localhost 改为相对路径，部署到服务器后头像正常加载',
          '版本号统一从 package.json 读取（vite.config define __APP_VERSION__），登录页与关于页自动同步',
        ],
      },
    ],
  },
  {
    version: '0.3.0-beta.2',
    date: '2026-09-07',
    title: '实时通知系统 + 群聊增强 + 扫码兼容性修复',
    tags: ['实时通信', '群聊', 'Bug 修复'],
    sections: [
      {
        type: 'feat',
        title: '好友请求实时通知',
        items: [
          '发送好友请求时通过 Socket.IO 定向推送给对方',
          '接受好友请求时实时通知请求发起方',
          '聊天导航栏联系人按钮显示未读请求计数红色徽章',
          '收到请求时自动刷新列表并播放提示音',
        ],
      },
      {
        type: 'feat',
        title: '群聊增强',
        items: [
          '创建群聊时实时通知被邀请成员加入新 Socket 房间',
          '解决被邀请成员首条群消息收不到实时推送的问题',
          '新增群成员列表接口，会话列表显示最后发送人昵称',
        ],
      },
      {
        type: 'fix',
        title: 'Bug 修复',
        items: [
          '通话挂断重复发送 3 条结束消息 → 添加 hasEndedRef 守卫只执行一次',
          '联系人页面/用户主页「发消息」按钮点不动 → 修正回调传参',
          'Safari/Firefox 扫码无效 → 集成 jsQR 作为 BarcodeDetector fallback',
          '拒绝好友请求状态错误（accepted → rejected）',
          '注销后默认主题改为浅色',
        ],
      },
    ],
  },
  {
    version: '0.2.0-beta.2',
    date: '2026-09-07',
    title: '全站清新 UI 改版',
    tags: ['UI', '主题'],
    sections: [
      {
        type: 'style',
        title: '全局主题改版',
        items: [
          '默认主题从深色改为浅色清新风格，主色调柔和蓝 #6c9ce9',
          '卡片毛玻璃白色、输入框浅灰背景、文字三级层次',
          '全站按钮文字统一为白色，底部导航栏白色毛玻璃',
          '验证码从滑块拼图改为数字计算题（加减乘法随机）',
        ],
      },
    ],
  },
  {
    version: '0.1.0-beta.1',
    date: '2026-09-06',
    title: 'Pulse 内测首发版本',
    tags: ['首发'],
    sections: [
      {
        type: 'feat',
        title: '用户系统',
        items: [
          '注册（用户名、昵称、QQ邮箱、密码）、登录 / 登出',
          '个人资料编辑（头像、昵称、签名、主题）',
          'QQ邮箱验证码注册验证，密码强度实时检测',
        ],
      },
      {
        type: 'feat',
        title: '即时通讯',
        items: [
          '私聊文字消息、消息已读状态、在线状态显示',
          '好友添加与管理、用户资料查看',
        ],
      },
      {
        type: 'feat',
        title: '音视频通话',
        items: [
          '语音通话、视频通话、通话模态框界面',
        ],
      },
      {
        type: 'feat',
        title: '管理员端 & 数据库可视化',
        items: [
          '管理员总览页面、数据库动态密码（30秒刷新）',
          '独立数据库可视化页面：增删改查、SQL 命令行、表描述管理',
        ],
      },
    ],
  },
];

async function seed() {
  await initDB();

  // 清空现有更新日志
  db.exec('DELETE FROM changelogs');

  const stmt = db.prepare(
    'INSERT INTO changelogs (id, version, date, title, tags, sections) VALUES (?, ?, ?, ?, ?, ?)'
  );

  for (const c of changelogs) {
    const id = crypto.randomUUID();
    stmt.run(
      id,
      c.version,
      c.date,
      c.title,
      JSON.stringify(c.tags),
      JSON.stringify(c.sections)
    );
    console.log(`✓ 写入 v${c.version}`);
  }

  console.log(`\n完成，共写入 ${changelogs.length} 个版本的更新日志。`);
  process.exit(0);
}

seed().catch(err => {
  console.error('种子数据写入失败:', err);
  process.exit(1);
});
