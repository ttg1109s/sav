/**
 * core/ui-theme/apply-ui.js — ghi DOM của hệ UI Theme.
 *
 * Mỗi phần tử ăn theme khai `data-uitk="<key1> <key2> ..."` trong template (chỉ màu nền/viền/chữ; class cấu trúc vẫn ở
 * `class`). `applyUiThemeToDom()` quét gốc DOM, tra class của theme đang active rồi đồng bộ vào `classList` — chỉ gỡ đúng các
 * class mà lần gọi trước đã thêm (lưu ở `data-uitk-applied`), nên gọi lại nhiều lần (đổi theme qua lại) không tích rác.
 */

/**
 * @param {ParentNode} rootEl - gốc DOM để quét (`document` lúc boot/đổi theme, hoặc 1 cụm vừa dựng); tính cả chính `rootEl`
 *   nếu nó mang `data-uitk` (querySelectorAll không khớp chính phần tử gọi — overlay/menu tự mang nền sẽ bị bỏ sót).
 * @param {object} keyList - 1 trong UI_THEME_LIGHT/DARK/MORPHIN (core/ui-theme/registry.js).
 */
function applyUiThemeToDom(rootEl, keyList) {
    const targets = rootEl.matches && rootEl.matches('[data-uitk]')
        ? [rootEl, ...rootEl.querySelectorAll('[data-uitk]')]
        : [...rootEl.querySelectorAll('[data-uitk]')];
    targets.forEach((el) => {
        const keys = el.dataset.uitk.trim().split(/\s+/);
        const prevApplied = el.dataset.uitkApplied;
        if (prevApplied) el.classList.remove(...prevApplied.split(/\s+/).filter(Boolean));

        // Tra key — cùng quy ước resolveUiThemeClass() (registry.js): "nhóm:nhánh" tra bảng con; key/nhóm/nhánh không có -> ''.
        const nextClasses = keys
            .map((key) => {
                const [group, branch] = key.split(':');
                return (branch === undefined ? keyList[key] : (keyList[group] && keyList[group][branch])) || '';
            })
            .join(' ')
            .trim()
            .split(/\s+/)
            .filter(Boolean);
        if (nextClasses.length) el.classList.add(...nextClasses);
        el.dataset.uitkApplied = nextClasses.join(' ');
    });
}

/** `color-scheme` của `<html>` — trình duyệt vẽ thanh cuộn, popup `<select>`, ô nhập màu... theo sáng/tối.
 * @param {'light'|'dark'} scheme */
function applyPageColorScheme(scheme) {
    document.documentElement.style.colorScheme = scheme;
}

/**
 * Key list UI Theme ĐANG ACTIVE — cache dùng chung cho mọi nơi tự dựng DOM (Generic Drawer, modalChoice, dropdown…) để áp
 * đúng theme cho nội dung mới dựng. Chỉ ghi qua `setActiveUiThemeKeyList()` (event/workflow/ui-theme.js).
 */
let _activeUiThemeKeyList = UI_THEME_LIGHT;

/** @param {object} keyList */
function setActiveUiThemeKeyList(keyList) {
    _activeUiThemeKeyList = keyList;
}
