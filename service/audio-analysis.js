/**
 * service/audio-analysis.js — KHO DỮ LIỆU PHÂN TÍCH AUDIO (class `AudioAnalysisStore`, instance toàn cục `audioAnalysis`).
 *
 * [MỚI — 01/10/2026, Giang chốt] Thay MỌI key audio trong appState (beatScale, smoothedEnergy, globalHueOffset,
 * fluxHistory, lastBeatTime, currentCalculatedBpm, lastValid*, latestPitch*, rubikPitch*, frameCounter, vizDataArray,
 * analysisSpectrumArray, previousSpectrumArray, pitchTimeDomainArray, audioFeatures, analyser). Đây là 1 NGOẠI LỆ CÓ CHỦ
 * ĐÍCH của luật "mọi đọc/ghi qua appState" (service/state.js) — cùng loại với AppConfig: kho riêng, API riêng.
 *
 * QUYỀN:
 *   - ĐỌC: mọi Workflow (effect, Game, React Beat, VBG, status bar...) qua các method công khai bên dưới. Giá trị trả về là
 *     dữ liệu CHỈ ĐỌC (mảng/typed array trả THAM CHIẾU để không cấp phát mỗi frame — không được sửa).
 *   - GHI: CHỈ event/workflow/audio-analysis.js (method `_` — quy ước, JS không chặn cứng).
 *   - Core KHÔNG gọi store này (Rule 2, như appState): Workflow đọc rồi truyền tham số.
 *
 * THỜI GIAN: mọi mốc thời gian trong store theo performance.now(). Nơi đọc nên dùng các hàm "msSince...()/is...Fresh()"
 * thay vì tự trừ — không bao giờ lẫn Date.now().
 *
 * PHỔ ĐỂ VẼ — xin theo tham số cỡ FFT (Giang: "phổ dùng tham số truyền vào, không cố định"):
 *   requireSpectrum(fftSize) khi effect bật -> spectrum(fftSize) mỗi frame -> releaseSpectrum(fftSize) khi tắt.
 *   Mỗi cỡ đang được xin có 1 AnalyserNode riêng (tạo lười, nối sau EQ trước âm lượng — xem _attachGraph()); cỡ 2048 dùng
 *   CHUNG analyser phân tích. Task phân tích đọc phổ cho đúng các cỡ đang được xin mỗi frame.
 *
 * NẠP: không phụ thuộc gì lúc nạp; đặt cạnh các service/state/*.js trong index.html.
 */

/** Cỡ FFT hợp lệ của AnalyserNode (Web Audio spec). */
const AUDIO_ANALYSIS_FFT_SIZES = Object.freeze([32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768]);
/** Thứ tự 6 dải tần (khớp core/audio-analysis.js::AUDIO_FEATURE_BANDS). */
const AUDIO_ANALYSIS_BAND_INDEX = Object.freeze({ sub: 0, bass: 1, lowMid: 2, mid: 3, highMid: 4, treble: 5 });

class AudioAnalysisStore {
    constructor() {
        this._d = this._createData();
        this._spectra = new Map(); // fftSize -> { analyser, data, refCount, shared }
        this._audioContext = null;
        this._tapNode = null;
        this._sharedSize = 0;
    }

    /** Hình dạng dữ liệu — 1 nơi duy nhất định nghĩa mọi field. */
    _createData() {
        return {
            frameIndex: 0,
            // Năng lượng / nhịp
            beatScale: 0, smoothedEnergy: 0, hueOffset: 0, energyPercent: 0, hasSignal: false,
            flux: 0, fluxHistory: [], lastBeatTime: 0, bpm: null,
            // Cao độ
            pitch: { frequency: -1, confidence: 0, midi: null, name: null, time: 0, history: [], average: 0 },
            melodyDirection: 0, melodySlope: 0, vibrato: false, vibratoRateHz: 0, vibratoExtentCents: 0,
            // Phổ (phân tích cố định 2048)
            bands: new Float32Array(6), bandOnsets: new Float32Array(6), bandOnsetTimes: new Float64Array(6),
            centroidHz: 0, spreadHz: 0, rolloffHz: 0, flatness: 0, dominantHz: 0,
            // Hoà âm
            chroma: new Float32Array(12),
            keyTonic: -1, keyMode: null, keyName: null, keyConfidence: 0,
            chordRoot: -1, chordQuality: null, chordName: null, chordConfidence: 0,
            // Miền thời gian
            rmsDb: -Infinity, peakDb: -Infinity, crestDb: 0, zcr: 0, loudnessDb: -100,
            isSilent: false, silenceKind: null, silentForMs: 0,
            loudnessTrendDbPerSec: 0, loudnessTrend: 'steady', isBuildUp: false, lastDropTime: 0,
        };
    }

    // ============================== GHI (chỉ event/workflow/audio-analysis.js) ==============================

