<template>
  <main class="page">
    <PageHeader eyebrow="成员" title="成员资料" description="九位成员资料、单人/小分队 关联曲和翻唱记录。" />
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

const members = ref<Member[]>([])

onMounted(async () => {
  members.value = (await api.members()).members
})
</script>


