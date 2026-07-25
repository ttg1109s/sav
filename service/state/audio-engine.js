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
        const EQ_PRESETS = Object.freeze({
            flat: Object.freeze([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), bass_boost: Object.freeze([6, 5, 4, 1, 0, 0, 0, 0, 0, 0]), pop: Object.freeze([-2, -1, 0, 2, 4, 4, 2, 0, -1, -2]),
            rock: Object.freeze([5, 4, 3, 1, -1, -1, 1, 2, 3, 4]), acoustic: Object.freeze([2, 1, 0, 0, 1, 2, 3, 4, 3, 2]), electronic: Object.freeze([5, 4, 1, -1, -2, 0, 1, 3, 4, 5]),
            manual: Object.freeze([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        });
