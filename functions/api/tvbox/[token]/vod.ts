import { ensureSchema, json, type PagesContext } from '../../../_lib/auth'
import {
  aggClasses,
  aggDetail,
  aggList,
  aggSearch,
  assertTvboxAccess,
  decodeAggId,
  findTvboxUserId,
  readTvboxSources,
} from '../../../_lib/tvbox'

/**
 * TVBox 聚合站协议端点：GET /api/tvbox/<token>/vod
 * 不看 ac 的具体值，按参数分发（各 APP 方言不一，参数才是事实）：
 * - 带 ids → 详情（多线路按匹配与速度排序）
 * - 带 wd → 跨源聚合搜索
 * - 其余 → 首页/分类列表（t 为分类名）
 */
export const onRequest = async (context: PagesContext) => {
  if (context.request.method !== 'GET') return json({ error: 'Method Not Allowed' }, 405)
  const db = context.env.TGYS_DB
  if (!db) return json({ code: 0, msg: '账号系统未配置', list: [] }, 503)
  await ensureSchema(db)

  const token = String(context.params.token ?? '')
  const userId = await findTvboxUserId(db, token)
  if (userId === null || !(await assertTvboxAccess(db, userId))) {
    return json({ code: 0, msg: '接口已失效，请重新获取', list: [] }, 403)
  }

  const url = new URL(context.request.url)
  const wd = (url.searchParams.get('wd') ?? '').trim()
  const ids = (url.searchParams.get('ids') ?? '').trim()
  const t = (url.searchParams.get('t') ?? '').trim()
  const pgRaw = Number.parseInt(url.searchParams.get('pg') ?? '1', 10)
  const pg = Number.isFinite(pgRaw) && pgRaw > 0 ? pgRaw : 1

  const sources = await readTvboxSources(db, context.env)
  if (sources.length === 0) {
    return json({ code: 1, msg: 'ok', page: pg, pagecount: pg, limit: 0, total: 0, list: [] })
  }

  if (ids) {
    const decoded = decodeAggId(ids)
    const record = decoded ? await aggDetail(sources, decoded.sourceId, decoded.vodId) : null
    return json({
      code: 1,
      msg: 'ok',
      page: 1,
      pagecount: 1,
      limit: record ? 1 : 0,
      total: record ? 1 : 0,
      list: record ? [record] : [],
    })
  }

  if (wd) {
    const list = await aggSearch(sources, wd, pg)
    return json({
      code: 1,
      msg: 'ok',
      page: pg,
      pagecount: list.length >= 60 ? pg + 1 : pg,
      limit: list.length,
      total: list.length,
      list,
    })
  }

  const [classes, list] = await Promise.all([
    pg === 1 && !t ? aggClasses(sources) : Promise.resolve(undefined),
    aggList(sources, t, pg),
  ])
  return json({
    code: 1,
    msg: 'ok',
    page: pg,
    pagecount: list.length >= 60 ? pg + 1 : pg,
    limit: list.length,
    total: list.length,
    ...(classes ? { class: classes } : {}),
    list,
  })
}
