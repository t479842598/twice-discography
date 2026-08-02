---
spec: '03-00-player-volume-control'
scene: '00-default'
created: '2026-08-01'
---

# 03-00 Player Volume Control - 设计

## L0 摘要

在 `audio` Pinia store 新增 volume/muted/lastVolume 状态与版本化 localStorage 持久化；`MiniAudioBar` 新增静音按钮与 0-100 键盘可操作滑杆，与唯一 `<audio>` 元素双向同步，live region 有限通知。

## L1 概览

### 架构思路

- 遵循 §4.1 单一播放所有者：音量状态只存在于 `audio` store，实际 `<audio>` 元素只存在于 `MiniAudioBar.vue`；不新增第二播放链路。
- 持久化只做浏览器端版本化 key（`twice.audio.volume.v1`），不跨设备同步；读取失败/非法值/存储不可用安全回退默认。
- UI 层（`MiniAudioBar`）只做展示与事件转发，不持有音量逻辑副本；`<audio>.volume/.muted` 通过 watcher 与 store 单向/双向同步。

### 主要模块

- `frontend/src/stores/audio.ts`（volume/muted/lastVolume 状态、setVolume/toggleMute、读写版本化持久化）
- `frontend/src/components/player/MiniAudioBar.vue`（静音按钮 + n-slider 0-100 + 百分比值 + live region + `<audio>` 同步 watcher）
- `frontend/src/i18n/messages.ts`（player.volume 等 6 个新 key 五语言）
- `frontend/src/stores/audio.test.ts`（vitest 5 例）

### 关键决策

| 决策 | 选项 | 倾向 | 是否产 ADR | 备注 |
| --- | --- | --- | --- | --- |
| 静音恢复语义 | 用独立 lastVolume vs 复用 volume 副本 | 独立 `lastVolume` 字段 | 否 | 静音时记录最后非零音量；取消静音若为 0 则恢复 |
| 持久化 key 形态 | 版本化 JSON `{v,m,l}` vs 多个 key | 单 key 版本化 JSON `{v,m,l}` | 否 | `twice.audio.volume.v1`；v=volume(0-1)、m=muted、l=lastVolume |
| 同步时机 | 仅值变化 vs 挂载时 + 值变化 | 元素挂载时 + store 值变化时双向同步 | 否 | `watch(audioRef)` + `watch([volume, muted])` |
| live region 时机 | 每次拖动通知 vs 静音切换 + 滑杆释放 | 静音切换 + `@after-change` 释放时通知 | 否 | 避免拖动每 tick 打断读屏 |

## L2 详情

### 模块详细设计

#### D-01 store 状态与持久化（F-01）

- 状态：`volume`(0-1)、`muted`(boolean)、`lastVolume`(0-1)。
- `setVolume(value)`：`Number.isFinite` 校验 + `clampVolume`（四舍五入到 2 位小数，钳制 0-1）；`next > 0` 时自动解除静音；写入 `{v,m,l}`。
- `toggleMute()`：静音时若 `volume > 0` 记录 `lastVolume`；取消静音时若 `volume === 0 && lastVolume > 0` 恢复 lastVolume。
- `readVolumePref()`：`try/catch` 包裹 `localStorage.getItem` + `JSON.parse`；逐字段校验（`Number.isFinite` + clamp，`l` 需 `> 0` 否则回退默认 1）；失败回退 `{v:1, m:false, l:1}`。
- `writeVolumePref()`：`try/catch` 包裹写入；存储不可用（隐私模式/配额）静默忽略，播放不受影响。

#### D-02 MiniAudioBar UI 与 `<audio>` 同步（F-02）

- 静音按钮：`n-button` circle quaternary，`:aria-pressed="audioStore.muted"`，`aria-label` = `player.mute`/`player.unmute`；图标按 `muted || volumePercent === 0` 显示 muted/非 muted 两种 SVG。
- 音量滑杆：`n-slider` `:min="0" :max="100" :step="1"` `:tooltip="false"`，`v-model:value="volumePercent"`（getter `round(volume*100)` / setter `setVolume(value/100)`），`aria-label="player.volume"`，`@after-change="announceVolume"`。
- 百分比值文本：`{{ volumePercent }}%`（`aria-hidden`，读屏靠 live region）。
- 同步：`watch(audioRef)` 在元素挂载时设置 `el.volume`/`el.muted`；`watch([() => audioStore.volume, () => audioStore.muted])` 在值变化时再次设置。
- live region：`<span class="mini-audio-live" aria-live="polite">`；`watch(muted)` 写 `player.volumeMuted`/`player.volumeUnmuted`；`announceVolume()` 在滑杆释放时写 `player.volumeAnnounce {value}`（muted 时不通知）。

#### D-03 i18n 与测试（F-03）

- 新增 key：`player.volume`/`player.mute`/`player.unmute`/`player.volumeAnnounce`（含 `{value}` 插值）/`player.volumeMuted`/`player.volumeUnmuted`，五语言完整（zh-TW 由 `toTraditional` 派生）。
- `audio.test.ts`（5 例）：钳制 + 抬升解除静音；持久化写入 `{v,m,l}` 并从新 store 实例恢复；静音后滑到 0 再取消恢复非零音量；非法值（v=999/l=-3）回退；损坏 JSON 回退默认。

### 数据模型

- 持久化结构：`{ v: number(0-1), m: boolean, l: number(0-1) }`，key = `twice.audio.volume.v1`。
- 无后端/API 变更；无新表。

### 接口契约

- store 新增：`volume`、`muted`（ref 暴露）、`setVolume(value: number)`、`toggleMute()`。
- `MiniAudioBar` 通过 store 的 `volumePercent` computed 双向绑定滑杆。
- `messages.ts` 新增 6 个 `player.*` key（五语言）。

### 错误处理

- 存储读写均 try/catch，任何失败不阻断播放。
- 非法输入（NaN/越界）在 `setVolume`/`readVolumePref` 内钳制或回退。
- `<audio>` 元素未挂载时 watcher 直接跳过（`if (!el) return`），不抛错。

### 测试策略

- 单元：`audio.test.ts` 5 例（见 D-03），覆盖钳制、持久化恢复、静音恢复、非法值/损坏回退。
- 集成：`messages.test.ts` 保证新增 key 五语言完整。
- 人工验收：拖动滑杆/方向键 → `<audio>.volume` 合法；静音切换 → `.muted` 同步且恢复非零音量；刷新 → 从 localStorage 恢复；存储不可用 → 默认值。
