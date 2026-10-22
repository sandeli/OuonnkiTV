import { describe, expect, it } from 'vitest'
import { pickBestCandidate, type AutoPlayCandidate } from './AutoPlayResolveView'

const c = (partial: Partial<AutoPlayCandidate>): AutoPlayCandidate => ({
  sourceId: 's',
  sourceName: '源',
  vodId: '1',
  tier: 2,
  latency: null,
  ...partial,
})

describe('pickBestCandidate', () => {
  it('空候选返回 null', () => {
    expect(pickBestCandidate([])).toBeNull()
  })

  it('档位优先于延迟：档位 0 的慢源胜过档位 2 的快源', () => {
    const best = pickBestCandidate([
      c({ sourceId: 'a', tier: 2, latency: 100 }),
      c({ sourceId: 'b', tier: 0, latency: 900 }),
    ])
    expect(best?.sourceId).toBe('b')
  })

  it('同档位比延迟，已测速优先于未测速', () => {
    const best = pickBestCandidate([
      c({ sourceId: 'a', tier: 1, latency: null }),
      c({ sourceId: 'b', tier: 1, latency: 500 }),
      c({ sourceId: 'd', tier: 1, latency: 200 }),
    ])
    expect(best?.sourceId).toBe('d')
  })

  it('全未测速时返回第一个候选', () => {
    const best = pickBestCandidate([c({ sourceId: 'a' }), c({ sourceId: 'b' })])
    expect(best?.sourceId).toBe('a')
  })
})
