import { describe, expect, it } from 'vitest'
import {
  buildCmsUrl,
  decodeAggId,
  encodeAggId,
  findTvboxUserId,
  getOrCreateTvboxToken,
  parseManagedSourcesJson,
  resetTvboxToken,
  splitPlayGroups,
  titleTier,
} from './tvbox'
import type { D1Database } from './auth'

/** 只实现 tvbox_tokens 两条查询与两种写入的最小 D1 假实现 */
function fakeDb(): D1Database & { rows: Map<string, number> } {
  const rows = new Map<string, number>() // token -> user_id
  const byUser = new Map<number, string>()
  const db = {
    rows,
    prepare: (sql: string) => ({
      bind: (...args: unknown[]) => ({
        first: async () => {
          if (sql.includes('SELECT token FROM tvbox_tokens WHERE user_id')) {
            const t = byUser.get(args[0] as number)
            return t ? { token: t } : null
          }
          if (sql.includes('SELECT user_id AS userId FROM tvbox_tokens WHERE token')) {
            const uid = rows.get(args[0] as string)
            return uid !== undefined ? { userId: uid } : null
          }
          return null
        },
        run: async () => {
          const [token, userId] = args as [string, number, number]
          if (sql.includes('ON CONFLICT')) {
            const old = byUser.get(userId)
            if (old) rows.delete(old)
            rows.set(token, userId)
            byUser.set(userId, token)
          } else if (!byUser.has(userId)) {
            rows.set(token, userId)
            byUser.set(userId, token)
          }
          return { success: true }
        },
      }),
    }),
  }
  return db as unknown as D1Database & { rows: Map<string, number> }
}

describe('TVBox 令牌', () => {
  it('生成后稳定复用，重置后旧令牌失效', async () => {
    const db = fakeDb()
    const t1 = await getOrCreateTvboxToken(db, 7)
    expect(t1).toMatch(/^[0-9a-f]{32}$/)
    expect(await getOrCreateTvboxToken(db, 7)).toBe(t1)
    expect(await findTvboxUserId(db, t1)).toBe(7)

    const t2 = await resetTvboxToken(db, 7)
    expect(t2).not.toBe(t1)
    expect(await findTvboxUserId(db, t1)).toBeNull()
    expect(await findTvboxUserId(db, t2)).toBe(7)
  })
  it('不同用户令牌不同；站长（0）也可持有', async () => {
    const db = fakeDb()
    const a = await getOrCreateTvboxToken(db, 0)
    const b = await getOrCreateTvboxToken(db, 3)
    expect(a).not.toBe(b)
    expect(await findTvboxUserId(db, a)).toBe(0)
  })
})

describe('源清单解析', () => {
  it('标准与 KVideo 两种格式都认，缺 id 时生成', () => {
    const entries = parseManagedSourcesJson(
      JSON.stringify([
        { id: 'a', name: '甲', url: 'https://a.tv/api.php/provide/vod/', isEnabled: true },
        { name: '乙', baseUrl: 'https://b.tv/api.php/provide/vod/', enabled: false },
        { name: '无地址' },
      ]),
    )
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({ id: 'a', api: 'https://a.tv/api.php/provide/vod/' })
    expect(entries[1].enabled).toBe(false)
    expect(entries[1].id).toBeTruthy()
  })
  it('坏 JSON 返回空', () => {
    expect(parseManagedSourcesJson('not json')).toEqual([])
  })
})

describe('协议拼装', () => {
  it('buildCmsUrl：已含 provide/vod 只拼参数，否则补路径', () => {
    expect(buildCmsUrl('https://x.tv/api.php/provide/vod/', 'ac=videolist')).toBe(
      'https://x.tv/api.php/provide/vod?ac=videolist',
    )
    expect(buildCmsUrl('https://x.tv', 'ac=videolist')).toBe(
      'https://x.tv/api.php/provide/vod/?ac=videolist',
    )
  })
  it('聚合 id 编解码', () => {
    expect(decodeAggId(encodeAggId('ikun', '12345'))).toEqual({
      sourceId: 'ikun',
      vodId: '12345',
    })
    expect(decodeAggId('noseparator')).toBeNull()
  })
  it('标题档位', () => {
    expect(titleTier('凡人修仙传', '凡人修仙传')).toBe(0)
    expect(titleTier('凡人修仙传 年番', '凡人修仙传')).toBe(1)
    expect(titleTier('重生之凡人修仙传外传', '凡人修仙传')).toBe(2)
    expect(titleTier('斗破苍穹', '凡人修仙传')).toBe(3)
  })
  it('播放分组拆分', () => {
    const groups = splitPlayGroups('源A$$$源B', '第1集$http://a/1.m3u8#第2集$http://a/2.m3u8$$$正片$http://b/1.m3u8')
    expect(groups).toHaveLength(2)
    expect(groups[0].episodes).toHaveLength(2)
    expect(groups[1].from).toBe('源B')
  })
})

