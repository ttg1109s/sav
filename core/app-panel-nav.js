/**
 * core/app-panel-nav.js — Core NGHIỆP VỤ cho bottom nav App Panel (MỚI). Chỉ thao tác DOM TĨNH có
 * sẵn từ dom-refs.js (`appBottomNav`, mount 1 lần lúc boot qua components/app-bottom-nav.js) —
 * KHÔNG tự `createElement`, nên KHÔNG cần hậu tố `-ui.js` (Rule 5c).
 *
 * Rule 1 — đơn tuyến: hàm CHỈ làm 1 việc (tô sáng đúng nút theo `tab` truyền vào), KHÔNG rẽ nhánh
 * theo NGUỒN tab (appState hay tham số) — nơi gọi (Workflow) tự quyết định tab nào, hàm chỉ thi hành.
 * Rule 2 — KHÔNG tự `appState.get()`, nhận `tab` qua tham số.
 *
 * NẠP SAU: core/dom-refs.js (appBottomNav).
 */

/** Tô sáng đúng nút bottom nav khớp `tab` — mọi nút khác bỏ `.active`.
 * @param {string} tab - 'media'|'folder'|'photo'|'storage'|'game'|'statis'|'setting' */
function setAppPanelNavActiveTab(tab) {
    if (!appBottomNav) return;
    appBottomNav.querySelectorAll('.app-bottom-nav-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
}
