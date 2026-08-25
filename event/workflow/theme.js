/**
 * event/workflow/theme.js — "THẰNG THỰC THI CUỐI" của router "theme" (3 card Sáng/Tối/Background
 * loại trừ nhau, cộng card Gradient độc lập).
 *
 * Card "Background" TÁI DÙNG NGUYÊN hệ thống bgImage/bgBlur/bgImageEnabled đã có sẵn (core/
 * visualizer/visualizer-display.js::applyBgImage()/applyBgImageEnabled()). Card "Sáng"/"Tối" CHỈ
 * lưu lựa chọn + tắt ảnh nền — CHƯA áp dụng lại màu app thật (xem docstring
 * DEFAULT_VIZ_CONFIG.themeMode, core/config.js). Picker chọn ảnh nền là Generic Drawer, TÁI DÙNG
 * NGUYÊN `workflowFileManagerPhoto.openCoverImagePicker()` — cùng picker dùng cho "Ảnh bìa" bài
 * hát (event/workflow/file-manager-photo.js).
 *
 * 3 method riêng theo mode (`applyNonBackgroundMode`/`pickNewBackgroundImage`/
 * `reuseExistingBackgroundImage`) — Router (event/router/theme.js) tự đọc `vizConfig` +
 * `VirtualMachineState` chọn ĐÚNG 1 method (event-bus-flow.md mục 4C: "cần đọc appState KHÁC để
 * quyết định CHẠY GÌ — LUÔN dùng VirtualMachineState" ở Router, không tự if/else trong Workflow);
 * cả 3 dùng chung `_commitThemeMode()` làm phần đuôi.
 *
 * Card "Gradient" (09/07/2026) ĐỘC LẬP hoàn toàn với "Background" (ảnh) — 2 field cấu hình riêng
 * (`gradientFrom`/`gradientTo`), core setter riêng (core/visualizer/visualizer-display.js::
 * setThemeGradientFrom/To), không đụng gì tới bgImage/bgBlur/bgImageEnabled.
 *
 * `_commitThemeMode()` mutate `cfg.themeMode` TRƯỚC, gọi `updatePlaylistBg()` + `forceGlassRepaint()`
 * (fix bug WebKit/iOS Safari backdrop-filter không tự resample) ĐÚNG 1 lần SAU CÙNG — thứ tự này
 * bắt buộc vì `updatePlaylistBg()` (core/color-utils.js) đọc `cfg.themeMode` để quyết định vẽ
 * gradient khi KHÔNG có ảnh.
 *
 * NẠP SAU: core/visualizer/visualizer-display.js (applyBgImageEnabled, applyBgImage),
 * core/color-utils.js (updatePlaylistBg, forceGlassRepaint), core/config.js (saveConfig),
 * core/loading-shield-util.js (withLoadingShield), service/db.js (getImageRecord), core/dom-refs.js
 * (themeModeCardLight/Dark/Background/Gradient, themeBgBlurRow, themeGradientRow,
 * themeGradientFromPicker/ToPicker, themeMockupBackground/Icon, themeMockupGradient,
 * bgBlurSlider, valBgBlurDisplay), event/workflow/file-manager-photo.js
 * (workflowFileManagerPhoto.openCoverImagePicker).
 */
