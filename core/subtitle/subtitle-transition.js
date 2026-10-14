/**
 * core/subtitle/subtitle-transition.js — Core THUẦN hiệu ứng Comming/In/Outing của dòng phụ đề trên Visualizer. Cài đặt
 * effect/valueMs chung mọi dòng (vizConfig.subtitleCommingEffect/InEffect/OutingEffect + ValueMs); khung giờ tính riêng
 * từng dòng, neo vào start/end của chính dòng đó.
 *
 * Khung (ví dụ dòng start=5 end=10): Comming neo start, value=-2 -> [3,5], +2 -> [5,7]; Outing neo end, +2 -> [10,12],
 * -2 -> [8,10]. Kẹp |value| <= 1/3 thời lượng dòng, mốc không < 0.
 *
 * Hiệu ứng Comming/Outing chạy bằng Web Animation ĐƯỢC GHIM theo thời gian media (computeSubtitlePhasePin()): tiến độ
 * = vị trí media trong khung, đứng yên khi media dừng, theo tốc độ phát — seek / pause / repeat / ẩn tab lâu đều về đúng.
 */

/** Biên nhập liệu (ms) cho Comming/Outing — biên áp dụng thật còn bị kẹp 1/3 thời lượng dòng. */
const SUBTITLE_TRANSITION_MAX_MS = 5000;

/** Keyframe trạng thái ẩn lúc VÀO (`enter`) và lúc RA (`exit`) — Comming: enter -> hiện, Outing: hiện -> exit. Slide up =
 * vào từ dưới lên, ra tiếp tục đi lên (slide down ngược lại). */
const SUBTITLE_TRANSITION_EFFECTS = {
    fade: { enter: { opacity: 0 }, exit: { opacity: 0 } },
    'slide-up': { enter: { opacity: 0, transform: 'translateY(12px)' }, exit: { opacity: 0, transform: 'translateY(-12px)' } },
    'slide-down': { enter: { opacity: 0, transform: 'translateY(-12px)' }, exit: { opacity: 0, transform: 'translateY(12px)' } },
    scale: { enter: { opacity: 0, transform: 'scale(0.85)' }, exit: { opacity: 0, transform: 'scale(0.85)' } },
};
const SUBTITLE_VISIBLE_KEYFRAME = { opacity: 1, transform: 'none' };

/** Hiệu ứng In: class chạy liên tục suốt pha in (keyframe ở assets/css/base.css). */
const SUBTITLE_IN_EFFECTS = {
    pulse: 'sub-in-pulse',
    glow: 'sub-in-glow',
};

/** Dòng hết hiệu lực khi t > activeTo, nên mốc "ẩn" đặt sau đó 1 chút. */
const SUBTITLE_BOUNDARY_EPS_SEC = 0.001;

/** Các dòng đang hiệu lực tại `t` + mốc gần nhất (> t) mà pha của 1 dòng bất kỳ sẽ đổi (null -> comming/in -> outing ->
 * null). Effect nào tắt ('none') thì không mở rộng khung phía đó.
 * @param {Array<{id: string, start: number, end: number}>} subtitles @param {number} t - thời điểm hiển thị (giây)
 * @param {object} cfg - vizConfig (subtitleCommingEffect/ValueMs, subtitleOutingEffect/ValueMs)
 * @returns {{entries: Array<{sub: object, phase: 'comming'|'in'|'outing', commingWindow: {from: number, to: number},
 *   outingWindow: {from: number, to: number}}>, nextBoundarySec: number}} */
function computeSubtitleLineStates(subtitles, t, cfg) {
    const commingOn = cfg.subtitleCommingEffect !== 'none';
    const outingOn = cfg.subtitleOutingEffect !== 'none';
    const entries = [];
    let nextBoundarySec = Infinity;
    subtitles.forEach((sub) => {
        const capMs = ((sub.end - sub.start) * 1000) / 3;
        const [commingWindow, outingWindow] = [[sub.start, cfg.subtitleCommingValueMs], [sub.end, cfg.subtitleOutingValueMs]].map(([anchor, valueMs]) => {
            const other = anchor + Math.max(-capMs, Math.min(capMs, valueMs || 0)) / 1000;
            return { from: Math.max(0, Math.min(anchor, other)), to: Math.max(anchor, other) };
        });
        const activeFrom = commingOn ? commingWindow.from : sub.start;
        const activeTo = outingOn ? outingWindow.to : sub.end;
        const boundaries = [
            activeFrom,
            commingOn ? commingWindow.to : activeFrom,
            outingOn ? outingWindow.from : activeTo,
            activeTo + SUBTITLE_BOUNDARY_EPS_SEC,
        ];
        boundaries.forEach((point) => { nextBoundarySec = point > t ? Math.min(nextBoundarySec, point) : nextBoundarySec; });
        if (t < activeFrom || t > activeTo) return;
        const phase = (commingOn && t < commingWindow.to) ? 'comming' : ((outingOn && t >= outingWindow.from) ? 'outing' : 'in');
        entries.push({ sub, phase, commingWindow, outingWindow });
    });
    return { entries, nextBoundarySec };
}

