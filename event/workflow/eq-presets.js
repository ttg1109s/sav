/**
 * event/workflow/eq-presets.js — "THẰNG THỰC THI CUỐI" của router "eqPresets".
 *
 * Danh sách preset SỐNG ở `appState.eqPresets` (nạp lúc boot từ `meta.eqPresets`, seed 6 preset
 * gốc nếu DB chưa có, xem loadPresetsOnBoot()) — preset ĐANG CHỌN chỉ là 1 id đơn giản
 * (`appConfigViz.eqPresetId`, lưu bền qua saveConfig() như mọi field vizConfig khác).
 *
 * #btn-cycle-eq — DUY NHẤT 1 nút cho CẢ 2 việc (SỬA 12/08/2026, Giang yêu cầu "gộp eq edit vào
 * hold 3s, bỏ icon edit riêng" — #btn-edit-eq cũ ĐÃ BỎ HẲN):
 *   - BẤM NGẮN (thả tay TRƯỚC 3s) — cycle qua danh sách, ÁP DỤNG NGAY (CÙNG khuôn đổi hiệu ứng
 *     Visualizer, không mở gì cả) — xem cyclePreset().
 *   - GIỮ đủ 3s (chưa thả tay) — mở Generic Drawer (core/generic-drawer.js, DÙNG CHUNG —
 *     components/eq-presets-drawer.js render nội dung) — 2 mode 'list'/'edit', CÙNG khuôn Document
 *     Reader (List<->Read): Workflow này tự querySelector + addEventListener trực tiếp lên
 *     genericDrawerHeader/genericDrawerBody SAU MỖI lần mở/chuyển mode (KHÔNG qua eventBus cho các
 *     nút động bên trong Drawer — xem docstring core/generic-drawer.js).
 *   Đếm giờ 3s qua `taskManager.once()` (CÙNG khuôn SEEK_HOLD_ACTIVATE_MS,
 *   event/workflow/visualizer-gesture.js) — startCycleHold()/endCycleHold()/cancelCycleHold() ứng
 *   pointerdown/pointerup/pointercancel+pointerleave (event/listener/eq-presets.js). Cờ
 *   `_cycleHoldFired` chặn KHÔNG cho cycle chạy thêm lúc thả tay SAU KHI đã giữ đủ 3s (Drawer đã
 *   mở rồi, thả tay lúc đó không còn ý nghĩa "bấm" nữa).
 *
 * Sửa/xoá CHỈ áp dụng cho preset KHÔNG `locked` (chỉ 'flat'/Default khoá — core/eq-presets.js).
 * Sửa preset ĐANG active thì áp gains mới NGAY LẬP TỨC; sửa preset khác không ảnh hưởng âm thanh
 * đang phát.
 *
 * NẠP SAU: core/eq-presets.js, core/generic-drawer.js, components/eq-presets-drawer.js,
 * core/dom-refs.js (btnCycleEq/eqBadgeLabel/genericDrawer*), service/db.js (getMeta/setMeta),
 * service/task-manager.js (taskManager — đếm giờ giữ 3s), event/workflow/generic-drawer-
 * helpers.js (closeFully()).
 */

const EQ_CYCLE_HOLD_MS = 3000; // ngưỡng giữ để mở Edit EQ — cố định, không phải setting (cùng tinh thần SEEK_HOLD_ACTIVATE_MS)
const EQ_CYCLE_HOLD_TASK = 'eqPresetsCycleHoldPending';

