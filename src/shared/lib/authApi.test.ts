import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAuthConfig } from './authApi'

describe('fetchAuthConfig', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
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
