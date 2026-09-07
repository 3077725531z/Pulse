#!/bin/bash
# Pulse 部署脚本

echo "=== 开始部署 Pulse ==="

# 1. 安装前端依赖并构建
echo ">>> 构建前端..."
cd frontend
npm install
npm run build
cd ..

# 2. 安装后端依赖
echo ">>> 安装后端依赖..."
cd backend
npm install --production
cd ..

echo "=== 部署完成 ==="
echo "启动命令: cd backend && NODE_ENV=production node src/index.js"
echo "访问地址: http://120.48.2.118:3000"
