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
 * NẠP SAU: core/settings-panel-stack.js (không cần, panel Theme sống ở Main list, TĨNH), core/
 * visualizer/visualizer-display.js (applyBgImageEnabled), event/workflow/visualizer-display.js
 * (workflowVisualizerDisplay.toggleBgImage), core/color-utils.js (updatePlaylistBg), core/config.js
 * (saveConfig), core/dom-refs.js (themeModeCardLight/Dark/Background, themeBgBlurRow,
 * bgBlurSlider, valBgBlurDisplay).
 */
const workflowTheme = {

    /**
     * Ứng với msg.type = 'theme.selectMode.click'.
     * @param {'light'|'dark'|'background'} mode
     */
    async selectThemeMode(mode) {
        if (mode === 'background') {
            const cfg = appState.get('vizConfig');
            if (!cfg.bgImage) {
                // Chưa từng chọn ảnh nào -> mở picker (TÁI DÙNG NGUYÊN flow cũ, CÓ mở hộp thoại).
                await workflowVisualizerDisplay.toggleBgImage({ enabled: true });
                if (!appState.get('vizConfig').bgImage) return; // huỷ picker -> giữ nguyên mode cũ, không đổi gì
            } else {
                // ĐÃ có ảnh từ trước -> chỉ cần BẬT LẠI, KHÔNG mở picker lại (core thuần, đồng bộ).
                applyBgImageEnabled(true);
                updatePlaylistBg();
            }
        } else {
            applyBgImageEnabled(false);
            updatePlaylistBg();
        }
        appState.mutate('vizConfig', cfg => { cfg.themeMode = mode; });
        saveConfig();
        this.refreshThemeCardUI();
    },

    /** Đồng bộ UI 3 card (viền/radio "đang chọn") + hiện/ẩn hàng "Độ mờ nền" — gọi lúc boot VÀ
     * sau mỗi lần đổi mode. */
    refreshThemeCardUI() {
        const cfg = appState.get('vizConfig');
        const mode = cfg.themeMode;

        const cards = {
            light: themeModeCardLight,
            dark: themeModeCardDark,
            background: themeModeCardBackground,
        };
        Object.keys(cards).forEach((m) => {
            const card = cards[m];
            if (!card) return; // guard: DOM chưa sẵn sàng (hiếm, race lúc boot)
            const radio = card.querySelector('.theme-mode-radio');
            const isSelected = m === mode;
            card.classList.toggle('ring-2', isSelected);
            card.classList.toggle('ring-sky-400', isSelected);
            if (radio) {
                radio.classList.toggle('bg-sky-500', isSelected);
                radio.classList.toggle('border-sky-400', isSelected);
                radio.innerHTML = isSelected
                    ? '<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>'
                    : '';
            }
        });

        if (themeBgBlurRow) {
            const showBlur = mode === 'background';
            themeBgBlurRow.classList.toggle('hidden', !showBlur);
            themeBgBlurRow.classList.toggle('flex', showBlur);
            if (showBlur && bgBlurSlider) {
                bgBlurSlider.value = cfg.bgBlur;
                if (valBgBlurDisplay) valBgBlurDisplay.textContent = cfg.bgBlur + 'px';
            }
        }
    },
};
