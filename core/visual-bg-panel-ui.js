/**
 * core/visual-bg-panel-ui.js — ghi DOM các màn Visual Background trong Generic Drawer: Background Media / Background Color
 * (components/visual-bg-settings-drawer.js), sub panel Gradient (components/visual-bg-gradient-drawer.js), màn Âm thanh
 * Video (components/visual-bg-video-audio-drawer.js) và picker Video/Ảnh. Nhận phần tử gốc + giá trị đã chuẩn bị qua tham số; không đọc appState/config, không gọi core
 * khác. Phần tử không có trong màn đang gắn -> bỏ qua. Gọi từ workflowVisualBg (event/workflow/visual-bg-common.js).
 */

/** id nhãn thời lượng của sub panel Gradient -> field `gradientMovement` (ms, hiện dạng "2.0s"). */
const VISUAL_BG_GRADIENT_MS_LABEL_ID_BY_FIELD = {
    rotateDurationMs: 'visual-bg-gradient-movement-duration-value',
    colorSwapIntervalMs: 'visual-bg-gradient-colorswap-interval-value',
    colorSwapTransitionMs: 'visual-bg-gradient-colorswap-transition-value',
};

/** Màn VBG (bất kỳ) có đang gắn trong `panelEl` không — nhận diện qua `[data-visual-bg-panel]` ở gốc mỗi màn.
 * @param {HTMLElement|null} panelEl @returns {boolean} */
function hasVisualBgPanelRoot(panelEl) {
    return !!panelEl && !!panelEl.querySelector('[data-visual-bg-panel]');
}

/**
 * Đồng bộ mọi control của màn Background Media / Background Color theo `cfg`.
 * @param {HTMLElement} panelEl
 * @param {object} cfg - appConfigVisualBg.getAll()
 * @param {{liveCount: number, resolutionMode: string, motionName: string, gradientCss: string}} view - số item sống đang
 *   hiển thị (pending nếu có), Resolution đã chuẩn hoá của `type`, tên preset Motion, CSS gradient tĩnh
 */
