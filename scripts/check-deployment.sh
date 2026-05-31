#!/bin/bash

# 前后端分离部署检查脚本
# 用于验证环境变量配置是否正确

echo "=========================================="
echo "TWICE Discography - 前后端分离部署检查"
echo "=========================================="
echo ""

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "❌ 错误：.env 文件不存在"
    echo "   请先运行：cp .env.example .env"
    exit 1
fi

echo "✅ .env 文件存在"
echo ""

# 加载环境变量
source .env

echo "📋 当前配置："
echo "----------------------------------------"
echo "部署模式: ${SERVE_FRONTEND:-true}"
echo "后端端口: ${BACKEND_PORT:-3000}"
echo "后端地址: ${BACKEND_HOST:-0.0.0.0}"
echo "数据库路径: ${DATABASE_PATH:-./data/twice.db}"
echo "CORS 源: ${CORS_ORIGIN:-未设置}"
echo "前端源: ${FRONTEND_ORIGIN:-未设置}"
echo "前端 API 地址: ${VITE_API_BASE:-未设置}"
echo "前端静态资源: ${VITE_STATIC_BASE:-未设置}"
echo ""

# 检查部署模式
if [ "${SERVE_FRONTEND}" = "false" ]; then
    echo "🔀 检测到前后端分离模式"
    echo ""

    # 检查必需的环境变量
    if [ -z "${FRONTEND_ORIGIN}" ]; then
        echo "⚠️  警告：FRONTEND_ORIGIN 未设置"
        echo "   前后端分离部署时需要设置前端域名"
        echo "   示例：FRONTEND_ORIGIN=https://twice.pages.dev"
    else
        echo "✅ FRONTEND_ORIGIN 已设置: ${FRONTEND_ORIGIN}"
    fi

    if [ -z "${VITE_API_BASE}" ]; then
        echo "❌ 错误：VITE_API_BASE 未设置"
        echo "   前端需要知道后端 API 地址"
        echo "   示例：VITE_API_BASE=https://twice-api.onrender.com/api"
    else
        echo "✅ VITE_API_BASE 已设置: ${VITE_API_BASE}"
    fi

    if [ -z "${VITE_STATIC_BASE}" ]; then
        echo "❌ 错误：VITE_STATIC_BASE 未设置"
        echo "   前端需要知道静态资源地址"
        echo "   示例：VITE_STATIC_BASE=https://twice-api.onrender.com/static"
    else
        echo "✅ VITE_STATIC_BASE 已设置: ${VITE_STATIC_BASE}"
    fi
else
    echo "🏢 检测到单体部署模式"
    echo ""
    echo "✅ 后端将同时提供 API 和前端静态文件"
    echo "   访问地址：http://${BACKEND_HOST}:${BACKEND_PORT}"
fi

echo ""
echo "=========================================="
echo "📦 依赖检查"
echo "=========================================="

# 检查 Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js: ${NODE_VERSION}"
else
    echo "❌ Node.js 未安装"
    exit 1
fi

# 检查 pnpm
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm --version)
    echo "✅ pnpm: ${PNPM_VERSION}"
else
    echo "❌ pnpm 未安装"
    echo "   请运行：corepack enable && corepack prepare pnpm@9.7.0 --activate"
    exit 1
fi

echo ""
echo "=========================================="
echo "🔧 构建检查"
echo "=========================================="

# 检查是否已构建
if [ -d "backend/dist" ]; then
    echo "✅ 后端已构建 (backend/dist)"
else
    echo "⚠️  后端未构建"
    echo "   请运行：pnpm build:backend"
fi

if [ -d "frontend/dist" ]; then
    echo "✅ 前端已构建 (frontend/dist)"
else
    echo "⚠️  前端未构建"
    echo "   请运行：pnpm build:frontend"
fi

echo ""
echo "=========================================="
echo "💡 下一步操作建议"
echo "=========================================="

if [ "${SERVE_FRONTEND}" = "false" ]; then
    echo ""
    echo "前后端分离部署步骤："
    echo ""
    echo "1️⃣  后端部署（Render）："
    echo "   - 访问 https://render.com"
    echo "   - 创建 Web Service"
    echo "   - 设置环境变量（参考 docs/DEPLOYMENT_SEPARATED.md）"
    echo "   - 获取后端 URL（例如：https://twice-api.onrender.com）"
    echo ""
    echo "2️⃣  前端部署（Cloudflare Pages）："
    echo "   - 访问 https://dash.cloudflare.com"
    echo "   - 创建 Pages 项目"
    echo "   - 设置 VITE_API_BASE 为后端 URL"
    echo "   - 获取前端 URL（例如：https://twice.pages.dev）"
    echo ""
    echo "3️⃣  更新后端 CORS："
    echo "   - 在 Render 中设置 FRONTEND_ORIGIN 为前端 URL"
    echo "   - 重新部署后端"
    echo ""
    echo "📖 详细步骤请查看：docs/DEPLOYMENT_SEPARATED.md"
else
    echo ""
    echo "单体部署步骤："
    echo ""
    echo "1️⃣  构建项目："
    echo "   pnpm build"
    echo ""
    echo "2️⃣  启动服务："
    echo "   pnpm start"
    echo ""
    echo "3️⃣  访问网站："
    echo "   http://localhost:${BACKEND_PORT}"
    echo ""
    echo "📖 详细步骤请查看：README.md"
fi

echo ""
echo "=========================================="
echo "检查完成！"
echo "=========================================="
