/**
 * core/recorder.js — Core THUẦN của chế độ Ghi âm (MỚI 01/10/2026, Giang yêu cầu). Mỗi hàm 1 việc, nhận tham số,
 * không appState.get(), không gọi core khác, không taskManager (Rule 1-3). Điều phối: event/workflow/recorder.js.
 *
 * [07/10/2026, Giang — cải tiến Ghi âm] BỎ Echo cancellation (mic luôn thu thô: echoCancellation/noiseSuppression/
 * autoGainControl = false — Android Chrome bật EC thì chuyển sang chế độ cuộc gọi, đẩy tiếng ra loa thoại; Safari bật EC
 * thì hạ mạnh mức mic). 2 CHẾ ĐỘ THU (`mode`, Settings > System > Ghi âm):
 *   - 'speaker'    (Loa ngoài): CHỈ mic — nhạc phát ra loa + giọng cùng vào mic (không trộn nhạc gốc: tránh nhạc vào bản
 *                  ghi 2 lần, không cần Sync vì cả 2 tới mic cùng lúc). buildRecorderMicOnlyGraph().
 *   - 'headphones' (Tai nghe): nhạc gốc + mic, nhạc trễ theo Sync để khớp giọng (graph dưới). buildRecorderMixGraph().
 *
 * GRAPH 'headphones' (Giang chốt phương án A — trộn NGAY lúc ghi, 1 MediaRecorder, không trộn lại sau):
 *
 *   masterGainNode (sau EQ, TRƯỚC âm lượng người dùng) -> DelayNode (Sync) -+
 *                                                                            +-> MediaStreamAudioDestinationNode -> MediaRecorder
 *   mic (getUserMedia) -> MediaStreamSource -------------------------------+
 *                                         \-> AnalyserNode (đo mức mic + báo clip cho overlay)
 *
 * Lấy nhạc ở `masterGainNode` nên đúng cho CẢ Song lẫn Video (video cũng chảy qua EQ -> master, core/video-player.js),
 * và âm lượng người dùng không làm bản ghi to/nhỏ theo. DelayNode chỉ nằm trên nhánh vào bản ghi — tiếng ra loa không đổi.
 * Giọng luôn tới trễ hơn nhạc (trễ loa + trễ mic) nên trễ NHẠC trong bản ghi một khoảng bằng đó để hai bên khớp.
 *
 * NẠP SAU: không phụ thuộc file nào lúc nạp (chỉ khai báo hằng số + hàm).
 */

/** Sync (trước là "Bù trễ giọng", Settings > System > Ghi âm, chỉ chế độ Tai nghe) — giới hạn slider, đơn vị ms. */
const RECORDER_LATENCY_MIN_MS = 0;
const RECORDER_LATENCY_MAX_MS = 500;
const RECORDER_LATENCY_STEP_MS = 10;
/** Trần DelayNode (giây) — phải ≥ RECORDER_LATENCY_MAX_MS. */
const RECORDER_DELAY_NODE_MAX_SEC = 1;

/** MỚI (07/10/2026) — chế độ thu (mặc định = phần tử đầu), Count-in (giây, 0 = tắt), Recording quality -> bitrate. */
const RECORDER_MODES = Object.freeze(['speaker', 'headphones']);
const RECORDER_COUNT_IN_OPTIONS = Object.freeze([0, 3, 5]);
const RECORDER_COUNT_IN_DEFAULT = 3;
const RECORDER_QUALITY_BITRATE = Object.freeze({ standard: 128000, high: 192000, max: 256000 });
const RECORDER_QUALITY_DEFAULT = 'standard';
/** Clip warning: |mẫu| ≥ ngưỡng này coi như vỡ tiếng; giữ báo đỏ thêm 1 khoảng để mắt kịp thấy. */
const RECORDER_CLIP_THRESHOLD = 0.98;
const RECORDER_CLIP_HOLD_MS = 1000;

