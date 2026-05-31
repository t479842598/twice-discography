<template>
  <RouterLink :to="`/albums/${album.id}`" class="album-card">
    <div class="album-art" :style="album.coverLocal ? undefined : { background: gradient }">
      <img v-if="album.coverLocal" :src="album.coverLocal" :alt="`${pickText(album.title, localeStore.locale)} cover`" loading="lazy" decoding="async" />
      <span>{{ album.year }}</span>
    </div>
    <div class="album-copy">
      <n-tag size="small" :bordered="false">{{ albumTypeLabel(album.type) }}</n-tag>
      <h3>{{ pickText(album.title, localeStore.locale) }}</h3>
      <p>{{ album.releaseDate }} · {{ album.trackCount }} 首歌</p>
    </div>
  </RouterLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { Album } from '@/api/types'
import { useLocaleStore } from '@/stores/locale'
import { albumTypeLabel, pickText } from '@/utils/text'

const props = defineProps<{ album: Album }>()
const localeStore = useLocaleStore()
const gradient = computed(() => {
  const hue = Math.abs([...props.album.id].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 40
  return `linear-gradient(135deg, hsl(${330 + hue} 85% 75%), hsl(${280 + hue} 75% 85%), hsl(${320 + hue} 80% 90%))`
})
</script>
