/**
 * core/audio-engine.js — Core THUẦN dựng Web Audio graph (AudioContext, EQ BiquadFilter nối tiếp, master gain,
 * 2 analyser) + tạo/gửi khung cho Worker nhận diện cao độ YIN.
 *
 * [DỌN NỢ CORE RULE — 01/10/2026, Giang yêu cầu "xử lý toàn bộ" vi phạm phân tích audio] 3 hàm di sản ĐÃ XOÁ:
 *   - setupAudioContext()      — R1 (2 tiến trình: tạo mới / resume), R2 (~20 lần appState.get), R3 (gọi
 *                                initPitchWorker/findEqPresetById/applyEqGains/updateDOMBackground, gọi NGƯỢC lên
 *                                workflowVisualizerRender.start()), R4 (set không log).
 *   - initPitchWorker()        — R2, R4 (onmessage/onerror ghi state không log).
 *   - requestPitchDetection()  — R2, R3 (gọi initPitchWorker(); bảng audit cũ ghi sót cột R3).
 * Điều phối (đọc state/config, chọn tạo mới hay resume, ghi state, giữ reqId, khởi động vòng lặp) dời sang
 * event/workflow/audio-engine.js (`workflowAudioEngine.setup()` / `ensurePitchWorker()` / `requestPitch()`).
 * File này chỉ còn builder 1 việc, nhận tham số, không appState.get(), không gọi core khác (Rule 1-3).
 * Hết luôn ngoại lệ "Core gọi Workflow" duy nhất của vòng lặp render (readme/event-bus-flow.md mục 1).
 *
 * Ghi chú lịch sử còn đúng (log 9->10, iOS): khi app bị ẩn, AudioContext của Safari chuyển sang 'interrupted'
 * (trạng thái do HỆ ĐIỀU HÀNH áp đặt, khác 'suspended' do app tự gọi) — resume phải xét CẢ 2 trạng thái. Nay
 * dùng chung resumeAudioContextIfInterrupted() bên dưới cho mọi lượt gọi lại workflowAudioEngine.setup().
 *
 * PITCH WORKER (v7): detectPitchYIN() chạy ở core/workers/pitch-worker.js (thread riêng). Giao thức message
 * xem docstring file worker.
 */

