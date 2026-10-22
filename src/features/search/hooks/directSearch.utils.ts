import type { VideoSource } from '@tgys/cms-core'

export interface SourcePaginationInfo {
  totalPages: number
  totalResults: number
}

export function getSourcesToFetch(
  selectedAPIs: VideoSource[],
  cachedSources: Map<string, SourcePaginationInfo>,
  page: number,
): VideoSource[] {
  return selectedAPIs.filter(source => {
    const cached = cachedSources.get(source.id)
    if (!cached) return true
    return page <= cached.totalPages
  })
}

/** 归一化文本用于标题匹配：全角转半角、小写、去掉空白与常见标点 */
export function normalizeForMatch(text: string): string {
  return text
    .replace(/[０-９ａ-ｚＡ-Ｚ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .toLowerCase()
    .replace(/[\s·•・:：\-—_()（）【】[\]《》"“”'‘’.,，。!！?？/\\|]/g, '')
}

/** 繁→简常用字映射（片名高频字子集）：源站常返回繁体标题，匹配前先归一 */
const TRAD_TO_SIMP: Record<string, string> = {
  體: '体', 劇: '剧', 員: '员', 國: '国', 學: '学', 們: '们', 這: '这', 裡: '里', 點: '点',
  開: '开', 關: '关', 東: '东', 車: '车', 馬: '马', 風: '风', 雲: '云', 龍: '龙', 鳳: '凤',
  飛: '飞', 黃: '黄', 樂: '乐', 長: '长', 門: '门', 問: '问', 間: '间', 陽: '阳', 陰: '阴',
  隊: '队', 陸: '陆', 軍: '军', 後: '后', 來: '来', 現: '现', 時: '时', 實: '实', 會: '会',
  個: '个', 為: '为', 對: '对', 進: '进', 遠: '远', 運: '运', 還: '还', 邊: '边', 達: '达',
  連: '连', 過: '过', 適: '适', 選: '选', 鄉: '乡', 醫: '医', 鐵: '铁', 銀: '银', 錢: '钱',
  鋼: '钢', 鏡: '镜', 鐘: '钟', 閃: '闪', 閉: '闭', 隱: '隐', 隨: '随', 險: '险', 難: '难',
  雙: '双', 電: '电', 視: '视', 頻: '频', 聲: '声', 聽: '听', 書: '书', 畫: '画', 寫: '写',
  讀: '读', 語: '语', 說: '说', 話: '话', 誰: '谁', 謝: '谢', 貝: '贝', 貴: '贵', 買: '买',
  賣: '卖', 質: '质', 貧: '贫', 貪: '贪', 賢: '贤', 賞: '赏', 賽: '赛', 軟: '软', 輕: '轻',
  較: '较', 輔: '辅', 輸: '输', 轉: '转', 辦: '办', 歷: '历', 壓: '压', 厭: '厌', 發: '发',
  參: '参', 臺: '台', 萬: '万', 喬: '乔', 魯: '鲁', 顧: '顾', 湯: '汤', 馮: '冯', 盧: '卢',
  韓: '韩', 鄭: '郑', 鄧: '邓', 羅: '罗', 麼: '么', 於: '于', 隻: '只', 讓: '让', 應: '应',
  廣: '广', 慶: '庆', 寶: '宝', 麗: '丽', 榮: '荣', 衛: '卫', 劉: '刘', 傳: '传', 倫: '伦',
  偉: '伟', 傑: '杰', 俠: '侠', 劍: '剑', 戰: '战', 鬥: '斗', 殺: '杀', 戀: '恋', 愛: '爱',
  夢: '梦', 靈: '灵', 熱: '热', 爭: '争', 爾: '尔', 獨: '独', 獸: '兽', 獻: '献', 蘇: '苏',
  葉: '叶', 楊: '杨', 張: '张', 孫: '孙', 吳: '吴', 呂: '吕', 歐: '欧', 龔: '龚', 蔣: '蒋',
  乾: '干', 坤: '坤', 壇: '坛', 場: '场', 塊: '块', 壞: '坏', 報: '报', 夠: '够', 奧: '奥',
  妝: '妆', 媽: '妈', 娛: '娱',
}

const CN_DIGITS: Record<string, number> = {
  零: 0, 〇: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
}

/** 解析中文数字（支持十/百组合，如 十二=12、二十三=23、一百零五=105）；无法解析返回 null */
function parseChineseNumeral(text: string): number | null {
  if (/^\d+$/.test(text)) return Number.parseInt(text, 10)
  let total = 0
  let current = 0
  let has = false
  for (const ch of text) {
    if (ch in CN_DIGITS) {
      current = CN_DIGITS[ch]
      has = true
    } else if (ch === '十') {
      total += (current || 1) * 10
      current = 0
      has = true
    } else if (ch === '百') {
      total += (current || 1) * 100
      current = 0
      has = true
    } else {
      return null
    }
  }
  return has ? total + current : null
}

/**
 * 宽松归一化：在严格归一化之上做繁→简、第X季/部/集的中文数字转阿拉伯数字、
 * 其余中文数字单字转数字。让「庆余年2 ↔ 庆余年第二季」「三体 ↔ 三體」能对上。
 */
function normalizeLoose(text: string): string {
  let out = normalizeForMatch(text)
  out = out.replace(/第([零〇一二三四五六七八九十百\d]+)[季部集]/g, (whole, num: string) => {
    const parsed = parseChineseNumeral(num)
    return parsed === null ? whole : String(parsed)
  })
  out = Array.from(out, ch => TRAD_TO_SIMP[ch] ?? (ch in CN_DIGITS ? String(CN_DIGITS[ch]) : ch)).join('')
  return out
}

const isAlnumChar = (ch: string | undefined) => !!ch && /[a-z0-9]/.test(ch)

/**
 * 前缀匹配需满足「词边界」：紧跟在匹配片段后面的字符若仍是字母/数字，
 * 且片段末尾也是字母/数字，说明片段只是更长数字/字母串的一部分（如搜 12 命中 1234），不算命中。
 */
function startsWithAtBoundary(longer: string, prefix: string): boolean {
  if (!longer.startsWith(prefix)) return false
  if (longer.length === prefix.length) return true
  return !(isAlnumChar(longer[prefix.length]) && isAlnumChar(prefix[prefix.length - 1]))
}

/** 包含匹配同样要满足两侧边界（任一出现位置满足即可） */
function includesAtBoundary(text: string, needle: string): boolean {
  let idx = text.indexOf(needle)
  while (idx !== -1) {
    const beforeOk = idx === 0 || !(isAlnumChar(text[idx - 1]) && isAlnumChar(needle[0]))
    const afterIdx = idx + needle.length
    const afterOk =
      afterIdx >= text.length ||
      !(isAlnumChar(text[afterIdx]) && isAlnumChar(needle[needle.length - 1]))
    if (beforeOk && afterOk) return true
    idx = text.indexOf(needle, idx + 1)
  }
  return false
}

function tierOfForm(t: string, q: string): number {
  if (!t || !q) return 3
  if (t === q) return 0
  if (startsWithAtBoundary(t, q) || startsWithAtBoundary(q, t)) return 1
  if (includesAtBoundary(t, q) || includesAtBoundary(q, t)) return 2
  return 3
}

/**
 * 标题与搜索词的匹配档位（越小越精准）：
 * 0 = 完全一致；1 = 一方以另一方开头（如带季数/年份后缀）；2 = 互相包含；3 = 无直接关系（源接口模糊匹配带回的）
 * 在严格与宽松两种归一化下各算一次取更优：宽松处理繁简与中文数字，边界规则剔除数字/字母片段误命中。
 */
export function getTitleMatchTier(title: string, query: string): number {
  const strict = tierOfForm(normalizeForMatch(title), normalizeForMatch(query))
  if (strict === 0) return 0
  const loose = tierOfForm(normalizeLoose(title), normalizeLoose(query))
  return Math.min(strict, loose)
}
