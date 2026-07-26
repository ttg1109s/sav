/**
 * event/workflow/visualizer-display.js — "THẰNG THỰC THI CUỐI" của router "visualizerDisplay".
 *
 * QUY TẮC (giống workflow/storage.js, workflow/playlist.js):
 *   - Workflow KHÔNG tự nghĩ ra logic nghiệp vụ mới — chỉ gọi các hàm core thuần đã có ở
 *     visualizers/visualizer-display.js.
 *   - withLoadingShield() và alertModal() ĐẶT Ở TẦNG NÀY — core hoàn toàn không biết 2 thứ này
 *     tồn tại.
 *   - QUY TẮC SHIELD/MODAL: alertModal() KHÔNG bao giờ gọi BÊN TRONG callback của
 *     withLoadingShield() — luôn gọi SAU KHI shield đã đóng hẳn.
 *
 * FIX (04/07/2026, mục 1 phản hồi Giang) — GỘP 'visualizerDisplay.bgImage.pickFromLibrary' (nút
 * riêng đã xoá) vào thẳng 'visualizerDisplay.bgImage.toggle': bật toggle giờ tự mở picker, huỷ/
 * không chọn gì thì tự trả toggle về "off" (onCancel). Tắt toggle CHỈ ẩn hiển thị, KHÔNG còn xoá
 * Blob khỏi IndexedDB (đảo ngược quyết định cũ) — vì vậy `toggleBgImage({enabled:false})` không
 * còn cần shield, gọi thẳng `applyBgImageEnabled(false)` (core giờ đồng bộ). CHỈ nhánh `enabled:true`
 * (mở picker + `applyBgImage()`) còn ở workflow (>1 bước + cần shield lúc lưu).
 *
 * === Batch D3 (Settings restructure, 06/07/2026) ===
 * THÊM `openPanel()` (push panel Visualizer Settings + đồng bộ TOÀN BỘ giá trị hiện tại — GỘP CẢ
 * phần "Chất lượng/Hình học/Màu sắc" (file này) LẪN phần "Tự động đổi hiệu ứng" (core/auto-switch-
 * visual.js), vì cả 2 SECTION cùng sống trong 1 panel — xem components/visualizer-settings-
 * drawer.js). THÊM 13 method `set*` — mỗi method GỘP core setter (Rule 1-4 đầy đủ, không tự gọi
 * core khác) + các lệnh core PHỤ (update.../resizeCanvas...) + `saveConfig()` theo ĐÚNG thứ tự hàm
 * cũ làm trước khi tách (xem lịch sử core/visualizer/visualizer-display.js).
 * LƯU Ý ĐẶT TÊN: nhiều method dưới đây TRÙNG TÊN với hàm core cùng chức năng (vd
 * `workflowVisualizerDisplay.setBgColor()` gọi hàm core toàn cục `setBgColor()`) — đây KHÔNG phải
 * đệ quy: gọi trần `setBgColor(...)` bên trong 1 method object-literal luôn phân giải theo scope
 * TỪ VỰNG (tìm thấy hàm global cùng tên ở core/), KHÔNG tự trỏ vào chính method đang chạy (khác
 * named function expression) — không có ES6 module nên không cần import, nhưng cũng vì vậy CHỈ
 * ĐƯỢC set 1 hàm global 1 tên duy nhất, không được định nghĩa lại `function setBgColor` ở file nào
 * khác ngoài core/visualizer/visualizer-display.js.
 */
