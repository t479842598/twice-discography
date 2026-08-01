# TWICE Discography — 完整重设计与交付规格

> **文档状态：** 已按当前代码库复核（Vue 3 + Vite + Pinia + Naive UI + Fastify 5 + SQLite）。§8 审计项于 2026-08-01 再次逐条对照代码复核并更新（含已解决项标注）；§3.1 新增 Music Station 样式细化规格。
> **目标：** 在不牺牲现有曲库、播放、MV、后台权限、多语言和部署能力的前提下，完成可访问、可测试、可维护的生产级重设计；不是只做视觉样稿。
>
> 本文是唯一设计实施规格。旧版引用的 `designs/*.md` 文件在仓库中不存在，不能作为实现依据。

---

## 1. 已确认的架构与边界

### 1.1 必须遵守的现有架构

| 层级 | 当前事实 | 设计实施约束 |
| --- | --- | --- |
| 前端 | Vue 3、TypeScript、Vue Router、Pinia、Naive UI、Vite | 延续现有组件、路由、Pinia store 和 Naive UI Provider；不得假定 React、Tailwind 或未安装图标库已存在。 |
| 样式 | `global.css`、`admin.css` 和组件 scoped CSS | 使用 CSS 自定义属性、现有 class 命名和 Naive UI theme overrides。除非经明确批准并完成迁移，不新增 Tailwind。 |
| 图标 | `@vicons/ionicons5` 与内联 SVG 已安装/使用 | 统一使用 Ionicons 或有可访问名称的内联 SVG；不得以 emoji 作为功能图标。 |
| 国际化 | `zh-CN`、`zh-TW`、`en-US`、`ja-JP`、`ko-KR` | 所有新增用户可见文本（含 aria-label、空态、错误、相对时间、轮播页码）必须进入现有 i18n 消息表，五种语言完整覆盖。 |
| 数据与 API | Fastify `/api`，目录、播放、MV、后台 API 已存在 | UI 不得伪造可编辑能力；需要写入的新后台功能必须先定义受权限保护的 API、验证、审计和失败语义。 |
| 播放器 | `audio` Pinia store + 全局 `MiniAudioBar` 持有实际 `<audio>` | 全站只能有一个媒体播放所有者。任何展开式播放器或 Music Station 必须驱动同一 store/音频元素，不能创建第二条独立播放链路。 |

### 1.2 不在本次重设计中允许的误导性承诺

- 当前不存在 `TracksView`、`SearchView`、`NavBar`、`MiniAudioPlayer` 或 `FullPlayer` 这些同名组件；实施规格须使用实际组件名，或先明确创建它们的路由、状态和测试。
- 当前后台只具备用户/角色、MV 与 B站凭证的写入 API。专辑、曲目、音源、歌词、成员和站点设置**不能**在 UI 上表现为已经可管理；它们属于下文的后续后台 API 工作包。
- `VarietyView.vue` 虽存在，但路由目前把 `/variety` 重定向到首页；上线版本必须要么实现并测试该页面，要么在导航和文案中移除该入口，不能保留死功能。
- 不能宣称所有动画已尊重 `prefers-reduced-motion`，直到全局动画、轮播、视频、卡片和播放器均实现该行为。

---

## 2. 视觉系统

### 2.1 设计方向

- 风格：**TWICE 粉色品牌语义 + 现代半透明表面 + 有节制的渐变**。玻璃效果仅用于层级、浮动导航、播放器和对话框，不能降低正文可读性。
- 默认主题：暗色优先；浅色为完整的一等主题，而非仅反转背景。⚠️ 复核：当前 `stores/theme.ts` 默认值为 `light`（localStorage 无值即浅色），与“暗色优先”冲突——需产品确认后同步修改默认值，或调整本规格为浅色默认。
- 字体：保留 **Outfit** 作为显示/界面字体；正文使用系统无衬线回退。若引入 Inter，必须将其作为显式构建/加载依赖，并提供本地及系统回退；不得只在设计文档中假定其可用。
- 背景视频和远程图片只是渐进增强：无网络、节流、移动端、数据节省或减少动态效果时，必须有低成本本地渐变/图片兜底，且不影响内容对比度。

### 2.2 语义 token（实现时以 CSS custom properties 映射到浅/暗主题）

```css
/* 暗色基础值；浅色主题必须提供语义等价值，而不是复用这些原始颜色。 */
--color-bg-canvas: #020617;
--color-surface: rgba(15, 23, 42, 0.82);
--color-surface-raised: rgba(30, 41, 59, 0.92);
--color-border: rgba(255, 255, 255, 0.14);
--color-text: #f8fafc;
--color-text-muted: #cbd5e1;
--color-primary: #ec4899;
--color-primary-hover: #f472b6;
--color-secondary: #a855f7;
--color-accent: #60a5fa;
--color-success: #34d399;
--color-warning: #fbbf24;
--color-danger: #fb7185;
--focus-ring: #f9a8d4;
```

> **token 对齐（与现有代码词汇的关系，防止平行 token 体系）：**
> 复核确认：代码库现有 token 词汇是 `--page-bg`/`--page-bg-soft`、`--panel-bg`/`--panel-bg-strong`、`--topbar-bg`、`--page-text`、`--muted-text`、`--heading-text`、`--soft-border`、`--accent`/`--accent-strong`/`--accent-light`、`--shadow`/`--glow`（浅色在 `global.css` 的 `:root`，暗色在 `:root[data-theme='dark']`）；后台另有 `--admin-*` 一组（`admin.css` 的 `.admin-page` 与 `:root[data-theme='dark'] .admin-page` 覆盖）。**§2.2 的 `--color-*` 是目标语义命名，不是第二套运行时 token**——落地时以“重命名/别名”收敛到现有词汇（如 `--color-text→--page-text`、`--color-text-muted→--muted-text`、`--color-border→--soft-border`、`--color-primary→--accent-strong`），或一次性全局替换并同步所有引用；不得新旧两套并存。`--focus-ring`、成功/警告/危险色、`--shadow-soft`、`--color-surface-raised` 等缺失 token 在 tokens 层补齐浅/暗值（联动 UX-08 的 tokens 文件与 lint）。页面 scoped CSS 一律引用 token，不得引用裸色值。