/** MỚI (07/10/2026) — Latency calibration (chế độ Tai nghe): phát chuỗi tiếng "tick" ra tai nghe đặt sát mic, so thời
 * điểm tick trong tín hiệu gốc với lúc mic nghe thấy NGAY TRONG CÙNG 1 graph — đúng độ lệch mà graph ghi phải bù. */
const RECORDER_CALIB_LEAD_SEC = 0.6;        // chờ trước tick đầu (mic ổn định)
const RECORDER_CALIB_CLICK_COUNT = 6;
const RECORDER_CALIB_INTERVAL_SEC = 0.75;   // > RECORDER_LATENCY_MAX_MS để không nhầm tick kế
const RECORDER_CALIB_CLICK_SEC = 0.02;
const RECORDER_CALIB_CLICK_HZ = 2000;
const RECORDER_CALIB_TAIL_SEC = 0.8;        // thu thêm sau tick cuối
const RECORDER_CALIB_PROCESSOR_SIZE = 2048;
const RECORDER_CALIB_MIN_MATCHES = 3;
const RECORDER_CALIB_MAX_SPREAD_MS = 40;    // các lần đo lệch nhau quá mức này -> không tin được (ồn, mic không nghe rõ)

/** MIME ưu tiên cho MediaRecorder — "lưu định dạng theo OS" (Giang chốt): iOS/Safari chỉ có audio/mp4 (AAC), Chrome
 * Android thường audio/webm (Opus). Workflow lọc qua MediaRecorder.isTypeSupported() rồi lấy cái đầu tiên. */
const RECORDER_MIME_CANDIDATES = Object.freeze(['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']);

/** MIME gốc (đã bỏ tham số codecs) -> đuôi file lưu. */
const RECORDER_FILE_EXT_BY_BASE_MIME = Object.freeze({
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/aac': 'aac',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
});
const RECORDER_FALLBACK_FILE_EXT = 'm4a';

