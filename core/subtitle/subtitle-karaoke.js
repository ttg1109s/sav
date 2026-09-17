/**
 * core/subtitle/subtitle-karaoke.js — Core nghiệp vụ THUẦN cho karaoke timing theo từ (tách từ từ
 * text 1 dòng phụ đề, chia đều ms mặc định, kéo tay/gõ số chỉnh lại theo kiểu Aegisub — kéo 1 mốc
 * chia CHỈ đổi 2 từ liền kề, tổng ms toàn dòng LUÔN giữ nguyên) — tuân Rule 1-5
 * (core-function-conventions.md).
 *
 * MỚI (17/09/2026, yêu cầu Giang — bổ sung tính năng karaoke).
 *
 * Định dạng LƯU (field `karaoke` của 1 dòng phụ đề, xem core/subtitle/subtitles.js::
 * createSubtitleLine()): `null` (chưa timing) hoặc mảng cặp `[[từ, ms], [từ, ms], ...]` — ms là
 * THỜI LƯỢNG riêng của từ đó (không phải mốc tuyệt đối) — cộng dồn ra vị trí phát thật = start
 * dòng + tổng ms các từ TRƯỚC nó (xem computeKaraokeWordPlayRange()).
 *
 * Định dạng LÀM VIỆC (lúc drawer đang mở, Workflow giữ ở `appState._karaokeWords`): mảng object
 * `{word, ms}` — tiện thao tác hơn mảng cặp lúc render/tính toán, quy đổi 2 chiều qua
 * karaokeArrayToWorkingWords()/workingWordsToKaraokeArray().
 *
 * NẠP SAU: không phụ thuộc gì (core THUẦN, không đụng DOM/appState/taskManager).
 */

const KARAOKE_MIN_WORD_MS = 10; // sàn thời lượng 1 từ — kéo tay/gõ số không bao giờ cho về 0 hay âm

/** Tách text 1 dòng thành mảng TỪ (theo khoảng trắng, mỗi từ = 1 âm tiết tiếng Việt) — bỏ chuỗi
 * rỗng/toàn khoảng trắng. @param {string} text @returns {Array<string>} */
function splitTextIntoKaraokeWords(text) {
    return String(text || '').trim().split(/\s+/).filter((w) => w.length > 0);
}

/** Chia ĐỀU `durationMs` cho các từ tách từ `text` — dùng lúc dòng CHƯA có `karaoke` timing (hoặc
 * đã có nhưng lệch text hiện tại, xem isKaraokeMatchingText()). Dư ra (chia không hết) dồn hết vào
 * từ CUỐI — tổng luôn khớp CHÍNH XÁC `durationMs`, không lệch vài mili giây do làm tròn.
 * @param {string} text @param {number} durationMs @returns {Array<{word: string, ms: number}>} */
function buildDefaultKaraokeWordMs(text, durationMs) {
    const words = splitTextIntoKaraokeWords(text);
    if (words.length === 0) return [];
    const base = Math.floor(durationMs / words.length);
    const remainder = durationMs - base * words.length;
    return words.map((word, i) => ({ word, ms: i === words.length - 1 ? base + remainder : base }));
}

/** Quy đổi mảng LƯU `[[từ, ms], ...]` -> mảng LÀM VIỆC `{word, ms}` (Workflow đọc lúc mở drawer,
 * có sẵn timing từ lần Apply trước). @param {Array<Array>} karaokeArray
 * @returns {Array<{word: string, ms: number}>} */
function karaokeArrayToWorkingWords(karaokeArray) {
    if (!Array.isArray(karaokeArray)) return [];
    return karaokeArray.map(([word, ms]) => ({ word, ms }));
}

/** Chiều ngược lại karaokeArrayToWorkingWords() — Workflow gọi lúc bấm "Áp dụng", ghi thẳng vào
 * field `karaoke` của dòng. @param {Array<{word: string, ms: number}>} words @returns {Array<Array>} */
function workingWordsToKaraokeArray(words) {
    return words.map((w) => [w.word, w.ms]);
}

/** So khớp `karaokeArray` đã lưu với `text` HIỆN TẠI của dòng — dùng để phát hiện timing đã CŨ (vd
 * người dùng thêm/bớt từ sau khi đã timing, xem event/workflow/subtitle-editor.js::applyLineEdit())
 * — so ĐÚNG số từ + ĐÚNG thứ tự/nội dung từng từ, khác đi (kể cả chỉ 1 từ) coi là KHÔNG khớp.
 * @param {Array<Array>|null|undefined} karaokeArray @param {string} text @returns {boolean} */
function isKaraokeMatchingText(karaokeArray, text) {
    if (!Array.isArray(karaokeArray)) return false;
    const words = splitTextIntoKaraokeWords(text);
    if (karaokeArray.length !== words.length) return false;
    return karaokeArray.every(([word], i) => word === words[i]);
}

/** Mốc chia CỘNG DỒN (ms, tính từ đầu dòng = 0) của `words` — mảng dài N+1 (N = số từ): phần tử 0
 * luôn = 0, phần tử cuối luôn = tổng ms. Dùng để vẽ mốc chia trên waveform mini + tính giờ phát
 * từng từ (xem computeKaraokeWordPlayRange()).
 * @param {Array<{word: string, ms: number}>} words @returns {Array<number>} */
