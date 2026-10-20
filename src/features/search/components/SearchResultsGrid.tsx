import type { TmdbMediaItem } from '@/shared/types/tmdb'
import type { VideoItem } from '@tgys/cms-core'
import { MediaPosterCard } from '@/shared/components/common/MediaPosterCard'
import { NoResultIcon } from '@/shared/components/icons'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { cn } from '@/shared/lib/utils'
import { AspectRatio } from '@/shared/components/ui/aspect-ratio'
import { useMemo } from 'react'
import type { SearchMode } from './SearchModeToggle'
import { getSourceColorScheme } from '@/shared/lib/source-colors'
import { SourceStatusBadge } from './SourceStatusBadge'
import { DirectResultCard } from './DirectResultCard'
import { getPosterUrl } from '@/shared/lib/tmdb'
import { buildCmsPlayPath, buildTmdbDetailPath } from '@/shared/lib/routes'

interface SearchResultsGridProps {
  /** 搜索模式 */
  mode: SearchMode
  /** TMDB 搜索结果 */
  tmdbResults?: TmdbMediaItem[]
  /** 直连搜索结果 */
  directResults?: VideoItem[]
  /** 是否加载中 */
  loading: boolean
  /** 直连搜索进度（已完成的源数量/总源数量） */
  searchProgress?: { completed: number; total: number }
  /** 成功返回结果的源 ID 集合 */
  successfulSources?: Set<string>
  /** 各源响应耗时（毫秒）：直连模式按源速从快到慢排序结果 */
  sourceLatencies?: Map<string, number>
  /** 总结果数量（来自 API 分页信息） */
  totalResults?: number
  /** 是否正在搜索新查询（用于显示骨架屏） */
  isSearchingNewQuery?: boolean
  /** 是否还有更多内容 */
  hasMore?: boolean
  /** 当前页是否已完成（仅 Direct 模式） */
  isCurrentPageComplete?: boolean
  /** 哨兵元素引用（用于滚动加载） */
  sentinelRef?: React.RefObject<HTMLDivElement | null>
  className?: string
}

// 骨架屏数量
const SKELETON_COUNT = 20

const RESOLUTION_PATTERN = /(2160P|1440P|1080P|720P|576P|480P|4K|2K)/i

/** 从播放地址/备注中提取影片规格（分辨率），提不到返回 null */
function extractResolution(item: VideoItem): string | null {
  for (const text of [item.vod_play_url, item.vod_remarks]) {
    if (!text) continue
    const match = text.match(RESOLUTION_PATTERN)
    if (match) return match[1].toUpperCase()
  }
  return null
}

/**
 * ResultSkeleton - 结果骨架屏
 */
function ResultSkeleton() {
  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg">
        <AspectRatio ratio={2 / 3}>
          <Skeleton className="h-full w-full" />
        </AspectRatio>
      </div>
      <Skeleton className="h-4 w-3/4" />
    </div>
  )
}

/**
 * EmptyState - 空状态组件
 */
function EmptyState({ mode }: { mode: SearchMode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <NoResultIcon size={128} className="text-muted-foreground/30" />
      <p className="text-muted-foreground mt-4 text-sm">
        {mode === 'tmdb' ? '未找到相关内容，试试其他关键词' : '换个关键词试试吧'}
      </p>
    </div>
  )
}

/**
 * SearchResultsGrid - 搜索结果网格组件
 */
