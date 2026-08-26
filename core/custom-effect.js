/**
 * core/custom-effect.js — Core thuần cho hệ Custom Effect (config riêng từng effect, xem
 * DEFAULT_CUSTOM_EFFECT ở core/config.js). Key = đúng giá trị MODES ('bar'/'black hole'/...).
 *
 * NẠP SAU: core/config.js (DEFAULT_CUSTOM_EFFECT, appConfigViz).
 */

// Đèn tuỳ chỉnh (Rain, style street) — customEffect.rain.customLamps, xem components/
// custom-effect-drawer.js::_renderCeLampsSection() + event/workflow/custom-effect.js.
const CUSTOM_EFFECT_MAX_LAMPS = 8;
const CUSTOM_EFFECT_DEFAULT_LAMP = { xPercent: 50, heightPx: 150, flareScale: 1 };

// Effect KHÔNG dùng blur/glow tuỳ chỉnh (Drawer ẩn khối blur) — glow của các effect này (nếu có)
// là phối cảnh cố định, không đọc blurEnabled/blurIntensity: Vortex không shadowBlur/bloom nào cả;
// Rain (quầng Trăng) và Rubik (viền khối sáng) glow LUÔN bật, giá trị cố định trong code.
// SỬA (27/08/2026, phản hồi Giang — "on off blur và chỉnh blur như effect khác đang dùng") — BỎ
// 'space' khỏi danh sách này: Space (WebGL, không phải canvas 2D) giờ CÓ blurEnabled/blurIntensity
// riêng (core/config.js), áp bằng CSS filter blur() lên #webgl-canvas thay vì ctx.shadowBlur — xem
// applyWebglCanvasBlur() (core/visualizer/visualizer-display.js) + event/workflow/visualizer-render.js.
const CUSTOM_EFFECT_NO_BLUR = ['vortex', 'rain', 'rubik'];

// Nhãn i18n cho 10 hình thái thiên hà (Space, mục enabledGalaxyTypes bên dưới) — key TRÙNG Y HỆT
// chuỗi trong SPACE_GALAXY_TYPES (core/webgl/three-space.js), KHÔNG tham chiếu biến đó trực tiếp
// được (file này nạp TRƯỚC three-space.js trong index.html — tham chiếu sớm sẽ ReferenceError),
// nên chỉ có thể trùng lặp y hệt chuỗi ở đây — SỬA 1 trong 2 nơi thì PHẢI sửa nơi còn lại.
const SPACE_GALAXY_TYPE_LABEL_KEYS = {
    'Spiral': 'customEffectDrawer.galaxyType.spiral',
    'Barred Spiral': 'customEffectDrawer.galaxyType.barredSpiral',
    'Elliptical': 'customEffectDrawer.galaxyType.elliptical',
    'Ring': 'customEffectDrawer.galaxyType.ring',
    'Irregular': 'customEffectDrawer.galaxyType.irregular',
    'Lenticular': 'customEffectDrawer.galaxyType.lenticular',
    'Flocculent Spiral': 'customEffectDrawer.galaxyType.flocculentSpiral',
    'Sombrero': 'customEffectDrawer.galaxyType.sombrero',
    'Cartwheel': 'customEffectDrawer.galaxyType.cartwheel',
    'Peculiar': 'customEffectDrawer.galaxyType.peculiar',
};

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
 * tức thì (field chỉ đọc lúc khởi tạo scene, không đọc mỗi frame).
 * `type`: 'slider' (số nguyên) | 'sliderFloat' (số thực, có `decimals`) | 'toggle' (bật/tắt 1
 * field boolean) | 'multiToggle' (MỚI 27/08/2026 — bật/tắt TỪNG phần tử trong 1 mảng string,
 * field lưu MẢNG các giá trị đang bật; cần thêm `options` — mảng HOẶC hàm trả về mảng, dùng hàm
 * khi danh sách gốc định nghĩa ở file nạp SAU — và `optionLabelKeys` optional, map value->i18n key). */
