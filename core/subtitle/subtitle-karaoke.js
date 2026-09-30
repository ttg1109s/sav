/**
 * core/subtitle/subtitle-karaoke.js — Core THUẦN karaoke timing theo từ (dùng ở CẢ subtitle-editor.html lẫn
 * index.html). Không đụng DOM/appState/taskManager, không hàm nào gọi hàm khác trong file (Rule 3).
 *
 * Định dạng LƯU (field `karaoke` của 1 dòng): `null` hoặc `[[từ, ms], ...]` — ms là THỜI LƯỢNG của từ, cộng dồn
 * từ start dòng ra mốc thật. Định dạng LÀM VIỆC trong drawer Karaoke: `[{word, ms}]`.
 * Kéo/gõ chỉnh timing kiểu Aegisub: 1 mốc chia chỉ đổi 2 từ liền kề, tổng ms luôn = thời lượng dòng.
 */

const KARAOKE_MIN_WORD_MS = 10; // sàn thời lượng 1 từ
// Drawer Karaoke (subtitle-editor.html) giải mã riêng file gốc ở tần số này — WaveSurfer chính chỉ giải mã 8000Hz (nghe đục).
const KARAOKE_DECODE_SAMPLE_RATE = 22050;
const KARAOKE_HIRES_MAX_DURATION_SEC = 1200; // bài dài hơn -> dùng lại PCM 8000Hz của waveform chính (đỡ RAM)
const KARAOKE_MINI_PEAK_BUCKETS = 1200; // số ô peaks tối thiểu của waveform mini
const KARAOKE_MINI_MIN_WORD_PX = 56; // bề rộng trung bình tối thiểu 1 từ trên waveform mini — vượt khung thì cuộn ảo
const KARAOKE_MINI_HEIGHT_PX = 88; // PHẢI khớp #karaoke-mini-waveform (components/subtitle-karaoke-drawer.js)

/** Chia đều `durationMs` cho các từ của `text` — phần dư dồn vào từ cuối (tổng khớp chính xác).
 * @param {string} text @param {number} durationMs @returns {Array<{word: string, ms: number}>} */
function buildDefaultKaraokeWordMs(text, durationMs) {
    const words = String(text || '').trim().split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) return [];
    const base = Math.floor(durationMs / words.length);
    const remainder = durationMs - base * words.length;
    return words.map((word, i) => ({ word, ms: i === words.length - 1 ? base + remainder : base }));
}

/** `[[từ, ms]]` -> `[{word, ms}]`. @param {Array<Array>} karaokeArray @returns {Array<{word: string, ms: number}>} */
function karaokeArrayToWorkingWords(karaokeArray) {
    if (!Array.isArray(karaokeArray)) return [];
    return karaokeArray.map(([word, ms]) => ({ word, ms }));
}

/** `[{word, ms}]` -> `[[từ, ms]]`. @param {Array<{word: string, ms: number}>} words @returns {Array<Array>} */
function workingWordsToKaraokeArray(words) {
    return words.map((w) => [w.word, w.ms]);
}

/** Timing đã lưu còn khớp text hiện tại không (đúng số từ + đúng từng từ theo thứ tự).
 * @param {Array<Array>|null|undefined} karaokeArray @param {string} text @returns {boolean} */
function isKaraokeMatchingText(karaokeArray, text) {
    if (!Array.isArray(karaokeArray)) return false;
    const words = String(text || '').trim().split(/\s+/).filter((w) => w.length > 0);
    if (karaokeArray.length !== words.length) return false;
    return karaokeArray.every(([word], i) => word === words[i]);
}

/** Mốc chia cộng dồn (ms, 0 = đầu dòng), dài N+1. @param {Array<{ms: number}>} words @returns {Array<number>} */
function computeKaraokeWordBoundariesMs(words) {
    const boundaries = [0];
    let cum = 0;
    words.forEach((w) => { cum += w.ms; boundaries.push(cum); });
    return boundaries;
}

/** Kéo mốc chia `dividerIndex` (giữa words[i] và words[i+1]) tới `newBoundaryMs` — chỉ 2 từ liền kề đổi, kẹp
 * để không từ nào dưới KARAOKE_MIN_WORD_MS. Trả mảng MỚI (không đổi mảng gốc).
 * @param {Array<{word: string, ms: number}>} words @param {number} dividerIndex @param {number} newBoundaryMs
 * @returns {Array<{word: string, ms: number}>} */
