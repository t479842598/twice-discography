import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const root = process.cwd()
const designDir = path.join(root, 'design')
const outputDir = path.join(root, 'output', 'playwright')
const htmlPath = path.join(designDir, 'first-style-page-designs.html')

const assets = {
  logo: '../frontend/public/twice-logomark.png',
  hero: 'https://d1al7qj7ydfbpt.cloudfront.net/artist/twice/2ecb5a255d824a90a1f1d366c1333813-%E1%84%8A%E1%85%A5%E1%86%B7%E1%84%82%E1%85%A6%E1%84%8B%E1%85%B5%E1%86%AF.jpg',
  meYou: '../backend/public/albums/apple-twice-1840284138.jpg',
  strategy: '../backend/public/albums/strategy.jpg',
  whatIsLove: '../backend/public/albums/what-is-love.jpg',
  fancy: '../backend/public/albums/fancy-you.jpg',
  formula: '../backend/public/albums/formula-of-love.jpg',
  ready: '../backend/public/albums/ready-to-be.jpg',
  masterpiece: '../backend/public/albums/misamo-masterpiece.jpg',
  nayeon: '../frontend/public/members/nayeon.webp',
  sana: '../frontend/public/members/sana.webp',
  momo: '../frontend/public/members/momo.webp',
  jihyo: '../frontend/public/members/jihyo.webp',
  mina: '../frontend/public/members/mina.webp',
  dahyun: '../frontend/public/members/dahyun.webp',
}

const pages = [
  page('home', '首页', '/', 'TEN: The Story Goes On', 'ME+YOU', '最新发行、时间线与播放器的完整首页体验。', ['2025', 'Single', 'Title Track'], ['Latest', 'Title Tracks', 'Korean', 'Japanese', 'Solo', 'MISAMO'], 'home', '#ec3f78', assets.hero),
  page('year-detail', '年份详情', '/years/:year', 'Year Archive', '2025 Timeline', '把年度专辑、主打、舞台与补充作品放在同一条叙事里。', ['2025', '7 Albums', '42 Tracks'], ['2025', '2024', '2023', '2022', '2021'], 'timeline', '#a46a13', assets.ready),
  page('albums', '专辑列表', '/albums', 'Albums', 'Discography Shelf', '封面网格、分类筛选和发行信息保持首页同款卡片语言。', ['84 Releases', 'Korean', 'Japanese'], ['All', 'Albums', 'Singles', 'Japanese', 'Solo'], 'albums', '#1686a7', assets.formula),
  page('album-detail', '专辑详情', '/albums/:id', 'Album Detail', 'What is Love?', '封面、元信息、曲目与整专播放入口集中呈现。', ['2018', 'Album', 'Title Track'], ['Tracks', 'Lyrics', 'Credits', 'Related'], 'album-detail', '#1c8b6a', assets.whatIsLove),
  page('track-detail', '歌曲详情', '/tracks/:id', 'Track Detail', 'FANCY', '突出立即播放、MV、歌词和所属专辑关系。', ['2019', 'FANCY YOU', '3:33'], ['Play', 'MV', 'Lyrics', 'Sources'], 'track-detail', '#8f315f', assets.fancy),
  page('solo-unit', 'Solo / Unit', '/solo-unit', 'Solo & Unit', 'Members Projects', 'Solo、Unit 与 MISAMO 用分段控件和成员作品卡组织。', ['Solo', 'Unit', 'MISAMO'], ['NAYEON', 'JIHYO', 'TZUYU', 'MISAMO'], 'solo', '#6654b8', assets.nayeon),
  page('cfs', 'CF 歌曲', '/cfs', 'Commercial Songs', 'Brand Collabs', '广告曲以品牌、年份、歌曲和播放状态聚合。', ['26 Songs', '18 Brands', '10 Years'], ['Brand', 'Year', 'Playable', 'MV'], 'list', '#a46a13', assets.strategy),
  page('covers', '翻唱作品', '/covers', 'Covers', 'Special Stages', '成员、原唱、舞台地点和年份组成可扫描列表。', ['64 Covers', '31 Stages', '9 Members'], ['Member', 'Original', 'Stage', 'Year'], 'covers', '#1686a7', assets.sana),
  page('members', '成员列表', '/members', 'Members', 'Nine Profiles', '九位成员以照片网格为主，作品入口紧跟在卡片内。', ['9 Members', '24 Solo', '18 Unit'], ['All', 'Vocal', 'Dance', 'Rap'], 'members', '#ec3f78', assets.jihyo),
  page('member-detail', '成员详情', '/members/:id', 'Member Profile', 'MOMO', '成员照片、履历字段、相关曲目和作品时间线同屏呈现。', ['Dance', 'Japan', '1996'], ['Profile', 'Tracks', 'Albums', 'Stages'], 'member-detail', '#1c8b6a', assets.momo),
  page('music-station', '音乐台', '/music-station', 'Music Station', 'Search & Lyrics', '搜索、音源选择、播放队列和歌词面板是核心。', ['3 Sources', 'Lossless', 'Queue'], ['Search', 'Sources', 'Lyrics', 'Queue'], 'station', '#8f315f', assets.formula),
  page('variety', '综艺备选页', '未接入 /variety', 'Variety Archive', 'TIME TO TWICE', '为后续综艺路由保留分类、视频卡和节目时间线。', ['18 Shows', '96 Clips', '5 Platforms'], ['T T T', 'Interview', 'Behind', 'Live'], 'variety', '#6654b8', assets.whatIsLove),
  page('admin-login', '管理登录', '/admin/login', 'Admin Access', 'Login Console', '管理端保持工作台密度，但使用同一品牌顶栏和状态色。', ['Session', '2 Fields', 'Inline Error'], ['Login', 'Security', 'Back Home'], 'admin-login', '#293449', assets.logo, true),
  page('admin-dashboard', '管理总览', '/admin', 'Dashboard', 'Content Console', '健康度、KPI、优先事项和最近操作直接进入首屏。', ['12 Tasks', '98% Auth', '4 Users'], ['Today', 'Content', 'Access', 'Logs'], 'admin-dashboard', '#293449', assets.logo, true),
  page('admin-mvs', 'MV 管理', '/admin/mvs', 'MV Management', 'Video Assets', '表格、封面预览、批量校验和保存反馈高密度排列。', ['118 MVs', '3 Missing', '2 Errors'], ['Search', 'Table', 'Preview', 'Batch'], 'admin-table', '#1686a7', assets.logo, true),
  page('admin-bilibili-settings', 'B 站设置', '/admin/settings/bilibili', 'Bilibili Settings', 'Cookie & Proxy', 'Cookie 文本域、验证状态和错误恢复路径双栏呈现。', ['Verified', '7 Days', 'Proxy OK'], ['Cookie', 'Verify', 'Proxy', 'Recovery'], 'admin-form', '#a46a13', assets.logo, true),
  page('admin-users', '用户权限', '/admin/users', 'Users & Roles', 'Role Control', '账号、角色、状态和操作在表格与移动行卡里保持清晰。', ['4 Users', '1 Owner', '0 Disabled'], ['Owner', 'Editor', 'Viewer'], 'admin-users', '#6654b8', assets.logo, true),
]

