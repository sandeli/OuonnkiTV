import type { VideoSource } from '@tgys/cms-core'
import type { AccountSourcePayload } from '@/shared/lib/authApi'

/** 订阅源 id 约定前缀（与 apiStore 内部判定一致；此处不引 subscriptionStore 以免模块循环） */
const isSubscriptionSourceId = (id: string) => id.startsWith('sub:')

/**
 * 账号源的本地口径（纯函数集合）：
 * 账户源 = 当前登录用户手动维护、随账户同步的源，包括两部分：
 * 1. 已登记的账户源（accountSourceIds）——哪怕已开启全站生效、正以托管源形态展示；
 * 2. 尚未同步过的手动源（非订阅、非托管）。
 * 订阅源与站点基础托管源不属于账户源。
 */
export function collectAccountSources(
  videoAPIs: VideoSource[],
  managedSourceIds: string[],
  accountSourceIds: string[],
): VideoSource[] {
  const managed = new Set(managedSourceIds)
  const registered = new Set(accountSourceIds)
  return videoAPIs.filter(
    s => !isSubscriptionSourceId(s.id) && (registered.has(s.id) || !managed.has(s.id)),
  )
}

/** VideoSource → 上行载荷（字段固定，序列化稳定，便于哈希比对） */
export function toAccountSourcePayload(source: VideoSource): AccountSourcePayload {
  return {
    id: source.id,
    name: source.name,
    url: source.url,
    ...(source.detailUrl && source.detailUrl !== source.url
      ? { detailUrl: source.detailUrl }
      : {}),
    ...(typeof source.timeout === 'number' ? { timeout: source.timeout } : {}),
    ...(typeof source.retry === 'number' ? { retry: source.retry } : {}),
    isEnabled: source.isEnabled !== false,
    siteWide: source.siteWide === true,
  }
}

/** 上行/下行载荷 → 本地 VideoSource */
export function fromAccountSourcePayload(payload: AccountSourcePayload): VideoSource {
  return {
    id: payload.id,
    name: payload.name,
    url: payload.url,
    detailUrl: payload.detailUrl || payload.url,
    timeout: payload.timeout,
    retry: payload.retry,
    isEnabled: payload.isEnabled !== false,
    siteWide: payload.siteWide === true,
    updatedAt: new Date(),
  }
}

/** 账户源集合的稳定序列化（不含 updatedAt 等易变字段），用于变更检测 */
export function serializeAccountSources(list: VideoSource[]): string {
  return JSON.stringify(list.map(toAccountSourcePayload))
}

export interface AccountMirrorResult {
  videoAPIs: VideoSource[]
  accountSourceIds: string[]
}

/**
 * 把服务端账户源镜像进本地列表（与托管源镜像同一手法）：
 * - 旧账户源中「以个人形态存在」的条目先摘除，再把新集合插回它们原来的位置；
 * - 已开启全站生效、正以托管形态展示的条目由托管镜像负责，这里只登记 id、不重复插入；
 * - 订阅源与其他手动源原样保留。
 */
export function applyAccountMirror(
  videoAPIs: VideoSource[],
  prevAccountSourceIds: string[],
  incoming: VideoSource[],
  managedSourceIds: string[],
): AccountMirrorResult {
  const managed = new Set(managedSourceIds)
  const incomingLocal = incoming.filter(s => !managed.has(s.id))
  const prevLocalIds = new Set(prevAccountSourceIds.filter(id => !managed.has(id)))
  const insertAt = videoAPIs.findIndex(s => prevLocalIds.has(s.id))
  const rest = videoAPIs.filter(s => !prevLocalIds.has(s.id))
  const at = insertAt === -1 ? rest.length : Math.min(insertAt, rest.length)
  return {
    videoAPIs: [...rest.slice(0, at), ...incomingLocal, ...rest.slice(at)],
    accountSourceIds: incoming.map(s => s.id),
  }
}
