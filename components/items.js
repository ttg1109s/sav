/**
 * components/items.js — Catalog template item + renderItemList() dùng CHUNG (mục 3
 * plan-v12-extended.md, 10/07/2026, Nhóm A).
 *
 * XOÁ (loại bỏ Document Reader khỏi app) — `itemTemplateDocumentRow()` (template dòng Document
 * Picker, consumer GỐC ban đầu của file này) bỏ hẳn cùng tính năng. File này giờ CHỈ còn phục vụ
 * "Add to Folder" picker (`itemTemplateFolderTile()`) — File Manager Song/Photo (tự createElement
 * từng dòng) vẫn GIỮ NGUYÊN, chưa đụng.
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
 *   hàm khác cùng file — vẫn vi phạm dù addEventListener được phép. Không thể tự nhận miễn trừ kiểu
 *   modalChoice() — tài liệu đã bác chính xác pattern này ở folder-picker-ui.js ("tự ghi cùng
 *   pattern... KHÔNG hợp lệ, chưa qua audit").
 * - Rule 5c — thêm `document.createElement()` dựng cụm DOM mới (spacer/viewport) mà không đổi tên
 *   file thành `-ui.js`.
 *
 * SỬA ĐÚNG: windowing là ĐIỀU PHỐI liên tục theo dữ liệu — đúng vai trò Workflow (Rule 3: 2 hàm
 * core phụ thuộc kết quả nhau, `computeVirtualWindowRange()` RỒI `renderItemList()`, CHỈ Workflow
 * được gọi cả 2). File này CHỈ giữ hàm THUẦN tính toán (không DOM/`appState`/gọi hàm khác) — KHÔNG
 * có phần "tạo spacer/gắn scroll listener" ở đây.
 *
 * `scroll` — SỬA 14/07/2026 (Giang chỉ ra bản trước SAI): đi ĐÚNG luồng listener->bus->router->
 * workflow như MỌI sự kiện khác (kể cả tần suất cao), KHÔNG Workflow tự `addEventListener`.
 *
 * ĐẬP ĐI LÀM LẠI (rewrite Photo/Album, Giang yêu cầu "không dùng window virtual tự tạo nữa, dùng
 * thư viện") — `computeVariableVirtualWindowRange()`/`itemTemplateImageGridRow()` (từng ở file này,
 * dùng cho lưới ảnh Photo — xem lịch sử "CONSUMER THẬT ĐẦU TIÊN" cũ) XOÁ HẲN cùng lúc bỏ
 * hẳn `event/workflow,router,listener/virtual-list.js`. Lưới ảnh Photo GIỜ KHÔNG còn dùng
 * gì ở file NÀY nữa — chuyển hẳn sang `event/workflow/photo-gallery-window.js` (windowing cấp NHÓM
 * NGÀY qua `IntersectionObserver` + fjGallery, thư viện thật). `computeVirtualWindowRange()` (giả
 * định chiều cao đều — GIỮ NGUYÊN, dùng cho danh sách đều bất kỳ) là hàm windowing DUY NHẤT còn lại
 * ở file này — hiện CHƯA có consumer thật nào gọi tới nó (xem docstring hàm đó).
 *
 * Generic Drawer (core/generic-drawer.js) và items.js TÁCH BIỆT HOÀN TOÀN, không phụ thuộc nhau:
 * Drawer không biết "item" là gì (chỉ nhận `bodyHtml` là 1 chuỗi có sẵn), items.js không biết
 * "drawer" là gì (chỉ trả chuỗi HTML). Workflow là nơi DUY NHẤT nối 2 thứ — xem
 * `itemTemplateFolderTile()` bên dưới cho ví dụ thật (event/workflow/playlist.js::
 * createFolderInPicker()).
 *
 * NẠP SAU: core/modal-choice-ui.js (dùng chung escapeHtml()).
 */

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
/**
 * SỬA (ver12 "Song/Video Unification", phản hồi Giang 28/07/2026) — thêm icon type (song/video)
 * chồng GIỮA icon thư mục (KHÔNG PHẢI badge góc nhỏ như bản Batch 4 cũ, đã bỏ khi viết lại Folder
 * Browser ở Batch 5 mục 6e) — `type: null`/chưa xác định giữ NGUYÊN icon thư mục mặc định, không
 * chồng gì thêm. DÙNG CHUNG cho cả Folder Browser (event/workflow/file-manager-folder-browser.js)
 * lẫn "Add to Folder" picker (event/workflow/playlist.js) — cả 2 đều gọi `listFolders()` (record
 * THÔ, có sẵn field `type`), không cần đổi gì ở 2 nơi gọi.
 * @param {{id: string, name: string, type?: 'song'|'video'|'photo'|null}} folder
 */
