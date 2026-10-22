import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import type { VideoSource } from '@tgys/cms-core'
import { Button } from '@/shared/components/ui/button'
import { Spinner } from '@/shared/components/ui/spinner'
import { useCmsClient } from '@/shared/hooks'
import { useApiStore } from '@/shared/store/apiStore'
import { getTitleMatchTier } from '@/features/search/hooks/directSearch.utils'
import { buildDoubanSearchPath } from '@/shared/lib/douban'

/**
 * 豆瓣墙点击直达播放的解析页（/play/auto?q=片名）：
 * 跨源搜索同名资源 → 按标题匹配档位筛候选 → 逐个探测第一集播放延迟 →
 * 选出最快的源后 replace 跳转到标准播放地址 /play/cms/:source/:vodId（播放页本体不感知此流程）。
 * 规则与搜索结果页一致：先比匹配档位，再比播放延迟，测不出延迟的排后面。
 * 10 秒软上限：到时已有候选就用当前最佳开播，不无限等；一个候选都没有则回退搜索结果页。
 */

export interface AutoPlayCandidate {
  sourceId: string
  sourceName: string
  vodId: string
  tier: number
  latency: number | null
}

/** 候选排序：档位优先，其次已测速优先、延迟升序（纯函数，可测） */
export function pickBestCandidate(candidates: AutoPlayCandidate[]): AutoPlayCandidate | null {
  if (candidates.length === 0) return null
  return [...candidates].sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier
    if (a.latency === null && b.latency !== null) return 1
    if (a.latency !== null && b.latency === null) return -1
    if (a.latency !== null && b.latency !== null) return a.latency - b.latency
    return 0
  })[0]
}

const SEARCH_WORKERS = 4
const PROBE_WORKERS = 3
const PROBE_TIMEOUT_MS = 6000
const RESOLVE_DEADLINE_MS = 10000

export default function AutoPlayResolveView() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const cmsClient = useCmsClient()
  const title = (searchParams.get('q') ?? '').trim()

  const [progress, setProgress] = useState({ searched: 0, total: 0, found: 0, probed: 0 })
  const runRef = useRef(0)

  useEffect(() => {
    if (!title) {
      navigate('/', { replace: true })
      return
    }
    const runId = ++runRef.current
    let cancelled = false
    let finished = false
    let searchDone = false
    let probesActive = 0
    let probesDone = 0
    let searchedCount = 0
    const candidates: AutoPlayCandidate[] = []
    const probeQueue: AutoPlayCandidate[] = []
    const sources: VideoSource[] = useApiStore.getState().getSelectedAPIs()
    setProgress({ searched: 0, total: sources.length, found: 0, probed: 0 })

    const finish = () => {
      if (finished || cancelled || runId !== runRef.current) return
      finished = true
      const best = pickBestCandidate(candidates)
      if (best) {
        navigate(`/play/cms/${best.sourceId}/${best.vodId}`, { replace: true })
      } else {
        toast.error('未找到可直接播放的源，已为你打开搜索结果')
        navigate(buildDoubanSearchPath(title), { replace: true })
      }
    }

    const maybeFinish = () => {
      if (searchDone && probesActive === 0 && probeQueue.length === 0) finish()
    }

    const deadline = setTimeout(() => {
      // 软上限：已有候选就用当前最佳开播；还没有则等搜索扫完再兜底
      if (candidates.length > 0) finish()
    }, RESOLVE_DEADLINE_MS)

    const probeOne = async (candidate: AutoPlayCandidate) => {
      const source = sources.find(s => s.id === candidate.sourceId)
      if (!source) return
      try {
        const detail = await cmsClient.getDetail(candidate.vodId, source)
        const episodeUrl = detail.episodes?.[0]
        if (!detail.success || !episodeUrl) return
        let parsed: URL
        try {
          parsed = new URL(episodeUrl)
        } catch {
          return
        }
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
        const start = performance.now()
        try {
          const response = await fetch(episodeUrl, {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal,
          })
          candidate.latency = Math.round(performance.now() - start)
          void response.body?.cancel().catch(() => {})
        } catch {
          // 测速失败（跨域/超时）保持 latency=null，排序时排后面
        } finally {
          clearTimeout(timer)
        }
      } catch {
        // 详情拉取失败：候选保留但无延迟数据
      }
    }

    // 固定测速池：轮询队列，搜索结束且队列清空后退出
    const probeWorker = async () => {
      for (;;) {
        if (cancelled) return
        const candidate = probeQueue.shift()
        if (candidate) {
          probesActive += 1
          await probeOne(candidate)
          probesActive -= 1
          probesDone += 1
          if (!cancelled) setProgress(p => ({ ...p, probed: probesDone }))
          maybeFinish()
          continue
        }
        if (searchDone) return
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    const searchWorker = async (queue: VideoSource[]) => {
      while (!cancelled && queue.length > 0) {
        const source = queue.shift()
        if (!source) break
        try {
          const result = await cmsClient.search(title, source)
          if (cancelled) return
          if (result.success) {
            let best: { vodId: string; tier: number } | null = null
            for (const item of result.items ?? []) {
              const tier = getTitleMatchTier(item.vod_name ?? '', title)
              if (tier > 2) continue
              if (!best || tier < best.tier) best = { vodId: String(item.vod_id), tier }
              if (tier === 0) break
            }
            if (best) {
              const candidate: AutoPlayCandidate = {
                sourceId: source.id,
                sourceName: source.name,
                vodId: best.vodId,
                tier: best.tier,
                latency: null,
              }
              candidates.push(candidate)
              probeQueue.push(candidate)
              setProgress(p => ({ ...p, found: candidates.length }))
            }
          }
        } catch {
          // 单个源搜索失败静默跳过
        }
        searchedCount += 1
        if (!cancelled) setProgress(p => ({ ...p, searched: searchedCount }))
      }
    }

    for (let i = 0; i < PROBE_WORKERS; i += 1) void probeWorker()
    const searchQueue = [...sources]
    const workers = Array.from({ length: Math.min(SEARCH_WORKERS, searchQueue.length) }, () =>
      searchWorker(searchQueue),
    )
    void Promise.all(workers).then(() => {
      searchDone = true
      maybeFinish()
    })
    if (sources.length === 0) {
      searchDone = true
      finish()
    }

    return () => {
      cancelled = true
      clearTimeout(deadline)
    }
    // 只按标题跑一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <Spinner className="size-8" />
      <div>
        <p className="text-lg font-semibold">正在为你挑最快的源</p>
        <p className="text-muted-foreground mt-1 text-sm">《{title}》</p>
      </div>
      <p className="text-muted-foreground text-sm">
        已搜索 {progress.searched}/{progress.total} 个源 · 找到 {progress.found} 个可播源 · 已测速{' '}
        {progress.probed} 个
      </p>
      <Button
        variant="outline"
        onClick={() => navigate(buildDoubanSearchPath(title), { replace: true })}
      >
        不等了，查看全部源
      </Button>
    </div>
  )
}
