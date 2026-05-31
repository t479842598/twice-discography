<template>
  <n-modal
    v-model:show="showModal"
    preset="card"
    :title="title"
    class="mv-player-modal"
    :bordered="false"
    @after-leave="stopVideo"
  >
    <div class="mv-player-container">
      <iframe
        v-if="ytVideoId"
        :src="`https://www.youtube.com/embed/${ytVideoId}?autoplay=${isMobile ? 0 : 1}&rel=0`"
        class="mv-player-iframe"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
      />
      <iframe
        v-else-if="biliBvid"
        :src="`https://player.bilibili.com/player.html?bvid=${biliBvid}&page=${biliPage || 1}&autoplay=${isMobile ? 0 : 1}&high_quality=1`"
        class="mv-player-iframe"
        frameborder="0"
        allowfullscreen
      />
      <n-empty v-else description="暂无MV链接">
        <template #extra>
          <n-button size="small" @click="showModal = false">关闭</n-button>
        </template>
      </n-empty>
    </div>
    <div v-if="ytVideoId || biliBvid" class="mv-player-tips">
      <p v-if="isMobile && !videoLoaded">
        <n-icon><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></n-icon>
        如果视频无法加载，请尝试：
      </p>
      <div v-if="isMobile" class="mv-player-actions">
        <n-button v-if="ytVideoId" text tag="a" :href="`https://www.youtube.com/watch?v=${ytVideoId}`" target="_blank" rel="noopener noreferrer">
          在 YouTube 打开 →
        </n-button>
        <n-button v-if="biliBvid" text tag="a" :href="`https://www.bilibili.com/video/${biliBvid}`" target="_blank" rel="noopener noreferrer">
          在 B站 打开 →
        </n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  show: boolean
  title: string
  ytVideoId?: string | null
  biliBvid?: string | null
  biliPage?: number | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const showModal = ref(props.show)
const isMobile = ref(false)
const videoLoaded = ref(false)

// 检测移动端
if (typeof window !== 'undefined') {
  isMobile.value = window.innerWidth <= 820 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

watch(
  () => props.show,
  (val) => {
    showModal.value = val
    if (val) {
      videoLoaded.value = false
      // 3秒后假设视频已加载
      setTimeout(() => {
        videoLoaded.value = true
      }, 3000)
    }
  }
)

watch(showModal, (val) => {
  emit('update:show', val)
})

function stopVideo() {
  // Modal关闭时会自动卸载iframe，停止播放
  videoLoaded.value = false
}
</script>

<style>
.mv-player-modal {
  width: min(1200px, calc(100vw - 32px));
}

.mv-player-container {
  position: relative;
  width: 100%;
  padding-bottom: 56.25%; /* 16:9 aspect ratio */
  background: #000;
  border-radius: 12px;
  overflow: hidden;
}

.mv-player-iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 12px;
}

.mv-player-tips {
  margin-top: 16px;
  padding: 12px;
  border-radius: 8px;
  background: var(--panel-bg);
  border: 1px solid var(--soft-border);
}

.mv-player-tips p {
  margin: 0 0 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--muted-text);
}

.mv-player-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

@media (max-width: 640px) {
  .mv-player-modal {
    width: calc(100vw - 16px);
  }

  .mv-player-modal .n-card {
    margin: 8px;
  }

  .mv-player-container {
    border-radius: 8px;
  }

  .mv-player-iframe {
    border-radius: 8px;
  }
}
</style>
