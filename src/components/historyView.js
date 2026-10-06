import { marked } from 'marked';
import DOMPurify from 'dompurify';
export function renderHistoryView(container, historyItems, callbacks) {
  const renderItem = ([id, game]) => {
    const dateStr = game.date || (game.timestamp ? new Date(game.timestamp).toLocaleString('ko-KR') : '날짜 없음');
    return `
    <div class="history-item" data-id="${id}">
      <div class="history-title">${dateStr} - 방 ${game.roomId}</div>
      <button class="delete-btn" data-id="${id}">🗑️</button>
    </div>
    `;
  };

  const bindEventsToItems = (rootElement) => {
    rootElement.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) return; // 삭제 버튼
        
        container.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        
        const gameId = item.dataset.id;
        const gameItem = historyItems.find(x => x[0] === gameId);
        const game = gameItem ? gameItem[1] : {};
        const activeMarkdown = game.markdown || "기록 내용이 없습니다.";
        
        document.getElementById('historyDetailTitle').innerText = `${game.roomId}방 결과`;
        const htmlContent = document.getElementById('historyHtmlContent');
        htmlContent.innerHTML = DOMPurify.sanitize(marked.parse(activeMarkdown, { breaks: true }));
        document.getElementById('historyMdContent').value = activeMarkdown;
      });
    });

    rootElement.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if(confirm('이 기록을 삭제하시겠습니까?')) {
          callbacks.onDelete(e.target.dataset.id);
        }
      });
    });
  };

  if (callbacks.isInitial) {
    container.innerHTML = `
      <div class="history-layout animate-fade-in">
        <div class="history-list-panel">
          <h3>📜 저장된 게임 목록</h3>
          <button id="closeHistoryBtn" class="btn-secondary btn-sm" style="margin-bottom: 15px; width: 100%;">로비로 돌아가기</button>
          <div id="historyListContainer" class="history-scroll-area">
            ${historyItems && historyItems.length > 0 
              ? historyItems.map(renderItem).join('') 
              : '<p class="empty-text">저장된 기록이 없습니다.</p>'}
            ${callbacks.hasMore ? '<div id="loadingMoreIndicator" style="text-align:center; padding: 10px; color: var(--gold-secondary);">스크롤하여 더 보기...</div>' : ''}
          </div>
        </div>
        
        <div class="history-viewer-panel">
          <div class="viewer-header">
            <h3 id="historyDetailTitle" style="margin: 0; color: var(--gold-primary);">기록을 선택하세요</h3>
            <div class="viewer-actions">
              <button id="copyHistoryBtn" class="btn-primary btn-sm">📋 복사</button>
              <button id="toggleHtmlBtn" class="btn-success btn-sm is-ready">뷰</button>
              <button id="toggleMdBtn" class="btn-outline btn-sm">원문</button>
            </div>
          </div>
          
          <div id="historyHtmlContent" class="md-content">좌측 목록에서 게임을 선택하면 게임 기록 데이터가 표시됩니다.</div>
          <textarea id="historyMdContent" class="md-textarea hidden" readonly></textarea>
        </div>
      </div>
    `;

    bindEventsToItems(container);

    // 스크롤 이벤트
    const listContainer = document.getElementById('historyListContainer');
    listContainer.addEventListener('scroll', () => {
      if (listContainer.scrollHeight - listContainer.scrollTop <= listContainer.clientHeight + 50) {
        if (callbacks.hasMore) {
          callbacks.onLoadMore();
        }
      }
    });

    const btnHtml = document.getElementById('toggleHtmlBtn');
    const btnMd = document.getElementById('toggleMdBtn');
    const htmlContent = document.getElementById('historyHtmlContent');
    const mdContent = document.getElementById('historyMdContent');

    btnHtml.onclick = () => {
      btnHtml.classList.replace('btn-outline', 'btn-success');
      btnMd.classList.replace('btn-success', 'btn-outline');
      htmlContent.classList.remove('hidden');
      mdContent.classList.add('hidden');
    };

    btnMd.onclick = () => {
      btnMd.classList.replace('btn-outline', 'btn-success');
      btnHtml.classList.replace('btn-success', 'btn-outline');
      mdContent.classList.remove('hidden');
      htmlContent.classList.add('hidden');
    };

    document.getElementById('copyHistoryBtn').onclick = () => {
      const activeMarkdown = mdContent.value;
      if (!activeMarkdown) return alert("복사할 내용이 없습니다.");
      navigator.clipboard.writeText(activeMarkdown).then(() => {
        alert("클립보드에 복사되었습니다!");
      });
    };

    document.getElementById('closeHistoryBtn').onclick = () => callbacks.onClose();

  } else {
    // isInitial === false 인 경우: append
    const listContainer = document.getElementById('historyListContainer');
    const indicator = document.getElementById('loadingMoreIndicator');
    if (indicator) indicator.remove(); // 기존 인디케이터 제거

    // 새로 추가된 아이템들만 추출 (historyItems에서 이미 렌더링된 것 이후의 아이템들)
    // 기존 아이템 개수 알기 어려우므로, data-id로 중복체크 또는 새로 렌더링
    // 여기서는 간단히 listContainer 내부를 전체 렌더링 후 이벤트 재바인딩 하거나 
    // 그냥 innerHTML 업데이트 후 전체 이벤트 재바인딩 수행
    // 스크롤 유지를 위해 전체를 다시 그리고 scrollTop 복원하는 방법 사용 (가장 간단)
    const currentScroll = listContainer.scrollTop;
    
    listContainer.innerHTML = `
      ${historyItems && historyItems.length > 0 
        ? historyItems.map(renderItem).join('') 
        : '<p class="empty-text">저장된 기록이 없습니다.</p>'}
      ${callbacks.hasMore ? '<div id="loadingMoreIndicator" style="text-align:center; padding: 10px; color: var(--gold-secondary);">스크롤하여 더 보기...</div>' : ''}
    `;
    
    listContainer.scrollTop = currentScroll;
    
    // 재바인딩 시 삭제나 클릭이 중복 등록되지 않도록 주의해야 하나,
    // innerHTML을 덮어씌웠으므로 기존 DOM 요소가 날아갔고 새 DOM 요소이므로 그냥 바인딩하면 됨
    bindEventsToItems(listContainer);
  }
}