const workflowTheme = {

    /**
     * Ứng với 'theme.selectMode.click' khi `mode !== 'background'` (light/dark/gradient) — Router
     * đã đọc appState + VirtualMachineState chọn ĐÚNG method này (xem event/router/theme.js).
     * Cả 3 mode đều KHÔNG dùng ảnh -> tắt hẳn bgImage rồi chốt mode.
     * @param {'light'|'dark'|'gradient'} mode
     */
    applyNonBackgroundMode(mode) {
        applyBgImageEnabled(false);
        this._commitThemeMode(mode);
    },

    /**
     * Ứng với 'theme.selectMode.click' khi cần ảnh MỚI — Router đã tính sẵn điều kiện này
     * (`needsNewBackgroundPhoto`, xem event/router/theme.js): chưa từng chọn ảnh nào, HOẶC đang
     * bấm lại ĐÚNG card "Background" trong lúc nó ĐANG active (muốn đổi ảnh khác).
     *
     * FIX BUG (17/07/2026, phản hồi Giang) "đã chọn Background nhưng muốn đổi ảnh khác thì không
     * được, phải đổi sang mode khác rồi chọn lại mới ra picker" — nằm ở CHÍNH điều kiện
     * `needsNewBackgroundPhoto` bên Router: bản trước CHỈ mở picker khi `cfg.bgImage` rỗng, bấm
     * lại ĐÚNG card đang active (bgImage vẫn còn) luôn bị coi là "đã có ảnh -> chỉ bật lại"
     * (`reuseExistingBackgroundImage()`), không có đường nào quay lại picker nếu không rời mode
     * trước đó (rời mode khác VÔ TÌNH xoá `cfg.bgImage` qua `applyBgImageEnabled(false)`, khiến
     * bước sau lại thấy rỗng — đó là lý do "đổi mode khác rồi chọn lại" TÌNH CỜ có tác dụng, không
     * phải hành vi được thiết kế).
     *
     * Dùng Generic Drawer — TÁI DÙNG NGUYÊN `workflowFileManagerPhoto.openCoverImagePicker()`
     * (event/workflow/file-manager-photo.js), ĐÚNG picker đang dùng cho "Ảnh bìa" bài hát (Workflow
     * gọi Workflow miền khác, tự do — event-bus-flow.md mục 4B).
     *
     * LƯU Ý — picker Generic Drawer KHÔNG blocking: `await
     * workflowFileManagerPhoto.openCoverImagePicker(...)` chỉ đợi tới lúc DRAWER MỞ XONG + ảnh tải
     * xong, KHÔNG đợi tới khi người dùng thật sự CHỌN/HUỶ. Vì vậy toàn bộ phần "chốt mode" PHẢI dời
     * vào TRONG callback `onSelect` (chạy MUỘN, đúng lúc người dùng thật sự bấm 1 ảnh) — gọi
     * `_commitThemeMode('background')` ở đó, KHÔNG gọi ngay sau `await` như 1 hàm đồng bộ bình
     * thường.
     */
    async pickNewBackgroundImage() {
        await workflowFileManagerPhoto.openCoverImagePicker(async (imageKey) => { // event/workflow/file-manager-photo.js
            const record = await getImageRecord(imageKey); // service/db.js
            if (!record) return; // guard: ảnh vừa bị xoá ở tab/thao tác khác
            await withLoadingShield(t('common.loading.savingImageBg'), async () => { // core/loading-shield-util.js
                await applyBgImage(record.blob); // core/visualizer/visualizer-display.js
            });
            this._commitThemeMode('background');
        }); // KHÔNG cần onCancel — huỷ picker thì giữ nguyên mode/ảnh hiện tại, không cần làm gì thêm.
    },

    /** Ứng với 'theme.selectMode.click' khi ĐÃ có ảnh từ trước VÀ KHÔNG phải đang reselect (Router
     * đã loại 2 case kia qua VMState) — chỉ cần BẬT LẠI, KHÔNG mở picker. */
    reuseExistingBackgroundImage() {
        applyBgImageEnabled(true);
        this._commitThemeMode('background');
    },

    /** Gộp phần "chốt mode" DÙNG CHUNG (mutate themeMode + saveConfig + updatePlaylistBg +
     * forceGlassRepaint + refreshThemeCardUI) cho cả 3 method ngay trên — 3 method đó KHÁC nhau ở
     * PHẦN ĐẦU (tắt/bật/mở picker ảnh), NHƯNG luôn kết thúc bằng ĐÚNG đoạn này.
     * @param {'light'|'dark'|'background'|'gradient'} mode
     */
    _commitThemeMode(mode) {
        appConfigViz.mutateAll(cfg => { cfg.themeMode = mode; });
        saveConfig();
        updatePlaylistBg(); // ĐẶT SAU khi themeMode đã cập nhật — xem docstring đầu file.
        forceGlassRepaint(); // fix bug mục 3 (09/07/2026) — ép WebKit vẽ lại lớp kính NGAY, không đợi thao tác khác.
        this.refreshThemeCardUI();
    },

    /** Ứng với msg.type = 'theme.gradientFrom.input'. @param {string} value */
    setGradientFrom(value) {
        setThemeGradientFrom(value); // core cùng tên, gọi trần phân giải theo scope từ vựng (core/visualizer/visualizer-display.js)
        saveConfig();
        updatePlaylistBg();
        forceGlassRepaint();
        this.refreshThemeCardUI(); // cập nhật mockup preview #theme-mockup-gradient theo màu mới
    },

    /** Ứng với msg.type = 'theme.gradientTo.input'. @param {string} value */
    setGradientTo(value) {
        setThemeGradientTo(value);
        saveConfig();
        updatePlaylistBg();
        forceGlassRepaint();
        this.refreshThemeCardUI();
    },

    /** Đồng bộ UI 4 card (nền gradient "đang chọn"/radio) + mockup Background/Gradient (phản ánh
     * ảnh/màu THẬT đang cấu hình) + hiện/ẩn 2 hàng "Độ mờ nền"/"2 màu Gradient" — gọi lúc boot VÀ
     * sau mỗi lần đổi mode/màu. */
    refreshThemeCardUI() {
        const cfg = appConfigViz.getAll();
        const mode = cfg.themeMode;

        const cards = {
            light: themeModeCardLight,
            dark: themeModeCardDark,
            background: themeModeCardBackground,
            gradient: themeModeCardGradient,
        };
        Object.keys(cards).forEach((m) => {
            const card = cards[m];
            if (!card) return; // guard: DOM chưa sẵn sàng (hiếm, race lúc boot)
            const radio = card.querySelector('.theme-mode-radio');
            const isSelected = m === mode;
            // 09/07/2026 (phản hồi Giang — "xoá border select theme"): bỏ viền ring-2 ring-sky-400
            // cũ, đổi sang nền gradient phủ lên card đang chọn (rounded-2xl/p-2 tĩnh đã có sẵn
            // trong template — xem components/settings/theme.js). LƯU Ý: gradient UI-indicator này
            // KHÔNG liên quan gradient của mode "Gradient" (mục d) — chỉ là màu đánh dấu chọn.
            card.classList.toggle('bg-gradient-to-b', isSelected);
            card.classList.toggle('from-sky-500/25', isSelected);
            card.classList.toggle('to-sky-500/5', isSelected);
            if (radio) {
                radio.classList.toggle('bg-sky-500', isSelected);
                radio.classList.toggle('border-sky-400', isSelected);
                radio.innerHTML = isSelected
                    ? '<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>'
                    : '';
            }
        });

        // MỚI (09/07/2026, mục 2 — mockup "phản ánh ảnh/gradient được chọn"):
        if (themeMockupBackground) {
            if (cfg.bgImage) {
                themeMockupBackground.style.backgroundImage = `url(${cfg.bgImage})`;
                themeMockupBackground.classList.remove('border-dashed');
                if (themeMockupBackgroundIcon) themeMockupBackgroundIcon.classList.add('hidden');
            } else {
                themeMockupBackground.style.backgroundImage = 'none';
                themeMockupBackground.classList.add('border-dashed');
                if (themeMockupBackgroundIcon) themeMockupBackgroundIcon.classList.remove('hidden');
            }
        }
        if (themeMockupGradient) {
            themeMockupGradient.style.background = `linear-gradient(135deg, ${cfg.gradientFrom}, ${cfg.gradientTo})`;
        }

        if (themeBgBlurRow) {
            const showBlur = mode === 'background';
            themeBgBlurRow.classList.toggle('hidden', !showBlur);
            themeBgBlurRow.classList.toggle('flex', showBlur);
            if (showBlur && bgBlurSlider) {
                bgBlurSlider.value = cfg.bgBlur;
                if (valBgBlurDisplay) valBgBlurDisplay.textContent = cfg.bgBlur + 'px';
            }
        }
        if (themeGradientRow) {
            const showGradient = mode === 'gradient';
            themeGradientRow.classList.toggle('hidden', !showGradient);
            themeGradientRow.classList.toggle('flex', showGradient);
            if (showGradient) {
                if (themeGradientFromPicker) themeGradientFromPicker.value = cfg.gradientFrom;
                if (themeGradientToPicker) themeGradientToPicker.value = cfg.gradientTo;
            }
        }
    },
};
