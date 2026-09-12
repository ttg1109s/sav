/**
 * event/workflow/player-display-settings.js — "THẰNG THỰC THI CUỐI" cho domain 'playerDisplay'
 * (Settings > Visualizer Screen > Player) — CÙNG khuôn tối giản `event/workflow/ui-theme.js`
 * (persist qua `meta.playerDisplayConfig`, IndexedDB, `setMeta()` trực tiếp mỗi lần đổi, KHÔNG
 * debounce — tần suất đổi cực thấp, chỉ lúc người dùng vào Settings chỉnh tay).
 *
 * GIAI ĐOẠN 1 (Giang chốt "code backend đăng ký + hiển thị list, CHƯA code cơ chế hoạt động") —
 * 2 hàm dưới đây CHỈ ghi/đọc giá trị đã chọn, KHÔNG có bước "áp dụng" nào (không đụng
 * #bg-video/#visual-bg-image, không gọi Motion Engine) — khác hẳn `workflowVisualBg.
 * changeMotionPresetId()` (event/workflow/visual-bg-common.js) vốn áp LIVE ngay qua
 * `workflowMotionEngine.updatePreset()` sau khi ghi. Việc áp dụng thật để dành giai đoạn 2.
 *
 * Router/Listener: CHƯA có router riêng — được gọi TRỰC TIẾP từ `workflowAppSettings`
 * (event/workflow/app-settings.js, cùng cách `handleThemeSelectMode()` gọi qua router 'theme')
 * vì Player chưa cần luồng eventBus riêng nào khác ngoài Settings.
 *
 * NẠP SAU: core/config.js (appConfigPlayerDisplay), core/player-display-settings.js
 * (PLAYER_MOTION_SLOTS/resolvePlayerMotionPresetField/resolvePlayerResolutionField),
 * service/db.js (getMeta/setMeta).
 * NẠP TRƯỚC: event/workflow/app-settings.js, event/workflow/app-boot.js.
 */
const workflowPlayerDisplaySettings = {

    /** Khôi phục lựa chọn đã lưu bền LÚC BOOT — gọi từ event/workflow/app-boot.js. Chưa từng lưu
     * (boot lần đầu) -> `saved` rỗng, giữ nguyên default đã seed sẵn trong appConfigPlayerDisplay
     * (Resolution 'fit', mọi *PresetId null). KHÔNG áp dụng gì lên DOM (chưa có cơ chế hoạt động). */
    async loadPersistedPlayerDisplayOnBoot() {
        const saved = await getMeta('playerDisplayConfig'); // service/db.js
        if (saved && typeof saved === 'object') {
            appConfigPlayerDisplay.mutateAll((cfg) => Object.assign(cfg, saved)); // core/config.js
            console.log('writer: "loadPersistedPlayerDisplayOnBoot", page: "playerDisplayConfig", content: "khôi phục từ meta.playerDisplayConfig"');
        }
    },

    /** Ứng select Resolution đổi (màn Player > Video hoặc Photo). KHÔNG validate `value` khớp
     * PLAYER_RESOLUTION_MODES ở đây — `<select>` chỉ có đúng 3 `<option>` hợp lệ nên giá trị luôn
     * sạch, cùng tinh thần các select đơn giản khác trong app-settings.js (vd Theme mode).
     * @param {'video'|'photo'} kind @param {string} value */
    async changeResolutionMode(kind, value) {
        const field = resolvePlayerResolutionField(kind); // core/player-display-settings.js
        appConfigPlayerDisplay.mutateAll((cfg) => { cfg[field] = value; }); // core/config.js
        console.log(`writer: "workflowPlayerDisplaySettings.changeResolutionMode", page: "playerDisplayConfig", content: "${field}=${value}"`);
        await setMeta('playerDisplayConfig', appConfigPlayerDisplay.getAll()); // service/db.js
    },

    /** Ứng 1 trong 7 select Motion đổi (4 vai trò x Video, 3 vai trò x Photo — Photo không có
     * React Beat, xem core/player-display-settings.js::PLAYER_MOTION_SLOTS). `value` rỗng ('') -> gỡ (null).
     * @param {'video'|'photo'} kind @param {string} slot - 1 trong PLAYER_MOTION_SLOTS[].slot @param {string} value */
    async changeMotionSlot(kind, slot, value) {
        const field = resolvePlayerMotionPresetField(kind, slot); // core/player-display-settings.js
        if (!field) return; // slot lạ (không nên xảy ra — select chỉ dựng từ PLAYER_MOTION_SLOTS) -> bỏ qua an toàn
        appConfigPlayerDisplay.mutateAll((cfg) => { cfg[field] = value || null; }); // core/config.js
        console.log(`writer: "workflowPlayerDisplaySettings.changeMotionSlot", page: "playerDisplayConfig", content: "${field}=${value || null}"`);
        await setMeta('playerDisplayConfig', appConfigPlayerDisplay.getAll()); // service/db.js
    },
};
