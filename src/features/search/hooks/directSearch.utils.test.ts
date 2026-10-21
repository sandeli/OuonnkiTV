import { describe, expect, it } from 'vitest'
import type { VideoSource } from '@tgys/cms-core'
import { getSourcesToFetch, getTitleMatchTier } from './directSearch.utils'

function createSource(id: string): VideoSource {
  return {
    id,
    name: id,
    url: `https://example.com/${id}`,
    detailUrl: `https://example.com/${id}`,
    isEnabled: true,
    updatedAt: new Date(),
    timeout: 5000,
    retry: 1,
  }
}

describe('getSourcesToFetch', () => {
  it('无缓存时返回全部启用源', () => {
    const selectedAPIs = [createSource('a'), createSource('b')]
    const result = getSourcesToFetch(selectedAPIs, new Map(), 2)

    expect(result.map(item => item.id)).toEqual(['a', 'b'])
  })

  it('页码超出缓存总页数时跳过该源', () => {
    const selectedAPIs = [createSource('a'), createSource('b'), createSource('c')]
    const cache = new Map([
      ['a', { totalPages: 1, totalResults: 10 }],
      ['b', { totalPages: 3, totalResults: 20 }],
    ])

    const result = getSourcesToFetch(selectedAPIs, cache, 2)

    expect(result.map(item => item.id)).toEqual(['b', 'c'])
    expect(result).toHaveLength(2)
  })
})

describe('getTitleMatchTier', () => {
  it('完全一致为 0 档（忽略标点与空白）', () => {
    expect(getTitleMatchTier('嫁金钗', '嫁金钗')).toBe(0)
    expect(getTitleMatchTier('嫁 金钗', '嫁金钗')).toBe(0)
    expect(getTitleMatchTier('《嫁金钗》', '嫁金钗')).toBe(0)
  })

  it('带季数/年份后缀为 1 档', () => {
    expect(getTitleMatchTier('嫁金钗第一季', '嫁金钗')).toBe(1)
    expect(getTitleMatchTier('嫁金钗', '嫁金钗国语版')).toBe(1)
  })

  it('互相包含为 2 档，完全无关为 3 档', () => {
    expect(getTitleMatchTier('新嫁金钗传奇', '嫁金钗')).toBe(2)
    expect(getTitleMatchTier('金枝欲孽', '嫁金钗')).toBe(3)
    expect(getTitleMatchTier('', '嫁金钗')).toBe(3)
  })
})
