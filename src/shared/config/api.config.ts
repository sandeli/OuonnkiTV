// API 配置
export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

export const API_CONFIG = {
  search: {
    path: '/api.php/provide/vod/?ac=videolist&wd=',
    headers: {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'application/json',
    },
  },
  detail: {
    path: '/api.php/provide/vod/?ac=videolist&ids=',
    headers: {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'application/json',
    },
  },
}

// 代理地址前缀（可在设置页被覆盖）
export const DEFAULT_PROXY_URL = '/proxy?url='
export const PROXY_URL = DEFAULT_PROXY_URL
export const M3U8_PATTERN = /\$https?:\/\/[^"'\s]+?\.m3u8/g

export const normalizeProxyPrefix = (proxyUrl?: string | null): string => {
  const value = typeof proxyUrl === 'string' ? proxyUrl.trim() : ''
  const base = value || DEFAULT_PROXY_URL

  if (base.includes('{url}')) return base
  if (/[?&]url=$/i.test(base)) return base
  if (/[?&]url=[^&]*$/i.test(base)) {
    return base.replace(/([?&]url=)[^&]*$/i, '$1')
  }
  return base.includes('?') ? `${base}&url=` : `${base}?url=`
}

export const buildProxyRequestUrl = (targetUrl: string, proxyUrl?: string | null): string => {
  const normalized = normalizeProxyPrefix(proxyUrl)
  if (normalized.includes('{url}')) {
    return normalized.split('{url}').join(encodeURIComponent(targetUrl))
  }
  return normalized + encodeURIComponent(targetUrl)
}

import type { VideoApi } from '@/shared/types/video'
import { INITIAL_CONFIG, type VideoSourceConfig } from './initialConfig'
import { DEFAULT_SETTINGS } from './settings.config'
import { getPublicEnv } from './runtimeEnv'
import { useAuthStore } from '@/shared/store/authStore'
import type { SiteBehaviorConfig } from '@/shared/lib/authApi'

type VideoSourceInput = VideoSourceConfig[] | string | undefined

export const parseVideoSources = (sources: VideoSourceConfig[]): VideoApi[] => {
  return sources
    .map((source, index) => {
      // 兼容 KVideo 源格式：baseUrl（完整接口地址）等价于 url，enabled 等价于 isEnabled
      const url = source?.url || source?.baseUrl
      if (!source || typeof source !== 'object' || !source.name || !url) {
        console.warn(`跳过无效的视频源配置: ${JSON.stringify(source)}`)
        return null
      }

      return {
        id: source.id || `env_source_${index}`,
        name: source.name,
        url,
        detailUrl: source.detailUrl || url,
        isEnabled: source.isEnabled ?? source.enabled ?? true,
        updatedAt: source.updatedAt ? new Date(source.updatedAt) : new Date(),
        timeout: source.timeout ?? DEFAULT_SETTINGS.network.defaultTimeout,
        retry: source.retry ?? DEFAULT_SETTINGS.network.defaultRetry,
      } as VideoApi
    })
    .filter((source): source is VideoApi => source !== null)
}

export const loadVideoSources = async (input: VideoSourceInput): Promise<VideoApi[]> => {
  if (Array.isArray(input)) return parseVideoSources(input)
  if (!input || typeof input !== 'string') return []

  let sourceText = input.trim()
  if (!sourceText) return []

  let remoteUrl: URL | null = null
  try {
    remoteUrl = new URL(sourceText)
  } catch {
    // 不是 URL，按内联 JSON 继续处理
  }

  if (remoteUrl) {
    try {
      const response = await fetch(buildProxyRequestUrl(remoteUrl.toString()))
      if (!response.ok) {
        console.error(`无法获取视频源，HTTP状态: ${response.status}`)
        return []
      }
      sourceText = await response.text()
    } catch (error) {
      console.error('获取远程视频源失败:', error)
      return []
    }
  }

  try {
    const cleanedSources = sourceText
      .replace(/^\s*['"`]/, '') // 移除开头的引号
      .replace(/['"`]\s*$/, '') // 移除结尾的引号
      .trim()

    const jsonSources: unknown = JSON.parse(cleanedSources)
    const sources = Array.isArray(jsonSources) ? jsonSources : [jsonSources]

    return parseVideoSources(sources as VideoSourceConfig[])
  } catch (error) {
    console.error('解析环境变量中的视频源失败:', error)
    return []
  }
}

// 初始视频源优先级：管理员后台设置 > TGYS_INITIAL_CONFIG > TGYS_INITIAL_VIDEO_SOURCES 环境变量。
// 管理员值经公开配置下发，与环境变量同格式（远程 JSON 地址或内联 JSON）；留空表示回退环境变量。
/** 管理员对托管源的显式开关表（公开配置下发）：表中源全站按此开关使用，未入表按源文件默认开关 */
/** 站点级「系统行为」设置（管理员后台维护、公开配置下发）：字段缺失 = 管理员未设置，调用方回退本地/环境默认 */
export const getSiteBehavior = (): SiteBehaviorConfig => {
  return useAuthStore.getState().authConfig?.siteBehavior ?? {}
}

export const getManagedSourceEnabled = (): Record<string, boolean> => {
  const map = useAuthStore.getState().authConfig?.managedSourceEnabled
  if (!map || typeof map !== 'object' || Array.isArray(map)) return {}
  return Object.fromEntries(
    Object.entries(map).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
  )
}

export const getInitialVideoSources = async (): Promise<VideoApi[]> => {
  try {
    const adminSources = useAuthStore.getState().authConfig?.initialVideoSources
    if (adminSources && adminSources.trim()) {
      return loadVideoSources(adminSources)
    }
  } catch {
    // 忽略：未初始化时按环境变量走
  }
  if (INITIAL_CONFIG && INITIAL_CONFIG.videoSources !== undefined) {
    return loadVideoSources(INITIAL_CONFIG.videoSources)
  }
  return loadVideoSources(getPublicEnv('TGYS_INITIAL_VIDEO_SOURCES'))
}
