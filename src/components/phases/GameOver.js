import { escapeHtml } from '../../utils/domUtils.js';
// src/components/phases/GameOver.js
import { ROLES } from '../../logic/constants.js';

export function renderGameOver(playData, playersData, isHost) {
  const target = playData.assassinatedTarget;
  let winText = "";
  if (playData.voteTrack >= 5) winText = "투표 5연속 부결: 악 진영 승리!";
  else if ((playData.questResults||[]).filter(r=>r==='fail').length >= 3) winText = "원정 3회 실패: 악 진영 승리!";
  else if (target) {
    if (playersData[target].role === ROLES.MERLIN) winText = `멀린 암살 성공(${escapeHtml(playersData[target].nickname)}): 악 진영 역전승!`;
    else winText = `멀린 암살 실패(${escapeHtml(playersData[target].nickname)}): 선 진영 승리!`;
  } else winText = "선 진영 최종 승리!";
  
  return `
    <div class="phase-box">
      <h2 style="color: var(--gold-primary);">🏆 게임 종료</h2>
      <h3 style="margin-bottom: 20px;">${winText}</h3>
      <ul style="text-align: left; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px;">
        ${playData.playerOrder.map(id => `
          <li>${escapeHtml(playersData[id].nickname)} - <b>${playersData[id].role}</b></li>
        `).join('')}
      </ul>
      ${isHost ? `
        <div style="text-align: center; margin-top: 25px;">
          <button id="btnRestartGame" class="btn-primary btn-large glow-btn" style="width: 100%; max-width: 300px; padding: 15px 0; font-size: 1.1rem;">새 게임 준비 (대기실)</button>
        </div>
      ` : ''}
    </div>
  `;
}

export function bindGameOverEvents(callbacks) {
  const btnRestart = document.getElementById('btnRestartGame');
  if (btnRestart) btnRestart.onclick = () => callbacks.onRestart();
}
