import { describe, expect, it } from 'vitest'
import { pickBestCandidate, type AutoPlayCandidate } from './AutoPlayResolveView'
import type { PlaybackProbeResult } from '@/shared/lib/playbackProbe'

const probe = (partial: Partial<PlaybackProbeResult>): PlaybackProbeResult => ({
  startupMs: 500,
  throughputMbps: 10,
  ...partial,
})

const c = (partial: Partial<AutoPlayCandidate>): AutoPlayCandidate => ({
  sourceId: 's',
  sourceName: '源',
  vodId: '1',
  tier: 2,
  probe: null,
  ...partial,
})

describe('pickBestCandidate', () => {
  it('空候选返回 null', () => {
    expect(pickBestCandidate([])).toBeNull()
  })

  it('档位优先于测速：档位 0 的低余量源胜过档位 2 的高余量源', () => {
    const best = pickBestCandidate([
      c({ sourceId: 'a', tier: 2, probe: probe({ headroom: 8, throughputMbps: 40 }) }),
      c({ sourceId: 'b', tier: 0, probe: probe({ headroom: 1.2, throughputMbps: 6 }) }),
    ])
    expect(best?.sourceId).toBe('b')
  })

  it('同档位比吞吐余量：起播慢但余量大的源胜出（播得稳优先）', () => {
    const best = pickBestCandidate([
      c({ sourceId: 'a', tier: 1, probe: probe({ startupMs: 200, headroom: 1.1, throughputMbps: 5.5 }) }),
      c({ sourceId: 'b', tier: 1, probe: probe({ startupMs: 900, headroom: 4, throughputMbps: 20 }) }),
    ])
    expect(best?.sourceId).toBe('b')
  })

  it('同档位已测速优先于未测速', () => {
    const best = pickBestCandidate([
      c({ sourceId: 'a', tier: 1, probe: null }),
      c({ sourceId: 'b', tier: 1, probe: probe({ headroom: 2 }) }),
    ])
    expect(best?.sourceId).toBe('b')
  })

  it('全未测速时返回第一个候选', () => {
    const best = pickBestCandidate([c({ sourceId: 'a' }), c({ sourceId: 'b' })])
    expect(best?.sourceId).toBe('a')
  })
})
