/**
 * Subtitle Style Settings — CHỈ còn toggle "Hiện phụ đề" (mục 2, phản hồi Giang — "loại bỏ toàn
 * bộ khung box của subtitles, chỉ giữ lại text trắng và shadow, toàn bộ tuỳ chọn -> xoá").
 *
 * === VIẾT LẠI (mục 2) === 8 hàm set* style khung/chữ (bgColor/bgOpacity/borderColor/
 * borderOpacity/borderWidth/borderRadius/textColor/fontSize/lineHeight/letterSpacing) ĐÃ XOÁ —
 * không còn field `vizConfig.subtitleStyle` (xem core/config.js). Chữ phụ đề giờ trắng + shadow
 * CỐ ĐỊNH qua CSS tĩnh, không đọc config nữa (xem core/subtitle/subtitle-display.js::
 * addActiveSubBlock()).
 *
 * PHẢI nạp SAU: core/config.js (vizConfig/saveConfig).
 */

function setSubtitlesEnabled(checked) {
    appState.set('isSubtitlesEnabled', checked);
    appConfigViz.mutateAll(cfg => { cfg.subtitlesEnabled = appState.get('isSubtitlesEnabled'); });
    saveConfig();
    if (!appState.get('isSubtitlesEnabled')) clearAllActiveSubBlocks();
}

/**
 * Đồng bộ `isSubtitlesEnabled` (appState) từ config lúc boot — CHỈ còn phần STATE, không còn tự
 * đồng bộ checkbox/style DOM nào ở đây nữa (checkbox giờ SỐNG ĐỘNG bên trong panel con "Phụ đề",
 * tự đồng bộ lúc panel MỞ qua `workflowSubtitleStyleSettings.refresh()`, KHÔNG cần đồng bộ lúc
 * boot vì panel chưa tồn tại trong DOM). Gọi từ loadConfig() (core/config.js).
 * ĐỔI TÊN (mục 2, từ `initSubtitleToggleUIFromConfig` — tên cũ nhắc tới "UI" trong khi hàm giờ
 * KHÔNG còn đụng DOM nào cả, chỉ set appState) — xem core/config.js::loadConfig().
 */
function initSubtitleStateFromConfig() {
    appState.set('isSubtitlesEnabled', appConfigViz.getAll().subtitlesEnabled !== false);
}
