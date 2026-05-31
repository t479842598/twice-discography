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
            <n-tag v-if="candidate.recommended" size="small" type="error" :bordered="false">推荐</n-tag>
            <n-tag v-if="candidate.hasLyrics" size="small" :bordered="false">歌词</n-tag>
            <n-tag v-if="!candidate.playable" size="small" type="warning">不可播放</n-tag>
            <n-tag v-if="failedSources.includes(candidate.source)" size="small" type="error">失败</n-tag>
          </div>
          <n-button
            size="small"
            :type="candidate.selected ? 'primary' : 'default'"
            :disabled="!candidate.playable"
            class="source-action-button"
            @click="$emit('select', candidate.source)"
          >
            {{ candidate.selected ? '当前' : '切换' }}
          </n-button>
        </div>
      </div>
    </n-list-item>
  </n-list>
</template>

<script setup lang="ts">
import type { MusicCandidate } from '@/api/types'

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
