/**
 * 统一代理核心逻辑（供 Vercel/Netlify/本地中间件复用）
 * 使用 JS 文件确保 Serverless 运行时可直接解析，不依赖 TS 源文件转译。
 */
const DEFAULT_PROXY_TIMEOUT_MS = 15000
const MIN_PROXY_TIMEOUT_MS = 1000
const MAX_PROXY_TIMEOUT_MS = 120000

/**
 * 解析代理超时配置（毫秒）
 */
export function getProxyTimeoutMs(rawTimeout = process.env.PROXY_TIMEOUT_MS) {
  const parsed = Number(rawTimeout)
  if (!Number.isFinite(parsed)) {
    return DEFAULT_PROXY_TIMEOUT_MS
  }
  return Math.min(MAX_PROXY_TIMEOUT_MS, Math.max(MIN_PROXY_TIMEOUT_MS, Math.floor(parsed)))
}

/**
 * 解析 fetch 异常，尽量透传底层 cause 信息
 */
export function parseProxyError(error) {
  const payload = {
    message: error instanceof Error ? error.message : 'Unknown error',
  }

  if (!(error instanceof Error) || !error.cause || typeof error.cause !== 'object') {
    return payload
  }

  const cause = error.cause
  const parsedCause = {}

  if (typeof cause.name === 'string') {
    parsedCause.name = cause.name
  }
  if (typeof cause.code === 'string' || typeof cause.code === 'number') {
    parsedCause.code = String(cause.code)
  }
  if (typeof cause.message === 'string') {
    parsedCause.message = cause.message
  }

  if (Object.keys(parsedCause).length > 0) {
    payload.cause = parsedCause
  }

  return payload
}

// 豆瓣图片镜像主机：imgN.doubanio.com 路径相同、线路不同，
// 某条线路不可达时换镜像重试（参考 KVideo 的 douban-image 代理模式）
const DOUBAN_IMAGE_HOSTS = ['img9.doubanio.com', 'img3.doubanio.com', 'img2.doubanio.com']

function buildDoubanImageCandidates(targetUrl, hostname) {
  const candidates = [targetUrl]
  if (!/^img\d+\.doubanio\.com$/.test(hostname)) return candidates
  try {
    const parsed = new URL(targetUrl)
    for (const host of DOUBAN_IMAGE_HOSTS) {
      if (host === hostname) continue
      const alternate = new URL(parsed.toString())
      alternate.hostname = host
      candidates.push(alternate.toString())
    }
  } catch {
    // URL 已在调用方校验，这里只保留原始地址
  }
  return candidates
}

export async function handleProxyRequest(targetUrl) {
  let hostname = ''
  try {
    hostname = new URL(targetUrl).hostname
  } catch {
    throw new Error('Invalid URL format')
  }

  const timeoutMs = getProxyTimeoutMs()
  const isDoubanImage = hostname === 'doubanio.com' || hostname.endsWith('.doubanio.com')

  // 豆瓣图片 CDN 有防盗链：无 Referer 或外站 Referer 会返回 403/418，
  // 带上豆瓣自身 Referer + 图片 Accept 才能正常取图
  const headers = isDoubanImage
    ? {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'image/jpeg,image/png,image/gif,*/*;q=0.8',
        Referer: 'https://movie.douban.com/',
      }
    : {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
      }

  if (!isDoubanImage) {
    return fetch(targetUrl, {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    })
  }

  // 豆瓣图片：依次尝试各镜像线路，返回第一个成功响应
  let lastResponse = null
  let lastError = null
  for (const candidate of buildDoubanImageCandidates(targetUrl, hostname)) {
    try {
      const response = await fetch(candidate, {
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (response.ok) return response
      lastResponse = response
    } catch (error) {
      lastError = error
    }
  }
  if (lastResponse) return lastResponse
  throw lastError || new Error('Douban image fetch failed')
}

export function getTargetUrl(url) {
  const urlObj = new URL(url, 'http://localhost')
  const targetUrl = urlObj.searchParams.get('url')

  if (!targetUrl) {
    throw new Error('URL parameter is required')
  }

  return decodeURIComponent(targetUrl)
}
