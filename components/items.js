/**
 * components/items.js — template lưới Folder dùng chung (Folder Browser, picker "Thêm vào thư mục", picker "Thư mục" của
 * Visual Background) + `renderItemList()`. Chỉ trả chuỗi HTML, không gắn sự kiện (wiring:
 * core/file-manager/folder-picker-ui.js). Generic Drawer không biết "item" là gì, file này không biết "drawer" là gì —
 * Workflow nối 2 thứ.
 *
 * NẠP SAU: core/modal-choice-ui.js (escapeHtml), core/ui-theme/icon-svg-ui.js (iconSvg), lang/lang.js (t/tFormat),
 * components/generic-drawer.js (buildDrawerHeaderHtml), core/info-icon-ui.js (infoIconHtml), core/about-stats.js (formatBytes).
 */

/** Hình thư mục cho ô 56x56 (w-14 h-14) của folder tile, toạ độ px: tab bo tròn trên-trái (y 6..13), thân bo góc 6px
 * (y 13..52, x 2..54). Dùng chung cho clip-path của ô và nét viền chọn — sửa 1 chỗ, 2 nơi khớp nhau. */
const FOLDER_TILE_SHAPE_PATH = 'M2 12 Q2 6 8 6 L19 6 Q21.8 6 23.5 8.2 L25.5 10.8 Q27.2 13 30 13 L48 13 Q54 13 54 19 L54 46 Q54 52 48 52 L8 52 Q2 52 2 46 Z';

// Icon loại chồng giữa ô (màu phân loại cố định -500, đủ tương phản trên cả 3 theme). Folder chưa có type: không icon.
const FOLDER_TILE_TYPE_ICON = {
    song: { icon: 'music-note', colorClass: 'text-emerald-500' },
    video: { icon: 'video-camera', colorClass: 'text-violet-500' },
    photo: { icon: 'photograph', colorClass: 'text-sky-500' },
};

/**
 * Tile 1 folder: ô màu theme cắt hình thư mục (clip-path) + icon loại, tên bên dưới (tối đa 2 dòng, line-clamp inline).
 * 2 chế độ: bình thường (nút chạm/giữ tay) hoặc đang sửa tên (`ctx.editingFolderId === folder.id` — ô nhập, ngay sau khi
 * tạo folder mới). `ctx.selectedOrder` (Map<folderId, thứ tự>, picker chọn nhiều) -> viền + badge số thứ tự.
 * @param {{id: string, name: string, type?: 'song'|'video'|'photo'|null}} folder
 * @param {{editingFolderId?: string|null, selectedOrder?: Map<string, number>|null}} [ctx]
 * @returns {string}
 */
function itemTemplateFolderTile(folder, ctx) {
    const isEditing = !!(ctx && ctx.editingFolderId === folder.id);
    const typeIcon = FOLDER_TILE_TYPE_ICON[folder.type];
    const typeOverlayHtml = typeIcon
        ? `<div class="absolute inset-0 flex items-center justify-center pointer-events-none ${typeIcon.colorClass}" style="padding-top:9px">${iconSvg(typeIcon.icon, 'h-6 w-6')}</div>`
        : '';
    const iconBoxHtml = `<div class="relative w-14 h-14 shrink-0" style="clip-path:path('${FOLDER_TILE_SHAPE_PATH}');-webkit-clip-path:path('${FOLDER_TILE_SHAPE_PATH}')" data-uitk="accentIconBoxBg accentIconBoxText">${typeOverlayHtml}</div>`;

    if (isEditing) {
        return `
            <div class="generic-item-folder-tile-editing flex flex-col items-center gap-1.5 w-20" data-folder-id="${escapeHtml(folder.id)}">
                ${iconBoxHtml}
                <input type="text" value="${escapeHtml(folder.name)}" class="generic-folder-tile-rename-input w-full text-xs text-center border rounded-lg px-1 py-1 outline-none" data-uitk="textPrimary inputBorderFocus" />
            </div>
        `;
    }
    const order = ctx && ctx.selectedOrder ? ctx.selectedOrder.get(folder.id) : null;
    const selectedRingClass = order ? ' generic-item-folder-tile-selected' : '';
    const selectedBadgeHtml = order ? `<span class="generic-folder-tile-badge">${order}</span>` : '';
    // Viền chọn là SVG vẽ nét theo đúng hình thư mục, chồng ngoài ô (box-shadow bị clip-path cắt mất).
    const selectedRingHtml = order ? `<svg class="absolute inset-0 w-14 h-14 pointer-events-none" viewBox="0 0 56 56" fill="none"><path d="${FOLDER_TILE_SHAPE_PATH}" stroke="#0ea5e9" stroke-width="2.5" stroke-linejoin="round"/></svg>` : '';
    return `
        <button type="button" class="generic-item-folder-tile select-none flex flex-col items-center gap-1.5 w-20${selectedRingClass}" data-folder-id="${escapeHtml(folder.id)}">
            <div class="generic-folder-tile-icon-wrap relative">${iconBoxHtml}${selectedRingHtml}${selectedBadgeHtml}</div>
            <span class="text-xs font-medium text-center leading-tight break-words" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;" data-uitk="textSecondaryStrong">${escapeHtml(folder.name)}</span>
        </button>
    `;
}