规则：

1. `--color-primary` 不是自动可配白字的背景色；每个按钮、标签和状态都必须选择经对比度验证的前景色。
2. 普通正文、表单标签、禁用状态以外的文字与其实际背景的对比度至少为 **4.5:1**；大号文字至少为 **3:1**；焦点指示器与相邻背景至少为 **3:1**。
3. 状态不能只靠颜色传达：成功、警告、错误和播放状态均需文本、图标或形状提示。
4. 所有半透明表面必须有不透明/高对比 fallback，以应对 `backdrop-filter` 不可用、动态背景或高对比模式。

### 2.3 组件规范

| 元素 | 规则 |
| --- | --- |
| 页面容器 | 320px 起无横向滚动；内容最大宽度与现有 `.page` 保持一致，避免在每页自行定义不一致的容器。 |
| 卡片 | 统一圆角、边框、surface token 和阴影 token。hover 只能改变颜色/阴影或 transform，不得导致布局位移、内容遮挡或键盘焦点丢失。 |
| 按钮 | 语义明确的主、次、危险、文字按钮；禁用态不可触发操作且与可用态可辨。仅图标按钮必须有本地化 `aria-label`/tooltip。 |
| 图片 | 使用现有 `FallbackImage` 链式回退；封面和成员图要提供描述性 alt，纯装饰背景使用空 alt 或 `aria-hidden`。必须为图像保留尺寸/比例，避免 CLS。 |
| 图标 | 用 `@vicons/ionicons5` 或内联 SVG 替换所有功能 emoji（例如 MV 标记）。SVG 要么 `aria-hidden` 且邻近有文字，要么有可读名称。 |
| 动效 | 过渡一般不超过 300ms；避免无限的大面积发光/漂浮动画。`prefers-reduced-motion: reduce` 时停止轮播自动前进、视频自动播放、无限动画和非必要 transform，仅保留必要的即时状态变化。 |

---

## 3. 信息架构、路由与页面要求

### 3.1 公开路由

下表是目标公开信息架构。每个页面都必须有 loading、空、失败、重试（适用时）和窄屏状态；参数不存在时应显示可恢复的 404/空态，不能只留下 skeleton 或空白。

| 路由 | 页面/现状 | 最终要求 |
| --- | --- | --- |
| `/` | `HomeView` | 精选 MV 轮播、统计、年份时间线、精选专辑、快速播放。轮播支持键盘前后切换、暂停/继续、当前项语义和减少动态效果；当前精选 MV 数据为空时使用明确的非视频 Hero 兜底。 |
| `/years/:year` | `YearView` | 按年展示专辑、曲目、广告曲和翻唱汇总；无效年份给出可返回时间线的状态。 |
| `/albums` | `AlbumsView` | 团体专辑浏览，提供服务端或前端可预测的搜索、类型/语言/年份筛选和排序；URL query 必须可分享、可还原。 |
| `/albums/:id` | `AlbumDetailView` | 专辑元数据、封面、完整曲目、可播放队列。曲目顺序、主打标识和不可播放状态必须清楚。 |
| `/tracks` | **新增 `TracksView`** | 所有曲目的分页/虚拟化目录，支持 `category`、`year`、`q`；筛选同步 URL。当前 API 已支持上述参数，但 UI/路由尚未存在。 |
| `/tracks/:id` | `TrackDetailView` | 曲目元数据、多源候选、歌词可用性与播放入口。候选列表只能显示当前曲目的请求结果，切换路由时必须取消/忽略过期响应。 |
| `/members`、`/members/:id` | 现有成员页 | 九人资料和详情；成员相关曲目、图片回退、可访问的国旗替代文本和无数据状态。 |
| `/solo-unit` | `SoloUnitView` | 独唱、小分队、MISAMO 的明确分类；tab 状态可由 URL 还原并能直接链接。 |
| `/cfs`、`/covers` | 现有列表页 | 可播放曲目与档案资料分区；`highlight` query 需可见地定位结果并提供非色彩提示。 |
| `/variety` | 当前错误地重定向首页 | 实施已存在的 `VarietyView` 并注册路由、导航和测试；若业务决定不发布，则删除/隐藏所有入口和设计承诺。 |
| `/music-station` | `MusicStationView` | 多源检索、播放和歌词。下载操作须只在授权分发的资源与合规部署中展示；不允许以新 `<audio>` 与全局播放器同时播放。 |
| `/search?q=` | **新增 `SearchView`** | 按专辑、曲目、成员、广告曲、翻唱分组呈现 `GET /api/search` 的完整结果；空 query 显示引导。顶部搜索提交后跳转此页，而不是只跳到“最佳猜测”。 |

### 3.1.1 Music Station（`/music-station`）样式与体验细化（本轮优化目标）

**现状（已复核）：** `MusicStationView` 已接入全局 audio store——播放经 `audioStore.playResolvedMusic()` 载入全局 `MiniAudioBar` 链路，页面自身无 `<audio>`（UX-01 已解决）；检索/解析/播放/下载文案已全部 i18n。本轮“样式优化”按 §2 视觉系统与下列要求执行，不是推翻现有结构：

