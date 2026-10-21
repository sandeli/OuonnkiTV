import { ensureSchema, isRegistrationOpen, json, type PagesContext } from '../../_lib/auth'

/** 账号系统公开配置：前端据此决定走服务器账号还是旧单密码模式 */
export const onRequest = async (context: PagesContext) => {
  const db = context.env.TGYS_DB
  if (!db) {
    return json({ authEnabled: false, registrationOpen: false, turnstileSiteKey: '' })
  }
  await ensureSchema(db)
  return json({
    authEnabled: true,
    registrationOpen: await isRegistrationOpen(db, context.env),
    turnstileSiteKey: context.env.TGYS_TURNSTILE_SITE_KEY ?? '',
  })
}
