import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  ArrowLeft,
  Ban,
  ChevronDown,
  ChevronUp,
  LogOut,
  ShieldAlert,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Switch } from '@/shared/components/ui/switch'
import { Input } from '@/shared/components/ui/input'
import { Spinner } from '@/shared/components/ui/spinner'
import { ConfirmModal } from '@/shared/components/common/ConfirmModal'
import { useAuthStore } from '@/shared/store/authStore'
import { useVersionStore } from '@/shared/store/versionStore'
import {
  adminDeleteUser,
  adminGetSettings,
  adminGetUserDetail,
  adminKickUser,
  adminListUsers,
  adminSetUserDisabled,
  adminSetUserExpiry,
  adminUpdateSettings,
  type AdminUserDetail,
  type AdminUserRow,
} from '@/shared/lib/authApi'

const COUNTRY_NAMES: Record<string, string> = {
  CN: '中国',
  HK: '中国香港',
  TW: '中国台湾',
  MO: '中国澳门',
  US: '美国',
  JP: '日本',
  KR: '韩国',
  SG: '新加坡',
  GB: '英国',
  DE: '德国',
  FR: '法国',
  CA: '加拿大',
  AU: '澳大利亚',
  RU: '俄罗斯',
  IN: '印度',
  VN: '越南',
  TH: '泰国',
  MY: '马来西亚',
  ID: '印度尼西亚',
  PH: '菲律宾',
  NL: '荷兰',
  IT: '意大利',
  ES: '西班牙',
  BR: '巴西',
}

const REGION_NAMES: Record<string, string> = {
  Beijing: '北京',
  Tianjin: '天津',
  Shanghai: '上海',
  Chongqing: '重庆',
  Hebei: '河北',
  Shanxi: '山西',
  Liaoning: '辽宁',
  Jilin: '吉林',
  Heilongjiang: '黑龙江',
  Jiangsu: '江苏',
  Zhejiang: '浙江',
  Anhui: '安徽',
  Fujian: '福建',
  Jiangxi: '江西',
  Shandong: '山东',
  Henan: '河南',
  Hubei: '湖北',
  Hunan: '湖南',
  Guangdong: '广东',
  Hainan: '海南',
  Sichuan: '四川',
  Guizhou: '贵州',
  Yunnan: '云南',
  Shaanxi: '陕西',
  Gansu: '甘肃',
  Qinghai: '青海',
  'Inner Mongolia': '内蒙古',
  Guangxi: '广西',
  Tibet: '西藏',
  Ningxia: '宁夏',
  Xinjiang: '新疆',
  'Hong Kong': '香港',
  Macau: '澳门',
  Taiwan: '台湾',
}

/** 登录日志属地文本：国家 + 省份（相对准）+ 城市（运营商出口影响，仅参考）。老记录无数据时为空 */
function formatGeo(country: string | null, region: string | null, city: string | null): string {
  if (!country && !region && !city) return ''
  const countryName = country ? (COUNTRY_NAMES[country] ?? country) : ''
  const regionName = region ? (REGION_NAMES[region] ?? region) : ''
  return [countryName, regionName, city ?? ''].filter(Boolean).join(' ')
}

function formatTime(seconds: number | null): string {
  if (!seconds) return '从未'
  return new Date(seconds * 1000).toLocaleString('zh-CN', { hour12: false })
}

/** 有效期文案：无限制 / 剩余 N 天（到期日） / 已到期 */
function formatExpiry(expiresAt: number | null): { text: string; expired: boolean } {
  if (expiresAt === null) return { text: '无限制', expired: false }
  const now = Math.floor(Date.now() / 1000)
  if (expiresAt < now) return { text: `已到期（${formatTime(expiresAt)}）`, expired: true }
  const days = Math.ceil((expiresAt - now) / 86400)
  return { text: `剩余 ${days} 天（${formatTime(expiresAt)} 到期）`, expired: false }
}

function remainingDays(expiresAt: number | null): number {
  if (expiresAt === null) return 0
  const now = Math.floor(Date.now() / 1000)
  if (expiresAt < now) return 0
  return Math.ceil((expiresAt - now) / 86400)
}

function formatProgress(progress: number, duration: number): string {
  if (duration <= 0) return '已开始观看'
  const percent = Math.min(100, Math.round((progress / duration) * 100))
  return `看到 ${Math.floor(progress / 60)} 分钟 / 共 ${Math.floor(duration / 60)} 分钟（${percent}%）`
}

