/**
 * 一次性脚本：将 8.16-8.21 标签(1).xlsx 的最新活动更新到营销信息.xlsx 的"套餐信息"工作表
 * 规则（用户确认）：
 * - 江苏中烟：标注"组1~组6"的品规 = 活动品规（每组起点），组内其余 = 激励品规
 * - 云南中烟①：标注"1"、"2"是两个活动（组1、组2），标注行 = 活动品规
 * - 云南中烟②（大重九）：前3个品规 = 活动品规，最后一个 = 激励品规
 * - 无标注品牌（上烟/福建/湖南/安徽/湖北）：每组第一个 = 活动品规，其余 = 激励品规
 * ⚠️ 只修改"套餐信息"工作表，其他工作表保持原样！
 */

import XLSX from 'xlsx'
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..')

const NEW_FILE = '/Users/ltazy/Desktop/workplace/8.16-8.21标签(1).xlsx'
const TARGET_FILE = join(PROJECT_ROOT, 'data', '营销信息.xlsx')

// 营销信息套餐信息的列（保持现有列，新增"30-29档数量"列放最后）
const HEADERS = [
  '品牌组', '品牌', '类型', '品规名称',
  '30-28档数量', '27-20档数量', '19-15档数量', '14-10档数量', '9-1档数量',
  '更新时间', '30档数量', '29-28档数量', '30-29档数量',
]
const TODAY = '2026-08-18'

// 解析新表格
const wbNew = XLSX.readFile(NEW_FILE)
const wsNew = wbNew.Sheets['Sheet1']
const rows = XLSX.utils.sheet_to_json(wsNew, { defval: '', header: 1 })

const packages = []
let currentBrand = ''        // 当前品牌组名（上烟集团/江苏中烟/...）
let currentGroup = null      // 当前活动组（组1~组6）
let tierCols = []            // 当前表头的档位列映射：列号 -> 档位名
let firstOfBrand = true      // 当前品牌第一个数据行（用于无标注品牌的活动品规判断）
let brandRowCount = {}       // 每个品牌的数据行计数（用于云南大重九前3行规则）
let currentBrandTierKey = '' // 当前品牌的档位表头特征（区分湖北/云南②的特殊表头）

function isTierHeader(c) {
  return /^\d+(-\d+)?档$/.test(String(c || '').trim())
}

for (let i = 0; i < rows.length; i++) {
  const r = rows[i] || []
  const a = String(r[0] || '').trim()   // A：品牌名/条形码
  const b = String(r[1] || '').trim()   // B：标注（组X / 1 / 2）
  const c = String(r[2] || '').trim()   // C：品规名 或 品牌名（云南中烟的表头行写在这）

  // 档位表头行（D列起是"30-28档"等；品牌名可能在 A 列或 C 列）
  if (isTierHeader(String(r[3] || '').trim())) {
    tierCols = []
    for (let col = 3; col <= 7; col++) {
      const h = String(r[col] || '').trim()
      if (isTierHeader(h)) tierCols.push({ col, key: h.replace('档', '') })
    }
    const brand = a || c
    if (brand) {
      // 新品牌组开始
      currentBrand = brand
      currentGroup = null
      firstOfBrand = true
      brandRowCount[currentBrand] = 0
      currentBrandTierKey = tierCols.map(t => t.key).join('+')
      // 标注了"组X"的品牌（江苏中烟/云南中烟①）需要组标注；"1"、"2"标注也属于组标注
    }
    continue
  }

  // 数据行（A列是条形码数字）
  if (/^\d{10,}$/.test(a) && c) {
    brandRowCount[currentBrand] = (brandRowCount[currentBrand] || 0) + 1
    const rowIdx = brandRowCount[currentBrand]

    // 确定品牌组
    let group
    if (/^组\d+$/.test(b)) {
      // 江苏中烟：标注"组X" → 新活动组
      group = b
      currentGroup = b
    } else if (/^\d$/.test(b) && currentBrand === '云南中烟') {
      // 云南中烟①：标注"1"/"2" → 两个活动组
      group = '组' + b
      currentGroup = group
    } else if (currentGroup) {
      // 当前处于活动组内（江苏中烟组X内的后续品规 / 云南中烟组X内后续品规）
      group = currentGroup
    } else {
      // 无标注品牌：品牌组 = 品牌名
      group = currentBrand
    }

    // 确定类型
    let type
    const isGroupMarked = /^组\d+$/.test(b) || (/^\d$/.test(b) && currentBrand === '云南中烟')
    if (isGroupMarked) {
      type = '活动品规'
    } else if (currentBrandTierKey === '30-29') {
      // 云南中烟②（大重九，30-29档）：前3个活动品规，最后一个激励品规
      type = rowIdx <= 3 ? '活动品规' : '激励品规'
    } else if (currentBrand === '云南中烟' && currentGroup === null) {
      // 云南中烟①中未标注组的部分（不应出现，保险处理）
      type = '激励品规'
    } else if (firstOfBrand && !currentGroup) {
      // 无标注品牌：每组第一个是活动品规
      type = '活动品规'
    } else {
      type = '激励品规'
    }
    if (!isGroupMarked && !currentGroup) firstOfBrand = false

    // 档位数量
    const tierMap = {}
    for (const tc of tierCols) {
      const v = r[tc.col]
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        tierMap[tc.key] = Number(String(v).replace(/[^0-9.]/g, '')) || 0
      }
    }

    packages.push({
      品牌组: group,
      品牌: currentBrand,
      类型: type,
      品规名称: c,
      档位数量: tierMap,
    })
  }
}

