/**
 * core/custom-effect.js — Core thuần cho hệ Custom Effect (config riêng từng effect, xem
 * DEFAULT_CUSTOM_EFFECT ở core/config.js). Key = đúng giá trị MODES ('bar'/'black hole'/...).
 *
 * NẠP SAU: core/config.js (DEFAULT_CUSTOM_EFFECT, appConfigViz).
 */

/** Style con của effect (nếu có) — field trong customEffect[type] + danh sách option, dùng để
 * dựng dropdown ĐẦU TIÊN trong Custom Effect Drawer. null nếu effect chỉ có 1 kiểu vẽ. */
const CUSTOM_EFFECT_STYLE = {
    bar: { field: 'barStyle', options: ['mirror', 'cascade'] },
    rain: { field: 'rainStyle', options: ['glass', 'street'] },
    vortex: { field: 'vortexStyle', options: ['rings', 'bars', 'wave'] },
};

/** Key i18n cho từng option style — TÁI DÙNG bộ text sẵn có (visualizerSettingsDrawer.*), không
 * dịch trùng 1 khái niệm ở 2 nơi. */
const CUSTOM_EFFECT_STYLE_LABEL_KEYS = {
    bar: { mirror: 'visualizerSettingsDrawer.barStyle.mirror', cascade: 'visualizerSettingsDrawer.barStyle.cascade' },
    rain: { glass: 'visualizerSettingsDrawer.rainStyle.glass', street: 'visualizerSettingsDrawer.rainStyle.street' },
    vortex: { rings: 'visualizerSettingsDrawer.vortexStyle.rings', bars: 'visualizerSettingsDrawer.vortexStyle.bars', wave: 'visualizerSettingsDrawer.vortexStyle.wave' },
};

/** Field riêng của TỪNG effect, hiện SAU khối chung (style/color/blur) trong Drawer — dựng UI
 * DATA-DRIVEN (1 hàm render chung đọc bảng này, xem components/custom-effect-drawer.js), tránh
 * viết tay 7 khối HTML lặp lại. `showIf(cfg)` optional — field chỉ hiện khi đúng điều kiện (vd
 * riêng theo style con hiện tại). `refresh` optional — hàm core cần gọi lại NGAY để thấy hiệu quả
 * tức thì (field chỉ đọc lúc khởi tạo scene, không đọc mỗi frame). */
