/**
 * TGYS 账号系统共享库（Cloudflare Pages Functions 专用）。
 * 数据存 D1（绑定名 TGYS_DB），首次调用时自动建表。
 * 密码 PBKDF2-SHA256 加盐哈希；会话令牌只存 SHA-256 摘要。
 * 站长：用户名 admin + 环境变量 TGYS_ACCESS_PASSWORD，不占 users 表（user_id = 0）。
 */

export interface D1PreparedStatement {
  bind: (...values: unknown[]) => D1PreparedStatement
  run: () => Promise<unknown>
  first: <T = Record<string, unknown>>() => Promise<T | null>
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>
}

export interface D1Database {
  prepare: (query: string) => D1PreparedStatement
  batch: (statements: D1PreparedStatement[]) => Promise<unknown>
}

export interface AuthEnv {
  TGYS_DB?: D1Database
  TGYS_ACCESS_PASSWORD?: string
  TGYS_REGISTRATION_OPEN?: string
  TGYS_TURNSTILE_SECRET?: string
  TGYS_TURNSTILE_SITE_KEY?: string
}

export interface PagesContext {
  request: Request
  env: AuthEnv
  params: Record<string, string | string[]>
}

export interface SessionUser {
  userId: number
  username: string
  role: 'admin' | 'user'
  isMaster: boolean
}

export const MASTER_USER_ID = 0
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

/** Cloudflare 边缘在请求上附带的地理信息（国家代码/省份/城市），本地/非 CF 环境为空 */
export function getRequestGeo(request: Request): { country: string; region: string; city: string } {
  const cf = (request as Request & { cf?: { country?: string; region?: string; city?: string } }).cf
  return { country: cf?.country ?? '', region: cf?.region ?? '', city: cf?.city ?? '' }
}

// ---------- 建表（幂等，进程内只跑一次） ----------

let schemaPromise: Promise<void> | null = null

export function ensureSchema(db: D1Database): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await db.batch([
        db.prepare(
          `CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            password_salt TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            disabled INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            last_login_at INTEGER
          )`,
        ),
        db.prepare(
          `CREATE TABLE IF NOT EXISTS sessions (
            token_hash TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL
          )`,
        ),
        db.prepare(
          `CREATE TABLE IF NOT EXISTS login_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            ip TEXT,
            user_agent TEXT,
            created_at INTEGER NOT NULL
          )`,
        ),
        db.prepare(
          `CREATE INDEX IF NOT EXISTS idx_login_logs_user ON login_logs (user_id, created_at DESC)`,
        ),
        db.prepare(
          `CREATE TABLE IF NOT EXISTS watch_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            source_code TEXT NOT NULL DEFAULT '',
            source_name TEXT NOT NULL DEFAULT '',
            vod_id TEXT NOT NULL DEFAULT '',
            episode_index INTEGER NOT NULL DEFAULT 0,
            episode_name TEXT NOT NULL DEFAULT '',
            progress REAL NOT NULL DEFAULT 0,
            duration REAL NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            UNIQUE (user_id, source_code, vod_id, episode_index)
          )`,
        ),
        db.prepare(
          `CREATE INDEX IF NOT EXISTS idx_watch_user ON watch_records (user_id, updated_at DESC)`,
        ),
        db.prepare(
          `CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
          )`,
        ),
      ])
      // 老表补列（列已存在时 ALTER 会报错，忽略即可）
      const columnAdditions: Array<[string, string, string]> = [
        ['login_logs', 'country', 'TEXT'],
        ['login_logs', 'region', 'TEXT'],
        ['login_logs', 'city', 'TEXT'],
        // 用户到期时间（unix 秒，NULL = 无限制），由管理员在后台设置
        ['users', 'expires_at', 'INTEGER'],
      ]
      for (const [table, column, type] of columnAdditions) {
        try {
          await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run()
        } catch {
          // 列已存在
        }
      }
    })().catch(error => {
      schemaPromise = null
      throw error
    })
  }
  return schemaPromise
}

// ---------- 加密工具 ----------

function toHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

