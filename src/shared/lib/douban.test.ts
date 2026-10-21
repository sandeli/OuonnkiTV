import { describe, expect, it } from 'vitest'
import { buildDoubanDataRequestUrl, buildDoubanPosterUrl } from './douban'
import type { DoubanProxyConfig } from './authApi'

const SITE_PROXY = '/proxy?url='
const TARGET = 'https://movie.douban.com/j/search_subjects?type=movie&tag=%E7%83%AD%E9%97%A8'
const COVER = 'https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2927066381.jpg'

function cfg(partial: Partial<DoubanProxyConfig>): DoubanProxyConfig {
  return { dataType: 'direct', dataUrl: '', imageType: 'server', imageUrl: '', ...partial }
}

describe('buildDoubanDataRequestUrl', () => {
  it('direct 走本站代理', () => {
    expect(buildDoubanDataRequestUrl(TARGET, cfg({}), SITE_PROXY)).toBe(
      `${SITE_PROXY}${encodeURIComponent(TARGET)}`,
    )
  })

  it('zwei 走 ciao-cors 前缀', () => {
    expect(buildDoubanDataRequestUrl(TARGET, cfg({ dataType: 'cors-proxy-zwei' }), SITE_PROXY)).toBe(
      `https://ciao-cors.is-an.org/${encodeURIComponent(TARGET)}`,
    )
  })

  it('cmliussss 镜像只换域名不走代理', () => {
    expect(
      buildDoubanDataRequestUrl(TARGET, cfg({ dataType: 'cmliussss-cdn-tencent' }), SITE_PROXY),
    ).toBe(TARGET.replace('movie.douban.com', 'movie.douban.cmliussss.net'))
    expect(
      buildDoubanDataRequestUrl(TARGET, cfg({ dataType: 'cmliussss-cdn-ali' }), SITE_PROXY),
    ).toBe(TARGET.replace('movie.douban.com', 'movie.douban.cmliussss.com'))
  })

  it('custom 用自定义前缀；未填时回退本站代理', () => {
    expect(
      buildDoubanDataRequestUrl(
        TARGET,
        cfg({ dataType: 'custom', dataUrl: 'https://p.example.com/?u=' }),
        SITE_PROXY,
      ),
    ).toBe(`https://p.example.com/?u=${encodeURIComponent(TARGET)}`)
    expect(buildDoubanDataRequestUrl(TARGET, cfg({ dataType: 'custom' }), SITE_PROXY)).toBe(
      `${SITE_PROXY}${encodeURIComponent(TARGET)}`,
    )
  })
})

describe('buildDoubanPosterUrl', () => {
  it('server（默认）经本站代理', () => {
    expect(buildDoubanPosterUrl(COVER, cfg({}), SITE_PROXY)).toBe(
      `${SITE_PROXY}${encodeURIComponent(COVER)}`,
    )
  })

  it('direct 返回原图地址', () => {
    expect(buildDoubanPosterUrl(COVER, cfg({ imageType: 'direct' }), SITE_PROXY)).toBe(COVER)
  })

  it('img3 与 cmliussss 镜像换域名', () => {
    expect(buildDoubanPosterUrl(COVER, cfg({ imageType: 'img3' }), SITE_PROXY)).toBe(
      COVER.replace('img1.doubanio.com', 'img3.doubanio.com'),
    )
    expect(
      buildDoubanPosterUrl(COVER, cfg({ imageType: 'cmliussss-cdn-tencent' }), SITE_PROXY),
    ).toBe(COVER.replace('img1.doubanio.com', 'img.doubanio.cmliussss.net'))
    expect(buildDoubanPosterUrl(COVER, cfg({ imageType: 'cmliussss-cdn-ali' }), SITE_PROXY)).toBe(
      COVER.replace('img1.doubanio.com', 'img.doubanio.cmliussss.com'),
    )
  })

  it('custom 用自定义前缀；未填时回退本站代理', () => {
    expect(
      buildDoubanPosterUrl(
        COVER,
        cfg({ imageType: 'custom', imageUrl: 'https://p.example.com/?u=' }),
        SITE_PROXY,
      ),
    ).toBe(`https://p.example.com/?u=${encodeURIComponent(COVER)}`)
    expect(buildDoubanPosterUrl(COVER, cfg({ imageType: 'custom' }), SITE_PROXY)).toBe(
      `${SITE_PROXY}${encodeURIComponent(COVER)}`,
    )
  })

  it('非豆瓣图与空值原样返回', () => {
    const other = 'https://cdn.example.com/poster.jpg'
    expect(buildDoubanPosterUrl(other, cfg({ imageType: 'direct' }), SITE_PROXY)).toBe(other)
    expect(buildDoubanPosterUrl('', cfg({}), SITE_PROXY)).toBe('')
  })
})
