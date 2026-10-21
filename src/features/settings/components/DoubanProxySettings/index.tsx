import { Globe } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { DEFAULT_DOUBAN_PROXY } from '@/shared/lib/authApi'
import { useAuthStore } from '@/shared/store/authStore'
import { useDoubanProxyOverrideStore } from '@/shared/store/doubanProxyOverrideStore'
import { SettingsItem, SettingsSection } from '../common'

const FOLLOW_ADMIN = '__admin__'

const DATA_OPTIONS = [
  { value: 'direct', label: '本站代理（服务器转发）' },
  { value: 'cors-proxy-zwei', label: 'CORS 代理 By Zwei' },
  { value: 'cmliussss-cdn-tencent', label: '豆瓣 CDN By CMLiussss（腾讯云）' },
  { value: 'cmliussss-cdn-ali', label: '豆瓣 CDN By CMLiussss（阿里云）' },
  { value: 'custom', label: '自定义代理' },
]

const IMAGE_OPTIONS = [
  { value: 'server', label: '本站代理（服务器转发图片）' },
  { value: 'direct', label: '直连（浏览器直接加载豆瓣图）' },
  { value: 'img3', label: '豆瓣 img3 节点' },
  { value: 'cmliussss-cdn-tencent', label: '豆瓣 CDN By CMLiussss（腾讯云）' },
  { value: 'cmliussss-cdn-ali', label: '豆瓣 CDN By CMLiussss（阿里云）' },
  { value: 'custom', label: '自定义代理' },
]

function labelOf(options: { value: string; label: string }[], value: string): string {
  return options.find(o => o.value === value)?.label ?? value
}

/**
 * 豆瓣代理（个人设置）：默认跟随管理员的全站设置，
 * 每位用户也可为自己单独指定，仅对自己生效（按账号保存在本机）。
 */
export default function DoubanProxySettings() {
  const admin = useAuthStore(state => state.authConfig?.doubanProxy) ?? DEFAULT_DOUBAN_PROXY
  const dataType = useDoubanProxyOverrideStore(state => state.dataType)
  const dataUrl = useDoubanProxyOverrideStore(state => state.dataUrl)
  const imageType = useDoubanProxyOverrideStore(state => state.imageType)
  const imageUrl = useDoubanProxyOverrideStore(state => state.imageUrl)
  const setOverride = useDoubanProxyOverrideStore(state => state.setOverride)
  const resetOverride = useDoubanProxyOverrideStore(state => state.resetOverride)
  const hasOverride = dataType !== null || imageType !== null

  return (
    <SettingsSection
      title="豆瓣代理"
      description="首页豆瓣墙的数据与海报加载方式。默认跟随管理员设置，也可以为自己单独指定（仅对自己生效，按账号保存在本机）。"
      icon={<Globe className="size-4" />}
      tone="sky"
    >
      <SettingsItem
        title="数据代理"
        description={`当前管理员设置：${labelOf(DATA_OPTIONS, admin.dataType)}`}
        control={
          <div className="w-64 max-w-full space-y-2">
            <Select
              value={dataType ?? FOLLOW_ADMIN}
              onValueChange={value =>
                setOverride({ dataType: value === FOLLOW_ADMIN ? null : value })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FOLLOW_ADMIN}>跟随管理员设置</SelectItem>
                {DATA_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {dataType === 'custom' && (
              <Input
                placeholder="自定义代理前缀，如 https://proxy.example.com/?url="
                value={dataUrl}
                onChange={e => setOverride({ dataUrl: e.target.value })}
              />
            )}
          </div>
        }
      />
      <SettingsItem
        title="图片代理"
        description={`当前管理员设置：${labelOf(IMAGE_OPTIONS, admin.imageType)}`}
        control={
          <div className="w-64 max-w-full space-y-2">
            <Select
              value={imageType ?? FOLLOW_ADMIN}
              onValueChange={value =>
                setOverride({ imageType: value === FOLLOW_ADMIN ? null : value })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FOLLOW_ADMIN}>跟随管理员设置</SelectItem>
                {IMAGE_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {imageType === 'custom' && (
              <Input
                placeholder="自定义代理前缀，如 https://proxy.example.com/?url="
                value={imageUrl}
                onChange={e => setOverride({ imageUrl: e.target.value })}
              />
            )}
          </div>
        }
      />
      {hasOverride && (
        <SettingsItem
          title="恢复默认"
          description="清除自己的豆瓣代理设置，重新跟随管理员设置。"
          control={
            <Button size="sm" variant="outline" onClick={() => resetOverride()}>
              恢复为管理员设置
            </Button>
          }
        />
      )}
    </SettingsSection>
  )
}
