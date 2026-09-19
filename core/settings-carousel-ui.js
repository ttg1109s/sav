/**
 * core/settings-carousel-ui.js — MỚI (20/09/2026, Giang yêu cầu "thiết kế lại main setting — dạng
 * nằm ngang cuộn: item prev | item current | item next, current scale lớn, khi cuộn (2) nhỏ dần,
 * (1)/(3) tăng lên, tới chính giữa thì trở thành current"). Core UI THUẦN cho carousel ngang của màn
 * Main Setting (HTML do components/settings/app-settings-main.js::renderAppSettingsCarousel() dựng).
 *
 * TẤT CẢ hàm ở đây chỉ nhận THAM SỐ (`scrollerEl`/`cardEl`), KHÔNG `appState.get()`, KHÔNG gọi core
 * khác BẰNG TÊN (Rule 1/2/3 — CÙNG khuôn core/slider-panel-scroll.js), KHÔNG addEventListener
 * (Rule 5a — listener `scroll`/`touch`/`click` nằm ở core/app-settings-ui.js::
 * wireAppSettingsMainCarousel(), chỉ `eventBus.send()`; Router event/router/app-settings.js gọi thẳng
 * các hàm ở đây). Hàm `_apply...` bên dưới là helper private DÙNG CHUNG trong file (cùng khuôn
 * `_cssLengthToPx()` ở core/generic-drawer.js), không phải core-gọi-core.
 *
 * CẤU TRÚC DOM (xem app-settings-main.js): `scrollerEl` = `#app-settings-carousel` (flex ngang,
 * scroll-snap, `position:relative` để `offsetLeft` của card tính theo NỘI DUNG cuộn) chứa
 * `SETTINGS_CAROUSEL_SETS` bản lặp của N card (`[data-carousel-card]`, `data-carousel-index` = 0..N-1
 * trong 1 bản, `data-carousel-count` trên scroller = N); dải chấm `[data-carousel-dot]` là anh em
 * của scroller (cùng cha).
 *
 * Core KHÔNG hẹn giờ (không setTimeout/taskManager — task-manager-conventions.md): mọi thứ cần chờ
 * (hiệu ứng mở, debounce "cuộn đã dừng") do event/workflow/app-settings.js điều phối bằng taskManager.
 *
 * KHÔNG dùng `scroll-snap-stop: always` — cho phép 1 cú vuốt mạnh lướt qua nhiều card rồi mới snap.
 *
 * Style card đổi liên tục lúc cuộn (`transform`/`opacity`) — vùng bọc ngoài carousel có
 * `data-gd-ignore-mutation` để MutationObserver auto-height của core/generic-drawer.js bỏ qua, xem
 * docstring observer đó.
 *
 * Số bản lặp KHÔNG hardcode ở đây — tự suy ra từ (số card thật / `data-carousel-count`), nên đổi
 * SETTINGS_CAROUSEL_SETS ở components/settings/app-settings-main.js không cần sửa file này.
 * NẠP TRƯỚC: event/workflow/app-settings.js, event/router/app-settings.js (2 file đó chỉ gọi các
 * hàm ở đây lúc chạy, không lúc nạp — nên thứ tự với file này không bắt buộc chặt).
 */

/** Scale/opacity của card ở XA tâm ≥ 1 bước (bước = bề rộng card + gap) — card đúng tâm luôn = 1.
 * PHẢI khớp `transform:scale(0.8); opacity:0.5` inline ở app-settings-main.js (trạng thái ban đầu
 * trước khi `initSettingsCarousel()` chạy hiệu ứng mở). */
const SETTINGS_CAROUSEL_MIN_SCALE = 0.8;
const SETTINGS_CAROUSEL_MIN_OPACITY = 0.5;


/** Đổi `scrollLeft` NGAY (không animate, không bị scroll-snap kéo lại/giật) — tắt snap tạm rồi bật lại. */
function _setSettingsCarouselScrollLeftInstant(scrollerEl, left) {
    const prevSnapType = scrollerEl.style.scrollSnapType;
    scrollerEl.style.scrollSnapType = 'none';
    scrollerEl.scrollLeft = left;
    scrollerEl.style.scrollSnapType = prevSnapType;
}

