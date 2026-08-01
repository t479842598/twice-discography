import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAudioStore } from './audio'

const VOLUME_STORAGE_KEY = 'twice.audio.volume.v1'

function installStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  const storage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value) },
    removeItem: (key: string) => { map.delete(key) },
    clear: () => map.clear(),
  }
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true })
  return storage
}

describe('audio volume store (DESIGN_SPECS §4.2)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    installStorage()
  })

  it('clamps volume to [0,1] and unmutes when raised above zero', () => {
    const store = useAudioStore()
    store.setVolume(1.7)
    expect(store.volume).toBe(1)
    store.setVolume(-0.5)
    expect(store.volume).toBe(0)
    store.toggleMute()
    expect(store.muted).toBe(true)
    store.setVolume(0.6)
    expect(store.muted).toBe(false)
  })

  it('persists and restores volume+muted via the versioned key', () => {
    const store = useAudioStore()
    store.setVolume(0.42)
    store.toggleMute()

    const saved = JSON.parse((globalThis.localStorage as ReturnType<typeof installStorage>).getItem(VOLUME_STORAGE_KEY) ?? '{}')
    expect(saved.v).toBe(0.42)
    expect(saved.m).toBe(true)
    expect(saved.l).toBe(0.42)

    // A fresh store instance reads the persisted preference.
    const restored = useAudioStore()
    expect(restored.volume).toBe(0.42)
    expect(restored.muted).toBe(true)
  })

  it('restores the last non-zero volume on unmute', () => {
    const store = useAudioStore()
    store.setVolume(0.3)
    store.toggleMute() // mute at 0.3
    store.setVolume(0) // slide to zero while muted
    expect(store.muted).toBe(true)
    store.toggleMute() // unmute
    expect(store.muted).toBe(false)
    expect(store.volume).toBe(0.3)
  })

  it('falls back safely on invalid or missing persisted values', () => {
    installStorage({ [VOLUME_STORAGE_KEY]: JSON.stringify({ v: 999, m: true, l: -3 }) })
    const store = useAudioStore()
    expect(store.volume).toBe(1)
    expect(store.muted).toBe(true)
  })

  it('falls back to defaults when storage is corrupted', () => {
    installStorage({ [VOLUME_STORAGE_KEY]: '{not-json' })
    const store = useAudioStore()
    expect(store.volume).toBe(1)
    expect(store.muted).toBe(false)
  })
})
