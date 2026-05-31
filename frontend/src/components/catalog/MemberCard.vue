<template>
  <RouterLink :to="`/members/${member.id}`" class="member-card" :style="{ '--member-color': member.colorHex }">
    <div class="member-avatar">
      <img v-if="member.photoLocal && !imageFailed" :src="member.photoLocal" :alt="pickText(member.name, localeStore.locale)" loading="lazy" decoding="async" @error="imageFailed = true" />
      <span v-else>{{ initials }}</span>
    </div>
    <strong>{{ pickText(member.realName, localeStore.locale) }}</strong>
    <span>
      {{ pickText(member.name, localeStore.locale) }} ·
      <CountryFlag :country-code="member.nationality" :emoji="member.flagEmoji" size="small" />
      {{ member.positions.join(' · ') }}
    </span>
  </RouterLink>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import type { Member } from '@/api/types'
import CountryFlag from '@/components/common/CountryFlag.vue'
import { useLocaleStore } from '@/stores/locale'
import { pickText } from '@/utils/text'

const props = defineProps<{ member: Member }>()
const localeStore = useLocaleStore()
const imageFailed = ref(false)
const initials = computed(() => props.member.name.en.slice(0, 2).toUpperCase())

watch(() => props.member.photoLocal, () => {
  imageFailed.value = false
})
</script>
