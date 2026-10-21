import { json, nowSeconds, readJson, requireAdmin, type PagesContext } from '../../../../_lib/auth'

/** 管理员：设置用户可用天数（从现在起算，0 = 无限制；设为已到期时同时踢下线） */
export const onRequest = async (context: PagesContext) => {
  if (context.request.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)
  const result = await requireAdmin(context)
  if (result instanceof Response) return result
  const { db } = result

  const raw = context.params.id
  const userId = Number(Array.isArray(raw) ? raw[0] : raw)
  if (!Number.isInteger(userId) || userId <= 0) return json({ error: '用户不存在' }, 404)

  const body = await readJson<{ days?: unknown }>(context.request)
  const days = typeof body?.days === 'number' ? Math.floor(body.days) : NaN
  if (!Number.isInteger(days) || days < 0 || days > 36500) {
    return json({ error: '天数需为 0-36500 的整数（0 表示无限制）' }, 400)
  }

  const expiresAt = days === 0 ? null : nowSeconds() + days * 86400
  await db.prepare('UPDATE users SET expires_at = ? WHERE id = ?').bind(expiresAt, userId).run()
  return json({ ok: true, expiresAt })
}