/** Tile "Tạo folder mới" — cố định cuối lưới, không qua renderItemList() (là nút hành động, không phải 1 folder). */
function buildAddFolderTileHtml() {
    return `
        <button type="button" id="generic-folder-picker-add-tile" class="flex flex-col items-center gap-1.5 w-20">
            <div class="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border-2 border-dashed" data-uitk="cardBg textMutedIcon dashedBorder">
                ${iconSvg('plus', 'h-7 w-7')}
            </div>
            <span class="text-xs font-medium text-center" data-uitk="textSecondary">${t('fileManager.folderPicker.newTileLabel')}</span>
        </button>
    `;
}

/**
 * Wrapper chung cho mọi lưới folder tile. CSS Grid `repeat(auto-fill, minmax(5rem, 1fr))`: hàng đầy giãn đều, hàng cuối lẻ
 * căn trái, tile nằm giữa mỗi cột (Flexbox không làm được cả 2 cùng lúc). `display`/`grid-template-columns`/`justify-items`
 * để inline để có hiệu lực ngay lúc Generic Drawer đo chiều cao tự nhiên.
 * @param {string} innerHtml - các tile đã dựng sẵn
 * @returns {string}
 */
function buildFolderGridWrapperHtml(innerHtml) {
    return `<div class="gap-4 p-5" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(5rem, 1fr)); justify-items: center;">${innerHtml}</div>`;
}

/**
 * Thân modal đổi tên folder (`bodyHtml` của modalChoice()) — ô nhập rỗng; tên hiện tại do
 * core/file-manager/folder-picker-ui.js::fillRenameFolderModalInput() điền qua DOM (dữ liệu người dùng, không nội suy).
 * Nơi gọi: event/workflow/file-manager-folder-browser.js::renameFromTileMenu().
 * @returns {string}
 */
function renderRenameFolderModalBody() {
    return `<input id="rename-folder-input" type="text" class="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors" data-uitk="inputBg inputBorder inputText">`;
}

/**
 * Thân Drawer Folder Browser (màn List): lưới tile + ô "Tạo mới" + hàng phân trang `#folder-browser-pagination`
 * (core/pagination-ui.js::wirePaginationControls() tra id này). Nơi gọi:
 * event/workflow/file-manager-folder-browser.js::_renderList().
 * @param {string} itemsHtml - các tile (renderItemList()) @param {string} paginationHtml - workflowPagination.buildControlsHtml()
 * @returns {string}
 */
function buildFolderBrowserListBodyHtml(itemsHtml, paginationHtml) {
    return buildFolderGridWrapperHtml(`${itemsHtml}${buildAddFolderTileHtml()}`) + `<div id="folder-browser-pagination" class="px-3 pb-3">${paginationHtml}</div>`;
}

/**
 * Thân Drawer picker "Thêm vào thư mục" (dùng chung Playlist + Visual Background): danh sách rỗng, không có ô "Tạo mới" và
 * nơi gọi có câu báo rỗng -> hiện câu đó; còn lại -> lưới tile (+ ô "Tạo mới" nếu cho tạo).
 * Nơi gọi: event/workflow/playlist.js::_renderFolderPickerGrid().
 * @param {string} itemsHtml @param {boolean} showAddTile @param {string} emptyMsg - '' = không có câu báo rỗng
 * @param {boolean} isEmpty - danh sách folder rỗng
 * @returns {string}
 */
function buildFolderPickerBodyHtml(itemsHtml, showAddTile, emptyMsg, isEmpty) {
    const addTileHtml = showAddTile ? buildAddFolderTileHtml() : '';
    return (isEmpty && !showAddTile && emptyMsg)
        ? `<p class="text-sm text-center py-10 px-6" data-uitk="textSecondary">${emptyMsg}</p>`
        : buildFolderGridWrapperHtml(`${itemsHtml}${addTileHtml}`);
}

/**
 * Phần nút bên phải header picker "Thêm vào thư mục": dropdown đổi loại (`typeOptions`, Visual Background) + nút "Chọn (N)"
 * (multi-select) — cả 2 tuỳ chọn, không có thì chuỗi rỗng. Id cố định (core/file-manager/folder-picker-ui.js gắn sự kiện).
 * Nơi gọi: event/workflow/playlist.js::_buildFolderPickerHeaderHtml().
 * @param {{current: 'video'|'photo'}|null} typeOptions @param {boolean} multiSelect @param {number} confirmCount
 * @returns {string}
 */
