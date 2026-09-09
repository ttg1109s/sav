/**
 * Component: hệ "Playlist Filter Presets" (VIẾT LẠI 08/09/2026, phản hồi Giang — thay panel Lọc
 * 1-bộ-rule-sống bằng danh sách preset đặt tên, mirror components/motion-settings-drawer.js: danh
 * sách List <-> Edit 1 preset, dùng qua `workflowAppSettings.navigateTo()`, KHÔNG phải Generic
 * Drawer riêng như EQ). 2 hàm render chính:
 *   1. `renderPlaylistFilterListBody(presets, activeId)` — danh sách preset: tap dòng = sửa, MỖI
 *      dòng có thêm 2 nút riêng (chọn áp dụng + xoá nhanh) — KHÁC Motion (chỉ có xoá nhanh, "chọn
 *      áp dụng" nằm trong màn Edit) vì Giang yêu cầu rõ "chọn áp dụng" phải bấm được NGAY từ danh
 *      sách, không bắt buộc vào Edit trước.
 *   2. `renderPlaylistFilterEditBody(preset, source, isActive)` — sửa 1 preset: hàng "Name" (đầu,
 *      CÙNG khuôn EQ) + field rule theo ĐÚNG Nguồn hiện tại (`_renderFilterTextFieldRow()`/
 *      `_renderFilterNumericFieldRow()`, KHÔNG đổi — 1 hàng PER FIELD, mỗi field ĐÚNG 1 điều kiện,
 *      bật/tắt qua checkbox riêng) + 2 nút cuối "Chọn áp dụng"/"Cập nhật"/"Xoá" (CÙNG khuôn EQ
 *      `eq-drawer-apply`/`eq-drawer-delete` — chữ nút đầu đổi "Cập nhật" khi `isActive`, xem
 *      docstring hàm dưới). MỌI thay đổi field GHI THẲNG vào preset đang sửa NGAY (live-commit,
 *      KHÔNG còn nút "Lưu" riêng — xem workflowPlaylistFilterPresets.setFilterField()) — preset đó
 *      CHỈ thật sự ảnh hưởng Playlist khi bấm "Chọn áp dụng"/"Cập nhật" (ghi
 *      playlistFilterActivePresetId + hỏi reload).
 *
 * Field theo ĐÚNG Nguồn (`source`, 'song'|'video'|'photo') — song có 3 field text (tên/album/nghệ
 * sĩ), video/photo chỉ có "tên"+"album"; cả 3 CÙNG field số/ngày (ngày tải/số lần phát/dung lượng/
 * thời lượng, riêng "tổng thời gian nghe" CHỈ song/video) — xem docstring
 * renderPlaylistFilterEditBody() dưới + clonePlaylistFilterConfigDefaults() (service/state/
 * playlist.js, nguồn sự thật DUY NHẤT cho danh sách field hợp lệ theo Nguồn).
 *
 * Mọi điều kiện ĐANG BẬT trong 1 preset kết hợp AND với nhau (mô phỏng SQL WHERE field1=x AND
 * field2=y...) — xem docstring đầu core/playlist/filter.js.
 *
 * QUY ƯỚC data-attribute field rule (đọc bởi event/listener/playlist.js, KHÔNG đổi so với bản cũ):
 * MỌI control mang `data-filter-field="<field>"` + `data-filter-prop="enabled|op|mode|value|
 * valueTo"` — field/prop đọc TRỰC TIẾP qua dataset, KHÔNG suy ra từ `id` (khối "đơn"/"range" của
 * field số CÙNG dùng `data-filter-prop="value"` nhưng khác `id` — id chỉ để CSS/debug, KHÔNG dùng
 * để định danh nghiệp vụ, tránh trùng id giữa 2 khối).
 *
 * NẠP SAU: core/playlist/filter.js (danh sách field hợp lệ theo Nguồn, tham chiếu qua
 * clonePlaylistFilterConfigDefaults()).
 */

