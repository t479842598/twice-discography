<template>
  <RouterLink :to="`/members/${member.id}`" class="member-card" :style="{ '--member-color': member.colorHex }">
    <div class="member-avatar">
      <img v-if="member.photoLocal" :src="member.photoLocal" :alt="pickText(member.name, localeStore.locale)" loading="lazy" />
      <span v-else>{{ initials }}</span>
    </div>
    <strong>{{ pickText(member.name, localeStore.locale) }}</strong>
    <span>{{ member.flagEmoji }} {{ member.positions.join(' · ') }}</span>
  </RouterLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { Member } from '@/api/types'
import { useLocaleStore } from '@/stores/locale'
import { pickText } from '@/utils/text'

const props = defineProps<{ member: Member }>()
const localeStore = useLocaleStore()
const initials = computed(() => props.member.name.en.slice(0, 2).toUpperCase())
</script>
