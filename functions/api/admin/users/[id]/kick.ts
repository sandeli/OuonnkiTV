import { json, requireAdmin, type PagesContext } from '../../../../_lib/auth'

/** 管理员：踢用户下线（删除其全部会话） */
export const onRequest = async (context: PagesContext) => {
  if (context.request.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)
  const result = await requireAdmin(context)
  if (result instanceof Response) return result
  const { db } = result

  const raw = context.params.id
  const userId = Number(Array.isArray(raw) ? raw[0] : raw)
  if (!Number.isInteger(userId) || userId <= 0) return json({ error: '用户不存在' }, 404)

  await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run()
  return json({ ok: true })
}