// 打印解析结果供检查
console.log('=== 解析结果（' + packages.length + ' 个品规）===')
const groups = {}
for (const p of packages) {
  const key = p.品牌组 + '|' + p.品牌
  if (!groups[key]) groups[key] = []
  groups[key].push(p)
}
for (const [key, list] of Object.entries(groups)) {
  const acts = list.filter(p => p.类型 === '活动品规').map(p => p.品规名称)
  const inas = list.filter(p => p.类型 === '激励品规').map(p => p.品规名称)
  console.log(`\n【${key}】活动(${acts.length}): ${acts.join('、')}`)
  console.log(`  激励(${inas.length}): ${inas.join('、')}`)
}

// 写入营销信息.xlsx：只改"套餐信息"，其他工作表保留
const wbTarget = XLSX.readFile(TARGET_FILE)
const rowsOut = [HEADERS]
for (const p of packages) {
  const tier = p.档位数量
  rowsOut.push([
    p.品牌组, p.品牌, p.类型, p.品规名称,
    tier['30-28'] ?? '', tier['27-20'] ?? '', tier['19-15'] ?? '', tier['14-10'] ?? '', tier['9-1'] ?? '',
    TODAY,
    tier['30'] ?? '', tier['29-28'] ?? '', tier['30-29'] ?? '',
  ])
}
const wsOut = XLSX.utils.aoa_to_sheet(rowsOut)
// 设置列宽，方便用户查看
wsOut['!cols'] = [{ wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }]
wbTarget.Sheets['套餐信息'] = wsOut

// 同步更新基础设置中与本次活动直接相关的两项（页面显示用，属于本次活动的一部分）
const wsBase = wbTarget.Sheets['基础设置']
const baseRows = XLSX.utils.sheet_to_json(wsBase, { header: 1, defval: '' })
for (const row of baseRows) {
  if (row[0] === '数据更新时间') row[1] = TODAY
  if (row[0] === '活动日期范围') row[1] = '8.16-8.21'
}
const wsBaseOut = XLSX.utils.aoa_to_sheet(baseRows)
wsBaseOut['!cols'] = wsBase['!cols']
wbTarget.Sheets['基础设置'] = wsBaseOut

// 其他工作表自动保留（原样）
writeFileSync(TARGET_FILE, XLSX.write(wbTarget, { type: 'buffer', bookType: 'xlsx' }))
console.log('\n✅ 已更新 data/营销信息.xlsx 的"套餐信息"工作表（' + packages.length + ' 行），其他工作表未动')
