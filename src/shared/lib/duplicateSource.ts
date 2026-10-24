import type { VideoSource } from '@tgys/cms-core'

/**
 * 在现有源列表里找与候选源重复的那一条（名称与地址都相同即视为同一个源，
 * 与 addSource / 导入 / 账号源去重的判重口径一致）。
 * excludeId 用于编辑场景排除源自己。找不到返回 undefined。
 */
export function findDuplicateVideoSource(
  list: VideoSource[],
  candidate: { name: string; url: string },
  excludeId?: string,
): VideoSource | undefined {
  return list.find(
    s => s.id !== excludeId && s.name === candidate.name && s.url === candidate.url,
  )
}
