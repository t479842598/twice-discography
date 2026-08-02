---
spec: '02-00-audit-and-a11y-fixes'
scene: '00-default'
created: '2026-08-01'
---

# 02-00 Audit And A11y Fixes - 设计

## L0 摘要

按 DESIGN_SPECS §8 quick-wins 收敛后台样式单一所有权、补全局 reduce-motion 与轮播可访问性、清理 i18n/emoji、补齐 CSS token、给 music_cache 加有界清理并移除 gitignore 反向规则。

## L1 概览

### 架构思路

- 以最小侵入落地：CSS token 与全局 reduce 规则收敛到 `global.css`（单一入口），后台外壳样式收敛到 `admin.css`（单一所有权），JS 侧（轮播/视频/预热）显式检查 `prefers-reduced-motion`。
- 缓存清理复用既有 `withMusicCache` 的 `music_cache` 表，仅新增删除过期行 + 条数上限，不改变读写语义。
- 仓库卫生：删除 gitignore 反向规则、取消跟踪占位 DB，不引入新的构建步骤。

### 主要模块

- `frontend/src/styles/global.css`（token + 全局 reduce 规则）
- `frontend/src/styles/admin.css`（admin 外壳样式单一所有权）
- `frontend/src/views/HomeView.vue`（轮播键盘/暂停/aria/reduce 停止 + 预热 reduce 检查）
- `frontend/src/components/layout/AppShell.vue`（主题 SVG 图标）
- `frontend/src/views/AdminMvsView.vue` / `MemberDetailView.vue`（placeholder/MBTI 入消息表）
- `frontend/src/i18n/messages.ts` + `messages.test.ts`（i18n 完整性测试）
- `backend/src/services/musicCache.ts` + `backend/src/server.ts`（缓存清理定时任务）
- `.gitignore`（移除 `!data/twice.db`）

### 关键决策

| 决策 | 选项 | 倾向 | 是否产 ADR | 备注 |
| --- | --- | --- | --- | --- |
| 全局 reduce 规则的落点 | 每组件分散 vs global.css 全局 `*` 规则 | global.css 全局规则 + JS 侧显式检查 | 否 | 全局规则收敛一切 transition/animation 时长，JS 侧停止轮播/视频/预热的自动行为 |
| admin 外壳样式所有权 | 保留 global.css 重复定义 vs 收敛到 admin.css | 收敛到 admin.css | 否 | 删除 global.css 中 admin-login-link/admin-account-button/admin-auth-slot 重复规则 |
| music_cache 清理策略 | 仅 TTL 判断 vs 定时删除 + 条数上限 | 启动 + 每 10 分钟删除过期行 + 5k 行上限 | 否 | 复用 `withMusicCache`，新增 `cleanupMusicCache()`；SEC-08 |

## L2 详情

### 模块详细设计

#### D-01 admin 外壳样式单一所有权（UX-02）

- `admin-login-link`/`admin-account-button`/`admin-auth-slot` 及 hover/暗色变体仅保留在 `admin.css`；`global.css` 中对应规则删除。
- 验收对齐 F-01：前后台加载无重复规则互相覆盖。

#### D-02 全局 prefers-reduced-motion（UX-03）

- `global.css` 顶部（`:root` token 之后）新增 `@media (prefers-reduced-motion: reduce)` 全局规则：`*`/`::before`/`::after` 的 `animation-duration: 0.01ms`、`animation-iteration-count: 1`、`transition-duration: 0.01ms`、`scroll-behavior: auto`（均 `!important`）。
- JS 侧：`HomeView.startCarousel()` 在 `prefersReducedMotion()` 或暂停态下不启动 interval；`startHeroVideo()` reduce 下不自动播放；`shouldPrewarmMv()` reduce/save-data 下跳过预热。
- 残余（记录在案）：scoped `LyricsDisplay` 的 `fadeInUp` 无组件内 reduce 分支（由全局 `*` 规则兜底）；`MusicStationView` 结果卡 hover `translateY(-3px)` 未显式禁用（全局规则只收敛时长，位移本身在 reduce 下瞬间生效）。

#### D-03 轮播键盘与暂停（UX-05）

- 轮播容器 `tabindex="0"` + `aria-roledescription="carousel"`，`keydown.left/right` 前后切换并重置计时器。
- 可见暂停/继续按钮（`aria-pressed`）、左右箭头按钮（`aria-label` i18n）、圆点按钮（`aria-current="true"` + `home.slideAria` 五语言文案）。
- `mouseenter` 暂停、`mouseleave` 恢复；`carouselPaused` 与 reduce 检查阻止自动重启。

#### D-04 i18n 与 emoji 清理（UX-07）

- `AppShell` 主题切换 ☀/☾ emoji 换为内联 SVG（`aria-hidden` + 按钮 `aria-label` i18n）。
- `AdminMvsView` BVID/页码/链接 placeholder、`MemberDetailView` MBTI 标签入 `messages.ts`。
- 新增 `messages.test.ts`：五语言覆盖 zh-CN 全部 key、无空值、插值 key 可翻译；`zh-TW` 由 `toTraditional()` 派生。

#### D-05 token 与缓存/仓库卫生（UX-08、SEC-08/09）

- `--shadow-soft` 在 `global.css` 的 `:root`（浅）与 `:root[data-theme='dark']`（暗）定义，`MusicStationView` 等引用处有确定值。
- `backend/src/services/musicCache.ts`：`cleanupMusicCache()` 删除 `expires_at <= now` 的过期行，并按 `updated_at DESC` 保留最新 `MUSIC_CACHE_MAX_ROWS=5000` 行；`server.ts` 启动时执行一次 + `setInterval` 每 10 分钟执行（best-effort，失败不影响播放）。
- `.gitignore`：移除 `!data/twice.db` 反向规则；`data/twice.db` 空占位文件不再被 Git 跟踪（`git ls-files` 验证）。

### 数据模型

- 无新增表/字段。复用 `music_cache`（`cache_key`/`value_json`/`expires_at`/`created_at`/`updated_at`）。
- 新增模块级常量 `MUSIC_CACHE_MAX_ROWS = 5_000`。

### 接口契约

- 新增导出 `cleanupMusicCache()`（`musicCache.ts`），无入参、void、best-effort。
- `global.css` 新增 token `--shadow-soft`（浅/暗两值）。
- `messages.ts` 新增 `home.slideAria`/`home.carouselPause`/`home.carouselPlay`、`admin.mvs.bvidPlaceholder`/`pagePlaceholder`/`linkPlaceholder`/`coverPlaceholder`、`member.mbti` 等 key。

### 错误处理

- 缓存清理全程 try/catch，任何失败静默忽略（缓存清理不得破坏音乐播放）。
- 轮播数据加载失败（`api.homeFeaturedMvs()`）回退到非视频 Hero，不抛未处理异常。
- i18n 完整性测试为硬门禁：缺 key/空值即测试失败。

### 测试策略

- 单元：`messages.test.ts`（五语言无缺 key、无空值、插值翻译）；`audio.test.ts` 仅涉及音量（见 03-00）。
- 人工验收：浅/暗主题渲染 token 有定义；`prefers-reduced-motion` 下轮播/视频/预热停止；键盘可前后切换并暂停/继续；`git ls-files` 无 `data/twice.db`。
