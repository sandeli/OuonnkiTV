/**
 * 旧存储键一次性迁移（品牌改名 Ouonnki → TGYS）
 *
 * 改名时 zustand persist 的键名从 `ouonnki-tv-*` 改为 `tgys-tv-*`，
 * 老用户浏览器 localStorage 里的收藏、观看历史、设置、已配源等数据还在旧键下。
 * 本模块在应用入口最先执行：把旧键数据搬到新键（新键已有数据时不覆盖），然后删除旧键。
 */

/** 把 localStorage 中所有旧前缀的键搬到新前缀下，返回搬移的键数量 */
export function migrateLegacyStorageKeys(
  storage: Storage,
  legacyPrefix = 'ouonnki-tv-',
  currentPrefix = 'tgys-tv-',
): number {
  let migrated = 0
  try {
    const legacyKeys: string[] = []
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i)
      if (key && key.startsWith(legacyPrefix)) {
        legacyKeys.push(key)
      }
    }

    for (const legacyKey of legacyKeys) {
      const currentKey = currentPrefix + legacyKey.slice(legacyPrefix.length)
      const value = storage.getItem(legacyKey)
      if (value === null) continue
      // 新键已有数据（用户已在新版本产生数据）时不覆盖，只清理旧键
      if (storage.getItem(currentKey) === null) {
        storage.setItem(currentKey, value)
        migrated += 1
      }
      storage.removeItem(legacyKey)
    }
  } catch {
    // 存储不可用（隐私模式/被禁用）时静默跳过，不影响应用启动
  }
  return migrated
}

// 浏览器环境下模块加载即执行（必须早于任何 store 的持久化读取）
if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
  migrateLegacyStorageKeys(localStorage)
}
