import {
  DEFAULT_DOUBAN_PROXY,
  ensureSchema,
  getRegistrationMode,
  getRegistrationOpenAt,
  getSetting,
  isRegistrationFull,
  json,
  readManagedSourceEnabled,
  readDoubanProxySettings,
  readSiteBehavior,
  type PagesContext,
} from '../../_lib/auth'

/** 账号系统公开配置：前端据此决定走服务器账号还是旧单密码模式，并读取首页弹窗公告 */
export const onRequest = async (context: PagesContext) => {
  const db = context.env.TGYS_DB
  if (!db) {
    return json({
      authEnabled: false,
      registrationOpen: false,
      registrationMode: 'closed',
      registrationOpenAt: 0,
      registrationFull: false,
      turnstileSiteKey: '',
      announcement: null,
      announcementBar: '',
      doubanProxy: DEFAULT_DOUBAN_PROXY,
      initialVideoSources: '',
      managedSourceEnabled: {} as Record<string, boolean>,
      siteBehavior: {},
    })
  }
  await ensureSchema(db)
  const [enabled, content, version, barContent, doubanProxy, videoSources, managedSourceEnabled, registrationMode, registrationOpenAt, registrationFull] =
    await Promise.all([
    getSetting(db, 'announcement_popup_enabled'),
    getSetting(db, 'announcement_popup_content'),
    getSetting(db, 'announcement_popup_version'),
    getSetting(db, 'announcement_bar_content'),
    readDoubanProxySettings(db),
    getSetting(db, 'initial_video_sources'),
    readManagedSourceEnabled(db),
    getRegistrationMode(db, context.env),
    getRegistrationOpenAt(db),
    isRegistrationFull(db),
  ])
  return json({
    authEnabled: true,
    registrationOpen: registrationMode !== 'closed',
    registrationMode,
    registrationOpenAt,
    registrationFull,
    turnstileSiteKey: context.env.TGYS_TURNSTILE_SITE_KEY ?? '',
    announcement: {
      enabled: enabled === '1',
      content: content ?? '',
      version: Number.parseInt(version ?? '0', 10) || 0,
    },
    announcementBar: barContent ?? '',
    doubanProxy,
    initialVideoSources: videoSources ?? '',
    managedSourceEnabled,
    siteBehavior: await readSiteBehavior(db),
  })
}
