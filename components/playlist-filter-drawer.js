/**
 * components/playlist-filter-drawer.js — HTML (chuỗi thuần) cho Playlist Filter:
 *   - `renderPlaylistFilterListBody()` — danh sách preset của 1 Nguồn (Settings, workflowAppSettings.navigateTo()).
 *   - `renderPlaylistFilterEditBody()` — màn Edit 1 preset.
 *   - `buildFolderFilterEditBodyHtml()` — màn "Cài đặt filter" riêng của 1 folder.
 * Hai màn Edit dùng chung `_renderFilterFieldRowsHtml()`: 1 hàng/field, bật tắt bằng checkbox riêng; các điều kiện
 * đang bật kết hợp AND (core/playlist/filter.js). Control mang `data-filter-field` + `data-filter-prop`
 * (enabled|op|mode|value|valueTo — đọc qua dataset, không suy từ id); khối chứa mang `data-filter-owner`
 * (preset|folder) để delegate event/listener/playlist.js chọn router. Giá trị đổ sau bởi workflowFilterRuleEdit.syncUi().
 *
 * NẠP SAU: lang/lang.js (t()), core/modal-choice-ui.js (escapeHtml()).
 */

/** Danh sách preset: dòng active chỉ có nút "Bỏ chọn"; dòng khác có "Chọn áp dụng" + "Xoá". `presets` đã cắt đúng
 * trang, `paginationHtml` ('' khi tắt/1 trang) đặt trong `#playlist-filter-list-pagination` để Workflow wire.
 * @param {{id:string,name:string}[]} presets @param {string|null} activeId @param {string} [paginationHtml] */
function renderPlaylistFilterListBody(presets, activeId, paginationHtml) {
    const addRowHtml = `
        <button type="button" id="btn-playlist-filter-list-add" class="w-full text-center px-4 py-3.5 rounded-2xl mb-2 text-sm font-semibold" data-uitk="btnAccentSoft accentSoftBorder" data-i18n="playlistFilterPresetsDrawer.list.add.label">${t('playlistFilterPresetsDrawer.list.add.label')}</button>
    `;
    if (presets.length === 0) {
        return addRowHtml + `<p class="text-sm text-center py-10 px-6" data-uitk="textSecondary" data-i18n="playlistFilterPresetsDrawer.list.empty">${t('playlistFilterPresetsDrawer.list.empty')}</p>`;
    }
    const itemsHtml = presets.map((p) => {
        const isActive = p.id === activeId;
        const rowThemeKeys = isActive ? 'rowActiveBg rowActiveBorder' : 'cardBg cardBorder cardHoverBg';
        const actionsHtml = isActive
            ? `<button type="button" data-playlist-filter-quickunselect="${escapeHtml(p.id)}" class="w-8 h-8 flex items-center justify-center rounded-full" data-uitk="iconBtnCaution" title="${t('playlistFilterPresetsDrawer.list.unselect.title')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 12H6" /></svg>
                </button>`
            : `<button type="button" data-playlist-filter-quickselect="${escapeHtml(p.id)}" class="w-8 h-8 flex items-center justify-center rounded-full" data-uitk="iconBtnAccent" title="${t('playlistFilterPresetsDrawer.list.select.title')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                </button>
                <button type="button" data-playlist-filter-quickdelete="${escapeHtml(p.id)}" class="w-8 h-8 flex items-center justify-center rounded-full" data-uitk="iconBtnDestructive" title="${t('playlistFilterPresetsDrawer.list.delete.title')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>`;
        return `
        <div data-playlist-filter-tile="${escapeHtml(p.id)}" class="w-full text-left px-4 py-3.5 rounded-2xl mb-2 flex items-center justify-between gap-2 transition-colors cursor-pointer" data-uitk="${rowThemeKeys}">
            <span class="flex items-center gap-2 min-w-0">
                <span class="text-sm font-semibold truncate" data-uitk="textSecondaryStrong">${escapeHtml(p.name)}</span>
            </span>
            <span class="flex items-center gap-1 shrink-0">
                ${actionsHtml}
            </span>
        </div>
    `;
    }).join('');
    return addRowHtml + itemsHtml + `<div id="playlist-filter-list-pagination">${paginationHtml || ''}</div>`;
}

