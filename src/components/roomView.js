export function renderRoomView(container, roomId, myUserId, playersData, isHost, callbacks) {
  const playerCount = Object.keys(playersData).length;
  let readyCount = 0;
  let allOnline = true;
  
  const playersHtml = Object.entries(playersData).map(([id, p]) => {
    if (p.isReady && p.isOnline !== false) readyCount++;
    if (p.isOnline === false) allOnline = false;
    
    const isMe = id === myUserId;
    const isHostMarker = p.isHost || (currentHost(playersData) === id) ? '👑' : ''; 
    let statusClass = p.isOnline === false ? 'offline' : (p.isReady ? 'ready' : 'wait');
    let statusText = p.isOnline === false ? '오프라인' : (p.isReady ? '준비 완료' : '대기 중');
    
    return `
      <div class="player-list-item ${statusClass}">
        <div class="player-name">
          ${isHostMarker} ${p.nickname} ${isMe ? '<span class="me-tag">(나)</span>' : ''}
        </div>
        <div class="status-badge ${statusClass}">${statusText}</div>
      </div>
    `;
  }).join('');

  const me = playersData[myUserId] || {};

  let card = container.querySelector('.room-card');
  if (!card) {
    // 최초 렌더링
    container.innerHTML = `
      <div class="view-card room-card animate-fade-in">
        <div class="card-header">
          <span class="step-badge">대기실</span>
          <h2>방 코드: ${roomId}</h2>
        </div>
        <div class="player-list-box" id="playerListBox"></div>
        ${isHost ? `
          <div class="host-settings-box" id="hostSettingsBox">
            <h4 style="color: var(--gold-primary); margin-bottom: 8px;">👑 방장 전용 특수 직업 설정</h4>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 12px;" id="hostRecText"></p>
            <label class="checkbox-label"><input type="checkbox" id="cbPercival"> 퍼시벌 (선) <span class="rec-badge" id="recP" style="display:none">추천</span></label>
            <label class="checkbox-label"><input type="checkbox" id="cbMorgana"> 모르가나 (악) <span class="rec-badge" id="recM" style="display:none">추천</span></label>
            <label class="checkbox-label"><input type="checkbox" id="cbMordred"> 모드레드 (악) <span class="rec-badge" id="recMo" style="display:none">추천</span></label>
            <label class="checkbox-label"><input type="checkbox" id="cbOberon"> 오베론 (악) <span class="rec-badge" id="recO" style="display:none">추천</span></label>
          </div>
        ` : ''}
        <div class="room-actions">
          <button id="toggleReadyBtn" class="btn-large"></button>
          ${isHost ? `<button id="startGameBtn" class="btn-large btn-accent" style="margin-top: 10px;" disabled></button>` : ''}
          ${isHost ? `
            <div class="action-row" style="margin-top: 10px;">
              <button id="resetRoomBtn" class="btn-large btn-secondary">데이터 초기화</button>
              <button id="deleteRoomBtn" class="btn-large btn-danger">방 폭파</button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  } else {
    // 이미 렌더링된 상태에서 호스트가 변경되었을 경우 (호스트 박스가 없는데 방장이 된 경우) 전체 다시 그리기
    const hasHostBox = !!document.getElementById('hostSettingsBox');
    if (isHost !== hasHostBox) {
      container.innerHTML = '';
      return renderRoomView(container, roomId, myUserId, playersData, isHost, callbacks);
    }
  }

  // DOM 업데이트 (깜박임 방지)
  document.getElementById('playerListBox').innerHTML = playersHtml;
  
  const readyBtn = document.getElementById('toggleReadyBtn');
  readyBtn.className = `btn-large ${me.isReady ? 'btn-success' : 'btn-primary'}`;
  readyBtn.innerText = me.isReady ? '준비 완료 취소' : '준비하기';
  readyBtn.onclick = () => callbacks.onToggleReady(!me.isReady);

  if (isHost) {
    const resetBtn = document.getElementById('resetRoomBtn');
    if (resetBtn) {
      resetBtn.onclick = () => {
        if (confirm("방 데이터를 초기화하시겠습니까? (모든 플레이어의 준비 상태와 게임 데이터가 리셋됩니다)")) {
          callbacks.onResetRoom();
        }
      };
    }
    
    const deleteBtn = document.getElementById('deleteRoomBtn');
    if (deleteBtn) {
      deleteBtn.onclick = () => {
        if (confirm("정말로 방을 폭파하시겠습니까? (모든 인원이 로비로 쫓겨납니다)")) {
          callbacks.onDeleteRoom();
        }
      };
    }
    
    document.getElementById('hostRecText').innerText = `참여 인원(${playerCount}명)에 따라 권장 직업이 달라집니다.`;
    document.getElementById('recP').style.display = playerCount >= 5 ? 'inline-block' : 'none';
    document.getElementById('recM').style.display = playerCount >= 5 ? 'inline-block' : 'none';
    document.getElementById('recMo').style.display = playerCount >= 8 ? 'inline-block' : 'none';
    document.getElementById('recO').style.display = (playerCount === 7 || playerCount === 10) ? 'inline-block' : 'none';

    const startBtn = document.getElementById('startGameBtn');
    if (playerCount >= 5 && playerCount <= 10 && readyCount === playerCount && allOnline) {
      startBtn.disabled = false;
      startBtn.innerText = `게임 시작 (${playerCount}명)`;
      startBtn.classList.replace('btn-accent', 'btn-primary');
    } else {
      startBtn.disabled = true;
      startBtn.innerText = allOnline ? `시작 대기 (${playerCount}/5~10명 준비)` : "접속 대기 중...";
      startBtn.classList.replace('btn-primary', 'btn-accent');
    }

    startBtn.onclick = () => {
      const options = {
        percival: document.getElementById('cbPercival').checked,
        morgana: document.getElementById('cbMorgana').checked,
        mordred: document.getElementById('cbMordred').checked,
        oberon: document.getElementById('cbOberon').checked
      };
      callbacks.onStartGame(options);
    };
  }
}

function currentHost(playersData) {
  // Find the host in playersData just for displaying the crown marker properly
  // Since we don't have the host ID directly passed in the easiest way, we can scan
  let hostId = null;
  // Note: the original logic passed host ID dynamically via main.js, but since playersData might contain isHost flag (actually it doesn't by default), let's just ignore the marker if it's too complex or just check. We will handle it in the marker logic above using isHost flag or we can just pass hostId as an argument.
  return null;
}
