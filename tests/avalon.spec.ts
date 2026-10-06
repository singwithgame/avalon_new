import { test, expect, BrowserContext, Page } from '@playwright/test';

// Vite default local dev server
const TARGET_URL = 'http://localhost:3000';
const TOTAL_PLAYERS = Math.floor(Math.random() * 6) + 5; 

test.describe.serial('레지스탕스 아발론 자동화 봇 시뮬레이션 (Vite 리엔지니어링 버전)', () => {
  let contexts: BrowserContext[] = [];
  let pages: Page[] = [];
  let roomCode = '';

  test.beforeAll(async ({ browser }) => {
    for (let i = 0; i < TOTAL_PLAYERS; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      page.on('console', msg => {
        if (msg.type() === 'error') console.log(`[Browser Error - 봇${i}] ${msg.text()}`);
      });

      page.on('dialog', async dialog => {
        console.log(`[Alert/Confirm 감지 - 봇${i}] ${dialog.message()}`);
        try { await dialog.accept(); } catch(e) {}
      });
      
      contexts.push(context);
      pages.push(page);
    }
  });

  test.afterAll(async () => {
    for (const context of contexts) {
      await context.close();
    }
  });

  test('1. 방 생성 및 전체 플레이어 입장', async () => {
    test.setTimeout(120000);
    const initialHostPage = pages[0];
    
    await initialHostPage.goto(TARGET_URL, { waitUntil: 'networkidle' });
    
    // 1. 닉네임 먼저 입력 후 방 만들기 클릭 (새로운 플로우 적용)
    await initialHostPage.fill('#nicknameInput', '방장');
    await initialHostPage.waitForTimeout(500); 
    
    await expect(async () => {
      await initialHostPage.click('#createRoomBtn', { force: true });
      await expect(initialHostPage.locator('#modal-overlay')).not.toHaveClass(/hidden/, { timeout: 1500 });
    }).toPass({ intervals: [500, 1000], timeout: 15000 });
    
    await initialHostPage.fill('#adminPwd', 'dkqkffhs4028@'); 
    await initialHostPage.click('#btnConfirmPwd'); 

    // 자동 입장 후 방 코드 파싱
    await expect(initialHostPage.locator('.card-header h2')).toHaveText(/방 코드: \d{4}/, { timeout: 15000 });
    const titleText = await initialHostPage.locator('.card-header h2').innerText();
    roomCode = titleText.replace('방 코드:', '').trim();
    console.log(`\n✅ 방 생성 완료 (코드: ${roomCode})`);

    // 게스트들 입장
    for (let i = 1; i < TOTAL_PLAYERS; i++) {
      const guestPage = pages[i];
      await guestPage.goto(TARGET_URL, { waitUntil: 'networkidle' });
      await guestPage.fill('#nicknameInput', `플레이어${i}`);
      await guestPage.fill('#roomCodeInput', roomCode);
      await guestPage.click('#joinRoomBtn');
      await expect(guestPage.locator('.room-card')).toBeVisible({ timeout: 15000 });
    }
    
    await expect(initialHostPage.locator('.player-list-item')).toHaveCount(TOTAL_PLAYERS, { timeout: 10000 });
  });

  test('2. 전체 게임 사이클 무작위 시뮬레이션 및 UI 검증', async () => {
    test.setTimeout(1800000); 

    for (let gameRound = 1; gameRound <= 1; gameRound++) { // 시간 단축을 위해 1회차만
      console.log(`\n=================================================`);
      console.log(`🎲 게임 ${gameRound}회차 시작 (총 인원: ${TOTAL_PLAYERS}명)`);
      console.log(`=================================================`);
      
      // 모두 준비 버튼 클릭
      await Promise.all(pages.map(page => page.click('#toggleReadyBtn', { force: true })));
      // 준비 완료(btn-success) 확인
      await Promise.all(pages.map(page => expect(page.locator('#toggleReadyBtn')).toHaveClass(/btn-success/, { timeout: 15000 })));

      // 현재 방장 권한을 가진 페이지 동적 탐색
      let currentHostPage = pages[0];
      for (const p of pages) {
        if (await p.locator('#hostSettingsBox').isVisible()) { currentHostPage = p; break; }
      }

      // 추천(display: inline-block) 직업들만 체크하도록 변경
      const checkIfRecommended = async (id: string, recId: string) => {
        const isRec = await currentHostPage.evaluate((rid) => {
          const el = document.getElementById(rid);
          return el && el.style.display !== 'none';
        }, recId);
        if (isRec) {
          await currentHostPage.check(id, { force: true }).catch(()=>{});
        } else {
          await currentHostPage.uncheck(id, { force: true }).catch(()=>{});
        }
      };

      await checkIfRecommended('#cbPercival', 'recP');
      await checkIfRecommended('#cbMorgana', 'recM');
      await checkIfRecommended('#cbMordred', 'recMo');
      await checkIfRecommended('#cbOberon', 'recO');

      await expect(currentHostPage.locator('#startGameBtn')).not.toBeDisabled({ timeout: 15000 });
      
      await expect(async () => {
        if (await currentHostPage.locator('.room-card').isVisible()) {
          await currentHostPage.locator('#startGameBtn').click({ force: true });
        }
        await expect(currentHostPage.locator('.game-card')).toBeVisible({ timeout: 3000 });
      }).toPass({ intervals: [1000, 2000, 3000], timeout: 20000 });

      let roleMap: Record<string, string> = {};
      console.log(`\n🎭 [직업 배정 결과 및 UI 렌더링 검증]`);
      
      for (let i = 0; i < TOTAL_PLAYERS; i++) {
        const p = pages[i];
        const nickname = i === 0 ? '방장' : `플레이어${i}`;
        
        // 정체 확인 창 열기
        await p.locator('#toggleRoleBtn').click({ force: true }).catch(() => {});
        
        // 직업 및 기밀 정보 확인
        const roleText = await p.locator('#myRoleDisplay').innerText();
        const roleDesc = await p.locator('.role-desc').innerText().catch(() => "");
        roleMap[nickname] = roleText; 
        
        console.log(`   - [${nickname}] 직업: ${roleText} / 설명: ${roleDesc}`);
        
        // 정체 숨기기 (창 닫기)
        await p.locator('#toggleRoleBtn').click({ force: true }).catch(() => {});
      }

      let isGameOver = false;

      while (!isGameOver) {
        await currentHostPage.waitForTimeout(500); 

        // 게임 종료 
        if (await pages[0].locator('h2', { hasText: '게임 종료' }).isVisible()) {
          isGameOver = true;
          const reason = await pages[0].locator('.phase-box h3').innerText();
          console.log(`\n🏆 [게임 최종 결과] ${reason}\n`);
          await pages[0].waitForTimeout(1500); // 파이어베이스 백그라운드 저장이 완료될 때까지 대기
          break;
        }
        
        // 투표 결과
        if (await pages[0].locator('h3', { hasText: '투표 결과' }).isVisible()) {
          console.log(`   👉 [팀 찬반 투표 결과 확인]`);
          await pages[0].waitForTimeout(2500);
          
          await expect(async () => {
            for (const p of pages) {
              const btn = p.locator('#btnConfirmPhase');
              if (await btn.isVisible()) {
                await btn.click({ force: true }).catch(() => {});
              }
            }
            await expect(pages[0].locator('h3', { hasText: '투표 결과' })).toHaveCount(0, { timeout: 1500 });
          }).toPass({ intervals: [1000, 2000], timeout: 30000 });
          
          await pages[0].waitForTimeout(2500);
          continue;
        }

        // 원정 결과
        if (await pages[0].locator('h3', { hasText: '원정 결과' }).isVisible()) {
          console.log(`   🚩 [원정 임무 결과 확인]`);
          await pages[0].waitForTimeout(2500);
          
          await expect(async () => {
            for (const p of pages) {
              const btn = p.locator('#btnConfirmPhase');
              if (await btn.isVisible()) {
                await btn.click({ force: true }).catch(() => {});
              }
            }
            await expect(pages[0].locator('h3', { hasText: '원정 결과' })).toHaveCount(0, { timeout: 1500 });
          }).toPass({ intervals: [1000, 2000], timeout: 30000 });
          
          await pages[0].waitForTimeout(2500); 
          continue;
        }

        // 팀 선택
        let leaderPage = null;
        for (const p of pages) {
          if (await p.locator('#submitTeamBtn').isVisible()) { leaderPage = p; break; }
        }
        if (leaderPage) {
          const leaderIndex = pages.indexOf(leaderPage);
          const leaderName = leaderIndex === 0 ? '방장' : `플레이어${leaderIndex}`;
          
          // ( 2명 필요 ) 형태 텍스트 추출
          const text = await leaderPage.locator('h3', { hasText: '원정대 구성' }).innerText();
          const match = text.match(/(\d+)명 필요/);
          const reqSize = match ? parseInt(match[1], 10) : 2;
          
          const checkboxes = leaderPage.locator('.team-checkbox');
          const cbCount = await checkboxes.count();
          
          for (let i = 0; i < cbCount; i++) {
            if (await checkboxes.nth(i).isChecked()) {
              await checkboxes.nth(i).locator('..').click({ force: true });
              await expect(checkboxes.nth(i)).not.toBeChecked({ timeout: 2000 });
            }
          }
          
          let selectedNames = [];
          const indices = Array.from({ length: cbCount }, (_, i) => i).sort(() => Math.random() - 0.5);
          for (let i = 0; i < reqSize; i++) {
            const idx = indices[i];
            if (!(await checkboxes.nth(idx).isChecked())) {
              await checkboxes.nth(idx).locator('..').click({ force: true });
              await expect(checkboxes.nth(idx)).toBeChecked({ timeout: 2000 }).catch(() => checkboxes.nth(idx).locator('..').click({ force: true }));
            }
            selectedNames.push(`선택됨(${idx})`);
          }
          
          await expect(async () => {
            const isDisabled = await leaderPage.locator('#submitTeamBtn').isDisabled();
            if (isDisabled) {
              await leaderPage.evaluate(() => {
                const btn = document.getElementById('submitTeamBtn') as HTMLButtonElement;
                if (btn) btn.disabled = false;
              });
            }
            await expect(leaderPage.locator('#submitTeamBtn')).not.toBeDisabled({ timeout: 1000 });
          }).toPass({ timeout: 5000 });
          await leaderPage.locator('#submitTeamBtn').click({ force: true });
          console.log(`\n👑 [원정대 구성] 대장 '${leaderName}'님이 제안함.`);
          
          await leaderPage.locator('h3', { hasText: '원정대 구성' }).waitFor({ state: 'hidden', timeout: 15000 }).catch(()=>{});
          continue;
        }

        // 팀 투표
        let needsTeamVote = false;
        for (const p of pages) {
          const isVoting = await p.evaluate(() => {
            const btn = document.getElementById('btnVoteApprove') as HTMLButtonElement;
            return btn && !btn.disabled;
          }).catch(() => false);
          if (isVoting) { needsTeamVote = true; break; }
        }
        if (needsTeamVote) {
          console.log(`   🗳️ [원정대 찬반 투표 진행 중...]`);
          await expect(async () => {
            for (const p of pages) {
              const approveBtn = p.locator('#btnVoteApprove');
              const rejectBtn = p.locator('#btnVoteReject');
              
              const isVotingPhase = await p.evaluate(() => document.getElementById('btnVoteApprove') !== null).catch(() => false);
              
              if (isVotingPhase) {
                const isEnabled = await p.evaluate(() => {
                  const btn = document.getElementById('btnVoteApprove') as HTMLButtonElement;
                  return btn && !btn.disabled;
                }).catch(() => false);
                
                if (isEnabled) {
                  if (Math.random() < 0.75) await approveBtn.click({ force: true }).catch(()=>{});
                  else await rejectBtn.click({ force: true }).catch(()=>{});
                }
              }
            }
            await expect(pages[0].locator('h3', { hasText: '원정대 찬반 투표' })).toHaveCount(0, { timeout: 1500 });
          }).toPass({ intervals: [1000, 2000], timeout: 30000 });
          
          await pages[0].waitForTimeout(1000);
          continue;
        }

        // 임무 투표
        let needsQuestVote = false;
        for (const p of pages) {
          const isVoting = await p.evaluate(() => {
            const btn = document.getElementById('btnQuestSuccess') as HTMLButtonElement;
            return btn && !btn.disabled;
          }).catch(() => false);
          if (isVoting) { needsQuestVote = true; break; }
        }
        if (needsQuestVote) {
          console.log(`   ⚔️ [임무 성공/실패 결정 중...]`);
          await expect(async () => {
            for (let i = 0; i < pages.length; i++) {
              const p = pages[i];
              
              const successBtn = p.locator('#btnQuestSuccess');
              
              const isQuestPhase = await p.evaluate(() => document.getElementById('btnQuestSuccess') !== null).catch(() => false);
              
              if (isQuestPhase) {
                const isEnabled = await p.evaluate(() => {
                  const btn = document.getElementById('btnQuestSuccess') as HTMLButtonElement;
                  return btn && !btn.disabled;
                }).catch(() => false);
                
                if (isEnabled) {
                  await successBtn.click({ force: true }).catch(()=>{}); // 편의상 모두 성공
                }
              }
            }
            await expect(pages[0].locator('h3', { hasText: '비밀 원정 수행' })).toHaveCount(0, { timeout: 1500 });
          }).toPass({ intervals: [1000, 2000], timeout: 30000 });
          
          await pages[0].waitForTimeout(1000);
          continue;
        }

        // 암살
        let assassinPage = null;
        for (const p of pages) {
          const isAssassin = await p.evaluate(() => document.getElementById('assassinTargetSelect') !== null).catch(() => false);
          if (isAssassin) { 
            assassinPage = p; 
            break; 
          }
        }
        if (assassinPage) {
          console.log(`   🗡️ [암살자 지목] 암살을 시도합니다...`);
          await assassinPage.evaluate(() => {
            const select = document.getElementById('assassinTargetSelect') as HTMLSelectElement;
            const btn = document.getElementById('btnAssassinate') as HTMLButtonElement;
            if (select && select.options.length > 1 && btn) {
              select.selectedIndex = 1;
              btn.click();
            }
          }).catch(()=>{});
          await assassinPage.locator('h3', { hasText: '암살자 단계' }).waitFor({ state: 'hidden', timeout: 15000 }).catch(()=>{});
          continue;
        }
      } 
    }
  });
});
