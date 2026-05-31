# 🚀 前后端分离部署 - 快速开始

> 5 分钟完成免费部署，国内可访问

## 📋 准备工作

- ✅ GitHub 账号
- ✅ 项目已推送到 GitHub
- ✅ 本地测试通过（`pnpm dev` 正常运行）

---

## 🎯 第一步：部署后端（Render）

### 1. 注册并登录

访问 [https://render.com](https://render.com)，使用 GitHub 登录

### 2. 创建 Web Service

1. 点击 **New +** → **Web Service**
2. 选择 `twice-discography` 仓库
3. 填写配置：

```
Name: twice-api
Region: Singapore
Build Command: corepack enable && corepack prepare pnpm@9.7.0 --activate && pnpm install --frozen-lockfile && pnpm build:backend
Start Command: pnpm --filter backend start
```

### 3. 添加环境变量

点击 **Advanced** → **Add Environment Variable**：

```bash
NODE_ENV=production
BACKEND_PORT=10000
BACKEND_HOST=0.0.0.0
DATABASE_PATH=/opt/render/project/src/data/twice.db
SERVE_FRONTEND=false
FRONTEND_ORIGIN=https://临时占位.pages.dev
CORS_ORIGIN=https://临时占位.pages.dev
STATIC_PREFIX=/static
```

### 4. 部署并获取 URL

1. 点击 **Create Web Service**
2. 等待 5-10 分钟构建完成
3. 复制 URL，例如：`https://twice-api.onrender.com`
4. 测试：访问 `https://twice-api.onrender.com/health`，应该返回 `{"ok":true}`

---

## 🌐 第二步：部署前端（Cloudflare Pages）

### 1. 注册并登录

访问 [https://dash.cloudflare.com](https://dash.cloudflare.com)，注册账号

### 2. 创建 Pages 项目

1. 进入 **Workers & Pages**
2. 点击 **Create application** → **Pages** → **Connect to Git**
3. 授权并选择 `twice-discography` 仓库
4. 填写配置：

```
Project name: twice-discography
Production branch: main
Build command: cd frontend && npm install -g pnpm@9.7.0 && pnpm install --frozen-lockfile && pnpm build
Build output directory: frontend/dist
```

### 3. 添加环境变量

在 **Environment variables** 部分添加（**重要：替换为第一步获得的后端 URL**）：

```bash
VITE_API_BASE=https://twice-api.onrender.com/api
VITE_STATIC_BASE=https://twice-api.onrender.com/static
VITE_PLAYER_BASE=/player
VITE_HOME_BG_VIDEO=/media/me-you-bg.mp4
VITE_SITE_BG_VIDEO=/media/me-you-bg.mp4
```

### 4. 部署并获取 URL

1. 点击 **Save and Deploy**
2. 等待 3-5 分钟构建完成
3. 复制 URL，例如：`https://twice-discography.pages.dev`

---

## 🔄 第三步：更新后端 CORS

### 1. 回到 Render 控制台

1. 进入 `twice-api` Web Service
2. 点击 **Environment** 标签

### 2. 更新环境变量

将前端 URL 填入（**替换为第二步获得的前端 URL**）：

```bash
FRONTEND_ORIGIN=https://twice-discography.pages.dev
CORS_ORIGIN=https://twice-discography.pages.dev
```

### 3. 保存并重新部署

点击 **Save Changes**，Render 会自动重新部署（约 2-3 分钟）

---

## ✅ 第四步：验证部署

### 1. 测试后端

```bash
curl https://twice-api.onrender.com/health
curl https://twice-api.onrender.com/api/albums
```

### 2. 测试前端

1. 访问 `https://twice-discography.pages.dev`
2. 检查首页是否正常加载
3. 点击"专辑"，查看列表
4. 尝试播放歌曲
5. 按 F12 打开开发者工具，检查 Console 是否有错误

### 3. 国内访问测试

使用国内网络访问前端 URL，检查：
- ✅ 页面加载速度（Cloudflare Pages 在国内较快）
- ✅ API 请求是否正常（可能稍慢，但能访问）
- ✅ 图片和视频是否加载

---

## 🎉 完成！

您的 TWICE Discography 网站已成功部署！

**访问地址：** `https://twice-discography.pages.dev`

---

## 📝 后续优化

### 1. 添加自定义域名

**前端（Cloudflare Pages）：**
1. 在项目中点击 **Custom domains**
2. 添加您的域名（例如：`twice.yourdomain.com`）
3. 按提示配置 DNS

**后端（Render）：**
1. 在 Settings 中点击 **Custom Domain**
2. 添加您的域名（例如：`api.yourdomain.com`）
3. 按提示配置 DNS

### 2. 更新环境变量

使用自定义域名后，记得更新：

**Cloudflare Pages：**
```bash
VITE_API_BASE=https://api.yourdomain.com/api
VITE_STATIC_BASE=https://api.yourdomain.com/static
```

**Render：**
```bash
FRONTEND_ORIGIN=https://twice.yourdomain.com
CORS_ORIGIN=https://twice.yourdomain.com
```

### 3. 添加持久化磁盘（推荐）

在 Render 中：
1. 进入 Web Service
2. 点击 **Disks** 标签
3. 添加磁盘：
   - Name: `twice-data`
   - Mount Path: `/opt/render/project/src/data`
   - Size: 1 GB（免费）

---

## ❓ 常见问题

### Q1: 前端能访问，但 API 请求失败

**原因：** CORS 配置错误

**解决：**
1. 检查后端 `FRONTEND_ORIGIN` 是否正确
2. 确保前端 URL 完全匹配（包括 `https://`）
3. 重新部署后端

### Q2: Render 首次访问很慢

**原因：** 免费版 15 分钟无请求后会休眠

**解决：**
1. 接受冷启动（首次慢，后续正常）
2. 升级到付费版（$7/月）
3. 使用定时任务每 10 分钟 ping `/health`

### Q3: 数据库数据丢失

**原因：** 未配置持久化磁盘

**解决：**
1. 添加持久化磁盘（见上文"后续优化"）
2. 确保 `DATABASE_PATH` 指向挂载路径

---

## 📖 详细文档

- [完整部署指南](DEPLOYMENT_SEPARATED.md)
- [环境变量配置示例](ENV_EXAMPLES.md)
- [故障排查](DEPLOYMENT_SEPARATED.md#六常见问题)

---

## 💰 成本

- **Cloudflare Pages**: 完全免费
- **Render 免费版**: 750 小时/月（够用）
- **总计**: **$0/月** 🎉

---

祝部署顺利！如有问题，请查看详细文档或提交 Issue。
