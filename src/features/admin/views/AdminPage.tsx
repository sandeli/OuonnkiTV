import { useCallback, useEffect, useState } from 'react'
import {
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
import { Spinner } from '@/shared/components/ui/spinner'
import { ConfirmModal } from '@/shared/components/common/ConfirmModal'
import { useAuthStore } from '@/shared/store/authStore'
import {
  adminDeleteUser,
  adminGetSettings,
  adminGetUserDetail,
  adminKickUser,
  adminListUsers,
  adminSetUserDisabled,
  adminUpdateSettings,
  type AdminUserDetail,
  type AdminUserRow,
} from '@/shared/lib/authApi'

function formatTime(seconds: number | null): string {
  if (!seconds) return '从未'
  return new Date(seconds * 1000).toLocaleString('zh-CN', { hour12: false })
}

function formatProgress(progress: number, duration: number): string {
  if (duration <= 0) return '已开始观看'
  const percent = Math.min(100, Math.round((progress / duration) * 100))
  return `看到 ${Math.floor(progress / 60)} 分钟 / 共 ${Math.floor(duration / 60)} 分钟（${percent}%）`
}

export default function AdminPage() {
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
      const result = await adminUpdateSettings(token, open)
      setRegistrationOpen(result.registrationOpen)
      toast.success(open ? '已开放注册' : '已关闭注册')
    } catch {
      toast.error('保存失败')
    } finally {
      setSwitchSaving(false)
    }
  }

  const handleToggleDetail = async (row: AdminUserRow) => {
    if (expandedId === row.id) {
      setExpandedId(null)
      setDetail(null)
      return
    }
    setExpandedId(row.id)
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
                {row.watchCount} 部
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
                    <div className="grid gap-6 md:grid-cols-2">
                      <div>
                        <h3 className="mb-2 text-sm font-semibold">登录记录（最近 50 次）</h3>
                        {detail.loginLogs.length === 0 ? (
                          <p className="text-muted-foreground text-sm">暂无登录记录</p>
                        ) : (
                          <ul className="space-y-2">
                            {detail.loginLogs.map(log => (
                              <li key={log.id} className="text-sm">
                                <span>{formatTime(log.createdAt)}</span>
                                <span className="text-muted-foreground ml-2">{log.ip ?? ''}</span>
                                <span className="text-muted-foreground block truncate text-xs">
                                  {log.userAgent ?? ''}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div>
                        <h3 className="mb-2 text-sm font-semibold">观看记录（最近 100 部）</h3>
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
