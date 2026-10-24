import { Navbar, NavbarBrand, NavbarContent } from '@/shared/components/ui/navbar'
import { TgysLogo } from '@/shared/components/icons'
import { SidebarTrigger } from '@/shared/components/ui/sidebar'
import { NavLink, useLocation } from 'react-router'
import { useEffect, useState } from 'react'
import { LogOut, Moon, Sun, Laptop, ShieldCheck } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { Button } from '@/shared/components/ui/button'
import { ThemeToggle, useThemeState } from './theme'
import SearchBox from './SearchBox'
import { useAuthStore } from '@/shared/store/authStore'
import { cn } from '@/shared/lib'
import { detectCarBrowser } from '@/shared/lib/carBrowser'

interface NavigationProps {
  hidden?: boolean
  enableScrollAnimation?: boolean
}

export default function Navigation({ hidden = false, enableScrollAnimation = false }: NavigationProps) {
  const { mode } = useThemeState()
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
  const location = useLocation()
  const authUser = useAuthStore(state => state.user)
  const authMode = useAuthStore(state => state.authMode)
  const hasLegacySession = useAuthStore(state => !!state.sessionToken)
  const authLogout = useAuthStore(state => state.logout)

  const showAccount = authMode === 'server' && !!authUser
  const showLogout = showAccount || (authMode === 'legacy' && hasLegacySession)
  // 访客模式（无会员开放 / 车机自动免登录）：未登录时顶栏只留一个「管理员登录」入口（没有用户登录/注册页）
  const openAccess = useAuthStore(state => state.authConfig?.siteBehavior?.openAccess ?? false)
  const carOpenAccess = useAuthStore(state => state.authConfig?.siteBehavior?.carOpenAccess ?? false)
  const visitorMode = openAccess || (carOpenAccess && detectCarBrowser())
  const setLoginWallRequested = useAuthStore(state => state.setLoginWallRequested)
  // 车机上不显示管理员入口：车机只用来观看，管理走手机/电脑
  const showAdminLogin = authMode === 'server' && visitorMode && !authUser && !detectCarBrowser()

  // 在搜索页面隐藏导航栏搜索框
  const isSearchPage = location.pathname === '/search'

  // 路由切换时复位移动端搜索展开状态：提交搜索会先卸载导航栏搜索框，
  // 展开状态来不及回调复位便会残留，导致返回首页后品牌区（菜单键 + 站名图标）
  // 与右侧按钮一直处于隐藏状态（仅手机端，桌面端有 sm 样式兜底不受影响）
  useEffect(() => {
    setIsMobileSearchOpen(false)
  }, [location.pathname])

  return (
    <div
      className={cn(
        'sticky top-0 z-50 w-full overflow-hidden',
        enableScrollAnimation
          ? 'transition-[height] duration-220 ease-out motion-reduce:transition-none'
          : 'transition-none',
      )}
      style={{ height: hidden ? '0rem' : '4rem' }}
    >
      <div
        className={cn(
          'flex w-full justify-center',
          enableScrollAnimation
            ? 'transform-gpu will-change-[transform,opacity] transition-[opacity,transform] duration-220 ease-out motion-reduce:transition-none'
            : 'transition-none',
          hidden ? 'pointer-events-none -translate-y-2 opacity-0' : 'translate-y-0 opacity-100',
        )}
      >
        <Navbar
          className={cn(
            enableScrollAnimation && 'transition-[backdrop-filter,box-shadow] duration-200',
            enableScrollAnimation && hidden && 'backdrop-blur-none shadow-none',
          )}
        >
          {/* Logo 和侧边栏触发器 - 移动端搜索模式下隐藏 */}
          <NavbarBrand
            className={cn(
              '!flex-none',
              enableScrollAnimation
                ? 'transition-[opacity,transform] duration-220 ease-out'
                : 'transition-none',
              isMobileSearchOpen
                ? 'pointer-events-none -translate-x-4 opacity-0 sm:pointer-events-auto sm:translate-x-0 sm:opacity-100'
                : '',
            )}
          >
            <SidebarTrigger />
            <NavLink to="/" className="flex items-center">
              <div className="flex items-end">
                <div>
                  <TgysLogo />
                </div>
                <p className="text-accent-foreground text-lg font-bold">TGYS TV</p>
              </div>
            </NavLink>
          </NavbarBrand>

          <NavbarContent justify="center" className="gap-2">
            <div className="flex-1" />

            {/* 搜索框组件 - 搜索页面时隐藏 */}
            <AnimatePresence mode="wait">
              {!isSearchPage && (
                <motion.div
                  key="navbar-search"
                  layoutId="main-search-box"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="flex flex-auto items-center"
                >
                  <SearchBox onMobileSearchChange={setIsMobileSearchOpen} />
                </motion.div>
              )}
            </AnimatePresence>

            <div
              className={cn(
                'flex flex-1 justify-end gap-2 sm:gap-0',
                enableScrollAnimation
                  ? 'transition-[opacity,transform] duration-220 ease-out'
                  : 'transition-none',
                isMobileSearchOpen
                  ? 'pointer-events-none translate-x-4 opacity-0 sm:pointer-events-auto sm:translate-x-0 sm:opacity-100'
                  : '',
              )}
            >
              {/* 账号与退出（桌面端顶栏；手机端布局不变，退出入口在设置中心） */}
              {showLogout && (
                <div className="hidden items-center gap-1 pr-1 sm:gap-2 md:flex">
                  {showAccount && authUser && (
                    <span className="text-muted-foreground hidden max-w-28 truncate text-sm lg:block">
                      {authUser.username}
                      {authUser.isMaster ? '（站长）' : ''}
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={() => void authLogout()}
                  >
                    <LogOut className="size-3.5" />
                    退出
                  </Button>
                </div>
              )}
              {showAdminLogin && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 shrink-0 gap-1 px-2 text-xs"
                  onClick={() => setLoginWallRequested(true)}
                >
                  <ShieldCheck className="size-3.5" />
                  管理员登录
                </Button>
              )}
              <ThemeToggle>
                <Button size="icon" variant="ghost" className="size-7">
                  {mode === 'dark' && <Moon />}
                  {mode === 'light' && <Sun />}
                  {mode === 'system' && <Laptop />}
                </Button>
              </ThemeToggle>
            </div>
          </NavbarContent>
        </Navbar>
      </div>
    </div>
  )
}
