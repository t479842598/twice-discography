---
title: 'TWICE Discography'
created: '2026-08-01'
---

# TWICE Discography

## L0 摘要

TWICE 全曲库（专辑/曲目/成员/广告曲/翻唱/MV）的公开目录站点，带全局播放器、音乐站多源检索与后台管理，支持五语言与暗色优先主题。

## L1 概览

### 项目目标

- 按年份/专辑/曲目/成员浏览 TWICE 完整音乐目录，提供可播放音源与歌词、MV 观看。
- 提供 Music Station 多源音乐搜索（QQ/网易云/酷我/JOOX）与下载。
- 提供受权限保护的后台（MV 配置、B站凭证、用户角色）。
- 以可访问（WCAG 2.2 AA）、可测试、可维护的生产级标准交付；`DESIGN_SPECS.md` 为唯一实施规格。

### 核心用户

- TWICE 粉丝 / 音乐目录浏览者；后台内容管理者。

### 当前阶段

- 生产迭代中：公开目录与播放器已上线；本轮为 MV 播放性能优化（§6.4）与审计修复（§8）。

## L2 详情

### 背景

- 单体部署（Fastify 托管前端静态文件）或前后端分离（`FRONTEND_ORIGIN`/`CORS_ORIGIN`）双模式。
- 数据在 SQLite（`backend/data/twice.db`），种子脚本 `pnpm seed` 重建。
- MV 播放链路：B站 view+playurl 解析 → 签名 URL → Cloudflare Worker 边缘代理（`workers/mv-proxy`）或内置 `/api/mv/:trackId/stream` 代理 → 前端 MP4/DASH（MediaSource）。

### 边界与范围

**包含**：公开目录、播放/队列/歌词、MV 播放、Music Station、后台（MV/凭证/用户）、多语言、部署。

**不包含**：专辑/曲目/音源/歌词/成员的内容写 API（`DESIGN_SPECS.md` §3.3 独立工作包，未完成前 UI 不展示假的编辑能力）。

### 关键约束

- 全站唯一 `<audio>` 在 `MiniAudioBar.vue`；`audio` Pinia store 是唯一播放状态来源，不得创建第二条播放链路。
- i18n 五语言（zh-CN/zh-TW/en-US/ja-JP/ko-KR）全覆盖，新增可见文本必须进消息表。
- 后端认证/授权服务端执行；写操作审计；凭证/密码永不落日志。
