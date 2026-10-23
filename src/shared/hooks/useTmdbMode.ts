import { useSettingStore } from '@/shared/store/settingStore'
import { useAuthStore } from '@/shared/store/authStore'
import { getSiteBehavior } from '@/shared/config/api.config'

/** 获取当前 TMDB 模式是否启用（React hook）：管理员后台的站点开关优先，未设置时用本地开关 */
export function useTmdbEnabled(): boolean {
  const siteEnabled = useAuthStore(state => state.authConfig?.siteBehavior?.tmdbEnabled)
  const localEnabled = useSettingStore(state => state.system.tmdbEnabled)
  return siteEnabled ?? localEnabled
}

/** 非 hook 场景下获取 TMDB 模式状态 */
export function isTmdbEnabled(): boolean {
  return getSiteBehavior().tmdbEnabled ?? useSettingStore.getState().system.tmdbEnabled
}
