import { describe, expect, it } from 'vitest'
import type { VideoSource } from '@tgys/cms-core'
import {
  applyAccountMirror,
  collectAccountSources,
  fromAccountSourcePayload,
  serializeAccountSources,
  toAccountSourcePayload,
} from './accountSources'

const src = (partial: Partial<VideoSource> & { id: string }): VideoSource => ({
  name: partial.id,
  url: `https://${partial.id}.example/api`,
  isEnabled: true,
  ...partial,
})

describe('collectAccountSources 账户源集合口径', () => {
  it('包含手动源与已登记的托管形态全站源，排除订阅源与基础托管源', () => {
    const list = [
      src({ id: 'manual1' }),
      src({ id: 'managed_base' }),
      src({ id: 'managed_sitewide', siteWide: true }),
      src({ id: 'sub:sub1:xyz' }),
    ]
    const out = collectAccountSources(list, ['managed_base', 'managed_sitewide'], ['managed_sitewide'])
    expect(out.map(s => s.id)).toEqual(['manual1', 'managed_sitewide'])
  })

  it('未登记的手动源即使不在 accountSourceIds 里也会被收集（待同步）', () => {
    const out = collectAccountSources([src({ id: 'fresh' })], [], [])
    expect(out.map(s => s.id)).toEqual(['fresh'])
  })
})

describe('载荷映射与序列化', () => {
  it('toAccountSourcePayload 固定字段且 detailUrl 与 url 相同则省略', () => {
    const a = toAccountSourcePayload(src({ id: 'x', detailUrl: 'https://x.example/api' }))
    expect(a).toEqual({ id: 'x', name: 'x', url: 'https://x.example/api', isEnabled: true, siteWide: false })
    const b = toAccountSourcePayload(src({ id: 'y', detailUrl: 'https://y.example/detail', siteWide: true }))
    expect(b.detailUrl).toBe('https://y.example/detail')
    expect(b.siteWide).toBe(true)
  })

  it('序列化不受 updatedAt 变化影响（变更检测稳定）', () => {
    const a = src({ id: 'x', updatedAt: new Date('2026-01-01T00:00:00Z') })
    const b = src({ id: 'x', updatedAt: new Date('2026-06-01T00:00:00Z') })
    expect(serializeAccountSources([a])).toBe(serializeAccountSources([b]))
    expect(serializeAccountSources([a])).not.toBe(
      serializeAccountSources([{ ...b, siteWide: true }]),
    )
  })

  it('fromAccountSourcePayload 还原成本地源（detailUrl 缺省回退 url）', () => {
    const out = fromAccountSourcePayload({
      id: 'x',
      name: '甲',
      url: 'https://x.example/api',
      isEnabled: false,
      siteWide: true,
    })
    expect(out).toMatchObject({
      id: 'x',
      name: '甲',
      detailUrl: 'https://x.example/api',
      isEnabled: false,
      siteWide: true,
    })
  })
})

describe('applyAccountMirror 账户源镜像', () => {
  it('摘除旧个人账户源、把新集合插回原位置，托管与订阅源不动', () => {
    const current = [
      src({ id: 'managed_base' }),
      src({ id: 'acct_old1' }),
      src({ id: 'acct_old2' }),
      src({ id: 'sub:sub1:1' }),
    ]
    const incoming = [src({ id: 'acct_new1' }), src({ id: 'acct_old2', name: '改名' })]
    const result = applyAccountMirror(current, ['acct_old1', 'acct_old2'], incoming, ['managed_base'])
    expect(result.videoAPIs.map(s => s.id)).toEqual(['managed_base', 'acct_new1', 'acct_old2', 'sub:sub1:1'])
    expect(result.videoAPIs.find(s => s.id === 'acct_old2')?.name).toBe('改名')
    expect(result.accountSourceIds).toEqual(['acct_new1', 'acct_old2'])
  })

  it('已以托管形态展示的全站源只登记 id、不重复插入', () => {
    const current = [src({ id: 'managed_sitewide', siteWide: true }), src({ id: 'acct_a' })]
    const incoming = [src({ id: 'managed_sitewide', siteWide: true }), src({ id: 'acct_a' })]
    const result = applyAccountMirror(current, ['acct_a'], incoming, ['managed_sitewide'])
    expect(result.videoAPIs.map(s => s.id)).toEqual(['managed_sitewide', 'acct_a'])
    expect(result.accountSourceIds).toEqual(['managed_sitewide', 'acct_a'])
  })

  it('服务端删掉的个人源在镜像后消失（删除跨设备传播）', () => {
    const current = [src({ id: 'acct_a' }), src({ id: 'acct_b' })]
    const result = applyAccountMirror(current, ['acct_a', 'acct_b'], [src({ id: 'acct_a' })], [])
    expect(result.videoAPIs.map(s => s.id)).toEqual(['acct_a'])
    expect(result.accountSourceIds).toEqual(['acct_a'])
  })
})
