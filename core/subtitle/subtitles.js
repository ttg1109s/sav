/**
 * core/subtitle/subtitles.js — Core THUẦN cho phụ đề của trang subtitle-editor.html: parse/build SRT, tạo/sửa/xoá/dịch giờ
 * dòng, kiểm tra số nhập ở modal Split/Shift. Mọi hàm nhận `subtitles` (mảng) qua tham số và trả mảng MỚI (không sửa mảng
 * gốc) — Workflow (event/workflow/subtitle-editor.js) tự đọc/ghi `appState` quanh các lời gọi.
 *
 * NẠP SAU: không phụ thuộc gì (không đụng DOM/appState/taskManager).
 */

/** @param {number} sec @returns {string} "HH:MM:SS,mmm" */
function secToStr(sec) {
    if (isNaN(sec) || sec < 0) return '00:00:00,000';
    // Làm tròn TỔNG ms 1 lần rồi mới tách h/m/s/ms — tách phần lẻ `sec % 1` dính sai số dấu phẩy động (2.3 % 1 =
    // 0.2999...), ",300" thành ",299", giờ hụt dần qua mỗi lần nhập/xuất.
    const totalMs = Math.round(sec * 1000);
    const h = Math.floor(totalMs / 3600000); const m = Math.floor((totalMs % 3600000) / 60000); const s = Math.floor((totalMs % 60000) / 1000); const ms = totalMs % 1000;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

/** @param {string} str "HH:MM:SS,mmm" @returns {number} giây (0 nếu parse lỗi) */
function strToSec(str) {
    const parts = String(str || '').trim().split(/[:,]/);
    if (parts.length !== 4) return 0;
    return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10) + parseInt(parts[3], 10) / 1000;
}

/** @param {string} data nội dung file .srt @returns {Array<Object>} */
function parseSRT(data) {
    // Chuẩn hoá xuống dòng (CRLF của Windows) + bỏ BOM đầu file trước — regex chỉ nhận `\n`.
    const text = String(data || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const regex = /(\d+)\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\n([\s\S]*?)(?=\n\n|\n*$)/g;
    const result = []; let match;
    while ((match = regex.exec(text)) !== null) {
        result.push({ id: `${Date.now()}-${Math.random()}`, start: strToSec(match[2]), end: strToSec(match[3]), startStr: match[2], endStr: match[3], text: match[4] });
    }
    return result;
}

/** @param {Array<Object>} subtitles (đã sắp xếp SẴN theo start — xem sortSubtitlesByStart()) @returns {string} */
function buildSRTString(subtitles) {
    let out = '';
    subtitles.forEach((s, i) => { out += `${i + 1}\n${s.startStr} --> ${s.endStr}\n${s.text}\n\n`; });
    return out.trim();
}

/** @param {Array<Object>} subtitles @returns {Array<Object>} bản SAO đã sắp xếp theo `start` tăng dần */
function sortSubtitlesByStart(subtitles) {
    return [...subtitles].sort((a, b) => a.start - b.start);
}

/**
 * Tạo 1 dòng sub mới từ khoảng [startSec, endSec] — dùng cho CẢ "Thêm dòng" (nối sau dòng cuối,
 * Workflow tự tính startSec/endSec trước khi gọi) LẪN "Lấy giờ từ vùng chọn" (Workflow đọc 2 tay
 * kéo waveform trước khi gọi) — CÙNG 1 hàm, khác NGUỒN của startSec/endSec (Workflow quyết định).
 * @param {string} text @param {number} startSec @param {number} endSec
 * @returns {{id: string, start: number, end: number, startStr: string, endStr: string, text: string}}
 */
function createSubtitleLine(text, startSec, endSec) {
    return { id: `${Date.now()}-${Math.random()}`, start: startSec, end: endSec, startStr: secToStr(startSec), endStr: secToStr(endSec), text };
}

/**
 * Trả về mảng MỚI với dòng `id` được cập nhật `changes` (KHÔNG sửa mảng gốc — Rule 1/2: hàm THUẦN,
 * không side-effect). `changes.start`/`changes.end` (nếu có) tự tính lại `startStr`/`endStr` đi
 * kèm — Workflow KHÔNG cần tự gọi `secToStr()` riêng.
 * @param {Array<Object>} subtitles @param {string} id
 * @param {{text?: string, start?: number, end?: number}} changes
 * @returns {Array<Object>}
 */
function computeUpdatedSubtitles(subtitles, id, changes) {
    return subtitles.map((sub) => {
        if (sub.id !== id) return sub;
        const next = { ...sub, ...changes };
        if (changes.start !== undefined) next.startStr = secToStr(changes.start);
        if (changes.end !== undefined) next.endStr = secToStr(changes.end);
        return next;
    });
}

/** @param {Array<Object>} subtitles @param {string} id @returns {Array<Object>} mảng MỚI không có dòng `id` */
function computeRemovedSubtitles(subtitles, id) {
    return subtitles.filter((sub) => sub.id !== id);
}

/**
 * Tool "Shift" — cộng `amountSec` (có thể ÂM, lùi giờ) vào start/end (hoặc cả
 * 2, theo `target`) của MỌI dòng có id nằm trong `ids` — hàm THUẦN (Rule 1/2), trả mảng MỚI, không
 * sửa mảng gốc. Clamp kết quả về 0 nếu ra âm (không cho giờ âm). Nếu kết quả khiến end <= start
 * (vd lùi "end" quá tay), BỎ QUA dòng đó (giữ nguyên, không áp) — tránh tạo dòng vô nghĩa hàng loạt
 * mà không ai kiểm tra kịp.
 * @param {Array<Object>} subtitles @param {Set<string>} ids @param {number} amountSec
 * @param {'start'|'end'|'both'} target
 * @returns {Array<Object>}
 */
function shiftSubtitleTimes(subtitles, ids, amountSec, target) {
    return subtitles.map((sub) => {
        if (!ids.has(sub.id)) return sub;
        let newStart = sub.start;
        let newEnd = sub.end;
        if (target === 'start' || target === 'both') newStart = Math.max(0, sub.start + amountSec);
        if (target === 'end' || target === 'both') newEnd = Math.max(0, sub.end + amountSec);
        if (newEnd <= newStart) return sub; // kết quả vô nghĩa -> bỏ qua, giữ nguyên dòng này
        return { ...sub, start: newStart, end: newEnd, startStr: secToStr(newStart), endStr: secToStr(newEnd) };
    });
}

/** Số dòng nhập ở modal Split (chuỗi thô của ô số) — hợp lệ khi là số nguyên ≥ 2.
 * @param {string} raw @returns {{isValid: boolean, count: number}} */
function resolveSubtitleSplitCount(raw) {
    const count = parseInt(raw, 10);
    return { isValid: Number.isFinite(count) && count >= 2, count };
}

/** Số giây dịch nhập ở modal Shift (chuỗi thô, cho phép âm) — hợp lệ khi là số khác 0.
 * @param {string} raw @returns {{isValid: boolean, amount: number}} */
function resolveSubtitleShiftAmount(raw) {
    const amount = parseFloat(raw);
    return { isValid: Number.isFinite(amount) && amount !== 0, amount };
}
