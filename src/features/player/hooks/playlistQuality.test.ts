import { describe, expect, it } from 'vitest'
import { formatQualityLabel, parsePlaylistQuality } from './playlistQuality'

const MASTER = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
360.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720
720.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
1080.m3u8
`

const MEDIA = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXTINF:9.9,
seg1.ts
#EXT-X-ENDLIST
`

describe('parsePlaylistQuality', () => {
  it('主清单取最高档位', () => {
    expect(parsePlaylistQuality(MASTER)).toBe('1080p')
  })
  it('1440 高标为 2K、2160 标为 4K', () => {
    expect(
      parsePlaylistQuality('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1,RESOLUTION=2560x1440\nx.m3u8'),
    ).toBe('2K')
    expect(
      parsePlaylistQuality('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1,RESOLUTION=3840x2160\nx.m3u8'),
    ).toBe('4K')
  })
  it('540 高标为 540p', () => {
    expect(
      parsePlaylistQuality('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1,RESOLUTION=960x540\nx.m3u8'),
    ).toBe('540p')
  })
  it('媒体清单无分辨率信息返回 null', () => {
    expect(parsePlaylistQuality(MEDIA)).toBeNull()
  })
  it('非清单文本返回 null', () => {
    expect(parsePlaylistQuality('<html>404</html>')).toBeNull()
    expect(parsePlaylistQuality('')).toBeNull()
  })
})

describe('formatQualityLabel', () => {
  it('档位边界', () => {
    expect(formatQualityLabel(2160)).toBe('4K')
    expect(formatQualityLabel(1440)).toBe('2K')
    expect(formatQualityLabel(1080)).toBe('1080p')
    expect(formatQualityLabel(480)).toBe('480p')
  })
})
