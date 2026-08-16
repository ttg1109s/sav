/**
 * Subtitle Style Settings — toggle "Hiện phụ đề" (mục 2, phản hồi Giang — "loại bỏ toàn bộ khung
 * box của subtitles, chỉ giữ lại text trắng và shadow, toàn bộ tuỳ chọn -> xoá") + MỚI (15/08/2026,
 * mục 4a) `setSubtitleBoxCss()` — ghi lại chuỗi CSS build từ Element Style Editor (core/
 * element-style-editor.js), CHUNG cho khung `subtitleFrame` bao mọi dòng phụ đề.
 *
 * === VIẾT LẠI (mục 2) === 8 hàm set* style khung/chữ (bgColor/bgOpacity/borderColor/
 * borderOpacity/borderWidth/borderRadius/textColor/fontSize/lineHeight/letterSpacing) ĐÃ XOÁ —
 * không còn field `vizConfig.subtitleStyle` (xem core/config.js). Chữ phụ đề giờ trắng + shadow
 * CỐ ĐỊNH qua CSS tĩnh, không đọc config nữa (xem core/subtitle/subtitle-display.js::
 * addActiveSubBlock()) — RIÊNG khung `subtitleFrame` (bao ngoài, KHÔNG phải từng dòng `<p>`) thì
 * ĐÃ CÓ style tuỳ chỉnh lại (mục 4a, xem `subtitleBoxCss` dưới).
 *
 * PHẢI nạp SAU: core/config.js (vizConfig/saveConfig), core/element-style-editor.js
 * (applyElementStyleToDom()), core/dom-refs.js (subtitleFrame).
 */

function setSubtitlesEnabled(checked) {
    appState.set('isSubtitlesEnabled', checked);
    appConfigViz.mutateAll(cfg => { cfg.subtitlesEnabled = appState.get('isSubtitlesEnabled'); });
    saveConfig();
    if (!appState.get('isSubtitlesEnabled')) clearAllActiveSubBlocks();
}

/** MỚI (16/08/2026, mục 3 — Giang yêu cầu "toggle tuỳ chọn sử dụng hiển thị mặc định") — bật/tắt
 * `subtitleUseCustomStyling`, LƯU + áp lại NGAY (applySubtitleFrameStyle(), xem dưới) để đổi công
 * tắc thấy hiệu quả tức thì trên `subtitleFrame`, không cần đợi phát nhạc/tick tiếp theo. CÙNG
 * PRECEDENT `setSubtitlesEnabled()` ngay trên (ghi + lưu + tự áp lại DOM liên quan trong 1 hàm, vì
 * ĐƠN GIẢN, router gọi THẲNG không cần qua Workflow). */
function setSubtitleUseCustomStyling(checked) {
    appConfigViz.mutateAll(cfg => { cfg.subtitleUseCustomStyling = checked; });
    saveConfig();
    applySubtitleFrameStyle(appConfigViz.getAll());
}

/** MỚI (16/08/2026, mục 3 — "Nếu là mặc định cho phép chỉnh sửa cỡ chữ 8-16px, cho phép chỉnh
 * color") — ghi 1 trong 2 field default (`subtitleDefaultFontSize`/`subtitleDefaultColor`) —
 * `field` CHỈ lập chỉ mục (KHÔNG rẽ nhánh tiến trình khác nhau theo field, CÙNG PRECEDENT
 * setSubtitleTransitionField() ngay trên — không vi phạm Rule 1). Tự áp lại NGAY, CÙNG lý do
 * setSubtitleUseCustomStyling() — 2 field này CHỈ có tác dụng lúc `subtitleUseCustomStyling ===
 * false`, applySubtitleFrameStyle() tự guard đúng nhánh. */
function setSubtitleDefaultField(field, value) {
    appConfigViz.mutateAll(cfg => { cfg[field] = value; });
    saveConfig();
    applySubtitleFrameStyle(appConfigViz.getAll());
}

/** MỚI (mục 4a) — ghi chuỗi CSS mới build từ Element Style Editor vào config (CHUNG cho
 * `subtitleFrame`, KHÔNG áp riêng từng dòng). Nơi gọi (event/workflow/subtitle-style-settings.js)
 * TỰ áp lên DOM ngay qua applyElementStyleToDom() (core/element-style-editor.js) — hàm NÀY chỉ lo
 * phần LƯU, đúng 1 tiến trình, không trộn 2 việc ghi state + đụng DOM vào chung 1 hàm. */
function setSubtitleBoxCss(cssString) {
    appConfigViz.mutateAll(cfg => { cfg.subtitleBoxCss = cssString; });
}

