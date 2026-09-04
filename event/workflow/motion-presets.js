/**
 * event/workflow/motion-presets.js — "THẰNG THỰC THI CUỐI" của router "motionPresets" — hệ "Cấu
 * hình Motion" độc lập, điều hướng qua `workflowAppSettings.navigateTo()`/`_render()` (màn hình
 * trong Settings), KHÔNG phải Generic Drawer List<->Edit riêng như EQ.
 *
 * Danh sách preset SỐNG ở `appState.motionPresets` (nạp lúc boot từ `meta.motionPresets`, xem
 * loadPresetsOnBoot() — rỗng là HỢP LỆ, KHÔNG seed gì cả). Preset TỰ đăng ký cho nơi tiêu thụ (hiện
 * DUY NHẤT Photo Visual Background) qua `appState.motionApply` (từ màn Edit — nhóm "Áp dụng cho"),
 * nơi tiêu thụ tự chọn 1 preset TRONG SỐ đã đăng ký qua field riêng
 * (`appConfigVisualBg.motionPresetId`) — xem core/motion-presets.js.
 *
 * Toggle Point Move/React Beat Audio (công tắc tổng, `changePointMoveEnabled()`/
 * `changeBeatReactField()`) gọi THẲNG `workflowMotionEngine` (KHÔNG qua nơi tiêu thụ nào) để áp
 * SỐNG ngay lúc đang hiển thị — Motion Engine + Motion Preset cùng 1 domain "Motion", nơi tiêu thụ
 * CÓ THỂ là bất kỳ ai (hiện tại/tương lai), Motion không cần/không nên biết. Guard qua
 * `appState.motionRunning` (preset ĐANG THẬT SỰ render — Motion Engine tự ghi mỗi lần kích hoạt,
 * xem `workflowMotionEngine._setActivePreset()`) — KHÁC `motionPresetId` phía nơi tiêu thụ (đó là
 * "đang CHỌN gì", không phải "đang chạy gì").
 *
 * NẠP SAU: core/motion-presets.js, core/motion-engine.js, core/point-move-timing-ui.js,
 * components/motion-settings-drawer.js, service/db.js (getMeta/setMeta), event/workflow/
 * app-settings.js (workflowAppSettings — liên tuyến domain), event/workflow/motion-engine.js
 * (workflowMotionEngine — liên tuyến domain, áp sống toggle), event/workflow/visual-bg-common.js
 * (workflowVisualBg — liên tuyến domain, đọc/ghi `motionPresetId`), core/time-picker-modal.js.
 */

