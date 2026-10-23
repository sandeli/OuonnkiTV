import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildDoubanDataRequestUrl,
  buildDoubanPosterUrl,
  DOUBAN_CATEGORIES,
  fetchDoubanCategory,
  resolveDoubanProxyConfig,
} from './douban'
import type { DoubanCategory } from './douban'
import type { DoubanProxyConfig } from './authApi'

const SITE_PROXY = '/proxy?url='
const TARGET = 'https://movie.douban.com/j/search_subjects?type=movie&tag=%E7%83%AD%E9%97%A8'
const COVER = 'https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2927066381.jpg'

function cfg(partial: Partial<DoubanProxyConfig>): DoubanProxyConfig {
  return { dataType: 'direct', dataUrl: '', imageType: 'server', imageUrl: '', ...partial }
}

describe('buildDoubanDataRequestUrl', () => {
  it('direct 走本站代理', () => {
    expect(buildDoubanDataRequestUrl(TARGET, cfg({}), SITE_PROXY)).toBe(
      `${SITE_PROXY}${encodeURIComponent(TARGET)}`,
    )
  })

  it('zwei 走 ciao-cors 前缀', () => {
    expect(buildDoubanDataRequestUrl(TARGET, cfg({ dataType: 'cors-proxy-zwei' }), SITE_PROXY)).toBe(
      `https://ciao-cors.is-an.org/${encodeURIComponent(TARGET)}`,
    )
  })

  it('cmliussss 镜像只换域名不走代理', () => {
    expect(
      buildDoubanDataRequestUrl(TARGET, cfg({ dataType: 'cmliussss-cdn-tencent' }), SITE_PROXY),
    ).toBe(TARGET.replace('movie.douban.com', 'movie.douban.cmliussss.net'))
    expect(
      buildDoubanDataRequestUrl(TARGET, cfg({ dataType: 'cmliussss-cdn-ali' }), SITE_PROXY),
    ).toBe(TARGET.replace('movie.douban.com', 'movie.douban.cmliussss.com'))
  })

  it('custom 用自定义前缀；未填时回退本站代理', () => {
    expect(
      buildDoubanDataRequestUrl(
        TARGET,
        cfg({ dataType: 'custom', dataUrl: 'https://p.example.com/?u=' }),
        SITE_PROXY,
      ),
    ).toBe(`https://p.example.com/?u=${encodeURIComponent(TARGET)}`)
    expect(buildDoubanDataRequestUrl(TARGET, cfg({ dataType: 'custom' }), SITE_PROXY)).toBe(
      `${SITE_PROXY}${encodeURIComponent(TARGET)}`,
    )
  })
})

describe('buildDoubanPosterUrl', () => {
  it('server（默认）经本站代理', () => {
    expect(buildDoubanPosterUrl(COVER, cfg({}), SITE_PROXY)).toBe(
      `${SITE_PROXY}${encodeURIComponent(COVER)}`,
    )
  })

  it('direct 返回原图地址', () => {
    expect(buildDoubanPosterUrl(COVER, cfg({ imageType: 'direct' }), SITE_PROXY)).toBe(COVER)
  })

  it('img3 与 cmliussss 镜像换域名', () => {
    expect(buildDoubanPosterUrl(COVER, cfg({ imageType: 'img3' }), SITE_PROXY)).toBe(
      COVER.replace('img1.doubanio.com', 'img3.doubanio.com'),
    )
    expect(
      buildDoubanPosterUrl(COVER, cfg({ imageType: 'cmliussss-cdn-tencent' }), SITE_PROXY),
    ).toBe(COVER.replace('img1.doubanio.com', 'img.doubanio.cmliussss.net'))
    expect(buildDoubanPosterUrl(COVER, cfg({ imageType: 'cmliussss-cdn-ali' }), SITE_PROXY)).toBe(
      COVER.replace('img1.doubanio.com', 'img.doubanio.cmliussss.com'),
    )
  })

  it('custom 用自定义前缀；未填时回退本站代理', () => {
    expect(
      buildDoubanPosterUrl(
        COVER,
        cfg({ imageType: 'custom', imageUrl: 'https://p.example.com/?u=' }),
        SITE_PROXY,
      ),
    ).toBe(`https://p.example.com/?u=${encodeURIComponent(COVER)}`)
    expect(buildDoubanPosterUrl(COVER, cfg({ imageType: 'custom' }), SITE_PROXY)).toBe(
      `${SITE_PROXY}${encodeURIComponent(COVER)}`,
    )
  })

  it('非豆瓣图与空值原样返回', () => {
    const other = 'https://cdn.example.com/poster.jpg'
    expect(buildDoubanPosterUrl(other, cfg({ imageType: 'direct' }), SITE_PROXY)).toBe(other)
    expect(buildDoubanPosterUrl('', cfg({}), SITE_PROXY)).toBe('')
  })
})

