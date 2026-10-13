/**
 * core/app-panel-nav.js — bottom nav App Panel. Chỉ thao tác DOM tĩnh từ core/dom-refs.js (`appBottomNav`,
 * `appBottomNavGameDot`, `appBottomNavGameIconIdle`, `appBottomNavGameIconPlaying` — mount lúc boot qua
 * components/app-bottom-nav.js) nên không cần hậu tố `-ui`. Nhận mọi giá trị qua tham số.
 */

/** Tô sáng nút khớp `tab`, mọi nút khác về màu thường. Màu là class Tailwind của theme đang chạy (Workflow tra qua
 * `resolveUiThemeClass()`); class đã tô lần trước nhớ trong `data-nav-tint-applied` và được gỡ đúng chuỗi đó — đổi theme
 * không để sót class màu của theme cũ.
 * @param {string} tab - 'media'|'folder'|'storage'|'game'|'statis' ('media' = Home, không có nút -> mọi nút thường)
 * @param {string} activeCls @param {string} inactiveCls */
function setAppPanelNavActiveTab(tab, activeCls, inactiveCls) {
    if (!appBottomNav) return;
    appBottomNav.querySelectorAll('.app-bottom-nav-btn').forEach((btn) => {
        const isActive = btn.dataset.tab === tab;
        btn.classList.toggle('active', isActive);
        const prevTint = (btn.dataset.navTintApplied || '').split(/\s+/).filter(Boolean);
        if (prevTint.length) btn.classList.remove(...prevTint);
        const nextTint = (isActive ? activeCls : inactiveCls).split(/\s+/).filter(Boolean);
        if (nextTint.length) btn.classList.add(...nextTint);
        btn.dataset.navTintApplied = nextTint.join(' ');
    });
}

/** Icon + chấm xanh báo "đang chơi Game" trên nút Game. @param {boolean} isPlaying - `gameplayPhase !== 'idle'`
 * (nơi gọi suy ra): true -> icon máy chơi game cầm tay + chấm xanh nhấp nháy; false -> icon thường. */
function setAppBottomNavGameIndicator(isPlaying) {
    if (appBottomNavGameIconIdle) appBottomNavGameIconIdle.classList.toggle('hidden', isPlaying);
    if (appBottomNavGameIconPlaying) appBottomNavGameIconPlaying.classList.toggle('hidden', !isPlaying);
    if (appBottomNavGameDot) appBottomNavGameDot.classList.toggle('hidden', !isPlaying);
}
