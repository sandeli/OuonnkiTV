import { Rss, Pencil, Eye, Clock } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { Switch } from '@/shared/components/ui/switch'
import { Button } from '@/shared/components/ui/button'
import { useApiStore } from '@/shared/store/apiStore'
import { useAuthStore } from '@/shared/store/authStore'
import { adminUpdateSettings } from '@/shared/lib/authApi'
import { getManagedSourceEnabled } from '@/shared/config/api.config'
import { toast } from 'sonner'
import {
  isSubscriptionSource,
  extractSubscriptionId,
  useSubscriptionStore,
} from '@/shared/store/subscriptionStore'
import dayjs from 'dayjs'
import type { VideoSource } from '@tgys/cms-core'
import HealthStatusIndicator from './HealthStatusIndicator'

interface VideoSourceCardProps {
  source: VideoSource
  onEdit: () => void
}

export default function VideoSourceCard({ source, onEdit }: VideoSourceCardProps) {
  const { setApiEnabled, setApiSiteWide } = useApiStore()
  const isSub = isSubscriptionSource(source.id)

  // 托管源（管理员统一提供）的开关显示以全站显式开关表为准（管理员可能在别的设备上改过）
  const managedIds = useApiStore(state => state.managedSourceIds)
  const siteOverrides = useAuthStore(state => state.authConfig?.managedSourceEnabled)
  const isManaged = managedIds.includes(source.id)
  const siteOverride =
    isManaged && siteOverrides && Object.prototype.hasOwnProperty.call(siteOverrides, source.id)
      ? siteOverrides[source.id]
      : undefined
  const effectiveEnabled = siteOverride ?? source.isEnabled

  // 「全站」快捷开关（仅站长、仅手动源）：基础托管源天生全站生效、订阅源不是手动源，都不显示。
  // 切换后账号同步会把标记存回账户，服务端随即重新派生全站分发列表，所有用户跟上。
  const authModeCard = useAuthStore(state => state.authMode)
  const authRoleCard = useAuthStore(state => state.user?.role)
  const canSiteWide = authModeCard === 'server' && authRoleCard === 'admin'
  const isBaseManaged = isManaged && !source.siteWide
  const showSiteWideToggle = canSiteWide && !isSub && !isBaseManaged
  const handleSiteWideToggle = (checked: boolean) => {
    setApiSiteWide(source.id, checked)
    toast.success(checked ? '已设为全站生效，所有用户都能用这个源' : '已改为自用，只在你的账户中启用')
  }

  const handleToggle = (checked: boolean) => {
    setApiEnabled(source.id, checked)
    // 站长在服务器账号模式下开关托管源：同步写入全站开关表，所有用户随即按此执行；
    // 自加源与订阅源只改本地，不走这里
    const { authMode, user, token } = useAuthStore.getState()
    if (isManaged && authMode === 'server' && user?.role === 'admin' && token) {
      const next = { ...getManagedSourceEnabled(), [source.id]: checked }
      void adminUpdateSettings(token, { managedSourceEnabled: next })
        .then(() => useAuthStore.getState().probeConfig())
        .catch(() => toast.error('全站开关同步失败，请稍后重试'))
    }
  }

  return (
    <div className="bg-muted/35 space-y-2.5 rounded-lg px-4 py-3">
      {/* 第一行：名称 + 测速(桌面端) + 操作区 */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {isSub && (
            <Rss className="size-3.5 shrink-0 text-violet-600 dark:text-violet-400" />
          )}
          <p className="truncate text-sm font-medium">{source.name}</p>
          <span className="hidden shrink-0 sm:inline-flex">
            <HealthStatusIndicator sourceId={source.id} />
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {showSiteWideToggle && (
            <span className="flex items-center gap-1" title="全站生效：开启后本站所有用户都能用这个源，关闭则只在你自己账户中启用">
              <span className="text-muted-foreground text-[11px]">全站</span>
              <Switch
                checked={source.siteWide === true}
                onCheckedChange={handleSiteWideToggle}
                onClick={e => e.stopPropagation()}
                className="scale-90"
              />
            </span>
          )}
          <Switch
            checked={effectiveEnabled}
            onCheckedChange={handleToggle}
            onClick={e => e.stopPropagation()}
          />
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onEdit}
          >
            {isSub ? <Eye className="size-3.5" /> : <Pencil className="size-3.5" />}
          </Button>
        </div>
      </div>
      {/* 第二行：Badge + 测速(移动端) + 附加信息 */}
      <SecondaryInfo source={source} isSub={isSub} isManaged={isManaged} />
    </div>
  )
}

type SourceBadgeKind = 'sub' | 'sitewide' | 'managed' | 'manual'

function SecondaryInfo({
  source,
  isSub,
  isManaged,
}: {
  source: VideoSource
  isSub: boolean
  isManaged: boolean
}) {
  // 来源标签：订阅源 / 全站源（站长手动添加并开启全站生效）/ 后台源（管理员后台或环境变量统一设置）/ 手动源（自己手动添加）
  const badgeKind: SourceBadgeKind = isSub
    ? 'sub'
    : source.siteWide
      ? 'sitewide'
      : isManaged
        ? 'managed'
        : 'manual'
  const subscriptionId = isSub ? extractSubscriptionId(source.id) : null
  const subscription = useSubscriptionStore(state =>
    subscriptionId ? state.subscriptions.find(s => s.id === subscriptionId) : undefined,
  )

  return (
    <div className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
      {badgeKind === 'sub' ? (
        <Badge
          variant="outline"
          className="border-violet-500/30 text-violet-600 dark:text-violet-400 h-5 text-[10px]"
        >
          订阅源
        </Badge>
      ) : badgeKind === 'sitewide' ? (
        <Badge
          variant="outline"
          className="h-5 border-emerald-500/40 text-[10px] text-emerald-600 dark:text-emerald-400"
        >
          全站源
        </Badge>
      ) : badgeKind === 'managed' ? (
        <Badge
          variant="outline"
          className="h-5 border-amber-500/40 text-[10px] text-amber-600 dark:text-amber-400"
        >
          后台源
        </Badge>
      ) : (
        <Badge
          variant="outline"
          className="border-sky-500/30 text-sky-600 h-5 text-[10px] dark:border-emerald-700/40 dark:text-emerald-300"
        >
          手动源
        </Badge>
      )}
      {/* 移动端测速结果显示在 Badge 右侧 */}
      <span className="shrink-0 sm:hidden">
        <HealthStatusIndicator sourceId={source.id} />
      </span>
      {isSub && subscription && (
        <span className="truncate">来自「{subscription.name}」</span>
      )}
      {!isSub && source.updatedAt && (
        <span className="flex items-center gap-1">
          <Clock className="size-3" />
          {dayjs(source.updatedAt).format('MM-DD HH:mm')}
        </span>
      )}
    </div>
  )
}
