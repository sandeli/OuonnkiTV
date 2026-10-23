import {
  changeUserPassword,
  json,
  MASTER_USER_ID,
  readJson,
  requireUser,
  sha256Hex,
  validatePassword,
  type PagesContext,
} from '../../_lib/auth'

/**
 * 当前登录用户修改密码：
 * - POST { currentPassword, newPassword }：校验现密码后更新，并踢下线其他设备的会话（当前设备保持登录）
 * - 站长（主账号）的密码保存在部署环境变量 TGYS_ACCESS_PASSWORD 中，不走这里
 */
export const onRequest = async (context: PagesContext) => {
  const result = await requireUser(context)
  if (result instanceof Response) return result
  const { db, user } = result

  if (context.request.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)
  if (user.isMaster || user.userId === MASTER_USER_ID) {
    return json({ error: '站长密码保存在部署环境变量 TGYS_ACCESS_PASSWORD 中，请修改后重新部署' }, 400)
  }

  const body = await readJson<{ currentPassword?: unknown; newPassword?: unknown }>(context.request)
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : ''
  if (!currentPassword) return json({ error: '请输入当前密码' }, 400)
  const newPassword = validatePassword(body?.newPassword)
  if (!newPassword) return json({ error: '新密码需 6-64 位' }, 400)

  const auth = context.request.headers.get('Authorization') ?? ''
  const match = auth.match(/^Bearer\s+(.+)$/i)
  const currentTokenHash = match ? await sha256Hex(match[1].trim()) : ''

  const outcome = await changeUserPassword(db, user.userId, currentPassword, newPassword, currentTokenHash)
  if (outcome === 'wrong-current') return json({ error: '当前密码不正确' }, 400)
  if (outcome === 'not-found') return json({ error: '账号不存在' }, 404)
  return json({ ok: true })
}
