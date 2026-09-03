/**
 * event/workflow/motion-presets.js — "THẰNG THỰC THI CUỐI" của router "motionPresets" — hệ "Cấu
 * hình Motion" độc lập, điều hướng qua `workflowAppSettings.navigateTo()`/`_render()` (màn hình
 * trong Settings), KHÔNG phải Generic Drawer List<->Edit riêng như EQ.
 *
 * Danh sách preset SỐNG ở `appState.motionPresets` (nạp lúc boot từ `meta.motionPresets`, xem
 * loadPresetsOnBoot() — rỗng là HỢP LỆ, KHÔNG seed gì cả). "Nơi tiêu thụ" (hiện DUY NHẤT Photo
 * Visual Background) chỉ giữ 1 tham chiếu `appConfigVisualBg.motionPresetId` — Motion KHÔNG biết/
 * không cần biết ai đang dùng mình, chỉ cung cấp danh sách + CRUD.
 *
 * NẠP SAU: core/motion-presets.js, core/motion-engine.js, core/point-move-timing-ui.js,
 * components/motion-settings-drawer.js, service/db.js (getMeta/setMeta), event/workflow/
 * app-settings.js (workflowAppSettings — liên tuyến domain), event/workflow/visual-bg.js
 * (workflowVisualBg — liên tuyến domain, đọc/ghi `motionPresetId`), core/time-picker-modal.js.
 */

