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
 * lại"] — Lần sửa ĐẦU trong ngày (chờ double-rAF TRƯỚC RỒI MỚI đo) tạo ra 1 lỗ hổng MỚI, NGHIÊM
 * TRỌNG HƠN: toàn bộ phép đo/set height bị dời HẲN vào bên trong 2 lượt `requestAnimationFrame`
 * lồng nhau — nếu rAF bị trì hoãn/bỏ qua vì BẤT KỲ lý do gì trên thiết bị thật, callback đó KHÔNG
 * BAO GIỜ chạy, height bị TREO VĨNH VIỄN ở giá trị màn TRƯỚC — đo pixel qua video Giang gửi xác nhận
 * ĐÚNG triệu chứng này, tái hiện được 100% bằng cách chặn cứng `requestAnimationFrame` trong
 * Playwright test.
 *
 * [SỬA 20/08/2026, LẦN 3 — Giang chỉ thẳng gốc bệnh] — Dù đã quay về đo đồng bộ (bỏ rAF bắt buộc),
 * bản chất VẪN LÀ set `height` thành 1 số PX CỐ ĐỊNH — MỌI lần đổi nội dung đều BẮT BUỘC phải có
 * đúng 1 đoạn JS chạy để đo lại + set lại con số đó, hễ đoạn đó lỡ không chạy đúng ở bất kỳ đâu
 * (kể cả những chỗ chưa lường trước) là panel "kẹt" ở số cũ.
 * SỬA TẬN GỐC (Giang chỉ định): `height` KHÔNG BAO GIỜ còn là 1 giá trị CỐ ĐỊNH nữa —
 * `_measureGenericDrawerNaturalHeightPx()` chỉ dùng `height: auto` TẠM THỜI để đo, đo xong XOÁ HẲN
 * property này (không giữ lại gì). Property DUY NHẤT còn tồn tại lâu dài là `min-height` — vốn CHỈ
 * là 1 SÀN tối thiểu, KHÔNG BAO GIỜ chặn panel giãn CAO hơn theo nội dung thật (khác hẳn `height`
 * cứng, chặn CẢ 2 CHIỀU) — nên dù `min-height` có lỡ "kẹt" ở số CŨ vì lý do gì, panel vẫn LUÔN đúng
 * hoặc CAO HƠN nội dung thật (không bao giờ cắt cụt), nhẹ hơn hẳn bug cũ. `openGenericDrawer()`/
 * `updateGenericDrawer()` tự đo/set `min-height` ĐỒNG BỘ (không phụ thuộc rAF) qua
 * `_applyGenericDrawerAutoHeight()` dùng chung.
 *
 * ĐÃ THỬ (Playwright, xác nhận thực tế) — xoá `min-height` NGAY sau khi set (dù có ép reflow ở
 * giữa) trong CÙNG 1 lượt JS làm MẤT HẲN animation (height nhảy thẳng, không trượt) — trình duyệt
 * chỉ so sánh style TRƯỚC/SAU nguyên khối JS lúc vẽ khung hình kế tiếp. Vì vậy `min-height` được
 * GIỮ NGUYÊN sau khi set (không xoá ngay) — vẫn tuân đúng tinh thần chỉ đạo (height không còn là 1
 * giá trị cứng chặn 2 chiều), khác đúng 1 điểm: không "dọn về mặc định" ngay sau mỗi lần mở/cập
 * nhật vì việc đó phá animation.
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

/**
 * [SỬA 20/08/2026, Giang chỉ đạo trực tiếp] — GỐC BỆNH: `height` bị SET CỨNG thành 1 số px, KHÔNG
 * BAO GIỜ thật sự "auto" trở lại — mọi lần đổi nội dung đều cần JS đo lại + set lại con số đó, hễ
 * bước này lỡ không chạy đúng là panel "kẹt" ở số cũ. ĐÚNG bug "Playlist -> Sort không co lại".
 *
 * SỬA (đúng chỉ đạo): `height: auto` CHỈ dùng để ĐO (tạm thời), đo xong XOÁ HẲN property `height`
 * (không giữ lại gì, kể cả 'auto') — CHỈ set `min-height = px` đo được. Sau khi mở/cập nhật XONG,
 * XOÁ NỐT `min-height` về mặc định (initial) — lúc đó KHÔNG còn property nào ép kích thước cả,
 * panel hoàn toàn do TRÌNH DUYỆT tự co giãn theo nội dung thật. Nhờ vậy: đổi nội dung xong, dù JS có
 * chạy tiếp hay không, trình duyệt VẪN tự đúng kích thước — không cần "biết trước" gì cả. `min-height`
 * chỉ tồn tại ĐÚNG khoảnh khắc cần 1 cặp số cụ thể (cũ -> mới) để CSS `transition` animate được
 * (không animate được TỪ/TỚI 'auto').
 */
