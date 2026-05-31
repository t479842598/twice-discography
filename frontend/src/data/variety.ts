export type VarietyCategoryKey =
  | 'preview'
  | 'group'
  | 'time-to-twice'
  | 'variety'
  | 'anniversary'
  | 'solo'
  | 'live'
  | 'radio'
  | 'concert'
  | 'fanchant'
  | 'list'

export interface VarietyCategory {
  key: VarietyCategoryKey
  label: string
  description: string
}

export interface VarietyItem {
  id: string
  category: Exclude<VarietyCategoryKey, 'preview' | 'list'>
  title: string
  subtitle?: string
  year?: string
  episodes?: string
  cast: string
  source: 'Notion' | 'TWFlix' | 'Manual'
  tags: string[]
  description: string
  url: string
  coverUrl?: string  // 封面图片 URL
}

export const varietySourceLinks = {
  notion: 'https://receptive-mandible-a0f.notion.site/TWICE-16b0258e9f208065b0e1e83e4b1525aa',
  twflix: 'https://twflix.carrd.co/#profile',
}

export const notionVarietyMeta = {
  collectionName: '观兔手册',
  visibleRows: 198,
  properties: ['类型', '首播时间', '出演', '链接', '画质', '推荐', '频道', '季数', '集数', '字幕', '标签', '简介'],
}

export const varietyCategories: VarietyCategory[] = [
  { key: 'preview', label: '预览', description: '总览所有视频资料入口，类似观兔手册首页视图。' },
  { key: 'group', label: '团综汇总', description: 'TWICE TV、TW-LOG、团体真人秀和团体自制内容。' },
  { key: 'time-to-twice', label: 'Time to TWICE', description: '官方 TTT 系列，按主题、季数和玩法继续补充。' },
  { key: 'variety', label: '综艺', description: '电视台/网络综艺、采访、游戏节目和外部节目出演。' },
  { key: 'anniversary', label: '周年', description: '出道周年、纪念直播、十周年相关内容。' },
  { key: 'solo', label: '个综', description: '成员个人频道、个人企划和 Solo 时期物料。' },
  { key: 'live', label: '直播', description: 'V LIVE、YouTube Live、回归直播和聊天直播。' },
  { key: 'radio', label: '电台', description: '回归电台、IDOL RADIO、采访电台和特别 DJ 内容。' },
  { key: 'concert', label: '演唱会', description: '线下/线上演唱会、巡演、Fan Meeting 与 Showcase。' },
  { key: 'fanchant', label: '应援法', description: '官方应援、练习、口号和 ONCE 现场指南。' },
  { key: 'list', label: 'List', description: '表格模式查看全部条目，便于后续按年份/成员/标签筛选。' },
]

