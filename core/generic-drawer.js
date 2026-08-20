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
 *
 * [SỬA 20/08/2026, Giang xác nhận — điều tra bug "Settings bị cutoff chiều cao, mở lại lần 2 mới
 * đúng"] — 2 THAY ĐỔI CÙNG ĐỢT trong `openGenericDrawer()`/`updateGenericDrawer()`/
 * `closeGenericDrawer()`:
 * 1. THÊM double-`requestAnimationFrame` chờ 2 khung hình TRƯỚC KHI đo chiều cao tự nhiên (bước
 *    2-4 cũ) — GỐC BỆNH: `bodyHtml` gán `innerHTML` xong là đo `getBoundingClientRect()` NGAY
 *    trong CÙNG 1 tick JS, giả định "trình duyệt vẽ lại SAU KHI script chạy xong nên CSS chắc chắn
 *    đã áp dụng đủ" — SAI với Tailwind CDN JIT (`cdn.tailwindcss.com`, xem index.html): class nào
 *    LẦN ĐẦU xuất hiện trong DOM thì CDN tự bắt qua `MutationObserver` RIÊNG của nó rồi mới tiêm
 *    `<style>` — việc này BẤT ĐỒNG BỘ, không kịp trong tick đo. Phần tử dùng class mới toanh coi
 *    như chưa có style lúc đo → chiều cao đo được HỤT → panel cutoff. Mở lại lần 2: Tailwind đã
 *    tiêm xong CSS cho đúng class đó từ lần trước → đo đúng ngay. ĐÚNG bug/fix đã từng gặp ở
 *    `core/time-picker-modal.js` (18/07/2026, double-rAF) — nay áp lại đúng bài học đó ở đây.
 *    Settings (`event/workflow/app-settings.js`) lộ rõ nhất vì dùng nhiều tổ hợp class riêng
 *    (`.app-settings-scope` + card/row bespoke) không xuất hiện ở đâu khác trong app trước đó —
 *    Folder Browser/Storage ít lộ hơn vì tái dùng template/class đã "khởi động" từ nơi khác.
 * 2. ĐỔI HẲN cơ chế trượt ẩn/hiện từ `style.bottom` (JS tính `-heightPx`) sang
 *    `style.transform: translateY(100%)`/`translateY(0)` (Giang yêu cầu, ĐẢO NGƯỢC quyết định
 *    "bỏ transform, dùng position" trước đó — xem lịch sử ở components/generic-drawer.js/assets/
 *    css/base.css) — LỢI ÍCH PHỤ: `translateY(100%)` LUÔN đẩy đúng 1 lần chiều cao CHÍNH NÓ bất kể
 *    chiều cao thật là bao nhiêu — KHÔNG cần biết trước số px như `bottom = -heightPx` cũ, nên
 *    `closeGenericDrawer()` không còn cần đo `getBoundingClientRect()` nữa (đơn giản hoá kèm theo).
 *
 * LƯU Ý — `appState.set('isGenericDrawerOpen', true)` DỜI LÊN đầu `openGenericDrawer()` (bước 1,
 * ĐỒNG BỘ) thay vì cuối hàm như bản cũ — vì giờ có khoảng chờ 2 rAF (~33ms) TRƯỚC khi panel thật sự
 * lên hình, nếu vẫn đợi tới cuối mới set cờ thì Block gate (event/block.js) có 1 khoảng hở KHÔNG
 * chặn được 1 lần mở Generic Drawer khác chen vào giữa lúc đang chờ đo — dời cờ lên sớm giữ ĐÚNG
 * "cửa sổ bảo vệ" chặt như bản cũ (đồng bộ hoàn toàn trong 1 tick), không bị nới rộng thêm.
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
 * XOÁ (đợt viết lại theo 8 bước "bỏ transform, dùng position") — hằng số
 * `GENERIC_DRAWER_AUTO_HEIGHT_GAP_PX`/padding-bottom đệm trong panel (mục 2 cũ) KHÔNG còn dùng —
 * thuật toán 8 bước mới không có bước đệm gap. Cần lại thì thêm sau, hiện tại giữ đúng ĐÚNG 8
 * bước Giang chỉ định, không tự ý giữ lại phần cũ không có trong thuật toán mới.
 */

/**
 * VIẾT LẠI LẦN 3 (2 lần trước đều lỗi — "vẫn không auto height", "cộng dồn sau mỗi lần ra vào" —
 * theo ĐÚNG hướng Giang chỉ định) — 2 lần trước đều cố "suy luận" chiều cao qua JS (scrollHeight,
 * clone, cộng dồn từng mảnh) — luôn dính 1 dạng sai lệch nào đó (flex-grow mập mờ khi container
 * auto-size, `scrollHeight` bị "kẹt" ở kích thước ĐANG render hiện tại...).
 *
 * ĐÚNG HƯỚNG: để chính TRÌNH DUYỆT tự layout `height: auto` THẬT trên panel THẬT (không suy luận,
 * không clone) — `getBoundingClientRect().height` lúc đó là số ĐÚNG TUYỆT ĐỐI, không thể sai. Vấn
 * đề duy nhất cần né: (1) không được để lộ trạng thái "auto chưa kẹp maxHeight" ra màn hình dù chỉ
 * 1 khung hình, (2) phải chốt LẠI về SỐ PX CỤ THỂ ngay sau đó (CSS không animate được tới/từ
 * 'auto') để lần sau đổi nội dung còn animate được.
 * Toàn bộ đo + chốt số xảy ra ĐỒNG BỘ trong 1 lượt thực thi JS DUY NHẤT — trình duyệt CHỈ vẽ lại
 * màn hình SAU KHI script hiện tại chạy xong (không có frame nào chen giữa được), nên "auto" tạm
 * thời không bao giờ thực sự lộ ra, ngay cả KHÔNG CẦN ẩn gì thêm — nơi gọi (`openGenericDrawer()`)
 * vẫn tự thêm `opacity:0` làm lớp AN TOÀN kép (đề phòng lý thuyết, không dựa hoàn toàn vào giả định
 * "JS luôn chạy xong trước khi trình duyệt kịp vẽ").
 */
function _cssLengthToPx(cssLength) {
    // Dùng 1 phần tử dò ẩn để trình duyệt TỰ quy đổi bất kỳ đơn vị CSS nào (vh/%/calc()/px...) ra
    // px — không tự parse tay (dễ sai/sót đơn vị mới).
    const probe = document.createElement('div');
    probe.style.cssText = `position:fixed; visibility:hidden; height:${cssLength};`;
    document.body.appendChild(probe);
    const px = probe.offsetHeight;
    probe.remove();
    return px;
}

/** Đo chiều cao TỰ NHIÊN THẬT của panel — set THẲNG `height:auto` GENUINE lên panel THẬT (KHÔNG
 * kẹp `maxHeight` lúc đo — cố tình bỏ tạm, để biết đúng kích thước tự nhiên CHƯA bị chặn, xem
 * docstring khối trên), đọc `getBoundingClientRect().height`, rồi TRẢ NGAY 2 style đã đổi về như
 * cũ (nơi gọi mới là chỗ quyết định giá trị CUỐI CÙNG thật sự được set).
 *
 * [SỬA 20/08/2026, Giang báo bug "toggle 1 field cuối panel Lọc -> scroll nhảy về 0"] — TRONG lúc
 * `maxHeight` bị bỏ tạm + `height: auto` (đúng 2 dòng trên), panel giãn ra ĐỦ chứa hết nội dung ->
 * `genericDrawerBody` (`overflow-y-auto`) tại đúng khoảnh khắc đó HẾT TRÀN
 * (`scrollHeight === clientHeight`) — `getBoundingClientRect()` ngay dưới ép layout NGAY LÚC ĐÓ,
 * trình duyệt CLAMP `genericDrawerBody.scrollTop` về 0 TẠI THỜI ĐIỂM ĐÓ (phần tử không tràn thì
 * không thể giữ scrollTop khác 0) — trả `height`/`maxHeight` panel về như cũ NGAY SAU đó chỉ khôi
 * phục lại KÍCH THƯỚC, KHÔNG tự khôi phục lại `scrollTop` đã bị clamp. Hàm này được
 * `MutationObserver` tự gọi lại MỖI KHI có `classList.toggle` bên trong `genericDrawerBody` (vd
 * bật/tắt field trong panel Lọc — xem `setFilterField()`, event/workflow/playlist.js) — nên user
 * cảm giác giống "bị refresh" dù KHÔNG có dòng `innerHTML` nào chạy lại cả. SỬA: tự lưu/khôi phục
 * `genericDrawerBody.scrollTop` quanh đúng 2 dòng đổi height/maxHeight — ĐÚNG 1 chỗ, áp dụng cho
 * MỌI màn auto-height (không chỉ riêng panel Lọc).
 * @returns {number} px tự nhiên, CHƯA kẹp maxHeight. */
function _measureGenericDrawerNaturalHeightPx() {
    const prevHeight = genericDrawerPanel.style.height;
    const prevMaxHeight = genericDrawerPanel.style.maxHeight;
    const prevBodyScrollTop = genericDrawerBody.scrollTop;
    genericDrawerPanel.style.maxHeight = '';
    genericDrawerPanel.style.height = 'auto';
    const px = genericDrawerPanel.getBoundingClientRect().height;
    genericDrawerPanel.style.height = prevHeight;
    genericDrawerPanel.style.maxHeight = prevMaxHeight;
    genericDrawerBody.scrollTop = prevBodyScrollTop; // khôi phục — xem docstring trên (trình duyệt đã tự clamp về 0 lúc đo)
    return px;
}

/**
 * VIẾT LẠI (phản hồi Giang — "bỏ transform, dùng position", đúng 8 bước) — TRƯỚC ĐÂY hàm này tự
 * SET LUÔN `style.height` — giờ chỉ tính toán + TRẢ VỀ SỐ PX (không side-effect style height/
 * bottom nữa) — nơi gọi (`openGenericDrawer()`/`updateGenericDrawer()`) mới là chỗ quyết định set
 * gì lên panel, vì `openGenericDrawer()` giờ CẦN con số này để tính `bottom = -heightPx` (bước 5).
 *
 * [SỬA 20/08/2026] Bước 1.5 MỚI — chờ double-`requestAnimationFrame` (2 khung hình) TRƯỚC bước 2,
 * để Tailwind CDN JIT kịp tiêm CSS cho class MỚI THẤY LẦN ĐẦU (xem docstring đầu file) — panel vẫn
 * đang `opacity:0` + `translateY(100%)` trong lúc chờ nên KHÔNG lộ ra màn hình dù có delay.
 *
 * Bước 2-3-4 (đúng thứ tự Giang chỉ định, nay chạy trong `_finishOpenGenericDrawer()` SAU 2 rAF):
 *   2. Đo chiều cao TỰ NHIÊN THẬT (chưa kẹp maxHeight) — `_measureGenericDrawerNaturalHeightPx()`.
 *   3. Nếu vượt `maxHeight` (quy đổi ra px) — CLAMP: dùng THẲNG maxHeight (đã quy px) làm chiều
 *      cao cuối — nội dung dài tự cuộn bên trong nhờ `bodyClass: 'overflow-y-auto'`.
 *   4. Nếu KHÔNG vượt — dùng ĐÚNG số đo tự nhiên ở bước 2 (không cần đo lại lần 2, đã có sẵn).
 * @param {{height?: string, maxHeight?: string}} config
 * @returns {number} px
 */
function _resolveGenericDrawerHeightPx(config) {
    if (config.height !== 'auto') {
        _genericDrawerIsAutoMode = false;
        return _cssLengthToPx(config.height || '70vh');
    }
    _genericDrawerIsAutoMode = true;
    _genericDrawerAutoMaxHeight = config.maxHeight || '';
    const naturalPx = _measureGenericDrawerNaturalHeightPx(); // bước 2
    if (!config.maxHeight) return naturalPx; // không giới hạn gì -> dùng thẳng số tự nhiên
    const maxPx = _cssLengthToPx(config.maxHeight);
    return naturalPx > maxPx ? maxPx : naturalPx; // bước 3 (vượt -> clamp) / bước 4 (không vượt -> giữ nguyên)
}

/**
 * `_applyGenericDrawerHeight()` (cũ) chỉ đo lại lúc openGenericDrawer()/updateGenericDrawer() chạy
 * (ĐỔI HẲN màn) — mọi toggle NỘI BỘ 1 màn (Gesture/Slideshow/Visual Background... tự
 * `classList.toggle('hidden', ...)` để hiện/ẩn 1 khối con, KHÔNG đi qua 2 hàm đó) không hề kích
 * hoạt đo lại, panel giữ NGUYÊN chiều cao cũ dù nội dung thật đã đổi.
 *
 * SỬA: `MutationObserver` theo dõi CHÍNH `genericDrawerBody` (childList + attributes class/style,
 * `subtree: true` — bắt được MỌI khối con ẩn/hiện dù lồng sâu bao nhiêu cấp) — hễ có thay đổi VÀ
 * đang ở chế độ `height: 'auto'` (`_genericDrawerIsAutoMode`), tự đo lại (`_resolveGenericDrawerHeightPx()`)
 * + set lại `style.height` — animate MƯỢT tự nhiên nhờ CSS transition có sẵn (không cần thêm gì,
 * `bottom` giữ nguyên 0 — chỉ chiều cao đổi, panel không trượt lại). Debounce nhẹ (rAF) — tránh đo
 * lại NHIỀU LẦN nếu 1 thao tác gây ra nhiều mutation liền (vd innerHTML gán lại cả khối).
 *
 * KHÔNG lo vòng lặp vô hạn: hàm đo (`_measureGenericDrawerNaturalHeightPx()`) chỉ ĐỌC
 * `getBoundingClientRect()` trên CHÍNH `genericDrawerPanel`, KHÔNG GHI bất kỳ class/attribute nào
 * lên `genericDrawerBody` hay con cháu của nó, nên tự nó KHÔNG kích hoạt lại chính observer này.
 *
 * `openGenericDrawer()`/`updateGenericDrawer()` tự `disconnect()` observer NGAY TRƯỚC KHI gán nội
 * dung, `observe()` lại NGAY SAU KHI đã tính xong chiều cao đích — observer từ đó CHỈ còn bắt đúng
 * toggle NỘI BỘ xảy ra SAU (Gesture/Slideshow... tự ẩn/hiện 1 khối), không đụng gì tới chính lần
 * mở/chuyển màn (tránh đo lại CHỒNG lên đúng lúc đang tự tay xử lý, từng gây mất animation).
 */
let _genericDrawerIsAutoMode = false;
let _genericDrawerAutoMaxHeight = '';
let _genericDrawerResizeRaf = null;
const _genericDrawerBodyObserver = new MutationObserver(() => {
    if (!_genericDrawerIsAutoMode || genericDrawerPanel.classList.contains('hidden')) return; // không đo khi đang đóng (đo lúc display:none luôn ra 0)
    if (_genericDrawerResizeRaf) cancelAnimationFrame(_genericDrawerResizeRaf);
    _genericDrawerResizeRaf = requestAnimationFrame(() => {
        _genericDrawerResizeRaf = null;
        if (!_genericDrawerIsAutoMode || genericDrawerPanel.classList.contains('hidden')) return; // có thể vừa đóng/chuyển sang height cố định TRONG lúc chờ rAF
        const px = _resolveGenericDrawerHeightPx({ height: 'auto', maxHeight: _genericDrawerAutoMaxHeight });
        genericDrawerPanel.style.height = `${px}px`; // transform giữ nguyên translateY(0) [SỬA 20/08/2026] — chỉ chiều cao đổi
    });
});
_genericDrawerBodyObserver.observe(genericDrawerBody, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });


