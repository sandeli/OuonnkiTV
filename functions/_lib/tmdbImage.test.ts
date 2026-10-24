import { describe, expect, it } from 'vitest'
import { buildTmdbImageOriginUrl } from './tmdbImage'

describe('buildTmdbImageOriginUrl 白名单校验', () => {
  it('合法的尺寸+文件名拼成官方源站地址', () => {
    expect(buildTmdbImageOriginUrl(['w500', 'abcDEF123.jpg'])).toBe(
      'https://image.tmdb.org/t/p/w500/abcDEF123.jpg',
    )
    expect(buildTmdbImageOriginUrl(['original', 'x_y-z.png'])).toBe(
      'https://image.tmdb.org/t/p/original/x_y-z.png',
    )
    expect(buildTmdbImageOriginUrl(['h632', 'p.jpg'])).toBe(
      'https://image.tmdb.org/t/p/h632/p.jpg',
    )
  })

  it('段数不对、尺寸段非法、路径穿越与编码绕过一律拒绝', () => {
    expect(buildTmdbImageOriginUrl([])).toBeNull()
    expect(buildTmdbImageOriginUrl(['w500'])).toBeNull()
    expect(buildTmdbImageOriginUrl(['w500', 'a.jpg', 'extra'])).toBeNull()
    expect(buildTmdbImageOriginUrl(['evil', 'a.jpg'])).toBeNull()
    expect(buildTmdbImageOriginUrl(['w500', '..'])).toBeNull()
    expect(buildTmdbImageOriginUrl(['w500', '%2e%2e'])).toBeNull()
    expect(buildTmdbImageOriginUrl(['w500', 'a/b.jpg'])).toBeNull()
    expect(buildTmdbImageOriginUrl(['w500', ''])).toBeNull()
  })
})
