import express from 'express'
import cors from 'cors'
import { getProxyTimeoutMs, parseProxyError, handleProxyRequest } from './shared/proxy-core.js'

const app = express()
const PORT = process.env.PROXY_PORT || 3001

app.use(cors({ origin: '*' }))

app.get('/proxy', async (req, res) => {
  try {
    const { url } = req.query
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' })
    }

    const targetUrl = decodeURIComponent(url)
    const response = await handleProxyRequest(targetUrl)
    // 二进制安全：图片等非文本内容不能走 text() 转手（会损坏字节）
    const buffer = Buffer.from(await response.arrayBuffer())
    const contentType = response.headers.get('content-type') || 'application/json'

    res.setHeader('Content-Type', contentType)
    res.status(response.status).send(buffer)
  } catch (error) {
    const { message, cause } = parseProxyError(error)
    res.status(500).json({
      error: 'Proxy request failed',
      message,
      cause,
      timeoutMs: getProxyTimeoutMs(),
    })
  }
})

app.listen(PORT, () => console.log(`Proxy server on :${PORT}`))