function fillVisualBgSettingsPanel(panelEl, cfg, view) {
    const isList = view.liveCount > 1;
    const isVideo = cfg.type === 'video';
    const isSlideshowCycling = isList && cfg.listPlaybackMode === 'slideshow';
    const isGradient = cfg.colorMode === 'gradient';

    const enabledCheckbox = panelEl.querySelector('#setting-visual-bg-enabled');
    if (enabledCheckbox) enabledCheckbox.checked = cfg.enabled !== false;

    const listPlaybackSelect = panelEl.querySelector('#setting-visual-bg-list-playback-mode');
    if (listPlaybackSelect) listPlaybackSelect.value = cfg.listPlaybackMode;
    const nextOrderSelect = panelEl.querySelector('#setting-visual-bg-next-order');
    if (nextOrderSelect) nextOrderSelect.value = cfg.nextOrder;
    const playbackGroup = panelEl.querySelector('#visual-bg-playback-group'); // chưa có media sống -> ẩn cả nhóm Playback
    if (playbackGroup) playbackGroup.classList.toggle('hidden', view.liveCount < 1);
    const listPlaybackRow = panelEl.querySelector('#visual-bg-list-playback-row');
    if (listPlaybackRow) listPlaybackRow.classList.toggle('hidden', !isList);
    const nextOrderRow = panelEl.querySelector('#visual-bg-next-order-row');
    if (nextOrderRow) nextOrderRow.classList.toggle('hidden', !isList);

    const durationModeSelect = panelEl.querySelector('#setting-visual-bg-duration-mode');
    if (durationModeSelect) durationModeSelect.value = cfg.durationMode;
    const durationModeRow = panelEl.querySelector('#visual-bg-duration-mode-row');
    if (durationModeRow) durationModeRow.classList.toggle('hidden', !isSlideshowCycling);
    const durationSecondsRow = panelEl.querySelector('#visual-bg-duration-seconds-row');
    if (durationSecondsRow) durationSecondsRow.classList.toggle('hidden', !(isSlideshowCycling && cfg.durationMode === 'fixtime'));
    const durationSecondsLabel = panelEl.querySelector('#visual-bg-duration-seconds-label');
    if (durationSecondsLabel) durationSecondsLabel.textContent = t(isVideo ? 'visualBgSettingsDrawer.durationSeconds.labelVideo' : 'visualBgSettingsDrawer.durationSeconds.labelPhoto');
    const durationSecondsBtn = panelEl.querySelector('#setting-visual-bg-duration-seconds');
    if (durationSecondsBtn) durationSecondsBtn.textContent = `${cfg.durationSeconds.toFixed(1)}s`;

    const videoAudioRow = panelEl.querySelector('#setting-visual-bg-open-video-audio');
    if (videoAudioRow) videoAudioRow.classList.toggle('hidden', !(isVideo && view.liveCount >= 1));

    const resolutionLabel = panelEl.querySelector('#visual-bg-resolution-label'); // card Media: luôn hiện, nhãn + giá trị theo `type`
    if (resolutionLabel) resolutionLabel.textContent = t(isVideo ? 'visualBgSettingsDrawer.resolution.labelVideo' : 'visualBgSettingsDrawer.resolution.labelPhoto');
    const resolutionSelect = panelEl.querySelector('#setting-visual-bg-resolution');
    if (resolutionSelect) resolutionSelect.value = view.resolutionMode;

    const syncSpeedRow = panelEl.querySelector('#visual-bg-sync-speed-row');
    if (syncSpeedRow) syncSpeedRow.classList.toggle('hidden', !isVideo);
    const syncSpeedCheckbox = panelEl.querySelector('#setting-visual-bg-sync-speed');
    if (syncSpeedCheckbox) syncSpeedCheckbox.checked = cfg.videoSyncPlaybackSpeed;

    const motionBtn = panelEl.querySelector('#setting-visual-bg-open-motion-picker');
    if (motionBtn) motionBtn.classList.toggle('hidden', cfg.type !== 'photo' && !isVideo);
    const motionNameEl = panelEl.querySelector('[data-visual-bg-motion-name]');
    if (motionNameEl) motionNameEl.textContent = view.motionName;

    const colorModeSelect = panelEl.querySelector('#setting-visual-bg-color-mode');
    if (colorModeSelect) colorModeSelect.value = cfg.colorMode;
    const solidColorRow = panelEl.querySelector('#visual-bg-solid-color-row');
    if (solidColorRow) solidColorRow.classList.toggle('hidden', isGradient);
    const openGradientBtn = panelEl.querySelector('#setting-visual-bg-open-gradient');
    if (openGradientBtn) openGradientBtn.classList.toggle('hidden', !isGradient);
    const solidColorInput = panelEl.querySelector('#setting-visual-bg-solid-color');
    if (solidColorInput) solidColorInput.value = cfg.solidColor;
    const gradientSwatch = panelEl.querySelector('#visual-bg-gradient-swatch');
    if (gradientSwatch) gradientSwatch.style.backgroundImage = view.gradientCss;
}

/** Nhãn nút "Seconds per video/photo". @param {HTMLElement} panelEl @param {number} seconds */
function setVisualBgDurationSecondsLabel(panelEl, seconds) {
    const btn = panelEl.querySelector('#setting-visual-bg-duration-seconds');
    if (btn) btn.textContent = `${seconds.toFixed(1)}s`;
}

/** Nút "Làm tươi" đang đọc DB: khoá + xoay. @param {HTMLElement|null} panelEl @param {boolean} busy */
function setVisualBgRefreshSourceBusy(panelEl, busy) {
    const btn = panelEl ? panelEl.querySelector('#setting-visual-bg-refresh-source') : null;
    if (!btn) return;
    btn.disabled = busy;
    btn.classList.toggle('animate-spin', busy);
}

/** 2 nút Làm tươi/Gỡ nguồn chỉ hiện khi có origin. @param {HTMLElement|null} panelEl @param {boolean} hasOrigin */
function setVisualBgSourceButtonsVisible(panelEl, hasOrigin) {
    if (!panelEl) return;
    const refreshBtn = panelEl.querySelector('#setting-visual-bg-refresh-source');
    if (refreshBtn) refreshBtn.classList.toggle('hidden', !hasOrigin);
    const clearBtn = panelEl.querySelector('#setting-visual-bg-clear-source');
    if (clearBtn) clearBtn.classList.toggle('hidden', !hasOrigin);
}

/** Tên nguồn đang chọn. @param {HTMLElement|null} panelEl @param {string} name */
function setVisualBgSourceName(panelEl, name) {
    const labelEl = panelEl ? panelEl.querySelector('#visual-bg-source-name') : null;
    if (labelEl) labelEl.textContent = name;
}

