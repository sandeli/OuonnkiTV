import { toast } from 'sonner'
import type { VideoSource } from '@tgys/cms-core'
import { useApiStore } from '@/shared/store/apiStore'
import { useAuthStore } from '@/shared/store/authStore'
import { fetchUserSources, saveUserSources } from '@/shared/lib/authApi'
import {
  collectAccountSources,
  fromAccountSourcePayload,
  serializeAccountSources,
  toAccountSourcePayload,
} from '@/shared/lib/accountSources'

/**
 * 账号源同步引擎（服务器账号模式下登录用户启动，随账户走、不随浏览器）：
 * - 启动时先按归属用户隔离上一账号的源，再拉取服务端账户源，与本地手动源并集后
 *   镜像进本地（老本地源自动迁上账户）；
 * - 之后本地账户源集合有任何变化（增删改、开关、全站标记）都防抖整体回存服务端；
 * - 站长保存时服务端会把开启「全站生效」的源派生进全站分发列表，本端随后刷新
 *   公开配置，托管镜像随即跟上（含站长自己这台设备）；普通用户的源只对自己生效。
 * 返回停止函数（登出/身份变化时由调用方清理）。
 */
export function startAccountSourceSync(userId: number): () => void {
  useApiStore.getState().beginAccountSyncForUser(userId)
  let disposed = false
  let applying = false
  let timer: number | null = null
  let lastHash: string | null = null
  let failureNotified = false
  /** 服务端已知的账户源（最近一次拉取/保存回显）：用于识别「本机还没加载到」的已发布源 */
  let serverKnown: VideoSource[] = []
  /** 本次会话里在本地列表中出现过的源 id：出现过又消失 = 被删，不再从服务端副本里带回 */
  const seenIds = new Set<string>(useApiStore.getState().videoAPIs.map(s => s.id))

  const collect = () => {
    const state = useApiStore.getState()
    return collectAccountSources(state.videoAPIs, state.managedSourceIds, state.accountSourceIds)
  }

  const pushNow = async () => {
    if (disposed) return
    const token = useAuthStore.getState().token
    if (!token) return
    const local = collect()
    const localIds = new Set(local.map(s => s.id))
    // 已发布（全站生效）的源在托管镜像没加载到本机时不出现在本地列表里，
    // 回存时把这类「服务端有、本机没见过」的条目原样带回，避免一次本地编辑把它们误删下架
    const carried = serverKnown.filter(
      s => s.siteWide === true && !localIds.has(s.id) && !seenIds.has(s.id),
    )
    const list = [...local, ...carried]
    const hash = serializeAccountSources(list)
    if (hash === lastHash) return
    // 先乐观更新服务端副本：托管镜像随后摘除/恢复条目时，对账以这份最新意图为准
    serverKnown = list
    try {
      const saved = await saveUserSources(token, list.map(toAccountSourcePayload))
      serverKnown = saved.sources.map(fromAccountSourcePayload)
      lastHash = hash
      failureNotified = false
      // 全站分发可能变化：刷新公开配置，托管镜像（本站长设备与其他用户）随后跟上
      void useAuthStore.getState().probeConfig()
    } catch {
      if (!failureNotified) {
        failureNotified = true
        toast.error('源同步到账户失败，改动暂存在本机，之后会自动重试')
      }
    }
  }

  const schedulePush = () => {
    if (timer !== null) window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      timer = null
      void pushNow()
    }, 1200)
  }

  const init = async () => {
    const token = useAuthStore.getState().token
    if (!token || disposed) return
    try {
      const remote = await fetchUserSources(token)
      if (disposed) return
      serverKnown = remote.sources.map(fromAccountSourcePayload)
      const localList = collect()
      // 并集（同 id 以服务端为准）：把这台设备上还没上过账户的老手动源迁上去
      const remoteIds = new Set(serverKnown.map(s => s.id))
      const merged = [...serverKnown, ...localList.filter(s => !remoteIds.has(s.id))]
      applying = true
      useApiStore.getState().applyAccountSources(merged)
      applying = false
      // 先刷新配置并跑一遍托管镜像，让已发布的源以托管形态回到本地列表，
      // 之后的变更检测才不会把它们误判为「已删除」
      await useAuthStore.getState().probeConfig()
      if (disposed) return
      await useApiStore.getState().initializeEnvSources()
      if (disposed) return
      for (const s of useApiStore.getState().videoAPIs) seenIds.add(s.id)
      lastHash = serializeAccountSources(collect())
      if (serializeAccountSources(serverKnown) !== serializeAccountSources(merged)) {
        const saved = await saveUserSources(token, merged.map(toAccountSourcePayload))
        serverKnown = saved.sources.map(fromAccountSourcePayload)
        lastHash = serializeAccountSources(collect())
        if (!disposed) void useAuthStore.getState().probeConfig()
      }
    } catch {
      // 拉取失败不打扰：本地源照常可用，下次打开站点会再同步
    }
  }
  void init()

  const unsubscribe = useApiStore.subscribe((state, prevState) => {
    if (disposed) return
    for (const s of state.videoAPIs) seenIds.add(s.id)
    if (applying) return
    if (state.videoAPIs === prevState.videoAPIs) return
    // 对账：账户源在服务端有、本机列表里却缺失（且不是正以托管形态展示）时补回本地。
    // 典型场景：关闭某源的「全站生效」后，托管镜像会把它从列表摘除，
    // 但它仍是站长的个人账户源，应以个人形态回到列表里，而不是被删掉
    const missing = serverKnown.filter(
      s =>
        !state.videoAPIs.some(v => v.id === s.id) && !state.managedSourceIds.includes(s.id),
    )
    if (missing.length > 0) {
      applying = true
      useApiStore.getState().applyAccountSources(serverKnown)
      applying = false
    }
    schedulePush()
  })

  return () => {
    disposed = true
    unsubscribe()
    if (timer !== null) window.clearTimeout(timer)
  }
}
