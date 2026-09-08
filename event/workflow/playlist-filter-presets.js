/**
 * event/workflow/playlist-filter-presets.js — "THẰNG THỰC THI CUỐI" của router "playlistFilterPresets"
 * — hệ "Playlist Filter Presets" (VIẾT LẠI 08/09/2026, phản hồi Giang), điều hướng qua
 * `workflowAppSettings.navigateTo()`/`_render()` (màn hình trong Settings, CÙNG khuôn Motion Preset
 * List/Edit — event/workflow/motion-presets.js), KHÔNG phải Generic Drawer riêng như EQ.
 *
 * TRƯỚC (bản cũ, đã XOÁ — workflowPlaylist.openFilterPanel()/_syncFilterPanelUI()/setFilterField()/
 * applyFilterChanges()): Settings → Playlist → "Lọc" mở THẲNG 1 bộ rule sống DUY NHẤT
 * (`playlistFilterConfig`), nút "Áp dụng" lưu bền + hỏi reload.
 *
 * SAU: Settings → Playlist → "Lọc" là 1 NÚT DUY NHẤT (SỬA 09/09/2026, phản hồi Giang — "bỏ toggle,
 * bỏ manage filter, chỉ giữ Filter để vào nơi quản lý", RÚT GỌN lại bản 08/09 từng thêm công tắc
 * tổng + nút "Quản lý bộ lọc" riêng) mở THẲNG danh sách preset (mirror EQ/Motion — tap dòng = sửa,
 * mỗi dòng có thêm nút xoá nhanh + chọn áp dụng nhanh, xem components/playlist-filter-drawer.js::
 * renderPlaylistFilterListBody()). KHÔNG còn công tắc tổng riêng (`playlistFilterEnabled` ĐÃ XOÁ) —
 * điều kiện filter CÓ hiệu lực trên Playlist thật = CHỈ `playlistFilterActivePresetId` trỏ 1 preset
 * còn tồn tại (preset ĐANG active TỰ LÀ công tắc, không cần field riêng) — quyết định
 * `playlistFilterConfig` SUY RA (`_recomputeLiveConfig()`), đọc bởi `applyPlaylistFilter()`/
 * `applyFolderScope()`/`applyAllSongsScope()` (core/playlist/filter.js, event/workflow/
 * playlist-scope.js) — 2 nơi đó KHÔNG đổi gì.
 *
 * "Chọn áp dụng"/"Cập nhật" (list HOẶC màn Edit, CÙNG hành động `selectPreset()`; label đổi thành
 * "Cập nhật" khi preset đang sửa CHÍNH LÀ preset đang active — SỬA 09/09/2026, xem
 * `_renderPlaylistFilterEdit()` event/workflow/app-settings.js) — ghi `playlistFilterActivePresetId`
 * rồi hỏi reload (tái dùng thẳng `workflowPlaylistScope.askReloadToApplyNow()`, CÙNG modal Scope đã
 * dùng — event/workflow/playlist-scope.js) — CÙNG UX bản cũ (lưu bền + hỏi reload, không áp ngay
 * trong phiên). CHẶN bấm (mở `alertModal()` cảnh báo, KHÔNG áp gì cả) nếu preset chưa có field rule
 * hợp lệ nào cho Nguồn đang xem — xem `hasValidPlaylistFilterField()` (core/playlist/
 * filter-presets.js) + docstring `selectPreset()` dưới (phản hồi Giang mục 3a).
 *
 * Sửa field rule trong 1 preset — GHI THẲNG (live-commit) vào `playlistFilterPresets[_editingId]`
 * NGAY mỗi lần đổi (KHÔNG còn nút "Lưu" riêng, CÙNG khuôn Motion Edit) — preset đó chỉ thật sự ảnh
 * hưởng Playlist SAU KHI bấm "Chọn áp dụng"/"Cập nhật" + reload, sửa preset KHÁC preset đang active
 * không ảnh hưởng gì tới danh sách đang hiển thị (giống hệt EQ — sửa preset không active không ảnh
 * hưởng âm thanh đang phát) — QUAN TRỌNG, câu này ĐÚNG luôn cho CẢ preset ĐANG active (xem đoạn "ảnh
 * chốt" ngay dưới): sửa field của preset đang active KHÔNG tự đổi filter thật đang chạy, dù đã lưu
 * bền.
 *
 * "Ảnh chốt" (`playlistFilterAppliedConfig`) — `_recomputeLiveConfig()` đọc TỪ ĐÂY (KHÔNG đọc
 * `playlistFilterPresets[activeId].config` — bản đang sửa dở — trực tiếp). `selectPreset()` (nút
 * "Chọn áp dụng"/"Cập nhật") deep-clone `preset.config` NGAY LÚC BẤM vào field này — field sửa sau
 * đó (kể cả của preset đang active) vẫn lưu bền bình thường (thấy lại lúc mở Edit) nhưng KHÔNG ảnh
 * hưởng filter thật cho tới khi bấm "Chọn áp dụng"/"Cập nhật" LẦN NỮA (chụp ảnh chốt MỚI).
 *
 * MỚI (09/09/2026, phản hồi Giang mục 3b — "sửa preset đang chọn: xoá -> tự gỡ; hết field hợp lệ mà
 * thoát X/Back -> tự gỡ") — 2 đường TỰ ĐỘNG gỡ filter khỏi Playlist, cho ĐÚNG preset đang active:
 *   1. Xoá preset đang active (`_deletePresetById()`) — ĐÃ CÓ SẴN từ trước, không đổi gì thêm.
 *   2. Sửa preset đang active tới mức KHÔNG còn field hợp lệ nào (`hasValidPlaylistFilterField()`
 *      trả `false`), rồi rời màn Edit qua nút Back/Close (X) MÀ KHÔNG bấm "Cập nhật" trước — GỌI
 *      `autoUnapplyIfInvalid()` (xem hàm đó) qua móc `workflowAppSettings._leaveGuard` (MỚI, gắn ở
 *      `_renderPlaylistFilterEdit()`, tự chạy 1 lần đúng lúc Back/Close, xem docstring 2 hàm đó ở
 *      event/workflow/app-settings.js) — tự bỏ chọn preset + reset ảnh chốt + reload NGAY, không
 *      hỏi (CÙNG lý do bỏ preset = nới kết quả ra, không cần xác nhận).
 *
 * KHÔNG MIGRATE `meta.playlistFilterConfig` cũ (bản 1-bộ-rule-sống trước 08/09/2026) — CHỐT Giang
 * (mục 2, đợt này) "bắt đầu lại từ đầu, không cần giữ rule cũ" — field đó giờ MỒ CÔI trong DB, an
 * toàn (chỉ đọc lúc boot bản cũ, giờ không nơi nào đọc nữa).
 *
 * NẠP SAU: core/playlist/filter-presets.js, core/playlist/filter.js (clonePlaylistFilterConfigDefaults()),
 * core/modal-choice-ui.js (alertModal()), components/playlist-filter-drawer.js, service/db.js
 * (getMeta/setMeta), event/workflow/app-settings.js (workflowAppSettings — liên tuyến domain),
 * event/workflow/playlist-scope.js (workflowPlaylistScope.askReloadToApplyNow() — liên tuyến domain).
 */