function page(slug, title, route, eyebrow, heading, body, tags, filters, type, accent, image, admin = false) {
  return { slug, title, route, eyebrow, heading, body, tags, filters, type, accent, image, admin }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
}

function css() {
  return `
    :root{--brand:#ec3f78;--ink:#111318;--muted:#62666f;--line:#d9d7d2;--shell:#fffdfa;--soft:#f4f1ed;--shadow:0 20px 55px rgba(22,24,30,.16);font-family:Inter,Outfit,"Microsoft YaHei","PingFang SC",Arial,sans-serif;color:var(--ink);letter-spacing:0;background:#ebe8e3}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 12% 8%,rgba(236,63,120,.12),transparent 28%),linear-gradient(135deg,#f3f0eb,#e4e0d8);}.gallery{width:min(1740px,calc(100% - 40px));margin:0 auto;padding:28px 0 80px}.intro{display:grid;grid-template-columns:minmax(0,1fr)360px;gap:24px;align-items:end;margin-bottom:24px}.brandline{display:flex;gap:14px;align-items:center}.brandline img{width:58px;height:58px;object-fit:contain}.intro h1{margin:20px 0 8px;font-size:44px;line-height:1.05}.intro p,.meta{color:var(--muted);line-height:1.7}.meta{padding:18px;border:1px solid rgba(17,19,24,.09);border-radius:18px;background:rgba(255,255,255,.68);box-shadow:0 18px 45px rgba(22,24,30,.1)}.page-board{margin:28px 0;padding:18px;border-radius:24px;background:#f8f6f2;box-shadow:var(--shadow)}.board-head{display:flex;gap:18px;align-items:center;justify-content:space-between;padding:0 4px 14px}.board-head h2{margin:0;font-size:24px}.board-head p{margin:5px 0 0;color:var(--muted)}.route{display:inline-flex;min-height:34px;align-items:center;padding:0 12px;border:1px solid var(--line);border-radius:999px;background:#fff;font:700 13px Consolas,monospace;color:#555}.frames{display:grid;grid-template-columns:minmax(0,1fr)360px;gap:16px}.desktop,.phone{overflow:hidden;background:var(--shell);box-shadow:0 16px 40px rgba(17,19,24,.14)}.desktop{height:820px;border:1px solid rgba(17,19,24,.1);border-radius:18px}.phone{height:820px;border:1px solid rgba(17,19,24,.15);border-radius:26px}.topbar,.mobile-top{display:grid;align-items:center;border-bottom:1px solid rgba(17,19,24,.1);background:rgba(255,253,250,.94);backdrop-filter:blur(18px)}.topbar{grid-template-columns:260px minmax(0,1fr)300px;height:76px;padding:0 28px}.brand{display:flex;gap:12px;align-items:center;font-weight:900}.brand img{width:58px;height:58px;object-fit:contain}.brand small{display:block;margin-top:2px;color:var(--muted);font-weight:700}.nav{display:flex;gap:22px;justify-content:center;font-size:13px;font-weight:800}.nav span:first-child{color:var(--brand);border-bottom:2px solid var(--brand)}.actions{display:flex;gap:10px;justify-content:flex-end}.search,.iconbtn{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line);background:#fff}.search{width:210px;height:42px;border-radius:14px;color:#8a8d94;font-size:12px}.iconbtn{width:42px;height:42px;border-radius:50%;font-weight:900}.hero{position:relative;height:315px;display:flex;align-items:flex-end;overflow:hidden;padding:34px;background-image:linear-gradient(90deg,rgba(0,0,0,.78),rgba(0,0,0,.32) 48%,rgba(0,0,0,.58)),var(--hero-image);background-position:center;background-size:cover;color:#fff}.hero h3{margin:8px 0 0;font-size:58px;line-height:.9;letter-spacing:0}.eyebrow{font-weight:900}.tags,.chips,.buttons{display:flex;flex-wrap:wrap;gap:9px}.tag,.chip{display:inline-flex;align-items:center;border-radius:8px;font-size:12px;font-weight:900}.tag{height:28px;padding:0 12px;border:1px solid rgba(255,255,255,.45);background:rgba(0,0,0,.22)}.tag.is-title{border-color:#a4d65e;color:#d6ff92}.buttons{margin-top:18px}.button{display:inline-flex;min-width:112px;height:44px;align-items:center;justify-content:center;border-radius:999px;background:var(--accent);font-size:14px;font-weight:900}.button.secondary{border:1px solid rgba(255,255,255,.55);background:rgba(0,0,0,.22)}.dots{position:absolute;right:34px;bottom:24px;display:flex;gap:12px}.dots span{width:10px;height:10px;border-radius:999px;background:rgba(255,255,255,.5)}.dots span:first-child{width:26px;background:var(--accent)}.content{padding:18px 28px 0}.chips{margin-bottom:16px}.chip{height:36px;padding:0 16px;background:#efeeeb;color:#34363b}.chip.active{background:var(--accent);color:#fff}.timeline{display:grid;grid-template-columns:repeat(6,1fr);align-items:end;margin:12px 0 18px;color:#333;font-size:12px;font-weight:900}.timeline span{position:relative;text-align:center}.timeline span:after{content:"";display:block;width:7px;height:7px;margin:8px auto 0;border-radius:50%;background:#595c62;box-shadow:0 0 0 1px #d7d4ce}.timeline span:first-child{color:var(--accent)}.timeline span:first-child:after{background:var(--accent);box-shadow:0 0 0 6px rgba(236,63,120,.14)}.module-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.card,.panel,.row{border:1px solid var(--line);border-radius:10px;background:#fff;box-shadow:0 14px 28px rgba(17,19,24,.07)}.card{overflow:hidden;min-height:184px}.card img{width:100%;height:118px;object-fit:cover}.card div{padding:11px}.card strong,.row strong{display:block}.card span,.row span,.panel p{color:var(--muted);font-size:12px}.panel{padding:16px}.panel h4{margin:0 0 12px;font-size:16px}.rows{display:grid;gap:9px}.row{display:grid;grid-template-columns:46px minmax(0,1fr)auto;gap:12px;align-items:center;min-height:58px;padding:9px 12px}.row img{width:46px;height:46px;border-radius:8px;object-fit:cover}.mini-player{height:70px;margin-top:16px;border-top:1px solid var(--line);display:grid;grid-template-columns:220px 1fr 220px;gap:20px;align-items:center;padding:0 22px;background:#fff}.track{display:flex;gap:12px;align-items:center}.track img{width:48px;height:48px;border-radius:8px}.controls{text-align:center;font-weight:900}.progress{height:4px;margin-top:8px;border-radius:999px;background:linear-gradient(90deg,var(--accent) 35%,#b8b8b8 35%)}.mobile-status{height:28px;display:flex;justify-content:space-between;align-items:center;padding:0 14px;font-size:11px;font-weight:900}.mobile-top{grid-template-columns:46px minmax(0,1fr)46px;height:54px;padding:0 10px}.mobile-logo{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:900}.mobile-logo img{width:38px;height:38px}.mobile-content{height:668px;overflow:hidden;background:#fbfaf8}.mobile-hero{height:280px;display:flex;align-items:flex-end;padding:14px;background-image:linear-gradient(180deg,rgba(0,0,0,.15),rgba(0,0,0,.85)),var(--hero-image);background-position:center;background-size:cover;color:#fff}.mobile-hero h3{margin:7px 0 0;font-size:38px;line-height:.95}.mobile-actions{display:flex;gap:8px;margin-top:12px}.mobile-actions .button{min-width:112px;height:38px;font-size:12px}.mobile-body{padding:12px}.mobile-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}.mobile-card{overflow:hidden}.mobile-card img{height:92px}.mobile-card div{padding:7px}.mobile-card strong{font-size:11px}.mobile-row{grid-template-columns:38px minmax(0,1fr)auto;min-height:50px}.mobile-row img{width:38px;height:38px}.quote{text-align:center;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:10px;color:#23262b;font-weight:900}.bottom-player{height:58px;display:grid;grid-template-columns:44px minmax(0,1fr)80px;gap:9px;align-items:center;padding:8px 12px;background:#fff}.bottom-player img{width:40px;height:40px;border-radius:8px}.bottom-nav{height:56px;display:grid;grid-template-columns:repeat(5,1fr);align-items:center;background:#fff;border-top:1px solid var(--line);font-size:10px;font-weight:800;text-align:center}.bottom-nav span:first-child{color:var(--accent)}.admin .hero{background-image:linear-gradient(135deg,rgba(255,255,255,.96),rgba(239,244,247,.93));color:#1d2533}.admin .hero p{color:#5f6773}.admin .button.secondary{border-color:rgba(29,37,51,.2);color:#1d2533;background:#fff}.admin-side{background:#293449;color:#fff;padding:18px}.admin-layout{display:grid;grid-template-columns:176px 1fr;height:100%}.admin-main .topbar{grid-template-columns:220px 1fr 180px}.admin-nav span{height:34px;display:block;padding:8px 10px;border-radius:8px;color:rgba(255,255,255,.72);font-size:12px;font-weight:800}.admin-nav span:first-child{background:rgba(255,255,255,.14);color:#fff}.form{display:grid;grid-template-columns:1fr 290px;gap:14px}.field{height:44px;border:1px solid var(--line);border-radius:10px;background:#fff;margin-bottom:10px}.field.tall{height:150px}.table{display:grid;gap:8px}.table .row{grid-template-columns:1.2fr .7fr .7fr auto}.phone.admin .mobile-hero{height:220px;background:linear-gradient(135deg,#fff,#eef3f6);color:#1d2533;border-bottom:1px solid var(--line)}@media(max-width:1100px){.frames,.intro{grid-template-columns:1fr}.phone{width:360px}.desktop{min-width:1180px}.desktop-wrap{overflow:auto}}`
}