- **搜索面板**：输入框 + 源多选（qq/netease/kuwo/joox）+ 音质选择（best/lossless/320k/hq/standard）三栏网格，≤900px 折叠为单列（现状已具备，统一用 `--panel-bg`/`--soft-border`/`--shadow-soft` 语义化 token）。提交后 query 保留在输入框可一键重搜；空 query、候选不可用（404）、网络失败分别给出可读、可关闭提示，不依赖短暂 toast。
- **结果卡片**：封面固定比例（70×70 / 移动 88×88）走 `FallbackImage` 链式回退并保留占位避免 CLS；标题、歌手、专辑、来源/时长/音质/歌词标签齐全。hover/激活态仅变化颜色与阴影（现状 `translateY(-3px)` 在移动端已禁用，桌面端需在 `prefers-reduced-motion` 下同样禁用）；激活卡片用非色彩标识（边框 + `aria-current`/选中态）标识当前播放项。
- **播放联动**：播放=解析后经 `audioStore.playResolvedMusic()` 载入全局播放器；正在播放的候选在结果中明确标识；本页不创建第二条播放链路（E2E 覆盖）。音量、队列、Media Session 统一由全局播放器负责（§4）。
- **下载**：下载按钮只在授权分发的资源与合规部署中展示（需服务端/环境开关，不默认全开）；当前 `openDownload` 直接 `window.open` 解析 URL，需受该开关约束并给出解析失败的可恢复提示。
- **状态与无障碍**：loading（n-spin）、空态（n-empty）、错误（n-alert）齐备；表单控件与卡片操作按钮键盘可达；所有文案/aria 入 i18n 五语言；`prefers-reduced-motion` 下禁用卡片位移与转场动画。
- **死代码清理**：删除无引用的 `.music-station-audio`、`.music-station-lyrics-empty` 样式；`--shadow-soft` 未定义 token 按 UX-08 统一处理。
- **验收**：320/640/900/1280 断点、浅/暗主题、五语言、键盘遍历、无第二播放链路 E2E。

### 3.2 全局壳层

实际全局组件为 `AppShell.vue`，不是独立 `NavBar`。其规格：

- 桌面端：品牌、主要导航、全局搜索、主题、语言、管理员入口；当前路由以 `aria-current="page"` 明确标识。
- 移动端：使用可关闭的菜单抽屉/折叠导航，不得让全部链接仅靠换行挤压顶部区域。打开时锁定适当的背景焦点，关闭后将焦点还给触发按钮，支持 Escape。
- 搜索：输入框有 label（可视觉隐藏）；提交、失败、无结果和结果计数均不依赖短暂 toast 才能理解。避免每次路由变化都不必要请求管理员会话/外部头像。
- 主题和语言：初始化不得在 SSR/首帧造成闪烁；持久化值需校验白名单。切换后即时更新文档语言、颜色模式和所有 aria 文案。
- 页脚：版权和媒体权利声明本地化；外链使用安全 `rel` 属性。

### 3.3 后台路由与范围

| 路由/模块 | 当前能力 | 本轮设计的交付要求 |
| --- | --- | --- |
| `/admin/login` | 登录 | 无已登录闪回、错误不泄漏认证细节、密码输入可使用密码管理器。 |
| `/admin` | 工作台 | 展示真实、可授权读取的统计/最近活动；加载失败不得把“运行稳定”当作真实状态。 |
| `/admin/mvs` | MV 管理 | 服务端分页、过滤、编辑校验、未保存更改提示、保存成功/失败反馈。 |
| `/admin/settings/bilibili` | 凭证 | Cookie 永不回显/写入日志/下发浏览器以外位置；仅 owner 能保存或验证，明确过期/失败状态。 |
| `/admin/users` | 用户与角色 | owner-only，创建/编辑/禁用/改密有服务端校验，禁止锁死最后一个 owner，并记录审计事件。 |
| 内容管理（专辑、曲目、音源、歌词、成员、首页编排） | **尚无写 API** | 作为独立工作包：先设计 schema migration、输入 Zod 校验、细粒度授权、审计日志、并发/冲突策略、软删除/恢复与 API 合约，再实现 UI。未完成前显示“未开放”，不展示假的编辑按钮。 |

所有危险操作（删除、禁用账号、覆盖 MV、替换凭证、批量导入）必须二次确认，描述影响范围；成功后刷新来自服务端的真实数据，而不是乐观地伪造完成状态。

---

## 4. 播放器、队列、歌词与音量

### 4.1 单一播放所有者

`MiniAudioBar.vue` 的 `<audio>` 是唯一实际媒体元素。`audio` Pinia store 是播放状态的唯一事实来源。未来的展开式播放器（命名为 `FullPlayerOverlay`）是同一 store 的展示层，不得再创建 `<audio>`、独立 `currentTime` 来源或第二份队列。

`MusicStationView` 解析到的音源必须通过 store 的受类型约束方法载入（保留 source/provider/歌词/质量元数据），并关闭/替换此前播放项；不保留独立的 `currentResolved` 音频播放路径。这样可以保证队列、暂停、Media Session、歌词和音量在全站一致。

### 4.2 MiniAudioBar（现有全局播放器）

保持现有迷你条的核心布局与最小化气泡行为，并补齐：

1. **音量控制：** 音量 0–100、静音切换、键盘可操作 slider、清晰本地化值文本。实际 `<audio>.volume` 与 `.muted` 必须同步；最后的非零音量用于取消静音。
2. **持久化：** 仅在浏览器端以版本化 key 保存有效范围内的 `volume` 与 `muted`；读取失败、非法值、存储不可用时安全回退。不可尝试跨设备同步。
3. **歌词：** 有 LRC 时显示当前/相邻行；无歌词显示明确空态。LRC 解析应支持多时间戳、分/秒、小数和元数据行；不带时间戳的文本必须标识为静态歌词而非伪造每四秒同步。
4. **队列与结束行为：** 顺序、列表循环、随机模式的上一首/下一首可用状态与结束逻辑完全一致；随机模式在一个循环内避免重复，队列变更时保持有效索引。
5. **可访问性：** 控件可 Tab、Enter/Space 使用；slider 有 label、最小/最大/当前值；状态变更通过有限、非打扰性的 live region 通知；关闭与最小化的语义不同且可恢复。
6. **移动端：** 使用安全区 inset，弹出的队列抽屉正确管理焦点且不与页面滚动/播放器遮挡冲突。

