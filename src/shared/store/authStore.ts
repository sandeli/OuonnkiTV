import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { getPublicEnv } from '@/shared/config/runtimeEnv'
import {
  AuthApiError,
  fetchAuthConfig,
  fetchMe,
  loginAccount,
  logoutAccount,
  registerAccount,
  type AuthPublicConfig,
  type AuthUser,
} from '@/shared/lib/authApi'

/**
 * 认证存储，两种模式：
 * - server：站点部署在 Cloudflare Pages 且绑定了 D1，账号/会话由服务器接口管理
 * - legacy：无账号系统时回退到原来的单密码本地校验（TGYS_ACCESS_PASSWORD）
 * 模式由 probeConfig() 拉取 /api/auth/config 决定。
 */
export type AuthMode = 'server' | 'legacy'

export interface AuthResult {
  ok: boolean
  error?: string
}

interface AuthState {
  /** 服务器会话令牌（server 模式） */
  token: string | null
  /** 当前登录用户（server 模式） */
  user: AuthUser | null
  /** 旧单密码模式的本地会话（legacy 模式） */
  sessionToken: string | null
  salt: string | null
  authMode: AuthMode | null
  authConfig: AuthPublicConfig | null
  isInitialized: boolean
}

type PersistedAuthState = Pick<AuthState, 'token' | 'user' | 'sessionToken' | 'salt' | 'authMode'>

interface AuthActions {
  probeConfig: () => Promise<AuthPublicConfig>
  /** 账号登录（server 模式） */
  loginWithAccount: (username: string, password: string) => Promise<AuthResult>
  /** 注册（server 模式，注册成功即登录） */
  register: (username: string, password: string, turnstileToken?: string) => Promise<AuthResult>
  /** 单密码登录：server 模式下即站长登录（admin），legacy 模式下是原访问密码 */
  login: (password: string) => Promise<boolean>
  logout: () => Promise<void>
  validateSession: () => Promise<boolean>
}

type AuthStore = AuthState & AuthActions

const generateSalt = () => {
  const array = new Uint8Array(16)
  window.crypto.getRandomValues(array)
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

const computeHash = async (message: string) => {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

let probePromise: Promise<AuthPublicConfig> | null = null

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      sessionToken: null,
      salt: null,
      authMode: null,
      authConfig: null,
      isInitialized: false,

      probeConfig: () => {
        if (!probePromise) {
          probePromise = fetchAuthConfig()
            .then(config => {
              set({
                authConfig: config,
                authMode: config.authEnabled ? 'server' : 'legacy',
              })
              return config
            })
            .finally(() => {
              probePromise = null
            })
        }
        return probePromise
      },

      loginWithAccount: async (username, password) => {
        try {
          const { token, user } = await loginAccount(username, password)
          set({ token, user, isInitialized: true })
          return { ok: true }
        } catch (error) {
          return {
            ok: false,
            error: error instanceof AuthApiError ? error.message : '登录失败，请稍后重试',
          }
        }
      },

      register: async (username, password, turnstileToken) => {
        try {
          const { token, user } = await registerAccount(username, password, turnstileToken)
          set({ token, user, isInitialized: true })
          return { ok: true }
        } catch (error) {
          return {
            ok: false,
            error: error instanceof AuthApiError ? error.message : '注册失败，请稍后重试',
          }
        }
      },

      login: async (password: string) => {
        // server 模式：单密码即站长登录
        if (get().authMode === 'server') {
          const result = await get().loginWithAccount('admin', password)
          return result.ok
        }

        const correctPassword = getPublicEnv('TGYS_ACCESS_PASSWORD')
        if (!correctPassword) {
          return true
        }
        if (password === correctPassword) {
          const salt = generateSalt()
          const token = await computeHash(correctPassword + salt)
          set({ sessionToken: token, salt, isInitialized: true })
          return true
        }
        return false
      },

      logout: async () => {
        const { token } = get()
        if (token) {
          await logoutAccount(token)
        }
        set({ token: null, user: null, sessionToken: null, salt: null, isInitialized: true })
      },

      validateSession: async () => {
        const state = get()
        if (state.authMode === 'server') {
          if (!state.token) return false
          try {
            const user = await fetchMe(state.token)
            set({ user, isInitialized: true })
            return true
          } catch {
            set({ token: null, user: null })
            return false
          }
        }

        // legacy 模式：原本地校验逻辑
        const { sessionToken, salt } = get()
        const correctPassword = getPublicEnv('TGYS_ACCESS_PASSWORD')
        if (!correctPassword) {
          return true
        }
        if (!sessionToken || !salt) {
          return false
        }
        const expectedToken = await computeHash(correctPassword + salt)
        if (sessionToken === expectedToken) {
          return true
        }
        set({ sessionToken: null, salt: null })
        return false
      },
    }),
    {
      name: 'auth-storage',
      version: 2,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state): PersistedAuthState => ({
        token: state.token,
        user: state.user,
        sessionToken: state.sessionToken,
        salt: state.salt,
        authMode: state.authMode,
      }),
      migrate: (persistedState: unknown): PersistedAuthState => {
        const old = (persistedState ?? {}) as Partial<PersistedAuthState>
        return {
          token: old.token ?? null,
          user: old.user ?? null,
          sessionToken: old.sessionToken ?? null,
          salt: old.salt ?? null,
          authMode: null,
        }
      },
    },
  ),
)
