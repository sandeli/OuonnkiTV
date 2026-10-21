import { json, requireUser, type PagesContext } from '../../_lib/auth'

export const onRequest = async (context: PagesContext) => {
  if (context.request.method !== 'GET') return json({ error: 'Method Not Allowed' }, 405)
  const result = await requireUser(context)
  if (result instanceof Response) return result
  const { user } = result
  return json({
    user: {
      id: user.userId,
      username: user.username,
      role: user.role,
      isMaster: user.isMaster,
    },
  })
}
