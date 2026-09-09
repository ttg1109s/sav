/**
 * event/workflow/playlist-filter-presets.js — "THẰNG THỰC THI CUỐI" của router "playlistFilterPresets"
 * — hệ "Playlist Filter Presets", điều hướng qua `workflowAppSettings.navigateTo()`/`_render()`
 * (màn hình trong Settings, CÙNG khuôn Motion Preset List/Edit — event/workflow/motion-presets.js),
 * KHÔNG phải Generic Drawer riêng như EQ.
 *
 * TRƯỚC (bản cũ nhất, đã XOÁ — workflowPlaylist.openFilterPanel()/_syncFilterPanelUI()/
 * setFilterField()/applyFilterChanges()): Settings → Playlist → "Lọc" mở THẲNG 1 bộ rule sống
 * DUY NHẤT dùng chung mọi Nguồn, nút "Áp dụng" lưu bền + hỏi reload.
 *
 * (08/09/2026) VIẾT LẠI thành hệ preset đặt tên (list/edit/select/delete, mirror EQ/Motion) —
 * NHƯNG lúc đó vẫn 1 danh sách preset DÙNG CHUNG mọi Nguồn (preset ôm cả 3 bucket
 * {song,video,photo}), chỉ 1 preset active DUY NHẤT áp dụng cho MỌI Nguồn cùng lúc.
 *
 * SỬA LẦN CUỐI (09/09/2026, phản hồi Giang — "mỗi source media 1 list filter khác nhau + mỗi
 * source có filter active khác nhau", tham khảo mẫu `activePlayListFolder` — service/state/
 * file-manager.js: `{song, video, photo}`) — `playlistFilterPresets`/`playlistFilterActivePresetId`
 * (service/state/playlist.js) giờ là OBJECT keyed theo Nguồn — MỖI Nguồn có danh sách preset RIÊNG
 * + preset active RIÊNG, hoàn toàn ĐỘC LẬP nhau (chọn/sửa/xoá preset ở Song không đụng gì tới
 * Video/Photo). Preset KHÔNG còn ôm cả 3 bucket — `config` giờ CHÍNH LÀ bucket rule của ĐÚNG Nguồn
 * preset đó thuộc về (xem docstring core/playlist/filter-presets.js). Mọi method dưới đây vì vậy
 * đều cần biết "đang thao tác cho Nguồn nào" — 2 nguồn xác định Nguồn đó:
 *   - Màn DANH SÁCH (list) VÀ nút quick-select/quick-delete trên đó — LUÔN dùng
 *     `appState.activeMediaSource` HIỆN TẠI (danh sách chỉ hiện preset của ĐÚNG Nguồn đang chọn ở
 *     Settings → Playlist → "Nguồn").
 *   - Màn EDIT 1 preset — dùng `this._editingSource`, CHỐT NGAY lúc mở Edit (`tileClick()`/
 *     `createNew()`) — KHÔNG đọc lại `activeMediaSource` sau đó, tránh lệch nếu (hiếm) Nguồn đổi ở
 *     màn khác trong lúc đang mở Edit.
 *
 * Điều kiện filter CÓ hiệu lực trên Playlist thật, cho 1 Nguồn = CHỈ
 * `playlistFilterActivePresetId[source]` trỏ 1 preset còn tồn tại trong
 * `playlistFilterPresets[source]` (preset ĐANG active TỰ LÀ công tắc, không cần field riêng) —
 * quyết định `playlistFilterConfig[source]` SUY RA (`_recomputeLiveConfig()`, tính CẢ 3 Nguồn 1
 * lượt), đọc bởi `applyPlaylistFilter()`/`applyFolderScope()`/`applyAllSongsScope()`
 * (core/playlist/filter.js, event/workflow/playlist-scope.js) — 2 nơi đó KHÔNG đổi gì (đã sẵn đọc
 * theo `[mediaType]` như cũ).
 *
 * "Chọn áp dụng"/"Cập nhật" (list HOẶC màn Edit, CÙNG hành động `selectPreset()`; label đổi thành
 * "Cập nhật" khi preset đang sửa CHÍNH LÀ preset đang active CHO ĐÚNG NGUỒN ĐÓ — xem
 * `_renderPlaylistFilterEdit()` event/workflow/app-settings.js) — ghi
 * `playlistFilterActivePresetId[source]` rồi hỏi reload (tái dùng thẳng
 * `workflowPlaylistScope.askReloadToApplyNow()`, CÙNG modal Scope đã dùng — event/workflow/
 * playlist-scope.js). CHẶN bấm (mở `alertModal()` cảnh báo, KHÔNG áp gì cả) nếu preset chưa có
 * field rule hợp lệ nào — xem `hasValidPlaylistFilterField()` (core/playlist/filter-presets.js).
 *
 * Sửa field rule trong 1 preset — GHI THẲNG (live-commit) vào
 * `playlistFilterPresets[source][i].config` NGAY mỗi lần đổi (KHÔNG còn nút "Lưu" riêng, CÙNG khuôn
 * Motion Edit) — preset đó chỉ thật sự ảnh hưởng Playlist SAU KHI bấm "Chọn áp dụng"/"Cập nhật" +
 * reload — ĐÚNG luôn cho CẢ preset ĐANG active (xem đoạn "ảnh chốt" ngay dưới): sửa field của
 * preset đang active KHÔNG tự đổi filter thật đang chạy, dù đã lưu bền.
 *
 * "Ảnh chốt" (`playlistFilterAppliedConfig[source]`) — `_recomputeLiveConfig()` đọc TỪ ĐÂY (KHÔNG
 * đọc `preset.config` — bản đang sửa dở — trực tiếp). `selectPreset()` (nút "Chọn áp dụng"/"Cập
 * nhật") deep-clone `preset.config` NGAY LÚC BẤM vào `playlistFilterAppliedConfig[source]` — field
 * sửa sau đó vẫn lưu bền bình thường (thấy lại lúc mở Edit) nhưng KHÔNG ảnh hưởng filter thật cho
 * tới khi bấm "Chọn áp dụng"/"Cập nhật" LẦN NỮA (chụp ảnh chốt MỚI, CHỈ CHO NGUỒN ĐÓ).
 *
 * Xoá preset đang active (`_deletePresetById()`, CHO ĐÚNG NGUỒN, không đụng Nguồn khác) — TỰ ĐỘNG
 * gỡ filter khỏi Playlist (bỏ chọn + reset ảnh chốt + reload NGAY, không hỏi — xoá = nới kết quả
 * ra). XOÁ (09/09/2026, phản hồi Giang mục 1 — "loại bỏ cơ chế này") — đường tự-gỡ THỨ 2 (sửa
 * preset đang active xuống hết field hợp lệ rồi thoát Edit qua Back/Close mà KHÔNG bấm "Cập nhật"
 * → tự gỡ, qua cơ chế `workflowAppSettings._leaveGuard`/`autoUnapplyIfInvalid()`) ĐÃ BỎ HẲN — sửa
 * field (kể cả xuống hết field hợp lệ) không còn tự gỡ gì khi thoát nữa, CHỈ xoá hẳn preset hoặc
 * bấm "Chọn áp dụng"/"Cập nhật" mới thay đổi filter thật đang áp dụng.
 *
 * KHÔNG MIGRATE dữ liệu Filter của các bản trước (1-bộ-rule-sống trước 08/09, hay preset-dùng-
 * chung-mọi-Nguồn trước 09/09) — CHỐT Giang mỗi đợt "bắt đầu lại từ đầu" — field cũ mồ côi trong
 * DB, an toàn (không nơi nào còn đọc).
 *
 * NẠP SAU: core/playlist/filter-presets.js, core/playlist/filter.js (clonePlaylistFilterConfigDefaults()),
 * core/modal-choice-ui.js (alertModal()), components/playlist-filter-drawer.js, service/db.js
 * (getMeta/setMeta), event/workflow/app-settings.js (workflowAppSettings — liên tuyến domain),
 * event/workflow/playlist-scope.js (workflowPlaylistScope.askReloadToApplyNow() — liên tuyến domain).
 */