export function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return toHex(bytes)
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return toHex(digest)
}

const PBKDF2_ITERATIONS = 100000

export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: fromHex(saltHex) as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    256,
  )
  return toHex(bits)
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export async function verifyPassword(
  password: string,
  saltHex: string,
  expectedHashHex: string,
): Promise<boolean> {
  const actual = await hashPassword(password, saltHex)
  return timingSafeEqualHex(actual, expectedHashHex)
}

// ---------- 输入校验 ----------

export function validateUsername(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const username = raw.trim()
  if (username.length < 3 || username.length > 24) return null
  if (!/^[\p{L}\p{N}_-]+$/u.test(username)) return null
  if (username.toLowerCase() === 'admin') return null
  return username
}

export function validatePassword(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  if (raw.length < 6 || raw.length > 64) return null
  return raw
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}

export function clampText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return ''
  return value.slice(0, maxLength)
}

export function clampNumber(value: unknown, min: number, max: number): number {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return min
  return Math.min(max, Math.max(min, num))
}

// ---------- 会话 ----------

export async function createSession(
  db: D1Database,
  user: SessionUser,
): Promise<{ token: string; expiresAt: number }> {
  const token = randomHex(32)
  const tokenHash = await sha256Hex(token)
  const createdAt = nowSeconds()
  const expiresAt = createdAt + SESSION_TTL_SECONDS
  await db
    .prepare(
      'INSERT INTO sessions (token_hash, user_id, username, role, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(tokenHash, user.userId, user.username, user.role, createdAt, expiresAt)
    .run()
  return { token, expiresAt }
}

export async function getSessionUser(
  db: D1Database,
  request: Request,
): Promise<SessionUser | null> {
  const auth = request.headers.get('Authorization') ?? ''
  const match = auth.match(/^Bearer\s+(.+)$/i)
  if (!match) return null
  const tokenHash = await sha256Hex(match[1].trim())
  const row = await db
    .prepare(
      `SELECT s.user_id AS userId, s.username AS username, s.role AS role, s.expires_at AS expiresAt,
              u.disabled AS disabled, u.id AS realUserId, u.expires_at AS userExpiresAt
       FROM sessions s LEFT JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`,
    )
    .bind(tokenHash)
    .first<{
      userId: number
      username: string
      role: string
      expiresAt: number
      disabled: number | null
      realUserId: number | null
      userExpiresAt: number | null
    }>()
  if (!row) return null
  if (row.expiresAt < nowSeconds()) {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run()
    return null
  }
  const isMaster = row.userId === MASTER_USER_ID
  if (!isMaster) {
    // 账号被删、被禁用或已到期 时会话立即失效
    if (row.realUserId === null || row.disabled === 1) return null
    if (row.userExpiresAt !== null && row.userExpiresAt < nowSeconds()) return null
  }
  return {
    userId: row.userId,
    username: row.username,
    role: row.role === 'admin' ? 'admin' : 'user',
    isMaster,
  }
}

export async function deleteSession(db: D1Database, request: Request): Promise<void> {
  const auth = request.headers.get('Authorization') ?? ''
  const match = auth.match(/^Bearer\s+(.+)$/i)
  if (!match) return
  const tokenHash = await sha256Hex(match[1].trim())
  await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run()
}

export async function requireUser(
  context: PagesContext,
): Promise<{ db: D1Database; user: SessionUser } | Response> {
  const db = context.env.TGYS_DB
  if (!db) return json({ error: '账号系统未配置' }, 503)
  await ensureSchema(db)
  const user = await getSessionUser(db, context.request)
  if (!user) return json({ error: '未登录或登录已过期' }, 401)
  return { db, user }
}

export async function requireAdmin(
  context: PagesContext,
): Promise<{ db: D1Database; user: SessionUser } | Response> {
  const result = await requireUser(context)
  if (result instanceof Response) return result
  if (result.user.role !== 'admin') return json({ error: '无管理员权限' }, 403)
  return result
}

// ---------- 站点设置（注册开关） ----------

export const DOUBAN_DATA_PROXY_TYPES = [
  'direct',
  'cors-proxy-zwei',
  'cmliussss-cdn-tencent',
  'cmliussss-cdn-ali',
  'custom',
] as const

export const DOUBAN_IMAGE_PROXY_TYPES = [
  'server',
  'direct',
  'img3',
  'cmliussss-cdn-tencent',
  'cmliussss-cdn-ali',
  'custom',
] as const

export interface DoubanProxySettings {
  dataType: string
  dataUrl: string
  imageType: string
  imageUrl: string
}

export const DEFAULT_DOUBAN_PROXY: DoubanProxySettings = {
  dataType: 'direct',
  dataUrl: '',
  imageType: 'server',
  imageUrl: '',
}

/** 读取豆瓣代理设置（管理员后台配置，存 settings 表）；非法值回退默认 */
export async function readDoubanProxySettings(db: D1Database): Promise<DoubanProxySettings> {
  const [dataType, dataUrl, imageType, imageUrl] = await Promise.all([
    getSetting(db, 'douban_data_proxy_type'),
    getSetting(db, 'douban_data_proxy_url'),
    getSetting(db, 'douban_image_proxy_type'),
    getSetting(db, 'douban_image_proxy_url'),
  ])
  return {
    dataType: (DOUBAN_DATA_PROXY_TYPES as readonly string[]).includes(dataType ?? '')
      ? (dataType as string)
      : DEFAULT_DOUBAN_PROXY.dataType,
    dataUrl: dataUrl ?? '',
    imageType: (DOUBAN_IMAGE_PROXY_TYPES as readonly string[]).includes(imageType ?? '')
      ? (imageType as string)
      : DEFAULT_DOUBAN_PROXY.imageType,
    imageUrl: imageUrl ?? '',
  }
}

/**
 * 管理员对托管源（环境变量/管理员后台设置的初始源）的显式开关表
 * （settings 键 managed_source_enabled，JSON 对象 id→布尔）。
 * 表中有的源：全站所有用户按表中的开关使用；表里没有的源：按源文件自身的默认开关。
 * 用户自己添加的源不在此列，仍归各人本地控制。
 */
export async function readManagedSourceEnabled(db: D1Database): Promise<Record<string, boolean>> {
  const raw = await getSetting(db, 'managed_source_enabled')
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const result: Record<string, boolean> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'boolean' && key) result[key] = value
      if (Object.keys(result).length >= 500) break
    }
    return result
  } catch {
    return {}
  }
}

