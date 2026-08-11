/**
 * service/state/audio-engine.js — Package STATE domain "audio-engine": Web Audio API context/
 * node/pitch-worker + hằng số EQ/FFT dùng chung. Xem cơ chế package ở service/state.js.
 * PHẢI nạp SAU service/state.js.
 */
        AppState.definePackage('audio-engine', {
            schema: {
                audioContext: 'any',           // AudioContext | undefined trước setupAudioContext()
                analyser: 'any',               // AnalyserNode | undefined
                analyserPitch: 'any',          // AnalyserNode | undefined
                animationId: 'any',            // number (requestAnimationFrame id) | undefined
                masterGainNode: 'any',         // GainNode | undefined
                eqBandNodes: 'array',
                eqPresets: 'array',
                isSeeking: 'boolean',
                currentObjectURL: 'nullable-string',
                currentCoverObjectURL: 'nullable-string',
                pitchWorker: 'any',            // Worker | null
                pitchWorkerBusy: 'boolean',
                latestPitchFrequency: 'number',
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
                    eqBandNodes: [],
                    eqPresets: [],
                    isSeeking: false,
                    currentObjectURL: null,
                    currentCoverObjectURL: null,
                    pitchWorker: null,
                    pitchWorkerBusy: false,
                    latestPitchFrequency: -1,
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
