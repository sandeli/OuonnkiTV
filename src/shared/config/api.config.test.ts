import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getInitialVideoSources, loadVideoSources, mergeManagedSourceLists } from './api.config'
import { useAuthStore } from '@/shared/store/authStore'

describe('loadVideoSources', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('解析完整配置中的视频源数组', async () => {
    const sources = await loadVideoSources([
      { name: '测试源', url: 'https://video.example.com/api', retry: 0 },
    ])

    expect(sources).toHaveLength(1)
    expect(sources[0]).toMatchObject({
      id: 'env_source_0',
      name: '测试源',
      detailUrl: 'https://video.example.com/api',
      retry: 0,
    })
  })

  it('通过代理加载完整配置中的远程视频源', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([{ name: '远程源', url: 'https://remote.example/api' }]),
    })
    vi.stubGlobal('fetch', fetchMock)

    const sources = await loadVideoSources('https://example.com/sources.json')

    expect(fetchMock).toHaveBeenCalledWith(
      `/proxy?url=${encodeURIComponent('https://example.com/sources.json')}`,
    )
    expect(sources[0]).toMatchObject({ name: '远程源', url: 'https://remote.example/api' })
  })
})

describe('getInitialVideoSources 管理员视频源优先级', () => {
  beforeEach(() => {
    useAuthStore.setState({ authConfig: null })
  })

  it('管理员后台设置非空时优先使用（内联 JSON）', async () => {
    useAuthStore.setState({
      authConfig: {
        initialVideoSources:
          '[{"name":"后台源","url":"https://admin.example/api.php/provide/vod"}]',
      } as never,
    })
    const sources = await getInitialVideoSources()
    expect(sources.map(s => s.name)).toEqual(['后台源'])
  })

  it('管理员设置为空时回退环境变量（测试环境未设则为空）', async () => {
    useAuthStore.setState({
      authConfig: { initialVideoSources: '   ' } as never,
    })
    const sources = await getInitialVideoSources()
    expect(sources).toEqual([])
  })

  it('站长全站源与基础托管源合并：同 id 以全站源为准、独有追加在后、siteWide 透传', async () => {
    useAuthStore.setState({
      authConfig: {
        initialVideoSources:
          '[{"id":"base1","name":"后台源一","url":"https://base1.example/api"},{"id":"shared","name":"旧名","url":"https://shared.example/api"}]',
        siteWideSources:
          '[{"id":"shared","name":"站长改名","url":"https://shared.example/api","siteWide":true},{"id":"own1","name":"站长源","url":"https://own.example/api","siteWide":true}]',
      } as never,
    })
    const sources = await getInitialVideoSources()
    expect(sources.map(s => s.id)).toEqual(['base1', 'shared', 'own1'])
    expect(sources.find(s => s.id === 'shared')?.name).toBe('站长改名')
    expect(sources.find(s => s.id === 'own1')?.siteWide).toBe(true)
    expect(sources.find(s => s.id === 'base1')?.siteWide).toBeUndefined()
  })
})

describe('mergeManagedSourceLists', () => {
  const mk = (id: string, name = id) =>
    ({ id, name, url: `https://${id}.example/api`, isEnabled: true }) as never
  it('extra 为空时原样返回 base', () => {
    const base = [mk('a')]
    expect(mergeManagedSourceLists(base, [])).toBe(base)
  })
  it('同 id 覆盖并保持 extra 顺序追加', () => {
    const out = mergeManagedSourceLists([mk('a'), mk('b')], [mk('b', 'B2'), mk('c')])
    expect(out.map(s => s.id)).toEqual(['a', 'b', 'c'])
    expect(out.find(s => s.id === 'b')?.name).toBe('B2')
  })
})
