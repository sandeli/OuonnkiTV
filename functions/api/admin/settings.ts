import {
  DOUBAN_DATA_PROXY_TYPES,
  DOUBAN_IMAGE_PROXY_TYPES,
  countRegisteredUsers,
  getRegistrationCloseAt,
  getRegistrationMaxUsers,
  getRegistrationMode,
  getRegistrationOpenAt,
  getSetting,
  isRegistrationOpen,
  json,
  readManagedSourceEnabled,
  readDoubanProxySettings,
  readSiteBehavior,
  TMDB_IMAGE_QUALITIES,
  TMDB_LANGUAGES,
  readJson,
  readTgNotifyConfig,
  requireAdmin,
  sanitizeManagedSourceEnabled,
  setSetting,
  type D1Database,
  type PagesContext,
} from '../../_lib/auth'

async function readAnnouncement(db: D1Database) {
  const [enabled, content, version] = await Promise.all([
    getSetting(db, 'announcement_popup_enabled'),
    getSetting(db, 'announcement_popup_content'),
    getSetting(db, 'announcement_popup_version'),
  ])
  return {
    enabled: enabled === '1',
    content: content ?? '',
    version: Number.parseInt(version ?? '0', 10) || 0,
  }
}

/** 管理员：站点设置（注册开关 + 首页弹窗公告） */
export const onRequest = async (context: PagesContext) => {
  const result = await requireAdmin(context)
  if (result instanceof Response) return result
  const { db } = result

  if (context.request.method === 'GET') {
    const tgNotify = await readTgNotifyConfig(db)
    return json({
      registrationOpen: await isRegistrationOpen(db, context.env),
      registrationMode: await getRegistrationMode(db, context.env),
      registrationOpenAt: await getRegistrationOpenAt(db),
      registrationCloseAt: await getRegistrationCloseAt(db),
      registrationMaxUsers: await getRegistrationMaxUsers(db),
      registeredUserCount: await countRegisteredUsers(db),
      tgBotToken: tgNotify.botToken,
      tgChatId: tgNotify.chatId,
      announcement: await readAnnouncement(db),
      announcementBar: (await getSetting(db, 'announcement_bar_content')) ?? '',
      doubanProxy: await readDoubanProxySettings(db),
      videoSources: (await getSetting(db, 'initial_video_sources')) ?? '',
      managedSourceEnabled: await readManagedSourceEnabled(db),
      siteBehavior: await readSiteBehavior(db),
    })
  }

  if (context.request.method === 'POST') {
    const body = await readJson<{
      registrationOpen?: unknown
      registrationMode?: unknown
      registrationOpenAt?: unknown
      registrationCloseAt?: unknown
      registrationMaxUsers?: unknown
      tgBotToken?: unknown
      tgChatId?: unknown
      announcementEnabled?: unknown
      announcementContent?: unknown
      announcementBarContent?: unknown
      doubanDataProxyType?: unknown
      doubanDataProxyUrl?: unknown
      doubanImageProxyType?: unknown
      doubanImageProxyUrl?: unknown
      videoSources?: unknown
      managedSourceEnabled?: unknown
      siteUpdateLogEnabled?: unknown
      siteScrollChromeAnimationEnabled?: unknown
      tmdbApiToken?: unknown
      tmdbEnabled?: unknown
      tmdbApiBaseUrl?: unknown
      tmdbImageBaseUrl?: unknown
      tmdbLanguage?: unknown
      tmdbImageQuality?: unknown
      danmakuApiUrl?: unknown
      siteClosed?: unknown
      siteClosedMessage?: unknown
    }>(context.request)

    if (typeof body?.registrationOpen === 'boolean') {
      await setSetting(db, 'registration_open', body.registrationOpen ? '1' : '0')
    }

    if (
      body?.registrationMode === 'open' ||
      body?.registrationMode === 'invite' ||
      body?.registrationMode === 'closed'
    ) {
      await setSetting(db, 'registration_mode', body.registrationMode)
      // 同步旧开关，保持其他读取 registration_open 的地方语义一致
      await setSetting(db, 'registration_open', body.registrationMode === 'open' ? '1' : '0')
    }

    // 注册定时开放时刻（unix 秒）：0 = 清除定时；只接受合理范围内的整数
    if (typeof body?.registrationOpenAt === 'number' && Number.isFinite(body.registrationOpenAt)) {
      const openAt = Math.floor(body.registrationOpenAt)
      if (openAt >= 0 && openAt <= 4102444800) {
        await setSetting(db, 'registration_open_at', String(openAt))
      }
    }

    // 注册开放时段结束时刻（unix 秒）：0 = 不设结束；只接受合理范围内的整数
    if (
      typeof body?.registrationCloseAt === 'number' &&
      Number.isFinite(body.registrationCloseAt)
    ) {
      const closeAt = Math.floor(body.registrationCloseAt)
      if (closeAt >= 0 && closeAt <= 4102444800) {
        await setSetting(db, 'registration_close_at', String(closeAt))
      }
    }

    // 注册人数上限：0 = 不限；只接受合理范围内的整数
    if (
      typeof body?.registrationMaxUsers === 'number' &&
      Number.isFinite(body.registrationMaxUsers)
    ) {
      const maxUsers = Math.floor(body.registrationMaxUsers)
      if (maxUsers >= 0 && maxUsers <= 100000) {
        await setSetting(db, 'registration_max_users', String(maxUsers))
      }
    }

    if (typeof body?.tgBotToken === 'string') {
      await setSetting(db, 'tg_notify_bot_token', body.tgBotToken.trim().slice(0, 128))
    }
    if (typeof body?.tgChatId === 'string') {
      await setSetting(db, 'tg_notify_chat_id', body.tgChatId.trim().slice(0, 64))
    }

    if (typeof body?.announcementEnabled === 'boolean') {
      await setSetting(db, 'announcement_popup_enabled', body.announcementEnabled ? '1' : '0')
    }

    if (typeof body?.announcementContent === 'string') {
      const content = body.announcementContent.slice(0, 2000)
      const current = await readAnnouncement(db)
      if (content !== current.content) {
        // 内容变化则版本号 +1：所有用户会重新看到一次新公告
        await setSetting(db, 'announcement_popup_content', content)
        await setSetting(db, 'announcement_popup_version', String(current.version + 1))
      }
    }

    if (typeof body?.announcementBarContent === 'string') {
      await setSetting(db, 'announcement_bar_content', body.announcementBarContent.slice(0, 500))
    }

    if (
      typeof body?.doubanDataProxyType === 'string' &&
      (DOUBAN_DATA_PROXY_TYPES as readonly string[]).includes(body.doubanDataProxyType)
    ) {
      await setSetting(db, 'douban_data_proxy_type', body.doubanDataProxyType)
    }
    if (typeof body?.doubanDataProxyUrl === 'string') {
      await setSetting(db, 'douban_data_proxy_url', body.doubanDataProxyUrl.trim().slice(0, 500))
    }
    if (
      typeof body?.doubanImageProxyType === 'string' &&
      (DOUBAN_IMAGE_PROXY_TYPES as readonly string[]).includes(body.doubanImageProxyType)
    ) {
      await setSetting(db, 'douban_image_proxy_type', body.doubanImageProxyType)
    }
    if (typeof body?.doubanImageProxyUrl === 'string') {
      await setSetting(db, 'douban_image_proxy_url', body.doubanImageProxyUrl.trim().slice(0, 500))
    }
    if (typeof body?.siteUpdateLogEnabled === 'boolean') {
      await setSetting(db, 'site_update_log_enabled', body.siteUpdateLogEnabled ? '1' : '0')
    }
    if (typeof body?.siteScrollChromeAnimationEnabled === 'boolean') {
      await setSetting(db, 'site_scroll_chrome_animation', body.siteScrollChromeAnimationEnabled ? '1' : '0')
    }
    if (typeof body?.tmdbApiToken === 'string') {
      await setSetting(db, 'tmdb_api_token', body.tmdbApiToken.trim().slice(0, 600))
    }
    if (typeof body?.tmdbEnabled === 'boolean') {
      await setSetting(db, 'tmdb_enabled', body.tmdbEnabled ? '1' : '0')
    }
    if (typeof body?.tmdbApiBaseUrl === 'string') {
      await setSetting(db, 'tmdb_api_base_url', body.tmdbApiBaseUrl.trim().slice(0, 500))
    }
    if (typeof body?.tmdbImageBaseUrl === 'string') {
      await setSetting(db, 'tmdb_image_base_url', body.tmdbImageBaseUrl.trim().slice(0, 500))
    }
    if (
      typeof body?.tmdbLanguage === 'string' &&
      (TMDB_LANGUAGES as readonly string[]).includes(body.tmdbLanguage)
    ) {
      await setSetting(db, 'tmdb_language', body.tmdbLanguage)
    }
    if (
      typeof body?.tmdbImageQuality === 'string' &&
      (TMDB_IMAGE_QUALITIES as readonly string[]).includes(body.tmdbImageQuality)
    ) {
      await setSetting(db, 'tmdb_image_quality', body.tmdbImageQuality)
    }
    if (typeof body?.siteClosed === 'boolean') {
      await setSetting(db, 'site_closed', body.siteClosed ? '1' : '0')
    }
    if (typeof body?.siteClosedMessage === 'string') {
      await setSetting(db, 'site_closed_message', body.siteClosedMessage.trim().slice(0, 500))
    }
    if (typeof body?.danmakuApiUrl === 'string') {
      // 站点默认弹幕接口：优先级低于用户个人设置、高于部署变量 TGYS_DANMAKU_API_URL；留空表示不设置
      await setSetting(db, 'site_danmaku_api_url', body.danmakuApiUrl.trim().slice(0, 500))
    }

    if (typeof body?.videoSources === 'string') {
      // 管理员视频源：与 TGYS_INITIAL_VIDEO_SOURCES 同格式（远程 JSON 地址或内联 JSON），
      // 非空时客户端优先用它，留空表示回退环境变量
      await setSetting(db, 'initial_video_sources', body.videoSources.trim().slice(0, 512000))
    }

    if (body?.managedSourceEnabled !== undefined) {
      const sanitized = sanitizeManagedSourceEnabled(body.managedSourceEnabled)
      if (sanitized) {
        await setSetting(db, 'managed_source_enabled', JSON.stringify(sanitized))
      }
    }

    const tgNotifyAfter = await readTgNotifyConfig(db)
    return json({
      ok: true,
      registrationOpen: await isRegistrationOpen(db, context.env),
      registrationMode: await getRegistrationMode(db, context.env),
      registrationOpenAt: await getRegistrationOpenAt(db),
      registrationCloseAt: await getRegistrationCloseAt(db),
      registrationMaxUsers: await getRegistrationMaxUsers(db),
      registeredUserCount: await countRegisteredUsers(db),
      tgBotToken: tgNotifyAfter.botToken,
      tgChatId: tgNotifyAfter.chatId,
      announcement: await readAnnouncement(db),
      announcementBar: (await getSetting(db, 'announcement_bar_content')) ?? '',
      doubanProxy: await readDoubanProxySettings(db),
      videoSources: (await getSetting(db, 'initial_video_sources')) ?? '',
      managedSourceEnabled: await readManagedSourceEnabled(db),
      siteBehavior: await readSiteBehavior(db),
    })
  }

  return json({ error: 'Method Not Allowed' }, 405)
}
