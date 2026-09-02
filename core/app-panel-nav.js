/**
 * core/app-panel-nav.js — Core NGHIỆP VỤ cho bottom nav App Panel. Chỉ thao tác DOM TĨNH có sẵn từ
 * dom-refs.js (`appBottomNav`, `appBottomNavGameDot`, `appBottomNavGameIconIdle`,
 * `appBottomNavGameIconPlaying` — mount 1 lần lúc boot qua components/app-bottom-nav.js) — KHÔNG tự
 * `createElement`, nên KHÔNG cần hậu tố `-ui.js` (Rule 5c).
 *
 * Rule 1 — đơn tuyến: hàm CHỈ làm 1 việc (tô sáng đúng nút theo `tab` truyền vào), KHÔNG rẽ nhánh
 * theo NGUỒN tab (appState hay tham số) — nơi gọi (Workflow) tự quyết định tab nào, hàm chỉ thi hành.
 * Rule 2 — KHÔNG tự `appState.get()`, nhận `tab`/`isPlaying` qua tham số.
 *
 * NẠP SAU: core/dom-refs.js (appBottomNav, appBottomNavGameDot, appBottomNavGameIconIdle,
 * appBottomNavGameIconPlaying).
 */

/** Tô sáng đúng nút bottom nav khớp `tab` — mọi nút khác bỏ `.active`.
 * @param {string} tab - 'media'|'folder'|'storage'|'game'|'statis' */
function setAppPanelNavActiveTab(tab) {
    if (!appBottomNav) return;
    appBottomNav.querySelectorAll('.app-bottom-nav-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
}

/** Đồng bộ icon + chấm xanh báo hiệu "đang chơi Game Mode" trên nút "Game" — MỚI (02/09/2026, Giang
 * yêu cầu "icon game ở nav phải biểu thị đang ở game mode"). [SỬA cùng ngày — Giang chỉnh: "chỉ
 * quan tâm khi play -> game mode true hay false, KHÔNG chia phase"] Đúng 1 boolean DUY NHẤT — bản
 * trước tự chia 3 trạng thái (idle/armed/playing) là THỪA, ĐÃ BỎ.
 *
 * @param {boolean} isPlaying - true: đang chơi thật (`gameplayPhase !== 'idle'`, xem nơi gọi) -> đổi
 *   icon sang máy chơi game cầm tay (`appBottomNavGameIconPlaying`) + chấm XANH nhấp nháy. false:
 *   icon thường, KHÔNG chấm.
 *
 * Nhận `isPlaying` qua tham số (Rule 2) — nơi gọi (workflowGameCatalog.renderList(), gọi lại từ MỌI
 * mốc đổi `gameplayPhase` trong event/workflow/gameplay.js) tự đọc appState rồi suy ra, KHÔNG tự
 * appState.get() ở đây. */
function setAppBottomNavGameIndicator(isPlaying) {
    if (appBottomNavGameIconIdle) appBottomNavGameIconIdle.classList.toggle('hidden', isPlaying);
    if (appBottomNavGameIconPlaying) appBottomNavGameIconPlaying.classList.toggle('hidden', !isPlaying);
    if (appBottomNavGameDot) appBottomNavGameDot.classList.toggle('hidden', !isPlaying);
}
