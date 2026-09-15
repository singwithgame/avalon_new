import { escapeHtml } from '../../utils/domUtils.js';
// src/components/phases/TeamSelection.js
import { QUEST_CAPACITY } from '../../logic/constants.js';

export function renderTeamSelection(playData, playersData, myUserId) {
  const isLeader = playData.playerOrder[playData.leaderIndex] === myUserId;
  const currentQuestSize = QUEST_CAPACITY[playData.playerOrder.length][playData.currentQuest];
  
  return `
    <div class="phase-box">
      <h3>원정대 구성 ( ${currentQuestSize}명 필요 )</h3>
      ${isLeader ? `
        <p class="subtitle">당신은 원정대장입니다. 대원을 지목하세요.</p>
        <div id="teamSelectionGrid" class="selection-grid">
          ${playData.playerOrder.map(id => `
            <label class="select-label"><input type="checkbox" value="${id}" class="team-checkbox"> ${escapeHtml(playersData[id].nickname)}</label>
          `).join('')}
        </div>
        <div style="text-align: center; margin-top: 25px;">
          <button id="submitTeamBtn" class="btn-primary btn-large" style="width: 100%; max-width: 300px; padding: 15px 0; font-size: 1.1rem;" disabled>원정대 구성 완료</button>
        </div>
      ` : `
        <p class="subtitle">대장이 원정대원을 고르고 있습니다. 대기해주세요.</p>
      `}
    </div>
  `;
}

export function bindTeamSelectionEvents(playData, callbacks) {
  const checkboxes = document.querySelectorAll('.team-checkbox');
  const submitBtn = document.getElementById('submitTeamBtn');
  if (submitBtn) {
    const required = QUEST_CAPACITY[playData.playerOrder.length][playData.currentQuest];

    const updateSubmitBtn = () => {
      const checked = document.querySelectorAll('.team-checkbox:checked').length;
      if (submitBtn) submitBtn.disabled = checked !== required;
    };

    checkboxes.forEach(cb => {
      cb.addEventListener('change', updateSubmitBtn);
      cb.addEventListener('click', updateSubmitBtn);
    });

    updateSubmitBtn();
    submitBtn.onclick = () => {
      const teamIds = Array.from(document.querySelectorAll('.team-checkbox:checked')).map(cb => cb.value);
      callbacks.onSubmitTeam(teamIds);
    };
  }
}