/** scrollLeft để tâm card trùng tâm khung nhìn. */
function _getSettingsCarouselCenterScrollLeft(scrollerEl, cardEl) {
    return cardEl.offsetLeft + cardEl.offsetWidth / 2 - scrollerEl.clientWidth / 2;
}

/** Card GẦN tâm khung nhìn nhất + khoảng cách của từng card (đọc layout 1 lượt, chưa ghi gì). */
function _measureSettingsCarousel(scrollerEl) {
    const cards = Array.from(scrollerEl.querySelectorAll('[data-carousel-card]'));
    const viewCenter = scrollerEl.scrollLeft + scrollerEl.clientWidth / 2;
    const dists = cards.map((cardEl) => Math.abs(cardEl.offsetLeft + cardEl.offsetWidth / 2 - viewCenter));
    let nearestIdx = 0;
    dists.forEach((d, i) => { if (d < dists[nearestIdx]) nearestIdx = i; });
    const step = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : (cards[0] ? cards[0].offsetWidth : 1);
    return { cards, dists, nearestIdx, step: step || 1 };
}

/** Ghi scale/opacity theo khoảng cách tới tâm (đọc-hết-rồi-ghi-hết, tránh layout thrash) + đồng bộ
 * dải chấm. Trả card gần tâm nhất (hoặc null). */
function _applySettingsCarouselFocusStyles(scrollerEl) {
    const { cards, dists, nearestIdx, step } = _measureSettingsCarousel(scrollerEl);
    if (!cards.length) return null;
    cards.forEach((cardEl, i) => {
        const t = Math.min(dists[i] / step, 1); // 0 = đúng tâm, 1 = cách ≥ 1 bước
        cardEl.style.transform = `scale(${(1 - (1 - SETTINGS_CAROUSEL_MIN_SCALE) * t).toFixed(3)})`;
        cardEl.style.opacity = (1 - (1 - SETTINGS_CAROUSEL_MIN_OPACITY) * t).toFixed(3);
    });
    const focusIndex = cards[nearestIdx].dataset.carouselIndex;
    if (scrollerEl.dataset.carouselFocus !== focusIndex) { // chỉ ghi chấm khi current ĐỔI
        scrollerEl.dataset.carouselFocus = focusIndex;
        const wrapEl = scrollerEl.parentElement;
        if (wrapEl) wrapEl.querySelectorAll('[data-carousel-dot]').forEach((dotEl) => {
            const isActive = dotEl.dataset.carouselDot === focusIndex;
            dotEl.style.width = isActive ? '18px' : '6px';
            dotEl.style.opacity = isActive ? '1' : '0.35';
        });
    }
    return cards[nearestIdx];
}


/**
 * Lúc MỞ màn Main (bước 1/3 của hiệu ứng mở): đặt card `startIndex` (0 = đầu tiên) của bản chính
 * giữa vào TÂM (instant), giữ MỌI card ở trạng thái nhỏ/mờ (khớp HTML gốc) và bật cờ
 * `data-carousel-entering` — trong lúc cờ này bật `updateSettingsCarouselFocus()` KHÔNG làm gì (nếu
 * không, sự kiện `scroll` do chính lệnh đặt scrollLeft sẽ làm card phóng to NGAY, mất hiệu ứng).
 * Bước 2 (`startSettingsCarouselEntrance()`) và 3 (`endSettingsCarouselEntrance()`) do WORKFLOW gọi
 * sau khi hẹn giờ bằng taskManager — core KHÔNG tự hẹn giờ (task-manager-conventions.md mục 1-2).
 * @param {HTMLElement} scrollerEl @param {number} startIndex
 */
function initSettingsCarousel(scrollerEl, startIndex) {
    if (!scrollerEl) return;
    const cards = Array.from(scrollerEl.querySelectorAll('[data-carousel-card]'));
    const count = Number(scrollerEl.dataset.carouselCount) || 1;
    if (!cards.length) return;
    const midSet = Math.floor(cards.length / count / 2);
    const startCardEl = cards[midSet * count + Math.max(0, Math.min(count - 1, startIndex || 0))];
    scrollerEl.dataset.carouselEntering = '1';
    _setSettingsCarouselScrollLeftInstant(scrollerEl, _getSettingsCarouselCenterScrollLeft(scrollerEl, startCardEl));
}

