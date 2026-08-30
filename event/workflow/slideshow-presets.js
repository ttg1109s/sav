/**
 * event/workflow/slideshow-presets.js — "THẰNG THỰC THI CUỐI" của router "slideshowPresets", MỚI
 * (29/08/2026, phản hồi Giang — hệ "Cấu hình Slideshow" độc lập, CÙNG KHUÔN EQ presets nhưng điều
 * hướng qua `workflowAppSettings.navigateTo()`/`_render()` (màn hình trong Settings), KHÔNG phải
 * Generic Drawer List<->Edit riêng như EQ (EQ mở nhanh từ Control Center, đây nằm SẴN trong cây
 * Settings — System > Slideshow, xem components/slideshow-settings-drawer.js).
 *
 * Danh sách preset SỐNG ở `appState.slideshowPresets` (nạp lúc boot từ `meta.slideshowPresets`, xem
 * loadPresetsOnBoot() — rỗng là HỢP LỆ, KHÔNG seed gì cả, khác EQ). "Nơi tiêu thụ" (hiện DUY NHẤT
 * Photo Visual Background) chỉ giữ 1 tham chiếu `appConfigVisualBg.slideshowPresetId` — Slideshow
 * KHÔNG biết/không cần biết ai đang dùng mình, chỉ cung cấp danh sách + CRUD.
 *
 * NẠP SAU: core/slideshow-presets.js, core/file-manager/slideshow.js (SLIDESHOW_TRANSITION_TYPES/
 * SLIDESHOW_TRANSITION_EASINGS/SLIDESHOW_KENBURNS_MODES/transitionSupportsInOutRatio()/
 * capSlideshowTransitionDurationMs()), components/slideshow-settings-drawer.js, service/db.js
 * (getMeta/setMeta), event/workflow/app-settings.js (workflowAppSettings — liên tuyến domain, đọc/
 * gọi `navigateTo()`/`_render*()`), event/workflow/visual-bg.js (workflowVisualBg — liên tuyến domain,
 * đọc/ghi `slideshowPresetId`), core/time-picker-modal.js (openTimePickerModal — nút chọn thời gian
 * transition).
 */

