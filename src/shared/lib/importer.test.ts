import { describe, expect, it } from 'vitest'
import type { SourceStore, VideoSource } from '@tgys/cms-core'
import { importSources } from '@tgys/cms-core/source'

const emptyStore: SourceStore = { sources: [], version: 1 }

describe('importSources 字段透传', () => {
  it('保留 siteWide 全站生效标记（托管镜像导入全站源时不能丢）', () => {
    const incoming: Partial<VideoSource>[] = [
      { id: 'sw1', name: '西瓜资源', url: 'https://xg.example/api', siteWide: true },
      { id: 'base1', name: '后台源', url: 'https://base.example/api' },
    ]
    const { store, result } = importSources(emptyStore, incoming, { skipInvalid: true })
    expect(result.imported).toBe(2)
    const byId = new Map(store.sources.map(s => [s.id, s]))
    expect(byId.get('sw1')?.siteWide).toBe(true)
    expect(byId.get('base1')?.siteWide).toBeUndefined()
  })
})
