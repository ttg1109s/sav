/**
 * core/custom-effect.js — Core thuần cho hệ Custom Effect (config riêng từng effect, xem
 * DEFAULT_CUSTOM_EFFECT ở core/config.js). Key = đúng giá trị GROUP (khớp Object.keys(EFFECT_GROUPS),
 * service/state/visualizer-runtime.js — bar/lighting/rain/vortex/shape).
 *
 * [SỬA — 05/09/2026, yêu cầu Giang, "group hoá" effect picker] Trước đây key = giá trị MODES phẳng
 * ('bar'/'black hole'/'lighting'/...), CUSTOM_EFFECT_STYLE dùng để dựng dropdown "chọn style con"
 * NGAY TRONG Custom Effect Drawer (components/custom-effect-drawer.js). Dropdown đó ĐÃ BỎ HẲN
 * (Giang: "bỏ phần chọn style trong toàn bộ các custom effect") — style con giờ CHỈ chọn qua modal
 * 2-dropdown (group -> style) mở bằng GIỮ #btn-cycle-mode, xem
 * core/visualizer/visualizer-display.js::openEffectPickerModal(). CUSTOM_EFFECT_STYLE/
 * CUSTOM_EFFECT_STYLE_LABEL_KEYS bên dưới GIỮ LẠI (không xoá) — vẫn là nguồn dữ liệu cho modal đó
 * đọc field/options/label, chỉ KHÔNG còn dựng dropdown Ở TRONG DRAWER nữa.
 *
 * NẠP SAU: core/config.js (DEFAULT_CUSTOM_EFFECT, appConfigViz), service/state/
 * visualizer-runtime.js (EFFECT_GROUPS/GROUP_STYLE_FIELD/STYLE_TO_GROUP).
 */

// Đèn tuỳ chỉnh (Rain, style street) — customEffect.rain.customLamps, xem components/
// custom-effect-drawer.js::_renderCeLampsSection() + event/workflow/custom-effect.js.
const CUSTOM_EFFECT_MAX_LAMPS = 8;
const CUSTOM_EFFECT_DEFAULT_LAMP = { xPercent: 50, heightPx: 150, flareScale: 1 };

// Chữ bắn pháo hoa (Fireworks) — customEffect.fireworks.customTexts, xem components/
// custom-effect-drawer.js::_renderCeFireworksTextsSection() + event/workflow/custom-effect.js.
const CUSTOM_EFFECT_MAX_TEXTS = 10;

// Trần CỨNG opacity của lớp chớp sáng toàn màn hình — [MỚI 19/09/2026, yêu cầu Giang] áp dụng cho MỌI
// effect có chớp (Thunder/Fireworks/Rain), kẹp ở đúng 1 nơi: drawScreenFlash() (core/visualizer/draw/
// screen-flash.js). Cũng là `max` của slider field `flashMaxOpacity` (CUSTOM_EFFECT_FIELDS bên dưới).
const SCREEN_FLASH_MAX_ALPHA = 0.8;

/** Bộ field CHỚP SÁNG toàn màn hình — DÙNG CHUNG (spread) cho group 'lighting' (Thunder + Fireworks) và
 * 'rain' (Glass + Street) trong CUSTOM_EFFECT_FIELDS bên dưới -> 4 effect luôn CÙNG 3 field, CÙNG nhãn,
 * CÙNG thứ tự, CÙNG khoảng giá trị (chỉ khác default, xem DEFAULT_CUSTOM_EFFECT, core/config.js). Không
 * gắn showIf — toggle trong Drawer không dựng lại UI nên không dùng nó ẩn/hiện field khác. Công thức:
 * computeScreenFlashAlpha() (core/visualizer/draw/screen-flash-alpha.js). [MỚI 19/09/2026] */
const CUSTOM_EFFECT_FLASH_FIELDS = [
    { id: 'flashEnabled', labelKey: 'customEffectDrawer.field.flashEnabled', type: 'toggle' },
    { id: 'flashThreshold', labelKey: 'customEffectDrawer.field.flashThreshold', type: 'sliderFloat', min: 0, max: 1, step: 0.05, decimals: 2 },
    { id: 'flashMaxOpacity', labelKey: 'customEffectDrawer.field.flashMaxOpacity', type: 'sliderFloat', min: 0, max: SCREEN_FLASH_MAX_ALPHA, step: 0.05, decimals: 2 },
];

// Effect KHÔNG dùng blur/glow tuỳ chỉnh (Drawer ẩn khối blur) — glow của các effect này (nếu có)
// là phối cảnh cố định, không đọc blurEnabled/blurIntensity: Vortex không shadowBlur/bloom nào
// cả; Rain (quầng Trăng) và Shape/Rubik (viền khối sáng) glow LUÔN bật, giá trị cố định trong
// code. Fireworks CÓ dùng (shadowBlur quanh mỗi hạt tại vùng nổ, xem drawFireworksParticle()) —
// KHÔNG nằm trong danh sách này. Bar (group, gồm cả style "black hole") CÓ dùng blur — không nằm
// trong danh sách.
// [XOÁ — 15/09/2026, yêu cầu Giang, "dọn sạch visualizer effect space"] Group "space" (Galaxy
// Journey) đã BỎ HẲN — engine core/webgl/three-space.js, core/visualizer/groups/space/,
// service/state/three-space.js đã xoá; mọi entry "space" trong các bảng dưới đây trong file này
// cũng đã bỏ theo (14 field riêng của space trong CUSTOM_EFFECT_FIELDS).
// 'connector' glow là sprite Three.js riêng (glowEnabled/glowIntensity, CUSTOM_EFFECT_FIELDS bên
// dưới), không phải shadowBlur canvas 2D — không dùng khối blur chung nên cũng nằm trong danh
// sách này (getConnectorGlowMult() là hàm đọc RIÊNG, xem cuối file).
const CUSTOM_EFFECT_NO_BLUR = ['vortex', 'rain', 'shape', 'connector'];

