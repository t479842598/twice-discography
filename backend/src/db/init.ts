import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getDatabase, closeDatabase } from './database.js'
import { appleAlbums, appleTracks } from './seed/appleCatalog.js'
import { albums, cfs, covers, members, tracks } from './seed/catalog.js'

function normalizeTitle(value: string) {
  return value.toLowerCase().replace(/\\s*[-–—]\\s*(ep|single)$/i, '').replace(/[^a-z0-9]+/g, '')
}

const manualAlbumKeys = new Set(albums.map((album) => normalizeTitle(album.name_en)))
const appleTrackAlbumIds = new Set(appleTracks.map((track) => track.album_id).filter(Boolean))
const catalogAlbums = [
  ...albums,
  ...appleAlbums.filter((album) => appleTrackAlbumIds.has(album.id) && !manualAlbumKeys.has(normalizeTitle(album.name_en))),
]
const catalogAlbumIds = new Set(catalogAlbums.map((album) => album.id))
const catalogTracks = [
  ...tracks,
  ...appleTracks.filter((track) => !track.album_id || catalogAlbumIds.has(track.album_id)),
]
type CatalogSeedTrack = (typeof catalogTracks)[number]

const titleTrackByAlbum: Record<string, string> = {
  thestorybegins: 'likeoohahh',
  pagetwo: 'cheerup',
  twicecoasterlane1: 'tt',
  twicecoasterlane2: 'knockknock',
  signal: 'signal',
  twicetagram: 'likey',
  merryandhappy: 'heartshaker',
  whatislove: 'whatislove',
  summernights: 'dancethenightaway',
  yesoryes: 'yesoryes',
  theyearofyes: 'thebestthingieverdid',
  fancyyou: 'fancy',
  feelspecial: 'feelspecial',
  moreandmore: 'moreandmore',
  eyeswideopen: 'icantstopme',
  tasteoflove: 'alcoholfree',
  formulaofloveot3: 'scientist',
  between12: 'talkthattalk',
  readytobe: 'setmefree',
  withyouth: 'onespark',
  strategy: 'strategy',
  thisisfor: 'thisisfor',
  thisisfordeluxe: 'thisisfor',
  enemy: 'enemy',
  dive: 'dive',
  masterpiece: 'donottouch',
  hautecouture: 'identity',
  play: 'confetti',
  imnayeon: 'pop',
  na: 'abcd',
  zone: 'killinmegood',
  aboutzu: 'runaway',
}

function normalizeSongTitle(value: string) {
  return normalizeTitle(value)
    .replace(/ep$/i, '')
    .replace(/single$/i, '')
    .replace(/deluxe$/i, '')
}

function titleFlag(track: { is_title?: number; title_en: string; album_id?: string | null; track_no?: number | null }) {
  if (!track.album_id) return track.track_no === 1 ? 1 : 0
  const album = catalogAlbums.find((item) => item.id === track.album_id)
  if (!album) return track.track_no === 1 ? 1 : 0
  const albumKey = normalizeSongTitle(album.name_en)
  const trackKey = normalizeSongTitle(track.title_en)
  const mapped = titleTrackByAlbum[albumKey]
  if (mapped) return trackKey === mapped ? 1 : 0
  if (albumKey && trackKey === albumKey) return 1
  return track.track_no === 1 ? 1 : 0
}

const memberAliases: Record<string, string[]> = {
  NAYEON: ['nayeon'],
  JEONGYEON: ['jeongyeon'],
  MOMO: ['momo'],
  SANA: ['sana'],
  JIHYO: ['jihyo'],
  MINA: ['mina'],
  DAHYUN: ['dahyun'],
  CHAEYOUNG: ['chaeyoung'],
  TZUYU: ['tzuyu'],
  MISAMO: ['momo', 'sana', 'mina'],
}

function uniqueMemberIds(memberIds: string[]) {
  return Array.from(new Set(memberIds))
}

function inferMemberIdsFromTitle(title: string) {
  const parentheticalParts = Array.from(title.matchAll(/\(([^)]+)\)/g), (match) => match[1].toUpperCase())
  const matchedIds = parentheticalParts.flatMap((part) =>
    Object.entries(memberAliases).flatMap(([alias, memberIds]) => {
      const pattern = new RegExp(`(^|[^A-Z])${alias}([^A-Z]|$)`)
      return pattern.test(part) ? memberIds : []
    }),
  )

  return uniqueMemberIds(matchedIds)
}

