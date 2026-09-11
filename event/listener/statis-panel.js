/**
 * event/listener/statis-panel.js — MỚI (Giang yêu cầu "tích hợp 1+2+3"). Listener cụm "statisPanel".
 * Nội dung render ĐỘNG (`.innerHTML` đổi hẳn mỗi lần đổi sort/filter, xem event/workflow/
 * statis-panel.js::renderContent()) -> KHÔNG gắn listener trực tiếp lên từng nút — dùng DELEGATION
 * trên `statisPanelBody` (gốc TĨNH, mount 1 lần lúc boot), CÙNG khuôn
 * event/listener/game-catalog.js::handleGamePanelListDelegatedClick().
 *
 * NẠP SAU CÙNG (sau bus, core, workflow, router, VÀ SAU dom-refs.js).
 */
function handleStatisPanelBodyDelegatedClick(e) {
    const sortBtn = e.target.closest('.statis-sort-btn');
    if (sortBtn) {
        eventBus.send({ router: 'statisPanel', type: 'statisPanel.sort.click', payload: { mode: sortBtn.dataset.sortMode } });
        return;
    }

    const filterBtn = e.target.closest('.statis-filter-btn');
    if (filterBtn) {
        eventBus.send({ router: 'statisPanel', type: 'statisPanel.filter.click', payload: { type: filterBtn.dataset.filterType } });
        return;
    }
}

if (statisPanelBody) {
    statisPanelBody.addEventListener('click', handleStatisPanelBodyDelegatedClick);
}
