import { json, requireAdmin, type PagesContext } from '../../../_lib/auth'

/** 管理员：删除（撤销）一个邀请码 */
export const onRequest = async (context: PagesContext) => {
  if (context.request.method !== 'DELETE') return json({ error: 'Method Not Allowed' }, 405)
  const result = await requireAdmin(context)
  if (result instanceof Response) return result
  const { db } = result

  const raw = context.params.id
  const inviteId = Number(Array.isArray(raw) ? raw[0] : raw)
  if (!Number.isInteger(inviteId) || inviteId <= 0) return json({ error: '邀请码不存在' }, 404)

  await db.prepare('DELETE FROM invite_codes WHERE id = ?').bind(inviteId).run()
  return json({ ok: true })
}