function categoryForMemberCredit(track: CatalogSeedTrack, inferredMemberIds: string[]) {
  if (inferredMemberIds.length === 0) return track.category
  if (inferredMemberIds.length === 1) return 'solo'
  if (track.category === 'misamo' && inferredMemberIds.join(',') === 'momo,sana,mina') return 'misamo'
  return 'unit'
}

function withInferredMemberCredits(track: CatalogSeedTrack) {
  const inferredMemberIds = inferMemberIdsFromTitle(track.title_en)
  if (inferredMemberIds.length === 0) return track

  return {
    ...track,
    category: categoryForMemberCredit(track, inferredMemberIds),
    member_ids_json: JSON.stringify(inferredMemberIds),
  }
}

const memberFacts: Record<string, { height_cm: number; blood_type: string; mbti: string; zodiac: string; bio_zh: string; bio_en: string; bio_ja: string; bio_ko: string }> = {
  nayeon: { height_cm: 163, blood_type: 'A', mbti: 'ISTP', zodiac: 'Virgo', bio_zh: '林娜琏是 TWICE 的大姐与主唱线成员，2015 年通过 Mnet 生存节目《SIXTEEN》出道。她音色明亮甜美，常担任歌曲副歌与高音部分，舞台表情和亲和力十足。2022 年发行首张个人迷你专辑《IM NAYEON》，主打曲 POP! 席卷全球各大榜单；2024 年又以 ABCD 展现成熟多变的个人色彩，是组合中人气与话题度兼具的"中心"之一。', bio_en: 'Im Na-yeon is TWICE’s eldest member and a leading vocalist, debuting in 2015 through Mnet’s survival show SIXTEEN. Her bright, sweet tone frequently carries the hooks and high notes of TWICE songs, and her warm stage presence makes her a fan favorite. In 2022 she released her debut solo mini-album IM NAYEON, whose title track POP! topped charts worldwide; ABCD in 2024 showed an even more mature, versatile side of her artistry.', bio_ja: 'イム・ナヨンは TWICE の最年長メンバーでメインボーカルラインの一人。2015年にサバイバル番組『SIXTEEN』でデビューしました。明るく甘い歌声でサビやハイトーンを担当し、親しみやすいステージが魅力。2022年に1stミニアルバム『IM NAYEON』をリリースし『POP!』が各国チャートを席巻。2024年の『ABCD』ではさらに成熟した姿を見せています。', bio_ko: '임나연은 TWICE의 맏언니이자 메인 보컬라인 멤버로, 2015년 Mnet 서바이벌 《SIXTEEN》을 통해 데뷔했습니다. 밝고 달콤한 음색으로 후렴구와 고음을 도맡으며 무대 친화력이 뛰어납니다. 2022년 첫 솔로 미니앨범 《IM NAYEON》을 발표해 타이틀곡 POP!으로 전 세계 차트를 휩쓸었고, 2024년 ABCD로 한층 성숙하고 다채로운 매력을 보여주었습니다.' },
  jeongyeon: { height_cm: 167, blood_type: 'O', mbti: 'ISFJ', zodiac: 'Scorpio', bio_zh: '俞定延是 TWICE 的主唱成员，2015 年出道以来以稳健清澈的嗓音支撑着组合的抒情曲与和声部分。她性格温柔直率，综艺感与团队凝聚力都很强，短发造型曾让她成为"少年感"的代表。舞台上是可靠的嗓音支柱，私下则是把妹妹们照顾得无微不至的暖心二姐。', bio_en: 'Yoo Jeong-yeon is a main vocalist of TWICE whose steady, clear voice anchors the group’s ballads and harmonies. Since debuting in 2015, she has been known for a warm, candid personality and strong variety presence, and her iconic short hair made her a style icon of youthful charm. On stage she is a dependable vocal anchor; off stage she is the caring second-oldest member who always looks after her younger bandmates.', bio_ja: 'ユ・ジョンヨンは TWICE のボーカル担当で、2015年のデビュー以来、安定した澄んだ歌声でバラードやハーモニーを支えてきました。温かく率直な性格でバラエティでも大活躍。ショートヘアがトレードマークで、舞台上では頼れる歌声、プライベートでは面倒見のいい二番目のお姉さんです。', bio_ko: '유정연은 TWICE의 메인 보컬 멤버로, 2015년 데뷔 이후 안정적이고 맑은 목소리로 발라드와 화음을 든든하게 받쳐주고 있습니다. 따뜻하고 솔직한 성격으로 예능감이 뛰어나며, 짧은 머리 스타일로 큰 사랑을 받았습니다. 무대에서는 믿음직한 보컬, 무대 밖에서는 동생들을 세심하게 챙기는 듬직한 둘째 언니입니다.' },
  momo: { height_cm: 167, blood_type: 'A', mbti: 'INFP', zodiac: 'Scorpio', bio_zh: '平井桃是 TWICE 的主舞与日本成员，凭借《SIXTEEN》中惊艳的舞蹈实力出道。她拥有极强的爆发力与节奏控制，被誉为"舞蹈机器"，是组合舞台的视觉核心之一；同时是日本小分队 MISAMO 的成员，2023 年随小分队发行 EP《Masterpiece》与《Haute Couture》。舞台下爱美食、反差萌的形象也深受粉丝喜爱。', bio_en: 'Hirai Momo is TWICE’s main dancer and a Japanese member, debuting on the strength of her breathtaking performances in SIXTEEN. Renowned for explosive power and razor-sharp rhythm control, she is one of K-pop’s most respected dancers and a visual centerpiece of the group’s stages. As part of the Japanese sub-unit MISAMO, she released the EPs Masterpiece (2023) and Haute Couture. Off stage, her love of food and lovable gap-moe charm endear her to fans worldwide.', bio_ja: '平井ももは TWICE のメインダンサーで日本出身メンバー。『SIXTEEN』での圧倒的なダンスでデビューを掴み、爆発力とリズムコントロールに定評があり「ダンスマシーン」と呼ばれます。ユニット MISAMO のメンバーとして2023年にEP『Masterpiece』と『Haute Couture』をリリース。食いしん坊で愛らしいギャップも大人気です。', bio_ko: '히라이 모모는 TWICE의 메인 댄서이자 일본 출신 멤버로, 《SIXTEEN》에서 압도적인 댄스 실력으로 데뷔했습니다. 폭발적인 파워와 정교한 리듬 컨트롤로 ‘댄스 머신’이라 불리며 무대의 핵심으로 활약합니다. 일본 유닛 MISAMO의 멤버로 2023년 EP 《Masterpiece》, 《Haute Couture》를 발표했고, 무대 밖에서는 먹방과 귀여운 반전 매력으로 사랑받고 있습니다.' },
  sana: { height_cm: 164, blood_type: 'B', mbti: 'ENFP', zodiac: 'Capricorn', bio_zh: '凑崎纱夏是 TWICE 的日本成员与 MISAMO 成员，以百变的舞台表情和甜蜜声线著称。她"天使般"的综艺感与极具感染力的粉丝互动让她成为话题中心，一句"샤이 샤이 샤이(Shy Shy Shy)"曾风靡全韩成为流行语。2023 年随 MISAMO 发行《Masterpiece》，在甜美之外展现出更具层次感的舞台表现。', bio_en: 'Minatozaki Sana is a Japanese member of TWICE and part of the MISAMO sub-unit, famed for her endlessly expressive stages and sweet vocal color. Her angelic variety sense and heartfelt fan service made her a viral sensation — her playful "Shy Shy Shy" hook became a nationwide catchphrase in Korea. With MISAMO she released the EP Masterpiece in 2023, revealing a more layered, mature side of her performance.', bio_ja: '湊﨑紗夏は TWICE の日本出身メンバーで MISAMO の一員。豊かな表情と甘い歌声、そしてファンへの愛にあふれたステージで知られ、「シャイシャイシャイ」のフレーズで韓国中を沸かせました。2023年にはMISAMOとしてEP『Masterpiece』を発表し、甘さだけでない深みのある表現も見せています。', bio_ko: '미나토자키 사나는 TWICE의 일본 출신 멤버이자 MISAMO의 일원으로, 풍부한 표정과 달콤한 음색, 팬을 향한 애정 가득한 무대로 유명합니다. ‘샤이 샤이 샤이’ 훅은 전국적인 유행어가 되기도 했으며, 2023년 MISAMO로 EP 《Masterpiece》를 발표하며 달콤함 너머의 깊이 있는 무대를 보여주고 있습니다.' },
  jihyo: { height_cm: 160, blood_type: 'O', mbti: 'ESFP', zodiac: 'Aquarius', bio_zh: '朴志效是 TWICE 的队长与主唱，也是练习生涯长达十年的"王牌练习生"。她拥有扎实的现场唱功与舞台领导力，出道近十年始终是组合的定海神针。2023 年发行个人专辑《ZONE》，主打曲 Killin’ Me Good 以成熟的 R&B 曲风展现个人色彩；她也积极参与作词作曲，为组合多首歌曲贡献创作。', bio_en: 'Park Ji-hyo is TWICE’s leader and main vocalist — a powerhouse trainee who trained for a decade before debuting through SIXTEEN. Her rock-solid live vocals and stage leadership have anchored the group for nearly a decade. In 2023 she released her solo album ZONE with the R&B title track Killin’ Me Good, and she actively writes lyrics and co-composes songs for the group, bringing her own musical color to the discography.', bio_ja: 'パク・ジヒョは TWICE のリーダー兼メインボーカル。練習生生活は10年に及び、圧倒的なライブ歌唱力とステージ統率力でグループを支えてきました。2023年にはソロアルバム『ZONE』をリリースし、『Killin’ Me Good』で大人のR&Bテイストを見せました。作詞作曲にも積極的に関わり、グループの音楽に自分らしさを注いでいます。', bio_ko: '박지효는 TWICE의 리더이자 메인 보컬로, 10년의 연습생 생활을 거쳐 《SIXTEEN》으로 데뷔했습니다. 뛰어난 라이브 가창력과 리더십으로 그룹을 든든히 이끌어 왔으며, 2023년 솔로 앨범 《ZONE》을 발표해 타이틀곡 Killin’ Me Good으로 성숙한 매력을 보여주었습니다. 작사·작곡에도 적극 참여하며 그룹 음악에 자신만의 색을 더하고 있습니다.' },
  mina: { height_cm: 163, blood_type: 'A', mbti: 'ISFP', zodiac: 'Aries', bio_zh: '名井南是 TWICE 的日本成员与 MISAMO 成员，11 岁起学习芭蕾，深厚的舞蹈底子让她的舞台线条格外优雅，被粉丝称作"黑天鹅"。她气质清冷而温柔，在组合中担任领舞与副唱；2023 年随 MISAMO 发行《Masterpiece》，以细腻的表演进一步展现个人色彩。', bio_en: 'Myoui Mina is a Japanese member of TWICE and part of the MISAMO sub-unit. Trained in ballet from the age of 11, her dance background gives her an exceptionally graceful stage presence, earning her the nickname "Black Swan." Calm, elegant and gentle, she serves as a lead dancer and vocalist; with MISAMO she released the EP Masterpiece in 2023, showcasing her delicate artistry.', bio_ja: '名井南は TWICE の日本出身メンバーで MISAMO の一員。11歳からバレエを学び、その経験を活かした優雅なステージで「黒鳥」と称されます。クールで上品、それでいて優しい雰囲気が魅力です。2023年にはMISAMOとしてEP『Masterpiece』を発表し、繊細な表現力でさらに魅了しています。', bio_ko: '묘이 미나는 TWICE의 일본 출신 멤버이자 MISAMO의 일원입니다. 11살부터 배운 발레를 바탕으로 우아한 무대 매너를 보여줘 ‘블랙 스완’이라 불립니다. 차분하고 우아하면서도 따뜻한 분위기가 매력적이며, 2023년 MISAMO로 EP 《Masterpiece》를 발표해 섬세한 표현력을 보여주고 있습니다.' },
  dahyun: { height_cm: 165, blood_type: 'O', mbti: 'ISFJ', zodiac: 'Gemini', bio_zh: '金多贤是 TWICE 的 Rapper 与副唱成员，出道以来以满满的综艺感和"豆腐"般亲切的形象深受喜爱。她反应敏捷、口才出色，是各大综艺的常客；同时积极参与作词，并推出多首自作曲。舞台上她独特的"老鹰舞"与幽默表现力，早已成为 K-Pop 的经典名场面。', bio_en: 'Kim Da-hyun is TWICE’s rapper and sub-vocalist, loved for her variety-show instincts and soft "tofu" image. Quick-witted and eloquent, she is a frequent guest across Korean variety shows, and she actively writes lyrics and releases self-composed songs. Her playful "eagle dance" and comedic stage presence have become iconic moments in K-pop history.', bio_ja: 'キム・ダヒョンは TWICE のラッパー／ボーカルで、抜群のバラエティセンスと「豆腐」のような親しみやすいイメージが人気です。機転とトーク力に優れ、作詞や自作曲にも積極的。ステージで見せる個性的な「イーグルダンス」は今やK-POPの名物となっています。', bio_ko: '김다현은 TWICE의 래퍼이자 서브보컬로, 넘치는 예능감과 ‘두부’ 같은 친근한 이미지로 사랑받고 있습니다. 순발력과 입담이 뛰어나 각종 예능에서 활약하며 작사와 자작곡에도 적극 참여합니다. 무대 위 개성 넘치는 ‘독수리 춤’과 유머 감각은 K-POP의 명장면으로 꼽힙니다.' },
  chaeyoung: { height_cm: 159, blood_type: 'B', mbti: 'INFP', zodiac: 'Taurus', bio_zh: '孙彩瑛是 TWICE 的主 Rapper，也是组合公认的"艺术担当"。她擅长作词与绘画，从出道时期就参与歌词创作；个性鲜明的纹身与造型让她在舞台上辨识度十足。她也为多首收录曲参与作词作曲，用音乐和画面表达自己的独特色彩。', bio_en: 'Son Chae-young is TWICE’s main rapper and the group’s resident artist. A talented lyricist and painter, she has contributed to the group’s lyrics since debut, and her bold tattoos and signature styling make her instantly recognizable on stage. She also writes and composes for the group’s albums, expressing her distinct creative color through both music and visuals.', bio_ja: 'ソン・チェヨンは TWICE のメインラッパーで、グループきってのアート担当。作詞と絵を得意とし、デビュー当初から歌詞制作に参加。個性的なタトゥーとスタイリングでステージでも強い存在感を放ちます。アルバムの作詞作曲にも携わり、音楽とビジュアルの両方で自分らしさを表現しています。', bio_ko: '손채영은 TWICE의 메인 래퍼이자 그룹 대표 아트 담당입니다. 작사와 그림을 잘하며 데뷔 초부터 가사 작업에 참여했고, 개성 넘치는 타투와 스타일링으로 무대에서도 눈에 띕니다. 앨범의 작사·작곡에도 참여하며 음악과 비주얼 양쪽에서 자신만의 색을 보여주고 있습니다.' },
  tzuyu: { height_cm: 170, blood_type: 'A', mbti: 'ISFP', zodiac: 'Gemini', bio_zh: '周子瑜是 TWICE 的忙内与门面成员，来自台湾，以高挑出众的外貌和沉静温柔的性格闻名。2015 年出道时年仅 16 岁，如今已成为组合中最具国际认知度的成员之一，在海外粉丝中人气极高。2024 年发行首张个人专辑《abouTZU》，主打曲 Run Away 展现了成熟而坚定的声线。', bio_en: 'Chou Tzu-yu is TWICE’s youngest member and visual, hailing from Taiwan. Debuting at just 16 in 2015, she has grown into one of the group’s most internationally recognized faces, adored by fans around the world for her striking looks and calm, gentle personality. In 2024 she released her debut solo album abouTZU with the title track Run Away, showcasing a mature and confident vocal color.', bio_ja: '周子瑜は台湾出身の TWICE 最年少メンバーで、グループのビジュアル担当。2015年に16歳でデビューし、抜群のスタイルと穏やかな性格で世界中のファンから愛されています。2024年には初のソロアルバム『abouTZU』をリリースし、タイトル曲『Run Away』で成熟した歌声を披露しました。', bio_ko: '저우쯔위는 대만 출신 TWICE의 막내이자 비주얼 멤버입니다. 2015년 16세의 나이로 데뷔해 뛰어난 비주얼과 차분하고 부드러운 성격으로 전 세계 팬들의 사랑을 받고 있습니다. 2024년 첫 솔로 앨범 《abouTZU》를 발표하고 타이틀곡 Run Away로 성숙하고 단단해진 보컬을 보여주었습니다.' },
}