    /** Object dữ liệu nội bộ để Workflow phân tích ghi TẠI CHỖ mỗi frame. */
    _data() { return this._d; }

    /** Gắn graph: AudioContext + điểm rẽ nhánh (sau EQ, trước âm lượng) + analyser phân tích dùng chung cỡ của nó. Tạo
     * analyser cho các cỡ đã được xin TRƯỚC khi có graph. */
    _attachGraph(audioContext, tapNode, sharedAnalyser, sharedData) {
        this._audioContext = audioContext;
        this._tapNode = tapNode;
        this._sharedSize = sharedAnalyser.fftSize;
        const existing = this._spectra.get(this._sharedSize);
        this._spectra.set(this._sharedSize, { analyser: sharedAnalyser, data: sharedData, refCount: existing ? existing.refCount : 0, shared: true });
        this._spectra.forEach((entry, size) => this._ensureAnalyser(entry, size));
    }

    /** Các cỡ phổ RIÊNG đang được xin (không gồm cỡ dùng chung — Workflow tự đọc cỡ đó). */
    _ownedSpectra() {
        const owned = [];
        this._spectra.forEach((entry) => { if (!entry.shared && entry.analyser && entry.refCount > 0) owned.push(entry); });
        return owned;
    }

    _ensureAnalyser(entry, size) {
        if (entry.analyser || !this._audioContext) return;
        entry.analyser = this._audioContext.createAnalyser();
        entry.analyser.fftSize = size;
        this._tapNode.connect(entry.analyser);
    }

    // ============================== PHỔ ĐỂ VẼ ==============================

    /** Effect khai báo cần phổ cỡ `fftSize` (gọi khi bật). Sai cỡ -> báo lỗi rõ, trả false. */
    requireSpectrum(fftSize) {
        if (!AUDIO_ANALYSIS_FFT_SIZES.includes(fftSize)) {
            console.error(`[audioAnalysis] requireSpectrum(${fftSize}): cỡ FFT không hợp lệ — phải là 1 trong ${AUDIO_ANALYSIS_FFT_SIZES.join('/')}`);
            return false;
        }
        const entry = this._spectra.get(fftSize) || { analyser: null, data: new Uint8Array(fftSize / 2), refCount: 0, shared: false };
        entry.refCount++;
        this._spectra.set(fftSize, entry);
        this._ensureAnalyser(entry, fftSize);
        return true;
    }

    /** Effect trả lại phổ (gọi khi tắt). Hết người dùng -> gỡ analyser riêng (cỡ dùng chung giữ nguyên). */
    releaseSpectrum(fftSize) {
        const entry = this._spectra.get(fftSize);
        if (!entry || entry.refCount === 0) return;
        entry.refCount--;
        if (entry.refCount > 0 || entry.shared) return;
        if (entry.analyser) entry.analyser.disconnect();
        this._spectra.delete(fftSize);
    }

    /** Phổ byte (0-255) cỡ `fftSize` của frame hiện tại; chưa xin / chưa có graph -> null. */
    spectrum(fftSize) {
        const entry = this._spectra.get(fftSize);
        return entry && entry.analyser ? entry.data : null;
    }

    /** AnalyserNode của cỡ phổ đó (CHỈ để đọc minDecibels/maxDecibels/context.sampleRate) — chưa có -> null. */
    spectrumAnalyser(fftSize) {
        const entry = this._spectra.get(fftSize);
        return entry ? entry.analyser : null;
    }

    sampleRate() { return this._audioContext ? this._audioContext.sampleRate : 44100; }

    // ============================== NĂNG LƯỢNG / NHỊP ==============================

    frameIndex() { return this._d.frameIndex; }
    /** Năng lượng dải 0-2 kHz, 0-1 (tín hiệu React Beat/effect từ trước tới nay). */
    beatScale() { return this._d.beatScale; }
    smoothedEnergy() { return this._d.smoothedEnergy; }
    /** Hue chạy vòng 0-360 theo năng lượng. */
    hueOffset() { return this._d.hueOffset; }
    energyPercent() { return this._d.energyPercent; }
    /** RMS trên ngưỡng im lặng. */
    hasSignal() { return this._d.hasSignal; }
    flux() { return this._d.flux; }
    /** 45 giá trị flux gần nhất (CHỈ ĐỌC). */
    fluxHistory() { return this._d.fluxHistory; }
    /** Mốc beat gần nhất (performance.now(); 0 = chưa có) — dùng để so "beat mới" (giá trị đổi = beat mới). */
    lastBeatTime() { return this._d.lastBeatTime; }
    msSinceBeat() { return this._d.lastBeatTime > 0 ? performance.now() - this._d.lastBeatTime : Infinity; }
    /** BPM (số nguyên) hoặc null khi chưa ước lượng được / đang dừng. */
    bpm() { return this._d.bpm; }
    /** BPM dạng chữ cho hiển thị ("---" khi null). */
    bpmText() { return this._d.bpm === null ? '---' : String(this._d.bpm); }
    /** BPM hoặc giá trị dự phòng (effect cần 1 con số để tính tốc độ). */
    bpmOr(fallback) { return this._d.bpm === null ? fallback : this._d.bpm; }

