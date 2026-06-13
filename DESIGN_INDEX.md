# TWICE Discography 页面重设计交付索引

本目录仅包含设计图/规格文档，未修改现有前端或后端页面代码。

## 已完成设计文档

| 序号 | 页面/组件 | 文档 | 说明 |
|---:|---|---|---|
| 01 | 首页 | `designs/01-home.md` | Hero、专辑轮播、精选专辑、热门曲目 |
| 02 | 专辑列表 | `designs/02-albums.md` | 搜索、筛选、排序、响应式专辑网格 |
| 03 | 专辑详情 | `designs/03-album-detail.md` | 大封面、专辑信息、曲目表格/移动卡片 |
| 04 | 曲目列表 | `designs/04-tracks.md` | 电脑表格 + 移动卡片，音质/筛选展示 |
| 05 | 曲目详情 | `designs/05-track-detail.md` | 歌曲封面、音源选择、歌词预览、相关推荐 |
| 06 | 成员页面 | `designs/06-members.md` | 9 成员卡片、成员详情入口 |
| 07 | 搜索页面 | `designs/07-search.md` | 全局搜索、筛选、结果分组 |
| 08 | 导航栏 | `designs/08-navbar.md` | 浮动玻璃导航、移动端抽屉 |
| 09 | 迷你播放器 | `designs/09-mini-player.md` | 保持当前播放器样式，仅新增音量控制；保留歌词显示 |
| 10 | 全屏播放器 | `designs/10-full-player.md` | 沉浸式歌词、队列、音量控制 |
| 11 | 后台管理 | `designs/11-admin.md` | Dashboard、专辑/曲目/音源/歌词/成员/设置管理 |

## 统一设计系统

### 颜色

```css
--color-bg-main: #020617;      /* slate-950 */
--color-surface: rgba(255,255,255,.05);
--color-border: rgba(255,255,255,.10);
--color-text: #F8FAFC;         /* slate-50 */
--color-text-muted: #94A3B8;   /* slate-400 */
--color-primary: #EC4899;      /* pink-500 */
--color-secondary: #A855F7;    /* purple-500 */
--color-accent: #60A5FA;       /* blue-400 */
--color-success: #10B981;      /* emerald-500 */
--color-warning: #F59E0B;      /* amber-500 */
--color-danger: #F43F5E;       /* rose-500 */
```

### 背景

```html
bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950
```

### 卡片

```html
rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl
```

### 主按钮

```html
rounded-full bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg shadow-pink-500/20 hover:shadow-pink-500/40 transition-shadow cursor-pointer
```

### 次按钮

```html
rounded-full border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer
```

## 响应式原则

| 断点 | 布局策略 |
|---|---|
| 320-639px | 单列卡片、底部播放器、抽屉菜单、横向 chips |
| 640-767px | 2 列小网格、按钮可并排 |
| 768-1023px | 表格开始启用，但隐藏非关键列 |
| 1024-1279px | 侧栏/双栏布局启用 |
| 1280px+ | 完整表格、4 列卡片、后台侧边栏 |

## 播放器决策点

### 用户明确要求

- 当前迷你播放器样式只增加音量控制。
- 播放器要显示歌词。
- 暂不修改页面，先给设计图。

### 建议实现顺序

1. 只给 MiniAudioBar 增加音量控制：`volume`、`muted`、slider、localStorage。
2. 保留/优化现有 LyricsDisplay 的位置和样式。
3. 再决定是否做全屏播放器。
4. 最后统一前后台页面样式。

## 下一步可选方案

### 方案 A：保守实现

- 不大改页面结构。
- 统一颜色、圆角、按钮和卡片。
- Mini Player 只加音量。
- 风险最低，适合先上线。

### 方案 B：完整重设计

- 按这些设计文档重构所有前台页面。
- 后台也统一深色玻璃风格。
- 增加全屏播放器与歌词沉浸模式。
- 视觉提升最大，但改动较多。

### 方案 C：分阶段

1. 播放器音量 + 歌词体验。
2. 首页/���辑/曲目三个主页面。
3. 成员/搜索/详情页。
4. 后台页面。

## 设计检查清单

- [ ] 电脑端和移动端风格一致。
- [ ] 移动端无横向滚动。
- [ ] 所有可点击元素有 `cursor-pointer`。
- [ ] 不使用表情符号图标，全部替换为 SVG。
- [ ] Hover 不造成布局位移。
- [ ] 歌词无内容时有空状态。
- [ ] 音量可键盘操作，支持静音。
- [ ] 后台危险操作有确认。
