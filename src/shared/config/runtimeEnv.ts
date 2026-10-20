export const PUBLIC_ENV_KEYS = [
  'TGYS_INITIAL_VIDEO_SOURCES',
  'TGYS_TMDB_API_TOKEN',
  'TGYS_TMDB_API_BASE_URL',
  'TGYS_TMDB_IMAGE_BASE_URL',
  'TGYS_ACCESS_PASSWORD',
  'TGYS_DISABLE_ANALYTICS',
  'TGYS_INITIAL_CONFIG',
] as const

export type PublicEnvKey = (typeof PUBLIC_ENV_KEYS)[number]
export type RuntimeConfig = Partial<Record<PublicEnvKey, string>>

type RuntimeConfigGlobal = typeof globalThis & {
  __TGYS_RUNTIME_CONFIG__?: RuntimeConfig
  /** 旧版运行时配置全局变量（改名前的 Docker 镜像写入） */
  __OKI_RUNTIME_CONFIG__?: RuntimeConfig
}

/** 旧变量名（OKI_ 前缀）与新变量名（TGYS_ 前缀）的对应，用于向后兼容 */
function legacyKeyOf(key: PublicEnvKey): string {
  return key.replace(/^TGYS_/, 'OKI_')
}

function getBuildTimeEnv(key: PublicEnvKey): string | undefined {
  const buildTimeConfig: RuntimeConfig = {
    TGYS_INITIAL_VIDEO_SOURCES: import.meta.env.TGYS_INITIAL_VIDEO_SOURCES,
    TGYS_TMDB_API_TOKEN: import.meta.env.TGYS_TMDB_API_TOKEN,
    TGYS_TMDB_API_BASE_URL: import.meta.env.TGYS_TMDB_API_BASE_URL,
    TGYS_TMDB_IMAGE_BASE_URL: import.meta.env.TGYS_TMDB_IMAGE_BASE_URL,
    TGYS_ACCESS_PASSWORD: import.meta.env.TGYS_ACCESS_PASSWORD,
    TGYS_DISABLE_ANALYTICS: import.meta.env.TGYS_DISABLE_ANALYTICS,
    TGYS_INITIAL_CONFIG: import.meta.env.TGYS_INITIAL_CONFIG,
  }
  const value = buildTimeConfig[key]
  if (value !== undefined) return value
  // 兼容改名前的构建：旧 OKI_ 前缀变量仍可读
  const legacyConfig: Record<string, string | undefined> = {
    TGYS_INITIAL_VIDEO_SOURCES: import.meta.env.OKI_INITIAL_VIDEO_SOURCES,
    TGYS_TMDB_API_TOKEN: import.meta.env.OKI_TMDB_API_TOKEN,
    TGYS_TMDB_API_BASE_URL: import.meta.env.OKI_TMDB_API_BASE_URL,
    TGYS_TMDB_IMAGE_BASE_URL: import.meta.env.OKI_TMDB_IMAGE_BASE_URL,
    TGYS_ACCESS_PASSWORD: import.meta.env.OKI_ACCESS_PASSWORD,
    TGYS_DISABLE_ANALYTICS: import.meta.env.OKI_DISABLE_ANALYTICS,
    TGYS_INITIAL_CONFIG: import.meta.env.OKI_INITIAL_CONFIG,
  }
  return legacyConfig[key]
}

export function getRuntimeConfig(): RuntimeConfig {
  const global = globalThis as RuntimeConfigGlobal
  return global.__TGYS_RUNTIME_CONFIG__ ?? global.__OKI_RUNTIME_CONFIG__ ?? {}
}

/** Docker 运行时配置优先，其他部署回退到 Vite 构建时环境变量。 */
export function getPublicEnv(key: PublicEnvKey): string | undefined {
  const runtimeConfig = getRuntimeConfig()
  if (Object.prototype.hasOwnProperty.call(runtimeConfig, key)) {
    const runtimeValue = runtimeConfig[key]
    return typeof runtimeValue === 'string' ? runtimeValue : undefined
  }
  // 兼容改名前的运行时配置：键名仍是 OKI_ 前缀时按旧键读取
  const legacyKey = legacyKeyOf(key)
  if (
    legacyKey !== key &&
    Object.prototype.hasOwnProperty.call(runtimeConfig, legacyKey)
  ) {
    const runtimeValue = (runtimeConfig as Record<string, string | undefined>)[legacyKey]
    return typeof runtimeValue === 'string' ? runtimeValue : undefined
  }
  return getBuildTimeEnv(key)
}

function hashConfigValue(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

/** 标识会初始化本地视频源和订阅的配置；环境变量变化后触发一次重新初始化。 */
export function getInitialContentConfigId(schemaVersion = '2'): string {
  const initialConfig = getPublicEnv('TGYS_INITIAL_CONFIG')?.trim() ?? ''
  const initialSources = getPublicEnv('TGYS_INITIAL_VIDEO_SOURCES')?.trim() ?? ''
  return `${schemaVersion}:${hashConfigValue(`${initialConfig}\u0000${initialSources}`)}`
}
