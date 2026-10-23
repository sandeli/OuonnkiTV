import { describe, expect, it } from 'vitest'
import {
  matchDanmakuEpisode,
  parseDanmakuComments,
  parseDanmakuSearchResults,
  pickDanmakuAnime,
} from './danmaku'

describe('parseDanmakuSearchResults', () => {
  it('解析 animes 结构并统一字段', () => {
    const results = parseDanmakuSearchResults({
      animes: [
        {
          animeId: 123,
          animeTitle: '嫁金钗',
          episodes: [
            { episodeId: 1001, episodeTitle: '第01集' },
            { episodeId: 1002, episodeTitle: '第02集' },
          ],
        },
      ],
    })
    expect(results).toHaveLength(1)
    expect(results[0].animeId).toBe('123')
    expect(results[0].episodes[1]).toEqual({ episodeId: '1002', episodeTitle: '第02集' })
  })

  it('异常输入返回空数组', () => {
    expect(parseDanmakuSearchResults(null)).toEqual([])
    expect(parseDanmakuSearchResults({})).toEqual([])
  })
})

describe('pickDanmakuAnime', () => {
  const results = parseDanmakuSearchResults({
    animes: [
      {
        animeId: 1,
        animeTitle: '嫁金钗外传',
        episodes: [{ episodeId: 11, episodeTitle: '第01集' }],
      },
      { animeId: 2, animeTitle: '嫁金钗', episodes: [{ episodeId: 21, episodeTitle: '第01集' }] },
      { animeId: 3, animeTitle: '嫁金钗', episodes: [] },
    ],
  })

  it('优先完全一致且有分集的剧集', () => {
    expect(pickDanmakuAnime(results, '嫁金钗')?.animeId).toBe('2')
  })

  it('无结果时返回 null', () => {
    expect(pickDanmakuAnime([], '嫁金钗')).toBeNull()
  })
})

describe('matchDanmakuEpisode', () => {
  const episodes = [
    { episodeId: 'a', episodeTitle: '第01集' },
    { episodeId: 'b', episodeTitle: '第02集' },
    { episodeId: 'c', episodeTitle: '第12集' },
  ]

  it('按集号匹配（阿拉伯数字）', () => {
    expect(matchDanmakuEpisode(episodes, '第2集', 0)?.episodeId).toBe('b')
    expect(matchDanmakuEpisode(episodes, 'EP12', 0)?.episodeId).toBe('c')
  })

  it('按集号匹配（中文数字）', () => {
    expect(matchDanmakuEpisode(episodes, '第十二集', 0)?.episodeId).toBe('c')
  })

  it('无集号时按序号退回', () => {
    expect(matchDanmakuEpisode(episodes, '正片', 1)?.episodeId).toBe('b')
  })
})

describe('parseDanmakuComments', () => {
  it('解析 p/m 格式：模式与颜色映射正确', () => {
    const items = parseDanmakuComments({
      count: 3,
      comments: [
        { p: '12.5,1,16777215', m: '普通滚动' },
        { p: '3.0,5,16711680', m: '顶部弹幕' },
        { p: '7.2,4,0', m: '底部弹幕' },
      ],
    })
    expect(items).toHaveLength(3)
    // 按时间排序后：顶部(3s) / 底部(7.2s) / 滚动(12.5s)
    expect(items[0]).toMatchObject({ text: '顶部弹幕', mode: 1, color: '#ff0000' })
    expect(items[1]).toMatchObject({ text: '底部弹幕', mode: 2 })
    expect(items[1].color).toBeUndefined()
    expect(items[2]).toMatchObject({ text: '普通滚动', mode: 0, color: '#ffffff' })
  })

  it('兼容已归一化的 {text,time,type} 格式', () => {
    const items = parseDanmakuComments({
      data: [{ text: 'hi', time: 1.5, type: 'top', color: '#00ff00' }],
    })
    expect(items[0]).toMatchObject({ text: 'hi', mode: 1, color: '#00ff00' })
  })
})

