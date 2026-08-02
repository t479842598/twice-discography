<template>
  <main class="page home-page home-skeleton" role="status" :aria-label="t('home.loading')" aria-busy="true">
    <!-- 精选 MV 轮播占位 -->
    <div class="home-skel-hero">
      <div class="home-skel-hero-shade" />
      <div class="home-skel-hero-content">
        <div class="home-skel-logo" />
        <div class="home-skel-line home-skel-hero-title" />
        <div class="home-skel-line home-skel-hero-sub" />
        <div class="home-skel-hero-actions">
          <div class="home-skel-pill" />
          <div class="home-skel-pill" />
        </div>
      </div>
    </div>

    <!-- 统计数字占位 -->
    <div class="home-skel-stats">
      <div v-for="i in 7" :key="i" class="home-skel-stat" />
    </div>

    <!-- 年份时间线占位 -->
    <section class="section" aria-hidden="true">
      <div class="home-skel-heading">
        <span class="home-skel-line home-skel-heading-line" />
      </div>
      <div class="home-skel-years">
        <div v-for="i in 3" :key="i" class="home-skel-year">
          <span class="home-skel-line home-skel-year-year" />
          <div class="home-skel-card">
            <span class="home-skel-line home-skel-line-md" />
            <span class="home-skel-line home-skel-line-sm" />
          </div>
        </div>
      </div>
    </section>

    <!-- 代表专辑占位 -->
    <section class="section" aria-hidden="true">
      <div class="home-skel-heading">
        <span class="home-skel-line home-skel-heading-line" />
      </div>
      <div class="home-skel-albums">
        <div v-for="i in 5" :key="i" class="home-skel-album">
          <div class="home-skel-album-cover" />
          <span class="home-skel-line home-skel-line-sm" />
          <span class="home-skel-line home-skel-line-xs" />
        </div>
      </div>
    </section>

    <!-- 热门曲目占位 -->
    <section class="section" aria-hidden="true">
      <div class="home-skel-heading">
        <span class="home-skel-line home-skel-heading-line" />
      </div>
      <div class="home-skel-tracks">
        <div v-for="i in 5" :key="i" class="home-skel-track">
          <div class="home-skel-track-play" />
          <div class="home-skel-track-text">
            <span class="home-skel-line home-skel-line-md" />
            <span class="home-skel-line home-skel-line-xs" />
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { useI18n } from '@/i18n'

const { t } = useI18n()
</script>

<style scoped>
.home-skel-line {
  display: block;
  border-radius: 8px;
  background:
    linear-gradient(
      100deg,
      color-mix(in srgb, var(--accent) 12%, transparent) 40%,
      color-mix(in srgb, var(--accent) 22%, transparent) 50%,
      color-mix(in srgb, var(--accent) 12%, transparent) 60%
    );
  background-size: 200% 100%;
  animation: homeSkelShimmer 1.4s ease-in-out infinite;
}

.home-skel-hero {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--soft-border);
  border-radius: 24px;
  aspect-ratio: 16 / 7;
  background: var(--panel-bg);
  box-shadow: var(--shadow-soft);
}

.home-skel-hero-shade {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 18% 12%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 42%),
    linear-gradient(135deg, color-mix(in srgb, var(--accent-light) 26%, transparent), color-mix(in srgb, var(--accent) 10%, transparent));
  animation: homeSkelShimmer 1.4s ease-in-out infinite;
  background-size: 200% 100%;
}

.home-skel-hero-content {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: flex-start;
  justify-content: center;
  height: 100%;
  padding: 24px clamp(20px, 6vw, 56px);
}

.home-skel-logo {
  width: 118px;
  height: 118px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent) 20%, transparent);
}

.home-skel-hero-title {
  width: min(420px, 70%);
  height: 34px;
  border-radius: 10px;
}

.home-skel-hero-sub {
  width: min(240px, 40%);
  height: 16px;
}

.home-skel-hero-actions {
  display: flex;
  gap: 12px;
  margin-top: 10px;
}

.home-skel-pill {
  width: 132px;
  height: 44px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 26%, transparent);
  animation: homeSkelShimmer 1.4s ease-in-out infinite;
  background-size: 200% 100%;
}

.home-skel-stats {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 12px;
  margin-top: 20px;
}

.home-skel-stat {
  height: 76px;
  border: 1px solid var(--soft-border);
  border-radius: 18px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  animation: homeSkelShimmer 1.4s ease-in-out infinite;
  background-size: 200% 100%;
}

.section {
  margin-top: 34px;
}

.home-skel-heading {
  margin-bottom: 16px;
}

.home-skel-heading-line {
  width: 170px;
  height: 26px;
  border-radius: 8px;
}

.home-skel-years {
  display: grid;
  gap: 18px;
  padding: 4px 0 4px 34px;
}

.home-skel-year {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  gap: 16px;
  align-items: center;
}

.home-skel-year-year {
  width: 64px;
  height: 22px;
}

.home-skel-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 20px;
  border: 1px solid var(--soft-border);
  border-radius: 18px;
  background: var(--panel-bg);
}

.home-skel-line-md { height: 16px; width: 100%; }
.home-skel-line-sm { height: 13px; width: 58%; }
.home-skel-line-xs { height: 12px; width: 42%; }

.home-skel-albums {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 16px;
}

.home-skel-album {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--soft-border);
  border-radius: 18px;
  background: var(--panel-bg);
}

.home-skel-album-cover {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 14px;
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  animation: homeSkelShimmer 1.4s ease-in-out infinite;
  background-size: 200% 100%;
}

.home-skel-tracks {
  display: grid;
  gap: 10px;
}

.home-skel-track {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 12px 16px;
  border: 1px solid var(--soft-border);
  border-radius: 16px;
  background: var(--panel-bg);
}

.home-skel-track-play {
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent) 24%, transparent);
  animation: homeSkelShimmer 1.4s ease-in-out infinite;
  background-size: 200% 100%;
}

.home-skel-track-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
}

@keyframes homeSkelShimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (max-width: 980px) {
  .home-skel-stats {
    grid-template-columns: repeat(4, 1fr);
  }
  .home-skel-logo {
    width: 88px;
    height: 88px;
  }
  .home-skel-hero-title {
    height: 26px;
  }
  .home-skel-year {
    grid-template-columns: 92px minmax(0, 1fr);
  }
}

@media (max-width: 560px) {
  .home-skel-stats {
    grid-template-columns: repeat(2, 1fr);
  }
  .home-skel-logo {
    width: 64px;
    height: 64px;
  }
  .home-skel-hero {
    aspect-ratio: 4 / 3;
  }
  .home-skel-albums {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
}

/* 全局 reduced-motion 规则已收敛动画时长（UX-03），此处无需额外处理 */
</style>
