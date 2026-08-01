---
spec: '03-00-player-volume-control'
scene: '00-default'
status: in-progress
priority: P2
created: '2026-08-01'
---

# 03-00 Player Volume Control - 需求

## L0 摘要

MiniAudioBar 补齐音量控制（§4.2）：0-100 滑杆 + 静音切换 + 键盘可操作 + 版本化 localStorage 持久化 + i18n 五语言 + 有限 live region 通知。

## L1 概览

### 目标

- 用户可拖动滑杆或按方向键调整音量（0-100），<audio>.volume 实时同步。
- 静音/取消静音切换，取消静音时恢复最后非零音量。
- 刷新页面后从版本化 key（twice.audio.volume.v1）恢复音量与静音状态；非法值/存储不可用安全回退。
- 不创建第二条播放链路：仍由 MiniAudioBar 的唯一 <audio> 持有音量。

### 用户故事

- 作为用户，我希望调节音量并记住我的偏好，以便无需每次调整。
- 作为键盘用户，我希望滑杆可用方向键操作且有清晰的本地化值文本。

### 范围

**包含**：audio store 音量/静音状态与持久化、MiniAudioBar 音量 UI、i18n、单元测试。

**不包含**：FullPlayerOverlay（§4.3）、跨设备同步、歌词/队列改造。

## L2 详情

### 详细需求

#### F-01 状态与持久化
- store 持有 volume（0-1）/ muted / lastVolume；版本化 key 保存 {v,m,l}。
- setVolume 钳制 0-1，>0 时自动解除静音；toggleMute 静音时记录最后非零音量，取消静音时若为 0 则恢复。
- 读取失败、非法值、存储不可用时回退默认（v=1, m=false）。
- 验收：WHEN 刷新页面 THEN 音量与静音从版本化 localStorage 恢复；WHEN 存储损坏 THEN 回退默认。

#### F-02 播放器 UI 与同步
- MiniAudioBar 新增静音按钮 + n-slider（0-100，键盘可操作）+ 百分比值文本；aria-label/aria-pressed。
- <audio>.volume/.muted 与 store 双向同步（元素挂载时 + 值变化时）。
- live region 仅在静音切换与滑杆释放时通知，不在拖动每 tick 通知。
- 验收：WHEN 拖动滑杆或按方向键 THEN <audio>.volume 同步且值合法；WHEN 静音切换 THEN muted 同步且恢复最后非零音量。

#### F-03 i18n 与测试
- 新增 player.volume/mute/unmute/volumeAnnounce/volumeMuted/volumeUnmuted，五语言完整。
- vitest 覆盖钳制、持久化恢复、静音恢复非零音量、非法值回退。
- 验收：WHEN 运行 i18n 与 store 测试 THEN 全部通过。
