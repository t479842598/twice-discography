<template>
  <RouterLink :to="`/albums/${album.id}`" class="album-card">
    <div class="album-art" :style="hasCover ? undefined : { background: gradient }">
      <FallbackImage
        v-if="hasCover"
        :sources="coverSources"
        :alt="t('common.coverAlt', { title: pickText(album.title, localeStore.locale) })"
        loading="lazy"
        decoding="async"
      />
      <span>{{ album.year }}</span>
    </div>
    <div class="album-copy">
      <n-tag size="small" :bordered="false">{{ albumTypeLabel(album.type, localeStore.locale) }}</n-tag>
      <h3>{{ pickText(album.title, localeStore.locale) }}</h3>
      <p>{{ album.releaseDate }} · {{ t('album.trackCount', { count: album.trackCount }) }}</p>
    </div>
  </RouterLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { Album } from '@/api/types'
import FallbackImage from '@/components/common/FallbackImage.vue'
import { useI18n } from '@/i18n'
import { useLocaleStore } from '@/stores/locale'
import { albumTypeLabel, pickText } from '@/utils/text'

const props = defineProps<{ album: Album }>()
const localeStore = useLocaleStore()
const { t } = useI18n()
const coverSources = computed(() => [props.album.coverLocal, props.album.coverRemote].filter(Boolean) as string[])
const hasCover = computed(() => coverSources.value.length > 0)
const gradient = computed(() => {
  const hue = Math.abs([...props.album.id].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 40
  return `linear-gradient(135deg, hsl(${330 + hue} 85% 75%), hsl(${280 + hue} 75% 85%), hsl(${320 + hue} 80% 90%))`
})
</script>
