import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getProxyTimeoutMs, handleProxyRequest, parseProxyError } from '../shared/proxy-core.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    const { url } = req.query

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL parameter is required' })
    }

    const targetUrl = decodeURIComponent(url)
    const response = await handleProxyRequest(targetUrl)
    // 二进制安全：图片等非文本内容不能走 text() 转手（会损坏字节）
    const buffer = Buffer.from(await response.arrayBuffer())
    const contentType = response.headers.get('content-type') || 'application/json'

    res.setHeader('Content-Type', contentType)
    // 图片（豆瓣海报等）长缓存，其余内容短缓存（对齐 KVideo 图片代理）
    res.setHeader(
      'Cache-Control',
      contentType.startsWith('image/')
        ? 'public, max-age=15720000, s-maxage=15720000'
        : 'public, max-age=60',
    )
    res.status(response.status).send(buffer)
  } catch (error) {
    const { message, cause } = parseProxyError(error)
    const timeoutMs = getProxyTimeoutMs()
    res.status(500).json({ error: 'Proxy request failed', message, cause, timeoutMs })
  }
}
