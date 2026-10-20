import { describe, it, expect } from 'vitest'
import { migrateLegacyStorageKeys } from './legacyStorageMigration'

function createFakeStorage(initial: Record<string, string>): Storage {
  const data = new Map(Object.entries(initial))
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => {
      data.delete(key)
    },
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
  }
}

describe('migrateLegacyStorageKeys', () => {
  it('把 ouonnki-tv- 前缀的键搬到 tgys-tv- 并删除旧键', () => {
    const storage = createFakeStorage({
      'ouonnki-tv-favorites-store': '{"state":{"favorites":[1]}}',
      'ouonnki-tv-viewing-history': '{"state":{"viewingHistory":[2]}}',
      'unrelated-key': 'keep',
    })

    const migrated = migrateLegacyStorageKeys(storage)

    expect(migrated).toBe(2)
    expect(storage.getItem('tgys-tv-favorites-store')).toBe('{"state":{"favorites":[1]}}')
    expect(storage.getItem('tgys-tv-viewing-history')).toBe('{"state":{"viewingHistory":[2]}}')
    expect(storage.getItem('ouonnki-tv-favorites-store')).toBeNull()
    expect(storage.getItem('unrelated-key')).toBe('keep')
  })

  it('新键已有数据时不覆盖，仅清理旧键', () => {
    const storage = createFakeStorage({
      'ouonnki-tv-favorites-store': 'old',
      'tgys-tv-favorites-store': 'new',
    })

    const migrated = migrateLegacyStorageKeys(storage)

    expect(migrated).toBe(0)
    expect(storage.getItem('tgys-tv-favorites-store')).toBe('new')
    expect(storage.getItem('ouonnki-tv-favorites-store')).toBeNull()
  })

  it('没有旧键时什么都不做', () => {
    const storage = createFakeStorage({ 'tgys-tv-favorites-store': 'new' })
    expect(migrateLegacyStorageKeys(storage)).toBe(0)
    expect(storage.getItem('tgys-tv-favorites-store')).toBe('new')
  })
})
