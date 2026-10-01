/**
 * pitch-worker.js — Web Worker thuần CPU cho thuật toán nhận diện cao độ YIN.
 *
 * VÌ SAO TÁCH RA: detectPitchYIN() là O(halfLen²) (halfLen = fftSizePitch/2 = 1024 ->
 * ~1 triệu phép trừ-bình-phương MỖI FRAME requestAnimationFrame), chạy đồng bộ ngay trong
 * drawVisualizer() trước khi vẽ canvas — nặng hơn hẳn phần còn lại của draw loop, có thể gây
 * giật hình ở những đoạn nhạc có cao độ rõ (giọng hát, nhạc cụ đơn). Toàn bộ input/output của
 * hàm này là dữ liệu số thuần (không đụng DOM/Canvas/Three.js) nên an toàn để chuyển hẳn sang
 * thread riêng.
 *
 * GIAO THỨC MESSAGE (bên gửi/nhận: event/workflow/audio-engine.js — requestPitch()/_onPitchReply(), gửi qua
 * core/audio-engine.js::postPitchFrame(); trước 01/10/2026 là requestPitchDetection()):
 *   postMessage vào worker : { buf: Float32Array (TRANSFERRED, không phải copy), sampleRate: number, reqId: number }
 *   postMessage từ worker   : { frequency: number, confidence: number, reqId: number }
 *   `confidence` (MỚI 01/10/2026) = 1 - giá trị YIN tại lag được chọn (0-1; -1 tần số -> 0). Main thread dùng để loại
 *   nốt giả (PITCH_MIN_CONFIDENCE, core/audio-features.js). Thuật toán chọn tần số KHÔNG đổi.
 * `reqId` dùng để main thread loại bỏ kết quả CŨ trả về trễ (nếu có >1 request đang bay) —
 * tránh tình huống hiếm gặp lúc giật khung làm 2 message chồng nhau, kết quả về sai thứ tự.
 *
 * Classic Worker (KHÔNG `type: 'module'`) — bắt buộc để chạy được qua `file://`, đồng bộ với
 * toàn bộ phần còn lại của project (vanilla script, share global scope, không build step).
 */

/** @returns {{frequency: number, confidence: number}} */
function detectPitchYIN(buf, sampleRate) {
    const halfLen = Math.floor(buf.length / 2); let yinBuffer = new Float32Array(halfLen); let threshold = 0.15;
    yinBuffer[0] = 1; let runningSum = 0;
    for (let tau = 1; tau < halfLen; tau++) {
        let sum = 0; for (let j = 0; j < halfLen; j++) { let diff = buf[j] - buf[j + tau]; sum += diff * diff; }
        runningSum += sum; yinBuffer[tau] = sum * tau / (runningSum === 0 ? 1 : runningSum);
    }
    for (let tau = 2; tau < halfLen; tau++) {
        if (yinBuffer[tau] < threshold) {
            while (tau + 1 < halfLen && yinBuffer[tau + 1] < yinBuffer[tau]) tau++;
            return { frequency: sampleRate / tau, confidence: Math.max(0, Math.min(1, 1 - yinBuffer[tau])) };
        }
    }
    let minTau = 2; let minVal = yinBuffer[2];
    for (let tau = 2; tau < halfLen; tau++) { if (yinBuffer[tau] < minVal) { minVal = yinBuffer[tau]; minTau = tau; } }
    if (minVal < 0.6) return { frequency: sampleRate / minTau, confidence: Math.max(0, Math.min(1, 1 - minVal)) };
    return { frequency: -1, confidence: 0 };
}

self.onmessage = function(e) {
    const { buf, sampleRate, reqId } = e.data;
    const result = detectPitchYIN(buf, sampleRate);
    self.postMessage({ frequency: result.frequency, confidence: result.confidence, reqId });
};
