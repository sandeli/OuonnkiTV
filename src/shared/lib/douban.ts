import { buildProxyRequestUrl } from '@/shared/config/api.config'
import { DEFAULT_DOUBAN_PROXY, type DoubanProxyConfig } from '@/shared/lib/authApi'
import { useAuthStore } from '@/shared/store/authStore'
import { useDoubanProxyOverrideStore } from '@/shared/store/doubanProxyOverrideStore'
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
  { label: '国产剧', type: 'tv', tag: '国产剧' },
  { label: '韩剧', type: 'tv', tag: '韩剧' },
  { label: '美剧', type: 'tv', tag: '美剧' },
  { label: '日剧', type: 'tv', tag: '日剧' },
  { label: '热门综艺', type: 'tv', tag: '综艺' },
  // 豆瓣 tv 侧没有「动画」标签（官方标签列表里动漫叫「日本动画」），用错标签会恒返回空
  { label: '热门动漫', type: 'tv', tag: '日本动画' },
  { label: '豆瓣高分', type: 'movie', tag: '豆瓣高分' },
  { label: '经典电影', type: 'movie', tag: '经典' },
]

const PAGE_LIMIT = 18

/** 分类整页（点栏目名进入）一次展示的条数：分页拉取 5 页 × 20 条凑满 100 */
export const FULL_PAGE_SIZE = 100
const FULL_PAGE_CHUNK = 20

// ===== 持久缓存 + 并发治理（稳定性改进）=====
// 背景：首页 9 个分类同时请求豆瓣且零持久缓存时，会间歇性撞上豆瓣限流，
// 表现为随机分类整块消失。借鉴 KVideo 的「缓存 1 小时」思路，落到客户端实现：
// - 成功结果写入 localStorage（TTL 1 小时），刷新/重开浏览器直接命中，不再每次回源
// - 过期数据先返回展示、后台静默刷新（SWR）；刷新失败继续用旧数据，板块不消失
// - 内存缓存保留作第一层（同一会话内切页返回零延迟）
// - 在途请求并发上限 3（信号量排队），避免 9 连发加重限流；单请求 8 秒超时、失败退避重试 1 次
const CACHE_TTL_MS = 60 * 60 * 1000
const STORAGE_PREFIX = 'tgys-douban-cache:'
const REQUEST_TIMEOUT_MS = 8000
const MAX_CONCURRENT_REQUESTS = 3

// 内存缓存：同一会话内切页返回首页不重复请求
const cache = new Map<string, DoubanSubject[]>()

interface StoredDoubanCache {
  at: number
  items: DoubanSubject[]
}

function readStoredCache(key: string): StoredDoubanCache | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredDoubanCache>
    if (typeof parsed.at !== 'number' || !Array.isArray(parsed.items)) return null
    return { at: parsed.at, items: parsed.items }
  } catch {
    return null
  }
}

function writeStoredCache(key: string, items: DoubanSubject[]) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify({ at: Date.now(), items }))
  } catch {
    // 存储不可用/已满时静默放弃，内存缓存仍生效
  }
}

// 并发信号量：同时在途的豆瓣数据请求不超过 MAX_CONCURRENT_REQUESTS
let activeRequests = 0
const waitQueue: Array<() => void> = []

async function acquireSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT_REQUESTS) {
    activeRequests += 1
    return
  }
  await new Promise<void>(resolve => waitQueue.push(resolve))
  activeRequests += 1
}

function releaseSlot() {
  activeRequests -= 1
  const next = waitQueue.shift()
  if (next) next()
}

// 同一分类的在途请求去重（内存缓存未命中且并发调用时只发一次）
const inflight = new Map<string, Promise<DoubanSubject[]>>()

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

/** 个人覆盖（系统设置里可改）：某类为 null 表示跟随管理员设置 */
export interface DoubanProxyOverride {
  dataType: string | null
  dataUrl: string
  imageType: string | null
  imageUrl: string
}

/** 合并管理员设置与个人覆盖，得到最终生效的豆瓣代理配置（纯函数） */
export function resolveDoubanProxyConfig(
  admin: DoubanProxyConfig,
  override: DoubanProxyOverride,
): DoubanProxyConfig {
  return {
    dataType: override.dataType ?? admin.dataType,
    dataUrl: override.dataType ? override.dataUrl : admin.dataUrl,
    imageType: override.imageType ?? admin.imageType,
    imageUrl: override.imageType ? override.imageUrl : admin.imageUrl,
  }
}

/** 当前生效的豆瓣代理配置：管理员全站设置为默认，叠加当前用户的个人覆盖 */
export function doubanProxyConfig(): DoubanProxyConfig {
  let admin: DoubanProxyConfig = DEFAULT_DOUBAN_PROXY
  try {
    admin = useAuthStore.getState().authConfig?.doubanProxy ?? DEFAULT_DOUBAN_PROXY
  } catch {
    admin = DEFAULT_DOUBAN_PROXY
  }
  try {
    const o = useDoubanProxyOverrideStore.getState()
    return resolveDoubanProxyConfig(admin, {
      dataType: o.dataType,
      dataUrl: o.dataUrl,
      imageType: o.imageType,
      imageUrl: o.imageUrl,
    })
  } catch {
    return admin
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

/** 单次请求豆瓣一页（信号量 + 8 秒超时）：成功返回条目；失败或空结果返回 null（空多半是被限流，按失败处理） */
async function requestSubjectsOnce(
  category: DoubanCategory,
  pageStart: number,
  pageLimit: number,
): Promise<DoubanSubject[] | null> {
  const target =
    `https://movie.douban.com/j/search_subjects?type=${category.type}` +
    `&tag=${encodeURIComponent(category.tag)}&sort=recommend` +
    `&page_limit=${pageLimit}&page_start=${pageStart}`
  const url = buildDoubanDataRequestUrl(target, doubanProxyConfig(), proxyUrlFromSettings())

  await acquireSlot()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) return null
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
    return items.length ? items : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    releaseSlot()
  }
}