const workflowEqPresets = {
    _editingId: null, // id preset đang sửa trong mode 'edit' (null nếu đang ở 'list'/đóng hẳn)
    _draftGains: null,
    _draftName: '',
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
     * EQ_CYCLE_HOLD_MS (3s), CÙNG khuôn SEEK_HOLD_ACTIVATE_MS (event/workflow/
     * visualizer-gesture.js::_onTouchStart()) — hết ngưỡng mà CHƯA thả tay -> coi là GIỮ, mở Edit
     * EQ (_fireCycleHold()) thay vì cycle. */
    startCycleHold() {
        this._cycleHoldFired = false;
        taskManager.once(() => this._fireCycleHold(), EQ_CYCLE_HOLD_MS, EQ_CYCLE_HOLD_TASK);
    },

    /** Ứng với 'eqPresets.cyclePress.end' (pointerup) — CHỈ huỷ hẹn giờ 3s nếu chưa hết (thả tay
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

    /** Hết ngưỡng CỐ ĐỊNH EQ_CYCLE_HOLD_MS (3s) giữ tay yên (pointerup CHƯA fire) -> mở Edit EQ
     * (THAY #btn-edit-eq đã bỏ, xem components/visualizer-overlay.js). */
    _fireCycleHold() {
        this._cycleHoldFired = true;
        this.openListView();
    },

    /** Ứng với 'eqPresets.cycle.click' (sự kiện `click` DOM thật trên #btn-cycle-eq — bấm tay
     * NGẮN của người dùng LẪN `targetEl.click()` do hệ Tap-3-lần/Action-slot gọi hộ, xem docstring
     * event/listener/eq-presets.js) — chặn KHÔNG cycle nếu vừa giữ đủ 3s xong (`_cycleHoldFired`,
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

    /** Mở view List của Generic Drawer EQ — gọi từ _fireCycleHold() (giữ 3s #btn-cycle-eq, THAY
     * 'eqPresets.openDrawer.click'/#btn-edit-eq đã bỏ) hoặc từ _saveEdit()/_deletePreset() (quay
     * lại List sau khi Lưu/Xoá xong). */
    openListView() {
        this._editingId = null;
        // SỬA (12/08/2026, Giang chỉ ra "khớp với generic drawer") — mở/chuyển view LUÔN dùng
        // updateGenericDrawer() nếu drawer đang mở (List <-> Edit trong CÙNG drawer), CHỈ
        // openGenericDrawer() (lần đầu) — trước đây gọi thẳng openGenericDrawer() bất kể trạng
        // thái, khiến quay lại List từ Edit bị "mở lại từ đầu" thay vì chuyển mượt (đúng bug khuôn
        // mẫu document-reader.js từng tránh, xem event/workflow/document-reader.js::openPicker()).
        const config = {
            headerHtml: renderEqListHeader(), // components/eq-presets-drawer.js
            bodyHtml: renderEqListBody(appState.get('eqPresets'), appConfigViz.getAll().eqPresetId),
            bodyClass: 'overflow-y-auto px-4 py-3',
        };
        if (genericDrawerPanel.classList.contains('hidden')) {
            openGenericDrawer(config); // core/generic-drawer.js
        } else {
            updateGenericDrawer(config); // core/generic-drawer.js
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
        const isBuiltIn = buildDefaultEqPresets().some((p) => p.id === id); // core — Workflow tự tra (Rule 3, component không tự gọi core)
        updateGenericDrawer({ // core/generic-drawer.js — chuyển mượt, không đóng/mở lại
            headerHtml: renderEqEditHeader(preset, isBuiltIn), // components/eq-presets-drawer.js
            bodyHtml: renderEqEditBody(preset),
            bodyClass: 'overflow-y-auto px-4 py-3',
        });
        this._wireEditView(preset, isBuiltIn);
    },

    _wireEditView(preset, isBuiltIn) {
        const backBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-back');
        if (backBtn) backBtn.addEventListener('click', () => this.openListView());
        if (preset.locked) return; // Default — chỉ xem, không có nút Lưu/Xoá/Khôi phục/input nào để wire thêm

        const saveBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-save');
        if (saveBtn) saveBtn.addEventListener('click', () => this._saveEdit());

        // FIX (12/08/2026, Giang yêu cầu — "eq mặc định có nút reset ở header") — CHỈ hiện/wire với
        // preset GỐC (isBuiltIn) — nút vốn không được render cho preset người dùng tự tạo (xem
        // renderEqEditHeader()), querySelector trả null thì đơn giản bỏ qua, không cần check lại
        // isBuiltIn ở đây.
        const resetBtn = genericDrawerHeader.querySelector('#btn-eq-drawer-reset');
        if (resetBtn) resetBtn.addEventListener('click', () => this._resetEditToDefault(preset.id));

        const nameInput = genericDrawerBody.querySelector('#eq-drawer-name');
        if (nameInput) nameInput.addEventListener('input', (e) => { this._draftName = e.target.value; });

        genericDrawerBody.querySelectorAll('.eq-preset-slider').forEach((slider) => {
            slider.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.index, 10);
                if (isNaN(index)) return;
                const value = parseInt(e.target.value, 10);
                this._draftGains[index] = value;
                const valEl = genericDrawerBody.querySelector(`#eq-edit-val-${index}`);
                if (valEl) valEl.textContent = value > 0 ? `+${value}` : value;
                // SỬA (12/08/2026, Giang báo "không hiển thị thanh dọc") — dải fill tím
                // (.eq-preset-slider-fill, components/eq-presets-drawer.js) giờ tự đổi left/width
                // %  NGAY khi kéo, dùng CHUNG computeEqFillRect() (component đã tính lúc render
                // lần đầu — tái dùng để 2 nơi luôn khớp công thức, không chép lại phép tính).
                const fillEl = genericDrawerBody.querySelector(`#eq-edit-fill-${index}`);
                if (fillEl) {
                    const fill = computeEqFillRect(value); // components/eq-presets-drawer.js
                    fillEl.style.bottom = `${fill.bottom}%`;
                    fillEl.style.height = `${fill.height}%`;
                }
            });
        });

        // MỚI (12/08/2026, Giang yêu cầu "thêm nút apply cạnh nút delete") — xem
        // docstring components/eq-presets-drawer.js (SỬA 3) + _applyPreset() ngay dưới.
        const applyBtn = genericDrawerBody.querySelector('#eq-drawer-apply');
        if (applyBtn) applyBtn.addEventListener('click', () => this._applyPreset(preset.id));

        const deleteBtn = genericDrawerBody.querySelector('#eq-drawer-delete');
        if (deleteBtn) deleteBtn.addEventListener('click', () => this._deletePreset(preset.id));
    },

    /** Ứng với nút "Áp dụng" cạnh Xoá trong body Edit (MỚI, 12/08/2026 — chỉ hiện với preset
     * KHÔNG locked, cùng điều kiện với nút Xoá, xem components/eq-presets-drawer.js) — CHỌN preset
     * đang sửa làm preset ĐANG DÙNG (`eqPresetId`) NGAY LẬP TỨC, đồng thời áp `_draftGains` (giá
     * trị đang chỉnh trên slider LÚC NÀY, kể cả CHƯA bấm Lưu) lên audio graph thật — cho nghe thử
     * trực tiếp trong lúc chỉnh. KHÁC HẲN Lưu (_saveEdit(), chỉ GHI DB — chỉ áp gains lên audio
     * NẾU preset đó ĐÃ SẴN đang active từ trước): Áp dụng KHÔNG ghi `_draftGains` vào danh sách
     * preset lưu DB (bấm Lưu riêng mới ghi thật — vẫn đúng nguyên tắc 1 cửa ghi DB duy nhất cho
     * "sửa nội dung 1 preset"), chỉ đổi preset nào đang ĐƯỢC CHỌN + phát ra âm thanh gì ngay bây
     * giờ. Giữ nguyên ở Edit view sau khi bấm (không quay về List) — người dùng có thể chỉnh tiếp
     * rồi Áp dụng lại nhiều lần để nghe thử trước khi quyết định Lưu.
     * @param {string} id */
    _applyPreset(id) {
        appConfigViz.mutateAll((cfg) => { cfg.eqPresetId = id; });
        applyEqGains(appState.get('eqBandNodes'), this._draftGains); // core
        const preset = findEqPresetById(appState.get('eqPresets'), id); // core
        syncEqBadgeLabel(this._draftName.trim() || (preset ? preset.name : '')); // core
        saveConfig();
    },

    /** Ứng với nút "Khôi phục mặc định" trong header Edit (CHỈ hiện với preset gốc chưa khoá, xem
     * renderEqEditHeader()) — đổi _draftGains về ĐÚNG giá trị GỐC lúc seed lần đầu
     * (buildDefaultEqPresets(), core/eq-presets.js), GHI THẲNG vào danh sách preset lưu DB NGAY
     * (SỬA 12/08/2026, Giang báo bug "Reset default không ghi lại danh sách eq mặc định" — bản
     * trước chỉ đổi `_draftGains` để xem trước, không `setMeta()`, nên gains "khôi phục" bị mất
     * nếu người dùng rời Edit view mà quên bấm Lưu riêng — nay Khôi phục TỰ NÓ là 1 hành động ghi
     * hoàn chỉnh, không phụ thuộc bấm Lưu nữa, CÙNG khuôn _saveEdit()/_deletePreset() — chỉ khác
     * NGUỒN giá trị gains dùng để ghi). Tên đang gõ dở (`_draftName`) GIỮ NGUYÊN, KHÔNG ghi vào DB
     * — nút này chỉ khôi phục/ghi lại THÔNG SỐ (gains), không đụng tên.
     * @param {string} id */
    async _resetEditToDefault(id) {
        const factory = buildDefaultEqPresets().find((p) => p.id === id); // core
        if (!factory) return; // an toàn — nút vốn đã ẩn với preset không phải built-in
        this._draftGains = factory.gains.slice();
        const presets = appState.get('eqPresets').map((p) => (p.id === id ? { ...p, gains: this._draftGains } : p));
        appState.set('eqPresets', presets);
        await setMeta('eqPresets', presets);
        if (appConfigViz.getAll().eqPresetId === id) {
            applyEqGains(appState.get('eqBandNodes'), this._draftGains); // core
        }
        const preset = findEqPresetById(presets, id); // core — lấy locked/id hiện tại (bản VỪA ghi)
        if (!preset) return;
        updateGenericDrawer({ // core/generic-drawer.js
            headerHtml: renderEqEditHeader(preset, true), // components/eq-presets-drawer.js — chắc chắn isBuiltIn (nút chỉ hiện khi true)
            bodyHtml: renderEqEditBody({ ...preset, name: this._draftName, gains: this._draftGains }),
            bodyClass: 'overflow-y-auto px-4 py-3',
        });
        this._wireEditView(preset, true);
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
