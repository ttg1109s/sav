/**
 * event/workflow/playlist-filter-presets.js — thực thi router "playlistFilterPresets": Playlist Filter dạng preset đặt
 * tên, màn List/Edit trong Settings (workflowAppSettings.navigateTo()).
 *
 * State (service/state/playlist.js), mỗi field là object `{song, video, photo}` — mỗi Nguồn có danh sách + preset
 * active RIÊNG, độc lập nhau:
 *   - `playlistFilterPresets[source]`       — preset `{id, name, config, appliesToFolder}`; `config` = bucket rule của Nguồn đó.
 *   - `playlistFilterActivePresetId[source]` — preset đang áp dụng (null = không lọc).
 *   - `playlistFilterAppliedConfig[source]`  — "ảnh chốt" deep-clone lúc bấm Chọn áp dụng/Cập nhật; sửa field sau đó
 *     (live-commit vào preset) KHÔNG đổi filter thật cho tới lần chọn kế tiếp.
 *   - `playlistFilterAppliesToFolder[source]` — chốt cùng ảnh chốt; tắt = preset không áp khi đang xem 1 thư mục.
 *   - `playlistFilterConfig` (suy ra, `_recomputeLiveConfig()`) — giá trị sống đọc bởi applyPlaylistFilter()/playlist-scope.js.
 *
 * Nguồn đang thao tác: màn List dùng `activeMediaSource` hiện tại; màn Edit dùng `_editingSource` chốt lúc mở.
 * Chọn áp dụng chặn khi preset không có field hợp lệ (`hasValidPlaylistFilterField()`), xong hỏi reload. Bỏ chọn /
 * xoá preset đang active -> tự gỡ + reload ngay. Sửa field rule qua workflowFilterRuleEdit (dùng chung màn "Cài đặt
 * filter" của folder).
 *
 * NẠP SAU: core/playlist/filter-presets.js, service/state/playlist.js (clonePlaylistFilterConfigDefaults()),
 * core/modal-choice-ui.js (alertModal()), components/playlist-filter-drawer.js, service/db.js (getMeta/setMeta),
 * event/workflow/filter-rule-edit.js, event/workflow/app-settings.js (runtime), event/workflow/playlist-scope.js (runtime).
 */

// Ghép ảnh chốt vào bucket sống theo việc Nguồn đó có preset active hợp lệ hay không.
const FILTER_LIVE_BUCKET_BY_HAS_ACTIVE = {
    true: (defaultBucket, appliedBucket) => ({ ...defaultBucket, ...appliedBucket }),
    false: (defaultBucket) => defaultBucket,
};

