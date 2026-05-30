import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api/client'
import type { CatalogOverview } from '@/api/types'

export const useCatalogStore = defineStore('catalog', () => {
  const overview = ref<CatalogOverview | null>(null)
  const loading = ref(false)
  const error = ref('')

  async function loadOverview() {
    if (overview.value) return overview.value
    loading.value = true
    error.value = ''
    try {
      overview.value = await api.overview()
      return overview.value
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  return { overview, loading, error, loadOverview }
})