const workflowSlideshowPresets = {
    _editingId: null,   // preset đang sửa (màn Edit) — null nếu không ở màn Edit
    _pickMode: false,    // true khi màn Danh sách đang ở chế độ "Áp dụng > Chọn" (tap = gắn, không phải sửa)

    /** Gọi từ event/workflow/app-boot.js — đọc `meta.slideshowPresets`, sanitize từng phần tử (phòng
     * dữ liệu hỏng/thiếu field). Danh sách RỖNG là hợp lệ — KHÔNG seed gì (khác EQ).
     * MIGRATE (29/08/2026) — bản cũ (trước khi Slideshow tách khỏi Visual Background) lưu CẢ cấu
     * hình Transition/Ken Burns NGAY TRONG `meta.visualBgConfig.slideshow` — đọc thẳng RAW meta đó
     * (KHÔNG qua `appConfigVisualBg.getAll()`, vì schema hiện tại không còn field `slideshow` nữa,
     * `getAll()` sẽ không thấy được dữ liệu cũ) để dựng preset ĐẦU TIÊN + gán luôn `slideshowPresetId`
     * — GHI THẲNG vào meta (không qua `appConfigVisualBg`, domain đó CHƯA nạp lúc hàm này chạy, xem
     * thứ tự gọi ở event/workflow/app-boot.js: hàm NÀY chạy TRƯỚC
     * `workflowVisualBg.loadPersistedSettingsOnBoot()`) — để lúc VBG đọc lại `meta.visualBgConfig`
     * ngay sau đó, thấy ĐÚNG `slideshowPresetId` đã gán, không mất cấu hình Giang từng chỉnh. CHỈ
     * chạy 1 LẦN DUY NHẤT (guard: `visualBgRaw.slideshowPresetId` CHƯA từng có — lần boot SAU sẽ
     * luôn có field này, dù null hay có giá trị, nên không migrate lặp lại). */
    async loadPresetsOnBoot() {
        const raw = await getMeta('slideshowPresets'); // service/db.js
        let presets = Array.isArray(raw) ? raw.map((p) => sanitizeSlideshowPreset(p)) : []; // core/slideshow-presets.js

        const visualBgRaw = await getMeta('visualBgConfig'); // service/db.js — RAW, xem docstring trên
        if (visualBgRaw && typeof visualBgRaw === 'object' && visualBgRaw.slideshow && typeof visualBgRaw.slideshow === 'object' && !('slideshowPresetId' in visualBgRaw)) {
            const migrated = sanitizeSlideshowPreset({ ...visualBgRaw.slideshow, name: t('slideshowPresetsDrawer.migratedName'), transitionEnabled: true }); // core/slideshow-presets.js — bản cũ luôn "bật" Transition (chưa có khái niệm tắt)
            presets = [...presets, migrated];
            visualBgRaw.slideshowPresetId = migrated.id;
            delete visualBgRaw.slideshow; // dọn field cũ — schema hiện tại không còn định nghĩa, để lại chỉ tổ rác
            await setMeta('visualBgConfig', visualBgRaw); // service/db.js — GHI THẲNG, xem docstring trên (VBG chưa nạp domain lúc này)
            console.log(`writer: "workflowSlideshowPresets.loadPresetsOnBoot", page: "slideshowPresets", content: "migrated legacy slideshow -> preset ${migrated.id}, gán slideshowPresetId"`);
        }

        appState.set('slideshowPresets', presets);
        await setMeta('slideshowPresets', presets); // ghi lại bản đã sanitize (+ preset migrate nếu có)
        console.log(`writer: "workflowSlideshowPresets.loadPresetsOnBoot", page: "slideshowPresets", content: "${presets.length} preset"`);
    },

    async _persist() {
        await setMeta('slideshowPresets', appState.get('slideshowPresets')); // service/db.js
    },

    // ===================== Màn Menu (System > Slideshow) =====================

    /** 2 dòng "Quản lý cấu hình"/"Áp dụng cấu hình" — bản thân render CHỈ dùng
     * `renderAppSettingsRowList()` dùng chung, không cần hàm riêng ở đây. */

    // ===================== Quản lý cấu hình (danh sách) =====================

    /** Ứng nút "+" header màn Danh sách — tạo preset trắng, mở NGAY màn Edit của nó. */
    async addPreset() {
        const presets = appState.get('slideshowPresets');
        const preset = buildBlankSlideshowPreset(tFormat('slideshowPresetsDrawer.defaultName', { n: presets.length + 1 })); // core/slideshow-presets.js
        appState.set('slideshowPresets', [...presets, preset]);
        await this._persist();
        this._editingId = preset.id;
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderSlideshowEdit()); // liên tuyến domain
    },

    /** Ứng tap 1 dòng preset trong danh sách — `pickMode` quyết định hành vi: đang Quản lý -> mở Edit;
     * đang Áp dụng > Chọn -> gắn NGAY vào Photo VBG rồi quay lại (KHÔNG mở Edit).
     * @param {string} id */
    async tileClick(id) {
        if (this._pickMode) { await this._pickForConsumer(id); return; }
        this._editingId = id;
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderSlideshowEdit()); // liên tuyến domain
    },

    /** Ứng nút xoá nhanh trên 1 dòng (chỉ hiện khi KHÔNG pickMode) — xoá thẳng, KHÔNG mở Edit trước,
     * vẽ lại danh sách tại chỗ. Nếu preset bị xoá đang GẮN cho Photo VBG -> tự gỡ (Rule: đừng để 1
     * tham chiếu treo tới preset không còn tồn tại).
     * @param {string} id */
    async quickDelete(id) {
        await this._deletePresetById(id);
        workflowAppSettings._renderSlideshowManage(); // liên tuyến domain — vẽ lại TẠI CHỖ (không navigateTo mới, đang đứng sẵn ở màn danh sách)
    },

    // ===================== Sửa 1 preset (màn Edit) =====================

    /** Đồng bộ UI màn Edit theo preset đang sửa — gọi sau MỌI field change (Rule 5d, workflow tự ghi
     * DOM cho field phụ thuộc field khác — CÙNG khuôn `event/workflow/slideshow.js` cũ). */
    _syncEditUI() {
        if (genericDrawerPanel.classList.contains('hidden')) return; // core/dom-refs.js
        const preset = findSlideshowPresetById(appState.get('slideshowPresets'), this._editingId); // core/slideshow-presets.js
        if (!preset) return;
        const q = (sel) => genericDrawerBody.querySelector(sel); // core/dom-refs.js
        const ratioRow = q('#slideshow-transition-ratio-row');
        if (ratioRow) ratioRow.classList.toggle('hidden', !transitionSupportsInOutRatio(preset.transitionType)); // core/file-manager/slideshow.js
        const durationBtn = q('#setting-slideshow-transition-duration');
        if (durationBtn) durationBtn.textContent = `${(preset.transitionDurationMs / 1000).toFixed(1)}s`;
        const ratioSlider = q('#setting-slideshow-transition-ratio');
        if (ratioSlider) ratioSlider.value = preset.transitionInOutRatio;
        this._updateTransitionRatioLabel(preset.transitionDurationMs, preset.transitionInOutRatio);
    },

    _updateTransitionRatioLabel(transitionDurationMs, ratioPercent) {
        const labelEl = genericDrawerBody ? genericDrawerBody.querySelector('#slideshow-transition-ratio-label') : null; // core/dom-refs.js
        if (!labelEl) return;
        const { inMs, outMs } = computeSlideshowTransitionInOutMs(transitionDurationMs, ratioPercent); // core/file-manager/slideshow.js
        labelEl.textContent = tFormat('slideshowSettingsDrawer.transitionRatio.previewFormat', { in: (inMs / 1000).toFixed(1), out: (outMs / 1000).toFixed(1) });
    },

    /** Ghi đè 1 (vài) field của preset ĐANG SỬA (`_editingId`) — dùng CHUNG cho mọi field change bên
     * dưới, tránh lặp đọc/map/ghi 4 dòng ở mỗi hàm.
     * @param {(preset: object) => void} mutatorFn */
    async _mutateEditing(mutatorFn) {
        const presets = appState.get('slideshowPresets').map((p) => {
            if (p.id !== this._editingId) return p;
            const copy = { ...p };
            mutatorFn(copy);
            return copy;
        });
        appState.set('slideshowPresets', presets);
        await this._persist();
    },

    async changeName(name) {
        const trimmed = name.trim();
        if (!trimmed) return; // guard: tên rỗng -> bỏ qua, giữ tên cũ (input vẫn hiện giá trị cũ, không xoá trắng vĩnh viễn)
        await this._mutateEditing((p) => { p.name = trimmed; });
    },

    async changeTransitionEnabled(checked) {
        await this._mutateEditing((p) => { p.transitionEnabled = checked; });
    },

    async changeTransitionType(value) {
        if (!SLIDESHOW_TRANSITION_TYPES.includes(value)) return; // core/file-manager/slideshow.js
        await this._mutateEditing((p) => { p.transitionType = value; });
        this._syncEditUI();
    },

    /** Ứng nút mở modal chọn "Thời gian chuyển cảnh" — CÙNG khuôn `openTransitionDurationPicker()`
     * cũ (event/workflow/slideshow.js, nay chỉ còn dùng cho video/preview cycle — hàm NÀY là bản cho
     * riêng preset đang sửa, không đọc/ghi `appConfigVisualBg` nữa).
     * SỬA (29/08/2026, phản hồi Giang — "config generic thì đâu biết trước sẽ dùng bởi ai mà đòi
     * kẹp UI") — 2 bản trước đều SAI cách tiếp cận (dù bản sau có sửa lại điều kiện `durationMode`,
     * vẫn sai TỪ GỐC): lúc SỬA 1 preset ở đây, KHÔNG có cách nào biết chắc ai sẽ dùng nó — có thể
     * CHƯA gắn cho nơi tiêu thụ nào cả, có thể gắn cho VBG đang ở mode 'duration' (mỗi ảnh 1 số khác
     * nhau, không có gì để đối chiếu), hay 1 nơi tiêu thụ TƯƠNG LAI hoàn toàn khác. Đọc
     * `appConfigVisualBg` (dù có điều kiện `durationMode==='fixtime'` hay không) TRONG picker này
     * đều là ĐOÁN — sai bản chất "cấu hình độc lập, KHÔNG sở hữu bởi bất kỳ nơi tiêu thụ nào".
     * BỎ HẲN mọi tham chiếu động — picker CHỈ còn trần cứng `SLIDESHOW_TRANSITION_MAX_TIME_MS`
     * (60s). Kẹp THẬT (< thời lượng hiển thị thật, ít nhất 1s) chỉ xảy ra ở RUNTIME — nơi DUY NHẤT
     * biết CHẮC CHẮN con số đúng tại đúng thời điểm đó — qua CHÍNH `capSlideshowTransitionDurationMs()`
     * đã có sẵn trong `_tick()` (event/workflow/slideshow.js), không đổi gì thêm ở đó. */
    openTransitionDurationPicker() {
        if (genericDrawerPanel.classList.contains('hidden')) return;
        const preset = findSlideshowPresetById(appState.get('slideshowPresets'), this._editingId); // core/slideshow-presets.js
        if (!preset) return;
        const maxMs = SLIDESHOW_TRANSITION_MAX_TIME_MS; // core/file-manager/slideshow.js — trần cứng DUY NHẤT, xem docstring trên
        openTimePickerModal({ // core/time-picker-modal.js
            title: t('slideshowSettingsDrawer.transitionDuration.pickerTitle'),
            format: 's-ms',
            valueMs: Math.min(preset.transitionDurationMs, maxMs), // kẹp vị trí cuộn ban đầu, tránh mở lên vượt max mới
            minMs: SLIDESHOW_TRANSITION_MIN_TIME_MS, // core/file-manager/slideshow.js
            maxMs,
            onConfirm: async (resultMs) => {
                const v = Math.max(SLIDESHOW_TRANSITION_MIN_TIME_MS, Math.min(maxMs, resultMs));
                await this._mutateEditing((p) => { p.transitionDurationMs = v; });
                if (genericDrawerPanel.classList.contains('hidden')) return;
                const btn = genericDrawerBody.querySelector('#setting-slideshow-transition-duration');
                if (btn) btn.textContent = `${(v / 1000).toFixed(1)}s`;
                const ratioSlider = genericDrawerBody.querySelector('#setting-slideshow-transition-ratio');
                this._updateTransitionRatioLabel(v, ratioSlider ? Number(ratioSlider.value) : 50);
            },
        });
    },

    previewTransitionRatio(ratioPercent) {
        if (genericDrawerPanel.classList.contains('hidden')) return;
        const preset = findSlideshowPresetById(appState.get('slideshowPresets'), this._editingId); // core/slideshow-presets.js
        if (preset) this._updateTransitionRatioLabel(preset.transitionDurationMs, ratioPercent);
    },

    async changeTransitionRatio(ratioPercent) {
        const v = Math.max(0, Math.min(100, ratioPercent));
        await this._mutateEditing((p) => { p.transitionInOutRatio = v; });
        this._updateTransitionRatioLabel(findSlideshowPresetById(appState.get('slideshowPresets'), this._editingId).transitionDurationMs, v); // core/slideshow-presets.js
    },

    async changeTransitionEasing(easing) {
        if (!SLIDESHOW_TRANSITION_EASINGS.includes(easing)) return; // core/file-manager/slideshow.js
        await this._mutateEditing((p) => { p.transitionEasing = easing; });
    },

    async changeKenBurnsEnabled(checked) {
        await this._mutateEditing((p) => { p.kenBurnsEnabled = checked; });
    },

    async changeKenBurnsMode(mode) {
        if (!SLIDESHOW_KENBURNS_MODES.includes(mode)) return; // core/file-manager/slideshow.js
        await this._mutateEditing((p) => { p.kenBurnsMode = mode; });
    },

    /** Ứng MỌI thay đổi field trong nhóm "React Beat Audio" — GENERIC 1 hàm DUY NHẤT cho cả field
     * top-level (`enabled`/`replaceMovement`, `effectKey=null`) LẪN 3 cụm con zoom/pan/rotate
     * (`effectKey` tương ứng) — tránh lặp ~13 hàm gần giống nhau (mỗi hàm chỉ khác đúng 1 field
     * path). Validate theo TỪNG loại field (checkbox/slider/select) trước khi ghi, KHÔNG tin payload
     * mù — vẫn 1 hàm, chỉ rẽ nhánh validate ngắn.
     * @param {'zoom'|'pan'|'rotate'|null} effectKey - null = field top-level.
     * @param {string} fieldKey - 'enabled' | 'replaceMovement' | 'everyNBeats' | 'amountPct' | 'amountDeg' | 'direction'.
     * @param {boolean|number|string} value
     */
    async changeBeatReactField(effectKey, fieldKey, value) {
        if (fieldKey === 'enabled' || fieldKey === 'replaceMovement') {
            if (typeof value !== 'boolean') return;
        } else if (fieldKey === 'everyNBeats') {
            if (typeof value !== 'number' || value < SLIDESHOW_BEAT_REACT_EVERY_N_BEATS_MIN || value > SLIDESHOW_BEAT_REACT_EVERY_N_BEATS_MAX) return; // core/slideshow-presets.js
        } else if (fieldKey === 'amountPct') {
            const [min, max] = effectKey === 'pan' ? [100, 150] : [100, 200]; // zoom
            if (typeof value !== 'number' || value < min || value > max) return;
        } else if (fieldKey === 'amountDeg') {
            if (typeof value !== 'number' || value < 0 || value > 360) return;
        } else if (fieldKey === 'direction') {
            if (!SLIDESHOW_BEAT_REACT_DIRECTIONS.includes(value)) return; // core/slideshow-presets.js
        } else {
            return; // fieldKey lạ -> bỏ qua, không ghi mù
        }
        await this._mutateEditing((p) => {
            const target = effectKey ? p.reactBeatAudio[effectKey] : p.reactBeatAudio;
            target[fieldKey] = value;
        });
        // Đồng bộ nhãn SỐNG bên cạnh slider (Rule 5d — field phụ thuộc field khác, workflow tự ghi
        // DOM) — chỉ 2 field có label riêng (everyNBeats/amountPct/amountDeg), enabled/direction/
        // replaceMovement không cần (checkbox/select tự phản ánh giá trị qua chính nó).
        if (genericDrawerPanel.classList.contains('hidden') || !effectKey) return;
        if (fieldKey === 'everyNBeats') {
            const el = genericDrawerBody.querySelector(`#slideshow-beatreact-${effectKey}-beats-label`);
            if (el) el.textContent = String(value);
        } else if (fieldKey === 'amountPct' || fieldKey === 'amountDeg') {
            const el = genericDrawerBody.querySelector(`#slideshow-beatreact-${effectKey}-amount-label`);
            if (el) el.textContent = `${value}${fieldKey === 'amountDeg' ? '°' : '%'}`;
        }
    },

    /** Header "Reset" — về ĐÚNG mặc định `buildBlankSlideshowPreset()` (GIỮ id/name, chỉ reset các
     * field cấu hình — khác "Xoá" hẳn preset). Vẽ lại TẠI CHỖ (update, không navigateTo mới). */
    async resetEditing() {
        const presets = appState.get('slideshowPresets');
        const current = findSlideshowPresetById(presets, this._editingId); // core/slideshow-presets.js
        if (!current) return;
        const blank = buildBlankSlideshowPreset(current.name); // core/slideshow-presets.js — id mới sinh ra ở đây KHÔNG dùng, chỉ lấy field cấu hình
        await this._mutateEditing((p) => {
            p.transitionEnabled = blank.transitionEnabled;
            p.transitionType = blank.transitionType;
            p.transitionDurationMs = blank.transitionDurationMs;
            p.transitionInOutRatio = blank.transitionInOutRatio;
            p.transitionEasing = blank.transitionEasing;
            p.kenBurnsEnabled = blank.kenBurnsEnabled;
            p.kenBurnsMode = blank.kenBurnsMode;
            p.reactBeatAudio = blank.reactBeatAudio;
        });
        workflowAppSettings._renderSlideshowEdit(); // liên tuyến domain — vẽ lại TẠI CHỖ, đúng field mới
    },

    /** Header "Xoá" — xoá hẳn preset đang sửa, quay về danh sách Quản lý. */
    async deleteEditing() {
        await this._deletePresetById(this._editingId);
        this._editingId = null;
        workflowAppSettings.back(); // liên tuyến domain — quay về đúng màn Danh sách vừa đến từ đó
    },

    /** Dùng CHUNG cho `quickDelete()` (danh sách) VÀ `deleteEditing()` (header Edit) — xoá khỏi
     * `appState.slideshowPresets`, gỡ tham chiếu bên Photo VBG NẾU đang gắn đúng preset này (Rule —
     * không để 1 `slideshowPresetId` treo trỏ tới preset không còn tồn tại).
     * @param {string} id */
    async _deletePresetById(id) {
        const presets = appState.get('slideshowPresets').filter((p) => p.id !== id);
        appState.set('slideshowPresets', presets);
        await this._persist();
        if (typeof workflowVisualBg !== 'undefined' && appConfigVisualBg.getAll().slideshowPresetId === id) { // liên tuyến domain
            appConfigVisualBg.mutateAll((c) => { c.slideshowPresetId = null; });
            await workflowVisualBg._persist(); // liên tuyến domain — CÙNG tiền lệ event/workflow/settings-misc.js đã gọi thẳng hàm này
        }
    },

    // ===================== Áp dụng cấu hình =====================

    /** Ứng tap dòng "Photo visual background" trong màn Áp dụng — mở màn chi tiết. */
    openApplyDetail() {
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderSlideshowApplyPhotoVisualBg()); // liên tuyến domain
    },

    /** Ứng nút "Chọn cấu hình" trong màn chi tiết — mở lại danh sách preset ở CHẾ ĐỘ CHỌN (tap 1
     * dòng = gắn NGAY, xem `tileClick()`). */
    openPickForPhotoVisualBg() {
        this._pickMode = true;
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderSlideshowManage()); // liên tuyến domain — TÁI DÙNG màn Danh sách, `_pickMode` đổi hành vi/ẩn nút xoá/nút "+"
    },

    /** Gắn preset `id` vào Photo VBG — CHỈ 1 "nơi tiêu thụ" hiện có, tên hàm giữ chung chung
     * ("_pickForConsumer") để mở rộng thêm nơi tiêu thụ khác sau này không cần đổi tên.
     * @param {string} id */
    async _pickForConsumer(id) {
        this._pickMode = false;
        appConfigVisualBg.mutateAll((c) => { c.slideshowPresetId = id; }); // liên tuyến domain
        await workflowVisualBg._persist(); // liên tuyến domain
        workflowAppSettings.back(); // liên tuyến domain — quay về đúng màn chi tiết "Photo visual background", tự vẽ lại tên preset mới
    },

    /** Ứng nút "Gỡ" trong màn chi tiết — bỏ tham chiếu, vẽ lại TẠI CHỖ. */
    async detachFromPhotoVisualBg() {
        appConfigVisualBg.mutateAll((c) => { c.slideshowPresetId = null; }); // liên tuyến domain
        await workflowVisualBg._persist(); // liên tuyến domain
        workflowAppSettings._renderSlideshowApplyPhotoVisualBg(); // liên tuyến domain — vẽ lại TẠI CHỖ
    },
};
