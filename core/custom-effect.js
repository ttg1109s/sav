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
 * CÙNG thứ tự, CÙNG khoảng giá trị (chỉ khác default, xem DEFAULT_CUSTOM_EFFECT, core/config.js). Công
 * thức: computeScreenFlashAlpha() (core/visualizer/draw/screen-flash-alpha.js). [MỚI 19/09/2026]
 * SỬA (25/09/2026, rà soát Custom Effect) — toggle `rerender` + 2 slider `showIf` theo toggle: tắt chớp thì
 * ẩn ngưỡng/opacity (cùng khuôn khối Blur — trước đây không ẩn được vì toggle chưa dựng lại UI, giờ đã có
 * `rerender`). Cả 3 thuộc card 'flash' (xem CUSTOM_EFFECT_CARD_ORDER). */
const CUSTOM_EFFECT_FLASH_FIELDS = [
    { id: 'flashEnabled', labelKey: 'customEffectDrawer.field.flashEnabled', type: 'toggle', card: 'flash', rerender: true },
    { id: 'flashThreshold', labelKey: 'customEffectDrawer.field.flashThreshold', type: 'sliderFloat', min: 0, max: 1, step: 0.05, decimals: 2, card: 'flash', showIf: (cfg) => cfg.flashEnabled !== false },
    { id: 'flashMaxOpacity', labelKey: 'customEffectDrawer.field.flashMaxOpacity', type: 'sliderFloat', min: 0, max: SCREEN_FLASH_MAX_ALPHA, step: 0.05, decimals: 2, card: 'flash', showIf: (cfg) => cfg.flashEnabled !== false },
];

/** MỚI (25/09/2026, Giang "sắp xếp lại custom effect theo nhóm card") — MỌI field trong CUSTOM_EFFECT_FIELDS
 * mang `card` (chuỗi, hoặc hàm `(cfg) => chuỗi` khi 1 field đổi ý nghĩa theo style — vd maxH). Drawer
 * (components/custom-effect-drawer.js::renderCustomEffectBody()) dựng MỖI loại 1 card KHÔNG tiêu đề (Giang
 * bỏ hết tiêu đề kiểu "Redirect"/"Finale"/"Burst"), theo đúng thứ tự mảng này; trong 1 card xếp theo
 * loại field (CUSTOM_EFFECT_FIELD_TYPE_ORDER ngay dưới), cùng loại thì giữ thứ tự khai báo. Card không có field nào đang hiện (showIf) thì không vẽ. Khối Color luôn đứng đầu, khối Blur
 * chung (group ngoài CUSTOM_EFFECT_NO_BLUR) vẽ tại vị trí 'glow'.
 *   - music    : cơ chế tự trigger theo chuyển đoạn nhạc — toggle bật/tắt + tham số THẬT của
 *                detectMusicTransition() (sectionWindowBeats/fluxThreshold). Giữ NGAY DƯỚI Color (phản hồi
 *                Giang trước đây).
 *   - flash    : chớp sáng toàn màn hình (CUSTOM_EFFECT_FLASH_FIELDS).
 *   - glow     : phát sáng/bloom (connector: glow sprite + bloom circuit; group khác: khối Blur chung).
 *   - element  : bật/tắt thành phần + độ hiện (opacity/đuôi vệt).
 *   - layout   : bố cục tĩnh — số lượng, kích thước, hình dạng, hướng.
 *   - motion   : chuyển động — tốc độ/xoay (cặp "base + theo năng lượng" đi CÙNG nhau), nhịp chạy.
 *   - reaction : phản ứng âm thanh — ngưỡng kích hoạt, độ nhạy, biên độ/tác động theo audio. */
const CUSTOM_EFFECT_CARD_ORDER = ['music', 'flash', 'glow', 'element', 'layout', 'motion', 'reaction'];

/** MỚI (25/09/2026, Giang) — thứ tự loại field TRONG 1 card: toggle > dropdown (select) > input > slider
 * (slider + sliderFloat chung hạng). Sắp ổn định (stable) — cùng hạng giữ thứ tự khai báo. Loại lạ (chưa có
 * trong bảng) xếp cuối. 'input' chưa field nào dùng, giữ chỗ cho đúng thứ tự Giang chốt. */
const CUSTOM_EFFECT_FIELD_TYPE_ORDER = { toggle: 0, select: 1, input: 2, slider: 3, sliderFloat: 3 };

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
/** MỚI (26/09/2026, Giang báo clock "chưa áp dụng blur/glow") — ngoại lệ THEO STYLE của CUSTOM_EFFECT_NO_BLUR:
 * group nằm trong danh sách trên nhưng style con dưới đây CÓ đọc khối Blur chung (shadowBlur canvas 2D) ->
 * Drawer vẫn hiện khối Blur khi đang ở style đó. Shape: 'clock' dùng, 'rubik' vẫn glow cố định. */
const CUSTOM_EFFECT_BLUR_STYLES = { shape: ['clock'] };

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
    shape: { field: 'shapeStyle', options: ['rubik', 'clock'] },
    connector: { field: 'connectorStyle', options: ['synapse', 'circuit', 'brain'] },
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
    shape: { rubik: 'visualizerSettingsDrawer.shapeStyle.rubik', clock: 'visualizerSettingsDrawer.shapeStyle.clock' },
    connector: { synapse: 'visualizerSettingsDrawer.connectorStyle.synapse', circuit: 'visualizerSettingsDrawer.connectorStyle.circuit', brain: 'visualizerSettingsDrawer.connectorStyle.brain' },
};

