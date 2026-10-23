import { json, readJson, requireUser, type PagesContext } from '../../_lib/auth'
import { getOrCreateTvboxToken, resetTvboxToken } from '../../_lib/tvbox'

/**
 * 当前登录用户的 TVBox 接口管理：
 * - GET：取（没有就生成）我的令牌与完整配置地址
 * - POST { action: 'reset' }：重置令牌（旧地址立即失效）
 */
export const onRequest = async (context: PagesContext) => {
  const result = await requireUser(context)
  if (result instanceof Response) return result
  const { db, user } = result
  const origin = new URL(context.request.url).origin

  if (context.request.method === 'GET') {
    const token = await getOrCreateTvboxToken(db, user.userId)
    return json({ token, configUrl: `${origin}/api/tvbox/${token}` })
  }

  if (context.request.method === 'POST') {
    const body = await readJson<{ action?: unknown }>(context.request)
    if (body?.action !== 'reset') return json({ error: '未知操作' }, 400)
    const token = await resetTvboxToken(db, user.userId)
    return json({ token, configUrl: `${origin}/api/tvbox/${token}` })
  }

  return json({ error: 'Method Not Allowed' }, 405)
}
