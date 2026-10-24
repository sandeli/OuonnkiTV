import { buildTmdbImageOriginUrl } from '../../_lib/tmdbImage'
import type { PagesContext } from '../../_lib/auth'

/** 边缘缓存与浏览器缓存时长：30 天（TMDB 图片路径带内容指纹，长期不变） */
const IMAGE_CACHE_SECONDS = 30 * 24 * 60 * 60

interface EdgeCache {
  match(request: Request): Promise<Response | undefined>
  put(request: Request, response: Response): Promise<void>
}

function edgeCache(): EdgeCache | null {
  const storage = (globalThis as { caches?: { default?: EdgeCache } }).caches
  return storage?.default ?? null
}

/**
 * TMDB 图片代理：GET /api/tmdb-img/<尺寸>/<文件名>
 * 观看者浏览器不再直连 image.tmdb.org（国内慢且不稳），改为经本站转发并写入
 * Cloudflare 边缘缓存——同一张图全站只回源一次，之后就近直出。
 * 源站路径经白名单校验（见 _lib/tmdbImage），端点不能被拿去代理任意地址。
 */
export const onRequest = async (context: PagesContext) => {
  if (context.request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 })
  }
  const rawPath = context.params.path
  let segments: string[]
  try {
    segments = (Array.isArray(rawPath) ? rawPath : rawPath ? [rawPath] : []).map(s =>
      decodeURIComponent(s),
    )
  } catch {
    return new Response('Not Found', { status: 404 })
  }
  const originUrl = buildTmdbImageOriginUrl(segments)
  if (!originUrl) {
    return new Response('Not Found', { status: 404 })
  }

  const cache = edgeCache()
  const cacheKey = new Request(context.request.url, { method: 'GET' })
  if (cache) {
    const hit = await cache.match(cacheKey)
    if (hit) return hit
  }

  let origin: Response
  try {
    origin = await fetch(originUrl, {
      headers: { 'User-Agent': 'TGYS-TV image proxy' },
    })
  } catch {
    return new Response('Bad Gateway', { status: 502 })
  }
  if (!origin.ok) {
    return new Response('Bad Gateway', { status: 502 })
  }

  const response = new Response(origin.body, {
    status: 200,
    headers: {
      'Content-Type': origin.headers.get('Content-Type') ?? 'image/jpeg',
      'Cache-Control': `public, max-age=${IMAGE_CACHE_SECONDS}, immutable`,
    },
  })
  if (cache && typeof context.waitUntil === 'function') {
    context.waitUntil(cache.put(cacheKey, response.clone()))
  }
  return response
}