/** 1 hàng field TEXT (tên/album/nghệ sĩ) — checkbox bật + select toán tử (=, !=, Contains) + ô nhập. */
function _renderFilterTextFieldRow(field, labelKey) {
    return `
                        <div data-filter-row="${field}" class="flex flex-col p-4 gap-2 transition-opacity border-b" data-uitk="dividerBorder">
                            <div class="flex justify-between items-center">
                                <span class="text-sm font-medium truncate" data-i18n="${labelKey}">${t(labelKey)}</span>
                                <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                    <input type="checkbox" data-filter-field="${field}" data-filter-prop="enabled" class="sr-only peer">
                                    <div class="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all shadow-inner" data-uitk="toggleTrackOff toggleTrackOn"></div>
                                </label>
                            </div>
                            <!-- data-filter-body: chỉ khối này mờ/khoá khi field tắt; checkbox nằm ngoài nên luôn bấm được. -->
                            <div data-filter-body class="flex gap-2">
                                <select data-filter-field="${field}" data-filter-prop="op" class="rounded-lg px-2 py-1.5 text-xs outline-none w-28" data-uitk="inputBg inputBorder inputText">
                                    <option value="===" data-i18n="playlistFilterPanel.op.eq">${t('playlistFilterPanel.op.eq')}</option>
                                    <option value="!==" data-i18n="playlistFilterPanel.op.neq">${t('playlistFilterPanel.op.neq')}</option>
                                    <option value="contains" data-i18n="playlistFilterPanel.op.contains">${t('playlistFilterPanel.op.contains')}</option>
                                    <option value="notContains" data-i18n="playlistFilterPanel.op.notContains">${t('playlistFilterPanel.op.notContains')}</option>
                                </select>
                                <input type="text" data-filter-field="${field}" data-filter-prop="value" class="flex-1 min-w-0 rounded-lg px-3 py-1.5 text-xs outline-none" data-uitk="inputBg inputBorder inputText">
                            </div>
                        </div>
`;
}

/** 1 hàng field SỐ/NGÀY/GIÂY — checkbox bật + select single/range/outRange + khối single (toán tử + 1 ô) hoặc khối
 * range (từ/đến). `inputType`: 'date' | 'number' | 'time-picker' (ô giá trị là <button data-filter-time-trigger> mở
 * openTimePickerModal h:m:s thay vì <input>). */
function _renderFilterNumericFieldRow(field, labelKey, inputType, step) {
    const isTimePicker = inputType === 'time-picker';
    const stepAttr = step ? `step="${step}"` : '';
    const valueControl = (prop, placeholderKey) => isTimePicker
        ? `<button type="button" data-filter-field="${field}" data-filter-prop="${prop}" data-filter-time-trigger class="flex-1 min-w-0 rounded-lg px-3 py-1.5 text-xs text-left outline-none" data-uitk="inputBg inputBorder inputText">0:00:00</button>`
        : `<input type="${inputType}" ${stepAttr} data-filter-field="${field}" data-filter-prop="${prop}" class="flex-1 min-w-0 rounded-lg px-3 py-1.5 text-xs outline-none" data-uitk="inputBg inputBorder inputText"${placeholderKey ? ` data-i18n-placeholder="${placeholderKey}" placeholder="${t(placeholderKey)}"` : ''}>`;
    return `
                        <div data-filter-row="${field}" class="flex flex-col p-4 gap-2 transition-opacity border-b" data-uitk="dividerBorder">
                            <div class="flex justify-between items-center">
                                <span class="text-sm font-medium truncate" data-i18n="${labelKey}">${t(labelKey)}</span>
                                <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                    <input type="checkbox" data-filter-field="${field}" data-filter-prop="enabled" class="sr-only peer">
                                    <div class="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all shadow-inner" data-uitk="toggleTrackOff toggleTrackOn"></div>
                                </label>
                            </div>
                            <div data-filter-body class="flex flex-col gap-2">
                                <select data-filter-field="${field}" data-filter-prop="mode" class="rounded-lg px-2 py-1.5 text-xs outline-none w-full" data-uitk="inputBg inputBorder inputText">
                                    <option value="single" data-i18n="playlistFilterPanel.mode.single">${t('playlistFilterPanel.mode.single')}</option>
                                    <option value="range" data-i18n="playlistFilterPanel.mode.range">${t('playlistFilterPanel.mode.range')}</option>
                                    <option value="outRange" data-i18n="playlistFilterPanel.mode.outRange">${t('playlistFilterPanel.mode.outRange')}</option>
                                </select>
                                <div data-filter-single-block class="flex gap-2">
                                    <select data-filter-field="${field}" data-filter-prop="op" class="rounded-lg px-2 py-1.5 text-xs outline-none w-24" data-uitk="inputBg inputBorder inputText">
                                        <option value="===">=</option>
                                        <option value="!==">≠</option>
                                        <option value=">">&gt;</option>
                                        <option value="<">&lt;</option>
                                        <option value=">=">&ge;</option>
                                        <option value="<=">&le;</option>
                                    </select>
                                    ${valueControl('value')}
                                </div>
                                <div data-filter-range-block class="hidden flex gap-2 items-center">
                                    ${valueControl('value', isTimePicker ? null : 'playlistFilterPanel.rangeFrom')}
                                    <span class="text-xs" data-uitk="textSecondary">–</span>
                                    ${valueControl('valueTo', isTimePicker ? null : 'playlistFilterPanel.rangeTo')}
                                </div>
                            </div>
                        </div>
`;
}

