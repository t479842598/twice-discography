<template>
  <main class="page">
    <header class="page-header">
      <div>
        <span class="eyebrow">VARIETY SHOWS</span>
        <h1>综艺节目</h1>
        <p>TWICE 团综、个综、外部综艺、直播、电台、演唱会等视频资料汇总</p>
      </div>
    </header>

    <n-tabs v-model:value="activeCategory" type="line" animated>
      <n-tab-pane
        v-for="category in varietyCategories"
        :key="category.key"
        :name="category.key"
        :tab="category.label"
      >
        <div class="variety-category-intro">
          <p>{{ category.description }}</p>
        </div>

        <div v-if="category.key === 'preview'" class="variety-preview">
          <n-grid :cols="2" :x-gap="16" :y-gap="16" responsive="screen">
            <n-gi v-for="cat in contentCategories" :key="cat.key">
              <div class="variety-preview-card" @click="activeCategory = cat.key">
                <div class="variety-preview-icon">{{ getCategoryIcon(cat.key) }}</div>
                <strong>{{ cat.label }}</strong>
                <span>{{ getItemCount(cat.key) }} 项内容</span>
              </div>
            </n-gi>
          </n-grid>
        </div>

        <div v-else-if="category.key === 'list'" class="variety-list-view">
          <n-data-table
            :columns="tableColumns"
            :data="varietyItems"
            :pagination="{ pageSize: 20 }"
            :bordered="false"
          />
        </div>

        <div v-else class="variety-grid">
          <div
            v-for="item in getItemsByCategory(category.key)"
            :key="item.id"
            class="variety-card"
            @click="openVarietyPlayer(item)"
          >
            <div v-if="item.coverUrl" class="variety-card-cover">
              <img :src="item.coverUrl" :alt="item.title" loading="lazy" decoding="async" />
              <div class="variety-card-play-overlay">
                <span class="variety-card-play-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </span>
              </div>
            </div>
            <div class="variety-card-content">
              <div class="variety-card-header">
                <h3>{{ item.title }}</h3>
                <n-tag v-if="item.subtitle" size="small" :bordered="false">{{ item.subtitle }}</n-tag>
              </div>
              <div class="variety-card-meta">
                <span v-if="item.year">📅 {{ item.year }}</span>
                <span v-if="item.episodes">📺 {{ item.episodes }}</span>
                <span>👥 {{ item.cast }}</span>
              </div>
              <p class="variety-card-description">{{ item.description }}</p>
              <div class="variety-card-tags">
                <n-tag
                  v-for="tag in item.tags"
                  :key="tag"
                  size="small"
                  :bordered="false"
                >
                  {{ tag }}
                </n-tag>
              </div>
              <div class="variety-card-footer">
                <n-tag size="small" type="info" :bordered="false">{{ item.source }}</n-tag>
                <n-button text @click.stop="openVarietyPlayer(item)">
                  观看 →
                </n-button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="getItemsByCategory(category.key).length === 0 && category.key !== 'preview' && category.key !== 'list'" class="variety-empty">
          <n-empty description="该分类暂无内容">
            <template #extra>
              <n-button size="small" @click="activeCategory = 'preview'">返回预览</n-button>
            </template>
          </n-empty>
        </div>
      </n-tab-pane>
    </n-tabs>

    <section class="variety-sources">
      <h2>数据来源</h2>
      <n-grid :cols="2" :x-gap="16" :y-gap="16" responsive="screen">
        <n-gi>
          <div class="variety-source-card">
            <strong>观兔手册 (Notion)</strong>
            <p>{{ notionVarietyMeta.collectionName }} · {{ notionVarietyMeta.visibleRows }} 条记录</p>
            <n-button
              text
              tag="a"
              :href="varietySourceLinks.notion"
              target="_blank"
              rel="noopener noreferrer"
            >
              访问 Notion →
            </n-button>
          </div>
        </n-gi>
        <n-gi>
          <div class="variety-source-card">
            <strong>TWFlix</strong>
            <p>TWICE 视频资料整理站</p>
            <n-button
              text
              tag="a"
              :href="varietySourceLinks.twflix"
              target="_blank"
              rel="noopener noreferrer"
            >
              访问 TWFlix →
            </n-button>
          </div>
        </n-gi>
      </n-grid>
    </section>

    <n-modal v-model:show="showPlayer" preset="card" class="variety-player-modal" :title="currentItem?.title" :bordered="false" @after-leave="stopPlayer">
      <iframe
        v-if="currentItem"
        :src="currentItem.url"
        class="variety-player-iframe"
        frameborder="0"
        allowfullscreen
      />
    </n-modal>
  </main>
</template>

<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { NButton, NTag } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import {
  varietyCategories,
  varietyItems,
  varietySourceLinks,
  notionVarietyMeta,
  type VarietyCategoryKey,
  type VarietyItem,
} from '@/data/variety'

const activeCategory = ref<VarietyCategoryKey>('preview')
const showPlayer = ref(false)
const currentItem = ref<VarietyItem | null>(null)

const contentCategories = computed(() =>
  varietyCategories.filter((c) => c.key !== 'preview' && c.key !== 'list')
)

function getItemsByCategory(categoryKey: VarietyCategoryKey) {
  if (categoryKey === 'preview' || categoryKey === 'list') return []
  return varietyItems.filter((item) => item.category === categoryKey)
}

function getItemCount(categoryKey: VarietyCategoryKey) {
  return getItemsByCategory(categoryKey).length
}

