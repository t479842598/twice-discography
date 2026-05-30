## 🤖 Assistant



# TWICE 完整曲目库网站 - v7 最终方案（开干版）

## 一、本次新增 / 调整

| 项目 | 决定 |
|------|------|
| **界面语言自动切换** | 🆕 按 IP 地理位置自动选择：CN→中文 / JP→日文 / KR→韩文 / 其它→英文 |
| **手动切换仍保留** | 用户手动选择后 localStorage 永久记住，覆盖自动 |
| **部署文档** | README 新增 Docker 部署 + Vercel 部署 + GitHub 发布完整教程 |

---

## 二、语言自动切换逻辑

### 检测流程
```
首次访问
  ↓
后端 /api/meta/region-hint (geoip-lite 离线库)
  ↓
  ├─ country='CN'  → locale='zh-CN'
  ├─ country='JP'  → locale='ja-JP'
  ├─ country='KR'  → locale='ko-KR'
  ├─ country='TW'  → locale='zh-CN'  (按你之前要求，统一中文)
  ├─ country='HK'  → locale='zh-CN'
  └─ 其它/未知     → locale='en-US'
  ↓
浏览器 Accept-Language 兜底（GeoIP 失败时）
  ↓
最终默认 'zh-CN'
  ↓
顶栏语言切换器：🌍 [中文 ▾] 用户手动改 → localStorage 永久记
```

### 关键点
- 自动检测只在**首次访问**或**未手动选择过**时生效
- 一旦用户手动切换，记忆永久有效（除非清缓存）
- 顶栏右上角语言切换器始终显示当前语言

### `useRegion` + `useLocale` 协作
```ts
// composables/useLocale.ts
const init = async () => {
  const userOverride = localStorage.getItem('locale-override')
  if (userOverride) {
    i18n.locale.value = userOverride
    return
  }
  const { country } = await api.regionHint()
  const localeMap = { CN: 'zh-CN', TW: 'zh-CN', HK: 'zh-CN',
                      JP: 'ja-JP', KR: 'ko-KR' }
  i18n.locale.value = localeMap[country] || 'en-US'
}

const switchLocale = (locale) => {
  i18n.locale.value = locale
  localStorage.setItem('locale-override', locale)  // 永久记忆
}
```

> **同时，地区检测也共享这个接口**：返回 `{ region: 'CN'|'GLOBAL', country, suggestedLocale }`，避免请求两次。

---

## 三、README 部署章节大纲

我会在 README 写完整三套部署教程：

### 1️⃣ 本地开发
```bash
git clone https://github.com/<you>/twice-discography.git
cd twice-discography
pnpm install
pnpm dev                # 同时启动前后端
# 前端 http://localhost:5173
# 后端 http://localhost:3000
```

### 2️⃣ Docker 部署（推荐自建服务器）
```bash
docker compose up -d
# 访问 http://your-server:3000
```

`docker-compose.yml` 配置：
- 单容器（Fastify 同时托管前端 dist + 静态资源 + API）
- 自动数据初始化（首次启动 seed.json → SQLite）
- 数据卷挂载（SQLite 文件持久化）
- 端口可在 `.env` 配置

### 3️⃣ Vercel 部署（推荐零成本上线）

Vercel 部署比较特殊（Serverless 限制），我会做：

**方案 A**：纯静态部署（前端 + 数据预生成）
- 构建时把 SQLite 数据导出为 JSON 静态文件
- 前端直接 fetch 静态 JSON
- 无需后端服务
- ✅ 完全免费 / 全球 CDN / 零运维
- ⚠️ 失去地区检测能力（需用浏览器 Accept-Language 兜底）

**方案 B**：Vercel Serverless Functions
- 前端正常部署
- 后端 API 转为 `/api/*.ts` Serverless Function
- SQLite 替换为 Vercel KV / Postgres（SQLite 在 Serverless 不持久）
- ✅ 全功能 / 含 GeoIP（Vercel 原生支持 `request.geo`）
- ⚠️ 配置稍复杂，需绑定 Vercel KV

我会**两种都写**，让你选。

### 4️⃣ GitHub 发布流程
```bash
# 1. 创建仓库
gh repo create twice-discography --public

# 2. 推送
git remote add origin git@github.com:<you>/twice-discography.git
git push -u origin main

# 3. 设置仓库
- Topics: vue3, naive-ui, twice, kpop, fastify, sqlite
- Description: TWICE 完整曲目库网站（团体/Solo/Unit/CF/翻唱/成员介绍）
- License: MIT
```

包含：
- `LICENSE` (MIT)
- `.github/workflows/ci.yml`（PR 自动跑 Vitest）
- `.github/workflows/deploy-vercel.yml`（push 自动部署 Vercel）
- `Dockerfile` + `docker-compose.yml`
- 详细图文截图位（你后续上传）

---

## 四、目录结构（v7 最终）