/** MỚI (15/08/2026, mục 4b) — ghi 1 field Comming/In/Outing (CHUNG cho mọi dòng) — `field` chỉ
 * dùng để LẬP CHỈ MỤC đúng key `vizConfig` (KHÔNG rẽ nhánh tiến trình khác nhau theo field, giống
 * setElementStyleField(), core/element-style-editor.js — không vi phạm Rule 1). Tự saveConfig()
 * NGAY (CÙNG PRECEDENT setSubtitlesEnabled() ngay trên — hàm này ĐƠN GIẢN, không cần điều phối gì
 * thêm ngoài ghi+lưu, nên router gọi THẲNG, không cần đi qua Workflow). */
function setSubtitleTransitionField(field, value) {
    appConfigViz.mutateAll(cfg => { cfg[field] = value; });
    saveConfig();
}

/** MỚI (16/08/2026, mục 3 — Giang chỉ ra "tuỳ chỉnh Styling chưa thắng inline subtitle") — ĐIỂM
 * DUY NHẤT quyết định `subtitleFrame` mang style nào, thay THẲNG cho lệnh gọi
 * `applyElementStyleToDom()` trần trụi trước đó (KHÔNG check `subtitleUseCustomStyling`, nên LUÔN
 * áp `subtitleBoxCss` dù toggle đang tắt — đây CHÍNH LÀ phần "kiểm tra lúc boot" Giang yêu cầu,
 * xem hội thoại).
 *
 * `if/else` ở đây là 2 TIẾN TRÌNH THẬT SỰ khác nhau (không phải guard bỏ qua 1 property như
 * buildElementStyleCssString()) — CÙNG PRECEDENT `_applySubtitleBlockPhase()` ngay file
 * subtitle-display.js (if/else theo `phase`, 3 nhánh xử lý riêng biệt), CÙNG thư mục `core/subtitle/`
 * — không phải pattern mới, không cần hỏi lại Giang trước khi viết (đã có tiền lệ RÕ trong chính
 * domain này).
 *
 * `removeAttribute('style')` TRƯỚC khi áp lại — bắt buộc, tránh CÒN SÓT thuộc tính của chế độ TRƯỚC
 * ĐÓ (vd Custom ON đã set border/padding qua Styling, TẮT lại Custom -> applyElementStyleToDom()
 * CHỈ setProperty() TỪNG khai báo của chuỗi MỚI, KHÔNG tự xoá property THỪA không còn trong chuỗi
 * đó, xem docstring hàm, core/element-style-editor.js).
 *
 * NHÁNH `false` (mặc định) CHỈ set 2 property (color/font-size) — font-weight/line-height/
 * text-shadow vẫn đến từ class TĨNH `.subtitle-default-appearance` + `.sub-text-glow`
 * (components/visualizer-overlay.js, assets/css/base.css) — ĐÚNG như Giang chốt "nếu là mặc định
 * CHỈ cho phép chỉnh cỡ chữ + color", KHÔNG mở rộng thêm field nào khác lúc default.
 * @param {Object} cfg - appConfigViz.getAll()
 */
function applySubtitleFrameStyle(cfg) {
    if (!subtitleFrame) return; // guard: DOM chưa sẵn sàng
    subtitleFrame.removeAttribute('style');
    if (cfg.subtitleUseCustomStyling) {
        applyElementStyleToDom(subtitleFrame, cfg.subtitleBoxCss); // core/element-style-editor.js
    } else {
        subtitleFrame.style.setProperty('color', cfg.subtitleDefaultColor);
        subtitleFrame.style.setProperty('font-size', `${cfg.subtitleDefaultFontSize}px`);
    }
}

/**
 * Đồng bộ `isSubtitlesEnabled` (appState) từ config lúc boot + MỚI (mục 4a, SỬA 16/08/2026 mục 3)
 * áp lại style `subtitleFrame` ĐÚNG theo `subtitleUseCustomStyling` đã lưu (survive qua reload —
 * CÙNG PRECEDENT `updateDOMBackground()`/`setBottomPlayerVisible()` gọi thẳng từ loadConfig(),
 * core/config.js, đụng DOM domain khác lúc boot). Gọi từ loadConfig() (core/config.js).
 * ĐỔI TÊN (mục 2, từ `initSubtitleToggleUIFromConfig` — tên cũ nhắc tới "UI" trong khi hàm giờ
 * KHÔNG còn đụng DOM nào cả, chỉ set appState) — xem core/config.js::loadConfig().
 */
function initSubtitleStateFromConfig() {
    appState.set('isSubtitlesEnabled', appConfigViz.getAll().subtitlesEnabled !== false);
    applySubtitleFrameStyle(appConfigViz.getAll());
}
