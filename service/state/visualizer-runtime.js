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
                // MỚI (29/08/2026, phản hồi Giang — "React Beat Audio" của Slideshow) — bộ đếm BEAT
                // RỜI RẠC, tăng dần MỖI LẦN có 1 beat được phát hiện (updateStatsDashboard(), core/
                // audio-analysis.js — CÙNG điều kiện đã dùng để đẩy vào `beatTimes`). `beatScale`
                // (field ngay trên) là NĂNG LƯỢNG LIÊN TỤC mỗi khung hình, không phải "đã có 1 beat
                // hay chưa" — mọi nơi cần biết "N beat đã trôi qua kể từ lần trước tôi xem" (như
                // event/workflow/motion-engine.js — pulse zoom/pan/rotate "mỗi N beat") chỉ cần lưu lại
                // `beatCount` LÚC TRƯỚC rồi so `beatCount - lastSeen >= N`, KHÔNG cần tự dò
                // ngưỡng flux riêng — dùng CHUNG đúng 1 nơi phát hiện beat DUY NHẤT của toàn app.
                beatCount: 'number',
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
                    beatCount: 0,
                    fluxHistory: [],
                    frameCounter: 0,
                    dpr: 1,
                };
            },
        });

        // 'space' — visual "Galaxy Journey", không có kiểu con, tinh chỉnh là hằng số cố định
        // trong event/workflow/visualizer-render.js. 'lighting' — gộp 2 style con qua
        // customEffect.lighting.lightingStyle: 'thunder' (tia sét, trước là type riêng
        // 'lightning') và 'fireworks' (pháo hoa).
        const MODES = ['bar', 'lighting', 'rubik', 'vortex', 'black hole', 'rain', 'space'];
