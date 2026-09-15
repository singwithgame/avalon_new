import { escapeHtml } from '../../utils/domUtils.js';
import { QUEST_CAPACITY } from '../../logic/constants.js';

export function renderScoreboard(playData, totalPlayers, playersData) {
  let html = `<div class="scoreboard-bar"><div class="rounds-tracker">`;
  const results = playData.questResults || [];
  const details = playData.questDetails || [];
  
  for(let i = 0; i < 5; i++) {
    const qSize = QUEST_CAPACITY[totalPlayers][i];
    const failReq = (totalPlayers >= 7 && i === 3) ? 2 : 1;
    const result = results[i];
    const detail = details[i];
    
    let statusClass = 'pending';
    let icon = `${qSize}인`;
    let detailHtml = failReq === 2 ? `<span class="fails-tag" style="color: var(--evil-red);">(실패 2 이상)</span>` : '';
    
    if (result === 'success' || result === 'fail') {
      statusClass = result === 'success' ? 'good-win' : 'evil-win';
      icon = result === 'success' ? '🔵' : '🔴';
      detailHtml = `<span class="fails-tag" style="color: var(--text-main);">${detail.s}🔵 ${detail.f}🔴</span>`;
    }
    else if (i === playData.currentQuest) { 
      statusClass = 'active'; 
    }
    
    html += `
      <div class="round-badge ${statusClass}">
        <span class="round-num">${i+1}R</span>
        <span class="round-icon">${icon}</span>
        ${detailHtml}
      </div>
    `;
  }
  html += `</div></div>`;
  
  const shiftedOrder = [];
  const totalCount = playData.playerOrder.length;
  for (let j = 0; j < totalCount; j++) {
    const actualIndex = (playData.leaderIndex + j) % totalCount;
    shiftedOrder.push({ id: playData.playerOrder[actualIndex], isCurrent: j === 0 });
  }

  html += `
    <div class="leader-info-strip" style="flex-direction: column; align-items: stretch; gap: 10px;">
      <div style="display: flex; justify-content: space-between; width: 100%;">
        <div class="leader-badge"><span>원정대장 로테이션 순서</span></div>
        <div class="rejection-tracker ${playData.voteTrack >= 4 ? 'warn' : ''}">현재 부결: <b>${playData.voteTrack} / 5</b></div>
      </div>
      <div class="player-order-list" style="display: flex; gap: 5px; overflow-x: auto; padding-bottom: 5px;">
        ${shiftedOrder.map((p, idx) => `
          <div class="order-item ${p.isCurrent ? 'current-leader' : ''}">
            ${p.isCurrent ? '👑' : ''} ${escapeHtml(playersData[p.id].nickname)}
          </div>
          ${idx < shiftedOrder.length - 1 ? '<span style="color: var(--text-muted);">▶</span>' : ''}
        `).join('')}
      </div>
    </div>
  `;
  return html;
}
