import React, { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Lock, ShieldCheck, User, UserPlus } from 'lucide-react'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Spinner } from '@/shared/components/ui/spinner'
import { useAuthStore } from '@/shared/store/authStore'
import { TgysLogo } from '@/shared/components/icons'
import { toast } from 'sonner'
import { getPublicEnv } from '@/shared/config/runtimeEnv'

interface AuthGuardProps {
  children: React.ReactNode
}

const easeOutQuad = [0.25, 0.46, 0.45, 0.94] as const

type GateMode = 'server' | 'legacy' | 'open'
type FormMode = 'account' | 'master' | 'register'

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      remove: (id: string) => void
    }
  }
}

/** Cloudflare Turnstile 人机验证小部件（仅在配置了 Site Key 时渲染） */
function TurnstileWidget({
  siteKey,
  onToken,
}: {
  siteKey: string
  onToken: (token: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!siteKey) return
    let widgetId: string | undefined
    const render = () => {
      if (ref.current && window.turnstile) {
        widgetId = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          callback: onToken,
        })
      }
    }
    if (window.turnstile) {
      render()
    } else {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
      script.async = true
      script.onload = render
      document.head.appendChild(script)
    }
    return () => {
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [siteKey, onToken])

  if (!siteKey) return null
  return <div ref={ref} className="flex justify-center" />
}

