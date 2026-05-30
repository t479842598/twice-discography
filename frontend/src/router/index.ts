import { createRouter, createWebHistory } from 'vue-router'
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
import SearchView from '@/views/SearchView.vue'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/years/:year', name: 'year', component: YearView },
    { path: '/albums', name: 'albums', component: AlbumsView },
    { path: '/albums/:id', name: 'album-detail', component: AlbumDetailView },
    { path: '/tracks/:id', name: 'track-detail', component: TrackDetailView },
    { path: '/solo-unit', name: 'solo-unit', component: SoloUnitView },
    { path: '/cfs', name: 'cfs', component: CfsView },
    { path: '/covers', name: 'covers', component: CoversView },
    { path: '/members', name: 'members', component: MembersView },
    { path: '/members/:id', name: 'member-detail', component: MemberDetailView },
    { path: '/search', name: 'search', component: SearchView },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})