### 4.3 FullPlayerOverlay（完整功能，不是“以后再决定”）

在 MiniAudioBar 稳定后实现，可从迷你条的“展开”操作打开：

- 使用 modal/dialog 语义、焦点陷阱、Escape 关闭、关闭后焦点回到触发元素；移动端采用全屏 sheet。
- 显示封面、完整曲目/专辑信息、进度、音量、播放模式、队列、候选音源、歌词面板和明确的无歌词状态。
- 大歌词遵循用户的减少动态效果偏好，当前行不应以高频 `aria-live` 朗读；歌词滚动可由用户暂停/恢复。
- 支持 Media Session 元数据、操作处理器（播放/暂停、上一首、下一首、seek）及 `visibilitychange`/音频错误的正确状态同步；浏览器不支持时优雅降级。
- 不自动绕过浏览器 autoplay 策略：首次播放失败必须恢复可操作的暂停状态并说明原因，不能无限重试。

---

## 5. 数据、错误与安全契约

### 5.1 前端数据行为

- 所有异步页面和播放器请求都要处理 loading、空、网络/权限/404、重试和路由快速切换。请求完成时必须确认结果仍属于当前路由/播放请求，避免旧曲目覆盖新曲目。
- 使用已有 `ApiError.status` 区分 400、401、403、404、429 和 5xx 的用户提示；不得直接把后端异常、Cookie、上游 URL 或堆栈展示给用户。
- 目录页大量曲目采用服务端分页或列表虚拟化；hover/focus 音源预取必须限流、可取消、受网络条件和减少数据策略约束，不能为每一行发起播放解析。
- 图片、MV 封面和外部资源采用 HTTPS、可信 host 策略、超时/失败回退；禁止让用户可编辑 URL 绕过服务端校验或 CSP。

### 5.2 后端/API 前置条件

为新增页面或后台功能补 API 时，必须同时交付：

- 明确 TypeScript request/response 类型，Zod 输入验证，稳定的分页/排序参数和标准错误 envelope；
- 认证、角色授权在 Fastify 服务端执行，前端路由守卫仅是 UX，不是安全边界；
- CSRF/session cookie 的 SameSite、Secure、HttpOnly 策略与跨域部署模式匹配；跨域 credential 请求采用精确 origin allowlist，不能使用通配源；
- 写操作审计（操作者、对象、前后值摘要、时间、结果），凭证和密码永不记录；
- SQLite migration 可重复执行、可备份/回滚，并在真实数据副本上验证；
- 有权分发的音频、歌词、封面和视频才可缓存、下载或通过代理提供。无授权或地域/版权受限内容必须以不可播放状态处理，不可通过 UI 绕过。

---

## 6. 可访问性、响应式与性能验收

### 6.1 可访问性

- 目标 WCAG 2.2 AA：键盘完整可用、可见焦点、语义标题层级、合适 landmarks、表单 label 和错误关联。
- 所有 dialog/drawer/dropdown 都有焦点管理与 Escape 策略；不能把 hover 作为唯一可见/可执行入口。
- 轮播不自动抢焦点；自动播放可暂停。视频无声自动播放，任何有声播放必须由用户主动发起。
- 为屏幕阅读器提供加载、结果更新和保存结果的简洁通知；歌词逐行变化不应制造持续朗读。
- 在 200% 缩放、浏览器最小字体、键盘导航、强制色彩/高对比和 `prefers-reduced-motion` 下验证。

### 6.2 响应式基线

| 宽度 | 布局要求 |
| --- | --- |
| 320–639px | 单列为主、两列仅在卡片内容仍可读时使用；移动菜单；安全区处理；不可横向溢出。 |
| 640–767px | 可采用双列小卡；表单操作可换行且顺序合理。 |
| 768–1023px | 表格可显示关键列；非关键列折叠为详情/卡片；播放器有足够触控间距。 |
| 1024–1279px | 双栏详情、后台侧栏或可折叠导航可用。 |
| 1280px+ | 完整表格和后台工作台，但文本列必须可缩放、截断可查看。 |

触控目标最小 44×44 CSS px；关键操作不依赖悬停；横向可滚动表格要保留可见的列标题与操作列，并在窄屏转换为带 label 的卡片。

### 6.3 性能和可靠性

- 首屏只加载首屏需要的数据、字体和媒体；背景视频 `preload="none"`，在小屏、save-data 和减少动态效果下不请求。
- 图片用固定比例、`loading="lazy"`（首屏 LCP 图片除外）、`decoding="async"`、回退源；构建产物使用内容 hash 后才可长缓存 immutable。
- 不以全局无限 animation、所有列表项预取或每次路由切换的管理会话请求换取“视觉效果”。
- 在慢网、离线、第三方音源/MV 失败、封面失败、localStorage 禁用和音频 autoplay 拒绝下验证可恢复体验。

### 6.4 MV 播放性能优化（本轮新增）

**已复核的冷启动延迟链路：**

1. 点击播放 → modal 打开 → 前端才调 `GET /api/mv/:trackId/playback`（`MvPlayer.vue` 在 `watch(show)` 内冷启动解析，无任何预取）；
2. 后端 `resolveBiliMvPlayback()` 串行两次**无缓存**的上游 B站请求（`view` API 取 cid → `playurl` API 取 DASH/MP4 地址），每次打开都重新付出该往返延迟；
3. 配置了 `MV_PROXY_SIGNING_SECRET`/`MV_PROXY_BASE_URL` 时走 Cloudflare Worker 边缘（快）；否则 builtin `/api/mv/:trackId/stream` 由 Node 中转 B站 CDN（跨地域慢，仅有 500 条 streamTarget 内存缓存）；
4. `dashPlayer.ts` 对视频/音频 fMP4 从字节 0 顺序拉取（无 Range/init-first 策略），mp4box 在主线程解析，首帧延迟高；
5. 默认 qn=80（1080P）DASH 起播，弱网首帧更慢；移动端用硬编码 `setTimeout(3000)` 假“加载中”提示。