// ===================== Sub panel Gradient =====================

/** Đồng bộ góc xoay + Movement + "Tráo màu" lúc mở sub panel (danh sách chặng + preview ghi riêng).
 * @param {HTMLElement} panelEl @param {object} cfg - appConfigVisualBg.getAll() */
function fillVisualBgGradientPanel(panelEl, cfg) {
    const gm = cfg.gradientMovement;
    const angleInput = panelEl.querySelector('#setting-visual-bg-gradient-angle');
    if (angleInput) angleInput.value = cfg.gradientAngleDeg;
    const angleLabel = panelEl.querySelector('#visual-bg-gradient-angle-value');
    if (angleLabel) angleLabel.textContent = `${cfg.gradientAngleDeg}°`;

    const movementCheckbox = panelEl.querySelector('#setting-visual-bg-gradient-movement-enable');
    if (movementCheckbox) movementCheckbox.checked = gm.enabled;
    const movementOptions = panelEl.querySelector('#visual-bg-gradient-movement-options');
    if (movementOptions) movementOptions.classList.toggle('hidden', !gm.enabled);
    const modeSelect = panelEl.querySelector('#setting-visual-bg-gradient-movement-mode');
    if (modeSelect) modeSelect.value = gm.mode;
    const timeBlock = panelEl.querySelector('#visual-bg-gradient-movement-time-block');
    if (timeBlock) timeBlock.classList.toggle('hidden', gm.mode !== 'time');
    const audioBlock = panelEl.querySelector('#visual-bg-gradient-movement-audio-block');
    if (audioBlock) audioBlock.classList.toggle('hidden', gm.mode !== 'audio');
    const audioInputs = {
        '#setting-visual-bg-gradient-movement-audio-rotate-from': gm.audioRotateFrom,
        '#setting-visual-bg-gradient-movement-audio-rotate-to': gm.audioRotateTo,
        '#setting-visual-bg-gradient-movement-audio-spread-from': gm.audioStopSpreadFrom,
        '#setting-visual-bg-gradient-movement-audio-spread-to': gm.audioStopSpreadTo,
    };
    Object.entries(audioInputs).forEach(([sel, value]) => {
        const el = panelEl.querySelector(sel);
        if (el) el.value = value;
    });

    const swapCheckbox = panelEl.querySelector('#setting-visual-bg-gradient-colorswap-enable');
    if (swapCheckbox) swapCheckbox.checked = gm.colorSwapEnabled;
    const swapOptions = panelEl.querySelector('#visual-bg-gradient-colorswap-options');
    if (swapOptions) swapOptions.classList.toggle('hidden', !gm.colorSwapEnabled);
    Object.entries(VISUAL_BG_GRADIENT_MS_LABEL_ID_BY_FIELD).forEach(([field, id]) => {
        const el = panelEl.querySelector(`#${id}`);
        if (el) el.textContent = `${((gm[field] || 0) / 1000).toFixed(1)}s`;
    });
}

/** Nhãn góc xoay. @param {HTMLElement} panelEl @param {number} deg */
function setVisualBgGradientAngleLabel(panelEl, deg) {
    const el = panelEl.querySelector('#visual-bg-gradient-angle-value');
    if (el) el.textContent = `${deg}°`;
}

/** Nhãn % của 1 hàng chặng màu. @param {HTMLElement} panelEl @param {number} index @param {number} position */
function setVisualBgGradientStopLabel(panelEl, index, position) {
    const el = panelEl.querySelector(`[data-visual-bg-stop-label="${index}"]`);
    if (el) el.textContent = `${position}%`;
}

/** Ô vuông xem trước (gradient TĨNH theo config, không chạy Movement). @param {HTMLElement} panelEl @param {string} gradientCss */
function setVisualBgGradientPreview(panelEl, gradientCss) {
    const el = panelEl.querySelector('#visual-bg-gradient-preview');
    if (el) el.style.backgroundImage = gradientCss;
}

/** Vẽ lại danh sách chặng (markup từ components/visual-bg-gradient-drawer.js) + làm mờ nút Thêm khi đã chạm trần.
 * @param {HTMLElement} panelEl @param {string} rowsHtml @param {boolean} canAdd
 * @returns {HTMLElement|null} phần tử danh sách (Workflow áp theme lại) */
