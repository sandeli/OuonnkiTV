import { NavLink } from 'react-router'
import { Clapperboard } from 'lucide-react'
import type { TmdbMediaItem } from '@/shared/types/tmdb'
import { MediaPosterCard } from '@/shared/components/common'
import { getPosterUrl } from '@/shared/lib/tmdb'
import { buildTmdbDetailPath } from '@/shared/lib/routes'

interface PlayerInfoAndRecommendationsProps {
  showRecommendations?: boolean
  recommendations: TmdbMediaItem[]
}

/**
 * 播放页底部区：只剩「猜你还喜欢」推荐。
 * 「影视介绍」已整体搬到右侧选集/简介合并框的「简介」页（PlayerInfoContent）。
 */
export function PlayerInfoAndRecommendations({
  showRecommendations = true,
  recommendations,
}: PlayerInfoAndRecommendationsProps) {
  if (!showRecommendations) return null

  return (
    <section className="space-y-3 rounded-lg border border-border/60 bg-card/45 p-4 md:p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Clapperboard className="size-4" />
          猜你还喜欢
        </h2>
        <NavLink to="/" className="text-muted-foreground text-xs hover:text-foreground">
          去首页查看更多
        </NavLink>
      </div>

      {recommendations.length > 0 ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {recommendations.slice(0, 12).map(item => (
            <MediaPosterCard
              key={`${item.mediaType}-${item.id}`}
              to={buildTmdbDetailPath(item.mediaType, item.id)}
              posterUrl={getPosterUrl(item.posterPath, 'w342')}
              title={item.title}
              showTitle
            />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">暂无推荐内容</p>
      )}
    </section>
  )
}
