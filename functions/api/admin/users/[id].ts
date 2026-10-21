import { json, requireAdmin, type PagesContext } from '../../../_lib/auth'

function parseUserId(context: PagesContext): number {
  const raw = context.params.id
  const id = Number(Array.isArray(raw) ? raw[0] : raw)
  return Number.isInteger(id) && id > 0 ? id : 0
}

/** 管理员：用户详情（登录历史 + 观看明细）；DELETE 删除账号及其全部数据 */
export const onRequest = async (context: PagesContext) => {
  const result = await requireAdmin(context)
  if (result instanceof Response) return result
  const { db } = result
  const userId = parseUserId(context)
  if (!userId) return json({ error: '用户不存在' }, 404)

  if (context.request.method === 'GET') {
    const user = await db
      .prepare(
        'SELECT id, username, role, disabled, created_at AS createdAt, last_login_at AS lastLoginAt FROM users WHERE id = ?',
      )
      .bind(userId)
      .first()
    if (!user) return json({ error: '用户不存在' }, 404)

    const loginLogs = await db
      .prepare(
        'SELECT id, ip, user_agent AS userAgent, created_at AS createdAt FROM login_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      )
      .bind(userId)
      .all()
    const watchRecords = await db
      .prepare(
        `SELECT id, title, source_code AS sourceCode, source_name AS sourceName, vod_id AS vodId,
                episode_index AS episodeIndex, episode_name AS episodeName, progress, duration,
                created_at AS createdAt, updated_at AS updatedAt
         FROM watch_records WHERE user_id = ? ORDER BY updated_at DESC LIMIT 100`,
      )
      .bind(userId)
      .all()
    return json({ user, loginLogs: loginLogs.results, watchRecords: watchRecords.results })
  }

  if (context.request.method === 'DELETE') {
    await db.batch([
      db.prepare('DELETE FROM users WHERE id = ?').bind(userId),
      db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId),
      db.prepare('DELETE FROM login_logs WHERE user_id = ?').bind(userId),
      db.prepare('DELETE FROM watch_records WHERE user_id = ?').bind(userId),
    ])
    return json({ ok: true })
  }

  return json({ error: 'Method Not Allowed' }, 405)
}
