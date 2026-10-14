/**
 * core/settings-carousel-ui.js — carousel ngang của màn Main Setting (prev | current | next: card càng gần tâm càng to/rõ, cuộn
 * vô hạn bằng các bản lặp). HTML: components/settings/app-settings-main.js::renderAppSettingsCarousel(); listener:
 * core/app-settings-ui.js::wireAppSettingsMainCarousel(); điều phối + hẹn giờ (hiệu ứng mở, debounce "đã dừng cuộn"):
 * event/workflow/app-settings.js. Các hàm ở đây chỉ nhận tham số, không gọi nhau: đo (`measureSettingsCarousel()`) trả kết quả
 * cho Workflow chuyển sang hàm ghi.
 *
 * DOM: `scrollerEl` = `#app-settings-carousel` (flex ngang, scroll-snap, `position:relative` để `offsetLeft` tính theo nội dung
 * cuộn) chứa các bản lặp của N card (`[data-carousel-card]`, `data-carousel-index` 0..N-1, `data-carousel-count` = N trên
 * scroller); dải chấm `[data-carousel-dot]` là anh em của scroller. Số bản lặp tự suy ra từ số card / N. Không dùng
 * `scroll-snap-stop: always` (vuốt mạnh lướt qua nhiều card). Vùng bọc có `data-gd-ignore-mutation` (style card đổi liên tục).
 */

/** Scale/opacity của card cách tâm ≥ 1 bước (bước = bề rộng card + gap); card đúng tâm = 1. Khớp style ban đầu ở
 * app-settings-main.js (`transform:scale(0.8); opacity:0.5`). */
const SETTINGS_CAROUSEL_MIN_SCALE = 0.8;
const SETTINGS_CAROUSEL_MIN_OPACITY = 0.5;

/** Đo layout 1 lượt, chưa ghi gì: khoảng cách từng card tới tâm khung nhìn, card gần tâm nhất, bước, số card 1 bản.
 * @param {HTMLElement} scrollerEl
 * @returns {{cards:HTMLElement[], dists:number[], nearestIdx:number, step:number, focusCard:HTMLElement|null, count:number}} */
function measureSettingsCarousel(scrollerEl) {
    if (!scrollerEl) return { cards: [], dists: [], nearestIdx: 0, step: 1, focusCard: null, count: 1 };
    const cards = Array.from(scrollerEl.querySelectorAll('[data-carousel-card]'));
    const viewCenter = scrollerEl.scrollLeft + scrollerEl.clientWidth / 2;
    const dists = cards.map((cardEl) => Math.abs(cardEl.offsetLeft + cardEl.offsetWidth / 2 - viewCenter));
    let nearestIdx = 0;
    dists.forEach((d, i) => { if (d < dists[nearestIdx]) nearestIdx = i; });
    const step = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : (cards[0] ? cards[0].offsetWidth : 1);
    return { cards, dists, nearestIdx, step: step || 1, focusCard: cards[nearestIdx] || null, count: Number(scrollerEl.dataset.carouselCount) || 1 };
}

/** scrollLeft để tâm `cardEl` trùng tâm khung nhìn. @param {HTMLElement} scrollerEl @param {HTMLElement} cardEl @returns {number} */
function computeSettingsCarouselCenterLeft(scrollerEl, cardEl) {
    return cardEl.offsetLeft + cardEl.offsetWidth / 2 - scrollerEl.clientWidth / 2;
}

/** Đổi `scrollLeft` NGAY (không animate, không bị scroll-snap kéo lại) — tắt snap tạm rồi bật lại.
 * @param {HTMLElement} scrollerEl @param {number} left */
function setSettingsCarouselScrollLeftInstant(scrollerEl, left) {
    const prevSnapType = scrollerEl.style.scrollSnapType;
    scrollerEl.style.scrollSnapType = 'none';
    scrollerEl.scrollLeft = left;
    scrollerEl.style.scrollSnapType = prevSnapType;
}

/**
 * Bước 1/3 hiệu ứng mở màn Main: bật cờ `data-carousel-entering` (trong lúc bật, ghi focus và kéo-về-bản-giữa đều bỏ qua — nếu
 * không, sự kiện `scroll` do chính lệnh đặt scrollLeft sẽ phóng to card ngay, mất hiệu ứng) và trả card thứ `startIndex` của
 * bản lặp giữa để Workflow đặt vào tâm. Không có card -> null (không bật cờ).
 * @param {HTMLElement} scrollerEl @param {number} startIndex @returns {HTMLElement|null}
 */
function beginSettingsCarouselEntrance(scrollerEl, startIndex) {
    if (!scrollerEl) return null;
    const cards = Array.from(scrollerEl.querySelectorAll('[data-carousel-card]'));
    const count = Number(scrollerEl.dataset.carouselCount) || 1;
    if (!cards.length) return null;
    const midSet = Math.floor(cards.length / count / 2);
    scrollerEl.dataset.carouselEntering = '1';
    return cards[midSet * count + Math.max(0, Math.min(count - 1, startIndex || 0))];
}

