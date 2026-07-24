/**
 * core/video-editor/media-gain.js — Core THUẦN (Rule 1-4 core-function-conventions.md). TÁI TẠO
 * (24/07/2026, round 4 — Giang báo "chỉnh volume video/nhạc không có tác dụng gì cả, dù đã sửa
 * nhiều lần"). ĐÃ TRA CỨU tìm ra NGUYÊN NHÂN THẬT SỰ, không phải bug ở code JS như 2 lần sửa trước:
 *
 * **iOS (Safari LẪN mọi trình duyệt khác trên iOS — Chrome/Firefox iOS đều bắt buộc dùng chung
 * engine WebKit theo luật Apple) KHOÁ CỨNG thuộc tính `.volume` của `<video>`/`<audio>`** — gán giá
 * trị mới bị ÂM THẦM BỎ QUA, đọc lại LUÔN LUÔN trả về `1`. Tài liệu CHÍNH THỨC của Apple xác nhận
 * (Device-Specific Considerations, HTML5 Audio/Video):
 * "On iOS devices, the audio level is always under the user's physical control. **The volume
 * property is not settable in JavaScript. Reading the volume property always returns 1.**"
 * → Đây là giới hạn CỐ Ý, VĨNH VIỄN của nền tảng (không phải bug có thể vá bằng cách gán `.volume`
 * theo bất kỳ cách nào khác) — GIẢI THÍCH ĐÚNG tại sao 2 lần sửa trước (chỉ đổi cách gán `.volume`)
 * KHÔNG BAO GIỜ có tác dụng trên máy Giang.
 *
 * GIẢI PHÁP DUY NHẤT được xác nhận rộng rãi (nhiều nguồn, kể cả forum chính thức
 * developer.apple.com): định tuyến qua **Web Audio API GainNode** — `gainNode.gain.value` KHÔNG
 * bị khoá, hoạt động đúng trên iOS.
 *
 * BẢN THỬ TRƯỚC (sáng 24/07/2026) ĐÃ ĐÚNG HƯỚNG NÀY nhưng bị lỗi KHÁC (đã bỏ vì Giang báo "mất
 * tiếng"): tạo `AudioContext` lúc `_onMetadataReady()` (do sự kiện 'loadedmetadata', KHÔNG PHẢI cử
 * chỉ người dùng) → context ở trạng thái `'suspended'` VĨNH VIỄN vì không hề gọi `.resume()` ở đâu
 * — câm HẲN toàn bộ audio (không riêng gì volume). BẢN NÀY sửa ĐÚNG gốc: `createMediaGainBoost()` +
 * `.resume()` giờ PHẢI được gọi từ 1 user-gesture THẬT (nút Play/nút mở Drawer Volume), xem
 * `_ensureGainBoosts()`, event/workflow/video-editor.js — KHÔNG tạo lúc `_onMetadataReady()` nữa.
 *
 * LƯU Ý KIỂM THỬ: sandbox này KHÔNG chạy được trình duyệt thật (càng không có thiết bị iOS thật) —
 * CHƯA verify runtime trực tiếp trên iOS, chỉ dựa theo tài liệu Apple + nhiều báo cáo thực tế khớp
 * nhau. Nếu vẫn không nghe thấy thay đổi sau bản này, khả năng cao là do 1 trong 2: (1) AudioContext
 * vẫn bị 'suspended' vì trình duyệt/thiết bị cụ thể có chính sách khắt khe hơn — cần Giang mở
 * DevTools/Safari Web Inspector xem console có warning "Không tạo được GainNode" hay
 * `audioCtx.state` có phải `'running'` không; (2) file JS/HTML cache cũ chưa thật sự được nạp lại
 * (SAV là PWA — service worker có thể vẫn phục vụ bản cache cũ dù đã thay file trên server).
 *
 * Rule 2 — không đọc appState. Rule 3 — không gọi core nào khác (chỉ gọi Web Audio API chuẩn).
 * `createMediaGainBoost()` chỉ ĐƯỢC gọi ĐÚNG 1 LẦN cho mỗi phần tử media (`createMediaElementSource()`
 * ném lỗi nếu gọi lần 2 trên CÙNG 1 phần tử) — Workflow tự chịu trách nhiệm gọi đúng 1 lần, lưu lại
 * kết quả, tái dùng cho mọi lần sau (xem `_ensureGainBoosts()`, có guard `if (!this._xGainBoost)`).
 */

/**
 * Tạo 1 chuỗi Web Audio (`<video>`/`<audio>` -> MediaElementSource -> GainNode -> destination) cho
 * 1 phần tử media — trả về `null` nếu trình duyệt không hỗ trợ AudioContext.
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
 * Áp giá trị volume (0-1, ĐÚNG thang đo dùng ở clip Video/Nhạc trong toàn bộ trang — slider đã kẹp
 * về 0-100% từ round trước) lên 1 "gain boost node" đã tạo qua `createMediaGainBoost()`.
 * @param {{gain: GainNode}} boost @param {number} volume
 */
function applyMediaGainBoost(boost, volume) {
    boost.gain.gain.value = Math.max(0, volume);
}
