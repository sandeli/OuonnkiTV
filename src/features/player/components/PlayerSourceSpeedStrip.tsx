import { RadioTower } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import type { PlayerSourceOption } from '@/features/player/hooks'

interface PlayerSourceSpeedStripProps {
  options: PlayerSourceOption[]
  latencies: Map<string, number>
  probedCodes: Set<string>
  selectedSourceCode: string
  onSourceChange: (sourceCode: string) => void
  isWorking: boolean
  className?: string
}

/**
 * 选集上方的换源条：候选源按播放线路测速（第一集首字节耗时）升序排列，
 * 测速结果到达后自动重排；无 CORS/超时测不出的源排最后并标注。
 */
export function PlayerSourceSpeedStrip({
  options,
  latencies,
  probedCodes,
  selectedSourceCode,
  onSourceChange,
  isWorking,
  className,
}: PlayerSourceSpeedStripProps) {
  if (options.length <= 1) return null

  return (
    <section
      className={cn(
        'space-y-2.5 rounded-lg border border-border/60 bg-card/55 p-3 md:p-4',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <RadioTower className="size-4" />
          换源
        </h2>
        <span className="text-muted-foreground text-xs">{isWorking ? '测速中…' : '按速度排序'}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {options.map(option => {
          const active = option.sourceCode === selectedSourceCode
          const latency = latencies.get(option.sourceCode)
          const probed = probedCodes.has(option.sourceCode)
          return (
            <Button
              key={option.sourceCode}
              size="sm"
              variant={active ? 'default' : 'secondary'}
              className="max-w-full min-w-0 justify-between rounded-full sm:w-auto sm:max-w-[260px]"
              aria-current={active ? 'true' : undefined}
              aria-label={`切换到视频源 ${option.sourceName}`}
              onClick={() => onSourceChange(option.sourceCode)}
            >
              <span className="truncate">{option.sourceName}</span>
              {latency !== undefined ? (
                <span className="shrink-0 rounded-full bg-sky-500/15 px-1.5 py-px text-[11px] text-sky-600 dark:text-sky-400">
                  {latency} ms
                </span>
              ) : probed ? (
                <span className="shrink-0 text-[11px] opacity-60">测不出</span>
              ) : (
                <span className="shrink-0 text-[11px] opacity-60">测速中</span>
              )}
            </Button>
          )
        })}
      </div>
    </section>
  )
}
