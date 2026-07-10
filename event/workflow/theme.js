/**
 * event/workflow/theme.js — "THẰNG THỰC THI CUỐI" của router "theme" (MỞ ĐẦU THEME THẬT,
 * 07/07/2026, phản hồi Giang mục 3 — 3 card Sáng/Tối/Background loại trừ nhau).
 *
 * Card "Background" TÁI DÙNG NGUYÊN hệ thống bgImage/bgBlur/bgImageEnabled đã có sẵn (core/
 * visualizer/visualizer-display.js::applyBgImage()/applyBgImageEnabled(), event/workflow/
 * visualizer-display.js::toggleBgImage() — dùng lại chính LUỒNG MỞ PICKER đã viết cho toggle "App
 * background image" cũ, không viết lại từ đầu). Card "Sáng"/"Tối" CHỈ lưu lựa chọn + tắt ảnh nền
 * — CHƯA áp dụng lại màu app thật (xem docstring DEFAULT_VIZ_CONFIG.themeMode, core/config.js).
 *
 * === MODE "GRADIENT" RIÊNG (09/07/2026, phản hồi Giang mục 1 — "Thêm gradient là một mode riêng")
 * === Card thứ 4, ĐỘC LẬP hoàn toàn với "Background" (ảnh) — 2 field cấu hình riêng
 * (`gradientFrom`/`gradientTo`), core setter riêng (core/visualizer/visualizer-display.js::
 * setThemeGradientFrom/To), không đụng gì tới bgImage/bgBlur/bgImageEnabled.
 *
 * === VIẾT LẠI `selectThemeMode()` (09/07/2026) === Trước đây mutate `cfg.themeMode` SAU CÙNG,
 * `updatePlaylistBg()` gọi rải rác TRONG từng nhánh if/else (đọc `cfg.themeMode` CŨ, trước khi kịp
 * cập nhật) — vô hại lúc đó vì hàm này chỉ cần biết `cfg.bgImage` có hay không. Từ khi thêm nhánh
 * 'gradient' vào `updatePlaylistBg()` (core/color-utils.js, đọc `cfg.themeMode` để quyết định vẽ
 * gradient khi KHÔNG có ảnh), thứ tự bắt đầu quan trọng — dồn `updatePlaylistBg()` về ĐÚNG 1 lần
 * DUY NHẤT, SAU KHI `themeMode` đã mutate xong, tránh đọc giá trị CŨ.
 *
 * === FIX bug "chọn ảnh xong vẫn thấy nền cũ, thao tác gì đó mới trong suốt" (09/07/2026, phản hồi
 * Giang mục 3) === Thêm `forceGlassRepaint()` (core/color-utils.js) NGAY SAU MỌI lần
 * `updatePlaylistBg()` do người dùng chủ động đổi nền — bug WebKit/iOS Safari (backdrop-filter
 * không tự resample), xem docstring đầy đủ ở `forceGlassRepaint()`.
 *
 * NẠP SAU: core/settings-panel-stack.js (không cần, panel Theme sống ở Main list, TĨNH), core/
 * visualizer/visualizer-display.js (applyBgImageEnabled, setThemeGradientFrom/To), event/workflow/
 * visualizer-display.js (workflowVisualizerDisplay.toggleBgImage), core/color-utils.js
 * (updatePlaylistBg, forceGlassRepaint), core/config.js (saveConfig), core/dom-refs.js
 * (themeModeCardLight/Dark/Background/Gradient, themeBgBlurRow, themeGradientRow,
 * themeGradientFromPicker/ToPicker, themeMockupBackground/Icon, themeMockupGradient,
 * bgBlurSlider, valBgBlurDisplay).
 */
const workflowTheme = {

    /**
     * Ứng với msg.type = 'theme.selectMode.click'.
     * @param {'light'|'dark'|'background'|'gradient'} mode
     */
    async selectThemeMode(mode) {
        if (mode === 'background') {
            const cfg = appState.get('vizConfig');
            if (!cfg.bgImage) {
                // Chưa từng chọn ảnh nào -> mở picker (TÁI DÙNG NGUYÊN flow cũ, CÓ mở hộp thoại).
                // toggleBgImage() giờ THẬT SỰ await tới lúc chọn/huỷ xong (fix 09/07/2026, xem
                // docstring event/workflow/visualizer-display.js::toggleBgImage()).
                await workflowVisualizerDisplay.toggleBgImage({ enabled: true });
                if (!appState.get('vizConfig').bgImage) return; // huỷ picker -> giữ nguyên mode cũ, không đổi gì
            } else {
                // ĐÃ có ảnh từ trước -> chỉ cần BẬT LẠI, KHÔNG mở picker lại (core thuần, đồng bộ).
                applyBgImageEnabled(true);
            }
        } else {
            // 'light' | 'dark' | 'gradient' — cả 3 đều KHÔNG dùng ảnh -> tắt hẳn bgImage. Riêng
            // 'gradient' tự vẽ nền qua updatePlaylistBg() ngay dưới (đọc themeMode SAU khi đã
            // mutate), không cần xử lý gì thêm ở đây.
            applyBgImageEnabled(false);
        }
        appState.mutate('vizConfig', cfg => { cfg.themeMode = mode; });
        saveConfig();
        updatePlaylistBg(); // ĐẶT SAU khi themeMode đã cập nhật — xem docstring đầu file.
        forceGlassRepaint(); // fix bug mục 3 — ép WebKit vẽ lại lớp kính NGAY, không đợi thao tác khác.
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
        const cfg = appState.get('vizConfig');
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