/** Bước 2/3 — gỡ cờ entering, bật `transition` cho mọi card (Workflow ghi focus ngay sau -> card ở tâm phóng to có animation).
 * Scroller đã rời DOM (drawer chuyển màn/đóng trong lúc chờ) -> bỏ qua. @param {HTMLElement} scrollerEl @param {number} durationMs */
function startSettingsCarouselEntrance(scrollerEl, durationMs) {
    if (!scrollerEl || !scrollerEl.isConnected) return;
    delete scrollerEl.dataset.carouselEntering;
    scrollerEl.querySelectorAll('[data-carousel-card]').forEach((cardEl) => {
        cardEl.style.transition = `transform ${durationMs}ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity ${durationMs}ms ease-out`;
    });
}

/** Bước 3/3 — gỡ `transition` để lúc cuộn card đi theo tay tức thì. @param {HTMLElement} scrollerEl */
function endSettingsCarouselEntrance(scrollerEl) {
    if (!scrollerEl || !scrollerEl.isConnected) return;
    scrollerEl.querySelectorAll('[data-carousel-card]').forEach((cardEl) => { cardEl.style.transition = ''; });
}

/** Ghi scale/opacity theo khoảng cách tới tâm (số đo có sẵn — đọc-hết-rồi-ghi-hết, tránh layout thrash) + đồng bộ dải chấm khi
 * card current đổi. Scroller đã rời DOM / đang entering / không có card -> bỏ qua.
 * @param {HTMLElement} scrollerEl @param {ReturnType<typeof measureSettingsCarousel>} measure */
function applySettingsCarouselFocusStyles(scrollerEl, measure) {
    if (!scrollerEl || !scrollerEl.isConnected || scrollerEl.dataset.carouselEntering || !measure.cards.length) return;
    const { cards, dists, step, focusCard } = measure;
    cards.forEach((cardEl, i) => {
        const t = Math.min(dists[i] / step, 1); // 0 = đúng tâm, 1 = cách ≥ 1 bước
        cardEl.style.transform = `scale(${(1 - (1 - SETTINGS_CAROUSEL_MIN_SCALE) * t).toFixed(3)})`;
        cardEl.style.opacity = (1 - (1 - SETTINGS_CAROUSEL_MIN_OPACITY) * t).toFixed(3);
    });
    const focusIndex = focusCard.dataset.carouselIndex;
    if (scrollerEl.dataset.carouselFocus === focusIndex) return; // chỉ ghi chấm khi current ĐỔI
    scrollerEl.dataset.carouselFocus = focusIndex;
    const wrapEl = scrollerEl.parentElement;
    if (wrapEl) wrapEl.querySelectorAll('[data-carousel-dot]').forEach((dotEl) => {
        const isActive = dotEl.dataset.carouselDot === focusIndex;
        dotEl.style.width = isActive ? '18px' : '6px';
        dotEl.style.opacity = isActive ? '1' : '0.35';
    });
}

/** Cuộn đã dừng mà card current nằm ở bản lặp phía ngoài -> scrollLeft tương ứng ở bản giữa (hình y hệt nên không thấy giật),
 * để luôn còn chỗ cuộn tiếp 2 phía. null = không cần nhảy (đang ở bản giữa, chỉ 1 bản, đang entering, đã rời DOM).
 * @param {HTMLElement} scrollerEl @param {ReturnType<typeof measureSettingsCarousel>} measure @returns {number|null} */
function computeSettingsCarouselSettleLeft(scrollerEl, measure) {
    if (!scrollerEl || !scrollerEl.isConnected || scrollerEl.dataset.carouselEntering) return null;
    const { cards, nearestIdx, count } = measure;
    if (cards.length <= count) return null;
    const midSet = Math.floor(cards.length / count / 2);
    const setIndex = Math.floor(nearestIdx / count);
    if (setIndex === midSet) return null;
    const targetIdx = nearestIdx + (midSet - setIndex) * count;
    return scrollerEl.scrollLeft + (cards[targetIdx].offsetLeft - cards[nearestIdx].offsetLeft);
}

/** Tap 1 card: card đang ở tâm (= mở màn đích) hay card bên cạnh (= cuộn vào giữa), kèm chỉ số của card trong 1 bản.
 * @param {ReturnType<typeof measureSettingsCarousel>} measure @param {HTMLElement} cardEl @returns {{isFocused:boolean, index:number}} */
function resolveSettingsCarouselTap(measure, cardEl) {
    return { isFocused: measure.focusCard === cardEl, index: Number(cardEl.dataset.carouselIndex) || 0 };
}

/** Cuộn MƯỢT tới `left`. @param {HTMLElement} scrollerEl @param {number} left */
function scrollSettingsCarouselTo(scrollerEl, left) {
    if (!scrollerEl) return;
    scrollerEl.scrollTo({ left, behavior: 'smooth' });
}
