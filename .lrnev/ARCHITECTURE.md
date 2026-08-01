---
title: 'TWICE Discography Architecture'
created: '2026-08-01'
---

# TWICE Discography 架构

## L0 摘要

Vue 3 + Vite 前端（Pinia/Naive UI）＋ Fastify 5 + better-sqlite3 后端（Zod 校验、签名流代理）＋ Cloudflare Worker 边缘代理；单体与分离双部署模式。

## L1 概览

### 技术栈

- 前端：Vue 3、TypeScript、Vue Router、Pinia、Naive UI、Vite、`@vicons/ionicons5`
- 后端：Fastify 5、better-sqlite3、Zod、dotenv、geoip-lite
- 边缘：Cloudflare Worker（`workers/mv-proxy`，HMAC 签名 URL + host 白名单 + Range 透传）
- 测试：vitest（后端）、supertest；前端测试待补（§7.1）
- 包管理：pnpm workspace（`backend/`、`frontend/`、`workers/`）

### 主要模块

- `frontend/src/views/`：Home/Albums/AlbumDetail/Tracks/TrackDetail/Members/SoloUnit/Cfs/Covers/Variety/MusicStation + 后台 5 视图
- `frontend/src/components/player/`：`MiniAudioBar.vue`（唯一 `<audio>`）、`MvPlayer.vue`、`dashPlayer.ts`（MediaSource DASH）、`LyricsDisplay.vue`
- `backend/src/routes/`：catalog/meta/music/mv/tracks/admin
- `backend/src/services/`：biliCredential（B站解析+签名）、musicCache（TTL 缓存）、musicProviders、musicR2Cache、adminAuth
- `workers/mv-proxy/src/index.ts`：边缘流代理

### 关键数据流

- 播放：`audioStore.playTrack()` → `/api/tracks/:id/playback`（musicProviders 解析+R2 缓存）→ 唯一 `<audio>`。
- MV：`MvPlayer` → `/api/mv/:trackId/playback`（`resolveBiliMvPlayback`：view→cid→playurl，TTL 缓存）→ 签名 Worker URL 或内置 `/stream` → MP4 或 DASH。
- 后台：session cookie + CSRF token + Origin 白名单；角色（owner/editor/viewer+自定义）在服务端鉴权。

### 部署

- 单体：`SERVE_FRONTEND=true` Fastify 托管 `frontend/dist`；分离：前端静态托管 + `FRONTEND_ORIGIN`。
- 生产要求 `MV_PROXY_BASE_URL` + `MV_PROXY_SIGNING_SECRET`（Worker 边缘）；内置代理仅作降级。
- `render.yaml` 为 Render 部署配置；`.env.production.example` 为环境变量模板。