const memberPhotos: Record<string, string> = {
  nayeon: '/members/nayeon.webp',
  jeongyeon: '/members/jeongyeon.webp',
  momo: '/members/momo.webp',
  sana: '/members/sana.webp',
  jihyo: '/members/jihyo.webp',
  mina: '/members/mina.webp',
  dahyun: '/members/dahyun.webp',
  chaeyoung: '/members/chaeyoung.webp',
  tzuyu: '/members/tzuyu.webp',
}

const memberFullNames: Record<string, { zh: string; en: string; ja: string; ko: string }> = {
  nayeon: { zh: '林娜琏', en: 'Im Na-yeon', ja: 'イム・ナヨン', ko: '임나연' },
  jeongyeon: { zh: '俞定延', en: 'Yoo Jeong-yeon', ja: 'ユ・ジョンヨン', ko: '유정연' },
  momo: { zh: '平井桃', en: 'Hirai Momo', ja: '平井もも', ko: '히라이 모모' },
  sana: { zh: '凑崎纱夏', en: 'Minatozaki Sana', ja: '湊﨑紗夏', ko: '미나토자키 사나' },
  jihyo: { zh: '朴志效', en: 'Park Ji-hyo', ja: 'パク・ジヒョ', ko: '박지효' },
  mina: { zh: '名井南', en: 'Myoui Mina', ja: '名井南', ko: '묘이 미나' },
  dahyun: { zh: '金多贤', en: 'Kim Da-hyun', ja: 'キム・ダヒョン', ko: '김다현' },
  chaeyoung: { zh: '孙彩瑛', en: 'Son Chae-young', ja: 'ソン・チェヨン', ko: '손채영' },
  tzuyu: { zh: '周子瑜', en: 'Chou Tzu-yu', ja: '周子瑜', ko: '저우쯔위' },
}

