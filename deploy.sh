#!/bin/bash
# Pulse 部署脚本（推荐使用 PM2 守护进程，支持管理员端一键重启）

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="pulse"

echo "=== 开始部署 Pulse ==="

# 1. 安装前端依赖并构建
#    vite.config.js 已配置 outDir: '../backend/public'，构建产物会直接输出到 backend/public
echo ">>> 构建前端（输出到 backend/public）..."
cd "$PROJECT_ROOT/frontend"
npm install
npm run build

# 2. 安装后端依赖
echo ">>> 安装后端依赖..."
cd "$PROJECT_ROOT/backend"
npm install --production

# 3. 检查 PM2 是否安装
if ! command -v pm2 &> /dev/null; then
  echo ">>> 未检测到 PM2，正在全局安装..."
  npm install -g pm2
fi

# 4. 用 PM2 启动 / 重启应用
if pm2 list | grep -q "$APP_NAME"; then
  echo ">>> PM2 已存在 $APP_NAME，执行 reload（零停机重启）..."
  pm2 reload "$APP_NAME" --update-env
else
  echo ">>> PM2 首次启动 $APP_NAME..."
  cd "$PROJECT_ROOT/backend"
  NODE_ENV=production pm2 start src/index.js \
    --name "$APP_NAME" \
    --exp-backoff-restart-delay-interval 100
  pm2 save
  if [ "$(id -u)" -eq 0 ]; then
    pm2 startup 2>/dev/null || true
  else
    echo "    （非 root 用户，请手动执行 sudo env PATH=\$PATH:\$(which pm2) pm2 startup systemd --hp \$HOME -u \$(whoami) 设置开机自启）"
  fi
fi

echo ""
echo "=== 部署完成 ==="
echo "访问地址: http://localhost:3000"
echo ""
echo "PM2 常用命令:"
echo "  查看状态:        pm2 status"
echo "  查看日志:        pm2 logs $APP_NAME"
echo "  手动重启:        pm2 restart $APP_NAME"
echo "  零停机重载:      pm2 reload $APP_NAME"
echo "  停止应用:        pm2 stop $APP_NAME"
echo "  删除应用:        pm2 delete $APP_NAME"
echo ""
echo ">>> 管理员端「部署」标签可一键上传代码包并触发系统重启 <<<"