/** Style con của effect (nếu có) — field trong customEffect[group] + danh sách option. TRƯỚC ĐÂY
 * dùng để dựng dropdown ĐẦU TIÊN trong Custom Effect Drawer — dropdown đó ĐÃ BỎ (xem docstring đầu
 * file); giờ là nguồn dữ liệu CHO modal chọn effect 2-dropdown (core/visualizer/
 * visualizer-display.js::openEffectPickerModal()). MỌI group đều có entry, kể cả group chỉ 1
 * style (shape) — nhất quán, không cần rẽ nhánh riêng. */
const CUSTOM_EFFECT_STYLE = {
    bar: { field: 'barStyle', options: ['mirror', 'cascade', 'black hole', 'dot'] },
    rain: { field: 'rainStyle', options: ['glass', 'street'] },
    vortex: { field: 'vortexStyle', options: ['rings', 'bars', 'wave'] },
    lighting: { field: 'lightingStyle', options: ['thunder', 'fireworks'] },
    shape: { field: 'shapeStyle', options: ['rubik'] },
    connector: { field: 'connectorStyle', options: ['synapse', 'circuit', 'brain'] },
};

/** Tiêu đề card "Music Transition" (components/custom-effect-drawer.js::_renderCeMusicSection())
 * THEO TỪNG GROUP — MỚI (15/09/2026, yêu cầu Giang, "curv đang phản ánh sai chức năng") — group
 * nào không có mặt ở đây rơi về tên chung "Music Transition" (customEffectDrawer.musicSection.title).
 * Fireworks gọi "Finale" (toggle finaleEnabled quyết định có tự bắn "Đại Tiệc Pháo Hoa" theo nhạc
 * hay không); Vortex gọi "Redirect" (toggle redirectEnabled quyết định có tự rẽ hướng ống theo
 * nhạc hay không). */
const CUSTOM_EFFECT_MUSIC_SECTION_TITLE_KEYS = {
    lighting: 'customEffectDrawer.musicSection.finaleTitle',
    vortex: 'customEffectDrawer.musicSection.redirectTitle',
};
/** MỚI (23/09/2026) — tiêu đề card Music Transition theo STYLE con (ưu tiên hơn bảng theo group ở
 * trên) — group connector có 2 style dùng Music Transition cho 2 việc khác nhau (circuit = camera
 * shift, brain = burst), không đặt chung 1 tên theo group được. */
const CUSTOM_EFFECT_MUSIC_SECTION_TITLE_KEYS_BY_STYLE = {
    brain: 'customEffectDrawer.musicSection.burstTitle',
};

/** Key i18n cho từng option style — TÁI DÙNG bộ text sẵn có (visualizerSettingsDrawer.*), không
 * dịch trùng 1 khái niệm ở 2 nơi. */
const CUSTOM_EFFECT_STYLE_LABEL_KEYS = {
    bar: {
        mirror: 'visualizerSettingsDrawer.barStyle.mirror', cascade: 'visualizerSettingsDrawer.barStyle.cascade',
        'black hole': 'visualizerSettingsDrawer.barStyle.blackHole', dot: 'visualizerSettingsDrawer.barStyle.dot',
    },
    rain: { glass: 'visualizerSettingsDrawer.rainStyle.glass', street: 'visualizerSettingsDrawer.rainStyle.street' },
    vortex: { rings: 'visualizerSettingsDrawer.vortexStyle.rings', bars: 'visualizerSettingsDrawer.vortexStyle.bars', wave: 'visualizerSettingsDrawer.vortexStyle.wave' },
    lighting: { thunder: 'visualizerSettingsDrawer.lightingStyle.thunder', fireworks: 'visualizerSettingsDrawer.lightingStyle.fireworks' },
    shape: { rubik: 'visualizerSettingsDrawer.shapeStyle.rubik' },
    connector: { synapse: 'visualizerSettingsDrawer.connectorStyle.synapse', circuit: 'visualizerSettingsDrawer.connectorStyle.circuit', brain: 'visualizerSettingsDrawer.connectorStyle.brain' },
};

/** Field riêng của TỪNG effect, hiện SAU khối chung (style/color/blur) trong Drawer — dựng UI
 * DATA-DRIVEN (1 hàm render chung đọc bảng này, xem components/custom-effect-drawer.js), tránh
 * viết tay 7 khối HTML lặp lại. `showIf(cfg)` optional — field chỉ hiện khi đúng điều kiện (vd
 * riêng theo style con hiện tại). `refresh` optional — hàm core cần gọi lại NGAY để thấy hiệu quả
 * tức thì (field chỉ đọc lúc khởi tạo scene, không đọc mỗi frame). */