/** Ký tự không hợp lệ trong tên file (mọi hệ điều hành phổ biến). */
const RECORDER_FILENAME_INVALID_CHARS = /[\\/:*?"<>|]+/g;
const RECORDER_FILENAME_TITLE_MAX = 60;

/**
 * Trình duyệt có đủ API ghi âm không (mic + MediaRecorder). file:// không có `navigator.mediaDevices` (không phải
 * secure context) -> false.
 * @param {Navigator} nav @param {Function|undefined} mediaRecorderCtor - window.MediaRecorder
 * @returns {boolean}
 */
function isMediaRecordingSupported(nav, mediaRecorderCtor) {
    return !!(nav && nav.mediaDevices && typeof nav.mediaDevices.getUserMedia === 'function' && typeof mediaRecorderCtor === 'function');
}

/**
 * Ràng buộc getUserMedia cho mic — SỬA (07/10/2026, Giang bỏ Echo cancellation): luôn thu THÔ, tắt cả 3 bộ xử lý giọng
 * nói (EC làm Android chuyển chế độ cuộc gọi/ra loa thoại và Safari hạ mức mic; NS/AGC bóp méo, tự tăng giảm âm lượng).
 * @returns {MediaStreamConstraints}
 */
function buildRecorderMicConstraints() {
    return { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false };
}

/** Chế độ thu hợp lệ; giá trị lạ -> 'speaker'. @param {*} value @returns {'speaker'|'headphones'} */
function normalizeRecorderMode(value) {
    return RECORDER_MODES.includes(value) ? value : RECORDER_MODES[0];
}

/** Count-in (giây) hợp lệ; giá trị lạ -> mặc định. @param {*} value @returns {number} */
function normalizeRecorderCountIn(value) {
    const n = Number(value);
    return RECORDER_COUNT_IN_OPTIONS.includes(n) ? n : RECORDER_COUNT_IN_DEFAULT;
}

/** Mức chất lượng hợp lệ; giá trị lạ -> mặc định. @param {*} value @returns {string} */
function normalizeRecorderQuality(value) {
    return Object.prototype.hasOwnProperty.call(RECORDER_QUALITY_BITRATE, value) ? value : RECORDER_QUALITY_DEFAULT;
}

/** Tuỳ chọn MediaRecorder: MIME (đã lọc hỗ trợ, rỗng = để trình duyệt chọn) + bitrate theo chất lượng.
 * @param {string} mimeType @param {string} quality @returns {MediaRecorderOptions} */
function buildRecorderOptions(mimeType, quality) {
    const options = { audioBitsPerSecond: RECORDER_QUALITY_BITRATE[quality] || RECORDER_QUALITY_BITRATE[RECORDER_QUALITY_DEFAULT] };
    if (mimeType) options.mimeType = mimeType;
    return options;
}

/** Kẹp giá trị bù trễ vào [MIN, MAX], làm tròn theo bước slider. Giá trị hỏng -> MIN. @param {number} ms @returns {number} */
function clampRecorderLatencyMs(ms) {
    const value = Number(ms);
    if (!Number.isFinite(value)) return RECORDER_LATENCY_MIN_MS;
    const stepped = Math.round(value / RECORDER_LATENCY_STEP_MS) * RECORDER_LATENCY_STEP_MS;
    return Math.min(RECORDER_LATENCY_MAX_MS, Math.max(RECORDER_LATENCY_MIN_MS, stepped));
}

/**
 * MỚI (07/10/2026) — graph ghi chế độ 'speaker': CHỈ mic vào bản ghi (nhạc tới mic qua loa). Không chạm graph phát nhạc.
 * @param {AudioContext} audioContext @param {MediaStream} micStream @param {number} micAnalyserFftSize
 * @returns {{destination: MediaStreamAudioDestinationNode, musicTapNode: null, musicDelay: null,
 *   micSource: MediaStreamAudioSourceNode, micAnalyser: AnalyserNode}}
 */
function buildRecorderMicOnlyGraph(audioContext, micStream, micAnalyserFftSize) {
    const destination = audioContext.createMediaStreamDestination();
    const micSource = audioContext.createMediaStreamSource(micStream);
    micSource.connect(destination);
    const micAnalyser = audioContext.createAnalyser();
    micAnalyser.fftSize = micAnalyserFftSize;
    micSource.connect(micAnalyser);
    return { destination, musicTapNode: null, musicDelay: null, micSource, micAnalyser };
}

/**
 * Dựng graph ghi chế độ 'headphones' (sơ đồ đầu file). KHÔNG đụng nhánh ra loa/phân tích hiện có — chỉ THÊM 1 kết nối từ `musicTapNode`.
 * @param {AudioContext} audioContext
 * @param {AudioNode} musicTapNode - masterGainNode
 * @param {MediaStream} micStream
 * @param {number} delaySec - bù trễ giọng (giây)
 * @param {number} micAnalyserFftSize
 * @returns {{destination: MediaStreamAudioDestinationNode, musicTapNode: AudioNode, musicDelay: DelayNode,
 *   micSource: MediaStreamAudioSourceNode, micAnalyser: AnalyserNode}}
 */
function buildRecorderMixGraph(audioContext, musicTapNode, micStream, delaySec, micAnalyserFftSize) {
    const destination = audioContext.createMediaStreamDestination();
    const musicDelay = audioContext.createDelay(RECORDER_DELAY_NODE_MAX_SEC);
    musicDelay.delayTime.value = Math.max(0, Math.min(RECORDER_DELAY_NODE_MAX_SEC, delaySec));
    musicTapNode.connect(musicDelay);
    musicDelay.connect(destination);

    const micSource = audioContext.createMediaStreamSource(micStream);
    micSource.connect(destination);
    const micAnalyser = audioContext.createAnalyser();
    micAnalyser.fftSize = micAnalyserFftSize;
    micSource.connect(micAnalyser);

    return { destination, musicTapNode, musicDelay, micSource, micAnalyser };
}

/**
 * Gỡ graph ghi (cả 2 chế độ) — CHỈ gỡ đúng kết nối master -> DelayNode (master vẫn nối loa/phân tích như cũ); chế độ
 * 'speaker' không có nhánh nhạc (null -> bước đó tự bỏ qua trong try). Mỗi bước bọc try riêng: 1 node đã gỡ sẵn không
 * làm hỏng các bước sau (cùng 1 việc "dọn", không phải nhiều tiến trình).
 * @param {{musicTapNode: AudioNode|null, musicDelay: DelayNode|null, micSource: AudioNode, micAnalyser: AudioNode, destination: AudioNode}} graph
 */
function disposeRecorderMixGraph(graph) {
    try { if (graph.musicTapNode) graph.musicTapNode.disconnect(graph.musicDelay); } catch (e) { console.warn('[recorder] gỡ master -> delay lỗi (bỏ qua):', e); }
    try { if (graph.musicDelay) graph.musicDelay.disconnect(); } catch (e) { /* đã gỡ */ }
    try { graph.micSource.disconnect(); } catch (e) { /* đã gỡ */ }
    try { graph.micAnalyser.disconnect(); } catch (e) { /* đã gỡ */ }
}

/** Dừng mọi track của stream mic (tắt đèn báo mic của hệ điều hành). @param {MediaStream} stream */
function stopMediaStreamTracks(stream) {
    stream.getTracks().forEach((track) => track.stop());
}

/** Mức mic 0..1 từ 1 khung time-domain (RMS, nhân hệ số để giọng nói thường ~0.3-0.8). @param {Float32Array} buf @returns {number} */
function computeRecorderMicLevel(buf) {
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / (buf.length || 1));
    return Math.min(1, rms * 4);
}

