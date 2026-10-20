import type { Handler, HandlerEvent } from '@netlify/functions'
import { getProxyTimeoutMs, handleProxyRequest, parseProxyError } from '../../src/shared/lib/proxy'

const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    }
  }

  const { url } = event.queryStringParameters || {}

  if (!url) {
    return {
      statusCode: 400,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'URL parameter is required' }),
    }
  }

  try {
    const response = await handleProxyRequest(url)
    const contentType = response.headers.get('content-type') || 'application/json'

    // 文本内容（JSON 等）直传；图片等二进制走 base64，避免 text() 转手损坏字节
    if (/json|text|xml|javascript/.test(contentType)) {
      return {
        statusCode: response.status,
        headers: {
          ...headers,
          'Content-Type': contentType,
        },
        body: await response.text(),
      }
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    return {
      statusCode: response.status,
      headers: {
        ...headers,
        'Content-Type': contentType,
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true,
    }
  } catch (error) {
    const { message, cause } = parseProxyError(error)
    const timeoutMs = getProxyTimeoutMs()
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Proxy request failed', message, cause, timeoutMs }),
    }
  }
}

export { handler }
