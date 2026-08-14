/**
 * Component: panel "Lọc" Playlist (mục 1d, phản hồi Giang) — 1 hàng PER FIELD (KHÔNG phải danh
 * sách điều kiện lặp lại tự do trên cùng 1 field — mỗi field có ĐÚNG 1 điều kiện, bật/tắt qua
 * checkbox riêng). Field theo ĐÚNG Nguồn (`source`, 'song'|'video') — song có 3 field text
 * (tên/album/nghệ sĩ), video chỉ có "tên"; cả 2 CÙNG 4 field số/ngày (ngày tải/số lần phát/tổng
 * thời gian nghe/dung lượng) — xem core/playlist/filter.js (PLAYLIST_FILTER_TEXT_FIELDS/
 * PLAYLIST_FILTER_NUMERIC_FIELDS, nguồn sự thật cho danh sách field hợp lệ theo Nguồn).
 *
 * Mọi điều kiện ĐANG BẬT kết hợp AND với nhau (mô phỏng SQL WHERE field1=x AND field2=y...) —
 * xem docstring đầu core/playlist/filter.js. Đồng bộ giá trị lúc mở panel qua
 * `workflowPlaylist.openFilterPanel()`/`_syncFilterPanelUI()` (event/workflow/playlist.js). Nút
 * "Áp dụng" LƯU BỀN + hỏi reload (KHÔNG áp ngay lập tức trong phiên) — xem
 * `workflowPlaylist.applyFilterChanges()`.
 *
 * QUY ƯỚC data-attribute (đọc bởi event/listener/playlist.js): MỌI control mang
 * `data-filter-field="<field>"` + `data-filter-prop="enabled|op|mode|value|valueTo"` — field/prop
 * đọc TRỰC TIẾP qua dataset, KHÔNG suy ra từ `id` (khối "đơn"/"range" của field số CÙNG dùng
 * `data-filter-prop="value"` nhưng khác `id` — id chỉ để CSS/debug, KHÔNG dùng để định danh nghiệp
 * vụ, tránh trùng id giữa 2 khối).
 *
 * NẠP SAU: core/playlist/filter.js (PLAYLIST_FILTER_TEXT_FIELDS — dùng để dựng đúng field theo
 * Nguồn khi renderPlaylistFilterPanelBody(source) được gọi).
 */

/** 1 hàng field TEXT (tên/album/nghệ sĩ) — checkbox bật + select toán tử (=, !=, Contains) + ô nhập. */
function _renderFilterTextFieldRow(field, labelKey) {
    return `
                        <div data-filter-row="${field}" class="flex flex-col p-4 border-b border-white/5 gap-2 transition-opacity">
                            <div class="flex justify-between items-center">
                                <span class="text-sm font-medium truncate" data-i18n="${labelKey}">${t(labelKey)}</span>
                                <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                    <input type="checkbox" data-filter-field="${field}" data-filter-prop="enabled" class="sr-only peer">
                                    <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                                </label>
                            </div>
                            <!-- FIX (bug — checkbox bị khoá theo cả row) — data-filter-body BỌC
                                 RIÊNG phần control bên dưới checkbox — CHỈ khối này bị mờ/khoá lúc
                                 field tắt (workflowPlaylist._syncFilterPanelUI()/setFilterField()),
                                 checkbox ở NGOÀI khối này nên luôn bấm lại được. -->
                            <div data-filter-body class="flex gap-2">
                                <select data-filter-field="${field}" data-filter-prop="op" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-28">
                                    <option value="===" data-i18n="playlistFilterPanel.op.eq">${t('playlistFilterPanel.op.eq')}</option>
                                    <option value="!==" data-i18n="playlistFilterPanel.op.neq">${t('playlistFilterPanel.op.neq')}</option>
                                    <option value="contains" data-i18n="playlistFilterPanel.op.contains">${t('playlistFilterPanel.op.contains')}</option>
                                    <option value="notContains" data-i18n="playlistFilterPanel.op.notContains">${t('playlistFilterPanel.op.notContains')}</option>
                                </select>
                                <input type="text" data-filter-field="${field}" data-filter-prop="value" class="flex-1 min-w-0 bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none">
                            </div>
                        </div>
`;
}

/** 1 hàng field SỐ/NGÀY (ngày tải/số lần phát/tổng thời gian/dung lượng) — checkbox bật + select
 * đơn-giá-trị↔range + (khối đơn: toán tử + 1 ô) hoặc (khối range: 2 ô "từ"/"đến"). `inputType`:
 * 'date' cho addedAt, 'number' (bước thập phân) cho size (MB)/count/totalTime. */
