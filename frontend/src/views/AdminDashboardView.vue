<template>
  <main class="page admin-page admin-dashboard-page">
    <section class="admin-bili-hero">
      <div class="admin-bili-banner"></div>
      <div class="admin-bili-profile">
        <div class="admin-bili-avatar-wrap">
          <img v-if="profile?.face" class="admin-bili-avatar" :src="profile.face" :alt="profile.uname" />
          <span v-else class="admin-bili-avatar admin-bili-avatar-fallback">{{ profileInitial }}</span>
        </div>
        <div class="admin-bili-main">
          <div class="admin-bili-name-row">
            <h1>{{ profile?.uname || 'B站账号未读取' }}</h1>
            <span v-if="profile?.level" class="admin-bili-level">LV{{ profile.level }}</span>
            <span v-if="profile?.vipStatus" class="admin-bili-vip">大会员</span>
            <span v-if="profile?.officialTitle" class="admin-bili-badge">{{ profile.officialTitle }}</span>
          </div>
          <p>{{ profileSubtitle }}</p>
        </div>
      </div>
      <div class="admin-bili-stats">
        <span>粉丝 <strong>{{ formatCount(profile?.follower) }}</strong></span>
        <span>关注 <strong>{{ formatCount(profile?.following) }}</strong></span>
        <span>动态 <strong>{{ formatCount(profile?.dynamic) }}</strong></span>
      </div>
    </section>

    <n-tabs v-model:value="activeTab" type="line" animated class="admin-dashboard-tabs">
      <n-tab-pane name="home" tab="主页">
        <div class="admin-grid">
          <RouterLink class="panel admin-entry" to="/admin/mvs"><strong>MV 管理</strong><span>维护 BVID、封面、首页展示和排序</span></RouterLink>
          <RouterLink class="panel admin-entry" to="/admin/settings/bilibili"><strong>B站凭证</strong><span>保存授权 Cookie 并验证高清能力</span></RouterLink>
          <RouterLink class="panel admin-entry" to="/admin/users"><strong>用户和角色</strong><span>新增管理员、编辑和所有者</span></RouterLink>
        </div>
      </n-tab-pane>
      <n-tab-pane name="mvs" tab="投稿">
        <AdminMvsView />
      </n-tab-pane>
      <n-tab-pane name="collections" tab="合集和系列">
        <section class="panel admin-panel">
          <div class="admin-section-title">
            <div>
              <h2>合集和系列</h2>
              <p>当前合集内容由曲库数据生成，后续可在这里扩展分组管理。</p>
            </div>
          </div>
        </section>
      </n-tab-pane>
      <n-tab-pane name="favorites" tab="收藏">
        <section class="panel admin-panel">
          <div class="admin-section-title">
            <div>
              <h2>收藏</h2>
              <p>用于预留收藏/精选内容管理入口。</p>
            </div>
          </div>
        </section>
      </n-tab-pane>
      <n-tab-pane name="settings" tab="设置">
        <AdminBiliSettingsView />
      </n-tab-pane>
      <n-tab-pane name="users" tab="用户和角色">
        <AdminUsersView />
      </n-tab-pane>
    </n-tabs>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { api } from '@/api/client'
import type { BiliProfile } from '@/api/types'
import AdminBiliSettingsView from './AdminBiliSettingsView.vue'
import AdminMvsView from './AdminMvsView.vue'
import AdminUsersView from './AdminUsersView.vue'

const route = useRoute()
const router = useRouter()
const activeTab = ref(tabFromRoute(route.path))
const profile = ref<BiliProfile | null>(null)
const profileMessage = ref('')

const profileInitial = computed(() => (profile.value?.uname || 'B').trim().slice(0, 1).toUpperCase())
const profileSubtitle = computed(() => {
  if (profile.value?.pendantName) return profile.value.pendantName
  if (profileMessage.value && profileMessage.value !== 'ok') return profileMessage.value
  return '编辑个性签名'
})

function tabFromRoute(path: string) {
  if (path.includes('/admin/mvs')) return 'mvs'
  if (path.includes('/admin/settings/bilibili')) return 'settings'
  if (path.includes('/admin/users')) return 'users'
  return 'home'
}

function routeFromTab(tab: string) {
  const routes: Record<string, string | undefined> = {
    home: '/admin',
    mvs: '/admin/mvs',
    settings: '/admin/settings/bilibili',
    users: '/admin/users',
  }
  return routes[tab]
}

function formatCount(value: number | null | undefined) {
  if (value === null || value === undefined) return '--'
  if (value >= 10000) return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}万`
  return String(value)
}

async function loadBiliProfile() {
  try {
    const result = await api.adminBiliProfile()
    profile.value = result.profile
    profileMessage.value = result.message
  } catch (error) {
    profileMessage.value = error instanceof Error ? error.message : 'B站资料读取失败'
  }
}

watch(() => route.path, (path) => {
  activeTab.value = tabFromRoute(path)
})

watch(activeTab, (tab) => {
  const target = routeFromTab(tab)
  if (target && target !== route.path) void router.push(target)
})

onMounted(loadBiliProfile)
</script>
