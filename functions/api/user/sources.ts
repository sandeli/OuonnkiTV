import {
  getUserSources,
  json,
  readJson,
  requireUser,
  saveUserSources,
  type PagesContext,
} from '../../_lib/auth'

/**
 * 账号源（随账户走，不随浏览器）：每个登录用户一份，按 user_id 隔离。
 * - GET：读取当前用户在设置页手动维护的源列表
 * - PUT { sources }：整体保存
 * 只有站长（主账号）的源可以带「全站生效」标记，保存时由服务端派生进全站
 * 分发列表；普通用户传来的全站标记会被剥掉，源只对自己账户生效。
 */
export const onRequest = async (context: PagesContext) => {
  const result = await requireUser(context)
  if (result instanceof Response) return result
  const { db, user } = result

  if (context.request.method === 'GET') {
    return json({ sources: await getUserSources(db, user.userId) })
  }

  if (context.request.method === 'PUT') {
    const body = await readJson<{ sources?: unknown }>(context.request)
    if (!Array.isArray(body?.sources)) {
      return json({ error: '源列表格式不正确' }, 400)
    }
    if (JSON.stringify(body.sources).length > 262_144) {
      return json({ error: '源列表过大' }, 400)
    }
    const saved = await saveUserSources(db, user.userId, body.sources)
    return json({ ok: true, sources: saved })
  }

  return json({ error: 'Method Not Allowed' }, 405)
}