/** Khối cần gỡ / thêm so với lần đồng bộ trước. @param {Set<string>} prevIds @param {Array<{sub: {id: string}}>} entries
 * @returns {{removeIds: string[], addEntries: Array<object>, nextIds: Set<string>, layoutChanged: boolean}} */
function diffSubtitleActiveLines(prevIds, entries) {
    const nextIds = new Set(entries.map((entry) => entry.sub.id));
    const removeIds = Array.from(prevIds).filter((id) => !nextIds.has(id));
    const addEntries = entries.filter((entry) => !prevIds.has(entry.sub.id));
    return { removeIds, addEntries, nextIds, layoutChanged: removeIds.length > 0 || addEntries.length > 0 };
}

/** Ghim hiệu ứng Comming/Outing của 1 dòng theo thời gian media: thời lượng khung, tiến độ hiện tại, có chạy tiếp không
 * (media đang phát và chưa hết khung — chạy tiếp ở cuối khung thì Web Animation tự tua về đầu).
 * @param {{from: number, to: number}} phaseWindow @param {number} t @param {boolean} isMediaRunning
 * @returns {{durationMs: number, elapsedMs: number, running: boolean}} */
function computeSubtitlePhasePin(phaseWindow, t, isMediaRunning) {
    const durationMs = Math.max(1, (phaseWindow.to - phaseWindow.from) * 1000);
    const elapsedMs = Math.max(0, Math.min(durationMs, (t - phaseWindow.from) * 1000));
    return { durationMs, elapsedMs, running: isMediaRunning && elapsedMs < durationMs };
}

const SUBTITLE_PHASE_EASING = { comming: 'ease-out', outing: 'ease-in' };

/** Keyframe + easing của hiệu ứng pha: Comming = enter -> hiện, Outing = hiện -> exit. Effect lạ -> null (không hiệu ứng).
 * @param {string} effectName @param {'comming'|'outing'} phase @returns {{keyframes: Keyframe[], easing: string}|null} */
function resolveSubtitlePhaseAnimation(effectName, phase) {
    const fx = SUBTITLE_TRANSITION_EFFECTS[effectName];
    if (!fx) return null;
    return {
        keyframes: phase === 'comming' ? [fx.enter, SUBTITLE_VISIBLE_KEYFRAME] : [SUBTITLE_VISIBLE_KEYFRAME, fx.exit],
        easing: SUBTITLE_PHASE_EASING[phase],
    };
}

/** Đồng hồ media cho hiệu ứng pha: chạy khi đang phát và không kéo thanh tiến trình (lúc kéo phụ đề đứng ở mốc kéo).
 * @param {boolean} isPaused @param {boolean} isSeeking @param {number} playbackRate @returns {{running: boolean, rate: number}} */
function computeSubtitleMediaClock(isPaused, isSeeking, playbackRate) {
    return { running: !isPaused && !isSeeking, rate: playbackRate || 1 };
}

/** Đồng hồ mốc không còn việc: media dừng hoặc hết mốc phía trước. @param {boolean} isPaused @param {number} nextBoundarySec */
function isSubtitleClockIdle(isPaused, nextBoundarySec) {
    return isPaused || nextBoundarySec === Infinity;
}

/** Vị trí media -> thời điểm phụ đề nên hiển thị: tiếng ra loa trễ hơn `currentTime` đúng bằng độ trễ đầu ra của
 * AudioContext (baseLatency + outputLatency) -> trừ đi để chữ khớp tiếng nghe thật. Không báo -> 0. Không âm.
 * @param {number} mediaTimeSec @param {number|undefined} baseLatency @param {number|undefined} outputLatency @returns {number} */
function computeSubtitleDisplayTime(mediaTimeSec, baseLatency, outputLatency) {
    const base = Number.isFinite(baseLatency) ? baseLatency : 0;
    const output = Number.isFinite(outputLatency) ? outputLatency : 0;
    return Math.max(0, mediaTimeSec - base - output);
}

/** Đồng hồ mốc: đồng bộ khi tới mốc kế tiếp hoặc thời gian lùi (tua lùi / lặp bài).
 * @param {number} t @param {number|null} lastSec - t ở khung hình trước @param {number} nextBoundarySec @returns {boolean} */
function shouldSyncSubtitleClock(t, lastSec, nextBoundarySec) {
    return t >= nextBoundarySec || (lastSec !== null && t < lastSec);
}

/** Dòng log chẩn đoán độ trễ đầu ra (Debug console). @param {number|undefined} baseLatency @param {number|undefined} outputLatency */
function formatSubtitleLatencyLog(baseLatency, outputLatency) {
    const fmt = (v) => (typeof v === 'number' ? `${v.toFixed(3)}s` : 'n/a');
    return `[workflowSubtitleDisplay] độ trễ đầu ra AudioContext: baseLatency=${fmt(baseLatency)}, outputLatency=${fmt(outputLatency)} — đang bù vào phụ đề (n/a = trình duyệt không báo, không bù)`;
}