const workflowPlaylistFilterPresets = {
    _editingId: null,     // preset đang sửa (màn Edit) — null nếu không ở màn đó
    _editingSource: null, // Nguồn preset đang sửa thuộc về — CHỐT lúc mở Edit, xem docstring đầu file

    /** Gọi từ event/workflow/app-boot.js (qua workflowPlaylist.loadPersistedFilterConfigOnBoot() —
     * event/workflow/playlist.js, chỉ delegate thẳng sang đây) — đọc field từ meta, sanitize theo
     * TỪNG Nguồn, rồi tính lại playlistFilterConfig sống (cả 3 Nguồn). PHẢI chạy TRƯỚC khối Scope
     * (applyAllSongsScope()/applyFolderScope() đọc playlistFilterConfig để lọc playlistOrder). */
    async loadOnBoot() {
        const rawPresets = await getMeta('playlistFilterPresets');
        const presetsMap = sanitizePlaylistFilterPresetsMap(rawPresets); // core/playlist/filter-presets.js
        const rawActiveIdMap = await getMeta('playlistFilterActivePresetId');
        const activeIdMap = sanitizePlaylistFilterActiveIdMap(rawActiveIdMap, presetsMap); // core
        const rawApplied = await getMeta('playlistFilterAppliedConfig');
        const appliedConfig = (rawApplied && typeof rawApplied === 'object') ? { ...clonePlaylistFilterConfigDefaults(), ...rawApplied } : clonePlaylistFilterConfigDefaults();
        const rawAppliesToFolder = await getMeta('playlistFilterAppliesToFolder');
        const appliesToFolderMap = {
            song: typeof rawAppliesToFolder?.song === 'boolean' ? rawAppliesToFolder.song : true,
            video: typeof rawAppliesToFolder?.video === 'boolean' ? rawAppliesToFolder.video : true,
            photo: typeof rawAppliesToFolder?.photo === 'boolean' ? rawAppliesToFolder.photo : true,
        };

        appState.set('playlistFilterPresets', presetsMap);
        appState.set('playlistFilterActivePresetId', activeIdMap);
        appState.set('playlistFilterAppliedConfig', appliedConfig);
        appState.set('playlistFilterAppliesToFolder', appliesToFolderMap);
        console.log(`writer: "workflowPlaylistFilterPresets.loadOnBoot", page: "playlistFilterPresets", content: "song=${presetsMap.song.length}/video=${presetsMap.video.length}/photo=${presetsMap.photo.length} preset, active song=${activeIdMap.song}/video=${activeIdMap.video}/photo=${activeIdMap.photo}"`);
        this._recomputeLiveConfig();
    },

    /** Tính lại `playlistFilterConfig` (giá trị SỐNG, đọc bởi applyPlaylistFilter()) — CẢ 3 Nguồn 1
     * lượt, ĐỘC LẬP nhau. Gọi sau MỌI lần đổi playlistFilterActivePresetId/playlistFilterPresets/
     * playlistFilterAppliedConfig. KHÔNG tự render/reload gì ở đây (thuần tính state) — nơi gọi tự
     * lo phần đó theo đúng ngữ cảnh. */
    _recomputeLiveConfig() {
        const presetsMap = appState.get('playlistFilterPresets');
        const activeIdMap = appState.get('playlistFilterActivePresetId');
        const appliedMap = appState.get('playlistFilterAppliedConfig');
        const next = clonePlaylistFilterConfigDefaults();
        const summary = [];
        for (const source of ['song', 'video', 'photo']) {
            const hasValidActive = !!findPlaylistFilterPresetById(presetsMap[source], activeIdMap[source]); // core
            if (hasValidActive) next[source] = { ...next[source], ...appliedMap[source] };
            summary.push(`${source}=${hasValidActive ? 'ảnh chốt' : 'rỗng'}`);
        }
        appState.set('playlistFilterConfig', next);
        console.log(`writer: "workflowPlaylistFilterPresets._recomputeLiveConfig", page: "playlistFilterConfig", content: "${summary.join(', ')}"`);
    },

    async _persist() {
        await setMeta('playlistFilterPresets', appState.get('playlistFilterPresets'));
        await setMeta('playlistFilterActivePresetId', appState.get('playlistFilterActivePresetId'));
        await setMeta('playlistFilterAppliedConfig', appState.get('playlistFilterAppliedConfig'));
        await setMeta('playlistFilterAppliesToFolder', appState.get('playlistFilterAppliesToFolder'));
    },

    // ===================== Màn danh sách (theo activeMediaSource hiện tại) =====================

    /** Ứng nút "Lọc" (Settings → Playlist) — mở THẲNG danh sách preset CỦA Nguồn đang chọn
     * (KHÔNG còn công tắc tổng/nút "Quản lý" riêng). */
    openList() {
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderPlaylistFilterList()); // liên tuyến domain
    },

    /** Ứng tap 1 dòng trong danh sách — mở màn Edit preset đó, CHỐT `_editingSource` = Nguồn hiện
     * tại (danh sách chỉ hiện preset của Nguồn này).
     * @param {string} id */
    tileClick(id) {
        this._editingId = id;
        this._editingSource = appState.get('activeMediaSource');
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderPlaylistFilterEdit()); // liên tuyến domain
    },

    /** Nút "+" — tạo preset trắng CHO Nguồn đang chọn (mọi field rule null, tên tự sinh "New
     * filter"/"New filter 2"..., CÙNG khuôn addPreset() Motion), mở NGAY màn Edit. */
    async createNew() {
        const source = appState.get('activeMediaSource');
        const presetsMap = appState.get('playlistFilterPresets');
        const list = presetsMap[source];
        const preset = buildBlankPlaylistFilterPreset(tFormat('playlistFilterPresetsDrawer.defaultName', { n: list.length + 1 }), source); // core/playlist/filter-presets.js
        appState.set('playlistFilterPresets', { ...presetsMap, [source]: [...list, preset] });
        console.log(`writer: "createNew", page: "playlistFilterPresets", content: "[${source}] +${preset.id} \"${preset.name}\""`);
        await this._persist();
        this._editingId = preset.id;
        this._editingSource = source;
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderPlaylistFilterEdit()); // liên tuyến domain
    },

    /** Nút xoá nhanh trên 1 dòng danh sách — xoá thẳng, KHÔNG mở Edit trước, vẽ lại danh sách TẠI
     * CHỖ (CÙNG khuôn quickDelete() Motion).
     * @param {string} id */
    async quickDelete(id) {
        await this._deletePresetById(id, appState.get('activeMediaSource'));
        workflowAppSettings._renderPlaylistFilterList(); // liên tuyến domain — vẽ lại TẠI CHỖ
    },

    /** Nút chọn áp dụng nhanh trên 1 dòng danh sách — CÙNG hành động `selectPreset()` (xem dưới),
     * vẽ lại danh sách TẠI CHỖ để thấy chấm active đổi ngay (modal hỏi reload đứng ĐÈ LÊN TRÊN,
     * z-[130], không cần đợi vẽ lại xong).
     * @param {string} id */
    async quickSelect(id) {
        await this.selectPreset(id, appState.get('activeMediaSource'));
        workflowAppSettings._renderPlaylistFilterList(); // liên tuyến domain — vẽ lại TẠI CHỖ
    },

    // ===================== Màn Edit 1 preset (theo _editingSource đã chốt) =====================

    /** Đồng bộ toàn bộ field trong màn Edit theo `config` của preset đang sửa — gọi từ `onMount`
     * (event/workflow/app-settings.js::_renderPlaylistFilterEdit()) NGAY sau khi HTML vừa chèn
     * (component render RỖNG, KHÔNG tự bind giá trị — xem components/playlist-filter-drawer.js).
     * Dùng ĐÚNG data-attribute đã dựng (data-filter-row/data-filter-prop) để tìm input, KHÔNG
     * hard-code id từng field. */
    _syncEditUI() {
        const preset = findPlaylistFilterPresetById(appState.get('playlistFilterPresets')[this._editingSource], this._editingId); // core
        if (!preset) return;
        const rules = preset.config; // SỬA (09/09/2026) — TRƯỚC ĐÂY preset.config[source], giờ config CHÍNH LÀ bucket (preset đã thuộc riêng 1 Nguồn)
        // MỚI (phản hồi Giang — "totalTime/duration dùng time picker, h:m:s") — kind 'seconds' là
        // NÚT (`<button>`, data-filter-time-trigger), set `.textContent` qua `_formatSecondsAsHms()`
        // — KHÁC mọi kind khác (`<input>`, set `.value` qua `_formatFilterNumberForInput()`).
        const setDisplay = (el, kind, value) => {
            if (!el) return;
            if (kind === 'seconds') el.textContent = _formatSecondsAsHms(value); // core/playlist/filter.js
            else el.value = kind === 'text' ? (value || '') : _formatFilterNumberForInput(kind, value); // core/playlist/filter.js
        };
        for (const field of Object.keys(rules)) {
            const rule = rules[field];
            const rowEl = genericDrawerBody.querySelector(`[data-filter-row="${field}"]`);
            if (!rowEl) continue;
            const kind = _filterFieldKind(field); // core/playlist/filter.js
            const enableEl = rowEl.querySelector('[data-filter-prop="enabled"]');
            if (enableEl) enableEl.checked = !!rule;
            const bodyEl = rowEl.querySelector('[data-filter-body]');
            if (bodyEl) {
                bodyEl.classList.toggle('opacity-40', !rule);
                bodyEl.classList.toggle('pointer-events-none', !rule);
            }
            if (!rule) continue;
            const opEl = rowEl.querySelector('[data-filter-prop="op"]');
            if (opEl && rule.op !== undefined) opEl.value = rule.op;
            const modeEl = rowEl.querySelector('[data-filter-prop="mode"]');
            if (modeEl && rule.mode !== undefined) modeEl.value = rule.mode;
            const rangeBlock = rowEl.querySelector('[data-filter-range-block]');
            const singleBlock = rowEl.querySelector('[data-filter-single-block]');
            if (!rangeBlock && !singleBlock) {
                setDisplay(rowEl.querySelector('[data-filter-prop="value"]'), kind, rule.value);
                continue;
            }
            setDisplay(singleBlock && singleBlock.querySelector('[data-filter-prop="value"]'), kind, rule.value);
            setDisplay(rangeBlock && rangeBlock.querySelector('[data-filter-prop="value"]'), kind, rule.value);
            setDisplay(rangeBlock && rangeBlock.querySelector('[data-filter-prop="valueTo"]'), kind, rule.valueTo);
            if (rangeBlock && singleBlock && rule.mode !== undefined) {
                rangeBlock.classList.toggle('hidden', rule.mode === 'single');
                singleBlock.classList.toggle('hidden', rule.mode !== 'single');
            }
        }
    },

    /** Tên đang sửa (input "Name", commit lúc rời ô — CÙNG khuôn Motion `changeName()`, KHÁC EQ —
     * EQ gom tên vào `_draftName` chờ bấm Lưu chung, Playlist Filter KHÔNG còn nút Lưu nên commit
     * NGAY từng field độc lập).
     * @param {string} value */
    async setName(value) {
        const id = this._editingId, source = this._editingSource;
        const trimmed = value.trim();
        if (!trimmed) return; // guard — tên rỗng bỏ qua, giữ tên cũ (input tự hiện lại giá trị cũ lúc mở lại màn)
        const presetsMap = appState.get('playlistFilterPresets');
        const list = presetsMap[source].map((p) => (p.id === id ? { ...p, name: trimmed } : p));
        appState.set('playlistFilterPresets', { ...presetsMap, [source]: list });
        console.log(`writer: "setName", page: "playlistFilterPresets", content: "[${source}] ${id} -> \"${trimmed}\""`);
        await this._persist();
    },

    /** Checkbox vuông "Có áp dụng cho thư mục hay không" dưới hàng Name (MỚI 09/09/2026, phản hồi
     * Giang, mặc định BẬT) — live-commit vào `preset.appliesToFolder` NGAY (CÙNG khuôn setName()),
     * KHÔNG tự đổi hành vi Filter thật đang áp dụng (đã có ảnh chốt riêng, xem
     * `playlistFilterAppliesToFolder` — service/state/playlist.js) cho tới khi bấm lại "Chọn áp
     * dụng"/"Cập nhật".
     * @param {boolean} value */
    async setAppliesToFolder(value) {
        const id = this._editingId, source = this._editingSource;
        const presetsMap = appState.get('playlistFilterPresets');
        const list = presetsMap[source].map((p) => (p.id === id ? { ...p, appliesToFolder: value } : p));
        appState.set('playlistFilterPresets', { ...presetsMap, [source]: list });
        console.log(`writer: "setAppliesToFolder", page: "playlistFilterPresets", content: "[${source}] ${id} -> appliesToFolder=${value}"`);
        await this._persist();
    },

    /** Đổi 1 rule field của preset đang sửa — GHI THẲNG (live-commit) vào `config` (bucket trực
     * tiếp, KHÔNG còn index `[source]` — preset đã thuộc riêng 1 Nguồn) + toggle mờ/khoá
     * `data-filter-body`/hiện single-range block NGAY.
     * @param {string} field @param {string} prop @param {string|boolean} rawValue */
    async setFilterField(field, prop, rawValue) {
        const id = this._editingId, source = this._editingSource;
        const presetsMap = appState.get('playlistFilterPresets');
        const list = presetsMap[source];
        const preset = findPlaylistFilterPresetById(list, id); // core/playlist/filter-presets.js
        if (!preset) return; // guard — preset vừa bị xoá ở nơi khác giữa lúc đang sửa (hiếm, an toàn)
        const kind = _filterFieldKind(field); // core/playlist/filter.js
        const nextBucket = { ...preset.config };
        if (!(field in nextBucket)) return; // guard — field không thuộc Nguồn preset này (không nên xảy ra)
        if (prop === 'enabled') {
            nextBucket[field] = rawValue
                ? (kind === 'text' ? { op: '===', value: '' } : { mode: 'single', op: '===', value: 0, valueTo: 0 })
                : null;
        } else {
            const rule = nextBucket[field];
            if (!rule) return; // guard — field đang tắt, bỏ qua input ẩn
            if (prop === 'op') rule.op = rawValue;
            else if (prop === 'mode') rule.mode = rawValue;
            else if (prop === 'value') rule.value = kind === 'text' ? rawValue : _parseFilterNumberInput(kind, rawValue); // core/playlist/filter.js
            else if (prop === 'valueTo') rule.valueTo = _parseFilterNumberInput(kind, rawValue);
        }
        const nextList = list.map((p) => (p.id === id ? { ...p, config: nextBucket } : p));
        appState.set('playlistFilterPresets', { ...presetsMap, [source]: nextList });
        await this._persist();

        // Toggle mờ/khoá data-filter-body NGAY khi bật/tắt field — NGUYÊN VẸN hiệu ứng bản cũ.
        if (prop === 'enabled') {
            const rowEl = genericDrawerBody.querySelector(`[data-filter-row="${field}"]`);
            const bodyEl = rowEl && rowEl.querySelector('[data-filter-body]');
            if (bodyEl) {
                bodyEl.classList.toggle('opacity-40', !rawValue);
                bodyEl.classList.toggle('pointer-events-none', !rawValue);
            }
        }
        if (prop === 'mode') {
            const rowEl = genericDrawerBody.querySelector(`[data-filter-row="${field}"]`);
            if (rowEl) {
                const rangeBlock = rowEl.querySelector('[data-filter-range-block]');
                const singleBlock = rowEl.querySelector('[data-filter-single-block]');
                if (rangeBlock && singleBlock) {
                    rangeBlock.classList.toggle('hidden', rawValue === 'single');
                    singleBlock.classList.toggle('hidden', rawValue !== 'single');
                }
            }
        }
    },

    /** Ứng nút mở time-picker (field 'totalTime'/'duration', `data-filter-time-trigger` — xem
     * components/playlist-filter-drawer.js) — ĐỌC/GHI vào preset đang sửa (Nguồn `_editingSource`).
     * @param {string} field - 'totalTime' | 'duration' @param {string} prop - 'value' | 'valueTo' */
    openFilterTimePicker(field, prop) {
        const preset = findPlaylistFilterPresetById(appState.get('playlistFilterPresets')[this._editingSource], this._editingId); // core
        if (!preset) return;
        const rule = preset.config[field];
        if (!rule) return; // guard — field đang tắt (không nên xảy ra, nút bị pointer-events-none)
        const currentSeconds = (prop === 'valueTo' ? rule.valueTo : rule.value) || 0;
        openTimePickerModal({ // core/time-picker-modal.js
            title: t(field === 'totalTime' ? 'playlistFilterPanel.field.totalTime' : 'playlistFilterPanel.field.duration'),
            format: 'h-m-s',
            valueMs: currentSeconds * 1000,
            minMs: 0,
            maxMs: 359999000, // 99:59:59 — đủ lớn cho mọi giá trị thực tế (thời lượng video/tổng giờ nghe)
            onConfirm: (resultMs) => {
                const seconds = Math.round(resultMs / 1000);
                this.setFilterField(field, prop, String(seconds));
                const btn = genericDrawerBody.querySelector(`[data-filter-field="${field}"][data-filter-prop="${prop}"][data-filter-time-trigger]`);
                if (btn) btn.textContent = _formatSecondsAsHms(seconds); // core/playlist/filter.js
            },
        });
    },

    /** Nút "Chọn áp dụng"/"Cập nhật" (list HOẶC màn Edit) — preset `id` (CỦA Nguồn `source`) thành
     * preset ĐANG DÙNG CHO NGUỒN ĐÓ, CHỤP "ảnh chốt" (`playlistFilterAppliedConfig[source]` — deep
     * clone `preset.config` NGAY LÚC NÀY) rồi lưu bền + hỏi reload (tái dùng
     * workflowPlaylistScope.askReloadToApplyNow() — CÙNG modal Scope). Giữ NGUYÊN màn đang đứng sau
     * khi bấm (KHÔNG tự điều hướng đi đâu, CÙNG khuôn EQ _applyPreset() — có thể chỉnh tiếp rồi
     * Chọn áp dụng lại nhiều lần, MỖI LẦN bấm là 1 lần chụp ảnh chốt MỚI — "cập nhật"; sửa xong
     * KHÔNG bấm = field vẫn lưu trong preset nhưng filter thật đang chạy giữ NGUYÊN ảnh chốt CŨ).
     * Deep clone bằng JSON.parse(JSON.stringify()) chứ KHÔNG spread nông — `setFilterField()`
     * MUTATE trực tiếp object `rule` lồng bên trong (`rule.op = ...`), spread nông chỉ copy tầng
     * ngoài, tầng `rule` vẫn CHUNG reference — ảnh chốt sẽ ÂM THẦM đổi theo mọi lần sửa sau nếu
     * không deep-clone. `config` chỉ chứa dữ liệu thuần nên JSON round-trip an toàn.
     * CHẶN hẳn (mở `alertModal()` cảnh báo, KHÔNG ghi/reload gì cả) nếu preset KHÔNG có field rule
     * hợp lệ nào (`hasValidPlaylistFilterField()`, core/playlist/filter-presets.js — không field
     * nào bật, HOẶC field bật rồi mà chưa nhập dữ liệu, vd field text để trống).
     * @param {string} id @param {string} source - 'song'|'video'|'photo' — Nguồn preset `id` thuộc về */
    async selectPreset(id, source) {
        const preset = findPlaylistFilterPresetById(appState.get('playlistFilterPresets')[source], id); // core
        if (!preset) return;
        if (!hasValidPlaylistFilterField(preset.config)) { // core/playlist/filter-presets.js
            alertModal(t('playlistFilterPresetsDrawer.invalidWarning')); // core/modal-choice-ui.js
            return;
        }
        const activeIdMap = appState.get('playlistFilterActivePresetId');
        appState.set('playlistFilterActivePresetId', { ...activeIdMap, [source]: id });
        const appliedMap = appState.get('playlistFilterAppliedConfig');
        appState.set('playlistFilterAppliedConfig', { ...appliedMap, [source]: JSON.parse(JSON.stringify(preset.config)) });
        const appliesToFolderMap = appState.get('playlistFilterAppliesToFolder');
        appState.set('playlistFilterAppliesToFolder', { ...appliesToFolderMap, [source]: preset.appliesToFolder });
        console.log(`writer: "selectPreset", page: "playlistFilterActivePresetId", content: "[${source}] ${id} (\"${preset.name}\"), đã chụp ảnh chốt config + appliesToFolder=${preset.appliesToFolder}"`);
        this._recomputeLiveConfig();
        await this._persist();
        workflowPlaylistScope.askReloadToApplyNow(t('playlistFilterPresetsDrawer.reloadPrompt')); // liên tuyến domain, event/workflow/playlist-scope.js
    },

    /** Nút "Bỏ chọn" (list quick-action HOẶC màn Edit, CÙNG hành động — MỚI 09/09/2026, phản hồi
     * Giang — "với filter đang active, thay vì nút delete -> unselect") — CHỈ gỡ preset khỏi vai
     * trò active CHO NGUỒN `source` (bỏ chọn + reset ảnh chốt về rỗng + reload NGAY, không hỏi —
     * CÙNG lý do mọi hành động "gỡ" khác: nới kết quả ra, không cần xác nhận), KHÔNG xoá preset
     * khỏi danh sách — preset vẫn còn nguyên để chọn lại sau. KHÁC hẳn `deletePreset()`/
     * `_deletePresetById()` (xoá HẲN preset khỏi `playlistFilterPresets[source]`).
     * @param {string} source - 'song'|'video'|'photo' */
    async unselectPreset(source) {
        const activeIdMap = appState.get('playlistFilterActivePresetId');
        appState.set('playlistFilterActivePresetId', { ...activeIdMap, [source]: null });
        const appliedMap = appState.get('playlistFilterAppliedConfig');
        appState.set('playlistFilterAppliedConfig', { ...appliedMap, [source]: clonePlaylistFilterConfigDefaults()[source] });
        const appliesToFolderMap = appState.get('playlistFilterAppliesToFolder');
        appState.set('playlistFilterAppliesToFolder', { ...appliesToFolderMap, [source]: true }); // dọn về mặc định BẬT — không còn preset nào giữ ảnh chốt nữa
        console.log(`writer: "unselectPreset", page: "playlistFilterActivePresetId", content: "[${source}] null (bỏ chọn, KHÔNG xoá preset)"`);
        this._recomputeLiveConfig();
        await this._persist();
        window.location.reload();
    },

    /** Nút "Xoá" ở màn Edit — xoá preset đang sửa, quay lại danh sách.
     * @param {string} id */
    async deletePreset(id) {
        await this._deletePresetById(id, this._editingSource);
        workflowAppSettings._renderPlaylistFilterList(); // liên tuyến domain — thay Back thường (preset đã xoá, không còn gì để "sửa tiếp")
    },

    /** Dùng CHUNG cho quickDelete() (danh sách) VÀ deletePreset() (màn Edit) — xoá khỏi
     * `playlistFilterPresets[source]`; nếu ĐÚNG preset đang active CỦA NGUỒN ĐÓ thì tự bỏ chọn +
     * reload NGAY, không hỏi (bỏ preset đang active = nới kết quả ra, không cần xác nhận).
     * @param {string} id @param {string} source */
    async _deletePresetById(id, source) {
        const activeIdMap = appState.get('playlistFilterActivePresetId');
        const wasActive = activeIdMap[source] === id;
        const presetsMap = appState.get('playlistFilterPresets');
        const nextList = presetsMap[source].filter((p) => p.id !== id);
        appState.set('playlistFilterPresets', { ...presetsMap, [source]: nextList });
        if (this._editingId === id) { this._editingId = null; this._editingSource = null; }
        if (wasActive) {
            appState.set('playlistFilterActivePresetId', { ...activeIdMap, [source]: null });
            const appliedMap = appState.get('playlistFilterAppliedConfig');
            appState.set('playlistFilterAppliedConfig', { ...appliedMap, [source]: clonePlaylistFilterConfigDefaults()[source] }); // dọn ảnh chốt cũ CỦA NGUỒN NÀY — không còn preset nào giữ nó nữa
            const appliesToFolderMap = appState.get('playlistFilterAppliesToFolder');
            appState.set('playlistFilterAppliesToFolder', { ...appliesToFolderMap, [source]: true }); // dọn về mặc định BẬT — CÙNG lý do ảnh chốt config
        }
        console.log(`writer: "_deletePresetById", page: "playlistFilterPresets", content: "[${source}] -${id}${wasActive ? ' (đang active, tự bỏ chọn + dọn ảnh chốt)' : ''}"`);
        this._recomputeLiveConfig();
        await this._persist();
        if (wasActive) window.location.reload();
    },
};
