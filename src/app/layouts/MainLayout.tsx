import Navigation from '@/shared/components/Navigation'
import { SidebarProvider, SidebarInset } from '@/shared/components/ui/sidebar'
import SideBar from '@/shared/components/SideBar'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { CustomAnimatedOutlet } from '@/shared/components/AnimatedOutlet'
import BackToTopButton from '@/shared/components/BackToTopButton'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useVersionStore } from '@/shared/store/versionStore'
import { useAuthStore } from '@/shared/store/authStore'
import { useSettingStore } from '@/shared/store/settingStore'
import { useApiStore } from '@/shared/store/apiStore'
import { useSubscriptionStore } from '@/shared/store/subscriptionStore'
import { useSubscriptionAutoRefresh } from '@/shared/hooks/useSubscriptionAutoRefresh'
import { useScrollChromeVisibility } from '@/shared/hooks'
import { useLocation } from 'react-router'
import { getInitialContentConfigId, hashConfigValue } from '@/shared/config/runtimeEnv'

const UpdateModal = lazy(() => import('@/shared/components/UpdateModal'))

export default function MainLayout() {
  const { hasNewVersion, setShowUpdateModal } = useVersionStore()
  // 更新日志仅管理员可见（账号模式下的站长）
  const canViewChangelog = useAuthStore(
    state => state.authMode === 'server' && state.user?.role === 'admin',
  )
  const { system } = useSettingStore()
  const { initializeEnvSources } = useApiStore()
  const { initializeEnvSubscriptions } = useSubscriptionStore()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isChromeVisible = useScrollChromeVisibility({
    enabled: system.isScrollChromeAnimationEnabled,
    scrollRootSelector: '[data-main-scroll-area]',
    resetKey: location.pathname,
  })

  // 订阅源自动刷新
  useSubscriptionAutoRefresh()

  const adminVideoSources = useAuthStore(state => state.authConfig?.initialVideoSources ?? '')

  // 初始化逻辑 (从 MyRouter 迁移)
  useEffect(() => {
    // 指纹纳入管理员后台视频源：管理员改源后，所有客户端下次打开自动重新导入
    const adminSegment = adminVideoSources.trim()
      ? `:adminsrc:${hashConfigValue(adminVideoSources.trim())}`
      : ''
    const initialContentConfigId = getInitialContentConfigId() + adminSegment
    const needsInitialization =
      localStorage.getItem('initialContentConfigId') !== initialContentConfigId
    if (needsInitialization) {
      const initialize = async () => {
        await initializeEnvSources()
        await initializeEnvSubscriptions()
        localStorage.setItem('initialContentConfigId', initialContentConfigId)
      }
      void initialize()
    }
  }, [initializeEnvSources, initializeEnvSubscriptions, adminVideoSources])

  // 版本更新检查（仅管理员：普通用户不弹更新日志）
  useEffect(() => {
    if (canViewChangelog && hasNewVersion() && system.isUpdateLogEnabled) {
      setShowUpdateModal(true)
    }
  }, [canViewChangelog, hasNewVersion, setShowUpdateModal, system.isUpdateLogEnabled])

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
      style={
        {
          '--sidebar-top': isChromeVisible ? '4rem' : '0rem',
        } as React.CSSProperties
      }
      className="flex h-dvh flex-col overflow-hidden"
    >
      <Navigation
        hidden={!isChromeVisible}
        enableScrollAnimation={system.isScrollChromeAnimationEnabled}
      />
      <div className="flex flex-1 overflow-hidden">
        <SideBar
          hidden={!isChromeVisible}
          enableScrollAnimation={system.isScrollChromeAnimationEnabled}
        />
        <SidebarInset className="h-full overflow-hidden">
          <div className="h-full p-2 md:pl-1">
            <div className="border-border bg-sidebar relative h-full rounded-lg border py-2 shadow-sm">
              <ScrollArea data-main-scroll-area className="h-full rounded-lg px-2">
                <CustomAnimatedOutlet
                  routeKey={pathname =>
                    pathname === '/settings' || pathname.startsWith('/settings/')
                      ? '/settings'
                      : pathname
                  }
                />
                {canViewChangelog && (
                  <Suspense fallback={null}>
                    <UpdateModal />
                  </Suspense>
                )}
              </ScrollArea>
              <BackToTopButton scrollRootSelector="[data-main-scroll-area]" />
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
