/**
 * service/state/visualizer-runtime.js — Package STATE domain "visualizer-runtime": hot path
 * 60fps của vòng lặp vẽ visualizer + currentModeIndex (KHÔNG chứa vizConfig — vizConfig giờ
 * thuộc AppConfig, xem service/state.js + core/config.js). Xem cơ chế package ở service/state.js.
 * PHẢI nạp SAU service/state.js.
 */
        AppState.definePackage('visualizer-runtime', {
            schema: {
                currentModeIndex: 'number',
                smoothedEnergy: 'number',
                globalHueOffset: 'number',
                beatScale: 'number',
                vizDataArray: 'any',             // Uint8Array | undefined trước khi audio context init
                pitchTimeDomainArray: 'any',      // Uint8Array | undefined
                previousSpectrumArray: 'any',     // Float32Array | undefined
                beatTimes: 'array',
                fluxHistory: 'array',
                frameCounter: 'number',
                dpr: 'number',
            },
            buildDefaults() {
                return {
                    currentModeIndex: 0,
                    smoothedEnergy: 0,
                    globalHueOffset: 0,
                    beatScale: 0,
                    vizDataArray: undefined,
                    pitchTimeDomainArray: undefined,
                    previousSpectrumArray: undefined,
                    beatTimes: [],
                    fluxHistory: [],
                    frameCounter: 0,
                    dpr: 1,
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
        // "Space" đổi tên style thành "galaxy explore" (group vẫn tên "space").
        //
        // STYLE_TO_GROUP: style -> group chứa nó (dùng để suy ra cfg.type = group khi cycle/chọn
        // style, xem updateTypeUI()/applyVisualizerStyleChoice()).
        // GROUP_STYLE_FIELD: group -> tên field lưu style con hiện tại trong customEffect[group]
        // (khớp CUSTOM_EFFECT_STYLE, core/custom-effect.js) — MỌI group đều có field này, kể cả
        // group chỉ 1 style (shape/space), để cơ chế chung nhất quán, không cần rẽ nhánh riêng.
        // EFFECT_GROUPS: group -> danh sách style con thuộc group đó, ĐÚNG THỨ TỰ hiện trong
        // dropdown 2 của modal chọn effect (xem core/visualizer/visualizer-display.js::
        // openEffectPickerModal()) — nguồn CHÂN LÝ DUY NHẤT cho việc "style nào thuộc group nào",
        // STYLE_TO_GROUP suy ra TỰ ĐỘNG từ bảng này (KHÔNG khai riêng, tránh lệch 2 bảng).
        const EFFECT_GROUPS = {
            bar: ['mirror', 'cascade', 'black hole'],
            lighting: ['thunder', 'fireworks'],
            rain: ['glass', 'street'],
            vortex: ['rings', 'bars', 'wave'],
            shape: ['rubik'],
            space: ['galaxy explore'],
        };
        const GROUP_STYLE_FIELD = {
            bar: 'barStyle', lighting: 'lightingStyle', rain: 'rainStyle',
            vortex: 'vortexStyle', shape: 'shapeStyle', space: 'spaceStyle',
        };
        const STYLE_TO_GROUP = {};
        Object.keys(EFFECT_GROUPS).forEach((group) => {
            EFFECT_GROUPS[group].forEach((style) => { STYLE_TO_GROUP[style] = group; });
        });
        const MODES = Object.values(EFFECT_GROUPS).flat();
