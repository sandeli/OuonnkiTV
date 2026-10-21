import { useCallback, useEffect, useState } from 'react'
import { Ban, ChevronDown, ChevronUp, LogOut, Trash2, UserCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Spinner } from '@/shared/components/ui/spinner'
import { ConfirmModal } from '@/shared/components/common/ConfirmModal'
import { useAuthStore } from '@/shared/store/authStore'
import {
  adminDeleteUser,
  adminGetUserDetail,
  adminKickUser,
  adminListUsers,
  adminSetUserDisabled,
  adminSetUserExpiry,
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

/**
 * 用户管理（设置中心独立页，仅服务器模式管理员可见）：
 * 注册用户列表 + 登录/观看明细 + 可用天数、禁用、踢下线、删除。
 * 数据接口本身在服务端有管理员校验，这里再做一层可见性拦截。
 */
export default function UserManagementSettings() {
  const token = useAuthStore(state => state.token)
  const user = useAuthStore(state => state.user)
  const authMode = useAuthStore(state => state.authMode)
  const isAdmin = authMode === 'server' && !!token && user?.role === 'admin'

  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<AdminUserDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null)
  const [expiryInput, setExpiryInput] = useState('')
  const [expirySaving, setExpirySaving] = useState(false)

  const loadUsers = useCallback(async () => {
    if (!token) return
    setIsLoading(true)
    try {
      setUsers(await adminListUsers(token))
    } catch {
      toast.error('加载用户列表失败')
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (isAdmin) void loadUsers()
    else setIsLoading(false)
  }, [isAdmin, loadUsers])

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
      void loadUsers()
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
      void loadUsers()
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
      void loadUsers()
    } catch {
      toast.error('删除失败')
    }
  }

  if (!isAdmin) {
    return (
      <p className="text-muted-foreground py-16 text-center text-sm">用户管理仅管理员可见。</p>
    )
  }

  return (
    <div>
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

              <p className="text-muted-foreground mt-2 text-sm [overflow-wrap:anywhere]">
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
                <div className="border-border mt-4 min-w-0 border-t pt-4">
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
                      <div className="grid min-w-0 gap-6 md:grid-cols-2">
                      <div className="min-w-0">
                        <h3 className="mb-2 text-sm font-semibold">登录记录（最近 10 次）</h3>
                        {detail.loginLogs.length === 0 ? (
                          <p className="text-muted-foreground text-sm">暂无登录记录</p>
                        ) : (
                          <ul className="space-y-2">
                            {detail.loginLogs.map(log => (
                              <li key={log.id} className="min-w-0 text-sm [overflow-wrap:anywhere]">
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
                      <div className="min-w-0">
                        <h3 className="mb-2 text-sm font-semibold">观看记录（最近 10 部）</h3>
                        {detail.watchRecords.length === 0 ? (
                          <p className="text-muted-foreground text-sm">暂无观看记录</p>
                        ) : (
                          <ul className="space-y-2">
                            {detail.watchRecords.map(record => (
                              <li key={record.id} className="min-w-0 text-sm [overflow-wrap:anywhere]">
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
