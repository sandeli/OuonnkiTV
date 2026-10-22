import { json, readJson, requireAdmin, type PagesContext } from '../../../../_lib/auth'

/** 管理员：设置某用户的电报上线通知开关（开启后该用户每次登录都会给管理员发 TG 消息） */
export const onRequest = async (context: PagesContext) => {
  if (context.request.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)
  const result = await requireAdmin(context)
  if (result instanceof Response) return result
  const { db } = result

  const raw = context.params.id
  const userId = Number(Array.isArray(raw) ? raw[0] : raw)
  if (!Number.isInteger(userId) || userId <= 0) return json({ error: '用户不存在' }, 404)

  const body = await readJson<{ enabled?: unknown }>(context.request)
  const enabled = body?.enabled === true ? 1 : 0
  await db.prepare('UPDATE users SET tg_watch = ? WHERE id = ?').bind(enabled, userId).run()
  return json({ ok: true, tgWatch: enabled === 1 })
}
