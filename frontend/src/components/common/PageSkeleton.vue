<template>
  <main class="page page-skeleton" role="status" :aria-label="t('page.loading')" aria-busy="true">
    <!-- 页头占位 -->
    <div class="page-skel-header">
      <span class="page-skel-line page-skel-eyebrow" />
      <span class="page-skel-line page-skel-title" />
      <span class="page-skel-line page-skel-desc" />
      <span class="page-skel-line page-skel-desc-short" />
    </div>

    <!-- 卡片网格：专辑 / 成员 -->
    <template v-if="variant === 'grid'">
      <div class="page-skel-grid">
        <div v-for="i in 8" :key="i" class="page-skel-card">
          <div class="page-skel-cover" />
          <span class="page-skel-line page-skel-line-sm" />
          <span class="page-skel-line page-skel-line-xs" />
        </div>
      </div>
    </template>

    <!-- 标签页：单人 / 小分队 -->
    <template v-else-if="variant === 'tabs'">
      <div class="page-skel-tabs">
        <span class="page-skel-tab" />
        <span class="page-skel-tab" />
      </div>
      <div class="page-skel-section">
        <span class="page-skel-line page-skel-heading" />
        <div class="page-skel-grid">
          <div v-for="i in 4" :key="i" class="page-skel-card">
            <div class="page-skel-cover" />
            <span class="page-skel-line page-skel-line-sm" />
            <span class="page-skel-line page-skel-line-xs" />
          </div>
        </div>
      </div>
      <div class="page-skel-section">
        <span class="page-skel-line page-skel-heading" />
        <div class="page-skel-list">
          <div v-for="i in 4" :key="i" class="page-skel-row">
            <div class="page-skel-row-cover" />
            <div class="page-skel-row-main">
              <span class="page-skel-line page-skel-line-md" />
              <span class="page-skel-line page-skel-line-xs" />
            </div>
            <div class="page-skel-row-play" />
          </div>
        </div>
      </div>
    </template>

    <!-- 列表：广告曲 / 翻唱 -->
    <template v-else>
      <div class="page-skel-section">
        <span class="page-skel-line page-skel-heading" />
        <div class="page-skel-list">
          <div v-for="i in 5" :key="i" class="page-skel-row">
            <div class="page-skel-row-cover" />
            <div class="page-skel-row-main">
              <span class="page-skel-line page-skel-line-md" />
              <span class="page-skel-line page-skel-line-xs" />
            </div>
            <div class="page-skel-row-play" />
          </div>
        </div>
      </div>
      <div class="page-skel-section">
        <span class="page-skel-line page-skel-heading" />
        <div class="page-skel-grid">
          <div v-for="i in 3" :key="i" class="page-skel-card page-skel-card-archive">
            <span class="page-skel-line page-skel-line-sm" />
            <span class="page-skel-line page-skel-line-md" />
            <span class="page-skel-line page-skel-line-xs" />
          </div>
        </div>
      </div>
    </template>
  </main>
</template>

<script setup lang="ts">
import { useI18n } from '@/i18n'

defineProps<{
  variant?: 'grid' | 'tabs' | 'list'
}>()

const { t } = useI18n()
</script>

<style scoped>
.page-skel-line {
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
  animation: pageSkelShimmer 1.4s ease-in-out infinite;
}

.page-skel-header {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 148px;
  justify-content: flex-end;
  margin-bottom: 28px;
}

.page-skel-eyebrow {
  width: 84px;
  height: 12px;
}

.page-skel-title {
  width: min(360px, 62%);
  height: clamp(34px, 6vw, 52px);
  border-radius: 10px;
}

.page-skel-desc {
  width: min(560px, 92%);
  height: 16px;
}

.page-skel-desc-short {
  width: min(320px, 55%);
  height: 16px;
}

.page-skel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 16px;
}

.page-skel-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--soft-border);
  border-radius: 18px;
  background: var(--panel-bg);
}

.page-skel-cover {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 14px;
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  animation: pageSkelShimmer 1.4s ease-in-out infinite;
  background-size: 200% 100%;
}

.page-skel-card-archive {
  min-height: 150px;
}

.page-skel-line-sm { height: 14px; width: 62%; }
.page-skel-line-md { height: 16px; width: 100%; }
.page-skel-line-xs { height: 12px; width: 44%; }

.page-skel-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 24px;
}

.page-skel-tab {
  width: 108px;
  height: 38px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  animation: pageSkelShimmer 1.4s ease-in-out infinite;
  background-size: 200% 100%;
}

.page-skel-section {
  margin-top: 34px;
}

.page-skel-heading {
  width: 180px;
  height: 26px;
  margin-bottom: 16px;
  border-radius: 8px;
}

.page-skel-list {
  display: grid;
  gap: 10px;
}

.page-skel-row {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 12px 16px;
  border: 1px solid var(--soft-border);
  border-radius: 16px;
  background: var(--panel-bg);
}

.page-skel-row-cover {
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  animation: pageSkelShimmer 1.4s ease-in-out infinite;
  background-size: 200% 100%;
}

.page-skel-row-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 9px;
}

.page-skel-row-play {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent) 22%, transparent);
  animation: pageSkelShimmer 1.4s ease-in-out infinite;
  background-size: 200% 100%;
}

@keyframes pageSkelShimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (max-width: 560px) {
  .page-skel-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
  .page-skel-header {
    min-height: 120px;
  }
}
</style>