function itemTemplateFolderTile(folder, ctx) {
    const isEditing = !!(ctx && ctx.editingFolderId === folder.id);
    const folderIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>`;

    // type: null/chưa xác định -> '' (giữ NGUYÊN icon thư mục mặc định, không chồng gì).
    // SỬA (khôi phục — Giang báo "folder photo chưa có icon như song/video") — 'photo' bị THIẾU
    // hẳn khỏi ternary này từ đầu (chỉ viết cho song/video lúc "Song/Video Unification", Photo
    // hợp nhất vào Playlist SAU — folder.type === 'photo' rơi về nhánh mặc định '', không icon).
    const typeOverlaySvg = folder.type === 'song'
        ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 004.5 14C2.567 14 1 15.343 1 17s1.567 3 3.5 3 3.5-1.343 3.5-3V7.82l8-1.6v5.894A4.37 4.37 0 0014.5 12c-1.933 0-3.5 1.343-3.5 3s1.567 3 3.5 3 3.5-1.343 3.5-3V3z" /></svg>`
        : folder.type === 'video'
        ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM16.553 7.106A1 1 0 0016 8v4a1 1 0 00.553.894l2 1A1 1 0 0020 13V7a1 1 0 00-1.447-.894l-2 1z" /></svg>`
        : folder.type === 'photo'
        ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l3.5-4.5 2.5 3.01L13.5 8 18 15H16z" clip-rule="evenodd" /></svg>`
        : '';
    const typeOverlayColorClass = folder.type === 'song' ? 'text-emerald-400' : folder.type === 'photo' ? 'text-sky-300' : 'text-violet-400';
    const typeOverlayHtml = typeOverlaySvg
        ? `<div class="absolute inset-0 flex items-center justify-center"><div class="w-6 h-6 rounded-full bg-[#0f172a] flex items-center justify-center ${typeOverlayColorClass}">${typeOverlaySvg}</div></div>`
        : '';
    // SỬA (09/09/2026, hệ UI Theme) — icon box màu ĐI QUA `data-uitk` (accentIconBoxBg/Text, core/
    // ui-theme/light.js) THAY hardcode `bg-sky-100 text-sky-600` — badge tròn TỐI phủ giữa (loại
    // media song/video/photo) GIỮ NGUYÊN hardcode, KHÔNG qua theme (màu PHÂN LOẠI dữ liệu, không
    // phải màu giao diện — cùng tinh thần 3 màu thanh Storage Management giữ nguyên khi "xử lý
    // triệt để dark cũ").
    const iconBoxHtml = `<div class="relative w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" data-uitk="accentIconBoxBg accentIconBoxText">${folderIconSvg}${typeOverlayHtml}</div>`;

    if (isEditing) {
        return `
            <div class="generic-item-folder-tile-editing flex flex-col items-center gap-1.5 w-20" data-folder-id="${escapeHtml(folder.id)}">
                ${iconBoxHtml}
                <input type="text" value="${escapeHtml(folder.name)}" class="generic-folder-tile-rename-input w-full text-xs text-center border rounded-lg px-1 py-1 outline-none" data-uitk="textPrimary inputBorderFocus" />
            </div>
        `;
    }
    // MỚI (29/08/2026, phản hồi Giang mục 5 — "multi selection phải đánh số theo thứ tự") —
    // `ctx.selectedOrder` là Map<folderId, order> (Visual Background picker Thư mục multi-select,
    // xem event/workflow/playlist.js::_renderFolderPickerGrid()) — có giá trị -> viền xanh + badge
    // số ở góc; không có (null, hoặc id chưa được chọn) -> tile bình thường như trước.
    const order = ctx && ctx.selectedOrder ? ctx.selectedOrder.get(folder.id) : null;
    const selectedRingClass = order ? ' generic-item-folder-tile-selected' : '';
    const selectedBadgeHtml = order ? `<span class="generic-folder-tile-badge">${order}</span>` : '';
    return `
        <button type="button" class="generic-item-folder-tile select-none flex flex-col items-center gap-1.5 w-20${selectedRingClass}" data-folder-id="${escapeHtml(folder.id)}">
            <div class="generic-folder-tile-icon-wrap relative">${iconBoxHtml}${selectedBadgeHtml}</div>
            <span class="text-xs font-medium text-center leading-tight break-words" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;" data-uitk="textSecondaryStrong">${escapeHtml(folder.name)}</span>
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
            <div class="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border-2 border-dashed" data-uitk="cardBg textMutedIcon dashedBorder">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4" /></svg>
            </div>
            <span class="text-xs font-medium text-center" data-uitk="textSecondary">${t('fileManager.folderPicker.newTileLabel')}</span>
        </button>
    `;
}

