/**
 * core/audio-segment.js — Core THUẦN xử lý 1 ĐOẠN audio PCM đã giải mã sẵn (gộp mono, cắt đoạn,
 * tính peaks để vẽ waveform, đóng gói WAV PCM 16-bit) — tuân Rule 1-5 (core-function-conventions.md).
 *
 * MỚI (30/09/2026, Giang báo "mini waveform ở kr subtitle không load được" + "play của word chỉ
 * được play ở mini waveform"). Nguyên tắc "tua vít": file này CHỈ là cơ chế — không biết ai dùng
 * (hiện tại: waveform mini của drawer Karaoke, event/workflow/subtitle-editor.js). Mọi hàm nhận dữ
 * liệu qua THAM SỐ, trả kết quả MỚI, không đụng DOM/appState/taskManager, KHÔNG gọi core khác
 * (Rule 3 — phép tính nhỏ lặp lại được viết thẳng trong từng hàm).
 *
 * NẠP SAU: không phụ thuộc gì.
 */

/** Gộp mọi kênh của 1 AudioBuffer (Web Audio API) thành 1 kênh mono (trung bình cộng) — bản SAO
 * mới, không giữ tham chiếu tới buffer gốc (gốc có thể được GC sau đó).
 * @param {AudioBuffer|{numberOfChannels:number, length:number, getChannelData:(i:number)=>Float32Array}} audioBuffer
 * @returns {Float32Array} */
function mixAudioBufferToMono(audioBuffer) {
    const channelCount = Math.max(1, audioBuffer.numberOfChannels || 1);
    const length = audioBuffer.length;
    const mono = new Float32Array(length);
    for (let c = 0; c < channelCount; c++) {
        const data = audioBuffer.getChannelData(c);
        for (let i = 0; i < length; i++) mono[i] += data[i] / channelCount;
    }
    return mono;
}

/** Cắt ĐÚNG đoạn [startSec, endSec] của 1 kênh mono — bản SAO mới (không phải subarray dùng chung
 * bộ nhớ). Kẹp trong phạm vi thật của mảng; đoạn rỗng/ngược -> mảng dài 0.
 * @param {Float32Array} samples @param {number} sampleRate @param {number} startSec @param {number} endSec
 * @returns {Float32Array} */
function sliceMonoSamples(samples, sampleRate, startSec, endSec) {
    const startSample = Math.max(0, Math.floor(startSec * sampleRate));
    const endSample = Math.min(samples.length, Math.ceil(endSec * sampleRate));
    if (endSample <= startSample) return new Float32Array(0);
    return samples.slice(startSample, endSample);
}

/** Peaks cho WaveSurfer (option `peaks`) — chia `samples` thành `bucketCount` ô đều nhau, mỗi ô lấy
 * biên độ TUYỆT ĐỐI lớn nhất (WaveSurfer tự vẽ đối xứng trên/dưới). Mảng ngắn hơn số ô -> trả
 * nguyên biên độ tuyệt đối từng mẫu.
 * @param {Float32Array} samples @param {number} bucketCount @returns {Float32Array} */
function computeMonoPeaks(samples, bucketCount) {
    const count = Math.max(1, Math.min(bucketCount, samples.length));
    const peaks = new Float32Array(count);
    const perBucket = samples.length / count;
    for (let b = 0; b < count; b++) {
        const from = Math.floor(b * perBucket);
        const to = Math.max(from + 1, Math.floor((b + 1) * perBucket));
        let max = 0;
        for (let i = from; i < to && i < samples.length; i++) {
            const v = Math.abs(samples[i]);
            if (v > max) max = v;
        }
        peaks[b] = max;
    }
    return peaks;
}

/** Đóng gói 1 kênh mono Float32 (-1..1) thành file WAV PCM 16-bit little-endian (header RIFF 44
 * byte chuẩn) — phát được bằng <audio> ở MỌI trình duyệt (kể cả Safari iOS), seek CHÍNH XÁC tới
 * từng mẫu (PCM không nén, khác MP3 VBR seek xấp xỉ).
 * @param {Float32Array} samples @param {number} sampleRate @returns {ArrayBuffer} */
function encodeMonoWavPcm16(samples, sampleRate) {
    const dataSize = samples.length * 2;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    const header = [['RIFF', 0], ['WAVE', 8], ['fmt ', 12], ['data', 36]];
    header.forEach(([text, offset]) => {
        for (let i = 0; i < 4; i++) view.setUint8(offset + i, text.charCodeAt(i));
    });
    view.setUint32(4, 36 + dataSize, true);
    view.setUint32(16, 16, true);            // độ dài khối fmt
    view.setUint16(20, 1, true);             // PCM
    view.setUint16(22, 1, true);             // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byteRate = sampleRate * blockAlign
    view.setUint16(32, 2, true);             // blockAlign = 1 kênh * 2 byte
    view.setUint16(34, 16, true);            // bitsPerSample
    view.setUint32(40, dataSize, true);
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
    }
    return buffer;
}