function renderContent(page, mobile = false) {
  if (page.type === 'members') return renderMembers(mobile)
  if (page.type === 'member-detail') return renderRows(['生日与国籍', '参与专辑', '精选舞台'], mobile)
  if (page.type === 'station') return renderStation(mobile)
  if (page.type === 'admin-form') return renderAdminForm()
  if (page.type?.startsWith('admin')) return renderAdminTable(page)
  if (['album-detail', 'track-detail', 'timeline', 'list', 'covers', 'variety'].includes(page.type)) return renderRows(page.filters, mobile)
  return renderCards(page, mobile)
}

function renderCards(page, mobile = false) {
  const images = [page.image, assets.meYou, assets.fancy]
  return `<div class="${mobile ? 'mobile-cards' : 'module-grid'}">${images.map((image, index) => `<article class="card ${mobile ? 'mobile-card' : ''}"><img src="${image}" alt=""><div><strong>${escapeHtml(['ME+YOU', 'ENEMY', 'THIS IS FOR'][index] || page.title)}</strong><span>${escapeHtml(page.filters[index] || page.title)}</span></div></article>`).join('')}</div>`
}

function renderRows(items, mobile = false) {
  const images = [assets.fancy, assets.whatIsLove, assets.strategy]
  return `<div class="rows">${items.slice(0, 3).map((item, index) => `<article class="row ${mobile ? 'mobile-row' : ''}"><img src="${images[index]}" alt=""><div><strong>${escapeHtml(item)}</strong><span>${escapeHtml(['TWICE', 'Title Track', 'Release note'][index])}</span></div><span class="route">Play</span></article>`).join('')}</div>`
}

