---
spec: '02-00-audit-and-a11y-fixes'
scene: '00-default'
created: '2026-08-01'
---

# 02-00 Audit And A11y Fixes - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pending → in_progress → completed / failed；blocked 可回 in_progress；failed 可回 pending 重试。

## 阶段 1

<!-- FILL: 使用 task_create 追加任务；任务会以 `### T-XXX 标题 <!-- lrnev-task: ... -->` 形式追加到这里 -->

## 验收标准（整体）

- <!-- FILL: 按本 Spec 调整整体验收清单 -->
- [ ] 所有任务完成
- [ ] 单元测试通过
- [ ] 集成测试通过

### T-001 UX-08 shadow-soft token 补齐 <!-- lrnev-task: status=completed, created=2026-08-01T05:24:35.662Z, updated=2026-08-01T05:54:56.840Z -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-08-01T05:44:46.738Z"},{"from":"in_progress","to":"completed","at":"2026-08-01T05:54:56.840Z"}] -->

定义 --shadow-soft 浅/暗值并收敛 --accent-gradient 使用

**验收**：
- WHEN 浅色/暗色主题下渲染 MusicStation 面板 THEN 阴影 token 有定义不退化

### T-002 UX-03 全局 prefers-reduced-motion <!-- lrnev-task: status=completed, created=2026-08-01T05:24:36.188Z, updated=2026-08-01T05:54:58.230Z -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-08-01T05:54:57.452Z"},{"from":"in_progress","to":"completed","at":"2026-08-01T05:54:58.230Z"}] -->

global.css 加全局 reduce 规则；组件 scoped 动效实现 reduce 分支；轮播/背景视频停止自动

**验收**：
- WHEN prefers-reduced-motion THEN 全局动画/轮播/视频自动行为停止

### T-003 UX-05 首页轮播键盘与暂停 <!-- lrnev-task: status=completed, created=2026-08-01T05:24:36.756Z, updated=2026-08-01T05:54:59.459Z -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-08-01T05:54:58.793Z"},{"from":"in_progress","to":"completed","at":"2026-08-01T05:54:59.459Z"}] -->

轮播支持键盘前后切换、可见暂停/继续按钮、aria-current、i18n 文案、reduce 停止自动轮播

**验收**：
- WHEN 键盘聚焦轮播 THEN 可前后切换并暂停/继续

### T-004 UX-07 i18n 与 emoji 清理 <!-- lrnev-task: status=completed, created=2026-08-01T05:24:37.375Z, updated=2026-08-01T05:55:00.562Z -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-08-01T05:54:59.999Z"},{"from":"in_progress","to":"completed","at":"2026-08-01T05:55:00.562Z"}] -->

AppShell ☀/☾ 换 SVG；AdminMvsView BVID placeholder、MemberDetailView MBTI 入消息表

**验收**：
- WHEN 切换主题 THEN 使用可访问 SVG 图标而非 emoji

### T-005 SEC-08/09 缓存清理与 gitignore <!-- lrnev-task: status=completed, created=2026-08-01T05:24:37.938Z, updated=2026-08-01T05:55:01.704Z -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-08-01T05:30:29.743Z"},{"from":"in_progress","to":"completed","at":"2026-08-01T05:55:01.704Z"}] -->

music_cache 过期行定时清理与条数上限；移除 .gitignore 的 !data/twice.db 反向规则并取消跟踪占位文件

**验收**：
- WHEN 运行一段时间 THEN 过期缓存行被清理且有规模上限

### T-006 UX-02 admin 外壳样式单一所有权 <!-- lrnev-task: status=completed, created=2026-08-01T05:24:38.467Z, updated=2026-08-01T05:55:02.879Z -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-08-01T05:55:02.353Z"},{"from":"in_progress","to":"completed","at":"2026-08-01T05:55:02.879Z"}] -->

admin-login-link/admin-account-button/admin-auth-slot 收敛到 admin.css，删除 global.css 重复规则

**验收**：
- WHEN 前后台加载 THEN 无重复定义互相覆盖
