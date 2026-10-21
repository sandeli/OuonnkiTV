import { describe, expect, it } from 'vitest'
import {
  clampNumber,
  clampText,
  hashPassword,
  randomHex,
  sha256Hex,
  validatePassword,
  validateUsername,
  verifyPassword,
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
