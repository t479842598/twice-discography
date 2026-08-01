---
spec: '04-00-pending-product-decisions'
scene: '00-default'
created: '2026-08-01'
---

# 04-00 Pending Product Decisions - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pending → in_progress → completed / failed；blocked 可回 in_progress；failed 可回 pending 重试。

## 阶段 1

<!-- FILL: 使用 task_create 追加任务；任务会以 `### T-XXX 标题 <!-- lrnev-task: ... -->` 形式追加到这里 -->

## 验收标准（整体）

- <!-- FILL: 按本 Spec 调整整体验收清单 -->
- [ ] 所有任务完成
- [ ] 单元测试通过
- [ ] 集成测试通过

### T-001 UX-04 /variety 发布或删除（产品决策） <!-- lrnev-task: status=blocked, created=2026-08-01T07:12:09.427Z, updated=2026-08-01T07:12:29.372Z -->
<!-- lrnev-task-history: [{"from":"pending","to":"blocked","at":"2026-08-01T07:12:29.372Z"}] -->

DESIGN_SPECS §8 UX-04：/variety 路由目前重定向首页。决策：发布（注册路由+i18n+iframe sandbox+URL 白名单）或删除所有入口与死代码。

**验收**：
- WHEN 产品确认发布或删除 THEN 按决策实施并移除重定向

### T-002 UX-06 全局 .n-button/.n-tag 覆盖重构（排期） <!-- lrnev-task: status=blocked, created=2026-08-01T07:12:09.980Z, updated=2026-08-01T07:12:29.939Z -->
<!-- lrnev-task-history: [{"from":"pending","to":"blocked","at":"2026-08-01T07:12:29.939Z"}] -->

DESIGN_SPECS §8 UX-06：global.css 的全局 !important 规则改为自有 BEM class，避免破坏 Naive UI 状态色/焦点/尺寸。高风险视觉改动，需单独排期与视觉回归。

**验收**：
- WHEN 排期实施 THEN 无全局 !important 覆盖且视觉回归通过

### T-003 SEC-06 全局限速与外部请求超时（排期） <!-- lrnev-task: status=blocked, created=2026-08-01T07:12:10.549Z, updated=2026-08-01T07:12:30.531Z -->
<!-- lrnev-task-history: [{"from":"pending","to":"blocked","at":"2026-08-01T07:12:30.531Z"}] -->

DESIGN_SPECS §8 SEC-06：Fastify 全局 body size/request timeout/登录退避；musicR2Cache 等外部请求补 timeout/大小限制/取消传播。

**验收**：
- WHEN 实施 THEN 无超时外部请求占用 Node 连接

### T-004 SEC-07 最后一个 owner 保护与写审计（排期） <!-- lrnev-task: status=blocked, created=2026-08-01T07:12:11.060Z, updated=2026-08-01T07:12:31.181Z -->
<!-- lrnev-task-history: [{"from":"pending","to":"blocked","at":"2026-08-01T07:12:31.181Z"}] -->

DESIGN_SPECS §8 SEC-07：服务端事务阻止移除/禁用最后一个 active owner；写操作审计表与记录。

**验收**：
- WHEN 实施 THEN 无法锁死最后一个 owner 且写操作有审计

### T-005 UX-09 各页 loading/error/404 统一（排期） <!-- lrnev-task: status=blocked, created=2026-08-01T07:12:11.627Z, updated=2026-08-01T07:12:31.692Z -->
<!-- lrnev-task-history: [{"from":"pending","to":"blocked","at":"2026-08-01T07:12:31.692Z"}] -->

DESIGN_SPECS §8 UX-09：Albums/Members/AlbumDetail/TrackDetail/MemberDetail 统一 request state、AbortController、重试与 404/网络失败区分。

**验收**：
- WHEN 实施 THEN 无永久 skeleton 且 404/网络失败区分展示

### T-006 §6.4 方案6 DASH 解析移入 Web Worker（排期） <!-- lrnev-task: status=blocked, created=2026-08-01T07:12:12.142Z, updated=2026-08-01T07:12:32.342Z -->
<!-- lrnev-task-history: [{"from":"pending","to":"blocked","at":"2026-08-01T07:12:32.342Z"}] -->

mp4box 分段解析从主线程移入 Web Worker，主线程只做 SourceBuffer 追加与背压。

**验收**：
- WHEN 实施 THEN 长视频解析不卡 UI

### T-007 §4.3 FullPlayerOverlay（排期） <!-- lrnev-task: status=blocked, created=2026-08-01T07:12:12.700Z, updated=2026-08-01T07:12:32.912Z -->
<!-- lrnev-task-history: [{"from":"pending","to":"blocked","at":"2026-08-01T07:12:32.912Z"}] -->

DESIGN_SPECS §4.3：从迷你条展开的完整播放器（焦点陷阱/Escape/全屏 sheet/歌词面板/Media Session）。

**验收**：
- WHEN 实施 THEN 与 MiniAudioBar 共享同一 store 无第二播放链路

### T-008 SEC-03 残余：并发/带宽配额（排期） <!-- lrnev-task: status=blocked, created=2026-08-01T07:12:13.440Z, updated=2026-08-01T07:12:33.474Z -->
<!-- lrnev-task-history: [{"from":"pending","to":"blocked","at":"2026-08-01T07:12:33.474Z"}] -->

内置流代理补并发/带宽配额与全局限速，生产默认关闭内置代理。

**验收**：
- WHEN 实施 THEN 高并发有配额保护