/**
 * VIẾT LẠI LẦN 4 (20/08/2026, Giang xác nhận — thêm chờ double-rAF + đổi `bottom` sang `transform`,
 * xem docstring đầu file) — Mở drawer LẦN ĐẦU (đang đóng -> mở), CHIA 2 GIAI ĐOẠN:
 *   Giai đoạn A (hàm này, ĐỒNG BỘ):
 *     1. Set nội dung (header/body), set `opacity: 0` + `transform: translateY(100%)` NGAY (đẩy hẳn
 *        ra khỏi khung nhìn — KHÔNG cần biết chiều cao thật vì `translateY(100%)` tự đẩy đúng 1 lần
 *        chiều cao CHÍNH NÓ, bất kể lúc này là bao nhiêu), bỏ `hidden`.
 *     1.5. `appState.set('isGenericDrawerOpen', true)` NGAY (xem "LƯU Ý" ở docstring đầu file — giữ
 *        cửa sổ bảo vệ Block gate chặt như trước, không nới rộng thêm vì có delay ở giai đoạn B).
 *   Giai đoạn B (`_finishOpenGenericDrawer()`, chạy SAU double-rAF — 2 khung hình):
 *     2-4. Tính chiều cao đích bằng px (check maxHeight -> clamp nếu vượt, dùng đúng số đo tự nhiên
 *        nếu không — xem `_resolveGenericDrawerHeightPx()`) — đo LÚC NÀY (không phải ngay trong tick
 *        gọi hàm) để Tailwind CDN JIT đã kịp tiêm CSS cho class mới, tránh đo hụt/cutoff.
 *     5. Set `height` = px thực đó (giữ nguyên `translateY(100%)` — vẫn ngoài khung nhìn).
 *     6. Bỏ `opacity` (trả về hiện, nhưng vẫn đang nằm ngoài màn hình nhờ transform nên chưa ai thấy).
 *     7. Set `transform: translateY(0)` — transition CSS (`#generic-drawer-panel`, assets/css/
 *        base.css) tự chạy, panel trồi lên đúng vị trí — animation mượt vì chiều cao đã CHỐT SỐ CỤ
 *        THỂ từ bước 5, không đổi giữa chừng lúc đang trượt.
 * @param {{height?: string, maxHeight?: string, zIndex?: number, headerHtml: string, bodyHtml: string, bodyClass?: string}} config
 *   - height: mặc định '70vh' nếu không truyền. 'auto' -> tự co theo nội dung, xem
 *     `_resolveGenericDrawerHeightPx()`.
 *   - maxHeight: kẹp chiều cao khi `height: 'auto'` — nội dung dài tự cuộn bên trong
 *     `genericDrawerBody` nhờ `bodyClass: 'overflow-y-auto'`.
 *   - zIndex: mặc định GENERIC_DRAWER_DEFAULT_Z_INDEX (128) nếu không truyền (overlay tự dùng
 *     zIndex - 1) — xem giải thích đầy đủ ở docstring hằng số phía trên.
 */
