# TWICE Discography

TWICE 完整曲目库网站，整理团体、Solo、小分队、MISAMO、CF、翻唱、Pre-debut 作品，并提供多语言资料页、成员页、搜索、时间线和多源音乐播放。

当前仓库已经落地 Fastify + SQLite 后端曲库 API、MusicSquare 多源音乐接口和 Vue 3 + Naive UI 前端。首页参考 TWICE JYP 官方页，优先播放本地/自托管 `ME+YOU` 视频背景，加载失败时自动回退到官方合照背景。

## 功能概览

- 全曲目资料：团体、Solo、Unit、MISAMO、CF、翻唱、Pre-debut。
- 多语言：中文、英文、日文、韩文，支持后端地区提示和前端手动切换。
- 多源音乐：QQ 音乐、网易云、酷我、JOOX，默认选择最高音质，同音质优先 QQ 音乐。
- 歌曲详情：展示多个音乐源、音质、是否可播放、是否推荐、歌词状态。
- 全局播放器：支持手动换源、失败自动换源和切页不断播。
- 秒开优化：首屏曲目、歌曲详情和悬停曲目会提前解析播放地址并预热音频元数据。
- 部署目标：Windows、Linux、宝塔面板，推荐完整 Node/Fastify 部署。

## 页面截图

| 页面 | 截图 |
|------|------|
| 首页 / ME+YOU 首屏 | ![首页](docs/screenshots/home.png) |
| 专辑列表 | ![专辑列表](docs/screenshots/albums.png) |
| 专辑详情 | ![专辑详情](docs/screenshots/album-detail.png) |
| 歌曲详情 / 多源播放 | ![歌曲详情](docs/screenshots/song-detail.png) |
| Solo / 小分队 / MISAMO | ![Solo Unit](docs/screenshots/solo-unit.png) |
| 成员九宫格 | ![成员九宫格](docs/screenshots/members.png) |
| 成员详情 | ![成员详情](docs/screenshots/member-detail.png) |
| 广告曲 | ![广告曲](docs/screenshots/cf-covers.png) |
| 翻唱 / Pre-debut | ![翻唱](docs/screenshots/covers.png) |
| 全局搜索 | ![全局搜索](docs/screenshots/search.png) |
| 全局播放器 | ![全局播放器](docs/screenshots/player.png) |

## 技术栈

- Monorepo：pnpm workspace
- 后端：Fastify、TypeScript、SQLite、geoip-lite
- 音乐接口：MusicSquare 使用的 QQ / 网易云 / 酷我 / JOOX 接口
- 测试：Vitest、Fastify inject
- 前端：Vue 3、Vite、Naive UI、Vue Router、Pinia、全局播放器

## 快速开始

```bash
pnpm install
pnpm seed
pnpm --filter backend test
pnpm dev
```

后端默认地址：

```text
http://localhost:3000
```

常用接口：

```http
GET /health
GET /api/meta/region-hint
GET /api/catalog/overview
GET /api/albums
GET /api/search?q=FANCY
GET /api/music/search?q=TWICE%20FANCY
GET /api/tracks/:id/music-candidates
GET /api/tracks/:id/playback?source=qq
```

## 环境变量

复制 `.env.example` 为 `.env`，按需修改：

```bash
cp .env.example .env
```

关键配置：

| 变量 | 说明 |
|------|------|
| `BACKEND_PORT` | 后端端口，默认 `3000` |
| `DATABASE_PATH` | SQLite 数据库路径 |
| `CORS_ORIGIN` | 允许访问后端的前端域名 |
| `JOOX_TOKEN` | JOOX 接口 token；为空时自动禁用 JOOX |
| `VITE_API_BASE` | 前端 API 地址 |
| `VITE_HOME_BG_VIDEO` | 首页背景视频，默认 `/media/me-you-bg.mp4`；也可填自托管 CDN 地址 |

## 首页 MV 背景

首页使用 `<video>` 静音循环播放背景视频，并保留 `ME+YOU` 合照作为兜底。把你有权分发的 `mp4` 或 `webm` 放到下面路径即可本地播放：

```text
frontend/public/media/me-you-bg.mp4
```

如果视频放在 CDN，改 `.env`：

```env
VITE_HOME_BG_VIDEO=https://your-cdn.example.com/twice/me-you-bg.mp4
```