/**
 * Toàn bộ hàng field rule theo Nguồn — dùng chung màn Edit preset và màn "Cài đặt filter" của folder. Danh sách
 * field PHẢI khớp `clonePlaylistFilterConfigDefaults()` (service/state/playlist.js) — tự đối chiếu khi sửa.
 * `artist` chỉ Song có; totalTime: Song "Listen time", Video/Photo "Watch time" (chỉ khác nhãn).
 * @param {'song'|'video'|'photo'} source
 * @returns {string}
 */
function _renderFilterFieldRowsHtml(source) {
    const textFieldsBySource = {
        song: [['name', 'playlistFilterPanel.field.name'], ['album', 'playlistFilterPanel.field.album'], ['artist', 'playlistFilterPanel.field.artist']],
        video: [['name', 'playlistFilterPanel.field.name'], ['album', 'playlistFilterPanel.field.album']],
        photo: [['name', 'playlistFilterPanel.field.name'], ['album', 'playlistFilterPanel.field.album']],
    };
    const textFields = textFieldsBySource[source] || textFieldsBySource.song; // source lạ rơi về Song
    const totalTimeLabelKey = source === 'song' ? 'playlistFilterPanel.field.totalTime' : 'playlistFilterPanel.field.viewDuration';
    return `
                        ${textFields.map(([field, labelKey]) => _renderFilterTextFieldRow(field, labelKey)).join('')}
                        ${_renderFilterNumericFieldRow('addedAt', 'playlistFilterPanel.field.addedAt', 'date')}
                        ${_renderFilterNumericFieldRow('count', 'playlistFilterPanel.field.count', 'number', '1')}
                        ${_renderFilterNumericFieldRow('totalTime', totalTimeLabelKey, 'time-picker')}
                        ${_renderFilterNumericFieldRow('duration', 'playlistFilterPanel.field.duration', 'time-picker')}
                        ${_renderFilterNumericFieldRow('size', 'playlistFilterPanel.field.size', 'number', '0.1')}`;
}

/**
 * Body màn Edit 1 preset: Name, checkbox "Có áp dụng cho thư mục", các hàng field rule (`data-filter-owner="preset"`
 * — delegate event/listener/playlist.js gửi về router 'playlistFilterPresets'), nút Chọn áp dụng|Cập nhật + Xoá|Bỏ chọn.
 * @param {{id:string,name:string,config:object,appliesToFolder:boolean}} preset
 * @param {'song'|'video'|'photo'} source
 * @param {boolean} isActive - preset đang active của Nguồn này -> nút đầu "Cập nhật", nút sau "Bỏ chọn".
 */
