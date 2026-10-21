import { AnnouncementBar } from '../components/AnnouncementBar'
import { AnnouncementPopup } from '../components/AnnouncementPopup'
import { ContinueWatching } from '../components/ContinueWatching'
import { DoubanHomeContent } from '../components/DoubanHomeContent'

/**
 * HomeView - 首页视图
 * 豆瓣分类墙：热门电影 / 热门剧集 / 热门综艺 / 热门动漫 / 豆瓣高分 / 经典电影
 * 点击任意海报按片名跳转站内聚合搜索各源
 */
export default function HomeView() {
  return (
    <div className="flex flex-col gap-6">
      {/* 滚动公告（环境变量 TGYS_ANNOUNCEMENT，未设置不显示） */}
      <AnnouncementBar />
      {/* 弹窗公告（管理员后台设置，每个版本只弹一次） */}
      <AnnouncementPopup />
      {/* 继续观看 */}
      <ContinueWatching />
      {/* 豆瓣分类墙 */}
      <DoubanHomeContent />
    </div>
  )
}