/** MỚI (07/10/2026) — Clip warning: biên độ đỉnh |mẫu| của 1 khung time-domain (0..1+). @param {Float32Array} buf @returns {number} */
function computeRecorderMicPeak(buf) {
    let peak = 0;
    for (let i = 0; i < buf.length; i++) {
        const v = Math.abs(buf[i]);
        if (v > peak) peak = v;
    }
    return peak;
}

// ===================== Latency calibration (MỚI 07/10/2026) =====================

/**
 * Graph đo trễ: N tiếng tick (sóng sin ngắn, có bao biên) lên lịch từ `startAt` -> (a) loa/tai nghe, (b) kênh 0 của bộ
 * gộp (tín hiệu GỐC); mic -> kênh 1. Bộ gộp -> ScriptProcessor (2 kênh vào; thu mẫu do Workflow gắn onaudioprocess) ->
 * gain 0 -> destination (để trình duyệt chịu chạy processor). Hai kênh đi qua CÙNG 1 lượt render nên độ lệch tick giữa
 * 2 kênh = đúng độ lệch giữa nhánh nhạc gốc và mic trong graph ghi.
 * @param {AudioContext} audioContext @param {MediaStream} micStream @param {number} startAt - audioContext.currentTime + lead
 * @returns {{processor: ScriptProcessorNode, nodes: AudioNode[], endAt: number}}
 */
