/**
 * core/subtitle/subtitle-transition.js — Core THUẦN tuân Rule 1-5 đầy đủ (core-function-
 * conventions.md) cho hiệu ứng Comming/In/Outing (mục 4b, 15/08/2026) khi 1 dòng phụ đề bắt đầu/
 * kết thúc hiệu lực trong Visualizer.
 *
 * CÀI ĐẶT (effect/valueMs) là CHUNG cho MỌI dòng (vizConfig.subtitleCommingEffect/CommingValueMs/
 * InEffect/OutingEffect/OutingValueMs, xem
 * core/config.js) — nhưng KHUNG THỜI GIAN thực tế (giây tuyệt đối trên timeline media) được TÍNH
 * RIÊNG cho TỪNG dòng, lấy `start`/`end` của chính dòng đó làm mốc neo — đúng yêu cầu Giang "chỉ
 * lấy time start, end của data subline làm gốc tham chiếu, không cần đụng Subtitle Editor".
 *
 * CÔNG THỨC (chốt qua hội thoại, ví dụ Giang: dòng start=5 end=10):
 *   - Comming neo = start. value=-2 -> khoảng [3,5] (start lùi 2s). value=+2 -> khoảng [5,7]
 *     (start tiến 2s). TỔNG QUÁT: 2 điểm {neo, neo + value/1000} sắp tăng dần = [from,to].
 *   - Outing neo = end. value=+2 -> khoảng [10,12]. value=-2 -> khoảng [8,10]. CÙNG công thức
 *     trên, chỉ đổi neo.
 *   - Kẹp biên KÉP, bất kể giá trị đặt: (1) |value| không vượt 1/3 tổng thời lượng dòng (end-start)
 *     — cả Comming lẫn Outing riêng biệt; (2) mốc tuyệt đối không được < 0 (trước 0s của media).
 *
 * NẠP: không phụ thuộc gì (thuần tính toán) — đặt cạnh core/subtitle/subtitle-display.js (nơi
 * DUY NHẤT gọi hàm ở đây, xem docstring đầu file đó).
 */

/** Biên độ lớn nhất (mili giây) người dùng được phép đặt cho Comming/Outing — Giang chốt "s:ms
 * max 5s". Đây là biên NHẬP LIỆU (UI, xem components/subtitle-settings-drawer.js) — biên ÁP DỤNG
 * THỰC TẾ còn bị kẹp thêm theo 1/3 tổng thời lượng dòng, xem computeSubtitleTransitionWindow(). */
const SUBTITLE_TRANSITION_MAX_MS = 5000;

/** Hiệu ứng Comming/Outing — `hiddenCss`/`visibleCss` là 2 trạng thái CSS áp trực tiếp qua
 * `style.cssText` (core/subtitle/subtitle-display.js), browser tự nội suy mượt qua
 * `transition-duration` (KHÔNG phải hàm nào ở đây tính progress từng khung hình — tick
 * 'timeupdate' không đủ dày cho hoạt hoạ mượt, xem hội thoại). */
const SUBTITLE_TRANSITION_EFFECTS = {
    fade: { hiddenCss: 'opacity:0', visibleCss: 'opacity:1' },
    'slide-up': { hiddenCss: 'opacity:0;transform:translateY(12px)', visibleCss: 'opacity:1;transform:translateY(0)' },
    'slide-down': { hiddenCss: 'opacity:0;transform:translateY(-12px)', visibleCss: 'opacity:1;transform:translateY(0)' },
    scale: { hiddenCss: 'opacity:0;transform:scale(0.85)', visibleCss: 'opacity:1;transform:scale(1)' },
};

/** Hiệu ứng "In" — CHỈ 1 class CSS bật/tắt (KHÔNG có value/khung giờ, chạy LIÊN TỤC suốt lúc dòng
 * đang ở phase "in", xem docstring đầu file: "In là hiệu ứng trong lúc hiển thị"), keyframe khai
 * báo ở assets/css/base.css. */
const SUBTITLE_IN_EFFECTS = {
    pulse: 'sub-in-pulse',
    glow: 'sub-in-glow',
};

/**
 * Rule 1: đơn tuyến — tính khoảng [from,to] (giây, KHÔNG âm) quanh 1 mốc neo, DÙNG CHUNG cho cả
 * Comming (neo=lineStart) lẫn Outing (neo=lineEnd), xem công thức ở docstring đầu file.
 * Rule 2: chỉ nhận tham số, không đọc appState/appConfig — nơi gọi tự đọc vizConfig rồi truyền
 * đúng `valueMs` vào.
 * @param {number} anchorTime - giây, lineStart (Comming) hoặc lineEnd (Outing).
 * @param {number} valueMs - giá trị đặt, CÓ DẤU, mili giây (đã nhập liệu, CHƯA kẹp 1/3).
 * @param {number} lineStart @param {number} lineEnd - giây, mốc gốc của dòng phụ đề.
 * @returns {{from: number, to: number}}
 */
function computeSubtitleTransitionWindow(anchorTime, valueMs, lineStart, lineEnd) {
    const capMs = ((lineEnd - lineStart) * 1000) / 3;
    const clampedMs = Math.max(-capMs, Math.min(capMs, valueMs));
    const otherPoint = anchorTime + clampedMs / 1000;
    const from = Math.max(0, Math.min(anchorTime, otherPoint));
    const to = Math.max(anchorTime, otherPoint);
    return { from, to };
}