const workflowMotionPresets = {
    _editingId: null,   // preset đang sửa (màn Edit) — null nếu không ở màn Edit
    _editingApplyConsumerKey: MOTION_APPLY_CONSUMERS[0].key, // consumer ĐANG chọn ở dropdown "Áp dụng cho" (màn Edit)
    _editingPointMoveId: null, // point move đang sửa (màn Point Move Edit) — null nếu không ở màn đó
    _dragPreviewPointMoveId: null, // point move ĐANG kéo trên thanh Timing — null nếu không kéo
    _dragPreviewTimingX: 0,

    /** Gọi từ event/workflow/app-boot.js — đọc `meta.motionPresets`/`meta.motionApply`, sanitize.
     * Danh sách preset RỖNG là hợp lệ — KHÔNG seed gì (khác EQ).
     * MIGRATE — bản cũ (trước khi Motion tách khỏi Visual Background) lưu CẢ cấu hình Transition/
     * Ken Burns NGAY TRONG `meta.visualBgConfig.motion` — đọc thẳng RAW meta đó để dựng preset ĐẦU
     * TIÊN + gán `motionPresetId` + tự đăng ký preset đó cho 'photoVisualBg' trong `motionApply`
     * (đúng ý nghĩa preset MIGRATE — nó VỐN được gắn cho VBG Photo). CHỈ chạy 1 LẦN DUY NHẤT (guard:
     * `visualBgRaw.motionPresetId` CHƯA từng có). */
    async loadPresetsOnBoot() {
        const raw = await getMeta('motionPresets'); // service/db.js
        let presets = Array.isArray(raw) ? raw.map((p) => sanitizeMotionPreset(p)) : []; // core/motion-presets.js
        let motionApply = sanitizeMotionApply(await getMeta('motionApply')); // service/db.js, core/motion-presets.js

        const visualBgRaw = await getMeta('visualBgConfig'); // service/db.js — RAW
        if (visualBgRaw && typeof visualBgRaw === 'object' && visualBgRaw.motion && typeof visualBgRaw.motion === 'object' && !('motionPresetId' in visualBgRaw)) {
            const migrated = sanitizeMotionPreset({ ...visualBgRaw.motion, name: t('motionPresetsDrawer.migratedName'), transitionEnabled: true }); // core/motion-presets.js — bản cũ luôn "bật" Transition (chưa có khái niệm tắt)
            presets = [...presets, migrated];
            motionApply = subscribeMotionApply(motionApply, 'photoVisualBg', migrated.id); // core/motion-presets.js
            visualBgRaw.motionPresetId = migrated.id;
            delete visualBgRaw.motion; // dọn field cũ — schema hiện tại không còn định nghĩa
            await setMeta('visualBgConfig', visualBgRaw); // service/db.js — GHI THẲNG (VBG chưa nạp domain lúc này)
            console.log(`writer: "workflowMotionPresets.loadPresetsOnBoot", page: "motionPresets", content: "migrated legacy motion -> preset ${migrated.id}, gán motionPresetId + đăng ký photoVisualBg"`);
        }

        appState.set('motionPresets', presets);
        appState.set('motionApply', motionApply);
        await setMeta('motionPresets', presets);
        await setMeta('motionApply', motionApply); // service/db.js
        console.log(`writer: "workflowMotionPresets.loadPresetsOnBoot", page: "motionPresets", content: "${presets.length} preset"`);
    },

    async _persist() {
        await setMeta('motionPresets', appState.get('motionPresets')); // service/db.js
    },

    // ===================== Màn Menu (System > Motion) =====================
    // 2 dòng "Quản lý cấu hình"/"Áp dụng cấu hình" — bản thân render CHỈ dùng
    // `renderAppSettingsRowList()` dùng chung, không cần hàm riêng ở đây.

    // ===================== Quản lý cấu hình (danh sách) =====================

    /** Tạo preset trắng, mở NGAY màn Edit của nó. */
    async addPreset() {
        const presets = appState.get('motionPresets');
        const preset = buildBlankMotionPreset(tFormat('motionPresetsDrawer.defaultName', { n: presets.length + 1 })); // core/motion-presets.js
        appState.set('motionPresets', [...presets, preset]);
        await this._persist();
        this._editingId = preset.id;
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderMotionEdit()); // liên tuyến domain
    },

    /** Ứng tap 1 dòng preset trong danh sách — mở màn Edit.
     * @param {string} id */
    async tileClick(id) {
        this._editingId = id;
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderMotionEdit()); // liên tuyến domain
    },

    /** Ứng nút xoá nhanh trên 1 dòng — xoá thẳng, KHÔNG mở Edit trước.
     * @param {string} id */
    async quickDelete(id) {
        await this._deletePresetById(id);
        workflowAppSettings._renderMotionList(); // liên tuyến domain — vẽ lại TẠI CHỖ
    },

    // ===================== Sửa 1 preset (màn Edit) =====================

    /** Đồng bộ UI màn Edit theo preset đang sửa — gọi sau MỌI field change (Rule 5d). */
    _syncEditUI() {
        if (genericDrawerPanel.classList.contains('hidden')) return; // core/dom-refs.js
        const preset = findMotionPresetById(appState.get('motionPresets'), this._editingId); // core/motion-presets.js
        if (!preset) return;
        const q = (sel) => genericDrawerBody.querySelector(sel); // core/dom-refs.js
        const ratioRow = q('#motion-transition-ratio-row');
        if (ratioRow) ratioRow.classList.toggle('hidden', !transitionSupportsInOutRatio(preset.transitionType)); // core/motion-engine.js
        const directionRow = q('#motion-transition-direction-row');
        if (directionRow) directionRow.classList.toggle('hidden', !transitionSupportsDirection(preset.transitionType));
        const zoomDirectionRow = q('#motion-transition-zoom-direction-row');
        if (zoomDirectionRow) zoomDirectionRow.classList.toggle('hidden', !transitionSupportsZoomDirection(preset.transitionType));
        const spinDirectionRow = q('#motion-transition-spin-direction-row');
        if (spinDirectionRow) spinDirectionRow.classList.toggle('hidden', !transitionSupportsSpinDirection(preset.transitionType));
        const wipeDirectionRow = q('#motion-transition-wipe-direction-row');
        if (wipeDirectionRow) wipeDirectionRow.classList.toggle('hidden', !transitionSupportsWipeDirection(preset.transitionType));
        const curtainDirectionRow = q('#motion-transition-curtain-direction-row');
        if (curtainDirectionRow) curtainDirectionRow.classList.toggle('hidden', !transitionSupportsCurtainDirection(preset.transitionType));
        // 2 dòng phụ CHỈ hiện khi transitionType là 'flipEdge'; dòng checkbox "ảnh trước đứng yên"
        // hiện HẸP HƠN NỮA — CHỈ khi ĐỒNG THỜI edgeFlipVariant==='close'.
        const isEdgeFlip = transitionIsEdgeFlip(preset.transitionType); // core/motion-engine.js
        const variantRow = q('#motion-edge-flip-variant-row');
        if (variantRow) variantRow.classList.toggle('hidden', !isEdgeFlip);
        const staticOldRow = q('#motion-edge-flip-static-old-row');
        if (staticOldRow) staticOldRow.classList.toggle('hidden', !(isEdgeFlip && preset.edgeFlipVariant === 'close'));
        const durationBtn = q('#setting-motion-transition-duration');
        if (durationBtn) durationBtn.textContent = `${(preset.transitionDurationMs / 1000).toFixed(1)}s`;
        const ratioSlider = q('#setting-motion-transition-ratio');
        if (ratioSlider) ratioSlider.value = preset.transitionInOutRatio;
        this._updateTransitionRatioLabel(preset.transitionDurationMs, preset.transitionInOutRatio);
        // Point Move — dòng "Thứ tự chọn" CHỈ hiện khi runMode==='one', nút "Timing" + 2 checkbox
        // "force baseline" CHỈ hiện khi 'all' (MỚI — phản hồi Giang, sửa bug hard-cut baseline).
        const orderRow = q('#motion-pointmove-order-row');
        if (orderRow) orderRow.classList.toggle('hidden', preset.pointMoveRunMode !== 'one');
        const timingBtn = q('#btn-motion-pointmove-timing');
        if (timingBtn) timingBtn.classList.toggle('hidden', preset.pointMoveRunMode !== 'all');
        const startForceRow = q('#motion-pointmove-start-force-row');
        if (startForceRow) startForceRow.classList.toggle('hidden', preset.pointMoveRunMode !== 'all');
        const endForceRow = q('#motion-pointmove-end-force-row');
        if (endForceRow) endForceRow.classList.toggle('hidden', preset.pointMoveRunMode !== 'all');
        // Đồng bộ trạng thái tick (bật 1 cái có thể đã tự TẮT cái kia — xem
        // changePointMoveStartForceBaseline()/changePointMoveEndForceBaseline() ngay dưới).
        const startForceCb = q('#setting-motion-pointmove-start-force-baseline');
        if (startForceCb) startForceCb.checked = preset.pointMoveStartForceBaseline;
        const endForceCb = q('#setting-motion-pointmove-end-force-baseline');
        if (endForceCb) endForceCb.checked = preset.pointMoveEndForceBaseline;
        this._syncApplyButton();
    },

    _updateTransitionRatioLabel(transitionDurationMs, ratioPercent) {
        const labelEl = genericDrawerBody ? genericDrawerBody.querySelector('#motion-transition-ratio-label') : null; // core/dom-refs.js
        if (!labelEl) return;
        const { inMs, outMs } = computeMotionEngineTransitionInOutMs(transitionDurationMs, ratioPercent); // core/motion-engine.js
        labelEl.textContent = tFormat('motionSettingsDrawer.transitionRatio.previewFormat', { in: (inMs / 1000).toFixed(1), out: (outMs / 1000).toFixed(1) });
    },

    /** Ghi đè 1 (vài) field của preset ĐANG SỬA (`_editingId`).
     * @param {(preset: object) => void} mutatorFn */
    async _mutateEditing(mutatorFn) {
        const presets = appState.get('motionPresets').map((p) => {
            if (p.id !== this._editingId) return p;
            const copy = { ...p };
            mutatorFn(copy);
            return copy;
        });
        appState.set('motionPresets', presets);
        await this._persist();
    },

    async changeName(name) {
        const trimmed = name.trim();
        if (!trimmed) return; // guard: tên rỗng -> bỏ qua, giữ tên cũ
        await this._mutateEditing((p) => { p.name = trimmed; });
    },

    async changeTransitionEnabled(checked) {
        await this._mutateEditing((p) => { p.transitionEnabled = checked; });
    },

    async changeTransitionType(value) {
        if (!MOTION_ENGINE_TRANSITION_TYPES.includes(value)) return; // core/motion-engine.js
        await this._mutateEditing((p) => { p.transitionType = value; });
        this._syncEditUI();
    },

    async changeTransitionDirection(value) {
        if (!MOTION_ENGINE_TRANSITION_DIRECTIONS_WITH_RANDOM.includes(value)) return; // core/motion-presets.js
        await this._mutateEditing((p) => { p.transitionDirection = value; });
    },

    async changeTransitionZoomDirection(value) {
        if (!MOTION_ENGINE_ZOOM_DIRECTIONS_WITH_RANDOM.includes(value)) return; // core/motion-presets.js
        await this._mutateEditing((p) => { p.transitionZoomDirection = value; });
    },

    async changeTransitionSpinDirection(value) {
        if (!MOTION_ENGINE_SPIN_DIRECTIONS_WITH_RANDOM.includes(value)) return; // core/motion-presets.js
        await this._mutateEditing((p) => { p.transitionSpinDirection = value; });
    },

    async changeTransitionWipeDirection(value) {
        if (!MOTION_ENGINE_WIPE_DIRECTIONS_WITH_RANDOM.includes(value)) return; // core/motion-presets.js
        await this._mutateEditing((p) => { p.transitionWipeDirection = value; });
    },

    async changeTransitionCurtainDirection(value) {
        if (!MOTION_ENGINE_CURTAIN_DIRECTIONS_WITH_RANDOM.includes(value)) return; // core/motion-presets.js
        await this._mutateEditing((p) => { p.transitionCurtainDirection = value; });
    },

    async changeEdgeFlipVariant(value) {
        if (!MOTION_ENGINE_EDGE_FLIP_VARIANTS.includes(value)) return; // core/motion-presets.js
        await this._mutateEditing((p) => { p.edgeFlipVariant = value; });
        this._syncEditUI(); // "close"/"open" đổi -> hàng checkbox edgeFlipStaticOld có thể cần ẩn/hiện lại
    },

    async changeEdgeFlipStaticOld(checked) {
        await this._mutateEditing((p) => { p.edgeFlipStaticOld = checked; });
    },

    /** Ứng nút mở modal chọn "Thời gian chuyển cảnh" — picker CHỈ còn trần cứng
     * `MOTION_ENGINE_TRANSITION_MAX_TIME_MS` (60s)/`MOTION_ENGINE_TRANSITION_MIN_TIME_MS` (300ms).
     * Kẹp THẬT (< thời lượng hiển thị thật) chỉ xảy ra ở RUNTIME qua
     * `capMotionEngineTransitionDurationMs()` (core, đã có sẵn trong workflowMotionEngine). */
    openTransitionDurationPicker() {
        if (genericDrawerPanel.classList.contains('hidden')) return;
        const preset = findMotionPresetById(appState.get('motionPresets'), this._editingId); // core/motion-presets.js
        if (!preset) return;
        const maxMs = MOTION_ENGINE_TRANSITION_MAX_TIME_MS; // core/motion-engine.js
        openTimePickerModal({ // core/time-picker-modal.js
            title: t('motionSettingsDrawer.transitionDuration.pickerTitle'),
            format: 's-ms',
            valueMs: Math.min(preset.transitionDurationMs, maxMs),
            minMs: MOTION_ENGINE_TRANSITION_MIN_TIME_MS, // core/motion-engine.js
            maxMs,
            onConfirm: async (resultMs) => {
                const v = Math.max(MOTION_ENGINE_TRANSITION_MIN_TIME_MS, Math.min(maxMs, resultMs));
                await this._mutateEditing((p) => { p.transitionDurationMs = v; });
                if (genericDrawerPanel.classList.contains('hidden')) return;
                const btn = genericDrawerBody.querySelector('#setting-motion-transition-duration');
                if (btn) btn.textContent = `${(v / 1000).toFixed(1)}s`;
                const ratioSlider = genericDrawerBody.querySelector('#setting-motion-transition-ratio');
                this._updateTransitionRatioLabel(v, ratioSlider ? Number(ratioSlider.value) : 50);
            },
        });
    },

    previewTransitionRatio(ratioPercent) {
        if (genericDrawerPanel.classList.contains('hidden')) return;
        const preset = findMotionPresetById(appState.get('motionPresets'), this._editingId); // core/motion-presets.js
        if (preset) this._updateTransitionRatioLabel(preset.transitionDurationMs, ratioPercent);
    },

    async changeTransitionRatio(ratioPercent) {
        const v = Math.max(0, Math.min(100, ratioPercent));
        await this._mutateEditing((p) => { p.transitionInOutRatio = v; });
        this._updateTransitionRatioLabel(findMotionPresetById(appState.get('motionPresets'), this._editingId).transitionDurationMs, v); // core/motion-presets.js
    },

    async changeTransitionEasing(easing) {
        if (!MOTION_ENGINE_TRANSITION_EASINGS.includes(easing)) return; // core/motion-engine.js
        await this._mutateEditing((p) => { p.transitionEasing = easing; });
    },

    // ===================== Point Move (thay Ken Burns) =====================

    /** Công tắc TỔNG (CÙNG khuôn `transitionEnabled`/`reactBeatAudio.enabled`) — Point Move có được
     * ÁP DỤNG lúc phát hay không, ĐỘC LẬP với việc list/run mode/timing đã cấu hình gì (LUÔN hiển
     * thị/chỉnh được bất kể bật/tắt — xem event/workflow/motion-engine.js::_activatePointMove()).
     * SỬA (phản hồi Giang — off/on giữa lúc ảnh đang hiện phải áp NGAY, không đợi ảnh đổi) — check
     * THẲNG `appState.motionRunning` (preset ĐANG THẬT SỰ render — Motion Engine tự ghi, xem
     * `_setActivePreset()`) rồi gọi THẲNG Motion Engine áp sống — KHÔNG qua nơi tiêu thụ nào (Motion
     * Engine + Motion Preset cùng 1 domain "Motion", nơi tiêu thụ CÓ THỂ là bất kỳ ai, Motion không
     * cần/không nên biết — xem `workflowMotionEngine.livePointMoveToggle()`). */
    async changePointMoveEnabled(checked) {
        await this._mutateEditing((p) => { p.pointMoveEnabled = checked; });
        if (appState.get('motionRunning') === this._editingId && typeof workflowMotionEngine !== 'undefined') {
            workflowMotionEngine.livePointMoveToggle(this._editingId, checked); // liên tuyến domain — Motion Engine, KHÔNG qua nơi tiêu thụ
        }
    },

    /** Ứng dòng "Point move" trong màn Edit — mở danh sách point move. */
    openPointMoveList() {
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderPointMoveList()); // liên tuyến domain
    },

    async changePointMoveRunMode(mode) {
        if (!MOTION_POINT_MOVE_RUN_MODES.includes(mode)) return; // core/motion-presets.js
        await this._mutateEditing((p) => { p.pointMoveRunMode = mode; });
        this._syncEditUI();
    },

    async changePointMoveOneOrder(order) {
        if (!MOTION_POINT_MOVE_ONE_ORDERS.includes(order)) return; // core/motion-presets.js
        await this._mutateEditing((p) => { p.pointMoveOneOrder = order; });
    },

    /** Checkbox "Start point: force baseline" (CHỈ có ý nghĩa khi `pointMoveRunMode==='all'`) — CHỈ
     * ĐƯỢC 1 TRONG 2 (start/end) bật cùng lúc (phản hồi Giang) — bật cái này tự TẮT "End force
     * baseline" nếu đang bật. SỬA LẦN 2 (phản hồi Giang — bug "giật cứng" tái xuất hiện) — 2 field
     * này giờ dùng CHUNG 1 cơ chế (chèn mốc ảo x=100=baseline vào đuôi MỌI vòng, xem
     * event/workflow/motion-engine.js::_activatePointMoveAll()), nên nudge point move đang đứng
     * đúng mốc bị khoá cũng DÙNG CHUNG mốc x=100 (KHÔNG còn x=0 nữa, +0.2% CÙNG quy ước
     * addPointMove()).
     * @param {boolean} checked */
    async changePointMoveStartForceBaseline(checked) {
        await this._mutateEditing((p) => {
            p.pointMoveStartForceBaseline = checked;
            if (checked) {
                p.pointMoveEndForceBaseline = false;
                p.pointMoves = p.pointMoves.map((pm) => (pm.timingX === 100 ? { ...pm, timingX: 99.9 } : pm));
            }
        });
        this._syncEditUI();
    },

    /** Checkbox "Endpoint: force baseline" — CÙNG cơ chế `changePointMoveStartForceBaseline()` ngay
     * trên (2 checkbox giờ chỉ khác NHÃN/khung nhìn người dùng chọn, không khác hành vi runtime).
     * @param {boolean} checked */
    async changePointMoveEndForceBaseline(checked) {
        await this._mutateEditing((p) => {
            p.pointMoveEndForceBaseline = checked;
            if (checked) {
                p.pointMoveStartForceBaseline = false;
                p.pointMoves = p.pointMoves.map((pm) => (pm.timingX === 100 ? { ...pm, timingX: 99.9 } : pm));
            }
        });
        this._syncEditUI();
    },

    /** Biên [minX,maxX] kéo/nhập `timingX` HIỆN TẠI của preset đang sửa — `maxX` hẹp lại (99.9) khi
     * 1 trong 2 cờ force-baseline đang bật (mốc x=100 đó do baseline chiếm, xem docstring 2 hàm
     * trên) — `minX` LUÔN 0 (SỬA LẦN 2 — mốc x=0 không còn bị field nào khoá nữa, xem
     * event/workflow/motion-engine.js::_activatePointMoveAll()). DÙNG CHUNG cho thanh Timing
     * (`_renderTimingCurve()`) LẪN modal nhập số (`_commitPointMoveTimingModal()`) — tránh lệch biên
     * giữa 2 nơi.
     * @param {object} preset @returns {{minX:number, maxX:number}} */
    _pointMoveTimingBounds(preset) {
        return {
            minX: 0,
            maxX: (preset.pointMoveStartForceBaseline || preset.pointMoveEndForceBaseline) ? 99.9 : 100,
        };
    },

    /** Ứng checkbox 1 dòng trong danh sách point move — VỊ TRÍ ĐẦU (index 0) khoá `checked:true`,
     * UI đã disable checkbox đó nên message này thực tế KHÔNG bao giờ gửi cho id ở vị trí 0 (phòng
     * hờ vẫn guard lại ở đây — không tin payload mù).
     * @param {string} id @param {boolean} checked */
    async togglePointMoveChecked(id, checked) {
        await this._mutateEditing((p) => {
            const idx = p.pointMoves.findIndex((pm) => pm.id === id);
            if (idx <= 0) return; // guard: không tìm thấy HOẶC đúng vị trí đầu -> bỏ qua, giữ nguyên khoá
            p.pointMoves[idx] = { ...p.pointMoves[idx], checked };
        });
        workflowAppSettings._renderPointMoveList(); // liên tuyến domain — vẽ lại TẠI CHỖ
    },

    /** Thêm 1 point move trắng vào CUỐI danh sách — `timingX` tự tịnh tiến +0.2% so với point move
     * CUỐI hiện có (kẹp tối đa 100%, phản hồi Giang — tránh chồng khít lên nhau tại 0% mỗi lần thêm,
     * dễ thấy/dễ kéo tách ra hơn ngay khi vừa tạo), vẽ lại TẠI CHỖ. */
    async addPointMove() {
        await this._mutateEditing((p) => {
            const blank = buildBlankPointMove(); // core/motion-presets.js
            const lastTimingX = p.pointMoves.length > 0 ? p.pointMoves[p.pointMoves.length - 1].timingX : 0;
            blank.timingX = Math.min(this._pointMoveTimingBounds(p).maxX, lastTimingX + 0.2); // SỬA (phản hồi Giang) — kẹp theo biên ĐỘNG, không còn cố định 100
            p.pointMoves = [...p.pointMoves, blank];
        });
        workflowAppSettings._renderPointMoveList(); // liên tuyến domain
    },

    /** Nhân bản 1 point move — bản sao GIỮ NGUYÊN mọi thông số (deep-copy 6 field con, tránh 2 point
     * move cùng trỏ chung 1 object field gây sửa 1 bên ảnh hưởng bên kia), `id` MỚI, LUÔN `checked:
     * true` mặc định, `timingX` tự tịnh tiến +0.2% (CÙNG quy tắc `addPointMove()` — tránh chồng khít
     * lên bản gốc), chèn vào CUỐI danh sách. Vẽ lại TẠI CHỖ.
     * @param {string} id */
    async duplicatePointMove(id) {
        await this._mutateEditing((p) => {
            const original = p.pointMoves.find((pm) => pm.id === id);
            if (!original) return;
            const lastTimingX = p.pointMoves[p.pointMoves.length - 1].timingX;
            const clone = {
                ...original,
                id: generatePointMoveId(), // core/motion-presets.js
                checked: true,
                timingX: Math.min(this._pointMoveTimingBounds(p).maxX, lastTimingX + 0.2), // SỬA (phản hồi Giang) — kẹp theo biên ĐỘNG, không còn cố định 100
                linearX: { ...original.linearX }, linearY: { ...original.linearY },
                rotate: { ...original.rotate }, zoom: { ...original.zoom },
                flipX: { ...original.flipX }, flipY: { ...original.flipY },
            };
            p.pointMoves = [...p.pointMoves, clone];
        });
        workflowAppSettings._renderPointMoveList(); // liên tuyến domain
    },

    /** Ứng kéo-thả đổi vị trí TRONG màn Danh sách — HOÁN ĐỔI TOÀN BỘ 2 phần tử mảng (order N VÀ mọi
     * field khác, bao gồm `timingX` — phản hồi Giang: "hai cái hoán đổi là đồng thời", đây là 1 thao
     * tác DUY NHẤT (trao đổi hẳn 2 object trong mảng), KHÔNG PHẢI 2 bước tách rời — `timingX` tự
     * "đi theo" object vì nó là field CỦA object đó, giống mọi list kéo-thả sắp xếp lại tiêu chuẩn.
     * Vị trí ĐẦU (index 0) VẪN hoán đổi được bình thường — nếu kết quả đẩy 1 object KHÁC vào index 0,
     * nó TỰ bị khoá `checked:true` qua `sanitizeMotionPointMoves()` (khoá theo VỊ TRÍ, không theo
     * object cụ thể nào — đúng quy tắc đã chốt từ đầu).
     * @param {string} idA @param {string} idB */
    async swapPointMoveOrder(idA, idB) {
        if (idA === idB) return;
        await this._mutateEditing((p) => {
            const idxA = p.pointMoves.findIndex((pm) => pm.id === idA);
            const idxB = p.pointMoves.findIndex((pm) => pm.id === idB);
            if (idxA === -1 || idxB === -1) return;
            const newList = [...p.pointMoves];
            [newList[idxA], newList[idxB]] = [newList[idxB], newList[idxA]];
            p.pointMoves = sanitizeMotionPointMoves(newList); // core/motion-presets.js — ép lại khoá checked vị trí đầu ngay
        });
        workflowAppSettings._renderPointMoveList(); // liên tuyến domain
    },

    /** Xoá 1 point move — LUÔN giữ ít nhất 1 phần tử (guard, UI đã disable nút xoá khi chỉ còn 1,
     * phòng hờ vẫn chặn lại ở đây). Nếu phần tử VỊ TRÍ ĐẦU bị xoá, phần tử KẾ TIẾP tự trở thành vị
     * trí đầu MỚI và tự bị khoá `checked` qua `sanitizeMotionPointMoves()` lúc `_mutateEditing` ghi
     * lại — KHÔNG cần xử lý riêng ở đây.
     * @param {string} id */
    async deletePointMove(id) {
        await this._mutateEditing((p) => {
            if (p.pointMoves.length <= 1) return; // guard: không xoá xuống dưới 1
            const filtered = p.pointMoves.filter((pm) => pm.id !== id);
            p.pointMoves = sanitizeMotionPointMoves(filtered); // core/motion-presets.js — ép lại khoá checked vị trí đầu ngay (không đợi lượt sanitize kế tiếp)
        });
        workflowAppSettings._renderPointMoveList(); // liên tuyến domain
    },

    /** Ứng icon sửa 1 dòng — mở màn Point Move Edit.
     * @param {string} id */
    openPointMoveEdit(id) {
        this._editingPointMoveId = id;
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderPointMoveEdit()); // liên tuyến domain
    },

    /** Ghi đè 1 (vài) field của point move ĐANG SỬA (`_editingPointMoveId`, thuộc preset `_editingId`).
     * @param {(pointMove: object) => void} mutatorFn */
    async _mutateEditingPointMove(mutatorFn) {
        await this._mutateEditing((p) => {
            const idx = p.pointMoves.findIndex((pm) => pm.id === this._editingPointMoveId);
            if (idx === -1) return;
            const copy = { ...p.pointMoves[idx] };
            mutatorFn(copy);
            p.pointMoves = p.pointMoves.map((pm, i) => (i === idx ? copy : pm));
        });
    },

    /** Đổi đơn vị Linear X/Y (%/px) — RESET single/rangeMin/rangeMax về 0 (2 đơn vị không cùng
     * thang đo, giữ nguyên con số cũ sẽ vô nghĩa/gây hiểu lầm — vd 150% giữ nguyên số nhưng đổi
     * sang 150px là 1 giá trị HOÀN TOÀN khác ý người dùng đang có).
     * @param {'linearX'|'linearY'} fieldKey @param {string} unit - '%'|'px'. */
    async changePointMoveUnit(fieldKey, unit) {
        if (!MOTION_POINT_MOVE_LINEAR_UNITS.includes(unit)) return; // core/motion-presets.js
        await this._mutateEditingPointMove((pm) => { pm[fieldKey] = { mode: 'single', unit, single: 0, rangeMin: 0, rangeMax: 0 }; });
        workflowAppSettings._renderPointMoveEdit(); // liên tuyến domain — vẽ lại TẠI CHỖ (biên số học đổi theo unit mới)
    },

    /** Đổi chế độ 1 field (single/randomRange).
     * @param {string} fieldKey - 'linearX'|'linearY'|'rotate'|'zoom'|'flipX'|'flipY'.
     * @param {string} mode - 'single'|'randomRange'. */
    async changePointMoveFieldMode(fieldKey, mode) {
        if (!MOTION_POINT_MOVE_FIELD_MODES.includes(mode)) return; // core/motion-presets.js
        await this._mutateEditingPointMove((pm) => { pm[fieldKey] = { ...pm[fieldKey], mode }; });
        this._syncPointMoveEditUI(fieldKey);
    },

    /** Ứng slider "single" (mode==='single') — LIVE preview lúc kéo (`input`), KHÔNG persist mỗi
     * pixel (cùng convention `previewTransitionRatio()`/`transitionRatio.preview` đã có) — chỉ cập
     * nhật nhãn giá trị, persist THẬT diễn ra ở `changePointMoveFieldSingle()` lúc thả tay (`change`). */
    previewPointMoveFieldSingle(fieldKey, value) {
        if (genericDrawerPanel.classList.contains('hidden')) return; // core/dom-refs.js
        const labelEl = genericDrawerBody.querySelector(`#ptmove-${fieldKey}-value-label`);
        if (!labelEl) return;
        const preset = findMotionPresetById(appState.get('motionPresets'), this._editingId); // core/motion-presets.js
        const pointMove = preset ? findPointMoveById(preset.pointMoves, this._editingPointMoveId) : null; // core/motion-presets.js
        const suffix = pointMove ? (pointMove[fieldKey].unit || (fieldKey === 'zoom' ? '' : '°')) : '';
        labelEl.textContent = `${value}${suffix}`;
    },

    /** Ứng slider "single" (mode==='single') — persist THẬT lúc thả tay (`change`). */
    async changePointMoveFieldSingle(fieldKey, value) {
        if (typeof value !== 'number') return;
        await this._mutateEditingPointMove((pm) => { pm[fieldKey] = { ...pm[fieldKey], single: value }; });
        this._updatePointMoveFieldLabel(fieldKey);
    },

    /** Ứng 1 trong 2 tay kéo dual-range (mode==='randomRange') — `which` phân biệt tay TRÁI/PHẢI.
     * TỰ kẹp min<=max (tay trái vượt tay phải -> đẩy tay phải theo, và ngược lại) — tránh khoảng
     * random rỗng/đảo ngược.
     * @param {string} fieldKey @param {'min'|'max'} which @param {number} value */
    async changePointMoveFieldRange(fieldKey, which, value) {
        if (typeof value !== 'number') return;
        await this._mutateEditingPointMove((pm) => {
            const field = { ...pm[fieldKey] };
            if (which === 'min') { field.rangeMin = value; if (field.rangeMax < value) field.rangeMax = value; }
            else { field.rangeMax = value; if (field.rangeMin > value) field.rangeMin = value; }
            pm[fieldKey] = field;
        });
        workflowAppSettings._renderPointMoveEdit(); // liên tuyến domain — vẽ lại TẠI CHỖ (2 tay kéo có thể cùng đổi vị trí)
    },

    /** Đồng bộ UI 1 field sau khi đổi mode (single<->randomRange) — ẨN/HIỆN đúng cụm slider, KHÔNG
     * full re-render (giữ nguyên vị trí cuộn màn hình). */
    _syncPointMoveEditUI(fieldKey) {
        if (genericDrawerPanel.classList.contains('hidden')) return; // core/dom-refs.js
        const preset = findMotionPresetById(appState.get('motionPresets'), this._editingId); // core/motion-presets.js
        const pointMove = preset ? findPointMoveById(preset.pointMoves, this._editingPointMoveId) : null;
        if (!pointMove) return;
        const field = pointMove[fieldKey];
        const singleWrap = genericDrawerBody.querySelector(`#ptmove-${fieldKey}-single-wrap`);
        const rangeWrap = genericDrawerBody.querySelector(`#ptmove-${fieldKey}-range-wrap`);
        if (singleWrap) singleWrap.style.display = field.mode === 'single' ? '' : 'none';
        if (rangeWrap) rangeWrap.style.display = field.mode === 'single' ? 'none' : '';
        this._updatePointMoveFieldLabel(fieldKey);
    },

    _updatePointMoveFieldLabel(fieldKey) {
        if (genericDrawerPanel.classList.contains('hidden')) return; // core/dom-refs.js
        const preset = findMotionPresetById(appState.get('motionPresets'), this._editingId); // core/motion-presets.js
        const pointMove = preset ? findPointMoveById(preset.pointMoves, this._editingPointMoveId) : null;
        if (!pointMove) return;
        const field = pointMove[fieldKey];
        const labelEl = genericDrawerBody.querySelector(`#ptmove-${fieldKey}-value-label`);
        if (!labelEl) return;
        const suffix = field.unit || (fieldKey === 'zoom' ? '' : '°');
        labelEl.textContent = field.mode === 'single' ? `${field.single}${suffix}` : `${field.rangeMin}${suffix} ~ ${field.rangeMax}${suffix}`;
        const fillEl = genericDrawerBody.querySelector(`#ptmove-${fieldKey}-range-fill`);
        if (fillEl) {
            const minInput = genericDrawerBody.querySelector(`#setting-ptmove-${fieldKey}-rangemin`);
            const maxInput = genericDrawerBody.querySelector(`#setting-ptmove-${fieldKey}-rangemax`);
            if (minInput && maxInput) {
                const lo = Number(minInput.min), hi = Number(minInput.max);
                const leftPct = ((Number(minInput.value) - lo) / (hi - lo)) * 100;
                const rightPct = ((Number(maxInput.value) - lo) / (hi - lo)) * 100;
                fillEl.style.left = `${leftPct}%`;
                fillEl.style.width = `${Math.max(0, rightPct - leftPct)}%`;
            }
        }
    },

    // ===================== Point Move — Timing (chỉ dùng khi pointMoveRunMode==='all') =====================

    /** Ứng nút "Timing" trong màn Edit — mở màn thanh Timing. */
    openPointMoveTiming() {
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderPointMoveTiming()); // liên tuyến domain
    },

    /** Tính danh sách node (CHỈ point move đã tick, sort theo `timingX`) — DÙNG CHUNG cho
     * `_renderTimingCurve()` (dựng lại TOÀN BỘ SVG) LẪN `_patchTimingPreview()` (chỉ vá lại phần tử
     * ĐANG có, xem 2 hàm dưới). `overrideId` khác null -> point move ĐÓ dùng `overrideTimingX` thay
     * vì giá trị đã lưu (preview LIVE, chưa persist).
     * @param {object} preset @param {string|null} overrideId @param {number} [overrideTimingX]
     * @returns {object[]} */
    _computeTimingPoints(preset, overrideId, overrideTimingX) {
        return preset.pointMoves
            .filter((p) => p.checked)
            .map((p) => (p.id === overrideId ? { ...p, timingX: overrideTimingX } : p))
            .map((p) => ({ id: p.id, timingX: p.timingX, locked: preset.pointMoves[0].id === p.id, n: preset.pointMoves.findIndex((pm) => pm.id === p.id) })) // `n` = ĐÚNG index trong MẢNG GỐC (khớp tên "Point move N" ở màn Danh sách), không phải vị trí sau khi lọc/sort ở đây
            .sort((a, b) => a.timingX - b.timingX);
    },

    /** Dựng lại TOÀN BỘ SVG (xoá sạch + `buildPointMoveTimingCurveEl()` mới) — CHỈ gọi lúc mở màn
     * lần đầu hoặc SAU KHI đã persist xong 1 lượt sửa (commit) — KHÔNG gọi liên tục lúc đang kéo
     * (xem `_patchTimingPreview()`, tách riêng đúng vì lý do đó: xoá/dựng lại SVG giữa chừng lúc
     * đang kéo sẽ làm `draggingEl`/toạ độ core-ui đang giữ bị "treo" — phần tử cũ đã bị gỡ khỏi DOM,
     * `getBoundingClientRect()` trả về rỗng, toạ độ tính tiếp sẽ sai/NaN).
     * @param {HTMLElement} containerEl - `#ptmove-timing-container`. */
    _renderTimingCurve(containerEl) {
        if (!containerEl) return;
        const preset = findMotionPresetById(appState.get('motionPresets'), this._editingId); // core/motion-presets.js
        if (!preset) return;
        const points = this._computeTimingPoints(preset, this._dragPreviewPointMoveId, this._dragPreviewTimingX);
        const { minX, maxX } = this._pointMoveTimingBounds(preset);
        containerEl.innerHTML = '';
        containerEl.appendChild(buildPointMoveTimingCurveEl(points, minX, maxX)); // core/point-move-timing-ui.js
    },

    /** Vá LIVE vị trí 1 node NGAY TRONG SVG đang có (KHÔNG xoá/dựng lại — xem lý do ở
     * `_renderTimingCurve()`).
     * @param {string} id @param {number} timingX */
    _patchTimingPreview(id, timingX) {
        if (genericDrawerPanel.classList.contains('hidden')) return; // core/dom-refs.js
        const container = genericDrawerBody.querySelector('#ptmove-timing-container'); // core/dom-refs.js
        const svgEl = container ? container.querySelector('.ptmove-timing-svg') : null;
        const nodeEl = svgEl ? svgEl.querySelector(`circle[data-point-move-id="${id}"]`) : null;
        if (!nodeEl) return;
        const usableW = POINT_MOVE_TIMING_SVG_W - POINT_MOVE_TIMING_PAD_X * 2; // core/point-move-timing-ui.js (consts)
        nodeEl.setAttribute('cx', POINT_MOVE_TIMING_PAD_X + (timingX / 100) * usableW);
    },

    /** Preview LIVE khi đang kéo 1 node (mỗi `pointermove`, KHÔNG persist) — vá tại chỗ.
     * @param {string} id @param {number} timingX */
    previewPointMoveTimingDrag(id, timingX) {
        this._dragPreviewPointMoveId = id;
        this._dragPreviewTimingX = timingX;
        this._patchTimingPreview(id, timingX);
    },

    /** `pointerup` sau khi ĐÃ kéo đủ xa (core-ui tự phân biệt tap/kéo) — CHỐT giá trị đang preview
     * vào preset thật (persist), dựng lại TOÀN MÀN cho chắc ăn đồng bộ tuyệt đối sau khi ghi. */
    async commitPointMoveTimingDrag() {
        const id = this._dragPreviewPointMoveId;
        if (!id) return;
        const timingX = this._dragPreviewTimingX;
        this._dragPreviewPointMoveId = null;
        await this._mutateEditing((p) => {
            const idx = p.pointMoves.findIndex((pm) => pm.id === id);
            if (idx === -1) return;
            p.pointMoves[idx] = { ...p.pointMoves[idx], timingX };
        });
        if (genericDrawerPanel.classList.contains('hidden')) return; // core/dom-refs.js
        workflowAppSettings._renderPointMoveTiming(); // liên tuyến domain — dựng lại TOÀN màn (an toàn, commit chỉ xảy ra 1 lần lúc thả tay, không phải mỗi pixel)
    },

    /** Ứng TAP (không kéo) 1 node trên thanh — mở modal nhập số CHÍNH XÁC thay vì kéo tay.
     * @param {string} id */
    openPointMoveTimingNodeModal(id) {
        const preset = findMotionPresetById(appState.get('motionPresets'), this._editingId); // core/motion-presets.js
        if (!preset) return;
        const idx = preset.pointMoves.findIndex((p) => p.id === id);
        if (idx === -1) return;
        const pm = preset.pointMoves[idx];
        const { minX, maxX } = this._pointMoveTimingBounds(preset); // SỬA (phản hồi Giang) — biên ĐỘNG, không còn cố định [0,100]
        let draftX = pm.timingX;
        modalChoice( // core/modal-choice-ui.js
            tFormat('motionSettingsDrawer.pointMove.itemName', { n: idx }),
            [{
                label: t('common.save'),
                className: 'flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-sm font-semibold transition-colors',
                onClick: () => this._commitPointMoveTimingModal(id, draftX),
            }],
            {
                bodyHtml: `
                    <label class="block text-xs text-slate-400 mb-1">${escapeHtml(t('motionSettingsDrawer.pointMove.timing.xLabel'))}</label>
                    <input type="number" id="ptmove-modal-x-input" min="${minX}" max="${maxX}" step="1" value="${pm.timingX}" class="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none">
                `,
            },
        );
        const xInput = document.getElementById('ptmove-modal-x-input');
        if (xInput) xInput.addEventListener('input', (e) => { draftX = Number(e.target.value); });
    },

    /** Ứng nút "Lưu" trong modal (`openPointMoveTimingNodeModal()`) — commit số ĐÃ gõ, tự kẹp biên
     * (phòng số ngoài min/max input, dù browser thường tự chặn — vẫn không tin mù).
     * @param {string} id @param {number} timingX */
    async _commitPointMoveTimingModal(id, timingX) {
        if (typeof timingX !== 'number' || Number.isNaN(timingX)) return;
        const preset = findMotionPresetById(appState.get('motionPresets'), this._editingId); // core/motion-presets.js
        if (!preset) return;
        const { minX, maxX } = this._pointMoveTimingBounds(preset); // SỬA (phản hồi Giang) — biên ĐỘNG, không còn cố định [0,100]
        const clampedX = Math.max(minX, Math.min(maxX, timingX));
        await this._mutateEditing((p) => {
            const idx = p.pointMoves.findIndex((pm) => pm.id === id);
            if (idx === -1) return;
            p.pointMoves[idx] = { ...p.pointMoves[idx], timingX: clampedX };
        });
        if (genericDrawerPanel.classList.contains('hidden')) return; // core/dom-refs.js
        workflowAppSettings._renderPointMoveTiming(); // liên tuyến domain
    },

    // ===================== React Beat Audio =====================

    /** Ứng MỌI thay đổi field trong nhóm "React Beat Audio" — GENERIC 1 hàm DUY NHẤT cho cả field
     * top-level (`enabled`, `effectKey=null`) LẪN 3 cụm con zoom/pan/rotate (`effectKey` tương ứng).
     * `replaceMovement` ĐÃ XOÁ (hết ý nghĩa từ khi Ken Burns không còn để "thay thế" — xem
     * core/motion-presets.js) — KHÔNG còn trong danh sách `fieldKey` hợp lệ.
     * Công tắc tổng (`effectKey===null, fieldKey==='enabled'`) đổi thì check THẲNG
     * `appState.motionRunning` rồi báo SỐNG sang Motion Engine NGAY (KHÔNG qua nơi tiêu thụ, cùng
     * lý do `changePointMoveEnabled()` ngay trên, xem `workflowMotionEngine.liveBeatReactToggle()`).
     * @param {'zoom'|'pan'|'rotate'|null} effectKey - null = field top-level.
     * @param {string} fieldKey - 'enabled' | 'maxPct' | 'maxDeg' | 'direction' | 'reverse'.
     * @param {boolean|number|string} value
     */
    async changeBeatReactField(effectKey, fieldKey, value) {
        if (fieldKey === 'enabled' || fieldKey === 'reverse') {
            if (typeof value !== 'boolean') return;
        } else if (fieldKey === 'maxPct') {
            const [min, max] = effectKey === 'pan' ? [100, 150] : [100, 200]; // zoom
            if (typeof value !== 'number' || value < min || value > max) return;
        } else if (fieldKey === 'maxDeg') {
            if (typeof value !== 'number' || value < 0 || value > 360) return;
        } else if (fieldKey === 'direction') {
            if (!MOTION_BEAT_REACT_DIRECTIONS.includes(value)) return; // core/motion-presets.js
        } else {
            return; // fieldKey lạ -> bỏ qua, không ghi mù
        }
        await this._mutateEditing((p) => {
            const target = effectKey ? p.reactBeatAudio[effectKey] : p.reactBeatAudio;
            target[fieldKey] = value;
        });
        if (effectKey === null && fieldKey === 'enabled' && appState.get('motionRunning') === this._editingId && typeof workflowMotionEngine !== 'undefined') {
            workflowMotionEngine.liveBeatReactToggle(this._editingId, value); // liên tuyến domain — Motion Engine, KHÔNG qua nơi tiêu thụ
        }
        if (genericDrawerPanel.classList.contains('hidden') || !effectKey) return;
        if (fieldKey === 'maxPct' || fieldKey === 'maxDeg') {
            const el = genericDrawerBody.querySelector(`#motion-beatreact-${effectKey}-max-label`);
            if (el) el.textContent = `${value}${fieldKey === 'maxDeg' ? '°' : '%'}`;
        }
    },

    // ===================== Quản lý preset =====================

    /** Header "Reset" — về ĐÚNG mặc định `buildBlankMotionPreset()` (GIỮ id/name, chỉ reset các
     * field cấu hình). Vẽ lại TẠI CHỖ. */
    async resetEditing() {
        const presets = appState.get('motionPresets');
        const current = findMotionPresetById(presets, this._editingId); // core/motion-presets.js
        if (!current) return;
        const blank = buildBlankMotionPreset(current.name); // core/motion-presets.js — id mới sinh ra ở đây KHÔNG dùng, chỉ lấy field cấu hình
        await this._mutateEditing((p) => {
            p.transitionEnabled = blank.transitionEnabled;
            p.transitionType = blank.transitionType;
            p.transitionDurationMs = blank.transitionDurationMs;
            p.transitionInOutRatio = blank.transitionInOutRatio;
            p.transitionEasing = blank.transitionEasing;
            p.transitionDirection = blank.transitionDirection;
            p.transitionZoomDirection = blank.transitionZoomDirection;
            p.transitionSpinDirection = blank.transitionSpinDirection;
            p.transitionWipeDirection = blank.transitionWipeDirection;
            p.transitionCurtainDirection = blank.transitionCurtainDirection;
            p.edgeFlipVariant = blank.edgeFlipVariant;
            p.edgeFlipStaticOld = blank.edgeFlipStaticOld;
            p.pointMoves = blank.pointMoves;
            p.pointMoveEnabled = blank.pointMoveEnabled;
            p.pointMoveRunMode = blank.pointMoveRunMode;
            p.pointMoveOneOrder = blank.pointMoveOneOrder;
            p.reactBeatAudio = blank.reactBeatAudio;
        });
        workflowAppSettings._renderMotionEdit(); // liên tuyến domain — vẽ lại TẠI CHỖ, đúng field mới
    },

    /** Header "Xoá" — xoá hẳn preset đang sửa, quay về danh sách Quản lý. */
    async deleteEditing() {
        await this._deletePresetById(this._editingId);
        this._editingId = null;
        workflowAppSettings.back(); // liên tuyến domain — quay về đúng màn Danh sách vừa đến từ đó
    },

    /** Dùng CHUNG cho `quickDelete()` (danh sách) VÀ `deleteEditing()` (header Edit) — xoá khỏi
     * `appState.motionPresets`, gỡ tham chiếu bên Photo VBG NẾU đang gắn đúng preset này, gỡ khỏi
     * `motionApply` (mọi nơi tiêu thụ đã đăng ký).
     * @param {string} id */
    async _deletePresetById(id) {
        const presets = appState.get('motionPresets').filter((p) => p.id !== id);
        appState.set('motionPresets', presets);
        const motionApply = removeMotionApplyEverywhere(appState.get('motionApply'), id); // core/motion-presets.js
        appState.set('motionApply', motionApply);
        await this._persist();
        await setMeta('motionApply', motionApply); // service/db.js
        if (typeof workflowVisualBg !== 'undefined' && appConfigVisualBg.getAll().motionPresetId === id) { // liên tuyến domain
            appConfigVisualBg.mutateAll((c) => { c.motionPresetId = null; });
            await workflowVisualBg._persist(); // liên tuyến domain
        }
    },

    // ===================== Áp dụng cho nơi tiêu thụ (màn Edit) =====================

    /** Ứng select đổi consumer đang xem trong dropdown — chỉ đổi state UI cục bộ, KHÔNG persist gì
     * (chưa bấm nút đăng ký/huỷ). Vẽ lại nút cho ĐÚNG trạng thái sub/unsub của consumer mới chọn.
     * @param {string} key */
    changeApplyConsumer(key) {
        if (!MOTION_APPLY_CONSUMER_KEYS.includes(key)) return; // core/motion-presets.js
        this._editingApplyConsumerKey = key;
        this._syncApplyButton();
    },

    /** Ứng nút Đăng ký/Huỷ đăng ký — toggle theo đúng trạng thái HIỆN TẠI của consumer đang chọn.
     * @see core/motion-presets.js — subscribeMotionApply()/unsubscribeMotionApply(). */
    async toggleApplySubscription() {
        const key = this._editingApplyConsumerKey;
        const motionApply = appState.get('motionApply');
        const subscribed = isMotionApplySubscribed(motionApply, key, this._editingId); // core/motion-presets.js
        const next = subscribed
            ? unsubscribeMotionApply(motionApply, key, this._editingId) // core/motion-presets.js
            : subscribeMotionApply(motionApply, key, this._editingId); // core/motion-presets.js
        appState.set('motionApply', next);
        await setMeta('motionApply', next); // service/db.js
        console.log(`writer: "workflowMotionPresets.toggleApplySubscription", page: "motionApply", content: "${key}.${this._editingId}=${!subscribed}"`);
        this._syncApplyButton();
    },

    /** Đồng bộ nút Đăng ký/Huỷ đăng ký theo đúng trạng thái consumer đang chọn — gọi sau đổi
     * dropdown/toggle xong, VÀ lúc mở màn Edit (`_syncEditUI()`). */
    _syncApplyButton() {
        if (genericDrawerPanel.classList.contains('hidden')) return; // core/dom-refs.js
        const btn = genericDrawerBody.querySelector('#btn-motion-apply-toggle'); // core/dom-refs.js
        if (!btn) return;
        const subscribed = isMotionApplySubscribed(appState.get('motionApply'), this._editingApplyConsumerKey, this._editingId); // core/motion-presets.js
        btn.textContent = t(subscribed ? 'motionPresetsDrawer.apply.unsubscribe.label' : 'motionPresetsDrawer.apply.subscribe.label');
        btn.classList.toggle('bg-emerald-500', !subscribed);
        btn.classList.toggle('hover:bg-emerald-400', !subscribed);
        btn.classList.toggle('bg-rose-500', subscribed);
        btn.classList.toggle('hover:bg-rose-400', subscribed);
    },
};
