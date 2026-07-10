/**
 * core/file-manager/document.js — Documents (mục 4.b4 plan-v12-multimedia.md, code 04/07/2026).
 *
 * VIẾT LẠI HOÀN TOÀN (10/07/2026, Nhóm A — mục 1 plan-v12-extended.md) — ĐỔI HƯỚNG LƯU TRỮ, bỏ
 * hẳn Markdown/Toast UI Editor/Turndown (đã dùng tạm 05/07-09/07/2026): `content` giờ là **1 chuỗi
 * HTML ĐÃ LỌC WHITELIST** (KHÔNG còn là Markdown). Lý do đổi hướng (mục 0 plan-v12-extended.md):
 * Giang quyết định tự viết engine định dạng cơ bản (contentEditable + toolbar qua
 * document.execCommand(), xem core/file-manager/document-ui.js::buildDocumentEditorSurface())
 * thay vì phụ thuộc thư viện ngoài cho phần soạn thảo/hiển thị — CHỈ còn mammoth.js (đọc .docx) là
 * thư viện ngoài bắt buộc duy nhất, Toast UI Editor + Turndown ĐÃ GỠ KHỎI index.html.
 *
 * Schema record (store 'documents', service/db.js):
 *   { filename, title, content: string, format: 'txt'|'docx', createdBy: 'upload'|'user', addedAt }
 *   - filename: tên file GỐC lúc upload (giữ NGUYÊN đuôi .docx/.txt). Với tài liệu 'user' tạo mới,
 *     filename = title + '.txt' (LUÔN .txt — không có khái niệm "tạo mới .docx").
 *   - title: tên HIỂN THỊ, tách riêng khỏi filename để sửa được độc lập (không đụng identity/key).
 *   - content: 1 chuỗi HTML đã lọc whitelist — CHỈ giữ `h1 h2 h3 h4 h5 h6 p b strong i em u
 *     blockquote ul ol li a` (xem sanitizeDocumentHtml() dưới đây), thẻ `<a>` chỉ giữ attribute
 *     `href`, mọi tag khác xoá SẠCH attribute — chặn onclick/style/class chèn bậy từ
 *     contentEditable hoặc HTML dán vào.
 *   - **Tương thích ngược** — record CŨ có thể ở 1 trong 3 dạng đã từng tồn tại (xem
 *     resolveDocumentHtml() dưới đây, dùng ở MỌI nơi ĐỌC `content`):
 *     (a) `string[]` (trước 05/07/2026) — mảng đoạn văn text thuần.
 *     (b) `string` Markdown thô (05/07-09/07/2026, CHƯA có người dùng thật nào lưu dạng này —
 *         không đáng đầu tư xử lý riêng, xem resolveDocumentHtml()).
 *     (c) `string` HTML đã lọc whitelist (dạng CHUẨN từ nay, 10/07/2026 trở đi).
 *   - format: 'txt' | 'docx' — CHỈ để hiện icon/nhãn đúng loại gốc, KHÔNG ảnh hưởng cách đọc.
 *   - createdBy: 'upload' (tải lên máy) | 'user' (tự tạo trong app) — CHỈ 'user' được phép SỬA nội
 *     dung (đúng yêu cầu Giang — tài liệu upload là read-only).
 *
 * Core THUẦN — tuân Rule 1-4 (core-function-conventions.md): KHÔNG tự gọi hàm core khác (kể cả
 * hàm KHÁC trong CÙNG FILE này — Rule 3 không phân biệt cùng file/khác file), KHÔNG tự
 * appState.get(), KHÔNG dùng taskManager. `sanitizeDocumentHtml()`/`resolveDocumentHtml()`/
 * `buildDocumentHtmlFromPlainText()` vì vậy đều TỰ CHỨA (chỉ dùng API DOM có sẵn của trình duyệt
 * để escape/dựng cây tạm — KHÔNG gọi lẫn nhau, KHÔNG gọi escapeHtml() của core/modal-choice.js).
 * Orchestration (đọc file, gọi mammoth.js, hiện cảnh báo, gọi sanitizeDocumentHtml() TRƯỚC khi lưu)
 * sống ở event/workflow/file-manager-document.js.
 *
 * NẠP SAU: service/db.js (getDocumentRecord/setDocumentRecord/deleteDocumentRecord/getAllDocumentKeys).
 */

/**
 * DOCUMENT_HTML_ALLOWED_TAGS — whitelist thẻ HTML được GIỮ trong `content` Documents (mục 1.1
 * plan-v12-extended.md). Thẻ NGOÀI danh sách này bị sanitizeDocumentHtml() BÓC (unwrap, giữ
 * nguyên nội dung con) — KHÔNG xoá mất nội dung, chỉ xoá lớp bọc lạ.
 */
const DOCUMENT_HTML_ALLOWED_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'B', 'STRONG', 'I', 'EM', 'U', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'A']);

/**
 * Lọc 1 chuỗi HTML theo whitelist (mục 1.1 plan-v12-extended.md) — dựng `<div>` tạm (KHÔNG gắn
 * vào document thật), đệ quy xử lý CON TRƯỚC KHI xử lý chính node cha (bottom-up — tránh phá kết
 * quả đã lọc của con khi unwrap cha ở lượt xử lý sau). Tag lạ (KHÔNG nằm trong whitelist) ->
 * UNWRAP (giữ nguyên con, chỉ bỏ lớp bọc); comment/node lạ khác -> xoá hẳn. Tag hợp lệ -> xoá SẠCH
 * attribute thừa — RIÊNG `<a>` giữ lại `href`.
 *
 * Dùng ở: (1) event/workflow/file-manager-document.js SAU mammoth.js (upload .docx), (2)
 * core/file-manager/document-ui.js::buildDocumentEditorSurface().getHtml() (lọc lại HTML
 * contentEditable trước khi lưu — trình duyệt hay tự chèn div/span style lộn xộn, mục 1.3).
 * @param {string} html
 * @returns {string}
 */
