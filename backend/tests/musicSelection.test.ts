import { describe, expect, it } from 'vitest'
import { normalizeQuality, selectDefaultCandidate } from '../src/services/musicSelection.js'
import { MUSIC_SOURCE_LABELS, type MusicCandidate, type MusicSource, type QualityTag } from '../src/services/musicTypes.js'

function candidate(source: MusicSource, tag: QualityTag, playable = true): MusicCandidate {
  return {
    source,
    sourceName: MUSIC_SOURCE_LABELS[source],
    providerId: `${source}-id`,
    title: 'FANCY',
    artist: 'TWICE',
    album: 'FANCY YOU',
    quality: normalizeQuality({ tag }),
    playable,
    recommended: source === 'qq',
    selected: false,
    hasLyrics: true,
    audioUrl: playable ? `https://example.com/${source}.${tag}` : null,
    lrc: '[00:00.000]FANCY',
  }
}

describe('music source selection', () => {
  it('selects QQ when QQ has lossless playback', () => {
    const selected = selectDefaultCandidate([
      candidate('qq', 'lossless'),
      candidate('netease', '320k'),
      candidate('kuwo', '320k'),
    ])

    expect(selected?.source).toBe('qq')
    expect(selected?.quality.tag).toBe('lossless')
  })

  it('selects a higher quality non-QQ source when QQ is lower quality', () => {
    const selected = selectDefaultCandidate([
      candidate('qq', 'low'),
      candidate('netease', 'lossless'),
      candidate('kuwo', '320k'),
    ])

    expect(selected?.source).toBe('netease')
    expect(selected?.quality.tag).toBe('lossless')
  })

  it('uses QQ before Netease when quality is tied', () => {
    const selected = selectDefaultCandidate([
      candidate('netease', '320k'),
      candidate('qq', '320k'),
      candidate('kuwo', '320k'),
    ])

    expect(selected?.source).toBe('qq')
  })

  it('skips failed candidates and falls back to Netease', () => {
    const selected = selectDefaultCandidate([
      candidate('qq', 'lossless', false),
      candidate('netease', '320k'),
      candidate('kuwo', 'standard'),
    ])

    expect(selected?.source).toBe('netease')
  })
})
