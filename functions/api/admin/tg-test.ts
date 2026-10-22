import {
  json,
  readJson,
  requireAdmin,
  sendTelegramMessage,
  type PagesContext,
} from '../../_lib/auth'

/** 管理员：用表单里当前填的 Bot Token + Chat ID 发送一条测试消息，验证电报通知配置 */
export const onRequest = async (context: PagesContext) => {
  if (context.request.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)
  const result = await requireAdmin(context)
  if (result instanceof Response) return result

  const body = await readJson<{ botToken?: unknown; chatId?: unknown }>(context.request)
  const botToken = typeof body?.botToken === 'string' ? body.botToken.trim() : ''
  const chatId = typeof body?.chatId === 'string' ? body.chatId.trim() : ''
  if (!botToken || !chatId) return json({ error: '请先填写 Bot Token 和 Chat ID' }, 400)

  const sent = await sendTelegramMessage(
    botToken,
    chatId,
    '✅ TGYS TV 电报通知测试成功：用户上线通知已接通。',
  )
  if (!sent.ok) {
    return json({ error: `发送失败：${sent.description ?? '未知错误'}（请检查 Token 与 Chat ID）` }, 400)
  }
  return json({ ok: true })
}
