/**
 * 账号系统前端客户端（对接 functions/api 下的 Pages Functions 接口）。
 * 非 Cloudflare Pages 部署或未绑定 D1 时，config 接口不可用 → authEnabled=false，站点回退旧单密码模式。
 */

export interface AuthUser {
  id: number
  username: string
  role: 'admin' | 'user'
  isMaster?: boolean
}

export interface AnnouncementConfig {
  enabled: boolean
  content: string
  version: number
}

export interface DoubanProxyConfig {
  /** 数据代理：direct=本站服务器转发 / cors-proxy-zwei / cmliussss-cdn-tencent / cmliussss-cdn-ali / custom */
  dataType: string
  dataUrl: string
  /** 图片代理：server=本站代理 / direct / img3 / cmliussss-cdn-tencent / cmliussss-cdn-ali / custom */
  imageType: string
  imageUrl: string
}

export const DEFAULT_DOUBAN_PROXY: DoubanProxyConfig = {
  dataType: 'direct',
  dataUrl: '',
  imageType: 'server',
  imageUrl: '',
}

export interface AuthPublicConfig {
  authEnabled: boolean
  registrationOpen: boolean
  turnstileSiteKey: string
  announcement: AnnouncementConfig | null
  /** 首页滚动公告（管理员后台设置；空字符串表示未设置，前端回退环境变量） */
  announcementBar: string
  /** 豆瓣数据/图片代理（管理员后台设置） */
  doubanProxy: DoubanProxyConfig
}

export class AuthApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit, token?: string | null): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  let response: Response
  try {
    response = await fetch(path, { ...init, headers: { ...headers, ...(init?.headers ?? {}) } })
  } catch {
    throw new AuthApiError('网络异常，请稍后重试', 0)
  }
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null
  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : `请求失败 (${response.status})`
    throw new AuthApiError(message, response.status)
  }
  return data as T
}

/** 拉取账号系统公开配置；任何异常都视为未启用账号系统 */
export async function fetchAuthConfig(): Promise<AuthPublicConfig> {
  try {
    const response = await fetch('/api/auth/config')
    if (!response.ok) throw new Error('bad status')
    const data = (await response.json()) as Partial<AuthPublicConfig>
    const announcement =
      data.announcement && typeof data.announcement === 'object'
        ? {
            enabled: data.announcement.enabled === true,
            content: typeof data.announcement.content === 'string' ? data.announcement.content : '',
            version: typeof data.announcement.version === 'number' ? data.announcement.version : 0,
          }
        : null
    return {
      authEnabled: data.authEnabled === true,
      registrationOpen: data.registrationOpen === true,
      turnstileSiteKey: typeof data.turnstileSiteKey === 'string' ? data.turnstileSiteKey : '',
      announcement,
      announcementBar: typeof data.announcementBar === 'string' ? data.announcementBar : '',
      doubanProxy:
        data.doubanProxy && typeof data.doubanProxy === 'object'
          ? {
              dataType:
                typeof data.doubanProxy.dataType === 'string'
                  ? data.doubanProxy.dataType
                  : DEFAULT_DOUBAN_PROXY.dataType,
              dataUrl: typeof data.doubanProxy.dataUrl === 'string' ? data.doubanProxy.dataUrl : '',
              imageType:
                typeof data.doubanProxy.imageType === 'string'
                  ? data.doubanProxy.imageType
                  : DEFAULT_DOUBAN_PROXY.imageType,
              imageUrl:
                typeof data.doubanProxy.imageUrl === 'string' ? data.doubanProxy.imageUrl : '',
            }
          : DEFAULT_DOUBAN_PROXY,
    }
  } catch {
    return {
      authEnabled: false,
      registrationOpen: false,
      turnstileSiteKey: '',
      announcement: null,
      announcementBar: '',
      doubanProxy: DEFAULT_DOUBAN_PROXY,
    }
  }
}

interface SessionResponse {
  token: string
  expiresAt: number
  user: AuthUser
}

