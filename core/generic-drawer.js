/**
 * core/generic-drawer.js — Core NGHIỆP VỤ tuân Rule 1-5 đầy đủ (core-function-conventions.md) cho
 * 1 drawer TRẮNG dùng chung (mục 2 plan-v12-extended.md) — Document List+Reader dùng (xem
 * event/workflow/document-reader.js) — Settings/File Manager Song/Photo/Folder Detail GIỮ NGUYÊN
 * nav-stack riêng (core/settings-panel-stack.js), KHÔNG migrate.
 *
 * [SỬA 13/07/2026, Giang yêu cầu] — KHÔI PHỤC lại overlay (nền mờ che toàn màn hình, ĐÃ BỎ
 * 10/07/2026 vì bug `closeGenericDrawer()` không xoá lại `hidden` cho overlay, che chắn UI mãi mãi
 * sau lần đóng đầu) — lần này SỬA ĐÚNG gốc: `closeGenericDrawer()`/`hideGenericDrawerImmediately()`
 * xử lý overlay THEO ĐÚNG NHỊP với panel (ẩn dần lúc bắt đầu đóng, xoá `hidden` hẳn lúc đã đóng
 * xong) — không lặp lại bug cũ.
 *
 * THÊM 1 việc MỚI cùng đợt:
 * 1. `isGenericDrawerOpen` (service/state.js) — ghi `true` lúc mở, `false` lúc đóng hẳn — dùng bởi
 *    Block gate (event/block.js) để CHẶN mọi msg.type "mở Generic Drawer" khác trong lúc đang mở
 *    (tránh 2 tính năng cùng lúc ghi đè bodyHtml của nhau) — xem event/block.js.
 *
 * ĐÃ GỠ (rewrite Photo/Album, Giang yêu cầu "không dùng window virtual tự tạo nữa") —
 * `config.isWindowVirtual`/`isGenericDrawerContentVirtual` (từng ghi cờ cho `event/router/
 * virtual-list.js` biết có nên xử lý 'scroll' hay không) — XOÁ HẲN cùng lúc bỏ hẳn
 * `event/workflow,router,listener/virtual-list.js` — picker ảnh Generic Drawer giờ dùng
 * `event/workflow/photo-gallery-window.js` (IntersectionObserver, KHÔNG cần lắng nghe sự kiện
 * 'scroll' nào cả, nên cờ gate này không còn ý nghĩa).
 *
 * Ghi qua `appState.set()` (Rule 2 CHO PHÉP — chỉ chặn chiều ĐỌC, không chặn chiều GHI), kèm
 * `console.log` theo Rule 4.
 *
 * Khung HTML (components/generic-drawer.js) lấy NGUYÊN từ components/document-picker-drawer.js CŨ
 * (ĐÃ XOÁ) — đổi id/class sang trung tính `generic-drawer*`.
 *
 * Drawer KHÔNG biết nội dung headerHtml/bodyHtml là gì (chỉ nhận chuỗi HTML có sẵn, gán thẳng vào
 * innerHTML) — Workflow tự querySelector bên trong SAU KHI gọi openGenericDrawer()/
 * updateGenericDrawer() để wire event (KHÔNG đi qua eventBus cho các nút động này).
 *
 * `hideGenericDrawerImmediately()` — ẩn hẳn panel + overlay (thêm `hidden`, không chỉ trượt
 * xuống/mờ dần) — Workflow tự gọi hàm này SAU KHI nghe `transitionend` trên panel (core/generic-
 * drawer.js KHÔNG tự addEventListener ở đây vì panel là DOM TĨNH có sẵn từ dom-refs.js, KHÔNG phải
 * cụm DOM MỚI tự tạo — không đạt điều kiện ngoại lệ Rule 5a, xem core-function-conventions.md).
 *
 * NẠP SAU: core/dom-refs.js (genericDrawerOverlay/Panel/Header/Body), service/state.js (appState).
 */

