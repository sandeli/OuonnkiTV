import { getPublicEnv } from '@/shared/config/runtimeEnv'
import { useSettingStore } from '@/shared/store/settingStore'
import { buildProxyRequestUrl } from '@/shared/config/api.config'

/**
 * 弹幕数据层（弹弹play 兼容接口 / danmu_api 协议）：
 * 1. 按片名搜索剧集：GET {api}/api/v2/search/episodes?anime=<片名>
 * 2. 匹配剧集与集数后拉取评论：GET {api}/api/v2/comment/<episodeId>?withRelated=true
 * 请求统一走本站 /proxy（遵循网络设置），避免接口跨域问题。
 *
 * 接口地址优先级：用户在播放设置中填的自有地址 > 部署变量 TGYS_DANMAKU_API_URL > 无（不启用弹幕）。
 */

/** artplayer-plugin-danmuku 的弹幕项（mode: 0 滚动 / 1 顶部 / 2 底部） */
export interface DanmakuItem {
  text: string
  time: number
  mode: 0 | 1 | 2
  color?: string
  style?: { fontFamily?: string; fontWeight?: string; textShadow?: string }
}

/** 弹幕文字描边（多向文字阴影模拟描边，无边框，复杂画面上也清晰） */
export const DANMAKU_TEXT_SHADOW =
  '1px 0 0 rgba(0,0,0,0.85), -1px 0 0 rgba(0,0,0,0.85), 0 1px 0 rgba(0,0,0,0.85), 0 -1px 0 rgba(0,0,0,0.85), 1px 1px 0 rgba(0,0,0,0.85), -1px -1px 0 rgba(0,0,0,0.85), -1px 1px 0 rgba(0,0,0,0.85), 1px -1px 0 rgba(0,0,0,0.85)'

/** 默认弹幕字体：清晰优先的黑体栈（各系统取可用的第一种） */
export const DANMAKU_DEFAULT_FONT_FAMILY =
  '"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", sans-serif'

export interface DanmakuEpisode {
  episodeId: string
  episodeTitle: string
}

export interface DanmakuAnime {
  animeId: string
  animeTitle: string
  episodes: DanmakuEpisode[]
}

/** 解析最终生效的弹幕接口地址：用户自有地址优先，其次部署变量；都没有返回空串 */
export function resolveDanmakuApiUrl(userUrl?: string | null): string {
  const own = (userUrl ?? '').trim().replace(/\/+$/, '')
  if (own) return own
  return (getPublicEnv('TGYS_DANMAKU_API_URL') ?? '').trim().replace(/\/+$/, '')
}