function openGenericDrawer(config) {
    _genericDrawerBodyObserver.disconnect(); // tạm ngắt trong lúc tự xử lý — xem docstring khai báo observer ở trên
    genericDrawerHeader.innerHTML = config.headerHtml || '';
    genericDrawerBody.innerHTML = config.bodyHtml || '';
    genericDrawerBody.className = `flex-1 min-h-0 ${config.bodyClass || ''}`.trim(); // 'flex-1 min-h-0' LUÔN giữ, bodyClass CHỈ bổ sung

    // Bước 1.
    genericDrawerPanel.style.opacity = '0';
    // Bỏ `hidden` (display:none -> có layout box thật) — BẮT BUỘC: panel display:none thì
    // `getBoundingClientRect()` ở bước 2-4 (giai đoạn B) luôn ra 0.
    genericDrawerPanel.classList.remove('hidden');

    // SỬA (Giang chỉ ra — "chưa có bước bỏ px gắn cứng khi ẩn") — lần MỞ LẠI (không phải lần đầu),
    // `height` vẫn còn giá trị PX CỨNG của LẦN ĐÓNG TRƯỚC. Tắt hẳn transition NGAY TỪ ĐÂY — TRƯỚC CẢ
    // bước đo (2-4) — vì bản thân hàm đo (`_measureGenericDrawerNaturalHeightPx()`) cũng có 1 lượt
    // gán/khôi phục `style.height` (auto -> giá trị CŨ) có thể để lại 1 transition dở dang nếu
    // transition vẫn đang bật lúc đó. Chỉ bật lại đúng lúc NGAY TRƯỚC bước 7, đảm bảo animation
    // trồi lên là animation DUY NHẤT thật sự chạy, xuất phát đúng từ mốc off-screen sạch.
    genericDrawerPanel.style.transition = 'none';
    // [SỬA 20/08/2026] `transform` THAY `bottom` — đẩy hẳn ra khỏi khung nhìn KHÔNG cần biết trước
    // chiều cao (xem docstring đầu file).
    genericDrawerPanel.style.transform = 'translateY(100%)';
    void genericDrawerPanel.offsetHeight; // ép reflow — chốt "transition:none, đã ở mốc off-screen" TRƯỚC khi bắt đầu chờ 2 rAF

    // [SỬA 20/08/2026] `isGenericDrawerOpen` set NGAY ở đây (bước 1.5), KHÔNG đợi tới cuối giai
    // đoạn B — xem "LƯU Ý" ở docstring đầu file.
    appState.set('isGenericDrawerOpen', true);
    console.log(`writer: "openGenericDrawer", page: "isGenericDrawerOpen", content: "true"`);

    // [SỬA 20/08/2026] Chờ double-rAF (2 khung hình) rồi mới đo/chốt chiều cao thật — xem docstring
    // đầu file (Tailwind CDN JIT tiêm CSS bất đồng bộ cho class mới thấy lần đầu).
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            _finishOpenGenericDrawer(config);
        });
    });
}

