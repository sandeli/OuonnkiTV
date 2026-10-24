import { useState } from 'react'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { cn } from '@/shared/lib/utils'
import { PlayerEpisodePanel } from './PlayerEpisodePanel'
import { PlayerInfoContent, type PlayerInfoData } from './PlayerInfoContent'
import type { EpisodePageItem } from '@/features/player/hooks'

interface EpisodeRange {
  label: string
  value: string
}

interface PlayerEpisodeInfoPanelProps {
  /** 「简介」胶囊页的数据（影视介绍整体搬入，含演员/导演链接） */
  info: PlayerInfoData
  totalEpisodes: number
  selectedEpisode: number
  isReversed: boolean
  onToggleOrder: () => void
  pageRanges: EpisodeRange[]
  currentPageRange: string
  onPageRangeChange: (value: string) => void
  episodes: EpisodePageItem[]
  onEpisodeSelect: (displayIndex: number) => void
  episodeProgressMap?: Map<number, number> | null
  className?: string
}

type AsideTab = 'episodes' | 'info'

const TABS: Array<{ value: AsideTab; label: string }> = [
  { value: 'episodes', label: '选集' },
  { value: 'info', label: '简介' },
]

/**
 * 播放页右侧合并框：选集与简介收进同一个框，顶部两个胶囊切换
 *（样式对齐 KVideo 播放页的分段胶囊）。默认停在选集。
 */
export function PlayerEpisodeInfoPanel({
  info,
  totalEpisodes,
  selectedEpisode,
  isReversed,
  onToggleOrder,
  pageRanges,
  currentPageRange,
  onPageRangeChange,
  episodes,
  onEpisodeSelect,
  episodeProgressMap,
  className,
}: PlayerEpisodeInfoPanelProps) {
  const [tab, setTab] = useState<AsideTab>('episodes')

  return (
    <section
      className={cn(
        'flex min-h-0 flex-col gap-3 rounded-lg border border-border/60 bg-card/55 p-3 md:p-4',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="bg-muted/70 flex items-center gap-1 rounded-full p-1" role="tablist" aria-label="选集与简介切换">
          {TABS.map(item => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={tab === item.value}
              onClick={() => setTab(item.value)}
              className={cn(
                'rounded-full px-4 py-1.5 text-xs font-medium transition-colors sm:text-sm',
                tab === item.value
                  ? 'bg-background text-foreground shadow'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        {tab === 'episodes' && (
          <span className="text-muted-foreground shrink-0 text-xs">共 {totalEpisodes} 集</span>
        )}
      </div>

      {tab === 'episodes' ? (
        <div className="min-h-0 flex-1">
          <PlayerEpisodePanel
            totalEpisodes={totalEpisodes}
            selectedEpisode={selectedEpisode}
            isReversed={isReversed}
            onToggleOrder={onToggleOrder}
            pageRanges={pageRanges}
            currentPageRange={currentPageRange}
            onPageRangeChange={onPageRangeChange}
            episodes={episodes}
            onEpisodeSelect={onEpisodeSelect}
            episodeProgressMap={episodeProgressMap}
            compact
            fillHeight
            hideHeader
            className="h-full border-0 bg-transparent p-0 md:p-0"
          />
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <PlayerInfoContent info={info} />
        </ScrollArea>
      )}
    </section>
  )
}
