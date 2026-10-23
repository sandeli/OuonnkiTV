import { Button } from '@/shared/components/ui/button'
import {
  CircleX,
  CircleCheckBig,
  Database,
  Activity,
  ArrowUpDown,
  Loader2,
  GripVertical,
  RotateCcw,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { useApiStore } from '@/shared/store/apiStore'
import { useAuthStore } from '@/shared/store/authStore'
import { adminUpdateSettings } from '@/shared/lib/authApi'
import {
  expandApiSiteSources,
  extractTvboxSources,
  getManagedSourceEnabled,
} from '@/shared/config/api.config'
import { useHealthStore } from '@/shared/store/healthStore'
import { isSubscriptionSource } from '@/shared/store/subscriptionStore'
import { useSettingStore } from '@/shared/store/settingStore'
import { batchCheckVideoSources } from '@/shared/lib/health-check'
import dayjs from 'dayjs'
import { Badge } from '@/shared/components/ui/badge'
import ActionDropdown from '@/shared/components/common/ActionDropdown'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import SortableVideoSourceCard from './SortableVideoSourceCard'
import VideoSourceEditDialog from './VideoSourceEditDialog'
import SubscriptionSourceDialog from './SubscriptionSourceDialog'
import { URLSourceModal, TextSourceModal } from './ImportSourceModal'
import { SettingsSection } from '../common'
import { ConfirmModal } from '@/shared/components/common/ConfirmModal'
import { v4 as uuidv4 } from 'uuid'
import type { VideoApi } from '@/shared/types'
import type { VideoSource } from '@tgys/cms-core'

export default function VideoSource() {
  const {
    selectAllAPIs,
    deselectAllAPIs,
    videoAPIs,
    importVideoAPIs,
    reorderVideoAPIs,
    managedSourceIds,
    setVideoSourcesEnabled,
    resetVideoSources,
  } = useApiStore()

  // 管理员统一提供的源：站长（及旧单密码模式的机主）可见可管；
  // 普通用户只管理自己添加的源，托管源照常参与搜索播放但不在此列表显示
  const authMode = useAuthStore(state => state.authMode)
  const authRole = useAuthStore(state => state.user?.role)
  const canSeeManaged = authMode === 'legacy' || (authMode === 'server' && authRole === 'admin')
  const isServerAdmin = authMode === 'server' && authRole === 'admin'
  const managedIdSet = new Set(managedSourceIds)
  const visibleAPIs = canSeeManaged
    ? videoAPIs
    : videoAPIs.filter(s => !managedIdSet.has(s.id))
  const visibleEnabledCount = visibleAPIs.filter(s => s.isEnabled).length

  // 把「可见列表的新顺序」合并回完整列表：托管源保持原位，可见源按新序填回自己的槽位
  const mergeVisibleOrder = (newVisibleIds: string[]): string[] => {
    const visibleIdSet = new Set(visibleAPIs.map(s => s.id))
    let cursor = 0
    return videoAPIs.map(s => (visibleIdSet.has(s.id) ? newVisibleIds[cursor++] : s.id))
  }

  const { results } = useHealthStore()
  const hasResults = Object.keys(results).length > 0

  // 本地测速状态（不影响其他组件）
  const [isTesting, setIsTesting] = useState(false)
  const [testProgress, setTestProgress] = useState({ completed: 0, total: 0 })

  // 全选逻辑（按当前可见列表判断）
  const isAllSelected = visibleAPIs.length > 0 && visibleEnabledCount === visibleAPIs.length

  const handleToggleSelectAll = () => {
    const target = !isAllSelected
    if (canSeeManaged) {
      if (target) selectAllAPIs()
      else deselectAllAPIs()
      // 站长全选/全不选：托管源部分同步写入全站开关表，所有用户随即按此执行
      const { authMode, user, token } = useAuthStore.getState()
      if (authMode === 'server' && user?.role === 'admin' && token && managedSourceIds.length > 0) {
        const next = { ...getManagedSourceEnabled() }
        for (const id of managedSourceIds) next[id] = target
        void adminUpdateSettings(token, { managedSourceEnabled: next })
          .then(() => useAuthStore.getState().probeConfig())
          .catch(() => toast.error('全站开关同步失败，请稍后重试'))
      }
    } else {
      setVideoSourcesEnabled(
        visibleAPIs.map(s => s.id),
        !isAllSelected,
      )
    }
  }

  // 编辑弹窗状态
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingSource, setEditingSource] = useState<VideoApi | null>(null)

  // 订阅源详情弹窗状态
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [viewingSource, setViewingSource] = useState<VideoSource | null>(null)

  // 重置确认弹窗状态
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)

  // 重置视频源：清掉本设备上自加/导入的源，恢复站点默认源（订阅独立存储，不受影响）
  const handleResetSources = async () => {
    try {
      await resetVideoSources()
      toast.success('已重置：本地添加的源已清除，恢复为站点默认源')
    } catch {
      toast.error('重置失败，请重试')
    }
  }

  // 导入弹窗状态
  const [urlSourceModalOpen, setUrlSourceModalOpen] = useState(false)
  const [textSourceModalOpen, setTextSourceModalOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 拖拽传感器
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // 拖拽结束
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = visibleAPIs.findIndex(s => s.id === active.id)
    const newIndex = visibleAPIs.findIndex(s => s.id === over.id as string)
    if (oldIndex === -1 || newIndex === -1) return

    const newVisibleOrder = [...visibleAPIs]
    const [moved] = newVisibleOrder.splice(oldIndex, 1)
    newVisibleOrder.splice(newIndex, 0, moved)
    reorderVideoAPIs(mergeVisibleOrder(newVisibleOrder.map(s => s.id)))
  }

  // 批量测速
  const handleBatchTest = async () => {
    setIsTesting(true)
    setTestProgress({ completed: 0, total: visibleAPIs.length })
    await batchCheckVideoSources(visibleAPIs, (completed, total) => {
      setTestProgress({ completed, total })
    })
    setIsTesting(false)
  }

  // 按延迟排序
  const handleSortByLatency = () => {
    const healthResults = useHealthStore.getState().results
    const statusPriority = (id: string) => {
      const s = healthResults[id]?.status
      if (s === 'online') return 0
      if (s === 'timeout') return 1
      if (s === 'offline' || s === 'error') return 2
      return 3
    }
    const sortedVisibleIds = [...visibleAPIs]
      .sort((a, b) => {
        const pa = statusPriority(a.id)
        const pb = statusPriority(b.id)
        if (pa !== pb) return pa - pb
        const la = healthResults[a.id]?.latency ?? Infinity
        const lb = healthResults[b.id]?.latency ?? Infinity
        return la - lb
      })
      .map(s => s.id)
    reorderVideoAPIs(mergeVisibleOrder(sortedVisibleIds))
  }

  // 添加视频源
  const handleAddSource = () => {
    setEditingSource({
      id: uuidv4(),
      name: '新增源',
      url: '',
      detailUrl: '',
      timeout: useSettingStore.getState().network.defaultTimeout || 3000,
      retry: useSettingStore.getState().network.defaultRetry || 3,
      isEnabled: true,
      siteWide: false,
      updatedAt: new Date(),
    })
    setEditDialogOpen(true)
  }

  // 编辑/查看视频源
  const handleEditSource = (source: VideoSource) => {
    if (isSubscriptionSource(source.id)) {
      setViewingSource(source)
      setDetailDialogOpen(true)
    } else {
      setEditingSource(source as VideoApi)
      setEditDialogOpen(true)
    }
  }

  // 文件导入
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = e => {
      try {
        const content = e.target?.result as string
        const sources = JSON.parse(content)
        // 数组格式（自家/KVideo）与 MoonTV 的 api_site 格式都认，后者由 importVideoAPIs 内部展开
        if (Array.isArray(sources) || expandApiSiteSources(sources) || extractTvboxSources(sources)) {
          const result = importVideoAPIs(sources)
          if (result.imported > 0) {
            toast.success(`成功导入 ${result.imported} 个视频源`)
          }
          if (result.skipped > 0) {
            toast.warning(`跳过 ${result.skipped} 个无效条目`, {
              description: result.errors.slice(0, 3).join('；'),
            })
          }
        } else {
          toast.error('导入失败：格式不支持，应为源数组、MoonTV 的 api_site 或 TVBox 配置')
        }
      } catch (error) {
        console.error('Import error:', error)
        toast.error('导入失败：JSON 解析错误')
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
    reader.readAsText(file)
  }

  // 导出为文件（排除订阅源）
  const handleExportToFile = () => {
    try {
      const manualAPIs = visibleAPIs.filter(s => !isSubscriptionSource(s.id))
      const data = JSON.stringify(manualAPIs, null, 2)
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `tgys-tv-sources-${dayjs().format('YYYY-MM-DD')}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success('导出成功')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('导出失败')
    }
  }

  // 导出为文本（排除订阅源）
  const handleExportToText = async () => {
    try {
      const manualAPIs = visibleAPIs.filter(s => !isSubscriptionSource(s.id))
      const data = JSON.stringify(manualAPIs, null, 2)
      await navigator.clipboard.writeText(data)
      toast.success('已复制到剪贴板')
    } catch (error) {
      console.error('Copy error:', error)
      toast.error('复制失败，请手动复制')
    }
  }

  return (
    <>
      <VideoSourceEditDialog
        source={editingSource}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
      <SubscriptionSourceDialog
        source={viewingSource}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
      <ConfirmModal
        isOpen={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        onConfirm={handleResetSources}
        title="重置视频源？"
        description="将清除当前设备上你自己添加、导入的全部视频源（包括启停状态与排序），恢复为站点默认源（管理员后台托管源与站点初始源）。订阅不会被删除，订阅中的源会重新同步。此操作不可恢复。"
        confirmText="确认重置"
        isDestructive
      />
      <URLSourceModal open={urlSourceModalOpen} onOpenChange={setUrlSourceModalOpen} />
      <TextSourceModal open={textSourceModalOpen} onOpenChange={setTextSourceModalOpen} />

      <SettingsSection
        title="视频源列表"
        description={
          isServerAdmin
            ? '在这里添加、编辑、导入、导出并控制视频源启用状态。你手动添加的源会随账户同步（换设备登录也在），编辑源时可开启「全站生效」让所有用户都用上。'
            : authMode === 'server'
              ? '这里管理你自己添加的源，会随你的账户同步（换设备登录也在）；管理员统一提供的源不在此显示（照常参与搜索与播放）。'
              : canSeeManaged
                ? '在这里添加、编辑、导入、导出并控制视频源启用状态。'
                : '管理员统一提供的源不在此显示（照常参与搜索与播放）；这里只管理你自己添加的源。'
        }
        icon={<Database className="size-4" />}
        tone="sky"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {visibleAPIs.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3"
                onClick={handleBatchTest}
                disabled={isTesting}
              >
                {isTesting ? (
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                ) : (
                  <Activity className="mr-1 size-3.5" />
                )}
                {isTesting
                  ? `${testProgress.completed}/${testProgress.total}`
                  : '测速'}
              </Button>
            )}
            {visibleAPIs.length > 0 && hasResults && !isTesting && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3"
                onClick={handleSortByLatency}
              >
                <ArrowUpDown className="mr-1 size-3.5" />
                按延迟排序
              </Button>
            )}
            {visibleAPIs.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3"
                onClick={handleToggleSelectAll}
              >
                {isAllSelected ? (
                  <CircleX className="mr-1 size-3.5" />
                ) : (
                  <CircleCheckBig className="mr-1 size-3.5" />
                )}
                {isAllSelected ? '全部停用' : '全部启用'}
              </Button>
            )}
            {visibleAPIs.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3"
                onClick={() => setResetConfirmOpen(true)}
              >
                <RotateCcw className="mr-1 size-3.5" />
                重置源
              </Button>
            )}
            <ActionDropdown
              label="添加源"
              items={[
                {
                  label: '手动添加',
                  onClick: handleAddSource,
                },
                {
                  label: '导入视频源',
                  type: 'sub',
                  children: [
                    {
                      label: '从文件导入',
                      onClick: () => fileInputRef.current?.click(),
                    },
                    {
                      label: '从URL导入',
                      onClick: () => setUrlSourceModalOpen(true),
                    },
                    {
                      label: '从文本导入',
                      onClick: () => setTextSourceModalOpen(true),
                    },
                  ],
                },
                {
                  label: '导出视频源',
                  type: 'sub',
                  children: [
                    {
                      label: '导出为文件',
                      onClick: handleExportToFile,
                    },
                    {
                      label: '导出为文本',
                      onClick: handleExportToText,
                    },
                  ],
                },
              ]}
            />
          </div>
        }
      >
        {visibleAPIs.length === 0 ? (
          <div className="text-muted-foreground flex h-20 items-center justify-center text-sm">
            暂无视频源，点击右上角「添加源」开始使用。
          </div>
        ) : (
          <>
            {/* 已启用统计 + 拖拽排序提示 */}
            <div className="flex items-center justify-between gap-2">
              <Badge variant="secondary" className="bg-sky-500/14 text-sky-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                已启用 {visibleEnabledCount}/{visibleAPIs.length}
              </Badge>
              <div className="text-muted-foreground/60 flex items-center gap-1.5 text-xs">
                <GripVertical className="size-3" />
                <span>拖拽左侧手柄可调整顺序</span>
              </div>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={visibleAPIs.map(s => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {visibleAPIs.map(source => (
                    <SortableVideoSourceCard
                      key={source.id}
                      source={source}
                      onEdit={() => handleEditSource(source)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </>
        )}

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".json"
          onChange={handleFileChange}
        />
      </SettingsSection>
    </>
  )
}