function renderPlaylistFilterEditBody(preset, source, isActive) {
    return `
                <div>
                    <div class="rounded-2xl px-4 flex items-center justify-between gap-3 mb-4" data-uitk="cardBg cardBorder">
                        <label for="playlist-filter-drawer-name" class="text-sm shrink-0" data-uitk="textSecondary" data-i18n="playlistFilterPresetsDrawer.name.label">${t('playlistFilterPresetsDrawer.name.label')}</label>
                        <input type="text" id="playlist-filter-drawer-name" maxlength="24" value="${escapeHtml(preset.name)}" class="flex-1 min-w-0 bg-transparent border-0 text-right py-3 text-sm outline-none focus:ring-0" data-uitk="textPrimary">
                    </div>
                    <!-- Tắt = preset chỉ áp ở view "Tất cả", không áp khi đang xem 1 thư mục (playlist-scope.js::applyFolderScope()). -->
                    <label class="flex items-center gap-2.5 text-sm cursor-pointer mb-4 px-1" data-uitk="textSecondaryStrong">
                        <input type="checkbox" id="playlist-filter-drawer-appliestofolder" class="w-4 h-4 rounded shrink-0" data-uitk="accentControl"${preset.appliesToFolder ? ' checked' : ''}>
                        <span data-i18n="playlistFilterPresetsDrawer.appliesToFolder.label">${t('playlistFilterPresetsDrawer.appliesToFolder.label')}</span>
                    </label>
                    <div class="rounded-2xl flex flex-col overflow-hidden" data-filter-owner="preset" data-uitk="cardBg cardBorder">${_renderFilterFieldRowsHtml(source)}
                    </div>
                    <div class="flex gap-2 mt-4">
                        <button id="btn-playlist-filter-select" type="button" class="flex-1 py-3 rounded-2xl text-sm font-medium" data-uitk="btnAccentSoft" data-i18n="${isActive ? 'playlistFilterPresetsDrawer.update' : 'playlistFilterPresetsDrawer.select'}">${isActive ? t('playlistFilterPresetsDrawer.update') : t('playlistFilterPresetsDrawer.select')}</button>
                        <button id="${isActive ? 'btn-playlist-filter-unselect' : 'btn-playlist-filter-delete'}" type="button" class="flex-1 py-3 rounded-2xl text-sm font-medium" data-uitk="${isActive ? 'btnCautionSoft' : 'btnDestructiveSoft'}" data-i18n="${isActive ? 'playlistFilterPresetsDrawer.unselect' : 'playlistFilterPresetsDrawer.delete'}">${isActive ? t('playlistFilterPresetsDrawer.unselect') : t('playlistFilterPresetsDrawer.delete')}</button>
                    </div>
                    <div class="text-xs mt-2 text-center" data-uitk="textSecondary" data-i18n="playlistFilterPanel.hint">${t('playlistFilterPanel.hint')}</div>
                </div>
`;
}

/**
 * MỚI (07/10/2026, Giang chốt dời khỏi Workflow) — header màn "Cài đặt filter" riêng của 1 folder: nút Back
 * `#btn-folder-filter-edit-back` + tiêu đề + nút Áp dụng `#btn-folder-filter-edit-apply` (core/file-manager/folder-picker-ui.js
 * ::wireFolderFilterEditUi() gắn sự kiện). Trước đây là workflowFileManagerFolderBrowser._buildFilterEditHeaderHtml().
 * @returns {string}
 */
function buildFolderFilterEditHeaderHtml() {
    return `
        <div class="flex justify-between items-center gap-2 px-5 pb-3" data-uitk="headerBorder">
            <button id="btn-folder-filter-edit-back" class="w-8 h-8 flex items-center justify-center rounded-full transition-colors shrink-0" data-uitk="headerCloseHover headerCloseIcon" title="${t('common.back')}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h3 class="text-base font-bold truncate flex-1 text-center" data-uitk="headerTitle">${t('fileManager.folderBrowser.tileMenu.filterSettings')}</h3>
            <button id="btn-folder-filter-edit-apply" type="button" class="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold" data-uitk="btnPrimaryBg btnPrimaryHoverBg textOnAccent">${t('common.apply')}</button>
        </div>
    `;
}

/**
 * Body màn "Cài đặt filter" riêng của 1 folder (Generic Drawer, event/workflow/file-manager-folder-browser.js::
 * filterFromTileMenu()) — chỉ các hàng field rule (`data-filter-owner="folder"`), nút Áp dụng ở header. Drawer đã
 * tự cuộn (bodyClass overflow-y-auto), không bọc scroll riêng.
 * Giá trị rule được đổ sau bởi workflowFilterRuleEdit.syncUi().
 * @param {'song'|'video'|'photo'} mediaType
 * @returns {string}
 */
function buildFolderFilterEditBodyHtml(mediaType) {
    return `
        <div class="rounded-2xl flex flex-col overflow-hidden" data-filter-owner="folder" data-uitk="cardBg cardBorder">${_renderFilterFieldRowsHtml(mediaType)}
        </div>
`;
}

