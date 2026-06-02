# Cloudflare R2 音乐缓存配置教程

> 只缓存你有权分发的音频。音乐站搜索页 `/api/music/*` 不会写入 R2；只有站内曲库播放接口 `/api/tracks/:id/playback` 会参与缓存。

## 1. Cloudflare 控制台配置

1. 进入 Cloudflare Dashboard → R2 → Create bucket，创建 bucket，例如 `twice-music-assets`。
2. 进入 bucket → Settings → Public access，绑定自定义域名，例如 `cdn2.479842598.xyz`。
3. 进入 R2 → Manage R2 API Tokens，创建可读写该 bucket 的 token。
4. 记录这些值，发给后端配置使用：
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET`
   - `R2_PUBLIC_BASE_URL`

## 2. R2 CORS 配置

在 bucket 的 CORS 配置里允许站点读取音频，并允许浏览器 Range 播放：

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5173",
      "https://你的前端域名"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range", "Content-Type"],
    "ExposeHeaders": ["Accept-Ranges", "Content-Length", "Content-Range", "Content-Type", "ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## 3. 后端 `.env` 示例

```env
MUSIC_R2_CACHE_ENABLED=true
MUSIC_R2_CACHE_MISS_MODE=background
MUSIC_R2_MIN_AUDIO_BYTES=16384
MUSIC_R2_MAX_BYTES=9126805504

R2_ACCOUNT_ID=你的账号ID
R2_ACCESS_KEY_ID=你的AccessKey
R2_SECRET_ACCESS_KEY=你的SecretKey
R2_BUCKET=twice-music-assets
R2_PUBLIC_BASE_URL=https://cdn2.479842598.xyz
```

说明：

- `MUSIC_R2_CACHE_MISS_MODE=background`：首次播放先返回上游音源，后台上传 R2，下次播放走 R2。
- `MUSIC_R2_CACHE_MISS_MODE=blocking`：首次播放等待上传成功后直接返回 R2，体验会慢一些。
- `MUSIC_R2_MAX_BYTES=9126805504`：默认 8.5GB 上限，超过后不会继续上传，播放仍回退上游。

## 4. 启动和预热

开发环境：

```bash
pnpm dev:backend
pnpm dev:frontend
```

批量预热站内曲库：

```bash
pnpm music:warm-r2 -- --concurrency=2
```

只测试前 5 首：

```bash
pnpm music:warm-r2 -- --limit=5 --concurrency=1
```

## 5. 验收

1. 打开站内歌曲列表，播放一首曲库里的歌。
2. 首次播放可能仍是上游 URL。
3. 等后台上传完成后再次播放，接口 `audioUrl` 应变为 `R2_PUBLIC_BASE_URL` 开头。
4. 打开浏览器 Network，确认音频域名是 `cdn2.479842598.xyz`。
5. 打开音乐站搜索页播放任意搜索结果，确认不会写入 R2。


## 5. 专辑封面 CDN

专辑封面也可以复用同一组 R2 配置上传到 CDN。脚本会优先读取 `backend/public/albums` 中已经下载的封面；如果本地没有，会使用种子数据里的 Apple 原图下载后上传。

```bash
pnpm --filter backend covers:r2

# 只预览将要写入的 CDN 链接，不上传也不更新数据库
pnpm --filter backend covers:r2 -- --dry-run

# 强制重新上传并覆盖数据库链接
pnpm --filter backend covers:r2 -- --force
```

上传成功后，数据库 `albums.cover_local` 会变成 `R2_PUBLIC_BASE_URL/album-covers/<album-id>.jpg`。接口仍会返回 `coverRemote` 原始 Apple 图片，前端的 `FallbackImage` 会在 CDN 加载失败时自动回退。