/** Giai đoạn B của `openGenericDrawer()` (bước 2-7), chạy SAU double-rAF — xem docstring
 * `openGenericDrawer()`. */
function _finishOpenGenericDrawer(config) {
    // Guard: lỡ bị đóng lại (closeFully()) TRONG LÚC đang chờ 2 rAF (vd người dùng bấm quá nhanh) —
    // bỏ qua, KHÔNG tự mở nhầm lại nội dung đã cũ.
    if (genericDrawerPanel.classList.contains('hidden')) return;

    const zIndex = config.zIndex || GENERIC_DRAWER_DEFAULT_Z_INDEX;
    genericDrawerPanel.style.zIndex = String(zIndex);

    // Bước 2-3-4.
    const heightPx = _resolveGenericDrawerHeightPx(config);
    genericDrawerPanel.style.maxHeight = config.maxHeight || ''; // giữ lại làm lưới an toàn CSS (vd xoay màn hình/đổi kích thước cửa sổ lúc đang mở)

    // Bước 5.
    genericDrawerPanel.style.height = `${heightPx}px`;
    void genericDrawerPanel.offsetHeight; // ép reflow — chốt bước 5 TRƯỚC khi sang bước 6/7

    _genericDrawerBodyObserver.observe(genericDrawerBody, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] }); // nối lại — từ đây chỉ bắt toggle NỘI BỘ về sau

    genericDrawerOverlay.style.zIndex = String(zIndex - 1);
    genericDrawerOverlay.classList.remove('hidden');
    void genericDrawerOverlay.offsetHeight; // ép reflow — đảm bảo transition opacity CHẠY
    genericDrawerOverlay.classList.remove('opacity-0');
    genericDrawerOverlay.classList.add('pointer-events-auto');

    // Bước 6.
    genericDrawerPanel.style.opacity = '';
    // Bật lại transition NGAY TRƯỚC bước 7 — ép reflow chốt trạng thái "transition:none, đã ở đúng
    // mốc off-screen" TRƯỚC KHI bật lại, để trình duyệt không gộp chung 2 thay đổi (bật transition +
    // đổi transform) vào 1 bước, làm mất animation lần nữa (đúng bài học các lần sửa trước).
    void genericDrawerPanel.offsetHeight;
    genericDrawerPanel.style.transition = '';
    void genericDrawerPanel.offsetHeight; // ép reflow lần 2 — chốt "transition ĐÃ BẬT LẠI" TRƯỚC khi đổi transform (bước 7), đảm bảo lần đổi NGAY SAU ĐÂY chắc chắn được animate

    // Bước 7.
    genericDrawerPanel.style.transform = 'translateY(0)';
}