function renderMembers(mobile = false) {
  const members = [[assets.nayeon, 'NAYEON'], [assets.sana, 'SANA'], [assets.momo, 'MOMO'], [assets.jihyo, 'JIHYO'], [assets.mina, 'MINA'], [assets.dahyun, 'DAHYUN']]
  const count = mobile ? 3 : 6
  return `<div class="${mobile ? 'mobile-cards' : 'module-grid'}">${members.slice(0, count).map(([image, name]) => `<article class="card ${mobile ? 'mobile-card' : ''}"><img src="${image}" alt=""><div><strong>${name}</strong><span>Profile & Works</span></div></article>`).join('')}</div>`
}

function renderStation(mobile = false) {
  return `<div class="panel"><h4>搜索与播放</h4><div class="field"></div><div class="rows">${renderRows(['FANCY - TWICE', 'What is Love?', 'Strategy'], mobile).replace('<div class="rows">', '').replace('</div>', '')}</div></div>`
}

function renderAdminForm() {
  return `<div class="form"><div class="panel"><h4>Cookie 输入</h4><div class="field tall"></div><span class="button">保存并验证</span></div><div class="panel"><h4>验证状态</h4>${renderRows(['Cookie 已验证', '代理正常', '播放权限可用'])}</div></div>`
}

