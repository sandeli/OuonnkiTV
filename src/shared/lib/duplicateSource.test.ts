import { describe, expect, it } from 'vitest'
import type { VideoSource } from '@tgys/cms-core'
import { findDuplicateVideoSource } from './duplicateSource'

const src = (partial: Partial<VideoSource> & { id: string }): VideoSource => ({
  name: partial.id,
  url: `https://${partial.id}.example/api`,
  isEnabled: true,
  ...partial,
})

describe('findDuplicateVideoSource 判重口径', () => {
  it('名称+地址都相同算重复，返回撞到的那条', () => {
    const list = [src({ id: 'managed1', name: '量子', url: 'https://cj.example/api' })]
    const dup = findDuplicateVideoSource(list, { name: '量子', url: 'https://cj.example/api' })
    expect(dup?.id).toBe('managed1')
  })

  it('只同名或只同址都不算重复', () => {
    const list = [src({ id: 'a', name: '量子', url: 'https://cj.example/api' })]
    expect(findDuplicateVideoSource(list, { name: '量子', url: 'https://other.example/api' })).toBeUndefined()
    expect(findDuplicateVideoSource(list, { name: '非凡', url: 'https://cj.example/api' })).toBeUndefined()
  })

  it('编辑时排除自己：只剩自己不算重复，撞到别人算', () => {
    const list = [
      src({ id: 'self', name: '量子', url: 'https://cj.example/api' }),
      src({ id: 'other', name: '非凡', url: 'https://ff.example/api' }),
    ]
    expect(
      findDuplicateVideoSource(list, { name: '量子', url: 'https://cj.example/api' }, 'self'),
    ).toBeUndefined()
    expect(
      findDuplicateVideoSource(list, { name: '非凡', url: 'https://ff.example/api' }, 'self')?.id,
    ).toBe('other')
  })
})
