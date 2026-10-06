/**
 * event/workflow/eq-presets.js — "THẰNG THỰC THI CUỐI" của router "eqPresets".
 *
 * Danh sách preset SỐNG ở `appState.eqPresets` (nạp lúc boot từ `meta.eqPresets`, seed 6 preset
 * gốc nếu DB chưa có, xem loadPresetsOnBoot()) — preset ĐANG CHỌN chỉ là 1 id đơn giản
 * (`appConfigViz.eqPresetId`, lưu bền qua saveConfig() như mọi field vizConfig khác).
 *
 * #btn-cycle-eq — DUY NHẤT 1 nút cho CẢ 2 việc (SỬA 12/08/2026, Giang yêu cầu "gộp eq edit vào
 * hold 3s, bỏ icon edit riêng" — #btn-edit-eq cũ ĐÃ BỎ HẲN):
 *   - BẤM NGẮN (thả tay TRƯỚC 1.5s) — cycle qua danh sách, ÁP DỤNG NGAY (CÙNG khuôn đổi hiệu ứng
 *     Visualizer, không mở gì cả) — xem cyclePreset().
 *   - GIỮ đủ 1.5s (chưa thả tay) — mở Generic Drawer (core/generic-drawer.js, DÙNG CHUNG —
 *     components/eq-presets-drawer.js render nội dung) — 2 mode 'list'/'edit', CÙNG khuôn Document
 *     Reader (List<->Read): Workflow này tự querySelector + addEventListener trực tiếp lên
 *     genericDrawerHeader/genericDrawerBody SAU MỖI lần mở/chuyển mode (KHÔNG qua eventBus cho các
 *     nút động bên trong Drawer — xem docstring core/generic-drawer.js).
 *   Đếm giờ 1.5s qua `taskManager.once()` (CÙNG khuôn SEEK_HOLD_ACTIVATE_MS,
 *   event/workflow/visualizer-gesture.js) — startCycleHold()/endCycleHold()/cancelCycleHold() ứng
 *   pointerdown/pointerup/pointercancel+pointerleave (event/listener/eq-presets.js). Cờ
 *   `_cycleHoldFired` chặn KHÔNG cho cycle chạy thêm lúc thả tay SAU KHI đã giữ đủ 1.5s (Drawer đã
 *   mở rồi, thả tay lúc đó không còn ý nghĩa "bấm" nữa).
 *
 * Sửa/xoá CHỈ áp dụng cho preset KHÔNG `locked` (chỉ 'flat'/Default khoá — core/eq-presets.js).
 * Sửa preset ĐANG active thì áp gains mới NGAY LẬP TỨC; sửa preset khác không ảnh hưởng âm thanh
 * đang phát.
 *
 * NẠP SAU: core/eq-presets.js, core/generic-drawer.js, components/eq-presets-drawer.js,
 * core/dom-refs.js (btnCycleEq/eqBadgeLabel/genericDrawer*), service/db.js (getMeta/setMeta),
 * service/task-manager.js (taskManager — đếm giờ giữ 1.5s), event/workflow/generic-drawer-
 * helpers.js (closeFully()), core/visualizer-control-center.js (closeControlCenter() — SỬA
 * 14/08/2026, xem _fireCycleHold()).
 */

const EQ_CYCLE_HOLD_MS = 1500; // SỬA (13/08/2026, Giang yêu cầu "giảm hold xuống 1.5s") — trước 3000ms — ngưỡng giữ để mở Edit EQ, cố định, không phải setting (cùng tinh thần SEEK_HOLD_ACTIVATE_MS)
const EQ_CYCLE_HOLD_TASK = 'eqPresetsCycleHoldPending';

/** MỚI (07/10/2026, Giang) — bấm nút Áp dụng trong Edit, theo "preset này ĐANG được áp dụng chưa": chưa -> áp dụng +
 * thông báo đã chọn (nút chuyển sang trạng thái khoá); rồi -> chỉ thông báo "đang áp dụng rồi". */
const EQ_APPLY_CLICK_BY_ACTIVE = {
    true: (preset) => alertModal(tFormat('eqPresets.alreadyApplied', { name: escapeHtml(preset.name) }), { title: t('eqPresets.title') }), // core/modal-choice-ui.js
    false: (preset) => workflowEqPresets._applyAndNotify(preset),
};

