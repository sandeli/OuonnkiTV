import { reportWatch } from './authApi'
import { useAuthStore } from '@/shared/store/authStore'
import type { ViewingHistoryItem } from '@/shared/types'

/**
 * 观看记录上报：本地观看历史每次写入时顺带上报到服务器（供管理员后台查看）。
 * 仅在服务器账号模式且以普通账号登录时上报；站长与旧单密码模式不上报。
 * 节流：同一部剧同一集 30 秒内只报一次，进度跳变超过 60 秒立即报。
 */

const THROTTLE_MS = 30_000
const PROGRESS_JUMP_SECONDS = 60

const lastReportMap = new Map<string, { at: number; progress: number }>()

export function reportWatchActivity(item: ViewingHistoryItem): void {
  const { authMode, token, user } = useAuthStore.getState()
  if (authMode !== 'server' || !token || !user || user.isMaster) return
  if (!item.title || item.duration <= 0) return

  const key = `${item.sourceCode}|${item.vodId}|${item.episodeIndex}`
  const now = Date.now()
  const last = lastReportMap.get(key)
  if (last) {
    const throttled = now - last.at < THROTTLE_MS
    const smallProgressMove = Math.abs(item.playbackPosition - last.progress) < PROGRESS_JUMP_SECONDS
    if (throttled && smallProgressMove) return
  }
  lastReportMap.set(key, { at: now, progress: item.playbackPosition })

  void reportWatch(token, {
    title: item.title,
    sourceCode: item.sourceCode,
    sourceName: item.sourceName,
    vodId: item.vodId,
    episodeIndex: item.episodeIndex,
    episodeName: item.episodeName,
    progress: item.playbackPosition,
    duration: item.duration,
  }).catch(() => {
    // 上报失败静默：删掉节流记录，下次写入时重试
    lastReportMap.delete(key)
  })
}