function computeKaraokeWordBoundariesMs(words) {
    const boundaries = [0];
    let cum = 0;
    words.forEach((w) => { cum += w.ms; boundaries.push(cum); });
    return boundaries;
}

/** LÕI kéo tay/gõ số chỉnh timing — CÙNG 1 hàm cho CẢ kéo mốc chia trên waveform LẪN gõ số ms trực
 * tiếp (Workflow tự quy đổi gõ số -> đúng lời gọi hàm này, xem applyKaraokeWordMsInput() ngay
 * dưới). Kéo mốc chia `dividerIndex` (mốc NẰM GIỮA words[dividerIndex] và words[dividerIndex+1])
 * tới vị trí cộng dồn MỚI `newBoundaryMs` — CHỈ 2 từ liền kề mốc đó đổi thời lượng (cộng/trừ NGƯỢC
 * NHAU đúng phần chênh lệch), mọi từ khác GIỮ NGUYÊN — tổng ms toàn dòng vì vậy LUÔN giữ nguyên
 * (đúng yêu cầu Giang "giống Aegisub"). Kẹp `newBoundaryMs` trong khoảng [mốc trước +
 * KARAOKE_MIN_WORD_MS, mốc sau - KARAOKE_MIN_WORD_MS] — không bao giờ cho 1 từ về 0/âm hay 2 mốc
 * chia vượt qua nhau.
 * @param {Array<{word: string, ms: number}>} words @param {number} dividerIndex (0..words.length-2)
 * @param {number} newBoundaryMs
 * @returns {Array<{word: string, ms: number}>} mảng MỚI (Rule 1/2, không sửa mảng gốc) */
function redistributeKaraokeBoundary(words, dividerIndex, newBoundaryMs) {
    if (dividerIndex < 0 || dividerIndex > words.length - 2) return words; // mốc không hợp lệ — bỏ qua, giữ nguyên
    const boundaries = computeKaraokeWordBoundariesMs(words);
    const prevBoundary = boundaries[dividerIndex]; // mốc TRƯỚC words[dividerIndex]
    const nextBoundary = boundaries[dividerIndex + 2]; // mốc SAU words[dividerIndex+1]
    const minAllowed = prevBoundary + KARAOKE_MIN_WORD_MS;
    const maxAllowed = nextBoundary - KARAOKE_MIN_WORD_MS;
    if (minAllowed > maxAllowed) return words; // 2 từ liền kề đã sát sàn tối thiểu, không còn chỗ kéo — bỏ qua
    const clamped = Math.min(maxAllowed, Math.max(minAllowed, Math.round(newBoundaryMs)));
    return words.map((w, i) => {
        if (i === dividerIndex) return { ...w, ms: clamped - prevBoundary };
        if (i === dividerIndex + 1) return { ...w, ms: nextBoundary - clamped };
        return w;
    });
}

/** Gõ trực tiếp ms của words[wordIndex] (ô input số, xem components/subtitle-karaoke-drawer.js) —
 * quy đổi thành ĐÚNG 1 lời gọi redistributeKaraokeBoundary() để GIỮ tổng ms không đổi CÙNG khuôn
 * kéo tay: từ KHÔNG PHẢI cuối cùng -> coi như kéo mốc NGAY SAU nó (dividerIndex = wordIndex); từ
 * CUỐI CÙNG (không có mốc sau) -> coi như kéo mốc NGAY TRƯỚC nó (dividerIndex = wordIndex - 1),
 * tính lại vị trí mốc từ `newMs` mong muốn của từ cuối (mốc mới = tổng - newMs).
 * @param {Array<{word: string, ms: number}>} words @param {number} wordIndex @param {number} newMs
 * @returns {Array<{word: string, ms: number}>} */
function applyKaraokeWordMsInput(words, wordIndex, newMs) {
    if (words.length < 2) return words; // 1 từ duy nhất — không có mốc nào để chỉnh, tổng luôn = ms từ đó
    const boundaries = computeKaraokeWordBoundariesMs(words);
    const total = boundaries[boundaries.length - 1];
    if (wordIndex < words.length - 1) {
        const newBoundary = boundaries[wordIndex] + newMs; // mốc NGAY SAU words[wordIndex]
        return redistributeKaraokeBoundary(words, wordIndex, newBoundary);
    }
    const newBoundary = total - newMs; // từ CUỐI — mốc NGAY TRƯỚC nó
    return redistributeKaraokeBoundary(words, wordIndex - 1, newBoundary);
}

/** Giờ phát [start,end] (giây, TUYỆT ĐỐI trong bài hát) của words[wordIndex] — start dòng + mốc
 * cộng dồn TRƯỚC/SAU từ đó (đổi ms -> giây). Dùng cho nút ▶ từng từ (xem components/
 * subtitle-karaoke-drawer.js + event/workflow/subtitle-editor.js::_toggleKaraokeWordPlay()).
 * @param {Array<{word: string, ms: number}>} words @param {number} lineStartSec @param {number} wordIndex
 * @returns {{start: number, end: number}} */
function computeKaraokeWordPlayRange(words, lineStartSec, wordIndex) {
    const boundaries = computeKaraokeWordBoundariesMs(words);
    return { start: lineStartSec + boundaries[wordIndex] / 1000, end: lineStartSec + boundaries[wordIndex + 1] / 1000 };
}
