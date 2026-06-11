<template>
  <img
    v-if="flagUrl"
    :src="flagUrl"
    :alt="t('common.flagAlt', { country: countryCode || '' })"
    :class="['country-flag', sizeClass]"
    loading="lazy"
  />
  <span v-else class="country-flag-fallback">{{ emoji }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/i18n'

const props = withDefaults(
  defineProps<{
    countryCode?: string | null
    emoji?: string
    size?: 'small' | 'medium' | 'large'
  }>(),
  {
    countryCode: '',
    emoji: '',
    size: 'medium',
  }
)
const { t } = useI18n()

const flagUrl = computed(() => {
  if (!props.countryCode) return null
  const code = props.countryCode.toLowerCase()
  // 使用本地国旗图片（静态文件路径）
  return `/static/flags/${code}.png`
})

const sizeClass = computed(() => `flag-${props.size}`)
</script>

<style scoped>
.country-flag {
  display: inline-block;
  vertical-align: middle;
  border-radius: 2px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.flag-small {
  width: 20px;
  height: auto;
}

.flag-medium {
  width: 28px;
  height: auto;
}

.flag-large {
  width: 40px;
  height: auto;
}

.country-flag-fallback {
  display: inline-block;
  font-size: 1.5em;
  vertical-align: middle;
}
</style>
