import { escapeHtml } from '../../utils/domUtils.js';
// src/components/phases/TeamVoting.js
export function renderTeamVoting(playData, myUserId, playersData) {
  return `
    <div class="phase-box">
      <h3>🗳️ 원정대 찬반 투표</h3>
      <p>제안된 원정대: <b>${playData.proposedTeam.map(id => playersData[id].nickname).join(', ')}</b></p>
      <div class="action-row" style="margin-top: 20px; gap: 15px; display: flex;">
        <button id="btnVoteApprove" class="btn-success" style="padding: 20px 10px; font-size: 1.2rem; flex: 1;">👍 찬성</button>
        <button id="btnVoteReject" class="btn-danger" style="padding: 20px 10px; font-size: 1.2rem; flex: 1;">👎 반대</button>
      </div>
      <p id="voteWaitText" style="margin-top: 10px; color: var(--text-muted); display: none;">투표 완료. 다른 플레이어를 기다립니다...</p>
    </div>
  `;
}

export function bindTeamVotingEvents(callbacks) {
  const btnApprove = document.getElementById('btnVoteApprove');
  const btnReject = document.getElementById('btnVoteReject');
  const waitText = document.getElementById('voteWaitText');
  if (btnApprove) btnApprove.onclick = () => { 
    callbacks.onTeamVote('approve'); 
    btnApprove.disabled=true; 
    btnReject.disabled=true; 
    waitText.style.display='block'; 
  };
  if (btnReject) btnReject.onclick = () => { 
    callbacks.onTeamVote('reject'); 
    btnApprove.disabled=true; 
    btnReject.disabled=true; 
    waitText.style.display='block'; 
  };
}
