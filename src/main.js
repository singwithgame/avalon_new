import { api } from './api/firebaseApp.js';
import { generateRoles, initializePlayData, calculateTeamVoteResult, calculateQuestResult } from './logic/gameLogic.js';
import { ALIGNMENT_RATIO, ROLES } from './logic/constants.js';
import { generateMarkdownHistory } from './logic/markdownGen.js';
import * as cryptoUtils from './logic/crypto.js';
import { GameController } from './logic/GameController.js';
import { renderLobbyView } from './components/lobbyView.js';
import { renderHistoryView } from './components/historyView.js';
import { renderRoomView } from './components/roomView.js';
import { renderGamePhase } from './components/phases/GamePhaseManager.js';

const viewContainer = document.getElementById('view-container');
const headerStatus = document.querySelector('.header-phase-pill');
const modalOverlay = document.getElementById('modal-overlay');
const modalBody = document.getElementById('modal-body');

let appState = {
  view: 'lobby', // 'lobby', 'history', 'room', 'game'
  roomId: null,
  myUserId: null,
  myNickname: null,
  isHost: false,
  playersData: {},
  gameState: 'lobby',
  playData: null,
  historyItems: [],
  cryptoKeyPair: null,

  historyLastKey: null,
  historyLastKey: null,
  hasMoreHistory: true,
  isLoadingHistory: false
};

const gameController = new GameController(api, () => appState);

let isProcessingTransition = false;
let heartbeatInterval = null;

function init() {
  api.cleanupOldRooms();
  
  // 세션 복구
  const savedSession = localStorage.getItem('avalon_session');
  if (savedSession) {
    const sessionData = JSON.parse(savedSession);
    api.getRoom(sessionData.roomId).then(room => {
      if (room && room.players && room.players[sessionData.userId]) {
        appState.roomId = sessionData.roomId;
        appState.myUserId = sessionData.userId;
        appState.myNickname = sessionData.nickname;
        startRoomSync();
      } else {
        localStorage.removeItem('avalon_session');
        renderLobby();
      }
    });
  } else {
    renderLobby();
  }
}

function updateHeader() {
  if (appState.view === 'lobby') headerStatus.innerText = '로비 (대기실)';
  else if (appState.view === 'history') headerStatus.innerText = '과거 기록 보관소';
  else if (appState.view === 'room') headerStatus.innerText = `접속 중 [${appState.roomId}]`;
  else headerStatus.innerText = `게임 진행 중 [${appState.roomId}]`;
}