describe('resolveDoubanProxyConfig', () => {
  const admin: DoubanProxyConfig = {
    dataType: 'cmliussss-cdn-tencent',
    dataUrl: '',
    imageType: 'server',
    imageUrl: '',
  }

  it('无覆盖时完全跟随管理员设置', () => {
    const resolved = resolveDoubanProxyConfig(admin, {
      dataType: null,
      dataUrl: '',
      imageType: null,
      imageUrl: '',
    })
    expect(resolved).toEqual(admin)
  })

  it('只覆盖图片时数据仍跟随管理员', () => {
    const resolved = resolveDoubanProxyConfig(admin, {
      dataType: null,
      dataUrl: '',
      imageType: 'direct',
      imageUrl: '',
    })
    expect(resolved.dataType).toBe('cmliussss-cdn-tencent')
    expect(resolved.imageType).toBe('direct')
  })

  it('覆盖为自定义时用自己的地址而非管理员的', () => {
    const resolved = resolveDoubanProxyConfig(
      { ...admin, dataType: 'custom', dataUrl: 'https://admin.example/?url=' },
      {
        dataType: 'custom',
        dataUrl: 'https://mine.example/?url=',
        imageType: null,
        imageUrl: '',
      },
    )
    expect(resolved.dataUrl).toBe('https://mine.example/?url=')
  })
})

describe('DOUBAN_CATEGORIES 标签有效性', () => {
  it('热门动漫使用豆瓣官方标签「日本动画」（tv 侧不存在「动画」标签，恒为空）', () => {
    const anime = DOUBAN_CATEGORIES.find(x => x.label === '热门动漫')
    expect(anime).toMatchObject({ type: 'tv', tag: '日本动画' })
    expect(DOUBAN_CATEGORIES.some(x => x.type === 'tv' && x.tag === '动画')).toBe(false)
  })
})

describe('DOUBAN_CATEGORIES', () => {
  it('国产剧取代热门剧集（type=tv、tag=国产剧）', () => {
    const labels = DOUBAN_CATEGORIES.map(x => x.label)
    expect(labels).toContain('国产剧')
    expect(labels).not.toContain('热门剧集')
    expect(DOUBAN_CATEGORIES.find(x => x.label === '国产剧')).toMatchObject({
      type: 'tv',
      tag: '国产剧',
    })
  })
})