**方案（按收益/成本排序，全部可独立交付）：**

1. **后端解析缓存**：对 `view`+`playurl` 结果做短 TTL 缓存（5–10 分钟，复用 `withMusicCache` 模式；只缓存最小必要元数据与 `qualities`，不落盘长期签名 URL）；重复打开从秒级降到 <500ms。
2. **前端 MV 预热**：首页/专辑页在空闲时按需预取可见/精选 MV 的 playback（限流、可取消、遵守 save-data 与 reduced-motion）；hover/进入视口触发预取（按 §5.1 规则）。
3. **后端预热任务**：可选启动/定时任务预热精选 MV 的 view+playurl 解析写入 TTL 缓存，与前端预热互补（受 SEC-06 有界队列约束）。
4. **默认画质降级起播**：首次以 480P/720P 起播保证首帧，播放稳定后自动升到用户上次选择的画质（版本化 localStorage 记忆）；后端按客户端提示可下调默认 qn。
5. **DASH 播放器优化**：先拉 init 段与前几秒样本即开播；**按需分段 Range 拉取**——现状 `pump()` 会把视频+音频**整个流拉完（读到 `done`）才结束**，用户只看开头也全量下载；**AbortController 贯穿 fetch**，关闭播放器/切画质/路由离开时立即中断（现状 fetch 无 signal，关闭 modal 后下载仍在继续）；**视频就绪即开播**——现状 `Promise.all([videoReady, audioReady])` 会等双轨 init 都就绪才 append/start，音频慢会拖住视频首帧，应改为视频就绪即起播、音频就绪后补挂（注意 Chrome 对已有数据的 MediaSource 会锁定 buffer 数量，需先建双 SourceBuffer 再喂数据，代码注释已说明该约束）；SourceBuffer 背压；真实 buffering 状态（`waiting`/`canplay` 事件）替代假计时器。
6. **DASH 解析移入 Web Worker**：`dashPlayer.ts` 的 mp4box 分段解析当前全部在主线程，长视频会卡 UI；解析移入 Web Worker，主线程只做 SourceBuffer 追加与背压。
7. **边缘优先**：生产强制配置 Worker（`MV_PROXY_BASE_URL`），Worker 用 Cache API 缓存视频段；builtin 代理仅作降级（SEC-03 残余一并处理）。
8. **连接预热**：`preconnect`/`dns-prefetch` 到 CDN host（`bilivideo.com`、`akamaized.net`）。
9. **加载 UI**：视频容器先显示封面 poster，加载/缓冲态有真实文案（i18n）与键盘可读提示。
10. **B站官方 iframe 零成本兜底**：把现有 `MvPlayer` 的 `player.bilibili.com` 路径（`localBiliIframeUrl`/`fallbackBiliIframeUrl`）从“仅失败兜底”升级为显式低延迟策略——无凭证、弱网或 Worker 不可达时直接切官方播放器（B站 CDN 保证首帧），代价是失去内置画质选择，用设置开关控制。
11. **验收指标**：同网 P75 首帧 < 2s；命中缓存重复打开 < 500ms；弱网可降到 480P 起播；无假计时器残留。

---

## 7. 测试、质量门槛与实施顺序

### 7.1 必须新增/维护的测试层次

| 层次 | 最低覆盖范围 |
| --- | --- |
| 单元测试 | i18n 完整性、LRC 解析、音量持久化/静音、队列模式、URL query 筛选、图片回退、错误映射。 |
| 组件测试 | MiniAudioBar/FullPlayerOverlay 键盘与 aria、搜索结果分组、移动导航、表单校验、后台危险操作确认。 |
| API 测试 | 401/403、输入验证、分页排序、管理写操作审计、凭证不回显、非法资源 URL、迁移幂等性。 |
| E2E（Playwright） | 公开深层路由刷新、五种语言切换、浅/暗主题、搜索、播放/暂停/音量/队列、轮播减少动态效果、管理员权限边界、320px 与桌面视口。 |
| 视觉/人工 | 关键页面的浅/暗主题截图，键盘遍历，200% 缩放，减少动态效果，慢网和外部资源失败。 |

构建、类型检查、既有后端测试及上述新增测试必须在 CI 中通过。没有前端测试不能视为设计完成。

### 7.2 依赖顺序

1. **基础层：** 建立语义 token、浅/暗映射、动效降级、全局可访问性基线和 i18n key 完整性检查。
2. **信息架构：** 实现并测试 `/tracks`、`/search`、`/variety` 的明确决策，重构 AppShell 移动导航与 URL 状态。
3. **数据浏览：** 依次完成首页、年份、专辑/曲目、成员、Solo/Unit、CF/Cover 的 loading/empty/error、筛选和响应式布局。
4. **统一播放器：** 先修正单一音频所有权，再交付音量、歌词/队列语义、Media Session 和 FullPlayerOverlay；随后把 Music Station 接入同一链路；MV 播放性能（§6.4：解析缓存、预热、降级起播、DASH init-first）与播放器一同交付。
5. **后台：** 先完成现有模块的安全、状态与错误体验；新增内容管理先交付 API/migration/审计，再交付 UI。
6. **收尾：** 全量测试、性能预算、可访问性审计、跨部署模式（单体与前后端分离）验证、视觉回归与文档更新。

每一步均应是可发布的垂直切片；不要先铺设无法工作的“预留入口”，也不要为了页面样式跳过数据、权限和失败路径。

### 7.3 Definition of Done

一个页面/组件只有在以下全部满足时才算完成：

