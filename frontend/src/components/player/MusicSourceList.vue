<template>
  <n-list bordered class="source-list">
    <n-list-item v-for="candidate in candidates" :key="`${candidate.source}-${candidate.providerId}`">
      <div class="source-row">
        <div class="source-info">
          <strong>{{ candidate.sourceName }}</strong>
          <p>{{ candidate.title }} · {{ candidate.artist }}</p>
        </div>
        <div class="source-tags">
          <div class="source-quality-tags">
            <n-tag size="small" :type="candidate.quality.lossless ? 'success' : 'info'" :bordered="false">
              {{ candidate.quality.label }}
            </n-tag>
            <n-tag v-if="candidate.recommended" size="small" type="error" :bordered="false">{{ t('source.recommended') }}</n-tag>
            <n-tag v-if="candidate.hasLyrics" size="small" :bordered="false">{{ t('source.lyrics') }}</n-tag>
            <n-tag v-if="!candidate.playable" size="small" type="warning">{{ t('source.unavailable') }}</n-tag>
            <n-tag v-if="failedSources.includes(candidate.source)" size="small" type="error">{{ t('source.failed') }}</n-tag>
          </div>
          <n-button
            size="small"
            :type="candidate.selected ? 'primary' : 'default'"
            :disabled="!candidate.playable"
            class="source-action-button"
            @click="$emit('select', candidate.source)"
          >
            {{ candidate.selected ? t('source.current') : t('source.switch') }}
          </n-button>
        </div>
      </div>
    </n-list-item>
  </n-list>
</template>

<script setup lang="ts">
import type { MusicCandidate } from '@/api/types'
import { useI18n } from '@/i18n'

const { t } = useI18n()

defineProps<{
  candidates: MusicCandidate[]
  failedSources: string[]
}>()

defineEmits<{ select: [source: string] }>()
</script>

<style scoped>
.source-info {
  min-width: 0;
  flex: 1;
}

.source-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.source-quality-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.source-action-button {
  flex-shrink: 0;
  min-width: 56px;
}

@media (max-width: 640px) {
  .source-tags {
    width: 100%;
    justify-content: space-between;
  }

  .source-quality-tags {
    flex: 1;
  }

  .source-action-button {
    margin-left: auto;
  }
}
</style>
