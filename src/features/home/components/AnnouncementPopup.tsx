import { useEffect, useState } from 'react'
import { Megaphone } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { useAuthStore } from '@/shared/store/authStore'

const SEEN_VERSION_KEY = 'tgys-announcement-seen-version'

/**
 * 首页弹窗公告：内容由管理员在后台设置（存 D1）。
 * 每个版本只弹一次（看过即记录版本号）；管理员改内容后版本 +1，所有人会重新看到一次。
 */
export function AnnouncementPopup() {
  const announcement = useAuthStore(state => state.authConfig?.announcement ?? null)
  const [open, setOpen] = useState(false)

  // 每次进首页都重拉一次公开配置：管理员刚改的公告在站内跳转时也能立刻生效
  useEffect(() => {
    void useAuthStore.getState().probeConfig()
  }, [])

  useEffect(() => {
    if (!announcement || !announcement.enabled || !announcement.content.trim()) return
    const seen = Number.parseInt(localStorage.getItem(SEEN_VERSION_KEY) ?? '0', 10) || 0
    if (announcement.version > seen) {
      setOpen(true)
    }
  }, [announcement])

  if (!announcement) return null

  const markSeenAndClose = () => {
    localStorage.setItem(SEEN_VERSION_KEY, String(announcement.version))
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next) markSeenAndClose()
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="size-5" />
            公告
          </DialogTitle>
        </DialogHeader>
        <div className="text-sm leading-relaxed whitespace-pre-wrap">{announcement.content}</div>
        <DialogFooter>
          <Button onClick={markSeenAndClose}>知道了</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
