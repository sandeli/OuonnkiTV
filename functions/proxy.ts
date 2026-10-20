// Cloudflare Pages Function
// 部署到 Cloudflare Pages 时，此文件会自动处理 /proxy 路由
// 注意：Cloudflare Workers 环境不支持直接导入 src 模块，需要内联核心逻辑

interface Context {
  request: Request
  env: unknown
  params: unknown
}

const DEFAULT_PROXY_TIMEOUT_MS = 15000
const MIN_PROXY_TIMEOUT_MS = 1000
const MAX_PROXY_TIMEOUT_MS = 120000

function getProxyTimeoutMs(env: unknown): number {
  const envObj = env && typeof env === 'object' ? (env as Record<string, unknown>) : {}
  const rawTimeout = envObj.PROXY_TIMEOUT_MS
  const parsed = Number(rawTimeout)

  if (!Number.isFinite(parsed)) {
    return DEFAULT_PROXY_TIMEOUT_MS
  }
  return Math.min(MAX_PROXY_TIMEOUT_MS, Math.max(MIN_PROXY_TIMEOUT_MS, Math.floor(parsed)))
}

function parseProxyError(error: unknown): {
  message: string
  cause?: { name?: string; code?: string; message?: string }
} {
  const typedError = error as Error & { cause?: unknown }
  const payload: {
    message: string
    cause?: { name?: string; code?: string; message?: string }
  } = {
    message: typedError instanceof Error ? typedError.message : 'Unknown error',
  }

  if (!(typedError instanceof Error) || !typedError.cause || typeof typedError.cause !== 'object') {
    return payload
  }

  const cause = typedError.cause as { name?: unknown; code?: unknown; message?: unknown }
  const parsedCause: { name?: string; code?: string; message?: string } = {}

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

// 内联核心代理逻辑（Cloudflare Workers 环境限制）
async function handleProxyRequest(targetUrl: string, timeoutMs: number): Promise<Response> {
  try {
    new URL(targetUrl)
  } catch {
    throw new Error('Invalid URL format')
  }

  let hostname = ''
  try {
    hostname = new URL(targetUrl).hostname
  } catch {
    // URL 格式已在上方校验，这里忽略
  }
  const isDoubanImage = hostname === 'doubanio.com' || hostname.endsWith('.doubanio.com')

  // 豆瓣图片 CDN 防盗链：带上豆瓣自身 Referer + 图片 Accept 才能取图
  const headers: Record<string, string> = isDoubanImage
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

  // 豆瓣图片镜像线路轮换（imgN 路径相同），返回第一个成功响应
  const hosts = ['img9.doubanio.com', 'img3.doubanio.com', 'img2.doubanio.com']
  const candidates = [targetUrl]
  if (/^img\d+\.doubanio\.com$/.test(hostname)) {
    for (const host of hosts) {
      if (host === hostname) continue
      const alternate = new URL(targetUrl)
      alternate.hostname = host
      candidates.push(alternate.toString())
    }
  }

  let lastResponse: Response | null = null
  let lastError: unknown = null
  for (const candidate of candidates) {
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

export const onRequest = async (context: Context) => {
  const url = new URL(context.request.url)
  const targetUrl = url.searchParams.get('url')

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'URL parameter is required' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    })
  }

  try {
    const timeoutMs = getProxyTimeoutMs(context.env)
    const response = await handleProxyRequest(targetUrl, timeoutMs)

    // Create a new response with the body from the fetch
    const newResponse = new Response(response.body, response)

    // 图片（豆瓣海报等）长缓存，减少重复取图
    const contentType = newResponse.headers.get('content-type') || ''
    if (contentType.startsWith('image/')) {
      newResponse.headers.set('Cache-Control', 'public, max-age=15720000, s-maxage=15720000')
    }

    // Add CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
      newResponse.headers.set(key, value)
    })

    return newResponse
  } catch (error) {
    const timeoutMs = getProxyTimeoutMs(context.env)
    const { message, cause } = parseProxyError(error)
    return new Response(JSON.stringify({ error: 'Proxy request failed', message, cause, timeoutMs }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    })
  }
}
