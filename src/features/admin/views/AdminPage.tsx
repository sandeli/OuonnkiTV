import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Switch } from '@/shared/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { getPublicEnv } from '@/shared/config/runtimeEnv'
import { useAuthStore } from '@/shared/store/authStore'
import { useVersionStore } from '@/shared/store/versionStore'
import {
  adminCreateInvite,
  adminDeleteInvite,
  adminGetSettings,
  adminListInvites,
  adminTestTgNotify,
  adminUpdateSettings,
  type InviteCodeRow,
  type RegistrationMode,
} from '@/shared/lib/authApi'

export default function AdminPage() {
  const navigate = useNavigate()
  const updateHistory = useVersionStore(state => state.updateHistory)
  const token = useAuthStore(state => state.token)
  const user = useAuthStore(state => state.user)
  const authMode = useAuthStore(state => state.authMode)

  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>('open')
  const [modeSaving, setModeSaving] = useState(false)
  const [invites, setInvites] = useState<InviteCodeRow[]>([])
  const [inviteNote, setInviteNote] = useState('')
  const [inviteMaxUses, setInviteMaxUses] = useState('1')
  const [inviteDays, setInviteDays] = useState('7')
  const [inviteCreating, setInviteCreating] = useState(false)
  const [tgBotToken, setTgBotToken] = useState('')
  const [tgChatId, setTgChatId] = useState('')
  const [tgSaving, setTgSaving] = useState(false)
  const [tgTesting, setTgTesting] = useState(false)
  const [announcementEnabled, setAnnouncementEnabled] = useState(false)
  const [announcementContent, setAnnouncementContent] = useState('')
  const [announcementVersion, setAnnouncementVersion] = useState(0)
  const [announcementSaving, setAnnouncementSaving] = useState(false)
  const [announcementBar, setAnnouncementBar] = useState('')
  const [announcementBarSaving, setAnnouncementBarSaving] = useState(false)
  const [doubanDataType, setDoubanDataType] = useState('direct')
  const [doubanDataUrl, setDoubanDataUrl] = useState('')
  const [doubanImageType, setDoubanImageType] = useState('server')
  const [doubanImageUrl, setDoubanImageUrl] = useState('')
  const [doubanProxySaving, setDoubanProxySaving] = useState(false)
  const [videoSources, setVideoSources] = useState('')
  const [videoSourcesSaving, setVideoSourcesSaving] = useState(false)

  const isAdmin = authMode === 'server' && !!token && user?.role === 'admin'

  const loadAll = useCallback(async () => {
    if (!token) return
    try {
      const settings = await adminGetSettings(token)
      setRegistrationMode(settings.registrationMode)
      setTgBotToken(settings.tgBotToken)
      setTgChatId(settings.tgChatId)
      try {
        setInvites(await adminListInvites(token))
      } catch {
        // 邀请码列表加载失败不阻塞其他设置
      }
      setAnnouncementEnabled(settings.announcement.enabled)
      setAnnouncementContent(settings.announcement.content)
      setAnnouncementVersion(settings.announcement.version)
      setAnnouncementBar(settings.announcementBar)
      setDoubanDataType(settings.doubanProxy.dataType)
      setDoubanDataUrl(settings.doubanProxy.dataUrl)
      setDoubanImageType(settings.doubanProxy.imageType)
      setDoubanImageUrl(settings.doubanProxy.imageUrl)
      setVideoSources(settings.videoSources)
    } catch {
      toast.error('加载管理员数据失败')
    }
  }, [token])

  useEffect(() => {
    if (isAdmin) void loadAll()
  }, [isAdmin, loadAll])

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-24 text-center">
        <ShieldAlert className="text-muted-foreground size-10" />
        <p className="text-lg font-semibold">无管理员权限</p>
        <p className="text-muted-foreground max-w-sm text-sm">
          管理员后台仅对站长开放（使用站长登录进入，或由站长将账号设为管理员）。
        </p>
      </div>
    )
  }

  const handleChangeRegistrationMode = async (mode: RegistrationMode) => {
    if (!token) return
    setModeSaving(true)
    try {
      const result = await adminUpdateSettings(token, { registrationMode: mode })
      setRegistrationMode(result.registrationMode)
      void useAuthStore.getState().probeConfig()
      toast.success(
        mode === 'open'
          ? '已切换为开放注册'
          : mode === 'invite'
            ? '已切换为仅邀请码注册'
            : '已关闭注册',
      )
    } catch {
      toast.error('保存失败')
    } finally {
      setModeSaving(false)
    }
  }

  const handleCreateInvite = async () => {
    if (!token) return
    const maxUses = Number.parseInt(inviteMaxUses, 10)
    const days = Number.parseInt(inviteDays, 10)
    if (Number.isNaN(maxUses) || maxUses < 1) {
      toast.error('可用次数需为正整数')
      return
    }
    if (Number.isNaN(days) || days < 0) {
      toast.error('有效天数需为 0 或正整数（0 = 永不过期）')
      return
    }
    setInviteCreating(true)
    try {
      const result = await adminCreateInvite(token, {
        note: inviteNote.trim(),
        maxUses,
        expiresDays: days,
      })
      setInvites(prev => [result.invite, ...prev])
      setInviteNote('')
      toast.success(`邀请码已生成：${result.invite.code}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '生成失败')
    } finally {
      setInviteCreating(false)
    }
  }

  const handleDeleteInvite = async (invite: InviteCodeRow) => {
    if (!token) return
    try {
      await adminDeleteInvite(token, invite.id)
      setInvites(prev => prev.filter(x => x.id !== invite.id))
      toast.success(`邀请码 ${invite.code} 已删除`)
    } catch {
      toast.error('删除失败')
    }
  }

  const handleSaveTgNotify = async () => {
    if (!token) return
    setTgSaving(true)
    try {
      const result = await adminUpdateSettings(token, {
        tgBotToken: tgBotToken.trim(),
        tgChatId: tgChatId.trim(),
      })
      setTgBotToken(result.tgBotToken)
      setTgChatId(result.tgChatId)
      toast.success(
        result.tgBotToken && result.tgChatId
          ? '电报通知配置已保存'
          : '电报通知已清空（功能停用）',
      )
    } catch {
      toast.error('保存失败')
    } finally {
      setTgSaving(false)
    }
  }

  const handleTestTgNotify = async () => {
    if (!token) return
    setTgTesting(true)
    try {
      await adminTestTgNotify(token, tgBotToken.trim(), tgChatId.trim())
      toast.success('测试消息已发送，请去 Telegram 查看')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '发送失败')
    } finally {
      setTgTesting(false)
    }
  }

  const handleSaveAnnouncement = async () => {
    if (!token) return
    setAnnouncementSaving(true)
    try {
      const result = await adminUpdateSettings(token, {
        announcementEnabled,
        announcementContent,
      })
      setAnnouncementEnabled(result.announcement.enabled)
      setAnnouncementContent(result.announcement.content)
      const versionChanged = result.announcement.version !== announcementVersion
      setAnnouncementVersion(result.announcement.version)
      toast.success(versionChanged ? '公告已保存，新内容将对所有人重新弹出一次' : '公告设置已保存')
    } catch {
      toast.error('保存公告失败')
    } finally {
      setAnnouncementSaving(false)
    }
  }

  const handleSaveAnnouncementBar = async () => {
    if (!token) return
    setAnnouncementBarSaving(true)
    try {
      const result = await adminUpdateSettings(token, { announcementBarContent: announcementBar })
      setAnnouncementBar(result.announcementBar)
      // 刷新本页缓存的公开配置，管理员自己切到首页即可看到新滚动公告
      void useAuthStore.getState().probeConfig()
      toast.success(announcementBar.trim() ? '滚动公告已保存' : '滚动公告已清空')
    } catch {
      toast.error('保存滚动公告失败')
    } finally {
      setAnnouncementBarSaving(false)
    }
  }

  const handleSaveDoubanProxy = async () => {
    if (!token) return
    setDoubanProxySaving(true)
    try {
      const result = await adminUpdateSettings(token, {
        doubanDataProxyType: doubanDataType,
        doubanDataProxyUrl: doubanDataUrl,
        doubanImageProxyType: doubanImageType,
        doubanImageProxyUrl: doubanImageUrl,
      })
      setDoubanDataType(result.doubanProxy.dataType)
      setDoubanDataUrl(result.doubanProxy.dataUrl)
      setDoubanImageType(result.doubanProxy.imageType)
      setDoubanImageUrl(result.doubanProxy.imageUrl)
      // 刷新本页缓存的公开配置，管理员切到首页即可看到新代理效果
      void useAuthStore.getState().probeConfig()
      toast.success('豆瓣代理已保存')
    } catch {
      toast.error('保存豆瓣代理失败')
    } finally {
      setDoubanProxySaving(false)
    }
  }

  const handleSaveVideoSources = async () => {
    if (!token) return
    setVideoSourcesSaving(true)
    try {
      const result = await adminUpdateSettings(token, { videoSources })
      setVideoSources(result.videoSources)
      // 刷新公开配置：本机指纹随之变化，会按新源重新导入
      void useAuthStore.getState().probeConfig()
      toast.success(
        result.videoSources.trim()
          ? '视频源已保存，将优先于环境变量生效'
          : '已清空视频源设置，恢复使用环境变量',
      )
    } catch {
      toast.error('保存视频源失败')
    } finally {
      setVideoSourcesSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* 注册设置：开放 / 仅邀请码 / 关闭 三档 */}
      <div className="border-border bg-card mb-6 flex flex-wrap items-center gap-2 rounded-xl border p-4">
        <span className="font-semibold">注册设置</span>
        <span className="text-muted-foreground text-xs">
          开放：访客可自助注册；仅邀请码：注册时必须填有效邀请码；关闭：仅已有账号与站长可登录
        </span>
        <div className="ml-auto shrink-0">
          <Select
            value={registrationMode}
            disabled={modeSaving}
            onValueChange={value => void handleChangeRegistrationMode(value as RegistrationMode)}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">开放注册</SelectItem>
              <SelectItem value="invite">仅邀请码</SelectItem>
              <SelectItem value="closed">关闭注册</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 邀请码管理 */}
      <div className="border-border bg-card mb-6 rounded-xl border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">邀请码</span>
          <span className="text-muted-foreground text-xs">
            「仅邀请码」模式下，访客凭码注册；一码可设可用次数与有效期，用完或过期自动失效
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input
            className="w-40"
            placeholder="备注（如：给小王）"
            maxLength={100}
            value={inviteNote}
            onChange={e => setInviteNote(e.target.value)}
          />
          <span className="text-muted-foreground flex items-center gap-1 text-sm">
            可用
            <Input
              type="number"
              min={1}
              className="w-20"
              value={inviteMaxUses}
              onChange={e => setInviteMaxUses(e.target.value)}
            />
            次
          </span>
          <span className="text-muted-foreground flex items-center gap-1 text-sm">
            有效
            <Input
              type="number"
              min={0}
              className="w-20"
              value={inviteDays}
              onChange={e => setInviteDays(e.target.value)}
            />
            天（0 = 不限）
          </span>
          <Button size="sm" disabled={inviteCreating} onClick={() => void handleCreateInvite()}>
            {inviteCreating ? '生成中…' : '生成邀请码'}
          </Button>
        </div>
        {invites.length > 0 && (
          <ul className="mt-3 space-y-2">
            {invites.map(invite => {
              const expired = invite.expiresAt !== null && invite.expiresAt * 1000 < Date.now()
              const exhausted = invite.usedCount >= invite.maxUses
              return (
                <li key={invite.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <code className="bg-muted rounded px-2 py-0.5 font-mono font-semibold tracking-wider">
                    {invite.code}
                  </code>
                  {invite.note && <span className="text-muted-foreground">{invite.note}</span>}
                  <span className="text-muted-foreground">
                    已用 {invite.usedCount}/{invite.maxUses} 次
                  </span>
                  <span className="text-muted-foreground">
                    {invite.expiresAt
                      ? `${new Date(invite.expiresAt * 1000).toLocaleDateString('zh-CN')} 到期`
                      : '永不过期'}
                  </span>
                  {expired ? (
                    <Badge variant="destructive">已过期</Badge>
                  ) : exhausted ? (
                    <Badge variant="secondary">已用完</Badge>
                  ) : (
                    <Badge>可用</Badge>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive ml-auto"
                    onClick={() => void handleDeleteInvite(invite)}
                  >
                    删除
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* 电报上线通知配置 */}
      <div className="border-border bg-card mb-6 rounded-xl border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">电报上线通知</span>
          <span className="text-muted-foreground text-xs">
            在用户管理里给某个用户打开「电报通知」后，他每次登录都会给下面的 Chat 发一条上线消息（只报上线，不报下线）
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input
            className="w-72"
            placeholder="Bot Token（如 123456:ABC-...）"
            value={tgBotToken}
            onChange={e => setTgBotToken(e.target.value)}
            autoComplete="off"
          />
          <Input
            className="w-44"
            placeholder="Chat ID（如 373849886）"
            value={tgChatId}
            onChange={e => setTgChatId(e.target.value)}
            autoComplete="off"
          />
          <Button size="sm" disabled={tgSaving} onClick={() => void handleSaveTgNotify()}>
            {tgSaving ? '保存中…' : '保存'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={tgTesting}
            onClick={() => void handleTestTgNotify()}
          >
            {tgTesting ? '发送中…' : '发送测试消息'}
          </Button>
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          机器人找 @BotFather 创建；Chat ID 是接收消息的账号或群的数字 ID（可先给机器人发一句话，再开 https://api.telegram.org/bot&lt;Token&gt;/getUpdates 查看）。清空两项并保存即停用。
        </p>
      </div>

      {/* 首页滚动公告设置 */}
      <div className="border-border bg-card mb-6 rounded-xl border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">首页滚动公告</span>
          <span className="text-muted-foreground text-xs">
            显示在首页顶部的滚动字幕，保存后立即生效；留空则不显示（若设过环境变量 TGYS_ANNOUNCEMENT
            会回退显示它）
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Input
            placeholder="输入滚动公告内容"
            maxLength={500}
            value={announcementBar}
            onChange={e => setAnnouncementBar(e.target.value)}
          />
          <Button
            size="sm"
            className="shrink-0"
            disabled={announcementBarSaving}
            onClick={() => void handleSaveAnnouncementBar()}
          >
            {announcementBarSaving ? '保存中…' : '保存'}
          </Button>
        </div>
      </div>

      {/* 首页弹窗公告设置 */}
      <div className="border-border bg-card mb-6 rounded-xl border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">首页弹窗公告</span>
          <span className="text-muted-foreground text-xs">
            用户打开首页时弹出；看过后同一版本不再重复弹，修改内容保存后所有人会重新看到一次
          </span>
          <span className="ml-auto flex items-center gap-2">
            <span className="text-muted-foreground text-sm">启用</span>
            <Switch
              checked={announcementEnabled}
              disabled={announcementSaving}
              onCheckedChange={checked => {
                setAnnouncementEnabled(checked)
                if (!token) return
                setAnnouncementSaving(true)
                adminUpdateSettings(token, { announcementEnabled: checked })
                  .then(() => toast.success(checked ? '弹窗公告已启用' : '弹窗公告已关闭'))
                  .catch(() => {
                    toast.error('保存失败')
                    setAnnouncementEnabled(!checked)
                  })
                  .finally(() => setAnnouncementSaving(false))
              }}
            />
          </span>
        </div>
        <textarea
          className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring mt-3 min-h-24 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-1 focus-visible:outline-none"
          placeholder="输入公告内容，支持多行文本"
          maxLength={2000}
          value={announcementContent}
          onChange={e => setAnnouncementContent(e.target.value)}
        />
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" disabled={announcementSaving} onClick={() => void handleSaveAnnouncement()}>
            {announcementSaving ? '保存中…' : '保存公告'}
          </Button>
          <span className="text-muted-foreground text-xs">当前版本 v{announcementVersion}</span>
        </div>
      </div>

      {/* 豆瓣代理设置 */}
      <div className="border-border bg-card mb-6 rounded-xl border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">豆瓣代理</span>
          <span className="text-muted-foreground text-xs">
            首页豆瓣墙的数据与海报加载方式，保存后作为全站默认生效；每位用户也可在「设置中心 →
            系统设置」里为自己单独指定。海报崩图或数据加载慢时可切换 CDN 镜像
          </span>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-sm">数据代理</p>
            <Select value={doubanDataType} onValueChange={setDoubanDataType}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="direct">直连（服务器直接请求豆瓣）</SelectItem>
                <SelectItem value="cors-proxy-zwei">Cors Proxy By Zwei</SelectItem>
                <SelectItem value="cmliussss-cdn-tencent">豆瓣 CDN By CMLiussss（腾讯云）</SelectItem>
                <SelectItem value="cmliussss-cdn-ali">豆瓣 CDN By CMLiussss（阿里云）</SelectItem>
                <SelectItem value="custom">自定义代理</SelectItem>
              </SelectContent>
            </Select>
            {doubanDataType === 'custom' && (
              <Input
                placeholder="自定义代理前缀，如 https://proxy.example.com/?url="
                value={doubanDataUrl}
                onChange={e => setDoubanDataUrl(e.target.value)}
              />
            )}
          </div>
          <div className="space-y-1.5">
            <p className="text-sm">图片代理</p>
            <Select value={doubanImageType} onValueChange={setDoubanImageType}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="server">本站代理（服务器转发图片）</SelectItem>
                <SelectItem value="direct">直连（浏览器直接加载豆瓣图）</SelectItem>
                <SelectItem value="img3">豆瓣 img3 节点</SelectItem>
                <SelectItem value="cmliussss-cdn-tencent">豆瓣 CDN By CMLiussss（腾讯云）</SelectItem>
                <SelectItem value="cmliussss-cdn-ali">豆瓣 CDN By CMLiussss（阿里云）</SelectItem>
                <SelectItem value="custom">自定义代理</SelectItem>
              </SelectContent>
            </Select>
            {doubanImageType === 'custom' && (
              <Input
                placeholder="自定义代理前缀，如 https://proxy.example.com/?url="
                value={doubanImageUrl}
                onChange={e => setDoubanImageUrl(e.target.value)}
              />
            )}
          </div>
        </div>
        <div className="mt-3">
          <Button size="sm" disabled={doubanProxySaving} onClick={() => void handleSaveDoubanProxy()}>
            {doubanProxySaving ? '保存中…' : '保存'}
          </Button>
        </div>
      </div>

      {/* 视频源设置（优先级高于 TGYS_INITIAL_VIDEO_SOURCES 环境变量） */}
      <div className="border-border bg-card mb-6 rounded-xl border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">视频源</span>
          <span className="text-muted-foreground text-xs">
            与环境变量 TGYS_INITIAL_VIDEO_SOURCES 同格式：可填远程 JSON 地址（如 KVideo 的
            lite.json 链接）或直接粘贴内联 JSON；本项非空时优先于环境变量生效，保存后所有用户下次打开站点自动重新导入
          </span>
        </div>
        <Textarea
          className="mt-3 min-h-28 font-mono text-xs"
          placeholder="留空 = 使用环境变量 TGYS_INITIAL_VIDEO_SOURCES"
          value={videoSources}
          onChange={e => setVideoSources(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={videoSourcesSaving} onClick={() => void handleSaveVideoSources()}>
            {videoSourcesSaving ? '保存中…' : '保存'}
          </Button>
          <span className="text-muted-foreground text-xs">
            {getPublicEnv('TGYS_INITIAL_VIDEO_SOURCES')?.trim()
              ? '环境变量当前已设置（本框留空时使用它）'
              : '环境变量当前未设置'}
          </span>
        </div>
      </div>

      <div className="border-border bg-card mb-6 flex flex-wrap items-center gap-2 rounded-xl border p-4">
        <span className="font-semibold">用户管理</span>
        <span className="text-muted-foreground text-xs">
          注册用户列表与登录、观看明细已拆分为独立页面
        </span>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto shrink-0"
          onClick={() => navigate('/settings/users')}
        >
          前往用户管理
        </Button>
      </div>

      {/* 更新日志（与站内版本记录同一份数据，每次更新同步维护） */}
      <div className="mt-10">
        <h2 className="mb-4 text-lg font-bold">更新日志</h2>
        <div className="space-y-3">
          {updateHistory.map(entry => (
            <div key={entry.version} className="border-border bg-card rounded-xl border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">v{entry.version}</Badge>
                <span className="font-semibold">{entry.title}</span>
                <span className="text-muted-foreground ml-auto text-xs">{entry.date}</span>
              </div>
              {entry.features.length > 0 && (
                <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5 text-sm">
                  {entry.features.map(feature => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              )}
              {entry.fixes && entry.fixes.length > 0 && (
                <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5 text-sm">
                  {entry.fixes.map(fix => (
                    <li key={fix}>修复：{fix}</li>
                  ))}
                </ul>
              )}
              {entry.breaking && entry.breaking.length > 0 && (
                <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5 text-sm">
                  {entry.breaking.map(item => (
                    <li key={item}>注意：{item}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
