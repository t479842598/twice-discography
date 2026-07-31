# TWICE Discography — 完整重设计与交付规格

> **文档状态：** 已按当前代码库复核（Vue 3 + Vite + Pinia + Naive UI + Fastify + SQLite）。
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
- 默认主题：暗色优先；浅色为完整的一等主题，而非仅反转背景。
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
4. **统一播放器：** 先修正单一音频所有权，再交付音量、歌词/队列语义、Media Session 和 FullPlayerOverlay；随后把 Music Station 接入同一链路。
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

### 8.1 安全与可靠性

| ID | 严重度 | 已验证问题 | 证据 | 建议处置 |
| --- | --- | --- | --- | --- |
| SEC-01 | **P1 高** | 生产默认管理员密码存在硬编码回退值 `tang1234`，且示例环境文件也提供该弱值。若部署遗漏 `ADMIN_DEFAULT_PASSWORD` 且数据库首次初始化，攻击者可用公开默认凭据取得 owner 权限。 | `backend/src/services/adminAuth.ts` 的 `DEFAULT_ADMIN_PASSWORD` 与 `ensureDefaultAdmin()`；`.env.example`。 | 删除默认值；生产环境缺少强随机密码时拒绝启动/拒绝初始化；首次初始化使用一次性 bootstrap secret 或显式 CLI；对现有安装执行凭据轮换。 |
| SEC-02 | **P1 高** | 管理员 cookie 在跨站部署时设置为 `SameSite=None; Secure`，但所有改变服务器状态的管理端点没有 CSRF 防护，也未校验 `Origin`/`Referer`。已登录 owner 访问恶意站点时，跨站请求可创建账号、改角色/密码、写入 Cookie、修改 MV 或登出。 | `backend/src/services/adminAuth.ts` 的 `adminCookieAttributes()`；`backend/src/routes/admin.ts` 的 POST/PUT/PATCH/DELETE 路由；前端 API 一律 `credentials: 'include'`。 | 引入 CSRF token（双提交或服务端绑定 token）并在全部非安全方法强制校验；同时严格 allowlist 校验 Origin；能同站部署时优先 `SameSite=Lax/Strict`；新增跨域/CSRF E2E 测试。 |
| SEC-03 | **P1 高** | 后端内置 MV 流代理对公开请求使用服务端 B站凭证解析和转发视频，但无频率、并发、带宽、Range、超时和响应大小限制；还显式返回 `Access-Control-Allow-Origin: *`。攻击者可枚举有效 trackId，将服务器变成高带宽公开代理并耗尽连接/流量。 | `backend/src/routes/mv.ts` 的 `/:trackId/stream`（无 `Range` 转发、无 AbortController、公开 CORS、`public` 缓存）。 | 默认禁用内置流代理，生产仅使用已签名且限速的 Worker；若保留，增加鉴权/签名、IP/会话速率与并发限制、上游 host allowlist、Range 正确透传、请求超时与流取消、带宽配额、`Vary: Origin` 与精确 CORS。 |
| SEC-04 | **P1 高** | Cloudflare MV Worker 的签名载荷与后端签发载荷不一致：后端签名 `targetUrl + referer + expiresAt + allowedOrigin` 四项，Worker 仅验证前三项；同时 Worker 解码出的 `u` 可指向任意 HTTP(S) host，且跟随重定向。这会使 Worker 路径在当前配置下失效；若签名格式被“修好”但未加入 host/redirect 校验，则会成为签名 URL 有效期内的开放代理/SSRF 出口。 | `backend/src/services/biliCredential.ts` 的 `signProxyUrl()`；`workers/mv-proxy/src/index.ts` 的 `sign()`、`fetch()`。 | 统一为同一版本化 canonical payload（包含允许的前端 origin/受众）；Worker 验证 `o` 与请求 Origin，并只允许明确的 Bilibili CDN host 集合和 HTTPS；使用 `redirect: 'manual'` 或逐跳重新校验；加速率/大小限制与签名契约测试。 |
| SEC-05 | **P1 高** | 依赖审计检出 15 个 high（共 19 个）：Fastify 4.29.1、`@fastify/static` 7.0.4 及传递的 `fast-uri`、`find-my-way`、`glob`/`brace-expansion`，还有前端 PostCSS。包含静态路径遍历/路由守卫绕过、HTTP body validation bypass、DoS 等已公开漏洞。 | `pnpm audit --prod --audit-level=low` 输出；`backend/package.json` 锁定 Fastify 4 / static 7。 | 将 Fastify、其官方插件和 `fastify-type-provider-zod` 迁移到相互兼容的受支持版本，升级/override 所有受影响传递依赖；锁文件更新后运行完整 API、静态托管、CSP、路由和部署回归测试；CI 阻断新增 high/critical。 |
| SEC-06 | **P2 中** | 管理员登录、B站解析/验证、封面代理、内置 MV 流及 R2 音频下载没有统一的入站速率限制；其中多处外部 `fetch` 没有 timeout/AbortController，慢上游可长期占用 Node 请求和资源。 | `backend/src/routes/admin.ts`、`backend/src/routes/mv.ts`、`backend/src/services/biliCredential.ts`、`backend/src/services/musicR2Cache.ts`。 | 在 Fastify 加全局 body size、request timeout、限速与登录退避；对外部请求统一封装 timeout、总响应大小/内容类型限制、取消传播和有限重试；为耗时缓存工作使用有界队列。 |
| SEC-07 | **P2 中** | 管理员角色模型把所有自定义角色归一为 `editor` 默认权限语义，且 UI 可移除最后一个 owner 的 owner 角色或禁用最后一个 owner；会造成锁死/不可恢复的后台管理。 | `backend/src/db/admin.ts` 的 `normalizeAdminRoles()`、`updateAdminUser()`；`backend/src/routes/admin.ts`；`AdminUsersView.vue`。 | 服务器事务内阻止移除/禁用最后一个 active owner；自定义角色必须定义权限集后才可授予，不能暗中等同 editor；为 owner 转移、禁用和恢复写审计及测试。 |
| SEC-08 | **P2 中** | 音乐搜索/播放响应（含短期音频 URL 与歌词）被持久化进 SQLite `music_cache`，但没有清理过期行、容量上限或敏感 URL 生命周期策略；数据库泄露/备份会扩大第三方访问链接和歌词暴露面，长期运行也会膨胀。 | `backend/src/services/musicCache.ts` 与 `backend/src/db/schema.sql` 的 `music_cache`。 | 只缓存最小必要元数据；避免落盘临时签名 URL/敏感 token；定期删除过期项，限制条数/字节数，并在备份策略中加密/排除该缓存。 |
| SEC-09 | **P2 中** | 已提交的运行数据库 `data/twice.db` 当前工作树中含一条 B站加密凭证记录和 7 条管理员 session；即使 Git index 中的该文件为空，数据库/备份/部署打包策略已不安全，且现有 session 应视为泄露。 | 对 `backend/data/twice.db` 的只读 schema/计数检查；`.gitignore` 仅忽略 `backend/data/`，而运行时默认路径可能写入 `data/twice.db`。 | 立即撤销所有 session、轮换 B站 Cookie 和加密密钥；绝不跟踪运行时数据库或备份；使用持久卷/secret manager；加入 pre-commit/CI secret 与二进制数据库检测。 |

