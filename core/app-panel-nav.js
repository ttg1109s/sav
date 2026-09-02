/**
 * core/app-panel-nav.js — Core NGHIỆP VỤ cho bottom nav App Panel. Chỉ thao tác DOM TĨNH có sẵn từ
 * dom-refs.js (`appBottomNav`, `appBottomNavGameDot`, `appBottomNavGameIconIdle`,
 * `appBottomNavGameIconPlaying` — mount 1 lần lúc boot qua components/app-bottom-nav.js) — KHÔNG tự
 * `createElement`, nên KHÔNG cần hậu tố `-ui.js` (Rule 5c).
 *
 * Rule 1 — đơn tuyến: hàm CHỈ làm 1 việc (tô sáng đúng nút theo `tab` truyền vào), KHÔNG rẽ nhánh
 * theo NGUỒN tab (appState hay tham số) — nơi gọi (Workflow) tự quyết định tab nào, hàm chỉ thi hành.
 * Rule 2 — KHÔNG tự `appState.get()`, nhận `tab`/`state` qua tham số.
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

/** Đồng bộ icon + chấm báo hiệu "Game Mode" trên nút "Game" theo ĐÚNG 1 trong 3 trạng thái — MỚI
 * (02/09/2026, Giang yêu cầu "icon game ở nav phải biểu thị đang ở game mode"), [SỬA cùng ngày,
 * Giang yêu cầu "khi playgame cần chuyển sang icon máy chơi game cầm tay + nút chấm xanh"] tách từ
 * 1 boolean (hiện/ẩn chấm đỏ) thành 3 trạng thái rõ rệt hơn — bản trước KHÔNG phân biệt được "đã
 * armed, đang chờ" với "đang chơi thật".
 *
 * @param {'idle'|'armed'|'playing'} state - 'idle': KHÔNG game nào armed (icon thường, KHÔNG chấm).
 *   'armed': đã armed, CHƯA/KHÔNG còn phát thật (icon thường, chấm ĐỎ nhấp nháy — dùng CHUNG
 *   `.app-bottom-nav-game-dot` animation cũ). 'playing': đang chơi THẬT (`gameplayPhase` khác
 *   'idle' — bao gồm CẢ 'countdown' lẫn 'ended', vẫn coi là "trong phiên", xem nơi gọi) — đổi hẳn
 *   sang icon máy chơi game cầm tay (`appBottomNavGameIconPlaying`) + chấm XANH
 *   (`.app-bottom-nav-game-dot--playing`, đè màu lên animation nhấp nháy sẵn có).
 *
 * Nhận `state` qua tham số (Rule 2) — nơi gọi (workflowGameCatalog.renderList(), gọi lại từ MỌI mốc
 * đổi `gameplayPhase` trong event/workflow/gameplay.js) tự đọc appState rồi suy ra 1 trong 3 giá trị
 * trên, KHÔNG tự appState.get() ở đây. */
function setAppBottomNavGameIndicator(state) {
    if (appBottomNavGameIconIdle) appBottomNavGameIconIdle.classList.toggle('hidden', state === 'playing');
    if (appBottomNavGameIconPlaying) appBottomNavGameIconPlaying.classList.toggle('hidden', state !== 'playing');
    if (appBottomNavGameDot) {
        appBottomNavGameDot.classList.toggle('hidden', state === 'idle');
        appBottomNavGameDot.classList.toggle('app-bottom-nav-game-dot--playing', state === 'playing');
    }
}
