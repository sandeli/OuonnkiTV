import { beforeEach, describe, expect, it } from 'vitest'
import { createScopedStorage, currentAuthScope } from './scopedStorage'
import { useAuthStore } from '@/shared/store/authStore'

const NAME = 'tgys-tv-viewing-history'

function asUser(id: number) {
  useAuthStore.setState({
    authMode: 'server',
    user: { id, username: `user${id}`, role: 'user' },
    token: 't',
    sessionToken: null,
  })
}

function asGuest() {
  useAuthStore.setState({ authMode: 'server', user: null, token: null, sessionToken: null })
}

function rawStorage() {
  const inner = createScopedStorage() as unknown as {
    getItem: (n: string) => string | null
    setItem: (n: string, v: string) => void
    removeItem: (n: string) => void
  }
  return inner
}

describe('scopedStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    asGuest()
  })

  it('未登录时 scope 为 guest', () => {
    expect(currentAuthScope()).toBe('guest')
  })

  it('不同账号读写互不可见', () => {
    const storage = rawStorage()
    asUser(7)
    storage.setItem(NAME, '{"state":{"viewingHistory":[7]}}')
    asUser(9)
    expect(storage.getItem(NAME)).toBeNull()
    storage.setItem(NAME, '{"state":{"viewingHistory":[9]}}')
    asUser(7)
    expect(storage.getItem(NAME)).toContain('[7]')
    asUser(9)
    expect(storage.getItem(NAME)).toContain('[9]')
    expect(localStorage.getItem(`${NAME}::u7`)).toContain('[7]')
    expect(localStorage.getItem(`${NAME}::u9`)).toContain('[9]')
  })

  it('旧版未分仓数据由首个登录账号收编，后续账号不再继承', () => {
    localStorage.setItem(NAME, '{"state":{"viewingHistory":[1]}}')
    const storage = rawStorage()
    asUser(3)
    expect(JSON.stringify(storage.getItem(NAME))).toContain('[1]')
    expect(localStorage.getItem(NAME)).toBeNull()
    expect(localStorage.getItem(`${NAME}::u3`)).toContain('[1]')
    asUser(4)
    expect(storage.getItem(NAME)).toBeNull()
  })

  it('guest 不收编旧版数据', () => {
    localStorage.setItem(NAME, '{"state":{"viewingHistory":[1]}}')
    const storage = rawStorage()
    expect(storage.getItem(NAME)).toBeNull()
    expect(localStorage.getItem(NAME)).toContain('[1]')
  })

  it('旧版单密码模式 scope 为 legacy 并可收编', () => {
    useAuthStore.setState({ authMode: 'legacy', user: null, token: null, sessionToken: 's' })
    expect(currentAuthScope()).toBe('legacy')
    localStorage.setItem(NAME, '{"state":{"viewingHistory":[5]}}')
    const storage = rawStorage()
    expect(JSON.stringify(storage.getItem(NAME))).toContain('[5]')
    expect(localStorage.getItem(`${NAME}::legacy`)).toContain('[5]')
  })
})