/**
 * Chuyển MƯỢT sang cấu hình MỚI trong khi ĐANG MỞ (không đóng/mở lại từ đầu) — cơ chế chuyển
 * List <-> Read (mục 2/4.1 plan-v12-extended.md). Drawer PHẢI đang mở trước khi gọi.
 *
 * `transform` GIỮ NGUYÊN `translateY(0)` (panel đang hiện đúng vị trí, KHÔNG trượt lại — [SỬA
 * 20/08/2026] THAY `bottom: 0` cũ) — CHỈ `height` đổi, animate nhờ transition CSS có sẵn
 * (`#generic-drawer-panel`, assets/css/base.css) — từ giá trị PX HIỆN TẠI (`style.height` luôn là
 * số px cụ thể, KHÔNG BAO GIỜ để 'auto' lâu dài, xem `_resolveGenericDrawerHeightPx()`) sang PX
 * ĐÍCH MỚI, browser tự chạy mượt giữa 2 mốc.
 *
 * [SỬA 20/08/2026] Việc ĐO chiều cao đích (bước cần Tailwind CSS đã áp dụng đủ) giờ chờ double-rAF
 * TRƯỚC khi chạy — cùng lý do `openGenericDrawer()` (xem docstring đầu file): nội dung MỚI
 * (`bodyHtml`) có thể chứa tổ hợp class Tailwind lần đầu xuất hiện trong Drawer (vd List -> Read,
 * hoặc Settings `navigateTo()` sang màn khác), đo NGAY trong tick gọi hàm dễ hụt/cutoff cùng kiểu
 * bug đã gặp ở Settings. Phần gán nội dung/scrollTop vẫn chạy ĐỒNG BỘ (không cần chờ) — chỉ riêng
 * bước đo+set height bị dời sau 2 rAF, nên có ~2 khung hình panel hiện ĐÚNG nội dung mới nhưng
 * TẠM giữ chiều cao CŨ trước khi animate mượt sang chiều cao đích — chấp nhận được (rất ngắn, không
 * đáng kể so với việc bị cutoff hẳn tới khi mở lại).
 * @param {{height?: string, maxHeight?: string, zIndex?: number, headerHtml: string, bodyHtml: string, bodyClass?: string}} config
 */
