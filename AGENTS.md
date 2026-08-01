# TWICE Discography — 仓库级 AGENTS.md

> 本文件由 pi 在每个会话启动时自动加载，是"本仓库每次会话从 lrnev 开始"的落地机制。
> 通用治理规则见全局 `~/.pi/agent/AGENTS.md`（lrnev 治理章节），本文件只放项目事实与项目级强制流程，不重复全局规则。

## 会话启动（强制，第一步）

每次新会话、接手本仓库任何改动前，**先执行 lrnev 接手流程**，再动手：

1. 调 `project_status`（或 `lrnev status`）获取 scenes/specs/active_tasks/recent_adrs/open_errors 概览；有 in_progress / blocked 的 Task 时，优先从该 Task 继续。
2. 需要全景定位时调 `governance_map`（或 `lrnev map`）看 scene→spec 压缩视图。
3. 新任务先分类（小改动直接做；已有 spec 的落位 `task_create`；独立可交付特性才 `spec_create`），再 `task_update(in_progress)` → 改代码 → `task_update(completed)`。
4. 不清楚用法调 `lrnev_guide`；收尾可跑 `lrnev_report`（只读体检）与 `lrnev_doctor`（健康诊断）。
5. 本仓库场景落位：默认 `00-default`；只有确认承载多个 spec 的新业务域才 `scene_create`，拿不准就问用户。

## 项目事实

- **技术栈**：Vue 3 + TypeScript + Vite + Pinia + Naive UI（`frontend/`）；Fastify 5 + better-sqlite3 + Zod（`backend/`）；Cloudflare Worker 边缘代理（`workers/mv-proxy/`）。
- **设计规格**：`DESIGN_SPECS.md` 是唯一实施规格（视觉系统、路由、播放器、MV 性能 §6.4、审计 §8）。`DESIGN_INDEX.md` 已 SUPERSEDED，仅历史参考。
- **常用命令**（pnpm workspace）：
  - `pnpm dev`（前后端并行）/ `pnpm dev:backend` / `pnpm dev:frontend`
  - `pnpm build` / `pnpm test` / `pnpm lint` / `pnpm seed`（重建数据库）
  - 后端单独：`pnpm --filter backend test`（vitest）/ `pnpm --filter backend build`（tsc）
- **运行**：`backend/src/server.ts` 入口；单体部署 `SERVE_FRONTEND=true` 直接托管 `frontend/dist`；部署配置见 `render.yaml`。

## 架构约束（改动必须遵守）

- **单一播放所有者**：全站唯一 `<audio>` 在 `MiniAudioBar.vue`；`audio` Pinia store 是唯一播放状态来源。Music Station / MV 不得创建第二条播放链路。
- **i18n**：zh-CN / zh-TW / en-US / ja-JP / ko-KR 五语言全覆盖；新增用户可见文本（含 aria-label、占位符、错误）必须进 `frontend/src/i18n/messages.ts` 消息表。
- **CSS token**：页面样式一律引用现有 token（`--page-*`、`--panel-*`、`--accent-*`、`--soft-border`、`--shadow` 等，浅色 `:root`、暗色 `:root[data-theme='dark']`），不写裸色值；后台用 `--admin-*`（`admin.css`，admin 外壳样式单一所有权在 admin.css）。
- **后端 API 约定**：Fastify `/api` 路由 + Zod 输入校验 + 标准错误 envelope；认证/授权在服务端执行，前端路由守卫只是 UX；写操作需审计，凭证/密码永不落日志。
- **图标**：`@vicons/ionicons5` 或可访问内联 SVG，不用 emoji 做功能图标。
- **MV 性能基线**（§6.4）：解析结果走 TTL 缓存；DASH 分段 Range 拉取 + AbortController 中断；真实缓冲态替代假计时器；起播画质降级并记忆用户选择。

## 易错点

- `data/twice.db`（0 字节占位）已被取消 git 跟踪；真实运行时库在 `backend/data/twice.db`（gitignored），备份/部署包必须排除 `backend/data/`。
- 前端 MCP 工具（lrnev 等）在会话启动时经 `.pi/mcp.json` 注册；改动 MCP 配置后需重启会话生效。