const CUSTOM_EFFECT_FIELDS = {
    bar: [
        // SỬA (25/09/2026) — style 'dot' chỉ dùng maxH khi kiểu tác động = 'height'.
        { id: 'maxH', labelKey: 'visualizerSettingsDrawer.maxHeight.label', type: 'slider', min: 50, max: 1000, step: 10, showIf: (cfg) => cfg.barStyle !== 'dot' || cfg.dotImpactMode === 'height' },
        { id: 'mirrorBarCount', labelKey: 'visualizerSettingsDrawer.mirrorCount.label', type: 'slider', min: 10, max: 32, step: 1, showIf: (cfg) => cfg.barStyle === 'mirror' },
        { id: 'barFillRatio', labelKey: 'customEffectDrawer.field.barFillRatio', type: 'sliderFloat', min: 0.3, max: 0.9, step: 0.05, decimals: 2, showIf: (cfg) => cfg.barStyle === 'mirror' },
        { id: 'barCornerRadius', labelKey: 'customEffectDrawer.field.barCornerRadius', type: 'slider', min: 0, max: 15, step: 1, showIf: (cfg) => cfg.barStyle === 'mirror' },
        { id: 'cascadeBaseAlpha', labelKey: 'customEffectDrawer.field.cascadeBaseAlpha', type: 'sliderFloat', min: 0, max: 1, step: 0.05, decimals: 2, showIf: (cfg) => cfg.barStyle === 'cascade' },
        { id: 'cascadeKeyCount', labelKey: 'customEffectDrawer.field.cascadeKeyCount', type: 'slider', min: 16, max: 128, step: 4, showIf: (cfg) => cfg.barStyle === 'cascade' },
        // Style "black hole" (CHUYỂN NHÓM 05/09/2026 — trước đây bucket 'black hole' riêng, dùng
        // CHUNG field 'maxH' ở trên, không khai riêng).
        { id: 'barWidth', labelKey: 'visualizerSettingsDrawer.barWidth.label', type: 'slider', min: 1, max: 15, step: 1, showIf: (cfg) => cfg.barStyle === 'black hole' },
        { id: 'starCount', labelKey: 'customEffectDrawer.field.starCount', type: 'slider', min: 40, max: 400, step: 10, showIf: (cfg) => cfg.barStyle === 'black hole', refresh: 'resizeCanvas' },
        { id: 'radiusRatio', labelKey: 'customEffectDrawer.field.radiusRatio', type: 'sliderFloat', min: 0.05, max: 0.3, step: 0.01, decimals: 2, showIf: (cfg) => cfg.barStyle === 'black hole' },
        { id: 'radiusEnergyMult', labelKey: 'customEffectDrawer.field.radiusEnergyMult', type: 'sliderFloat', min: 0, max: 0.2, step: 0.01, decimals: 2, showIf: (cfg) => cfg.barStyle === 'black hole' },
        { id: 'suctionBase', labelKey: 'customEffectDrawer.field.suctionBase', type: 'sliderFloat', min: 0, max: 1, step: 0.05, decimals: 2, showIf: (cfg) => cfg.barStyle === 'black hole' },
        { id: 'suctionEnergyMult', labelKey: 'customEffectDrawer.field.suctionEnergyMult', type: 'sliderFloat', min: 0, max: 5, step: 0.1, decimals: 1, showIf: (cfg) => cfg.barStyle === 'black hole' },
        { id: 'flareThreshold', labelKey: 'customEffectDrawer.field.flareThreshold', type: 'sliderFloat', min: 0, max: 1, step: 0.05, decimals: 2, showIf: (cfg) => cfg.barStyle === 'black hole' },
        { id: 'flashFadeSpeed', labelKey: 'customEffectDrawer.field.flashFadeSpeed', type: 'sliderFloat', min: 0.02, max: 0.2, step: 0.01, decimals: 2, showIf: (cfg) => cfg.barStyle === 'black hole' },
        // MỚI (25/09/2026, Giang) — style 'dot' (trục thời gian chuyển từ connector brain, core/visualizer/
        // groups/bar/dot.js). Quãng đường sóng KHÔNG còn field (theo audio, trục chỉ là mốc tối đa).
        // dotShape/dotImpactMode `rerender` — field khác có showIf phụ thuộc (dotLineVibrate / maxH).
        // (25/09/2026, lượt 2) dotMoving bật -> hình trục + rung đàn hồi không dùng (ẩn).
        { id: 'dotMoving', labelKey: 'customEffectDrawer.field.dotMoving', type: 'toggle', showIf: (cfg) => cfg.barStyle === 'dot', rerender: true },
        { id: 'dotShape', labelKey: 'customEffectDrawer.field.dotShape', type: 'select', showIf: (cfg) => cfg.barStyle === 'dot' && !cfg.dotMoving, rerender: true, options: [
            { value: 'line', labelKey: 'customEffectDrawer.timelineShape.line' },
            { value: 'sinDown', labelKey: 'customEffectDrawer.timelineShape.sinDown' },
            { value: 'sinUp', labelKey: 'customEffectDrawer.timelineShape.sinUp' },
            { value: 'sinWave', labelKey: 'customEffectDrawer.timelineShape.sinWave' },
            { value: 'squareWave', labelKey: 'customEffectDrawer.timelineShape.squareWave' },
            { value: 'circle', labelKey: 'customEffectDrawer.timelineShape.circle' },
            { value: 'square', labelKey: 'customEffectDrawer.timelineShape.square' },
            { value: 'triangle', labelKey: 'customEffectDrawer.timelineShape.triangle' },
        ] },
        { id: 'dotLineVibrate', labelKey: 'customEffectDrawer.field.dotLineVibrate', type: 'toggle', showIf: (cfg) => cfg.barStyle === 'dot' && !cfg.dotMoving && cfg.dotShape === 'line' },
        { id: 'dotImpactMode', labelKey: 'customEffectDrawer.field.dotImpactMode', type: 'select', showIf: (cfg) => cfg.barStyle === 'dot', rerender: true, options: [
            { value: 'radius', labelKey: 'customEffectDrawer.dotImpactMode.radius' },
            { value: 'height', labelKey: 'customEffectDrawer.dotImpactMode.height' },
        ] },
        // (25/09/2026, lượt 2) bẻ góc 2 nhánh — chỉ kiểu 'height'
        { id: 'dotBend', labelKey: 'customEffectDrawer.field.dotBend', type: 'select', showIf: (cfg) => cfg.barStyle === 'dot' && cfg.dotImpactMode === 'height', rerender: true, options: [
            { value: 'none', labelKey: 'customEffectDrawer.dotBend.none' },
            { value: 'gt', labelKey: 'customEffectDrawer.dotBend.gt' },
            { value: 'lt', labelKey: 'customEffectDrawer.dotBend.lt' },
            { value: 'slash', labelKey: 'customEffectDrawer.dotBend.slash' },
            { value: 'backslash', labelKey: 'customEffectDrawer.dotBend.backslash' },
        ] },
        { id: 'dotBendAngle', labelKey: 'customEffectDrawer.field.dotBendAngle', type: 'slider', min: 10, max: 80, step: 5, showIf: (cfg) => cfg.barStyle === 'dot' && cfg.dotImpactMode === 'height' && cfg.dotBend && cfg.dotBend !== 'none' },
        { id: 'dotCount', labelKey: 'customEffectDrawer.field.dotCount', type: 'slider', min: 20, max: 80, step: 2, showIf: (cfg) => cfg.barStyle === 'dot' },
    ],
    rain: [
        ...CUSTOM_EFFECT_FLASH_FIELDS, // chung Glass + Street (Street trước đây KHÔNG có toggle riêng)
        { id: 'glassCityOpacity', labelKey: 'visualizerSettingsDrawer.rainCityOpacity.label', type: 'slider', min: 0, max: 100, step: 5, showIf: (cfg) => cfg.rainStyle === 'glass' },
        { id: 'glassCityVisible', labelKey: 'visualizerSettingsDrawer.rainCityVisible.label', type: 'toggle', showIf: (cfg) => cfg.rainStyle === 'glass' },
        { id: 'glassMoonVisible', labelKey: 'visualizerSettingsDrawer.rainMoonVisible.label', type: 'toggle', showIf: (cfg) => cfg.rainStyle === 'glass' },
        { id: 'glassDropDensity', labelKey: 'customEffectDrawer.field.glassDropDensity', type: 'slider', min: 40, max: 400, step: 10, showIf: (cfg) => cfg.rainStyle === 'glass', refresh: 'resizeCanvas' },
        { id: 'glassStreakFrequency', labelKey: 'customEffectDrawer.field.glassStreakFrequency', type: 'slider', min: 0, max: 100, step: 5, showIf: (cfg) => cfg.rainStyle === 'glass' },
        { id: 'streetDensity', labelKey: 'customEffectDrawer.field.streetDensity', type: 'slider', min: 40, max: 400, step: 10, showIf: (cfg) => cfg.rainStyle === 'street', refresh: 'resizeCanvas' },
        { id: 'streetBuildingScale', labelKey: 'customEffectDrawer.field.streetBuildingScale', type: 'sliderFloat', min: 0.5, max: 3.0, step: 0.1, decimals: 1, showIf: (cfg) => cfg.rainStyle === 'street', refresh: 'resizeCanvas' },
    ],
    shape: [ // ĐỔI TÊN (05/09/2026) — trước đây khoá 'rubik', field không đổi.
        { id: 'cubeSizeRatio', labelKey: 'customEffectDrawer.field.cubeSizeRatio', type: 'sliderFloat', min: 0.03, max: 0.15, step: 0.01, decimals: 2 },
        { id: 'pitchSensitivity', labelKey: 'customEffectDrawer.field.pitchSensitivity', type: 'sliderFloat', min: 0, max: 2, step: 0.1, decimals: 1 },
        { id: 'rotationEnergyThreshold', labelKey: 'customEffectDrawer.field.rotationEnergyThreshold', type: 'sliderFloat', min: 0, max: 1, step: 0.05, decimals: 2 },
        { id: 'layerTurnSpeed', labelKey: 'customEffectDrawer.field.layerTurnSpeed', type: 'sliderFloat', min: 0.02, max: 0.3, step: 0.01, decimals: 2 },
    ],
    vortex: [
        // SỬA (25/09/2026, rà soát field dùng chung giữa style) — tunnelRingCount CHỈ style 'rings' đọc
        // (tGroupRings, core/webgl/three-vortex.js::initThreeJS()); trước đây không có showIf nên hiện cả ở
        // 'bars'/'wave' mà kéo không có tác dụng gì.
        { id: 'tunnelRingCount', labelKey: 'customEffectDrawer.field.tunnelRingCount', type: 'slider', min: 10, max: 100, step: 5, showIf: (cfg) => cfg.vortexStyle === 'rings', refresh: 'initThreeJS' },
        { id: 'warpSpeedBase', labelKey: 'customEffectDrawer.field.warpSpeedBase', type: 'slider', min: 0, max: 50, step: 1 },
        { id: 'warpSpeedEnergyMult', labelKey: 'customEffectDrawer.field.warpSpeedEnergyMult', type: 'slider', min: 0, max: 100, step: 5 },
        { id: 'redirectEnabled', labelKey: 'customEffectDrawer.field.redirectEnabled', type: 'toggle', group: 'music' },
        { id: 'sectionWindowBeats', labelKey: 'customEffectDrawer.field.curveSectionWindowBeats', type: 'slider', min: 6, max: 32, step: 1, group: 'music' },
        { id: 'fluxThreshold', labelKey: 'customEffectDrawer.field.curveFluxThreshold', type: 'sliderFloat', min: 0.1, max: 1, step: 0.05, decimals: 2, group: 'music' },
        { id: 'barsRingCount', labelKey: 'customEffectDrawer.field.barsRingCount', type: 'slider', min: 10, max: 80, step: 2, showIf: (cfg) => cfg.vortexStyle === 'bars', refresh: 'initThreeJS' },
        { id: 'barsPerRing', labelKey: 'customEffectDrawer.field.barsPerRing', type: 'slider', min: 6, max: 48, step: 2, showIf: (cfg) => cfg.vortexStyle === 'bars', refresh: 'initThreeJS' },
        { id: 'barsTwistFactor', labelKey: 'customEffectDrawer.field.barsTwistFactor', type: 'sliderFloat', min: 0, max: 6, step: 0.2, decimals: 1, showIf: (cfg) => cfg.vortexStyle === 'bars' },
        { id: 'waveRotationBase', labelKey: 'customEffectDrawer.field.waveRotationBase', type: 'sliderFloat', min: 0, max: 0.1, step: 0.005, decimals: 3, showIf: (cfg) => cfg.vortexStyle === 'wave' },
        { id: 'waveRotationEnergyMult', labelKey: 'customEffectDrawer.field.waveRotationEnergyMult', type: 'sliderFloat', min: 0, max: 0.3, step: 0.01, decimals: 2, showIf: (cfg) => cfg.vortexStyle === 'wave' },
        { id: 'waveScaleBase', labelKey: 'customEffectDrawer.field.waveScaleBase', type: 'sliderFloat', min: 0.3, max: 1.5, step: 0.05, decimals: 2, showIf: (cfg) => cfg.vortexStyle === 'wave' },
        { id: 'waveScaleEnergyMult', labelKey: 'customEffectDrawer.field.waveScaleEnergyMult', type: 'sliderFloat', min: 0, max: 1, step: 0.05, decimals: 2, showIf: (cfg) => cfg.vortexStyle === 'wave' },
    ],
    lighting: [
        ...CUSTOM_EFFECT_FLASH_FIELDS, // chung Thunder + Fireworks
        // Style "thunder" (tia sét)
        { id: 'boltThreshold', labelKey: 'customEffectDrawer.field.boltThreshold', type: 'sliderFloat', min: 0, max: 1, step: 0.05, decimals: 2, showIf: (cfg) => cfg.lightingStyle === 'thunder' },
        { id: 'boltSpawnChance', labelKey: 'customEffectDrawer.field.boltSpawnChance', type: 'sliderFloat', min: 0, max: 1, step: 0.05, decimals: 2, showIf: (cfg) => cfg.lightingStyle === 'thunder' },
        { id: 'maxBoltCount', labelKey: 'customEffectDrawer.field.maxBoltCount', type: 'slider', min: 1, max: 10, step: 1, showIf: (cfg) => cfg.lightingStyle === 'thunder' },
        { id: 'boltFadeSpeed', labelKey: 'customEffectDrawer.field.boltFadeSpeed', type: 'sliderFloat', min: 0.01, max: 0.15, step: 0.01, decimals: 2, showIf: (cfg) => cfg.lightingStyle === 'thunder' },
        { id: 'boltHorizontalDeviation', labelKey: 'customEffectDrawer.field.boltHorizontalDeviation', type: 'slider', min: 20, max: 300, step: 10, showIf: (cfg) => cfg.lightingStyle === 'thunder' },
        { id: 'boltSegmentLength', labelKey: 'customEffectDrawer.field.boltSegmentLength', type: 'slider', min: 10, max: 150, step: 10, showIf: (cfg) => cfg.lightingStyle === 'thunder' },
        // Style "fireworks" (pháo hoa)
        { id: 'particleCount', labelKey: 'customEffectDrawer.field.fwParticleCount', type: 'slider', min: 40, max: 350, step: 10, showIf: (cfg) => cfg.lightingStyle === 'fireworks' },
        { id: 'burstPower', labelKey: 'customEffectDrawer.field.fwBurstPower', type: 'sliderFloat', min: 0.5, max: 2.0, step: 0.1, decimals: 1, showIf: (cfg) => cfg.lightingStyle === 'fireworks' },
        { id: 'gravity', labelKey: 'customEffectDrawer.field.fwGravity', type: 'sliderFloat', min: 0.02, max: 0.12, step: 0.01, decimals: 2, showIf: (cfg) => cfg.lightingStyle === 'fireworks' },
        { id: 'autoLaunchDensity', labelKey: 'customEffectDrawer.field.fwAutoLaunchDensity', type: 'slider', min: 5, max: 100, step: 5, showIf: (cfg) => cfg.lightingStyle === 'fireworks' },
        { id: 'maxConcurrentRockets', labelKey: 'customEffectDrawer.field.fwMaxConcurrentRockets', type: 'slider', min: 3, max: 30, step: 1, showIf: (cfg) => cfg.lightingStyle === 'fireworks' },
        { id: 'finaleEnabled', labelKey: 'customEffectDrawer.field.finaleEnabled', type: 'toggle', showIf: (cfg) => cfg.lightingStyle === 'fireworks', group: 'music' },
        // Tham số THẬT của detectMusicTransition() (core/audio-analysis.js) — CHỈ nghĩa lý ở style
        // "fireworks" (quyết định finale, xem event/workflow/visualizer-render.js::
        // _fwUpdateFinaleTrigger()), style "thunder" không dùng detectMusicTransition().
        { id: 'sectionWindowBeats', labelKey: 'customEffectDrawer.field.musicSectionWindowBeats', type: 'slider', min: 6, max: 32, step: 1, showIf: (cfg) => cfg.lightingStyle === 'fireworks', group: 'music' },
        { id: 'fluxThreshold', labelKey: 'customEffectDrawer.field.musicFluxThreshold', type: 'sliderFloat', min: 0.1, max: 1, step: 0.05, decimals: 2, showIf: (cfg) => cfg.lightingStyle === 'fireworks', group: 'music' },
    ],
    connector: [
        { id: 'glowEnabled', labelKey: 'customEffectDrawer.field.connectorGlowEnabled', type: 'toggle' },
        { id: 'glowIntensity', labelKey: 'customEffectDrawer.field.connectorGlowIntensity', type: 'slider', min: 0, max: 100, step: 5 },
        // MỚI (23/09/2026, Giang) — style 'brain'. type 'select' (MỚI, components/custom-effect-drawer.js
        // ::_renderCeFieldRow()): `options` = [{ value, labelKey }]. brain.js tự dựng lại layout khi giá
        // trị đổi (so với lần vẽ trước) nên không cần `refresh`.
        { id: 'brainDirection', labelKey: 'customEffectDrawer.field.brainDirection', type: 'select', showIf: (cfg) => cfg.connectorStyle === 'brain', options: [
            { value: 'ltr', labelKey: 'customEffectDrawer.brainDirection.ltr' },
            { value: 'rtl', labelKey: 'customEffectDrawer.brainDirection.rtl' },
            { value: 'ttb', labelKey: 'customEffectDrawer.brainDirection.ttb' },
            { value: 'btt', labelKey: 'customEffectDrawer.brainDirection.btt' },
        ] },
        // MỚI (23/09/2026, Giang "thêm hết custom effect") — style 'brain', brain.js::_applySettings().
        // Bật/tắt từng thành phần
        { id: 'brainShowNodes', labelKey: 'customEffectDrawer.field.brainShowNodes', type: 'toggle', showIf: (cfg) => cfg.connectorStyle === 'brain' },
        { id: 'brainShowOrbit', labelKey: 'customEffectDrawer.field.brainShowOrbit', type: 'toggle', showIf: (cfg) => cfg.connectorStyle === 'brain' },
        { id: 'brainShowStrings', labelKey: 'customEffectDrawer.field.brainShowStrings', type: 'toggle', showIf: (cfg) => cfg.connectorStyle === 'brain' },
        // Tia input + filter
        { id: 'brainSignalCount', labelKey: 'customEffectDrawer.field.brainSignalCount', type: 'slider', min: 40, max: 200, step: 10, showIf: (cfg) => cfg.connectorStyle === 'brain' },
        { id: 'brainFilterStrictness', labelKey: 'customEffectDrawer.field.brainFilterStrictness', type: 'sliderFloat', min: 0.8, max: 1, step: 0.01, decimals: 2, showIf: (cfg) => cfg.connectorStyle === 'brain' },
        { id: 'brainInputSpeed', labelKey: 'customEffectDrawer.field.brainInputSpeed', type: 'sliderFloat', min: 0.5, max: 3, step: 0.1, decimals: 1, showIf: (cfg) => cfg.connectorStyle === 'brain' },
        { id: 'brainPumpSqueeze', labelKey: 'customEffectDrawer.field.brainPumpSqueeze', type: 'slider', min: 0, max: 50, step: 2, showIf: (cfg) => cfg.connectorStyle === 'brain' },
        { id: 'brainPumpSensitivity', labelKey: 'customEffectDrawer.field.brainPumpSensitivity', type: 'sliderFloat', min: 1, max: 10, step: 0.5, decimals: 1, showIf: (cfg) => cfg.connectorStyle === 'brain' },
        // Node trong ellipse (ngoài ra dùng chung Fire threshold / Lateral inhibition phía trên)
        { id: 'brainNodeFlashSensitivity', labelKey: 'customEffectDrawer.field.brainNodeFlashSensitivity', type: 'sliderFloat', min: 1, max: 10, step: 0.5, decimals: 1, showIf: (cfg) => cfg.connectorStyle === 'brain' },
        // Dot quanh ellipse
        { id: 'brainOrbitDotCount', labelKey: 'customEffectDrawer.field.brainOrbitDotCount', type: 'slider', min: 1, max: 16, step: 1, showIf: (cfg) => cfg.connectorStyle === 'brain' },
        { id: 'brainOrbitBeatsPerLap', labelKey: 'customEffectDrawer.field.brainOrbitBeatsPerLap', type: 'slider', min: 2, max: 32, step: 1, showIf: (cfg) => cfg.connectorStyle === 'brain' },
        { id: 'brainOrbitTrail', labelKey: 'customEffectDrawer.field.brainOrbitTrail', type: 'slider', min: 0, max: 12, step: 1, showIf: (cfg) => cfg.connectorStyle === 'brain' },
        // 7 dây output
        { id: 'brainStringAmplitude', labelKey: 'customEffectDrawer.field.brainStringAmplitude', type: 'slider', min: 0, max: 200, step: 10, showIf: (cfg) => cfg.connectorStyle === 'brain' },
        { id: 'brainStringDecayMs', labelKey: 'customEffectDrawer.field.brainStringDecayMs', type: 'slider', min: 100, max: 1000, step: 20, showIf: (cfg) => cfg.connectorStyle === 'brain' },
        { id: 'brainStringDotBeats', labelKey: 'customEffectDrawer.field.brainStringDotBeats', type: 'slider', min: 1, max: 8, step: 1, showIf: (cfg) => cfg.connectorStyle === 'brain' },
        // (23/09/2026) khoảng cách dot trong đoàn theo hoạ âm của nốt — min (hoạ âm yếu) / max (hoạ âm mạnh), % độ dài dây
        { id: 'brainStringDotGapMin', labelKey: 'customEffectDrawer.field.brainStringDotGapMin', type: 'sliderFloat', min: 0.5, max: 10, step: 0.5, decimals: 1, showIf: (cfg) => cfg.connectorStyle === 'brain' },
        { id: 'brainStringDotGapMax', labelKey: 'customEffectDrawer.field.brainStringDotGapMax', type: 'sliderFloat', min: 2, max: 20, step: 0.5, decimals: 1, showIf: (cfg) => cfg.connectorStyle === 'brain' },
        { id: 'brainStringDotGapLive', labelKey: 'customEffectDrawer.field.brainStringDotGapLive', type: 'toggle', showIf: (cfg) => cfg.connectorStyle === 'brain' },
        // (25/09/2026) Trục thời gian của brain ĐÃ CHUYỂN sang style bar 'dot' (timelineShape/brainShowTimeline/
        // brainTimelineDotCount/brainTimelineMaxTravel xoá).
        // SỬA (yêu cầu Giang 16/09/2026, layout lưới phẳng) — max 48->64, min/step đổi 12/3->16/4
        // để 32 (mặc định mới) và 64 (max mới) đều rơi đúng mốc slider.
        { id: 'neuronCount', labelKey: 'customEffectDrawer.field.neuronCount', type: 'slider', min: 16, max: 64, step: 4, showIf: (cfg) => cfg.connectorStyle === 'synapse', refresh: 'initThreeJSConnector' },
        // ĐỔI (yêu cầu Giang — circuit bắn xung theo audio từng node, dùng CHUNG logic bắn với synapse): fireThreshold/lateralInhibitStrength hiện cho CẢ 2 style (bỏ showIf 'synapse').
        // (23/09/2026) Nay nối cả style 'brain': fireThreshold = ngưỡng nhiễu flux của node trong ellipse,
        // lateralInhibitStrength = dải loé đè 2 dải kề; glowEnabled/glowIntensity nhân vào mọi shadowBlur của brain.
        { id: 'fireThreshold', labelKey: 'customEffectDrawer.field.fireThreshold', type: 'sliderFloat', min: 0, max: 1, step: 0.05, decimals: 2 },
        // MỚI (yêu cầu Giang 17/09/2026 — "lateral inhibition", xem applyLateralInhibition(),
        // core/visualizer/groups/connector/synapse.js): mức ngưỡng bắn bị ĐÈ LÊN (đơn vị byte,
        // 0-255) ở các nơ-ron LÂN CẬN mỗi khi 1 nơ-ron vừa bắn — 0 = tắt hẳn (mọi nơ-ron độc lập
        // hoàn toàn), càng cao càng "tương phản"/thưa (tránh cả cụm cùng sáng loạt khi có 1 tiếng
        // động broadband).
        { id: 'lateralInhibitStrength', labelKey: 'customEffectDrawer.field.lateralInhibitStrength', type: 'slider', min: 0, max: 150, step: 10 },
        { id: 'synapseSpeedBase', labelKey: 'customEffectDrawer.field.synapseSpeedBase', type: 'slider', min: 20, max: 200, step: 5, showIf: (cfg) => cfg.connectorStyle === 'synapse' },
        { id: 'synapseSpeedEnergyMult', labelKey: 'customEffectDrawer.field.synapseSpeedEnergyMult', type: 'slider', min: 0, max: 150, step: 5, showIf: (cfg) => cfg.connectorStyle === 'synapse' },
        // ĐỔI (yêu cầu Giang — circuit lưới lập phương từ ngoài vào trong, buildCircuitCubeCells()): 20-80/5 -> 16-64/4, khớp neuronCount synapse.
        { id: 'nodeCount', labelKey: 'customEffectDrawer.field.nodeCount', type: 'slider', min: 16, max: 64, step: 4, showIf: (cfg) => cfg.connectorStyle === 'circuit', refresh: 'initThreeJSConnector' },
        { id: 'maxConcurrentSignals', labelKey: 'customEffectDrawer.field.maxConcurrentSignals', type: 'slider', min: 20, max: 90, step: 5, showIf: (cfg) => cfg.connectorStyle === 'circuit' },
        { id: 'trailLength', labelKey: 'customEffectDrawer.field.trailLength', type: 'slider', min: 5, max: 60, step: 5, showIf: (cfg) => cfg.connectorStyle === 'circuit' },
        { id: 'circuitSpeedBase', labelKey: 'customEffectDrawer.field.circuitSpeedBase', type: 'slider', min: 20, max: 200, step: 5, showIf: (cfg) => cfg.connectorStyle === 'circuit' },
        { id: 'circuitSpeedEnergyMult', labelKey: 'customEffectDrawer.field.circuitSpeedEnergyMult', type: 'slider', min: 0, max: 150, step: 5, showIf: (cfg) => cfg.connectorStyle === 'circuit' },
        { id: 'bloomStrengthBase', labelKey: 'customEffectDrawer.field.bloomStrengthBase', type: 'sliderFloat', min: 0, max: 4, step: 0.1, decimals: 1, showIf: (cfg) => cfg.connectorStyle === 'circuit' },
        { id: 'bloomStrengthEnergyMult', labelKey: 'customEffectDrawer.field.bloomStrengthEnergyMult', type: 'sliderFloat', min: 0, max: 4, step: 0.1, decimals: 1, showIf: (cfg) => cfg.connectorStyle === 'circuit' },
        { id: 'cameraShiftEnabled', labelKey: 'customEffectDrawer.field.connectorCameraShiftEnabled', type: 'toggle', showIf: (cfg) => cfg.connectorStyle === 'circuit' },
        // MỚI (23/09/2026) — style 'brain': burst theo Music Transition. `rerender: true` (MỚI) —
        // Workflow vẽ lại body khi toggle đổi, để 2 slider bên dưới (showIf phụ thuộc toggle) hiện/ẩn ngay.
        { id: 'burstEnabled', labelKey: 'customEffectDrawer.field.brainBurstEnabled', type: 'toggle', showIf: (cfg) => cfg.connectorStyle === 'brain', group: 'music', rerender: true },
        // ĐỔI (23/09/2026) — 2 field dùng CHUNG cho circuit (camera shift) và brain (burst).
        { id: 'sectionWindowBeats', labelKey: 'customEffectDrawer.field.musicSectionWindowBeats', type: 'slider', min: 6, max: 32, step: 1, showIf: (cfg) => (cfg.connectorStyle === 'circuit' && cfg.cameraShiftEnabled) || (cfg.connectorStyle === 'brain' && cfg.burstEnabled), group: 'music' },
        { id: 'fluxThreshold', labelKey: 'customEffectDrawer.field.musicFluxThreshold', type: 'sliderFloat', min: 0.1, max: 1, step: 0.05, decimals: 2, showIf: (cfg) => (cfg.connectorStyle === 'circuit' && cfg.cameraShiftEnabled) || (cfg.connectorStyle === 'brain' && cfg.burstEnabled), group: 'music' },
    ],
};
/** MỚI (25/09/2026, Giang báo "maxH chỉnh ở mirror, sang cascade vẫn dùng chung giá trị -> sai") — field
 * mà NHIỀU style con cùng hiện/cùng đọc trong 1 group -> lưu RIÊNG theo từng style, không dùng chung 1 giá
 * trị cho cả group nữa. Chỗ lưu: `customEffect[group].byStyle[style][field]` (chỉ tạo khi người dùng chỉnh).
 * Đọc: getEffectConfig() đè giá trị của style ĐANG CHỌN (field style = CUSTOM_EFFECT_STYLE[group].field) lên
 * bucket group; style CHƯA từng chỉnh field đó -> rơi về giá trị group cũ (= giá trị dùng chung trước bản
 * này) rồi default -> save cũ không cần migrate, mọi style giữ nguyên giá trị đang thấy, chỉ tách ra từ lần
 * chỉnh đầu tiên. Field CHỈ 1 style dùng (có showIf riêng 1 style) vẫn lưu phẳng ở bucket group như cũ —
 * không đưa vào đây (các hàm dựng scene đọc thẳng getEffectConfig(group) lúc resize/init, không phụ thuộc
 * style đang chọn). Group chỉ 1 style (shape) không cần entry.
 * Rà soát 25/09/2026 — field dùng chung đã tách:
 *   - Khối chung màu (mode/solidColor/dynA/dynB) mọi group nhiều style; blur (blurEnabled/blurIntensity)
 *     ở bar + lighting (group còn lại nằm trong CUSTOM_EFFECT_NO_BLUR).
 *   - bar: maxH (mirror/cascade/black hole).
 *   - lighting (thunder/fireworks) + rain (glass/street): 3 field chớp CUSTOM_EFFECT_FLASH_FIELDS.
 *   - vortex (rings/bars/wave): warpSpeedBase/warpSpeedEnergyMult + Redirect (redirectEnabled/
 *     sectionWindowBeats/fluxThreshold).
 *   - connector (synapse/circuit/brain): glowEnabled/glowIntensity/fireThreshold/lateralInhibitStrength;
 *     sectionWindowBeats/fluxThreshold (circuit camera shift / brain burst). */
