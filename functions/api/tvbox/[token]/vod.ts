import { ensureSchema, json, type PagesContext } from '../../../_lib/auth'
import {
  aggDetail,
  aggList,
  aggSearch,
  aggWallDetail,
  assertTvboxAccess,
  decodeAggId,
  decodeWallTitle,
  DOUBAN_WALL_CATEGORIES,
  fetchDoubanWall,
  findTvboxUserId,
  readTvboxSources,
} from '../../../_lib/tvbox'

/**
 * TVBox 聚合站协议端点：GET /api/tvbox/<token>/vod
 * 不看 ac 的具体值，按参数分发（各 APP 方言不一，参数才是事实）：
 * - 带 ids（wall__ 开头）→ 图片墙点击：按片名跨源找最快线路
 * - 带 ids（源__影片）→ 详情（多线路按匹配与速度排序）
 * - 带 wd → 跨源聚合搜索
 * - 其余 → 豆瓣图片墙：class 为网站同款分类，t 为分类名、pg 分页
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

  const envelope = (
    list: unknown[],
    extra?: Record<string, unknown>,
  ) =>
    json({
      code: 1,
      msg: 'ok',
      page: pg,
      pagecount: list.length >= 60 ? pg + 1 : pg,
      limit: list.length,
      total: list.length,
      ...extra,
      list,
    })

  if (ids) {
    const wallTitle = decodeWallTitle(ids)
    let record = null
    if (wallTitle) {
      const sources = await readTvboxSources(db, context.env)
      record = sources.length > 0 ? await aggWallDetail(sources, wallTitle) : null
    } else {
      const decoded = decodeAggId(ids)
      if (decoded) {
        const sources = await readTvboxSources(db, context.env)
        record = sources.length > 0 ? await aggDetail(sources, decoded.sourceId, decoded.vodId) : null
      }
    }
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
    const sources = await readTvboxSources(db, context.env)
    const list = sources.length > 0 ? await aggSearch(sources, wd, pg) : []
    return envelope(list)
  }

  // 首页 / 分类：豆瓣图片墙（t 是分类名；没带 t 时首页默认热门电影并下发分类表）
  const wallCategory = t
    ? DOUBAN_WALL_CATEGORIES.find(c => c.label === t)
    : DOUBAN_WALL_CATEGORIES[0]
  if (wallCategory) {
    const list = await fetchDoubanWall(db, wallCategory, pg)
    return envelope(
      list,
      !t
        ? {
            class: DOUBAN_WALL_CATEGORIES.map(c => ({
              type_id: c.label,
              type_name: c.label,
            })),
          }
        : undefined,
    )
  }

  // t 不是豆瓣分类名时，回退到源站分类合并列表（兼容个别 APP 的分类请求）
  const sources = await readTvboxSources(db, context.env)
  const list = sources.length > 0 ? await aggList(sources, t, pg) : []
  return envelope(list)
}