/**
 * Wrapper CHUNG cho MỌI grid folder tile (Folder Browser List, Add to Folder picker, Thư mục VBG
 * picker — 3 nơi TÁI DÙNG `itemTemplateFolderTile()`/`buildAddFolderTileHtml()`, giờ tái dùng LUÔN
 * đúng 1 wrapper, tránh 2 chuỗi CSS trùng nhau dễ lệch khi sửa sau này).
 *
 * SỬA (06/09/2026, Giang chỉ ra bug tiếp — ảnh chụp màn Folder Browser List, khoảng trống thừa bên
 * phải khi hàng đầy, tile dồn hẳn về trái) — bản CŨ `flex flex-wrap justify-start gap-4` (đổi từ
 * `justify-center` hồi 14/07/2026, xem event/workflow/playlist.js) chỉ giải quyết ĐƯỢC 1 nửa: hàng
 * cuối chưa đầy thì đúng là căn trái (không bị "cả cụm" kéo về giữa), NHƯNG đổi lại các hàng ĐÃ ĐẦY
 * cũng bị dồn trái ln, để trống hẳn 1 dải bên phải nếu bề ngang khung KHÔNG chia hết cho
 * (width tile + gap) — Flexbox không có cách nào vừa "hàng đầy giãn đều 2 bên" vừa "hàng cuối lẻ
 * căn trái" CÙNG LÚC (`justify-between`/`justify-around` sẽ kéo luôn cả hàng lẻ dở dang ra giãn
 * đều, ngược lại đúng thứ Giang KHÔNG muốn).
 * FIX: đổi hẳn sang CSS Grid — `grid-template-columns: repeat(auto-fill, minmax(5rem, 1fr))` (số
 * cột tự tính theo bề ngang khung, mỗi cột tối thiểu 5rem = đúng bề ngang 1 tile `w-20` hiện có,
 * *co giãn thêm bằng `1fr` để lấp hết khoảng trống thừa* — trả lời đúng ý "chỉnh kích thước/gap để
 * tận dụng khoảng trống, giãn đều 2 bên"). `justify-items-center` canh tile (vẫn giữ nguyên `w-20`,
 * không đổi) vào GIỮA mỗi cột đã giãn rộng ra — trả lời đúng ý "icon folder ở giữa". Khác Flexbox,
 * Grid xếp item theo đúng cột/hàng CỐ ĐỊNH (`grid-auto-flow` mặc định `row`) — hàng cuối thiếu tile
 * tự nhiên chỉ chiếm các cột ĐẦU (trái), KHÔNG có khái niệm "giãn đều cả hàng lẻ" như Flexbox —
 * cùng lúc thoả cả 2 yêu cầu tưởng chừng ngược nhau ở trên mà không cần media query/breakpoint nào.
 *
 * SỬA (09/09/2026, Giang báo lại bug "mở Folder Browser LẦN ĐẦU trong phiên -> panel dư/hụt so với
 * nội dung thật (khoảng trống dưới), đóng-mở lại thì ĐÚNG" — bug từng fix ở lượt 14/07/2026
 * (event/workflow/playlist.js, height cố định '60vh' -> 'auto') nhưng đó là fix cho NGUYÊN NHÂN
 * KHÁC (panel không co theo nội dung); bug NÀY tái xuất hiện đúng từ lượt đổi Flexbox -> CSS Grid
 * ở CHÍNH hàm này (06/09/2026, ngay trên).
 * NGUYÊN NHÂN GỐC: Tailwind nạp qua CDN (`<script src="https://cdn.tailwindcss.com">`, index.html)
 * — bản CDN này tự quét DOM và TIÊM CSS cho class MỚI GẶP LẦN ĐẦU một cách BẤT ĐỒNG BỘ (qua
 * MutationObserver RIÊNG của chính nó, không đồng bộ với luồng JS của app). 2 class Tailwind ở
 * wrapper này — `grid-cols-[repeat(auto-fill,minmax(5rem,1fr))]` (trừu tượng) VÀ
 * `justify-items-center` — grep xác nhận CHỈ xuất hiện ĐÚNG 1 CHỖ NÀY trong toàn bộ app, nên CSS
 * thật của chúng CHƯA được Tailwind CDN tiêm kịp đúng lúc `_measureGenericDrawerNaturalHeightPx()`
 * (core/generic-drawer.js) đo chiều cao tự nhiên — hàm đó chạy ĐỒNG BỘ, NGAY SAU KHI gán `bodyHtml`
 * (cùng tick), tức là đo TRÚNG lúc div còn CHƯA thật sự là `display:grid` (trình duyệt rơi về
 * block mặc định, tile xếp dọc). Min-height của Generic Drawer chốt theo con số ĐO SAI đó; Tailwind
 * CDN tiêm CSS thật xong ngay sau (không đồng bộ với animation mở Drawer), nội dung tự co lại
 * ĐÚNG theo Grid thật — NGẮN hơn hẳn min-height đã chốt trước đó -> để lại khoảng trống dưới, đúng
 * triệu chứng Giang mô tả. Mở lại (CSS 2 class này Tailwind CDN đã tiêm sẵn vào <style> từ lượt
 * trước, không mất đi khi đóng Drawer) đo ĐÚNG ngay từ đầu -> hết bug, đúng cũng là triệu chứng.
 * FIX: 2 thuộc tính quyết định layout/kích thước (`display:grid`, `grid-template-columns`,
 * `justify-items`) chuyển hẳn qua `style` inline — trình duyệt áp dụng NGAY, không phụ thuộc
 * Tailwind CDN tiêm kịp hay chưa. CÙNG cách né mà `itemTemplateFolderTile()` (phía trên trong file
 * này) đã dùng cho `-webkit-line-clamp` (khác nhau ở NGUYÊN NHÂN — chỗ đó là CDN có thể THIẾU hẳn
 * plugin `line-clamp`, chỗ này là CDN có tiêm nhưng KHÔNG KỊP lúc đo — nhưng CÙNG cách né: CSS thật
 * nằm ngay trong `style`, không qua class phải chờ Tailwind sinh). `gap-4`/`p-5` GIỮ NGUYÊN dạng
 * class Tailwind — cả 2 đã dùng rộng rãi ở nhiều nơi khác trong app từ trước (CSS đã có sẵn trong
 * stylesheet Tailwind tiêm từ lúc app boot, không có nguy cơ tương tự).
 * @param {string} innerHtml - chuỗi HTML các tile (renderItemList() + buildAddFolderTileHtml() nối
 *        sẵn), hàm này CHỈ bọc wrapper, không tự dựng tile.
 * @returns {string}
 */
