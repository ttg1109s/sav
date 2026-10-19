/**
 * event/workflow/eq-presets.js — Workflow của router "eqPresets".
 *
 * Danh sách preset sống ở `appState.eqPresets` (nạp lúc boot từ `meta.eqPresets`, seed 6 preset gốc nếu DB chưa có);
 * preset đang chọn là `appConfigViz.eqPresetId` (lưu qua workflowConfig.save()).
 *
 * #btn-cycle-eq — bấm ngắn: xoay sang preset kế tiếp, áp ngay (cyclePreset()); giữ 1.5s: mở Generic Drawer (List/Edit,
 * components/eq-presets-drawer.js). Đếm giờ giữ qua `taskManager.once()` — startCycleHold()/endCycleHold()/
 * cancelCycleHold() ứng pointerdown/pointerup/pointercancel+pointerleave; cờ `_cycleHoldFired` chặn cycle ở cú `click`
 * phát sinh sau khi đã giữ đủ. Nội dung Drawer đi event/listener/eq-presets.js (ủy quyền) -> router.
 *
 * Chỉ preset `locked` ('flat'/Default) không sửa/xoá được. Không có nút Lưu: slider lưu lúc thả tay, tên lúc rời ô; sửa
 * preset đang áp dụng thì gains có tác dụng ngay lúc kéo.
 *
 * NẠP SAU: core/eq-presets.js, core/eq-presets-drawer-ui.js, components/eq-presets-drawer.js, core/dom-refs.js,
 * service/db.js, service/task-manager.js, event/workflow/generic-drawer-helpers.js, core/visualizer-control-center.js.
 */

const EQ_CYCLE_HOLD_MS = 1500; // ngưỡng giữ để mở Edit EQ — cố định, không phải setting (cùng tinh thần SEEK_HOLD_ACTIVATE_MS)
const EQ_CYCLE_HOLD_TASK = 'eqPresetsCycleHoldPending';

/** Bấm nút Áp dụng trong Edit, theo "preset này ĐANG được áp dụng chưa": chưa -> áp dụng +
 * thông báo đã chọn (nút chuyển sang trạng thái khoá); rồi -> chỉ thông báo "đang áp dụng rồi". */
const EQ_APPLY_CLICK_BY_ACTIVE = {
    true: (preset) => alertModal(tFormat('eqPresets.alreadyApplied', { name: escapeHtml(preset.name) }), { title: t('eqPresets.title') }), // core/modal-choice-ui.js
    false: (preset) => workflowEqPresets._applyAndNotify(preset),
};

/** Kéo slider: preset đang áp dụng -> đổi âm thanh ngay; preset khác -> chỉ cập nhật giá trị. */
const EQ_LIVE_GAINS_BY_ACTIVE = {
    true: (gains) => applyEqGains(appState.get('eqBandNodes'), gains), // core/eq-presets.js
    false: () => {},
};

/** Cú `click` của #btn-cycle-eq: vừa giữ đủ 1.5s (Drawer đã mở) -> chỉ hạ cờ; còn lại -> xoay preset. */
const EQ_CYCLE_CLICK_BY_HOLD_FIRED = {
    true: () => { workflowEqPresets._cycleHoldFired = false; },
    false: () => workflowEqPresets.cyclePreset(),
};

/** Drawer đang đóng -> mở mới; đang mở (List <-> Edit) -> thay nội dung (event/workflow/generic-drawer-helpers.js). */
const EQ_DRAWER_BY_CLOSED = {
    true: (config) => workflowGenericDrawerHelpers.open(config),
    false: (config) => workflowGenericDrawerHelpers.update(config),
};

/** Rời ô Tên: rỗng -> trả ô về tên cũ; có chữ -> lưu tên mới. */
const EQ_COMMIT_NAME_BY_BLANK = {
    true: (rename) => workflowEqPresets._revertDraftName(rename.name),
    false: (rename, id) => workflowEqPresets._saveName(id, rename),
};

