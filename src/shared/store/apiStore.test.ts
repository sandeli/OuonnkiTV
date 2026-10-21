import { beforeEach, describe, expect, it } from 'vitest'
import { useApiStore } from './apiStore'
import { useAuthStore } from './authStore'

const SRC_A = '[{"id":"a","name":"源A","url":"https://a.example/api.php/provide/vod"}]'
const SRC_AB =
  '[{"id":"a","name":"源A","url":"https://a.example/api.php/provide/vod"},' +
  '{"id":"b","name":"源B","url":"https://b.example/api.php/provide/vod"}]'

function setAdminSources(value: string, managedSourceEnabled: Record<string, boolean> = {}) {
  useAuthStore.setState({
    authConfig: { initialVideoSources: value, managedSourceEnabled } as never,
  })
}

describe('apiStore 管理员托管源标记', () => {
  beforeEach(() => {
    useApiStore.setState({
      videoAPIs: [],
      managedSourceIds: [],
      managedTrackingVersion: 1,
      adFilteringEnabled: true,
    })
    setAdminSources('')
  })

  it('初始化后记录托管源 id', async () => {
    setAdminSources(SRC_AB)
    await useApiStore.getState().initializeEnvSources()
    const state = useApiStore.getState()
    expect(state.videoAPIs.map(s => s.id).sort()).toEqual(['a', 'b'])
    expect([...state.managedSourceIds].sort()).toEqual(['a', 'b'])
  })

  it('替换源文件后，同 id 的源按新文件内容更新', async () => {
    setAdminSources(SRC_AB)
    await useApiStore.getState().initializeEnvSources()
    const updated =
      '[{"id":"a","name":"源A改","url":"https://a2.example/api.php/provide/vod"}]'
    setAdminSources(updated)
    await useApiStore.getState().initializeEnvSources()
    const state = useApiStore.getState()
    expect(state.videoAPIs).toHaveLength(1)
    expect(state.videoAPIs[0].name).toBe('源A改')
    expect(state.videoAPIs[0].url).toBe('https://a2.example/api.php/provide/vod')
  })

  it('存量补标记：旧版本导入的残留源被清掉，手动添加的 uuid 源保留', async () => {
    // 模拟托管标记功能上线前就已存在的本地数据（无任何标记记录）
    useApiStore.setState({
      videoAPIs: [
        {
          id: 'stale1',
          name: '残留源',
          url: 'https://stale.example/api.php/provide/vod',
          detailUrl: 'https://stale.example/api.php/provide/vod',
          isEnabled: true,
          updatedAt: new Date(),
          timeout: 3000,
          retry: 3,
        } as never,
        {
          id: '123e4567-e89b-42d3-a456-426614174000',
          name: '手动源',
          url: 'https://manual.example/api.php/provide/vod',
          detailUrl: 'https://manual.example/api.php/provide/vod',
          isEnabled: true,
          updatedAt: new Date(),
          timeout: 3000,
          retry: 3,
        } as never,
      ],
      managedSourceIds: [],
      managedTrackingVersion: 0,
    })
    setAdminSources(SRC_A)
    await useApiStore.getState().initializeEnvSources()
    const ids = useApiStore.getState().videoAPIs.map(s => s.id)
    expect(ids).not.toContain('stale1')
    expect(ids).toContain('123e4567-e89b-42d3-a456-426614174000')
    expect(ids).toContain('a')
    expect(useApiStore.getState().managedSourceIds).toEqual(['a'])
  })

  it('管理员换源后，旧托管源被移除，用户自加源保留', async () => {
    setAdminSources(SRC_AB)
    await useApiStore.getState().initializeEnvSources()
    useApiStore.getState().importVideoAPIs([
      {
        id: 'mine',
        name: '我的源',
        url: 'https://mine.example/api.php/provide/vod',
        detailUrl: 'https://mine.example/api.php/provide/vod',
        isEnabled: true,
        updatedAt: new Date(),
        timeout: 3000,
        retry: 3,
      } as never,
    ])
    setAdminSources(SRC_A)
    await useApiStore.getState().initializeEnvSources()
    const state = useApiStore.getState()
    expect(state.videoAPIs.map(s => s.id).sort()).toEqual(['a', 'mine'])
    expect(state.managedSourceIds).toEqual(['a'])
  })

  it('管理员全站关掉的托管源对任何用户都不可用（本地开着也剔除）', async () => {
    setAdminSources(SRC_AB, { b: false })
    await useApiStore.getState().initializeEnvSources()
    // b 在源文件里默认开启、本地也是开启，但全站开关表关了它
    expect(useApiStore.getState().videoAPIs.find(s => s.id === 'b')?.isEnabled).toBe(true)
    expect(useApiStore.getState().getSelectedAPIs().map(s => s.id)).toEqual(['a'])
  })

  it('管理员全站打开文件里默认关闭的托管源后可用', async () => {
    const mixed =
      '[{"id":"a","name":"源A","url":"https://a.example/api.php/provide/vod"},' +
      '{"id":"b","name":"源B","url":"https://b.example/api.php/provide/vod","enabled":false}]'
    setAdminSources(mixed, { b: true })
    await useApiStore.getState().initializeEnvSources()
    expect(useApiStore.getState().getSelectedAPIs().map(s => s.id).sort()).toEqual(['a', 'b'])
  })

  it('批量启停只作用于指定 id', async () => {
    setAdminSources(SRC_AB)
    await useApiStore.getState().initializeEnvSources()
    useApiStore.getState().setVideoSourcesEnabled(['a'], false)
    const state = useApiStore.getState()
    expect(state.videoAPIs.find(s => s.id === 'a')?.isEnabled).toBe(false)
    expect(state.videoAPIs.find(s => s.id === 'b')?.isEnabled).toBe(true)
  })
})
