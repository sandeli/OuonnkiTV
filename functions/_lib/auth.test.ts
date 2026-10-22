import { describe, expect, it } from 'vitest'
import {
  clampNumber,
  clampText,
  generateInviteCode,
  getRegistrationMode,
  hashPassword,
  inviteCodeStatus,
  randomHex,
  sha256Hex,
  validatePassword,
  validateUsername,
  verifyPassword,
  type AuthEnv,
  type D1Database,
} from './auth'

describe('账号校验', () => {
  it('用户名：3-24 位文字/数字/下划线/连字符，admin 保留', () => {
    expect(validateUsername('abc')).toBe('abc')
    expect(validateUsername(' 张三_9-x ')).toBe('张三_9-x')
    expect(validateUsername('ab')).toBeNull()
    expect(validateUsername('admin')).toBeNull()
    expect(validateUsername('ADMIN')).toBeNull()
    expect(validateUsername('a b')).toBeNull()
    expect(validateUsername('x'.repeat(25))).toBeNull()
    expect(validateUsername(123)).toBeNull()
  })

  it('密码：6-64 位', () => {
    expect(validatePassword('123456')).toBe('123456')
    expect(validatePassword('12345')).toBeNull()
    expect(validatePassword('x'.repeat(65))).toBeNull()
  })

  it('clamp 工具', () => {
    expect(clampText('abcdef', 3)).toBe('abc')
    expect(clampText(42, 3)).toBe('')
    expect(clampNumber(120, 0, 100)).toBe(100)
    expect(clampNumber(Number.NaN, 0, 100)).toBe(0)
  })
})

describe('密码哈希与令牌摘要', () => {
  it('同盐同密码结果一致，异盐不同；校验可通过/拒绝', async () => {
    const salt = randomHex(16)
    const hash1 = await hashPassword('p@ssw0rd', salt)
    const hash2 = await hashPassword('p@ssw0rd', salt)
    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64)

    const otherSaltHash = await hashPassword('p@ssw0rd', randomHex(16))
    expect(otherSaltHash).not.toBe(hash1)

    expect(await verifyPassword('p@ssw0rd', salt, hash1)).toBe(true)
    expect(await verifyPassword('wrong-pass', salt, hash1)).toBe(false)
  })

  it('sha256Hex 稳定且为 64 位十六进制', async () => {
    const digest = await sha256Hex('tgys-token')
    expect(digest).toHaveLength(64)
    expect(await sha256Hex('tgys-token')).toBe(digest)
  })
})

/** 只实现 settings 读取的最小 D1 假实现（getSetting 只用 prepare→bind→first） */
function fakeDb(settings: Record<string, string>): D1Database {
  return {
    prepare: () => ({
      bind: (key: string) => ({
        first: async () => (settings[key] !== undefined ? { value: settings[key] } : null),
      }),
    }),
  } as unknown as D1Database
}

describe('注册模式', () => {
  const env = {} as AuthEnv
  it('默认开放；旧开关关闭则关闭', async () => {
    expect(await getRegistrationMode(fakeDb({}), env)).toBe('open')
    expect(await getRegistrationMode(fakeDb({ registration_open: '0' }), env)).toBe('closed')
    expect(
      await getRegistrationMode(fakeDb({}), { TGYS_REGISTRATION_OPEN: '0' } as AuthEnv),
    ).toBe('closed')
  })
  it('registration_mode 优先于旧开关', async () => {
    expect(
      await getRegistrationMode(fakeDb({ registration_mode: 'invite', registration_open: '1' }), env),
    ).toBe('invite')
    expect(
      await getRegistrationMode(fakeDb({ registration_mode: 'open', registration_open: '0' }), env),
    ).toBe('open')
    expect(await getRegistrationMode(fakeDb({ registration_mode: 'bogus' }), env)).toBe('open')
  })
})

describe('邀请码', () => {
  it('生成 10 位易读码（无易混字符）且多次不重复', () => {
    const codes = new Set<string>()
    for (let i = 0; i < 50; i += 1) {
      const code = generateInviteCode()
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{10}$/)
      codes.add(code)
    }
    expect(codes.size).toBe(50)
  })
  it('状态：可用 / 用完 / 过期（过期优先）', () => {
    const now = 1_700_000_000
    expect(inviteCodeStatus({ maxUses: 1, usedCount: 0, expiresAt: null }, now)).toBe('usable')
    expect(inviteCodeStatus({ maxUses: 1, usedCount: 1, expiresAt: null }, now)).toBe('exhausted')
    expect(inviteCodeStatus({ maxUses: 3, usedCount: 1, expiresAt: now - 1 }, now)).toBe('expired')
    expect(inviteCodeStatus({ maxUses: 3, usedCount: 1, expiresAt: now + 60 }, now)).toBe('usable')
  })
})