const workflowPlaylistFilterPresets = {
    _editingId: null,     // preset đang sửa (màn Edit)
    _editingSource: null, // Nguồn của preset đang sửa — chốt lúc mở Edit

    /** Boot (qua workflowPlaylist.loadPersistedFilterConfigOnBoot()) — đọc meta, sanitize theo từng Nguồn, tính lại
     * playlistFilterConfig. PHẢI chạy TRƯỚC khối Scope (applyAllSongsScope()/applyFolderScope() đọc giá trị này). */
    async loadOnBoot() {
        const rawPresets = await getMeta('playlistFilterPresets');
        const presetsMap = sanitizePlaylistFilterPresetsMap(rawPresets); // core/playlist/filter-presets.js
        const rawActiveIdMap = await getMeta('playlistFilterActivePresetId');
        const activeIdMap = sanitizePlaylistFilterActiveIdMap(rawActiveIdMap, presetsMap); // core
        const rawApplied = await getMeta('playlistFilterAppliedConfig');
        const appliedConfig = { ...clonePlaylistFilterConfigDefaults(), ...((rawApplied && typeof rawApplied === 'object') ? rawApplied : {}) };
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

    /** Tính lại `playlistFilterConfig` cả 3 Nguồn từ preset active + ảnh chốt. Thuần state, không render/reload. */
    _recomputeLiveConfig() {
        const presetsMap = appState.get('playlistFilterPresets');
        const activeIdMap = appState.get('playlistFilterActivePresetId');
        const appliedMap = appState.get('playlistFilterAppliedConfig');
        const next = clonePlaylistFilterConfigDefaults();
        const summary = [];
        for (const source of ['song', 'video', 'photo']) {
            const hasValidActive = !!findPlaylistFilterPresetById(presetsMap[source], activeIdMap[source]); // core
            next[source] = FILTER_LIVE_BUCKET_BY_HAS_ACTIVE[hasValidActive](next[source], appliedMap[source]);
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

    /** Preset đang sửa (màn Edit), null nếu đã bị xoá. */
    _findEditingPreset() {
        return findPlaylistFilterPresetById(appState.get('playlistFilterPresets')[this._editingSource], this._editingId); // core
    },

    // ===================== Màn danh sách (theo activeMediaSource hiện tại) =====================

    /** 'playlistFilterPresets.openManage.click' — mở danh sách preset của Nguồn đang chọn. */
    openList() {
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderPlaylistFilterList()); // liên tuyến domain
    },

    /** 'playlistFilterPresets.tile.click' — mở Edit preset `id`, chốt `_editingSource`. @param {string} id */
    tileClick(id) {
        this._editingId = id;
        this._editingSource = appState.get('activeMediaSource');
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderPlaylistFilterEdit()); // liên tuyến domain
    },

    /** 'playlistFilterPresets.add.click' — tạo preset trắng ("New filter N") cho Nguồn đang chọn, mở Edit ngay. */
    async createNew() {
        const source = appState.get('activeMediaSource');
        const presetsMap = appState.get('playlistFilterPresets');
        const list = presetsMap[source];
        const preset = buildBlankPlaylistFilterPreset(tFormat('playlistFilterPresetsDrawer.defaultName', { n: list.length + 1 }), source); // core/playlist/filter-presets.js
        appState.set('playlistFilterPresets', { ...presetsMap, [source]: [...list, preset] });
        console.log(`writer: "createNew", page: "playlistFilterPresets", content: "[${source}] +${preset.id} \\"${preset.name}\\""`);
        await this._persist();
        this._editingId = preset.id;
        this._editingSource = source;
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderPlaylistFilterEdit()); // liên tuyến domain
    },

    /** 'playlistFilterPresets.quickDelete.click' — xoá thẳng từ danh sách, vẽ lại tại chỗ. @param {string} id */
    async quickDelete(id) {
        await this._deletePresetById(id, appState.get('activeMediaSource'));
        workflowAppSettings._renderPlaylistFilterList(); // liên tuyến domain
    },

    /** 'playlistFilterPresets.quickSelect.click' — chọn áp dụng từ danh sách, vẽ lại tại chỗ. @param {string} id */
    async quickSelect(id) {
        await this.selectPreset(id, appState.get('activeMediaSource'));
        workflowAppSettings._renderPlaylistFilterList(); // liên tuyến domain
    },

    // ===================== Màn Edit 1 preset (theo _editingSource đã chốt) =====================

    /** onMount màn Edit (event/workflow/app-settings.js::_renderPlaylistFilterEdit()) — đổ config preset lên DOM. */
    _syncEditUI() {
        const preset = this._findEditingPreset();
        if (!preset) return;
        workflowFilterRuleEdit.syncUi(preset.config); // event/workflow/filter-rule-edit.js
    },

    /** 'playlistFilterPresets.name.change' (blur) — tên rỗng bỏ qua. @param {string} value */
    async setName(value) {
        const id = this._editingId, source = this._editingSource;
        const trimmed = value.trim();
        if (!trimmed) return;
        const presetsMap = appState.get('playlistFilterPresets');
        const list = presetsMap[source].map((p) => (p.id === id ? { ...p, name: trimmed } : p));
        appState.set('playlistFilterPresets', { ...presetsMap, [source]: list });
        console.log(`writer: "setName", page: "playlistFilterPresets", content: "[${source}] ${id} -> \\"${trimmed}\\""`);
        await this._persist();
    },

    /** 'playlistFilterPresets.appliesToFolder.change' — live-commit vào preset; chỉ có hiệu lực ở lần Chọn áp dụng kế tiếp.
     * @param {boolean} value */
    async setAppliesToFolder(value) {
        const id = this._editingId, source = this._editingSource;
        const presetsMap = appState.get('playlistFilterPresets');
        const list = presetsMap[source].map((p) => (p.id === id ? { ...p, appliesToFolder: value } : p));
        appState.set('playlistFilterPresets', { ...presetsMap, [source]: list });
        console.log(`writer: "setAppliesToFolder", page: "playlistFilterPresets", content: "[${source}] ${id} -> appliesToFolder=${value}"`);
        await this._persist();
    },

    /** 'playlistFilterPresets.field.change' — live-commit 1 prop rule vào preset đang sửa (+ DOM hàng đó).
     * @param {string} field @param {string} prop @param {string|boolean} rawValue */
    async setFilterField(field, prop, rawValue) {
        const id = this._editingId, source = this._editingSource;
        const preset = this._findEditingPreset();
        if (!preset) return; // guard: preset vừa bị xoá
        const nextBucket = { ...preset.config };
        const changed = workflowFilterRuleEdit.applyFieldChange(nextBucket, field, prop, rawValue); // event/workflow/filter-rule-edit.js
        if (!changed) return;
        const presetsMap = appState.get('playlistFilterPresets');
        const nextList = presetsMap[source].map((p) => (p.id === id ? { ...p, config: nextBucket } : p));
        appState.set('playlistFilterPresets', { ...presetsMap, [source]: nextList });
        console.log(`writer: "setFilterField", page: "playlistFilterPresets", content: "[${source}] ${id} ${field}.${prop}"`);
        await this._persist();
    },

    /** 'playlistFilterPresets.openTimePicker.click' (totalTime/duration). @param {string} field @param {string} prop */
    openFilterTimePicker(field, prop) {
        const preset = this._findEditingPreset();
        if (!preset) return;
        workflowFilterRuleEdit.openTimePicker(preset.config, field, prop, (seconds) => this.setFilterField(field, prop, String(seconds))); // event/workflow/filter-rule-edit.js
    },

    /**
     * 'playlistFilterPresets.select.click' / quickSelect — preset `id` thành preset active của `source`: chụp ảnh chốt
     * (deep clone — setFilterField() sửa object rule lồng bên trong) + appliesToFolder, lưu, hỏi reload. Ở lại màn
     * hiện tại. Chặn (cảnh báo) nếu preset chưa có field rule hợp lệ nào.
     * @param {string} id @param {'song'|'video'|'photo'} source
     */
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
        console.log(`writer: "selectPreset", page: "playlistFilterActivePresetId", content: "[${source}] ${id} (\\"${preset.name}\\"), đã chụp ảnh chốt config + appliesToFolder=${preset.appliesToFolder}"`);
        this._recomputeLiveConfig();
        await this._persist();
        workflowPlaylistScope.askReloadToApplyNow(t('playlistFilterPresetsDrawer.reloadPrompt')); // liên tuyến domain, event/workflow/playlist-scope.js
    },

    /** 'playlistFilterPresets.unselect.click' / quickUnselect — gỡ preset active của `source` (không xoá preset) + reload.
     * @param {'song'|'video'|'photo'} source */
    async unselectPreset(source) {
        this._clearActiveState(source);
        console.log(`writer: "unselectPreset", page: "playlistFilterActivePresetId", content: "[${source}] null (bỏ chọn, KHÔNG xoá preset)"`);
        this._recomputeLiveConfig();
        await this._persist();
        window.location.reload();
    },

    /** 'playlistFilterPresets.delete.click' — xoá preset đang sửa, back() về danh sách (pop ngăn xếp + giữ cuộn). @param {string} id */
    async deletePreset(id) {
        await this._deletePresetById(id, this._editingSource);
        workflowAppSettings.back(); // liên tuyến domain
    },

    /** Xoá preset khỏi `playlistFilterPresets[source]`; nếu đang active thì tự gỡ + reload ngay. @param {string} id @param {string} source */
    async _deletePresetById(id, source) {
        const wasActive = appState.get('playlistFilterActivePresetId')[source] === id;
        const presetsMap = appState.get('playlistFilterPresets');
        appState.set('playlistFilterPresets', { ...presetsMap, [source]: presetsMap[source].filter((p) => p.id !== id) });
        this._forgetEditing(id);
        this._clearActiveStateIf(wasActive, source);
        console.log(`writer: "_deletePresetById", page: "playlistFilterPresets", content: "[${source}] -${id}${wasActive ? ' (đang active, tự bỏ chọn + dọn ảnh chốt)' : ''}"`);
        this._recomputeLiveConfig();
        await this._persist();
        this._reloadIf(wasActive);
    },

    _forgetEditing(id) {
        if (this._editingId !== id) return;
        this._editingId = null;
        this._editingSource = null;
    },

    /** Gỡ preset active của `source`: active id null, ảnh chốt về rỗng, appliesToFolder về mặc định BẬT. */
    _clearActiveState(source) {
        const activeIdMap = appState.get('playlistFilterActivePresetId');
        appState.set('playlistFilterActivePresetId', { ...activeIdMap, [source]: null });
        const appliedMap = appState.get('playlistFilterAppliedConfig');
        appState.set('playlistFilterAppliedConfig', { ...appliedMap, [source]: clonePlaylistFilterConfigDefaults()[source] });
        const appliesToFolderMap = appState.get('playlistFilterAppliesToFolder');
        appState.set('playlistFilterAppliesToFolder', { ...appliesToFolderMap, [source]: true });
    },

    _clearActiveStateIf(wasActive, source) {
        if (!wasActive) return;
        this._clearActiveState(source);
    },

    _reloadIf(wasActive) {
        if (!wasActive) return;
        window.location.reload();
    },
};
