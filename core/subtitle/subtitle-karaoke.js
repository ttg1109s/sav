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
// MỚI (30/09/2026) — waveform mini + nghe từng từ trong drawer Karaoke giải mã RIÊNG file gốc ở tần số
// này (WaveSurfer chính giải mã mặc định 8000Hz — chỉ đủ vẽ sóng, nghe rất rè/đục, không đủ để canh chữ).
const KARAOKE_DECODE_SAMPLE_RATE = 22050;
// Bài dài hơn ngưỡng này (giây) KHÔNG giải mã riêng (tránh ngốn RAM trên điện thoại) — dùng lại dữ
// liệu 8000Hz của WaveSurfer chính.
const KARAOKE_HIRES_MAX_DURATION_SEC = 1200;
// Số ô peaks vẽ waveform mini (~ bề rộng khung x mật độ điểm ảnh màn hình điện thoại).
const KARAOKE_MINI_PEAK_BUCKETS = 1200;

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

/** MỚI (30/09/2026, sửa lỗi) — co/giãn `karaoke` đã lưu cho KHỚP thời lượng HIỆN TẠI của dòng — dùng
 * sau MỌI thao tác đổi start/end mà GIỮ nguyên chữ (sửa giờ dòng rồi ✓ Áp dụng, Shift chỉ start hoặc
 * chỉ end...). TRƯỚC ĐÂY tổng ms karaoke giữ nguyên số cũ trong khi dòng đã dài/ngắn đi -> mốc chia
 * vượt ra ngoài dòng, từ cuối bị cắt/hụt. Co/giãn theo TỈ LỆ trên các mốc cộng dồn (làm tròn từng
 * mốc, không làm tròn từng từ) -> tổng LUÔN khớp đúng thời lượng mới, không lệch vài ms. Dòng quá
 * ngắn không đủ sàn KARAOKE_MIN_WORD_MS cho mọi từ, hoặc tổng cũ = 0 -> chia đều lại.
 * Chỉ xử lý dòng có id trong `ids` VÀ có `karaoke` là mảng; dòng khác giữ nguyên tham chiếu.
 * @param {Array<Object>} subtitles @param {Set<string>} ids @returns {Array<Object>} mảng MỚI */
function fitSubtitlesKaraokeToDuration(subtitles, ids) {
    return subtitles.map((sub) => {
        if (!ids.has(sub.id) || !Array.isArray(sub.karaoke) || sub.karaoke.length === 0) return sub;
        const durationMs = Math.max(0, Math.round((sub.end - sub.start) * 1000));
        const count = sub.karaoke.length;
        const oldTotal = sub.karaoke.reduce((sum, pair) => sum + (Number(pair[1]) || 0), 0);
        if (oldTotal === durationMs) return sub;
        let msList;
        if (oldTotal <= 0 || durationMs < count * KARAOKE_MIN_WORD_MS) {
            const base = Math.floor(durationMs / count);
            msList = sub.karaoke.map((_, i) => (i === count - 1 ? durationMs - base * (count - 1) : base));
        } else {
            const ratio = durationMs / oldTotal;
            let cumOld = 0;
            let prevNew = 0;
            msList = sub.karaoke.map((pair, i) => {
                cumOld += Number(pair[1]) || 0;
                const boundary = i === count - 1 ? durationMs : Math.round(cumOld * ratio);
                const ms = boundary - prevNew;
                prevNew = boundary;
                return ms;
            });
            // Làm tròn có thể đẩy 1 từ rất ngắn xuống dưới sàn -> chia đều lại cho an toàn.
            if (msList.some((ms) => ms < KARAOKE_MIN_WORD_MS)) {
                const base = Math.floor(durationMs / count);
                msList = sub.karaoke.map((_, i) => (i === count - 1 ? durationMs - base * (count - 1) : base));
            }
        }
        return { ...sub, karaoke: sub.karaoke.map((pair, i) => [pair[0], msList[i]]) };
    });
}