export function SearchResultsGrid({
  mode,
  tmdbResults = [],
  directResults = [],
  loading,
  searchProgress,
  successfulSources,
  sourceLatencies,
  totalResults,
  isSearchingNewQuery,
  hasMore = false,
  isCurrentPageComplete = true,
  sentinelRef,
  className,
}: SearchResultsGridProps) {
  // 直连模式排序：已测得源速时按源响应耗时从快到慢（稳定排序，同源内保持原顺序，未测速排最后）
  const directResultsSorted = useMemo(() => {
    if (!sourceLatencies || sourceLatencies.size === 0) return directResults
    return [...directResults].sort((a, b) => {
      const la = a.source_code ? sourceLatencies.get(a.source_code) : undefined
      const lb = b.source_code ? sourceLatencies.get(b.source_code) : undefined
      return (la ?? Number.POSITIVE_INFINITY) - (lb ?? Number.POSITIVE_INFINITY)
    })
  }, [directResults, sourceLatencies])

  // TMDB 模式：显示所有结果
  if (mode === 'tmdb') {
    const results = tmdbResults
    const hasResults = results.length > 0
    // 判断骨架屏显示：
    // 1. 正在加载且没有已有结果（首次加载）
    // 2. 正在搜索新查询（更换关键词或切换筛选）
    const showSkeleton = loading && (!hasResults || isSearchingNewQuery)

    return (
      <div className={cn('space-y-6', className)}>
        {/* 结果统计 - 仅在非加载状态且有 totalResults 时显示 */}
        {!loading && hasResults && totalResults !== undefined && (
          <div className="text-muted-foreground text-sm">
            共找到 <span className="text-primary font-medium">{totalResults}</span> 个结果
            {results.length !== totalResults && (
              <>，已显示 <span className="text-primary font-medium">{results.length}</span> 个</>
            )}
          </div>
        )}

        {/* 内容区域 */}
        <div>
          {showSkeleton ? (
            <div className="grid grid-cols-3 gap-2 sm:gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
              {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
                <ResultSkeleton key={index} />
              ))}
            </div>
          ) : hasResults ? (
            <div className="grid grid-cols-3 gap-2 sm:gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
              {results.map(item => (
                <div key={`${item.mediaType}-${item.id}`}>
                  <MediaPosterCard
                    to={buildTmdbDetailPath(item.mediaType, item.id)}
                    posterUrl={getPosterUrl(item.posterPath, 'w342') || null}
                    title={item.title}
                    year={item.releaseDate ? item.releaseDate.split('-')[0] : undefined}
                    rating={item.voteAverage}
                  />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState mode="tmdb" />
          )}
        </div>

        {/* 加载更多状态 - 哨兵元素始终渲染，但只在有结果时显示内容 */}
        <div ref={sentinelRef} className="py-8 flex justify-center min-h-[60px]">
          {hasResults ? (
            loading ? (
              <div className="text-muted-foreground text-sm flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                加载下一页...
              </div>
            ) : hasMore ? (
              <div className="text-muted-foreground text-sm">
                下滑加载更多
              </div>
            ) : (
              <div className="text-muted-foreground text-sm">
                已加载全部内容
              </div>
            )
          ) : null}
        </div>
      </div>
    )
  }

  // Direct 模式：无分页，显示所有累积结果（已按源速排序，见组件顶部）
  const results = directResultsSorted
  const validResults = results.filter(item => item.source_code && item.vod_id)
  const hasResults = results.length > 0
  const sortedBySpeed = !!sourceLatencies && sourceLatencies.size > 0

  return (
    <div className={cn('space-y-6', className)}>
      {/* 结果统计 + 源状态 */}
      <div className="flex items-center justify-between gap-4">
        {/* 左侧：结果统计 */}
        {hasResults && (
          <div className="text-muted-foreground text-sm">
            共找到 <span className="text-primary font-medium">{results.length}</span> 个结果
            {sortedBySpeed && <span> · 已按各源速度从快到慢排列</span>}
          </div>
        )}
        {/* 右侧：源状态徽章 */}
        {searchProgress && (
          <SourceStatusBadge
            completed={searchProgress.completed}
            total={searchProgress.total}
            successfulSources={successfulSources}
            resultsCount={results.length}
            loading={loading}
          />
        )}
      </div>

      {/* 内容区域 */}
      <div>
        {loading && !hasResults ? (
          <div className="grid grid-cols-3 gap-2 sm:gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
            {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
              <ResultSkeleton key={index} />
            ))}
          </div>
        ) : hasResults ? (
          <div className="grid grid-cols-3 gap-2 sm:gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
            {validResults.map((item, index) => {
              const sourceCode = item.source_code as string
              return (
                <DirectResultCard
                  key={`${sourceCode}-${item.vod_id}`}
                  to={buildCmsPlayPath(sourceCode, item.vod_id)}
                  rank={index + 1}
                  title={item.vod_name}
                  posterUrl={item.vod_pic || null}
                  sourceName={item.source_name}
                  sourceColorScheme={getSourceColorScheme(sourceCode)}
                  remarks={item.vod_remarks || undefined}
                  resolution={extractResolution(item)}
                  latencyMs={sourceLatencies?.get(sourceCode)}
                  lang={item.vod_lang || undefined}
                />
              )
            })}
          </div>
        ) : (
          <EmptyState mode="direct" />
        )}
      </div>

      {/* 加载更多状态 */}
      {hasResults && (
        <div ref={sentinelRef} className="py-8 flex justify-center">
          {!hasMore ? (
            <div className="text-muted-foreground text-sm">
              已加载全部内容
            </div>
          ) : loading && isCurrentPageComplete ? (
            <div className="text-muted-foreground text-sm flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              加载下一页...
            </div>
          ) : !isCurrentPageComplete ? (
            <div className="text-muted-foreground text-sm flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              等待更多源返回结果...
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">
              下滑加载更多
            </div>
          )}
        </div>
      )}
    </div>
  )
}
