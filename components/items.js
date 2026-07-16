/**
 * components/items.js — Catalog template item + renderItemList() dùng CHUNG (mục 3
 * plan-v12-extended.md, 10/07/2026, Nhóm A). **Hiện CHỈ wire cho Document Picker** (danh sách bên
 * trong Generic Drawer ở chế độ List, xem event/workflow/document-reader.js::openPicker()) — File
 * Manager Song/Photo (tự createElement từng dòng) GIỮ NGUYÊN, chưa đụng. File Manager -> Documents
 * (CRUD, renderDocumentList() ở core/file-manager/document-ui.js) CŨNG GIỮ NGUYÊN — đó là danh
 * sách KHÁC (có badge/mở modal chi tiết), không phải Document Picker.
 *
 * Mốc hiệu năng đã hiệu chỉnh: ~100-200 item (không phải 1000+). Ở mốc này, `renderItemList()`
 * render đầy đủ 1 lần là đủ mượt — KHÔNG tự windowing bên trong hàm này (xem lý do ở
 * `computeVirtualWindowRange()` bên dưới).
 *
 * [SỬA 13/07/2026, tự audit lại theo core-function-conventions.md + event-bus-flow.md] — bản đầu
 * (cùng ngày) từng nhét CẢ vòng đời windowing (tạo spacer/viewport, gắn `scroll` listener, tự
 * quyết định khi nào vẽ lại) THẲNG vào `renderItemList()` — VI PHẠM:
 * - Rule 1 (core-function-conventions.md) — hàm chọn giữa 3 TIẾN TRÌNH khác nhau (trả chuỗi/render
 *   đầy đủ/render windowed có state riêng) theo hình dạng tham số, đúng mẫu SAI
 *   `handleUpload(file, isVideo)` trong tài liệu.
 * - Rule 3 + mục "Listener" (event-bus-flow.md) — callback của `scroll` listener gọi THẲNG TÊN 1
 *   hàm khác cùng file (`_scheduleVirtualRender`) — đúng lỗi tài liệu nêu đích danh ("document-ui.js
 *   bản đầu Nhóm A gọi resolveDocumentHtml() trong callback" — VẪN vi phạm dù addEventListener
 *   được phép). Không thể tự nhận miễn trừ kiểu modalChoice() — tài liệu đã bác chính xác pattern
 *   này ở folder-picker-ui.js ("tự ghi cùng pattern... KHÔNG hợp lệ, chưa qua audit").
 * - Rule 5c — thêm `document.createElement()` dựng cụm DOM mới (spacer/viewport) mà không đổi tên
 *   file thành `-ui.js`.
 *
 * SỬA ĐÚNG: windowing là ĐIỀU PHỐI liên tục theo dữ liệu — đúng vai trò Workflow (Rule 3: 2 hàm
 * core phụ thuộc kết quả nhau, `computeVirtualWindowRange()`/`computeVariableVirtualWindowRange()`
 * RỒI `renderItemList()`, CHỈ Workflow được gọi cả 2). File này CHỈ giữ 2 hàm THUẦN tính toán
 * (không DOM/`appState`/gọi hàm khác) — KHÔNG có phần "tạo spacer/gắn scroll listener" ở đây.
 *
 * `scroll` — SỬA 14/07/2026 (Giang chỉ ra bản trước SAI): đi ĐÚNG luồng listener->bus->router->
 * workflow như MỌI sự kiện khác (kể cả tần suất cao), KHÔNG Workflow tự `addEventListener`. Xem
 * `event/listener/virtual-list.js` (1 listener chung, đọc `dataset.virtualScrollMount`) +
 * `event/workflow/virtual-list.js` (`workflowVirtualList.mount()`/`redraw()` — nơi THẬT SỰ dựng
 * spacer/viewport + gọi 2 hàm core dưới đây).
 *
 * CONSUMER THẬT ĐẦU TIÊN (Patch mục 2, 14/07/2026): lưới ảnh Photo & Album, qua
 * `event/workflow/file-manager-photo.js::setupPhotoGridWindow()` -> `workflowVirtualList.mount()`.
 * Hàng lưới KHÔNG đều chiều cao (header ngày xen giữa, xem `core/file-manager/image.js::
 * buildPhotoGridRows()`) nên dùng `computeVariableVirtualWindowRange()` (ngay dưới), KHÔNG dùng
 * `computeVirtualWindowRange()` (giả định chiều cao đều — vẫn giữ cho danh sách đều sau này).
 * Template: `itemTemplateImageGridRow()` (ngay dưới).
 *
 * Generic Drawer (core/generic-drawer.js) và items.js TÁCH BIỆT HOÀN TOÀN, không phụ thuộc nhau:
 * Drawer không biết "item" là gì (chỉ nhận `bodyHtml` là 1 chuỗi có sẵn), items.js không biết
 * "drawer" là gì (chỉ trả chuỗi HTML). Workflow là nơi DUY NHẤT nối 2 thứ:
 *   openGenericDrawer({ bodyHtml: renderItemList(null, docs, itemTemplateDocumentRow, ctx) })
 *
 * NẠP SAU: core/modal-choice.js (dùng chung escapeHtml()), lang/lang.js (t() — hiện CHƯA cần
 * trong itemTemplateDocumentRow(), giữ chỗ nếu template sau này cần dịch text tĩnh).
 */

