# 前后端分离部署 - 环境变量配置示例

## 开发环境（本地）

```bash
# .env
NODE_ENV=development
BACKEND_PORT=3000
BACKEND_HOST=0.0.0.0
DATABASE_PATH=./data/twice.db
SERVE_FRONTEND=true
CORS_ORIGIN=http://localhost:5173
STATIC_PREFIX=/static
VITE_API_BASE=http://localhost:3000/api
VITE_STATIC_BASE=http://localhost:3000/static
VITE_PLAYER_BASE=/player
VITE_HOME_BG_VIDEO=/media/me-you-bg.mp4
VITE_SITE_BG_VIDEO=/media/me-you-bg.mp4
```

## 生产环境 - 前后端分离

### 后端（Render）

```bash
NODE_ENV=production
BACKEND_PORT=10000
BACKEND_HOST=0.0.0.0
DATABASE_PATH=/opt/render/project/src/data/twice.db
SERVE_FRONTEND=false
FRONTEND_ORIGIN=https://twice-discography.pages.dev
CORS_ORIGIN=https://twice-discography.pages.dev
STATIC_PREFIX=/static
```

### 前端（Cloudflare Pages）

```bash
VITE_API_BASE=https://twice-api.onrender.com/api
VITE_STATIC_BASE=https://twice-api.onrender.com/static
VITE_PLAYER_BASE=/player
VITE_HOME_BG_VIDEO=/media/me-you-bg.mp4
VITE_SITE_BG_VIDEO=/media/me-you-bg.mp4
```

## 生产环境 - 单体部署

### 后端（Render / VPS）

```bash
NODE_ENV=production
BACKEND_PORT=3000
BACKEND_HOST=0.0.0.0
DATABASE_PATH=/data/twice.db
SERVE_FRONTEND=true
CORS_ORIGIN=https://twice.yourdomain.com
STATIC_PREFIX=/static
VITE_API_BASE=/api
VITE_STATIC_BASE=/static
VITE_PLAYER_BASE=/player
VITE_HOME_BG_VIDEO=/media/me-you-bg.mp4
VITE_SITE_BG_VIDEO=/media/me-you-bg.mp4
```

## 注意事项

1. **SERVE_FRONTEND**：
   - `true`：后端提供前端静态文件（单体部署）
   - `false`：后端只提供 API（前后端分离）

2. **FRONTEND_ORIGIN**：
   - 前后端分离时必须设置
   - 可以设置多个域名，用逗号分隔
   - 示例：`https://twice.pages.dev,https://twice.yourdomain.com`

3. **VITE_API_BASE**：
   - 前后端分离：完整 URL（`https://twice-api.onrender.com/api`）
   - 单体部署：相对路径（`/api`）

4. **数据库路径**：
   - Render：`/opt/render/project/src/data/twice.db`
   - Railway：`/data/twice.db`（需要挂载 Volume）
   - VPS：自定义路径

5. **端口配置**：
   - Render 默认：`10000`
   - Railway：自动分配（使用 `PORT` 环境变量）
   - VPS：自定义（推荐 `3000`）