function _measureGenericDrawerNaturalHeightPx() {
    genericDrawerPanel.style.minHeight = ''; // dọn sạch min-height CÒN SÓT (nếu có) — không để nó kẹp trước khi đo
    genericDrawerPanel.style.maxHeight = ''; // bỏ tạm kẹp trên — đo ĐÚNG kích thước tự nhiên chưa bị chặn
    genericDrawerPanel.style.height = 'auto'; // BẬT tạm để đo
    const prevBodyScrollTop = genericDrawerBody.scrollTop;
    const px = genericDrawerPanel.getBoundingClientRect().height;
    genericDrawerPanel.style.height = ''; // XOÁ HẲN — không giữ lại 'auto', không giữ lại gì
    genericDrawerBody.scrollTop = prevBodyScrollTop; // khôi phục — height:auto tạm thời có thể khiến overflow-y-auto hết tràn, trình duyệt tự clamp scrollTop về 0 lúc đo
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
 * đang ở chế độ `height: 'auto'` (`_genericDrawerIsAutoMode`), tự đo lại
 * (`_resolveGenericDrawerHeightPx()`) + set `min-height` rồi XOÁ NGAY (xem docstring
 * `_measureGenericDrawerNaturalHeightPx()`) — animate MƯỢT tự nhiên nhờ CSS transition có sẵn.
 * Debounce nhẹ (rAF) — tránh đo lại NHIỀU LẦN nếu 1 thao tác gây ra nhiều mutation liền.
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
        _applyGenericDrawerAutoHeight({ height: 'auto', maxHeight: _genericDrawerAutoMaxHeight });
    });
});
_genericDrawerBodyObserver.observe(genericDrawerBody, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });

/**
 * [SỬA 20/08/2026, Giang chỉ đạo — "min-height = px, xong chuyển về mặc định"] — Set
 * `min-height = px đo được` để CSS `transition` có 1 cặp số cụ thể mà animate mượt (từ giá trị
 * min-height ĐANG CÓ trước đó sang px mới này).
 *
 * [KIỂM CHỨNG THỰC TẾ, Playwright] — thử xoá `min-height` NGAY sau khi set (kể cả có ép reflow ở
 * giữa) trong CÙNG 1 lượt JS: animation MẤT HẲN, height nhảy thẳng luôn — trình duyệt chỉ so sánh
 * style TRƯỚC/SAU cả khối JS lúc vẽ khung hình kế tiếp, không tính các bước trung gian bên trong.
 * SỬA: KHÔNG xoá ngay — giữ nguyên `min-height = px` sau khi set. Vẫn đúng tinh thần chỉ đạo:
 * `height` KHÔNG BAO GIỜ còn là 1 giá trị CỨNG chặn CẢ 2 CHIỀU nữa (xem `_measureGenericDrawerNaturalHeightPx()`
 * — chỉ dùng tạm lúc đo rồi xoá hẳn) — CHỈ `min-height` (1 SÀN tối thiểu, không chặn giãn CAO hơn)
 * còn tồn tại lâu dài, và luôn được hàm này giữ ĐÚNG kích thước nội dung hiện tại.
 * @param {{height?: string, maxHeight?: string}} config
 * @returns {number} px đã áp dụng
 */
function _applyGenericDrawerAutoHeight(config) {
    const px = _resolveGenericDrawerHeightPx(config);
    genericDrawerPanel.style.maxHeight = config.maxHeight || '';
    genericDrawerPanel.style.minHeight = `${px}px`;
    return px;
}