/** Danh sách preset — CÙNG khuôn renderMotionListBody() (components/motion-settings-drawer.js) +
 * thêm 1 nút "chọn áp dụng" riêng mỗi dòng (Motion không có, "Áp dụng cho" của Motion nằm trong màn
 * Edit — Playlist Filter cần bấm được NGAY từ danh sách, phản hồi Giang). Dòng đang active
 * (`p.id === activeId`) tô viền sky + chấm tròn, CÙNG khuôn renderEqListBody() (components/
 * eq-presets-drawer.js). `activeId` = `playlistFilterActivePresetId` hiện tại (KHÔNG còn gate qua
 * công tắc tổng — field đó đã bỏ, SỬA 09/09/2026, xem event/workflow/app-settings.js::
 * _renderPlaylistFilterList()), component không tự đọc appState (Rule 2).
 * SỬA (09/09/2026, phản hồi Giang — "với filter đang active, thay vì nút delete -> unselect") —
 * dòng ĐANG ACTIVE đổi nút xoá nhanh (`data-playlist-filter-quickdelete`) thành nút "bỏ chọn"
 * (`data-playlist-filter-quickunselect`, icon khác — dấu trừ trong vòng tròn, KHÔNG phải thùng rác)
 * — bỏ chọn CHỈ gỡ preset khỏi vai trò active (KHÔNG xoá hẳn preset, vẫn còn trong danh sách để
 * chọn lại sau) — xem workflowPlaylistFilterPresets.unselectPreset(). Dòng KHÔNG active vẫn xoá
 * nhanh như cũ.
 * @param {{id:string,name:string}[]} presets @param {string|null} activeId */
