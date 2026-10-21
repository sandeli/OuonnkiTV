import { Megaphone } from 'lucide-react'
import { getPublicEnv } from '@/shared/config/runtimeEnv'

/**
 * AnnouncementBar - 首页滚动公告栏
 * 内容来自环境变量 TGYS_ANNOUNCEMENT（Cloudflare 后台设置，改后需重新部署；
 * Docker 部署为运行时读取，重启容器即可）。未设置或为空时不渲染。
 */
export function AnnouncementBar() {
  const text = getPublicEnv('TGYS_ANNOUNCEMENT')?.trim()
  if (!text) return null

  // 滚动时长随文案长度调整，保证不同长度文案的滚动速度大致一致
  const duration = Math.max(12, Math.round(text.length * 0.55))

  return (
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
  )
}
