/**
 * core/generic-drawer.js — Core thuần của Generic Drawer (khung HTML tĩnh: components/generic-drawer.js).
 *
 * VIẾT LẠI (24/09/2026, Giang yêu cầu \"animation chiều cao khi update + fade chéo, đơn giản không bug\" + \"xử lý
 * những chỗ vi phạm core rule, event bus\"). Bản cũ (lưu lịch sử đầy đủ trong git/changelog) có 4 vi phạm:
 *   - Rule 3: `openGenericDrawer()`/`updateGenericDrawer()` tự gọi core khác `applyUiThemeToDom()` -> nay Workflow
 *     (event/workflow/generic-drawer-helpers.js) gọi SAU khi gắn nội dung.
 *   - Rule 5a/event bus: 1 `MutationObserver` + `requestAnimationFrame` sống NGAY trong core, tự nghe DOM TĨNH
 *     (#generic-drawer-body) và tự quyết định đo lại -> nay Listener (event/listener/generic-drawer.js) quan sát, gửi
 *     'genericDrawer.body.mutate' qua eventBus -> Router -> Workflow gọi các hàm core đo/animate bên dưới.
 *   - Rule 5b: rẽ nhánh theo `classList.contains('hidden')` bên trong callback observer -> Workflow tự kiểm.
 *   - Rule 1: `_resolveGenericDrawerHeightPx()` rẽ 2 tiến trình (cao cố định / auto) + `min-height` animate lệch 2
 *     chiều (cao lên thì NHẢY, thấp xuống thì lộ khoảng trống) -> bỏ hẳn cơ chế `min-height`.
 *
 * CƠ CHẾ MỚI — panel luôn để chiều cao \"thật\" (`height` = `config.height` hoặc rỗng = theo nội dung, kẹp bởi
 * `max-height`); hiệu ứng chuyển chiều cao dùng Web Animations API (`element.animate()`): animation CHỈ phủ lên giá
 * trị hiển thị trong lúc chạy, xong là trình duyệt tự trả về chiều cao thật — KHÔNG cần bước \"nhả khoá\"
 * (transitionend/timer), không kẹt px khi nội dung đổi về sau (ảnh load, xoay màn hình...).
 * Fade chéo: nội dung CŨ (node thật, không clone — tránh trùng id/nhóm radio) được CHUYỂN sang lớp phủ tĩnh
 * `#generic-drawer-fade-layer` rồi mờ dần, nội dung MỚI hiện dần ở chỗ thật. Workflow dọn lớp phủ khi hết thời gian.
 *
 * Mọi hàm dưới đây = đúng 1 việc, nhận tham số, không tự đọc appState, không gọi core khác, không listener/timer.
 */
const GENERIC_DRAWER_DEFAULT_Z_INDEX = Z_INDEX.GENERIC_DRAWER; // service/z-index.js
const GENERIC_DRAWER_ANIM_MS = 300; // khớp transition transform/overlay 300ms (assets/css/base.css, components/generic-drawer.js)
const GENERIC_DRAWER_HEIGHT_ANIM_ID = 'generic-drawer-height';

/** Gắn header/body/khung cho nội dung — phần CHUNG của open/update (hàm con nội bộ theo Rule 3c: chỉ phục vụ 2 hàm
 * ngay dưới trong CÙNG file, không nơi nào khác gọi). */
function _mountGenericDrawerContent(config) {
    const zIndex = config.zIndex || GENERIC_DRAWER_DEFAULT_Z_INDEX;
    genericDrawerPanel.style.zIndex = String(zIndex);
    genericDrawerOverlay.style.zIndex = String(zIndex - 1);
    genericDrawerHeader.innerHTML = config.headerHtml || '';
    genericDrawerBody.innerHTML = config.bodyHtml || '';
    genericDrawerBody.className = `flex-1 min-h-0 ${config.bodyClass || ''}`.trim(); // 'flex-1 min-h-0' LUÔN giữ, bodyClass CHỈ bổ sung
    genericDrawerPanel.style.minHeight = ''; // dọn di sản cơ chế min-height cũ (nếu còn sót)
    genericDrawerPanel.style.maxHeight = config.maxHeight || '';
    genericDrawerPanel.style.height = (config.height && config.height !== 'auto') ? config.height : ''; // rỗng = theo nội dung
    genericDrawerBody.scrollTop = config.scrollTop || 0;
}

/** Mở Drawer (đang ẩn, hoặc mở ĐÈ nội dung mới lên Drawer đang hiện) — gắn nội dung rồi trượt từ đáy lên.
 * @param {{headerHtml?:string, bodyHtml?:string, bodyClass?:string, height?:string, maxHeight?:string, zIndex?:number, scrollTop?:number}} config */
function openGenericDrawer(config) {
    _mountGenericDrawerContent(config);
    // Trượt vào: đặt mốc off-screen khi TẮT transition, ép reflow, BẬT lại rồi mới đổi transform (không ép reflow
    // giữa các bước thì trình duyệt gộp làm 1 và mất animation — bài học các bản trước).
    genericDrawerPanel.style.opacity = '0';
    genericDrawerPanel.classList.remove('hidden');
    genericDrawerPanel.style.transition = 'none';
    genericDrawerPanel.style.transform = 'translateY(100%)';
    void genericDrawerPanel.offsetHeight;
    genericDrawerBody.scrollTop = config.scrollTop || 0; // lúc còn `hidden` gán không có tác dụng -> gán lại sau khi hiện

    genericDrawerOverlay.classList.remove('hidden');
    void genericDrawerOverlay.offsetHeight; // ép reflow — đảm bảo transition opacity CHẠY
    genericDrawerOverlay.classList.remove('opacity-0');
    genericDrawerOverlay.classList.add('pointer-events-auto');

    genericDrawerPanel.style.opacity = '';
    void genericDrawerPanel.offsetHeight;
    genericDrawerPanel.style.transition = '';
    void genericDrawerPanel.offsetHeight;
    genericDrawerPanel.style.transform = 'translateY(0)';

    appState.set('isGenericDrawerOpen', true);
    console.log(`writer: "openGenericDrawer", page: "isGenericDrawerOpen", content: "true"`);
}