export default function AdminPage() {
  const navigate = useNavigate()
  const updateHistory = useVersionStore(state => state.updateHistory)
  const token = useAuthStore(state => state.token)
  const user = useAuthStore(state => state.user)
  const authMode = useAuthStore(state => state.authMode)

  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [registrationOpen, setRegistrationOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<AdminUserDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null)
  const [switchSaving, setSwitchSaving] = useState(false)
  const [expiryInput, setExpiryInput] = useState('')
  const [expirySaving, setExpirySaving] = useState(false)
  const [announcementEnabled, setAnnouncementEnabled] = useState(false)
  const [announcementContent, setAnnouncementContent] = useState('')
  const [announcementVersion, setAnnouncementVersion] = useState(0)
  const [announcementSaving, setAnnouncementSaving] = useState(false)

  const isAdmin = authMode === 'server' && !!token && user?.role === 'admin'

  const loadAll = useCallback(async () => {
    if (!token) return
    setIsLoading(true)
    try {
      const [list, settings] = await Promise.all([
        adminListUsers(token),
        adminGetSettings(token),
      ])
      setUsers(list)
      setRegistrationOpen(settings.registrationOpen)
      setAnnouncementEnabled(settings.announcement.enabled)
      setAnnouncementContent(settings.announcement.content)
      setAnnouncementVersion(settings.announcement.version)
    } catch {
      toast.error('加载管理员数据失败')
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (isAdmin) void loadAll()
    else setIsLoading(false)
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

  const handleToggleRegistration = async (open: boolean) => {
    if (!token) return
    setSwitchSaving(true)
    try {
      const result = await adminUpdateSettings(token, { registrationOpen: open })
      setRegistrationOpen(result.registrationOpen)
      toast.success(open ? '已开放注册' : '已关闭注册')
    } catch {
      toast.error('保存失败')
    } finally {
      setSwitchSaving(false)
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

  const handleToggleDetail = async (row: AdminUserRow) => {
    if (expandedId === row.id) {
      setExpandedId(null)
      setDetail(null)
      return
    }
    setExpandedId(row.id)
    setExpiryInput(String(remainingDays(row.expiresAt)))
    setDetail(null)
    if (!token) return
    setDetailLoading(true)
    try {
      setDetail(await adminGetUserDetail(token, row.id))
    } catch {
      toast.error('加载用户详情失败')
    } finally {
      setDetailLoading(false)
    }
  }

  const handleDisable = async (row: AdminUserRow) => {
    if (!token) return
    try {
      await adminSetUserDisabled(token, row.id, row.disabled !== 1)
      toast.success(row.disabled === 1 ? `已解禁 ${row.username}` : `已禁用 ${row.username}`)
      void loadAll()
    } catch {
      toast.error('操作失败')
    }
  }

  const handleSaveExpiry = async (row: AdminUserRow) => {
    if (!token) return
    const days = Number.parseInt(expiryInput, 10)
    if (Number.isNaN(days) || days < 0) {
      toast.error('天数需为 0 或正整数（0 = 无限制）')
      return
    }
    setExpirySaving(true)
    try {
      await adminSetUserExpiry(token, row.id, days)
      toast.success(
        days === 0
          ? `已将 ${row.username} 设为无限制`
          : `已设置 ${row.username} 的可用天数为 ${days} 天（从现在起算）`,
      )
      void loadAll()
      setDetail(await adminGetUserDetail(token, row.id))
    } catch {
      toast.error('设置失败')
    } finally {
      setExpirySaving(false)
    }
  }

  const handleKick = async (row: AdminUserRow) => {
    if (!token) return
    try {
      await adminKickUser(token, row.id)
      toast.success(`已将 ${row.username} 踢下线`)
    } catch {
      toast.error('操作失败')
    }
  }

  const handleDelete = async () => {
    if (!token || !deleteTarget) return
    try {
      await adminDeleteUser(token, deleteTarget.id)
      toast.success(`已删除账号 ${deleteTarget.username}`)
      setDeleteTarget(null)
      setExpandedId(null)
      setDetail(null)
      void loadAll()
    } catch {
      toast.error('删除失败')
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:py-10">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 h-8 px-2 text-xs md:h-9 md:px-3 md:text-sm"
        onClick={() => navigate('/')}
      >
        <ArrowLeft />
        返回
      </Button>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Users className="size-6" />
          <h1 className="text-xl font-bold md:text-2xl">管理员后台</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-muted-foreground text-sm">开放注册</span>
          <Switch
            checked={registrationOpen}
            disabled={switchSaving}
            onCheckedChange={checked => void handleToggleRegistration(checked)}
          />
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
              onCheckedChange={checked => setAnnouncementEnabled(checked)}
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

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : users.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center text-sm">
          还没有注册用户。开放注册后，用户在登录页即可自助注册。
        </p>
      ) : (
        <div className="space-y-3">
          {users.map(row => (
            <div key={row.id} className="border-border bg-card rounded-xl border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{row.username}</span>
                {row.role === 'admin' && <Badge variant="secondary">管理员</Badge>}
                {row.disabled === 1 && <Badge variant="destructive">已禁用</Badge>}
                <span className="text-muted-foreground ml-auto text-xs">
                  注册于 {formatTime(row.createdAt)}
                </span>
              </div>

              <p className="text-muted-foreground mt-2 text-sm">
                最近登录：{formatTime(row.lastLoginAt)} · 共登录 {row.loginCount} 次 · 观看{' '}
                {row.watchCount} 部 · 有效期：{formatExpiry(row.expiresAt).text}
                {row.lastWatchTitle
                  ? ` · 最近观看《${row.lastWatchTitle}》（${formatTime(row.lastWatchAt)}）`
                  : ''}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleToggleDetail(row)}
                >
                  {expandedId === row.id ? (
                    <>
                      <ChevronUp className="size-4" /> 收起明细
                    </>
                  ) : (
                    <>
                      <ChevronDown className="size-4" /> 登录与观看明细
                    </>
                  )}
                </Button>
                <Button size="sm" variant="outline" onClick={() => void handleDisable(row)}>
                  {row.disabled === 1 ? (
                    <>
                      <UserCheck className="size-4" /> 解禁
                    </>
                  ) : (
                    <>
                      <Ban className="size-4" /> 禁用
                    </>
                  )}
                </Button>
                <Button size="sm" variant="outline" onClick={() => void handleKick(row)}>
                  <LogOut className="size-4" /> 踢下线
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  onClick={() => setDeleteTarget(row)}
                >
                  <Trash2 className="size-4" /> 删除账号
                </Button>
              </div>

              {expandedId === row.id && (
                <div className="border-border mt-4 border-t pt-4">
                  {detailLoading || !detail ? (
                    <div className="flex justify-center py-6">
                      <Spinner />
                    </div>
                  ) : (
                    <>
                      <div className="mb-5 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">可用天数</span>
                        <span className="text-muted-foreground text-sm">
                          当前：
                          {formatExpiry(detail.user.expiresAt).text}
                          （从保存时刻起重新计算，填 0 为无限制）
                        </span>
                        <span className="ml-auto flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            className="h-8 w-24"
                            value={expiryInput}
                            onChange={e => setExpiryInput(e.target.value)}
                          />
                          <span className="text-muted-foreground text-sm">天</span>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={expirySaving}
                            onClick={() =>
                              void handleSaveExpiry(users.find(u => u.id === expandedId) ?? row)
                            }
                          >
                            保存
                          </Button>
                        </span>
                      </div>
                      <div className="grid gap-6 md:grid-cols-2">
                      <div>
                        <h3 className="mb-2 text-sm font-semibold">登录记录（最近 10 次）</h3>
                        {detail.loginLogs.length === 0 ? (
                          <p className="text-muted-foreground text-sm">暂无登录记录</p>
                        ) : (
                          <ul className="space-y-2">
                            {detail.loginLogs.map(log => (
                              <li key={log.id} className="text-sm">
                                <span>{formatTime(log.createdAt)}</span>
                                <span className="text-muted-foreground ml-2">{log.ip ?? ''}</span>
                                {formatGeo(log.country, log.region, log.city) && (
                                  <span className="text-muted-foreground ml-2">
                                    {formatGeo(log.country, log.region, log.city)}
                                  </span>
                                )}
                                <span className="text-muted-foreground block truncate text-xs">
                                  {log.userAgent ?? ''}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div>
                        <h3 className="mb-2 text-sm font-semibold">观看记录（最近 10 部）</h3>
                        {detail.watchRecords.length === 0 ? (
                          <p className="text-muted-foreground text-sm">暂无观看记录</p>
                        ) : (
                          <ul className="space-y-2">
                            {detail.watchRecords.map(record => (
                              <li key={record.id} className="text-sm">
                                <span className="font-medium">《{record.title}》</span>
                                <span className="text-muted-foreground ml-1">
                                  {record.episodeName ||
                                    (record.episodeIndex > 0
                                      ? `第 ${record.episodeIndex + 1} 集`
                                      : '')}
                                  {record.sourceName ? ` · ${record.sourceName}` : ''}
                                </span>
                                <span className="text-muted-foreground block text-xs">
                                  {formatProgress(record.progress, record.duration)} · 最后观看{' '}
                                  {formatTime(record.updatedAt)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title="删除账号"
        description={`确定删除账号「${deleteTarget?.username ?? ''}」吗？其登录记录与观看记录会一并删除，操作不可恢复。`}
        confirmText="删除"
        isDestructive
      />
    </div>
  )
}