const workflowVisualizerDisplay = {

    /**
     * Ứng với msg.type = 'visualizerDisplay.openPanel.click' — push panel + đồng bộ mọi input
     * (thay `initAutoSwitchVisualUI()` cũ cho phần auto-switch — xem core/auto-switch-visual.js).
     */
    openPanel() {
        const panelEl = pushSettingsPanel({ title: t('visualizerSettingsDrawer.title'), bodyHtml: renderVisualizerPanelBody() });
        const cfg = appConfigViz.getAll();

        panelEl.querySelector('#setting-quality').value = cfg.quality;
        panelEl.querySelector('#bg-color-picker').value = cfg.bgColor;
        panelEl.querySelector('#setting-color-mode').value = cfg.mode;
        panelEl.querySelector('#solid-color-text').value = cfg.solidColor;
        panelEl.querySelector('#solid-color-picker').value = cfg.solidColor;
        panelEl.querySelector('#dyn-color-a').value = cfg.dynA;
        panelEl.querySelector('#dyn-color-b').value = cfg.dynB;
        panelEl.querySelector('#setting-vortex-style').value = cfg.vortexStyle;
        panelEl.querySelector('#setting-bar-style').value = cfg.barStyle;
        panelEl.querySelector('#setting-rain-style').value = cfg.rainStyle;
        panelEl.querySelector('#setting-glass-flash').checked = cfg.glassFlash === true;
        panelEl.querySelector('#setting-max-height').value = cfg.maxH;
        panelEl.querySelector('#val-max').textContent = cfg.maxH;
        panelEl.querySelector('#setting-bar-width').value = cfg.barWidth;
        panelEl.querySelector('#val-width').textContent = cfg.barWidth;
        panelEl.querySelector('#setting-mirror-count').value = cfg.mirrorBarCount;
        panelEl.querySelector('#val-mirror-count').textContent = cfg.mirrorBarCount;
        // (Phần B, Galaxy — đồng bộ 5 input spaceStyle/4 slider ĐÃ BỎ 21/07/2026, phản hồi Giang mục 1)

        // Hiện/ẩn đúng khối theo kiểu hiệu ứng/mode màu/kiểu bar hiện tại — 3 hàm này giờ đã có
        // guard (Batch D3), panel vừa push nên chắc chắn tìm thấy phần tử, chạy đúng như mong đợi.
        updateTypeUI();
        updateColorMenuUI();
        updateBarStyleUI();

        // ===== Section "Tự động đổi hiệu ứng" (core/auto-switch-visual.js) =====
        const elEnable = panelEl.querySelector('#setting-auto-switch-enable');
        const elOptions = panelEl.querySelector('#auto-switch-options');
        elEnable.checked = cfg.autoSwitchVisualEnabled === true;
        elOptions.classList.toggle('hidden', !elEnable.checked);
        panelEl.querySelector('#setting-auto-switch-mode').value = cfg.autoSwitchVisualMode;
        panelEl.querySelector('#setting-auto-switch-time-mode').value = cfg.autoSwitchVisualTimeMode;
        panelEl.querySelector('#setting-auto-switch-seconds-fixed').value = cfg.autoSwitchVisualSecondsFixed;
        panelEl.querySelector('#setting-auto-switch-seconds-random').value = cfg.autoSwitchVisualSecondsRandom;
        panelEl.querySelector('#setting-auto-switch-seconds-duration').value = cfg.autoSwitchVisualSecondsDuration;
        syncAutoSwitchTimeModeBlocks(
            cfg.autoSwitchVisualTimeMode,
            panelEl.querySelector('#auto-switch-time-fixed-block'),
            panelEl.querySelector('#auto-switch-time-random-block'),
            panelEl.querySelector('#auto-switch-time-duration-block')
        );
    },

    setQuality(value) {
        setVisualizerQuality(value);
        resizeCanvas();
        saveConfig();
    },
    setBgColor(value) {
        setBgColor(value);
        updateDOMBackground();
        saveConfig();
    },
    setColorMode(value) {
        setColorMode(value);
        updateColorMenuUI();
        saveConfig();
    },
    setSolidColorFromPicker(value, crossEl) {
        setSolidColorFromPicker(value, crossEl);
        updateProgressBarCSS();
        saveConfig();
    },
    setSolidColorFromText(value, crossEl) {
        const applied = setSolidColorFromText(value, crossEl); // core trả về false nếu sai định dạng hex -> bỏ qua im lặng, giữ đúng hành vi gốc
        if (!applied) return;
        updateProgressBarCSS();
        saveConfig();
    },
    setDynColorA(value) {
        setDynColorA(value);
        saveConfig();
    },
    setDynColorB(value) {
        setDynColorB(value);
        updateProgressBarCSS();
        saveConfig();
    },
    setVortexStyle(value) {
        setVortexStyle(value);
        updateVortexVisibility();
        saveConfig();
    },
    setBarStyle(value) {
        setBarStyle(value);
        updateBarStyleUI();
        saveConfig();
    },
    setRainStyle(value) {
        setRainStyle(value);
        resizeCanvas();
        saveConfig();
    },
    setGlassFlash(checked) {
        setGlassFlash(checked);
        saveConfig();
    },
    setMaxHeight(value, displayEl) {
        setMaxHeight(value, displayEl);
        saveConfig();
    },
    setBarWidth(value, displayEl) {
        setBarWidth(value, displayEl);
        saveConfig();
    },
    setMirrorCount(value, displayEl) {
        setMirrorCount(value, displayEl);
        saveConfig();
    },
    // (Phần B, Galaxy — 5 method spaceStyle/4 slider ĐÃ BỎ 21/07/2026, phản hồi Giang mục 1)

    /**
     * FIX (04/07/2026, mục 1 phản hồi Giang) — GỘP nút "Chọn thư viện" (đã xoá) VÀO ĐÂY: gạt toggle
     * lên "On" giờ TỰ mở picker chọn ảnh có sẵn trong File Manager luôn, không cần 2 control tách
     * rời (từng gây bug UX: gạt On xong đóng modal không chọn gì, toggle vẫn kẹt "on"). Huỷ/đóng
     * modal không chọn ảnh -> `onCancel` tự trả toggle về "off" (tham số của
     * openImageCarouselPickerModal, xem core/file-manager/photo-ui.js). Gạt về "off" thì chỉ tắt
     * hiển thị — KHÔNG xoá Blob đã lưu trong IndexedDB nữa (đảo ngược quyết định cũ, xem
     * applyBgImageEnabled() core/visualizer/visualizer-display.js).
     *
     * MỒ CÔI HOÀN TOÀN (17/07/2026) — trước đây còn 1 đường gọi thật (event/workflow/theme.js ->
     * `selectThemeMode()`, khi card "Background" chưa có ảnh); card đó giờ gọi thẳng
     * `workflowFileManagerPhoto.openCoverImagePicker()` (Generic Drawer), KHÔNG qua hàm này nữa
     * (xem event/workflow/theme.js::pickNewBackgroundImage()). Đường vào CÒN LẠI —
     * `case 'visualizerDisplay.bgImage.toggle'` (event/router/visualizer-display.js) — đã mồ côi
     * TỪ TRƯỚC (07/07/2026, HOTFIX 4: checkbox `bgImageEnableToggle` gửi msg.type này đã bị xoá
     * khỏi DOM, không còn listener nào gửi lại msg.type đó nữa, xem
     * event/listener/visualizer-display.js). Kết quả: KHÔNG còn đường chạy thật nào tới hàm này —
     * GIỮ NGUYÊN trên đĩa (không xoá), cùng tinh thần các file mồ côi khác đã ghi nhận ở
     * readme/folder-structure.md (`event/workflow/document-picker.js`...).
     * @param {{enabled: boolean}} payload
     */
    async toggleBgImage(payload) {
        const { enabled } = payload;
        if (!enabled) {
            applyBgImageEnabled(false); // core giờ đồng bộ (không còn đụng IndexedDB)
            updatePlaylistBg();
            forceGlassRepaint(); // fix bug 09/07/2026 (mục 3) — ép WebKit vẽ lại lớp kính, xem docstring core/color-utils.js
            saveConfig();
            return;
        }

        const images = await listImages(); // core có sẵn (core/file-manager/image.js), CÓ return, DÙNG ngay dưới
        // FIX (04/07/2026, mục 2 phản hồi Giang) — đổi sang carousel (1 ảnh/lúc, windowed DOM)
        // THAY lưới ảnh cũ, xem core/file-manager/photo-ui.js::openImageCarouselPickerModal.
        //
        // FIX (09/07/2026, bug "chọn ảnh Background xong không hiện chọn/không hiện slider blur,
        // phải reload mới ra") — `openImageCarouselPickerModal()` là callback-based (onSelect/
        // onCancel), TỰ NÓ return ngay sau khi MỞ modal, không đợi người dùng chọn/huỷ gì cả. Trước
        // đây hàm `toggleBgImage()` (async) gọi nó KHÔNG bọc Promise -> hàm async này coi như xong
        // NGAY LẬP TỨC, trong khi nơi gọi (event/workflow/theme.js::selectThemeMode()) đang
        // `await workflowVisualizerDisplay.toggleBgImage(...)` để biết CHẮC CHẮN người dùng đã chọn
        // xong ảnh trước khi set `themeMode`/gọi `refreshThemeCardUI()` — `await` đó thực chất
        // không đợi được gì (resolve gần như đồng bộ), nên `selectThemeMode()` kiểm tra
        // `cfg.bgImage` lúc ảnh CHƯA kịp áp, tưởng picker bị huỷ, return sớm: ảnh vẫn hiện lên nền
        // (do `applyBgImage()`/`updatePlaylistBg()` chạy trong callback, độc lập) nhưng card
        // "Background" không được đánh dấu chọn, slider "Độ mờ nền" không hiện — chỉ đúng lại sau
        // khi reload (lúc đó `bgImage` đã có sẵn trong config, `selectThemeMode()` đi nhánh
        // `else` KHÔNG qua picker nữa, chạy đồng bộ trọn vẹn).
        // Sửa bằng cách BỌC lời gọi callback-based vào 1 `new Promise()` — hàm `toggleBgImage()`
        // (async) giờ THẬT SỰ đợi tới khi `onSelect`/`onCancel` chạy xong (bất kể chọn hay huỷ) rồi
        // mới resolve, `await` ở nơi gọi mới có tác dụng đúng nghĩa. KHÔNG đổi
        // `openImageCarouselPickerModal()` (core dùng chung, còn 1 nơi gọi khác — event/workflow/
        // visualizer-control-center.js — không cần await nên không đụng tới).
        await new Promise((resolve) => {
            openImageCarouselPickerModal(images, async (imageKey) => { // core/file-manager/photo-ui.js
                const record = await getImageRecord(imageKey); // core có sẵn (service/db.js)
                if (!record) { resolve(); return; } // guard: ảnh vừa bị xoá ở tab/thao tác khác -> coi như huỷ (07/07/2026: KHÔNG còn checkbox để trả về "off" — event/workflow/theme.js tự kiểm tra lại bgImage rỗng để biết đã huỷ)
                await withLoadingShield(t('common.loading.savingImageBg'), async () => {
                    await applyBgImage(record.blob); // core có sẵn — Blob coi như File vừa chọn
                });
                updatePlaylistBg();
                forceGlassRepaint(); // fix bug 09/07/2026 (mục 3)
                saveConfig();
                resolve();
            }, () => {
                // (07/07/2026: KHÔNG còn checkbox để trả về "off" — huỷ picker, bgImage vẫn rỗng,
                // event/workflow/theme.js::selectThemeMode() tự phát hiện qua đó, không cần làm gì ở đây)
                resolve();
            });
        });
    },

    /** Ứng với 'visualizerDisplay.bgBlur.input' — batch "nền chung" (07/07/2026): trước đây router
     * gọi thẳng `setBgBlur()` (1 hàm core). Core giờ Rule 1-4 đầy đủ (bỏ updatePlaylistBg/
     * saveConfig nội bộ) nên chuyển qua đây. @param {string} value */
    setBgBlur(value) {
        setBgBlur(value); // core cùng tên, gọi trần phân giải theo scope từ vựng (xem lưu ý đặt tên đầu file)
        updatePlaylistBg();
        forceGlassRepaint(); // fix bug 09/07/2026 (mục 3)
        saveConfig();
    },
};
