import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getInitialVideoSources, loadVideoSources } from './api.config'
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
})
