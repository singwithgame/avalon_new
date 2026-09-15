import { db } from "../../firebase-config.js";
import { 
  ref, set, get, onValue, update, onDisconnect, 
  query, orderByChild, endAt, push, runTransaction, serverTimestamp, limitToLast, orderByKey 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

class FirebaseAPI {
  constructor() {
    this.db = db;
    this.listeners = {};
    this.serverTimeOffset = 0;
    
    // 서버 시간 동기화
    onValue(ref(this.db, '.info/serverTimeOffset'), (snap) => {
      this.serverTimeOffset = snap.val() || 0;
    });
  }

  // --- Connection & Online Tracking ---
  setupPresence(roomId, userId) {
    const connectedRef = ref(this.db, '.info/connected');
    const myOnlineRef = ref(this.db, `rooms/${roomId}/players/${userId}/isOnline`);
    
    // 리스너 추적
    if (this.listeners['presence']) this.listeners['presence']();
    this.listeners['presence'] = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        onDisconnect(myOnlineRef).set(false);
        set(myOnlineRef, true);
      }
    });
  }

  updateHeartbeat(roomId, userId) {
    return update(ref(this.db, `rooms/${roomId}/players/${userId}`), { 
      lastActive: serverTimestamp() 
    });
  }

  // --- Room Operations ---
  async getRoom(roomId) {
    const snapshot = await get(ref(this.db, `rooms/${roomId}`));
    return snapshot.exists() ? snapshot.val() : null;
  }

  async checkAdminPassword(roomId, adminKey) {
    // 룸이 생성될 때 adminKey를 같이 넣게 되며, 클라이언트는 이를 통해 쓰기 권한을 얻음
    // 보안 규칙에 의해 틀린 adminKey로 쓰기를 시도하면 권한 거부됨
    return true; // 클라이언트 단 검증보다는 쓰기 시도시 에러로 캐치
  }

  async createRoom(roomId, adminKey) {
    // DB 룰에 의해 adminKey가 맞아야 생성 가능
    try {
      await set(ref(this.db, `rooms/${roomId}`), {
        createdAt: serverTimestamp(),
        adminKey: adminKey,
        gameState: 'lobby'
      });
      return true;
    } catch (error) {
      console.error("방 생성 실패 (비밀번호 오류 또는 권한 없음):", error);
      return false;
    }
  }

  async verifyAdmin(adminKey) {
    // 더미 방 무한 생성에 따른 DB 폭발을 막기 위해 단일 테스트 노드만 덮어쓰기 방식으로 검증
    try {
      const testRef = ref(this.db, `rooms/admin_test_room`);
      await set(testRef, {
        createdAt: serverTimestamp(),
        adminKey: adminKey,
        gameState: 'dummy_test'
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async joinRoom(roomId, userId, nickname, publicKey = "") {
    const playerRef = ref(this.db, `rooms/${roomId}/players/${userId}`);
    await update(playerRef, {
      nickname: nickname,
      isOnline: true,
      role: 'pending',
      publicKey: publicKey,
      isReady: false,
      lastActive: serverTimestamp()
    });
  }

  async cleanupOldRooms() {
    // 클라이언트 사이드 청소는 대역폭 낭비 및 지연을 유발하므로 폐기.
    // 서버 측 TTL(Time-To-Live) 또는 Cloud Functions에서 처리 권장.
  }

  // --- Sync Listeners ---
  subscribeToHost(roomId, callback) {
    if (this.listeners['host']) this.listeners['host']();
    this.listeners['host'] = onValue(ref(this.db, `rooms/${roomId}/host`), (snap) => callback(snap.val()));
  }

  subscribeToPlayers(roomId, callback) {
    if (this.listeners['players']) this.listeners['players']();
    this.listeners['players'] = onValue(ref(this.db, `rooms/${roomId}/players`), (snap) => callback(snap.val()));
  }

  subscribeToGameState(roomId, callback) {
    if (this.listeners['gameState']) this.listeners['gameState']();
    this.listeners['gameState'] = onValue(ref(this.db, `rooms/${roomId}/gameState`), (snap) => callback(snap.val()));
  }

  subscribeToPlayData(roomId, callback) {
    if (this.listeners['playData']) this.listeners['playData']();
    this.listeners['playData'] = onValue(ref(this.db, `rooms/${roomId}/playData`), (snap) => callback(snap.val()));
  }

  // --- Transactions & Updates ---
  async claimHost(roomId, currentHostId, myUserId, playersData) {
    const estimatedServerTime = Date.now() + this.serverTimeOffset;
    const hostData = playersData ? playersData[currentHostId] : null;
    
    // 호스트가 없거나, Firebase 상에서 완전히 오프라인으로 판정(isOnline === false)되었을 때만 탈취
    // (모바일 환경 백그라운드 전환 시 잦은 방장 탈취 현상 방지)
    const isHostOffline = hostData ? (hostData.isOnline === false) : false;
    const isHostUnresponsive = hostData ? (estimatedServerTime - (hostData.lastActive || 0) > 180000) : false; // 3분 무응답

    if (!currentHostId || !hostData || isHostOffline || isHostUnresponsive) {
      // 10명의 클라이언트가 동시에 트랜잭션을 발생시키는 것을 방지하기 위해 랜덤 딜레이 적용
      const delay = Math.floor(Math.random() * 2000);
      setTimeout(async () => {
        const currentHostSnap = await get(ref(this.db, `rooms/${roomId}/host`));
        if (currentHostSnap.val() && currentHostSnap.val() !== currentHostId) return; // 이미 다른 누군가가 탈취함

        await runTransaction(ref(this.db, `rooms/${roomId}/host`), (inDbHost) => {
          if (inDbHost === currentHostId || !inDbHost) return myUserId;
          return; // 변경 안함
        });
      }, delay);
    }
  }

  async updateGameState(roomId, newState) {
    await set(ref(this.db, `rooms/${roomId}/gameState`), newState);
  }

  async updatePlayData(roomId, newData) {
    await update(ref(this.db, `rooms/${roomId}/playData`), newData);
  }
  
  async overwritePlayData(roomId, fullData) {
    await set(ref(this.db, `rooms/${roomId}/playData`), fullData);
  }

  async updateRoot(updates) {
    await update(ref(this.db), updates);
  }

  async submitConfirmation(roomId, userId) {
    await set(ref(this.db, `rooms/${roomId}/playData/confirmations/${userId}`), true);
  }

  async setPlayerReady(roomId, userId, isReady) {
    await set(ref(this.db, `rooms/${roomId}/players/${userId}/isReady`), isReady);
  }

  // --- History (Past Games) ---
  async fetchHistoryPage(limitCount, endAtKey = null) {
    let q;
    if (endAtKey) {
      q = query(ref(this.db, 'past_games'), orderByKey(), endAt(endAtKey), limitToLast(limitCount + 1));
    } else {
      q = query(ref(this.db, 'past_games'), orderByKey(), limitToLast(limitCount));
    }
    const snap = await get(q);
    return snap.val() || {};
  }

  async saveGameHistory(gameData) {
    const newRef = push(ref(this.db, 'past_games'));
    await set(newRef, gameData);
  }

  async deleteGameHistory(historyId) {
    await set(ref(this.db, `past_games/${historyId}`), null);
  }

  unsubscribeAll() {
    Object.values(this.listeners).forEach(unsubscribe => unsubscribe());
    this.listeners = {};
  }
}

export const api = new FirebaseAPI();