function buildFolderPickerHeaderActionsHtml(typeOptions, multiSelect, confirmCount) {
    const typeDropdownHtml = typeOptions ? `
            <select id="playlist-folder-picker-type" class="rounded-lg px-2 py-1 text-xs outline-none" data-uitk="inputBg inputBorder inputText">
                <option value="video" ${typeOptions.current === 'video' ? 'selected' : ''}>${t('visualBgSettingsDrawer.folderPicker.typeVideo')}</option>
                <option value="photo" ${typeOptions.current === 'photo' ? 'selected' : ''}>${t('visualBgSettingsDrawer.folderPicker.typePhoto')}</option>
            </select>` : '';
    const confirmBtnHtml = multiSelect ? `
            <button type="button" id="playlist-folder-picker-confirm" class="text-xs font-semibold px-1 disabled:opacity-40 disabled:cursor-not-allowed" data-uitk="accentText" ${confirmCount === 0 ? 'disabled' : ''}>${confirmCount === 0 ? t('visualBgSettingsDrawer.picker.confirmEmpty') : tFormat('visualBgSettingsDrawer.picker.confirm', { count: confirmCount })}</button>` : '';
    return `<div class="flex items-center gap-2">${typeDropdownHtml}${confirmBtnHtml}</div>`;
}

/**
 * Header Generic Drawer của Folder Browser (màn List): tiêu đề + nút (i) giải thích (chạm = áp folder, giữ 1s = menu) + nút
 * đóng `#btn-generic-drawer-close`. Nơi gọi: event/workflow/file-manager-folder-browser.js::_renderList().
 * @returns {string}
 */
function buildFolderBrowserListHeaderHtml() {
    return buildDrawerHeaderHtml({ title: t('fileManager.folderBrowser.listTitle'), titleSuffixHtml: infoIconHtml(t('fileManager.folderBrowser.listInfo')) }); // components/generic-drawer.js
}

/**
 * Thân modal Thuộc tính folder: Contains/Size + 3 checkbox Read-only / Hidden / Apply filter (id cố định —
 * core/file-manager/folder-picker-ui.js::wireFolderPropertiesModalUi() gắn sự kiện). Nơi gọi:
 * event/workflow/file-manager-folder-browser.js::_showFolderProperties().
 * @param {string} countLabel - nhãn đã định dạng ("12 songs"…) @param {number} totalBytes
 * @param {{isReadOnly?: boolean, excludeFromMainPlaylist?: boolean, applyFilter?: boolean}} folderRecord
 * @returns {string}
 */
function buildFolderPropertiesBodyHtml(countLabel, totalBytes, folderRecord) {
    return `
        <div class="space-y-3">
            <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <span data-uitk="textSecondary">${t('fileManager.folderBrowser.tileMenu.propertiesContains')}</span><span class="font-medium" data-uitk="textPrimary">${escapeHtml(countLabel)}</span>
                <span data-uitk="textSecondary">${t('fileManager.folderBrowser.tileMenu.propertiesSize')}</span><span class="font-medium" data-uitk="textPrimary">${formatBytes(totalBytes)}</span>
            </div>
            <div class="border-t pt-3 space-y-2.5" data-uitk="dividerBorder">
                <label class="flex items-center gap-2.5 text-sm cursor-pointer" data-uitk="textPrimary">
                    <input type="checkbox" id="folder-properties-readonly-checkbox" class="w-4 h-4 rounded" data-uitk="accentControl"${folderRecord.isReadOnly ? ' checked' : ''}>
                    ${t('fileManager.folderBrowser.tileMenu.readOnlyLabel')}
                </label>
                <label class="flex items-center gap-2.5 text-sm cursor-pointer" data-uitk="textPrimary">
                    <input type="checkbox" id="folder-properties-hidden-checkbox" class="w-4 h-4 rounded" data-uitk="accentControl"${folderRecord.excludeFromMainPlaylist ? ' checked' : ''}>
                    ${t('fileManager.folderBrowser.tileMenu.hiddenLabel')}
                </label>
                <label class="flex items-center gap-2.5 text-sm cursor-pointer" data-uitk="textPrimary">
                    <input type="checkbox" id="folder-properties-applyfilter-checkbox" class="w-4 h-4 rounded" data-uitk="accentControl"${folderRecord.applyFilter !== false ? ' checked' : ''}>
                    ${t('fileManager.folderBrowser.tileMenu.applyFilterLabel')}
                </label>
            </div>
        </div>
    `;
}

/**
 * Nối chuỗi HTML của danh sách item theo `templateFn` (dùng làm `bodyHtml` của Generic Drawer).
 * @param {Array<Object>} items
 * @param {(item: Object, ctx?: Object) => string} templateFn
 * @param {Object} [ctx] - dữ liệu dùng chung cho mọi item (vd editingFolderId)
 * @returns {string}
 */
function renderItemList(items, templateFn, ctx) {
    return items.map((item) => templateFn(item, ctx)).join('');
}
