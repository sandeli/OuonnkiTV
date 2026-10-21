import {
  isRegistrationOpen,
  json,
  readJson,
  requireAdmin,
  setSetting,
  type PagesContext,
} from '../../_lib/auth'

/** 管理员：站点设置（注册开关） */
export const onRequest = async (context: PagesContext) => {
  const result = await requireAdmin(context)
  if (result instanceof Response) return result
  const { db } = result

  if (context.request.method === 'GET') {
    return json({ registrationOpen: await isRegistrationOpen(db, context.env) })
  }

  if (context.request.method === 'POST') {
    const body = await readJson<{ registrationOpen?: unknown }>(context.request)
    const open = body?.registrationOpen === true
    await setSetting(db, 'registration_open', open ? '1' : '0')
    return json({ ok: true, registrationOpen: open })
  }

  return json({ error: 'Method Not Allowed' }, 405)
}
