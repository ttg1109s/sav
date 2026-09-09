/**
 * core/ui-theme/apply-ui.js — Hàm DỰNG/CẬP NHẬT DOM DUY NHẤT của hệ UI Theme (hậu tố `-ui.js` đúng
 * Rule 5, core-function-conventions.md — hàm này KHÔNG addEventListener nên không có phần "gom cuối
 * hàm", chỉ thuần thao tác `classList`).
 *
 * CƠ CHẾ — mỗi phần tử muốn ăn theme gắn `data-uitk="<key1> <key2> ..."` (cách nhau bằng khoảng
 * trắng nếu cần nhiều key CÙNG LÚC, vd 1 `<input>` vừa cần `inputBg` vừa cần `inputBorder` vừa cần
 * `inputText`) NGAY TRONG chuỗi HTML lúc dựng template — KHÔNG cần tự viết class Tailwind màu vào
 * `class` tĩnh nữa (structural class như `rounded-2xl`/`flex`/`p-4`... vẫn khai BÌNH THƯỜNG trong
 * `class`, chỉ màu sắc/nền/viền/chữ mới cần rời sang `data-uitk`). Hàm này quét mọi phần tử có
 * `data-uitk` trong 1 gốc DOM, tính lại chuỗi class từ theme ĐANG ACTIVE rồi đồng bộ vào
 * `classList` — CỘNG DỒN đúng nghĩa (chỉ gỡ ĐÚNG những class mà CHÍNH LẦN GỌI TRƯỚC của hàm này đã
 * thêm vào, lưu vết qua `data-uitk-applied`, KHÔNG đụng tới bất kỳ class nào khác đang có sẵn trên
 * phần tử) — an toàn gọi lại NHIỀU LẦN (đổi theme qua lại) mà không tích luỹ rác class cũ.
 *
 * KHÔNG lo phần tử đã có `data-uitk-applied` từ TRƯỚC (element cũ, đang hiển thị) hay hoàn toàn MỚI
 * (vừa `innerHTML` xong, chưa từng chạy hàm này) — cả 2 case chỉ khác nhau ở việc "có gì để gỡ hay
 * không", vẫn ĐÚNG 1 kịch bản duy nhất "đồng bộ theme cho 1 phần tử" (guard clause thuần, Rule 1).
 *
 * @param {ParentNode} rootEl - gốc DOM để quét (`document` lúc boot/đổi theme toàn app, hoặc CHỈ
 *   `genericDrawerBody`/`genericDrawerHeader` lúc `openGenericDrawer()`/`updateGenericDrawer()` vừa
 *   gán `innerHTML` xong — xem event/workflow/ui-theme.js).
 * @param {object} keyList - 1 trong UI_THEME_LIGHT/DARK/MORPHIN (core/ui-theme/registry.js).
 */
function applyUiThemeToDom(rootEl, keyList) {
    // FIX (09/09/2026, Giang báo qua ảnh chụp — dropdown folder "không có bg") — TRƯỚC ĐÂY chỉ
    // `rootEl.querySelectorAll('[data-uitk]')`, bỏ SÓT chính `rootEl` nếu nó TỰ mang `data-uitk`
    // (querySelectorAll KHÔNG BAO GIỜ khớp với chính phần tử gọi nó, chỉ khớp CON/cháu) — mọi modal/
    // dropdown dựng động gọi `applyUiThemeToDom(overlay, ...)` với chính `overlay` mang
    // `data-uitk="overlayBg"` đều dính: nội dung BÊN TRONG lên màu đúng (là con/cháu, được
    // querySelectorAll khớp), nhưng chính `overlay`/`menu`/`wrapper` (nền/viền/backdrop) thì KHÔNG,
    // dù data-uitk vẫn khai đúng trên đó. Generic Drawer thoát nạn (data-uitk="panelBg panelShadow"
    // trên CHÍNH #generic-drawer-panel) chỉ vì lần gọi ĐẦU lúc boot dùng `document` làm rootEl
    // (panel là CON của document -> khớp đúng); các lần gọi SAU (openGenericDrawer()/
    // updateGenericDrawer(), rootEl = CHÍNH panel) mới lại dính y hệt bug này nhưng vô hình vì class
    // đã bám sẵn từ lần boot, không bị gỡ. Sửa: gộp rootEl (nếu chính nó khớp `[data-uitk]`) vào
    // cùng danh sách xử lý với mọi con/cháu tìm được — 1 vòng lặp DUY NHẤT, không tách riêng.
    const targets = rootEl.matches && rootEl.matches('[data-uitk]')
        ? [rootEl, ...rootEl.querySelectorAll('[data-uitk]')]
        : [...rootEl.querySelectorAll('[data-uitk]')];
    targets.forEach((el) => {
        const keys = el.dataset.uitk.trim().split(/\s+/);
        const prevApplied = el.dataset.uitkApplied;
        if (prevApplied) el.classList.remove(...prevApplied.split(/\s+/).filter(Boolean));

        const nextClasses = keys
            .map((key) => resolveUiThemeClass(keyList, key)) // core/ui-theme/registry.js
            .join(' ')
            .trim()
            .split(/\s+/)
            .filter(Boolean);
        if (nextClasses.length) el.classList.add(...nextClasses);
        el.dataset.uitkApplied = nextClasses.join(' ');
    });
}

/**
 * Key list UI Theme ĐANG ACTIVE — cache module-level DÙNG CHUNG cho MỌI component tự dựng DOM
 * ngoài Generic Drawer (MỞ RỘNG 09/09/2026, Giang yêu cầu "đụng hết, áp dụng cho toàn app" —
 * modalChoice/dropdown-menu/rename-folder-overlay/song-edit-modal/playback-error-modal... trước
 * đây CỐ Ý đứng ngoài hệ theme, giờ vào chung). TRƯỚC ĐÂY cache này sống RIÊNG trong core/generic-
 * drawer.js (`_genericDrawerUiThemeKeyList`) — dời ra ĐÂY (core/ui-theme/, không thuộc về riêng
 * Generic Drawer nữa) để mọi file khác (core/modal-choice-ui.js, core/dropdown-menu.js, core/file-
 * manager/folder-picker-ui.js, components/playlist-view.js...) đọc CHUNG 1 nguồn, không tự tạo
 * biến cache riêng lặp lại nhiều nơi. KHÔNG tự đọc `appState`/`appConfigUiTheme` (Rule 2) — chỉ
 * nhận qua `setActiveUiThemeKeyList()`, gọi bởi event/workflow/ui-theme.js. */
let _activeUiThemeKeyList = UI_THEME_LIGHT;

/** Setter DUY NHẤT cho `_activeUiThemeKeyList` — gọi bởi event/workflow/ui-theme.js mỗi khi theme
 * đổi/khôi phục, để MỌI hàm dựng DOM (Generic Drawer LẪN modalChoice/dropdown-menu/các modal tĩnh
 * khác) đọc lại đúng theme hiện tại cho nội dung MỚI vừa dựng. Nhận qua tham số, không tự đọc gì —
 * Rule 2. */
function setActiveUiThemeKeyList(keyList) {
    _activeUiThemeKeyList = keyList;
}
