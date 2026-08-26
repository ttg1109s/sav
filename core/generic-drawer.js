
const GENERIC_DRAWER_DEFAULT_Z_INDEX = Z_INDEX.GENERIC_DRAWER; // SỬA (25/07/2026, đợt tái cấu trúc state) — trước đây hardcode `128` riêng ở đây, trùng lặp với Z_INDEX.GENERIC_DRAWER (service/z-index.js) — nay đọc thẳng từ bảng chung, tránh lệch nếu 1 trong 2 chỗ bị sửa mà quên chỗ kia.


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



function _measureGenericDrawerNaturalHeightPx(maxHeightCss) {
    genericDrawerPanel.style.minHeight = ''; // xoá TRƯỚC TIÊN — không để min-height CŨ kẹp/xung đột trong lúc đo (xem lý do CSS spec ở docstring trên)
    genericDrawerPanel.style.maxHeight = maxHeightCss || ''; // GIỮ/set NGAY — để trình duyệt TỰ kẹp lúc đo (KHÔNG clear rồi đo riêng qua <div> dò nữa)
    genericDrawerPanel.style.height = 'auto'; // BẬT tạm để đo
    const prevBodyScrollTop = genericDrawerBody.scrollTop;
    const px = genericDrawerPanel.getBoundingClientRect().height; // ĐÃ kẹp bởi max-height THẬT (nếu có) — số CUỐI CÙNG
    genericDrawerPanel.style.height = ''; // XOÁ HẲN — không giữ lại 'auto', không giữ lại gì
    genericDrawerBody.scrollTop = prevBodyScrollTop; // khôi phục — height:auto tạm thời có thể khiến overflow-y-auto hết tràn, trình duyệt tự clamp scrollTop về 0 lúc đo
    return px;
}


// FIX (Giang chỉ ra bẫy mặc định — sau 3 lần độc lập dính đúng bug này: eq-presets.js, custom-
// effect.js, event/workflow/element-style-editor.js) — bản CŨ `if (config.height !== 'auto')`
// coi CẢ 2 trường hợp "chủ động truyền 1 giá trị fixed thật (vd '90vh')" LẪN "QUÊN truyền hẳn
// `height`" là MỘT — `undefined !== 'auto'` vẫn `true`, lặng lẽ rơi vào fixed 70vh, tắt luôn auto-
// resize (`_genericDrawerIsAutoMode = false`) — drawer trông như "không co theo nội dung", đúng
// triệu chứng lặp lại 3 lần trên. KHÔNG thể bỏ hẳn nhánh fixed — core/media-picker-drawer-helper.js
// (height:'90vh', "CỐ Ý giữ cố định", chỉ định trước đây) và event/workflow/document-reader.js
// (height:'70vh'/'calc(100% - 4rem)') dùng fixed mode THẬT SỰ có chủ đích. SỬA: chỉ vào fixed-mode
// khi `config.height` được truyền RÕ RÀNG và khác 'auto' — thiếu hẳn (`undefined`/`''`) giờ mặc
// định AN TOÀN về auto thay vì âm thầm fixed 70vh, dập tắt bug pattern này tái diễn lần thứ 4 ở bất
// kỳ Generic Drawer nào sau này lỡ quên truyền `height`.
function _resolveGenericDrawerHeightPx(config) {
    if (config.height && config.height !== 'auto') {
        _genericDrawerIsAutoMode = false;
        return _cssLengthToPx(config.height);
    }
    _genericDrawerIsAutoMode = true;
    _genericDrawerAutoMaxHeight = config.maxHeight || '';
    return _measureGenericDrawerNaturalHeightPx(config.maxHeight); // ĐÃ kẹp sẵn (nếu có maxHeight) — xem docstring hàm đó
}


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


function _applyGenericDrawerAutoHeight(config) {
    const px = _resolveGenericDrawerHeightPx(config);
    genericDrawerPanel.style.maxHeight = config.maxHeight || '';
    genericDrawerPanel.style.minHeight = `${px}px`;
    return px;
}


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


function closeGenericDrawer() {
    genericDrawerPanel.style.transform = 'translateY(100%)'; // trượt xuống
    genericDrawerOverlay.classList.add('opacity-0');
    genericDrawerOverlay.classList.remove('pointer-events-auto'); // cho thao tác lọt qua NGAY lúc bắt đầu mờ dần, không đợi hết transition
}


function hideGenericDrawerImmediately() {
    genericDrawerPanel.classList.add('hidden');
    genericDrawerPanel.style.opacity = '0'; // dọn dẹp — lưới an toàn kép (dù translateY(100%) [SỬA 20/08/2026] về lý thuyết đã LUÔN đẩy đủ 1 lần chiều cao chính nó, không như bottom âm cũ có thể tính hụt)
    genericDrawerOverlay.classList.add('hidden');
    _genericDrawerIsAutoMode = false; // dừng auto-resize observer tự đo lại trong lúc đang đóng

    appState.set('isGenericDrawerOpen', false);
    console.log(`writer: "hideGenericDrawerImmediately", page: "isGenericDrawerOpen", content: "false"`);
}
