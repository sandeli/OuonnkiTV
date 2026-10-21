import { json, readJson, requireAdmin, type PagesContext } from '../../../../_lib/auth'

/** 管理员：禁用/解禁账号（禁用时同时踢下线） */
export const onRequest = async (context: PagesContext) => {
  if (context.request.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)
  const result = await requireAdmin(context)
  if (result instanceof Response) return result
  const { db } = result

  const raw = context.params.id
  const userId = Number(Array.isArray(raw) ? raw[0] : raw)
  if (!Number.isInteger(userId) || userId <= 0) return json({ error: '用户不存在' }, 404)

  const body = await readJson<{ disabled?: unknown }>(context.request)
  const disabled = body?.disabled === true ? 1 : 0
  await db.prepare('UPDATE users SET disabled = ? WHERE id = ?').bind(disabled, userId).run()
  if (disabled === 1) {
    await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run()
  }
  return json({ ok: true, disabled: disabled === 1 })
}
