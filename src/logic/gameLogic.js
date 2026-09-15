import { QUEST_CAPACITY, ALIGNMENT_RATIO, ROLES } from './constants.js';

export function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function generateRoles(playerCount, selectedOptions) {
  const ratio = ALIGNMENT_RATIO[playerCount];
  
  let goodRoles = [ROLES.MERLIN];
  let evilRoles = [ROLES.ASSASSIN];

  if (selectedOptions.percival) goodRoles.push(ROLES.PERCIVAL);
  if (selectedOptions.morgana) evilRoles.push(ROLES.MORGANA);
  if (selectedOptions.mordred) evilRoles.push(ROLES.MODRED);
  if (selectedOptions.oberon) evilRoles.push(ROLES.OBERON);

  // 악의 세력 정원 초과 시, 필수(암살자)를 제외한 나머지 옵션 중 랜덤 제거
  if (evilRoles.length > ratio.evil) {
    evilRoles = [evilRoles[0], ...shuffleArray(evilRoles.slice(1))].slice(0, ratio.evil);
  }
  
  // 선의 세력 정원 초과 시, 필수(멀린)를 제외한 나머지 옵션 중 랜덤 제거
  if (goodRoles.length > ratio.good) {
    goodRoles = [goodRoles[0], ...shuffleArray(goodRoles.slice(1))].slice(0, ratio.good);
  }

  // 정원이 남으면 기본 직업으로 채움
  while (goodRoles.length < ratio.good) {
    goodRoles.push(ROLES.SERVANT);
  }
  while (evilRoles.length < ratio.evil) {
    evilRoles.push(ROLES.MINION);
  }

  return shuffleArray([...goodRoles, ...evilRoles]);
}

export function initializePlayData(playerIds) {
  const shuffledOrder = shuffleArray(playerIds);
  return {
    playerOrder: shuffledOrder,
    leaderIndex: 0,
    currentQuest: 0,
    voteTrack: 0,
    questResults: [],
    questDetails: [],
    timeline: [], // 마크다운 용 기록
    confirmations: {}
  };
}

export function getRoleTag(role) {
  if (role === ROLES.MERLIN) return " (멀)";
  if (role === ROLES.PERCIVAL) return " (퍼)";
  if (role === ROLES.MORGANA) return " (모르)";
  if (role === ROLES.MODRED) return " (모드)";
  if (role === ROLES.OBERON) return " (오)";
  if (role === ROLES.ASSASSIN || role === ROLES.MINION) return " (악)";
  return " (선)";
}

export function calculateTeamVoteResult(votes) {
  let approve = 0;
  let reject = 0;
  Object.values(votes).forEach(v => v === 'approve' ? approve++ : reject++);
  return {
    passed: approve > reject,
    approve,
    reject
  };
}

export function calculateQuestResult(votesArray, roundIndex, totalPlayers) {
  let success = 0;
  let fail = 0;
  votesArray.forEach(v => v === 'success' ? success++ : fail++);
  
  // 4라운드(인덱스3), 7인이상일 경우 실패 2개 필요
  const requiresTwoFails = (totalPlayers >= 7 && roundIndex === 3);
  const failedQuest = requiresTwoFails ? (fail >= 2) : (fail >= 1);

  return {
    successStatus: !failedQuest ? 'success' : 'fail',
    successCount: success,
    failCount: fail
  };
}
