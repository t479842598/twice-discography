---
spec: '02-00-audit-and-a11y-fixes'
scene: '00-default'
status: in-progress
priority: P2
created: '2026-08-01'
---

# 02-00 Audit And A11y Fixes - 需求

## L0 摘要

DESIGN_SPECS §8 审计 quick wins：admin 样式单一所有权、全局 reduce-motion、轮播可访问性、i18n/emoji 清理、CSS token 补齐、缓存清理与 gitignore 修正。

## L1 概览

### 目标

- 消除后台外壳样式的重复定义与互相覆盖（UX-02）。
- 全局尊重 prefers-reduced-motion（UX-03）；轮播键盘可操作、可暂停（UX-05）。
- 无硬编码用户可见文本与功能 emoji（UX-07）；CSS token 无未定义引用（UX-08）。
- music_cache 不无限膨胀（SEC-08）；仓库不再跟踪占位数据库（SEC-09）。

### 用户故事

- 作为键盘/读屏用户，我希望轮播可暂停、可前后切换且文案本地化。
- 作为减少动态效果用户，我希望页面动画与自动轮播停止。
- 作为后台使用者，我希望管理入口样式一致不被全局规则破坏。

### 范围

**包含**：UX-02/03/05/07/08、SEC-08/09。

**不包含**：UX-04（/variety 发布决策，需产品确认）、UX-06（全局 .n-button/.n-tag 覆盖重构，高风险排期）、UX-09（各页 loading/error 统一，独立工作包）、SEC-06/07（限速与 last-owner，独立工作包）。

## L2 详情

### 详细需求

#### F-01 admin 外壳样式单一所有权（UX-02）
- admin-login-link/admin-account-button/admin-auth-slot 收敛到 admin.css，global.css 不再定义。
- 验收：WHEN 前后台加载 THEN 无重复规则互相覆盖。

#### F-02 全局 prefers-reduced-motion（UX-03）
- global.css 全局 reduce 规则；轮播自动切换、MV 预热在 reduce 下停止。
- 验收：WHEN prefers-reduced-motion THEN 全局动画/自动轮播停止。

#### F-03 轮播键盘与暂停（UX-05）
- 可见暂停/继续按钮、左右方向键、aria-current、i18n slide 文案（五语言）。
- 验收：WHEN 键盘聚焦轮播 THEN 可前后切换并暂停/继续。

#### F-04 i18n 与 emoji 清理（UX-07）
- AppShell 主题切换改 SVG 图标；BVID/P 占位符、MBTI 标签入消息表。
- 新增 i18n 完整性单元测试（五语言无缺 key）。
- 验收：WHEN 切换主题 THEN 使用可访问 SVG 而非 emoji；WHEN 运行 i18n 测试 THEN 无缺失 key。

#### F-05 token 与缓存/仓库卫生（UX-08、SEC-08/09）
- 定义 --shadow-soft 浅/暗值；music_cache 过期清理 + 5k 行上限（启动 + 每 10 分钟）。
- 移除 .gitignore 的 `!data/twice.db` 反向规则并取消跟踪占位文件。
- 验收：WHEN 浅/暗主题渲染 THEN token 有定义；WHEN 运行一段时间 THEN 缓存有界。
