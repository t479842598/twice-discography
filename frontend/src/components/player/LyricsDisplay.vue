<template>
  <div
    v-if="parsedLyrics.length > 0"
    class="lyrics-display"
    :class="{ 'is-mobile': isMobile }"
    aria-live="polite"
  >
    <div class="lyrics-scroll">
      <div
        v-for="line in displayLines"
        :key="line.index"
        class="lyric-line"
        :class="{
          'is-current': line.isCurrent,
          'is-prev': line.isPrev,
          'is-next': line.isNext
        }"
      >
        {{ line.text }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

interface LyricLine {
  time: number
  text: string
}

interface DisplayLyricLine extends LyricLine {
  index: number
  isCurrent: boolean
  isPrev: boolean
  isNext: boolean
}

const props = defineProps<{
  lrc: string
  currentTime: number
}>()

const isMobile = ref(false)
const parsedLyrics = ref<LyricLine[]>([])
const currentLineIndex = ref(-1)

// 检测移动端
function updateViewportMode() {
  if (typeof window === 'undefined') return
  isMobile.value = window.innerWidth <= 820 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

// 解析 LRC 歌词
function parseLrc(lrc: string): LyricLine[] {
  if (!lrc) return []

  const lines: LyricLine[] = []
  const timeRegex = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g

  lrc.split('\n').forEach((line) => {
    const matches = [...line.matchAll(timeRegex)]
    if (matches.length === 0) return

    const text = line.replace(timeRegex, '').trim()
    if (!text) return

    matches.forEach((match) => {
      const minutes = Number.parseInt(match[1], 10)
      const seconds = Number.parseInt(match[2], 10)
      const milliseconds = match[3] ? Number.parseInt(match[3].padEnd(3, '0'), 10) : 0
      const time = minutes * 60 + seconds + milliseconds / 1000

      lines.push({ time, text })
    })
  })

  if (lines.length > 0) return lines.sort((a, b) => a.time - b.time)

  return lrc
    .split('\n')
    .map((line) => line.replace(/\[[^\]]+\]/g, '').trim())
    .filter(Boolean)
    .map((text, index) => ({ time: index * 4, text }))
}

// 根据当前时间找到当前歌词行
function findCurrentLine(time: number): number {
  if (parsedLyrics.value.length === 0) return -1

  for (let i = parsedLyrics.value.length - 1; i >= 0; i--) {
    if (time >= parsedLyrics.value[i].time) {
      return i
    }
  }

  return -1
}

// 计算显示的歌词行
const displayLines = computed(() => {
  if (parsedLyrics.value.length === 0) return []

  const current = Math.max(currentLineIndex.value, 0)
  const lines = parsedLyrics.value

  // 移动端显示当前行和下一行，减少歌词切换的等待感
  if (isMobile.value) {
    const end = Math.min(current + 1, lines.length - 1)
    const displayItems: DisplayLyricLine[] = []

    for (let lineIndex = current; lineIndex <= end; lineIndex += 1) {
      displayItems.push({
        ...lines[lineIndex],
        index: lineIndex,
        isCurrent: lineIndex === current,
        isPrev: false,
        isNext: lineIndex === current + 1,
      })
    }

    return displayItems
  }

  // 桌面端显示三行：上一行、当前行、下一行
  const start = Math.max(current - 1, 0)
  const end = Math.min(current + 1, lines.length - 1)
  const displayItems: DisplayLyricLine[] = []

  for (let lineIndex = start; lineIndex <= end; lineIndex += 1) {
    displayItems.push({
      ...lines[lineIndex],
      index: lineIndex,
      isCurrent: lineIndex === current,
      isPrev: lineIndex === current - 1,
      isNext: lineIndex === current + 1,
    })
  }

  return displayItems
})

// 监听歌词变化
watch(() => props.lrc, (newLrc) => {
  parsedLyrics.value = parseLrc(newLrc)
  currentLineIndex.value = -1
}, { immediate: true })

// 监听播放时间变化
watch(() => props.currentTime, (time) => {
  currentLineIndex.value = findCurrentLine(time)
})

onMounted(() => {
  updateViewportMode()
  window.addEventListener('resize', updateViewportMode)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateViewportMode)
})
</script>

<style scoped>
.lyrics-display {
  position: relative;
  min-height: 88px;
  padding: 12px 18px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 18px;
  background:
    radial-gradient(circle at 20% 0%, rgba(255, 107, 157, 0.22), transparent 34%),
    linear-gradient(135deg, rgba(20, 11, 19, 0.72), rgba(65, 29, 49, 0.54));
  backdrop-filter: blur(18px) saturate(1.2);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
}

.lyrics-scroll {
  width: 100%;
  text-align: center;
  display: grid;
  gap: 2px;
}

.lyric-line {
  padding: 3px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.54);
  transition: opacity 0.25s ease, transform 0.25s ease, color 0.25s ease;
}

.lyric-line.is-prev,
.lyric-line.is-next {
  opacity: 0.68;
  transform: translateY(0);
  font-size: 13px;
}

.lyric-line.is-current {
  opacity: 1;
  transform: translateY(0) scale(1.05);
  color: rgba(255, 255, 255, 1);
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 0.01em;
  text-shadow: 0 2px 12px rgba(255, 107, 157, 0.42);
}

/* 移动端样式 */
.lyrics-display.is-mobile {
  min-height: 74px;
  padding: 10px 14px;
  border-radius: 14px;
}

.lyrics-display.is-mobile .lyrics-scroll {
  gap: 1px;
}

.lyrics-display.is-mobile .lyric-line.is-current {
  font-size: 14px;
  white-space: normal;
}

.lyrics-display.is-mobile .lyric-line.is-next {
  font-size: 12px;
  opacity: 0.58;
  white-space: normal;
}

/* 动画效果 */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.lyric-line.is-current {
  animation: fadeInUp 0.3s ease;
}
</style>
