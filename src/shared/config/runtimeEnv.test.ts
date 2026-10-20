import { afterEach, describe, expect, it } from 'vitest'
import { getInitialContentConfigId, getPublicEnv, type RuntimeConfig } from './runtimeEnv'

type RuntimeConfigGlobal = typeof globalThis & {
  __TGYS_RUNTIME_CONFIG__?: RuntimeConfig
}

const runtimeGlobal = globalThis as RuntimeConfigGlobal
const originalRuntimeConfig = runtimeGlobal.__TGYS_RUNTIME_CONFIG__
const originalBuildTimePassword = import.meta.env.TGYS_ACCESS_PASSWORD

describe('getPublicEnv', () => {
  afterEach(() => {
    runtimeGlobal.__TGYS_RUNTIME_CONFIG__ = originalRuntimeConfig
    import.meta.env.TGYS_ACCESS_PASSWORD = originalBuildTimePassword
  })

  it('Docker 运行时配置优先于构建时配置', () => {
    runtimeGlobal.__TGYS_RUNTIME_CONFIG__ = {
      TGYS_ACCESS_PASSWORD: 'runtime-password',
    }

    expect(getPublicEnv('TGYS_ACCESS_PASSWORD')).toBe('runtime-password')
  })

  it('显式空值可以清除构建时配置', () => {
    runtimeGlobal.__TGYS_RUNTIME_CONFIG__ = {
      TGYS_TMDB_API_TOKEN: '',
    }

    expect(getPublicEnv('TGYS_TMDB_API_TOKEN')).toBe('')
  })

  it('没有 Docker 运行时值时回退到 Vite 构建时配置', () => {
    runtimeGlobal.__TGYS_RUNTIME_CONFIG__ = {}
    import.meta.env.TGYS_ACCESS_PASSWORD = 'build-time-password'

    expect(getPublicEnv('TGYS_ACCESS_PASSWORD')).toBe('build-time-password')
  })

  it('初始内容环境变量变化时生成不同配置标识', () => {
    runtimeGlobal.__TGYS_RUNTIME_CONFIG__ = {
      TGYS_INITIAL_VIDEO_SOURCES: '[{"name":"源一"}]',
    }
    const firstId = getInitialContentConfigId()

    runtimeGlobal.__TGYS_RUNTIME_CONFIG__ = {
      TGYS_INITIAL_VIDEO_SOURCES: '[{"name":"源二"}]',
    }

    expect(getInitialContentConfigId()).not.toBe(firstId)
  })
})