/**
 * Mở drawer LẦN ĐẦU (đang đóng -> mở):
 *   1. Set nội dung (header/body), `opacity: 0` + `transform: translateY(100%)` NGAY, bỏ `hidden`.
 *   2-4. Tính chiều cao đích bằng px, set `min-height` (xem `_applyGenericDrawerAutoHeight()`).
 *   5. Bỏ `opacity` (trả về hiện, nhưng vẫn đang nằm ngoài màn hình nhờ transform nên chưa ai thấy).
 *   6. Set `transform: translateY(0)` — transition CSS (`#generic-drawer-panel`, assets/css/
 *      base.css) tự chạy, panel trồi lên đúng vị trí.
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
    // `getBoundingClientRect()` bên trong bước đo luôn ra 0.
    genericDrawerPanel.classList.remove('hidden');
    genericDrawerPanel.style.transition = 'none';
    // `transform` THAY `bottom` — đẩy hẳn ra khỏi khung nhìn KHÔNG cần biết trước chiều cao.
    genericDrawerPanel.style.transform = 'translateY(100%)';
    genericDrawerPanel.style.minHeight = ''; // dọn sạch min-height CÒN SÓT từ phiên trước (nếu có) TRƯỚC khi đo — tránh đo hụt/thừa do bị chính nó kẹp
    void genericDrawerPanel.offsetHeight; // ép reflow — chốt "transition:none, đã ở mốc off-screen" TRƯỚC khi đo

    // Bước 2-3-4-5.
    _applyGenericDrawerAutoHeight(config);
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
}

/**
 * Chuyển MƯỢT sang cấu hình MỚI trong khi ĐANG MỞ (không đóng/mở lại từ đầu) — cơ chế chuyển
 * List <-> Read (mục 2/4.1 plan-v12-extended.md). Drawer PHẢI đang mở trước khi gọi.
 *
 * `transform` GIỮ NGUYÊN `translateY(0)` (panel đang hiện đúng vị trí, KHÔNG trượt lại). `height`
 * KHÔNG bị đụng tới ở đây — CHỈ `min-height` đổi (xem `_applyGenericDrawerAutoHeight()`), animate
 * nhờ transition CSS có sẵn (`#generic-drawer-panel`, assets/css/base.css) — từ giá trị PX HIỆN TẠI
 * sang PX ĐÍCH MỚI, browser tự chạy mượt giữa 2 mốc.
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

    // Tắt transition NGAY TRƯỚC bước đo — tránh chuỗi ghi style.minHeight liên tiếp (bỏ tạm -> khôi
    // phục về CŨ) chạy trong lúc transition đang bật.
    genericDrawerPanel.style.transition = 'none';
    void genericDrawerPanel.offsetHeight; // ép reflow — chốt "transition:none" TRƯỚC khi đo

    genericDrawerPanel.style.maxHeight = config.maxHeight || ''; // đo bên trong _applyGenericDrawerAutoHeight() cũng tự bỏ tạm maxHeight, nhưng set trước ở đây để tránh 1 khung hình "chưa kẹp maxHeight" lộ ra nếu transition không thực sự tắt kịp
    void genericDrawerPanel.offsetHeight; // ép reflow — chốt "vẫn đang ở min-height CŨ, transition:none" TRƯỚC khi bật lại

    // Bật lại transition TRƯỚC khi set min-height ĐÍCH — đảm bảo đúng lần đổi NÀY (CŨ -> ĐÍCH) là
    // lần được animate, không phải lần đo/khôi phục tạm bên trong _applyGenericDrawerAutoHeight().
    genericDrawerPanel.style.transition = '';
    void genericDrawerPanel.offsetHeight; // ép reflow — chốt "transition ĐÃ BẬT LẠI" TRƯỚC khi đổi min-height ĐÍCH ngay dưới

    _applyGenericDrawerAutoHeight(config); // giá trị ĐÍCH — animate NGAY (transition đã bật lại). `height` KHÔNG hề bị đụng tới — browser TỰ co giãn theo nội dung THẬT bất kể min-height này có đúng kịp hay không.

    _genericDrawerBodyObserver.observe(genericDrawerBody, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] }); // nối lại — từ đây chỉ bắt toggle NỘI BỘ về sau
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
