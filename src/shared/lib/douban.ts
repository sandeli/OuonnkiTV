import { buildProxyRequestUrl } from '@/shared/config/api.config'
import { DEFAULT_DOUBAN_PROXY, type DoubanProxyConfig } from '@/shared/lib/authApi'
import { useAuthStore } from '@/shared/store/authStore'
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
  { label: '韩剧', type: 'tv', tag: '韩剧' },
  { label: '美剧', type: 'tv', tag: '美剧' },
  { label: '日剧', type: 'tv', tag: '日剧' },
  { label: '热门综艺', type: 'tv', tag: '综艺' },
  { label: '热门动漫', type: 'tv', tag: '动画' },
  { label: '豆瓣高分', type: 'movie', tag: '豆瓣高分' },
  { label: '经典电影', type: 'movie', tag: '经典' },
]

const PAGE_LIMIT = 18

// 简单内存缓存：同一会话内切页返回首页不重复请求
const cache = new Map<string, DoubanSubject[]>()

function cacheKey(category: DoubanCategory) {
  const proxy = doubanProxyConfig()
  return `${category.type}:${category.tag}:${proxy.dataType}:${proxy.dataUrl}`
}

function proxyUrlFromSettings(): string | undefined {
  try {
    return useSettingStore.getState().network.proxyUrl
  } catch {
    return undefined
  }
}

/** 豆瓣代理配置（管理员后台设置，经公开配置下发；缺失时用默认：数据本站转发 / 图片本站代理） */
export function doubanProxyConfig(): DoubanProxyConfig {
  try {
    return useAuthStore.getState().authConfig?.doubanProxy ?? DEFAULT_DOUBAN_PROXY
  } catch {
    return DEFAULT_DOUBAN_PROXY
  }
}

const ZWEI_CORS_PROXY = 'https://ciao-cors.is-an.org/'

function swapDoubanHost(target: string, host: string): string {
  return target.replace(/^(https?:\/\/)(?:movie|m)\.douban\.com/, `$1${host}`)
}

/**
 * 按数据代理设置生成豆瓣接口的实际请求地址（纯函数，便于测试）。
 * - direct：经本站 /proxy 由服务器直接请求豆瓣（当前方式）
 * - cors-proxy-zwei：浏览器经 Zwei 的 CORS 代理转发
 * - cmliussss-cdn-*：浏览器直连 CMLiussss 的豆瓣 CDN 镜像域名
 * - custom：自定义代理前缀 + 编码后的目标地址
 */
export function buildDoubanDataRequestUrl(
  target: string,
  config: DoubanProxyConfig,
  siteProxy?: string,
): string {
  switch (config.dataType) {
    case 'cors-proxy-zwei':
      return `${ZWEI_CORS_PROXY}${encodeURIComponent(target)}`
    case 'cmliussss-cdn-tencent':
      return swapDoubanHost(target, 'movie.douban.cmliussss.net')
    case 'cmliussss-cdn-ali':
      return swapDoubanHost(target, 'movie.douban.cmliussss.com')
    case 'custom':
      return config.dataUrl.trim()
        ? `${config.dataUrl.trim()}${encodeURIComponent(target)}`
        : buildProxyRequestUrl(target, siteProxy)
    case 'direct':
    default:
      return buildProxyRequestUrl(target, siteProxy)
  }
}

/**
 * 按图片代理设置生成豆瓣海报的实际加载地址（纯函数，便于测试）。
 * 非 doubanio 域名直接原样返回。
 */
export function buildDoubanPosterUrl(
  cover: string,
  config: DoubanProxyConfig,
  siteProxy?: string,
): string {
  if (!cover) return ''
  if (!cover.includes('doubanio.com')) return cover
  switch (config.imageType) {
    case 'direct':
      return cover
    case 'img3':
      return cover.replace(/img\d+\.doubanio\.com/g, 'img3.doubanio.com')
    case 'cmliussss-cdn-tencent':
      return cover.replace(/img\d+\.doubanio\.com/g, 'img.doubanio.cmliussss.net')
    case 'cmliussss-cdn-ali':
      return cover.replace(/img\d+\.doubanio\.com/g, 'img.doubanio.cmliussss.com')
    case 'custom':
      return config.imageUrl.trim()
        ? `${config.imageUrl.trim()}${encodeURIComponent(cover)}`
        : buildProxyRequestUrl(cover, siteProxy)
    case 'server':
    default:
      return buildProxyRequestUrl(cover, siteProxy)
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
    const response = await fetch(
      buildDoubanDataRequestUrl(target, doubanProxyConfig(), proxyUrlFromSettings()),
    )
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

/** 豆瓣海报加载地址（按管理员后台的图片代理设置生成） */
export function doubanPosterUrl(cover: string): string {
  return buildDoubanPosterUrl(cover, doubanProxyConfig(), proxyUrlFromSettings())
}

/** 点击豆瓣条目 → 站内直连聚合搜索各源（mode=direct） */
export function buildDoubanSearchPath(title: string): string {
  return `/search?q=${encodeURIComponent(title)}&mode=direct`
}