// ========================
// Views Navigation
// ========================
function renderLobby() {
  appState.view = 'lobby';
  updateHeader();
  renderLobbyView(viewContainer, {
    onJoin: async (nickname, roomCode) => {
      const room = await api.getRoom(roomCode);
      if (!room) return alert("존재하지 않는 방입니다.");
      if (room.gameState !== 'lobby') return alert("이미 게임이 진행 중입니다.");
      
      const keyPair = await cryptoUtils.generateKeyPair();
      const pubKeyPem = await cryptoUtils.exportPublicKey(keyPair.publicKey);
      appState.cryptoKeyPair = keyPair;
      
      const userId = 'p_' + Date.now() + Math.floor(Math.random()*1000);
      await api.joinRoom(roomCode, userId, nickname, pubKeyPem);
      
      localStorage.setItem('avalon_session', JSON.stringify({ roomId: roomCode, userId, nickname }));
      appState.roomId = roomCode;
      appState.myUserId = userId;
      appState.myNickname = nickname;
      startRoomSync();
    },
    onCreateRoom: (nickname) => {
      modalBody.innerHTML = `
        <h3 style="color: var(--gold-primary); margin-top:0;">방 생성 권한 확인</h3>
        <p style="font-size: 0.9rem; margin-bottom: 15px;">관리자 비밀번호를 입력하세요.</p>
        <input type="password" id="adminPwd" class="input-modern" style="text-align: center; letter-spacing: 5px;">
        <div class="action-row" style="margin-top: 15px;">
          <button id="btnConfirmPwd" class="btn-primary">확인</button>
          <button id="btnCancelPwd" class="btn-danger">취소</button>
        </div>
      `;
      modalOverlay.classList.remove('hidden');
      
      const pwdInput = document.getElementById('adminPwd');
      pwdInput.focus();
      pwdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('btnConfirmPwd').click();
      });

      document.getElementById('btnCancelPwd').onclick = () => modalOverlay.classList.add('hidden');
      document.getElementById('btnConfirmPwd').onclick = async () => {
        const pwd = document.getElementById('adminPwd').value;
        const newCode = Math.floor(1000 + Math.random() * 9000).toString();
        const success = await api.createRoom(newCode, pwd);
        if (success) {
          modalOverlay.classList.add('hidden');
          
          const keyPair = await cryptoUtils.generateKeyPair();
          const pubKeyPem = await cryptoUtils.exportPublicKey(keyPair.publicKey);
          appState.cryptoKeyPair = keyPair;
          
          // 방 생성 성공 즉시 방장으로 자동 접속
          const userId = 'p_' + Date.now() + Math.floor(Math.random()*1000);
          await api.joinRoom(newCode, userId, nickname, pubKeyPem);
          
          localStorage.setItem('avalon_session', JSON.stringify({ roomId: newCode, userId, nickname }));
          appState.roomId = newCode;
          appState.myUserId = userId;
          appState.myNickname = nickname;
          startRoomSync();
        } else {
          alert("방 생성에 실패했습니다. 비밀번호를 확인해주세요.");
        }
      };
    },
    onOpenHistory: () => {
      modalBody.innerHTML = `
        <h3 style="color: var(--gold-primary); margin-top:0;">게임 기록 조회 권한</h3>
        <p style="font-size: 0.9rem; margin-bottom: 15px;">관리자 비밀번호를 입력하세요.</p>
        <input type="password" id="historyPwd" class="input-modern" style="text-align: center; letter-spacing: 5px;">
        <div class="action-row" style="margin-top: 15px;">
          <button id="btnConfirmHistoryPwd" class="btn-primary">확인</button>
          <button id="btnCancelHistoryPwd" class="btn-danger">취소</button>
        </div>
      `;
      modalOverlay.classList.remove('hidden');
      
      const historyPwdInput = document.getElementById('historyPwd');
      historyPwdInput.focus();
      historyPwdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('btnConfirmHistoryPwd').click();
      });
      
      document.getElementById('btnCancelHistoryPwd').onclick = () => modalOverlay.classList.add('hidden');
      document.getElementById('btnConfirmHistoryPwd').onclick = async () => {
        const pwd = document.getElementById('historyPwd').value;
        if (!pwd) return alert("비밀번호를 입력하세요.");
        
        const isValid = await api.verifyAdmin(pwd);
        if (!isValid) {
          alert("비밀번호가 일치하지 않거나 조회 권한이 없습니다.");
          return;
        }
        
        modalOverlay.classList.add('hidden');
        
        appState.view = 'history';
        updateHeader();
        
        appState.historyItems = [];
        appState.historyLastKey = null;
        appState.hasMoreHistory = true;
        appState.isLoadingHistory = false;

        const refreshHistoryView = (isInitial = false) => {
          if (appState.view !== 'history') return;
          renderHistoryView(viewContainer, appState.historyItems, {
            onClose: () => { appState.historyItems = []; renderLobby(); },
            onDelete: async (id) => {
              await api.deleteGameHistory(id);
              appState.historyItems = appState.historyItems.filter(([key]) => key !== id);
              refreshHistoryView(true);
            },
            onLoadMore: async () => {
              if (appState.isLoadingHistory || !appState.hasMoreHistory) return;
              appState.isLoadingHistory = true;
              try {
                const data = await api.fetchHistoryPage(10, appState.historyLastKey);
                let entries = Object.entries(data).sort((a, b) => a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0));
                if (appState.historyLastKey) {
                  entries = entries.filter(([key]) => key !== appState.historyLastKey);
                }
                if (entries.length === 0) {
                  appState.hasMoreHistory = false;
                } else {
                  entries.reverse();
                  appState.historyLastKey = entries[entries.length - 1][0];
                  appState.historyItems.push(...entries);
                }
                refreshHistoryView(false);
              } finally {
                appState.isLoadingHistory = false;
              }
            },
            hasMore: appState.hasMoreHistory,
            isInitial: isInitial
          });
        };

      appState.isLoadingHistory = true;
      // 처음에 로딩 표시를 위해 빈 상태로 렌더링
      refreshHistoryView(true);
      
      try {
        const data = await api.fetchHistoryPage(10);
        let entries = Object.entries(data).sort((a, b) => a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0));
        if (entries.length < 10) appState.hasMoreHistory = false;
        entries.reverse();
        if (entries.length > 0) {
          appState.historyLastKey = entries[entries.length - 1][0];
          appState.historyItems = entries;
        }
        refreshHistoryView(true);
      } catch (err) {
        console.error("Failed to fetch history:", err);
        alert("게임 기록을 불러오는 중 오류가 발생했습니다: " + err.message);
      } finally {
        appState.isLoadingHistory = false;
      }
      };
    }
  });
}

