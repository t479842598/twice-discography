<template>
  <img v-if="currentSrc" v-bind="$attrs" :src="currentSrc" :alt="alt" @error="handleError" />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  sources: Array<string | null | undefined>
  alt: string
}>()

const emit = defineEmits<{
  failed: []
}>()

const normalizedSources = computed(() => {
  const seen = new Set<string>()
  const sources: string[] = []
  for (const source of props.sources) {
    const normalized = source?.trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    sources.push(normalized)
  }
  return sources
})

const currentIndex = ref(0)
const currentSrc = computed(() => normalizedSources.value[currentIndex.value] ?? '')

function handleError() {
  if (currentIndex.value < normalizedSources.value.length - 1) {
    currentIndex.value += 1
    return
  }
  emit('failed')
}

watch(normalizedSources, () => {
  currentIndex.value = 0
})
</script>