describe('fetchDoubanCategory 缓存与重试', () => {
  const cat = (tag: string): DoubanCategory => ({ label: tag, type: 'movie', tag })
  const okJson = (subjects: unknown[]) => ({
    ok: true,
    json: async () => ({ subjects }),
  })
  const oneSubject = [
    { id: '1', title: '片名', rate: '8.0', cover: 'https://img1.doubanio.com/x.jpg', url: '' },
  ]

  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('成功后写入持久缓存，同分类二次调用不再发请求', async () => {
    const fetchMock = vi.fn(async () => okJson(oneSubject))
    vi.stubGlobal('fetch', fetchMock)
    const a = await fetchDoubanCategory(cat('缓存测试'))
    const b = await fetchDoubanCategory(cat('缓存测试'))
    expect(a).toHaveLength(1)
    expect(b).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(
      Object.keys(localStorage).some(k => k.startsWith('tgys-douban-cache:')),
    ).toBe(true)
  })

  it('首次失败会退避重试，第二次成功即返回数据', async () => {
    vi.useFakeTimers()
    let calls = 0
    const fetchMock = vi.fn(async () => {
      calls += 1
      return calls === 1 ? { ok: false, json: async () => ({}) } : okJson(oneSubject)
    })
    vi.stubGlobal('fetch', fetchMock)
    const promise = fetchDoubanCategory(cat('重试测试'))
    await vi.advanceTimersByTimeAsync(1000)
    const items = await promise
    expect(items).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('过期持久缓存先返回旧数据，并触发后台刷新', async () => {
    const target = cat('过期测试')
    const fetchMock = vi.fn(async () => okJson(oneSubject))
    vi.stubGlobal('fetch', fetchMock)
    // 先拉一次写入持久缓存，然后把缓存时间改到 2 小时前（TTL 1 小时 → 已过期）
    await fetchDoubanCategory(target)
    const key = Object.keys(localStorage).find(k => k.startsWith('tgys-douban-cache:'))!
    const stale = [{ id: '9', title: '旧片', rate: '', cover: '', url: '' }]
    localStorage.setItem(key, JSON.stringify({ at: Date.now() - 2 * 3600_000, items: stale }))
    // 重置模块清空内存缓存（localStorage 保留），模拟重开浏览器
    vi.resetModules()
    const fresh = await import('./douban')
    const items = await fresh.fetchDoubanCategory(target)
    // 立即拿到的是过期旧数据（不阻塞等待网络）
    expect(items).toEqual(stale)
    // 后台刷新已触发：等待其完成，持久缓存应被新数据覆盖
    await new Promise(r => setTimeout(r, 50))
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(JSON.parse(localStorage.getItem(key)!).items[0].title).toBe('片名')
  })
})

describe('fetchDoubanCategoryFull 整页拉取', () => {
  const cat = (tag: string): DoubanCategory => ({ label: tag, type: 'movie', tag })
  const subject = (id: number) => ({
    id: String(id),
    title: `片名${id}`,
    rate: '8.0',
    cover: 'https://img1.doubanio.com/x.jpg',
    url: '',
  })
  const okJson = (subjects: unknown[]) => ({ ok: true, json: async () => ({ subjects }) })

  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('分页合并 5 页凑满 100 条并写入独立缓存', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const decoded = decodeURIComponent(String(url))
      const start = Number(/page_start=(\d+)/.exec(decoded)?.[1] ?? 0)
      return okJson(Array.from({ length: 20 }, (_, i) => subject(start + i + 1)))
    })
    vi.stubGlobal('fetch', fetchMock)
    const mod = await import('./douban')
    const items = await mod.fetchDoubanCategoryFull(cat('整页合并测试'))
    expect(items).toHaveLength(100)
    expect(fetchMock).toHaveBeenCalledTimes(5)
    // 二次调用命中缓存，不再发请求
    const again = await mod.fetchDoubanCategoryFull(cat('整页合并测试'))
    expect(again).toHaveLength(100)
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })

  it('分页之间有重叠条目时按 id 去重', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const decoded = decodeURIComponent(String(url))
      const start = Number(/page_start=(\d+)/.exec(decoded)?.[1] ?? 0)
      const ids = Array.from({ length: 20 }, (_, i) => start + i + 1)
      if (start === 20) ids[0] = 20 // 与上一页末尾重叠 1 条（推荐列表位次漂移的真实情况）
      return okJson(ids.map(subject))
    })
    vi.stubGlobal('fetch', fetchMock)
    const items = await (
      await import('./douban')
    ).fetchDoubanCategoryFull(cat('整页去重测试'))
    expect(new Set(items.map(i => i.id)).size).toBe(items.length)
    expect(items.length).toBeLessThanOrEqual(100)
    expect(items.length).toBeGreaterThanOrEqual(95)
  })

  it('某一页彻底失败时返回已拉到的部分', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const decoded = decodeURIComponent(String(url))
      const start = Number(/page_start=(\d+)/.exec(decoded)?.[1] ?? 0)
      if (start >= 40) return { ok: false, json: async () => ({}) }
      return okJson(Array.from({ length: 20 }, (_, i) => subject(start + i + 1)))
    })
    vi.stubGlobal('fetch', fetchMock)
    const items = await (
      await import('./douban')
    ).fetchDoubanCategoryFull(cat('整页部分失败测试'))
    expect(items).toHaveLength(40)
  })
})
