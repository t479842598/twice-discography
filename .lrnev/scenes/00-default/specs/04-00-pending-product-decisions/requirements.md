---
spec: '04-00-pending-product-decisions'
scene: '00-default'
status: draft
priority: P2
created: '2026-08-01'
---

# 04-00 Pending Product Decisions - 需求

## L0 摘要

产品待决策/排期项登记册（blocked tasks）：新会话经 `project_status` 第一眼可见，产品拍板后解除 blocked 并实施。

## L1 概览

### 目标

- 让每个新会话在接手时能看到所有"等产品决策/等排期"的工作项，避免遗忘或重复决策。
- 决策一经拍板，直接在新窗口用一句话说明，agent 会从 blocked task 续接。

### 用户故事

- 作为产品负责人，我希望在任意新窗口一句话拍板待决项，以便 agent 直接执行。

### 范围

**包含**：UX-04、UX-06、SEC-06、SEC-07、UX-09、§6.4 方案6、§4.3、SEC-03 残余（详见 DESIGN_SPECS.md §8 与 §6.4/§4.3）。

**不包含**：已完成工作项（mv-playback-performance、audit-and-a11y-fixes、player-volume-control）。

## L2 详情

### 详细需求

#### F-01 决策登记与续接
- 每个待决项 = 一条 blocked task，描述里含 DESIGN_SPECS 依据与可选方案。
- 产品拍板 → 新会话说明决策 → agent `task_update(in_progress)` → 实施 → completed。
- 验收：WHEN 新会话运行 project_status THEN blocked 任务全部可见；WHEN 产品拍板 THEN 对应任务转为 in_progress。
