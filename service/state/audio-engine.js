/**
 * service/state/audio-engine.js — Package STATE domain "audio-engine": Web Audio API context/
 * node/pitch-worker + hằng số EQ/FFT dùng chung. Xem cơ chế package ở service/state.js.
 * PHẢI nạp SAU service/state.js.
 */
        AppState.definePackage('audio-engine', {
            schema: {
                audioContext: 'any',           // AudioContext | undefined trước workflowAudioEngine.setup() (event/workflow/audio-engine.js)
                analyser: 'any',               // AnalyserNode | undefined — phổ VẼ, fftSize đổi theo effect
                analyserPitch: 'any',          // AnalyserNode | undefined — phân tích CHUNG (FFT cố định 2048): phổ cho beat/energy/flux/BPM (01/10/2026) + time-domain cho pitch
                animationId: 'any',            // number (requestAnimationFrame id) | undefined
                masterGainNode: 'any',         // GainNode | undefined — cổng seek (1 bình thường, 0 khi cổng giữ), đứng TRƯỚC 2 analyser
                volumeGainNode: 'any',         // GainNode | undefined — MỚI 01/10/2026: âm lượng người dùng, CHỈ nhánh ra loa
                eqBandNodes: 'array',
                eqPresets: 'array',
                isSeeking: 'boolean',
                currentObjectURL: 'nullable-string',
                currentCoverObjectURL: 'nullable-string',
                pitchWorker: 'any',            // Worker | null
                pitchWorkerBusy: 'boolean',
                latestPitchFrequency: 'number',
                latestPitchConfidence: 'number', // MỚI 01/10/2026 — 0-1, 1 - giá trị YIN (core/workers/pitch-worker.js)
                lastValidNoteStr: 'nullable-string',
                lastValidNoteTime: 'number',
                lastValidMidiNote: 'nullable-number',
            },
            buildDefaults() {
                return {
                    audioContext: undefined,
                    analyser: undefined,
                    analyserPitch: undefined,
                    animationId: undefined,
                    masterGainNode: undefined,
                    volumeGainNode: undefined,
                    eqBandNodes: [],
                    eqPresets: [],
                    isSeeking: false,
                    currentObjectURL: null,
                    currentCoverObjectURL: null,
                    pitchWorker: null,
                    pitchWorkerBusy: false,
                    latestPitchFrequency: -1,
                    latestPitchConfidence: 0,
                    lastValidNoteStr: null,
                    lastValidNoteTime: 0,
                    lastValidMidiNote: null,
                };
            },
        });

        const APP_CONFIG = Object.freeze({ fftSizeStandard: 256, fftSizeHighRes: 2048, fftSizePitch: 2048, bpmMinWaitTime: 250 });
        const EQ_FREQS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
        const EQ_LABELS = ['32', '64', '125', '250', '500', '1K', '2K', '4K', '8K', '16K'];
        // EQ_PRESETS (bảng tĩnh cũ) ĐÃ XOÁ — THAY bằng preset lưu DB, xem core/eq-presets.js::
        // buildDefaultEqPresets() (seed lần đầu) + event/workflow/eq-presets.js (CRUD/áp dụng).
