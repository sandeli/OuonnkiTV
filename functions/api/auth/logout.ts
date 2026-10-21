import { deleteSession, ensureSchema, json, type PagesContext } from '../../_lib/auth'

export const onRequest = async (context: PagesContext) => {
  if (context.request.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)
  const db = context.env.TGYS_DB
  if (!db) return json({ ok: true })
  await ensureSchema(db)
  await deleteSession(db, context.request)
  return json({ ok: true })
}
