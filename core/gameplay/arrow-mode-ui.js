/**
 * core/gameplay/arrow-mode-ui.js — MỚI (07/10/2026, game "Arrow"). Core-ui (Rule 5c) RIÊNG mode "Arrow": ghi lên DOM
 * TĨNH của stage (components/gameplay-arrow-stage.js — tra qua core/dom-refs.js, Workflow truyền element vào). Không
 * appState.get() (Rule 2), không gọi hàm khác của project (Rule 3a), không addEventListener (listener tĩnh ở
 * event/listener/gameplay.js). HTML dải mũi tên do components/gameplay-arrow-stage.js::renderGameplayArrowStripHtml()
 * dựng — Workflow truyền chuỗi xuống paintArrowStrip() (Rule 5d: core không giữ markup).
 *
 * Mọi hàm là 1 lần ghi cùng tập vị trí (chỉ khác giá trị) hoặc switch A/B trên 1 phần tử — Rule 1 PASS.
 */

/** Vẽ vùng đích (dải blur) + vạch tâm theo hình học % do core/gameplay/arrow-mode.js::computeArrowTargetZoneGeometry()
 * trả — CÙNG số core dùng chấm điểm, nên mắt thấy đúng vùng được tính. */
function paintArrowTargetZone(zoneEl, targetEl, geometry) {
    zoneEl.style.left = `${geometry.zoneLeftPercent}%`;
    zoneEl.style.width = `${geometry.zoneWidthPercent}%`;
    targetEl.style.left = `${geometry.coreLeftPercent}%`;
    targetEl.style.width = `${geometry.coreWidthPercent}%`;
}

/** Nút tròn + phần thanh đã chạy — gọi MỖI FRAME (hot path), chỉ đổi transform (không layout). Rail rộng đúng bằng
 * thanh nên translateX(%) của rail = % dọc thanh. */
function paintArrowCursor(railEl, fillEl, progressPercent) {
    railEl.style.transform = `translate3d(${progressPercent}%, 0, 0)`;
    fillEl.style.transform = `scaleX(${progressPercent / 100})`;
}

/** Đổ dải mới (chuỗi HTML đã dựng sẵn) — xoá kết quả/hiệu ứng sai của dải trước. Ô mới tự chạy animation vào (CSS). */
function paintArrowStrip(stripEl, html) {
    stripEl.removeAttribute('data-result');
    stripEl.classList.remove('is-wrong');
    stripEl.innerHTML = html;
}

/** Trạng thái từng ô theo số mũi tên đã nhập đúng: trước `inputIndex` = 'done' (xanh lá), đúng `inputIndex` = 'current'
 * (vòng sáng chờ nhập), sau = 'pending'. */
function paintArrowStripProgress(stripEl, inputIndex) {
    const cells = stripEl.children;
    for (let i = 0; i < cells.length; i++) {
        cells[i].dataset.state = i < inputIndex ? 'done' : (i === inputIndex ? 'current' : 'pending');
    }
}

/** Rung dải khi nhập sai — chạy lại animation bằng remove + reflow + add (cùng khuôn showGameplayCountdown()). */
function flashArrowStripWrong(stripEl) {
    stripEl.classList.remove('is-wrong');
    void stripEl.offsetWidth; // ép reflow để animation chạy lại từ đầu
    stripEl.classList.add('is-wrong');
}

/** Đánh dấu kết quả vòng (tier name) lên dải — CSS: 'miss' tối + đỏ, tier khác bừng sáng. */
function paintArrowStripResult(stripEl, tierName) {
    stripEl.dataset.result = tierName;
}

/** Nút Enter sáng lên khi đã nhập đủ dải (chờ commit đúng vạch). */
function paintArrowCommitReady(commitBtnEl, ready) {
    commitBtnEl.classList.toggle('is-ready', ready);
}

/** Level + hệ số tốc độ ở HUD. */
function paintArrowHud(levelEl, speedEl, level, speedMultiplier) {
    levelEl.textContent = String(level);
    speedEl.textContent = `×${speedMultiplier.toFixed(2)}`;
}

/** Toạ độ (px, hệ toạ độ `#gameplay-tier-popup-layer` = `#gameplay-layer`) để hiện tier popup ngay DƯỚI giữa dải (phía
 * trên là thanh tiến trình — popup đè lên sẽ che vạch đích). */
function measureArrowPopupAnchor(stripEl, layerEl) {
    const stripRect = stripEl.getBoundingClientRect();
    const layerRect = layerEl.getBoundingClientRect();
    return {
        x: stripRect.left + stripRect.width / 2 - layerRect.left,
        y: stripRect.bottom - layerRect.top + 26,
    };
}
