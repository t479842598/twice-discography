---
spec: '01-00-mv-playback-performance'
scene: '00-default'
status: in-progress
priority: P1
created: '2026-08-01'
---

# 01-00 Mv Playback Performance - 需求

## L0 摘要

消除 MV 播放冷启动延迟：后端解析加 TTL 缓存、前端预热与画质降级起播、DASH 改为分段 Range 拉取并全程可中断、真实缓冲态替代假计时器。

## L1 概览

### 目标

- 同网 P75 首帧 < 2s；命中缓存重复打开 < 500ms（DESIGN_SPECS §6.4 验收指标）。
- 弱网可自动以低画质起播，播放稳定后升到用户上次选择画质。
- 关闭播放器/切画质/路由离开时立即中断下载，不再整流拉完。

### 用户故事

- 作为访客，我希望打开 MV 尽快看到首帧，以便不被加载等待劝退。
- 作为弱网用户，我希望先低画质起播再自动升级，以便首帧不卡。
- 作为节省流量用户，我希望只看开头时不下载整支 MV。

### 范围

**包含**：后端解析缓存、前端预热、画质记忆与降级起播、DASH 分段拉取+中断、加载 UI、官方播放器低延迟策略、CDN 预连接。

**不包含**：DASH 解析移入 Web Worker（§6.4 方案6，后续排期）；后端定时预热任务（方案3，可选）；生产强制 Worker 边缘（方案7，部署配置）。

## L2 详情

### 详细需求

#### F-01 后端解析 TTL 缓存
- view+playurl 解析结果缓存 8 分钟（复用 withMusicCache，key=bvid:page:format）。
- /stream 路由与 /playback 路由共享同一缓存；缓存失败不回源缓存。
- 验收：WHEN 重复打开同一 MV THEN 不再请求 B站上游；WHEN 缓存过期或解析失败 THEN 自动回源。

#### F-02 前端 MV 预热
- 首页空闲时预取可见/精选 MV 的 playback（requestIdleCallback，超时 5s 兜底）。
- 限流（同 trackId 去重）、可取消（unmount abort）、遵守 save-data 与 prefers-reduced-motion。
- 验收：WHEN 首页加载完成且空闲 THEN 精选 MV 解析被预取；WHEN 数据节省/减少动态效果 THEN 不预取。

#### F-03 画质降级起播与记忆
- 版本化 localStorage（twice.mvQuality.v1）记忆用户画质；默认 480P（qn=32）起播。
- 播放稳定（playing + 缓冲 ≥ 8s）后自动升到记忆画质（上限 1080P），保留播放进度。
- 验收：WHEN 首次打开 THEN 低画质快速出首帧；WHEN 用户选过画质 THEN 后续以该画质为上限自动升级。

#### F-04 DASH 播放器优化
- Range 按需分段拉取（2MB 块），缓冲 60s 即暂停、排空后恢复，不整流下载。
- AbortSignal 贯穿所有 fetch；teardown/切画质/离开立即中断。
- 双 SourceBuffer 先建后喂（Chrome buffer-count 锁）；起播后立即返回 cleanup（可中途销毁）。
- 中途流错误回调触发 MP4 兜底。
- 验收：WHEN 关闭/切画质/离开 THEN 下载立即中断；WHEN 缓冲充足 THEN 停止继续下载。

#### F-05 加载 UI 与低延迟策略
- 视频容器 poster（封面）+ 真实加载/缓冲文案（i18n 五语言），删除 setTimeout(3000) 假计时器。
- 播放通道开关（auto/iframe/proxy）持久化 localStorage；iframe 模式直接使用官方播放器。
- index.html 对 api.bilibili.com 与 bilivideo.com CDN 预连接。
- 验收：WHEN 加载中 THEN 显示真实状态文案；WHEN 无凭证/代理不可达 THEN 可切换官方 iframe。
