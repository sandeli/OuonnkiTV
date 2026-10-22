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

  it('数字片段误命中要沉底：搜 12 不应把 1234/312 当相关', () => {
    expect(getTitleMatchTier('1234', '12')).toBe(3)
    expect(getTitleMatchTier('312', '12')).toBe(3)
    expect(getTitleMatchTier('120急救', '12')).toBe(3)
  })

  it('数字在词边界上仍算命中', () => {
    expect(getTitleMatchTier('12只猴子', '12')).toBe(1)
    expect(getTitleMatchTier('飞驰人生2', '飞驰人生')).toBe(1)
    expect(getTitleMatchTier('重案六组第12集', '12')).toBe(2)
  })

  it('中文数字与阿拉伯数字互通（季数）', () => {
    expect(getTitleMatchTier('庆余年第二季', '庆余年2')).toBe(0)
    expect(getTitleMatchTier('庆余年第二季', '庆余年')).toBe(1)
    expect(getTitleMatchTier('琅琊榜之风起长林', '琅琊榜2')).toBe(3)
  })

  it('繁简体互通', () => {
    expect(getTitleMatchTier('三體', '三体')).toBe(0)
    expect(getTitleMatchTier('電視劇三體', '三体')).toBe(2)
    expect(getTitleMatchTier('繁體字劇場', '繁体字')).toBe(1)
  })

  it('全角数字与半角互通', () => {
    expect(getTitleMatchTier('１２只猴子', '12')).toBe(1)
  })
})
