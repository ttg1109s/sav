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
    bar: { field: 'barStyle', options: ['mirror', 'cascade', 'black hole'] },
    rain: { field: 'rainStyle', options: ['glass', 'street'] },
    vortex: { field: 'vortexStyle', options: ['rings', 'bars', 'wave'] },
    lighting: { field: 'lightingStyle', options: ['thunder', 'fireworks'] },
    shape: { field: 'shapeStyle', options: ['rubik'] },
    connector: { field: 'connectorStyle', options: ['synapse', 'circuit'] },
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

/** Key i18n cho từng option style — TÁI DÙNG bộ text sẵn có (visualizerSettingsDrawer.*), không
 * dịch trùng 1 khái niệm ở 2 nơi. */
const CUSTOM_EFFECT_STYLE_LABEL_KEYS = {
    bar: {
        mirror: 'visualizerSettingsDrawer.barStyle.mirror', cascade: 'visualizerSettingsDrawer.barStyle.cascade',
        'black hole': 'visualizerSettingsDrawer.barStyle.blackHole',
    },
    rain: { glass: 'visualizerSettingsDrawer.rainStyle.glass', street: 'visualizerSettingsDrawer.rainStyle.street' },
    vortex: { rings: 'visualizerSettingsDrawer.vortexStyle.rings', bars: 'visualizerSettingsDrawer.vortexStyle.bars', wave: 'visualizerSettingsDrawer.vortexStyle.wave' },
    lighting: { thunder: 'visualizerSettingsDrawer.lightingStyle.thunder', fireworks: 'visualizerSettingsDrawer.lightingStyle.fireworks' },
    shape: { rubik: 'visualizerSettingsDrawer.shapeStyle.rubik' },
    connector: { synapse: 'visualizerSettingsDrawer.connectorStyle.synapse', circuit: 'visualizerSettingsDrawer.connectorStyle.circuit' },
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
    shape: [ // ĐỔI TÊN (05/09/2026) — trước đây khoá 'rubik', field không đổi.
        { id: 'cubeSizeRatio', labelKey: 'customEffectDrawer.field.cubeSizeRatio', type: 'sliderFloat', min: 0.03, max: 0.15, step: 0.01, decimals: 2 },
        { id: 'pitchSensitivity', labelKey: 'customEffectDrawer.field.pitchSensitivity', type: 'sliderFloat', min: 0, max: 2, step: 0.1, decimals: 1 },
        { id: 'rotationEnergyThreshold', labelKey: 'customEffectDrawer.field.rotationEnergyThreshold', type: 'sliderFloat', min: 0, max: 1, step: 0.05, decimals: 2 },
        { id: 'layerTurnSpeed', labelKey: 'customEffectDrawer.field.layerTurnSpeed', type: 'sliderFloat', min: 0.02, max: 0.3, step: 0.01, decimals: 2 },
    ],
    vortex: [
        { id: 'tunnelRingCount', labelKey: 'customEffectDrawer.field.tunnelRingCount', type: 'slider', min: 10, max: 100, step: 5, refresh: 'initThreeJS' },
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
        // Chung cho cả 2 style — chớp sáng toàn màn hình khi năng lượng vượt ngưỡng.
        { id: 'flashThreshold', labelKey: 'customEffectDrawer.field.flashThreshold', type: 'sliderFloat', min: 0, max: 1, step: 0.05, decimals: 2 },
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
        // SỬA (yêu cầu Giang 16/09/2026, layout lưới phẳng) — max 48->64, min/step đổi 12/3->16/4
        // để 32 (mặc định mới) và 64 (max mới) đều rơi đúng mốc slider.
        { id: 'neuronCount', labelKey: 'customEffectDrawer.field.neuronCount', type: 'slider', min: 16, max: 64, step: 4, showIf: (cfg) => cfg.connectorStyle === 'synapse', refresh: 'initThreeJSConnector' },
        { id: 'fireThreshold', labelKey: 'customEffectDrawer.field.fireThreshold', type: 'sliderFloat', min: 0, max: 1, step: 0.05, decimals: 2, showIf: (cfg) => cfg.connectorStyle === 'synapse' },
        // MỚI (yêu cầu Giang 17/09/2026 — "lateral inhibition", xem applyLateralInhibition(),
        // core/visualizer/groups/connector/synapse.js): mức ngưỡng bắn bị ĐÈ LÊN (đơn vị byte,
        // 0-255) ở các nơ-ron LÂN CẬN mỗi khi 1 nơ-ron vừa bắn — 0 = tắt hẳn (mọi nơ-ron độc lập
        // hoàn toàn), càng cao càng "tương phản"/thưa (tránh cả cụm cùng sáng loạt khi có 1 tiếng
        // động broadband).
        { id: 'lateralInhibitStrength', labelKey: 'customEffectDrawer.field.lateralInhibitStrength', type: 'slider', min: 0, max: 150, step: 10, showIf: (cfg) => cfg.connectorStyle === 'synapse' },
        { id: 'synapseSpeedBase', labelKey: 'customEffectDrawer.field.synapseSpeedBase', type: 'slider', min: 20, max: 200, step: 5, showIf: (cfg) => cfg.connectorStyle === 'synapse' },
        { id: 'synapseSpeedEnergyMult', labelKey: 'customEffectDrawer.field.synapseSpeedEnergyMult', type: 'slider', min: 0, max: 150, step: 5, showIf: (cfg) => cfg.connectorStyle === 'synapse' },
        { id: 'nodeCount', labelKey: 'customEffectDrawer.field.nodeCount', type: 'slider', min: 20, max: 80, step: 5, showIf: (cfg) => cfg.connectorStyle === 'circuit', refresh: 'initThreeJSConnector' },
        { id: 'signalsPerBeat', labelKey: 'customEffectDrawer.field.signalsPerBeat', type: 'slider', min: 1, max: 6, step: 1, showIf: (cfg) => cfg.connectorStyle === 'circuit' },
        { id: 'maxConcurrentSignals', labelKey: 'customEffectDrawer.field.maxConcurrentSignals', type: 'slider', min: 20, max: 90, step: 5, showIf: (cfg) => cfg.connectorStyle === 'circuit' },
        { id: 'trailLength', labelKey: 'customEffectDrawer.field.trailLength', type: 'slider', min: 5, max: 60, step: 5, showIf: (cfg) => cfg.connectorStyle === 'circuit' },
        { id: 'circuitSpeedBase', labelKey: 'customEffectDrawer.field.circuitSpeedBase', type: 'slider', min: 20, max: 200, step: 5, showIf: (cfg) => cfg.connectorStyle === 'circuit' },
        { id: 'circuitSpeedEnergyMult', labelKey: 'customEffectDrawer.field.circuitSpeedEnergyMult', type: 'slider', min: 0, max: 150, step: 5, showIf: (cfg) => cfg.connectorStyle === 'circuit' },
        { id: 'bloomStrengthBase', labelKey: 'customEffectDrawer.field.bloomStrengthBase', type: 'sliderFloat', min: 0, max: 4, step: 0.1, decimals: 1, showIf: (cfg) => cfg.connectorStyle === 'circuit' },
        { id: 'bloomStrengthEnergyMult', labelKey: 'customEffectDrawer.field.bloomStrengthEnergyMult', type: 'sliderFloat', min: 0, max: 4, step: 0.1, decimals: 1, showIf: (cfg) => cfg.connectorStyle === 'circuit' },
        { id: 'cameraShiftEnabled', labelKey: 'customEffectDrawer.field.connectorCameraShiftEnabled', type: 'toggle', showIf: (cfg) => cfg.connectorStyle === 'circuit' },
        { id: 'sectionWindowBeats', labelKey: 'customEffectDrawer.field.musicSectionWindowBeats', type: 'slider', min: 6, max: 32, step: 1, showIf: (cfg) => cfg.connectorStyle === 'circuit' && cfg.cameraShiftEnabled, group: 'music' },
        { id: 'fluxThreshold', labelKey: 'customEffectDrawer.field.musicFluxThreshold', type: 'sliderFloat', min: 0.1, max: 1, step: 0.05, decimals: 2, showIf: (cfg) => cfg.connectorStyle === 'circuit' && cfg.cameraShiftEnabled, group: 'music' },
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

/** Glow sprite Three.js của connector — cơ chế khác hẳn shadowBlur canvas 2D nên đọc field riêng
 * (glowEnabled/glowIntensity), không dùng chung getEffectBlurMult(). */
function getConnectorGlowMult() {
    const ec = getEffectConfig('connector');
    return ec.glowEnabled ? ec.glowIntensity / 100 : 0;
}
