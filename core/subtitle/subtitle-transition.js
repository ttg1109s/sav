/**
 * core/subtitle/subtitle-transition.js — Core THUẦN hiệu ứng Comming/In/Outing của dòng phụ đề trên Visualizer.
 * Cài đặt effect/valueMs CHUNG mọi dòng (vizConfig.subtitleCommingEffect/InEffect/OutingEffect + ValueMs), khung giờ thực tế tính RIÊNG
 * từng dòng, neo vào start/end của chính dòng đó.
 *
 * Công thức (ví dụ dòng start=5 end=10): Comming neo start, value=-2 -> [3,5], +2 -> [5,7]; Outing neo end,
 * +2 -> [10,12], -2 -> [8,10]. Kẹp: |value| <= 1/3 thời lượng dòng, mốc không < 0.
 */

/** Biên nhập liệu (ms) cho Comming/Outing — biên áp dụng thật còn bị kẹp 1/3 thời lượng dòng. */
const SUBTITLE_TRANSITION_MAX_MS = 5000;

/** Hiệu ứng Comming/Outing: 2 trạng thái CSS, trình duyệt tự nội suy qua transition. */
const SUBTITLE_TRANSITION_EFFECTS = {
    fade: { hiddenCss: 'opacity:0', visibleCss: 'opacity:1' },
    'slide-up': { hiddenCss: 'opacity:0;transform:translateY(12px)', visibleCss: 'opacity:1;transform:translateY(0)' },
    'slide-down': { hiddenCss: 'opacity:0;transform:translateY(-12px)', visibleCss: 'opacity:1;transform:translateY(0)' },
    scale: { hiddenCss: 'opacity:0;transform:scale(0.85)', visibleCss: 'opacity:1;transform:scale(1)' },
};

/** Hiệu ứng In: class chạy liên tục suốt pha in (keyframe ở assets/css/base.css). */
const SUBTITLE_IN_EFFECTS = {
    pulse: 'sub-in-pulse',
    glow: 'sub-in-glow',
};

/** Khoảng [from,to] (giây, không âm) quanh 1 mốc neo — dùng chung Comming (neo start) và Outing (neo end).
 * @param {number} anchorTime @param {number} valueMs có dấu @param {number} lineStart @param {number} lineEnd
 * @returns {{from: number, to: number}} */
function computeSubtitleTransitionWindow(anchorTime, valueMs, lineStart, lineEnd) {
    const capMs = ((lineEnd - lineStart) * 1000) / 3;
    const clampedMs = Math.max(-capMs, Math.min(capMs, valueMs));
    const otherPoint = anchorTime + clampedMs / 1000;
    const from = Math.max(0, Math.min(anchorTime, otherPoint));
    const to = Math.max(anchorTime, otherPoint);
    return { from, to };
}

/** Pha của 1 dòng tại `t` — null nếu dòng không hiệu lực. Effect nào tắt thì không mở rộng khung phía đó.
 * @param {number} t @param {{start: number, end: number}} sub @param {{from: number, to: number}} commingWindow
 * @param {{from: number, to: number}} outingWindow @param {boolean} commingOn @param {boolean} outingOn
 * @returns {'comming'|'in'|'outing'|null} */
function resolveSubtitleLinePhase(t, sub, commingWindow, outingWindow, commingOn, outingOn) {
    const activeFrom = commingOn ? commingWindow.from : sub.start;
    const activeTo = outingOn ? outingWindow.to : sub.end;
    if (t < activeFrom || t > activeTo) return null;
    if (commingOn && t < commingWindow.to) return 'comming';
    if (outingOn && t >= outingWindow.from) return 'outing';
    return 'in';
}

/** MỚI (06/10/2026, Giang — chống lệch timing phụ đề) — sau mốc cuối (`activeTo`) dòng mới hết hiệu lực khi t > activeTo,
 * nên mốc kích hoạt đặt sau đó 1 chút. */
const SUBTITLE_BOUNDARY_EPS_SEC = 0.001;

/** MỚI (06/10/2026) — mốc thời gian GẦN NHẤT (> t) mà pha của 1 dòng sẽ đổi (null -> comming/in -> outing -> null),
 * CÙNG quy tắc `resolveSubtitleLinePhase()` ở trên. Workflow lấy min của mọi dòng làm mốc đồng bộ kế tiếp — không còn
 * phải chờ 'timeupdate' (thưa tới ~250ms). Không còn mốc nào -> Infinity.
 * @returns {number} giây */
function computeSubtitleLineNextBoundary(t, sub, commingWindow, outingWindow, commingOn, outingOn) {
    const activeFrom = commingOn ? commingWindow.from : sub.start;
    const activeTo = outingOn ? outingWindow.to : sub.end;
    const points = [
        activeFrom,                                          // null -> hiện
        commingOn ? commingWindow.to : activeFrom,           // comming -> in
        outingOn ? outingWindow.from : activeTo,             // in -> outing
        activeTo + SUBTITLE_BOUNDARY_EPS_SEC,                // -> null (ẩn)
    ];
    let next = Infinity;
    for (let i = 0; i < points.length; i++) {
        if (points[i] > t && points[i] < next) next = points[i];
    }
    return next;
}

/**
 * MỚI (07/10/2026 — BỔ SUNG hàm bị sót ở patch chống lệch phụ đề 06/10/2026, phương án A Giang chọn). event/workflow/
 * subtitle-display.js::_displayTime() gọi hàm này từ 06/10 nhưng nó chưa từng tồn tại -> mọi sync() phụ đề ném
 * ReferenceError (phụ đề Song không cập nhật theo 'timeupdate'/kéo thanh seek; cử chỉ seek-hold ở Song mất badge vì lỗi
 * xảy ra trước lúc vẽ badge). Vị trí media -> thời điểm phụ đề nên hiển thị: tiếng ra loa TRỄ hơn `currentTime` đúng
 * bằng độ trễ đầu ra của AudioContext (baseLatency + outputLatency) -> trừ đi để chữ khớp tiếng nghe thật. Trình duyệt
 * không báo giá trị nào (undefined/NaN) thì coi là 0 (không bù). Không trả số âm.
 * @param {number} mediaTimeSec @param {number|undefined} baseLatency @param {number|undefined} outputLatency @returns {number}
 */
function computeSubtitleDisplayTime(mediaTimeSec, baseLatency, outputLatency) {
    const base = Number.isFinite(baseLatency) ? baseLatency : 0;
    const output = Number.isFinite(outputLatency) ? outputLatency : 0;
    return Math.max(0, mediaTimeSec - base - output);
}
