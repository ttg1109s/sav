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

/**
 * Đồng bộ `isSubtitlesEnabled` (appState) từ config lúc boot + MỚI (mục 4a) áp lại
 * `subtitleBoxCss` đã lưu lên `subtitleFrame` (survive qua reload — CÙNG PRECEDENT
 * `updateDOMBackground()`/`setBottomPlayerVisible()` gọi thẳng từ loadConfig(), core/config.js,
 * đụng DOM domain khác lúc boot). Gọi từ loadConfig() (core/config.js).
 * ĐỔI TÊN (mục 2, từ `initSubtitleToggleUIFromConfig` — tên cũ nhắc tới "UI" trong khi hàm giờ
 * KHÔNG còn đụng DOM nào cả, chỉ set appState) — xem core/config.js::loadConfig().
 */
function initSubtitleStateFromConfig() {
    appState.set('isSubtitlesEnabled', appConfigViz.getAll().subtitlesEnabled !== false);
    applyElementStyleToDom(subtitleFrame, appConfigViz.getAll().subtitleBoxCss); // core/element-style-editor.js
}