const CUSTOM_EFFECT_COLOR_FIELDS = ['mode', 'solidColor', 'dynA', 'dynB'];
const CUSTOM_EFFECT_BLUR_FIELDS = ['blurEnabled', 'blurIntensity'];
const CUSTOM_EFFECT_PER_STYLE_FIELDS = {
    bar: [...CUSTOM_EFFECT_COLOR_FIELDS, ...CUSTOM_EFFECT_BLUR_FIELDS, 'maxH'],
    lighting: [...CUSTOM_EFFECT_COLOR_FIELDS, ...CUSTOM_EFFECT_BLUR_FIELDS, ...CUSTOM_EFFECT_FLASH_FIELDS.map((f) => f.id)],
    rain: [...CUSTOM_EFFECT_COLOR_FIELDS, ...CUSTOM_EFFECT_FLASH_FIELDS.map((f) => f.id)],
    vortex: [...CUSTOM_EFFECT_COLOR_FIELDS, 'warpSpeedBase', 'warpSpeedEnergyMult', 'redirectEnabled', 'sectionWindowBeats', 'fluxThreshold'],
    connector: [...CUSTOM_EFFECT_COLOR_FIELDS, 'glowEnabled', 'glowIntensity', 'fireThreshold', 'lateralInhibitStrength', 'sectionWindowBeats', 'fluxThreshold'],
};