const workflowPlaylistFilterPresets = {
    _editingId: null, // preset đang sửa (màn Edit) — null nếu không ở màn đó

    /** Gọi từ event/workflow/app-boot.js (THAY workflowPlaylist.loadPersistedFilterConfigOnBoot()
     * cũ — xem hàm đó, event/workflow/playlist.js, giờ chỉ delegate thẳng sang đây) — đọc field MỚI
     * từ meta, sanitize, rồi tính lại playlistFilterConfig sống. PHẢI chạy TRƯỚC khối Scope
     * (applyAllSongsScope()/applyFolderScope() đọc playlistFilterConfig để lọc playlistOrder). */
    async loadOnBoot() {
        const rawPresets = await getMeta('playlistFilterPresets');
        const presets = sanitizePlaylistFilterPresets(rawPresets); // core/playlist/filter-presets.js
        const rawActiveId = await getMeta('playlistFilterActivePresetId');
        const activeId = (typeof rawActiveId === 'string' && findPlaylistFilterPresetById(presets, rawActiveId)) ? rawActiveId : null; // core
        const rawApplied = await getMeta('playlistFilterAppliedConfig');
        const appliedConfig = (rawApplied && typeof rawApplied === 'object') ? { ...clonePlaylistFilterConfigDefaults(), ...rawApplied } : clonePlaylistFilterConfigDefaults();

        appState.set('playlistFilterPresets', presets);
        appState.set('playlistFilterActivePresetId', activeId);
        appState.set('playlistFilterAppliedConfig', appliedConfig);
        console.log(`writer: "workflowPlaylistFilterPresets.loadOnBoot", page: "playlistFilterPresets", content: "${presets.length} preset, active=${activeId}"`);
        this._recomputeLiveConfig();
    },

    /** Tính lại `playlistFilterConfig` (giá trị SỐNG, đọc bởi applyPlaylistFilter()) — gọi sau MỌI
     * lần đổi activePresetId/playlistFilterAppliedConfig. KHÔNG tự render/reload gì ở đây (thuần
     * tính state) — nơi gọi tự lo phần đó theo đúng ngữ cảnh. Đọc `playlistFilterAppliedConfig`
     * (ảnh chốt lúc `selectPreset()` chạy lần gần nhất) — HOÀN TOÀN không phụ thuộc `preset.config`
     * hiện tại — chỉ cần biết activeId CÓ còn trỏ tới 1 preset hợp lệ hay không (preset bị xoá thì
     * coi như mất active, rơi về rỗng) — KHÔNG cần đọc nội dung preset đó. */
    _recomputeLiveConfig() {
        const activeId = appState.get('playlistFilterActivePresetId');
        const hasValidActive = !!findPlaylistFilterPresetById(appState.get('playlistFilterPresets'), activeId); // core
        const applied = appState.get('playlistFilterAppliedConfig');
        appState.set('playlistFilterConfig', hasValidActive ? { ...clonePlaylistFilterConfigDefaults(), ...applied } : clonePlaylistFilterConfigDefaults());
        console.log(`writer: "workflowPlaylistFilterPresets._recomputeLiveConfig", page: "playlistFilterConfig", content: "${hasValidActive ? 'từ playlistFilterAppliedConfig (ảnh chốt lần Áp dụng gần nhất)' : 'rỗng (chưa chọn preset)'}"`);
    },

    async _persist() {
        await setMeta('playlistFilterPresets', appState.get('playlistFilterPresets'));
        await setMeta('playlistFilterActivePresetId', appState.get('playlistFilterActivePresetId'));
        await setMeta('playlistFilterAppliedConfig', appState.get('playlistFilterAppliedConfig'));
    },

    // ===================== Màn danh sách =====================

    /** Ứng nút "Lọc" (Settings → Playlist) — mở THẲNG danh sách preset (KHÔNG còn công tắc tổng/nút
     * "Quản lý" riêng — SỬA 09/09/2026, xem docstring đầu file). */
    openList() {
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderPlaylistFilterList()); // liên tuyến domain
    },

    /** Ứng tap 1 dòng trong danh sách — mở màn Edit preset đó.
     * @param {string} id */
    tileClick(id) {
        this._editingId = id;
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderPlaylistFilterEdit()); // liên tuyến domain
    },

    /** Nút "+" — tạo preset trắng (mọi field rule null, tên tự sinh "New filter"/"New filter 2"...,
     * CÙNG khuôn addPreset() Motion), mở NGAY màn Edit. */
    async createNew() {
        const presets = appState.get('playlistFilterPresets');
        const preset = buildBlankPlaylistFilterPreset(tFormat('playlistFilterPresetsDrawer.defaultName', { n: presets.length + 1 })); // core/playlist/filter-presets.js
        appState.set('playlistFilterPresets', [...presets, preset]);
        console.log(`writer: "createNew", page: "playlistFilterPresets", content: "+${preset.id} \"${preset.name}\""`);
        await this._persist();
        this._editingId = preset.id;
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderPlaylistFilterEdit()); // liên tuyến domain
    },

    /** Nút xoá nhanh trên 1 dòng danh sách — xoá thẳng, KHÔNG mở Edit trước, vẽ lại danh sách TẠI
     * CHỖ (CÙNG khuôn quickDelete() Motion).
     * @param {string} id */
    async quickDelete(id) {
        await this._deletePresetById(id);
        workflowAppSettings._renderPlaylistFilterList(); // liên tuyến domain — vẽ lại TẠI CHỖ
    },

    /** Nút chọn áp dụng nhanh trên 1 dòng danh sách — CÙNG hành động `selectPreset()` (xem dưới),
     * vẽ lại danh sách TẠI CHỖ để thấy chấm active đổi ngay (modal hỏi reload đứng ĐÈ LÊN TRÊN,
     * z-[130], không cần đợi vẽ lại xong).
     * @param {string} id */
    async quickSelect(id) {
        await this.selectPreset(id);
        workflowAppSettings._renderPlaylistFilterList(); // liên tuyến domain — vẽ lại TẠI CHỖ
    },

    // ===================== Màn Edit 1 preset =====================

    /** Đồng bộ toàn bộ field trong màn Edit theo `config[source]` của preset đang sửa — gọi từ
     * `onMount` (event/workflow/app-settings.js::_renderPlaylistFilterEdit()) NGAY sau khi HTML vừa
     * chèn (component render RỖNG, KHÔNG tự bind giá trị — xem components/playlist-filter-
     * drawer.js). PORT từ `workflowPlaylist._syncFilterPanelUI()` bản cũ (ĐÃ XOÁ), CHỈ đổi nguồn đọc
     * từ `playlistFilterConfig[source]` sống sang `preset.config[source]`. Dùng ĐÚNG data-attribute
     * đã dựng (data-filter-row/data-filter-prop) để tìm input, KHÔNG hard-code id từng field. */
    _syncEditUI() {
        const preset = findPlaylistFilterPresetById(appState.get('playlistFilterPresets'), this._editingId); // core
        if (!preset) return;
        const source = appState.get('activeMediaSource');
        const rules = preset.config[source];
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
        const id = this._editingId;
        const trimmed = value.trim();
        if (!trimmed) return; // guard — tên rỗng bỏ qua, giữ tên cũ (input tự hiện lại giá trị cũ lúc mở lại màn)
        const presets = appState.get('playlistFilterPresets').map((p) => (p.id === id ? { ...p, name: trimmed } : p));
        appState.set('playlistFilterPresets', presets);
        console.log(`writer: "setName", page: "playlistFilterPresets", content: "${id} -> \"${trimmed}\""`);
        await this._persist();
    },

    /** Đổi 1 rule field của preset đang sửa — GHI THẲNG (live-commit, mirror
     * workflowPlaylist.setFilterField() bản cũ NHƯNG ghi vào preset đang sửa thay vì
     * playlistFilterConfig sống trực tiếp) + toggle mờ/khoá `data-filter-body`/hiện single-range
     * block NGAY, CÙNG hiệu ứng UI bản cũ.
     * @param {string} field @param {string} prop @param {string|boolean} rawValue */
    async setFilterField(field, prop, rawValue) {
        const id = this._editingId;
        const preset = findPlaylistFilterPresetById(appState.get('playlistFilterPresets'), id); // core/playlist/filter-presets.js
        if (!preset) return; // guard — preset vừa bị xoá ở nơi khác giữa lúc đang sửa (hiếm, an toàn)
        const source = appState.get('activeMediaSource');
        const kind = _filterFieldKind(field); // core/playlist/filter.js
        const nextConfig = { ...preset.config, [source]: { ...preset.config[source] } };
        const bucket = nextConfig[source];
        if (!(field in bucket)) return; // guard — field không thuộc Nguồn hiện tại
        if (prop === 'enabled') {
            bucket[field] = rawValue
                ? (kind === 'text' ? { op: '===', value: '' } : { mode: 'single', op: '===', value: 0, valueTo: 0 })
                : null;
        } else {
            const rule = bucket[field];
            if (!rule) return; // guard — field đang tắt, bỏ qua input ẩn
            if (prop === 'op') rule.op = rawValue;
            else if (prop === 'mode') rule.mode = rawValue;
            else if (prop === 'value') rule.value = kind === 'text' ? rawValue : _parseFilterNumberInput(kind, rawValue); // core/playlist/filter.js
            else if (prop === 'valueTo') rule.valueTo = _parseFilterNumberInput(kind, rawValue);
        }
        const presets = appState.get('playlistFilterPresets').map((p) => (p.id === id ? { ...p, config: nextConfig } : p));
        appState.set('playlistFilterPresets', presets);
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
     * components/playlist-filter-drawer.js) — mirror workflowPlaylist.openFilterTimePicker() bản
     * cũ, ĐỌC/GHI vào preset đang sửa thay vì playlistFilterConfig sống trực tiếp.
     * @param {string} field - 'totalTime' | 'duration' @param {string} prop - 'value' | 'valueTo' */
    openFilterTimePicker(field, prop) {
        const preset = findPlaylistFilterPresetById(appState.get('playlistFilterPresets'), this._editingId); // core
        if (!preset) return;
        const source = appState.get('activeMediaSource');
        const rule = preset.config[source][field];
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

    /** Nút "Chọn áp dụng"/"Cập nhật" (list HOẶC màn Edit) — preset `id` thành preset ĐANG DÙNG,
     * CHỤP "ảnh chốt" (`playlistFilterAppliedConfig` — deep clone `preset.config` NGAY LÚC NÀY, xem
     * docstring field đó ở service/state/playlist.js) rồi lưu bền + hỏi reload (tái dùng
     * workflowPlaylistScope.askReloadToApplyNow() — CÙNG modal Scope). Giữ NGUYÊN màn đang đứng sau
     * khi bấm (KHÔNG tự điều hướng đi đâu, CÙNG khuôn EQ _applyPreset() — có thể chỉnh tiếp rồi
     * Chọn áp dụng lại nhiều lần, MỖI LẦN bấm là 1 lần chụp ảnh chốt MỚI — "cập nhật" ĐÚNG như Giang
     * yêu cầu: bấm lại = cập nhật; sửa xong KHÔNG bấm = field vẫn lưu trong preset (thấy lại lúc mở
     * Edit) nhưng filter thật đang chạy giữ NGUYÊN ảnh chốt CŨ, không tự đổi theo).
     * SỬA (09/09/2026) — deep clone bằng JSON.parse(JSON.stringify()) chứ KHÔNG spread nông
     * ({...config}/{...config[source]}) — `setFilterField()` MUTATE trực tiếp object `rule` lồng
     * bên trong (`rule.op = ...`), spread nông chỉ copy tầng ngoài, tầng `rule` vẫn CHUNG reference
     * — ảnh chốt sẽ ÂM THẦM đổi theo mọi lần sửa sau nếu không deep-clone, phá hỏng toàn bộ mục
     * đích tách biệt của field này. `config` chỉ chứa dữ liệu thuần (string/number/boolean/null/
     * object lồng) nên JSON round-trip an toàn, không mất field nào.
     * MỚI (09/09/2026, phản hồi Giang mục 3a) — CHẶN hẳn nếu preset KHÔNG có field rule hợp lệ nào
     * cho Nguồn đang xem (`hasValidPlaylistFilterField()`, core/playlist/filter-presets.js — không
     * field nào bật, HOẶC field bật rồi mà chưa nhập dữ liệu, vd field text để trống) — mở
     * `alertModal()` (core/modal-choice-ui.js) cảnh báo, KHÔNG ghi/reload gì cả, `return` NGAY.
     * @param {string} id */
    async selectPreset(id) {
        const preset = findPlaylistFilterPresetById(appState.get('playlistFilterPresets'), id); // core
        if (!preset) return;
        const source = appState.get('activeMediaSource');
        if (!hasValidPlaylistFilterField(preset.config[source])) { // core/playlist/filter-presets.js
            alertModal(t('playlistFilterPresetsDrawer.invalidWarning')); // core/modal-choice-ui.js
            return;
        }
        appState.set('playlistFilterActivePresetId', id);
        appState.set('playlistFilterAppliedConfig', JSON.parse(JSON.stringify(preset.config)));
        console.log(`writer: "selectPreset", page: "playlistFilterActivePresetId", content: "${id} (\"${preset.name}\"), đã chụp ảnh chốt config"`);
        this._recomputeLiveConfig();
        await this._persist();
        workflowPlaylistScope.askReloadToApplyNow(t('playlistFilterPresetsDrawer.reloadPrompt')); // liên tuyến domain, event/workflow/playlist-scope.js
    },

    /** MỚI (09/09/2026, phản hồi Giang mục 3b.2) — gọi từ `workflowAppSettings._leaveGuard` (móc
     * chạy đúng 1 lần lúc Back/Close, gắn ở `_renderPlaylistFilterEdit()`, xem event/workflow/
     * app-settings.js) khi rời màn Edit MÀ KHÔNG bấm "Cập nhật" — nếu preset vừa sửa (`presetId`)
     * ĐÚNG là preset đang active VÀ giờ không còn field hợp lệ nào cho Nguồn đang xem
     * (`hasValidPlaylistFilterField()`), tự bỏ chọn + reset ảnh chốt + reload NGAY (không hỏi, CÙNG
     * lý do "bỏ preset = nới kết quả ra"). Preset vẫn HỢP LỆ (còn field) hoặc KHÔNG PHẢI preset đang
     * active thì không làm gì — giữ nguyên ảnh chốt cũ (đã giải thích ở đầu file: sửa preset đang
     * active mà chưa bấm Cập nhật KHÔNG tự đổi filter thật).
     * @param {string} presetId */
    autoUnapplyIfInvalid(presetId) {
        if (appState.get('playlistFilterActivePresetId') !== presetId) return; // không phải preset đang active — không việc gì phải gỡ
        const preset = findPlaylistFilterPresetById(appState.get('playlistFilterPresets'), presetId); // core
        if (!preset) return; // đã bị xoá ở nhánh khác (deletePreset() tự lo phần gỡ rồi) — khỏi làm gì thêm
        const source = appState.get('activeMediaSource');
        if (hasValidPlaylistFilterField(preset.config[source])) return; // vẫn còn field hợp lệ — không cần gỡ
        appState.set('playlistFilterActivePresetId', null);
        appState.set('playlistFilterAppliedConfig', clonePlaylistFilterConfigDefaults());
        console.log(`writer: "autoUnapplyIfInvalid", page: "playlistFilterActivePresetId", content: "null (preset \"${preset.name}\" hết field hợp lệ lúc rời màn Edit, tự gỡ)"`);
        this._recomputeLiveConfig();
        this._persist(); // không await — đang rời màn, reload ngay sau đó nên không cần chờ
        window.location.reload();
    },

    /** Nút "Xoá" ở màn Edit — xoá preset đang sửa, quay lại danh sách.
     * @param {string} id */
    async deletePreset(id) {
        await this._deletePresetById(id);
        workflowAppSettings._renderPlaylistFilterList(); // liên tuyến domain — thay Back thường (preset đã xoá, không còn gì để "sửa tiếp")
    },

    /** Dùng CHUNG cho quickDelete() (danh sách) VÀ deletePreset() (màn Edit) — xoá khỏi
     * playlistFilterPresets; nếu ĐÚNG preset đang active thì tự bỏ chọn + reload NGAY, không hỏi
     * (CÙNG lý do autoUnapplyIfInvalid() — xoá = nới kết quả ra).
     * @param {string} id */
    async _deletePresetById(id) {
        const wasActive = appState.get('playlistFilterActivePresetId') === id;
        const presets = appState.get('playlistFilterPresets').filter((p) => p.id !== id);
        appState.set('playlistFilterPresets', presets);
        if (this._editingId === id) this._editingId = null;
        if (wasActive) {
            appState.set('playlistFilterActivePresetId', null);
            appState.set('playlistFilterAppliedConfig', clonePlaylistFilterConfigDefaults()); // dọn ảnh chốt cũ — không còn preset nào giữ nó nữa
        }
        console.log(`writer: "_deletePresetById", page: "playlistFilterPresets", content: "-${id}${wasActive ? ' (đang active, tự bỏ chọn + dọn ảnh chốt)' : ''}"`);
        this._recomputeLiveConfig();
        await this._persist();
        if (wasActive) window.location.reload();
    },
};
