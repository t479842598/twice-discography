<template>
  <main class="page admin-page admin-dashboard-page">
    <n-tabs v-model:value="activeTab" type="line" animated class="admin-dashboard-tabs">
      <n-tab-pane v-for="tab in adminTabs" :key="tab.name" :name="tab.name" :tab="tab.label">
        <template v-if="tab.name === 'home'">
          <section class="admin-overview panel">
            <div>
              <span class="admin-overview-kicker">TWICE 管理后台</span>
              <h1>所有功能已整理到标签页</h1>
              <p>像 B 站空间一样点击上方标签切换功能，不再展示账号头像、昵称和粉丝数据。</p>
            </div>
          </section>

          <div class="admin-grid admin-overview-grid">
            <button
              v-for="entry in quickEntries"
              :key="entry.tab"
              type="button"
              class="panel admin-entry"
              @click="activeTab = entry.tab"
            >
              <span class="admin-entry-icon">{{ entry.icon }}</span>
              <strong>{{ entry.title }}</strong>
              <span>{{ entry.description }}</span>
            </button>
          </div>
        </template>

        <AdminMvsView v-else-if="tab.name === 'mvs'" />

        <section v-else-if="tab.name === 'collections'" class="panel admin-panel admin-empty-panel">
          <div class="admin-section-title">
            <div>
              <h2>合集和系列</h2>
              <p>当前合集内容由曲库数据生成，后续可在这里扩展分组管理。</p>
            </div>
          </div>
        </section>

        <section v-else-if="tab.name === 'favorites'" class="panel admin-panel admin-empty-panel">
          <div class="admin-section-title">
            <div>
              <h2>收藏</h2>
              <p>用于预留收藏、精选内容和首页推荐管理入口。</p>
            </div>
          </div>
        </section>

        <AdminBiliSettingsView v-else-if="tab.name === 'settings'" />
        <AdminUsersView v-else-if="tab.name === 'users'" />
      </n-tab-pane>
    </n-tabs>
  </main>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AdminBiliSettingsView from './AdminBiliSettingsView.vue'
import AdminMvsView from './AdminMvsView.vue'
import AdminUsersView from './AdminUsersView.vue'

const adminTabs = [
  { name: 'home', label: '主页' },
  { name: 'mvs', label: '投稿' },
  { name: 'collections', label: '合集和系列' },
  { name: 'favorites', label: '收藏' },
  { name: 'settings', label: '设置' },
  { name: 'users', label: '用户和角色' },
]

const quickEntries = [
  { tab: 'mvs', icon: '▶', title: 'MV 管理', description: '维护 BVID、封面、首页展示和排序' },
  { tab: 'settings', icon: '⚙', title: '播放设置', description: '管理授权 Cookie 和播放验证能力' },
  { tab: 'users', icon: '◆', title: '用户和角色', description: '新增管理员、编辑和所有者' },
]

const route = useRoute()
const router = useRouter()
const activeTab = ref(tabFromRoute(route.path))

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

watch(() => route.path, (path) => {
  activeTab.value = tabFromRoute(path)
})

watch(activeTab, (tab) => {
  const target = routeFromTab(tab)
  if (target && target !== route.path) void router.push(target)
})
</script>
