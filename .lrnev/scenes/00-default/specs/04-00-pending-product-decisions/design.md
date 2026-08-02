---
spec: '04-00-pending-product-decisions'
scene: '00-default'
created: '2026-08-01'
---

# 04-00 Pending Product Decisions - 设计

## L0 摘要

将 DESIGN_SPECS §8/§6.4/§4.3 中待产品拍板的项目登记为 blocked task 注册表；新会话通过 `project_status` 一眼可见，产品一句话拍板后由 agent 从 blocked 续接实施。

## L1 概览

### 架构思路

- 本 spec 不是功能实现，而是"决策登记册"：每个待决项 = 一条 blocked task，描述内含 DESIGN_SPECS 依据与可选方案。
- 生命周期：pending → blocked（产品未拍板）→ in_progress（产品拍板）→ completed；拍板入口是任意新窗口的产品一句话，无需专门界面。
- 与 02-00/03-00 的边界：已完成工作项（mv-playback-performance、audit-and-a11y-fixes、player-volume-control）不在本册。

### 主要模块

- `.lrnev/scenes/00-default/specs/04-00-pending-product-decisions/tasks.md`（blocked task 注册表）
- 无代码改动；实施时按各 blocked task 的验收从对应模块（router/global.css/backend routes 等）落地。

### 关键决策

| 决策 | 选项 | 倾向 | 是否产 ADR | 备注 |
| --- | --- | --- | --- | --- |
| 待决项登记形态 | 单文档清单 vs blocked task 注册表 | blocked task 注册表 | 否 | 复用 lrnev 任务状态机，新会话 `project_status` 可见 |
| 拍板入口 | 专用页面 vs 新窗口一句话 | 新窗口一句话 | 否 | 产品负责人无操作成本 |

## L2 详情

### 模块详细设计

#### D-01 决策登记与续接（F-01）

- 每项一条 blocked task，格式：DESIGN_SPECS 依据（§8 UX-xx/SEC-xx 或 §6.4 方案 x / §4.3）+ 可选方案 + 验收（WHEN…THEN）。
- 已登记项（2026-08-01）：T-001 UX-04 /variety 发布或删除、T-002 UX-06 全局 .n-button/.n-tag 覆盖重构、T-003 SEC-06 全局限速与外部请求超时、T-004 SEC-07 last-owner 保护与写审计、T-005 UX-09 各页 loading/error 统一、T-006 §6.4 方案6 DASH Web Worker、T-007 §4.3 FullPlayerOverlay、T-008 SEC-03 残余（并发/带宽配额）。
- 续接流程：产品在任意新窗口说明决策 → agent `task_update(in_progress)` → 按任务验收实施 → completed。

### 数据模型

- 仅依赖 lrnev task 状态机（pending/in_progress/completed/blocked/failed）；无新增业务数据模型。

### 接口契约

- 对外接口：`project_status`（或 `lrnev status`）可见 blocked 任务；产品一句话即拍板入口。
- 无 API/组件变更。

### 错误处理

- 拍板前无代码执行风险；blocked 任务不进入实施路径。
- 决策变更（发布→删除）由任务描述内的可选方案覆盖，重新拍板即可。

### 测试策略

- 验收以"拍板后实施"为准，各任务自带 WHEN…THEN 验收；本册本身无单测。
- 例行检查：`project_status` 中 blocked 任务全部可见，无遗漏待决项。