/**
 * [SỬA 14/07/2026, Giang báo — "mở từ Playlist thì Drawer nằm DƯỚI UI, mở từ Visualizer thì OK"]
 * — NGUYÊN NHÂN GỐC: `#app-stack` (components/app-view-stack.js, bọc CẢ Playlist LẪN Settings) là
 * `fixed inset-0 z-[60]` — tự tạo 1 STACKING CONTEXT riêng. `#generic-drawer-panel`/
 * `#generic-drawer-overlay` là ANH EM (sibling) của `#app-stack` trong `#app-root` (xem main.js),
 * KHÔNG phải hậu duệ của nó — z-index của bất kỳ thứ gì BÊN TRONG `#app-stack` (kể cả
 * `#song-action-menu` z-[115]) chỉ so sánh được VỚI NHAU trong phạm vi stacking context đó, KHÔNG
 * "thoát ra ngoài" để so với `#generic-drawer-panel` — thứ THẬT SỰ cạnh tranh với Generic Drawer là
 * chính `#app-stack` (z-60). Mặc định CŨ `zIndex: 40` (< 60) khiến Drawer luôn bị `#app-stack` đè
 * lên bất cứ khi nào Playlist/Settings đang là view active — ĐÚNG triệu chứng "mở từ Playlist bị
 * nằm dưới UI" (mở từ nút trong Visualizer Control Center "may mắn" không việc gì vì lúc đó
 * `#app-stack` đang bị trượt translate ra ngoài khung nhìn, không thật sự che ĐÚNG vị trí Drawer).
 * SỬA: nâng mặc định lên `GENERIC_DRAWER_DEFAULT_Z_INDEX` — soi lại TOÀN BỘ z-index đang dùng
 * trong app (`z-[130]` của modalChoice() là mốc "đứng trên mọi modal thường, dưới loading-shield
 * z-[200]", xem docstring core/modal-choice-ui.js) — đặt Generic Drawer ở `128`: CAO HƠN mọi overlay
 * nội dung hiện có (menu/modal cao nhất trước đó là playback-error-modal `z-[125]`), THẤP HƠN
 * modalChoice() (`130`) để alertModal()/modalChoice() bật lên TRONG LÚC Drawer đang mở (vd báo lỗi
 * trùng tên khi tạo folder) vẫn hiện ĐÚNG TRÊN Drawer, không bị Drawer đè ngược lại.
 */
const GENERIC_DRAWER_DEFAULT_Z_INDEX = Z_INDEX.GENERIC_DRAWER; // SỬA (25/07/2026, đợt tái cấu trúc state) — trước đây hardcode `128` riêng ở đây, trùng lặp với Z_INDEX.GENERIC_DRAWER (service/z-index.js) — nay đọc thẳng từ bảng chung, tránh lệch nếu 1 trong 2 chỗ bị sửa mà quên chỗ kia.

/**
 * MỚI (phản hồi Giang mục 2 — "mặc định phải có 1 khoảng gap bên dưới" cho height:'auto') — gap
 * nằm BÊN TRONG panel (panel vẫn dính đáy màn hình `bottom-0` y hệt height cố định, KHÔNG nổi lên
 * tách khỏi mép màn hình) — chỉ là bên dưới nội dung thật còn 1 khoảng đệm TRẮNG (padding-bottom
 * của panel, cùng màu nền, "thuộc về" drawer) trước khi chạm đáy, tránh nội dung dính sát mép/thanh
 * home indicator. Height cố định (vd '90vh') KHÔNG có padding này (đã tự cuộn nội bộ, không cần).
 */
const GENERIC_DRAWER_AUTO_HEIGHT_GAP_PX = 16;

/**
 * Đo chiều cao TỰ NHIÊN thật của panel theo đúng nội dung VỪA gán (headerHtml/bodyHtml đã set vào
 * DOM) + padding-bottom (gap trong, xem hằng số trên), giới hạn bởi `maxHeight` — dùng cho
 * `height: 'auto'`. Set tạm `style.height='auto'` + `maxHeight` rồi đọc `offsetHeight` (CSS
 * `max-height` tự chặn đúng lúc đo — bao gồm LUÔN cả padding-bottom vừa set, không cần tính tay).
 * @returns {number} px
 */
function _measureGenericDrawerAutoHeightPx(maxHeight) {
    genericDrawerPanel.style.paddingBottom = `calc(env(safe-area-inset-bottom, 0px) + ${GENERIC_DRAWER_AUTO_HEIGHT_GAP_PX}px)`;
    genericDrawerPanel.style.maxHeight = maxHeight || '';
    genericDrawerPanel.style.height = 'auto';
    return genericDrawerPanel.offsetHeight;
}

