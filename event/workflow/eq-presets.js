/**
 * event/workflow/eq-presets.js — "THẰNG THỰC THI CUỐI" của router "eqPresets".
 *
 * Danh sách preset SỐNG ở `appState.eqPresets` (nạp lúc boot từ `meta.eqPresets`, seed 6 preset
 * gốc nếu DB chưa có, xem loadPresetsOnBoot()) — preset ĐANG CHỌN chỉ là 1 id đơn giản
 * (`appConfigViz.eqPresetId`, lưu bền qua saveConfig() như mọi field vizConfig khác).
 *
 * #btn-cycle-eq: cycle qua danh sách, ÁP DỤNG NGAY (CÙNG khuôn đổi hiệu ứng Visualizer, không mở
 * gì cả). #btn-edit-eq: mở Generic Drawer (core/generic-drawer.js, DÙNG CHUNG — components/
 * eq-presets-drawer.js render nội dung) — 2 mode 'list'/'edit', CÙNG khuôn Document Reader
 * (List<->Read): Workflow này tự querySelector + addEventListener trực tiếp lên
 * genericDrawerHeader/genericDrawerBody SAU MỖI lần mở/chuyển mode (KHÔNG qua eventBus cho các nút
 * động bên trong Drawer — xem docstring core/generic-drawer.js).
 *
 * Sửa/xoá CHỈ áp dụng cho preset KHÔNG `locked` (chỉ 'flat'/Default khoá — core/eq-presets.js).
 * Sửa preset ĐANG active thì áp gains mới NGAY LẬP TỨC; sửa preset khác không ảnh hưởng âm thanh
 * đang phát.
 *
 * NẠP SAU: core/eq-presets.js, core/generic-drawer.js, components/eq-presets-drawer.js,
 * core/dom-refs.js (btnCycleEq/btnEditEq/eqBadgeLabel/genericDrawer*), service/db.js (getMeta/
 * setMeta), event/workflow/generic-drawer-helpers.js (closeFully()).
 */

