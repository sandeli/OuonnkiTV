import {
  hashPassword,
  json,
  nowSeconds,
  randomHex,
  readJson,
  requireAdmin,
  validatePassword,
  validateUsername,
  type PagesContext,
} from '../../_lib/auth'

interface CreateUserBody {
  username?: unknown
  password?: unknown
}

/**
 * 管理员接口：
 * - GET：用户列表（含登录次数、观看部数、最近动态）
 * - POST：管理员直接创建用户（只需用户名+密码；不受开放注册开关与人机验证限制，
 *   校验规则与自助注册一致；不自动登录、不写登录日志）
 */
export const onRequest = async (context: PagesContext) => {
  if (context.request.method !== 'GET' && context.request.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405)
  }
  const result = await requireAdmin(context)
  if (result instanceof Response) return result
  const { db } = result

  if (context.request.method === 'POST') {
    const body = await readJson<CreateUserBody>(context.request)
    const username = validateUsername(body?.username)
    const password = validatePassword(body?.password)
    if (!username) return json({ error: '用户名需 3-24 位，仅限文字、数字、下划线、连字符' }, 400)
    if (!password) return json({ error: '密码需 6-64 位' }, 400)

    const salt = randomHex(16)
    const passwordHash = await hashPassword(password, salt)
    try {
      const insert = (await db
        .prepare(
          'INSERT INTO users (username, password_hash, password_salt, role, disabled, created_at) VALUES (?, ?, ?, ?, 0, ?)',
        )
        .bind(username, passwordHash, salt, 'user', nowSeconds())
        .run()) as { meta?: { last_row_id?: number } }
      return json({ ok: true, user: { id: insert.meta?.last_row_id ?? 0, username } })
    } catch {
      return json({ error: '用户名已被注册' }, 409)
    }
  }

  const { results } = await db
    .prepare(
      `SELECT u.id AS id, u.username AS username, u.role AS role, u.disabled AS disabled,
              u.created_at AS createdAt, u.last_login_at AS lastLoginAt, u.expires_at AS expiresAt, u.tg_watch AS tgWatch,
              (SELECT COUNT(*) FROM login_logs l WHERE l.user_id = u.id) AS loginCount,
              (SELECT COUNT(*) FROM watch_records w WHERE w.user_id = u.id) AS watchCount,
              (SELECT MAX(w.updated_at) FROM watch_records w WHERE w.user_id = u.id) AS lastWatchAt,
              (SELECT w2.title FROM watch_records w2 WHERE w2.user_id = u.id ORDER BY w2.updated_at DESC LIMIT 1) AS lastWatchTitle
       FROM users u
       ORDER BY u.created_at DESC
       LIMIT 500`,
    )
    .all()
  return json({ users: results })
}
