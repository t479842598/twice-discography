---
spec: '01-00-mv-playback-performance'
scene: '00-default'
created: '2026-08-01'
---

# 01-00 Mv Playback Performance - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pending → in_progress → completed / failed；blocked 可回 in_progress；failed 可回 pending 重试。

## 阶段 1

<!-- FILL: 使用 task_create 追加任务；任务会以 `### T-XXX 标题 <!-- lrnev-task: ... -->` 形式追加到这里 -->

## 验收标准（整体）

- <!-- FILL: 按本 Spec 调整整体验收清单 -->
- [ ] 所有任务完成
- [ ] 单元测试通过
- [ ] 集成测试通过

### T-001 后端 MV 解析 TTL 缓存 <!-- lrnev-task: status=completed, created=2026-08-01T05:24:17.180Z, updated=2026-08-01T05:30:29.109Z -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-08-01T05:24:53.595Z"},{"from":"in_progress","to":"completed","at":"2026-08-01T05:30:29.109Z"}] -->

resolveBiliMvPlayback 的 view+playurl 改为 withMusicCache TTL 缓存（8 分钟，最小必要元数据），/stream 路由复用同一缓存

**验收**：
- WHEN 重复打开同一 MV THEN 解析命中缓存不再请求 B站上游
- WHEN 缓存过期或解析失败 THEN 自动回源且不缓存失败

### T-002 前端 MV 预热 <!-- lrnev-task: status=completed, created=2026-08-01T05:24:17.733Z, updated=2026-08-01T05:45:17.012Z -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-08-01T05:45:16.464Z"},{"from":"in_progress","to":"completed","at":"2026-08-01T05:45:17.012Z"}] -->

首页空闲时按需预取可见/精选 MV playback；限流、可取消；遵守 save-data 与 prefers-reduced-motion

**验收**：
- WHEN 首页加载完成且空闲 THEN 精选 MV 播放解析被预取
- WHEN 用户数据节省或减少动态效果 THEN 不预取

### T-003 MV 默认画质降级起播与记忆 <!-- lrnev-task: status=completed, created=2026-08-01T05:24:18.271Z, updated=2026-08-01T05:45:18.142Z -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-08-01T05:45:17.589Z"},{"from":"in_progress","to":"completed","at":"2026-08-01T05:45:18.142Z"}] -->

首次以 480P 起播保证首帧，播放稳定后自动升到用户上次选择画质；版本化 localStorage 记忆

**验收**：
- WHEN 首次打开 MV THEN 以低画质快速出首帧
- WHEN 用户选择过画质 THEN 后续打开以该画质为上限自动升级

### T-004 DASH 播放器优化 <!-- lrnev-task: status=completed, created=2026-08-01T05:24:18.847Z, updated=2026-08-01T05:45:19.167Z -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-08-01T05:45:18.666Z"},{"from":"in_progress","to":"completed","at":"2026-08-01T05:45:19.167Z"}] -->

AbortController 贯穿 fetch；Range 分段拉取 + 背压预算（不整流拉完）；视频就绪即起播；真实缓冲态

**验收**：
- WHEN 关闭播放器/切画质/路由离开 THEN 未完成下载立即中断
- WHEN 缓冲充足 THEN 停止继续下载整个流

### T-005 MV 加载 UI 与低延迟策略 <!-- lrnev-task: status=completed, created=2026-08-01T05:24:19.392Z, updated=2026-08-01T05:45:20.215Z -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-08-01T05:45:19.688Z"},{"from":"in_progress","to":"completed","at":"2026-08-01T05:45:20.215Z"}] -->

视频容器 poster + 真实加载/缓冲文案（i18n 五语言）；删除 setTimeout(3000) 假计时器；B站官方 iframe 低延迟策略开关；CDN preconnect

**验收**：
- WHEN 视频加载中 THEN 显示真实状态文案而非固定计时器
- WHEN 无凭证或代理不可达 THEN 可切换到官方 iframe 播放