const workflowEqPresets = {
    _editingId: null, // id preset đang sửa trong mode 'edit' (null nếu đang ở 'list'/đóng hẳn)
    _draftGains: null,
    _draftName: '',

    /** Gọi từ event/workflow/app-boot.js — đọc `meta.eqPresets`, seed 6 preset gốc nếu chưa có. */
    async loadPresetsOnBoot() {
        let presets = await getMeta('eqPresets');
        if (!Array.isArray(presets) || presets.length === 0) {
            presets = buildDefaultEqPresets(); // core/eq-presets.js
            await setMeta('eqPresets', presets);
        }
        appState.set('eqPresets', presets);
        console.log(`writer: "loadPresetsOnBoot", page: "eqPresets", content: "${presets.length} preset"`);
        const active = findEqPresetById(presets, appConfigViz.getAll().eqPresetId); // core
        syncEqBadgeLabel(active ? active.name : presets[0].name); // core
    },

    /** Ứng với 'eqPresets.cycle.click' (#btn-cycle-eq) — xoay sang preset kế tiếp, áp NGAY. */
    cyclePreset() {
        const presets = appState.get('eqPresets');
        const nextId = resolveNextEqPresetId(presets, appConfigViz.getAll().eqPresetId); // core
        appConfigViz.mutateAll((cfg) => { cfg.eqPresetId = nextId; });
        const preset = findEqPresetById(presets, nextId); // core
        applyEqGains(appState.get('eqBandNodes'), preset ? preset.gains : null); // core
        syncEqBadgeLabel(preset ? preset.name : ''); // core
        saveConfig();
    },

    /** Ứng với 'eqPresets.openDrawer.click' (#btn-edit-eq). */
    openListView() {
        this._editingId = null;
        openGenericDrawer({ // core/generic-drawer.js
            headerHtml: renderEqListHeader(), // components/eq-presets-drawer.js
            bodyHtml: renderEqListBody(appState.get('eqPresets'), appConfigViz.getAll().eqPresetId),
            bodyClass: 'overflow-y-auto',
        });
        this._wireListView();
    },

    _wireListView() {
        const closeBtn = genericDrawerHeader.querySelector('#eq-drawer-close');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeDrawer());
        const addBtn = genericDrawerBody.querySelector('#eq-drawer-add');
        const nameInput = genericDrawerBody.querySelector('#eq-drawer-new-name');
        if (addBtn && nameInput) addBtn.addEventListener('click', () => this._createPreset(nameInput.value));
        genericDrawerBody.querySelectorAll('[data-eq-id]').forEach((row) => {
            row.addEventListener('click', () => this._openEditView(row.dataset.eqId));
        });
    },

    /** Tạo preset mới (gains mặc định phẳng), lưu DB, mở luôn view sửa cho preset vừa tạo.
     * @param {string} rawName */
    async _createPreset(rawName) {
        const name = (rawName || '').trim();
        if (!name) return;
        const preset = { id: generateEqPresetId(), name, gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], locked: false }; // core
        const presets = [...appState.get('eqPresets'), preset];
        appState.set('eqPresets', presets);
        await setMeta('eqPresets', presets);
        this._openEditView(preset.id);
    },

    _openEditView(id) {
        const preset = findEqPresetById(appState.get('eqPresets'), id); // core
        if (!preset) return;
        this._editingId = id;
        this._draftGains = preset.gains.slice();
        this._draftName = preset.name;
        updateGenericDrawer({ // core/generic-drawer.js — chuyển mượt, không đóng/mở lại
            headerHtml: renderEqEditHeader(preset), // components/eq-presets-drawer.js
            bodyHtml: renderEqEditBody(preset),
            bodyClass: 'overflow-y-auto',
        });
        this._wireEditView(preset);
    },

    _wireEditView(preset) {
        const backBtn = genericDrawerHeader.querySelector('#eq-drawer-back');
        if (backBtn) backBtn.addEventListener('click', () => this.openListView());
        if (preset.locked) return; // Default — chỉ xem, không có nút Lưu/Xoá/input nào để wire thêm

        const saveBtn = genericDrawerHeader.querySelector('#eq-drawer-save');
        if (saveBtn) saveBtn.addEventListener('click', () => this._saveEdit());

        const nameInput = genericDrawerBody.querySelector('#eq-drawer-name');
        if (nameInput) nameInput.addEventListener('input', (e) => { this._draftName = e.target.value; });

        genericDrawerBody.querySelectorAll('.eq-slider').forEach((slider) => {
            slider.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.index, 10);
                if (isNaN(index)) return;
                const value = parseInt(e.target.value, 10);
                this._draftGains[index] = value;
                const valEl = genericDrawerBody.querySelector(`#eq-edit-val-${index}`);
                if (valEl) valEl.textContent = value > 0 ? `+${value}` : value;
            });
        });

        const deleteBtn = genericDrawerBody.querySelector('#eq-drawer-delete');
        if (deleteBtn) deleteBtn.addEventListener('click', () => this._deletePreset(preset.id));
    },

    /** Lưu tên/gains đang sửa — nếu ĐÚNG preset đang active thì áp gains mới ngay lập tức. */
    async _saveEdit() {
        const id = this._editingId;
        const name = this._draftName.trim() || findEqPresetById(appState.get('eqPresets'), id).name;
        const presets = appState.get('eqPresets').map((p) => (p.id === id ? { ...p, name, gains: this._draftGains } : p));
        appState.set('eqPresets', presets);
        await setMeta('eqPresets', presets);
        if (appConfigViz.getAll().eqPresetId === id) {
            applyEqGains(appState.get('eqBandNodes'), this._draftGains); // core
            syncEqBadgeLabel(name); // core
        }
        this.openListView();
    },

    /** Xoá preset (guard: không xoá được preset locked — nút Xoá vốn đã ẩn cho locked, chặn thêm
     * ở đây phòng gọi nhầm). Nếu xoá đúng preset đang active, về lại Default ('flat').
     * @param {string} id */
    async _deletePreset(id) {
        const target = findEqPresetById(appState.get('eqPresets'), id); // core
        if (!target || target.locked) return;
        const presets = appState.get('eqPresets').filter((p) => p.id !== id);
        appState.set('eqPresets', presets);
        await setMeta('eqPresets', presets);
        if (appConfigViz.getAll().eqPresetId === id) {
            appConfigViz.mutateAll((cfg) => { cfg.eqPresetId = 'flat'; });
            const flatPreset = findEqPresetById(presets, 'flat'); // core
            applyEqGains(appState.get('eqBandNodes'), flatPreset ? flatPreset.gains : null); // core
            syncEqBadgeLabel(flatPreset ? flatPreset.name : 'Default'); // core
            saveConfig();
        }
        this.openListView();
    },

    /** Nút X trong header List (wired trực tiếp, xem _wireListView()) — dùng CHUNG helper đóng
     * Generic Drawer (KHÔNG tự chép lại logic transitionend — xem event/workflow/
     * generic-drawer-helpers.js). */
    closeDrawer() {
        workflowGenericDrawerHelpers.closeFully();
        this._editingId = null;
    },
};