function redistributeKaraokeBoundary(words, dividerIndex, newBoundaryMs) {
    if (dividerIndex < 0 || dividerIndex > words.length - 2) return words;
    let prevBoundary = 0;
    for (let i = 0; i < dividerIndex; i++) prevBoundary += words[i].ms;
    const nextBoundary = prevBoundary + words[dividerIndex].ms + words[dividerIndex + 1].ms;
    const minAllowed = prevBoundary + KARAOKE_MIN_WORD_MS;
    const maxAllowed = nextBoundary - KARAOKE_MIN_WORD_MS;
    if (minAllowed > maxAllowed) return words;
    const clamped = Math.min(maxAllowed, Math.max(minAllowed, Math.round(newBoundaryMs)));
    return words.map((w, i) => {
        if (i === dividerIndex) return { ...w, ms: clamped - prevBoundary };
        if (i === dividerIndex + 1) return { ...w, ms: nextBoundary - clamped };
        return w;
    });
}

/** Gõ ms trực tiếp cho words[wordIndex] -> quy ra mốc cần kéo: từ không phải cuối = mốc NGAY SAU nó; từ cuối =
 * mốc NGAY TRƯỚC nó. Workflow đưa kết quả vào redistributeKaraokeBoundary(). `null` = không có mốc (dòng 1 từ).
 * @param {Array<{ms: number}>} words @param {number} wordIndex @param {number} newMs
 * @returns {{dividerIndex: number, boundaryMs: number}|null} */
function computeKaraokeInputBoundary(words, wordIndex, newMs) {
    if (words.length < 2) return null;
    let before = 0;
    for (let i = 0; i < wordIndex; i++) before += words[i].ms;
    const total = words.reduce((sum, w) => sum + w.ms, 0);
    const isLast = wordIndex >= words.length - 1;
    return isLast
        ? { dividerIndex: words.length - 2, boundaryMs: total - newMs }
        : { dividerIndex: wordIndex, boundaryMs: before + newMs };
}

/** Giờ phát [start,end] (giây) của words[wordIndex], tính từ `lineStartSec`.
 * @param {Array<{ms: number}>} words @param {number} lineStartSec @param {number} wordIndex
 * @returns {{start: number, end: number}} */
function computeKaraokeWordPlayRange(words, lineStartSec, wordIndex) {
    let before = 0;
    for (let i = 0; i < wordIndex; i++) before += words[i].ms;
    return { start: lineStartSec + before / 1000, end: lineStartSec + (before + words[wordIndex].ms) / 1000 };
}

/** Co/giãn `karaoke` của các dòng trong `ids` cho khớp thời lượng hiện tại (tỉ lệ trên mốc cộng dồn, làm tròn
 * từng mốc — tổng luôn đúng). Dòng quá ngắn không đủ sàn cho mọi từ, hoặc tổng cũ = 0 -> chia đều.
 * @param {Array<Object>} subtitles @param {Set<string>} ids @returns {Array<Object>} */
function fitSubtitlesKaraokeToDuration(subtitles, ids) {
    return subtitles.map((sub) => {
        if (!ids.has(sub.id) || !Array.isArray(sub.karaoke) || sub.karaoke.length === 0) return sub;
        const durationMs = Math.max(0, Math.round((sub.end - sub.start) * 1000));
        const count = sub.karaoke.length;
        const oldTotal = sub.karaoke.reduce((sum, pair) => sum + (Number(pair[1]) || 0), 0);
        if (oldTotal === durationMs) return sub;
        const base = Math.floor(durationMs / count);
        const equalSplit = sub.karaoke.map((_, i) => (i === count - 1 ? durationMs - base * (count - 1) : base));
        const ratio = oldTotal > 0 ? durationMs / oldTotal : 0;
        let cumOld = 0;
        let prevNew = 0;
        const scaled = sub.karaoke.map((pair, i) => {
            cumOld += Number(pair[1]) || 0;
            const boundary = i === count - 1 ? durationMs : Math.round(cumOld * ratio);
            const ms = boundary - prevNew;
            prevNew = boundary;
            return ms;
        });
        const scaledValid = oldTotal > 0 && durationMs >= count * KARAOKE_MIN_WORD_MS && scaled.every((ms) => ms >= KARAOKE_MIN_WORD_MS);
        const msList = scaledValid ? scaled : equalSplit;
        return { ...sub, karaoke: sub.karaoke.map((pair, i) => [pair[0], msList[i]]) };
    });
}
