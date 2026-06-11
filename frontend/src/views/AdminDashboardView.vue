<template>
  <main class="page admin-page admin-dashboard-page">
    <section class="admin-console-shell">
      <aside class="admin-console-sidebar" :aria-label="t('admin.dashboard.workbench.modules.title')">
        <div class="admin-console-brand">
          <span class="admin-console-mark">TW</span>
          <div>
            <strong>{{ t('admin.dashboard.kicker') }}</strong>
            <small>{{ t('admin.dashboard.description') }}</small>
          </div>
        </div>

        <nav class="admin-console-nav">
          <button
            v-for="tab in adminTabs"
            :key="tab.name"
            type="button"
            :class="['admin-console-nav-item', `is-${tab.tone}`, { 'is-active': activeTab === tab.name }]"
            @click="activeTab = tab.name"
          >
            <n-icon class="admin-console-nav-icon" :component="tab.icon" />
            <span>{{ tab.label }}</span>
          </button>
        </nav>

        <div class="admin-console-note">
          <span>{{ t('admin.dashboard.workbench.status.title') }}</span>
          <strong>{{ t('admin.dashboard.workbench.status.ready') }}</strong>
        </div>
      </aside>

      <div class="admin-console-main">
        <template v-if="activeTab === 'overview'">
          <section class="admin-workbench-hero">
            <div class="admin-workbench-copy">
              <span class="admin-workbench-kicker">{{ t('admin.dashboard.workbench.updatedToday', { date: localizedToday }) }}</span>
              <h1>{{ t('admin.dashboard.workbench.title') }}</h1>
              <p>{{ t('admin.dashboard.workbench.subtitle') }}</p>
              <div class="admin-workbench-actions" :aria-label="t('admin.dashboard.workbench.action.group')">
                <button type="button" class="admin-primary-button" @click="activeTab = 'media'">
                  <n-icon :component="VideocamOutline" />
                  <span>{{ t('admin.dashboard.workbench.action.enterMedia') }}</span>
                </button>
                <button type="button" class="admin-secondary-button" @click="activeTab = 'playback'">
                  <n-icon :component="KeyOutline" />
                  <span>{{ t('admin.dashboard.workbench.action.verifyPlayback') }}</span>
                </button>
              </div>
            </div>

            <aside class="admin-health-card" :aria-label="t('admin.dashboard.workbench.status.title')">
              <span class="admin-health-label">{{ t('admin.dashboard.workbench.status.title') }}</span>
              <strong>{{ t('admin.dashboard.workbench.status.ready') }}</strong>
              <p>{{ t('admin.dashboard.workbench.status.description') }}</p>
              <ul>
                <li v-for="item in healthItems" :key="item">
                  <n-icon :component="CheckmarkCircleOutline" />
                  <span>{{ item }}</span>
                </li>
              </ul>
            </aside>
          </section>

          <section class="admin-kpi-grid" :aria-label="t('admin.dashboard.workbench.kpi.group')">
            <article v-for="card in kpiCards" :key="card.title" :class="['admin-kpi-card', `is-${card.tone}`]">
              <n-icon class="admin-kpi-icon" :component="card.icon" />
              <span>{{ card.title }}</span>
              <strong>{{ card.value }}</strong>
              <p>{{ card.description }}</p>
            </article>
          </section>

          <section class="admin-workbench-grid">
            <div class="admin-panel admin-priority-panel">
              <div class="admin-section-title">
                <div>
                  <h2>{{ t('admin.dashboard.workbench.priority.title') }}</h2>
                  <p>{{ t('admin.dashboard.workbench.priority.subtitle') }}</p>
                </div>
              </div>
              <div class="admin-priority-list">
                <button
                  v-for="item in priorityItems"
                  :key="item.title"
                  type="button"
                  :class="['admin-priority-item', `is-${item.tone}`]"
                  @click="activeTab = item.tab"
                >
                  <span class="admin-priority-rank">{{ item.index }}</span>
                  <div>
                    <strong>{{ item.title }}</strong>
                    <small>{{ item.description }}</small>
                  </div>
                  <em>{{ item.action }}</em>
                </button>
              </div>
            </div>

            <div class="admin-panel admin-activity-panel">
              <div class="admin-section-title">
                <div>
                  <h2>{{ t('admin.dashboard.workbench.activity.title') }}</h2>
                  <p>{{ t('admin.dashboard.workbench.activity.subtitle') }}</p>
                </div>
              </div>
              <ol class="admin-activity-list">
                <li v-for="item in activityList" :key="item.title">
                  <span>{{ item.time }}</span>
                  <div>
                    <strong>{{ item.title }}</strong>
                    <p>{{ item.description }}</p>
                  </div>
                </li>
              </ol>
            </div>
          </section>

          <section class="admin-grid admin-overview-grid" :aria-label="t('admin.dashboard.workbench.modules.title')">
            <button
              v-for="entry in quickEntries"
              :key="entry.tab"
              type="button"
              :class="['admin-entry', `is-${entry.tone}`]"
              @click="activeTab = entry.tab"
            >
              <span class="admin-entry-icon"><n-icon :component="entry.icon" /></span>
              <span class="admin-entry-meta">{{ entry.meta }}</span>
              <strong>{{ entry.title }}</strong>
              <span>{{ entry.description }}</span>
            </button>
          </section>
        </template>

        <AdminMvsView v-else-if="activeTab === 'media'" />

        <div v-else-if="activeTab === 'content'" class="admin-content-grid">
          <section class="admin-panel admin-empty-panel">
            <div class="admin-section-title">
              <div>
                <h2>{{ t('admin.dashboard.collections.title') }}</h2>
                <p>{{ t('admin.dashboard.collections.description') }}</p>
              </div>
              <n-icon class="admin-empty-icon" :component="AlbumsOutline" />
            </div>
          </section>

          <section class="admin-panel admin-empty-panel">
            <div class="admin-section-title">
              <div>
                <h2>{{ t('admin.dashboard.favorites.title') }}</h2>
                <p>{{ t('admin.dashboard.favorites.description') }}</p>
              </div>
              <n-icon class="admin-empty-icon" :component="LayersOutline" />
            </div>
          </section>
        </div>

        <AdminBiliSettingsView v-else-if="activeTab === 'playback'" />
        <AdminUsersView v-else-if="activeTab === 'access'" />
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  AlbumsOutline,
  CheckmarkCircleOutline,
  GridOutline,
  KeyOutline,
  LayersOutline,
  PeopleOutline,
  PlayCircleOutline,
  ShieldCheckmarkOutline,
  StatsChartOutline,
  VideocamOutline,
} from '@vicons/ionicons5'
import AdminBiliSettingsView from './AdminBiliSettingsView.vue'
import AdminMvsView from './AdminMvsView.vue'
import AdminUsersView from './AdminUsersView.vue'
import { api } from '@/api/client'
import type { AdminActivityItem, AdminStats } from '@/api/types'
import { useI18n } from '@/i18n'

