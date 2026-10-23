import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { VideoSource } from '@tgys/cms-core'
import { useCmsClient } from '@/shared/hooks'
import { useApiStore } from '@/shared/store/apiStore'
import { getTitleMatchTier } from '@/features/search/hooks/directSearch.utils'
import type { PlayerSourceOption } from './useTmdbPlayback'
import { parsePlaylistQuality } from './playlistQuality'

interface UseSourceSpeedOptionsArgs {
  /** TMDB 路由：候选源由 useTmdbPlayback 提供，不再另行搜索 */
  isTmdbRoute: boolean
  tmdbOptions: PlayerSourceOption[]
  /** 直连/CMS 路由：按片名在其他源中搜索同名资源作为候选 */
  discoverTitle: string | null
  currentOption: PlayerSourceOption | null
}

interface SourceSpeedState {
  /** 已按播放速度升序排列的候选源（未测出的排后面） */
  options: PlayerSourceOption[]
  /** 源 code -> 播放线路首字节耗时（毫秒） */
  latencies: Map<string, number>
  /** 源 code -> 清晰度标签（如 1080p / 2K / 4K）；清单里读不到分辨率的源没有 */
  qualities: Map<string, string>
  /** 已完成探测（成功或失败）的源 code */
  probedCodes: Set<string>
  /** 是否仍在发现/测速 */
  isWorking: boolean
  /** 是否仍在跨源匹配候选 */
  discovering: boolean
}

const MAX_CONCURRENT = 3
const PROBE_TIMEOUT_MS = 6000

/**
 * 播放页换源候选 + 播放线路测速：
 * - TMDB 路由直接使用已匹配的源；直连路由按片名跨源搜索同名资源（标题匹配档位 ≤2 才入选）
 * - 对每个候选源探测其第一集地址的首字节耗时（浏览器直连，与直连搜索卡片同一口径）
 * - 返回按耗时升序排列的候选列表，测速结果到达后自动重排
 *
 * 注意副作用顺序：重置必须最先声明（标题/路由变化时先清状态），
 * 之后发现与探速才不会被随后的重置误伤。
 */
