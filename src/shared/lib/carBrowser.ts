/**
 * 车机浏览器识别（供「车机自动免登录」使用）。
 *
 * 只认 UA 里的稳定标记，不看车型、不看浏览器版本：特斯拉现代车机（MCU2/MCU3）的 UA
 * 末尾带 `Tesla/<固件分支>`（如 Tesla/feature-2022.20.9-31-abc、Tesla/develop-*、FSD 测试版），
 * 这个标记多年未变，而 Chrome 版本号与固件后缀会一直变。识别不到时按普通浏览器处理
 * （退回正常登录页），不会把用户锁在外面。
 *
 * 注意：UA 可以伪造，这个识别只图方便、不是安全防线——设置/后台等接口仍由服务端会话校验把守。
 * 新增车机品牌时往名单里加标记即可（加之前先核实该品牌真实 UA）。
 */
export const CAR_BROWSER_UA_MARKERS: readonly string[] = ['Tesla/']

/** 纯函数：判断给定 UA 是否为车机浏览器 */
export function isCarBrowserUA(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  return CAR_BROWSER_UA_MARKERS.some(marker => userAgent.includes(marker))
}

/** 读取当前浏览器的 UA 并判断是否为车机 */
export function detectCarBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return isCarBrowserUA(navigator.userAgent)
}