type AdminTab = 'overview' | 'media' | 'content' | 'playback' | 'access'
type Tone = 'media' | 'content' | 'playback' | 'access' | 'success' | 'warning' | 'neutral'
type IconComponent = typeof GridOutline

const route = useRoute()
const router = useRouter()
const { locale, t } = useI18n()

const activeTab = ref<AdminTab>(tabFromRoute(route.path, route.query.tab))

const localizedToday = computed(() => new Intl.DateTimeFormat(locale.value, {
  month: 'short',
  day: 'numeric',
}).format(new Date()))

const adminTabs = computed<Array<{ name: AdminTab; label: string; tone: Tone; icon: IconComponent }>>(() => [
  { name: 'overview', label: t('admin.dashboard.tab.overview'), tone: 'neutral', icon: GridOutline },
  { name: 'media', label: t('admin.dashboard.tab.media'), tone: 'media', icon: VideocamOutline },
  { name: 'content', label: t('admin.dashboard.tab.content'), tone: 'content', icon: AlbumsOutline },
  { name: 'playback', label: t('admin.dashboard.tab.playback'), tone: 'playback', icon: PlayCircleOutline },
  { name: 'access', label: t('admin.dashboard.tab.access'), tone: 'access', icon: PeopleOutline },
])

const stats = ref<AdminStats | null>(null)
const activityItems = ref<AdminActivityItem[]>([])

onMounted(async () => {
  const [s, a] = await Promise.all([
    api.adminStats().catch(() => null),
    api.adminRecentActivity().catch(() => ({ items: [] })),
  ])
  stats.value = s
  activityItems.value = a.items
})

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function activityTime(ts: number) {
  const diff = Date.now() - ts
  if (diff < 60_000) return t('admin.dashboard.workbench.activity.time.now')
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(ts).toLocaleDateString()
}

function activityTitle(item: AdminActivityItem) {
  return item.title
}

function activityDescription(item: AdminActivityItem) {
  return item.description
}

const healthItems = computed(() => {
  const items = [t('admin.dashboard.workbench.status.media')]
  if (stats.value) {
    items.push(t('admin.dashboard.workbench.status.playback'), t('admin.dashboard.workbench.status.access'))
  }
  return items
})

const kpiCards = computed<Array<{ title: string; value: string; description: string; tone: Tone; icon: IconComponent }>>(() => {
  const s = stats.value
  return [
    { title: t('admin.dashboard.workbench.kpi.pendingMvs.title'), value: s ? String(s.mvs.pending) : '...', description: t('admin.dashboard.workbench.kpi.pendingMvs.description'), tone: 'warning' as Tone, icon: VideocamOutline },
    { title: t('admin.dashboard.workbench.kpi.r2Cached.title'), value: s ? formatBytes(s.r2Cache.totalBytes) : '...', description: `${s?.r2Cache.readyAssets ?? '...'} 个文件`, tone: 'success' as Tone, icon: ShieldCheckmarkOutline },
    { title: t('admin.dashboard.workbench.kpi.homeContent.title'), value: s ? String(s.mvs.homeFeatured) : '...', description: t('admin.dashboard.workbench.kpi.homeContent.description'), tone: 'content' as Tone, icon: LayersOutline },
    { title: t('admin.dashboard.workbench.kpi.adminAccounts.title'), value: s ? String(s.admins) : '...', description: t('admin.dashboard.workbench.kpi.adminAccounts.description'), tone: 'access' as Tone, icon: PeopleOutline },
  ]
})

