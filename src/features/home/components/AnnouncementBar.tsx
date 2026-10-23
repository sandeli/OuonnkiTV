import { useEffect } from 'react'
import { Megaphone, Wrench } from 'lucide-react'
import { getPublicEnv } from '@/shared/config/runtimeEnv'
import { useAuthStore } from '@/shared/store/authStore'

/**
 * AnnouncementBar - 首页滚动公告栏
 * 内容优先读管理员后台设置（存服务器，改完即生效）；后台未设置时回退
 * 环境变量 TGYS_ANNOUNCEMENT。两者都为空时不渲染。
 */
export function AnnouncementBar() {
  const serverText = useAuthStore(state => state.authConfig?.announcementBar)
  const siteClosed = useAuthStore(state => state.authConfig?.siteBehavior?.siteClosed ?? false)
  const isAdmin = useAuthStore(state => state.user?.role === 'admin')

  // 进首页重拉一次配置，保证管理员刚改的公告立刻生效
  useEffect(() => {
    void useAuthStore.getState().probeConfig()
  }, [])

  const text = serverText?.trim() || getPublicEnv('TGYS_ANNOUNCEMENT')?.trim()

  // 关站期间站长自己不受影响，首页顶部给一条状态提示，避免误以为没生效
  const closedNotice =
    siteClosed && isAdmin ? (
      <div className="flex items-center gap-2 rounded-lg bg-amber-500/15 px-3 py-2">
        <Wrench className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="text-sm text-amber-700 dark:text-amber-300">
          站点已开启关站维护：普通用户看到的是维护页，只有管理员能登录（你不受影响）
        </span>
      </div>
    ) : null

  if (!text) return closedNotice

  // 滚动时长随文案长度调整，保证不同长度文案的滚动速度大致一致
  const duration = Math.max(12, Math.round(text.length * 0.55))

  return (
    <div className="space-y-2">
      {closedNotice}
    <div className="bg-primary/10 flex items-center gap-2 overflow-hidden rounded-lg px-3 py-2">
      <Megaphone className="text-primary size-4 shrink-0" />
      <div className="group relative flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_3%,black_97%,transparent)]">
        <div
          className="animate-marquee flex w-max group-hover:[animation-play-state:paused]"
          style={{ animationDuration: `${duration}s` }}
        >
          <span className="pr-16 text-sm whitespace-nowrap">{text}</span>
          <span className="pr-16 text-sm whitespace-nowrap" aria-hidden="true">
            {text}
          </span>
        </div>
      </div>
    </div>
    </div>
  )
}