function buildLatencyCalibrationGraph(audioContext, micStream, startAt) {
    const merger = audioContext.createChannelMerger(2);
    const processor = audioContext.createScriptProcessor(RECORDER_CALIB_PROCESSOR_SIZE, 2, 2);
    const sink = audioContext.createGain();
    sink.gain.value = 0;
    merger.connect(processor);
    processor.connect(sink);
    sink.connect(audioContext.destination);

    const micSource = audioContext.createMediaStreamSource(micStream);
    micSource.connect(merger, 0, 1);

    const nodes = [merger, processor, sink, micSource];
    for (let k = 0; k < RECORDER_CALIB_CLICK_COUNT; k++) {
        const t = startAt + k * RECORDER_CALIB_INTERVAL_SEC;
        const osc = audioContext.createOscillator();
        osc.frequency.value = RECORDER_CALIB_CLICK_HZ;
        const env = audioContext.createGain();
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(0.9, t + 0.002);
        env.gain.setValueAtTime(0.9, t + RECORDER_CALIB_CLICK_SEC - 0.004);
        env.gain.linearRampToValueAtTime(0, t + RECORDER_CALIB_CLICK_SEC);
        osc.connect(env);
        env.connect(audioContext.destination);
        env.connect(merger, 0, 0);
        osc.start(t);
        osc.stop(t + RECORDER_CALIB_CLICK_SEC + 0.01);
        nodes.push(osc, env);
    }
    const endAt = startAt + (RECORDER_CALIB_CLICK_COUNT - 1) * RECORDER_CALIB_INTERVAL_SEC + RECORDER_CALIB_TAIL_SEC;
    return { processor, nodes, endAt };
}

/** Gỡ graph đo trễ (mỗi node bọc try — đã gỡ/đã dừng thì bỏ qua). @param {{processor: ScriptProcessorNode, nodes: AudioNode[]}} graph */
function disposeLatencyCalibrationGraph(graph) {
    graph.processor.onaudioprocess = null;
    graph.nodes.forEach((node) => { try { node.disconnect(); } catch (e) { /* đã gỡ */ } });
}

/**
 * Độ trễ (ms, CHƯA làm tròn — Workflow kẹp theo slider Sync bằng clampRecorderLatencyMs()) từ 2 kênh đã thu: tìm thời điểm bắt đầu từng tick ở kênh gốc (vượt 30%
 * đỉnh kênh, sau đó bỏ qua 1/2 khoảng tick), rồi với mỗi tick tìm lần ĐẦU kênh mic vượt ngưỡng trong cửa sổ
 * [tick, tick + trễ tối đa]. Ngưỡng mic = max(sàn ồn × 4, 25% đỉnh mic) — sàn ồn đo ở đoạn trước tick đầu. Lấy trung vị;
 * thiếu lần khớp hoặc các lần lệch nhau quá RECORDER_CALIB_MAX_SPREAD_MS -> ok=false.
 * @param {Float32Array} refChannel @param {Float32Array} micChannel @param {number} sampleRate
 * @returns {{ok: boolean, latencyMs: number, matches: number, spreadMs: number}}
 */
function detectCalibrationLatencyMs(refChannel, micChannel, sampleRate) {
    const n = Math.min(refChannel.length, micChannel.length);
    let refPeak = 0, micPeak = 0;
    for (let i = 0; i < n; i++) {
        refPeak = Math.max(refPeak, Math.abs(refChannel[i]));
        micPeak = Math.max(micPeak, Math.abs(micChannel[i]));
    }
    const fail = { ok: false, latencyMs: 0, matches: 0, spreadMs: 0 };
    if (refPeak <= 0 || micPeak <= 0) return fail;

    const refOnsets = [];
    const refThreshold = refPeak * 0.3;
    const refHold = Math.floor(sampleRate * RECORDER_CALIB_INTERVAL_SEC / 2);
    for (let i = 0; i < n; i++) {
        if (Math.abs(refChannel[i]) < refThreshold) continue;
        refOnsets.push(i);
        i += refHold;
    }
    if (refOnsets.length === 0) return fail;

    let noise = 0;
    const noiseEnd = Math.max(1, refOnsets[0] - Math.floor(sampleRate * 0.05));
    for (let i = 0; i < noiseEnd; i++) noise = Math.max(noise, Math.abs(micChannel[i]));
    const micThreshold = Math.max(noise * 4, micPeak * 0.25);
    if (micThreshold >= micPeak) return fail;

    const maxLag = Math.floor(sampleRate * RECORDER_LATENCY_MAX_MS / 1000);
    const lagsMs = [];
    refOnsets.forEach((onset) => {
        const end = Math.min(n, onset + maxLag + 1);
        for (let i = onset; i < end; i++) {
            if (Math.abs(micChannel[i]) >= micThreshold) { lagsMs.push((i - onset) * 1000 / sampleRate); return; }
        }
    });
    if (lagsMs.length < RECORDER_CALIB_MIN_MATCHES) return { ...fail, matches: lagsMs.length };
    lagsMs.sort((a, b) => a - b);
    const median = lagsMs[Math.floor(lagsMs.length / 2)];
    const spreadMs = lagsMs[lagsMs.length - 1] - lagsMs[0];
    if (spreadMs > RECORDER_CALIB_MAX_SPREAD_MS) return { ok: false, latencyMs: 0, matches: lagsMs.length, spreadMs };
    return { ok: true, latencyMs: median, matches: lagsMs.length, spreadMs };
}

