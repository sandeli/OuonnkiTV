import {
  clampNumber,
  clampText,
  json,
  nowSeconds,
  readJson,
  requireUser,
  type PagesContext,
} from '../../_lib/auth'

interface WatchBody {
  title?: unknown
  sourceCode?: unknown
  sourceName?: unknown
  vodId?: unknown
  episodeIndex?: unknown
  episodeName?: unknown
  progress?: unknown
  duration?: unknown
}

/** 观看记录上报：同一用户+来源+影片+集数只保留一行，反复上报只更新进度与时间 */
export const onRequest = async (context: PagesContext) => {
  if (context.request.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)
  const result = await requireUser(context)
  if (result instanceof Response) return result
  const { db, user } = result

  // 站长本人不产生观看记录
  if (user.isMaster) return json({ ok: true, skipped: true })

  const body = await readJson<WatchBody>(context.request)
  const title = clampText(body?.title, 200)
  if (!title) return json({ error: '缺少片名' }, 400)

  const sourceCode = clampText(body?.sourceCode, 100)
  const sourceName = clampText(body?.sourceName, 100)
  const vodId = clampText(body?.vodId, 100)
  const episodeIndex = Math.floor(clampNumber(body?.episodeIndex, 0, 100000))
  const episodeName = clampText(body?.episodeName, 200)
  const progress = clampNumber(body?.progress, 0, 60 * 60 * 24)
  const duration = clampNumber(body?.duration, 0, 60 * 60 * 24)
  const now = nowSeconds()

  await db
    .prepare(
      `INSERT INTO watch_records
         (user_id, title, source_code, source_name, vod_id, episode_index, episode_name, progress, duration, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, source_code, vod_id, episode_index) DO UPDATE SET
         title = excluded.title,
         source_name = excluded.source_name,
         episode_name = excluded.episode_name,
         progress = excluded.progress,
         duration = excluded.duration,
         updated_at = excluded.updated_at`,
    )
    .bind(
      user.userId,
      title,
      sourceCode,
      sourceName,
      vodId,
      episodeIndex,
      episodeName,
      progress,
      duration,
      now,
      now,
    )
    .run()

  return json({ ok: true })
}
