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

const memberFacts: Record<string, { height_cm: number; blood_type: string; mbti: string; zodiac: string; bio_zh: string; bio_en: string; bio_ja: string; bio_ko: string }> = {
  nayeon: { height_cm: 163, blood_type: 'A', mbti: 'ISTP', zodiac: 'Virgo', bio_zh: '娜琏是 TWICE 大姐与主唱线成员，音色明亮，代表 Solo 作品包括 POP! 与 ABCD。', bio_en: 'Nayeon is TWICE’s eldest member and a lead vocal color, with solo releases including POP! and ABCD.', bio_ja: 'ナヨンは TWICE の最年長メンバーで、明るいボーカルカラーが魅力です。', bio_ko: '나연은 TWICE의 맏언니이자 밝은 보컬 컬러를 가진 멤버입니다.' },
  jeongyeon: { height_cm: 167, blood_type: 'O', mbti: 'ISFJ', zodiac: 'Scorpio', bio_zh: '定延是 TWICE 主唱成员，声音稳健清澈，在团体抒情曲和副歌段落中很有辨识度。', bio_en: 'Jeongyeon is a TWICE vocalist known for a steady, clear tone across group songs.', bio_ja: 'ジョンヨンは安定した澄んだ声が特徴の TWICE ボーカルです。', bio_ko: '정연은 안정적이고 맑은 음색이 돋보이는 TWICE 보컬 멤버입니다.' },
  momo: { height_cm: 167, blood_type: 'A', mbti: 'INFP', zodiac: 'Scorpio', bio_zh: '桃是 TWICE 主舞，属于 MISAMO 成员，舞蹈表现力和节奏控制是组合核心看点。', bio_en: 'Momo is TWICE’s main dancer and a MISAMO member, known for powerful performance control.', bio_ja: 'モモは TWICE のメインダンサーで MISAMO のメンバーです。', bio_ko: '모모는 TWICE의 메인 댄서이자 MISAMO 멤버입니다.' },
  sana: { height_cm: 164, blood_type: 'B', mbti: 'ENFP', zodiac: 'Capricorn', bio_zh: '纱夏是 TWICE 日本成员与 MISAMO 成员，舞台表情、甜美声线和综艺感突出。', bio_en: 'Sana is a Japanese TWICE and MISAMO member known for expressive stages and a sweet vocal tone.', bio_ja: 'サナは TWICE と MISAMO のメンバーで、表情豊かなステージが魅力です。', bio_ko: '사나는 TWICE와 MISAMO의 멤버로 풍부한 표정과 달콤한 음색이 매력입니다.' },
  jihyo: { height_cm: 160, blood_type: 'O', mbti: 'ESFP', zodiac: 'Aquarius', bio_zh: '志效是 TWICE 队长和主唱，拥有强劲现场唱功，Solo 专辑 ZONE 展示了个人音乐色彩。', bio_en: 'Jihyo is TWICE’s leader and main vocalist; her solo work ZONE highlights her own musical color.', bio_ja: 'ジヒョは TWICE のリーダー兼メインボーカルです。', bio_ko: '지효는 TWICE의 리더이자 메인 보컬이며 솔로 ZONE을 발표했습니다.' },
  mina: { height_cm: 163, blood_type: 'A', mbti: 'ISFP', zodiac: 'Aries', bio_zh: '名井南是 TWICE 日本成员与 MISAMO 成员，芭蕾基础让她的舞台线条优雅细腻。', bio_en: 'Mina is a Japanese TWICE and MISAMO member whose ballet background shapes an elegant stage style.', bio_ja: 'ミナは TWICE と MISAMO のメンバーで、バレエ経験を活かした優雅な表現が魅力です。', bio_ko: '미나는 TWICE와 MISAMO의 멤버로 우아한 퍼포먼스가 돋보입니다.' },
  dahyun: { height_cm: 165, blood_type: 'O', mbti: 'ISFJ', zodiac: 'Gemini', bio_zh: '多贤是 TWICE Rapper 与副唱成员，舞台亲和力、综艺感和创作参与度都很高。', bio_en: 'Dahyun is a TWICE rapper and vocalist known for bright variety presence and songwriting participation.', bio_ja: 'ダヒョンは TWICE のラッパー／ボーカルで、明るい存在感が特徴です。', bio_ko: '다현은 TWICE의 래퍼이자 보컬로 밝은 에너지와 작사 참여가 돋보입니다.' },
  chaeyoung: { height_cm: 159, blood_type: 'B', mbti: 'INFP', zodiac: 'Taurus', bio_zh: '彩瑛是 TWICE 主 Rapper，兼具作词、绘画和造型表达，个人风格鲜明。', bio_en: 'Chaeyoung is TWICE’s main rapper with a distinct creative voice in lyrics, art and styling.', bio_ja: 'チェヨンは TWICE のメインラッパーで、創作面でも個性を発揮します。', bio_ko: '채영은 TWICE의 메인 래퍼로 작사와 아트워크에서도 개성이 뚜렷합니다.' },
  tzuyu: { height_cm: 170, blood_type: 'A', mbti: 'ISFP', zodiac: 'Gemini', bio_zh: '子瑜是 TWICE 忙内与门面成员，来自台湾，Solo 作品 abouTZU 展现了成熟声线。', bio_en: 'Tzuyu is TWICE’s youngest member and visual from Taiwan; abouTZU presents a mature solo tone.', bio_ja: 'ツウィは台湾出身の TWICE 最年少メンバーで、abouTZU でソロの魅力を見せました。', bio_ko: '쯔위는 대만 출신 TWICE 막내이자 비주얼 멤버이며 abouTZU를 발표했습니다.' },
}

