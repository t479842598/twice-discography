<template>
  <header class="page-header">
    <div>
      <n-text depth="3" class="eyebrow">{{ eyebrow }}</n-text>
      <h1>{{ title }}</h1>
      <p v-if="description">{{ description }}</p>
    </div>
    <slot name="actions" />
  </header>
</template>

<script setup lang="ts">
defineProps<{
  eyebrow: string
  title: string
  description?: string
}>()
</script>