export const varietyItems: VarietyItem[] = [
  {
    id: 'twice-tv',
    category: 'group',
    title: 'TWICE TV',
    subtitle: '团体幕后 / 出道早期 / 回归花絮',
    year: '2015 - Present',
    episodes: '多季',
    cast: '全体',
    source: 'TWFlix',
    tags: ['团综', '幕后花絮', '回归记录'],
    description: 'TWFlix 页面把 TWICE TV 作为团体 Original 栏目展示，适合做团综汇总入口。',
    url: varietySourceLinks.twflix,
  },
  {
    id: 'tw-log',
    category: 'group',
    title: 'TW-LOG',
    subtitle: '成员日常记录',
    year: '2021 - Present',
    episodes: '系列',
    cast: '全体 / 成员个人',
    source: 'TWFlix',
    tags: ['Vlog', '日常', '治愈'],
    description: '以成员视角记录日常、练习、活动和旅行片段，可作为 Vlog 子分类入口。',
    url: varietySourceLinks.twflix,
  },
  {
    id: 'time-to-twice',
    category: 'time-to-twice',
    title: 'Time to TWICE',
    subtitle: '官方自制综艺主线',
    year: '2020 - Present',
    episodes: '多主题',
    cast: '全体',
    source: 'Notion',
    tags: ['团综', '游戏', '名场面'],
    description: 'Notion 视图中单独拆出 Time to TWICE，后续可按 Crime Scene、Healing、High School 等主题继续细分。',
    url: varietySourceLinks.notion,
  },
  {
    id: 'sixteen',
    category: 'variety',
    title: 'SIXTEEN',
    subtitle: '出道生存节目',
    year: '2015',
    episodes: '10 集',
    cast: '出道前成员 / JYP',
    source: 'Manual',
    tags: ['出道综', '纪录片', '必看'],
    description: 'TWICE 诞生前的重要节目，适合放在综艺模块作为入坑必看。',
    url: 'https://www.youtube.com/results?search_query=TWICE+SIXTEEN',
  },
  {
    id: 'elegant-private-life',
    category: 'variety',
    title: 'TWICE’s Elegant Private Life',
    subtitle: '出道初期真人秀',
    year: '2016',
    episodes: '8 集',
    cast: '全体',
    source: 'Manual',
    tags: ['团综', '出道初期', '生活观察'],
    description: '出道初期真人秀，可和 SIXTEEN、TWICE TV 放在新粉入门线路。',
    url: 'https://www.youtube.com/results?search_query=TWICE+Elegant+Private+Life',
  },
  {
    id: 'running-man',
    category: 'variety',
    title: 'Running Man',
    subtitle: '外部综艺出演',
    year: '多期',
    episodes: '多期',
    cast: '全体 / 部分成员',
    source: 'TWFlix',
    tags: ['综艺', '游戏', '熟人局'],
    description: 'TWFlix 页面设有 TV APPEARANCES，并列出 Running Man 作为代表外部综艺入口。',
    url: varietySourceLinks.twflix,
  },
  {
    id: 'anniversary',
    category: 'anniversary',
    title: 'Anniversary Archive',
    subtitle: '周年直播与纪念企划',
    year: '2016 - Present',
    episodes: '年度',
    cast: '全体',
    source: 'Notion',
    tags: ['周年记录', '直播', '纪念'],
    description: 'Notion 将“周年”单独做视图，适合整理出道周年、十周年和 ONCE 纪念内容。',
    url: varietySourceLinks.notion,
  },
  {
    id: 'nayeon-original',
    category: 'solo',
    title: 'NAYEON Original',
    subtitle: 'Solo 企划与采访',
    year: '2022 - Present',
    episodes: '系列',
    cast: '林娜琏',
    source: 'TWFlix',
    tags: ['个综', 'Solo', '采访'],
    description: 'TWFlix 用成员分季展示 Solo 内容，站内个综模块沿用这种“大卡片 + 横向条目”的思路。',
    url: varietySourceLinks.twflix,
  },
  {
    id: 'misamo-original',
    category: 'solo',
    title: 'MISAMO Original',
    subtitle: '小分队影像企划',
    year: '2023 - Present',
    episodes: '系列',
    cast: 'Momo / Sana / Mina',
    source: 'TWFlix',
    tags: ['小分队', 'MISAMO', '日本活动'],
    description: 'TWFlix 将 MISAMO 独立成内容入口，适合和成员个人企划共同放在个综页签。',
    url: varietySourceLinks.twflix,
  },
  {
    id: 'comeback-live',
    category: 'live',
    title: 'Comeback Live',
    subtitle: '回归直播',
    year: '多时期',
    episodes: '多期',
    cast: '全体',
    source: 'TWFlix',
    tags: ['直播', '回归', '聊天'],
    description: '回归期直播、专辑倒计时与幕后聊天，可按专辑年份继续扩充。',
    url: varietySourceLinks.twflix,
  },
  {
    id: 'idol-radio',
    category: 'radio',
    title: 'Radio / IDOL RADIO',
    subtitle: '电台与宣传期音频节目',
    year: '多时期',
    episodes: '多期',
    cast: '全体 / 小分队 / 成员',
    source: 'Notion',
    tags: ['电台', '回归宣传', '采访'],
    description: 'Notion 视图中单独拆出“电台”，并有回归电台、特别 DJ 等标签。',
    url: varietySourceLinks.notion,
  },
  {
    id: 'concert-archive',
    category: 'concert',
    title: 'Concert / Showcase / Fan Meeting',
    subtitle: '演唱会与舞台活动',
    year: '2017 - Present',
    episodes: '巡演 / 线上',
    cast: '全体',
    source: 'Notion',
    tags: ['演唱会', '线上演唱会', 'Showcase'],
    description: 'Notion 把演唱会独立成视图，TWFlix 也有 Concert、Showcase、Fan Meeting 展示入口。',
    url: varietySourceLinks.notion,
  },
  {
    id: 'fanchant-guide',
    category: 'fanchant',
    title: 'Fan Chant / 应援法',
    subtitle: 'ONCE 现场应援指南',
    year: '持续更新',
    episodes: '按歌曲',
    cast: 'ONCE',
    source: 'Notion',
    tags: ['应援法', '现场', 'ONCE'],
    description: 'Notion 视图中有“应援法”分类，可后续按歌曲连接到曲库详情页。',
    url: varietySourceLinks.notion,
  },
]