`frontend/public/media/*` 默认不提交到 Git，避免把完整 MV 直接塞进仓库导致版权、体积和部署带宽问题。

## 音乐源规则

展示顺序固定为：

```text
QQ音乐 > 网易云 > 酷我 > JOOX
```

默认播放选择：

1. 过滤不可播放、无音频 URL、链接探测失败的候选。
2. 按音质排序：`LOSSLESS/FLAC > 320K > HQ > STD > LOW`。
3. 同音质时按来源排序：`QQ音乐 > 网易云 > 酷我 > JOOX`。
4. QQ 音乐始终作为推荐源显示；如果其它源音质明显更高，则默认播放更高音质源。

## 部署方法

当前项目推荐完整 Node 部署，因为音乐解析、SQLite 曲库、地区提示和前端路由都由 Fastify 统一提供。生产环境建议使用 Node.js 20+、pnpm 9+，并让反向代理指向后端端口 `3000`。

### 1. Windows 部署

适合 Windows Server、个人电脑常驻运行或内网部署。

```powershell
git clone https://github.com/t479842598/twice-discography.git
cd twice-discography
corepack enable
corepack prepare pnpm@9.7.0 --activate
pnpm install --frozen-lockfile
Copy-Item .env.example .env
pnpm build
pnpm start
```

`.env` 推荐配置：

```env
NODE_ENV=production
BACKEND_PORT=3000
BACKEND_HOST=0.0.0.0
DATABASE_PATH=./data/twice.db
CORS_ORIGIN=https://your-domain.com
VITE_API_BASE=/api
VITE_HOME_BG_VIDEO=/media/me-you-bg.mp4
```

后台常驻可以使用 PM2：

```powershell
npm install -g pm2
pm2 start pnpm --name twice-discography -- start
pm2 save
```

### 2. Linux 部署

适合 Ubuntu、Debian、CentOS、Rocky Linux 等服务器。

```bash
git clone https://github.com/t479842598/twice-discography.git
cd twice-discography
corepack enable
corepack prepare pnpm@9.7.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env
pnpm build
npm install -g pm2
pm2 start pnpm --name twice-discography -- start
pm2 save
pm2 startup
```

Nginx 反向代理示例：

```nginx
server {
  listen 80;
  server_name your-domain.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

如果要使用首页 MV 背景，把有权分发的文件放到：

```text
frontend/public/media/me-you-bg.mp4
```

然后重新运行：

```bash
pnpm build
pm2 restart twice-discography
```

### 3. 宝塔面板部署

适合用宝塔管理站点、SSL 和反向代理。

1. 软件商店安装 `Node.js 版本管理器`、`PM2 管理器`、`Nginx`。
2. 在 Node.js 版本管理器中安装 Node.js `20` 或更高版本。
3. 上传或拉取代码到 `/www/wwwroot/twice-discography`。
4. 在宝塔终端执行：

```bash
cd /www/wwwroot/twice-discography
corepack enable
corepack prepare pnpm@9.7.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env
pnpm build
```

5. 在 PM2 管理器中新建项目：

| 项目 | 配置 |
|------|------|
| 项目名称 | `twice-discography` |
| 运行目录 | `/www/wwwroot/twice-discography` |
| 启动命令 | `pnpm start` |
| 端口 | `3000` |
| Node 版本 | `20+` |

6. 在宝塔网站中新建站点并设置反向代理：

| 项目 | 配置 |
|------|------|
| 目标 URL | `http://127.0.0.1:3000` |
| 发送域名 | `$host` |
| 缓存 | 关闭 |

7. 在宝塔 SSL 面板申请证书，开启 HTTPS 后把 `.env` 的 `CORS_ORIGIN` 改成你的域名。

## 测试

```bash
pnpm verify-data
pnpm build
pnpm test
pnpm export-static
```

单独后端验证：

```bash
pnpm --filter backend test
pnpm --filter backend build
```

当前已覆盖：

- 曲库 overview、专辑详情、站内搜索。
- QQ lossless 存在时默认选 QQ。
- QQ 音质较低时选择更高音质来源。
- 同音质时 QQ 优先于网易云。
- QQ 失败时回退到网易云。
- 歌曲候选接口和播放接口返回可用数据。

## License

MIT
