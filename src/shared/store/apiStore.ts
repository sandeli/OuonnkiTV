import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { VideoSource, SourceStore } from '@tgys/cms-core'
import {
  addSource,
  removeSource,
  setSourceEnabled,
  selectAllSources,
  deselectAllSources,
  getEnabledSources,
  importSources,
} from '@tgys/cms-core/source'
import {
  getInitialVideoSources,
  getManagedSourceEnabled,
} from '@/shared/config/api.config'
import { DEFAULT_SETTINGS } from '@/shared/config/settings.config'
import { v4 as uuidv4 } from 'uuid'
import { useSettingStore } from './settingStore'
import { INITIAL_CONFIG } from '@/shared/config/initialConfig'

// 保持向后兼容的类型别名
export type VideoApi = VideoSource

interface ApiState {
  // 视频源列表
  videoAPIs: VideoSource[]
  // 广告过滤开关
  adFilteringEnabled: boolean
  // 管理员统一提供的源（环境变量/管理员后台设置的初始源）的 id 集合：
  // 这些源对所有用户生效，但普通用户的「视频源管理」列表中不显示，只能看到自己添加的源
  managedSourceIds: string[]
}

interface ApiActions {
  // 设置 API 启用状态
  setApiEnabled: (apiId: string, enabled: boolean) => void
  // 添加视频 API
  addAndUpdateVideoAPI: (api: VideoSource) => void
  // 删除视频 API
  removeVideoAPI: (apiId: string) => void
  // 设置广告过滤
  setAdFilteringEnabled: (enabled: boolean) => void
  // 全选 API
  selectAllAPIs: () => void
  // 取消全选
  deselectAllAPIs: () => void
  // 初始化环境变量中的视频源
  initializeEnvSources: () => Promise<number>
  // 按 id 批量设置启用状态（普通用户在管理页对自己可见的源做全选/全不选）
  setVideoSourcesEnabled: (ids: string[], enabled: boolean) => void
  // 批量导入视频源
  importVideoAPIs: (apis: VideoSource[]) => void
  // 获取选中的视频源
  getSelectedAPIs: () => VideoSource[]
  // 重置视频源
  resetVideoSources: () => Promise<void>
  // 替换指定订阅的所有视频源（保留用户之前的 isEnabled 设置）
  replaceSubscriptionSources: (subscriptionId: string, sources: VideoSource[]) => void
  // 移除指定订阅的所有视频源
  removeSubscriptionSources: (subscriptionId: string) => void
  // 按 ID 数组顺序重排视频源（拖拽排序 / 一键按延迟排序）
  reorderVideoAPIs: (orderedIds: string[]) => void
}

type ApiStore = ApiState & ApiActions

/**
 * 将ApiState转换为SourceStore格式以便使用cms-core纯函数
 */
function toSourceStore(state: ApiState): SourceStore {
  return {
    sources: state.videoAPIs,
    version: 1,
  }
}

/**
 * 从SourceStore提取sources到videoAPIs
 */
function fromSourceStore(store: SourceStore): VideoSource[] {
  return store.sources
}