function updateGenericDrawer(config) {
    const zIndex = config.zIndex || GENERIC_DRAWER_DEFAULT_Z_INDEX;
    _genericDrawerBodyObserver.disconnect(); // tạm ngắt trong lúc tự xử lý — cùng lý do openGenericDrawer()
    genericDrawerPanel.style.zIndex = String(zIndex);
    genericDrawerHeader.innerHTML = config.headerHtml || '';
    genericDrawerBody.innerHTML = config.bodyHtml || '';
    genericDrawerBody.className = `flex-1 min-h-0 ${config.bodyClass || ''}`.trim();
    genericDrawerOverlay.style.zIndex = String(zIndex - 1);
    genericDrawerBody.scrollTop = 0; // nội dung MỚI luôn bắt đầu từ đầu, không giữ vị trí cuộn của nội dung TRƯỚC đó

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (genericDrawerPanel.classList.contains('hidden')) return; // lỡ bị đóng lại trong lúc chờ — bỏ qua

            const heightPx = _resolveGenericDrawerHeightPx(config);
            genericDrawerPanel.style.maxHeight = config.maxHeight || '';
            genericDrawerPanel.style.height = `${heightPx}px`; // transform giữ nguyên translateY(0) — transition height lo phần animate

            _genericDrawerBodyObserver.observe(genericDrawerBody, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] }); // nối lại — từ đây chỉ bắt toggle NỘI BỘ về sau
        });
    });
}

