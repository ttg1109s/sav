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
 * đúng"] — GỐC BỆNH: `bodyHtml` gán `innerHTML` xong là đo `getBoundingClientRect()` NGAY trong
 * CÙNG 1 tick JS, giả định "trình duyệt vẽ lại SAU KHI script chạy xong nên CSS chắc chắn đã áp
 * dụng đủ" — SAI với Tailwind CDN JIT (`cdn.tailwindcss.com`, xem index.html): class nào LẦN ĐẦU
 * xuất hiện trong DOM thì CDN tự bắt qua `MutationObserver` RIÊNG của nó rồi mới tiêm `<style>` —
 * việc này BẤT ĐỒNG BỘ, không kịp trong tick đo. Phần tử dùng class mới toanh coi như chưa có style
 * lúc đo → chiều cao đo được HỤT → panel cutoff. Mở lại lần 2: Tailwind đã tiêm xong CSS cho đúng
 * class đó từ lần trước → đo đúng ngay. ĐÚNG bug/fix đã từng gặp ở `core/time-picker-modal.js`
 * (18/07/2026, double-rAF). Settings (`event/workflow/app-settings.js`) lộ rõ nhất vì dùng nhiều tổ
 * hợp class riêng (`.app-settings-scope` + card/row bespoke) không xuất hiện ở đâu khác trong app
 * trước đó — Folder Browser/Storage ít lộ hơn vì tái dùng template/class đã "khởi động" từ nơi khác.
 *
 * [SỬA 20/08/2026, LẦN 2 cùng ngày — Giang gửi video quay lại bug MỚI "Playlist -> Sort không co
 * lại"] — Lần sửa ĐẦU trong ngày (chờ double-rAF TRƯỚC RỒI MỚI đo, "VIẾT LẠI LẦN 4") tạo ra 1 lỗ
 * hổng MỚI, NGHIÊM TRỌNG HƠN: toàn bộ phép đo/set height bị dời HẲN vào bên trong 2 lượt
 * `requestAnimationFrame` lồng nhau — nếu rAF bị trì hoãn/bỏ qua vì BẤT KỲ lý do gì trên thiết bị
 * thật, callback đó KHÔNG BAO GIỜ chạy, height bị TREO VĨNH VIỄN ở giá trị màn TRƯỚC (không tự phục
 * hồi, không phải lệch nhẹ do timing) — đo pixel qua video Giang gửi xác nhận ĐÚNG triệu chứng này
 * (Playlist -> Sort: height đứng yên tuyệt đối hơn 1 giây, dù nội dung/tiêu đề đã đổi đúng), và tái
 * hiện được 100% bằng cách chặn cứng `requestAnimationFrame` trong Playwright test.
 * SỬA LẠI (VIẾT LẠI LẦN 5, xem docstring `openGenericDrawer()`/`updateGenericDrawer()`) — QUAY VỀ
 * đo/set height ĐỒNG BỘ NGAY (không phụ thuộc rAF để HOẠT ĐỘNG được) — double-rAF giờ CHỈ còn là 1
 * "correction pass" TÙY CHỌN chạy SAU đó (`_correctGenericDrawerHeightIfNeeded()`), đo lại 1 lần
 * nữa và CHỈ chỉnh nếu lệch so với lần đo đồng bộ — vừa giữ được fix Tailwind JIT (bug đầu tiên ở
 * trên) VỪA không còn kịch bản "kẹt hẳn nếu rAF không chạy" (bug thứ 2).
 *
 * 3. ĐỔI HẲN cơ chế trượt ẩn/hiện từ `style.bottom` (JS tính `-heightPx`) sang
 *    `style.transform: translateY(100%)`/`translateY(0)` (Giang yêu cầu, ĐẢO NGƯỢC quyết định
 *    "bỏ transform, dùng position" trước đó — xem lịch sử ở components/generic-drawer.js/assets/
 *    css/base.css) — LỢI ÍCH PHỤ: `translateY(100%)` LUÔN đẩy đúng 1 lần chiều cao CHÍNH NÓ bất kể
 *    chiều cao thật là bao nhiêu — KHÔNG cần biết trước số px như `bottom = -heightPx` cũ, nên
 *    `closeGenericDrawer()` không còn cần đo `getBoundingClientRect()` nữa (đơn giản hoá kèm theo).
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
 * VIẾT LẠI LẦN 5 (20/08/2026, Giang gửi video quay lại bug "Playlist -> Sort không co lại", đo
 * pixel xác nhận height ĐỨNG YÊN TUYỆT ĐỐI chứ không phải lệch nhẹ do timing) — GỐC BỆNH của bản
 * "double-rAF trước rồi mới đo" (VIẾT LẠI LẦN 4): toàn bộ phép đo/set height bị DỜI HẲN vào bên
 * trong 2 lượt `requestAnimationFrame` lồng nhau — nếu rAF bị trì hoãn/bỏ qua vì BẤT KỲ lý do gì
 * trên thiết bị thật (throttle nền, momentum scroll đang chạy, low power mode...), callback đó
 * KHÔNG BAO GIỜ chạy — height/tranform bị TREO VĨNH VIỄN ở giá trị CŨ (không phải "hụt một lát",
 * mà "kẹt hẳn, không tự phục hồi"). Đã tái hiện ĐÚNG triệu chứng bằng cách chặn cứng
 * `requestAnimationFrame` trong Playwright test — panel giữ nguyên height của màn TRƯỚC dù nội
 * dung/tiêu đề đã đổi đúng (xem trao đổi).
 *
 * SỬA — QUAY VỀ đo/set height ĐỒNG BỘ NGAY (không phụ thuộc rAF để HOẠT ĐỘNG được), CHỈ giữ lại
 * double-rAF như 1 lượt "CORRECTION PASS" TÙY CHỌN chạy SAU đó — đo lại LẦN NỮA, nếu lệch so với
 * lần đo đồng bộ (đúng trường hợp Tailwind CDN JIT chưa kịp tiêm CSS cho class MỚI THẤY LẦN ĐẦU lúc
 * đo đồng bộ, xem docstring đầu file) thì chỉnh nhẹ qua transition sẵn có — TUYỆT ĐỐI KHÔNG phải
 * điều kiện BẮT BUỘC để có 1 chiều cao hợp lý: dù rAF không bao giờ chạy, chiều cao ĐÃ ĐÚNG (hoặc
 * đúng gần hết, hoạ hoằn hụt nhẹ với class chưa từng dùng) NGAY TỪ ĐẦU nhờ lần đo đồng bộ, KHÔNG còn
 * kịch bản "kẹt hẳn ở size màn trước" nữa.
 */

/** Correction pass DÙNG CHUNG cho `openGenericDrawer()`/`updateGenericDrawer()` — đo lại SAU
 * double-rAF, CHỈ set lại `height`/`maxHeight` nếu số đo LẦN NÀY khác lần đồng bộ trước đó (phòng
 * Tailwind CDN JIT chưa kịp tiêm CSS class mới lúc đo đồng bộ — xem docstring khối trên). Không làm
 * gì nếu: đã đóng lại trong lúc chờ, hoặc không còn ở chế độ auto (đổi sang height cố định khác
 * TRONG lúc chờ), hoặc số đo KHÔNG đổi (transition tới đúng giá trị hiện tại là no-op, không cần
 * set lại làm gì).
 * @param {{height?: string, maxHeight?: string}} config @param {number} appliedPx - px đã set ở lần đo đồng bộ */
function _correctGenericDrawerHeightIfNeeded(config, appliedPx) {
    if (genericDrawerPanel.classList.contains('hidden')) return; // đã đóng lại trong lúc chờ — bỏ qua
    if (!_genericDrawerIsAutoMode) return; // đã đổi sang height cố định khác trong lúc chờ — bỏ qua
    const correctedPx = _resolveGenericDrawerHeightPx(config);
    if (Math.round(correctedPx) === Math.round(appliedPx)) return; // không lệch — không cần set lại
    genericDrawerPanel.style.maxHeight = config.maxHeight || '';
    genericDrawerPanel.style.height = `${correctedPx}px`; // transition ĐANG BẬT sẵn (đã bật lại từ lần đo đồng bộ) — tự animate mượt tới số đúng
}

/**
 * Mở drawer LẦN ĐẦU (đang đóng -> mở) — ĐO/SET height ĐỒNG BỘ NGAY (Bước 1-7, không chờ rAF để
 * HOẠT ĐỘNG được — xem docstring khối trên), sau đó lên lịch 1 correction pass double-rAF TÙY CHỌN:
 *   1. Set nội dung (header/body), `opacity: 0` + `transform: translateY(100%)` NGAY, bỏ `hidden`.
 *   2-4. Tính chiều cao đích bằng px (check maxHeight -> clamp nếu vượt, dùng đúng số đo tự nhiên
 *      nếu không — xem `_resolveGenericDrawerHeightPx()`).
 *   5. Set `height` = px thực đó (giữ nguyên `translateY(100%)` — vẫn ngoài khung nhìn).
 *   6. Bỏ `opacity` (trả về hiện, nhưng vẫn đang nằm ngoài màn hình nhờ transform nên chưa ai thấy).
 *   7. Set `transform: translateY(0)` — transition CSS (`#generic-drawer-panel`, assets/css/
 *      base.css) tự chạy, panel trồi lên đúng vị trí — animation mượt vì chiều cao đã CHỐT SỐ CỤ
 *      THỂ từ bước 5, không đổi giữa chừng lúc đang trượt.
 * @param {{height?: string, maxHeight?: string, zIndex?: number, headerHtml: string, bodyHtml: string, bodyClass?: string}} config
 *   - height: mặc định '70vh' nếu không truyền. 'auto' -> tự co theo nội dung, xem
 *     `_resolveGenericDrawerHeightPx()`.
 *   - maxHeight: kẹp chiều cao khi `height: 'auto'` — nội dung dài tự cuộn bên trong
 *     `genericDrawerBody` nhờ `bodyClass: 'overflow-y-auto'`.
 *   - zIndex: mặc định GENERIC_DRAWER_DEFAULT_Z_INDEX (128) nếu không truyền (overlay tự dùng
 *     zIndex - 1) — xem giải thích đầy đủ ở docstring hằng số phía trên.
 */
function openGenericDrawer(config) {
    const zIndex = config.zIndex || GENERIC_DRAWER_DEFAULT_Z_INDEX;
    _genericDrawerBodyObserver.disconnect(); // tạm ngắt trong lúc tự xử lý — xem docstring khai báo observer ở trên
    genericDrawerPanel.style.zIndex = String(zIndex);
    genericDrawerHeader.innerHTML = config.headerHtml || '';
    genericDrawerBody.innerHTML = config.bodyHtml || '';
    genericDrawerBody.className = `flex-1 min-h-0 ${config.bodyClass || ''}`.trim(); // 'flex-1 min-h-0' LUÔN giữ, bodyClass CHỈ bổ sung

    // Bước 1.
    genericDrawerPanel.style.opacity = '0';
    // Bỏ `hidden` (display:none -> có layout box thật) — BẮT BUỘC: panel display:none thì
    // `getBoundingClientRect()` ở bước 2-4 luôn ra 0.
    genericDrawerPanel.classList.remove('hidden');

    // SỬA (Giang chỉ ra — "chưa có bước bỏ px gắn cứng khi ẩn") — lần MỞ LẠI (không phải lần đầu),
    // `height` vẫn còn giá trị PX CỨNG của LẦN ĐÓNG TRƯỚC. Tắt hẳn transition NGAY TỪ ĐÂY — TRƯỚC CẢ
    // bước đo (2-4) — vì bản thân hàm đo (`_measureGenericDrawerNaturalHeightPx()`) cũng có 1 lượt
    // gán/khôi phục `style.height` (auto -> giá trị CŨ) có thể để lại 1 transition dở dang nếu
    // transition vẫn đang bật lúc đó. Chỉ bật lại đúng lúc NGAY TRƯỚC bước 7, đảm bảo animation
    // trồi lên là animation DUY NHẤT thật sự chạy, xuất phát đúng từ mốc off-screen sạch.
    genericDrawerPanel.style.transition = 'none';
    // `transform` THAY `bottom` — đẩy hẳn ra khỏi khung nhìn KHÔNG cần biết trước chiều cao.
    genericDrawerPanel.style.transform = 'translateY(100%)';
    void genericDrawerPanel.offsetHeight; // ép reflow — chốt "transition:none, đã ở mốc off-screen" TRƯỚC khi đo

    // Bước 2-3-4 — ĐỒNG BỘ, KHÔNG chờ rAF (xem docstring khối trên — lý do bỏ hẳn "chờ rồi mới đo").
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

    appState.set('isGenericDrawerOpen', true);
    console.log(`writer: "openGenericDrawer", page: "isGenericDrawerOpen", content: "true"`);

    // Correction pass TÙY CHỌN — xem docstring `_correctGenericDrawerHeightIfNeeded()`. Panel ĐÃ mở
    // đúng/gần đúng kích thước ngay từ bước 5 phía trên rồi — đây chỉ là lớp SỬA THÊM cho trường hợp
    // hiếm (class Tailwind mới toanh chưa kịp tiêm CSS lúc đo đồng bộ ở trên).
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            _correctGenericDrawerHeightIfNeeded(config, heightPx);
        });
    });
}