export function useSourceSpeedOptions({
  isTmdbRoute,
  tmdbOptions,
  discoverTitle,
  currentOption,
}: UseSourceSpeedOptionsArgs): SourceSpeedState {
  const cmsClient = useCmsClient()
  const cmsClientRef = useRef(cmsClient)
  cmsClientRef.current = cmsClient
  const { videoAPIs } = useApiStore()
  const videoApisRef = useRef(videoAPIs)
  videoApisRef.current = videoAPIs

  const [discovered, setDiscovered] = useState<PlayerSourceOption[]>([])
  const [discovering, setDiscovering] = useState(false)
  const [latencies, setLatencies] = useState<Map<string, number>>(new Map())
  const [qualities, setQualities] = useState<Map<string, string>>(new Map())
  const [probedCodes, setProbedCodes] = useState<Set<string>>(new Set())
  const latencyRef = useRef<Map<string, number>>(new Map())
  const qualityRef = useRef<Map<string, string>>(new Map())
  const doneRef = useRef<Set<string>>(new Set())
  const enqueuedRef = useRef<Set<string>>(new Set())
  const queueRef = useRef<PlayerSourceOption[]>([])
  const activeRef = useRef(0)
  const discoverRunRef = useRef(0)

  // ① 重置：标题或路由类型变化时清空上一部影片的候选与测速（必须最先声明）
  useEffect(() => {
    latencyRef.current = new Map()
    qualityRef.current = new Map()
    doneRef.current = new Set()
    enqueuedRef.current = new Set()
    queueRef.current = []
    setLatencies(new Map())
    setQualities(new Map())
    setProbedCodes(new Set())
    setDiscovered([])
    setDiscovering(false)
  }, [isTmdbRoute, discoverTitle])

  // ② 直连路由：跨源搜索同名资源（标题变化时重做）
  useEffect(() => {
    if (isTmdbRoute || !discoverTitle || !currentOption) return
    let cancelled = false
    const runId = ++discoverRunRef.current
    setDiscovering(true)

    const candidates = videoApisRef.current.filter(
      api => api.isEnabled && api.id !== currentOption.sourceCode,
    )
    let index = 0
    const worker = async () => {
      while (!cancelled && index < candidates.length) {
        const source = candidates[index]
        index += 1
        try {
          const result = await cmsClientRef.current.search(discoverTitle, source)
          if (cancelled || runId !== discoverRunRef.current || !result.success) continue
          let best: { vodId: string; tier: number } | null = null
          for (const item of result.items ?? []) {
            const tier = getTitleMatchTier(item.vod_name ?? '', discoverTitle)
            if (tier > 2) continue
            if (!best || tier < best.tier) best = { vodId: String(item.vod_id), tier }
            if (tier === 0) break
          }
          if (best && !cancelled) {
            const found = best
            setDiscovered(prev =>
              prev.some(o => o.sourceCode === source.id)
                ? prev
                : [
                    ...prev,
                    {
                      sourceCode: source.id,
                      sourceName: source.name,
                      bestVodId: found.vodId,
                      bestScore: 0,
                    },
                  ],
            )
          }
        } catch {
          // 单个源搜索失败静默跳过
        }
      }
    }
    const workers = Array.from({ length: Math.min(4, candidates.length) }, () => worker())
    void Promise.all(workers).then(() => {
      if (!cancelled && runId === discoverRunRef.current) setDiscovering(false)
    })
    return () => {
      cancelled = true
    }
    // videoAPIs 引用变化不重跑（配置中途变更不刷新候选），只随标题/当前源变化
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTmdbRoute, discoverTitle, currentOption?.sourceCode])

  // 候选集合：TMDB 用传入的；直连用 当前源 + 搜索发现的源
  const baseOptions = useMemo(() => {
    if (isTmdbRoute) return tmdbOptions
    const list: PlayerSourceOption[] = []
    if (currentOption) list.push(currentOption)
    for (const option of discovered) {
      if (!list.some(o => o.sourceCode === option.sourceCode)) list.push(option)
    }
    return list
  }, [isTmdbRoute, tmdbOptions, currentOption, discovered])

  // 播放线路探测：取详情第一集地址，浏览器直连计时到响应头（结果按源 code 记录，幂等）
  const runProbe = useCallback(async (option: PlayerSourceOption) => {
    const finish = (latency: number | null, quality: string | null = null) => {
      doneRef.current.add(option.sourceCode)
      setProbedCodes(new Set(doneRef.current))
      if (latency !== null) {
        latencyRef.current.set(option.sourceCode, latency)
        setLatencies(new Map(latencyRef.current))
      }
      if (quality !== null) {
        qualityRef.current.set(option.sourceCode, quality)
        setQualities(new Map(qualityRef.current))
      }
    }
    const source: VideoSource | undefined = videoApisRef.current.find(
      api => api.id === option.sourceCode,
    )
    if (!source || !option.bestVodId) {
      finish(null)
      return
    }
    try {
      const detail = await cmsClientRef.current.getDetail(option.bestVodId, source)
      const episodeUrl = detail.episodes?.[0]
      if (!detail.success || !episodeUrl) {
        finish(null)
        return
      }
      let parsed: URL
      try {
        parsed = new URL(episodeUrl)
      } catch {
        finish(null)
        return
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        finish(null)
        return
      }
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
      const start = performance.now()
      try {
        const response = await fetch(episodeUrl, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        })
        // 耗时以响应头到达为准（与既有测速口径一致）；随后读清单文本解析清晰度，
        // 读不到/媒体清单无分辨率信息时不记录，列表里就不显示标签
        const latency = Math.round(performance.now() - start)
        let quality: string | null = null
        try {
          quality = parsePlaylistQuality(await response.text())
        } catch {
          quality = null
        }
        finish(latency, quality)
      } finally {
        clearTimeout(timer)
      }
    } catch {
      finish(null)
    }
  }, [])

  const pumpQueue = useCallback(() => {
    while (activeRef.current < MAX_CONCURRENT && queueRef.current.length > 0) {
      const option = queueRef.current.shift()
      if (!option) break
      activeRef.current += 1
      void runProbe(option).finally(() => {
        activeRef.current -= 1
        pumpQueue()
      })
    }
  }, [runProbe])

  // ③ 候选出现后排队探测（每个源只测一次）
  useEffect(() => {
    for (const option of baseOptions) {
      if (enqueuedRef.current.has(option.sourceCode)) continue
      enqueuedRef.current.add(option.sourceCode)
      queueRef.current.push(option)
    }
    pumpQueue()
  }, [baseOptions, pumpQueue])

  const options = useMemo(() => {
    const sorted = [...baseOptions]
    sorted.sort((a, b) => {
      const la = latencies.get(a.sourceCode)
      const lb = latencies.get(b.sourceCode)
      if (la === undefined && lb === undefined) return 0
      if (la === undefined) return 1
      if (lb === undefined) return -1
      return la - lb
    })
    return sorted
  }, [baseOptions, latencies])

  const isWorking = discovering || probedCodes.size < baseOptions.length

  return { options, latencies, qualities, probedCodes, isWorking, discovering }
}