function renderAdminTable(page) {
  return `<div class="table">${['项目 / 内容', '状态', '负责人'].map((item) => `<article class="row"><strong>${escapeHtml(item)}</strong><span>${escapeHtml(page.title)}</span><span class="route">处理</span></article>`).join('')}</div>`
}

function renderDesktop(page) {
  const body = `<div class="content"><div class="chips">${page.filters.map((filter, index) => `<span class="chip ${index === 0 ? 'active' : ''}">${escapeHtml(filter)}</span>`).join('')}</div><div class="timeline">${['2025', '2024', '2023', '2022', '2021', '2020'].map((year) => `<span>${year}</span>`).join('')}</div>${renderContent(page)}<div class="mini-player"><div class="track"><img src="${assets.fancy}" alt=""><div><strong>FANCY</strong><span>TWICE · FANCY YOU</span></div></div><div class="controls">◀  ❚❚  ▶<div class="progress"></div></div><div class="actions"><span class="iconbtn">≡</span><span class="iconbtn">⌃</span></div></div></div>`
  if (page.admin) {
    return `<div class="desktop admin"><div class="admin-layout"><aside class="admin-side"><strong>TWICE Admin</strong><div class="admin-nav"><span>总览</span><span>MV 管理</span><span>B 站设置</span><span>用户权限</span></div></aside><div class="admin-main"><div class="topbar"><div class="brand"><img src="${assets.logo}" alt=""><span>管理后台<small>${escapeHtml(page.route)}</small></span></div><div class="nav"><span>${escapeHtml(page.title)}</span><span>状态</span><span>日志</span></div><div class="actions"><span class="iconbtn">A</span></div></div>${renderHero(page)}${body}</div></div></div>`
  }
  return `<div class="desktop"><div class="topbar"><div class="brand"><img src="${assets.logo}" alt=""><span>TWICE Discography<small>Complete archive</small></span></div><div class="nav"><span>Home</span><span>Albums</span><span>Timeline</span><span>Members</span><span>Music Station</span></div><div class="actions"><span class="search">Search releases, tracks...</span><span class="iconbtn">☼</span><span class="iconbtn">EN</span></div></div>${renderHero(page)}${body}</div>`
}

