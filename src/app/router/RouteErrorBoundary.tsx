import { useEffect } from 'react'
import { useRouteError } from 'react-router'
import { Button } from '@/shared/components/ui/button'
import { TgysLogo } from '@/shared/components/icons'

const RELOAD_GUARD_KEY = 'tgys-chunk-reload-at'
const RELOAD_GUARD_WINDOW_MS = 15_000

/** 懒加载分块拉取失败（多为站点刚发布新版本、旧页面引用的分块文件已被替换） */
function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { name?: unknown; message?: unknown }
  if (e.name === 'ChunkLoadError') return true
  const message = typeof e.message === 'string' ? e.message : ''
  return /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/i.test(
    message,
  )
}

/**
 * 路由错误边界：
 * - 分块加载失败（发新版后旧标签页最常见）→ 自动整页刷新一次拉取新版本，15 秒内不重复自动刷防死循环；
 * - 其他错误 → 友好的错误页（刷新 / 回首页），不再显示 React Router 的原始报错页。
 */
export default function RouteErrorBoundary() {
  const error = useRouteError()
  const chunkError = isChunkLoadError(error)

  useEffect(() => {
    if (!chunkError) return
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0)
    if (Date.now() - last > RELOAD_GUARD_WINDOW_MS) {
      sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()))
      window.location.reload()
    }
  }, [chunkError])

  const message =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message: unknown }).message)
      : ''

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-3 text-center">
        <TgysLogo size={64} />
        <h1 className="text-lg font-bold">
          {chunkError ? '站点刚更新，正在为你切换到新版本…' : '页面出错了'}
        </h1>
        <p className="text-muted-foreground text-sm">
          {chunkError
            ? '如果没有自动刷新，请点下面的按钮手动刷新一次。'
            : '刷新页面通常就能恢复；如果反复出现，请把下面的错误信息发给站长。'}
        </p>
        {!chunkError && message && (
          <p className="bg-muted/50 w-full rounded-md px-3 py-2 text-left text-xs break-all">
            {message}
          </p>
        )}
        <div className="mt-2 flex gap-2">
          <Button onClick={() => window.location.reload()}>刷新页面</Button>
          <Button variant="outline" onClick={() => window.location.assign('/')}>
            返回首页
          </Button>
        </div>
      </div>
    </div>
  )
}