function sanitizeDocumentHtml(html) {
    const container = document.createElement('div');
    container.innerHTML = html || '';

    (function walk(parentNode) {
        Array.from(parentNode.childNodes).forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) return; // giữ nguyên text
            if (node.nodeType !== Node.ELEMENT_NODE) { node.remove(); return; } // comment/node lạ khác -> xoá hẳn

            walk(node); // đệ quy CON TRƯỚC (bottom-up)

            if (!DOCUMENT_HTML_ALLOWED_TAGS.has(node.tagName)) {
                while (node.firstChild) node.parentNode.insertBefore(node.firstChild, node); // unwrap: đẩy con lên thay chính nó
                node.remove();
                return;
            }

            Array.from(node.attributes).forEach((attr) => {
                if (node.tagName === 'A' && attr.name === 'href') return; // <a> CHỈ giữ href
                node.removeAttribute(attr.name);
            });
        });
    })(container);

    return container.innerHTML;
}

/**
 * Quy `content` của 1 record VỀ 1 chuỗi HTML sẵn sàng hiển thị, bất kể record đó ở dạng nào trong
 * 3 dạng đã từng tồn tại (xem "Tương thích ngược" ở docstring đầu file):
 *   (a) `string[]` -> escape từng phần tử (DOM tự escape qua `span.textContent`, KHÔNG gọi
 *       escapeHtml() của core/modal-choice.js — Rule 3) + bọc `<p>`, nối lại.
 *   (b)/(c) `string` -> dùng THẲNG. (b) Markdown thô hiếm gặp sẽ hiện ra như text thường (không có
 *       thẻ HTML thật nào để hiểu nhầm là nội dung nguy hiểm — không đáng đầu tư xử lý riêng cho 1
 *       dạng dữ liệu chưa từng thật sự tồn tại, xem docstring đầu file); (c) đã là HTML lọc sẵn.
 * @param {{content: string|string[]}} record
 * @returns {string}
 */
function resolveDocumentHtml(record) {
    if (Array.isArray(record.content)) {
        return record.content.map((paragraph) => {
            const span = document.createElement('span'); // DOM tự escape, KHÔNG gọi hàm core khác (Rule 3)
            span.textContent = paragraph;
            return `<p>${span.innerHTML}</p>`;
        }).join('');
    }
    return record.content || '';
}

/**
 * Chuyển 1 chuỗi text thuần (.txt) THÀNH 1 chuỗi HTML hợp lệ theo whitelist — tách đoạn theo DÒNG
 * TRỐNG (mục 1.2 plan-v12-extended.md, thuật toán CŨ hồi sinh lại từ trước 05/07/2026), escape
 * từng đoạn (DOM tự escape, KHÔNG gọi hàm core khác — Rule 3), bọc `<p>`, nối lại thành 1 chuỗi.
 * @param {string} text
 * @returns {string}
 */
function buildDocumentHtmlFromPlainText(text) {
    const paragraphs = String(text || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    return paragraphs.map((paragraph) => {
        const span = document.createElement('span'); // DOM tự escape, KHÔNG gọi hàm core khác (Rule 3)
        span.textContent = paragraph;
        return `<p>${span.innerHTML}</p>`;
    }).join('');
}

/**
 * slugify + resolve key duy nhất cho 1 filename mới — CÙNG thuật toán resolveImageKey()
 * (core/file-manager/image.js)/resolveSongKey() (service/db.js), nhưng KHÔNG gọi thẳng 2 hàm đó
 * (Rule 3: core không được gọi core khác) — tự lặp lại VÒNG LẶP kiểm tra trùng key tại đây.
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
 * file/gọi mammoth.js/sanitizeDocumentHtml()/hiện cảnh báo trước khi tới đây — hàm này chỉ lưu
 * NGUYÊN VẸN, 1 tiến trình).
 * @param {string} documentKey
 * @param {{filename: string, title: string, content: string, format: 'txt'|'docx', createdBy: 'upload'|'user'}} record
 */
async function saveDocumentRecord(documentKey, record) {
    await setDocumentRecord(documentKey, { ...record, addedAt: Date.now() }); // data layer
}

/**
 * Đổi nội dung 1 tài liệu 'user' đã có — đọc lại record trước (giữ nguyên các field khác), CHỈ ghi
 * đè `content` (chuỗi HTML ĐÃ sanitizeDocumentHtml() từ nơi gọi, xem
 * buildDocumentEditorSurface().getHtml()). KHÔNG tự kiểm tra `createdBy === 'user'` ở đây (Rule 1:
 * đó là 1 QUYẾT ĐỊNH nghiệp vụ khác, thuộc về nơi gọi — workflow tự kiểm tra trước khi gọi hàm này).
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
 * trả về CÓ THỂ vẫn ở dạng CŨ (string[] hoặc Markdown thô) với record CŨ — dùng
 * `resolveDocumentHtml(doc)` ở nơi ĐỌC để quy về HTML sẵn sàng hiển thị, KHÔNG tự dùng thẳng ở đây.
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
