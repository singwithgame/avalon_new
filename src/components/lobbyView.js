import { escapeHtml } from '../utils/domUtils.js';
export function renderLobbyView(container, callbacks) {
  container.innerHTML = `
    <div class="view-card animate-fade-in">
      <div class="card-header">
        <h2>🏰 아발론 접속</h2>
        <p class="subtitle">이름과 방 코드를 입력하세요.</p>
      </div>
      
      <div class="section-block">
        <input type="text" id="nicknameInput" class="input-modern" placeholder="닉네임 입력 (최대 8자)" maxlength="8" />
        <input type="text" id="roomCodeInput" class="input-modern" placeholder="방 코드 4자리" maxlength="4" />
      </div>

      <div class="setup-actions">
        <button id="joinRoomBtn" class="btn-primary btn-large">방 입장하기</button>
      </div>

      <div class="divider"></div>
      
      <div class="action-row">
        <button id="createRoomBtn" class="btn-outline btn-sm">방 만들기</button>
        <button id="openHistoryBtn" class="btn-outline btn-sm">게임 기록 조회</button>
      </div>
    </div>
  `;

  document.getElementById('nicknameInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('roomCodeInput').focus();
  });
  document.getElementById('roomCodeInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('joinRoomBtn').click();
  });

  document.getElementById('joinRoomBtn').onclick = () => {
    const nick = document.getElementById('nicknameInput').value.trim();
    const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    if (!nick || !code) return alert("닉네임과 방 코드를 입력해주세요.");
    callbacks.onJoin(nick, code);
  };

  document.getElementById('createRoomBtn').onclick = () => {
    const nick = document.getElementById('nicknameInput').value.trim();
    if (!nick) return alert("방장이 사용할 닉네임을 먼저 입력해주세요.");
    callbacks.onCreateRoom(nick);
  };
  document.getElementById('openHistoryBtn').onclick = () => callbacks.onOpenHistory();
}