/**
 * Template 1 dòng Document trong Document Picker — CHỈ tap-để-chọn, KHÔNG có menu CRUD (đúng yêu
 * cầu Giang — CRUD chỉ có trong File Manager -> Documents, xem
 * core/file-manager/document-ui.js::renderDocumentList(), KHÔNG migrate batch này). Đánh dấu tài
 * liệu ĐANG mở (viền sáng) nếu `doc.key === ctx.activeDocumentKey` — CHỮ ĐEN vì Generic Drawer
 * nền TRẮNG (khác phần còn lại của app, mục 2/7 plan-v12-extended.md).
 * @param {{key: string, title: string, format: string}} doc
 * @param {{activeDocumentKey: string|null}} [ctx] - dữ liệu NGOÀI item (không thuộc riêng item
 *        này) mà template cần — renderItemList() truyền NGUYÊN ctx cho MỌI item khi gọi templateFn.
 * @returns {string}
 */
function itemTemplateDocumentRow(doc, ctx) {
    const isActive = !!(ctx && doc.key === ctx.activeDocumentKey);
    const iconBg = doc.format === 'docx' ? 'bg-sky-100 text-sky-600' : 'bg-slate-100 text-slate-600';
    const rowClass = isActive ? 'bg-sky-50 border border-sky-300' : 'hover:bg-slate-100 border border-transparent';
    return `
        <button type="button" class="generic-item-document-row w-full text-left px-4 py-3.5 rounded-xl mb-1.5 flex items-center gap-3 transition-colors ${rowClass}" data-document-key="${escapeHtml(doc.key)}">
            <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <span class="text-sm font-semibold text-slate-800 truncate">${escapeHtml(doc.title)}</span>
        </button>
    `;
}

/**
 * Tile 1 folder trong Generic Drawer grid (Add to Folder picker, MỚI 14/07/2026, Giang yêu cầu —
 * "before: modal, after: generic drawer grid") — icon TRÊN + tên DƯỚI (đầy đủ, tối đa 2 dòng, dùng
 * `-webkit-line-clamp` inline thay vì class `line-clamp-2` của Tailwind — CDN bản đang dùng KHÔNG
 * chắc có plugin đó, style inline ĐẢM BẢO chạy đúng bất kể phiên bản Tailwind nào).
 *
 * 2 CHẾ ĐỘ loại trừ nhau: bình thường (tap để chọn) HOẶC đang sửa tên (input, dùng NGAY sau khi
 * tạo folder mới qua buildAddFolderTileHtml() — xem event/workflow/playlist.js::
 * createFolderInPicker()) — biết qua `ctx.editingFolderId === folder.id`.
 * @param {{id: string, name: string}} folder
 * @param {{editingFolderId: string|null}} [ctx]
 * @returns {string}
 */