function renderHero(page) {
  return `<section class="hero" style="--hero-image:url('${page.image}');--accent:${page.accent}"><div><div class="eyebrow">${escapeHtml(page.eyebrow)}</div><h3>${escapeHtml(page.heading)}</h3><p>${escapeHtml(page.body)}</p><div class="tags">${page.tags.map((tag, index) => `<span class="tag ${index === 2 ? 'is-title' : ''}">${escapeHtml(tag)}</span>`).join('')}</div><div class="buttons"><span class="button">▶ Play</span><span class="button secondary">▣ Watch MV</span><span class="button secondary">View Release</span></div></div><div class="dots"><span></span><span></span><span></span><span></span></div></section>`
}

function renderMobile(page) {
  return `<div class="phone ${page.admin ? 'admin' : ''}"><div class="mobile-status"><span>9:41</span><span></span><span>●●●</span></div><div class="mobile-top"><div class="mobile-logo"><img src="${assets.logo}" alt=""></div><div class="mobile-logo">${escapeHtml(page.title)}</div><span class="iconbtn">☰</span></div><div class="mobile-content"><section class="mobile-hero" style="--hero-image:url('${page.image}');--accent:${page.accent}"><div><div class="eyebrow">${escapeHtml(page.eyebrow)}</div><h3>${escapeHtml(page.heading)}</h3><div class="tags">${page.tags.slice(0, 3).map((tag, index) => `<span class="tag ${index === 2 ? 'is-title' : ''}">${escapeHtml(tag)}</span>`).join('')}</div><div class="mobile-actions"><span class="button">▶ Play</span><span class="button secondary">▣ MV</span></div></div></section><div class="mobile-body"><div class="chips">${page.filters.slice(0, 3).map((filter, index) => `<span class="chip ${index === 0 ? 'active' : ''}">${escapeHtml(filter)}</span>`).join('')}</div>${renderContent(page, true)}</div><div class="quote">We write our story, you and me</div><div class="bottom-player"><img src="${assets.fancy}" alt=""><div><strong>FANCY</strong><br><span>TWICE</span></div><strong>▶ ▶</strong></div><div class="bottom-nav"><span>Home</span><span>Albums</span><span>Search</span><span>Members</span><span>Player</span></div></div></div>`
}

function renderPage(page, index) {
  return `<article class="page-board" id="${page.slug}" style="--accent:${page.accent}"><header class="board-head"><div><h2>${index + 1}. ${escapeHtml(page.title)}</h2><p>${escapeHtml(page.body)}</p></div><span class="route">${escapeHtml(page.route)}</span></header><div class="frames"><div class="desktop-wrap">${renderDesktop(page)}</div>${renderMobile(page)}</div></article>`
}

function html() {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TWICE 第一版风格逐页设计稿</title><style>${css()}</style></head><body><main class="gallery"><section class="intro"><div><div class="brandline"><img src="${assets.logo}" alt="TWICE"><strong>TWICE Discography</strong></div><h1>第一版首页风格 · 全站逐页设计稿</h1><p>依据你给的首页图，把其他页面统一到白色应用框、沉浸 MV Hero、胶囊筛选、年份时间线、卡片内容和底部播放器的视觉语言。</p></div><aside class="meta">覆盖用户端 12 页、管理端 5 页。每张图同时包含 PC 与移动端画板，方便逐页确认。</aside></section>${pages.map(renderPage).join('')}</main></body></html>`
}

await mkdir(designDir, { recursive: true })
await mkdir(outputDir, { recursive: true })
await writeFile(htmlPath, html(), 'utf8')

const browser = await chromium.launch({ headless: true })
const pageInstance = await browser.newPage({ viewport: { width: 1720, height: 980 }, deviceScaleFactor: 1 })
await pageInstance.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' })
await pageInstance.waitForFunction(() => Array.from(document.images).every((img) => img.complete), null, { timeout: 30000 }).catch(() => undefined)
await pageInstance.screenshot({ path: path.join(outputDir, 'first-style-page-designs-full.png'), fullPage: true })

for (const item of pages) {
  const locator = pageInstance.locator(`#${item.slug}`)
  await locator.scrollIntoViewIfNeeded()
  await locator.screenshot({ path: path.join(outputDir, `${item.slug}.png`) })
}

await browser.close()
console.log(`Generated ${pages.length} page screenshots in ${path.relative(root, outputDir)}`)
