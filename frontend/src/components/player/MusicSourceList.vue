<template>
  <n-list bordered class="source-list">
    <n-list-item v-for="candidate in candidates" :key="`${candidate.source}-${candidate.providerId}`">
      <div class="source-row">
        <div>
          <strong>{{ candidate.sourceName }}</strong>
          <p>{{ candidate.title }} · {{ candidate.artist }}</p>
        </div>
        <div class="source-tags">
          <n-tag size="small" :type="candidate.quality.lossless ? 'success' : 'info'" :bordered="false">
            {{ candidate.quality.label }}
          </n-tag>
          <n-tag v-if="candidate.recommended" size="small" type="error" :bordered="false">推荐</n-tag>
          <n-tag v-if="candidate.hasLyrics" size="small" :bordered="false">歌词</n-tag>
          <n-tag v-if="!candidate.playable" size="small" type="warning">不可播放</n-tag>
          <n-tag v-if="failedSources.includes(candidate.source)" size="small" type="error">失败</n-tag>
          <n-button
            size="small"
            :type="candidate.selected ? 'primary' : 'default'"
            :disabled="!candidate.playable"
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
