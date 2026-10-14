/**
 * core/ui-theme/registry.js — nguồn duy nhất cho "theme nào tồn tại" (UI_THEME_REGISTRY) và "theme nào đang cho chọn"
 * (UI_THEME_SELECTABLE_NAMES) + hàm thuần tra 2 bảng đó. Nơi khác không tự liệt kê 'light'/'dark'/'morphin'.
 *
 * NẠP SAU: core/ui-theme/light.js, core/ui-theme/dark.js, core/ui-theme/morphin.js.
 */
const UI_THEME_REGISTRY = {
    light: UI_THEME_LIGHT,
    dark: UI_THEME_DARK,
    morphin: UI_THEME_MORPHIN,
};

/** Theme mặc định — chưa từng chọn, hoặc tên lạ/không cho chọn. */
const UI_THEME_DEFAULT_NAME = 'light';

/** Theme đang cho chọn (tách khỏi registry: bỏ 1 tên khỏi đây là ẩn khỏi select mà không xoá bảng màu). */
const UI_THEME_SELECTABLE_NAMES = ['light', 'dark', 'morphin'];

/** THUẦN — tên theme thật sự áp dụng: tên không cho chọn/lạ -> mặc định. @param {string} themeName @returns {string} */
function resolveUiThemeName(themeName) {
    return UI_THEME_SELECTABLE_NAMES.includes(themeName) ? themeName : UI_THEME_DEFAULT_NAME;
}

/** THUẦN — key list của tên theme, không bao giờ `undefined` (tên lạ/không cho chọn -> theme mặc định).
 * @param {string} themeName @returns {object} UI_THEME_LIGHT/DARK/MORPHIN */
function resolveUiThemeKeyList(themeName) {
    if (!UI_THEME_SELECTABLE_NAMES.includes(themeName)) return UI_THEME_REGISTRY[UI_THEME_DEFAULT_NAME];
    return UI_THEME_REGISTRY[themeName] || UI_THEME_REGISTRY[UI_THEME_DEFAULT_NAME];
}

/** THUẦN — bản sao danh sách theme đang cho chọn (dựng `<option>`; nơi gọi sửa mảng không hỏng bảng gốc). */
function getSelectableUiThemeNames() {
    return [...UI_THEME_SELECTABLE_NAMES];
}

/**
 * THUẦN — tra 1 key trong key list đã có (nơi gọi tự resolveUiThemeKeyList() trước). Cú pháp "nhóm:nhánh" (vd
 * "categoryAccent:sky") tra bảng con. Key/nhóm/nhánh không có -> '' (an toàn gán className).
 * @param {object} keyList @param {string} key @returns {string} chuỗi class Tailwind
 */
function resolveUiThemeClass(keyList, key) {
    if (key.includes(':')) {
        const [group, branch] = key.split(':');
        return (keyList[group] && keyList[group][branch]) || '';
    }
    return keyList[key] || '';
}