/**
 * Set `style.height` theo `config.height`:
 *   - `'auto'`: đo chiều cao thật (đã gán content + padding-bottom trong, xem
 *     `_measureGenericDrawerAutoHeightPx()`), set bằng SỐ PX CỤ THỂ (KHÔNG để nguyên chuỗi 'auto'
 *     — CSS không animate được tới/từ 'auto', xem CSS transition ở assets/css/base.css).
 *   - Chuỗi khác (vd '90vh'/'70vh'): giữ NGUYÊN hành vi cũ — không padding-bottom thêm (đã tự cuộn
 *     nội bộ nhờ bodyClass overflow-y-auto, không cần đệm).
 * Panel LUÔN dính đáy (`bottom-0`, style.bottom rỗng) + bo 2 góc trên — KHÔNG đổi theo auto/cố
 * định (gap là ĐỆM BÊN TRONG, không phải panel nổi tách khỏi mép màn hình).
 * @param {{height?: string, maxHeight?: string}} config
 */
function _applyGenericDrawerHeight(config) {
    if (config.height === 'auto') {
        const px = _measureGenericDrawerAutoHeightPx(config.maxHeight);
        genericDrawerPanel.style.height = `${px}px`;
    } else {
        genericDrawerPanel.style.paddingBottom = '';
        genericDrawerPanel.style.maxHeight = config.maxHeight || '';
        genericDrawerPanel.style.height = config.height || '70vh';
    }
}


/**
 * Mở drawer LẦN ĐẦU (đang đóng -> mở) — set toàn bộ cấu hình + trượt lên + hiện overlay.
 * @param {{height?: string, maxHeight?: string, zIndex?: number, headerHtml: string, bodyHtml: string, bodyClass?: string}} config
 *   - height: mặc định '70vh' nếu không truyền.
 *   - maxHeight: MỚI (14/07/2026, Giang yêu cầu — "tránh thừa khoảng trống" cho grid folder ít
 *     item) — mặc định RỖNG (không giới hạn thêm gì cả, giữ hành vi cũ) nếu không truyền. Dùng
 *     KẾT HỢP `height: 'auto'` để panel tự co theo ĐÚNG nội dung thật (không còn 1 khối cố định
 *     cao `height` bất kể có bao nhiêu nội dung) nhưng vẫn KHÔNG BAO GIỜ vượt quá `maxHeight` (nội
 *     dung dài sẽ tự cuộn bên trong `genericDrawerBody`, nhờ `bodyClass: 'overflow-y-auto'`).
 *   - zIndex: mặc định GENERIC_DRAWER_DEFAULT_Z_INDEX (128) nếu không truyền (overlay tự dùng
 *     zIndex - 1) — xem giải thích đầy đủ ở docstring hằng số phía trên.
 */
function openGenericDrawer(config) {
    const zIndex = config.zIndex || GENERIC_DRAWER_DEFAULT_Z_INDEX;
    genericDrawerPanel.style.zIndex = String(zIndex);
    genericDrawerHeader.innerHTML = config.headerHtml || '';
    genericDrawerBody.innerHTML = config.bodyHtml || '';
    genericDrawerBody.className = `flex-1 min-h-0 ${config.bodyClass || ''}`.trim(); // 'flex-1 min-h-0' LUÔN giữ, bodyClass CHỈ bổ sung
    _applyGenericDrawerHeight(config); // core/generic-drawer.js — height cố định HOẶC 'auto' (đo theo content vừa gán, xem docstring)

    genericDrawerOverlay.style.zIndex = String(zIndex - 1);
    genericDrawerOverlay.classList.remove('hidden');
    void genericDrawerOverlay.offsetHeight; // ép reflow — đảm bảo transition opacity CHẠY (cùng lý do panel bên dưới)
    genericDrawerOverlay.classList.remove('opacity-0');
    genericDrawerOverlay.classList.add('pointer-events-auto');

    genericDrawerPanel.classList.remove('hidden');
    // Ép reflow trước khi bỏ translate-y-full — đảm bảo transition CHẠY (thêm/bỏ nhiều class
    // off-screen cùng lúc trong 1 tick JS có thể bị trình duyệt gộp, bỏ qua animation nếu không
    // ép reflow ở giữa).
    void genericDrawerPanel.offsetHeight;
    genericDrawerPanel.classList.remove('translate-y-full');

    appState.set('isGenericDrawerOpen', true);
    console.log(`writer: "openGenericDrawer", page: "isGenericDrawerOpen", content: "true"`);
}

