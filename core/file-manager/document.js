/**
 * core/file-manager/document.js — Documents (mục 4.b4 plan-v12-multimedia.md, code 04/07/2026).
 *
 * Schema record (store 'documents', service/db.js — CHỐT theo phản hồi Giang):
 *   { filename, title, content: string[], format: 'txt'|'docx', createdBy: 'upload'|'user', addedAt }
 *   - filename: tên file GỐC lúc upload (giữ NGUYÊN đuôi .docx/.txt dù nội dung lưu là text thuần
 *     — người dùng vẫn thấy đúng tên file họ đã chọn). Với tài liệu 'user' tạo mới, filename =
 *     title + '.txt' (LUÔN .txt — không có khái niệm "tạo mới .docx").
 *   - title: tên HIỂN THỊ, tách riêng khỏi filename để sửa được độc lập (không đụng identity/key).
 *   - content: MẢNG đoạn văn (KHÔNG phải 1 chuỗi dài) — mỗi phần tử là 1 đoạn, tách lúc upload/tạo
 *     (xem splitPlainTextIntoParagraphs()/extractParagraphsFromDocxHtml() dưới). Giữ dạng mảng để
 *     Reader phân trang theo ranh giới đoạn (không cắt ngang câu) và để sau này có thể sửa/thêm
 *     từng đoạn riêng lẻ nếu cần.
 *   - format: 'txt' | 'docx' — CHỈ để hiện icon/nhãn đúng loại gốc, KHÔNG ảnh hưởng cách đọc
 *     (content LUÔN là text thuần bất kể format).
 *   - createdBy: 'upload' (tải lên máy) | 'user' (tự tạo trong app) — CHỈ 'user' được phép SỬA nội
 *     dung trong Reader (đúng yêu cầu Giang — tài liệu upload là read-only).
 *
 * Core THUẦN — tuân Rule 1-4 (core-function-conventions.md, siết chặt 04/07/2026): KHÔNG tự gọi
 * hàm core khác (trừ service/db.js — coi là dịch vụ hạ tầng), KHÔNG tự appState.get(), KHÔNG dùng
 * taskManager. Orchestration (đọc file, gọi mammoth.js, hiện cảnh báo, lưu DB) sống ở
 * event/workflow/file-manager-document.js.
 *
 * NẠP SAU: service/db.js (getDocumentRecord/setDocumentRecord/deleteDocumentRecord/getAllDocumentKeys).
 */

/**
 * slugify + resolve key duy nhất cho 1 filename mới — CÙNG thuật toán resolveImageKey()
 * (core/file-manager/image.js)/resolveSongKey() (service/db.js), nhưng KHÔNG gọi thẳng 2 hàm đó
 * (Rule 3 mới: core không được gọi core khác) — tự lặp lại VÒNG LẶP kiểm tra trùng key tại đây.
 * `slugify()` (service/db.js) vẫn gọi thẳng được — đó là dịch vụ hạ tầng (service), không phải
 * "core khác".
 * @param {string} filename
 * @returns {Promise<string>}
 */
async function resolveDocumentKey(filename) {
    const baseSlug = slugify(filename) || 'document'; // service/db.js — dịch vụ hạ tầng, KHÔNG phải core-gọi-core
    let candidate = baseSlug;
    let suffix = 2;
    while (true) {
        const existing = await getDocumentRecord(candidate); // data layer
        if (!existing || existing.filename === filename) return candidate;
        candidate = `${baseSlug}-${suffix}`;
        suffix++;
    }
}

/**
 * Tách 1 chuỗi text thuần (.txt) thành mảng đoạn văn — ranh giới là DÒNG TRỐNG (1 dòng trống trở
 * lên), đúng quy ước đoạn văn phổ biến nhất. Lọc bỏ đoạn rỗng sau khi trim.
 * @param {string} text
 * @returns {string[]}
 */
function splitPlainTextIntoParagraphs(text) {
    return text
        .split(/\n\s*\n+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
}

/**
 * Tách HTML đã convert từ .docx (mammoth.convertToHtml().value) thành mảng đoạn văn — CHÍNH XÁC
 * hơn đoán theo xuống dòng: mammoth đã tự bọc mỗi đoạn gốc trong Word vào 1 thẻ <p> riêng, chỉ cần
 * đọc textContent của từng thẻ đó (bỏ HTML tag/style, giữ ĐÚNG text thuần). Lọc bỏ đoạn rỗng.
 * @param {string} html
 * @returns {string[]}
 */
function extractParagraphsFromDocxHtml(html) {
    const container = document.createElement('div');
    container.innerHTML = html;
    return Array.from(container.querySelectorAll('p'))
        .map((p) => p.textContent.trim())
        .filter((p) => p.length > 0);
}

/**
 * Lưu 1 tài liệu MỚI (upload HOẶC tự tạo) — record đã CHUẨN BỊ ĐẦY ĐỦ từ nơi gọi (workflow tự đọc
 * file/gọi mammoth.js/hiện cảnh báo trước khi tới đây — hàm này chỉ lưu NGUYÊN VẸN, 1 tiến trình).
 * @param {string} documentKey
 * @param {{filename: string, title: string, content: string[], format: 'txt'|'docx', createdBy: 'upload'|'user'}} record
 */
async function saveDocumentRecord(documentKey, record) {
    await setDocumentRecord(documentKey, { ...record, addedAt: Date.now() }); // data layer
}

/**
 * Đổi nội dung 1 tài liệu 'user' đã có — đọc lại record trước (giữ nguyên các field khác), CHỈ ghi
 * đè `content`. KHÔNG tự kiểm tra `createdBy === 'user'` ở đây (Rule 1: đó là 1 QUYẾT ĐỊNH nghiệp
 * vụ khác, thuộc về nơi gọi — workflow tự kiểm tra trước khi gọi hàm này).
 * @param {string} documentKey
 * @param {string[]} content
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
async function updateDocumentContent(documentKey, content) {
    const record = await getDocumentRecord(documentKey); // data layer
    if (!record) return { status: 'notFound' };
    await setDocumentRecord(documentKey, { ...record, content }); // data layer
    return { status: 'ok' };
}

/**
 * Đổi tên hiển thị (title) 1 tài liệu bất kỳ (kể cả 'upload' — đổi TITLE không phải đổi NỘI DUNG,
 * nên KHÔNG vi phạm "chỉ user mới sửa được").
 * @param {string} documentKey
 * @param {string} title
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
async function renameDocumentTitle(documentKey, title) {
    const record = await getDocumentRecord(documentKey); // data layer
    if (!record) return { status: 'notFound' };
    await setDocumentRecord(documentKey, { ...record, title }); // data layer
    return { status: 'ok' };
}

/** Xoá hẳn 1 tài liệu. */
async function deleteDocument(documentKey) {
    await deleteDocumentRecord(documentKey); // data layer
}

/**
 * Liệt kê TOÀN BỘ document, kèm key — sắp xếp mới nhất trước (addedAt giảm dần).
 * @returns {Promise<Array<{key: string, filename: string, title: string, content: string[], format: string, createdBy: string, addedAt: number}>>}
 */
async function listDocuments() {
    const keys = await getAllDocumentKeys(); // data layer
    const records = await Promise.all(keys.map(async (key) => {
        const record = await getDocumentRecord(key); // data layer
        return record ? { key, ...record } : null;
    }));
    return records.filter(Boolean).sort((a, b) => b.addedAt - a.addedAt);
}
