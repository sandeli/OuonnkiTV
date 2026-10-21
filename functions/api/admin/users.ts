import { json, requireAdmin, type PagesContext } from '../../_lib/auth'

/** 管理员：用户列表（含登录次数、观看部数、最近动态） */
export const onRequest = async (context: PagesContext) => {
  if (context.request.method !== 'GET') return json({ error: 'Method Not Allowed' }, 405)
  const result = await requireAdmin(context)
  if (result instanceof Response) return result
  const { db } = result

  const { results } = await db
    .prepare(
      `SELECT u.id AS id, u.username AS username, u.role AS role, u.disabled AS disabled,
              u.created_at AS createdAt, u.last_login_at AS lastLoginAt,
              (SELECT COUNT(*) FROM login_logs l WHERE l.user_id = u.id) AS loginCount,
              (SELECT COUNT(*) FROM watch_records w WHERE w.user_id = u.id) AS watchCount,
              (SELECT MAX(w.updated_at) FROM watch_records w WHERE w.user_id = u.id) AS lastWatchAt,
              (SELECT w2.title FROM watch_records w2 WHERE w2.user_id = u.id ORDER BY w2.updated_at DESC LIMIT 1) AS lastWatchTitle
       FROM users u
       ORDER BY u.created_at DESC
       LIMIT 500`,
    )
    .all()
  return json({ users: results })
}
