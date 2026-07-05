/**
 * core/file-manager/document.js — Documents (mục 4.b4 plan-v12-multimedia.md, code 04/07/2026).
 *
 * ĐỔI SCHEMA (05/07/2026, mục 5 phản hồi Giang — "sửa thuật toán tách đoạn, dùng thư viện ngoài"):
 * `content` đổi từ MẢNG đoạn văn text thuần (`string[]`) sang **1 chuỗi Markdown duy nhất**
 * (`string`). Bỏ hẳn thuật toán tự tách đoạn bằng regex (`splitPlainTextIntoParagraphs()`/
 * `extractParagraphsFromDocxHtml()` — ĐÃ XOÁ) — Giang chọn hướng "Markdown đơn giản + WYSIWYG"
 * (option 3, format ngay khi đang gõ): trình soạn thảo TOAST UI Editor (mục 5, CDN
 * `toastui-editor-all.min.js`, xem `event/workflow/file-manager-document.js`/
 * `core/file-manager/document-ui.js::openDocumentEditorDrawer`) hiển thị format NGAY trong lúc sửa
 * (chế độ `wysiwyg`) nhưng vẫn LƯU/XUẤT ra đúng 1 chuỗi Markdown thuần qua `editor.getMarkdown()` —
 * không cần app tự tách đoạn nữa, thư viện lo hết phần parse/serialize.
 *
 * Schema record (store 'documents', service/db.js):
 *   { filename, title, content: string, format: 'txt'|'docx', createdBy: 'upload'|'user', addedAt }
 *   - filename: tên file GỐC lúc upload (giữ NGUYÊN đuôi .docx/.txt dù nội dung lưu là Markdown
 *     thuần — người dùng vẫn thấy đúng tên file họ đã chọn). Với tài liệu 'user' tạo mới, filename =
 *     title + '.txt' (LUÔN .txt — không có khái niệm "tạo mới .docx").
 *   - title: tên HIỂN THỊ, tách riêng khỏi filename để sửa được độc lập (không đụng identity/key).
 *   - content: 1 chuỗi MARKDOWN (KHÔNG còn là mảng đoạn). `.txt` lưu THẲNG nội dung file (đã là
 *     text hợp lệ để coi như Markdown — không cú pháp đặc biệt thì hiển thị y hệt text thường).
 *     `.docx` chuyển qua mammoth.js -> HTML -> **Turndown** (thư viện ngoài, HTML->Markdown, CDN
 *     `turndown.js`) NGAY TRONG workflow (gọi trực tiếp, giống cách `mammoth` đã được gọi — KHÔNG
 *     wrap qua 1 hàm core riêng, coi như dịch vụ ngoài giống mammoth) — giữ được đậm/nghiêng/tiêu
 *     đề/danh sách (khác bản cũ: MẤT HẲN mọi định dạng), chỉ ảnh/bảng/định dạng phức tạp mới có thể
 *     bị rụng (xem `docxWarningBody` đã cập nhật lại lời cảnh báo cho đúng thực tế mới).
 *   - **Tương thích ngược**: record CŨ (tạo trước 05/07/2026) vẫn có `content` dạng `string[]` —
 *     dùng `resolveDocumentMarkdown(record)` dưới đây ở MỌI nơi ĐỌC `content` (Reader/Editor/tải
 *     về/tính dung lượng) để tự quy về 1 chuỗi Markdown, KHÔNG cần script migrate hàng loạt (đúng
 *     tinh thần "mỗi bài tự nâng cấp khi đụng tới" đã áp dụng cho `coverImageKey` — xem
 *     readme/song-cover-background-relations.md mục 3.2). Record MỚI (upload/tạo/sửa từ giờ) LUÔN
 *     ghi `content` dạng `string`.
 *   - format: 'txt' | 'docx' — CHỈ để hiện icon/nhãn đúng loại gốc, KHÔNG ảnh hưởng cách đọc.
 *   - createdBy: 'upload' (tải lên máy) | 'user' (tự tạo trong app) — CHỈ 'user' được phép SỬA nội
 *     dung (đúng yêu cầu Giang — tài liệu upload là read-only).
 *
 * Core THUẦN — tuân Rule 1-4 (core-function-conventions.md, siết chặt 04/07/2026): KHÔNG tự gọi
 * hàm core khác (trừ service/db.js — coi là dịch vụ hạ tầng), KHÔNG tự appState.get(), KHÔNG dùng
 * taskManager. Orchestration (đọc file, gọi mammoth.js/Turndown, hiện cảnh báo, lưu DB) sống ở
 * event/workflow/file-manager-document.js.
 *
 * NẠP SAU: service/db.js (getDocumentRecord/setDocumentRecord/deleteDocumentRecord/getAllDocumentKeys).
 */