function renderPlaylistFilterListBody(presets, activeId) {
    const addRowHtml = `
        <button type="button" id="btn-playlist-filter-list-add" class="w-full text-center px-4 py-3.5 rounded-2xl mb-2 bg-sky-50 border border-sky-200 hover:bg-sky-100 transition-colors text-sm font-semibold text-sky-600" data-i18n="playlistFilterPresetsDrawer.list.add.label">${t('playlistFilterPresetsDrawer.list.add.label')}</button>
    `;
    if (presets.length === 0) {
        return addRowHtml + `<p class="text-sm text-slate-500 text-center py-10 px-6" data-i18n="playlistFilterPresetsDrawer.list.empty">${t('playlistFilterPresetsDrawer.list.empty')}</p>`;
    }
    const itemsHtml = presets.map((p) => {
        const isActive = p.id === activeId;
        const rowClass = isActive ? 'bg-sky-50 border border-sky-300' : 'bg-slate-50 border border-slate-200 hover:bg-slate-100';
        const secondButtonHtml = isActive
            ? `<button type="button" data-playlist-filter-quickunselect="${escapeHtml(p.id)}" class="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-colors" title="${t('playlistFilterPresetsDrawer.list.unselect.title')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 12H6" /></svg>
                </button>`
            : `<button type="button" data-playlist-filter-quickdelete="${escapeHtml(p.id)}" class="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors" title="${t('playlistFilterPresetsDrawer.list.delete.title')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>`;
        return `
        <div data-playlist-filter-tile="${escapeHtml(p.id)}" class="w-full text-left px-4 py-3.5 rounded-2xl mb-2 flex items-center justify-between gap-2 transition-colors cursor-pointer ${rowClass}">
            <span class="flex items-center gap-2 min-w-0">
                <span class="text-sm font-semibold text-slate-700 truncate">${escapeHtml(p.name)}</span>
                ${isActive ? `<span class="shrink-0 w-1.5 h-1.5 rounded-full bg-sky-500"></span>` : ''}
            </span>
            <span class="flex items-center gap-1 shrink-0">
                <button type="button" data-playlist-filter-quickselect="${escapeHtml(p.id)}" class="w-8 h-8 flex items-center justify-center rounded-full ${isActive ? 'text-sky-500' : 'text-slate-400 hover:text-sky-500 hover:bg-sky-50'} transition-colors" title="${t('playlistFilterPresetsDrawer.list.select.title')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                </button>
                ${secondButtonHtml}
            </span>
        </div>
    `;
    }).join('');
    return addRowHtml + itemsHtml;
}

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
                                 field tắt (workflowPlaylistFilterPresets._syncEditUI()/setFilterField()),
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
 * Sửa 1 preset — hàng "Name" (CÙNG khuôn EQ, `eq-drawer-name`) + field rule theo Nguồn + 2 nút cuối
 * (CÙNG khuôn `eq-drawer-apply`/`eq-drawer-delete`, KHÔNG còn nút "Áp dụng" đơn lẻ như bản cũ 1-bộ-
 * rule-sống — mọi field GHI THẲNG (live-commit) vào preset đang sửa, xem
 * workflowPlaylistFilterPresets.setFilterField(), "Chọn áp dụng" mới thật sự đẩy preset này lên
 * Playlist). SỬA (09/09/2026, phản hồi Giang — "với filter đang active, thay vì nút delete ->
 * unselect") — nút thứ 2 đổi thành "Bỏ chọn" (`#btn-playlist-filter-unselect`) khi `isActive` —
 * CHỈ gỡ preset khỏi vai trò active (không xoá hẳn preset), thay vì "Xoá" (`#btn-playlist-filter-
 * delete`) như preset không active.
 * @param {{id:string,name:string,config:object}} preset
 * @param {string} source - 'song' | 'video' | 'photo' — quyết định field TEXT nào hiện (album/
 *   artist — SỬA (Giang yêu cầu, "filter/search hỗ trợ field Album của video/photo") — `artist`
 *   VẪN CHỈ Song có (Video/Photo không có field này), `album` giờ CẢ 3 mediaType đều có (record.album,
 *   core/playlist/actions.js::applyVideoEditAndSave()/applyPhotoEditAndSave())) VÀ field SỐ/NGÀY
 *   nào hiện (totalTime KHÔNG áp dụng cho Photo — CHỐT Giang, ảnh không có khái niệm "lượt nghe";
 *   `duration` giờ áp dụng CẢ Photo — Photo đã có duration thật, xem event/workflow/file-manager-
 *   photo.js::computePhotoDuration()). Danh sách field PHẢI khớp ĐÚNG với
 *   `clonePlaylistFilterConfigDefaults()` (service/state/playlist.js) cho từng Nguồn — 2 nơi
 *   này KHÔNG import chéo (why-no-es6-module.md), phải tự đối chiếu tay khi sửa 1 trong 2.
 * @param {boolean} isActive - MỚI (09/09/2026, phản hồi Giang mục 1) — preset đang sửa CHÍNH LÀ
 *   preset đang active (`playlistFilterActivePresetId`) hay không — Workflow tự tính rồi truyền
 *   vào (Rule 2, component KHÔNG tự đọc appState). `true` -> nút đầu đổi chữ thành "Cập nhật"
 *   (`playlistFilterPresetsDrawer.update`) thay vì "Chọn áp dụng" (`.select`) — CÙNG 1 hành động
 *   `selectPreset()` phía sau (chụp ảnh chốt MỚI), chỉ đổi CHỮ cho đúng ngữ cảnh "đang active rồi,
 *   bấm lại = cập nhật" thay vì "chưa active, bấm để chọn".
 */
function renderPlaylistFilterEditBody(preset, source, isActive) {
    // SỬA (hợp nhất Photo vào Playlist) — THAY ternary nhị phân cũ (chỉ đúng khi source CHẮC CHẮN
    // là 'song' hoặc 'video') bằng bảng tra theo TỪNG source — ternary cũ sẽ ÂM THẦM gán field của
    // Song (album/artist) cho bất kỳ source thứ 3 nào lọt vào nhánh else, đúng bug đã phát hiện lúc
    // rà soát trước khi thêm Photo.
    // SỬA (Giang yêu cầu — field Album cho Video/Photo) — thêm 'album' vào 2 mảng video/photo
    // (TRƯỚC ĐÂY chỉ có 'name') — 'artist' VẪN không thêm (Video/Photo không có field này).
    const textFieldsBySource = {
        song: [['name', 'playlistFilterPanel.field.name'], ['album', 'playlistFilterPanel.field.album'], ['artist', 'playlistFilterPanel.field.artist']],
        video: [['name', 'playlistFilterPanel.field.name'], ['album', 'playlistFilterPanel.field.album']],
        photo: [['name', 'playlistFilterPanel.field.name'], ['album', 'playlistFilterPanel.field.album']],
    };
    const textFields = textFieldsBySource[source] || textFieldsBySource.song; // guard — source lạ rơi về Song (an toàn hơn rỗng)
    const isPhoto = source === 'photo';

    return `
                <div>
                    <div class="bg-slate-50 border border-slate-200 rounded-2xl px-4 flex items-center justify-between gap-3 mb-4">
                        <label for="playlist-filter-drawer-name" class="text-sm text-slate-500 shrink-0" data-i18n="playlistFilterPresetsDrawer.name.label">${t('playlistFilterPresetsDrawer.name.label')}</label>
                        <input type="text" id="playlist-filter-drawer-name" maxlength="24" value="${escapeHtml(preset.name)}" class="flex-1 min-w-0 bg-transparent text-right py-3 text-sm text-slate-900 outline-none">
                    </div>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                        ${textFields.map(([field, labelKey]) => _renderFilterTextFieldRow(field, labelKey)).join('')}
                        ${_renderFilterNumericFieldRow('addedAt', 'playlistFilterPanel.field.addedAt', 'date')}
                        ${_renderFilterNumericFieldRow('count', 'playlistFilterPanel.field.count', 'number', '1')}
                        ${isPhoto ? '' : _renderFilterNumericFieldRow('totalTime', 'playlistFilterPanel.field.totalTime', 'time-picker')}
                        <!-- SỬA (Giang yêu cầu — Photo tích hợp duration như Song/Video) — TRƯỚC ĐÂY
                             ẩn hẳn cho Photo (lúc đó duration hard-code 0) — giờ LUÔN hiện, khớp
                             cách Sort panel đã un-hide trước đó (components/playlist-sort-drawer.js). -->
                        ${_renderFilterNumericFieldRow('duration', 'playlistFilterPanel.field.duration', 'time-picker')}
                        ${_renderFilterNumericFieldRow('size', 'playlistFilterPanel.field.size', 'number', '0.1')}
                    </div>
                    <div class="flex gap-2 mt-4">
                        <button id="btn-playlist-filter-select" type="button" class="flex-1 py-3 rounded-2xl bg-sky-50 hover:bg-sky-100 transition-colors text-sky-600 text-sm font-medium" data-i18n="${isActive ? 'playlistFilterPresetsDrawer.update' : 'playlistFilterPresetsDrawer.select'}">${isActive ? t('playlistFilterPresetsDrawer.update') : t('playlistFilterPresetsDrawer.select')}</button>
                        <button id="${isActive ? 'btn-playlist-filter-unselect' : 'btn-playlist-filter-delete'}" type="button" class="flex-1 py-3 rounded-2xl ${isActive ? 'bg-amber-50 hover:bg-amber-100 text-amber-600' : 'bg-rose-50 hover:bg-rose-100 text-rose-600'} transition-colors text-sm font-medium" data-i18n="${isActive ? 'playlistFilterPresetsDrawer.unselect' : 'playlistFilterPresetsDrawer.delete'}">${isActive ? t('playlistFilterPresetsDrawer.unselect') : t('playlistFilterPresetsDrawer.delete')}</button>
                    </div>
                    <div class="text-xs text-slate-400 mt-2 text-center" data-i18n="playlistFilterPanel.hint">${t('playlistFilterPanel.hint')}</div>
                </div>
`;
}
