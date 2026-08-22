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
 * (12/08/2026) Cấu hình riêng effect (màu/blur/style con/kích thước) ĐÃ DỜI hẳn sang Custom Effect
 * Drawer (event/workflow/custom-effect.js) — `openPanel()`/`openCustomEffectPanel()` cũ ĐÃ BỎ,
 * thay bằng `openDisplayPanel()` (panel "Display", 5 toggle UI chrome).
 */
const workflowVisualizerDisplay = {

    /** Đồng bộ 5 toggle panel "Display" (components/settings/visualizer-display-panel.js). SỬA
     * (đợt migrate Visualizer Screen, phản hồi Giang "làm nốt visualizer") — KHÔNG còn
     * `pushSettingsPanel()`, bodyHtml do event/workflow/app-settings.js cung cấp SẴN qua
     * `navigateTo()` — chỉ còn đồng bộ giá trị vào `genericDrawerBody`. */
    openDisplayPanel() {
        const panelEl = genericDrawerBody;
        const cfg = appConfigViz.getAll();
        panelEl.querySelector('#setting-visual-enable').checked = cfg.visualEnabled !== false;
        panelEl.querySelector('#setting-stats-panel-enable').checked = appConfigPlayer.getAll().isStatsPanelVisible !== false;
        panelEl.querySelector('#setting-bottom-player-enable').checked = cfg.bottomPlayerVisible !== false;
        panelEl.querySelector('#setting-playlist-button-enable').checked = cfg.playlistButtonVisible !== false;
        panelEl.querySelector('#setting-control-center-button-enable').checked = cfg.controlCenterButtonVisible !== false;
    },

    /** Ứng với msg.type = 'visualizerDisplay.openAutoSwitchPanel.click' — push panel "Auto-Switch
     * Effect" (MỚI 12/08/2026, mục 4f — tách từ card "Auto-switch effect" cũ trong panel
     * "Customize Visualizer") + đồng bộ mọi input (thay `initAutoSwitchVisualUI()` cũ — xem
     * core/auto-switch-visual.js). */
    /** Đồng bộ mọi input panel "Auto-Switch Effect" (thay `initAutoSwitchVisualUI()` cũ — xem
     * core/auto-switch-visual.js). SỬA (đợt migrate Visualizer Screen) — KHÔNG còn
     * `pushSettingsPanel()`, cùng khuôn openDisplayPanel() ngay trên. */
    openAutoSwitchPanel() {
        const panelEl = genericDrawerBody;
        const cfg = appConfigViz.getAll();

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

    // (14 method set* cho màu/blur/style con/kích thước ĐÃ DỜI sang event/workflow/custom-effect.js)
    // (Phần B, Galaxy — 5 method spaceStyle/4 slider ĐÃ BỎ 21/07/2026)

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
     * readme/folder-structure.md.
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

    /** Ứng với 'visualizerDisplay.statsPanelEnable.change' — checkbox dời từ nút Control Center.
     * Lưu bền qua domain 'player' (CÙNG Shuffle/Repeat, KHÔNG đổi domain — tái dùng
     * workflowPlayerControls._persistPlayerConfig() thay vì viết lại logic ghi bền lần 2). */
    setStatsPanelEnabled(checked) {
        setStatsPanelVisible(checked); // core/visualizer-ui-visibility.js
        workflowPlayerControls._persistPlayerConfig(); // event/workflow/player-controls.js — liên tuyến domain
    },

    /** 3 toggle RIÊNG (bỏ hẳn "full mode" gộp chung) — CÙNG khuôn setStatsPanelEnabled() ngay
     * trên: đặt tên KHẲNG ĐỊNH, checked=true nghĩa là HIỆN (không đảo `!checked` như bản cũ đặt
     * tên phủ định "hideX" — phản hồi Giang, nhất quán toàn section). Tên method TRÙNG core cùng
     * chức năng (gọi trần phân giải theo scope từ vựng — xem setBgBlur() trên, cùng khuôn). Ứng
     * với 'visualizerDisplay.bottomPlayerVisible/playlistButtonVisible/
     * controlCenterButtonVisible.change'. */
    setBottomPlayerVisible(checked) {
        setBottomPlayerVisible(checked); // core cùng tên
        appConfigViz.mutateAll(cfg => { cfg.bottomPlayerVisible = checked; });
        saveConfig();
    },
    setPlaylistButtonVisible(checked) {
        setPlaylistButtonVisible(checked); // core cùng tên
        appConfigViz.mutateAll(cfg => { cfg.playlistButtonVisible = checked; });
        saveConfig();
    },
    setControlCenterButtonVisible(checked) {
        setControlCenterButtonVisible(checked); // core cùng tên
        appConfigViz.mutateAll(cfg => { cfg.controlCenterButtonVisible = checked; });
        saveConfig();
    },
};
