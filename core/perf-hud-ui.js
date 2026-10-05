/**
 * core/perf-hud-ui.js — MỚI (05/10/2026, Giang yêu cầu đưa perf-probe về core + event bus). Dựng/ghi DOM của
 * Performance HUD — thay khối "Dựng dải HUD + kéo thả" của service/perf-probe.js cũ (ĐÃ XOÁ).
 *
 * Rule 5: template tĩnh ở components/perf-hud.js (Rule 5d, instantiate qua service/component-dynamic.js); HUD là cụm DOM
 * MỚI tạo nên được addEventListener NGAY TRONG hàm dựng — gom CUỐI hàm, callback CHỈ eventBus.send() tới router
 * 'perfHud' (Rule 5a). Không đọc appState, không taskManager, không gọi core khác (Rule 2-3). Áp theme
 * (applyUiThemeToDom) do Workflow gọi sau khi dựng — core không gọi core khác.
 *
 * Kéo thả = CHẠM GIỮ (Giang yêu cầu bỏ tay cầm kéo): 4 sự kiện pointer của chính HUD -> eventBus; hẹn giờ chạm giữ,
 * ngưỡng lệch, vị trí, lưu bền — event/workflow/perf-hud.js. CSS (touch-action/user-select) ở assets/css/perf-hud.css.
 */

/** Dựng HUD từ chuỗi template, gắn vào <body>. @param {string} html - renderPerfHudStrip()/renderPerfHudDetail()
 * @param {'horizontal'|'vertical'} orientation
 * @returns {{hudEl: HTMLElement, valueEls: Object<string, HTMLElement>, sparkBarEls: HTMLElement[]}} */
function mountPerfHud(html, orientation) {
    const fragment = instantiateComponent(html); // service/component-dynamic.js
    const hudEl = fragment.firstElementChild;
    hudEl.classList.toggle('pph-vertical', orientation === 'vertical');
    const valueEls = {};
    hudEl.querySelectorAll('[data-pph-value]').forEach((el) => { valueEls[el.dataset.pphValue] = el; });
    const sparkBarEls = [...hudEl.querySelectorAll('[data-pph-bar]')];
    document.body.appendChild(hudEl);

    // --- addEventListener: gom cuối hàm (Rule 5a) ---
    hudEl.addEventListener('pointerdown', (e) => eventBus.send({ router: 'perfHud', type: 'perfHud.hud.pointerdown', payload: { pointerId: e.pointerId, x: e.clientX, y: e.clientY } }));
    hudEl.addEventListener('pointermove', (e) => eventBus.send({ router: 'perfHud', type: 'perfHud.hud.pointermove', payload: { pointerId: e.pointerId, x: e.clientX, y: e.clientY } }));
    hudEl.addEventListener('pointerup', (e) => eventBus.send({ router: 'perfHud', type: 'perfHud.hud.pointerup', payload: { pointerId: e.pointerId } }));
    hudEl.addEventListener('pointercancel', (e) => eventBus.send({ router: 'perfHud', type: 'perfHud.hud.pointerup', payload: { pointerId: e.pointerId } }));

    return { hudEl, valueEls, sparkBarEls };
}

/** Gỡ HUD khỏi DOM (listener đi theo phần tử). @param {{hudEl: HTMLElement}} handle */
function removePerfHud(handle) {
    handle.hudEl.remove();
}

/** Đổi chiều dải (chỉ có tác dụng với kiểu strip — CSS). @param {HTMLElement} hudEl @param {'horizontal'|'vertical'} orientation */
function setPerfHudOrientation(hudEl, orientation) {
    hudEl.classList.toggle('pph-vertical', orientation === 'vertical');
}

/** @param {HTMLElement} hudEl @param {number} left @param {number} top */
function placePerfHud(hudEl, left, top) {
    hudEl.style.left = `${left}px`;
    hudEl.style.top = `${top}px`;
}

/** Ghi số mới — chỉ đổi textContent. @param {Object<string, HTMLElement>} valueEls @param {Object<string, string>} values */
function writePerfHudValues(valueEls, values) {
    Object.keys(values).forEach((id) => {
        const el = valueEls[id];
        if (el) el.textContent = values[id];
    });
}

/** Ghi chiều cao cột biểu đồ FPS (kiểu strip không có cột -> mảng rỗng, không làm gì).
 * @param {HTMLElement[]} barEls @param {number[]} heights - % */
function writePerfHudSparkHeights(barEls, heights) {
    barEls.forEach((el, i) => { el.style.height = `${heights[i]}%`; });
}

/** Bật/tắt dáng "đang nhấc lên để kéo". @param {HTMLElement} hudEl @param {boolean} isDragging */
function setPerfHudDragging(hudEl, isDragging) {
    hudEl.classList.toggle('pph-dragging', isDragging);
}

/** Giữ con trỏ trên HUD suốt lúc kéo (ngón tay trượt ra ngoài HUD vẫn nhận pointermove/up).
 * @param {HTMLElement} hudEl @param {number} pointerId */
function capturePerfHudPointer(hudEl, pointerId) {
    try { hudEl.setPointerCapture(pointerId); } catch (err) { /* con trỏ đã nhả trước khi kịp bắt — bỏ qua */ }
}
