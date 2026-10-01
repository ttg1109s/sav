/**
 * event/workflow/audio-features.js — Workflow điều phối ĐẶC TRƯNG AUDIO mở rộng (core/audio-features.js), chạy trong
 * task phân tích mỗi frame (workflowAudioAnalysis._tick() gọi `measureFrame()` rồi `track()`).
 *
 * [MỚI — 01/10/2026, Giang yêu cầu "thêm vào" 3 nhóm] Kết quả: appState `audioFeatures` (1 object, ghi TẠI CHỖ qua
 * appState.mutate mỗi frame — danh sách field xem core/audio-features.js::createAudioFeatures()). Chưa effect nào đọc —
 * đây là lớp dữ liệu dùng chung để các effect/Game/React Beat tự chọn dùng về sau.
 *
 * 2 bước mỗi frame:
 *   - `measureFrame()` — đo TỨC THỜI, mọi pha phát: mức 6 dải, onset theo dải (cần baseline phổ CŨ nên gọi TRƯỚC
 *     storeSpectrumBaseline), hình dạng phổ, tần số trội, RMS/peak/crest/ZCR, chroma tức thời.
 *   - `track()` — theo DÒNG THỜI GIAN, chỉ khi đang phát và đã qua cửa sổ ổn định (cùng quy tắc BPM): sự kiện onset
 *     từng dải, loudness + xu hướng + build-up/drop, im lặng, hợp âm, key, hướng giai điệu, vibrato. Pha khác -> ngắt
 *     dòng thời gian (xoá các ring theo thời gian), giữ chroma key tích luỹ (cùng bài thì key không đổi).
 *
 * Mốc thời gian trong `audioFeatures` (bandOnsetTimes, lastDropTime) theo performance.now() — KHÁC `lastBeatTime`
 * (Date.now()). Hot path: appState.mutate(..., { skipCheck: true }) không log (ngoại lệ Rule 4); cấp phát/reset có log.
 * Rẽ nhánh (readme/event-bus-flow.md mục 7): guard + chọn giá trị, không if/else chọn tiến trình.
 *
 * NẠP: sau core/audio-tempo.js + core/audio-features.js (ring buffer tạo LÚC NẠP), trước event/workflow/audio-analysis.js.
 */

/** Đã qua cửa sổ ổn định / chưa — object map thay if/else (readme/event-bus-flow.md mục 7). */
const AUDIO_FEATURES_TRACK_BY_SETTLED = {
    true: (frame, dt) => workflowAudioFeatures._trackFrame(frame, dt),
    false: () => workflowAudioFeatures._breakTracking(),
};

