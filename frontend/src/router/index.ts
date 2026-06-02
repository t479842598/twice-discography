import { createRouter, createWebHistory } from 'vue-router'
import { api } from '@/api/client'
import HomeView from '@/views/HomeView.vue'
import YearView from '@/views/YearView.vue'
import AlbumsView from '@/views/AlbumsView.vue'
import AlbumDetailView from '@/views/AlbumDetailView.vue'
import TrackDetailView from '@/views/TrackDetailView.vue'
import SoloUnitView from '@/views/SoloUnitView.vue'
import CfsView from '@/views/CfsView.vue'
import CoversView from '@/views/CoversView.vue'
import MembersView from '@/views/MembersView.vue'
import MemberDetailView from '@/views/MemberDetailView.vue'
import MusicStationView from '@/views/MusicStationView.vue'
import AdminDashboardView from '@/views/AdminDashboardView.vue'
import AdminLoginView from '@/views/AdminLoginView.vue'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/years/:year', name: 'year', component: YearView },
    { path: '/albums', name: 'albums', component: AlbumsView },
    { path: '/albums/:id', name: 'album-detail', component: AlbumDetailView },
    { path: '/tracks/:id', name: 'track-detail', component: TrackDetailView },
    { path: '/solo-unit', name: 'solo-unit', component: SoloUnitView },
    { path: '/variety', redirect: '/' },
    { path: '/cfs', name: 'cfs', component: CfsView },
    { path: '/covers', name: 'covers', component: CoversView },
    { path: '/members', name: 'members', component: MembersView },
    { path: '/members/:id', name: 'member-detail', component: MemberDetailView },
    { path: '/music-station', name: 'music-station', component: MusicStationView },
    { path: '/admin/login', name: 'admin-login', component: AdminLoginView },
    { path: '/admin', name: 'admin-dashboard', component: AdminDashboardView },
    { path: '/admin/mvs', name: 'admin-mvs', component: AdminDashboardView },
    { path: '/admin/users', name: 'admin-users', component: AdminDashboardView },
    { path: '/admin/settings/bilibili', name: 'admin-bili-settings', component: AdminDashboardView },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

router.beforeEach(async (to) => {
  if (!to.path.startsWith('/admin') || to.path === '/admin/login') return true
  try {
    const session = await api.adminSession()
    return session.user ? true : { path: '/admin/login', query: { redirect: to.fullPath } }
  } catch {
    return { path: '/admin/login', query: { redirect: to.fullPath } }
  }
})