describe('豆瓣图片墙', () => {
  it('分类与网站首页一致（9 个，含日本动画标签）', async () => {
    const { DOUBAN_WALL_CATEGORIES } = await import('./tvbox')
    expect(DOUBAN_WALL_CATEGORIES.map(c => c.label)).toEqual([
      '热门电影',
      '国产剧',
      '韩剧',
      '美剧',
      '日剧',
      '热门综艺',
      '热门动漫',
      '豆瓣高分',
      '经典电影',
    ])
    expect(DOUBAN_WALL_CATEGORIES.find(c => c.label === '热门动漫')?.tag).toBe('日本动画')
  })
  it('墙 id 编解码', async () => {
    const { decodeWallTitle, encodeWallId } = await import('./tvbox')
    expect(decodeWallTitle(encodeWallId('凡人修仙传'))).toBe('凡人修仙传')
    expect(decodeWallTitle('ikun__123')).toBeNull()
    expect(decodeWallTitle('wall__')).toBeNull()
  })
  it('豆瓣条目映射：海报带防盗链提示，评分进备注，无标题跳过', async () => {
    const { mapDoubanSubjects } = await import('./tvbox')
    const items = mapDoubanSubjects([
      { title: '片甲', cover: 'https://img1.doubanio.com/x.jpg', rate: '8.7' },
      { title: '', cover: 'https://img1.doubanio.com/y.jpg' },
      { title: '片乙' },
    ])
    expect(items).toHaveLength(2)
    expect(items[0].vod_id).toBe('wall__片甲')
    expect(String(items[0].vod_pic)).toContain('@Referer=https://movie.douban.com/')
    expect(items[0].vod_remarks).toBe('⭐ 8.7')
    expect(items[1].vod_pic).toBe('')
  })
})

describe('分片吞吐测速的纯逻辑', () => {
  it('主清单取子清单、媒体清单取首分片（相对地址解析）', async () => {
    const { firstSegmentUrl, variantPlaylistUrl } = await import('./tvbox')
    const master = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=1280x720\nsub/index.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=400000\nlow.m3u8'
    expect(variantPlaylistUrl(master, 'https://cdn.tv/live/main.m3u8')).toBe(
      'https://cdn.tv/live/sub/index.m3u8',
    )
    expect(variantPlaylistUrl('#EXTM3U\n#EXTINF:10,\nseg0.ts', 'https://cdn.tv/a.m3u8')).toBe('')
    const media = '#EXTM3U\n#EXT-X-TARGETDURATION:10\n#EXTINF:9.9,\nseg-0.ts\n#EXTINF:9.9,\nseg-1.ts'
    expect(firstSegmentUrl(media, 'https://cdn.tv/v/abc.m3u8?token=1')).toBe(
      'https://cdn.tv/v/seg-0.ts',
    )
    expect(firstSegmentUrl('#EXTM3U\n#EXT-X-ENDLIST', 'https://cdn.tv/a.m3u8')).toBe('')
  })
  it('吞吐格式化', async () => {
    const { formatThroughput } = await import('./tvbox')
    expect(formatThroughput(850)).toBe('850KB/s')
    expect(formatThroughput(2048)).toBe('2.0MB/s')
    expect(formatThroughput(0.2)).toBe('1KB/s')
  })
})
  it('从分享页文本提取 m3u8（保留查询串）', async () => {
    const { extractM3u8Url } = await import('./tvbox')
    expect(extractM3u8Url('var u="https://cdn.tv/x/index.m3u8?token=abc";')).toBe(
      'https://cdn.tv/x/index.m3u8?token=abc',
    )
    expect(extractM3u8Url('<html>没有视频地址</html>')).toBe('')
  })

describe('聚合详情的子请求预算', () => {
  it('传入已知命中时不再逐源搜索，且详情带测速标签', async () => {
    const { aggDetail } = await import('./tvbox')
    const calls: string[] = []
    const segBytes = new Uint8Array(300 * 1024)
    const detailRecord = (name: string, ep: string) => ({
      vod_id: '42',
      vod_name: name,
      vod_play_from: '主线',
      vod_play_url: `第1集$${ep}`,
    })
    const stub = async (input: unknown) => {
      const url = String(input)
      calls.push(url)
      if (url.includes('a.test') && url.includes('ids=')) {
        return new Response(JSON.stringify({ list: [detailRecord('测试片', 'https://cdn.test/a.m3u8')] }), {
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.includes('b.test') && url.includes('ids=')) {
        return new Response(JSON.stringify({ list: [detailRecord('测试片', 'https://cdn.test/b.m3u8')] }), {
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.endsWith('.m3u8')) {
        return new Response('#EXTM3U\n#EXTINF:10,\nseg0.ts', {
          headers: { 'Content-Type': 'application/vnd.apple.mpegurl' },
        })
      }
      if (url.includes('seg0.ts')) {
        return new Response(segBytes, { headers: { 'Content-Type': 'video/mp2t' } })
      }
      return new Response('{}', { status: 404 })
    }
    const { vi } = await import('vitest')
    vi.stubGlobal('fetch', stub)
    try {
      const sources = [
        { id: 'a', name: '源A', api: 'https://a.test/api.php/provide/vod/' },
        { id: 'b', name: '源B', api: 'https://b.test/api.php/provide/vod/' },
      ]
      const record = await aggDetail(sources, 'a', '42', [
        { sourceId: 'a', vodId: '42', tier: 0 },
        { sourceId: 'b', vodId: '42', tier: 0 },
      ])
      expect(record).not.toBeNull()
      // 关键：全程没有发出任何 wd= 搜索请求
      expect(calls.some(u => u.includes('wd='))).toBe(false)
      // 两条线路都测通并带 ⚡ 吞吐标签
      expect(String(record?.vod_play_from)).toContain('⚡')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
