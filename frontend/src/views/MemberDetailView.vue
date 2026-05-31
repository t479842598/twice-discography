<template>
  <main class="page">
    <PageHeader
      v-if="member"
      :eyebrow="`${member.birthday}`"
      :title="pickText(member.realName, localeStore.locale)"
      :description="pickText(member.bio, localeStore.locale)"
    >
      <template #eyebrow-prefix>
        <CountryFlag :country-code="member.nationality" :emoji="member.flagEmoji" size="small" />
      </template>
    </PageHeader>
    <section v-if="member" class="section member-detail-grid">
      <img v-if="member.photoLocal && !photoFailed" class="member-detail-photo" :src="member.photoLocal" :alt="pickText(member.name, localeStore.locale)" decoding="async" fetchpriority="high" @error="photoFailed = true" />
      <div v-else class="member-detail-photo member-detail-photo-fallback">{{ pickText(member.name, localeStore.locale).slice(0, 2).toUpperCase() }}</div>
      <div class="member-detail-main">
        <section class="panel member-resume">
          <h2>成员简历</h2>
          <p><strong>艺名</strong><span>{{ pickText(member.name, localeStore.locale) }}</span></p>
          <p><strong>本名</strong><span>{{ pickText(member.realName, localeStore.locale) }}</span></p>
          <p>
            <strong>国籍</strong>
            <span class="member-flag-wrapper">
              <CountryFlag :country-code="member.nationality" :emoji="member.flagEmoji" size="medium" />
            </span>
          </p>
          <p><strong>生日</strong><span>{{ member.birthday }}</span></p>
          <p><strong>出道</strong><span>{{ member.debutDate || '2015-10-20' }}</span></p>
          <p><strong>身高</strong><span>{{ member.heightCm ? `${member.heightCm} cm` : '—' }}</span></p>
          <p><strong>血型</strong><span>{{ member.bloodType || '—' }}</span></p>
          <p><strong>MBTI</strong><span>{{ member.mbti || '—' }}</span></p>
          <p><strong>星座</strong><span>{{ zodiacLabel(member.zodiac, localeStore.locale) }}</span></p>
          <p><strong>定位</strong><span>{{ member.positions.join(' · ') }}</span></p>
        </section>
        <section class="section">
          <h2>关联曲目</h2>
          <TrackList :tracks="member.tracks || []" />
          <n-empty v-if="!member.tracks?.length" description="暂无关联 单人 / 小分队 曲目" />
        </section>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '@/api/client'
import type { Member } from '@/api/types'
import CountryFlag from '@/components/common/CountryFlag.vue'
import TrackList from '@/components/catalog/TrackList.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import { useLocaleStore } from '@/stores/locale'
import { pickText, zodiacLabel } from '@/utils/text'

const route = useRoute()
const localeStore = useLocaleStore()
const member = ref<Member | null>(null)
const photoFailed = ref(false)

async function load() {
  photoFailed.value = false
  member.value = (await api.member(String(route.params.id))).member
}

onMounted(load)
watch(() => route.params.id, load)
</script>

<style scoped>
.member-flag-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
</style>