const CUSTOM_EFFECT_FIELDS = {
    bar: [
        { id: 'maxH', labelKey: 'visualizerSettingsDrawer.maxHeight.label', type: 'slider', min: 50, max: 1000, step: 10 },
        { id: 'mirrorBarCount', labelKey: 'visualizerSettingsDrawer.mirrorCount.label', type: 'slider', min: 10, max: 32, step: 1, showIf: (cfg) => cfg.barStyle === 'mirror' },
    ],
    'black hole': [
        { id: 'maxH', labelKey: 'visualizerSettingsDrawer.maxHeight.label', type: 'slider', min: 50, max: 1000, step: 10 },
        { id: 'barWidth', labelKey: 'visualizerSettingsDrawer.barWidth.label', type: 'slider', min: 1, max: 15, step: 1 },
        { id: 'starCount', labelKey: 'customEffectDrawer.field.starCount', type: 'slider', min: 40, max: 400, step: 10, refresh: 'resizeCanvas' },
    ],
    lightning: [],
    rain: [
        { id: 'glassFlash', labelKey: 'visualizerSettingsDrawer.glassFlash.label', type: 'toggle', showIf: (cfg) => cfg.rainStyle === 'glass' },
        { id: 'glassCityOpacity', labelKey: 'visualizerSettingsDrawer.rainCityOpacity.label', type: 'slider', min: 0, max: 100, step: 5, showIf: (cfg) => cfg.rainStyle === 'glass' },
        { id: 'glassCityVisible', labelKey: 'visualizerSettingsDrawer.rainCityVisible.label', type: 'toggle', showIf: (cfg) => cfg.rainStyle === 'glass' },
        { id: 'glassMoonVisible', labelKey: 'visualizerSettingsDrawer.rainMoonVisible.label', type: 'toggle', showIf: (cfg) => cfg.rainStyle === 'glass' },
        { id: 'glassDropDensity', labelKey: 'customEffectDrawer.field.glassDropDensity', type: 'slider', min: 40, max: 400, step: 10, showIf: (cfg) => cfg.rainStyle === 'glass', refresh: 'resizeCanvas' },
        { id: 'glassStreakFrequency', labelKey: 'customEffectDrawer.field.glassStreakFrequency', type: 'slider', min: 0, max: 100, step: 5, showIf: (cfg) => cfg.rainStyle === 'glass' },
        { id: 'streetDensity', labelKey: 'customEffectDrawer.field.streetDensity', type: 'slider', min: 40, max: 400, step: 10, showIf: (cfg) => cfg.rainStyle === 'street', refresh: 'resizeCanvas' },
        { id: 'streetBuildingScale', labelKey: 'customEffectDrawer.field.streetBuildingScale', type: 'sliderFloat', min: 0.5, max: 3.0, step: 0.1, showIf: (cfg) => cfg.rainStyle === 'street', refresh: 'resizeCanvas' },
    ],
    rubik: [],
    vortex: [
        { id: 'tunnelRingCount', labelKey: 'customEffectDrawer.field.tunnelRingCount', type: 'slider', min: 10, max: 100, step: 5, refresh: 'initThreeJS' },
    ],
    space: [
        { id: 'starCountMin', labelKey: 'customEffectDrawer.field.starCountMin', type: 'slider', min: 500, max: 6000, step: 100 },
        { id: 'starCountMax', labelKey: 'customEffectDrawer.field.starCountMax', type: 'slider', min: 1000, max: 10000, step: 100 },
        { id: 'nebulaCount', labelKey: 'customEffectDrawer.field.nebulaCount', type: 'slider', min: 0, max: 60, step: 1 },
        { id: 'dustCount', labelKey: 'customEffectDrawer.field.dustCount', type: 'slider', min: 100, max: 3000, step: 100 },
        { id: 'mapNodeCount', labelKey: 'customEffectDrawer.field.mapNodeCount', type: 'slider', min: 10, max: 120, step: 2 },
        { id: 'mapRadius', labelKey: 'customEffectDrawer.field.mapRadius', type: 'slider', min: 300, max: 1500, step: 50 },
    ],
};

/** Config đầy đủ (default merge field thiếu) của 1 effect theo type. */
function getEffectConfig(type) {
    const cfg = appConfigViz.getAll();
    return { ...DEFAULT_CUSTOM_EFFECT[type], ...(cfg.customEffect && cfg.customEffect[type]) };
}

/** Config effect ĐANG CHẠY (cfg.type) — dùng bởi getComputedColor()/getActiveBlurMult()
 * (core/audio-analysis.js) và mọi hàm vẽ (core/visualizer/types/*.js). */
function getActiveEffectConfig() {
    return getEffectConfig(appConfigViz.getAll().type);
}

/** Ghi 1 field vào customEffect[type] — DUY NHẤT nơi mutate (Rule 2), Workflow tự gọi saveConfig()
 * sau. Rule 1: luôn tạo bucket effect nếu thiếu rồi ghi field, đúng 1 tiến trình. */
function setCustomEffectField(type, field, value) {
    appConfigViz.mutateAll(cfg => {
        if (!cfg.customEffect[type]) cfg.customEffect[type] = { ...DEFAULT_CUSTOM_EFFECT[type] };
        cfg.customEffect[type][field] = value;
    });
}

/** Cường độ blur/glow quy đổi 0-1 cho 1 effect bất kỳ (không nhất thiết đang active) — dùng bởi
 * core/canvas-scene-setup.js lúc khởi tạo scene, KHÔNG qua audio-analysis.js (tránh phụ thuộc
 * chéo lúc file đó chưa nạp). */
function getEffectBlurMult(type) {
    const ec = getEffectConfig(type);
    return ec.blurEnabled ? ec.blurIntensity / 100 : 0;
}
