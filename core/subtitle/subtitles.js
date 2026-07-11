/**
 * core/subtitle/subtitles.js — Core NGHIỆP VỤ THUẦN cho phụ đề (parse/build SRT, tạo/sửa/xoá dòng)
 * — tuân Rule 1-5 ĐẦY ĐỦ (core-function-conventions.md).
 *
 * VIẾT LẠI HOÀN TOÀN (10/07/2026, Subtitle Editor chuyển sang trang riêng — phản hồi Giang) — bản
 * cũ (modal `#subtitle-modal`) từng đọc/ghi `appState.get('subtitles')` trực tiếp NGAY TRONG các
 * hàm này (vi phạm Rule 2) và trộn DOM read (`document.getElementById('edit-start-'+id)`) vào core
 * (vi phạm Rule 5). Bản MỚI: MỌI hàm ở đây THUẦN — nhận `subtitles` (mảng) làm THAM SỐ, trả về mảng
 * MỚI (không sửa mảng gốc) — Workflow (event/workflow/subtitle-editor.js) tự đọc/ghi `appState`
 * quanh các lời gọi này.
 *
 * UI MỚI (mỗi dòng LUÔN sửa được tại chỗ, không còn "chế độ sửa" ẩn/hiện qua click — xem
 * core/subtitle/subtitles-ui.js) không cần `editingSubId` nữa — state đó ĐÃ XOÁ khỏi
 * `service/state.js` (nếu còn sót, không dùng tới nữa, xoá tay khi tiện).
 *
 * NẠP SAU: không phụ thuộc gì (core THUẦN, không đụng DOM/appState/taskManager).
 */

/** @param {number} sec @returns {string} "HH:MM:SS,mmm" */
function secToStr(sec) {
    if (isNaN(sec) || sec < 0) return '00:00:00,000';
    const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); const s = Math.floor(sec % 60); const ms = Math.floor((sec % 1) * 1000);
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
    const regex = /(\d+)\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\n([\s\S]*?)(?=\n\n|\n*$)/g;
    const result = []; let match;
    while ((match = regex.exec(data)) !== null) {
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