const workflowMotionPresets = {
    _editingId: null,   // preset đang sửa (màn Edit) — null nếu không ở màn Edit
    _pickMode: false,    // true khi màn Danh sách đang ở chế độ "Áp dụng > Chọn" (tap = gắn, không phải sửa)
    _editingPointMoveId: null, // point move đang sửa (màn Point Move Edit) — null nếu không ở màn đó
    _dragPreviewPointMoveId: null, // point move ĐANG kéo trên đường cong Timing — null nếu không kéo
    _dragPreviewTimingX: 0,
    _dragPreviewTimingY: 0,

    /** Gọi từ event/workflow/app-boot.js — đọc `meta.motionPresets`, sanitize từng phần tử (phòng
     * dữ liệu hỏng/thiếu field). Danh sách RỖNG là hợp lệ — KHÔNG seed gì (khác EQ).
     * MIGRATE — bản cũ (trước khi Motion tách khỏi Visual Background) lưu CẢ cấu hình Transition/
     * Ken Burns NGAY TRONG `meta.visualBgConfig.motion` — đọc thẳng RAW meta đó (KHÔNG qua
     * `appConfigVisualBg.getAll()`, vì schema hiện tại không còn field `motion` nữa) để dựng preset
     * ĐẦU TIÊN + gán luôn `motionPresetId` — GHI THẲNG vào meta (domain đó CHƯA nạp lúc hàm này
     * chạy) — để lúc VBG đọc lại `meta.visualBgConfig` ngay sau đó, thấy ĐÚNG `motionPresetId` đã
     * gán, không mất cấu hình cũ. Trường `kenBurnsEnabled`/`kenBurnsMode` trong preset MIGRATE (nếu
     * có) bị `sanitizeMotionPreset()` bỏ qua tự nhiên (schema mới không còn field đó) — preset
     * MIGRATE chỉ giữ được phần Transition, Point Move bắt đầu trắng (đúng — Ken Burns không có
     * tương đương 1-1 để tự quy đổi sang Point Move). CHỈ chạy 1 LẦN DUY NHẤT (guard:
     * `visualBgRaw.motionPresetId` CHƯA từng có). */
    async loadPresetsOnBoot() {
        const raw = await getMeta('motionPresets'); // service/db.js
        let presets = Array.isArray(raw) ? raw.map((p) => sanitizeMotionPreset(p)) : []; // core/motion-presets.js

        const visualBgRaw = await getMeta('visualBgConfig'); // service/db.js — RAW, xem docstring trên
        if (visualBgRaw && typeof visualBgRaw === 'object' && visualBgRaw.motion && typeof visualBgRaw.motion === 'object' && !('motionPresetId' in visualBgRaw)) {
            const migrated = sanitizeMotionPreset({ ...visualBgRaw.motion, name: t('motionPresetsDrawer.migratedName'), transitionEnabled: true }); // core/motion-presets.js — bản cũ luôn "bật" Transition (chưa có khái niệm tắt)
            presets = [...presets, migrated];
            visualBgRaw.motionPresetId = migrated.id;
            delete visualBgRaw.motion; // dọn field cũ — schema hiện tại không còn định nghĩa, để lại chỉ tổ rác
            await setMeta('visualBgConfig', visualBgRaw); // service/db.js — GHI THẲNG, xem docstring trên (VBG chưa nạp domain lúc này)
            console.log(`writer: "workflowMotionPresets.loadPresetsOnBoot", page: "motionPresets", content: "migrated legacy motion -> preset ${migrated.id}, gán motionPresetId"`);
        }

        appState.set('motionPresets', presets);
        await setMeta('motionPresets', presets); // ghi lại bản đã sanitize (+ preset migrate nếu có)
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

    /** Ứng tap 1 dòng preset trong danh sách — `pickMode` quyết định hành vi: đang Quản lý -> mở Edit;
     * đang Áp dụng > Chọn -> gắn NGAY vào Photo VBG rồi quay lại (KHÔNG mở Edit).
     * @param {string} id */
    async tileClick(id) {
        if (this._pickMode) { await this._pickForConsumer(id); return; }
        this._editingId = id;
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderMotionEdit()); // liên tuyến domain
    },

    /** Ứng nút xoá nhanh trên 1 dòng (chỉ hiện khi KHÔNG pickMode) — xoá thẳng, KHÔNG mở Edit trước.
     * @param {string} id */
    async quickDelete(id) {
        await this._deletePresetById(id);
        workflowAppSettings._renderMotionManage(); // liên tuyến domain — vẽ lại TẠI CHỖ
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
        // Point Move — dòng "Thứ tự chọn" CHỈ hiện khi runMode==='one', nút "Timing" CHỈ hiện khi 'all'.
        const orderRow = q('#motion-pointmove-order-row');
        if (orderRow) orderRow.classList.toggle('hidden', preset.pointMoveRunMode !== 'one');
        const timingBtn = q('#btn-motion-pointmove-timing');
        if (timingBtn) timingBtn.classList.toggle('hidden', preset.pointMoveRunMode !== 'all');
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

    /** Thêm 1 point move trắng vào CUỐI danh sách, vẽ lại TẠI CHỖ. */
    async addPointMove() {
        await this._mutateEditing((p) => { p.pointMoves = [...p.pointMoves, buildBlankPointMove()]; }); // core/motion-presets.js
        workflowAppSettings._renderPointMoveList(); // liên tuyến domain
    },

    /** Xoá 1 point move — LUÔN giữ ít nhất 1 phần tử (guard, UI đã disable nút xoá khi chỉ còn 1,
     * phòng hờ vẫn chặn lại ở đây). Nếu phần tử VỊ TRÍ ĐẦU bị xoá, phần tử KẾ TIẾP tự trở thành vị
     * trí đầu MỚI và tự bị khoá checked/timingX qua `sanitizeMotionPointMoves()` lúc `_mutateEditing`
     * ghi lại — KHÔNG cần xử lý riêng ở đây.
     * @param {string} id */
    async deletePointMove(id) {
        await this._mutateEditing((p) => {
            if (p.pointMoves.length <= 1) return; // guard: không xoá xuống dưới 1
            const filtered = p.pointMoves.filter((pm) => pm.id !== id);
            p.pointMoves = sanitizeMotionPointMoves(filtered); // core/motion-presets.js — ép lại khoá vị trí đầu ngay (không đợi lượt sanitize kế tiếp)
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

    /** Ứng nút "Timing" trong màn Edit — mở màn đường cong. */
    openPointMoveTiming() {
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderPointMoveTiming()); // liên tuyến domain
    },

    /** Tính dữ liệu vẽ đường cong (danh sách node + chuỗi toạ độ polyline ĐÃ sample mượt) — DÙNG
     * CHUNG cho `_renderTimingCurve()` (dựng lại TOÀN BỘ SVG) LẪN `_patchTimingPreview()` (chỉ vá
     * lại phần tử ĐANG có, xem 2 hàm dưới) — tránh trùng lặp việc sample
     * `computePointMoveCurveIntensityAt()` (core) ở 2 nơi. `overrideId` khác null -> point move ĐÓ
     * dùng `overrideTimingX`/`overrideTimingY` thay vì giá trị đã lưu (preview LIVE, chưa persist).
     * Workflow là tầng DUY NHẤT được lặp gọi Core nhiều lần (Rule 3, core cấm gọi core).
     * @param {object} preset @param {string|null} overrideId @param {number} [overrideTimingX] @param {number} [overrideTimingY]
     * @returns {{points: object[], curveCoordsStr: string}} */
    _computeTimingCurveData(preset, overrideId, overrideTimingX, overrideTimingY) {
        const points = preset.pointMoves
            .filter((p) => p.checked)
            .map((p) => (p.id === overrideId ? { ...p, timingX: overrideTimingX, timingY: overrideTimingY } : p))
            .map((p) => ({ id: p.id, timingX: p.timingX, timingY: p.timingY, locked: p.timingX === 0 && preset.pointMoves[0].id === p.id }))
            .sort((a, b) => a.timingX - b.timingX);
        const nodesForCurve = points.map((p) => ({ x: p.timingX, y: p.timingY }));
        const SAMPLES = 60;
        const curveCoords = [];
        for (let i = 0; i <= SAMPLES; i++) {
            const xPercent = (i / SAMPLES) * 100;
            const yValue = computePointMoveCurveIntensityAt(nodesForCurve, xPercent); // core
            const svgX = POINT_MOVE_TIMING_PAD_X + (xPercent / 100) * (POINT_MOVE_TIMING_SVG_W - POINT_MOVE_TIMING_PAD_X - 6); // core/point-move-timing-ui.js (consts)
            const yRatio = 1 - (yValue - POINT_MOVE_TIMING_Y_MIN) / (POINT_MOVE_TIMING_Y_MAX - POINT_MOVE_TIMING_Y_MIN);
            const svgY = POINT_MOVE_TIMING_PAD_Y + yRatio * (POINT_MOVE_TIMING_SVG_H - POINT_MOVE_TIMING_PAD_Y * 2);
            curveCoords.push(`${svgX},${svgY}`);
        }
        return { points, curveCoordsStr: curveCoords.join(' ') };
    },

    /** Dựng lại TOÀN BỘ SVG (xoá sạch + `buildPointMoveTimingCurveEl()` mới) — CHỈ gọi lúc mở màn
     * lần đầu hoặc SAU KHI đã persist xong 1 lượt sửa (commit) — KHÔNG gọi liên tục lúc đang kéo/gõ
     * số (xem `_patchTimingPreview()`, tách riêng đúng vì lý do đó: xoá/dựng lại SVG giữa chừng lúc
     * đang kéo sẽ làm `draggingEl`/toạ độ core-ui đang giữ bị "treo" — phần tử cũ đã bị gỡ khỏi DOM,
     * `getBoundingClientRect()` trả về rỗng, toạ độ tính tiếp sẽ sai/NaN. Đây là lỗi THẬT đã xảy ra
     * ở bản trước khi gộp preview LIVE vào chung hàm này — SỬA bằng cách tách hẳn 2 luồng).
     * @param {HTMLElement} containerEl - `#ptmove-timing-container`. */
    _renderTimingCurve(containerEl) {
        if (!containerEl) return;
        const preset = findMotionPresetById(appState.get('motionPresets'), this._editingId); // core/motion-presets.js
        if (!preset) return;
        const { points, curveCoordsStr } = this._computeTimingCurveData(preset, this._dragPreviewPointMoveId, this._dragPreviewTimingX, this._dragPreviewTimingY);
        containerEl.innerHTML = '';
        containerEl.appendChild(buildPointMoveTimingCurveEl(points, curveCoordsStr)); // core/point-move-timing-ui.js
    },

    /** Vá LIVE 1 node + polyline NGAY TRONG SVG đang có (KHÔNG xoá/dựng lại — xem lý do ở
     * `_renderTimingCurve()`) + đồng bộ 2 ô nhập số cùng hàng (`skipField` bỏ qua ô ĐANG được gõ,
     * tránh ghi đè giá trị ngay dưới ngón tay người dùng đang gõ dở). Dùng CHUNG cho preview lúc kéo
     * (`skipField=null`, đồng bộ CẢ 2 ô số) LẪN preview lúc gõ số (`skipField` = field đang gõ).
     * @param {string} id @param {number} timingX @param {number} timingY @param {string|null} skipField - 'timingX'|'timingY'|null. */
    _patchTimingPreview(id, timingX, timingY, skipField) {
        if (genericDrawerPanel.classList.contains('hidden')) return; // core/dom-refs.js
        const preset = findMotionPresetById(appState.get('motionPresets'), this._editingId); // core/motion-presets.js
        if (!preset) return;
        const { points, curveCoordsStr } = this._computeTimingCurveData(preset, id, timingX, timingY);
        const container = genericDrawerBody.querySelector('#ptmove-timing-container'); // core/dom-refs.js
        const svgEl = container ? container.querySelector('.ptmove-timing-svg') : null;
        if (svgEl) {
            const polylineEl = svgEl.querySelector('.ptmove-timing-curve');
            if (polylineEl) polylineEl.setAttribute('points', curveCoordsStr);
            const nodeEl = svgEl.querySelector(`circle[data-point-move-id="${id}"]`);
            const point = points.find((p) => p.id === id);
            if (nodeEl && point) {
                const cx = POINT_MOVE_TIMING_PAD_X + (point.timingX / 100) * (POINT_MOVE_TIMING_SVG_W - POINT_MOVE_TIMING_PAD_X - 6); // core/point-move-timing-ui.js (consts)
                const yRatio = 1 - (point.timingY - POINT_MOVE_TIMING_Y_MIN) / (POINT_MOVE_TIMING_Y_MAX - POINT_MOVE_TIMING_Y_MIN);
                const cy = POINT_MOVE_TIMING_PAD_Y + yRatio * (POINT_MOVE_TIMING_SVG_H - POINT_MOVE_TIMING_PAD_Y * 2);
                nodeEl.setAttribute('cx', cx);
                nodeEl.setAttribute('cy', cy);
            }
        }
        const row = genericDrawerBody.querySelector(`[data-ptmove-timing-row="${id}"]`);
        if (!row) return;
        if (skipField !== 'timingX') {
            const xInput = row.querySelector('[data-ptmove-timing-field="timingX"]');
            if (xInput) xInput.value = timingX;
        }
        if (skipField !== 'timingY') {
            const yInput = row.querySelector('[data-ptmove-timing-field="timingY"]');
            if (yInput) yInput.value = timingY;
        }
    },

    /** Preview LIVE khi đang kéo 1 node (mỗi `pointermove`, KHÔNG persist) — vá tại chỗ + đồng bộ
     * CẢ 2 ô số cùng hàng (`skipField=null` — không ô nào đang được gõ tay lúc này).
     * @param {string} id @param {number} timingX @param {number} timingY */
    previewPointMoveTimingDrag(id, timingX, timingY) {
        this._dragPreviewPointMoveId = id;
        this._dragPreviewTimingX = timingX;
        this._dragPreviewTimingY = timingY;
        this._patchTimingPreview(id, timingX, timingY, null);
    },

    /** `pointerup` — CHỐT giá trị đang preview vào preset thật (persist), dựng lại TOÀN MÀN (SVG +
     * mọi ô số) cho chắc ăn đồng bộ tuyệt đối sau khi ghi. */
    async commitPointMoveTimingDrag() {
        const id = this._dragPreviewPointMoveId;
        if (!id) return;
        const timingX = this._dragPreviewTimingX;
        const timingY = this._dragPreviewTimingY;
        this._dragPreviewPointMoveId = null;
        await this._mutateEditing((p) => {
            const idx = p.pointMoves.findIndex((pm) => pm.id === id);
            if (idx === -1) return;
            p.pointMoves[idx] = { ...p.pointMoves[idx], timingX: idx === 0 ? 0 : timingX, timingY };
        });
        if (genericDrawerPanel.classList.contains('hidden')) return; // core/dom-refs.js
        workflowAppSettings._renderPointMoveTiming(); // liên tuyến domain — dựng lại TOÀN màn (an toàn, commit chỉ xảy ra 1 lần lúc thả tay, không phải mỗi pixel)
    },

    /** Ứng ô nhập số timingX/timingY — LIVE preview lúc gõ (`input`, KHÔNG persist, vá tại chỗ +
     * KHÔNG ghi đè lại chính ô đang gõ — `skipField`), giống hệt cơ chế preview/commit của kéo tay.
     * Point move VỊ TRÍ ĐẦU (index 0) khoá X=0 — UI đã disable input đó, vẫn guard lại ở đây.
     * @param {string} id @param {'timingX'|'timingY'} field @param {number} value */
    previewPointMoveTimingNumber(id, field, value) {
        if (typeof value !== 'number' || Number.isNaN(value)) return;
        const preset = findMotionPresetById(appState.get('motionPresets'), this._editingId); // core/motion-presets.js
        if (!preset) return;
        const idx = preset.pointMoves.findIndex((p) => p.id === id);
        if (idx === -1) return;
        const pm = preset.pointMoves[idx];
        const timingX = field === 'timingX' ? (idx === 0 ? 0 : Math.max(0, Math.min(100, value))) : pm.timingX;
        const timingY = field === 'timingY' ? Math.max(-150, Math.min(150, value)) : pm.timingY;
        this._patchTimingPreview(id, timingX, timingY, field);
    },

    /** Ứng ô nhập số timingX/timingY — persist THẬT lúc rời ô (`change`, tự bắn lúc blur/Enter). */
    async commitPointMoveTimingNumber(id, field, value) {
        if (typeof value !== 'number' || Number.isNaN(value)) return;
        await this._mutateEditing((p) => {
            const idx = p.pointMoves.findIndex((pm) => pm.id === id);
            if (idx === -1) return;
            const pm = { ...p.pointMoves[idx] };
            if (field === 'timingX') pm.timingX = idx === 0 ? 0 : Math.max(0, Math.min(100, value));
            if (field === 'timingY') pm.timingY = Math.max(-150, Math.min(150, value));
            p.pointMoves[idx] = pm;
        });
        if (genericDrawerPanel.classList.contains('hidden')) return; // core/dom-refs.js
        workflowAppSettings._renderPointMoveTiming(); // liên tuyến domain — dựng lại TOÀN màn, đồng bộ số ĐÃ kẹp biên (vd gõ vượt 100 sẽ bị kẹp lại 100 sau commit)
    },

    // ===================== React Beat Audio =====================

    /** Ứng MỌI thay đổi field trong nhóm "React Beat Audio" — GENERIC 1 hàm DUY NHẤT cho cả field
     * top-level (`enabled`, `effectKey=null`) LẪN 3 cụm con zoom/pan/rotate (`effectKey` tương ứng).
     * `replaceMovement` ĐÃ XOÁ (hết ý nghĩa từ khi Ken Burns không còn để "thay thế" — xem
     * core/motion-presets.js) — KHÔNG còn trong danh sách `fieldKey` hợp lệ.
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
     * `appState.motionPresets`, gỡ tham chiếu bên Photo VBG NẾU đang gắn đúng preset này.
     * @param {string} id */
    async _deletePresetById(id) {
        const presets = appState.get('motionPresets').filter((p) => p.id !== id);
        appState.set('motionPresets', presets);
        await this._persist();
        if (typeof workflowVisualBg !== 'undefined' && appConfigVisualBg.getAll().motionPresetId === id) { // liên tuyến domain
            appConfigVisualBg.mutateAll((c) => { c.motionPresetId = null; });
            await workflowVisualBg._persist(); // liên tuyến domain
        }
    },

    // ===================== Áp dụng cấu hình =====================

    /** Ứng tap dòng "Photo visual background" trong màn Áp dụng — mở màn chi tiết. */
    openApplyDetail() {
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderMotionApplyPhotoVisualBg()); // liên tuyến domain
    },

    /** Ứng nút "Chọn cấu hình" trong màn chi tiết — mở lại danh sách preset ở CHẾ ĐỘ CHỌN. */
    openPickForPhotoVisualBg() {
        this._pickMode = true;
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderMotionManage()); // liên tuyến domain
    },

    /** Gắn preset `id` vào Photo VBG.
     * @param {string} id */
    async _pickForConsumer(id) {
        this._pickMode = false;
        appConfigVisualBg.mutateAll((c) => { c.motionPresetId = id; }); // liên tuyến domain
        await workflowVisualBg._persist(); // liên tuyến domain
        workflowAppSettings.back(); // liên tuyến domain — quay về đúng màn chi tiết "Photo visual background"
    },

    /** Ứng nút "Gỡ" trong màn chi tiết — bỏ tham chiếu, vẽ lại TẠI CHỖ. */
    async detachFromPhotoVisualBg() {
        appConfigVisualBg.mutateAll((c) => { c.motionPresetId = null; }); // liên tuyến domain
        await workflowVisualBg._persist(); // liên tuyến domain
        workflowAppSettings._renderMotionApplyPhotoVisualBg(); // liên tuyến domain — vẽ lại TẠI CHỖ
    },
};