function normalizeTitle(text: string): string {
  return text.toLowerCase().replace(/[\s·•・:：\-—_()（）[\]《》"“”'‘’.,，。!！?？/\\|]/g, '')
}

/** 标题匹配档位（越小越精准）：0 完全一致 / 1 开头一致 / 2 互相包含 / 3 无关 */
function titleTier(title: string, query: string): number {
  const t = normalizeTitle(title)
  const q = normalizeTitle(query)
  if (!t || !q) return 3
  if (t === q) return 0
  if (t.startsWith(q) || q.startsWith(t)) return 1
  if (t.includes(q) || q.includes(t)) return 2
  return 3
}

/** 解析弹幕接口的剧集搜索结果 */
export function parseDanmakuSearchResults(data: unknown): DanmakuAnime[] {
  const record = data as Record<string, unknown> | null
  const animes = (record?.animes ?? record?.data ?? (Array.isArray(data) ? data : [])) as Array<
    Record<string, unknown>
  >
  if (!Array.isArray(animes)) return []
  return animes.map(a => ({
    animeId: String(a.animeId ?? a.id ?? ''),
    animeTitle: String(a.animeTitle ?? a.title ?? ''),
    episodes: (Array.isArray(a.episodes) ? a.episodes : []).map(ep => {
      const e = ep as Record<string, unknown>
      return {
        episodeId: String(e.episodeId ?? e.id ?? ''),
        episodeTitle: String(e.episodeTitle ?? e.title ?? ''),
      }
    }),
  }))
}

/** 在搜索结果中挑最匹配片名、且有分集数据的剧集；都不匹配时退回第一个有分集的 */
export function pickDanmakuAnime(results: DanmakuAnime[], title: string): DanmakuAnime | null {
  const usable = results.filter(r => r.episodes.length > 0)
  if (usable.length === 0) return null
  let best = usable[0]
  let bestTier = titleTier(best.animeTitle, title)
  for (const candidate of usable.slice(1)) {
    const tier = titleTier(candidate.animeTitle, title)
    if (tier < bestTier) {
      best = candidate
      bestTier = tier
      if (tier === 0) break
    }
  }
  return best
}

const CHINESE_NUMS: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
  十一: 11,
  十二: 12,
  十三: 13,
  十四: 14,
  十五: 15,
  十六: 16,
  十七: 17,
  十八: 18,
  十九: 19,
  二十: 20,
  二十一: 21,
  二十二: 22,
  二十三: 23,
  二十四: 24,
  二十五: 25,
  二十六: 26,
  二十七: 27,
  二十八: 28,
  二十九: 29,
  三十: 30,
}

function extractEpisodeNumber(str: string): number | null {
  const digitMatch = str.match(/(\d+)/)
  if (digitMatch) return parseInt(digitMatch[1], 10)
  // 按长度从长到短匹配，避免「十二」先被「一」截胡
  const entries = Object.entries(CHINESE_NUMS).sort((a, b) => b[0].length - a[0].length)
  for (const [cn, num] of entries) {
    if (str.includes(cn)) return num
  }
  return null
}

/**
 * 集数匹配（移植自 KVideo 的已验证逻辑）：先按集号（阿拉伯/中文数字）精确匹配，
 * 再按标题全等匹配，最后退回同序号分集。
 */
export function matchDanmakuEpisode(
  episodes: DanmakuEpisode[],
  episodeName: string,
  episodeIndex?: number,
): DanmakuEpisode | null {
  if (episodes.length === 0) return null

  const localNum = extractEpisodeNumber(episodeName)
  if (localNum !== null) {
    for (const ep of episodes) {
      if (extractEpisodeNumber(ep.episodeTitle) === localNum) return ep
    }
  }

  const normalized = episodeName.trim().toLowerCase()
  for (const ep of episodes) {
    if (ep.episodeTitle.trim().toLowerCase() === normalized) return ep
  }

  if (episodeIndex !== undefined && episodeIndex >= 0 && episodeIndex < episodes.length) {
    return episodes[episodeIndex]
  }
  return episodes[0] ?? null
}

/**
 * 解析弹幕评论为播放器弹幕项。
 * 接口格式：{ comments: [{ p: "时间,模式,颜色", m: "文本"}]}，
 * 模式 5 = 顶部、4 = 底部、其余 = 滚动；颜色为十进制 RGB。
 */
export function parseDanmakuComments(data: unknown): DanmakuItem[] {
  const record = data as Record<string, unknown> | null
  const comments = (record?.comments ?? record?.data ?? (Array.isArray(data) ? data : [])) as Array<
    Record<string, unknown>
  >
  if (!Array.isArray(comments)) return []

  const items: DanmakuItem[] = []
  for (const c of comments) {
    if (typeof c.p === 'string' && typeof c.m === 'string') {
      const parts = c.p.split(',')
      const time = parseFloat(parts[0]) || 0
      const modeNum = parseInt(parts[1], 10) || 1
      const colorNum = parseInt(parts[2], 10)
      items.push({
        text: c.m,
        time,
        mode: modeNum === 5 ? 1 : modeNum === 4 ? 2 : 0,
        color:
          Number.isFinite(colorNum) && colorNum > 0
            ? `#${colorNum.toString(16).padStart(6, '0')}`
            : undefined,
      })
    } else if (typeof c.text === 'string' && typeof c.time === 'number') {
      const type = c.type as string | undefined
      items.push({
        text: c.text,
        time: c.time,
        mode: type === 'top' ? 1 : type === 'bottom' ? 2 : 0,
        color: typeof c.color === 'string' ? c.color : undefined,
      })
    }
  }
  return items.sort((a, b) => a.time - b.time)
}

function proxyUrlFromSettings(): string | undefined {
  const { network } = useSettingStore.getState()
  if (network.isProxyEnabled === false) return undefined
  return network.proxyUrl?.trim() || undefined
}

async function fetchDanmakuJson(targetUrl: string): Promise<unknown> {
  const response = await fetch(buildProxyRequestUrl(targetUrl, proxyUrlFromSettings()), {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`弹幕接口请求失败: ${response.status}`)
  return response.json() as Promise<unknown>
}

/**
 * 为某一集加载弹幕：搜索剧集 → 匹配剧集/集数 → 拉取评论。
 * 任何环节失败或无匹配都返回空数组（静默，不影响播放）。
 */
export async function loadDanmakuForEpisode(
  apiUrl: string,
  title: string,
  episodeName: string,
  episodeIndex: number,
  fontFamily?: string,
): Promise<DanmakuItem[]> {
  const base = apiUrl.trim().replace(/\/+$/, '')
  if (!base || !title) return []
  try {
    const searchData = await fetchDanmakuJson(
      `${base}/api/v2/search/episodes?anime=${encodeURIComponent(title)}`,
    )
    const anime = pickDanmakuAnime(parseDanmakuSearchResults(searchData), title)
    if (!anime) return []

    const episode = matchDanmakuEpisode(anime.episodes, episodeName, episodeIndex)
    if (!episode || !episode.episodeId) return []

    const commentsData = await fetchDanmakuJson(
      `${base}/api/v2/comment/${encodeURIComponent(episode.episodeId)}?withRelated=true`,
    )
    const items = parseDanmakuComments(commentsData)
    const family = (fontFamily ?? '').trim() || DANMAKU_DEFAULT_FONT_FAMILY
    for (const item of items) {
      item.style = { fontFamily: family, fontWeight: '700', textShadow: DANMAKU_TEXT_SHADOW }
    }
    return items
  } catch {
    return []
  }
}
