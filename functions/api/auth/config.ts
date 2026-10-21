import {
  ensureSchema,
  getSetting,
  isRegistrationOpen,
  json,
  type PagesContext,
} from '../../_lib/auth'

/** 账号系统公开配置：前端据此决定走服务器账号还是旧单密码模式，并读取首页弹窗公告 */
export const onRequest = async (context: PagesContext) => {
  const db = context.env.TGYS_DB
  if (!db) {
    return json({
      authEnabled: false,
      registrationOpen: false,
      turnstileSiteKey: '',
      announcement: null,
      announcementBar: '',
    })
  }
  await ensureSchema(db)
  const [enabled, content, version, barContent] = await Promise.all([
    getSetting(db, 'announcement_popup_enabled'),
    getSetting(db, 'announcement_popup_content'),
    getSetting(db, 'announcement_popup_version'),
    getSetting(db, 'announcement_bar_content'),
  ])
  return json({
    authEnabled: true,
    registrationOpen: await isRegistrationOpen(db, context.env),
    turnstileSiteKey: context.env.TGYS_TURNSTILE_SITE_KEY ?? '',
    announcement: {
      enabled: enabled === '1',
      content: content ?? '',
      version: Number.parseInt(version ?? '0', 10) || 0,
    },
    announcementBar: barContent ?? '',
  })
}