/** Config đầy đủ (default merge field thiếu) của 1 effect theo type. SỬA (25/09/2026) — đè thêm giá trị
 * RIÊNG của style đang chọn cho các field trong CUSTOM_EFFECT_PER_STYLE_FIELDS (xem docblock bảng đó).
 * `byStyle` là chỗ lưu nội bộ, không trả ra ngoài -> nơi đọc (Drawer, hàm vẽ, brain `settings`) vẫn thấy
 * object phẳng y như trước. */
function getEffectConfig(type) {
    const cfg = appConfigViz.getAll();
    const merged = { ...DEFAULT_CUSTOM_EFFECT[type], ...(cfg.customEffect && cfg.customEffect[type]) };
    const perStyleFields = CUSTOM_EFFECT_PER_STYLE_FIELDS[type] || [];
    const styleDef = CUSTOM_EFFECT_STYLE[type];
    const own = (styleDef && merged.byStyle && merged.byStyle[merged[styleDef.field]]) || {};
    perStyleFields.forEach((field) => { if (own[field] !== undefined) merged[field] = own[field]; });
    delete merged.byStyle;
    return merged;
}

/** Config effect ĐANG CHẠY (cfg.type) — dùng bởi getComputedColor()/getActiveBlurMult()
 * (core/audio-analysis.js) và mọi hàm vẽ (core/visualizer/types/*.js). */