function _renderFilterNumericFieldRow(field, labelKey, inputType, step) {
    const stepAttr = step ? `step="${step}"` : '';
    return `
                        <div data-filter-row="${field}" class="flex flex-col p-4 border-b border-white/5 gap-2 transition-opacity">
                            <div class="flex justify-between items-center">
                                <span class="text-sm font-medium truncate" data-i18n="${labelKey}">${t(labelKey)}</span>
                                <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                    <input type="checkbox" data-filter-field="${field}" data-filter-prop="enabled" class="sr-only peer">
                                    <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                                </label>
                            </div>
                            <!-- FIX (bug — checkbox bị khoá theo cả row), CÙNG LÝ DO _renderFilterTextFieldRow() ở trên. -->
                            <div data-filter-body class="flex flex-col gap-2">
                                <select data-filter-field="${field}" data-filter-prop="mode" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-full">
                                    <option value="single" data-i18n="playlistFilterPanel.mode.single">${t('playlistFilterPanel.mode.single')}</option>
                                    <option value="range" data-i18n="playlistFilterPanel.mode.range">${t('playlistFilterPanel.mode.range')}</option>
                                </select>
                                <div data-filter-single-block class="flex gap-2">
                                    <select data-filter-field="${field}" data-filter-prop="op" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-24">
                                        <option value="===">=</option>
                                        <option value="!==">≠</option>
                                        <option value=">">&gt;</option>
                                        <option value="<">&lt;</option>
                                        <option value=">=">&ge;</option>
                                        <option value="<=">&le;</option>
                                    </select>
                                    <input type="${inputType}" ${stepAttr} data-filter-field="${field}" data-filter-prop="value" class="flex-1 min-w-0 bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none">
                                </div>
                                <div data-filter-range-block class="hidden flex gap-2 items-center">
                                    <input type="${inputType}" ${stepAttr} data-filter-field="${field}" data-filter-prop="value" class="flex-1 min-w-0 bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none" data-i18n-placeholder="playlistFilterPanel.rangeFrom" placeholder="${t('playlistFilterPanel.rangeFrom')}">
                                    <span class="text-slate-500 text-xs">–</span>
                                    <input type="${inputType}" ${stepAttr} data-filter-field="${field}" data-filter-prop="valueTo" class="flex-1 min-w-0 bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none" data-i18n-placeholder="playlistFilterPanel.rangeTo" placeholder="${t('playlistFilterPanel.rangeTo')}">
                                </div>
                            </div>
                        </div>
`;
}

/**
 * @param {string} source - 'song' | 'video' — quyết định field TEXT nào hiện (album/artist CHỈ
 *   Song có) — 4 field số/ngày dùng chung, KHÔNG đổi theo Nguồn.
 */
function renderPlaylistFilterPanelBody(source) {
    const textFields = source === 'video'
        ? [['name', 'playlistFilterPanel.field.name']]
        : [['name', 'playlistFilterPanel.field.name'], ['album', 'playlistFilterPanel.field.album'], ['artist', 'playlistFilterPanel.field.artist']];

    return `
                <div>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                        ${textFields.map(([field, labelKey]) => _renderFilterTextFieldRow(field, labelKey)).join('')}
                        ${_renderFilterNumericFieldRow('addedAt', 'playlistFilterPanel.field.addedAt', 'date')}
                        ${_renderFilterNumericFieldRow('count', 'playlistFilterPanel.field.count', 'number', '1')}
                        ${_renderFilterNumericFieldRow('totalTime', 'playlistFilterPanel.field.totalTime', 'number', '1')}
                        ${_renderFilterNumericFieldRow('duration', 'playlistFilterPanel.field.duration', 'number', '1')}
                        ${_renderFilterNumericFieldRow('size', 'playlistFilterPanel.field.size', 'number', '0.1')}
                    </div>
                    <button id="btn-playlist-filter-apply" class="mt-4 w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-sm font-semibold transition-colors" data-i18n="playlistFilterPanel.apply">${t('playlistFilterPanel.apply')}</button>
                    <div class="text-xs text-slate-400 mt-2 text-center" data-i18n="playlistFilterPanel.hint">${t('playlistFilterPanel.hint')}</div>
                </div>
`;
}