const initFilename = fileURLToPath(import.meta.url)
const initDirname = path.dirname(initFilename)

const backendRoot = path.resolve(initDirname, '../..')
const albumCoverExtensions = ['.webp', '.jpg', '.png', '.avif']
const staticPrefix = (process.env.STATIC_PREFIX || '/static').replace(/\/$/, '')
const r2PublicBaseUrl = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/+$/, '')

function safeAlbumCoverName(albumId: string) {
  return albumId.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
}

function albumCoverCdnUrl(albumId: string) {
  if (!r2PublicBaseUrl) return null
  return `${r2PublicBaseUrl}/album-covers/${safeAlbumCoverName(albumId)}.jpg`
}

function remoteCoverUrl(value: unknown) {
  return typeof value === 'string' && /^https?:\/\//i.test(value) ? value : null
}

function albumCoverLocalPath(albumId: string) {
  const baseName = safeAlbumCoverName(albumId)
  for (const extension of albumCoverExtensions) {
    const absolutePath = path.join(backendRoot, 'public', 'albums', `${baseName}${extension}`)
    if (fs.existsSync(absolutePath)) return `${staticPrefix}/albums/${baseName}${extension}`
  }
  return null
}

function readSchema() {
  const candidates = [
    path.resolve(initDirname, 'schema.sql'),
    path.resolve(initDirname, '../../src/db/schema.sql'),
  ]
  const schemaPath = candidates.find((candidate) => fs.existsSync(candidate))
  if (!schemaPath) throw new Error('schema.sql not found')

  return fs.readFileSync(schemaPath, 'utf8')
}