/** Bước 2/3 — gỡ cờ entering, bật `transition` cho MỌI card rồi ghi scale/opacity đúng theo vị trí
 * hiện tại -> card đang ở tâm PHÓNG TO lên current (có animation), 2 card kề bên giữ nhỏ.
 * @param {HTMLElement} scrollerEl @param {number} durationMs */
function startSettingsCarouselEntrance(scrollerEl, durationMs) {
    if (!scrollerEl || !scrollerEl.isConnected) return; // drawer đã chuyển màn/đóng trong lúc chờ
    delete scrollerEl.dataset.carouselEntering;
    scrollerEl.querySelectorAll('[data-carousel-card]').forEach((cardEl) => {
        cardEl.style.transition = `transform ${durationMs}ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity ${durationMs}ms ease-out`;
    });
    _applySettingsCarouselFocusStyles(scrollerEl);
}

/** Bước 3/3 — gỡ `transition` (sau khi hiệu ứng mở xong) để lúc cuộn card đi theo tay TỨC THÌ, không bị trễ.
 * @param {HTMLElement} scrollerEl */
function endSettingsCarouselEntrance(scrollerEl) {
    if (!scrollerEl || !scrollerEl.isConnected) return;
    scrollerEl.querySelectorAll('[data-carousel-card]').forEach((cardEl) => { cardEl.style.transition = ''; });
}

/** Gọi MỖI sự kiện `scroll` (qua Router) — card càng gần tâm càng to/rõ, card rời tâm nhỏ/mờ dần.
 * @param {HTMLElement} scrollerEl */
function updateSettingsCarouselFocus(scrollerEl) {
    if (!scrollerEl || !scrollerEl.isConnected || scrollerEl.dataset.carouselEntering) return;
    _applySettingsCarouselFocusStyles(scrollerEl);
}

/** Gọi khi cuộn ĐÃ DỪNG (debounce ở wire) — nếu current đang ở bản lặp phía ngoài thì nhảy nguyên
 * số bản về bản giữa (hình ảnh y hệt nên không thấy giật), để luôn còn chỗ cuộn tiếp 2 phía = "vô hạn".
 * @param {HTMLElement} scrollerEl */
function settleSettingsCarouselLoop(scrollerEl) {
    if (!scrollerEl || !scrollerEl.isConnected || scrollerEl.dataset.carouselEntering) return;
    const { cards, nearestIdx } = _measureSettingsCarousel(scrollerEl);
    const count = Number(scrollerEl.dataset.carouselCount) || 1;
    if (cards.length <= count) return;
    const midSet = Math.floor(cards.length / count / 2);
    const setIndex = Math.floor(nearestIdx / count);
    if (setIndex === midSet) return;
    const targetIdx = nearestIdx + (midSet - setIndex) * count;
    _setSettingsCarouselScrollLeftInstant(scrollerEl, scrollerEl.scrollLeft + (cards[targetIdx].offsetLeft - cards[nearestIdx].offsetLeft));
}

/** Card đang ở giữa (= "current") — Workflow dùng return value để quyết định tap = mở hay = cuộn tới.
 * @param {HTMLElement} scrollerEl @returns {HTMLElement|null} */
function getSettingsCarouselFocusCard(scrollerEl) {
    if (!scrollerEl) return null;
    const { cards, nearestIdx } = _measureSettingsCarousel(scrollerEl);
    return cards[nearestIdx] || null;
}

/** Cuộn MƯỢT để `cardEl` vào tâm (tap card bên cạnh).
 * @param {HTMLElement} scrollerEl @param {HTMLElement} cardEl */
function scrollSettingsCarouselTo(scrollerEl, cardEl) {
    if (!scrollerEl || !cardEl) return;
    scrollerEl.scrollTo({ left: _getSettingsCarouselCenterScrollLeft(scrollerEl, cardEl), behavior: 'smooth' });
}
