/**
 * core/app-panel-nav.js — Core NGHIỆP VỤ cho bottom nav App Panel. Chỉ thao tác DOM TĨNH có sẵn từ
 * dom-refs.js (`appBottomNav`, `appBottomNavGameDot` — mount 1 lần lúc boot qua components/
 * app-bottom-nav.js) — KHÔNG tự `createElement`, nên KHÔNG cần hậu tố `-ui.js` (Rule 5c).
 *
 * Rule 1 — đơn tuyến: hàm CHỈ làm 1 việc (tô sáng đúng nút theo `tab` truyền vào), KHÔNG rẽ nhánh
 * theo NGUỒN tab (appState hay tham số) — nơi gọi (Workflow) tự quyết định tab nào, hàm chỉ thi hành.
 * Rule 2 — KHÔNG tự `appState.get()`, nhận `tab`/`armed` qua tham số.
 *
 * NẠP SAU: core/dom-refs.js (appBottomNav, appBottomNavGameDot).
 */

/** Tô sáng đúng nút bottom nav khớp `tab` — mọi nút khác bỏ `.active`.
 * @param {string} tab - 'media'|'folder'|'storage'|'game'|'statis' */
function setAppPanelNavActiveTab(tab) {
    if (!appBottomNav) return;
    appBottomNav.querySelectorAll('.app-bottom-nav-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
}

/** Hiện/ẩn chấm đỏ báo "đang trong Game Mode" trên icon nút "Game" — MỚI (02/09/2026, Giang yêu
 * cầu "icon game ở nav phải biểu thị đang ở game mode"). Nhận `armed` qua tham số (Rule 2) — nơi
 * gọi (workflowGameCatalog.renderList()) tự đọc `appState.get('gameplayArmedGameId') != null` rồi
 * truyền vào, KHÔNG tự appState.get() ở đây. */
function setAppBottomNavGameIndicator(armed) {
    if (!appBottomNavGameDot) return;
    appBottomNavGameDot.classList.toggle('hidden', !armed);
}