function getActiveEffectConfig() {
    return getEffectConfig(appConfigViz.getAll().type);
}

/** Ghi 1 field vào customEffect[type] — DUY NHẤT nơi mutate (Rule 2), Workflow tự gọi saveConfig()
 * sau. Rule 1: luôn tạo bucket effect nếu thiếu rồi ghi field, đúng 1 tiến trình.
 * SỬA (25/09/2026) — field nằm trong CUSTOM_EFFECT_PER_STYLE_FIELDS[type] ghi vào ô RIÊNG của style đang
 * chọn (`byStyle[style]`) thay vì bucket group — vẫn đúng 1 tiến trình "ghi 1 field", chỉ tra bảng để
 * chọn ô đích. `byStyle`/ô style luôn tạo object MỚI (không sửa tại chỗ object có thể đang tham chiếu
 * chung với DEFAULT_CUSTOM_EFFECT qua spread nông). */
function setCustomEffectField(type, field, value) {
    appConfigViz.mutateAll(cfg => {
        if (!cfg.customEffect[type]) cfg.customEffect[type] = { ...DEFAULT_CUSTOM_EFFECT[type] };
        const bucket = cfg.customEffect[type];
        const styleDef = CUSTOM_EFFECT_STYLE[type];
        const isPerStyle = !!styleDef && (CUSTOM_EFFECT_PER_STYLE_FIELDS[type] || []).includes(field);
        if (!isPerStyle) { bucket[field] = value; return; }
        const style = bucket[styleDef.field] || DEFAULT_CUSTOM_EFFECT[type][styleDef.field];
        const byStyle = { ...(bucket.byStyle || {}) };
        byStyle[style] = { ...(byStyle[style] || {}), [field]: value };
        bucket.byStyle = byStyle;
    });
}

/** Cường độ blur/glow quy đổi 0-1 cho 1 effect bất kỳ (không nhất thiết đang active) — dùng bởi
 * core/canvas-scene-setup.js lúc khởi tạo scene, KHÔNG qua audio-analysis.js (tránh phụ thuộc
 * chéo lúc file đó chưa nạp). */
function getEffectBlurMult(type) {
    const ec = getEffectConfig(type);
    return ec.blurEnabled ? ec.blurIntensity / 100 : 0;
}

/** Glow sprite Three.js của connector — cơ chế khác hẳn shadowBlur canvas 2D nên đọc field riêng
 * (glowEnabled/glowIntensity), không dùng chung getEffectBlurMult(). */
function getConnectorGlowMult() {
    const ec = getEffectConfig('connector');
    return ec.glowEnabled ? ec.glowIntensity / 100 : 0;
}