### 8.2 样式、可访问性与产品质量

| ID | 严重度 | 已验证问题 | 证据 | 建议处置 |
| --- | --- | --- | --- | --- |
| UX-01 | **P1 高** | Music Station 自行渲染第二个 `<audio autoplay>`，而全局 MiniAudioBar 也有独立 `<audio>`。两个播放器可同时发声，队列、音量、歌词、暂停和 Media Session 状态会分裂。 | `frontend/src/views/MusicStationView.vue`；`frontend/src/components/player/MiniAudioBar.vue`。 | 按第 4 节重构为 audio store + 单一媒体元素；Music Station 仅将候选解析结果载入全局播放器；加 E2E 验证切换后不残留第二路播放。 |
| UX-02 | **P1 高** | 全局 CSS 与 admin CSS 大量重复且互相覆盖（例如 `admin-page`、`admin-panel`、`admin-table`、`admin-login-link` 等）；`global.css` 中保留多轮旧后台样式，会与 `admin.css` 的新设计竞争，导致主题、响应式和组件状态难以预测。 | `frontend/src/styles/global.css` 约 4,000 行及 `frontend/src/styles/admin.css`；重复选择器扫描结果。 | 建立单一 admin 样式所有权；删除死规则并按 token/组件分层；禁止全局裸 `.n-button`/`.n-tag` 覆盖；为浅/暗/窄屏做视觉回归。 |
| UX-03 | **P2 中** | 全局动效没有全局 `prefers-reduced-motion` 保障：`global.css` 有背景文字、logo、Hero、按钮、卡片、统计和歌词动画，只有局部移动端禁用；`admin.css` 的 reduced-motion 无法覆盖公开页面和 scoped LyricsDisplay。 | `frontend/src/styles/global.css` 的多处 `@keyframes`；`LyricsDisplay.vue`；唯一 reduce rule 在 `admin.css`。 | 在 `global.css` 加全局 reduce 规则，显式暂停轮播和背景视频；组件 scoped 动效也实现 reduce；避免无限装饰性动画。 |
| UX-04 | **P2 中** | `/variety` 已有完整但不可达的 View，路由仍重定向首页；页面本身还有硬编码中文/emoji、不可键盘操作的可点击 `div`、不受信任 iframe URL 直接绑定及缺少 iframe sandbox。 | `frontend/src/router/index.ts`；`frontend/src/views/VarietyView.vue`。 | 决定发布则注册路由、i18n、button/link 语义、URL allowlist 和 sandbox；不发布则移除该死代码与相关样式/数据，避免维护幻象。 |
| UX-05 | **P2 中** | 首页精选 MV 轮播自动切换，不能由键盘暂停/恢复，圆点 aria 文案硬编码英文 `Slide n`；减少动态效果时仍运行。 | `frontend/src/views/HomeView.vue` 的 interval、轮播 dots。 | 加入可见暂停按钮、键盘左右键策略、locale key、`aria-current`/tab 语义和 reduce 停止自动轮播；焦点或 hover 后不应重新强制自动播放。 |
| UX-06 | **P2 中** | 全局 `.n-button`、`.n-tag` 和 hover transform 覆盖 Naive UI 的所有按钮/标签，包括禁用、对话框、表格操作与后台；其 `!important` 覆盖可破坏 Naive 状态色、焦点、尺寸和无障碍可见性。 | `frontend/src/styles/global.css` 约 2488–2514 行。 | 将规则改为自有 BEM class；不要给库组件设置全局 `!important` transform/shadow；明确 hover、focus-visible、disabled、loading 和 reduced-motion 变体。 |
| UX-07 | **P2 中** | i18n 并不完整：Variety 页面大量硬编码内容；首页轮播文案、后台 BVID/P/复制失败、成员 MBTI 等也有硬编码。与“全部五语言覆盖”目标不符。 | `VarietyView.vue`、`HomeView.vue`、`AdminMvsView.vue`、`AdminBiliSettingsView.vue`、`MemberDetailView.vue`。 | 将所有面向用户文本、aria 文案、table title、placeholder、相对时间和错误纳入消息表；添加 CI key 完整性/硬编码扫描（允许名单仅用于不可翻译的 ID）。 |
| UX-08 | **P3 低** | 存在未定义或拼写漂移的 CSS token：`--shadow-soft` 无定义；`--accent-gradient` 只作为未设置 fallback；全局样式依赖 `--member-color` 但只有成员卡局部赋值。会使个别 surface/阴影在主题或复用中静默退化。 | CSS token 使用/定义扫描；`MusicStationView.vue`、`global.css`。 | 建立 tokens 文件与 lint；为所有 token 定义浅/暗值或在用处提供确定 fallback；避免页面 scoped CSS 引用未声明变量。 |
| UX-09 | **P3 低** | 公开页面存在不一致的加载/失败处理：专辑、成员、详情等直接 await API，失败后为空白或永久 skeleton；快速路由切换也可能让旧请求覆盖新页面。 | `AlbumsView.vue`、`MembersView.vue`、`AlbumDetailView.vue`、`TrackDetailView.vue`、`MemberDetailView.vue`。 | 给每页统一 request state、AbortController/请求序号、重试和返回导航；404 与网络失败区分展示。 |

### 8.3 建议决策顺序

1. **必须优先批准：** SEC-01、SEC-02、SEC-03、SEC-04、SEC-05、UX-01、UX-02。
2. **应在任何新增后台/播放能力前批准：** SEC-06 至 SEC-09、UX-03 至 UX-07。
3. **可作为设计债务排期：** UX-08、UX-09。

在处理 P1 前，不建议公开部署后台、启用 B站流代理或扩展音乐下载/缓存能力。
