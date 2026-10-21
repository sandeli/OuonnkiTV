import {
  createSession,
  ensureSchema,
  json,
  MASTER_USER_ID,
  nowSeconds,
  readJson,
  verifyPassword,
  type PagesContext,
  type SessionUser,
} from '../../_lib/auth'

interface LoginBody {
  username?: unknown
  password?: unknown
}

export const onRequest = async (context: PagesContext) => {
  if (context.request.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)
  const db = context.env.TGYS_DB
  if (!db) return json({ error: '账号系统未配置' }, 503)
  await ensureSchema(db)

  const body = await readJson<LoginBody>(context.request)
  const username = typeof body?.username === 'string' ? body.username.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!username || !password) return json({ error: '用户名或密码错误' }, 401)

  const ip = context.request.headers.get('CF-Connecting-IP') ?? ''
  const userAgent = context.request.headers.get('User-Agent') ?? ''
  const loginAt = nowSeconds()

  let sessionUser: SessionUser

  if (username.toLowerCase() === 'admin') {
    // 站长登录：用户名 admin + 环境变量 TGYS_ACCESS_PASSWORD
    const masterPassword = context.env.TGYS_ACCESS_PASSWORD ?? ''
    if (!masterPassword) return json({ error: '站长登录未启用' }, 403)
    if (password !== masterPassword) return json({ error: '用户名或密码错误' }, 401)
    sessionUser = { userId: MASTER_USER_ID, username: 'admin', role: 'admin', isMaster: true }
  } else {
    const row = await db
      .prepare(
        'SELECT id, username, password_hash AS passwordHash, password_salt AS passwordSalt, role, disabled FROM users WHERE username = ?',
      )
      .bind(username)
      .first<{
        id: number
        username: string
        passwordHash: string
        passwordSalt: string
        role: string
        disabled: number
      }>()
    if (!row) return json({ error: '用户名或密码错误' }, 401)
    const ok = await verifyPassword(password, row.passwordSalt, row.passwordHash)
    if (!ok) return json({ error: '用户名或密码错误' }, 401)
    if (row.disabled === 1) return json({ error: '账号已被禁用' }, 403)

    sessionUser = {
      userId: row.id,
      username: row.username,
      role: row.role === 'admin' ? 'admin' : 'user',
      isMaster: false,
    }
    await db
      .prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
      .bind(loginAt, row.id)
      .run()
  }

  await db
    .prepare('INSERT INTO login_logs (user_id, username, ip, user_agent, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(sessionUser.userId, sessionUser.username, ip, userAgent, loginAt)
    .run()

  const { token, expiresAt } = await createSession(db, sessionUser)
  return json({
    token,
    expiresAt,
    user: {
      id: sessionUser.userId,
      username: sessionUser.username,
      role: sessionUser.role,
      isMaster: sessionUser.isMaster,
    },
  })
}