/** MỚI (07/10/2026) — kéo slider: preset đang áp dụng -> đổi âm thanh NGAY; preset khác -> chỉ cập nhật giá trị (không đụng audio). */
const EQ_LIVE_GAINS_BY_ACTIVE = {
    true: (gains) => applyEqGains(appState.get('eqBandNodes'), gains), // core/eq-presets.js
    false: () => {},
};

const workflowEqPresets = {
    _editingId: null, // id preset đang sửa trong mode 'edit' (null nếu đang ở 'list'/đóng hẳn)
    _draftGains: null,
    _draftName: '',
    _listPageIndex: 0, // MỚI 23/09/2026 — trang đang xem của List (nơi 'eqPresets' của Pagination), core tự kẹp
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

    /** Ứng với 'eqPresets.cyclePress.start' (pointerdown #btn-cycle-eq) — hẹn giờ
     * EQ_CYCLE_HOLD_MS (1.5s), CÙNG khuôn SEEK_HOLD_ACTIVATE_MS (event/workflow/
     * visualizer-gesture.js::_onTouchStart()) — hết ngưỡng mà CHƯA thả tay -> coi là GIỮ, mở Edit
     * EQ (_fireCycleHold()) thay vì cycle. */
    startCycleHold() {
        this._cycleHoldFired = false;
        taskManager.once(() => this._fireCycleHold(), EQ_CYCLE_HOLD_MS, EQ_CYCLE_HOLD_TASK);
    },

    /** Ứng với 'eqPresets.cyclePress.end' (pointerup) — CHỈ huỷ hẹn giờ 1.5s nếu chưa hết (thả tay
     * TRƯỚC ngưỡng). KHÔNG tự cycle ở đây (khác bản đầu) — trình duyệt luôn tự phát sinh 1 sự kiện
     * `click` DOM NGAY SAU `pointerup` (trừ khi bị preventDefault, ở đây KHÔNG), onCycleClick() mới
     * là nơi THẬT SỰ chạy cyclePreset() — xem lý do tách 2 nhánh ở docstring event/listener/
     * eq-presets.js (tương thích `targetEl.click()` của hệ Tap-3-lần/Action-slot,
     * GESTURE_TRIPLE_TAP_TARGET_ELS). */
    endCycleHold() {
        taskManager.kill(EQ_CYCLE_HOLD_TASK);
    },

    /** Ứng với 'eqPresets.cyclePress.cancel' (pointercancel/pointerleave — rời ngón tay/chuột
     * khỏi nút TRƯỚC khi thả) — huỷ hẹn giờ, KHÔNG cycle (giống rê tay ra ngoài 1 nút bấm thường,
     * không tính là 1 lần bấm). */
    cancelCycleHold() {
        taskManager.kill(EQ_CYCLE_HOLD_TASK);
        this._cycleHoldFired = false;
    },

    /** Hết ngưỡng CỐ ĐỊNH EQ_CYCLE_HOLD_MS (1.5s) giữ tay yên (pointerup CHƯA fire) -> mở Edit EQ
     * (THAY #btn-edit-eq đã bỏ, xem components/visualizer-overlay.js).
     * SỬA (14/08/2026, Giang báo "giữ hold effect/eq không thu gọn icon center cùng lúc") — nút
     * #btn-cycle-eq nằm trong Control Center (core/visualizer-control-center.js): TRƯỚC ĐÂY panel
     * đó chỉ tự đóng khi sự kiện `click` DOM thật bắn ra (`visualizerControlCenter.gridClick`,
     * SAU `pointerup`) — nghĩa là lúc GIỮ đủ 1.5s, Drawer đã mở nhưng Control Center vẫn còn mở
     * nguyên, chỉ thu gọn lúc thả tay ra sau đó (2 panel chồng nhau 1 khoảng). Gọi thẳng
     * `closeControlCenter()` (core/visualizer-control-center.js, liên tuyến domain — CÙNG tiền lệ
     * `core/player-controls.js` đã gọi thẳng hàm này) NGAY tại đây, TRƯỚC khi mở Drawer, để 2 việc
     * xảy ra đồng thời. */
    _fireCycleHold() {
        this._cycleHoldFired = true;
        if (typeof closeControlCenter === 'function') closeControlCenter(); // core/visualizer-control-center.js
        // MỚI 23/09/2026 — mở List ĐÚNG trang chứa preset đang dùng (nơi 'eqPresets' của Pagination; tắt -> 0).
        const presets = appState.get('eqPresets');
        this._listPageIndex = workflowPagination.pageIndexOfItem('eqPresets', presets.findIndex((p) => p.id === appConfigViz.getAll().eqPresetId)); // event/workflow/pagination.js
        this.openListView(true); // SỬA (24/09/2026) — mở mới từ nút EQ -> List từ đầu
    },

    /** Ứng với 'eqPresets.cycle.click' (sự kiện `click` DOM thật trên #btn-cycle-eq — bấm tay
     * NGẮN của người dùng LẪN `targetEl.click()` do hệ Tap-3-lần/Action-slot gọi hộ, xem docstring
     * event/listener/eq-presets.js) — chặn KHÔNG cycle nếu vừa giữ đủ 1.5s xong (`_cycleHoldFired`,
     * Edit EQ đã mở ở _fireCycleHold(), `click` tự nhiên phát sinh ngay sau đó không còn ý nghĩa
     * "bấm" nữa); ngược lại xoay sang preset kế tiếp như bấm thường. */
    onCycleClick() {
        if (this._cycleHoldFired) {
            this._cycleHoldFired = false;
            return;
        }
        this.cyclePreset();
    },

    /** Xoay sang preset kế tiếp, áp NGAY — logic thuần, gọi từ onCycleClick(). */
    cyclePreset() {
        const presets = appState.get('eqPresets');
        const nextId = resolveNextEqPresetId(presets, appConfigViz.getAll().eqPresetId); // core
        appConfigViz.mutateAll((cfg) => { cfg.eqPresetId = nextId; });
        const preset = findEqPresetById(presets, nextId); // core
        applyEqGains(appState.get('eqBandNodes'), preset ? preset.gains : null); // core
        syncEqBadgeLabel(preset ? preset.name : ''); // core
        saveConfig();
    },

    /** Mở view List của Generic Drawer EQ — gọi từ _fireCycleHold() (giữ 1.5s #btn-cycle-eq, THAY
     * 'eqPresets.openDrawer.click'/#btn-edit-eq đã bỏ) hoặc từ _deletePreset() (quay
     * lại List sau khi Lưu/Xoá xong). */
    /** @param {boolean} [scrollReset] - SỬA (24/09/2026) — true = mở mới (bắt đầu từ đầu); mặc định false = quay
     *        lại từ Edit/vẽ lại sau Lưu/Xoá -> về đúng vị trí cuộn cũ của List (event/workflow/generic-drawer-helpers.js, `scrollKey`). */
    openListView(scrollReset = false) {
        this._editingId = null;
        // SỬA (12/08/2026, Giang chỉ ra "khớp với generic drawer") — mở/chuyển view LUÔN dùng
        // updateGenericDrawer() nếu drawer đang mở (List <-> Edit trong CÙNG drawer), CHỈ
        // openGenericDrawer() (lần đầu) — trước đây gọi thẳng openGenericDrawer() bất kể trạng
        // thái, khiến quay lại List từ Edit bị "mở lại từ đầu" thay vì chuyển mượt.
        // SỬA (phản hồi Giang mục 1 — "custom effect/eq edit không content-fit") — TRƯỚC ĐÂY config
        // này KHÔNG có `height`/`maxHeight` -> rơi về mặc định FIX CỨNG '70vh' của
        // `_resolveGenericDrawerHeightPx()` (core/generic-drawer.js) — KHÔNG bao giờ thật sự "auto",
        // panel LUÔN đúng 70vh bất kể danh sách preset dài/ngắn. Thêm `height:'auto'` + GIỮ NGUYÊN
        // `70vh` làm `maxHeight` (đúng trần CŨ, hành vi KHÔNG đổi khi danh sách dài/vượt trần — chỉ
        // MỚI thêm khả năng co nhỏ lại khi danh sách ngắn, vốn trước đây không có).
        // MỚI 23/09/2026 — nơi 'eqPresets' của Settings > System > Pagination (tắt = vẽ hết như cũ).
        const view = workflowPagination.computePlaceView('eqPresets', appState.get('eqPresets'), this._listPageIndex); // event/workflow/pagination.js
        this._listPageIndex = view.pageIndex; // giá trị đã kẹp (vd vừa xoá preset cuối của trang cuối)
        const config = {
            scrollKey: 'eqPresets:list', // MỚI (24/09/2026) — nhớ vị trí cuộn List (xem event/workflow/generic-drawer-helpers.js)
            scrollReset,
            height: 'auto',
            maxHeight: '70vh',
            headerHtml: renderEqListHeader(), // components/eq-presets-drawer.js
            bodyHtml: renderEqListBody(view.pageItems, appConfigViz.getAll().eqPresetId, workflowPagination.buildControlsHtml(view)),
            bodyClass: 'overflow-y-auto px-4 py-3',
        };
        if (genericDrawerPanel.classList.contains('hidden')) {
            workflowGenericDrawerHelpers.open(config); // event/workflow/generic-drawer-helpers.js (nhớ cuộn theo scrollKey) -> core/generic-drawer.js
        } else {
            workflowGenericDrawerHelpers.update(config); // event/workflow/generic-drawer-helpers.js (nhớ cuộn theo scrollKey) -> core/generic-drawer.js
        }
        this._wireListView();
    },

    _wireListView() {
        const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeDrawer());
        // SỬA (12/08/2026, Giang yêu cầu — "bấm icon + trên header, tự tạo eq với tên default")
        // — nút "+" giờ nằm trong HEADER (thay ô nhập tên + nút Tạo cũ trong body), tạo NGAY 1
        // preset tên tự sinh rồi mở thẳng view Sửa — xem _createPresetWithDefaultName().
        const addBtn = genericDrawerHeader.querySelector('#btn-eq-drawer-add');
        if (addBtn) addBtn.addEventListener('click', () => this._createPresetWithDefaultName());
        genericDrawerBody.querySelectorAll('[data-eq-id]').forEach((row) => {
            row.addEventListener('click', () => this._openEditView(row.dataset.eqId));
        });
        wirePaginationControls(genericDrawerBody.querySelector('#eq-list-pagination'), 'eqPresets', 'eqPresets.list.page.change'); // core/pagination-ui.js — MỚI 23/09/2026
    },

    /** MỚI 23/09/2026 — ứng với 'eqPresets.list.page.change' (thanh phân trang của List). Vẽ lại List,
     * cuộn về đầu. @param {number} pageIndex */
    setListPage(pageIndex) {
        this._listPageIndex = pageIndex;
        this.openListView();
        genericDrawerBody.scrollTop = 0;
    },

    /** Ứng với nút "+" trong header List — CÙNG khuôn createFolderInPicker()/
     * _computeDefaultFolderName() (event/workflow/playlist.js): tạo NGAY 1 preset tên tự sinh
     * (KHÔNG cần hỏi tên trước), mở thẳng view Sửa — người dùng đổi tên ở đó nếu muốn (đã có sẵn
     * ô Name), không cần bước nhập tên riêng trước khi tạo nữa. */
    async _createPresetWithDefaultName() {
        await this._createPreset(this._computeDefaultPresetName());
    },

    /** Tính tên mặc định KHÔNG trùng bất kỳ preset nào đang có — "New preset", "New preset 2"...
     * CÙNG khuôn _computeDefaultFolderName() (event/workflow/playlist.js). */
    _computeDefaultPresetName() {
        const base = t('eqPresets.defaultNewPresetName');
        const existingNames = new Set(appState.get('eqPresets').map((p) => p.name));
        if (!existingNames.has(base)) return base;
        let n = 2;
        while (existingNames.has(`${base} ${n}`)) n++;
        return `${base} ${n}`;
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
        // SỬA (phản hồi Giang mục 1) — height 'auto' + trần 70vh (nội dung Edit ngắn hơn 70vh, trước đây bị fix cứng 70vh).
        this._renderEditView(preset, { scrollReset: true });
    },

    /** MỚI (07/10/2026) — dựng (hoặc dựng lại tại chỗ) view Edit cho `preset` — dùng chung mở mới / Khôi phục mặc định /
     * Áp dụng (nút đổi sang trạng thái khoá). Tên + gains hiển thị = bản đang sửa (`_draftName`/`_draftGains`).
     * @param {object} preset @param {{scrollReset?: boolean}} [opts] */
    _renderEditView(preset, opts) {
        const isBuiltIn = buildDefaultEqPresets().some((p) => p.id === preset.id); // core — Workflow tự tra (Rule 3, component không tự gọi core)
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
        this._wireEditView(preset);
    },

    /** SỬA (07/10/2026, Giang: "bỏ tính năng save") — KHÔNG còn nút Lưu: kéo slider cập nhật số + (nếu preset đang áp
     * dụng) đổi âm thanh NGAY lúc kéo (`input`), thả tay (`change`) mới ghi DB; tên ghi lúc rời ô (`change`). */
    _wireEditView(preset) {
        const backBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-back');
        if (backBtn) backBtn.addEventListener('click', () => this.openListView());

        // Nút Áp dụng — có cả ở preset Default (locked). Xem onApplyClick().
        const applyBtn = genericDrawerBody.querySelector('#eq-drawer-apply');
        if (applyBtn) applyBtn.addEventListener('click', () => this.onApplyClick(preset.id));

        if (preset.locked) return; // Default — chỉ xem + Áp dụng, không có slider/tên/Xoá/Khôi phục để wire thêm

        // FIX (12/08/2026) — nút Khôi phục chỉ render với preset gốc (renderEqEditHeader()), null thì bỏ qua.
        const resetBtn = genericDrawerHeader.querySelector('#btn-eq-drawer-reset');
        if (resetBtn) resetBtn.addEventListener('click', () => this._resetEditToDefault(preset.id));

        const nameInput = genericDrawerBody.querySelector('#eq-drawer-name');
        if (nameInput) {
            nameInput.addEventListener('input', (e) => { this._draftName = e.target.value; });
            nameInput.addEventListener('change', () => this._commitName());
        }

        genericDrawerBody.querySelectorAll('.eq-band-slider').forEach((slider) => {
            slider.addEventListener('input', (e) => this._previewBandGain(e.target));
            slider.addEventListener('change', () => this._commitGains());
        });

        const deleteBtn = genericDrawerBody.querySelector('#eq-drawer-delete');
        if (deleteBtn) deleteBtn.addEventListener('click', () => this._deletePreset(preset.id));
    },

    /** Đang kéo 1 slider kênh: cập nhật `_draftGains` + số dB; preset đang áp dụng thì áp gains lên audio NGAY.
     * @param {HTMLInputElement} sliderEl */
    _previewBandGain(sliderEl) {
        const index = parseInt(sliderEl.dataset.index, 10);
        if (isNaN(index)) return;
        const value = parseInt(sliderEl.value, 10);
        this._draftGains[index] = value;
        const valEl = genericDrawerBody.querySelector(`#eq-edit-val-${index}`);
        if (valEl) valEl.textContent = value > 0 ? `+${value}` : value;
        EQ_LIVE_GAINS_BY_ACTIVE[appConfigViz.getAll().eqPresetId === this._editingId](this._draftGains);
    },

    /** Thả tay slider: ghi gains đang sửa vào danh sách preset (DB). Âm thanh đã đổi sẵn lúc kéo. */
    async _commitGains() {
        const id = this._editingId;
        if (!id) return;
        const presets = appState.get('eqPresets').map((p) => (p.id === id ? { ...p, gains: this._draftGains.slice() } : p));
        appState.set('eqPresets', presets);
        console.log(`writer: "workflowEqPresets._commitGains", page: "eqPresets", content: "${id} — [${this._draftGains.join(',')}]"`);
        await setMeta('eqPresets', presets); // service/db.js
    },

    /** Rời ô Tên: ghi tên mới; rỗng -> trả về tên cũ. Preset đang áp dụng -> đổi nhãn badge EQ theo. */
    async _commitName() {
        const id = this._editingId;
        const current = findEqPresetById(appState.get('eqPresets'), id); // core
        if (!current) return;
        const name = this._draftName.trim();
        if (!name) {
            this._draftName = current.name;
            const nameInput = genericDrawerBody.querySelector('#eq-drawer-name');
            if (nameInput) nameInput.value = current.name;
            return;
        }
        const presets = appState.get('eqPresets').map((p) => (p.id === id ? { ...p, name } : p));
        appState.set('eqPresets', presets);
        console.log(`writer: "workflowEqPresets._commitName", page: "eqPresets", content: "${id} — ${name}"`);
        await setMeta('eqPresets', presets); // service/db.js
        if (appConfigViz.getAll().eqPresetId === id) syncEqBadgeLabel(name); // core
    },

    /** MỚI (07/10/2026, Giang) — nút Áp dụng trong Edit: preset chưa áp dụng -> chọn + thông báo đã chọn, nút chuyển
     * sang trạng thái khoá "Đang áp dụng"; đã áp dụng (nút khoá) -> thông báo "đang áp dụng rồi".
     * @param {string} id */
    onApplyClick(id) {
        const preset = findEqPresetById(appState.get('eqPresets'), id); // core
        if (!preset) return;
        EQ_APPLY_CLICK_BY_ACTIVE[appConfigViz.getAll().eqPresetId === id](preset);
    },

    /** Chọn preset làm preset ĐANG DÙNG (`eqPresetId`), áp gains (bản đang sửa — luôn khớp DB vì tự lưu), vẽ lại Edit
     * để nút sang trạng thái khoá, rồi hiện thông báo. (Thay `_applyPreset()` cũ.)
     * @param {object} preset */
    _applyAndNotify(preset) {
        appConfigViz.mutateAll((cfg) => { cfg.eqPresetId = preset.id; });
        console.log(`writer: "workflowEqPresets._applyAndNotify", page: "vizConfig.eqPresetId", content: "${preset.id}"`);
        applyEqGains(appState.get('eqBandNodes'), this._draftGains); // core
        syncEqBadgeLabel(preset.name); // core
        saveConfig();
        this._renderEditView(preset);
        alertModal(tFormat('eqPresets.appliedNotice', { name: escapeHtml(preset.name) }), { title: t('eqPresets.title') }); // core/modal-choice-ui.js
    },

    /** Ứng với nút "Khôi phục mặc định" trong header Edit (CHỈ hiện với preset gốc chưa khoá, xem
     * renderEqEditHeader()) — đổi _draftGains về ĐÚNG giá trị GỐC lúc seed lần đầu
     * (buildDefaultEqPresets(), core/eq-presets.js), GHI THẲNG vào danh sách preset lưu DB NGAY
     * (SỬA 12/08/2026, Giang báo bug "Reset default không ghi lại danh sách eq mặc định" — bản
     * trước chỉ đổi `_draftGains` để xem trước, không `setMeta()`, nên gains "khôi phục" bị mất
     * nếu người dùng rời Edit view mà quên bấm Lưu riêng — nay Khôi phục TỰ NÓ là 1 hành động ghi
     * hoàn chỉnh, CÙNG khuôn _commitGains()/_deletePreset() — chỉ khác
     * NGUỒN giá trị gains dùng để ghi). Tên đang gõ dở (`_draftName`) GIỮ NGUYÊN, KHÔNG ghi vào DB
     * — nút này chỉ khôi phục/ghi lại THÔNG SỐ (gains), không đụng tên.
     * @param {string} id */
    async _resetEditToDefault(id) {
        const factory = buildDefaultEqPresets().find((p) => p.id === id); // core
        if (!factory) return; // an toàn — nút vốn đã ẩn với preset không phải built-in
        this._draftGains = factory.gains.slice();
        const presets = appState.get('eqPresets').map((p) => (p.id === id ? { ...p, gains: this._draftGains.slice() } : p)); // copy — _draftGains còn bị slider sửa tại chỗ
        appState.set('eqPresets', presets);
        await setMeta('eqPresets', presets);
        if (appConfigViz.getAll().eqPresetId === id) {
            applyEqGains(appState.get('eqBandNodes'), this._draftGains); // core
        }
        const preset = findEqPresetById(presets, id); // core — lấy locked/id hiện tại (bản VỪA ghi)
        if (!preset) return;
        this._renderEditView(preset); // vẽ lại TẠI CHỖ (giữ vị trí cuộn)
    },

    // XOÁ (07/10/2026, Giang: "bỏ tính năng save") — `_saveEdit()`: slider tự lưu lúc thả tay (_commitGains()), tên lúc
    // rời ô (_commitName()); preset đang áp dụng đổi âm thanh ngay lúc kéo (_previewBandGain()).

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
