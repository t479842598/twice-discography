# TWICE Discography 重设计方案

## 设计理念

**风格定位**：现代玻璃拟态 + 渐变背景 + K-pop 视觉风格
**色彩方案**：
- 主色：`#FF6B9D` (粉色 - TWICE 品牌色)
- 次色：`#C084FC` (紫色)
- 强调色：`#60A5FA` (蓝色)
- 背景：深色渐变 `from-slate-900 via-purple-900/20 to-slate-900`
- 文字：`#F8FAFC` (亮色) / `#94A3B8` (次要文字)

**字体**：
- 标题：Outfit (Google Fonts) - 现代、几何感
- 正文：Inter (Google Fonts) - 清晰易读

**交互特性**：
- 玻璃拟态卡片 `backdrop-blur-xl`
- 悬停效果：颜色过渡 + 轻微发光
- 平滑过渡 `transition-all duration-300`
- 响应式布局（320px - 1920px）

---

## 页面清单

### 前端页面
1. **首页 (HomeView)** - 专辑轮播 + 精选曲目
2. **专辑列表 (AlbumsView)** - 所有专辑网格展示
3. **专辑详情 (AlbumDetailView)** - 专辑信息 + 曲目列表
4. **曲目列表 (TracksView)** - 所有歌曲列表
5. **曲目详情 (TrackDetailView)** - 歌曲信息 + 音源列表
6. **成员页面 (MembersView)** - TWICE 成员展示
7. **搜索页面 (SearchView)** - 搜索专辑/歌曲

### 全局组件
8. **导航栏 (NavBar)** - 顶部固定导航
9. **迷你播放器 (MiniAudioPlayer)** - 底部固定播放器（**新增音量控制**）
10. **全屏播放器 (FullPlayer)** - 展开式播放器（**新增歌词显示**）

---

## 技术栈
- **框架**: Vue 3 + TypeScript
- **UI库**: Naive UI (保留现有)
- **样式**: Tailwind CSS
- **图标**: Heroicons
- **动画**: CSS Transitions + Vue Transition

---

## 响应式断点
```css
xs: 320px   (手机竖屏)
sm: 640px   (手机横屏)
md: 768px   (平板竖屏)
lg: 1024px  (平板横屏/小笔记本)
xl: 1280px  (桌面)
2xl: 1536px (大屏幕)
```

---

## 明暗模式支持
当前设计为**暗色模式优先**，未来可扩展亮色模式：
- 暗色：`bg-slate-900` + 玻璃效果
- 亮色：`bg-white` + 柔和阴影

---

## 可访问性
- ARIA 标签完整
- 键盘导航支持
- 焦点状态可见 `focus:ring-2 focus:ring-pink-500`
- 色彩对比度 ≥ 4.5:1
- 图片 alt 文本
- 动画尊重 `prefers-reduced-motion`

---

## 设计详情请查看各页面设计文档：
- [1. 首页设计](./designs/01-home.md)
- [2. 专辑列表设计](./designs/02-albums.md)
- [3. 专辑详情设计](./designs/03-album-detail.md)
- [4. 曲目列表设计](./designs/04-tracks.md)
- [5. 曲目详情设计](./designs/05-track-detail.md)
- [6. 成员页面设计](./designs/06-members.md)
- [7. 搜索页面设计](./designs/07-search.md)
- [8. 导航栏设计](./designs/08-navbar.md)
- [9. 迷你播放器设计](./designs/09-mini-player.md)
- [10. 全屏播放器设计](./designs/10-full-player.md)
