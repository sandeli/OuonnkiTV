/**
 * TMDB 图片代理的源站地址构建（纯函数）：
 * 只允许 <尺寸段>/<文件名> 两段式路径，尺寸段限 w<数字>/h<数字>/original，
 * 文件名限字母数字与 ._- ——白名单校验防止代理端点被拿去转发任意地址。
 */
const TMDB_IMAGE_ORIGIN = 'https://image.tmdb.org/t/p/'
const SIZE_PATTERN = /^(?:w\d+|h\d+|original)$/
const FILE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

export function buildTmdbImageOriginUrl(segments: string[]): string | null {
  if (segments.length !== 2) return null
  const [size, file] = segments
  if (!SIZE_PATTERN.test(size)) return null
  // 文件名不许是点段（防路径穿越），也不许带百分号编码（防双重编码绕过）
  if (file === '.' || file === '..' || file.includes('%')) return null
  if (!FILE_PATTERN.test(file)) return null
  return `${TMDB_IMAGE_ORIGIN}${size}/${file}`
}
