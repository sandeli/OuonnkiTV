import type { VideoSource } from '@tgys/cms-core'

export interface SourcePaginationInfo {
  totalPages: number
  totalResults: number
}

export function getSourcesToFetch(
  selectedAPIs: VideoSource[],
  cachedSources: Map<string, SourcePaginationInfo>,
  page: number,
): VideoSource[] {
  return selectedAPIs.filter(source => {
    const cached = cachedSources.get(source.id)
    if (!cached) return true
    return page <= cached.totalPages
  })
}

/** 归一化文本用于标题匹配：小写并去掉空白与常见标点 */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s·•・:：\-—_()（）【】[\]《》"“”'‘’.,，。!！?？/\\|]/g, '')
}

/**
 * 标题与搜索词的匹配档位（越小越精准）：
 * 0 = 完全一致；1 = 一方以另一方开头（如带季数/年份后缀）；2 = 互相包含；3 = 无直接关系（源接口模糊匹配带回的）
 */
export function getTitleMatchTier(title: string, query: string): number {
  const t = normalizeForMatch(title)
  const q = normalizeForMatch(query)
  if (!t || !q) return 3
  if (t === q) return 0
  if (t.startsWith(q) || q.startsWith(t)) return 1
  if (t.includes(q) || q.includes(t)) return 2
  return 3
}
