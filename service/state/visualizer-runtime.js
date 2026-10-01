/**
 * service/state/visualizer-runtime.js — Package STATE domain "visualizer-runtime": hot path
 * 60fps của vòng lặp vẽ visualizer + currentModeIndex (KHÔNG chứa vizConfig — vizConfig giờ
 * thuộc AppConfig, xem service/state.js + core/config.js). Xem cơ chế package ở service/state.js.
 * PHẢI nạp SAU service/state.js.
 */
        AppState.definePackage('visualizer-runtime', {
            schema: {
                currentModeIndex: 'number',
                dpr: 'number',
                frameEffectConfig: 'any', // MỚI (28/09/2026, Phase 2) — config effect đang chạy, resolve 1 lần ĐẦU mỗi frame VẼ (workflowVisualizerRender._tickDraw()), null ngoài frame vẽ — getComputedColor()/getActiveBlurMult() đọc lại thay vì tự getActiveEffectConfig() mỗi lời gọi.
            },
            buildDefaults() {
                return {
                    currentModeIndex: 0,
                    dpr: 1,
                    frameEffectConfig: null,
                };
            },
        });

        // [SỬA — 05/09/2026, yêu cầu Giang, "group hoá" effect picker] MODES TRƯỚC ĐÂY là 7 khoá
        // GROUP/type phẳng (bar/lighting/rubik/vortex/'black hole'/rain/space) — nút cycle
        // (#btn-cycle-mode, click) xoay qua ĐÚNG 7 khoá đó, sub-style con (mirror/cascade,
        // thunder/fireworks...) CHỈ chọn được qua dropdown riêng trong Custom Effect Drawer (giữ
        // 1.5s). GIỜ: MODES là danh sách PHẲNG 12 STYLE CON (không phải group) — cycle (click) xoay
        // qua ĐÚNG 12 style này, nhãn icon hiện tên STYLE (không phải group, xem
        // core/visualizer/visualizer-display.js::updateTypeUI()). "Black Hole" CHUYỂN từ type
        // riêng thành 1 style của group "bar"; "Rubik" CHUYỂN thành 1 style của group "shape" (MỚI,
        // thay tên group "rubik" cũ — group vẫn chỉ 1 style, đặt tên chung để dễ mở rộng sau);
        // [XOÁ — 15/09/2026, yêu cầu Giang, "dọn sạch visualizer effect space"] Group "space"
        // (Galaxy Journey, style "galaxy explore") đã BỎ HẲN khỏi EFFECT_GROUPS/GROUP_STYLE_FIELD
        // bên dưới — MODES (12 style phẳng cũ) còn lại 11.
        //
        // STYLE_TO_GROUP: style -> group chứa nó (dùng để suy ra cfg.type = group khi cycle/chọn
        // style, xem updateTypeUI()/applyVisualizerStyleChoice()).
        // GROUP_STYLE_FIELD: group -> tên field lưu style con hiện tại trong customEffect[group]
        // (khớp CUSTOM_EFFECT_STYLE, core/custom-effect.js) — MỌI group đều có field này, kể cả
        // group chỉ 1 style (shape), để cơ chế chung nhất quán, không cần rẽ nhánh riêng.
        // EFFECT_GROUPS: group -> danh sách style con thuộc group đó, ĐÚNG THỨ TỰ hiện trong
        // dropdown 2 của modal chọn effect (xem core/visualizer/visualizer-display.js::
        // openEffectPickerModal()) — nguồn CHÂN LÝ DUY NHẤT cho việc "style nào thuộc group nào",
        // STYLE_TO_GROUP suy ra TỰ ĐỘNG từ bảng này (KHÔNG khai riêng, tránh lệch 2 bảng).
        const EFFECT_GROUPS = {
            bar: ['mirror', 'cascade', 'black hole', 'dot'], // 'dot' MỚI 25/09/2026 — trục thời gian chuyển từ connector brain
            lighting: ['thunder', 'fireworks'],
            rain: ['glass', 'street'],
            vortex: ['rings', 'bars', 'wave'],
            shape: ['rubik', 'clock'], // 'clock' MỚI 26/09/2026 — đồng hồ lộ máy (groups/shape/clock.js)
            connector: ['synapse', 'circuit'], // 'brain' ĐÃ XOÁ 01/10/2026 (Giang) — lựa chọn cũ rơi về 'synapse' (core/config.js)
        };
        const GROUP_STYLE_FIELD = {
            bar: 'barStyle', lighting: 'lightingStyle', rain: 'rainStyle',
            vortex: 'vortexStyle', shape: 'shapeStyle', connector: 'connectorStyle',
        };
        const STYLE_TO_GROUP = {};
        Object.keys(EFFECT_GROUPS).forEach((group) => {
            EFFECT_GROUPS[group].forEach((style) => { STYLE_TO_GROUP[style] = group; });
        });
        const MODES = Object.values(EFFECT_GROUPS).flat();

        // (FFT_HIGH_RES_GROUPS / FFT_HIGH_RES_STYLES / needsHighResFft() — ĐÃ XOÁ 01/10/2026: mỗi group tự khai báo cỡ phổ
        // cạnh code của nó (`spectrumSize(style)` trong event/workflow/visualizer/*.js), host xin qua audioAnalysis.)