const workflowEqPresets = {
    _editingId: null, // id preset đang sửa trong mode 'edit' (null nếu đang ở 'list'/đóng hẳn)
    _draftGains: null,
    _draftName: '',
    _listPageIndex: 0, // trang đang xem của List (nơi 'eqPresets' của Pagination), core tự kẹp
    _cycleHoldFired: false, // true nếu đã giữ đủ EQ_CYCLE_HOLD_MS (Drawer đã mở) — chặn cycle chạy thêm lúc thả tay ra

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

    /** 'eqPresets.cyclePress.start' (pointerdown) — hẹn giờ 1.5s; hết ngưỡng mà chưa thả tay -> mở Drawer (_fireCycleHold()). */
    startCycleHold() {
        this._cycleHoldFired = false;
        taskManager.once(() => this._fireCycleHold(), EQ_CYCLE_HOLD_MS, EQ_CYCLE_HOLD_TASK);
    },

    /** 'eqPresets.cyclePress.end' (pointerup) — chỉ huỷ hẹn giờ. Không cycle ở đây: cú `click` DOM phát sinh ngay sau
     * mới chạy onCycleClick() (tương thích `targetEl.click()` của Tap-3-lần/Action-slot, xem event/listener/eq-presets.js). */
    endCycleHold() {
        taskManager.kill(EQ_CYCLE_HOLD_TASK);
    },

    /** 'eqPresets.cyclePress.cancel' (pointercancel/pointerleave) — huỷ hẹn giờ, không cycle. */
    cancelCycleHold() {
        taskManager.kill(EQ_CYCLE_HOLD_TASK);
        this._cycleHoldFired = false;
    },

    /** Giữ đủ 1.5s -> mở List EQ. Control Center vốn chỉ tự đóng khi `click` bắn ra (sau pointerup) nên đóng ngay tại
     * đây, trước khi mở Drawer (không chồng 2 panel). */
    _fireCycleHold() {
        this._cycleHoldFired = true;
        if (typeof closeControlCenter === 'function') closeControlCenter(); // core/visualizer-control-center.js
        // Mở List đúng trang chứa preset đang dùng (Pagination tắt -> 0).
        const activeIndex = findEqPresetIndexById(appState.get('eqPresets'), appConfigViz.getAll().eqPresetId); // core
        this._listPageIndex = workflowPagination.pageIndexOfItem('eqPresets', activeIndex); // event/workflow/pagination.js
        this.openListView(true); // mở mới từ nút EQ -> List từ đầu
    },

    /** 'eqPresets.cycle.click' — `click` DOM thật trên #btn-cycle-eq (bấm tay lẫn `targetEl.click()` của Tap-3-lần/
     * Action-slot, xem event/listener/eq-presets.js). */
    onCycleClick() {
        EQ_CYCLE_CLICK_BY_HOLD_FIRED[this._cycleHoldFired]();
    },

    /** Xoay sang preset kế tiếp, áp ngay. */
    cyclePreset() {
        const { eqPresets: presets, eqBandNodes } = appState.get(['eqPresets', 'eqBandNodes']);
        const nextId = resolveNextEqPresetId(presets, appConfigViz.getAll().eqPresetId); // core
        appConfigViz.mutateAll((cfg) => { cfg.eqPresetId = nextId; });
        const preset = findEqPresetById(presets, nextId); // core
        applyEqGains(eqBandNodes, preset ? preset.gains : null); // core
        syncEqBadgeLabel(preset ? preset.name : ''); // core
        workflowConfig.save();
    },

    /** View List — từ _fireCycleHold(), sau khi Xoá, nút Back của Edit, đổi trang.
     * @param {boolean} [scrollReset] - true = cuộn từ đầu; false = về vị trí cuộn đã nhớ của List (`scrollKey`). */
    openListView(scrollReset = false) {
        this._editingId = null;
        // Chiều cao co theo nội dung, trần 70vh. Phân trang theo nơi 'eqPresets' (Settings > System > Pagination; tắt = vẽ hết).
        const view = workflowPagination.computePlaceView('eqPresets', appState.get('eqPresets'), this._listPageIndex); // event/workflow/pagination.js
        this._listPageIndex = view.pageIndex; // giá trị đã kẹp (vd vừa xoá preset cuối của trang cuối)
        const config = {
            scrollKey: 'eqPresets:list', // nhớ vị trí cuộn List (xem event/workflow/generic-drawer-helpers.js)
            scrollReset,
            height: 'auto',
            maxHeight: '70vh',
            headerHtml: renderEqListHeader(), // components/eq-presets-drawer.js
            bodyHtml: renderEqListBody(view.pageItems, appConfigViz.getAll().eqPresetId, workflowPagination.buildControlsHtml(view)),
            bodyClass: 'overflow-y-auto px-4 py-3',
        };
        EQ_DRAWER_BY_CLOSED[genericDrawerPanel.classList.contains('hidden')](config);
        // X / "+" / hàng preset đi Listener -> Router; thanh phân trang do core -ui gắn (callback chỉ eventBus.send — Rule 5a).
        wirePaginationControls(genericDrawerBody.querySelector('#eq-list-pagination'), 'eqPresets', 'eqPresets.list.page.change'); // core/pagination-ui.js
    },

    /** 'eqPresets.list.page.change' — vẽ lại List ở trang mới, cuộn về đầu. @param {number} pageIndex */
    setListPage(pageIndex) {
        this._listPageIndex = pageIndex;
        this.openListView(true);
    },

    /** 'eqPresets.list.add.click' (nút "+" header List) — tạo ngay 1 preset tên tự sinh, lưu DB, mở thẳng view Sửa. */
    async _createPresetWithDefaultName() {
        const { preset, presets } = buildEqPresetListWithNew(appState.get('eqPresets'), t('eqPresets.defaultNewPresetName'), generateEqPresetId()); // core
        appState.set('eqPresets', presets);
        console.log(`writer: "workflowEqPresets._createPresetWithDefaultName", page: "eqPresets", content: "thêm ${preset.id}"`);
        await setMeta('eqPresets', presets); // service/db.js
        this._openEditView(preset.id);
    },

    /** Mở view Edit của 1 preset ('eqPresets.list.row.click' hoặc ngay sau khi tạo). @param {string} id */
    _openEditView(id) {
        const preset = findEqPresetById(appState.get('eqPresets'), id); // core
        if (!preset) return;
        this._editingId = id;
        this._draftGains = preset.gains.slice();
        this._draftName = preset.name;
        this._renderEditView(preset, { scrollReset: true });
    },

    /** Dựng (hoặc dựng lại tại chỗ) view Edit cho `preset` — dùng chung mở mới / Khôi phục mặc định /
     * Áp dụng (nút đổi sang trạng thái khoá). Tên + gains hiển thị = bản đang sửa (`_draftName`/`_draftGains`). Chiều cao
     * co theo nội dung, trần 70vh. Sự kiện đi Listener -> Router; preset Default (locked) không có nút Khôi phục/Xoá, ô tên
     * + slider `disabled` (không phát sự kiện) -> chỉ xem + Áp dụng.
     * @param {object} preset @param {{scrollReset?: boolean}} [opts] */
    _renderEditView(preset, opts) {
        const isBuiltIn = !!findEqPresetById(buildDefaultEqPresets(), preset.id); // core — Workflow tự tra (component không gọi core)
        const isActive = appConfigViz.getAll().eqPresetId === preset.id;
        workflowGenericDrawerHelpers.update({ // event/workflow/generic-drawer-helpers.js (nhớ cuộn theo scrollKey) -> core/generic-drawer.js — chuyển mượt, không đóng/mở lại
            scrollKey: 'eqPresets:edit', // màn đi TỚI: từ đầu (scrollReset); vẽ lại tại chỗ: giữ vị trí cuộn
            scrollReset: !!(opts && opts.scrollReset),
            height: 'auto',
            maxHeight: '70vh',
            headerHtml: renderEqEditHeader(preset, isBuiltIn), // components/eq-presets-drawer.js
            bodyHtml: renderEqEditBody({ ...preset, name: this._draftName, gains: this._draftGains }, isActive),
            bodyClass: 'overflow-y-auto px-4 py-3',
        });
    },

    /** Ứng với 'eqPresets.edit.name.input' (đang gõ ô Tên) — chỉ giữ bản nháp, rời ô mới ghi (_commitName()).
     * @param {string} value */
    setDraftName(value) {
        this._draftName = value;
    },

    /** 'eqPresets.edit.band.input' — đang kéo 1 slider kênh: cập nhật `_draftGains` + số dB; preset đang áp dụng thì áp
     * gains lên audio NGAY. Nhận `data-index` + giá trị thô từ Listener (core thuần đổi sang số + chữ hiển thị).
     * @param {string} rawIndex @param {string} rawValue */
    _previewBandGain(rawIndex, rawValue) {
        const band = resolveEqBandSliderInput(rawIndex, rawValue); // core/eq-presets.js
        if (!band.isValid) return;
        this._draftGains[band.index] = band.value;
        setEqBandValueText(genericDrawerBody, band.index, band.text); // core/eq-presets-drawer-ui.js
        EQ_LIVE_GAINS_BY_ACTIVE[appConfigViz.getAll().eqPresetId === this._editingId](this._draftGains);
    },

    /** 'eqPresets.edit.band.change' — thả tay slider: ghi gains đang sửa vào danh sách preset (DB). Âm thanh đã đổi sẵn lúc kéo. */
    async _commitGains() {
        const id = this._editingId;
        if (!id) return;
        const presets = replaceEqPresetGains(appState.get('eqPresets'), id, this._draftGains); // core
        appState.set('eqPresets', presets);
        console.log(`writer: "workflowEqPresets._commitGains", page: "eqPresets", content: "${id} — [${this._draftGains.join(',')}]"`);
        await setMeta('eqPresets', presets); // service/db.js
    },

    /** 'eqPresets.edit.name.change' — rời ô Tên: ghi tên mới; rỗng -> trả về tên cũ. */
    async _commitName() {
        const id = this._editingId;
        const presets = appState.get('eqPresets');
        const current = findEqPresetById(presets, id); // core
        if (!current) return;
        const rename = resolveEqPresetRename(presets, current, this._draftName); // core
        await EQ_COMMIT_NAME_BY_BLANK[rename.isBlank](rename, id);
    },

    /** Tên rỗng: bản nháp + ô Tên về tên cũ. @param {string} name */
    _revertDraftName(name) {
        this._draftName = name;
        setEqDrawerNameInputValue(genericDrawerBody, name); // core/eq-presets-drawer-ui.js
    },

    /** Lưu tên mới (DB); preset đang áp dụng -> đổi nhãn badge EQ theo.
     * @param {string} id @param {{name: string, presets: object[]}} rename - resolveEqPresetRename() */
    async _saveName(id, rename) {
        appState.set('eqPresets', rename.presets);
        console.log(`writer: "workflowEqPresets._saveName", page: "eqPresets", content: "${id} — ${rename.name}"`);
        await setMeta('eqPresets', rename.presets); // service/db.js
        if (appConfigViz.getAll().eqPresetId === id) syncEqBadgeLabel(rename.name); // core
    },

    /** 'eqPresets.edit.apply.click' — nút Áp dụng trong Edit: preset chưa áp dụng -> chọn + thông báo đã chọn, nút chuyển
     * sang trạng thái khoá "Đang áp dụng"; đã áp dụng (nút khoá) -> thông báo "đang áp dụng rồi".
     * @param {string} id */
    onApplyClick(id) {
        const preset = findEqPresetById(appState.get('eqPresets'), id); // core
        if (!preset) return;
        EQ_APPLY_CLICK_BY_ACTIVE[appConfigViz.getAll().eqPresetId === id](preset);
    },

    /** Chọn preset làm preset ĐANG DÙNG (`eqPresetId`), áp gains (bản đang sửa — luôn khớp DB vì tự lưu), vẽ lại Edit
     * để nút sang trạng thái khoá, rồi hiện thông báo.
     * @param {object} preset */
    _applyAndNotify(preset) {
        appConfigViz.mutateAll((cfg) => { cfg.eqPresetId = preset.id; });
        console.log(`writer: "workflowEqPresets._applyAndNotify", page: "vizConfig.eqPresetId", content: "${preset.id}"`);
        applyEqGains(appState.get('eqBandNodes'), this._draftGains); // core
        syncEqBadgeLabel(preset.name); // core
        workflowConfig.save();
        this._renderEditView(preset);
        alertModal(tFormat('eqPresets.appliedNotice', { name: escapeHtml(preset.name) }), { title: t('eqPresets.title') }); // core/modal-choice-ui.js
    },

    /** 'eqPresets.edit.reset.click' — "Khôi phục mặc định" (chỉ preset gốc chưa khoá): gains về giá trị lúc seed và ghi
     * thẳng DB; không đụng tên đang gõ dở. @param {string} id */
    async _resetEditToDefault(id) {
        const factory = findEqPresetById(buildDefaultEqPresets(), id); // core
        if (!factory) return; // nút vốn ẩn với preset không phải built-in
        const { eqPresets, eqBandNodes } = appState.get(['eqPresets', 'eqBandNodes']);
        this._draftGains = factory.gains.slice();
        const presets = replaceEqPresetGains(eqPresets, id, this._draftGains); // core
        appState.set('eqPresets', presets);
        console.log(`writer: "workflowEqPresets._resetEditToDefault", page: "eqPresets", content: "${id} — gains gốc"`);
        await setMeta('eqPresets', presets); // service/db.js
        if (appConfigViz.getAll().eqPresetId === id) applyEqGains(eqBandNodes, this._draftGains); // core
        const preset = findEqPresetById(presets, id); // core — bản vừa ghi
        if (!preset) return;
        this._renderEditView(preset); // vẽ lại tại chỗ (giữ vị trí cuộn)
    },

    /** 'eqPresets.edit.delete.click' — xoá preset (không xoá preset locked — nút vốn ẩn, chặn thêm ở đây). Xoá đúng preset
     * đang áp dụng -> về Default ('flat'). @param {string} id */
    async _deletePreset(id) {
        const { eqPresets, eqBandNodes } = appState.get(['eqPresets', 'eqBandNodes']);
        const target = findEqPresetById(eqPresets, id); // core
        if (!target || target.locked) return;
        const presets = removeEqPresetById(eqPresets, id); // core
        appState.set('eqPresets', presets);
        console.log(`writer: "workflowEqPresets._deletePreset", page: "eqPresets", content: "xoá ${id}"`);
        await setMeta('eqPresets', presets); // service/db.js
        if (appConfigViz.getAll().eqPresetId === id) {
            appConfigViz.mutateAll((cfg) => { cfg.eqPresetId = 'flat'; });
            const flatPreset = findEqPresetById(presets, 'flat'); // core
            applyEqGains(eqBandNodes, flatPreset ? flatPreset.gains : null); // core
            syncEqBadgeLabel(flatPreset ? flatPreset.name : 'Default'); // core
            workflowConfig.save();
        }
        this.openListView();
    },

    /** Nút X trong header List (Listener -> Router 'eqPresets.list.close.click') — dùng CHUNG helper đóng
     * Generic Drawer (KHÔNG tự chép lại logic transitionend — xem event/workflow/
     * generic-drawer-helpers.js). */
    closeDrawer() {
        workflowGenericDrawerHelpers.closeFully();
        this._editingId = null;
    },
};
