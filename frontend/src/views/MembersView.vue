<template>
  <PageSkeleton v-if="loading" variant="grid" />

  <main v-else class="page">
    <PageHeader :eyebrow="t('page.members.eyebrow')" :title="t('page.members.title')" :description="t('page.members.description')" />
    <div class="member-grid">
      <MemberCard v-for="member in members" :key="member.id" :member="member" />
    </div>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '@/api/client'
import type { Member } from '@/api/types'
import MemberCard from '@/components/catalog/MemberCard.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import PageSkeleton from '@/components/common/PageSkeleton.vue'
import { useI18n } from '@/i18n'

const members = ref<Member[]>([])
const loading = ref(true)
const { t } = useI18n()

onMounted(async () => {
  try {
    members.value = (await api.members()).members
  } finally {
    loading.value = false
  }
})
</script>


