/**
 * core/theme/icon-svg-ui.js — `iconSvg()`: dựng chuỗi <svg> của 1 icon trong kho components/icons.js (MỚI 07/10/2026,
 * Giang chốt "hàm iconSvg ở core/theme/, kho ở components/").
 *
 * Core-UI THUẦN (Rule 5, đuôi -ui.js): chỉ nhận tham số, trả chuỗi HTML, không đọc appState, không gắn sự kiện.
 *
 * NGOẠI LỆ ĐÃ AUDIT (Rule 3a, readme/core-function-conventions.md mục 3e): các core `-ui.js` khác ĐƯỢC
 * gọi thẳng `iconSvg()` khi dựng markup — giống hệt cách chúng đã dùng `t()`/`escapeHtml()`. Lý do: iconSvg() là hàm
 * TRÌNH BÀY thuần (tra kho hằng + nối chuỗi), không nghiệp vụ, không trạng thái; bắt Workflow dựng sẵn từng icon rồi
 * truyền xuống chỉ dời markup ngược lên Workflow. Ngoại lệ CHỈ cho đúng hàm này.
 *
 * Chuẩn thẻ gốc (xem docstring components/icons.js): viewBox 0 0 24 24, aria-hidden="true"; icon nét thêm
 * fill="none" stroke="currentColor" stroke-width="2" stroke-linecap/linejoin="round"; glyph đặc thêm fill="currentColor".
 *
 * NẠP SAU: components/icons.js (ICON_REGISTRY). NẠP TRƯỚC: mọi components/ + core -ui có dựng icon.
 */
const ICON_SVG_STROKE_ATTRS = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const ICON_SVG_FILL_ATTRS = 'fill="currentColor"';

/**
 * @param {string} name - tên icon trong ICON_REGISTRY (components/icons.js)
 * @param {string} [className] - class Tailwind (kích thước/màu), vd 'h-5 w-5'
 * @param {string} [extraAttrs] - thuộc tính thêm, viết sẵn dạng HTML, vd 'id="icon-play" data-uitk="accentText"'
 * @returns {string} chuỗi <svg>; tên không có trong kho -> chuỗi rỗng + cảnh báo console
 */
function iconSvg(name, className = '', extraAttrs = '') {
    const icon = ICON_REGISTRY[name];
    if (!icon) { console.warn(`[iconSvg] không có icon "${name}" trong components/icons.js`); return ''; } // guard
    const rootAttrs = icon.fill ? ICON_SVG_FILL_ATTRS : ICON_SVG_STROKE_ATTRS;
    const classAttr = className ? ` class="${className}"` : '';
    const extra = extraAttrs ? ` ${extraAttrs}` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${rootAttrs}${classAttr}${extra} aria-hidden="true">${icon.body}</svg>`;
}
