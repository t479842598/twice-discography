---
spec: '03-00-player-volume-control'
scene: '00-default'
created: '2026-08-01'
---

# 03-00 Player Volume Control - 任务清单

> 任务由 lrnev `task_create` 工具创建，不要手编。
> 状态机：pending → in_progress → completed / failed；blocked 可回 in_progress；failed 可回 pending 重试。

## 阶段 1

<!-- FILL: 使用 task_create 追加任务；任务会以 `### T-XXX 标题 <!-- lrnev-task: ... -->` 形式追加到这里 -->

## 验收标准（整体）

- <!-- FILL: 按本 Spec 调整整体验收清单 -->
- [ ] 所有任务完成
- [ ] 单元测试通过
- [ ] 集成测试通过

### T-001 MiniAudioBar 音量控制与持久化 <!-- lrnev-task: status=completed, created=2026-08-01T06:55:00.817Z, updated=2026-08-01T07:10:40.946Z -->
<!-- lrnev-task-history: [{"from":"pending","to":"in_progress","at":"2026-08-01T06:55:16.497Z"},{"from":"in_progress","to":"completed","at":"2026-08-01T07:10:40.946Z"}] -->

§4.2：音量 0-100 滑杆 + 静音切换 + 键盘可操作 + 版本化 localStorage 持久化（volume/muted/最后非零音量）+ i18n 五语言 + 有限 live region 通知

**验收**：
- WHEN 拖动音量滑杆或按方向键 THEN <audio>.volume 同步且值合法
- WHEN 静音/取消静音 THEN muted 同步且恢复最后非零音量
- WHEN 刷新页面 THEN 音量与静音状态从版本化 localStorage 恢复
- WHEN localStorage 不可用或值非法 THEN 安全回退默认值