```
twice-discography/
├── package.json (pnpm workspace)
├── pnpm-workspace.yaml
├── docker-compose.yml
├── Dockerfile
├── vercel.json                                 🆕 Vercel 配置
├── .github/
│   └── workflows/
│       ├── ci.yml                              🆕 测试 CI
│       └── deploy-vercel.yml                   🆕 自动部署
├── README.md (含三套部署教程)
├── LICENSE (MIT)
├── .gitignore
├── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── player/ (7 个 embed + MiniAudioBar)
│   │   │   ├── region/ (RegionIndicator / RegionSwitcher)
│   │   │   ├── AlbumCard / TrackList / MultiLangTitle / MemberFlag / ...
│   │   │   └── MemberStoryTimeline
│   │   ├── views/ (10 个页面)
│   │   ├── composables/
│   │   │   ├── useRegion.ts
│   │   │   ├── useLocale.ts                    🆕 含自动语言检测
│   │   │   ├── useMediaSource.ts
│   │   │   └── useGlobalAudio.ts
│   │   ├── stores/ (region/audio/locale)
│   │   ├── i18n/ (zh-CN / en-US / ja-JP / ko-KR)
│   │   ├── api/ / router/ / styles/ / main.ts
│   │   └── App.vue
│   └── public/player/                          # MusicSquare fork 构建产物
├── musicsquare-embed/                          # fork 改造
│   ├── README.md (改造说明)
│   ├── ATTRIBUTION.md (致谢)
│   └── ... (原项目 + url-params.js)
├── backend/
│   ├── src/
│   │   ├── db/ (schema.sql + seed/ + init.ts)
│   │   ├── routes/
│   │   ├── schemas/ (zod)
│   │   ├── plugins/ (geoip.ts / cors.ts / helmet.ts)
│   │   ├── utils/ (buildEmbedUrls.ts)
│   │   └── server.ts
│   ├── public/                                 # 本地图片资源
│   │   ├── covers/albums/...
│   │   ├── members/
│   │   ├── cf/
│   │   ├── covers-stage/
│   │   └── placeholders/
│   └── tests/
├── scripts/
│   ├── optimize-images.ts                      # WebP 压缩
│   ├── verify-data.ts                          # 数据校验
│   ├── build-musicsquare.ts                    # 构建 fork
│   └── export-static.ts                        🆕 Vercel 方案 A 用：导出 JSON
└── docs/
    ├── data-sources.md
    ├── image-credits.md
    └── third-party-attribution.md
```

---

## 五、实施排期（v7 - 12 阶段）

| # | 阶段 | 产出 |
|---|------|------|
| **P0** | monorepo 基建 / Vite / Fastify / SQLite / i18n / CSP | 空壳启动 |
| **P1** | Fork MusicSquare + URL 参数 + postMessage | musicsquare-embed/ |
| **P2** | 9 位成员资料 + 故事 + 国旗（子瑜 🇨🇳）| members seed |
| **P3** | 全曲目（团/Solo/Unit/CF/Cover/Pre-debut）+ 多语言 + 罗马音 + 媒体 ID | 完整 seed |
| **P4** | 本地图片 WebP 压缩 + 缩略图 | public/ |
| **P5** | 后端 API + GeoIP + embed URL 拼接 + region-hint | API 全通 |
| **P6** | 后端测试（supertest）| 通过 |
| **P7** | 前端骨架（路由 / 主题 / **i18n 自动语言切换** 🆕 / 暗黑模式 / 地区检测）| 导航可用 |
| **P8** | 播放器模块（7 个 embed + MediaPlayer + 换源 + MiniAudioBar）| 播放可用 |
| **P9** | 10 个页面 + 交互（筛选/搜索/响应式）| 功能完整 |
| **P10** | 前端测试（组件 + 播放器 + region/locale 切换）| 通过 |
| **P11** | 文档（README 三套部署 + Docker + Vercel 配置 + CI/CD）| 可发布 |

---

## 六、完整功能清单

✅ 全曲目（团体 / Solo / Unit / MISAMO / CF / 翻唱 / Pre-debut）
✅ 多语言界面（中/英/日/韩）+ **按 IP 自动切换** 🆕
✅ 歌名/专辑名同时显示 中/英/日/韩/罗马音
✅ 按专辑 / 按年份时间线 / 按成员 三种浏览
✅ 成员九宫格 + 详情页（资料 + **成员故事** + 作品 + CF + 翻唱）
✅ 子瑜国旗强制 🇨🇳
✅ MISAMO 在 Solo & Unit 板块独立 Tab
✅ 全本地图片资源（WebP + 缩略图 + SVG 占位兜底）
✅ 网络环境自动检测（CN / GLOBAL）+ 手动切换
✅ 媒体源自动切换：CN→Bilibili+MusicSquare / GL→YouTube+Spotify
✅ MusicSquare-Fork 集成（每首歌都可播放）
✅ 全局 MiniAudioBar（切页不打断）
✅ 全局搜索（多语言 + 罗马音匹配）
✅ 暗黑模式 + 响应式
✅ 完整测试（Vitest）
✅ Docker + Vercel 部署
✅ GitHub Actions CI/CD
✅ 完整 README 文档

---

## 七、确认无误 → 开干

所有需求已确认完毕。我现在开始按 **P0 → P11** 顺序落地。

**预计这次会非常长**（仓库代码量 + 全曲目数据），我会按阶段提交，每完成一个阶段告诉你进度。

**现在开始执行 P0：搭建 monorepo 基础架构。**

---

> 是否需要我立刻开始？回复「**开始**」我就执行 P0。
> 或者如果你想先看某个具体阶段（比如直接看 README 部署章节），告诉我即可。