/** Field riêng của TỪNG effect, hiện SAU khối Color trong Drawer — dựng UI DATA-DRIVEN (1 hàm render chung
 * đọc bảng này, xem components/custom-effect-drawer.js), tránh viết tay 7 khối HTML lặp lại. `showIf(cfg)`
 * optional — field chỉ hiện khi đúng điều kiện (vd riêng theo style con hiện tại). `refresh` optional — hàm
 * core cần gọi lại NGAY để thấy hiệu quả tức thì (field chỉ đọc lúc khởi tạo scene, không đọc mỗi frame).
 * `rerender` optional — toggle/select mà field khác có showIf phụ thuộc -> Workflow vẽ lại body.
 * `card` BẮT BUỘC — loại card chứa field (CUSTOM_EFFECT_CARD_ORDER ở trên).
 * SẮP XẾP LẠI (25/09/2026, Giang) — khai báo theo đúng thứ tự card (music -> flash -> glow -> element ->
 * layout -> motion -> reaction), trong mỗi card xếp theo style con; id/khoảng giá trị/showIf cũ KHÔNG đổi. */
const CUSTOM_EFFECT_FIELDS = {
    bar: [
        // ── element ──
        { id: 'mirrorPeaks', labelKey: 'customEffectDrawer.field.mirrorPeaks', type: 'toggle', card: 'element', showIf: (cfg) => cfg.barStyle === 'mirror' }, // MỚI 25/09/2026
        { id: 'cascadeBaseAlpha', labelKey: 'customEffectDrawer.field.cascadeBaseAlpha', type: 'sliderFloat', min: 0, max: 1, step: 0.05, decimals: 2, card: 'element', showIf: (cfg) => cfg.barStyle === 'cascade' },
        // dotImpactMode (card 'reaction', chỉ style 'dot') — select nên luôn đứng trước maxH (slider) trong card,
        // theo CUSTOM_EFFECT_FIELD_TYPE_ORDER.
        { id: 'dotImpactMode', labelKey: 'customEffectDrawer.field.dotImpactMode', type: 'select', card: 'reaction', showIf: (cfg) => cfg.barStyle === 'dot', rerender: true, options: [
            { value: 'radius', labelKey: 'customEffectDrawer.dotImpactMode.radius' },
            { value: 'height', labelKey: 'customEffectDrawer.dotImpactMode.height' },
        ] },
        // ── layout ──
        // SỬA (25/09/2026) — style 'dot' chỉ dùng maxH khi kiểu tác động = 'height' — lúc đó là độ vươn của
        // dot tác động nên nằm card 'reaction' cạnh "Kiểu tác động"; style khác là chiều cao cột (layout).
        { id: 'maxH', labelKey: 'visualizerSettingsDrawer.maxHeight.label', type: 'slider', min: 50, max: 1000, step: 10, card: (cfg) => (cfg.barStyle === 'dot' ? 'reaction' : 'layout'), showIf: (cfg) => cfg.barStyle !== 'dot' || cfg.dotImpactMode === 'height' },
        { id: 'mirrorBarCount', labelKey: 'visualizerSettingsDrawer.mirrorCount.label', type: 'slider', min: 10, max: 32, step: 1, card: 'layout', showIf: (cfg) => cfg.barStyle === 'mirror' },
        { id: 'barFillRatio', labelKey: 'customEffectDrawer.field.barFillRatio', type: 'sliderFloat', min: 0.3, max: 0.9, step: 0.05, decimals: 2, card: 'layout', showIf: (cfg) => cfg.barStyle === 'mirror' },
        { id: 'barCornerRadius', labelKey: 'customEffectDrawer.field.barCornerRadius', type: 'slider', min: 0, max: 15, step: 1, card: 'layout', showIf: (cfg) => cfg.barStyle === 'mirror' },
        { id: 'mirrorCenterGap', labelKey: 'customEffectDrawer.field.mirrorCenterGap', type: 'sliderFloat', min: 1, max: 6, step: 0.5, decimals: 1, card: 'layout', showIf: (cfg) => cfg.barStyle === 'mirror' }, // MỚI 25/09/2026 — thân bướm
        { id: 'cascadeKeyCount', labelKey: 'customEffectDrawer.field.cascadeKeyCount', type: 'slider', min: 16, max: 128, step: 4, card: 'layout', showIf: (cfg) => cfg.barStyle === 'cascade' },
        // Style "black hole" (CHUYỂN NHÓM 05/09/2026 — trước đây bucket 'black hole' riêng, dùng CHUNG
        // field 'maxH' ở trên, không khai riêng). radiusRatio + radiusEnergyMult là 1 cặp kích thước.
        { id: 'barWidth', labelKey: 'visualizerSettingsDrawer.barWidth.label', type: 'slider', min: 1, max: 15, step: 1, card: 'layout', showIf: (cfg) => cfg.barStyle === 'black hole' },
        { id: 'starCount', labelKey: 'customEffectDrawer.field.starCount', type: 'slider', min: 40, max: 400, step: 10, card: 'layout', showIf: (cfg) => cfg.barStyle === 'black hole', refresh: 'resizeCanvas' },
        { id: 'radiusRatio', labelKey: 'customEffectDrawer.field.radiusRatio', type: 'sliderFloat', min: 0.05, max: 0.3, step: 0.01, decimals: 2, card: 'layout', showIf: (cfg) => cfg.barStyle === 'black hole' },
        { id: 'radiusEnergyMult', labelKey: 'customEffectDrawer.field.radiusEnergyMult', type: 'sliderFloat', min: 0, max: 0.2, step: 0.01, decimals: 2, card: 'layout', showIf: (cfg) => cfg.barStyle === 'black hole' },
        // MỚI (25/09/2026, Giang) — style 'dot' (trục thời gian chuyển từ connector brain, core/visualizer/
        // groups/bar/dot.js). Quãng đường sóng KHÔNG còn field (theo audio, trục chỉ là mốc tối đa).
        // (25/09/2026, lượt 4) 'dna' xoắn quanh hình tĩnh nên vẫn hiện Shape.
        { id: 'dotShape', labelKey: 'customEffectDrawer.field.dotShape', type: 'select', card: 'layout', showIf: (cfg) => cfg.barStyle === 'dot' && (!cfg.dotMoving || cfg.dotMoveType === 'dna'), rerender: true, options: [
            { value: 'line', labelKey: 'customEffectDrawer.timelineShape.line' },
            { value: 'sinDown', labelKey: 'customEffectDrawer.timelineShape.sinDown' },
            { value: 'sinUp', labelKey: 'customEffectDrawer.timelineShape.sinUp' },
            { value: 'sinWave', labelKey: 'customEffectDrawer.timelineShape.sinWave' },
            { value: 'squareWave', labelKey: 'customEffectDrawer.timelineShape.squareWave' },
            { value: 'circle', labelKey: 'customEffectDrawer.timelineShape.circle' },
            { value: 'square', labelKey: 'customEffectDrawer.timelineShape.square' },
            { value: 'triangle', labelKey: 'customEffectDrawer.timelineShape.triangle' },
        ] },
        { id: 'dotCount', labelKey: 'customEffectDrawer.field.dotCount', type: 'slider', min: 20, max: 80, step: 2, card: 'layout', showIf: (cfg) => cfg.barStyle === 'dot' },
        // ── motion ──
        { id: 'suctionBase', labelKey: 'customEffectDrawer.field.suctionBase', type: 'sliderFloat', min: 0, max: 1, step: 0.05, decimals: 2, card: 'motion', showIf: (cfg) => cfg.barStyle === 'black hole' },
        { id: 'suctionEnergyMult', labelKey: 'customEffectDrawer.field.suctionEnergyMult', type: 'sliderFloat', min: 0, max: 5, step: 0.1, decimals: 1, card: 'motion', showIf: (cfg) => cfg.barStyle === 'black hole' },
        // (25/09/2026, lượt 2) dotMoving bật -> hình trục + rung đàn hồi không dùng (ẩn).
        { id: 'dotMoving', labelKey: 'customEffectDrawer.field.dotMoving', type: 'toggle', card: 'motion', showIf: (cfg) => cfg.barStyle === 'dot', rerender: true },
        { id: 'dotMoveType', labelKey: 'customEffectDrawer.field.dotMoveType', type: 'select', card: 'motion', showIf: (cfg) => cfg.barStyle === 'dot' && cfg.dotMoving, rerender: true, options: [
            { value: 'snake', labelKey: 'customEffectDrawer.dotMoveType.snake' },
            { value: 'dna', labelKey: 'customEffectDrawer.dotMoveType.dna' },
        ] },
        // ── reaction ──
        // MỚI (25/09/2026) — mirror: nâng treble trên 1kHz + làm mượt kề (Monstercat), core/visualizer/groups/bar/mirror.js
        { id: 'mirrorTilt', labelKey: 'customEffectDrawer.field.mirrorTilt', type: 'sliderFloat', min: 0, max: 6, step: 0.5, decimals: 1, card: 'reaction', showIf: (cfg) => cfg.barStyle === 'mirror' },
        { id: 'mirrorSmoothSpread', labelKey: 'customEffectDrawer.field.mirrorSmoothSpread', type: 'sliderFloat', min: 0, max: 0.9, step: 0.05, decimals: 2, card: 'reaction', showIf: (cfg) => cfg.barStyle === 'mirror' },
        { id: 'flareThreshold', labelKey: 'customEffectDrawer.field.flareThreshold', type: 'sliderFloat', min: 0, max: 1, step: 0.05, decimals: 2, card: 'reaction', showIf: (cfg) => cfg.barStyle === 'black hole' },
        { id: 'flashFadeSpeed', labelKey: 'customEffectDrawer.field.flashFadeSpeed', type: 'sliderFloat', min: 0.02, max: 0.2, step: 0.01, decimals: 2, card: 'reaction', showIf: (cfg) => cfg.barStyle === 'black hole' },
        // MỚI (25/09/2026, Giang) — độ phình (%) của dot tác động, chỉ kiểu 'radius' (kiểu 'height' đã có maxH).
        { id: 'dotSwell', labelKey: 'customEffectDrawer.field.dotSwell', type: 'slider', min: 50, max: 300, step: 10, card: 'reaction', showIf: (cfg) => cfg.barStyle === 'dot' && cfg.dotImpactMode !== 'height' },
        // (25/09/2026, lượt 2) bẻ góc 2 nhánh — chỉ kiểu 'height'
        { id: 'dotBend', labelKey: 'customEffectDrawer.field.dotBend', type: 'select', card: 'reaction', showIf: (cfg) => cfg.barStyle === 'dot' && cfg.dotImpactMode === 'height', rerender: true, options: [
            { value: 'none', labelKey: 'customEffectDrawer.dotBend.none' },
            { value: 'gt', labelKey: 'customEffectDrawer.dotBend.gt' },
            { value: 'lt', labelKey: 'customEffectDrawer.dotBend.lt' },
            { value: 'slash', labelKey: 'customEffectDrawer.dotBend.slash' },
            { value: 'backslash', labelKey: 'customEffectDrawer.dotBend.backslash' },
        ] },
        { id: 'dotBendAngle', labelKey: 'customEffectDrawer.field.dotBendAngle', type: 'slider', min: 10, max: 80, step: 5, card: 'reaction', showIf: (cfg) => cfg.barStyle === 'dot' && cfg.dotImpactMode === 'height' && cfg.dotBend && cfg.dotBend !== 'none' },
        { id: 'dotLineVibrate', labelKey: 'customEffectDrawer.field.dotLineVibrate', type: 'toggle', card: 'reaction', showIf: (cfg) => cfg.barStyle === 'dot' && !cfg.dotMoving && cfg.dotShape === 'line' },
    ],
    rain: [
        ...CUSTOM_EFFECT_FLASH_FIELDS, // card 'flash' — chung Glass + Street (Street trước đây KHÔNG có toggle riêng)
        // ── element ── (toggle hiện Thành phố đứng trước độ mờ của nó)
        { id: 'glassCityVisible', labelKey: 'visualizerSettingsDrawer.rainCityVisible.label', type: 'toggle', card: 'element', showIf: (cfg) => cfg.rainStyle === 'glass' },
        { id: 'glassCityOpacity', labelKey: 'visualizerSettingsDrawer.rainCityOpacity.label', type: 'slider', min: 0, max: 100, step: 5, card: 'element', showIf: (cfg) => cfg.rainStyle === 'glass' },
        { id: 'glassMoonVisible', labelKey: 'visualizerSettingsDrawer.rainMoonVisible.label', type: 'toggle', card: 'element', showIf: (cfg) => cfg.rainStyle === 'glass' },
        // ── layout ── (card Đèn tuỳ chỉnh của style street vẽ NGAY SAU card này)
        { id: 'glassDropDensity', labelKey: 'customEffectDrawer.field.glassDropDensity', type: 'slider', min: 40, max: 400, step: 10, card: 'layout', showIf: (cfg) => cfg.rainStyle === 'glass', refresh: 'resizeCanvas' },
        { id: 'streetDensity', labelKey: 'customEffectDrawer.field.streetDensity', type: 'slider', min: 40, max: 400, step: 10, card: 'layout', showIf: (cfg) => cfg.rainStyle === 'street', refresh: 'resizeCanvas' },
        { id: 'streetBuildingScale', labelKey: 'customEffectDrawer.field.streetBuildingScale', type: 'sliderFloat', min: 0.5, max: 3.0, step: 0.1, decimals: 1, card: 'layout', showIf: (cfg) => cfg.rainStyle === 'street', refresh: 'resizeCanvas' },
        // ── motion ──
        { id: 'glassStreakFrequency', labelKey: 'customEffectDrawer.field.glassStreakFrequency', type: 'slider', min: 0, max: 100, step: 5, card: 'motion', showIf: (cfg) => cfg.rainStyle === 'glass' },
    ],
    shape: [ // ĐỔI TÊN (05/09/2026) — trước đây khoá 'rubik', field không đổi.
        // SỬA (26/09/2026) — group có thêm style 'clock' -> field rubik gắn showIf theo style.
        { id: 'cubeSizeRatio', labelKey: 'customEffectDrawer.field.cubeSizeRatio', type: 'sliderFloat', min: 0.03, max: 0.15, step: 0.01, decimals: 2, card: 'layout', showIf: (cfg) => cfg.shapeStyle !== 'clock' },
        { id: 'layerTurnSpeed', labelKey: 'customEffectDrawer.field.layerTurnSpeed', type: 'sliderFloat', min: 0.02, max: 0.3, step: 0.01, decimals: 2, card: 'motion', showIf: (cfg) => cfg.shapeStyle !== 'clock' },
        { id: 'pitchSensitivity', labelKey: 'customEffectDrawer.field.pitchSensitivity', type: 'sliderFloat', min: 0, max: 2, step: 0.1, decimals: 1, card: 'reaction', showIf: (cfg) => cfg.shapeStyle !== 'clock' },
        { id: 'rotationEnergyThreshold', labelKey: 'customEffectDrawer.field.rotationEnergyThreshold', type: 'sliderFloat', min: 0, max: 1, step: 0.05, decimals: 2, card: 'reaction', showIf: (cfg) => cfg.shapeStyle !== 'clock' },
        // MỚI (26/09/2026, Giang) — style 'clock' (core/visualizer/groups/shape/clock.js).
        { id: 'clockHandsSource', labelKey: 'customEffectDrawer.field.clockHandsSource', type: 'select', card: 'element', showIf: (cfg) => cfg.shapeStyle === 'clock', options: [
            { value: 'realtime', labelKey: 'customEffectDrawer.clockHandsSource.realtime' },
            { value: 'track', labelKey: 'customEffectDrawer.clockHandsSource.track' },
            // MỚI (26/09/2026, lượt 2) — kim chạy theo nốt: bậc < 4 ngược, > 4 thuận, 4 = kẹt. Past ưu tiên lùi
            // nhanh, Future ưu tiên tiến nhanh (advanceClockPitchHands(), core/visualizer/groups/shape/clock.js).
            { value: 'past', labelKey: 'customEffectDrawer.clockHandsSource.past' },
            { value: 'future', labelKey: 'customEffectDrawer.clockHandsSource.future' },
        ] },
        // SỬA (26/09/2026, lượt 2, Giang) — bỏ toggle clockSecondTick (kim giây luôn chạy trơn); thêm toggle vỏ + con lắc.
        { id: 'clockCaseVisible', labelKey: 'customEffectDrawer.field.clockCaseVisible', type: 'toggle', card: 'element', showIf: (cfg) => cfg.shapeStyle === 'clock' },
        { id: 'clockTicksVisible', labelKey: 'customEffectDrawer.field.clockTicksVisible', type: 'toggle', card: 'element', rerender: true, showIf: (cfg) => cfg.shapeStyle === 'clock' }, // lượt 3 — ẩn vạch đo giờ
        { id: 'clockPendulum', labelKey: 'customEffectDrawer.field.clockPendulum', type: 'toggle', card: 'element', showIf: (cfg) => cfg.shapeStyle === 'clock' },
        { id: 'clockSizeRatio', labelKey: 'customEffectDrawer.field.clockSizeRatio', type: 'sliderFloat', min: 0.5, max: 0.95, step: 0.05, decimals: 2, card: 'layout', showIf: (cfg) => cfg.shapeStyle === 'clock' },
        { id: 'clockGearSpeedBase', labelKey: 'customEffectDrawer.field.clockGearSpeedBase', type: 'sliderFloat', min: 0, max: 2, step: 0.1, decimals: 1, card: 'motion', showIf: (cfg) => cfg.shapeStyle === 'clock' },
        { id: 'clockGearSpeedEnergyMult', labelKey: 'customEffectDrawer.field.clockGearSpeedEnergyMult', type: 'sliderFloat', min: 0, max: 6, step: 0.1, decimals: 1, card: 'motion', showIf: (cfg) => cfg.shapeStyle === 'clock' },
        { id: 'clockTickGain', labelKey: 'customEffectDrawer.field.clockTickGain', type: 'sliderFloat', min: 0.5, max: 2.5, step: 0.1, decimals: 1, card: 'reaction', showIf: (cfg) => cfg.shapeStyle === 'clock' && cfg.clockTicksVisible !== false },
    ],
    vortex: [
        // ── music ── SỬA (25/09/2026, rà soát) — toggle `rerender`, 2 tham số ẩn khi tắt Redirect.
        { id: 'redirectEnabled', labelKey: 'customEffectDrawer.field.redirectEnabled', type: 'toggle', card: 'music', rerender: true },
        { id: 'sectionWindowBeats', labelKey: 'customEffectDrawer.field.curveSectionWindowBeats', type: 'slider', min: 6, max: 32, step: 1, card: 'music', showIf: (cfg) => cfg.redirectEnabled !== false },
        { id: 'fluxThreshold', labelKey: 'customEffectDrawer.field.curveFluxThreshold', type: 'sliderFloat', min: 0.1, max: 1, step: 0.05, decimals: 2, card: 'music', showIf: (cfg) => cfg.redirectEnabled !== false },
        // ── layout ──
        // SỬA (25/09/2026, rà soát field dùng chung giữa style) — tunnelRingCount CHỈ style 'rings' đọc
        // (tGroupRings, core/webgl/three-vortex.js::initThreeJS()).
        { id: 'tunnelRingCount', labelKey: 'customEffectDrawer.field.tunnelRingCount', type: 'slider', min: 10, max: 100, step: 5, card: 'layout', showIf: (cfg) => cfg.vortexStyle === 'rings', refresh: 'initThreeJS' },
        { id: 'barsRingCount', labelKey: 'customEffectDrawer.field.barsRingCount', type: 'slider', min: 10, max: 80, step: 2, card: 'layout', showIf: (cfg) => cfg.vortexStyle === 'bars', refresh: 'initThreeJS' },
        { id: 'barsPerRing', labelKey: 'customEffectDrawer.field.barsPerRing', type: 'slider', min: 6, max: 48, step: 2, card: 'layout', showIf: (cfg) => cfg.vortexStyle === 'bars', refresh: 'initThreeJS' },
        { id: 'barsTwistFactor', labelKey: 'customEffectDrawer.field.barsTwistFactor', type: 'sliderFloat', min: 0, max: 6, step: 0.2, decimals: 1, card: 'layout', showIf: (cfg) => cfg.vortexStyle === 'bars' },
        { id: 'waveScaleBase', labelKey: 'customEffectDrawer.field.waveScaleBase', type: 'sliderFloat', min: 0.3, max: 1.5, step: 0.05, decimals: 2, card: 'layout', showIf: (cfg) => cfg.vortexStyle === 'wave' },
        { id: 'waveScaleEnergyMult', labelKey: 'customEffectDrawer.field.waveScaleEnergyMult', type: 'sliderFloat', min: 0, max: 1, step: 0.05, decimals: 2, card: 'layout', showIf: (cfg) => cfg.vortexStyle === 'wave' },
        // ── motion ──
        { id: 'warpSpeedBase', labelKey: 'customEffectDrawer.field.warpSpeedBase', type: 'slider', min: 0, max: 50, step: 1, card: 'motion' },
        { id: 'warpSpeedEnergyMult', labelKey: 'customEffectDrawer.field.warpSpeedEnergyMult', type: 'slider', min: 0, max: 100, step: 5, card: 'motion' },
        { id: 'waveRotationBase', labelKey: 'customEffectDrawer.field.waveRotationBase', type: 'sliderFloat', min: 0, max: 0.1, step: 0.005, decimals: 3, card: 'motion', showIf: (cfg) => cfg.vortexStyle === 'wave' },
        { id: 'waveRotationEnergyMult', labelKey: 'customEffectDrawer.field.waveRotationEnergyMult', type: 'sliderFloat', min: 0, max: 0.3, step: 0.01, decimals: 2, card: 'motion', showIf: (cfg) => cfg.vortexStyle === 'wave' },
    ],
    lighting: [
        // ── music ── (style "fireworks") — tham số THẬT của detectMusicTransition() (core/audio-analysis.js),
        // quyết định finale (event/workflow/visualizer-render.js::_fwUpdateFinaleTrigger()); style "thunder"
        // không dùng. Card "Chữ bắn pháo hoa" (chỉ bắn trong finale) vẽ NGAY SAU card này.
        // SỬA (25/09/2026, rà soát) — toggle `rerender`, 2 tham số ẩn khi tắt Finale.
        { id: 'finaleEnabled', labelKey: 'customEffectDrawer.field.finaleEnabled', type: 'toggle', card: 'music', showIf: (cfg) => cfg.lightingStyle === 'fireworks', rerender: true },
        { id: 'sectionWindowBeats', labelKey: 'customEffectDrawer.field.musicSectionWindowBeats', type: 'slider', min: 6, max: 32, step: 1, card: 'music', showIf: (cfg) => cfg.lightingStyle === 'fireworks' && cfg.finaleEnabled !== false },
        { id: 'fluxThreshold', labelKey: 'customEffectDrawer.field.musicFluxThreshold', type: 'sliderFloat', min: 0.1, max: 1, step: 0.05, decimals: 2, card: 'music', showIf: (cfg) => cfg.lightingStyle === 'fireworks' && cfg.finaleEnabled !== false },
        ...CUSTOM_EFFECT_FLASH_FIELDS, // card 'flash' — chung Thunder + Fireworks
        // ── layout ── (card "Kiểu nổ" của fireworks vẽ NGAY SAU card này)
        { id: 'maxBoltCount', labelKey: 'customEffectDrawer.field.maxBoltCount', type: 'slider', min: 1, max: 10, step: 1, card: 'layout', showIf: (cfg) => cfg.lightingStyle === 'thunder' },
        { id: 'boltSegmentLength', labelKey: 'customEffectDrawer.field.boltSegmentLength', type: 'slider', min: 10, max: 150, step: 10, card: 'layout', showIf: (cfg) => cfg.lightingStyle === 'thunder' },
        { id: 'boltHorizontalDeviation', labelKey: 'customEffectDrawer.field.boltHorizontalDeviation', type: 'slider', min: 20, max: 300, step: 10, card: 'layout', showIf: (cfg) => cfg.lightingStyle === 'thunder' },
        { id: 'particleCount', labelKey: 'customEffectDrawer.field.fwParticleCount', type: 'slider', min: 40, max: 350, step: 10, card: 'layout', showIf: (cfg) => cfg.lightingStyle === 'fireworks' },
        { id: 'maxConcurrentRockets', labelKey: 'customEffectDrawer.field.fwMaxConcurrentRockets', type: 'slider', min: 3, max: 30, step: 1, card: 'layout', showIf: (cfg) => cfg.lightingStyle === 'fireworks' },
        // ── motion ──
        { id: 'boltFadeSpeed', labelKey: 'customEffectDrawer.field.boltFadeSpeed', type: 'sliderFloat', min: 0.01, max: 0.15, step: 0.01, decimals: 2, card: 'motion', showIf: (cfg) => cfg.lightingStyle === 'thunder' },
        { id: 'burstPower', labelKey: 'customEffectDrawer.field.fwBurstPower', type: 'sliderFloat', min: 0.5, max: 2.0, step: 0.1, decimals: 1, card: 'motion', showIf: (cfg) => cfg.lightingStyle === 'fireworks' },
        { id: 'gravity', labelKey: 'customEffectDrawer.field.fwGravity', type: 'sliderFloat', min: 0.02, max: 0.12, step: 0.01, decimals: 2, card: 'motion', showIf: (cfg) => cfg.lightingStyle === 'fireworks' },
        // ── reaction ──
        { id: 'boltThreshold', labelKey: 'customEffectDrawer.field.boltThreshold', type: 'sliderFloat', min: 0, max: 1, step: 0.05, decimals: 2, card: 'reaction', showIf: (cfg) => cfg.lightingStyle === 'thunder' },
        { id: 'boltSpawnChance', labelKey: 'customEffectDrawer.field.boltSpawnChance', type: 'sliderFloat', min: 0, max: 1, step: 0.05, decimals: 2, card: 'reaction', showIf: (cfg) => cfg.lightingStyle === 'thunder' },
        { id: 'autoLaunchDensity', labelKey: 'customEffectDrawer.field.fwAutoLaunchDensity', type: 'slider', min: 5, max: 100, step: 5, card: 'reaction', showIf: (cfg) => cfg.lightingStyle === 'fireworks' },
    ],
    connector: [
        // ── music ── (circuit = camera shift, brain = burst). 2 tham số dùng CHUNG, hiện khi toggle của
        // style đang chọn bật. SỬA (25/09/2026, rà soát) — cameraShiftEnabled trước đây THIẾU `rerender`
        // (bật/tắt không hiện/ẩn 2 tham số ngay) + nằm lẻ ngoài card music.
        { id: 'cameraShiftEnabled', labelKey: 'customEffectDrawer.field.connectorCameraShiftEnabled', type: 'toggle', card: 'music', showIf: (cfg) => cfg.connectorStyle === 'circuit', rerender: true },
        { id: 'burstEnabled', labelKey: 'customEffectDrawer.field.brainBurstEnabled', type: 'toggle', card: 'music', showIf: (cfg) => cfg.connectorStyle === 'brain', rerender: true },
        { id: 'sectionWindowBeats', labelKey: 'customEffectDrawer.field.musicSectionWindowBeats', type: 'slider', min: 6, max: 32, step: 1, card: 'music', showIf: (cfg) => (cfg.connectorStyle === 'circuit' && cfg.cameraShiftEnabled) || (cfg.connectorStyle === 'brain' && cfg.burstEnabled) },
        { id: 'fluxThreshold', labelKey: 'customEffectDrawer.field.musicFluxThreshold', type: 'sliderFloat', min: 0.1, max: 1, step: 0.05, decimals: 2, card: 'music', showIf: (cfg) => (cfg.connectorStyle === 'circuit' && cfg.cameraShiftEnabled) || (cfg.connectorStyle === 'brain' && cfg.burstEnabled) },
        // ── glow ── glow sprite (mọi style; brain nhân vào mọi shadowBlur) + bloom (circuit).
        // SỬA (25/09/2026, rà soát) — toggle `rerender`, cường độ ẩn khi tắt (cùng khuôn khối Blur chung).
        { id: 'glowEnabled', labelKey: 'customEffectDrawer.field.connectorGlowEnabled', type: 'toggle', card: 'glow', rerender: true },
        { id: 'glowIntensity', labelKey: 'customEffectDrawer.field.connectorGlowIntensity', type: 'slider', min: 0, max: 100, step: 5, card: 'glow', showIf: (cfg) => cfg.glowEnabled !== false },
        { id: 'bloomStrengthBase', labelKey: 'customEffectDrawer.field.bloomStrengthBase', type: 'sliderFloat', min: 0, max: 4, step: 0.1, decimals: 1, card: 'glow', showIf: (cfg) => cfg.connectorStyle === 'circuit' },
        { id: 'bloomStrengthEnergyMult', labelKey: 'customEffectDrawer.field.bloomStrengthEnergyMult', type: 'sliderFloat', min: 0, max: 4, step: 0.1, decimals: 1, card: 'glow', showIf: (cfg) => cfg.connectorStyle === 'circuit' },
        // ── element ── (brain: bật/tắt từng thành phần, brain.js::_applySettings())
        { id: 'brainShowNodes', labelKey: 'customEffectDrawer.field.brainShowNodes', type: 'toggle', card: 'element', showIf: (cfg) => cfg.connectorStyle === 'brain' },
        { id: 'brainShowOrbit', labelKey: 'customEffectDrawer.field.brainShowOrbit', type: 'toggle', card: 'element', showIf: (cfg) => cfg.connectorStyle === 'brain' },
        { id: 'brainShowStrings', labelKey: 'customEffectDrawer.field.brainShowStrings', type: 'toggle', card: 'element', showIf: (cfg) => cfg.connectorStyle === 'brain' },
        { id: 'brainOrbitTrail', labelKey: 'customEffectDrawer.field.brainOrbitTrail', type: 'slider', min: 0, max: 12, step: 1, card: 'element', showIf: (cfg) => cfg.connectorStyle === 'brain' },
        { id: 'trailLength', labelKey: 'customEffectDrawer.field.trailLength', type: 'slider', min: 5, max: 60, step: 5, card: 'element', showIf: (cfg) => cfg.connectorStyle === 'circuit' },
        // ── layout ──
        // SỬA (yêu cầu Giang 16/09/2026, layout lưới phẳng) — neuronCount max 48->64, min/step 16/4.
        { id: 'neuronCount', labelKey: 'customEffectDrawer.field.neuronCount', type: 'slider', min: 16, max: 64, step: 4, card: 'layout', showIf: (cfg) => cfg.connectorStyle === 'synapse', refresh: 'initThreeJSConnector' },
        // ĐỔI (circuit lưới lập phương, buildCircuitCubeCells()): 16-64/4, khớp neuronCount synapse.
        { id: 'nodeCount', labelKey: 'customEffectDrawer.field.nodeCount', type: 'slider', min: 16, max: 64, step: 4, card: 'layout', showIf: (cfg) => cfg.connectorStyle === 'circuit', refresh: 'initThreeJSConnector' },
        { id: 'maxConcurrentSignals', labelKey: 'customEffectDrawer.field.maxConcurrentSignals', type: 'slider', min: 20, max: 90, step: 5, card: 'layout', showIf: (cfg) => cfg.connectorStyle === 'circuit' },
        // MỚI (23/09/2026, Giang) — style 'brain', type 'select'. brain.js tự dựng lại layout khi giá trị đổi
        // (so với lần vẽ trước) nên không cần `refresh`.
        { id: 'brainDirection', labelKey: 'customEffectDrawer.field.brainDirection', type: 'select', card: 'layout', showIf: (cfg) => cfg.connectorStyle === 'brain', options: [
            { value: 'ltr', labelKey: 'customEffectDrawer.brainDirection.ltr' },
            { value: 'rtl', labelKey: 'customEffectDrawer.brainDirection.rtl' },
            { value: 'ttb', labelKey: 'customEffectDrawer.brainDirection.ttb' },
            { value: 'btt', labelKey: 'customEffectDrawer.brainDirection.btt' },
        ] },
        { id: 'brainSignalCount', labelKey: 'customEffectDrawer.field.brainSignalCount', type: 'slider', min: 40, max: 200, step: 10, card: 'layout', showIf: (cfg) => cfg.connectorStyle === 'brain' },
        { id: 'brainOrbitDotCount', labelKey: 'customEffectDrawer.field.brainOrbitDotCount', type: 'slider', min: 1, max: 16, step: 1, card: 'layout', showIf: (cfg) => cfg.connectorStyle === 'brain' },
        // (23/09/2026) khoảng cách dot trong đoàn theo hoạ âm của nốt — min (hoạ âm yếu) / max (hoạ âm mạnh), % độ dài dây
        { id: 'brainStringDotGapMin', labelKey: 'customEffectDrawer.field.brainStringDotGapMin', type: 'sliderFloat', min: 0.5, max: 10, step: 0.5, decimals: 1, card: 'layout', showIf: (cfg) => cfg.connectorStyle === 'brain' },
        { id: 'brainStringDotGapMax', labelKey: 'customEffectDrawer.field.brainStringDotGapMax', type: 'sliderFloat', min: 2, max: 20, step: 0.5, decimals: 1, card: 'layout', showIf: (cfg) => cfg.connectorStyle === 'brain' },
        { id: 'brainStringDotGapLive', labelKey: 'customEffectDrawer.field.brainStringDotGapLive', type: 'toggle', card: 'layout', showIf: (cfg) => cfg.connectorStyle === 'brain' },
        // ── motion ──
        { id: 'synapseSpeedBase', labelKey: 'customEffectDrawer.field.synapseSpeedBase', type: 'slider', min: 20, max: 200, step: 5, card: 'motion', showIf: (cfg) => cfg.connectorStyle === 'synapse' },
        { id: 'synapseSpeedEnergyMult', labelKey: 'customEffectDrawer.field.synapseSpeedEnergyMult', type: 'slider', min: 0, max: 150, step: 5, card: 'motion', showIf: (cfg) => cfg.connectorStyle === 'synapse' },
        { id: 'circuitSpeedBase', labelKey: 'customEffectDrawer.field.circuitSpeedBase', type: 'slider', min: 20, max: 200, step: 5, card: 'motion', showIf: (cfg) => cfg.connectorStyle === 'circuit' },
        { id: 'circuitSpeedEnergyMult', labelKey: 'customEffectDrawer.field.circuitSpeedEnergyMult', type: 'slider', min: 0, max: 150, step: 5, card: 'motion', showIf: (cfg) => cfg.connectorStyle === 'circuit' },
        { id: 'brainInputSpeed', labelKey: 'customEffectDrawer.field.brainInputSpeed', type: 'sliderFloat', min: 0.5, max: 3, step: 0.1, decimals: 1, card: 'motion', showIf: (cfg) => cfg.connectorStyle === 'brain' },
        { id: 'brainOrbitBeatsPerLap', labelKey: 'customEffectDrawer.field.brainOrbitBeatsPerLap', type: 'slider', min: 2, max: 32, step: 1, card: 'motion', showIf: (cfg) => cfg.connectorStyle === 'brain' },
        { id: 'brainStringDotBeats', labelKey: 'customEffectDrawer.field.brainStringDotBeats', type: 'slider', min: 1, max: 8, step: 1, card: 'motion', showIf: (cfg) => cfg.connectorStyle === 'brain' },
        // ── reaction ──
        // fireThreshold/lateralInhibitStrength — cả 3 style (circuit dùng CHUNG logic bắn với synapse; brain:
        // ngưỡng nhiễu flux của node trong ellipse / dải loé đè 2 dải kề). lateralInhibitStrength (17/09/2026,
        // applyLateralInhibition(), core/visualizer/groups/connector/synapse.js): ngưỡng bắn bị ĐÈ LÊN (byte
        // 0-255) ở nơ-ron LÂN CẬN mỗi khi 1 nơ-ron vừa bắn — 0 = tắt, càng cao càng thưa.
        { id: 'fireThreshold', labelKey: 'customEffectDrawer.field.fireThreshold', type: 'sliderFloat', min: 0, max: 1, step: 0.05, decimals: 2, card: 'reaction' },
        { id: 'lateralInhibitStrength', labelKey: 'customEffectDrawer.field.lateralInhibitStrength', type: 'slider', min: 0, max: 150, step: 10, card: 'reaction' },
        { id: 'brainFilterStrictness', labelKey: 'customEffectDrawer.field.brainFilterStrictness', type: 'sliderFloat', min: 0.8, max: 1, step: 0.01, decimals: 2, card: 'reaction', showIf: (cfg) => cfg.connectorStyle === 'brain' },
        { id: 'brainPumpSqueeze', labelKey: 'customEffectDrawer.field.brainPumpSqueeze', type: 'slider', min: 0, max: 50, step: 2, card: 'reaction', showIf: (cfg) => cfg.connectorStyle === 'brain' },
        { id: 'brainPumpSensitivity', labelKey: 'customEffectDrawer.field.brainPumpSensitivity', type: 'sliderFloat', min: 1, max: 10, step: 0.5, decimals: 1, card: 'reaction', showIf: (cfg) => cfg.connectorStyle === 'brain' },
        { id: 'brainNodeFlashSensitivity', labelKey: 'customEffectDrawer.field.brainNodeFlashSensitivity', type: 'sliderFloat', min: 1, max: 10, step: 0.5, decimals: 1, card: 'reaction', showIf: (cfg) => cfg.connectorStyle === 'brain' },
        { id: 'brainStringAmplitude', labelKey: 'customEffectDrawer.field.brainStringAmplitude', type: 'slider', min: 0, max: 200, step: 10, card: 'reaction', showIf: (cfg) => cfg.connectorStyle === 'brain' },
        { id: 'brainStringDecayMs', labelKey: 'customEffectDrawer.field.brainStringDecayMs', type: 'slider', min: 100, max: 1000, step: 20, card: 'reaction', showIf: (cfg) => cfg.connectorStyle === 'brain' },
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
    shape: [...CUSTOM_EFFECT_COLOR_FIELDS, ...CUSTOM_EFFECT_BLUR_FIELDS], // MỚI 26/09/2026 — rubik/clock mỗi style giữ màu riêng; blur (lượt 2) chỉ clock đọc
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
