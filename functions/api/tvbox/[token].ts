import { ensureSchema, json, type PagesContext } from '../../_lib/auth'
import { assertTvboxAccess, findTvboxUserId, readTvboxSources } from '../../_lib/tvbox'

/**
 * TVBox 配置接口：GET /api/tvbox/<token>
 * 用户把这个地址填进影视 / OK影视等 APP 的订阅地址。
 * 第一个站是本站聚合站（自动最快），其后是各托管源的直连站。
 */
export const onRequest = async (context: PagesContext) => {
  if (context.request.method !== 'GET') return json({ error: 'Method Not Allowed' }, 405)
  const db = context.env.TGYS_DB
  if (!db) return json({ error: '账号系统未配置' }, 503)
  await ensureSchema(db)

  const token = String(context.params.token ?? '')
  const userId = await findTvboxUserId(db, token)
  if (userId === null || !(await assertTvboxAccess(db, userId))) {
    return json({ error: '接口已失效，请到网站「设置中心 → TVBox 接口」重新获取' }, 403)
  }

  const sources = await readTvboxSources(db, context.env)
  const origin = new URL(context.request.url).origin
  const sites = [
    {
      key: 'tgys_agg',
      name: 'TGYS聚合·自动最快',
      type: 1,
      api: `${origin}/api/tvbox/${token}/vod`,
      searchable: 1,
      quickSearch: 1,
    },
    ...sources.map(s => ({
      key: `tgys_${s.id}`,
      name: s.name,
      type: 1,
      api: s.api,
      searchable: 1,
      quickSearch: 1,
    })),
  ]
  return json({ sites })
}