const priorityItems = computed<Array<{ index: string; tab: AdminTab; tone: Tone; title: string; description: string; action: string }>>(() => {
  const s = stats.value
  const pendingCount = s ? s.mvs.pending : '...'
  const biliOk = s?.biliCredential.configured && s.biliCredential.lastVerifyStatus === 'ok'
  return [
    { index: '01', tab: 'media' as AdminTab, tone: 'media' as Tone, title: `${t('admin.dashboard.workbench.priority.checkInvalidMvs')} (${pendingCount})`, description: t('admin.dashboard.workbench.priority.checkInvalidMvsDescription'), action: t('admin.dashboard.workbench.action.enterMedia') },
    { index: '02', tab: 'playback' as AdminTab, tone: 'playback' as Tone, title: biliOk ? t('admin.dashboard.workbench.priority.cookieOk') : t('admin.dashboard.workbench.priority.verifyCookie'), description: biliOk ? t('admin.dashboard.workbench.priority.cookieOkDescription') : t('admin.dashboard.workbench.priority.verifyCookieDescription'), action: t('admin.dashboard.workbench.action.verifyPlayback') },
    { index: '03', tab: 'content' as AdminTab, tone: 'content' as Tone, title: t('admin.dashboard.workbench.priority.reviewHomeOrder'), description: t('admin.dashboard.workbench.priority.reviewHomeOrderDescription'), action: t('admin.dashboard.workbench.action.reviewContent') },
  ]
})

const activityList = computed<Array<{ time: string; title: string; description: string }>>(() => {
  if (!activityItems.value.length) {
    return [{ time: '—', title: t('admin.dashboard.workbench.activity.empty'), description: t('admin.dashboard.workbench.activity.emptyDescription') }]
  }
  return activityItems.value.map((item) => ({
    time: activityTime(item.time),
    title: activityTitle(item),
    description: activityDescription(item),
  }))
})

const quickEntries = computed<Array<{ tab: AdminTab; icon: IconComponent; tone: Tone; meta: string; title: string; description: string }>>(() => [
  { tab: 'media', icon: VideocamOutline, tone: 'media', meta: t('admin.dashboard.workbench.modules.mediaMeta'), title: t('admin.dashboard.entry.media.title'), description: t('admin.dashboard.entry.media.description') },
  { tab: 'content', icon: LayersOutline, tone: 'content', meta: t('admin.dashboard.workbench.modules.contentMeta'), title: t('admin.dashboard.entry.content.title'), description: t('admin.dashboard.entry.content.description') },
  { tab: 'playback', icon: KeyOutline, tone: 'playback', meta: t('admin.dashboard.workbench.modules.playbackMeta'), title: t('admin.dashboard.entry.playback.title'), description: t('admin.dashboard.entry.playback.description') },
  { tab: 'access', icon: StatsChartOutline, tone: 'access', meta: t('admin.dashboard.workbench.modules.accessMeta'), title: t('admin.dashboard.entry.access.title'), description: t('admin.dashboard.entry.access.description') },
])

function isAdminTab(value: unknown): value is AdminTab {
  return ['overview', 'media', 'content', 'playback', 'access'].includes(String(value))
}

function tabFromRoute(path: string, queryTab: unknown): AdminTab {
  if (path.includes('/admin/mvs')) return 'media'
  if (path.includes('/admin/settings/bilibili')) return 'playback'
  if (path.includes('/admin/users')) return 'access'
  if (isAdminTab(queryTab)) return queryTab
  return 'overview'
}

function routeFromTab(tab: AdminTab) {
  const routes: Record<AdminTab, string | { path: string; query?: Record<string, string> }> = {
    overview: '/admin',
    media: '/admin/mvs',
    content: { path: '/admin', query: { tab: 'content' } },
    playback: '/admin/settings/bilibili',
    access: '/admin/users',
  }
  return routes[tab]
}

watch(() => [route.path, route.query.tab], ([path, queryTab]) => {
  activeTab.value = tabFromRoute(String(path), queryTab)
})

watch(activeTab, (tab) => {
  const target = routeFromTab(tab)
  if (typeof target === 'string') {
    if (target !== route.path || Object.keys(route.query).length) void router.push(target)
    return
  }

  if (target.path !== route.path || route.query.tab !== target.query?.tab) void router.push(target)
})
</script>
