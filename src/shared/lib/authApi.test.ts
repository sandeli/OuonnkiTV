import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAuthConfig } from './authApi'

describe('fetchAuthConfig', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('透传注册模式 registrationMode（邀请模式不能被漏掉）', async () => {
    const stub = (payload: Record<string, unknown>) =>
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, json: async () => payload }),
      )
    stub({ authEnabled: true, registrationOpen: true, registrationMode: 'invite' })
    expect((await fetchAuthConfig()).registrationMode).toBe('invite')
    // 旧后端无 registrationMode 字段时按 registrationOpen 推导
    stub({ authEnabled: true, registrationOpen: true })
    expect((await fetchAuthConfig()).registrationMode).toBe('open')
    stub({ authEnabled: true, registrationOpen: false })
    expect((await fetchAuthConfig()).registrationMode).toBe('closed')
    // 非法值同样回退推导
    stub({ authEnabled: true, registrationOpen: false, registrationMode: 'bogus' })
    expect((await fetchAuthConfig()).registrationMode).toBe('closed')
  })

  it('透传管理员视频源字段 initialVideoSources', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          authEnabled: true,
          registrationOpen: true,
          turnstileSiteKey: '',
          announcement: null,
          announcementBar: '',
          doubanProxy: { dataType: 'direct', dataUrl: '', imageType: 'server', imageUrl: '' },
          initialVideoSources: 'https://example.com/sources.json',
        }),
      }),
    )
    const config = await fetchAuthConfig()
    expect(config.initialVideoSources).toBe('https://example.com/sources.json')
  })

  it('透传管理员托管源开关表 managedSourceEnabled（只保留布尔条目）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          authEnabled: true,
          managedSourceEnabled: { a: false, b: true, bad: 'yes' },
        }),
      }),
    )
    const config = await fetchAuthConfig()
    expect(config.managedSourceEnabled).toEqual({ a: false, b: true })
  })

  it('透传站点系统行为 siteBehavior（过滤非法枚举与非布尔值）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          authEnabled: true,
          siteBehavior: {
            tmdbApiToken: 'site-token-123',
            tmdbEnabled: true,
            danmakuApiUrl: 'https://danmaku.example.com',
            tmdbLanguage: 'zh-CN',
            tmdbImageQuality: 'ultra',
            updateLogEnabled: 'yes',
            scrollChromeAnimationEnabled: false,
          },
        }),
      }),
    )
    const config = await fetchAuthConfig()
    expect(config.siteBehavior).toEqual({
      tmdbApiToken: 'site-token-123',
      tmdbEnabled: true,
      danmakuApiUrl: 'https://danmaku.example.com',
      tmdbLanguage: 'zh-CN',
      scrollChromeAnimationEnabled: false,
    })
  })

  it('缺失 initialVideoSources 时默认为空串（回退环境变量）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ authEnabled: false }),
      }),
    )
    const config = await fetchAuthConfig()
    expect(config.initialVideoSources).toBe('')
  })
})
