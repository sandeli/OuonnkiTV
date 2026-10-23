/**
 * 从 m3u8 清单文本解析最高清晰度标签（换源列表展示用）。
 * 主清单（master）里 #EXT-X-STREAM-INF 带 RESOLUTION=宽x高，取最大高度；
 * 媒体清单本身不带分辨率信息，返回 null（不展示标签，绝不猜测）。
 */

export function formatQualityLabel(height: number): string {
  if (height >= 2000) return '4K'
  if (height >= 1300) return '2K'
  return `${height}p`
}

export function parsePlaylistQuality(text: string): string | null {
  if (!text || !text.includes('#EXTM3U')) return null
  let maxHeight = 0
  for (const match of text.matchAll(/#EXT-X-STREAM-INF:[^\n]*?RESOLUTION=(\d+)x(\d+)/g)) {
    const height = Number.parseInt(match[2], 10)
    if (Number.isFinite(height) && height > maxHeight) maxHeight = height
  }
  return maxHeight > 0 ? formatQualityLabel(maxHeight) : null
}