function startRoomSync() {
  api.unsubscribeAll();
  api.setupPresence(appState.roomId, appState.myUserId);

  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    if (appState.roomId && appState.myUserId) api.updateHeartbeat(appState.roomId, appState.myUserId);
  }, 2500);

  api.subscribeToHost(appState.roomId, (hostId) => {
    appState.currentHostId = hostId;
    appState.isHost = hostId === appState.myUserId;
    refreshCurrentView();
  });

  api.subscribeToPlayers(appState.roomId, async (players) => {
    const oldPlayers = appState.playersData || {};
    const newPlayers = players || {};
    
    let changed = false;
    const oldKeys = Object.keys(oldPlayers);
    const newKeys = Object.keys(newPlayers);
    if (oldKeys.length !== newKeys.length) changed = true;
    else {
      for (const key of newKeys) {
        if (!oldPlayers[key] ||
            oldPlayers[key].isOnline !== newPlayers[key].isOnline ||
            oldPlayers[key].isReady !== newPlayers[key].isReady ||
            oldPlayers[key].role !== newPlayers[key].role ||
            oldPlayers[key].nickname !== newPlayers[key].nickname ||
            JSON.stringify(oldPlayers[key].encryptedRole) !== JSON.stringify(newPlayers[key].encryptedRole)) {
          changed = true;
          break;
        }
      }
    }

    appState.playersData = newPlayers;
    api.claimHost(appState.roomId, appState.currentHostId, appState.myUserId, appState.playersData);
    
    // 복호화 로직 (내 암호화된 직업 정보가 있다면)
    const myData = appState.playersData[appState.myUserId];
    if (myData && myData.encryptedRole && appState.cryptoKeyPair && !appState.myDecryptedRole) {
      const decrypted = await cryptoUtils.decryptData(appState.cryptoKeyPair.privateKey, myData.encryptedRole);
      if (decrypted) {
        appState.myDecryptedRole = decrypted.role;
        appState.myDecryptedSecrets = decrypted.secretList;
        changed = true; // 복호화 완료 시 화면 갱신
      }
    }

    // 만약 내가 방에서 튕겼다면 로비로 쫓겨남
    if (!appState.playersData[appState.myUserId]) {
      api.unsubscribeAll();
      localStorage.removeItem('avalon_session');
      renderLobby();
      return;
    }
    
    if (changed) {
      refreshCurrentView();
    }
  });

  api.subscribeToGameState(appState.roomId, (state) => {
    if (!state) return;
    appState.gameState = state;
    appState.view = state === 'lobby' ? 'room' : 'game';
    
    checkAndSaveHistory();
    
    updateHeader();
    refreshCurrentView();
  });

  api.subscribeToPlayData(appState.roomId, (pData) => {
    appState.playData = pData;
    
    if (pData && appState.gameState !== 'lobby' && appState.isHost && !isProcessingTransition) {
      const total = pData.playerOrder?.length || 0;
      
      if (pData.confirmations && Object.keys(pData.confirmations).length === total) {
        isProcessingTransition = true;
        setTimeout(() => {
          gameController.handlePhaseTransition(appState.gameState, pData).then(() => isProcessingTransition = false);
        }, 1000);
      }
      else if (appState.gameState === 'team_voting' && pData.votes && Object.keys(pData.votes).length === total) {
        isProcessingTransition = true;
        setTimeout(() => {
          gameController.processTeamVotes().then(() => isProcessingTransition = false);
        }, 500);
      }
      else if (appState.gameState === 'quest_voting' && pData.questVotes && pData.proposedTeam && Object.keys(pData.questVotes).length === pData.proposedTeam.length) {
        isProcessingTransition = true;
        setTimeout(() => {
          gameController.processQuestVotes().then(() => isProcessingTransition = false);
        }, 1000);
      }
    }
    checkAndSaveHistory();
    refreshCurrentView();
  });
}

