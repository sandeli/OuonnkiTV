import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createScopedStorage, onAuthScopeChange } from '@/shared/lib/scopedStorage'

/**
 * 豆瓣代理的个人覆盖（系统设置里可改）：
 * dataType / imageType 为 null 表示跟随管理员的全站设置；非 null 时用自己的类型与自定义地址。
 * 按登录账号分仓保存在本机（见 scopedStorage），同一浏览器换账号互不影响。
 */
interface DoubanProxyOverrideState {
  dataType: string | null
  dataUrl: string
  imageType: string | null
  imageUrl: string
  setOverride: (patch: Partial<Pick<DoubanProxyOverrideState, 'dataType' | 'dataUrl' | 'imageType' | 'imageUrl'>>) => void
  resetOverride: () => void
}

export const useDoubanProxyOverrideStore = create<DoubanProxyOverrideState>()(
  persist(
    (set) => ({
      dataType: null,
      dataUrl: '',
      imageType: null,
      imageUrl: '',
      setOverride: (patch) => set(patch),
      resetOverride: () => set({ dataType: null, dataUrl: '', imageType: null, imageUrl: '' }),
    }),
    {
      name: 'tgys-tv-douban-proxy-override',
      storage: createScopedStorage(),
      partialize: (state) => ({
        dataType: state.dataType,
        dataUrl: state.dataUrl,
        imageType: state.imageType,
        imageUrl: state.imageUrl,
      }),
    },
  ),
)

// 登录身份变化时换仓：每个账号用自己的覆盖设置
onAuthScopeChange(() => {
  void useDoubanProxyOverrideStore.persist.rehydrate()
})