const workflowAudioFeatures = {
    // Bảng dựng sẵn theo analyser phân tích (allocate()).
    _magTable: null,
    _bandRanges: null,
    _chromaMap: null,
    _binHz: 0,
    _dbMin: -100,
    _dbMax: -30,
    _dbPerByte: 0,
    // Trạng thái theo dòng thời gian.
    _chromaNow: new Float32Array(12),
    _keyChroma: new Float32Array(12),
    _keyTrackedMs: 0,
    _lastKeyEstimatePerf: 0,
    _bandHistories: AUDIO_FEATURE_BANDS.map(() => []),
    _loudnessRing: createOnsetEnvelope(AUDIO_FEATURE_RING_CAPACITY),
    _melodyRing: createOnsetEnvelope(AUDIO_FEATURE_RING_CAPACITY),
    _noteRing: createOnsetEnvelope(AUDIO_FEATURE_RING_CAPACITY),
    _loudnessPrimed: false,
    _buildUpSincePerf: 0,
    _lastBuildUpPerf: 0,
    _isQuiet: false,
    _quietSincePerf: 0,
    _hasHeardSound: false,
    _lastPitchPerf: 0,
    _lastNoteMidi: NaN,
    _lastTrackPerf: 0,

    /** Dựng bảng tra theo analyser PHÂN TÍCH + tạo object `audioFeatures`. workflowAudioAnalysis.allocateBuffers() gọi. */
    allocate(analyserPitch, sampleRate) {
        const binCount = analyserPitch.frequencyBinCount;
        this._binHz = sampleRate / (2 * binCount);
        this._dbMin = analyserPitch.minDecibels;
        this._dbMax = analyserPitch.maxDecibels;
        this._dbPerByte = (this._dbMax - this._dbMin) / 255;
        this._magTable = buildByteToMagnitudeTable(this._dbMin, this._dbMax); // core/audio-features.js
        this._bandRanges = buildFeatureBandRanges(binCount, sampleRate, AUDIO_FEATURE_BANDS); // core
        this._chromaMap = buildChromaBinMap(binCount, sampleRate, CHROMA_MIN_HZ, CHROMA_MAX_HZ); // core
        appState.set('audioFeatures', createAudioFeatures()); // core
        console.log(`writer: "workflowAudioFeatures.allocate", page: "audioFeatures", content: "${binCount} bin, ${sampleRate} Hz"`);
    },

    /** Đổi bài/video — workflowAudioAnalysis.resetForNewMedia() gọi. An toàn cả khi chưa cấp phát. */
    resetForNewMedia() {
        this._breakTracking();
        this._keyChroma.fill(0);
        this._keyTrackedMs = 0;
        this._lastKeyEstimatePerf = 0;
        this._hasHeardSound = false;
        this._lastBuildUpPerf = 0;
        this._bandHistories = AUDIO_FEATURE_BANDS.map(() => []);
        this._resetFeatureFields(appState.get('audioFeatures'));
    },

    /** Xoá phần "theo bài" của object đặc trưng (key, hợp âm, chroma, mốc onset/drop, im lặng). */
    _resetFeatureFields(features) {
        if (!features) return;
        appState.mutate('audioFeatures', (f) => {
            f.chroma.fill(0);
            f.bandOnsetTimes.fill(0);
            f.keyTonic = -1; f.keyMode = null; f.keyName = null; f.keyConfidence = 0;
            f.chordRoot = -1; f.chordQuality = null; f.chordName = null; f.chordConfidence = 0;
            f.lastDropTime = 0; f.isBuildUp = false; f.isSilent = false; f.silenceKind = null; f.silentForMs = 0;
            f.melodyDirection = 0; f.melodySlope = 0; f.vibrato = false; f.vibratoRateHz = 0; f.vibratoExtentCents = 0;
        });
        console.log(`writer: "workflowAudioFeatures._resetFeatureFields", page: "audioFeatures", content: "reset theo bài mới"`);
    },

    // ===================== Đo tức thời =====================

    /**
     * Đo các đặc trưng tức thời của frame. PHẢI gọi TRƯỚC storeSpectrumBaseline() (onset theo dải so với phổ frame trước).
     * @param {Uint8Array} spectrum - analysisSpectrumArray @param {Uint8Array} prevSpectrum @param {boolean} baselineValid
     * @param {Float32Array} timeDomain - pitchTimeDomainArray đã đọc ở frame này
     */
    measureFrame(spectrum, prevSpectrum, baselineValid, timeDomain) {
        if (!this._magTable) return; // guard — chưa cấp phát
        appState.mutate('audioFeatures', (f) => {
            computeBandLevels(spectrum, this._magTable, this._bandRanges, this._dbMin, this._dbMax, f.bands); // core
            computeBandOnsetStrengths(spectrum, prevSpectrum, this._bandRanges, this._dbPerByte, baselineValid, f.bandOnsets); // core
            computeSpectralShape(spectrum, this._magTable, this._binHz, SPECTRAL_ROLLOFF_RATIO, this._magTable[1], f); // core
            f.dominantHz = computeDominantFrequency(spectrum, this._binHz); // core
            computeTimeDomainLevels(timeDomain, f); // core
        }, { skipCheck: true });
        computeChroma(spectrum, this._magTable, this._chromaMap, this._chromaNow); // core
    },

    // ===================== Theo dòng thời gian =====================

    /**
     * @param {{nowPerf: number, isSettled: boolean, mediaTimeSec: number, mediaDurationSec: number,
     *          pitchFrequency: number, pitchConfidence: number}} frame
     */
    track(frame) {
        const dt = Math.min(100, Math.max(0, frame.nowPerf - this._lastTrackPerf)); // kẹp — tránh 1 bước EMA quá lớn sau khi ngắt
        this._lastTrackPerf = frame.nowPerf;
        if (!this._magTable) return; // guard — chưa cấp phát
        AUDIO_FEATURES_TRACK_BY_SETTLED[frame.isSettled === true](frame, dt); // không phát / đang ổn định lại -> ngắt
    },

    _trackFrame(frame, dt) {
        appState.mutate('audioFeatures', (f) => {
            this._trackSilence(f, frame.nowPerf, frame.mediaTimeSec, frame.mediaDurationSec);
            this._trackBandOnsets(f, frame.nowPerf);
            this._trackLoudness(f, frame.nowPerf, dt);
            this._trackHarmony(f, frame.nowPerf, dt);
            this._trackPitch(f, frame.nowPerf, frame.pitchFrequency, frame.pitchConfidence);
        }, { skipCheck: true });
    },

    /** Ngắt dòng thời gian: xoá các ring, loudness mồi lại, build-up/im lặng đếm lại. Giữ chroma key (cùng bài). */
    _breakTracking() {
        clearOnsetEnvelope(this._loudnessRing); // core/audio-tempo.js
        clearOnsetEnvelope(this._melodyRing);
        clearOnsetEnvelope(this._noteRing);
        this._loudnessPrimed = false;
        this._buildUpSincePerf = 0;
        this._isQuiet = false;
        this._quietSincePerf = 0;
        this._lastNoteMidi = NaN;
    },

    /** Im lặng có trễ + thời lượng tối thiểu; loại intro/gap/outro. */
    _trackSilence(f, now, mediaTimeSec, mediaDurationSec) {
        this._isQuiet = isBelowSilenceGate(f.rmsDb, this._isQuiet, SILENCE_ENTER_DB, SILENCE_EXIT_DB); // core
        this._quietSincePerf = this._isQuiet ? (this._quietSincePerf || now) : 0;
        this._hasHeardSound = this._hasHeardSound || !this._isQuiet;
        f.silentForMs = this._isQuiet ? now - this._quietSincePerf : 0;
        f.isSilent = f.silentForMs >= SILENCE_MIN_MS;
        f.silenceKind = f.isSilent ? resolveSilenceKind(this._hasHeardSound, mediaTimeSec, mediaDurationSec, SILENCE_OUTRO_TAIL_SEC, SILENCE_OUTRO_TAIL_RATIO) : null; // core
    },

    /** Sự kiện onset từng dải (ngưỡng thích nghi theo lịch sử RIÊNG từng dải). */
    _trackBandOnsets(f, now) {
        for (let b = 0; b < f.bandOnsets.length; b++) {
            const history = this._bandHistories[b];
            const isOnset = isBandOnset(f.bandOnsets[b], computeArrayMean(history), now, f.bandOnsetTimes[b],
                BAND_ONSET_MEAN_RATIO, BAND_ONSET_FLOOR_DB, BAND_ONSET_MIN_INTERVAL_MS); // core
            f.bandOnsetTimes[b] = isOnset ? now : f.bandOnsetTimes[b];
            pushBoundedHistory(history, f.bandOnsets[b], BAND_ONSET_HISTORY_MAX); // core/audio-analysis.js
        }
    },

    /** Loudness ngắn hạn, xu hướng, build-up, drop. Đầu bài / sau chỗ ngắt mà còn im lặng thì CHƯA mồi (không có mức tham
     * chiếu — mồi ở -60 rồi nhạc vào sẽ thành "build-up" giả, phát hiện khi test); khoảng lặng GIỮA bài vẫn ghi (kéo
     * loudness về sàn) để drop sau khoảng lặng được nhận ra. */
    _trackLoudness(f, now, dt) {
        if (!this._loudnessPrimed && this._isQuiet) return;
        const level = Math.max(LOUDNESS_FLOOR_DB, f.rmsDb);
        const smoothed = smoothLoudnessDb(f.loudnessDb, level, dt, LOUDNESS_TAU_MS); // core
        f.loudnessDb = this._loudnessPrimed ? smoothed : level; // lần mồi: lấy thẳng mức hiện tại
        this._loudnessPrimed = true;
        pushOnsetSample(this._loudnessRing, now, f.loudnessDb); // core/audio-tempo.js (ring theo thời gian dùng chung)
        f.loudnessTrendDbPerSec = computeTimedRingSlope(this._loudnessRing, LOUDNESS_TREND_WINDOW_MS, LOUDNESS_TREND_MIN_SPAN_MS); // core
        f.loudnessTrend = resolveLoudnessTrend(f.loudnessTrendDbPerSec, LOUDNESS_TREND_THRESHOLD_DB_PER_SEC); // core
        // Ngay sau 1 drop, cửa sổ xu hướng còn chứa cú nhảy của chính drop -> độ dốc dương giả; chờ hết cửa sổ mới xét build-up.
        const canBuildUp = f.loudnessTrend === 'rising' && now - f.lastDropTime > LOUDNESS_TREND_WINDOW_MS;
        this._buildUpSincePerf = canBuildUp ? (this._buildUpSincePerf || now) : 0;
        f.isBuildUp = this._buildUpSincePerf > 0 && now - this._buildUpSincePerf >= BUILDUP_MIN_MS;
        this._lastBuildUpPerf = f.isBuildUp ? now : this._lastBuildUpPerf;
        const recentMin = computeTimedRingMin(this._loudnessRing, DROP_LOOKBACK_MS); // core
        const isDrop = isLoudnessDrop(f.loudnessDb, recentMin, DROP_JUMP_DB, now, this._lastBuildUpPerf,
            DROP_AFTER_BUILDUP_MS, f.lastDropTime, DROP_MIN_INTERVAL_MS); // core
        f.lastDropTime = isDrop ? now : f.lastDropTime;
    },

    /** Chroma ngắn (hợp âm) + chroma dài (key). Lúc im lặng không tích luỹ, không đoán hợp âm. */
    _trackHarmony(f, now, dt) {
        blendChromaTowards(f.chroma, this._chromaNow, dt, CHORD_CHROMA_TAU_MS); // core
        this._applyChord(f, estimateChordFromChroma(f.chroma)); // core
        this._accumulateKeyChroma(dt);
        this._estimateKeyIfDue(f, now);
    },

    /** Hợp âm đủ điểm (và không đang im lặng) -> ghi; còn lại -> "N" (null). */
    _applyChord(f, chord) {
        const ok = !this._isQuiet && chord !== null && chord.score >= CHORD_MIN_SCORE;
        f.chordConfidence = chord ? Math.max(0, chord.score) : 0;
        f.chordRoot = ok ? chord.root : -1;
        f.chordQuality = ok ? chord.quality : null;
        f.chordName = ok ? formatChordName(chord.root, chord.quality, MIDI_NOTE_NAMES) : null; // core
    },

    _accumulateKeyChroma(dt) {
        if (this._isQuiet) return;
        blendChromaTowards(this._keyChroma, this._chromaNow, dt, KEY_CHROMA_TAU_MS); // core
        this._keyTrackedMs += dt;
    },

    /** Mỗi KEY_ESTIMATE_INTERVAL_MS, khi đã tích luỹ đủ KEY_MIN_TRACKED_MS nhạc có tiếng. */
    _estimateKeyIfDue(f, now) {
        if (now - this._lastKeyEstimatePerf < KEY_ESTIMATE_INTERVAL_MS) return;
        if (this._keyTrackedMs < KEY_MIN_TRACKED_MS) return;
        this._lastKeyEstimatePerf = now;
        this._applyKey(f, estimateKeyFromChroma(this._keyChroma, KEY_PROFILE_MAJOR, KEY_PROFILE_MINOR)); // core
    },

    /** Tương quan đủ ngưỡng -> ghi key; không thì để trống (vẫn ghi độ tin cậy để debug). */
    _applyKey(f, key) {
        if (!key) return;
        const ok = key.correlation >= KEY_MIN_CORRELATION;
        f.keyConfidence = key.correlation;
        f.keyTonic = ok ? key.tonic : -1;
        f.keyMode = ok ? key.mode : null;
        f.keyName = ok ? formatKeyName(key.tonic, key.mode, MIDI_NOTE_NAMES) : null; // core
    },

    /** Độ tin cậy pitch, hướng giai điệu (qua nhiều nốt), vibrato (trong 1 nốt). */
    _trackPitch(f, now, frequency, confidence) {
        f.pitchConfidence = confidence;
        const midiRaw = computeMidiFloatFromFrequency(frequency); // core
        const midi = !this._isQuiet && confidence >= PITCH_MIN_CONFIDENCE ? midiRaw : NaN;
        this._resetPitchRingsOnGap(now, midi);
        this._pushPitchSample(now, midi);
        f.melodySlope = computeTimedRingSlope(this._melodyRing, MELODY_WINDOW_MS, MELODY_WINDOW_MS / 2); // core
        f.melodyDirection = resolveMelodyDirection(f.melodySlope, MELODY_DEADBAND_ST_PER_SEC); // core
        const vib = measureVibrato(this._noteRing, VIBRATO_WINDOW_MS, VIBRATO_MIN_SPAN_MS); // core
        f.vibratoRateHz = vib.rateHz;
        f.vibratoExtentCents = vib.extentCents;
        f.vibrato = isVibratoMeasure(vib.rateHz, vib.extentCents, VIBRATO_RATE_MIN_HZ, VIBRATO_RATE_MAX_HZ,
            VIBRATO_EXTENT_MIN_CENTS, VIBRATO_EXTENT_MAX_CENTS); // core
    },

    /** Mất pitch lâu -> xoá ring giai điệu; mất ngắn hoặc nhảy nốt -> xoá ring nốt (bắt đầu nốt mới). */
    _resetPitchRingsOnGap(now, midi) {
        const gap = now - this._lastPitchPerf;
        const jumped = Math.abs(midi - this._lastNoteMidi) > NOTE_JUMP_SEMITONES; // NaN -> false
        this._clearRingIf(this._melodyRing, gap > MELODY_GAP_RESET_MS);
        this._clearRingIf(this._noteRing, gap > NOTE_GAP_MS || jumped);
    },

    _clearRingIf(ring, shouldClear) {
        if (!shouldClear) return;
        clearOnsetEnvelope(ring); // core/audio-tempo.js
    },

    _pushPitchSample(now, midi) {
        if (isNaN(midi)) return;
        pushOnsetSample(this._melodyRing, now, midi); // core/audio-tempo.js
        pushOnsetSample(this._noteRing, now, midi);
        this._lastPitchPerf = now;
        this._lastNoteMidi = midi;
    },
};