/** 实际请求豆瓣并写缓存：8 秒超时、失败退避重试 1 次；成功返回条目，彻底失败返回空数组 */
async function fetchCategoryFromNetwork(
  category: DoubanCategory,
  key: string,
): Promise<DoubanSubject[]> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 800))
    const items = await requestSubjectsOnce(category, 0, PAGE_LIMIT)
    if (items) {
      cache.set(key, items)
      writeStoredCache(key, items)
      return items
    }
  }
  return []
}

/** 整页数据：分页拉取（每页 20 条、逐页退避重试 1 次），按 id 去重凑满 FULL_PAGE_SIZE；某页彻底失败则用已拉到的部分 */
async function fetchCategoryFullFromNetwork(
  category: DoubanCategory,
  key: string,
): Promise<DoubanSubject[]> {
  const merged: DoubanSubject[] = []
  const seen = new Set<string>()
  for (let start = 0; start < FULL_PAGE_SIZE; start += FULL_PAGE_CHUNK) {
    let page: DoubanSubject[] | null = null
    for (let attempt = 0; attempt < 2 && !page; attempt += 1) {
      if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 800))
      page = await requestSubjectsOnce(category, start, FULL_PAGE_CHUNK)
    }
    if (!page) break
    for (const item of page) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      merged.push(item)
    }
    if (page.length < FULL_PAGE_CHUNK) break
  }
  if (merged.length) {
    const result = merged.slice(0, FULL_PAGE_SIZE)
    cache.set(key, result)
    writeStoredCache(key, result)
    return result
  }
  return []
}

/**
 * 拉取一个分类的豆瓣条目（不抛错）：
 * 内存缓存 → 未过期持久缓存 → 过期持久缓存先展示 + 后台刷新 → 网络（失败兜底旧缓存）
 */
async function fetchWithSwrCache(
  category: DoubanCategory,
  key: string,
  networkFetch: (category: DoubanCategory, key: string) => Promise<DoubanSubject[]>,
): Promise<DoubanSubject[]> {
  const memHit = cache.get(key)
  if (memHit) return memHit

  const stored = readStoredCache(key)
  if (stored && stored.items.length) {
    cache.set(key, stored.items)
    if (Date.now() - stored.at < CACHE_TTL_MS) return stored.items
    // 已过期：先返回旧数据展示，后台刷新供下次使用（失败则保留旧数据）
    if (!inflight.has(key)) {
      const p = networkFetch(category, key).finally(() => inflight.delete(key))
      inflight.set(key, p)
      void p
    }
    return stored.items
  }

  const pending = inflight.get(key)
  if (pending) return pending
  const request = networkFetch(category, key).finally(() => inflight.delete(key))
  inflight.set(key, request)
  return request
}

export async function fetchDoubanCategory(category: DoubanCategory): Promise<DoubanSubject[]> {
  return fetchWithSwrCache(category, cacheKey(category), fetchCategoryFromNetwork)
}

/** 拉取一个分类的整页条目（FULL_PAGE_SIZE 条，上下排列整页展示用）：缓存策略同首页版，缓存键独立 */
export async function fetchDoubanCategoryFull(category: DoubanCategory): Promise<DoubanSubject[]> {
  return fetchWithSwrCache(category, `${cacheKey(category)}:full`, fetchCategoryFullFromNetwork)
}

/** 按 type+tag 找分类配置（整页路由用）；找不到返回 undefined */
export function findDoubanCategory(type: string, tag: string): DoubanCategory | undefined {
  return DOUBAN_CATEGORIES.find(item => item.type === type && item.tag === tag)
}

/** 分类整页地址（点栏目名进入） */
export function buildDoubanCategoryPath(category: DoubanCategory): string {
  return `/douban/${category.type}/${encodeURIComponent(category.tag)}`
}

/** 豆瓣海报加载地址（按管理员后台的图片代理设置生成） */
export function doubanPosterUrl(cover: string): string {
  return buildDoubanPosterUrl(cover, doubanProxyConfig(), proxyUrlFromSettings())
}

/** 点击豆瓣条目 → 站内直连聚合搜索各源（mode=direct） */
export function buildDoubanSearchPath(title: string): string {
  return `/search?q=${encodeURIComponent(title)}&mode=direct`
}

/** 点击豆瓣条目 → 直达播放解析页：自动跨源挑最快的源开播（找不到才回退搜索页） */
export function buildDoubanPlayPath(title: string): string {
  return `/play/auto?q=${encodeURIComponent(title)}`
}
