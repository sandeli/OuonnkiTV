import { NavLink } from 'react-router'
import { CalendarDays, ExternalLink, Heart, Star, Tv } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'

/**
 * 播放页「简介」页的数据（由 UnifiedPlayer 按 CMS / TMDB 两种来源组装成统一结构）
 */
export interface PlayerInfoData {
  title: string
  originalTitle?: string
  /** 海报完整 URL（已拼好，可为空） */
  poster?: string
  overview: string
  sourceName: string
  modeLabel: string
  /** 媒体类型文案：剧集 / 电影 */
  mediaTypeText?: string | null
  releaseDate?: string
  rating?: number
  /** 季/集文案，如「共 2 季 / 24 集」 */
  seasonEpisodeText?: string
  /** CMS 详情的分类/年份/地区等补充徽章 */
  extraBadges?: string[]
  actors: string[]
  directors: string[]
  favoriteAction?: {
    active: boolean
    onToggle: () => void
  }
  detailLink?: string
}

/**
 * 人名拆分（与 KVideo 一致）：按逗号/中文逗号/斜杠切，不按空格切
 *（中文名无空格，英文名如 Tom Hanks 按空格切会切坏）。
 */
export function splitPersonNames(value: string | undefined | null): string[] {
  if (!value) return []
  return value
    .split(/[,，/]/)
    .map(name => name.trim())
    .filter(Boolean)
}

/** 人名胶囊链接：点击去豆瓣名人搜索（与 KVideo 影片简介一致） */
function PersonLinks({ label, names }: { label: string; names: string[] }) {
  if (names.length === 0) return null
  return (
    <div className="flex gap-1.5 text-xs sm:text-[13px]">
      <span className="shrink-0 font-semibold">{label}：</span>
      <span className="flex flex-wrap gap-1">
        {names.map(name => (
          <a
            key={name}
            href={`https://movie.douban.com/celebrities/search?search_text=${encodeURIComponent(name)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:border-primary/60 hover:text-primary inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 transition-colors"
          >
            {name}
            <ExternalLink className="size-2.5 opacity-60" />
          </a>
        ))}
      </span>
    </div>
  )
}

/**
 * 播放页右侧框「简介」页内容：原页面下方的「影视介绍」整体搬入，
 * 内容形态参考 KVideo 的影片简介（海报 + 徽章 + 简介全文 + 主演/导演胶囊链接）。
 */
export function PlayerInfoContent({ info }: { info: PlayerInfoData }) {
  const {
    title,
    originalTitle,
    poster,
    overview,
    sourceName,
    modeLabel,
    mediaTypeText,
    releaseDate,
    rating,
    seasonEpisodeText,
    extraBadges,
    actors,
    directors,
    favoriteAction,
    detailLink,
  } = info

  return (
    <div className="space-y-3.5 pr-1">
      <div className="flex gap-3">
        <div className="relative aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-lg border border-border/50 bg-muted/35">
          {poster ? (
            <img src={poster} alt={title} className="absolute inset-0 block h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center text-[10px]">暂无海报</div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-0.5">
              <h3 className="line-clamp-2 text-base leading-snug font-semibold">{title}</h3>
              {originalTitle && originalTitle !== title && (
                <p className="text-muted-foreground line-clamp-1 text-xs">{originalTitle}</p>
              )}
            </div>
            {favoriteAction ? (
              <Button
                size="sm"
                variant={favoriteAction.active ? 'default' : 'secondary'}
                className="h-7 shrink-0 rounded-full px-2.5 text-xs"
                onClick={favoriteAction.onToggle}
              >
                <Heart className={favoriteAction.active ? 'size-3.5 fill-current' : 'size-3.5'} />
                {favoriteAction.active ? '已收藏' : '收藏'}
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="h-6 rounded-full px-2 text-[11px]">
              {sourceName}
            </Badge>
            <Badge variant="outline" className="h-6 rounded-full px-2 text-[11px]">
              {modeLabel}
            </Badge>
            {mediaTypeText && (
              <Badge variant="outline" className="h-6 rounded-full px-2 text-[11px]">
                {mediaTypeText}
              </Badge>
            )}
            {extraBadges?.map(label => (
              <Badge key={label} variant="outline" className="h-6 rounded-full px-2 text-[11px]">
                {label}
              </Badge>
            ))}
            {releaseDate && (
              <Badge variant="outline" className="h-6 rounded-full px-2 text-[11px]">
                <CalendarDays className="size-3.5" />
                {releaseDate.slice(0, 10)}
              </Badge>
            )}
            {rating && rating > 0 ? (
              <Badge variant="outline" className="h-6 rounded-full px-2 text-[11px]">
                <Star className="size-3.5 text-amber-400" />
                {rating.toFixed(1)}
              </Badge>
            ) : null}
            {seasonEpisodeText && (
              <Badge variant="outline" className="h-6 rounded-full px-2 text-[11px]">
                <Tv className="size-3.5" />
                {seasonEpisodeText}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <h4 className="text-sm font-semibold">剧情介绍</h4>
        <p className="text-muted-foreground text-sm leading-6 whitespace-pre-wrap">
          {overview.trim() ? overview : '暂无剧情介绍'}
        </p>
      </div>

      <PersonLinks label="主演" names={actors} />
      <PersonLinks label="导演" names={directors} />

      {detailLink ? (
        <div className="flex justify-end">
          <NavLink to={detailLink} className="text-muted-foreground text-xs hover:text-foreground">
            查看详情
          </NavLink>
        </div>
      ) : null}
    </div>
  )
}
