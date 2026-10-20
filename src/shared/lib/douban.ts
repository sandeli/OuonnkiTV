import { buildProxyRequestUrl } from '@/shared/config/api.config'
import { useSettingStore } from '@/shared/store/settingStore'

/**
 * 豆瓣分类墙数据层
 * 数据来自豆瓣公开的 search_subjects 接口，经本站自带 /proxy 转发（绕过跨域与防盗链）。
 * 点击条目按片名去站内聚合搜索各源。
 */

export interface DoubanSubject {
  /** 豆瓣条目 ID */
  id: string
  /** 片名 */
  title: string
  /** 豆瓣评分（字符串形式，如 "8.7"；无评分为空串） */
  rate: string
  /** 海报图（doubanio 域名） */
  cover: string
  /** 豆瓣条目页 */
  url: string
}

export interface DoubanCategory {
  /** 板块标题 */
  label: string
  /** movie | tv */
  type: 'movie' | 'tv'
  /** 豆瓣标签 */
  tag: string
}

/** 首页分类墙板块（顺序即展示顺序） */
export const DOUBAN_CATEGORIES: DoubanCategory[] = [
  { label: '热门电影', type: 'movie', tag: '热门' },
  { label: '热门剧集', type: 'tv', tag: '热门' },
  { label: '热门综艺', type: 'tv', tag: '综艺' },
  { label: '热门动漫', type: 'tv', tag: '动画' },
  { label: '豆瓣高分', type: 'movie', tag: '豆瓣高分' },
  { label: '经典电影', type: 'movie', tag: '经典' },
]

const PAGE_LIMIT = 18

// 简单内存缓存：同一会话内切页返回首页不重复请求
const cache = new Map<string, DoubanSubject[]>()

function cacheKey(category: DoubanCategory) {
  return `${category.type}:${category.tag}`
}

function proxyUrlFromSettings(): string | undefined {
  try {
    return useSettingStore.getState().network.proxyUrl
  } catch {
    return undefined
  }
}

/** 拉取一个分类的豆瓣条目（失败返回空数组，不抛错） */
export async function fetchDoubanCategory(category: DoubanCategory): Promise<DoubanSubject[]> {
  const key = cacheKey(category)
  const hit = cache.get(key)
  if (hit) return hit

  const target =
    `https://movie.douban.com/j/search_subjects?type=${category.type}` +
    `&tag=${encodeURIComponent(category.tag)}&sort=recommend` +
    `&page_limit=${PAGE_LIMIT}&page_start=0`

  try {
    const response = await fetch(buildProxyRequestUrl(target, proxyUrlFromSettings()))
    if (!response.ok) return []
    const data = (await response.json()) as { subjects?: unknown }
    const subjects = Array.isArray(data.subjects) ? data.subjects : []
    const items: DoubanSubject[] = subjects
      .map(raw => {
        const s = (raw ?? {}) as Record<string, unknown>
        return {
          id: String(s.id ?? ''),
          title: typeof s.title === 'string' ? s.title : '',
          rate: typeof s.rate === 'string' ? s.rate : '',
          cover: typeof s.cover === 'string' ? s.cover : '',
          url: typeof s.url === 'string' ? s.url : '',
        }
      })
      .filter(item => item.id && item.title)
    if (items.length) cache.set(key, items)
    return items
  } catch {
    return []
  }
}

/** 豆瓣海报经本站代理加载（原图域名有防盗链，直连会 403） */
export function doubanPosterUrl(cover: string): string {
  if (!cover) return ''
  return buildProxyRequestUrl(cover, proxyUrlFromSettings())
}

/** 点击豆瓣条目 → 站内直连聚合搜索各源（mode=direct） */
export function buildDoubanSearchPath(title: string): string {
  return `/search?q=${encodeURIComponent(title)}&mode=direct`
}