export function loginAccount(username: string, password: string): Promise<SessionResponse> {
  return request<SessionResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function registerAccount(
  username: string,
  password: string,
  turnstileToken?: string,
): Promise<SessionResponse> {
  return request<SessionResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, turnstileToken }),
  })
}

export async function fetchMe(token: string): Promise<AuthUser> {
  const data = await request<{ user: AuthUser }>('/api/auth/me', undefined, token)
  return data.user
}

export async function logoutAccount(token: string): Promise<void> {
  await request('/api/auth/logout', { method: 'POST' }, token).catch(() => undefined)
}

export interface WatchReportPayload {
  title: string
  sourceCode: string
  sourceName: string
  vodId: string
  episodeIndex: number
  episodeName?: string
  progress: number
  duration: number
}

export async function reportWatch(token: string, payload: WatchReportPayload): Promise<void> {
  await request('/api/activity/watch', { method: 'POST', body: JSON.stringify(payload) }, token)
}

// ---------- 管理员接口 ----------

export interface AdminUserRow {
  id: number
  username: string
  role: string
  disabled: number
  createdAt: number
  lastLoginAt: number | null
  expiresAt: number | null
  loginCount: number
  watchCount: number
  lastWatchAt: number | null
  lastWatchTitle: string | null
}

export interface AdminLoginLog {
  id: number
  ip: string | null
  userAgent: string | null
  country: string | null
  region: string | null
  city: string | null
  createdAt: number
}

export interface AdminWatchRecord {
  id: number
  title: string
  sourceCode: string
  sourceName: string
  vodId: string
  episodeIndex: number
  episodeName: string
  progress: number
  duration: number
  createdAt: number
  updatedAt: number
}

export interface AdminUserDetail {
  user: {
    id: number
    username: string
    role: string
    disabled: number
    createdAt: number
    lastLoginAt: number | null
    expiresAt: number | null
  }
  loginLogs: AdminLoginLog[]
  watchRecords: AdminWatchRecord[]
}

export async function adminListUsers(token: string): Promise<AdminUserRow[]> {
  const data = await request<{ users: AdminUserRow[] }>('/api/admin/users', undefined, token)
  return data.users
}

export function adminGetUserDetail(token: string, userId: number): Promise<AdminUserDetail> {
  return request<AdminUserDetail>(`/api/admin/users/${userId}`, undefined, token)
}

export function adminSetUserDisabled(
  token: string,
  userId: number,
  disabled: boolean,
): Promise<{ ok: boolean }> {
  return request(`/api/admin/users/${userId}/disable`, {
    method: 'POST',
    body: JSON.stringify({ disabled }),
  }, token)
}

export function adminSetUserExpiry(
  token: string,
  userId: number,
  days: number,
): Promise<{ ok: boolean; expiresAt: number | null }> {
  return request(
    `/api/admin/users/${userId}/expiry`,
    { method: 'POST', body: JSON.stringify({ days }) },
    token,
  )
}

export function adminKickUser(token: string, userId: number): Promise<{ ok: boolean }> {
  return request(`/api/admin/users/${userId}/kick`, { method: 'POST' }, token)
}

export function adminDeleteUser(token: string, userId: number): Promise<{ ok: boolean }> {
  return request(`/api/admin/users/${userId}`, { method: 'DELETE' }, token)
}

export interface AdminSettings {
  registrationOpen: boolean
  announcement: AnnouncementConfig
  announcementBar: string
  doubanProxy: DoubanProxyConfig
}

export function adminGetSettings(token: string): Promise<AdminSettings> {
  return request<AdminSettings>('/api/admin/settings', undefined, token)
}

export function adminUpdateSettings(
  token: string,
  patch: {
    registrationOpen?: boolean
    announcementEnabled?: boolean
    announcementContent?: string
    announcementBarContent?: string
    doubanDataProxyType?: string
    doubanDataProxyUrl?: string
    doubanImageProxyType?: string
    doubanImageProxyUrl?: string
  },
): Promise<{ ok: boolean } & AdminSettings> {
  return request('/api/admin/settings', { method: 'POST', body: JSON.stringify(patch) }, token)
}