/**
 * Đóng drawer (bước 8, Giang chỉ định) — set `transform: translateY(100%)` — transition CSS tự
 * chạy trượt xuống. CHƯA thêm lại `hidden`/`opacity:0` (đợi transition xong, xem
 * `hideGenericDrawerImmediately()` — Workflow tự gọi 2 hàm này nối tiếp qua `transitionend`).
 *
 * [SỬA 20/08/2026] THAY `bottom = -currentHeightPx` (phải tự đo `getBoundingClientRect()` để biết
 * chiều cao THẬT hiện tại, có thể đã đổi so với lúc mở do `updateGenericDrawer()` gọi giữa chừng) —
 * `translateY(100%)` KHÔNG cần biết trước số px, LUÔN đẩy đúng 1 lần chiều cao CHÍNH NÓ tại thời
 * điểm áp dụng, nên bỏ hẳn được bước đo.
 */
function closeGenericDrawer() {
    genericDrawerPanel.style.transform = 'translateY(100%)'; // trượt xuống
    genericDrawerOverlay.classList.add('opacity-0');
    genericDrawerOverlay.classList.remove('pointer-events-auto'); // cho thao tác lọt qua NGAY lúc bắt đầu mờ dần, không đợi hết transition
}

/** Ẩn HẲN panel + overlay (thêm `hidden` + `opacity:0`, nốt bước 8) — gọi SAU KHI transition trượt
 * xuống đã xong (Workflow tự nghe `transitionend` rồi gọi hàm này, xem event/workflow/document-
 * reader.js). Đây là chỗ DUY NHẤT set `isGenericDrawerOpen = false` — đảm bảo Block gate
 * (event/block.js) chỉ cho mở lại SAU KHI overlay/panel đã ẩn hẳn thật sự, không phải ngay lúc bắt
 * đầu trượt xuống. */
function hideGenericDrawerImmediately() {
    genericDrawerPanel.classList.add('hidden');
    genericDrawerPanel.style.opacity = '0'; // dọn dẹp — lưới an toàn kép (dù translateY(100%) [SỬA 20/08/2026] về lý thuyết đã LUÔN đẩy đủ 1 lần chiều cao chính nó, không như bottom âm cũ có thể tính hụt)
    genericDrawerOverlay.classList.add('hidden');
    _genericDrawerIsAutoMode = false; // dừng auto-resize observer tự đo lại trong lúc đang đóng

    appState.set('isGenericDrawerOpen', false);
    console.log(`writer: "hideGenericDrawerImmediately", page: "isGenericDrawerOpen", content: "false"`);
}