function fillVisualBgGradientStopList(panelEl, rowsHtml, canAdd) {
    const listEl = panelEl.querySelector('#visual-bg-gradient-stop-list');
    if (listEl) listEl.innerHTML = rowsHtml;
    const addBtn = panelEl.querySelector('#setting-visual-bg-gradient-add');
    if (addBtn) addBtn.classList.toggle('opacity-30', !canAdd);
    return listEl;
}

/** Hiện/ẩn nhóm tuỳ chọn Movement. @param {HTMLElement} panelEl @param {boolean} enabled */
function setVisualBgGradientMovementOptionsVisible(panelEl, enabled) {
    const el = panelEl.querySelector('#visual-bg-gradient-movement-options');
    if (el) el.classList.toggle('hidden', !enabled);
}

/** Hiện khối input của đúng mode Movement đang chọn. @param {HTMLElement} panelEl @param {string} mode - 'time' | 'audio' */
function setVisualBgGradientMovementModeBlocks(panelEl, mode) {
    const timeBlock = panelEl.querySelector('#visual-bg-gradient-movement-time-block');
    if (timeBlock) timeBlock.classList.toggle('hidden', mode !== 'time');
    const audioBlock = panelEl.querySelector('#visual-bg-gradient-movement-audio-block');
    if (audioBlock) audioBlock.classList.toggle('hidden', mode !== 'audio');
}

/** Hiện/ẩn nhóm tuỳ chọn "Tráo màu". @param {HTMLElement} panelEl @param {boolean} enabled */
function setVisualBgGradientColorSwapOptionsVisible(panelEl, enabled) {
    const el = panelEl.querySelector('#visual-bg-gradient-colorswap-options');
    if (el) el.classList.toggle('hidden', !enabled);
}

/** Nhãn thời lượng (ms -> "2.0s") của 1 field `gradientMovement`. @param {HTMLElement} panelEl
 * @param {'rotateDurationMs'|'colorSwapIntervalMs'|'colorSwapTransitionMs'} field @param {number} ms */
function setVisualBgGradientMsLabel(panelEl, field, ms) {
    const el = panelEl.querySelector(`#${VISUAL_BG_GRADIENT_MS_LABEL_ID_BY_FIELD[field]}`);
    if (el) el.textContent = `${((ms || 0) / 1000).toFixed(1)}s`;
}

// ===================== Picker Video/Ảnh =====================

/** Nút "Chọn" của picker multi-select. @param {HTMLElement} bodyEl - genericDrawerBody @param {number} count
 * @param {string} label */
function setVisualBgPickerConfirmButton(bodyEl, count, label) {
    const btn = bodyEl.querySelector('#btn-file-manager-image-picker-confirm');
    if (!btn) return;
    btn.disabled = count === 0;
    btn.textContent = label;
}

/** Khung picker Video/Ảnh sau khi đọc danh sách: hiện dòng "trống" nếu không có item, trả vùng cuộn để gắn lưới.
 * @param {HTMLElement} bodyEl - genericDrawerBody @param {string} scrollId @param {string} emptyId @param {number} itemCount
 * @returns {HTMLElement|null} */
function fillVisualBgPickerList(bodyEl, scrollId, emptyId, itemCount) {
    const emptyEl = bodyEl.querySelector(`#${emptyId}`);
    if (emptyEl) emptyEl.classList.toggle('hidden', itemCount > 0);
    return bodyEl.querySelector(`#${scrollId}`);
}

// ===================== Màn Âm thanh Video =====================

/** Cập nhật đúng 2 nút (icon loa + "x%") của 1 hàng sau khi đổi. @param {HTMLElement} panelEl @param {string} videoKey
 * @param {string} iconHtml - components/visual-bg-video-audio-drawer.js @param {number} volumePercent @param {string} stateUitk
 * @returns {{iconBtn: HTMLElement|null, display: HTMLElement|null}} phần tử đã đổi (Workflow áp theme lại) */
function setVisualBgVideoAudioRowState(panelEl, videoKey, iconHtml, volumePercent, stateUitk) {
    const key = CSS.escape(videoKey);
    const iconBtn = panelEl.querySelector(`[data-visual-bg-video-audio-toggle="${key}"]`);
    if (iconBtn) iconBtn.innerHTML = iconHtml;
    const display = panelEl.querySelector(`[data-visual-bg-video-audio-volume-display="${key}"]`);
    if (display) {
        display.textContent = `${volumePercent}%`;
        display.dataset.uitk = stateUitk;
    }
    return { iconBtn, display };
}
