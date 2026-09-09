/**
 * core/ui-theme/registry.js — Bảng tra CHUNG (tên theme -> object key list) + hàm THUẦN đọc bảng
 * đó. Đây là NGUỒN CHÂN LÝ DUY NHẤT cho "theme nào đang tồn tại" (UI_THEME_REGISTRY) VÀ "theme nào
 * đang cho chọn" (UI_THEME_SELECTABLE_NAMES, 2 khái niệm TÁCH RIÊNG — xem ngay dưới) — mọi nơi khác
 * (Router/Workflow/UI chọn theme sau này) tra qua đây, KHÔNG tự liệt kê tay 'light'/'dark'/'morphin'
 * rải rác nhiều chỗ.
 *
 * NẠP SAU: core/ui-theme/light.js, core/ui-theme/dark.js, core/ui-theme/morphin.js.
 * NẠP TRƯỚC: core/ui-theme/apply-ui.js, event/workflow/ui-theme.js.
 */
const UI_THEME_REGISTRY = {
    light: UI_THEME_LIGHT,
    dark: UI_THEME_DARK,
    morphin: UI_THEME_MORPHIN,
};

/** Tên theme MẶC ĐỊNH — dùng khi chưa từng chọn (boot lần đầu) HOẶC khi gặp tên theme lạ (dữ liệu
 * cũ/hỏng trỏ tới theme không tồn tại, xem `resolveUiThemeKeyList()` ngay dưới). */
const UI_THEME_DEFAULT_NAME = 'light';

/** Danh sách theme ĐANG CHO CHỌN (SỬA 09/09/2026, Giang yêu cầu "tạm bỏ Dark/Morphin khỏi select,
 * không xoá code") — TÁCH RIÊNG khỏi `UI_THEME_REGISTRY` (registry vẫn giữ ĐỦ 3, code Dark/Morphin
 * còn nguyên, `resolveUiThemeKeyList()` vẫn tra được nếu gọi thẳng) — mảng NÀY mới là thứ quyết
 * định theme nào THẬT SỰ chọn/chuyển được lúc này. Dark/Morphin chưa thiết kế xong (vẫn placeholder
 * copy nguyên Light, xem docstring dark.js/morphin.js) nên CHƯA cho chọn — thêm lại 'dark'/'morphin'
 * vào đây (không cần đổi gì khác) NGAY KHI thiết kế thật xong. 1 nguồn DUY NHẤT cho việc này — UI
 * chọn theme sau này (dropdown Settings) PHẢI tự lấy danh sách qua đây, KHÔNG tự liệt kê tay. */
const UI_THEME_SELECTABLE_NAMES = ['light'];

/**
 * THUẦN (Rule 1-4 core-function-conventions.md) — trả về ĐÚNG 1 object key list khớp tên theme,
 * KHÔNG bao giờ trả `undefined`. Tên lạ HOẶC tên hợp lệ nhưng KHÔNG nằm trong
 * `UI_THEME_SELECTABLE_NAMES` (vd 'dark'/'morphin' lúc này) đều rơi về `UI_THEME_DEFAULT_NAME` —
 * CÙNG 1 guard clause thuần, không phải rẽ nhánh tiến trình (vẫn ĐÚNG 1 kịch bản "tra bảng, từ chối
 * đầu vào không hợp lệ", chỉ khác Ở CHỖ "hợp lệ" giờ gồm cả điều kiện "đang cho chọn").
 * @param {string} themeName
 * @returns {object} key list (UI_THEME_LIGHT/DARK/MORPHIN)
 */
function resolveUiThemeKeyList(themeName) {
    if (!UI_THEME_SELECTABLE_NAMES.includes(themeName)) return UI_THEME_REGISTRY[UI_THEME_DEFAULT_NAME];
    return UI_THEME_REGISTRY[themeName] || UI_THEME_REGISTRY[UI_THEME_DEFAULT_NAME];
}

/** THUẦN — trả BẢN SAO (không phải reference gốc) của danh sách tên theme đang cho chọn, dùng để
 * dựng `<option>` cho 1 dropdown chọn theme sau này (Settings) — trả bản sao để nơi gọi lỡ tay sửa
 * mảng trả về KHÔNG làm hỏng `UI_THEME_SELECTABLE_NAMES` gốc. */
function getSelectableUiThemeNames() {
    return [...UI_THEME_SELECTABLE_NAMES];
}

/**
 * THUẦN — tra 1 KEY cụ thể trong 1 key list đã có sẵn (tham số, KHÔNG tự tra theo tên theme — nơi
 * gọi tự `resolveUiThemeKeyList()` trước nếu cần, giữ hàm này đơn giản nhất có thể). Key không tồn
 * tại (lỗi đánh máy `data-uitk` hoặc key list thiếu sót) -> trả chuỗi rỗng thay vì `undefined`, để
 * `className = ''` an toàn thay vì `className = 'undefined'` (chuỗi thật) nếu nơi gọi quên kiểm tra.
 *
 * Hỗ trợ cú pháp `"nhóm:nhánh"` (vd `"categoryAccent:sky"` -> `keyList.categoryAccent.sky`) cho
 * bảng con NHIỀU MỨC (hiện chỉ `categoryAccent` dùng dạng này) — tách bằng dấu `:` ĐÚNG 1 lần, vế
 * sau luôn tra trong object con của vế trước. Guard clause thuần (thiếu vế nào, sai tên nhóm/nhánh
 * nào cũng chỉ rơi về rỗng), KHÔNG phải rẽ nhánh tiến trình khác — vẫn ĐÚNG 1 kịch bản "tra bảng".
 * @param {object} keyList - 1 trong UI_THEME_LIGHT/DARK/MORPHIN.
 * @param {string} key - tên phẳng (vd "cardBg") hoặc "nhóm:nhánh" (vd "categoryAccent:sky").
 * @returns {string} chuỗi class Tailwind (rỗng nếu key/nhóm/nhánh không tồn tại)
 */
function resolveUiThemeClass(keyList, key) {
    if (key.includes(':')) {
        const [group, branch] = key.split(':');
        return (keyList[group] && keyList[group][branch]) || '';
    }
    return keyList[key] || '';
}
