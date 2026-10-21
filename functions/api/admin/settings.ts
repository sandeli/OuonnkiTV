import {
  getSetting,
  isRegistrationOpen,
  json,
  readJson,
  requireAdmin,
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
    return json({
      registrationOpen: await isRegistrationOpen(db, context.env),
      announcement: await readAnnouncement(db),
      announcementBar: (await getSetting(db, 'announcement_bar_content')) ?? '',
    })
  }

  if (context.request.method === 'POST') {
    const body = await readJson<{
      registrationOpen?: unknown
      announcementEnabled?: unknown
      announcementContent?: unknown
      announcementBarContent?: unknown
    }>(context.request)

    if (typeof body?.registrationOpen === 'boolean') {
      await setSetting(db, 'registration_open', body.registrationOpen ? '1' : '0')
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

    return json({
      ok: true,
      registrationOpen: await isRegistrationOpen(db, context.env),
      announcement: await readAnnouncement(db),
      announcementBar: (await getSetting(db, 'announcement_bar_content')) ?? '',
    })
  }

  return json({ error: 'Method Not Allowed' }, 405)
}
