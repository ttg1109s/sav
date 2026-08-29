/**
 * core/media-picker-drawer-helper.js — MỘT hàm dùng chung: mở Generic Drawer "chọn 1 mục từ lưới
 * media" (v13).
 *
 * DỜI TỪ core/file-manager/photo-ui.js::openPhotoImagePickerDrawerUi(). Hàm gốc chỉ phục vụ lưới
 * ẢNH (router + selector tile hardcode), nên khi cần picker VIDEO thì đã có một bản sao gần y hệt
 * được viết ra — nay bản sao đó xoá, hàm gốc tham số hoá và dời ra file trung lập vì nó KHÔNG còn
 * thuộc miền Photo. Đặt tên file hậu tố `-helper` (không phải `-ui`): nó không dựng cụm DOM riêng
 * nào, chỉ ghép header + gọi `openGenericDrawer()` + wire sự kiện cho DOM mà nơi gọi đã chuẩn bị.
 *
 * KHÔNG gộp picker FOLDER vào đây — tile folder khác loại và đã có hạ tầng riêng
 * (`wireFolderPickerDrawerEvents()` + `workflowPlaylist._openFolderPickerDrawer()`).
 *
 * NẠP SAU: core/generic-drawer.js, core/dom-refs.js, service/z-index.js, lang/lang.js.
 */

/** Mở Generic Drawer picker chọn Ảnh (Album cover/nền Playlist) — dựng headerHtml (tiêu đề + nút
 * X) + gọi `openGenericDrawer()` + wire NGAY closeBtn/confirmBtn/delegated click lưới ảnh, TẤT CẢ Ở
 * ĐÂY (Rule 5a — DOM động, callback CHỈ `eventBus.send()`, gom cuối hàm). `bodyHtml` nhận SẴN từ
 * Workflow (Rule 2 — Core không tự đọc `appState`/session, Workflow tự chuẩn bị data trước).
 * SỬA (v13) — thêm `routerName`/`msgPrefix`/`tileSelector`/`tileDataKey`. TRƯỚC ĐÂY hardcode router
 * `fileManagerPhoto` + selector `[data-image-key]`, nên picker chọn 1 VIDEO (cùng bản chất: lưới
 * media trong Generic Drawer, cùng header, cùng closeBtn, cùng delegated click) không dùng lại được
 * và đã bị viết thành bản sao riêng — nay bản sao đó xoá, mọi lưới media dùng CHUNG hàm này.
 * KHÔNG gộp picker FOLDER vào đây: tile folder khác loại và đã có `wireFolderPickerDrawerEvents()`
 * + `_openFolderPickerDrawer()` riêng.
 * Truyền tên router/selector là truyền GIÁ TRỊ, không rẽ nhánh tiến trình -> Rule 1 không bị đụng.
 * MỚI (29/08/2026, phản hồi Giang — "đang ở generic rồi thì chuyển sang update") — thêm tham số
 * `updateInPlace` (mặc định false = hành vi CŨ, `openGenericDrawer()`): picker nào được mở TỪ BÊN
 * TRONG 1 Generic Drawer ĐANG MỞ SẴN (vd Visual Background sống trong Settings) truyền `true` ->
 * dùng `updateGenericDrawer()` thay vì mở chồng lần nữa — tránh đúng lớp bug "isGenericDrawerOpen
 * luôn true vì đang đứng trong chính Generic Drawer" (xem event/block.js, lịch sử sửa 29/08/2026).
 * @param {string} routerName @param {string} msgPrefix
 * @param {string} title @param {string} bodyHtml
 * @param {string} tileSelector - '[data-image-key]' | '.video-tile'
 * @param {string} tileDataKey - 'imageKey' | 'videoKey'
 * @param {boolean} showConfirmButton
 * @param {boolean} [updateInPlace]
 * @returns {() => void} hàm GỠ listener delegated trên `genericDrawerBody` (DOM TĨNH dùng chung).
 */
function openMediaPickerDrawerUi(routerName, msgPrefix, title, bodyHtml, tileSelector, tileDataKey, showConfirmButton, updateInPlace) {
    const config = { // core/generic-drawer.js
        height: '90vh',
        // SỬA (khôi phục — thiếu `maxHeight`, Giang báo "picker photo không bị kẹp max height") —
        // openGenericDrawer() KHÔNG có khái niệm "height cố định" thật sự (chỉ set `min-height`,
        // 1 SÀN — xem docstring core/generic-drawer.js), CHỈ `maxHeight` mới thật sự kẹp trần. Panel
        // này KHÔNG truyền `maxHeight` nên lưới ảnh/video (windowing IntersectionObserver tải trước
        // ~2 màn hình mỗi phía) có thể đẩy panel cao vượt hẳn 90vh, đẩy header/nút X ra ngoài màn
        // hình. Set trùng giá trị với `height` — mọi feature khác dùng cặp height:'auto'+maxHeight
        // (co theo nội dung, kẹp trần); picker này CỐ Ý giữ `height:'90vh'` cố định (Giang chỉ định
        // trước đây, xem docstring _openImagePickerDrawer() — event/workflow/file-manager-photo.js)
        // nên chỉ thêm `maxHeight` làm trần CHẶN, không đổi ý định gốc "luôn ~90vh".
        maxHeight: '90vh',
        zIndex: Z_INDEX.GENERIC_DRAWER, // service/z-index.js — mặc định, KHÔNG có modal xem ảnh nào mở đồng thời với picker này (khác action-menu cần z=131)
        headerHtml: `
            <div class="flex justify-between items-center px-5 pb-3 border-b border-slate-200">
                <h3 class="text-base font-bold text-slate-900">${title}</h3>
                <button id="btn-generic-drawer-close" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500" title="${t('common.close')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        `,
        bodyHtml,
        bodyClass: 'flex flex-col',
    };
    if (updateInPlace) updateGenericDrawer(config); else openGenericDrawer(config); // core/generic-drawer.js
    const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
    if (closeBtn) closeBtn.addEventListener('click', () => eventBus.send({ router: routerName, type: `${msgPrefix}.close.click`, payload: {} }));
    if (showConfirmButton) {
        const confirmBtn = genericDrawerBody.querySelector('#btn-file-manager-image-picker-confirm');
        if (confirmBtn) confirmBtn.addEventListener('click', () => eventBus.send({ router: routerName, type: `${msgPrefix}.confirm.click`, payload: {} }));
    }
    // Click tile — delegated NGAY TRÊN genericDrawerBody (phần tử TĨNH DÙNG CHUNG nhiều feature,
    // dom-refs.js — nội dung bên trong bị nhiều feature không liên quan thay phiên chiếm dụng, xem
    // docstring core/generic-drawer.js — nên PHẢI tự wire/gỡ đúng theo vòng đời phiên picker, KHÔNG
    // wire tĩnh 1 lần cho toàn app). `<div class="fj-gallery-item">`, KHÔNG phải `<button>`.
    const onBodyClick = (e) => {
        const tile = e.target.closest(tileSelector);
        if (!tile) return;
        eventBus.send({ router: routerName, type: `${msgPrefix}.tile.click`, payload: { [tileDataKey]: tile.dataset[tileDataKey] } });
    };
    genericDrawerBody.addEventListener('click', onBodyClick);
    return () => genericDrawerBody.removeEventListener('click', onBodyClick);
}
