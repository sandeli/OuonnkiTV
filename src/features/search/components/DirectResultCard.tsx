import { useState } from 'react'
import { NavLink } from 'react-router'
import { Play } from 'lucide-react'
import { AspectRatio } from '@/shared/components/ui/aspect-ratio'
import { cn } from '@/shared/lib/utils'
import type { SourceColorScheme } from '@/shared/lib/source-colors'

interface DirectResultCardProps {
  /** 播放页链接 */
  to: string
  /** 速度排名（按源速排序后的名次，从 1 开始） */
  rank: number
  /** 片名 */
  title: string
  /** 海报 URL */
  posterUrl?: string | null
  /** 源名称 */
  sourceName?: string
  /** 源名徽章配色 */
  sourceColorScheme?: SourceColorScheme
  /** 备注（集数等，如「更新至第12集」）- 显示在海报左下角 */
  remarks?: string
  /** 影片规格（分辨率，如 1080P / 2K / 4K）- 绿色实心标 */
  resolution?: string | null
  /** 该源测速耗时（毫秒）- 绿色描边标 */
  latencyMs?: number
  /** 语言（如「汉语普通话」） */
  lang?: string
}

/**
 * DirectResultCard - 直连搜索结果卡片
 * 布局：海报（左上排名 / 右上源名 / 左下集数）+ 居中标题 + 规格/测速徽章行 + 语言
 */
export function DirectResultCard({
  to,
  rank,
  title,
  posterUrl,
  sourceName,
  sourceColorScheme,
  remarks,
  resolution,
  latencyMs,
  lang,
}: DirectResultCardProps) {
  const [imgError, setImgError] = useState(false)
  const showPoster = !!posterUrl && !imgError

  const labelColor = sourceColorScheme || { bg: '59, 130, 246', text: '255, 255, 255' }
  const labelStyle = {
    backgroundColor: `rgb(${labelColor.bg})`,
    color: `rgb(${labelColor.text})`,
  }

  return (
    <NavLink to={to} className="block">
      <div className="group bg-card overflow-hidden rounded-2xl border shadow-sm transition-shadow duration-300 hover:shadow-md">
        {/* 海报区 */}
        <div className="relative">
          <AspectRatio ratio={2 / 3}>
            {showPoster ? (
              <img
                className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                src={posterUrl}
                alt={title}
                loading="lazy"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="bg-muted flex h-full w-full flex-col items-center justify-center gap-2">
                <div className="bg-primary/90 flex size-12 items-center justify-center rounded-full text-white">
                  <Play className="size-6 fill-current" />
                </div>
                <span className="text-muted-foreground text-xs">Image Not Available</span>
              </div>
            )}
          </AspectRatio>

          {/* 排名徽章：前三橙色，其余深色 */}
          <div
            className={cn(
              'absolute left-2 top-2 flex size-7 items-center justify-center rounded-lg text-sm font-bold text-white shadow',
              rank <= 3 ? 'bg-orange-500' : 'bg-black/70',
            )}
          >
            {rank}
          </div>

          {/* 源名徽章 */}
          {sourceName && (
            <div
              className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-medium shadow-sm"
              style={labelStyle}
            >
              {sourceName}
            </div>
          )}

          {/* 集数/备注徽章 */}
          {remarks && (
            <div className="absolute bottom-2 left-2 max-w-[85%] truncate rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-orange-400 backdrop-blur-sm">
              {remarks}
            </div>
          )}
        </div>

        {/* 信息区 */}
        <div className="px-2 py-3 text-center">
          <p className="text-primary line-clamp-1 text-sm font-semibold">{title}</p>

          {(resolution || latencyMs !== undefined) && (
            <div className="mt-2 flex items-center justify-center gap-1.5">
              {resolution && (
                <span className="rounded bg-green-500 px-1.5 py-0.5 text-[11px] font-bold text-white">
                  {resolution}
                </span>
              )}
              {latencyMs !== undefined && (
                <span className="rounded-full border border-green-500 px-2 py-0.5 text-[11px] font-medium text-green-600 dark:text-green-400">
                  {latencyMs}ms
                </span>
              )}
            </div>
          )}

          {lang && <p className="text-muted-foreground mt-1.5 truncate text-xs">{lang}</p>}
        </div>
      </div>
    </NavLink>
  )
}
