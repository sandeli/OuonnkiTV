import { describe, it, expect } from 'vitest'
import { loadVideoSources } from './api.config'
import { buildSearchUrl } from '../../../packages/cms-core/src/utils/url'

// KVideo 源格式样本（字段 baseUrl / enabled，含 xinlangapi.php 变体）
const KVIDEO_STYLE_SOURCES = [
  {
    id: 'iqiyi',
    name: '🎬-爱奇艺-',
    baseUrl: 'https://iqiyizyapi.com/api.php/provide/vod',
    group: 'normal',
    enabled: true,
    priority: 1,
  },
  {
    id: 'xinlang',
    name: '🎬新浪资源',
    baseUrl: 'https://api.xinlangapi.com/xinlangapi.php/provide/vod',
    group: 'normal',
    enabled: false,
    priority: 1,
  },
]

describe('KVideo 源格式兼容', () => {
  it('baseUrl 映射为 url，enabled 映射为 isEnabled', async () => {
    const sources = await loadVideoSources(KVIDEO_STYLE_SOURCES as never)
    expect(sources.length).toBe(2)
    expect(sources[0].url).toBe('https://iqiyizyapi.com/api.php/provide/vod')
    expect(sources[0].detailUrl).toBe('https://iqiyizyapi.com/api.php/provide/vod')
    expect(sources[0].isEnabled).toBe(true)
    expect(sources[1].isEnabled).toBe(false)
  })

  it('拼搜索地址不重复路径（含 xinlangapi.php 变体）', () => {
    expect(buildSearchUrl('https://iqiyizyapi.com/api.php/provide/vod', '测试', 1)).toBe(
      'https://iqiyizyapi.com/api.php/provide/vod?ac=videolist&wd=%E6%B5%8B%E8%AF%95',
    )
    expect(buildSearchUrl('https://api.xinlangapi.com/xinlangapi.php/provide/vod', '测试', 1)).toBe(
      'https://api.xinlangapi.com/xinlangapi.php/provide/vod?ac=videolist&wd=%E6%B5%8B%E8%AF%95',
    )
    expect(buildSearchUrl('https://example.com', '测试', 1)).toBe(
      'https://example.com/api.php/provide/vod/?ac=videolist&wd=%E6%B5%8B%E8%AF%95',
    )
  })
})