const FORM_HEADINGS: Record<FormMode, { title: string; desc: string }> = {
  account: { title: '欢迎回来', desc: '登录你的账号，继续观看' },
  master: { title: '站长验证', desc: '输入站长密码（即站点访问密码）进入' },
  register: { title: '创建账号', desc: '注册后即可登录观看' },
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { login, loginWithAccount, register, validateSession, probeConfig, revalidateSession } =
    useAuthStore()
  const serverToken = useAuthStore(state => state.token)
  const legacySessionToken = useAuthStore(state => state.sessionToken)
  const registrationMode = useAuthStore(
    state =>
      state.authConfig?.registrationMode ??
      (state.authConfig?.registrationOpen ? 'open' : 'closed'),
  )
  const registrationOpen = registrationMode !== 'closed'
  const turnstileSiteKey = useAuthStore(state => state.authConfig?.turnstileSiteKey ?? '')

  const [gateMode, setGateMode] = useState<GateMode | null>(null)
  const [formMode, setFormMode] = useState<FormMode>('account')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isDismissing, setIsDismissing] = useState(false)
  const revealRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const revealOriginRef = useRef('50% 50%')

  const accessPassword = getPublicEnv('TGYS_ACCESS_PASSWORD')
  const legacyProtectionEnabled = !!accessPassword && accessPassword.trim() !== ''

  useEffect(() => {
    const checkAuth = async () => {
      const config = await probeConfig()
      if (config.authEnabled) {
        setGateMode('server')
        const hasToken = !!useAuthStore.getState().token
        setIsAuthenticated(hasToken ? await validateSession() : false)
        return
      }
      if (!legacyProtectionEnabled) {
        setGateMode('open')
        setIsAuthenticated(true)
        return
      }
      setGateMode('legacy')
      setIsAuthenticated(await validateSession())
    }
    void checkAuth()
  }, [probeConfig, validateSession, legacyProtectionEnabled])

  // 应用内退出登录后，守卫重新上锁回到登录界面
  // 会话定时复查（账号模式）：被管理员踢下线/禁用/到期后，最多 60 秒内弹回登录页，看片中也一样（切回标签页会立即复查）
  useEffect(() => {
    if (!isAuthenticated || gateMode !== 'server') return
    let cancelled = false
    const revalidate = async () => {
      const result = await revalidateSession()
      if (!cancelled && result === 'invalid') {
        setIsAuthenticated(false)
      }
    }
    const timer = window.setInterval(() => void revalidate(), 60_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void revalidate()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [isAuthenticated, gateMode, revalidateSession])

  useEffect(() => {
    if (!isAuthenticated || isDismissing) return
    if (gateMode === 'server' && !serverToken) setIsAuthenticated(false)
    if (gateMode === 'legacy' && !legacySessionToken && legacyProtectionEnabled) {
      setIsAuthenticated(false)
    }
  }, [
    serverToken,
    legacySessionToken,
    gateMode,
    isAuthenticated,
    isDismissing,
    legacyProtectionEnabled,
  ])

  // 验证成功后，从按钮位置扩散圆形 clip-path 揭开页面内容
  useEffect(() => {
    if (!isDismissing) return

    const reveal = revealRef.current
    if (reveal) {
      const origin = revealOriginRef.current
      const animation = reveal.animate(
        [{ clipPath: `circle(0% at ${origin})` }, { clipPath: `circle(150% at ${origin})` }],
        {
          duration: 600,
          easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          fill: 'forwards',
        },
      )
      animation.onfinish = () => {
        setIsAuthenticated(true)
        setIsDismissing(false)
      }

      return () => animation.cancel()
    }

    setIsAuthenticated(true)
    setIsDismissing(false)
  }, [isDismissing])

  const handleSuccess = useCallback(() => {
    toast.success('验证成功')
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      revealOriginRef.current = `${rect.left + rect.width / 2}px ${rect.top + rect.height / 2}px`
    }
    setIsDismissing(true)
  }, [])

  if (gateMode === null || (gateMode !== 'open' && isAuthenticated === null)) {
    return null
  }

  if (gateMode === 'open' || isAuthenticated) {
    return <>{children}</>
  }

  const handleMasterLogin = async () => {
    setIsLoading(true)
    await new Promise(resolve => setTimeout(resolve, 300))
    const success = await login(password)
    if (success) {
      handleSuccess()
    } else {
      toast.error(gateMode === 'server' ? '站长密码不正确' : '验证失败')
      setIsLoading(false)
    }
  }

  const handleAccountLogin = async () => {
    if (!username.trim() || !password) {
      toast.error('请输入用户名和密码')
      return
    }
    setIsLoading(true)
    const result = await loginWithAccount(username.trim(), password)
    if (result.ok) {
      handleSuccess()
    } else {
      toast.error(result.error ?? '登录失败')
      setIsLoading(false)
    }
  }

  const handleRegister = async () => {
    if (!username.trim() || !password) {
      toast.error('请输入用户名和密码')
      return
    }
    if (password !== confirmPassword) {
      toast.error('两次输入的密码不一致')
      return
    }
    if (registrationMode === 'invite' && !inviteCode.trim()) {
      toast.error('请输入邀请码')
      return
    }
    if (turnstileSiteKey && !turnstileToken) {
      toast.error('请先完成人机验证')
      return
    }
    setIsLoading(true)
    const result = await register(
      username.trim(),
      password,
      turnstileToken || undefined,
      registrationMode === 'invite' ? inviteCode.trim() : undefined,
    )
    if (result.ok) {
      toast.success('注册成功')
      handleSuccess()
    } else {
      toast.error(result.error ?? '注册失败')
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || isLoading) return
    if (formMode === 'account') void handleAccountLogin()
    else if (formMode === 'register') void handleRegister()
    else void handleMasterLogin()
  }

  const switchForm = (mode: FormMode) => {
    setFormMode(mode)
    setConfirmPassword('')
    setTurnstileToken('')
  }

  const heading =
    gateMode === 'legacy'
      ? { title: '访问受限', desc: '当前站点通过密码保护，请输入访问密码以继续' }
      : FORM_HEADINGS[formMode]

  return (
    <>
      {/* 验证成功后渲染页面内容，clip-path 从按钮位置向外扩散 */}
      {isDismissing && (
        <div
          ref={revealRef}
          className="fixed inset-0 z-[10000]"
          style={{ clipPath: `circle(0% at ${revealOriginRef.current})` }}
        >
          {children}
        </div>
      )}

      {/* 守卫层 */}
      <div className="bg-background fixed inset-0 z-[9999] flex flex-col md:flex-row">
        {/* 左侧品牌区 — 移动端顶部横栏，桌面端左侧半屏 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: easeOutQuad }}
          className="bg-muted/40 relative flex shrink-0 flex-col items-center justify-center overflow-hidden px-8 py-12 md:w-1/2 md:py-0"
        >
          {/* 装饰性模糊光晕 */}
          <div className="bg-primary/10 pointer-events-none absolute -top-20 -left-20 size-72 rounded-full blur-3xl" />
          <div className="bg-primary/5 pointer-events-none absolute -right-16 -bottom-16 size-56 rounded-full blur-3xl" />

          <div className="relative flex flex-col items-center gap-4">
            <motion.div
              initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.5, delay: 0.1, ease: easeOutQuad }}
              className="flex flex-col items-center gap-3"
            >
              <TgysLogo size={80} />
              <div className="text-xl font-bold tracking-widest">TGYS TV</div>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.25, ease: easeOutQuad }}
              className="text-muted-foreground max-w-xs text-center text-sm"
            >
              你的私人流媒体影院
            </motion.p>
          </div>
        </motion.div>

        {/* 右侧表单区 — 移动端占满剩余空间，桌面端右侧半屏 */}
        <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-8 py-12 md:px-16">
          <div className="w-full max-w-sm space-y-8">
            {/* 信息区域 */}
            <motion.div
              initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.5, delay: 0.15, ease: easeOutQuad }}
              className="space-y-4"
            >
              <div className="bg-muted/70 ring-border/60 flex size-12 items-center justify-center rounded-xl ring-1">
                {formMode === 'register' ? (
                  <UserPlus className="text-muted-foreground size-5" />
                ) : formMode === 'master' ? (
                  <ShieldCheck className="text-muted-foreground size-5" />
                ) : (
                  <Lock className="text-muted-foreground size-5" />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-semibold">{heading.title}</h1>
                <p className="text-muted-foreground mt-1.5 text-sm">{heading.desc}</p>
              </div>
            </motion.div>

            {/* 表单区域 */}
            <motion.div
              initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.5, delay: 0.25, ease: easeOutQuad }}
              className="space-y-4"
              onKeyDown={handleKeyDown}
            >
              {gateMode === 'legacy' || formMode === 'master' ? (
                <>
                  <div className="flex items-center gap-2">
                    <Input
                      type="password"
                      placeholder="请输入访问密码"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="h-11 rounded-full"
                    />
                    <Button
                      ref={buttonRef}
                      size="icon-lg"
                      className="shrink-0 rounded-full"
                      onClick={() => void handleMasterLogin()}
                      disabled={isLoading}
                    >
                      {isLoading ? <Spinner size="sm" /> : <ArrowRight className="size-5" />}
                    </Button>
                  </div>
                  {gateMode === 'server' && (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
                      onClick={() => switchForm('account')}
                    >
                      <ArrowLeft className="size-4" />
                      返回账号登录
                    </button>
                  )}
                </>
              ) : formMode === 'account' ? (
                <>
                  <Input
                    type="text"
                    placeholder="用户名"
                    autoComplete="username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="h-11 rounded-full"
                  />
                  <Input
                    type="password"
                    placeholder="密码"
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="h-11 rounded-full"
                  />
                  <Button
                    ref={buttonRef}
                    className="h-11 w-full rounded-full"
                    onClick={() => void handleAccountLogin()}
                    disabled={isLoading}
                  >
                    {isLoading ? <Spinner size="sm" /> : '登录'}
                  </Button>
                  <div className="text-muted-foreground flex items-center justify-between text-sm">
                    <button
                      type="button"
                      className="hover:text-foreground flex items-center gap-1"
                      onClick={() => switchForm('master')}
                    >
                      <ShieldCheck className="size-4" />
                      站长登录
                    </button>
                    {registrationOpen ? (
                      <button
                        type="button"
                        className="hover:text-foreground flex items-center gap-1"
                        onClick={() => switchForm('register')}
                      >
                        <User className="size-4" />
                        {registrationMode === 'invite' ? '邀请码注册' : '注册账号'}
                      </button>
                    ) : (
                      <span>注册已关闭</span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Input
                    type="text"
                    placeholder="用户名（3-24 位，文字/数字/下划线）"
                    autoComplete="username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="h-11 rounded-full"
                  />
                  <Input
                    type="password"
                    placeholder="密码（至少 6 位）"
                    autoComplete="new-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="h-11 rounded-full"
                  />
                  <Input
                    type="password"
                    placeholder="确认密码"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="h-11 rounded-full"
                  />
                  {registrationMode === 'invite' && (
                    <Input
                      type="text"
                      placeholder="邀请码（向管理员索取）"
                      autoComplete="off"
                      value={inviteCode}
                      onChange={e => setInviteCode(e.target.value)}
                      className="h-11 rounded-full"
                    />
                  )}
                  <TurnstileWidget siteKey={turnstileSiteKey} onToken={setTurnstileToken} />
                  <Button
                    ref={buttonRef}
                    className="h-11 w-full rounded-full"
                    onClick={() => void handleRegister()}
                    disabled={isLoading}
                  >
                    {isLoading ? <Spinner size="sm" /> : '注册并登录'}
                  </Button>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
                    onClick={() => switchForm('account')}
                  >
                    <ArrowLeft className="size-4" />
                    已有账号，去登录
                  </button>
                </>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </>
  )
}
