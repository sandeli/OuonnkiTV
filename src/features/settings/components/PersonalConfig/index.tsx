import { ArchiveRestore, KeyRound, Settings2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { ConfirmModal } from '@/shared/components/common/ConfirmModal'
import ActionDropdown from '@/shared/components/common/ActionDropdown'
import { usePersonalConfig } from '@/shared/hooks/usePersonalConfig'
import { useAuthStore } from '@/shared/store/authStore'
import { AuthApiError, changePassword } from '@/shared/lib/authApi'
import { SettingsItem, SettingsPageShell, SettingsSection } from '../common'
import { TextConfigModal, URLConfigModal } from '../AboutProject/ImportConfigModal'

/** 修改密码表单（仅服务器账号模式的普通账号；站长密码在环境变量中，不走这里） */
function ChangePasswordForm() {
  const token = useAuthStore(state => state.token)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!token) return
    if (!currentPassword) {
      toast.error('请输入当前密码')
      return
    }
    if (newPassword.length < 6 || newPassword.length > 64) {
      toast.error('新密码需 6-64 位')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('两次输入的新密码不一致')
      return
    }
    if (newPassword === currentPassword) {
      toast.error('新密码不能与当前密码相同')
      return
    }
    setSaving(true)
    try {
      await changePassword(token, currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast.success('密码已修改，其他设备的登录已被踢下线')
    } catch (error) {
      toast.error(error instanceof AuthApiError ? error.message : '修改失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-muted/35 rounded-lg px-4 py-3">
      <div className="grid gap-2 sm:max-w-md">
        <Input
          type="password"
          placeholder="当前密码"
          autoComplete="current-password"
          value={currentPassword}
          onChange={e => setCurrentPassword(e.target.value)}
        />
        <Input
          type="password"
          placeholder="新密码（6-64 位）"
          autoComplete="new-password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
        />
        <Input
          type="password"
          placeholder="确认新密码"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
        />
      </div>
      <Button
        size="sm"
        className="mt-3 h-8 px-3"
        disabled={saving}
        onClick={() => void handleSubmit()}
      >
        <KeyRound className="size-4" />
        {saving ? '修改中…' : '修改密码'}
      </Button>
      <p className="text-muted-foreground mt-2 text-xs">
        修改成功后，其他设备上的登录会被踢下线，当前设备保持登录。
      </p>
    </div>
  )
}

export default function PersonalConfig() {
  const { exportConfig, exportConfigToText, importConfig, restoreDefault } = usePersonalConfig()
  const authMode = useAuthStore(state => state.authMode)
  const authUser = useAuthStore(state => state.user)
  const showPasswordSection = authMode === 'server' && !!authUser
  const isMasterUser = !!authUser?.isMaster
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [urlConfigModalOpen, setUrlConfigModalOpen] = useState(false)
  const [textConfigModalOpen, setTextConfigModalOpen] = useState(false)
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    importConfig(file)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <SettingsPageShell
      title="个人配置"
      description="导入、导出和恢复你的完整配置（设置 + 视频源）。"
      showHeader={false}
    >
      <SettingsSection
        title="配置管理"
        description="支持文件、URL、文本三种导入方式与两种导出方式。"
        icon={<Settings2 className="size-4" />}
        tone="amber"
        action={
          <ActionDropdown
            label="配置操作"
            buttonSize="sm"
            buttonClassName="h-8 px-3"
            items={[
              {
                label: '导出个人配置',
                type: 'sub',
                children: [
                  {
                    label: '导出为文件',
                    onClick: exportConfig,
                  },
                  {
                    label: '导出为文本',
                    onClick: exportConfigToText,
                  },
                ],
              },
              {
                label: '导入个人配置',
                type: 'sub',
                children: [
                  {
                    label: '从文件导入',
                    onClick: () => fileInputRef.current?.click(),
                  },
                  {
                    label: '从URL导入',
                    onClick: () => setUrlConfigModalOpen(true),
                  },
                  {
                    label: '从文本导入',
                    onClick: () => setTextConfigModalOpen(true),
                  },
                ],
              },
              {
                label: '恢复默认配置',
                className: 'text-red-600 focus:text-red-600 focus:bg-red-50',
                onClick: () => setConfirmRestoreOpen(true),
              },
            ]}
          />
        }
      >
        <SettingsItem
          title="配置快照"
          description="导出的配置包含系统设置、播放设置、搜索设置与全部视频源。"
          control={
            <Badge variant="outline" className="font-normal">
              支持 JSON
            </Badge>
          }
        />
        <SettingsItem
          title="恢复默认配置"
          description="重置所有设置并清空已添加视频源。"
          control={
            <Button
              variant="destructive"
              size="sm"
              className="h-8 px-3"
              onClick={() => setConfirmRestoreOpen(true)}
            >
              <ArchiveRestore className="size-4" />
              恢复默认
            </Button>
          }
        />
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".json"
          onChange={handleFileChange}
        />
      </SettingsSection>

      {showPasswordSection && (
        <SettingsSection
          title="账号安全"
          description="修改你的登录密码。"
          icon={<KeyRound className="size-4" />}
          tone="rose"
        >
          {isMasterUser ? (
            <SettingsItem
              title="站长密码"
              description="站长密码保存在部署环境变量 TGYS_ACCESS_PASSWORD 中，修改后需重新部署生效，无法在站内修改。"
              control={
                <Badge variant="outline" className="font-normal">
                  环境变量
                </Badge>
              }
            />
          ) : (
            <ChangePasswordForm />
          )}
        </SettingsSection>
      )}

      <URLConfigModal open={urlConfigModalOpen} onOpenChange={setUrlConfigModalOpen} />
      <TextConfigModal open={textConfigModalOpen} onOpenChange={setTextConfigModalOpen} />
      <ConfirmModal
        isOpen={confirmRestoreOpen}
        onClose={() => setConfirmRestoreOpen(false)}
        onConfirm={restoreDefault}
        title="确认恢复默认配置？"
        description="此操作将重置所有设置并清除所有已添加的视频源，恢复到初始默认状态。该操作无法撤销。"
        confirmText="确认恢复"
        isDestructive={true}
      />
    </SettingsPageShell>
  )
}