- 路由、数据契约、权限边界与空/错/加载状态已经实现；
- 五种 locale 无缺失 key、无硬编码可见字符串；
- 浅色、暗色、320px、桌面、键盘、减少动态效果通过验收；
- 没有 emoji 功能图标、无不可达控件、无颜色唯一状态；
- 图片、音频、MV、网络、存储和 autoplay 失败均有可恢复状态；
- 相应的单元/组件/API/E2E 测试通过，未引入新的 TypeScript、构建、CSP、CORS 或控制台错误；
## 8. 本轮代码审计待决项（按严重度，未经确认不实施）

> 本节基于前后端、Worker、部署配置与依赖树的实际读取结果编写。下列项目**尚未实施**，用于由产品负责人决定是否纳入修复计划。严重度采用：**P0 致命**（可直接导致敏感数据/权限失守）、**P1 高**（可被远程利用或造成明显生产中断）、**P2 中**（需条件或影响范围有限）、**P3 低**（体验、可访问性、可维护性问题）。当前未确认 P0；P1 应优先决定并修复。
>
> ⚠️ **复核说明（2026-08-01 再次逐条对照当前代码）：** 下表以**当前代码状态**为准。标注「**已解决**（原 Px）」的行，其修复已在最新提交中落地（保留用于追溯与回归验证）；其余为仍待决项。原审计中若干 P1 已关闭，剩余风险以 P2 为主，决策顺序见 §8.3。

### 8.1 安全与可靠性

| ID | 严重度 | 已验证问题 | 证据 | 建议处置 |
| --- | --- | --- | --- | --- |
| SEC-01 | **已解决**（原 P1） | 复核确认：`ensureDefaultAdmin()` 现要求 `ADMIN_DEFAULT_PASSWORD` ≥ 12 字符，否则启动即抛错拒绝初始化；代码中已无硬编码回退密码，`.env.example`/`.env.production.example` 也不再提供弱值。残余：仅本地开发 `.env`（gitignored）含 `tang1234`；曾用弱密码初始化的旧安装需凭据轮换。 | `backend/src/services/adminAuth.ts` 的 `ensureDefaultAdmin()`/`MIN_BOOTSTRAP_PASSWORD_LENGTH`；`.env.example` 第 62 行为空值。 | 已完成；补 CI/README 检查（禁止向仓库提交非空 `ADMIN_DEFAULT_PASSWORD`），旧部署轮换凭据。 |
| SEC-02 | **已解决**（原 P1） | 复核确认：`requireAdminCsrf()` 已在所有非安全方法（`/auth/login` 除外）强制校验——每会话独立 `csrfToken`、`x-csrf-token` 定时安全比较、请求 `Origin` 命中 `trustedAdminOrigins()` 白名单；cookie 跨站部署仍为 `SameSite=None; Secure`，同站回退 `Lax`。残余：补 CSRF/跨域 E2E 测试；同站部署可进一步收紧为 `Lax`。 | `backend/src/services/adminAuth.ts` 的 `requireAdminCsrf()`/`trustedAdminOrigins()`/`adminCookieAttributes()`；`backend/src/routes/admin.ts` 的 preHandler hook；`/admin/auth/login` 与 `/admin/session` 返回 `csrfToken`。 | 已完成；补充跨域/CSRF E2E 测试，同站部署改用 `SameSite=Lax`。 |
| SEC-03 | **P2 中**（原 P1，已部分解决） | 复核确认：内置流代理现要求短时签名 token（`verifyStreamToken`，过期/伪造返回 403）、按 IP 限速（429 `stream_rate_limited`）、15s AbortController 超时、正确透传 `Range`、`cache-control: private`；全局 CORS 为精确 origin 白名单（无 `*`）。残余：无并发/带宽配额、无全局速率限制、代理默认启用（未签名 URL 已不可用，但高并发仍可占用上游连接与带宽）。 | `backend/src/routes/mv.ts` 的 `/:trackId/stream`（`verifyStreamToken`/`isStreamAllowed`/AbortController/Range 转发/`private` 缓存）；`backend/src/server.ts` 的 cors 白名单。 | 追加并发/带宽配额与全局限速；评估生产默认关闭内置代理、仅用已签名限速 Worker。 |
| SEC-04 | **已解决**（原 P1） | 复核确认：后端 `signProxyUrl()` 与 Worker `sign()` 现使用同一版本化 payload（`v`、`u`、`r`、`exp`、`o` 五项）；Worker 校验全部五项、目标 host 白名单（`bilivideo.com`/`akamaized.net`）且仅 HTTPS、`redirect: 'manual'`、请求 `Origin` 必须等于 `o`、`access-control-allow-origin` 精确回显并带 `Vary: Origin`。残余：`workers/mv-proxy/README.md` 仍只写验证 `u`/`r`/`exp`/`sig`，未提 `v`/`o`——文档需与代码同步；补签名契约与限速测试。 | `backend/src/services/biliCredential.ts` 的 `signProxyUrl()`（五项 payload）；`workers/mv-proxy/src/index.ts` 的 `sign()`/`isAllowedTargetHost()`/`redirect: 'manual'`。 | 已完成；同步 Worker README 与代码；补充 Worker 签名契约与速率限制测试。 |
| SEC-05 | **已解决**（原 P1） | 复核确认：依赖已升级，lockfile 解析为 `fastify@5.11.0`、`@fastify/static@10.1.2`（后端已不在旧 Fastify 4 / static 7 链上）；复核时执行 `pnpm audit --prod --audit-level=high` 输出 “No known vulnerabilities found”。残余：CI 保持 audit 门禁并定期复查。 | `backend/package.json` 与 `pnpm-lock.yaml`（fastify 5.11.0 / @fastify/static 10.1.2）；`pnpm audit --prod` 结果。 | 已完成；CI 加入 audit 阻断（新增 high/critical 即失败），升级后跑完整 API/静态托管/CSP/路由回归。 |
| SEC-06 | **P2 中** | 管理员登录、B站解析/验证、封面代理、内置 MV 流及 R2 音频下载仍无统一的入站速率限制。MV 流/封面代理/B站 fetch 已有 timeout+AbortController，但 `musicR2Cache.ts` 的 R2 下载 fetch 仍无 timeout/AbortController，慢上游可长期占用 Node 请求。 | `backend/src/routes/admin.ts`；`backend/src/routes/mv.ts`（已有 AbortController）；`backend/src/services/biliCredential.ts`；`backend/src/services/musicR2Cache.ts`（缺失）。 | 在 Fastify 加全局 body size、request timeout、限速与登录退避；为 `musicR2Cache.ts` 等剩余外部请求统一封装 timeout、总响应大小/内容类型限制、取消传播和有限重试；为耗时缓存工作使用有界队列。 |
| SEC-07 | **P2 中** | 复核修正：自定义角色已入 `admin_roles` 表并支持增删改，`normalizeAdminRoles()` 仅过滤为现存角色（无有效输入时才回落 `editor`），不再把自定义角色一律归一为 editor。但 `updateAdminUser()` 与路由仍无“最后一个 active owner”保护：UI/API 可移除最后一个 owner 的 owner 角色或禁用其账号，造成后台锁死；全后端亦无写操作审计日志。 | `backend/src/db/admin.ts` 的 `normalizeAdminRoles()`、`updateAdminUser()`（无 last-owner 守卫）；`backend/src/routes/admin.ts`；`AdminUsersView.vue`。 | 服务端事务内阻止移除/禁用最后一个 active owner；owner 转移/禁用/恢复写审计并加测试；审计日志为 §5.2 通用前置条件（当前无 audit 表/记录）。 |
| SEC-08 | **P2 中** | 复核修正：`music_cache` 现已有 `expires_at` 列 + 索引，读写均按 TTL 判过期（不会回放过期数据）；但仍无过期行物理清理、无条数/字节上限，`value_json` 会持久化解析出的音频 URL（含短期签名 URL）与歌词，数据库/备份泄露会扩大访问链接暴露面，长期运行会膨胀。 | `backend/src/services/musicCache.ts`（TTL 判断已实现，无清理）；`backend/src/db/schema.sql` 的 `music_cache`（`expires_at` + 索引已存在）。 | 增加定时删除过期行与条数/字节上限；只缓存最小必要元数据，避免落盘临时签名 URL/敏感 token；备份策略加密或排除该缓存。 |
| SEC-09 | **P2 中** | 复核修正：Git 跟踪的 `data/twice.db` 为 **0 字节空文件**（无凭证泄露）；真实运行时库在 `backend/data/twice.db`（约 2.4MB，含 B站凭据/管理员 session），已被 `backend/data/` 忽略，另有 `twice.db.bak` 同目录。风险点：`.gitignore` 的 `!data/twice.db` 反向规则鼓励跟踪数据库；备份/部署打包若含 `backend/data/` 会泄露凭据与 session；本地 `.env` 存弱开发密码（见 SEC-01）。 | `git ls-files`（`data/twice.db` 为空）；`backend/data/twice.db` 与 `.bak`（gitignored）；`.gitignore`（`backend/data/` 已忽略，但含 `!data/twice.db`）。 | 移除 `!data/twice.db` 反向规则；确保备份/部署包排除 `backend/data/` 与 `.bak`；必要时对现有 session/凭据轮换；pre-commit/CI 加 secret 与二进制 DB 检测。 |

