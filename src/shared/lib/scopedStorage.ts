import { createJSONStorage, type StateStorage } from 'zustand/middleware'
import { useAuthStore } from '@/shared/store/authStore'

/**
 * 按登录身份分仓的本地存储：
 * 同一浏览器上不同账号的历史/收藏互不可见，各账号一份数据。
 * 实际键为 `<name>::<scope>`，scope 取值：
 * - server 账号：`u<用户ID>`（站长为 u0）
 * - 旧版单密码模式：`legacy`
 * - 未登录：`guest`
 */
export function currentAuthScope(): string {
  try {
    const state = useAuthStore.getState()
    if (state.authMode === 'server' && state.user) return `u${state.user.id}`
    if (state.authMode === 'legacy' && state.sessionToken) return 'legacy'
    return 'guest'
  } catch {
    return 'guest'
  }
}

/**
 * 给 zustand persist 用的分仓 storage。
 * 收编规则：某身份首次读取且分仓为空时，若存在旧版未分仓数据（键为 `<name>`），
 * 将其移入当前身份的分仓并删除旧键——旧数据归当前登录者所有，
 * 之后其他账号登录不会再看到这份共享数据。guest 不收编。
 */
export function createScopedStorage() {
  return createJSONStorage((): StateStorage => ({
    getItem: (name: string): string | null => {
      const scope = currentAuthScope()
      const scopedKey = `${name}::${scope}`
      const hit = localStorage.getItem(scopedKey)
      if (hit !== null) return hit
      if (scope !== 'guest') {
        const legacy = localStorage.getItem(name)
        if (legacy !== null) {
          localStorage.setItem(scopedKey, legacy)
          localStorage.removeItem(name)
          return legacy
        }
      }
      return null
    },
    setItem: (name: string, value: string): void => {
      localStorage.setItem(`${name}::${currentAuthScope()}`, value)
    },
    removeItem: (name: string): void => {
      localStorage.removeItem(`${name}::${currentAuthScope()}`)
    },
  }))
}

/** 登录身份变化（登录/退出/切换账号）时回调，通常用于让对应 store 重新 rehydrate 换仓 */
export function onAuthScopeChange(rehydrate: () => void): () => void {
  let last = currentAuthScope()
  return useAuthStore.subscribe(() => {
    const next = currentAuthScope()
    if (next !== last) {
      last = next
      rehydrate()
    }
  })
}
