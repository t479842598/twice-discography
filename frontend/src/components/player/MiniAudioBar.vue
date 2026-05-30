<template>
  <div v-if="audioStore.currentTrack" class="mini-audio">
    <div>
      <strong>{{ pickText(audioStore.currentTrack.title, localeStore.locale) }}</strong>
      <span>{{ audioStore.selected?.sourceName || '准备播放' }} · {{ audioStore.selected?.quality.label || '解析中' }}</span>
    </div>
    <audio
      ref="audioRef"
      :src="audioStore.audioUrl"
      controls
      preload="auto"
      @play="audioStore.setPlaying(true)"
      @pause="audioStore.setPlaying(false)"
      @ended="audioStore.setPlaying(false)"
      @error="audioStore.handleAudioError()"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAudioStore } from '@/stores/audio'
import { useLocaleStore } from '@/stores/locale'
import { pickText } from '@/utils/text'

const audioStore = useAudioStore()
const localeStore = useLocaleStore()
const audioRef = ref<HTMLAudioElement | null>(null)

watch(() => audioStore.audioUrl, async () => {
  if (!audioRef.value || !audioStore.playing) return
  try {
    await audioRef.value.play()
  } catch {
    audioStore.setPlaying(false)
  }
})
</script>
