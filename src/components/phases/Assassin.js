import { escapeHtml } from '../../utils/domUtils.js';
// src/components/phases/Assassin.js
import { ROLES } from '../../logic/constants.js';

export function renderAssassin(playData, playersData, myRole) {
  const isAssassin = myRole === ROLES.ASSASSIN;
  return `
    <div class="phase-box" style="border-color: var(--danger);">
      <h3 class="evil-text">🗡️ 암살자 단계</h3>
      ${isAssassin ? `
        <p>당신은 어쌔신입니다. 멀린을 지목하세요!</p>
        <select id="assassinTargetSelect" class="input-modern">
          <option value="">대상을 선택하세요</option>
          ${playData.playerOrder.map(id => {
            const targetRole = playersData[id].role;
            const evilRoles = [ROLES.ASSASSIN, ROLES.MORGANA, ROLES.MODRED, ROLES.OBERON, ROLES.MINION];
            if (evilRoles.includes(targetRole)) return '';
            return `<option value="${id}">${escapeHtml(playersData[id].nickname)}</option>`;
          }).join('')}
        </select>
        <div style="text-align: center; margin-top: 25px;">
          <button id="btnAssassinate" class="btn-danger btn-large" style="width: 100%; max-width: 300px; padding: 15px 0; font-size: 1.1rem;">암살 실행</button>
        </div>
      ` : `<p>어쌔신이 멀린을 암살하려 합니다. 대기하세요...</p>`}
    </div>
  `;
}

export function bindAssassinEvents(callbacks) {
  const btnAss = document.getElementById('btnAssassinate');
  const selAss = document.getElementById('assassinTargetSelect');
  if (btnAss) {
    btnAss.onclick = () => {
      if (selAss.value) callbacks.onAssassinate(selAss.value);
    };
  }
}
