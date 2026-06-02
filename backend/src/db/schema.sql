-- TWICE Discography SQLite schema

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS albums (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  language TEXT NOT NULL,
  release_date TEXT NOT NULL,
  cover_local TEXT,
  cover_remote TEXT,
  cover_thumb_local TEXT,
  yt_video_id TEXT,
  bili_bvid TEXT,
  bili_page INTEGER DEFAULT 1,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_ja TEXT,
  name_ko TEXT,
  name_romanized TEXT,
  desc_zh TEXT,
  desc_en TEXT,
  desc_ja TEXT,
  desc_ko TEXT
);

CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  album_id TEXT REFERENCES albums(id) ON DELETE SET NULL,
  track_no INTEGER,
  duration_sec INTEGER,
  is_title INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL,
  member_ids_json TEXT,
  language TEXT,
  composer TEXT,
  lyricist TEXT,
  arranger TEXT,
  yt_video_id TEXT,
  bili_bvid TEXT,
  bili_page INTEGER DEFAULT 1,
  spotify_track_id TEXT,
  apple_music_id TEXT,
  apple_music_country TEXT,
  music_square_query TEXT,
  music_square_preferred TEXT,
  netease_song_id TEXT,
  qq_song_mid TEXT,
  kuwo_rid TEXT,
  joox_song_mid TEXT,
  joox_song_id TEXT,
  music_source_order_json TEXT,
  title_zh TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_ja TEXT,
  title_ko TEXT,
  title_romanized TEXT,
  note_zh TEXT,
  note_en TEXT,
  note_ja TEXT,
  note_ko TEXT
);

CREATE TABLE IF NOT EXISTS music_cache (
  cache_key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_music_cache_expires_at ON music_cache (expires_at);

CREATE TABLE IF NOT EXISTS music_assets (
  id TEXT PRIMARY KEY,
  track_id TEXT,
  source TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  quality_tag TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  public_url TEXT NOT NULL,
  status TEXT NOT NULL,
  etag TEXT,
  content_type TEXT,
  size_bytes INTEGER,
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_music_assets_identity ON music_assets (source, provider_id, quality_tag);
CREATE INDEX IF NOT EXISTS idx_music_assets_track_status ON music_assets (track_id, status);
CREATE INDEX IF NOT EXISTS idx_music_assets_status ON music_assets (status);

CREATE TABLE IF NOT EXISTS music_lyrics (
  id TEXT PRIMARY KEY,
  track_id TEXT,
  source TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  lrc TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_music_lyrics_identity ON music_lyrics (source, provider_id);
CREATE INDEX IF NOT EXISTS idx_music_lyrics_track_source ON music_lyrics (track_id, source);


CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_roles (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_user_roles (
  user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions (expires_at);

CREATE TABLE IF NOT EXISTS bili_credentials (
  id TEXT PRIMARY KEY,
  encrypted_cookie TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  last_verified_at INTEGER,
  last_verify_status TEXT,
  last_verify_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS mv_configs (
  track_id TEXT PRIMARY KEY,
  bili_bvid TEXT,
  bili_page INTEGER NOT NULL DEFAULT 1,
  cover_url TEXT,
  aspect_ratio TEXT NOT NULL DEFAULT '16 / 9',
  is_home_featured INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mv_configs_enabled_home ON mv_configs (enabled, is_home_featured, sort_order);
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_ja TEXT,
  name_ko TEXT,
  name_romanized TEXT,
  real_name_zh TEXT,
  real_name_en TEXT,
  real_name_ja TEXT,
  real_name_ko TEXT,
  birthday TEXT,
  nationality_code TEXT NOT NULL,
  flag_emoji TEXT NOT NULL,
  position_json TEXT,
  height_cm INTEGER,
  blood_type TEXT,
  mbti TEXT,
  zodiac TEXT,
  debut_date TEXT,
  color_hex TEXT,
  photo_local TEXT,
  photo_thumb_local TEXT,
  bio_zh TEXT,
  bio_en TEXT,
  bio_ja TEXT,
  bio_ko TEXT,
  instagram_handle TEXT,
  instagram_url TEXT
);

CREATE TABLE IF NOT EXISTS member_stories (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  order_no INTEGER NOT NULL,
  category TEXT NOT NULL,
  year INTEGER,
  title_zh TEXT NOT NULL,
  title_en TEXT,
  title_ja TEXT,
  title_ko TEXT,
  content_zh TEXT NOT NULL,
  content_en TEXT,
  content_ja TEXT,
  content_ko TEXT,
  source_url TEXT
);

CREATE TABLE IF NOT EXISTS cfs (
  id TEXT PRIMARY KEY,
  brand TEXT NOT NULL,
  brand_logo_local TEXT,
  year INTEGER,
  country TEXT,
  member_ids_json TEXT,
  song_title_zh TEXT NOT NULL,
  song_title_en TEXT,
  song_title_ja TEXT,
  song_title_ko TEXT,
  song_title_romanized TEXT,
  desc_zh TEXT,
  desc_en TEXT,
  desc_ja TEXT,
  desc_ko TEXT,
  yt_video_id TEXT,
  bili_bvid TEXT,
  bili_page INTEGER DEFAULT 1,
  thumb_local TEXT
);

CREATE TABLE IF NOT EXISTS covers (
  id TEXT PRIMARY KEY,
  performed_at TEXT NOT NULL,
  is_predebut INTEGER NOT NULL DEFAULT 0,
  original_artist TEXT,
  original_song TEXT NOT NULL,
  performer_member_ids_json TEXT,
  year INTEGER,
  language TEXT,
  yt_video_id TEXT,
  bili_bvid TEXT,
  bili_page INTEGER DEFAULT 1,
  thumb_local TEXT,
  note_zh TEXT,
  note_en TEXT,
  note_ja TEXT,
  note_ko TEXT
);