const memberPhotos: Record<string, string> = {
  nayeon: 'https://www.twicejapan.com/static/twice/cmn/artist/202507/ph_01nayeon_7815696ecbf1c96e6894b779456d330e.jpg',
  jeongyeon: 'https://www.twicejapan.com/static/twice/cmn/artist/202507/ph_02jeongyeon_7815696ecbf1c96e6894b779456d330e.jpg',
  momo: 'https://www.twicejapan.com/static/twice/cmn/artist/202507/ph_03momo_7815696ecbf1c96e6894b779456d330e.jpg',
  sana: 'https://www.twicejapan.com/static/twice/cmn/artist/202507/ph_04sana_7815696ecbf1c96e6894b779456d330e.jpg',
  jihyo: 'https://www.twicejapan.com/static/twice/cmn/artist/202507/ph_05jihyo_7815696ecbf1c96e6894b779456d330e.jpg',
  mina: 'https://www.twicejapan.com/static/twice/cmn/artist/202507/ph_06mina_7815696ecbf1c96e6894b779456d330e.jpg',
  dahyun: 'https://www.twicejapan.com/static/twice/cmn/artist/202507/ph_07dahyun_7815696ecbf1c96e6894b779456d330e.jpg',
  chaeyoung: 'https://www.twicejapan.com/static/twice/cmn/artist/202507/ph_08chaeyoung_7815696ecbf1c96e6894b779456d330e.jpg',
  tzuyu: 'https://www.twicejapan.com/static/twice/cmn/artist/202507/ph_09tzuyu_7815696ecbf1c96e6894b779456d330e.jpg',
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function readSchema() {
  const candidates = [
    path.resolve(__dirname, 'schema.sql'),
    path.resolve(__dirname, '../../src/db/schema.sql'),
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
    db.prepare('DELETE FROM member_stories').run()
    db.prepare('DELETE FROM covers').run()
    db.prepare('DELETE FROM cfs').run()
    db.prepare('DELETE FROM tracks').run()
    db.prepare('DELETE FROM albums').run()
    db.prepare('DELETE FROM members').run()

    const insertAlbum = db.prepare(`
      INSERT INTO albums (
        id, type, language, release_date, cover_local, cover_thumb_local,
        yt_video_id, bili_bvid, bili_page,
        name_zh, name_en, name_ja, name_ko, name_romanized,
        desc_zh, desc_en, desc_ja, desc_ko
      )
      VALUES (
        @id, @type, @language, @release_date, @cover_local, @cover_thumb_local,
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
        cover_local: album.cover_local ?? null,
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
        real_name_zh: realName,
        real_name_en: realName,
        real_name_ja: realName,
        real_name_ko: realName,
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
        bio_zh: `${nameZh} 是 TWICE 成员，参与组合、舞台和多种企划活动。`,
        bio_en: `${nameEn} is a TWICE member featured across group releases, stages and projects.`,
        bio_ja: `${nameJa} は TWICE のメンバーです。`,
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
        ...Object.fromEntries(Object.entries(track).map(([key, value]) => [key, nullable(value)])),
        is_title: titleFlag(track),
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










