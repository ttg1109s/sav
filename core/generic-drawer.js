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
 * (Fade chéo nội dung cũ/mới từng có trong bản này — BỎ theo yêu cầu Giang cùng ngày.)
 *
 * Mọi hàm dưới đây = đúng 1 việc, nhận tham số, không tự đọc appState, không gọi core khác, không listener/timer.
 */
const GENERIC_DRAWER_DEFAULT_Z_INDEX = Z_INDEX.GENERIC_DRAWER; // service/z-index.js
const GENERIC_DRAWER_ANIM_MS = 300; // trượt mở/đóng — khớp transition transform/overlay 300ms (assets/css/base.css, components/generic-drawer.js)
// SỬA (24/09/2026, Giang báo "quá nhanh, gây giật") — thời lượng co/giãn tách riêng khỏi cú trượt (trước dùng chung
// 300ms), chậm hơn + đường cong mềm hơn. Easing chiều cao: kiểu "decelerate" nhấn mạnh (vào nhanh,
// hạ cánh rất êm) — không có điểm dừng gắt như `ease-out` mặc định.
const GENERIC_DRAWER_HEIGHT_ANIM_MS = 380;
const GENERIC_DRAWER_HEIGHT_EASING = 'cubic-bezier(0.2, 0, 0, 1)';
const GENERIC_DRAWER_HEIGHT_ANIM_ID = 'generic-drawer-height';

/** Gắn header/body/khung cho nội dung MỚI — CHỈ gán DOM/style, TUYỆT ĐỐI không đọc layout (không scrollTop, không
 * offsetHeight...). SỬA (24/09/2026, Giang báo "viền các list item trong Generic Drawer nháy sáng lên") — bản trước gán
 * `scrollTop` NGAY sau innerHTML (và `openGenericDrawer()` còn ép reflow) TRƯỚC khi Workflow kịp áp UI Theme: trình duyệt
 * đã tính style cho nội dung mới với class CHƯA theme (viền mặc định sáng), rồi áp theme đổi sang màu viền tối — phần tử
 * nào có `transition`/`transition-colors` sẽ CHẠY hiệu ứng từ sáng về tối = nháy viền. Nay Workflow gọi hàm này ->
 * `applyUiThemeToDom()` -> rồi mới tới mọi bước đọc layout (trượt vào, đo chiều cao, đặt vị trí cuộn).
 * Hàm này thay cho `updateGenericDrawer(config)` + phần gắn nội dung bên trong `openGenericDrawer(config)` cũ.
 * @param {{headerHtml?:string, bodyHtml?:string, bodyClass?:string, height?:string, maxHeight?:string, zIndex?:number}} config */
function mountGenericDrawerContent(config) {
    const zIndex = config.zIndex || GENERIC_DRAWER_DEFAULT_Z_INDEX;
    genericDrawerPanel.style.zIndex = String(zIndex);
    genericDrawerOverlay.style.zIndex = String(zIndex - 1);
    genericDrawerHeader.innerHTML = config.headerHtml || '';
    genericDrawerBody.innerHTML = config.bodyHtml || '';
    genericDrawerBody.className = `flex-1 min-h-0 ${config.bodyClass || ''}`.trim(); // 'flex-1 min-h-0' LUÔN giữ, bodyClass CHỈ bổ sung
    genericDrawerPanel.style.minHeight = ''; // dọn di sản cơ chế min-height cũ (nếu còn sót)
    genericDrawerPanel.style.maxHeight = config.maxHeight || '';
    genericDrawerPanel.style.height = (config.height && config.height !== 'auto') ? config.height : ''; // rỗng = theo nội dung
}

/** Trượt Drawer từ đáy lên (đang ẩn, hoặc mở ĐÈ lên Drawer đang hiện) — nội dung đã được gắn + áp theme TRƯỚC đó
 * (`mountGenericDrawerContent()` + Workflow áp theme). SỬA (24/09/2026) — không còn nhận config/tự gắn nội dung, xem
 * lý do ở `mountGenericDrawerContent()`. */
function openGenericDrawer() {
    // Trượt vào: đặt mốc off-screen khi TẮT transition, ép reflow, BẬT lại rồi mới đổi transform (không ép reflow
    // giữa các bước thì trình duyệt gộp làm 1 và mất animation — bài học các bản trước).
    genericDrawerPanel.style.opacity = '0';
    genericDrawerPanel.classList.remove('hidden');
    genericDrawerPanel.style.transition = 'none';
    genericDrawerPanel.style.transform = 'translateY(100%)';
    void genericDrawerPanel.offsetHeight;

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
 * SỬA (24/09/2026) — thêm `elapsedMs`: dựng lại ĐÚNG animation cũ rồi tua tới đúng thời điểm đang chạy -> tiếp tục
 * liền mạch, không khựng (dùng khi Workflow phải huỷ tạm animation để đo mà đích không đổi).
 * @param {number} fromPx @param {number} toPx @param {number} durationMs @param {number} [elapsedMs] */
function animateGenericDrawerHeight(fromPx, toPx, durationMs, elapsedMs) {
    const anim = genericDrawerPanel.animate(
        [{ height: `${fromPx}px` }, { height: `${toPx}px` }],
        { duration: durationMs, easing: GENERIC_DRAWER_HEIGHT_EASING, id: GENERIC_DRAWER_HEIGHT_ANIM_ID },
    );
    anim.currentTime = elapsedMs || 0;
}

// XOÁ (24/09/2026, Giang yêu cầu "bỏ crossfade") — 3 hàm fade chéo (begin/play/clear) + hằng thời lượng fade + lớp phủ
// `#generic-drawer-fade-layer` (components/generic-drawer.js) bỏ hẳn.

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
