/**
 * 标签活动模块
 * 客户从1-30档中选择自己的档位，展示对应活动品规
 * 显示"共X个活动"（按品牌组统计）
 */

import { escapeHtml } from '../utils.js'
import { getPackagesByTierNumber, getSettings } from '../data-service.js'
import { navigate } from '../router.js'

let selectedTier = ''

export function renderPackage(data) {
  const app = document.getElementById('app')
  if (!selectedTier) {
    selectedTier = '30'
  }
  renderPackageContent(app)
}

function renderPackageContent(app) {
  const products = getPackagesByTierNumber(Number(selectedTier))

  // 统计活动数量（按品牌组去重）
  const activityGroups = [...new Set(products.map(p => p.品牌组).filter(Boolean))]

  // 按品牌组分组（保持数据顺序）
  const groups = activityGroups

  // 档位按钮：30到1
  const tierButtons = []
  for (let t = 30; t >= 1; t--) {
    tierButtons.push(`
      <button class="btn ${String(selectedTier) === String(t) ? 'btn-primary' : 'btn-outline'}"
        onclick="selectTier('${t}')"
        style="
          flex: 0 0 calc(20% - 6px);
          padding: 8px 0;
          font-size: 13px;
          min-height: 38px;
        ">
        ${t}档
      </button>
    `)
  }

  app.innerHTML = `
    <div class="header">
      <div class="header-back" onclick="navigate('home')">← 返回</div>
      <div class="header-title">📦 标签活动</div>
    </div>

    <div class="page active">
      <!-- 活动日期 -->
      ${getSettings()['活动日期范围'] ? `
        <div style="
          text-align: center;
          font-size: 20px;
          font-weight: 600;
          color: var(--color-primary);
          padding: 14px 0 6px;
        ">
          ${getSettings()['活动日期范围']} 标签活动
        </div>
      ` : ''}

      <!-- 档位选择 -->
      <div class="card" style="padding: 14px;">
        <div style="font-size: 15px; font-weight: 600; margin-bottom: 10px;">
          请选择您的档位 <span style="font-size: 12px; color: #999; font-weight: normal;">（1-30档）</span>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
          ${tierButtons.join('')}
        </div>
      </div>

      ${selectedTier && products.length > 0 ? `
        <div style="font-size: 13px; color: #999; margin: 8px 0;">
          ${selectedTier}档 · 共 <strong style="color: var(--color-primary);">${activityGroups.length}</strong> 个活动
        </div>

        ${groups.map(group => {
          const items = products.filter(p => p.品牌组 === group)
          return `
            <div style="
              background: #fff;
              border-radius: 12px;
              margin-bottom: 12px;
              box-shadow: var(--shadow);
              overflow: hidden;
              border: 1px solid #ddd;
            ">
              <div style="
                padding: 10px 14px;
                background: #f5f5f5;
                font-size: 16px;
                font-weight: 600;
                color: #333;
                border-bottom: 1px solid #ddd;
              ">
                ${group.startsWith('组') ? escapeHtml(items[0].品牌) + ' · ' : ''}${escapeHtml(group)}
              </div>
              <div style="padding: 8px 14px 12px;">
                ${items.map(p => {
                  const isAct = p.类型 === '活动品规'
                  return `
                    <div style="
                      display: flex;
                      justify-content: space-between;
                      align-items: center;
                      padding: 10px 12px;
                      margin: 5px 0;
                      border-radius: 8px;
                      background: ${isAct ? '#d4edda' : '#fff'};
                      border: ${isAct ? 'none' : '1px solid #ddd'};
                    ">
                      <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 14px; font-weight: 500; color: #333;">
                          ${escapeHtml(p.品规名称)}
                        </div>
                        <div style="
                          display: inline-block;
                          margin-top: 4px;
                          padding: 1px 8px;
                          border-radius: 10px;
                          font-size: 11px;
                          font-weight: 500;
                          background: ${isAct ? '#c3e6cb' : '#e9ecef'};
                          color: ${isAct ? '#155724' : '#495057'};
                        ">
                          ${isAct ? '活动品规' : '激励品规'}
                        </div>
                      </div>
                      <div style="
                        flex-shrink: 0;
                        background: ${isAct ? '#c3e6cb' : '#e9ecef'};
                        padding: 4px 14px;
                        border-radius: 20px;
                        font-size: 15px;
                        font-weight: 600;
                        color: ${isAct ? '#155724' : '#495057'};
                        margin-left: 8px;
                      ">${p.数量}条</div>
                    </div>
                  `
                }).join('')}
              </div>
            </div>
          `
        }).join('')}

        <div class="legal-notice">
          ⚠️ 以上品规和数量以正式业务通知为准。
        </div>
      ` : selectedTier ? `
        <div class="empty-state">
          <div class="empty-state-icon">📦</div>
          <p>${selectedTier}档暂无可用活动</p>
        </div>
      ` : `
        <div class="empty-state">
          <div class="empty-state-icon">👆</div>
          <p>请先选择您的档位</p>
        </div>
      `}

      <div class="footer-notice">
        <p>具体活动内容以正式业务通知为准</p>
      </div>
    </div>
  `
}

window.selectTier = function(tier) {
  selectedTier = String(tier)
  const app = document.getElementById('app')
  renderPackageContent(app)
}