/**
 * Quy `content` của 1 record VỀ 1 chuỗi Markdown duy nhất, bất kể record đó lưu ở schema CŨ
 * (`string[]`, trước 05/07/2026) hay MỚI (`string`) — xem giải thích tương thích ngược ở docstring
 * đầu file. Nối mảng cũ bằng 2 dòng trống — đúng ranh giới đoạn Markdown chuẩn (1 dòng trống = 1
 * đoạn mới), nên KHÔNG mất cấu trúc đoạn của dữ liệu cũ khi hiển thị lại qua Toast UI Editor/Viewer.
 * @param {{content: string|string[]}} record
 * @returns {string}
 */
function resolveDocumentMarkdown(record) {
    if (Array.isArray(record.content)) return record.content.join('\n\n');
    return record.content || '';
}

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
 * Lưu 1 tài liệu MỚI (upload HOẶC tự tạo) — record đã CHUẨN BỊ ĐẦY ĐỦ từ nơi gọi (workflow tự đọc
 * file/gọi mammoth.js+Turndown/hiện cảnh báo trước khi tới đây — hàm này chỉ lưu NGUYÊN VẸN, 1 tiến
 * trình).
 * @param {string} documentKey
 * @param {{filename: string, title: string, content: string, format: 'txt'|'docx', createdBy: 'upload'|'user'}} record
 */
async function saveDocumentRecord(documentKey, record) {
    await setDocumentRecord(documentKey, { ...record, addedAt: Date.now() }); // data layer
}

/**
 * Đổi nội dung 1 tài liệu 'user' đã có — đọc lại record trước (giữ nguyên các field khác), CHỈ ghi
 * đè `content` (chuỗi Markdown lấy từ `editor.getMarkdown()`, xem `openDocumentEditorDrawer()`).
 * KHÔNG tự kiểm tra `createdBy === 'user'` ở đây (Rule 1: đó là 1 QUYẾT ĐỊNH nghiệp vụ khác, thuộc
 * về nơi gọi — workflow tự kiểm tra trước khi gọi hàm này).
 * @param {string} documentKey
 * @param {string} content
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
 * Liệt kê TOÀN BỘ document, kèm key — sắp xếp mới nhất trước (addedAt giảm dần). LƯU Ý: `content`
 * trả về CÓ THỂ vẫn là `string[]` với record CŨ (trước 05/07/2026) — dùng
 * `resolveDocumentMarkdown(doc)` ở nơi ĐỌC để quy về Markdown, KHÔNG tự `.join()`/dùng thẳng ở đây.
 * @returns {Promise<Array<{key: string, filename: string, title: string, content: string|string[], format: string, createdBy: string, addedAt: number}>>}
 */
async function listDocuments() {
    const keys = await getAllDocumentKeys(); // data layer
    const records = await Promise.all(keys.map(async (key) => {
        const record = await getDocumentRecord(key); // data layer
        return record ? { key, ...record } : null;
    }));
    return records.filter(Boolean).sort((a, b) => b.addedAt - a.addedAt);
}