export const useApiStore = create<ApiStore>()(
  devtools(
    persist(
      immer<ApiStore>((set, get) => ({
        videoAPIs: [],
        adFilteringEnabled: true,
        managedSourceIds: [],

        // Actions - 使用cms-core纯函数
        setApiEnabled: (apiId: string, enabled: boolean) => {
          set(state => {
            const store = toSourceStore(state)
            const newStore = setSourceEnabled(store, apiId, enabled)
            state.videoAPIs = fromSourceStore(newStore)
          })
        },

        addAndUpdateVideoAPI: (api: VideoSource) => {
          set(state => {
            const store = toSourceStore(state)
            const isExisting = store.sources.some(
              s => s.id === api.id || (s.name === api.name && s.url === api.url),
            )
            // addSource会自动处理添加或更新
            const newStore = addSource(store, {
              ...api,
              updatedAt: new Date(),
            })
            const nextSources = fromSourceStore(newStore)

            // 新增源默认置顶；更新源保持原有顺序
            if (!isExisting) {
              const inserted = nextSources.find(source => source.id === api.id)
              state.videoAPIs = inserted
                ? [inserted, ...nextSources.filter(source => source.id !== inserted.id)]
                : nextSources
            } else {
              state.videoAPIs = nextSources
            }
          })
        },

        removeVideoAPI: (apiId: string) => {
          set(state => {
            const store = toSourceStore(state)
            const newStore = removeSource(store, apiId)
            state.videoAPIs = fromSourceStore(newStore)
          })
        },

        setAdFilteringEnabled: (enabled: boolean) => {
          set(state => {
            state.adFilteringEnabled = enabled
          })
        },

        selectAllAPIs: () => {
          set(state => {
            const store = toSourceStore(state)
            const newStore = selectAllSources(store)
            state.videoAPIs = fromSourceStore(newStore)
          })
        },

        deselectAllAPIs: () => {
          set(state => {
            const store = toSourceStore(state)
            const newStore = deselectAllSources(store)
            state.videoAPIs = fromSourceStore(newStore)
          })
        },

        initializeEnvSources: async () => {
          const envSources = await getInitialVideoSources()
          set(state => {
            if (typeof INITIAL_CONFIG?.adFilteringEnabled === 'boolean') {
              state.adFilteringEnabled = INITIAL_CONFIG.adFilteringEnabled
            }
            if (envSources.length > 0) {
              const store = toSourceStore(state)
              const { store: newStore } = importSources(store, envSources, {
                defaultTimeout: useSettingStore.getState().network.defaultTimeout,
                defaultRetry: useSettingStore.getState().network.defaultRetry,
                skipInvalid: true,
              })
              state.videoAPIs = fromSourceStore(newStore)
              // 更新托管标记：此前由管理员提供、但新列表里已没有的源一并移除；
              // 用户自己添加的源（不在旧托管集合里）不受影响。拉取失败返回空时不更新，
              // 避免把托管源误清（见上方 return 的计数约定）。
              const nextManaged = new Set(envSources.map(s => s.id))
              state.videoAPIs = state.videoAPIs.filter(
                s => !state.managedSourceIds.includes(s.id) || nextManaged.has(s.id),
              )
              state.managedSourceIds = [...nextManaged]
            }
          })
          return envSources.length
        },

        setVideoSourcesEnabled: (ids: string[], enabled: boolean) => {
          set(state => {
            const idSet = new Set(ids)
            state.videoAPIs = state.videoAPIs.map(s =>
              idSet.has(s.id) ? { ...s, isEnabled: enabled } : s,
            )
          })
        },

        importVideoAPIs: (apis: VideoSource[]) => {
          set(state => {
            const store = toSourceStore(state)
            // 为没有ID的源生成UUID
            const apisWithIds = apis.map(api => ({
              ...api,
              id: api.id || uuidv4(),
            }))
            const { store: newStore } = importSources(store, apisWithIds, {
              defaultTimeout: useSettingStore.getState().network.defaultTimeout,
              defaultRetry: useSettingStore.getState().network.defaultRetry,
              skipInvalid: true,
            })
            state.videoAPIs = fromSourceStore(newStore)
          })
        },

        getSelectedAPIs: () => {
          const store = toSourceStore(get())
          const enabled = getEnabledSources(store)
          // 管理员显式开关表优先：托管源只要被管理员动过开关，全站（含本人）按表执行，
          // 不受各浏览器本地开关影响；未入表的托管源与自加源仍按本地/文件默认开关
          const overrides = getManagedSourceEnabled()
          if (Object.keys(overrides).length === 0) return enabled
          const managed = new Set(get().managedSourceIds)
          const enabledIds = new Set(enabled.map(s => s.id))
          return get().videoAPIs.filter(s => {
            if (managed.has(s.id) && Object.prototype.hasOwnProperty.call(overrides, s.id)) {
              return overrides[s.id]
            }
            return enabledIds.has(s.id)
          })
        },

        resetVideoSources: async () => {
          set(state => {
            state.videoAPIs = []
            state.adFilteringEnabled = INITIAL_CONFIG?.adFilteringEnabled ?? true
          })
          await get().initializeEnvSources()
        },

        replaceSubscriptionSources: (subscriptionId: string, sources: VideoSource[]) => {
          set(state => {
            const prefix = `sub:${subscriptionId}:`
            // 记录旧源的 isEnabled 状态（按 name+url 匹配，因为 index 可能变化）
            const oldEnabledMap = new Map<string, boolean>()
            state.videoAPIs
              .filter(s => s.id.startsWith(prefix))
              .forEach(s => {
                oldEnabledMap.set(`${s.name}||${s.url}`, s.isEnabled)
              })

            // 移除旧的订阅源
            const nonSubscriptionSources = state.videoAPIs.filter(s => !s.id.startsWith(prefix))

            // 对新源应用之前的 isEnabled 设置
            const newSources = sources.map(s => {
              const key = `${s.name}||${s.url}`
              const prevEnabled = oldEnabledMap.get(key)
              return {
                ...s,
                isEnabled: prevEnabled !== undefined ? prevEnabled : s.isEnabled,
              }
            })

            // 手动源在前，订阅源追加到末尾
            state.videoAPIs = [...nonSubscriptionSources, ...newSources]
          })
        },

        removeSubscriptionSources: (subscriptionId: string) => {
          set(state => {
            const prefix = `sub:${subscriptionId}:`
            state.videoAPIs = state.videoAPIs.filter(s => !s.id.startsWith(prefix))
          })
        },

        reorderVideoAPIs: (orderedIds: string[]) => {
          set(state => {
            const idIndexMap = new Map(orderedIds.map((id, index) => [id, index]))
            state.videoAPIs = [...state.videoAPIs].sort((a, b) => {
              const indexA = idIndexMap.get(a.id)
              const indexB = idIndexMap.get(b.id)
              if (indexA !== undefined && indexB !== undefined) return indexA - indexB
              if (indexA !== undefined) return -1
              if (indexB !== undefined) return 1
              return 0
            })
          })
        },
      })),
      {
        name: 'tgys-tv-api-store',
        version: 6,
        migrate: (persistedState: unknown, version: number) => {
          const state = persistedState as Partial<ApiState>

          if (version < 4) {
            state.videoAPIs = []
          }

          if (!Array.isArray(state.managedSourceIds)) {
            state.managedSourceIds = []
          }

          if (version < 5) {
            state.videoAPIs =
              state.videoAPIs?.map(api => ({
                ...api,
                timeout: DEFAULT_SETTINGS.network.defaultTimeout,
                retry: DEFAULT_SETTINGS.network.defaultRetry,
                updatedAt: new Date(),
              })) || []
          }

          return state
        },
      },
    ),
    {
      name: 'ApiStore', // DevTools 中显示的名称
    },
  ),
)