/**
 * Đỉnh biên độ theo `bucketCount` cột cho mini waveform — lấy max |mẫu| của MỌI kênh trong từng cột, rồi chuẩn hoá
 * theo đỉnh lớn nhất (bản ghi nhỏ tiếng vẫn hiện rõ hình dạng). Không có kênh nào (giải mã thất bại) -> mảng 0.
 * @param {Float32Array[]} channels @param {number} bucketCount @returns {Float32Array} giá trị 0..1
 */
function computeWaveformPeaks(channels, bucketCount) {
    const peaks = new Float32Array(bucketCount);
    if (!channels.length || !channels[0].length) return peaks;
    const length = channels[0].length;
    const samplesPerBucket = Math.max(1, Math.floor(length / bucketCount));
    let globalMax = 0;
    for (let b = 0; b < bucketCount; b++) {
        const start = b * samplesPerBucket;
        const end = Math.min(length, start + samplesPerBucket);
        let max = 0;
        for (let c = 0; c < channels.length; c++) {
            const data = channels[c];
            for (let i = start; i < end; i++) {
                const v = Math.abs(data[i]);
                if (v > max) max = v;
            }
        }
        peaks[b] = max;
        if (max > globalMax) globalMax = max;
    }
    if (globalMax <= 0) return peaks;
    for (let b = 0; b < bucketCount; b++) peaks[b] = peaks[b] / globalMax;
    return peaks;
}

/** Bỏ tham số (";codecs=...") + hạ chữ thường: 'audio/webm;codecs=opus' -> 'audio/webm'. @param {string} mime @returns {string} */
function normalizeRecorderMimeType(mime) {
    return String(mime || '').split(';')[0].trim().toLowerCase();
}

/** Đuôi file theo MIME gốc (đã normalize). MIME lạ/rỗng -> 'm4a'. @param {string} baseMime @returns {string} */
function resolveRecorderFileExtension(baseMime) {
    return RECORDER_FILE_EXT_BY_BASE_MIME[baseMime] || RECORDER_FALLBACK_FILE_EXT;
}

/** Nhãn thời điểm cho tag tiêu đề: 'dd/MM HH:mm' (Giang chốt). @param {Date} date @returns {string} */
function formatRecordingDateLabel(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Dấu thời gian cho tên file: 'YYYYMMDD-HHmmss' (đủ tới giây — "ghi mới", không đè bản cũ). @param {Date} date @returns {string} */
function formatRecordingFileStamp(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/**
 * Tên file bản ghi: '<tiêu đề gốc đã làm sạch> - rec-<stamp>.<ext>'.
 * @param {string} sourceTitle @param {string} stamp @param {string} ext @returns {string}
 */
function buildRecordingFilename(sourceTitle, stamp, ext) {
    const cleanTitle = String(sourceTitle || '').replace(RECORDER_FILENAME_INVALID_CHARS, ' ').replace(/\s+/g, ' ').trim().slice(0, RECORDER_FILENAME_TITLE_MAX) || 'recording';
    return `${cleanTitle} - rec-${stamp}.${ext}`;
}