const CUSTOM_EFFECT_FIELDS = {
    bar: [
        { id: 'maxH', labelKey: 'visualizerSettingsDrawer.maxHeight.label', type: 'slider', min: 50, max: 1000, step: 10 },
        { id: 'mirrorBarCount', labelKey: 'visualizerSettingsDrawer.mirrorCount.label', type: 'slider', min: 10, max: 32, step: 1, showIf: (cfg) => cfg.barStyle === 'mirror' },
        { id: 'barFillRatio', labelKey: 'customEffectDrawer.field.barFillRatio', type: 'sliderFloat', min: 0.3, max: 0.9, step: 0.05, decimals: 2, showIf: (cfg) => cfg.barStyle === 'mirror' },
        { id: 'barCornerRadius', labelKey: 'customEffectDrawer.field.barCornerRadius', type: 'slider', min: 0, max: 15, step: 1, showIf: (cfg) => cfg.barStyle === 'mirror' },
        { id: 'centerBarBeatRatio', labelKey: 'customEffectDrawer.field.centerBarBeatRatio', type: 'sliderFloat', min: 0, max: 1, step: 0.05, decimals: 2, showIf: (cfg) => cfg.barStyle === 'mirror' },
        { id: 'cascadeBaseAlpha', labelKey: 'customEffectDrawer.field.cascadeBaseAlpha', type: 'sliderFloat', min: 0, max: 1, step: 0.05, decimals: 2, showIf: (cfg) => cfg.barStyle === 'cascade' },
        { id: 'cascadeKeyCount', labelKey: 'customEffectDrawer.field.cascadeKeyCount', type: 'slider', min: 16, max: 128, step: 4, showIf: (cfg) => cfg.barStyle === 'cascade' },
    ],
    'black hole': [
        { id: 'maxH', labelKey: 'visualizerSettingsDrawer.maxHeight.label', type: 'slider', min: 50, max: 1000, step: 10 },
        { id: 'barWidth', labelKey: 'visualizerSettingsDrawer.barWidth.label', type: 'slider', min: 1, max: 15, step: 1 },
        { id: 'starCount', labelKey: 'customEffectDrawer.field.starCount', type: 'slider', min: 40, max: 400, step: 10, refresh: 'resizeCanvas' },
        { id: 'radiusRatio', labelKey: 'customEffectDrawer.field.radiusRatio', type: 'sliderFloat', min: 0.05, max: 0.3, step: 0.01, decimals: 2 },
        { id: 'radiusEnergyMult', labelKey: 'customEffectDrawer.field.radiusEnergyMult', type: 'sliderFloat', min: 0, max: 0.2, step: 0.01, decimals: 2 },
        { id: 'suctionBase', labelKey: 'customEffectDrawer.field.suctionBase', type: 'sliderFloat', min: 0, max: 1, step: 0.05, decimals: 2 },
        { id: 'suctionEnergyMult', labelKey: 'customEffectDrawer.field.suctionEnergyMult', type: 'sliderFloat', min: 0, max: 5, step: 0.1, decimals: 1 },
        { id: 'flareThreshold', labelKey: 'customEffectDrawer.field.flareThreshold', type: 'sliderFloat', min: 0, max: 1, step: 0.05, decimals: 2 },
        { id: 'flashFadeSpeed', labelKey: 'customEffectDrawer.field.flashFadeSpeed', type: 'sliderFloat', min: 0.02, max: 0.2, step: 0.01, decimals: 2 },
    ],
    lightning: [
        { id: 'flashThreshold', labelKey: 'customEffectDrawer.field.flashThreshold', type: 'sliderFloat', min: 0, max: 1, step: 0.05, decimals: 2 },
        { id: 'boltThreshold', labelKey: 'customEffectDrawer.field.boltThreshold', type: 'sliderFloat', min: 0, max: 1, step: 0.05, decimals: 2 },
        { id: 'boltSpawnChance', labelKey: 'customEffectDrawer.field.boltSpawnChance', type: 'sliderFloat', min: 0, max: 1, step: 0.05, decimals: 2 },
        { id: 'maxBoltCount', labelKey: 'customEffectDrawer.field.maxBoltCount', type: 'slider', min: 1, max: 10, step: 1 },
        { id: 'boltFadeSpeed', labelKey: 'customEffectDrawer.field.boltFadeSpeed', type: 'sliderFloat', min: 0.01, max: 0.15, step: 0.01, decimals: 2 },
        { id: 'boltHorizontalDeviation', labelKey: 'customEffectDrawer.field.boltHorizontalDeviation', type: 'slider', min: 20, max: 300, step: 10 },
        { id: 'boltSegmentLength', labelKey: 'customEffectDrawer.field.boltSegmentLength', type: 'slider', min: 10, max: 150, step: 10 },
    ],
    rain: [
        { id: 'glassFlash', labelKey: 'visualizerSettingsDrawer.glassFlash.label', type: 'toggle', showIf: (cfg) => cfg.rainStyle === 'glass' },
        { id: 'glassCityOpacity', labelKey: 'visualizerSettingsDrawer.rainCityOpacity.label', type: 'slider', min: 0, max: 100, step: 5, showIf: (cfg) => cfg.rainStyle === 'glass' },
        { id: 'glassCityVisible', labelKey: 'visualizerSettingsDrawer.rainCityVisible.label', type: 'toggle', showIf: (cfg) => cfg.rainStyle === 'glass' },
        { id: 'glassMoonVisible', labelKey: 'visualizerSettingsDrawer.rainMoonVisible.label', type: 'toggle', showIf: (cfg) => cfg.rainStyle === 'glass' },
        { id: 'glassDropDensity', labelKey: 'customEffectDrawer.field.glassDropDensity', type: 'slider', min: 40, max: 400, step: 10, showIf: (cfg) => cfg.rainStyle === 'glass', refresh: 'resizeCanvas' },
        { id: 'glassStreakFrequency', labelKey: 'customEffectDrawer.field.glassStreakFrequency', type: 'slider', min: 0, max: 100, step: 5, showIf: (cfg) => cfg.rainStyle === 'glass' },
        { id: 'streetDensity', labelKey: 'customEffectDrawer.field.streetDensity', type: 'slider', min: 40, max: 400, step: 10, showIf: (cfg) => cfg.rainStyle === 'street', refresh: 'resizeCanvas' },
        { id: 'streetBuildingScale', labelKey: 'customEffectDrawer.field.streetBuildingScale', type: 'sliderFloat', min: 0.5, max: 3.0, step: 0.1, decimals: 1, showIf: (cfg) => cfg.rainStyle === 'street', refresh: 'resizeCanvas' },
    ],
    rubik: [
        { id: 'cubeSizeRatio', labelKey: 'customEffectDrawer.field.cubeSizeRatio', type: 'sliderFloat', min: 0.03, max: 0.15, step: 0.01, decimals: 2 },
        { id: 'pitchSensitivity', labelKey: 'customEffectDrawer.field.pitchSensitivity', type: 'sliderFloat', min: 0, max: 2, step: 0.1, decimals: 1 },
        { id: 'rotationEnergyThreshold', labelKey: 'customEffectDrawer.field.rotationEnergyThreshold', type: 'sliderFloat', min: 0, max: 1, step: 0.05, decimals: 2 },
        { id: 'layerTurnSpeed', labelKey: 'customEffectDrawer.field.layerTurnSpeed', type: 'sliderFloat', min: 0.02, max: 0.3, step: 0.01, decimals: 2 },
    ],
    vortex: [
        { id: 'tunnelRingCount', labelKey: 'customEffectDrawer.field.tunnelRingCount', type: 'slider', min: 10, max: 100, step: 5, refresh: 'initThreeJS' },
        { id: 'warpSpeedBase', labelKey: 'customEffectDrawer.field.warpSpeedBase', type: 'slider', min: 0, max: 50, step: 1 },
        { id: 'warpSpeedEnergyMult', labelKey: 'customEffectDrawer.field.warpSpeedEnergyMult', type: 'slider', min: 0, max: 100, step: 5 },
        { id: 'curveChangeChance', labelKey: 'customEffectDrawer.field.curveChangeChance', type: 'sliderFloat', min: 0, max: 0.1, step: 0.005, decimals: 3 },
        { id: 'barsRingCount', labelKey: 'customEffectDrawer.field.barsRingCount', type: 'slider', min: 10, max: 80, step: 2, showIf: (cfg) => cfg.vortexStyle === 'bars', refresh: 'initThreeJS' },
        { id: 'barsPerRing', labelKey: 'customEffectDrawer.field.barsPerRing', type: 'slider', min: 6, max: 48, step: 2, showIf: (cfg) => cfg.vortexStyle === 'bars', refresh: 'initThreeJS' },
        { id: 'barsTwistFactor', labelKey: 'customEffectDrawer.field.barsTwistFactor', type: 'sliderFloat', min: 0, max: 6, step: 0.2, decimals: 1, showIf: (cfg) => cfg.vortexStyle === 'bars' },
        { id: 'waveRotationBase', labelKey: 'customEffectDrawer.field.waveRotationBase', type: 'sliderFloat', min: 0, max: 0.1, step: 0.005, decimals: 3, showIf: (cfg) => cfg.vortexStyle === 'wave' },
        { id: 'waveRotationEnergyMult', labelKey: 'customEffectDrawer.field.waveRotationEnergyMult', type: 'sliderFloat', min: 0, max: 0.3, step: 0.01, decimals: 2, showIf: (cfg) => cfg.vortexStyle === 'wave' },
        { id: 'waveScaleBase', labelKey: 'customEffectDrawer.field.waveScaleBase', type: 'sliderFloat', min: 0.3, max: 1.5, step: 0.05, decimals: 2, showIf: (cfg) => cfg.vortexStyle === 'wave' },
        { id: 'waveScaleEnergyMult', labelKey: 'customEffectDrawer.field.waveScaleEnergyMult', type: 'sliderFloat', min: 0, max: 1, step: 0.05, decimals: 2, showIf: (cfg) => cfg.vortexStyle === 'wave' },
    ],
    space: [
        { id: 'starCountMin', labelKey: 'customEffectDrawer.field.starCountMin', type: 'slider', min: 500, max: 6000, step: 100 },
        { id: 'starCountMax', labelKey: 'customEffectDrawer.field.starCountMax', type: 'slider', min: 1000, max: 10000, step: 100 },
        { id: 'nebulaCount', labelKey: 'customEffectDrawer.field.nebulaCount', type: 'slider', min: 0, max: 60, step: 1 },
        { id: 'dustCount', labelKey: 'customEffectDrawer.field.dustCount', type: 'slider', min: 100, max: 3000, step: 100 },
        // THAY (26/08/2026, mô hình cụm thiên hà — xem event/workflow/visualizer-render.js) —
        // mapNodeCount/mapRadius (bản đồ TĨNH cũ) ĐÃ BỎ, thay bằng 5 field cho mô hình cụm/thiên
        // hà MỚI: số thiên hà mỗi cụm, bán kính rải quanh tâm cụm, khoảng cách đặt 5 cụm quanh
        // camera lúc tái tạo.
        { id: 'clusterGalaxyCountMin', labelKey: 'customEffectDrawer.field.clusterGalaxyCountMin', type: 'slider', min: 2, max: 10, step: 1 },
        { id: 'clusterGalaxyCountMax', labelKey: 'customEffectDrawer.field.clusterGalaxyCountMax', type: 'slider', min: 4, max: 16, step: 1 },
        { id: 'clusterSpreadRadius', labelKey: 'customEffectDrawer.field.clusterSpreadRadius', type: 'slider', min: 40, max: 250, step: 10 },
        { id: 'clusterDistanceMin', labelKey: 'customEffectDrawer.field.clusterDistanceMin', type: 'slider', min: 100, max: 800, step: 20 },
        { id: 'clusterDistanceMax', labelKey: 'customEffectDrawer.field.clusterDistanceMax', type: 'slider', min: 300, max: 1500, step: 20 },
        // THÊM (27/08/2026, phản hồi Giang mục 1) — (a) khoảng cách GIỮA các cụm với NHAU (khác
        // clusterDistanceMin/Max ở trên — đó là khoảng cách từ camera lúc SINH cụm; đây là khoảng
        // cách ép buộc giữa TỪNG CẶP cụm, xem _pickClusterPositionWithSeparation(),
        // event/workflow/visualizer-render.js).
        { id: 'clusterSeparationMin', labelKey: 'customEffectDrawer.field.clusterSeparationMin', type: 'slider', min: 50, max: 500, step: 10 },
        { id: 'clusterSeparationMax', labelKey: 'customEffectDrawer.field.clusterSeparationMax', type: 'slider', min: 200, max: 1200, step: 20 },
        // (b) can thiệp điều kiện rời cụm — nhân thêm vào ngưỡng phát hiện chuyển pha nhạc VÀ số
        // beat chờ tối đa (SPACE_FLUX_TRANSITION_THRESHOLD/SPACE_PHRASE_REFRESH_BEATS,
        // event/workflow/visualizer-render.js) — CÀNG CAO càng khó kích hoạt chuyển cụm => càng
        // "stuck" lâu trong 1 cụm.
        { id: 'clusterStickiness', labelKey: 'customEffectDrawer.field.clusterStickiness', type: 'sliderFloat', min: 0.3, max: 3, step: 0.1, decimals: 1 },
        // (c) hệ số nhân tốc độ di chuyển (thay SPACE_SPEED_MULTIPLIER hằng số cũ) — kéo về min
        // cho cảm giác trôi CHẬM NHẤT có thể.
        { id: 'travelSpeedMultiplier', labelKey: 'customEffectDrawer.field.travelSpeedMultiplier', type: 'sliderFloat', min: 0.05, max: 4, step: 0.05, decimals: 2 },
        // (d) bật/tắt TỪNG hình thái thiên hà được phép xuất hiện trong túi xáo trộn
        // (pickGalaxyTypeFromBag(), core/webgl/three-space.js) — `options` là HÀM (không phải
        // mảng thẳng) vì SPACE_GALAXY_TYPES định nghĩa ở three-space.js, nạp SAU file này — gọi
        // hàm này lúc DỰNG UI (Drawer chỉ mở sau khi mọi script đã nạp xong) thay vì lúc file này
        // tự thực thi tránh ReferenceError.
        { id: 'enabledGalaxyTypes', labelKey: 'customEffectDrawer.field.enabledGalaxyTypes', type: 'multiToggle', options: () => SPACE_GALAXY_TYPES, optionLabelKeys: SPACE_GALAXY_TYPE_LABEL_KEYS },
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