/** Script pitch worker — Classic Worker (KHÔNG type 'module'), bắt buộc để chạy được qua file://. */
const PITCH_WORKER_URL = 'core/workers/pitch-worker.js?v=20261001af1'; // ?v — đổi mỗi khi sửa worker (cùng quy ước index.html), tránh cache bản cũ
/** Gain phẳng 10 dải — dùng khi chưa có preset EQ nào khớp id đang chọn (preset chưa nạp kịp / đã xoá). */
const EQ_FLAT_GAINS = Object.freeze([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

/**
 * Tạo Worker nhận diện cao độ. Trình duyệt không cho tạo (vd chặn Worker qua file://) -> null, log lỗi.
 * try/catch ở đây là xử lý lỗi của CÙNG 1 việc "tạo worker", không phải 2 tiến trình (Rule 1).
 * @param {string} scriptUrl @returns {Worker|null}
 */
function createPitchWorker(scriptUrl) {
    try {
        return new Worker(scriptUrl);
    } catch (err) {
        console.error('[audio-engine] Không tạo được pitch-worker (trình duyệt không hỗ trợ Worker qua file://?):', err);
        return null;
    }
}

/**
 * Gửi 1 khung time-domain sang worker — KHÔNG chờ kết quả. PHẢI clone trước khi transfer: `buf` là buffer TÁI
 * SỬ DỤNG (analyserPitch.getFloatTimeDomainData ghi đè mỗi frame), transfer thẳng buffer gốc sẽ làm nó bị
 * "neutered" ngay lần gửi đầu, mọi frame sau ghi vào 1 buffer đã chết.
 * @param {Worker} worker @param {Float32Array} buf @param {number} sampleRate @param {number} reqId
 */
function postPitchFrame(worker, buf, sampleRate, reqId) {
    const clone = buf.slice(); // Float32Array.slice() cấp ArrayBuffer MỚI, an toàn để transfer
    worker.postMessage({ buf: clone, sampleRate, reqId }, [clone.buffer]);
}

/**
 * Mở AudioContext mới + nguồn MediaElement cho phần tử phát (Song: `audioPlayer`). Mỗi phần tử media chỉ
 * createMediaElementSource() được 1 lần trong đời context — nơi gọi (Workflow) tự đảm bảo chỉ gọi 1 lần.
 * @param {HTMLMediaElement} mediaEl @returns {{audioContext: AudioContext, sourceNode: MediaElementAudioSourceNode}}
 */
function openAudioContextForElement(mediaEl) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const sourceNode = audioContext.createMediaElementSource(mediaEl);
    return { audioContext, sourceNode };
}

/** AnalyserNode mới với fftSize cho trước. @param {AudioContext} audioContext @param {number} fftSize @returns {AnalyserNode} */
function createAnalyserNode(audioContext, fftSize) {
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = fftSize;
    return analyser;
}

/** GainNode mới với mức gain ban đầu. @param {AudioContext} audioContext @param {number} gainValue @returns {GainNode} */
function createGainNode(audioContext, gainValue) {
    const gainNode = audioContext.createGain();
    gainNode.gain.value = gainValue;
    return gainNode;
}

/**
 * Chuỗi BiquadFilter 'peaking' NỐI TIẾP bắt đầu từ `inputNode`, mỗi tần số 1 dải (Q=1, gain 0 — gain thật do
 * applyEqGains() đặt sau). Không có tần số nào -> chuỗi rỗng, đầu ra chính là `inputNode`.
 * @param {AudioContext} audioContext @param {AudioNode} inputNode @param {number[]} frequencies
 * @returns {{filters: BiquadFilterNode[], outputNode: AudioNode}}
 */
function buildPeakingEqChain(audioContext, inputNode, frequencies) {
    const filters = [];
    let prevNode = inputNode;
    frequencies.forEach((freq) => {
        const filter = audioContext.createBiquadFilter();
        filter.type = 'peaking'; filter.frequency.value = freq; filter.Q.value = 1; filter.gain.value = 0;
        prevNode.connect(filter);
        prevNode = filter;
        filters.push(filter);
    });
    return { filters, outputNode: prevNode };
}

/**
 * Nối phần đuôi graph (SỬA 01/10/2026 — Giang: "volume độc lập với phân tích"):
 *
 *   đầu ra EQ -> masterGainNode (cổng seek, bình thường = 1) -+-> analyser       (phổ VẼ, fftSize theo effect)
 *                                                             +-> analyserPitch  (phân tích chung, FFT cố định 2048)
 *                                                             +-> volumeGainNode (âm lượng người dùng) -> loa
 *
 * 2 analyser rẽ nhánh TRƯỚC âm lượng nên kéo volume (kể cả về 0) không đổi số liệu phân tích; EQ vẫn nằm trước nên
 * preset EQ vẫn ảnh hưởng phân tích (đúng ý Giang — EQ đổi tính chất nhạc). Cổng seek vẫn câm CẢ loa lẫn phân tích.
 * Analyser không cần nối ra loa để xử lý (analyserPitch vốn đã không nối, pitch vẫn chạy trên iOS).
 * @param {AudioNode} eqOutputNode @param {GainNode} masterGainNode @param {GainNode} volumeGainNode
 * @param {AnalyserNode} analyser @param {AnalyserNode} analyserPitch @param {AudioDestinationNode} destination
 */
function wireAudioOutputGraph(eqOutputNode, masterGainNode, volumeGainNode, analyser, analyserPitch, destination) {
    eqOutputNode.connect(masterGainNode);
    masterGainNode.connect(analyser);
    masterGainNode.connect(analyserPitch);
    masterGainNode.connect(volumeGainNode);
    volumeGainNode.connect(destination);
}

        // ===================== Phát nền khi ẩn tab/PWA (MỚI 25/09/2026, Giang yêu cầu) =====================
        // 2 hàm THUẦN dưới đây do event/workflow/app-visibility.js (workflowAppVisibility) gọi — resumeAudioContextIfInterrupted()
        // còn được event/workflow/audio-engine.js (workflowAudioEngine.setup(), nhánh đã có context) dùng lại. KHÔNG tự đọc appState,
        // KHÔNG gọi hàm core nào khác, KHÔNG dùng taskManager (Rule 1-3).

        /**
         * Đăng ký Audio Session loại 'playback' (Audio Session API — Safari/iOS 16.4+, `navigator.audioSession`).
         * NGUYÊN NHÂN GỐC lỗi "ẩn app thì mất tiếng nhưng currentTime vẫn chạy, hết bài -> Next mới có tiếng lại":
         * `audioPlayer` đi QUA Web Audio (createMediaElementSource ở workflowAudioEngine.setup() — trước 01/10/2026 là setupAudioContext()) nên tiếng thật phát ra từ
         * AudioContext; iOS mặc định xếp trang dùng Web Audio vào loại session KHÔNG được phát nền -> vừa ẩn app là
         * AudioContext bị hệ điều hành chuyển sang 'interrupted' (câm), còn <audio> vẫn chạy tiếp (currentTime vẫn
         * tăng). Next/Prev "chữa" được chỉ vì mỗi lượt phát bài đều gọi lại hàm dựng graph (nay workflowAudioEngine.setup()), hàm đó resume(). Khai báo 'playback' =
         * báo iOS đây là app phát nhạc (giống app Music): được phát nền + hiện trên màn hình khoá. Hệ quả phụ (đúng
         * chuẩn app nhạc): tiếng phát cả khi gạt công tắc im lặng.
         * Idempotent — chỉ gán khi khác. Trình duyệt không hỗ trợ -> no-op.
         * @returns {boolean} true nếu trình duyệt hỗ trợ Audio Session API.
         */
        function applyPlaybackAudioSession() {
            if (typeof navigator === 'undefined' || !navigator.audioSession) return false;
            try {
                if (navigator.audioSession.type !== 'playback') {
                    navigator.audioSession.type = 'playback';
                    console.log('[audio-engine] Đã đăng ký navigator.audioSession.type = "playback"');
                }
            } catch (e) {
                console.warn('[audio-engine] Không đăng ký được audioSession (bỏ qua):', e);
            }
            return true;
        }

        /**
         * Lưới an toàn cho phát nền: AudioContext bị hệ điều hành ngắt ('interrupted' — riêng Safari) hoặc treo
         * ('suspended') trong lúc media VẪN đang phát -> resume() ngay (cùng điều kiện resume với
         * togglePlayPause(); workflowAudioEngine.setup() gọi hàm này với `shouldBeRunning` = true). `shouldBeRunning` = false (không có gì đang phát) thì KHÔNG đụng —
         * không tự đánh thức context lúc người dùng đã pause.
         * @param {AudioContext|null|undefined} audioContext - appState.get('audioContext') do Workflow đọc sẵn.
         * @param {boolean} shouldBeRunning - media đang thật sự phát (Workflow tự tính).
         * @returns {string} trạng thái context lúc kiểm tra ('none' nếu chưa có context) — Workflow dùng để log.
         */
        function resumeAudioContextIfInterrupted(audioContext, shouldBeRunning) {
            if (!audioContext) return 'none';
            const state = audioContext.state;
            if (shouldBeRunning && (state === 'suspended' || state === 'interrupted')) {
                audioContext.resume().catch((err) => console.warn('[audio-engine] resume() AudioContext lỗi (bỏ qua):', err));
            }
            return state;
        }

        // (25/09/2026) 2 hàm cổng seek v2 (setAudioOutputConnected/readAnalyserRms) ĐÃ XOÁ — cổng v3 không còn ngắt loa/đo
        // analyser, xem event/workflow/player-controls.js::runGatedSeek().

        /** MỚI (28/09/2026, Phase 3) — Đổi độ phân giải FFT của analyser chính (effect cần phổ mịn dùng 2048). */
        function setAnalyserFftSize(analyser, fftSize) {
            analyser.fftSize = fftSize;
        }
