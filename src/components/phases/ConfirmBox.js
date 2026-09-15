import { escapeHtml } from '../../utils/domUtils.js';
// src/components/phases/ConfirmBox.js
export function renderConfirmBox(gameState, playData, myUserId, playersData, isHost) {
  const isConfirmed = playData.confirmations && playData.confirmations[myUserId];
  const unconfirmed = playData.playerOrder.filter(id => !playData.confirmations || !playData.confirmations[id]);
  const uNames = unconfirmed.map(id => playersData[id].nickname).join(', ');
  
  let headerHtml = "";
  if (gameState === 'vote_result') {
    const isPassed = playData.lastVoteResult.passed;
    headerHtml = `
      <h3>투표 결과: ${isPassed ? '<span class="good-text">승인됨</span>' : '<span class="evil-text">부결됨</span>'}</h3>
      <p>찬성 ${playData.lastVoteResult.approve} / 반대 ${playData.lastVoteResult.reject}</p>
    `;
  } else if (gameState === 'quest_result') {
    const isSuccess = playData.lastQuestResult.successStatus === 'success';
    headerHtml = `
      <h3>원정 결과: ${isSuccess ? '<span class="good-text">성공</span>' : '<span class="evil-text">실패</span>'}</h3>
      <p>성공 카드 ${playData.lastQuestResult.successCount}장 / 실패 카드 ${playData.lastQuestResult.failCount}장</p>
    `;
  }

  return `
    <div class="phase-box confirm-box">
      ${headerHtml}
      <hr style="border-color: #333; margin: 15px 0;">
      ${isConfirmed
        ? `<p class="good-text">다른 플레이어를 기다리는 중입니다... (${playData.playerOrder.length - unconfirmed.length}/${playData.playerOrder.length})</p>
           <p class="evil-text" style="font-size: 0.8rem; margin-top: 5px;">미확인: ${uNames}</p>`
        : `<div style="text-align: center;">
             <button id="btnConfirmPhase" class="btn-primary btn-large glow-btn" style="width: 100%; max-width: 300px; padding: 15px 0; font-size: 1.1rem;">결과 확인 완료</button>
           </div>
           <p class="evil-text" style="font-size: 0.8rem; margin-top: 10px;">미확인: ${uNames}</p>`
      }
    </div>
  `;
}

export function bindConfirmBoxEvents(callbacks) {
  const btnConfirm = document.getElementById('btnConfirmPhase');
  if (btnConfirm) btnConfirm.onclick = () => callbacks.onConfirmResult();
}