/** Thay nội dung Drawer ĐANG mở tại chỗ (không trượt). Chiều cao/fade do Workflow điều phối qua các hàm bên dưới.
 * @param {object} config - cùng shape `openGenericDrawer()`. */
function updateGenericDrawer(config) {
    _mountGenericDrawerContent(config);
}

/** @returns {number} chiều cao panel ĐANG HIỂN THỊ (px) — kể cả khi animation chiều cao đang chạy. */
function readGenericDrawerHeightPx() {
    return genericDrawerPanel.getBoundingClientRect().height;
}

/** Dừng animation chiều cao đang chạy (nếu có) rồi trả chiều cao THẬT của panel theo nội dung hiện tại.
 * @returns {number} px */
function settleGenericDrawerHeightPx() {
    genericDrawerPanel.getAnimations().forEach((a) => { if (a.id === GENERIC_DRAWER_HEIGHT_ANIM_ID) a.cancel(); });
    return genericDrawerPanel.getBoundingClientRect().height;
}

/** Animate chiều cao hiển thị từ `fromPx` tới `toPx` — xong tự về chiều cao thật (WAAPI không `fill`).
 * @param {number} fromPx @param {number} toPx @param {number} durationMs */
function animateGenericDrawerHeight(fromPx, toPx, durationMs) {
    genericDrawerPanel.animate(
        [{ height: `${fromPx}px` }, { height: `${toPx}px` }],
        { duration: durationMs, easing: 'ease-out', id: GENERIC_DRAWER_HEIGHT_ANIM_ID },
    );
}

/** Fade chéo bước 1 — CHUYỂN (không clone) toàn bộ node header/body hiện tại sang lớp phủ tĩnh, giữ nguyên vị trí
 * cuộn, để ngay sau đó nội dung mới được gắn vào header/body thật. Gọi NGAY TRƯỚC `updateGenericDrawer()`. */
function beginGenericDrawerCrossfade() {
    genericDrawerFadeLayer.style.top = `${genericDrawerHeader.offsetTop}px`;
    genericDrawerFadeLayer.style.opacity = '1';
    genericDrawerFadeLayer.classList.remove('hidden');
    genericDrawerFadeHeader.replaceChildren(...genericDrawerHeader.childNodes);
    genericDrawerFadeBody.className = genericDrawerBody.className;
    const oldScrollTop = genericDrawerBody.scrollTop;
    genericDrawerFadeBody.replaceChildren(...genericDrawerBody.childNodes);
    genericDrawerFadeBody.scrollTop = oldScrollTop;
}

/** Fade chéo bước 2 — lớp phủ (nội dung cũ) mờ dần, header/body thật (nội dung mới) hiện dần. Gọi SAU khi gắn nội
 * dung mới. Lớp phủ giữ opacity 0 (`fill`) tới lúc `clearGenericDrawerCrossfade()`.
 * @param {number} durationMs */
function playGenericDrawerCrossfade(durationMs) {
    const opts = { duration: durationMs, easing: 'ease-out' };
    genericDrawerFadeLayer.animate([{ opacity: 1 }, { opacity: 0 }], { ...opts, fill: 'forwards' });
    genericDrawerHeader.animate([{ opacity: 0 }, { opacity: 1 }], opts);
    genericDrawerBody.animate([{ opacity: 0 }, { opacity: 1 }], opts);
}

/** Dọn lớp phủ fade chéo — dừng mọi animation opacity liên quan, bỏ nội dung cũ, ẩn lớp phủ. An toàn gọi nhiều lần. */
function clearGenericDrawerCrossfade() {
    genericDrawerFadeLayer.getAnimations().forEach((a) => a.cancel());
    genericDrawerHeader.getAnimations().forEach((a) => a.cancel());
    genericDrawerBody.getAnimations().forEach((a) => a.cancel());
    genericDrawerFadeHeader.replaceChildren();
    genericDrawerFadeBody.replaceChildren();
    genericDrawerFadeLayer.classList.add('hidden');
}

/** Trượt panel xuống + mờ overlay. Ẩn hẳn do Workflow hẹn giờ gọi `hideGenericDrawerImmediately()`. */
function closeGenericDrawer() {
    genericDrawerPanel.style.transform = 'translateY(100%)';
    genericDrawerOverlay.classList.add('opacity-0');
    genericDrawerOverlay.classList.remove('pointer-events-auto'); // cho thao tác lọt qua NGAY lúc bắt đầu mờ dần
}

/** Ẩn hẳn panel + overlay (sau khi trượt xong). */
function hideGenericDrawerImmediately() {
    genericDrawerPanel.classList.add('hidden');
    genericDrawerPanel.style.opacity = '0'; // lưới an toàn kép
    genericDrawerOverlay.classList.add('hidden');
    appState.set('isGenericDrawerOpen', false);
    console.log(`writer: "hideGenericDrawerImmediately", page: "isGenericDrawerOpen", content: "false"`);
}