/**
 * Chuyển MƯỢT sang cấu hình MỚI trong khi ĐANG MỞ (không đóng/mở lại từ đầu) — cơ chế chuyển
 * List <-> Read (mục 2/4.1 plan-v12-extended.md). Drawer PHẢI đang mở trước khi gọi.
 *
 * `transform` GIỮ NGUYÊN `translateY(0)` (panel đang hiện đúng vị trí, KHÔNG trượt lại) — CHỈ
 * `height` đổi, animate nhờ transition CSS có sẵn (`#generic-drawer-panel`, assets/css/base.css) —
 * từ giá trị PX HIỆN TẠI (`style.height` luôn là số px cụ thể, KHÔNG BAO GIỜ để 'auto' lâu dài, xem
 * `_resolveGenericDrawerHeightPx()`) sang PX ĐÍCH MỚI, browser tự chạy mượt giữa 2 mốc.
 *
 * ĐO/SET height ĐỒNG BỘ NGAY (không chờ rAF để HOẠT ĐỘNG được — xem docstring "VIẾT LẠI LẦN 5" phía
 * trên, đúng bug Giang báo "Sort không co lại"), kèm correction pass double-rAF TÙY CHỌN y hệt
 * `openGenericDrawer()` — tắt transition trong lúc đo (`_measureGenericDrawerNaturalHeightPx()` tự
 * đổi/khôi phục `style.height` vài lần, tắt transition tránh phụ thuộc cách engine gộp nhiều lần ghi
 * cùng 1 tick), chỉ bật lại NGAY TRƯỚC khi set height ĐÍCH để lần đổi đó animate mượt.
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

    // Tắt transition NGAY TRƯỚC bước đo — tránh chuỗi ghi style.height liên tiếp (auto -> khôi phục
    // về CŨ) chạy trong lúc transition đang bật (xem docstring "VIẾT LẠI LẦN 5" phía trên).
    genericDrawerPanel.style.transition = 'none';
    void genericDrawerPanel.offsetHeight; // ép reflow — chốt "transition:none" TRƯỚC khi đo

    const heightPx = _resolveGenericDrawerHeightPx(config); // ĐỒNG BỘ NGAY — không chờ rAF; đo xong, style.height đang ở giá trị CŨ (chưa đổi)
    genericDrawerPanel.style.maxHeight = config.maxHeight || '';
    void genericDrawerPanel.offsetHeight; // ép reflow — chốt "vẫn đang ở height CŨ, transition:none" TRƯỚC khi bật lại

    // Bật lại transition TRƯỚC khi set height ĐÍCH — đảm bảo đúng lần đổi NÀY (CŨ -> ĐÍCH) là lần
    // được animate, không phải lần đo/khôi phục tạm ở trên.
    genericDrawerPanel.style.transition = '';
    void genericDrawerPanel.offsetHeight; // ép reflow — chốt "transition ĐÃ BẬT LẠI" TRƯỚC khi đổi height ĐÍCH ngay dưới

    genericDrawerPanel.style.height = `${heightPx}px`; // giá trị ĐÍCH — animate NGAY (transition đã bật lại)

    _genericDrawerBodyObserver.observe(genericDrawerBody, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] }); // nối lại — từ đây chỉ bắt toggle NỘI BỘ về sau

    // Correction pass TÙY CHỌN — xem docstring `_correctGenericDrawerHeightIfNeeded()`.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            _correctGenericDrawerHeightIfNeeded(config, heightPx);
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
