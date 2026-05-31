# 前后端分离部署指南

本指南介绍如何将 TWICE Discography 项目以前后端分离的方式部署到免费平台，并确保国内可以正常访问。

## 推荐平台组合

- **前端**：Cloudflare Pages（免费，国内访问速度好）
- **后端**：Render 免费版（免费 750 小时/月，支持 SQLite 持久化）

---

## 一、后端部署（Render）

### 1.1 创建 Render 账号

1. 访问 [https://render.com](https://render.com)
2. 使用 GitHub 账号登录
3. 授权 Render 访问您的 GitHub 仓库

### 1.2 创建 Web Service

1. 点击 **New +** → **Web Service**
2. 连接您的 GitHub 仓库：`twice-discography`
3. 配置如下：

| 配置项 | 值 |
|--------|-----|
| **Name** | `twice-api`（或您喜欢的名字） |
| **Region** | Singapore（新加坡，国内访问较快） |
| **Branch** | `main` |
| **Root Directory** | 留空（使用仓库根目录） |
| **Runtime** | `Node` |
| **Build Command** | `npm install -g pnpm@9.7.0 && pnpm install --frozen-lockfile --prod=false && pnpm build:backend` |
| **Start Command** | `pnpm --filter backend start` |
| **Instance Type** | `Free` |

### 1.3 配置环境变量

在 Render 的 **Environment** 标签页添加以下环境变量：

```bash
NODE_VERSION=20.18.0
NODE_ENV=production
BACKEND_PORT=10000
BACKEND_HOST=0.0.0.0
DATABASE_PATH=/opt/render/project/src/data/twice.db
SERVE_FRONTEND=false
FRONTEND_ORIGIN=https://your-frontend.pages.dev
CORS_ORIGIN=https://your-frontend.pages.dev
STATIC_PREFIX=/static
```

> ⚠️ `NODE_VERSION=20.18.0` 必须设置，否则 Render 默认用 Node.js 26，会导致 better-sqlite3 原生模块编译失败。

**重要说明：**
- `BACKEND_PORT=10000` 是 Render 的默认端口
- `FRONTEND_ORIGIN` 先填一个占位符，等前端部署后再改
- `DATABASE_PATH` 指向项目目录（Render 会自动持久化）

### 1.4 添加持久化磁盘（可选但推荐）

1. 在 Render 控制台，进入您的 Web Service
2. 点击 **Disks** 标签
3. 点击 **Add Disk**
4. 配置：
   - **Name**: `twice-data`
   - **Mount Path**: `/opt/render/project/src/data`
   - **Size**: 1 GB（免费）
5. 保存后重新部署

### 1.5 部署并获取 API 地址

1. 点击 **Create Web Service**
2. 等待构建完成（约 5-10 分钟）
3. 构建成功后，您会得到一个 URL，例如：
   ```
   https://twice-api.onrender.com
   ```
4. 测试健康检查：
   ```bash
   curl https://twice-api.onrender.com/health
   # 应该返回：{"ok":true}
   ```

---

## 二、前端部署（Cloudflare Pages）

### 2.1 创建 Cloudflare 账号

1. 访问 [https://dash.cloudflare.com](https://dash.cloudflare.com)
2. 注册并登录
3. 进入 **Workers & Pages**

### 2.2 创建 Pages 项目

1. 点击 **Create application** → **Pages** → **Connect to Git**
2. 授权 Cloudflare 访问您的 GitHub 仓库
3. 选择 `twice-discography` 仓库
4. 配置如下：

| 配置项 | 值 |
|--------|-----|
| **Project name** | `twice-discography`（或您喜欢的名字） |
| **Production branch** | `main` |
| **Framework preset** | `None`（手动配置） |
| **Build command** | `npm install -g pnpm@9.7.0 && pnpm install --frozen-lockfile --prod=false && pnpm build:frontend` |
| **Build output directory** | `frontend/dist` |
| **Root directory** | 留空 |

### 2.3 配置环境变量

在 **Environment variables** 部分添加：

```bash
VITE_API_BASE=https://twice-api.onrender.com/api
VITE_STATIC_BASE=https://twice-api.onrender.com/static
VITE_PLAYER_BASE=/player
VITE_HOME_BG_VIDEO=/media/me-you-bg.mp4
VITE_SITE_BG_VIDEO=/media/me-you-bg.mp4
```

**重要：** 将 `twice-api.onrender.com` 替换为您在步骤 1.5 中获得的实际后端域名。

### 2.4 部署前端

1. 点击 **Save and Deploy**
2. 等待构建完成（约 3-5 分钟）
3. 构建成功后，您会得到一个 URL，例如：
   ```
   https://twice-discography.pages.dev
   ```

---

## 三、更新后端 CORS 配置

前端部署完成后，需要更新后端的 CORS 配置：

1. 回到 Render 控制台
2. 进入您的 `twice-api` Web Service
3. 点击 **Environment** 标签
4. 更新以下环境变量：
   ```bash
   FRONTEND_ORIGIN=https://twice-discography.pages.dev
   CORS_ORIGIN=https://twice-discography.pages.dev
   ```
5. 点击 **Save Changes**
6. Render 会自动重新部署

---

## 四、验证部署

### 4.1 测试后端 API

```bash
# 健康检查
curl https://twice-api.onrender.com/health

# 获取曲库概览
curl https://twice-api.onrender.com/api/catalog/overview

# 获取专辑列表
curl https://twice-api.onrender.com/api/albums
```

### 4.2 测试前端

1. 访问 `https://twice-discography.pages.dev`
2. 检查首页是否正常加载
3. 点击"专辑"，查看专辑列表
4. 点击任意专辑，查看详情页
5. 尝试播放歌曲
6. 打开浏览器开发者工具（F12），检查 Console 是否有 CORS 错误

### 4.3 国内访问测试

1. 使用国内网络访问前端 URL
2. 检查页面加载速度（Cloudflare Pages 在国内速度较好）
3. 检查 API 请求是否正常（Render 在国内可访问，但可能稍慢）

---

## 五、自定义域名（可选）

### 5.1 前端自定义域名（Cloudflare Pages）

1. 在 Cloudflare Pages 项目中，点击 **Custom domains**
2. 点击 **Set up a custom domain**
3. 输入您的域名，例如 `twice.yourdomain.com`
4. 按照提示添加 DNS 记录（如果域名在 Cloudflare，会自动配置）
5. 等待 SSL 证书生成（约 5-10 分钟）

### 5.2 后端自定义域名（Render）

1. 在 Render Web Service 中，点击 **Settings** → **Custom Domain**
2. 点击 **Add Custom Domain**
3. 输入您的域名，例如 `api.yourdomain.com`
4. 按照提示添加 CNAME 记录到您的 DNS 提供商
5. 等待 SSL 证书生成

### 5.3 更新环境变量

使用自定义域名后，需要更新环境变量：

**Cloudflare Pages（前端）：**
```bash
VITE_API_BASE=https://api.yourdomain.com/api
VITE_STATIC_BASE=https://api.yourdomain.com/static
```

**Render（后端）：**
```bash
FRONTEND_ORIGIN=https://twice.yourdomain.com
CORS_ORIGIN=https://twice.yourdomain.com
```

---

## 六、常见问题

### 6.1 CORS 错误

**症状：** 浏览器 Console 显示 `Access to fetch at 'https://twice-api.onrender.com/api/...' from origin 'https://twice-discography.pages.dev' has been blocked by CORS policy`

**解决方法：**
1. 检查后端环境变量 `FRONTEND_ORIGIN` 和 `CORS_ORIGIN` 是否正确
2. 确保前端域名完全匹配（包括 `https://`，不要有尾部斜杠）
3. 重新部署后端

### 6.2 Render 免费版冷启动

**症状：** 首次访问或长时间未访问后，API 响应很慢（15-30 秒）

**原因：** Render 免费版在 15 分钟无请求后会休眠

**解决方法：**
1. 升级到付费版（$7/月）
2. 使用定时任务每 10 分钟 ping 一次 `/health` 端点
3. 接受冷启动（首次访问慢，后续正常）

### 6.3 数据库丢失

**症状：** 重新部署后数据丢失

**解决方法：**
1. 确保添加了持久化磁盘（见步骤 1.4）
2. 检查 `DATABASE_PATH` 指向挂载的磁盘路径
3. 定期备份数据库文件

### 6.4 构建失败

**症状：** Cloudflare Pages 或 Render 构建失败

**常见原因：**
1. pnpm 版本不匹配
2. 依赖安装失败
3. 环境变量缺失

**解决方法：**
1. 检查构建日志
2. 确保 Build Command 正确
3. 本地测试 `pnpm build` 是否成功

### 6.5 国内访问慢

**症状：** 前端加载快，但 API 请求慢

**原因：** Render 服务器在国外，国内访问有延迟

**解决方法：**
1. 后端改用国内 VPS（阿里云、腾讯云）
2. 使用 CDN 加速 API 请求
3. 优化 API 响应（减少数据量、添加缓存）

---

## 七、成本估算

### 免费方案

| 服务 | 免费额度 | 限制 |
|------|---------|------|
| **Cloudflare Pages** | 无限流量 | 每月 500 次构建 |
| **Render** | 750 小时/月 | 15 分钟无请求后休眠 |
| **总计** | **完全免费** | 适合个人项目 |

### 付费升级（可选）

| 服务 | 价格 | 优势 |
|------|------|------|
| **Render Starter** | $7/月 | 无休眠，更快响应 |
| **Cloudflare Pro** | $20/月 | 更多构建次数，高级分析 |

---

## 八、监控与维护

### 8.1 健康检查

定期检查服务状态：

```bash
# 后端健康检查
curl https://twice-api.onrender.com/health

# 前端可访问性
curl -I https://twice-discography.pages.dev
```

### 8.2 日志查看

**Render：**
1. 进入 Web Service 控制台
2. 点击 **Logs** 标签
3. 查看实时日志

**Cloudflare Pages：**
1. 进入 Pages 项目
2. 点击 **Deployments**
3. 查看构建日志

### 8.3 数据库备份

定期备份 SQLite 数据库：

```bash
# 通过 Render Shell 备份
# 1. 在 Render 控制台点击 "Shell"
# 2. 运行：
cp /opt/render/project/src/data/twice.db /tmp/backup-$(date +%Y%m%d).db

# 3. 下载备份文件（需要手动操作）
```

---

## 九、下一步

部署完成后，您可以：

1. ✅ 测试所有功能是否正常
2. ✅ 配置自定义域名
3. ✅ 开始实施国际化（i18n）
4. ✅ 邀请朋友测试并收集反馈
5. ✅ 监控性能和错误日志

---

## 十、回滚到单体部署

如果前后端分离遇到问题，可以随时回滚到单体部署：

1. 修改后端环境变量：
   ```bash
   SERVE_FRONTEND=true
   CORS_ORIGIN=https://your-domain.com
   ```

2. 修改前端环境变量：
   ```bash
   VITE_API_BASE=/api
   VITE_STATIC_BASE=/static
   ```

3. 重新构建并部署到单个平台（如 Render）

---

## 联系支持

- **Render 文档**: https://render.com/docs
- **Cloudflare Pages 文档**: https://developers.cloudflare.com/pages
- **项目 Issues**: https://github.com/t479842598/twice-discography/issues

祝部署顺利！🎉