    // ============================== CAO ĐỘ ==============================

    /** Nốt MIDI gần nhất đã nhận (null = chưa có). */
    pitchMidi() { return this._d.pitch.midi; }
    pitchName() { return this._d.pitch.name; }
    pitchFrequency() { return this._d.pitch.frequency; }
    pitchConfidence() { return this._d.pitch.confidence; }
    /** Nốt còn "tươi" (nhận trong `maxAgeMs` gần đây). */
    isPitchFresh(maxAgeMs) { return this._d.pitch.midi !== null && performance.now() - this._d.pitch.time <= maxAgeMs; }
    msSincePitch() { return this._d.pitch.time > 0 ? performance.now() - this._d.pitch.time : Infinity; }
    /** Trung bình 30 nốt gần nhất (trước đây rubikPitchAvg). */
    pitchAverage() { return this._d.pitch.average; }
    pitchHistory() { return this._d.pitch.history; }
    melodyDirection() { return this._d.melodyDirection; }
    melodySlope() { return this._d.melodySlope; }
    vibrato() { return { active: this._d.vibrato, rateHz: this._d.vibratoRateHz, extentCents: this._d.vibratoExtentCents }; }

    // ============================== PHỔ (đặc trưng) ==============================

    /** Mức 0-1 của 1 dải: 'sub' | 'bass' | 'lowMid' | 'mid' | 'highMid' | 'treble'. */
    band(name) { return this._d.bands[AUDIO_ANALYSIS_BAND_INDEX[name]]; }
    bands() { return this._d.bands; }
    /** Độ tăng dB của dải ở frame này (độ mạnh onset). */
    bandOnset(name) { return this._d.bandOnsets[AUDIO_ANALYSIS_BAND_INDEX[name]]; }
    msSinceBandOnset(name) {
        const t = this._d.bandOnsetTimes[AUDIO_ANALYSIS_BAND_INDEX[name]];
        return t > 0 ? performance.now() - t : Infinity;
    }
    /** Dải có onset trong `withinMs` gần đây không (kick ≈ 'bass', snare ≈ 'mid', hi-hat ≈ 'treble'). */
    isBandOnset(name, withinMs) { return this.msSinceBandOnset(name) <= withinMs; }
    lastBandOnsetTime(name) { return this._d.bandOnsetTimes[AUDIO_ANALYSIS_BAND_INDEX[name]]; }
    centroidHz() { return this._d.centroidHz; }
    spreadHz() { return this._d.spreadHz; }
    rolloffHz() { return this._d.rolloffHz; }
    flatness() { return this._d.flatness; }
    dominantHz() { return this._d.dominantHz; }

    // ============================== HOÀ ÂM ==============================

    chroma() { return this._d.chroma; }
    /** {tonic, mode, name, confidence} hoặc null khi chưa đủ tin cậy. */
    key() { return this._d.keyName === null ? null : { tonic: this._d.keyTonic, mode: this._d.keyMode, name: this._d.keyName, confidence: this._d.keyConfidence }; }
    /** {root, quality, name, confidence} hoặc null ("N"). */
    chord() { return this._d.chordName === null ? null : { root: this._d.chordRoot, quality: this._d.chordQuality, name: this._d.chordName, confidence: this._d.chordConfidence }; }

    // ============================== MIỀN THỜI GIAN ==============================

    rmsDb() { return this._d.rmsDb; }
    peakDb() { return this._d.peakDb; }
    crestDb() { return this._d.crestDb; }
    zcr() { return this._d.zcr; }
    loudnessDb() { return this._d.loudnessDb; }
    loudnessTrend() { return this._d.loudnessTrend; }
    loudnessTrendDbPerSec() { return this._d.loudnessTrendDbPerSec; }
    isBuildUp() { return this._d.isBuildUp; }
    msSinceDrop() { return this._d.lastDropTime > 0 ? performance.now() - this._d.lastDropTime : Infinity; }
    lastDropTime() { return this._d.lastDropTime; }
    isSilent() { return this._d.isSilent; }
    /** 'intro' | 'gap' | 'outro' | null. */
    silenceKind() { return this._d.silenceKind; }
    silentForMs() { return this._d.silentForMs; }

    // ============================== DEBUG ==============================

    /** Bản sao nông toàn bộ dữ liệu + các cỡ phổ đang được xin — để soi trong console. */
    debugSnapshot() {
        const spectra = [];
        this._spectra.forEach((e, size) => spectra.push({ size, refCount: e.refCount, shared: e.shared, ready: !!e.analyser }));
        return { ...this._d, pitch: { ...this._d.pitch }, spectra };
    }
}

const audioAnalysis = new AudioAnalysisStore();