/** 校验并规整待保存的开关表：只留布尔值条目、键限长、限条数 */
export function sanitizeManagedSourceEnabled(value: unknown): Record<string, boolean> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const result: Record<string, boolean> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (typeof val !== 'boolean') continue
    const id = key.trim().slice(0, 128)
    if (id) result[id] = val
    if (Object.keys(result).length >= 500) break
  }
  return result
}

export async function getSetting(db: D1Database, key: string): Promise<string | null> {
  const row = await db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .bind(key)
    .first<{ value: string }>()
  return row?.value ?? null
}

export async function setSetting(db: D1Database, key: string, value: string): Promise<void> {
  await db
    .prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    )
    .bind(key, value)
    .run()
}

/** 注册是否开放：后台设置优先，其次环境变量 TGYS_REGISTRATION_OPEN，默认开放 */
export async function isRegistrationOpen(db: D1Database, env: AuthEnv): Promise<boolean> {
  const stored = await getSetting(db, 'registration_open')
  if (stored === '1') return true
  if (stored === '0') return false
  const envValue = (env.TGYS_REGISTRATION_OPEN ?? '').trim().toLowerCase()
  return envValue !== '0' && envValue !== 'false'
}

// ---------- Turnstile（可选：配置了 Secret 才校验） ----------

export async function verifyTurnstile(env: AuthEnv, token: string | undefined): Promise<boolean> {
  const secret = env.TGYS_TURNSTILE_SECRET
  if (!secret) return true
  if (!token) return false
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    })
    const data = (await response.json()) as { success?: boolean }
    return data.success === true
  } catch {
    return false
  }
}