function checkAndSaveHistory() {
  if (appState.gameState === 'game_over' && appState.isHost && appState.playData && !appState.playData.historySaved) {
    const succCount = (appState.playData.questResults || []).filter(r => r === 'success').length;
    // 선팀이 3번 성공하여 암살 단계로 넘어간 경우, 암살 내역(assassinatedTarget)이 확실히 도착할 때까지 대기
    if (succCount >= 3 && !appState.playData.assassinatedTarget) {
      return; 
    }
    gameController.handleGameOver();
  }
}

function refreshCurrentView() {
  if (appState.view === 'room') {
    renderRoomView(viewContainer, appState.roomId, appState.myUserId, appState.playersData, appState.isHost, {
      onToggleReady: (val) => api.setPlayerReady(appState.roomId, appState.myUserId, val),
      onResetRoom: async () => {
        const playerIds = Object.keys(appState.playersData);
        for (let id of playerIds) {
          await api.setPlayerReady(appState.roomId, id, false);
        }
        await api.updateRoot({
          [`rooms/${appState.roomId}/playData`]: null,
          [`rooms/${appState.roomId}/gameState`]: 'lobby'
        });
      },
      onDeleteRoom: async () => {
        await api.updateRoot({
          [`rooms/${appState.roomId}`]: null
        });
      },
      onStartGame: async (options) => {
        await gameController.startGame(options);
      }
    });
  } else if (appState.view === 'game') {
    renderGamePhase(viewContainer, appState.gameState, appState.playData, appState.myUserId, appState.playersData, appState.isHost, appState.myDecryptedRole, appState.myDecryptedSecrets, {
      onSubmitTeam: (teamIds) => {
        const tlItem = { type: 'team_proposed', leaderId: appState.myUserId, team: teamIds, attempt: (appState.playData.voteTrack || 0) + 1 };
        const tl = [...(appState.playData.timeline || []), tlItem];
        api.updatePlayData(appState.roomId, { proposedTeam: teamIds, timeline: tl });
        api.updateGameState(appState.roomId, 'team_voting');
      },
      onTeamVote: (voteStr) => {
        api.updatePlayData(appState.roomId, { [`votes/${appState.myUserId}`]: voteStr });
      },
      onQuestVote: async (voteStr) => {
        const roomPubKey = appState.playData?.roomPublicKey;
        if (roomPubKey) {
          const encVote = await cryptoUtils.encryptData(roomPubKey, voteStr);
          api.updatePlayData(appState.roomId, { [`questVotes/${appState.myUserId}`]: encVote });
        } else {
          // Fallback if no roomPublicKey (legacy)
          const hostPubKey = appState.playersData[appState.currentHostId]?.publicKey;
          if (hostPubKey) {
            const encVote = await cryptoUtils.encryptData(hostPubKey, voteStr);
            api.updatePlayData(appState.roomId, { [`questVotes/${appState.myUserId}`]: encVote });
          }
        }
      },
      onConfirmResult: () => {
        api.submitConfirmation(appState.roomId, appState.myUserId);
      },
      onAssassinate: (targetId) => {
        const assassinId = appState.myUserId;
        const success = appState.playersData[targetId].role === ROLES.MERLIN;
        
        const updates = { assassinatedTarget: targetId };
        const tlItem = { type: 'assassination', assassinId, targetId, success };
        const tl = [...(appState.playData.timeline || []), tlItem];
        updates.timeline = tl;
        
        api.updatePlayData(appState.roomId, updates);
        api.updateGameState(appState.roomId, 'game_over');
      },
      onRestart: () => {
        handleRestart();
      }
    });
  }
}

// ========================
// State Transitions (Host Only)
// (Moved to GameController.js)
// ========================

async function handleRestart() {
  appState.myDecryptedRole = null;
  appState.myDecryptedSecrets = null;
  Object.keys(appState.playersData).forEach(id => {
    api.setPlayerReady(appState.roomId, id, false);
  });
  await api.updateGameState(appState.roomId, 'lobby');
}

// Start
document.addEventListener('DOMContentLoaded', init);
