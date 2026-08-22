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

/** 1 hàng field SỐ/NGÀY/GIÂY (ngày tải/số lần phát/tổng thời gian/thời lượng/dung lượng) —
 * checkbox bật + select đơn-giá-trị↔range + (khối đơn: toán tử + 1 ô) hoặc (khối range: 2 ô
 * "từ"/"đến"). `inputType`: 'date' cho addedAt, 'number' (bước thập phân) cho size (MB)/count,
 * 'time-picker' cho totalTime/duration — Ô GIÁ TRỊ là NÚT mở `openTimePickerModal()` (format
 * h:m:s, core/time-picker-modal.js) thay vì `<input>` thô, SỬA (phản hồi Giang — "totalTime/
 * duration phải dùng time picker, định dạng h:m:s như item") — nút mang `data-filter-time-trigger`
 * để event/listener/playlist.js phân biệt (click -> mở modal, KHÔNG dispatch value trực tiếp như
 * input thường). */
function _renderFilterNumericFieldRow(field, labelKey, inputType, step) {
    const isTimePicker = inputType === 'time-picker';
    const stepAttr = step ? `step="${step}"` : '';
    const valueControl = (prop, placeholderKey) => isTimePicker
        ? `<button type="button" data-filter-field="${field}" data-filter-prop="${prop}" data-filter-time-trigger class="flex-1 min-w-0 bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white text-left outline-none">0:00:00</button>`
        : `<input type="${inputType}" ${stepAttr} data-filter-field="${field}" data-filter-prop="${prop}" class="flex-1 min-w-0 bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none"${placeholderKey ? ` data-i18n-placeholder="${placeholderKey}" placeholder="${t(placeholderKey)}"` : ''}>`;
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
                                    <option value="outRange" data-i18n="playlistFilterPanel.mode.outRange">${t('playlistFilterPanel.mode.outRange')}</option>
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
                                    ${valueControl('value')}
                                </div>
                                <div data-filter-range-block class="hidden flex gap-2 items-center">
                                    ${valueControl('value', isTimePicker ? null : 'playlistFilterPanel.rangeFrom')}
                                    <span class="text-slate-500 text-xs">–</span>
                                    ${valueControl('valueTo', isTimePicker ? null : 'playlistFilterPanel.rangeTo')}
                                </div>
                            </div>
                        </div>
`;
}

/**
 * @param {string} source - 'song' | 'video' | 'photo' — quyết định field TEXT nào hiện (album/
 *   artist CHỈ Song có) VÀ field SỐ/NGÀY nào hiện (totalTime/duration KHÔNG áp dụng cho Photo —
 *   CHỐT Giang, ảnh không có khái niệm "lượt nghe"/"thời lượng"). Danh sách field PHẢI khớp ĐÚNG
 *   với `clonePlaylistFilterConfigDefaults()` (service/state/playlist.js) cho từng Nguồn — 2 nơi
 *   này KHÔNG import chéo (why-no-es6-module.md), phải tự đối chiếu tay khi sửa 1 trong 2.
 */
function renderPlaylistFilterPanelBody(source) {
    // SỬA (hợp nhất Photo vào Playlist) — THAY ternary nhị phân cũ (chỉ đúng khi source CHẮC CHẮN
    // là 'song' hoặc 'video') bằng bảng tra theo TỪNG source — ternary cũ sẽ ÂM THẦM gán field của
    // Song (album/artist) cho bất kỳ source thứ 3 nào lọt vào nhánh else, đúng bug đã phát hiện lúc
    // rà soát trước khi thêm Photo.
    const textFieldsBySource = {
        song: [['name', 'playlistFilterPanel.field.name'], ['album', 'playlistFilterPanel.field.album'], ['artist', 'playlistFilterPanel.field.artist']],
        video: [['name', 'playlistFilterPanel.field.name']],
        photo: [['name', 'playlistFilterPanel.field.name']],
    };
    const textFields = textFieldsBySource[source] || textFieldsBySource.song; // guard — source lạ rơi về Song (an toàn hơn rỗng)
    const isPhoto = source === 'photo';

    return `
                <div>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                        ${textFields.map(([field, labelKey]) => _renderFilterTextFieldRow(field, labelKey)).join('')}
                        ${_renderFilterNumericFieldRow('addedAt', 'playlistFilterPanel.field.addedAt', 'date')}
                        ${_renderFilterNumericFieldRow('count', 'playlistFilterPanel.field.count', 'number', '1')}
                        ${isPhoto ? '' : _renderFilterNumericFieldRow('totalTime', 'playlistFilterPanel.field.totalTime', 'time-picker')}
                        ${isPhoto ? '' : _renderFilterNumericFieldRow('duration', 'playlistFilterPanel.field.duration', 'time-picker')}
                        ${_renderFilterNumericFieldRow('size', 'playlistFilterPanel.field.size', 'number', '0.1')}
                    </div>
                    <button id="btn-playlist-filter-apply" class="mt-4 w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-sm font-semibold transition-colors" data-i18n="playlistFilterPanel.apply">${t('playlistFilterPanel.apply')}</button>
                    <div class="text-xs text-slate-400 mt-2 text-center" data-i18n="playlistFilterPanel.hint">${t('playlistFilterPanel.hint')}</div>
                </div>
`;
}
