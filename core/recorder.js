/**
 * core/recorder.js — Core THUẦN của chế độ Ghi âm (MỚI 01/10/2026, Giang yêu cầu). Mỗi hàm 1 việc, nhận tham số,
 * không appState.get(), không gọi core khác, không taskManager (Rule 1-3). Điều phối: event/workflow/recorder.js.
 *
 * GRAPH GHI (Giang chốt phương án A — trộn NGAY lúc ghi, 1 MediaRecorder, không trộn lại sau):
 *
 *   masterGainNode (sau EQ, TRƯỚC âm lượng người dùng) -> DelayNode (bù trễ giọng) -+
 *                                                                                    +-> MediaStreamAudioDestinationNode -> MediaRecorder
 *   mic (getUserMedia) -> MediaStreamSource ---------------------------------------+
 *                                         \-> AnalyserNode (chỉ đo mức mic cho overlay)
 *
 * Lấy nhạc ở `masterGainNode` nên đúng cho CẢ Song lẫn Video (video cũng chảy qua EQ -> master, core/video-player.js),
 * và âm lượng người dùng không làm bản ghi to/nhỏ theo. DelayNode chỉ nằm trên nhánh vào bản ghi — tiếng ra loa không đổi.
 * Giọng luôn tới trễ hơn nhạc (trễ loa + trễ mic) nên trễ NHẠC trong bản ghi một khoảng bằng đó để hai bên khớp.
 *
 * NẠP SAU: không phụ thuộc file nào lúc nạp (chỉ khai báo hằng số + hàm).
 */

/** Bù trễ giọng (Settings > Visualizer Screen > Player > Ghi âm) — giới hạn slider, đơn vị ms. */
const RECORDER_LATENCY_MIN_MS = 0;
const RECORDER_LATENCY_MAX_MS = 500;
const RECORDER_LATENCY_STEP_MS = 10;
/** Trần DelayNode (giây) — phải ≥ RECORDER_LATENCY_MAX_MS. */
const RECORDER_DELAY_NODE_MAX_SEC = 1;

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
 * Ràng buộc getUserMedia cho mic. `echoCancellation` theo toggle người dùng (Giang chốt: tuỳ chọn); tắt
 * noiseSuppression/autoGainControl để giọng hát không bị bóp méo/tự tăng giảm âm lượng giữa chừng.
 * @param {boolean} echoCancellation @returns {MediaStreamConstraints}
 */
function buildRecorderMicConstraints(echoCancellation) {
    return { audio: { echoCancellation: echoCancellation === true, noiseSuppression: false, autoGainControl: false }, video: false };
}

/** Kẹp giá trị bù trễ vào [MIN, MAX], làm tròn theo bước slider. Giá trị hỏng -> MIN. @param {number} ms @returns {number} */
function clampRecorderLatencyMs(ms) {
    const value = Number(ms);
    if (!Number.isFinite(value)) return RECORDER_LATENCY_MIN_MS;
    const stepped = Math.round(value / RECORDER_LATENCY_STEP_MS) * RECORDER_LATENCY_STEP_MS;
    return Math.min(RECORDER_LATENCY_MAX_MS, Math.max(RECORDER_LATENCY_MIN_MS, stepped));
}

/**
 * Dựng graph ghi (sơ đồ đầu file). KHÔNG đụng nhánh ra loa/phân tích hiện có — chỉ THÊM 1 kết nối từ `musicTapNode`.
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
 * Gỡ graph ghi — CHỈ gỡ đúng kết nối master -> DelayNode (master vẫn nối loa/phân tích như cũ). Mỗi bước bọc try
 * riêng: 1 node đã gỡ sẵn không làm hỏng các bước sau (cùng 1 việc "dọn", không phải nhiều tiến trình).
 * @param {{musicTapNode: AudioNode, musicDelay: DelayNode, micSource: AudioNode, micAnalyser: AudioNode, destination: AudioNode}} graph
 */
function disposeRecorderMixGraph(graph) {
    try { graph.musicTapNode.disconnect(graph.musicDelay); } catch (e) { console.warn('[recorder] gỡ master -> delay lỗi (bỏ qua):', e); }
    try { graph.musicDelay.disconnect(); } catch (e) { /* đã gỡ */ }
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