function nullable(value: unknown) {
  return value === undefined ? null : value
}

export function initializeDatabase() {
  const db = getDatabase()
  db.exec(readSchema())

  const seed = db.transaction(() => {
    db.prepare('DELETE FROM music_cache').run()
    db.prepare('DELETE FROM member_stories').run()
    db.prepare('DELETE FROM covers').run()
    db.prepare('DELETE FROM cfs').run()
    db.prepare('DELETE FROM tracks').run()
    db.prepare('DELETE FROM albums').run()
    db.prepare('DELETE FROM members').run()

    const insertAlbum = db.prepare(`
      INSERT INTO albums (
        id, type, language, release_date, cover_local, cover_remote, cover_thumb_local,
        yt_video_id, bili_bvid, bili_page,
        name_zh, name_en, name_ja, name_ko, name_romanized,
        desc_zh, desc_en, desc_ja, desc_ko
      )
      VALUES (
        @id, @type, @language, @release_date, @cover_local, @cover_remote, @cover_thumb_local,
        @yt_video_id, @bili_bvid, @bili_page,
        @name_zh, @name_en, @name_ja, @name_ko, @name_romanized,
        @desc_zh, @desc_en, @desc_ja, @desc_ko
      )
    `)

    for (const album of catalogAlbums) {
      insertAlbum.run({
        yt_video_id: null,
        bili_bvid: null,
        bili_page: 1,
        ...album,
        cover_local: albumCoverCdnUrl(album.id) ?? albumCoverLocalPath(album.id) ?? album.cover_local ?? null,
        cover_remote: remoteCoverUrl(album.cover_local),
        cover_thumb_local: null,
      })
    }

    const insertMember = db.prepare(`
      INSERT INTO members (
        id, name_zh, name_en, name_ja, name_ko, name_romanized,
        real_name_zh, real_name_en, real_name_ja, real_name_ko,
        birthday, nationality_code, flag_emoji, position_json,
        height_cm, blood_type, mbti, zodiac, debut_date, color_hex,
        photo_local, photo_thumb_local, bio_zh, bio_en, bio_ja, bio_ko,
        instagram_handle, instagram_url
      )
      VALUES (
        @id, @name_zh, @name_en, @name_ja, @name_ko, @name_romanized,
        @real_name_zh, @real_name_en, @real_name_ja, @real_name_ko,
        @birthday, @nationality_code, @flag_emoji, @position_json,
        @height_cm, @blood_type, @mbti, @zodiac, @debut_date, @color_hex,
        @photo_local, @photo_thumb_local, @bio_zh, @bio_en, @bio_ja, @bio_ko,
        @instagram_handle, @instagram_url
      )
    `)

    for (const [id, nameZh, nameEn, nameJa, nameKo, realName, birthday, nationality, flag, color, position] of members) {
      insertMember.run({
        id,
        name_zh: nameZh,
        name_en: nameEn,
        name_ja: nameJa,
        name_ko: nameKo,
        name_romanized: nameEn,
        real_name_zh: memberFullNames[id]?.zh ?? realName,
        real_name_en: memberFullNames[id]?.en ?? realName,
        real_name_ja: memberFullNames[id]?.ja ?? realName,
        real_name_ko: memberFullNames[id]?.ko ?? realName,
        birthday,
        nationality_code: nationality,
        flag_emoji: flag,
        position_json: JSON.stringify(position.split(' / ')),
        height_cm: memberFacts[id]?.height_cm ?? null,
        blood_type: memberFacts[id]?.blood_type ?? null,
        mbti: memberFacts[id]?.mbti ?? null,
        zodiac: memberFacts[id]?.zodiac ?? null,
        debut_date: '2015-10-20',
        color_hex: color,
        photo_local: memberPhotos[id] ?? null,
        photo_thumb_local: memberPhotos[id] ?? null,
        bio_zh: memberFacts[id]?.bio_zh ?? `${nameZh} 是 TWICE 成员，参与组合、舞台和多种企划活动。`,
        bio_en: memberFacts[id]?.bio_en ?? `${nameEn} is a TWICE member featured across group releases, stages and projects.`,
        bio_ja: memberFacts[id]?.bio_ja ?? `${nameJa} は TWICE のメンバーです。`,
        bio_ko: memberFacts[id]?.bio_ko ?? `${nameKo}은 TWICE 멤버입니다.`,
        instagram_handle: null,
        instagram_url: null,
      })
    }

    const insertTrack = db.prepare(`
      INSERT INTO tracks (
        id, album_id, track_no, duration_sec, is_title, category, member_ids_json,
        language, composer, lyricist, arranger, yt_video_id, bili_bvid, bili_page,
        spotify_track_id, apple_music_id, apple_music_country,
        music_square_query, music_square_preferred, netease_song_id, qq_song_mid,
        kuwo_rid, joox_song_mid, joox_song_id, music_source_order_json,
        title_zh, title_en, title_ja, title_ko, title_romanized,
        note_zh, note_en, note_ja, note_ko
      )
      VALUES (
        @id, @album_id, @track_no, @duration_sec, @is_title, @category, @member_ids_json,
        @language, @composer, @lyricist, @arranger, @yt_video_id, @bili_bvid, @bili_page,
        @spotify_track_id, @apple_music_id, @apple_music_country,
        @music_square_query, @music_square_preferred, @netease_song_id, @qq_song_mid,
        @kuwo_rid, @joox_song_mid, @joox_song_id, @music_source_order_json,
        @title_zh, @title_en, @title_ja, @title_ko, @title_romanized,
        @note_zh, @note_en, @note_ja, @note_ko
      )
    `)

    for (const track of catalogTracks) {
      const normalizedTrack = withInferredMemberCredits(track)
      insertTrack.run({
        album_id: null,
        track_no: null,
        duration_sec: null,
        member_ids_json: null,
        language: null,
        composer: null,
        lyricist: null,
        arranger: null,
        yt_video_id: null,
        bili_bvid: null,
        bili_page: 1,
        spotify_track_id: null,
        apple_music_id: null,
        apple_music_country: null,
        music_square_query: null,
        music_square_preferred: 'qq',
        netease_song_id: null,
        qq_song_mid: null,
        kuwo_rid: null,
        joox_song_mid: null,
        joox_song_id: null,
        music_source_order_json: JSON.stringify(['qq', 'netease', 'kuwo', 'joox']),
        title_ja: null,
        title_ko: null,
        title_romanized: null,
        note_zh: null,
        note_en: null,
        note_ja: null,
        note_ko: null,
        ...Object.fromEntries(Object.entries(normalizedTrack).map(([key, value]) => [key, nullable(value)])),
        is_title: titleFlag(normalizedTrack),
      })
    }

    const insertCf = db.prepare(`
      INSERT INTO cfs (
        id, brand, brand_logo_local, year, country, member_ids_json,
        song_title_zh, song_title_en, song_title_ja, song_title_ko, song_title_romanized,
        desc_zh, desc_en, desc_ja, desc_ko, yt_video_id, bili_bvid, bili_page, thumb_local
      )
      VALUES (
        @id, @brand, @brand_logo_local, @year, @country, @member_ids_json,
        @song_title_zh, @song_title_en, @song_title_ja, @song_title_ko, @song_title_romanized,
        @desc_zh, @desc_en, @desc_ja, @desc_ko, @yt_video_id, @bili_bvid, @bili_page, @thumb_local
      )
    `)

    for (const cf of cfs) {
      insertCf.run({
        brand_logo_local: null,
        member_ids_json: null,
        song_title_romanized: cf.song_title_en,
        desc_ja: cf.desc_en,
        desc_ko: cf.desc_en,
        yt_video_id: null,
        bili_bvid: null,
        bili_page: 1,
        thumb_local: null,
        ...cf,
      })
    }

    const insertCover = db.prepare(`
      INSERT INTO covers (
        id, performed_at, is_predebut, original_artist, original_song,
        performer_member_ids_json, year, language, yt_video_id, bili_bvid,
        bili_page, thumb_local, note_zh, note_en, note_ja, note_ko
      )
      VALUES (
        @id, @performed_at, @is_predebut, @original_artist, @original_song,
        @performer_member_ids_json, @year, @language, @yt_video_id, @bili_bvid,
        @bili_page, @thumb_local, @note_zh, @note_en, @note_ja, @note_ko
      )
    `)

    for (const cover of covers) {
      insertCover.run({
        yt_video_id: null,
        bili_bvid: null,
        bili_page: 1,
        thumb_local: null,
        note_ja: cover.note_en,
        note_ko: cover.note_en,
        ...cover,
      })
    }
  })

  seed()

  return {
    albums: catalogAlbums.length,
    tracks: catalogTracks.length,
    members: members.length,
    cfs: cfs.length,
    covers: covers.length,
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = initializeDatabase()
  closeDatabase()
  console.log(`Seeded TWICE catalog: ${JSON.stringify(result)}`)
}