describe('loadDanmakuForEpisode 清晰化处理', () => {
  it('每条弹幕带文字描边、字重 700 与默认清晰黑体；可指定字体覆盖', async () => {
    const { loadDanmakuForEpisode, DANMAKU_DEFAULT_FONT_FAMILY } = await import('./danmaku')
    const { vi } = await import('vitest')

    const searchJson = {
      animes: [
        { animeId: 1, animeTitle: '嫁金钗', episodes: [{ episodeId: 1001, episodeTitle: '第01集' }] },
      ],
    }
    const commentsJson = { count: 1, comments: [{ p: '1.0,1,16777215', m: '测试弹幕' }] }
    let call = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        call += 1
        return { ok: true, json: async () => (call === 1 ? searchJson : commentsJson) }
      }),
    )

    const items = await loadDanmakuForEpisode('https://danmu.test', '嫁金钗', '第01集', 0)
    expect(items).toHaveLength(1)
    expect(items[0].style?.fontWeight).toBe('700')
    expect(items[0].style?.fontFamily).toBe(DANMAKU_DEFAULT_FONT_FAMILY)
    expect(items[0].style?.textShadow).toContain('rgba(0,0,0')

    call = 0
    const custom = await loadDanmakuForEpisode('https://danmu.test', '嫁金钗', '第01集', 0, 'SimHei')
    expect(custom[0].style?.fontFamily).toBe('SimHei')

    vi.unstubAllGlobals()
  })
})

describe('弹幕速度换算', () => {
  it('倍率 -> 时长：1 倍 = 5 秒，0.2 倍 = 25 秒（突破插件 10 秒上限靠这个值）', async () => {
    const { danmakuDurationFromMultiplier } = await import('./danmaku')
    expect(danmakuDurationFromMultiplier(1)).toBe(5)
    expect(danmakuDurationFromMultiplier(0.2)).toBe(25)
    expect(danmakuDurationFromMultiplier(2)).toBe(2.5)
    expect(danmakuDurationFromMultiplier(0)).toBe(5)
  })

  it('时长 -> 倍率：钳制在 0.2 ~ 2', async () => {
    const { danmakuMultiplierFromDuration } = await import('./danmaku')
    expect(danmakuMultiplierFromDuration(25)).toBe(0.2)
    expect(danmakuMultiplierFromDuration(10)).toBe(0.5)
    expect(danmakuMultiplierFromDuration(5)).toBe(1)
    expect(danmakuMultiplierFromDuration(1)).toBe(2)
    expect(danmakuMultiplierFromDuration(0)).toBe(1)
  })
})

describe('resolveDanmakuApiUrl 优先级', () => {
  it('用户自有地址最高优先，并去掉末尾斜杠', async () => {
    const { useAuthStore } = await import('@/shared/store/authStore')
    useAuthStore.setState({
      authConfig: { siteBehavior: { danmakuApiUrl: 'https://site.example.com' } } as never,
    })
    const { resolveDanmakuApiUrl } = await import('./danmaku')
    expect(resolveDanmakuApiUrl('https://own.example.com/')).toBe('https://own.example.com')
  })

  it('用户未填时用管理员后台的站点默认接口', async () => {
    const { useAuthStore } = await import('@/shared/store/authStore')
    useAuthStore.setState({
      authConfig: { siteBehavior: { danmakuApiUrl: 'https://site.example.com/' } } as never,
    })
    const { resolveDanmakuApiUrl } = await import('./danmaku')
    expect(resolveDanmakuApiUrl('')).toBe('https://site.example.com')
    expect(resolveDanmakuApiUrl(undefined)).toBe('https://site.example.com')
  })

  it('用户与站点都没设置时返回空串（测试环境无部署变量）', async () => {
    const { useAuthStore } = await import('@/shared/store/authStore')
    useAuthStore.setState({ authConfig: { siteBehavior: {} } as never })
    const { resolveDanmakuApiUrl } = await import('./danmaku')
    expect(resolveDanmakuApiUrl('')).toBe('')
  })
})