function itemTemplateFolderTile(folder, ctx) {
    const isEditing = !!(ctx && ctx.editingFolderId === folder.id);
    const folderIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>`;

    if (isEditing) {
        return `
            <div class="generic-item-folder-tile-editing flex flex-col items-center gap-1.5 w-20" data-folder-id="${escapeHtml(folder.id)}">
                <div class="w-14 h-14 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">${folderIconSvg}</div>
                <input type="text" value="${escapeHtml(folder.name)}" class="generic-folder-tile-rename-input w-full text-xs text-center text-slate-800 border border-sky-400 rounded-lg px-1 py-1 outline-none" />
            </div>
        `;
    }
    return `
        <button type="button" class="generic-item-folder-tile flex flex-col items-center gap-1.5 w-20" data-folder-id="${escapeHtml(folder.id)}">
            <div class="w-14 h-14 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">${folderIconSvg}</div>
            <span class="text-xs font-medium text-slate-700 text-center leading-tight break-words" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(folder.name)}</span>
        </button>
    `;
}

/**
 * Tile "Tạo folder mới" — CỐ ĐỊNH, đặt cuối grid, KHÔNG đi qua renderItemList() (không phải 1 item
 * trong danh sách folder, chỉ 1 nút hành động) — Workflow tự nối chuỗi này vào SAU
 * `renderItemList(null, folders, itemTemplateFolderTile, ctx)`, xem event/workflow/playlist.js.
 * @returns {string}
 */
function buildAddFolderTileHtml() {
    return `
        <button type="button" id="generic-folder-picker-add-tile" class="flex flex-col items-center gap-1.5 w-20">
            <div class="w-14 h-14 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center shrink-0 border-2 border-dashed border-slate-300">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4" /></svg>
            </div>
            <span class="text-xs font-medium text-slate-500 text-center">${t('fileManager.folderPicker.newTileLabel')}</span>
        </button>
    `;
}

/**
 * Dựng 1 danh sách item bằng cách gán `containerEl.innerHTML` (nếu có) **1 LẦN DUY NHẤT** (thay N
 * lần createElement+appendChild) — đủ mượt tới ~100-200 item trên mobile webview (xem docstring
 * đầu file). Hàm THUẦN, KHÔNG tự gắn sự kiện click — nơi gọi (Workflow) tự querySelector +
 * addEventListener SAU khi HTML đã vào DOM thật (xem event/workflow/document-reader.js).
 * @param {HTMLElement|null} containerEl - truyền `null` nếu CHỈ cần chuỗi HTML trả về (vd để làm
 *        `bodyHtml` cho openGenericDrawer()/updateGenericDrawer() — nơi đó mới THẬT SỰ gán vào
 *        DOM, gán 2 lần là thừa).
 * @param {Array<Object>} items
 * @param {(item: Object, ctx?: Object) => string} templateFn
 * @param {Object} [ctx] - dữ liệu NGOÀI item dùng chung cho MỌI item (vd activeDocumentKey).
 * @returns {string} chuỗi HTML đã dựng.
 */
function renderItemList(containerEl, items, templateFn, ctx) {
    const html = items.map((item) => templateFn(item, ctx)).join('');
    if (containerEl) containerEl.innerHTML = html;
    return html;
}

/**
 * THUẦN (Rule 1-4 core-function-conventions.md: không DOM, không `appState`, không gọi hàm nào
 * khác, không rẽ nhánh tiến trình — chỉ kẹp giá trị toán học) — tính khoảng chỉ số [startIdx,
 * endIdx) CẦN hiển thị cho 1 danh sách windowing, dựa trên vị trí cuộn/kích thước khung nhìn hiện
 * tại. GIẢ ĐỊNH mọi item cao ĐỀU NHAU (`itemHeight` cố định, đo 1 lần bên ngoài hàm này — không phù
 * hợp cho template có chiều cao co giãn theo nội dung).
 *
 * Workflow nào cần windowing THẬT (hiện CHƯA có nơi gọi — xem docstring đầu file) tự gọi hàm này
 * MỖI LẦN cuộn, rồi tự `renderItemList(viewportEl, items.slice(startIdx, endIdx), templateFn, ctx)`
 * — 2 lời gọi TÁCH RỜI do Workflow điều phối, KHÔNG hàm core nào gọi hàm core kia.
 *
 * @param {number} scrollTop - vị trí cuộn hiện tại (px) của khung chứa.
 * @param {number} viewHeight - chiều cao khung nhìn thấy (px, thường = containerEl.clientHeight).
 * @param {number} itemHeight - chiều cao 1 dòng/tile (px, đo 1 lần từ item đầu tiên, dùng chung).
 * @param {number} itemCount - tổng số item trong danh sách đầy đủ.
 * @param {number} [bufferRows] - số dòng đệm thêm mỗi phía NGOÀI vùng nhìn thấy (mặc định 4) — cuộn
 *        nhanh không bị chớp trắng trước khi kịp vẽ dòng mới.
 * @returns {{startIdx: number, endIdx: number}}
 */
function computeVirtualWindowRange(scrollTop, viewHeight, itemHeight, itemCount, bufferRows) {
    const buffer = bufferRows == null ? 4 : bufferRows;
    const safeItemHeight = itemHeight > 0 ? itemHeight : 1; // kẹp an toàn — tránh chia cho 0 nếu nơi gọi lỡ đo ra 0
    const startIdx = Math.max(0, Math.floor(scrollTop / safeItemHeight) - buffer);
    const endIdx = Math.min(itemCount, Math.ceil((scrollTop + viewHeight) / safeItemHeight) + buffer);
    return { startIdx, endIdx };
}

/**
 * MỚI (Patch mục 2, 14/07/2026) — biến thể `computeVirtualWindowRange()` cho danh sách CHIỀU CAO
 * TỪNG HÀNG KHÔNG ĐỀU (vd lưới ảnh Photo & Album: header ngăn cách ngày khác chiều cao hàng ảnh —
 * xem `core/file-manager/image.js::buildPhotoGridRows()`). Hàm THUẦN (Rule 1-4
 * core-function-conventions.md) — không DOM/`appState`/gọi hàm khác, chỉ toán học kẹp giá trị dựa
 * trên mảng chiều cao ĐÃ ĐO SẴN (nơi gọi tự đo, giống tinh thần `itemHeight` ở
 * `computeVirtualWindowRange()`). 1 vòng lặp duy nhất, 2 `if` bên trong đều là guard-clause cho
 * CÙNG 1 tiến trình "tìm khoảng hàng giao với [lo, hi]" (xoá `if` nào đi, vòng lặp vẫn mô tả ĐÚNG 1
 * kịch bản đó, chỉ mất phần dừng sớm/đánh dấu điểm bắt đầu — không phải rẽ nhánh 2 nghiệp vụ khác
 * nhau, Rule 1 core-function-conventions.md).
 * @param {number[]} rowHeights - chiều cao (px) TỪNG hàng, đúng thứ tự hiển thị.
 * @param {number} scrollTop
 * @param {number} viewHeight
 * @param {number} [bufferPx] - vùng đệm (px) mỗi phía NGOÀI vùng nhìn thấy — mặc định 600. Dùng PX
 *        thay vì "số hàng đệm" (`bufferRows` ở `computeVirtualWindowRange()`) vì chiều cao hàng ở
 *        đây không đều, không có 1 con số "N hàng" nào phản ánh đúng khoảng đệm thực tế.
 * @returns {{startIdx: number, endIdx: number, offsetTop: number, totalHeight: number}} `offsetTop`
 *          — vị trí (px) của hàng `startIdx` tính từ đầu danh sách, dùng để `translateY()` cửa sổ
 *          đã render đúng vị trí trong khung cuộn. `totalHeight` — tổng chiều cao TOÀN BỘ danh sách
 *          (kể cả phần chưa render), dùng đặt chiều cao "sizer" để thanh cuộn dài đúng thực tế.
 */
function computeVariableVirtualWindowRange(rowHeights, scrollTop, viewHeight, bufferPx) {
    // SỬA (15/07/2026, cùng đợt fix tràn RAM — xem event/workflow/virtual-list.js::handleScroll())
    // — giảm 600 -> 400: buffer càng lớn, càng nhiều ảnh CÙNG LÚC nằm trong cửa sổ (mỗi ảnh CHIẾM
    // BITMAP đã decode trong RAM, ảnh gốc độ phân giải cao có thể vài MB/ảnh) — 400px vẫn đủ mượt
    // (vài hàng đệm mỗi phía trước khi tới rìa màn hình thật) mà giảm đáng kể số ảnh decode đồng
    // thời tối đa so với 600px cũ.
    const buffer = bufferPx == null ? 400 : bufferPx;
    const totalHeight = rowHeights.reduce((sum, h) => sum + h, 0);
    const lo = Math.max(0, scrollTop - buffer);
    const hi = scrollTop + viewHeight + buffer;

    let offset = 0;
    let startIdx = 0;
    let endIdx = rowHeights.length;
    let offsetTop = 0;
    let foundStart = false;
    for (let i = 0; i < rowHeights.length; i++) {
        const rowTop = offset;
        const rowBottom = offset + rowHeights[i];
        if (!foundStart && rowBottom > lo) { startIdx = i; offsetTop = rowTop; foundStart = true; } // guard: đánh dấu điểm bắt đầu ĐÚNG 1 LẦN, ngay khi hàng đầu tiên chạm vùng [lo,hi]
        if (rowTop >= hi) { endIdx = i; break; } // guard: hàng đã vượt hẳn khỏi vùng [lo,hi] -> dừng sớm, không cần duyệt tiếp
        offset = rowBottom;
    }
    return { startIdx, endIdx, offsetTop, totalHeight };
}

/**
 * MỚI (Patch mục 2, 14/07/2026) — Template 1 "hàng" lưới ảnh, dùng CHUNG cho lưới Photo & Album
 * (`event/workflow/file-manager-photo.js::setupPhotoGridWindow()`) LẪN picker cover bài hát (cùng
 * hàm, khác nơi gọi — xem docstring đầu `core/file-manager/photo-ui.js`). Hàng có 2 DẠNG (xem
 * `core/file-manager/image.js::buildPhotoGridRows()`):
 *   - `header` — 1 `<div>` full-width ngăn cách ngày. Nhãn theo `navigator.language`
 *     (`Intl.DateTimeFormat`) — tên thứ/tháng không thuộc bộ key dịch `t()`/`tFormat()` hiện có, nên
 *     KHÔNG qua hệ i18n. Class `h-10` (40px) CỐ ĐỊNH — PHẢI khớp đúng hằng số
 *     `PHOTO_GRID_HEADER_HEIGHT_PX` ở `event/workflow/file-manager-photo.js` (Workflow cần biết
 *     TRƯỚC chiều cao thật để tính toán windowing — đổi 1 trong 2 chỗ PHẢI đổi luôn chỗ kia).
 *   - `imageRow` — bọc trong 1 `<div class="photo-row">` (Giai đoạn 2, rewrite Photo/Album, mục 3b —
 *     THAY hẳn CSS Grid `auto-fill` cũ, tránh fragile coupling "JS đoán trước số cột trình duyệt tự
 *     tính"). MỖI `<button>` ảnh tự set `style="aspect-ratio: width/height"` (CSS `height:100%` từ
 *     `.photo-row` cố định chiều cao, `aspect-ratio` tự suy ra chiều rộng — KHÔNG cần JS tính px thủ
 *     công). `image.width`/`image.height` THIẾU (ảnh cũ, upload trước Giai đoạn 1) -> fallback `1/1`
 *     — CÙNG quy tắc fallback `buildPhotoGridRows()` (core/file-manager/image.js) đang dùng, đảm bảo
 *     2 bên tính ra ĐÚNG hàng khớp nhau.
 *     Object URL lấy từ `image.thumbBlob` (ảnh đã resize lúc upload — nhẹ hơn nhiều so với ảnh gốc)
 *     — fallback `image.blob` cho ảnh cũ CHƯA có `thumbBlob` (Giai đoạn 1, mục 3d). `blob` GỐC chỉ
 *     dùng lúc mở full view (`openImagePreviewModal()`), KHÔNG đụng ở đây.
 *     AN TOÀN dù hàm này "THUẦN" theo nghĩa Rule 1-4 (Rule 1-4 chỉ cấm `appState.get()`/gọi core
 *     khác/`addEventListener` rải rác — KHÔNG cấm side-effect khác như tạo object URL) vì chỉ 1 CỬA
 *     SỔ NHỎ (visible+buffer) được template hoá mỗi lần `renderItemList()` chạy —
 *     `workflowVirtualList.redraw()`/`unmount()` (event/workflow/virtual-list.js) tự revoke object
 *     URL CŨ trước khi vẽ lại.
 * 2 DẠNG xử lý trong CÙNG 1 hàm — `if/else` ở đây CHỈ chọn giữa 2 CÁCH HIỂN THỊ của CÙNG 1 khái
 * niệm "hàng lưới ảnh" — đúng khuôn `itemTemplateFolderTile()` ở trên (2 chế độ hiển thị 1 LOẠI
 * item, KHÔNG phải rẽ nhánh giữa 2 NGHIỆP VỤ khác nhau — Rule 1 chỉ cấm vế sau).
 * @param {{type:'header', addedAt:number}|{type:'imageRow', images:Array<{key:string,blob:Blob,thumbBlob?:Blob,width?:number,height?:number,filename:string}>}} row
 * @param {{selectionMode?: boolean, selectedImageKeys?: Set<string>, quickDeleteMode?: boolean, quickDeleteSelectedKeys?: Set<string>}} [ctx]
 *        `quickDeleteMode`/`quickDeleteSelectedKeys` MỚI (Giai đoạn 3, redesign chế độ xoá nhanh) —
 *        LOẠI TRỪ với `selectionMode` (đảm bảo ở Router, không bao giờ cả 2 cùng true).
 * @returns {string}
 */
function itemTemplateImageGridRow(row, ctx) {
    if (row.type === 'header') {
        const d = new Date(row.addedAt || 0);
        const opts = { weekday: 'long', day: 'numeric', month: 'short' };
        if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
        const label = new Intl.DateTimeFormat(navigator.language, opts).format(d);
        return `<div class="photo-grid-header">${escapeHtml(label)}</div>`;
    }

    const selectionMode = !!(ctx && ctx.selectionMode);
    const selectedKeys = ctx && ctx.selectedImageKeys;
    // MỚI (Giai đoạn 3, rewrite Photo/Album — redesign chế độ xoá nhanh) — 2 chế độ đánh dấu tile
    // LOẠI TRỪ NHAU (đảm bảo ở Router — event/router/file-manager-photo.js, KHÔNG BAO GIỜ cả 2 cùng
    // true): `selectionMode` (chọn thêm vào album, badge XANH) / `quickDeleteMode` (đánh dấu chờ xoá
    // — MỚI, badge ĐỎ, khác màu để phân biệt 2 nghiệp vụ). Badge ĐỎ dùng luôn icon thùng rác thay vì
    // dấu tick — rõ ý nghĩa hơn ("ảnh này SẼ bị xoá") so với dùng chung 1 kiểu tick 2 màu.
    const quickDeleteMode = !!(ctx && ctx.quickDeleteMode);
    const quickDeleteSelectedKeys = ctx && ctx.quickDeleteSelectedKeys;
    const tilesHtml = row.images.map((image) => {
        const objectUrl = URL.createObjectURL(image.thumbBlob || image.blob); // fallback ảnh cũ chưa có thumbBlob (Giai đoạn 1, mục 3d)
        const aspectRatio = (image.width > 0 && image.height > 0) ? `${image.width}/${image.height}` : '1/1'; // fallback khớp buildPhotoGridRows()
        const isSelected = selectionMode && selectedKeys && selectedKeys.has(image.key);
        const isMarkedForDelete = quickDeleteMode && quickDeleteSelectedKeys && quickDeleteSelectedKeys.has(image.key);
        let badgeHtml = '';
        if (selectionMode) {
            badgeHtml = `
            <span class="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center border-2 transition-colors ${isSelected ? 'bg-sky-500 border-sky-400' : 'bg-black/40 border-white/60'}">${isSelected ? '<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>' : ''}</span>`;
        } else if (quickDeleteMode) {
            badgeHtml = `
            <span class="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center border-2 transition-colors ${isMarkedForDelete ? 'bg-rose-500 border-rose-400' : 'bg-black/40 border-white/60'}">${isMarkedForDelete ? '<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>' : ''}</span>`;
        }
        return `
            <button type="button" class="photo-tile${isMarkedForDelete ? ' opacity-50' : ''}" style="aspect-ratio: ${aspectRatio}" data-image-key="${escapeHtml(image.key)}" data-has-object-url="1">
                <img src="${objectUrl}" alt="${escapeHtml(image.filename)}">${badgeHtml}
            </button>`;
    }).join('');
    return `<div class="photo-row">${tilesHtml}</div>`;
}

/**
 * MỚI (Giai đoạn 3b, rewrite Photo/Album, mục 3a) — 1 hàng trong Album List sub-panel (THAY story
 * slider ngang cũ, event/workflow/file-manager-photo.js::refreshAlbumListPanel()). Layout ĐÚNG
 * Giang mô tả: tên trái (truncate, phần còn lại click được để LỌC lưới ảnh chính + quay lại panel
 * Photo) — số lượng ảnh giữa — 4 icon hành động phải (xem/thêm ảnh/đổi tên/xoá).
 * SỬA (fix bug 2, Giang yêu cầu "ấn vào album lại ra sub panel -> bỏ") — vùng tên/số lượng KHÔNG
 * còn bấm được nữa (đổi từ `<button data-album-list-row>` sang `<div>` tĩnh) — trước đây bấm vào sẽ
 * lọc lưới ảnh chính + quay về panel Photo, nay bỏ hẳn tương tác đó, CHỈ còn 4 icon hành động phải
 * là bấm được (xem/thêm ảnh/đổi tên/xoá).
 * Hàm THUẦN (Rule 1-4) — không appState, không DOM, không gọi core khác.
 * @param {{id: string, name: string, imageKeys: Array<string>}} album
 * @returns {string}
 */
function itemTemplateAlbumListRow(album) {
    const count = Array.isArray(album.imageKeys) ? album.imageKeys.length : 0;
    return `
        <div class="flex items-center gap-2 px-4 py-3 border-b border-white/5">
            <div class="flex-1 min-w-0">
                <span class="text-sm font-semibold text-slate-100 truncate block">${escapeHtml(album.name)}</span>
            </div>
            <span class="text-xs text-slate-400 shrink-0 tabular-nums">${tFormat('fileManager.photo.albumList.photoCount', { count })}</span>
            <div class="flex items-center gap-0.5 shrink-0">
                <button type="button" class="p-1.5 rounded-full hover:bg-white/10 transition-colors text-slate-400 hover:text-violet-400" data-album-list-action="view" data-album-id="${escapeHtml(album.id)}" title="${t('fileManager.photo.album.viewTitle')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 8a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                </button>
                <button type="button" class="p-1.5 rounded-full hover:bg-white/10 transition-colors text-slate-400 hover:text-sky-400" data-album-list-action="addImages" data-album-id="${escapeHtml(album.id)}" title="${t('fileManager.photo.album.addImagesTitle')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v4m-2-2h4" /></svg>
                </button>
                <button type="button" class="p-1.5 rounded-full hover:bg-white/10 transition-colors text-slate-400 hover:text-emerald-400" data-album-list-action="rename" data-album-id="${escapeHtml(album.id)}" title="${t('fileManager.photo.album.renameTitle')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
                <button type="button" class="p-1.5 rounded-full hover:bg-rose-500/10 transition-colors text-slate-400 hover:text-rose-400" data-album-list-action="delete" data-album-id="${escapeHtml(album.id)}" title="${t('fileManager.photo.album.deleteTitle')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </div>
        </div>`;
}
