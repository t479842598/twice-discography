{
  "id": "cb6ff6fa",
  "title": "后端 MV 解析 TTL 缓存（view+playurl）",
  "tags": [
    "mv",
    "backend",
    "ux-10"
  ],
  "status": "open",
  "created_at": "2026-08-01T05:07:53.412Z"
}

DESIGN_SPECS §6.4 方案1 / UX-10：resolveBiliMvPlayback 的 view+playurl 两次无缓存上游请求 → 用 withMusicCache 模式做 5-10 分钟 TTL 缓存（只缓存最小必要元数据与 qualities，不落盘长期签名 URL）。同时让 mv.ts /stream 路由复用同一缓存。