function getCategoryIcon(categoryKey: VarietyCategoryKey): string {
  const icons: Record<string, string> = {
    group: '🎬',
    'time-to-twice': '⏰',
    variety: '📺',
    anniversary: '🎉',
    solo: '⭐',
    live: '🔴',
    radio: '📻',
    concert: '🎤',
    fanchant: '📣',
  }
  return icons[categoryKey] || '📁'
}

function openVarietyPlayer(item: VarietyItem) {
  currentItem.value = item
  showPlayer.value = true
}

function stopPlayer() {
  currentItem.value = null
}

const tableColumns: DataTableColumns<VarietyItem> = [
  {
    title: '标题',
    key: 'title',
    width: 200,
    ellipsis: { tooltip: true },
  },
  {
    title: '副标题',
    key: 'subtitle',
    width: 150,
    ellipsis: { tooltip: true },
  },
  {
    title: '年份',
    key: 'year',
    width: 120,
  },
  {
    title: '集数',
    key: 'episodes',
    width: 100,
  },
  {
    title: '出演',
    key: 'cast',
    width: 120,
  },
  {
    title: '分类',
    key: 'category',
    width: 120,
    render: (row) => {
      const cat = varietyCategories.find((c) => c.key === row.category)
      return cat ? cat.label : row.category
    },
  },
  {
    title: '标签',
    key: 'tags',
    width: 200,
    render: (row) =>
      h(
        'div',
        { style: 'display: flex; gap: 4px; flex-wrap: wrap;' },
        row.tags.map((tag) =>
          h(NTag, { size: 'small', bordered: false }, { default: () => tag })
        )
      ),
  },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    render: (row) =>
      h(
        NButton,
        {
          text: true,
          tag: 'a',
          href: row.url,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
        { default: () => '查看' }
      ),
  },
]
</script>

<style scoped>
.variety-category-intro {
  margin-bottom: 24px;
  padding: 16px 20px;
  border-radius: 12px;
  background: var(--panel-bg);
  border: 1px solid var(--soft-border);
}

.variety-category-intro p {
  margin: 0;
  color: var(--muted-text);
}

.variety-preview {
  margin-top: 24px;
}

.variety-preview-card {
  padding: 24px;
  border: 1px solid var(--soft-border);
  border-radius: 16px;
  background: var(--panel-bg);
  box-shadow: var(--shadow);
  backdrop-filter: blur(16px);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.variety-preview-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow), var(--glow);
  border-color: var(--accent-light);
}

.variety-preview-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.variety-preview-card strong {
  display: block;
  margin-bottom: 8px;
  color: var(--heading-text);
  font-size: 18px;
}

.variety-preview-card span {
  display: block;
  color: var(--muted-text);
  font-size: 14px;
}

.variety-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
  margin-top: 24px;
}

.variety-card {
  padding: 20px;
  border: 1px solid var(--soft-border);
  border-radius: 16px;
  background: var(--panel-bg);
  box-shadow: var(--shadow);
  backdrop-filter: blur(16px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.variety-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow), var(--glow);
  border-color: var(--accent-light);
}

.variety-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.variety-card-header h3 {
  margin: 0;
  color: var(--heading-text);
  font-size: 18px;
  line-height: 1.4;
}

.variety-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--muted-text);
}

.variety-card-description {
  margin: 12px 0;
  color: var(--page-text);
  font-size: 14px;
  line-height: 1.6;
}

.variety-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 12px 0;
}

.variety-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--soft-border);
}

.variety-list-view {
  margin-top: 24px;
}

.variety-empty {
  margin-top: 48px;
  text-align: center;
}

.variety-sources {
  margin-top: 48px;
  padding-top: 32px;
  border-top: 1px solid var(--soft-border);
}

.variety-sources h2 {
  margin: 0 0 20px;
  color: var(--heading-text);
}

.variety-source-card {
  padding: 20px;
  border: 1px solid var(--soft-border);
  border-radius: 16px;
  background: var(--panel-bg);
  box-shadow: var(--shadow);
  backdrop-filter: blur(16px);
}

.variety-source-card strong {
  display: block;
  margin-bottom: 8px;
  color: var(--heading-text);
  font-size: 16px;
}

.variety-source-card p {
  margin: 0 0 12px;
  color: var(--muted-text);
  font-size: 14px;
}

.variety-card-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  margin-bottom: 16px;
  border-radius: 12px;
  overflow: hidden;
  background: var(--soft-border);
}

.variety-card-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.variety-card-play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  opacity: 0;
  transition: opacity 0.3s;
}

.variety-card:hover .variety-card-play-overlay {
  opacity: 1;
}

.variety-card-play-icon {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 107, 157, 0.9);
  color: white;
  font-size: 24px;
  padding-left: 4px;
  box-shadow: 0 4px 12px rgba(255, 107, 157, 0.4);
}

.variety-card {
  cursor: pointer;
}

.variety-card-content {
  /* 内容区域样式 */
}

.variety-player-modal {
  width: 90vw;
  max-width: 1200px;
}

.variety-player-iframe {
  width: 100%;
  height: 70vh;
  min-height: 500px;
  border-radius: 8px;
  background: #000;
}

@media (max-width: 640px) {
  .variety-grid {
    grid-template-columns: 1fr;
  }

  .variety-player-iframe {
    height: 50vh;
    min-height: 300px;
  }
}
</style>
