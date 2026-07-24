/**
 * core/video-editor/media-gain.js — Core THUẦN (Rule 1-4 core-function-conventions.md). MỚI,
 * 24/07/2026, phản hồi Giang (mục e — "kiểm tra âm lượng ... áp dụng cho cả preview lẫn thật").
 *
 * VẤN ĐỀ: thẻ `<video>`/`<audio>` gốc chỉ nhận `.volume` trong đoạn [0,1] — KHÔNG thể khuếch đại
 * vượt 100%. Nhưng slider Volume (Video clip lẫn Nhạc clip) cho phép tới 200%, và lúc XUẤT THẬT
 * (`core/video-editor/webcodecs-engine.js`) dùng `GainNode` (Web Audio, `gain.gain.value` KHÔNG bị
 * giới hạn ở 1) nên vượt 100% vẫn khuếch đại đúng — preview trước đây (gán thẳng `el.volume =
 * Math.min(1, volume)`) bị "cụt" ở 100%, không khớp bản xuất thật. File này tạo 1 "gain boost node"
 * (AudioContext + MediaElementSource + GainNode) để preview dùng CÙNG cơ chế GainNode như lúc xuất.
 *
 * LƯU Ý KIỂM THỬ: sandbox này KHÔNG chạy được trình duyệt thật, CHƯA verify runtime — đặc biệt
 * chính sách autoplay (AudioContext có thể ở trạng thái 'suspended' tới khi có cử chỉ người dùng,
 * xem Workflow tự `resume()` trong lúc xử lý click Play — không thuộc phạm vi file Core này).
 *
 * Rule 2 — không đọc `appState`. Rule 3 — không gọi core nào khác (chỉ gọi Web Audio API chuẩn).
 * `createMediaGainBoost()` chỉ ĐƯỢC gọi ĐÚNG 1 LẦN cho mỗi phần tử media (`createMediaElementSource()`
 * ném lỗi nếu gọi lần 2 trên CÙNG 1 phần tử) — Workflow tự chịu trách nhiệm gọi đúng 1 lần lúc khởi
 * tạo trang, lưu lại kết quả, tái dùng cho mọi lần đổi volume sau đó (không gọi lại hàm này).
 */

/**
 * Tạo 1 chuỗi Web Audio (`<video>`/`<audio>` -> MediaElementSource -> GainNode -> destination) cho
 * 1 phần tử media — trả về `null` nếu trình duyệt không hỗ trợ AudioContext (fallback: Workflow tự
 * dùng thẳng `el.volume` kẹp trong [0,1], KHÔNG khuếch đại được vượt 100%, chấp nhận được).
 * @param {HTMLMediaElement} mediaEl
 * @returns {{audioCtx: AudioContext, source: MediaElementAudioSourceNode, gain: GainNode}|null}
 */
function createMediaGainBoost(mediaEl) {
    const AudioCtxCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtxCtor) return null;
    const audioCtx = new AudioCtxCtor();
    const source = audioCtx.createMediaElementSource(mediaEl);
    const gain = audioCtx.createGain();
    source.connect(gain).connect(audioCtx.destination);
    return { audioCtx, source, gain };
}

/**
 * Áp giá trị volume (0-2, 1 = 100%, ĐÚNG thang đo dùng ở clip Video/Nhạc trong toàn bộ trang) lên 1
 * "gain boost node" đã tạo qua `createMediaGainBoost()`.
 * @param {{gain: GainNode}} boost @param {number} volume
 */
function applyMediaGainBoost(boost, volume) {
    boost.gain.gain.value = Math.max(0, volume);
}
