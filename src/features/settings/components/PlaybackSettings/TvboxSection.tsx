import { useEffect, useState } from 'react'
import { Copy, RefreshCw, Tv } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import { ConfirmModal } from '@/shared/components/common/ConfirmModal'
import { fetchTvboxInfo, resetTvboxToken, type TvboxInfo } from '@/shared/lib/authApi'
import { useAuthStore } from '@/shared/store/authStore'
import { SettingsItem, SettingsSection } from '../common'

/**
 * TVBox 接口区（播放设置页内）：展示当前用户的专属配置地址，
 * 填到电视上的影视 / OK影视等 APP 即可用本站的源看片（聚合站自动选最快源）。
 * 仅账号模式可用；旧单密码模式下自动隐藏。
 */
export function TvboxSection() {
  const authMode = useAuthStore(state => state.authMode)
  const token = useAuthStore(state => state.token)
  const [info, setInfo] = useState<TvboxInfo | null>(null)
  const [hidden, setHidden] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    if (authMode !== 'server' || !token) return
    let cancelled = false
    fetchTvboxInfo(token)
      .then(data => {
        if (!cancelled) setInfo(data)
      })
      .catch(() => {
        if (!cancelled) setHidden(true)
      })
    return () => {
      cancelled = true
    }
  }, [authMode, token])

  if (authMode !== 'server' || !token || hidden) return null

  const handleCopy = async () => {
    if (!info) return
    try {
      await navigator.clipboard.writeText(info.configUrl)
      toast.success('接口地址已复制')
    } catch {
      toast.error('复制失败，请手动选中地址复制')
    }
  }

  const handleReset = async () => {
    if (!token) return
    setResetting(true)
    try {
      const data = await resetTvboxToken(token)
      setInfo(data)
      setResetOpen(false)
      toast.success('已重置，旧地址立即失效')
    } catch {
      toast.error('重置失败，请稍后重试')
    } finally {
      setResetting(false)
    }
  }

  return (
    <SettingsSection
      title="TVBox 接口"
      description="把你的专属地址填进电视上的影视、OK影视等 APP 的订阅/配置地址，即可在电视上用本站的源看片。第一个站是聚合站，会自动选最快的源播放。"
      icon={<Tv className="size-4" />}
      tone="cyan"
    >
      <SettingsItem
        title="我的接口地址"
        description="地址里包含你的专属令牌，不要分享给别人；账号被禁用、到期或站点关站维护时会自动失效。"
        control={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => void handleCopy()} disabled={!info}>
              <Copy className="size-3.5" />
              复制
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setResetOpen(true)}
              disabled={!info || resetting}
            >
              <RefreshCw className="size-3.5" />
              重置
            </Button>
          </div>
        }
      >
        <p className="bg-muted/60 mt-1 rounded-md px-3 py-2 font-mono text-xs break-all select-all">
          {info ? info.configUrl : '正在生成…'}
        </p>
      </SettingsItem>

      <ConfirmModal
        isOpen={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={() => void handleReset()}
        title="重置 TVBox 令牌？"
        description="重置后旧的接口地址立即失效，电视上需要重新填写新地址。确定重置吗？"
        confirmText="重置"
        isDestructive
      />
    </SettingsSection>
  )
}