### 8.2 样式、可访问性与产品质量

| ID | 严重度 | 已验证问题 | 证据 | 建议处置 |
| --- | --- | --- | --- | --- |
| UX-01 | **已解决**（原 P1） | 复核确认：全前端唯一 `<audio>` 在 `MiniAudioBar.vue`；`MusicStationView` 已不再渲染第二 `<audio>`，播放经 `audioStore.playResolvedMusic()` 载入全局链路（store 内另有 ≤16 个仅 `preload='metadata'` 的瞬时暖机 `Audio` 对象，不构成第二播放链路）。残余：补 E2E 验证切换后无第二路播放；删除 `.music-station-audio`/`.music-station-lyrics-empty` 死样式。 | `frontend/src/views/MusicStationView.vue`（无 `<audio>`，调用 `playResolvedMusic`）；`frontend/src/components/player/MiniAudioBar.vue`（唯一 `<audio>`）；`frontend/src/stores/audio.ts` 的 `warmAudio()`。 | 已完成主体重构；补 E2E 与死样式清理。 |
| UX-02 | **P2 中**（原 P1） | 复核修正：`global.css` 现为 2,623 行（非约 4,000）；`admin-page`/`admin-panel`/`admin-table` 已仅存在于 `admin.css`（global.css 中为 0 处）。剩余重复集中在后台登录/账号外壳：`admin-login-link`、`admin-account-button`、`admin-auth-slot` 同时在 `global.css`（约 346–442、1893、2287 行）与 `admin.css` 中定义，仍会互相覆盖。 | `frontend/src/styles/global.css`（2,623 行）与 `frontend/src/styles/admin.css`（1,701 行）；重复选择器扫描（admin-login-link 等）。 | 将 admin 登录/账号外壳样式收敛到单一所有权（admin.css），删除 `global.css` 中对应规则；禁止全局裸 `.n-button`/`.n-tag` 覆盖（见 UX-06）；为浅/暗/窄屏做视觉回归。 |
| UX-03 | **P2 中** | 全局动效没有全局 `prefers-reduced-motion` 保障：`global.css` 有 13 处 `@keyframes`（背景文字、logo、Hero、卡片、统计、歌词等动画），只有局部移动端禁用；`admin.css` 的 reduce 规则（约 1671 行）无法覆盖公开页面和 scoped `LyricsDisplay`（其 `fadeInUp`/过渡无 reduce 分支）。 | `frontend/src/styles/global.css` 的 13 处 `@keyframes`；`frontend/src/components/player/LyricsDisplay.vue`；唯一 reduce rule 在 `admin.css`。 | 在 `global.css` 加全局 reduce 规则，显式暂停轮播和背景视频；组件 scoped 动效也实现 reduce；避免无限装饰性动画。 |
| UX-04 | **P2 中** | `/variety` 已有完整但不可达的 View，路由仍重定向首页；页面本身还有硬编码中文/emoji、不可键盘操作的可点击 `div`、不受信任 iframe URL 直接绑定及缺少 iframe sandbox。 | `frontend/src/router/index.ts`；`frontend/src/views/VarietyView.vue`。 | 决定发布则注册路由、i18n、button/link 语义、URL allowlist 和 sandbox；不发布则移除该死代码与相关样式/数据，避免维护幻象。 |
| UX-05 | **P2 中** | 首页精选 MV 轮播自动切换，不能由键盘暂停/恢复，圆点 aria 文案硬编码英文 `Slide n`；减少动态效果时仍运行。 | `frontend/src/views/HomeView.vue` 的 interval、轮播 dots。 | 加入可见暂停按钮、键盘左右键策略、locale key、`aria-current`/tab 语义和 reduce 停止自动轮播；焦点或 hover 后不应重新强制自动播放。 |
| UX-06 | **P2 中** | 全局 `.n-button`、`.n-tag` 和 hover transform 覆盖 Naive UI 的所有按钮/标签，包括禁用、对话框、表格操作与后台；其 `!important` 覆盖可破坏 Naive 状态色、焦点、尺寸和无障碍可见性。 | `frontend/src/styles/global.css` 约 2488–2507 行（`.n-button`/`.n-tag` 全局 `!important` 规则）。 | 将规则改为自有 BEM class；不要给库组件设置全局 `!important` transform/shadow；明确 hover、focus-visible、disabled、loading 和 reduced-motion 变体。 |
| UX-07 | **P2 中** | i18n 并不完整：Variety 页面大量硬编码内容；首页轮播圆点 `aria-label` 硬编码英文 `Slide n`；`AppShell` 主题切换用 emoji（☀/☾）作为功能图标（违反 §2.3 图标规则）；`AdminMvsView` 的 BVID 输入 placeholder、`MemberDetailView` 的 MBTI 标签硬编码（复核确认：后台视图其余文案已 i18n，无“复制失败”残留）。与“全部五语言覆盖”目标不符。 | `VarietyView.vue`、`HomeView.vue`（第 25 行 `Slide n`）、`AppShell.vue`（第 60 行 ☀/☾）、`AdminMvsView.vue`（第 77 行 BVID placeholder）、`MemberDetailView.vue`（第 31 行 MBTI）。 | 将所有面向用户文本、aria 文案、table title、placeholder、相对时间和错误纳入消息表；emoji 功能图标替换为 SVG/Ionicons；添加 CI key 完整性/硬编码扫描（允许名单仅用于不可翻译的 ID）。 |
| UX-08 | **P3 低** | 存在未定义或拼写漂移的 CSS token：`--shadow-soft` 无定义；`--accent-gradient` 只作为未设置 fallback；全局样式依赖 `--member-color` 但只有成员卡局部赋值。会使个别 surface/阴影在主题或复用中静默退化。 | CSS token 使用/定义扫描；`MusicStationView.vue`、`global.css`。 | 建立 tokens 文件与 lint；为所有 token 定义浅/暗值或在用处提供确定 fallback；避免页面 scoped CSS 引用未声明变量。 |
| UX-09 | **P3 低** | 公开页面存在不一致的加载/失败处理：专辑、成员、详情等直接 await API，失败后为空白或永久 skeleton；快速路由切换也可能让旧请求覆盖新页面。 | `AlbumsView.vue`、`MembersView.vue`、`AlbumDetailView.vue`、`TrackDetailView.vue`、`MemberDetailView.vue`。 | 给每页统一 request state、AbortController/请求序号、重试和返回导航；404 与网络失败区分展示。 |
| UX-10 | **P2 中** | MV 播放冷启动链路无缓存/无预取：点击播放后才解析；后端 `view`+`playurl` 两次上游请求不缓存；DASH 从字节 0 顺序拉取且 mp4box 主线程解析，`pump()` 会把视频+音频**整个流拉完（读到 `done`）才结束**——用户只看开头也全量下载；fetch 无 AbortController，关闭播放器/切画质/路由离开都不中断下载；默认 1080P 起播；移动端用硬编码 3s 计时器假装“加载中”。首帧延迟高、弱网更明显。 | `frontend/src/components/player/MvPlayer.vue`（`watch(show)` 冷启动、`setTimeout(3000)`）；`backend/src/services/biliCredential.ts` 的 `resolveBiliMvPlayback()`（无缓存）；`frontend/src/components/player/dashPlayer.ts`（`pump()` 读至 `done`、`fetch` 无 signal）；`backend/src/routes/mv.ts` 的 builtin `/stream`。 | 按 §6.4 执行：后端解析 TTL 缓存、前端 MV 预热与画质降级起播、DASH init-first + 按需分段 Range 拉取 + AbortController 中断、Worker 边缘优先、真实缓冲提示替代假计时器。 |

### 8.3 建议决策顺序

1. **已完成（复核确认，无需再批准）：** SEC-01、SEC-02、SEC-04、SEC-05、UX-01 已落地；SEC-03 主体（签名+限速）已落地，仅剩并发/带宽配额残余。
2. **必须优先批准：** UX-02（admin 样式单一所有权）、UX-10（MV 首帧性能，§6.4）、SEC-03 残余（并发/带宽配额与全局限速）。
3. **应在任何新增后台/播放能力前批准：** SEC-06 至 SEC-09、UX-03 至 UX-07。
4. **可作为设计债务排期：** UX-08、UX-09。

剩余风险以 P2 为主；公开部署后台/启用 B站流代理/扩展音乐下载缓存能力前，仍应先完成 UX-02、§5.2 写操作审计与 SEC-07 last-owner 保护。