/**
 * Chuyển MƯỢT sang cấu hình MỚI trong khi ĐANG MỞ (không đóng/mở lại từ đầu) — cơ chế chuyển
 * List <-> Read (mục 2/4.1 plan-v12-extended.md). Drawer PHẢI đang mở trước khi gọi.
 *
 * SỬA (phản hồi Giang mục 2 — "khi thay đổi nội dung & chiều cao cần có animation") — TRƯỚC ĐÂY
 * nhảy cóc tức thời (`style.height = ...` ghi đè thẳng, không transition) — giờ ĐÓNG BĂNG ở chiều
 * cao HIỆN TẠI (số px cụ thể, đo qua `getBoundingClientRect()`) TRƯỚC KHI đổi nội dung, rồi mới set
 * chiều cao ĐÍCH — CSS transition (`#generic-drawer-panel`, assets/css/base.css) tự chạy mượt giữa
 * 2 mốc SỐ CỤ THỂ này (browser interpolate được giữa px/vh, KHÔNG cần cùng đơn vị).
 * @param {{height?: string, maxHeight?: string, zIndex?: number, headerHtml: string, bodyHtml: string, bodyClass?: string}} config
 */
function updateGenericDrawer(config) {
    const zIndex = config.zIndex || GENERIC_DRAWER_DEFAULT_Z_INDEX;

    const fromHeightPx = genericDrawerPanel.getBoundingClientRect().height;
    genericDrawerPanel.style.height = `${fromHeightPx}px`;
    void genericDrawerPanel.offsetHeight; // ép reflow — chốt mốc BẮT ĐẦU trước khi đổi nội dung/chiều cao đích

    genericDrawerPanel.style.zIndex = String(zIndex);
    genericDrawerHeader.innerHTML = config.headerHtml || '';
    genericDrawerBody.innerHTML = config.bodyHtml || '';
    genericDrawerBody.className = `flex-1 min-h-0 ${config.bodyClass || ''}`.trim();
    genericDrawerOverlay.style.zIndex = String(zIndex - 1);

    _applyGenericDrawerHeight(config); // core/generic-drawer.js — set mốc ĐÍCH, transition CSS tự chạy giữa 2 mốc
}

/** Đóng drawer (trượt xuống + mờ dần overlay) — CHƯA thêm lại `hidden` (đợi transition xong, xem
 * `hideGenericDrawerImmediately()` — Workflow tự gọi 2 hàm này nối tiếp qua `transitionend`). */
function closeGenericDrawer() {
    genericDrawerPanel.classList.add('translate-y-full');
    genericDrawerOverlay.classList.add('opacity-0');
    genericDrawerOverlay.classList.remove('pointer-events-auto'); // cho thao tác lọt qua NGAY lúc bắt đầu mờ dần, không đợi hết transition
}

/** Ẩn HẲN panel + overlay (thêm `hidden`) — gọi SAU KHI transition trượt xuống đã xong (Workflow
 * tự nghe `transitionend` rồi gọi hàm này, xem event/workflow/document-reader.js). Đây là chỗ DUY
 * NHẤT set `isGenericDrawerOpen = false` — đảm bảo Block gate (event/block.js) chỉ cho mở lại SAU
 * KHI overlay/panel đã ẩn hẳn thật sự, không phải ngay lúc bắt đầu trượt xuống. */
function hideGenericDrawerImmediately() {
    genericDrawerPanel.classList.add('hidden');
    genericDrawerOverlay.classList.add('hidden');

    appState.set('isGenericDrawerOpen', false);
    console.log(`writer: "hideGenericDrawerImmediately", page: "isGenericDrawerOpen", content: "false"`);
}