function buildFolderGridWrapperHtml(innerHtml) {
    return `<div class="gap-4 p-5" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(5rem, 1fr)); justify-items: center;">${innerHtml}</div>`;
}

/**
 * Dựng 1 danh sách item bằng cách gán `containerEl.innerHTML` (nếu có) **1 LẦN DUY NHẤT** (thay N
 * lần createElement+appendChild) — đủ mượt tới ~100-200 item trên mobile webview (xem docstring
 * đầu file). Hàm THUẦN, KHÔNG tự gắn sự kiện click — nơi gọi (Workflow) tự querySelector +
 * addEventListener SAU khi HTML đã vào DOM thật (xem event/workflow/playlist.js::
 * createFolderInPicker() cho ví dụ thật).
 * @param {HTMLElement|null} containerEl - truyền `null` nếu CHỈ cần chuỗi HTML trả về (vd để làm
 *        `bodyHtml` cho openGenericDrawer()/updateGenericDrawer() — nơi đó mới THẬT SỰ gán vào
 *        DOM, gán 2 lần là thừa).
 * @param {Array<Object>} items
 * @param {(item: Object, ctx?: Object) => string} templateFn
 * @param {Object} [ctx] - dữ liệu NGOÀI item dùng chung cho MỌI item (vd editingFolderId).
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

// ===================== ĐÃ GỠ (rewrite Photo/Album, Giang yêu cầu "không dùng window virtual tự tạo
// nữa, dùng thư viện thật") — computeVariableVirtualWindowRange()/itemTemplateImageGridRow() ========
// 2 hàm (bản trước ở đây) XOÁ HẲN — nguồn gốc hàng loạt bug layout/lệch cuộn đã gặp (tự tính offset/
// chiều cao hàng bằng tay). Lưới ảnh Photo giờ dùng event/workflow/photo-gallery-window.js:
// windowing cấp NHÓM NGÀY qua IntersectionObserver (trình duyệt tự lo, không tính tay) + fjGallery
// (thư viện thật, thuật toán Flickr/Google Photos) lo layout thật bên trong mỗi nhóm — tile ảnh giờ
// dựng bằng DOM node thật (createElement) NGAY trong file đó, không còn qua template chuỗi HTML ở
// đây nữa (badge chọn/xoá toggle TRỰC TIẾP trên node đã có, không cần render lại).

// XOÁ (loại bỏ Album khỏi Photo Panel) — itemTemplateAlbumListRow() (1 hàng trong Album List
// sub-panel) bỏ hẳn cùng tính năng — panel đó không còn tồn tại.
