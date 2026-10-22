import {
  generateInviteCode,
  json,
  nowSeconds,
  readJson,
  requireAdmin,
  type InviteCodeRow,
  type PagesContext,
} from '../../_lib/auth'

interface CreateInviteBody {
  note?: unknown
  maxUses?: unknown
  expiresDays?: unknown
}

/** 管理员：邀请码列表（GET）与生成（POST） */
export const onRequest = async (context: PagesContext) => {
  if (context.request.method !== 'GET' && context.request.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405)
  }
  const result = await requireAdmin(context)
  if (result instanceof Response) return result
  const { db } = result

  if (context.request.method === 'GET') {
    const { results } = await db
      .prepare(
        `SELECT id, code, note, max_uses AS maxUses, used_count AS usedCount,
                expires_at AS expiresAt, created_at AS createdAt
         FROM invite_codes ORDER BY created_at DESC LIMIT 100`,
      )
      .all<InviteCodeRow>()
    return json({ invites: results })
  }

  const body = await readJson<CreateInviteBody>(context.request)
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 100) : ''
  const maxUsesRaw = typeof body?.maxUses === 'number' ? Math.floor(body.maxUses) : 1
  const maxUses = Math.min(1000, Math.max(1, maxUsesRaw))
  const daysRaw = typeof body?.expiresDays === 'number' ? Math.floor(body.expiresDays) : 7
  const expiresDays = Math.min(3650, Math.max(0, daysRaw))
  const createdAt = nowSeconds()
  const expiresAt = expiresDays > 0 ? createdAt + expiresDays * 86400 : null

  // 邀请码唯一冲突时换一个重试一次
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const code = generateInviteCode()
    try {
      const insert = (await db
        .prepare(
          'INSERT INTO invite_codes (code, note, max_uses, used_count, expires_at, created_at) VALUES (?, ?, ?, 0, ?, ?)',
        )
        .bind(code, note, maxUses, expiresAt, createdAt)
        .run()) as { meta?: { last_row_id?: number } }
      return json({
        ok: true,
        invite: {
          id: insert.meta?.last_row_id ?? 0,
          code,
          note,
          maxUses,
          usedCount: 0,
          expiresAt,
          createdAt,
        },
      })
    } catch {
      if (attempt === 1) return json({ error: '生成邀请码失败，请重试' }, 500)
    }
  }
  return json({ error: '生成邀请码失败，请重试' }, 500)
}
