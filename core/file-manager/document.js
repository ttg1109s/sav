/**
 * core/file-manager/document.js — Documents (mục 4.b4 plan-v12-multimedia.md, code 04/07/2026).
 *
 * VIẾT LẠI (10/07/2026, Nhóm A — mục 1 plan-v12-extended.md, CẬP NHẬT sau phản hồi Giang cùng
 * ngày): ĐỔI HƯỚNG LƯU TRỮ, bỏ hẳn Markdown/Toast UI Editor/Turndown. Sửa lại phiên bản ĐẦU của
 * Nhóm A (từng eager-convert MỌI thứ, kể cả .txt thuần, sang 1 chuỗi HTML ngay lúc lưu — SAI):
 *
 *   - **`string[]` (mảng đoạn văn text thuần) VẪN LÀ ĐỊNH DẠNG LƯU CHÍNH THỨC, ĐANG DÙNG** cho
 *     tài liệu `.txt` upload KHÔNG có markup gì — KHÔNG chỉ còn là "tương thích ngược" của record
 *     cũ như bản đầu Nhóm A hiểu sai. Giữ NGUYÊN VĂN dạng mảng đoạn — CHỈ bọc `<p>` LÚC ĐỌC (Reader
 *     load), xem `resolveDocumentHtml()`.
 *   - `.docx` (qua mammoth.js) và tài liệu do NGƯỜI DÙNG tự gõ/sửa (`createdBy === 'user'`, qua
 *     contentEditable) MỚI lưu dạng `string` HTML đã lọc whitelist — 2 trường hợp DUY NHẤT tạo ra
 *     HTML thật ở bước LƯU.
 *   - Markdown thô (`string`, 05/07-09/07/2026, chưa có người dùng thật nào lưu dạng này) vẫn được
 *     `resolveDocumentHtml()` dung nạp NHƯ CŨ (dùng thẳng, không parse cú pháp).
 *
 * Schema record (store 'documents', service/db.js):
 *   { filename, title, content: string|string[], format: 'txt'|'docx', createdBy: 'upload'|'user', addedAt }
 *   - filename: tên file GỐC lúc upload (giữ NGUYÊN đuôi .docx/.txt). Với tài liệu 'user' tạo mới,
 *     filename = title + '.txt' (LUÔN .txt — không có khái niệm "tạo mới .docx").
 *   - title: tên HIỂN THỊ, tách riêng khỏi filename để sửa được độc lập (không đụng identity/key).
 *   - content:
 *     (a) `string[]` — tài liệu `.txt` upload, tách đoạn theo dòng trống
 *         (`splitPlainTextIntoParagraphs()`) — ĐỊNH DẠNG LƯU CHÍNH THỨC cho trường hợp này (KHÔNG
 *         convert sang HTML lúc lưu — chỉ convert LÚC ĐỌC, xem `resolveDocumentHtml()`).
 *     (b) `string` HTML đã lọc whitelist — CHỈ giữ `h1 h2 h3 h4 h5 h6 p b strong i em u blockquote
 *         ul ol li a` (xem `sanitizeDocumentHtml()`), dùng cho `.docx` (mammoth.js -> HTML ->
 *         sanitizeDocumentHtml() ngay lúc lưu) VÀ tài liệu `createdBy==='user'` (mọi lần Sửa qua
 *         contentEditable, xem `buildDocumentEditorSurface()` ở document-ui.js).
 *     (c) `string` Markdown thô — record hiếm/cũ (05/07-09/07/2026), dung nạp qua
 *         `resolveDocumentHtml()` như text thường, không đầu tư xử lý riêng.
 *   - format: 'txt' | 'docx' — CHỈ để hiện icon/nhãn đúng loại gốc, KHÔNG ảnh hưởng cách đọc.
 *   - createdBy: 'upload' (tải lên máy) | 'user' (tự tạo trong app) — CHỈ 'user' được phép SỬA nội
 *     dung (đúng yêu cầu Giang — tài liệu upload là read-only).
 *
 * Core THUẦN — tuân Rule 1-4 (core-function-conventions.md): KHÔNG tự gọi hàm core khác (kể cả
 * hàm KHÁC trong CÙNG FILE này — Rule 3 không phân biệt cùng file/khác file), KHÔNG tự
 * appState.get(), KHÔNG dùng taskManager, KHÔNG addEventListener (đó là việc của Workflow — SIẾT
 * LẠI 10/07/2026 sau phản hồi Giang, xem core/file-manager/document-ui.js để biết chi tiết đầy đủ
 * lý do). Mọi hàm trong file này TỰ CHỨA (chỉ dùng API DOM có sẵn của trình duyệt) — KHÔNG gọi lẫn
 * nhau, KHÔNG gọi escapeHtml() của core/modal-choice.js. Orchestration (đọc file, gọi mammoth.js,
 * hiện cảnh báo, gọi sanitizeDocumentHtml()/resolveDocumentHtml()/convertDocumentHtmlToPlainText()
 * theo đúng thứ tự) sống ở event/workflow/file-manager-document.js.
 *
 * NẠP SAU: service/db.js (getDocumentRecord/setDocumentRecord/deleteDocumentRecord/getAllDocumentKeys).
 */

/**
 * DOCUMENT_HTML_ALLOWED_TAGS — whitelist thẻ HTML được GIỮ trong `content` dạng HTML (mục 1.1
 * plan-v12-extended.md). Thẻ NGOÀI danh sách này bị sanitizeDocumentHtml() BÓC (unwrap, giữ
 * nguyên nội dung con) — KHÔNG xoá mất nội dung, chỉ xoá lớp bọc lạ.
 */
const DOCUMENT_HTML_ALLOWED_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'B', 'STRONG', 'I', 'EM', 'U', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'A']);

// Tập con CHỈ những thẻ BLOCK-LEVEL của whitelist trên (loại B/STRONG/I/EM/U/A/LI — LI chỉ hợp lệ
// LỒNG trong UL/OL, không đứng rời top-level) — dùng để phân biệt "khối riêng" (flush đoạn đang
// gom, giữ nguyên) với "thẻ định dạng trong dòng" (vẫn thuộc VỀ đoạn đang gom) ở bước gom đoạn cuối
// sanitizeDocumentHtml(), xem docstring hàm đó.
const DOCUMENT_BLOCK_LEVEL_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'BLOCKQUOTE', 'UL', 'OL']);

/**
 * Lọc 1 chuỗi HTML theo whitelist (mục 1.1 plan-v12-extended.md) — dựng `<div>` tạm (KHÔNG gắn
 * vào document thật), đệ quy xử lý CON TRƯỚC KHI xử lý chính node cha (bottom-up — tránh phá kết
 * quả đã lọc của con khi unwrap cha ở lượt xử lý sau). Tag lạ (KHÔNG nằm trong whitelist) ->
 * UNWRAP (giữ nguyên con, chỉ bỏ lớp bọc); comment/node lạ khác -> xoá hẳn. Tag hợp lệ -> xoá SẠCH
 * attribute thừa — RIÊNG `<a>` giữ lại `href`.
 *
 * SỬA (13/07/2026, Giang báo — dán chữ từ app khác vào ô Sửa, các đoạn dính liền thành 1 khối) —
 * NGUYÊN NHÂN GỐC: trình duyệt dán plain-text vào contentEditable thường KHÔNG tạo `<p>` cho mỗi
 * dòng — WebKit/Safari (nền tảng chính của app, xem file:// + iOS webview) thường gói CẢ đoạn dán
 * vào 1 `<div>` DUY NHẤT, dùng `<br>` cho MỖI lượt xuống dòng bên trong (Chrome thì ngược lại, mỗi
 * dòng 1 `<div>` riêng) — CẢ 2 kiểu đều KHÔNG có trong whitelist. Bản CŨ unwrap TRƠN mọi tag lạ
 * (đẩy con lên, xoá vỏ, KHÔNG chèn gì thay thế) — với `<br>` (không có con để đẩy lên) nghĩa là XOÁ
 * SẠCH, mất hẳn dấu vết ngắt dòng; với `<div>` cũng vậy — nhiều dòng/đoạn RIÊNG BIỆT trong mắt
 * người dùng bị dính liền thành 1 khối văn bản không ngắt, đúng triệu chứng Giang báo.
 * SỬA: `<br>`/`<div>` giờ được thay bằng 1 TEXT NODE chứa `"\n"` (KHÔNG xoá trơn) TRƯỚC khi
 * unwrap/xoá — giữ lại dấu vết ranh giới dòng/đoạn. Sau khi walk() xong (mọi tag lạ đã xử lý), 1
 * lượt GOM ĐOẠN cuối cùng duyệt lại các node RỜI (text/thẻ định dạng trong dòng nằm trực tiếp ở
 * top-level, KHÔNG nằm trong khối `<p>`/`<h#>`/`<blockquote>` nào) — tách theo ranh giới `"\n"`
 * VỪA chèn (CÙNG quy tắc với splitPlainTextIntoParagraphs() — chấm câu + tab/≥2 dấu cách cũng tính
 * là ranh giới đoạn) — bọc mỗi phần THÀNH 1 `<p>` riêng, GIỮ NGUYÊN các khối ĐÃ hợp lệ sẵn (nếu
 * nguồn dán có `<p>` thật) không đụng gì.
 *
 * `walk()`/lượt gom đoạn đều là CLOSURE lồng bên trong CHÍNH hàm này (không phải hàm top-level
 * riêng) — Rule 3 (core-function-conventions.md) cấm core gọi core KHÁC, "không phân biệt cùng
 * file/khác file" (xem docstring đầu file.js) — closure lồng bên trong 1 hàm KHÔNG tính là "hàm
 * khác", đúng tinh thần cho phép.
 *
 * Dùng ở: (1) event/workflow/file-manager-document.js SAU mammoth.js (upload .docx), (2)
 * event/workflow/document-reader.js SAU khi đọc contentEditable (lọc lại HTML trước khi lưu —
 * trình duyệt hay tự chèn div/span/br lộn xộn, mục 1.3).
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

            if (node.tagName === 'BR') { node.replaceWith(document.createTextNode('\n')); return; } // giữ dấu vết ngắt dòng, KHÔNG xoá trơn
            if (node.tagName === 'DIV') {
                node.parentNode.insertBefore(document.createTextNode('\n'), node); // ranh giới TRƯỚC
                while (node.firstChild) node.parentNode.insertBefore(node.firstChild, node); // đẩy con lên (đã sanitize sạch từ đệ quy trên)
                node.parentNode.insertBefore(document.createTextNode('\n'), node); // ranh giới SAU
                node.remove();
                return;
            }

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

    // Gom các node RỜI (text/thẻ định dạng trong dòng nằm trực tiếp ở top-level `container`, do
    // BR/DIV vừa được walk() ở trên thay bằng "\n", HOẶC vốn dĩ chưa từng có khối bọc nào) thành
    // các <p> riêng theo đúng ranh giới "\n" — giữ NGUYÊN vị trí các khối ĐÃ hợp lệ (p/h#/
    // blockquote/ul/ol) xen kẽ, không đụng gì tới chúng.
    const finalContainer = document.createElement('div');
    let currentP = null; // <p> đang gom dở — null nghĩa là chưa có node rời nào để gom
    function ensureCurrentP() { return currentP || (currentP = document.createElement('p')); }
    function flushCurrentP() {
        if (currentP && currentP.textContent.trim()) finalContainer.appendChild(currentP);
        currentP = null;
    }
    Array.from(container.childNodes).forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE && DOCUMENT_BLOCK_LEVEL_TAGS.has(node.tagName)) {
            flushCurrentP(); // khối riêng -> đóng đoạn rời đang gom (nếu có) trước khi giữ nguyên khối này
            finalContainer.appendChild(node);
            return;
        }
        if (node.nodeType === Node.ELEMENT_NODE) { ensureCurrentP().appendChild(node); return; } // thẻ định dạng trong dòng (b/strong/i/em/u/a) -> thuộc đoạn đang gom
        // TEXT_NODE — tách theo "\n" (từ BR/DIV vừa thay ở walk(), hoặc \n thật vốn có sẵn) + CÙNG
        // quy tắc "chấm câu + tab/≥2 dấu cách" với splitPlainTextIntoParagraphs() (xem hàm đó).
        const parts = node.textContent.replace(/\.(\t| {2,})/g, '.\n').split('\n');
        parts.forEach((part, idx) => {
            if (part) ensureCurrentP().appendChild(document.createTextNode(part));
            if (idx < parts.length - 1) flushCurrentP(); // gặp ranh giới -> đóng đoạn hiện tại, đoạn MỚI bắt đầu từ phần sau
        });
    });
    flushCurrentP();

    return finalContainer.innerHTML;
}

/**
 * Quy `content` của 1 record VỀ 1 chuỗi HTML sẵn sàng hiển thị, bất kể record đó ở dạng nào trong
 * 3 dạng hợp lệ (xem "Tương thích" ở docstring đầu file):
 *   (a) `string[]` (ĐỊNH DẠNG LƯU CHÍNH THỨC của .txt upload, KHÔNG phải chỉ "record cũ") -> escape
 *       từng phần tử (DOM tự escape qua `span.textContent`, KHÔNG gọi escapeHtml() của
 *       core/modal-choice.js — Rule 3) + bọc `<p>`, nối lại — ĐÂY LÀ NƠI DUY NHẤT bọc `<p>` cho
 *       .txt, CHỦ Ý làm LÚC ĐỌC (không làm lúc lưu).
 *   (b)/(c) `string` (HTML đã lọc HOẶC Markdown thô hiếm gặp) -> dùng THẲNG.
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
 * Tách 1 chuỗi text thuần (.txt) THÀNH mảng đoạn văn — ĐỊNH DẠNG LƯU THẲNG cho .txt upload (KHÔNG
 * convert sang HTML ở bước này — xem docstring đầu file, resolveDocumentHtml() mới bọc `<p>` lúc
 * đọc).
 *
 * SỬA (13/07/2026, Giang báo — "chỉ nhận \n\n -> p, \n đơn lẻ không ra gì cả") — bản cũ chỉ tách
 * theo `/\n\s*\n/` (2 dòng trống liên tiếp), phụ thuộc file gốc CÓ dùng đúng kiểu xuống dòng đó —
 * mỗi ứng dụng/nguồn xuất file 1 kiểu khác nhau (Windows `\r\n`, Mac cũ chỉ `\r` không có `\n`, hay
 * chỉ xuống dòng ĐƠN không có dòng trống ngăn cách) khiến nhiều đoạn bị dính chung làm 1 khối hoặc
 * cả file chỉ ra đúng 1 đoạn duy nhất. Giờ chuẩn hoá TRƯỚC mọi kiểu xuống dòng (`\r\n`/`\r` riêng lẻ
 * đều quy về `\n`), rồi coi MỌI `\n` đơn lẻ (không cần dòng trống) là 1 ranh giới đoạn — thêm 1 dấu
 * hiệu ranh giới đoạn KHÁC không cần ký tự xuống dòng thật: câu kết bằng dấu chấm rồi theo sau là
 * tab hoặc từ 2 dấu cách trở lên (1 số nguồn xuất chỉ canh khoảng trắng/tab giữa đoạn, không có ký
 * tự xuống dòng thật nào).
 * @param {string} text
 * @returns {string[]}
 */
function splitPlainTextIntoParagraphs(text) {
    return String(text || '')
        .replace(/\r\n|\r/g, '\n') // chuẩn hoá Windows (\r\n) VÀ Mac cũ (\r riêng lẻ, không có \n) về \n
        .replace(/\.(\t| {2,})/g, '.\n') // chấm câu rồi tab/≥2 dấu cách (không có xuống dòng thật) -> cũng coi là ngắt đoạn
        .split('\n')
        .map((p) => p.trim())
        .filter(Boolean);
}

/**
 * MỚI (10/07/2026, sau phản hồi Giang — mục "download vẫn phải ra text đúng nghĩa") — Quy 1
 * chuỗi HTML (ĐÃ resolveDocumentHtml()) VỀ LẠI 1 chuỗi TEXT dùng cú pháp kiểu-Markdown tương ứng
 * (vd `<h3>abc</h3>` -> `### abc`, `<b>x</b>` -> `**x**`) — dùng cho nút Tải về (luôn ra `.txt`,
 * xem event/workflow/file-manager-document.js::downloadDocumentAsText() và
 * core/file-manager/document-ui.js). Với tài liệu .txt thuần không có thẻ gì ngoài `<p>` (đường đi
 * PHỔ BIẾN NHẤT — mọi .txt upload không markup), hàm này trả lại ĐÚNG NGUYÊN VĂN text gốc (round-
 * trip qua resolveDocumentHtml() -> convertDocumentHtmlToPlainText() không đổi nội dung).
 *
 * Core THUẦN, TỰ CHỨA — CHỈ dùng closure lồng bên trong 1 hàm (KHÔNG phải 2 hàm top-level riêng
 * gọi nhau — vẫn đúng Rule 3, xem cách làm giống hệt `walk()` trong sanitizeDocumentHtml() ở trên).
 * @param {string} html
 * @returns {string}
 */
function convertDocumentHtmlToPlainText(html) {
    const container = document.createElement('div');
    container.innerHTML = html || '';

    function inlineText(node) {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent;
        if (node.nodeType !== Node.ELEMENT_NODE) return '';
        const inner = Array.from(node.childNodes).map(inlineText).join('');
        switch (node.tagName) {
            case 'B': case 'STRONG': return `**${inner}**`;
            case 'I': case 'EM': return `*${inner}*`;
            case 'U': return `_${inner}_`;
            case 'A': { const href = node.getAttribute('href'); return href ? `${inner} (${href})` : inner; }
            default: return inner;
        }
    }

    function blockToLines(el) {
        switch (el.tagName) {
            case 'H1': return [`# ${inlineText(el)}`];
            case 'H2': return [`## ${inlineText(el)}`];
            case 'H3': return [`### ${inlineText(el)}`];
            case 'H4': return [`#### ${inlineText(el)}`];
            case 'H5': return [`##### ${inlineText(el)}`];
            case 'H6': return [`###### ${inlineText(el)}`];
            case 'BLOCKQUOTE': return [`> ${inlineText(el)}`];
            case 'UL': return Array.from(el.children).map((li) => `- ${inlineText(li)}`);
            case 'OL': return Array.from(el.children).map((li, i) => `${i + 1}. ${inlineText(li)}`);
            default: return [inlineText(el)]; // P và mọi block khác -> 1 dòng thuần, không tiền tố
        }
    }

    return Array.from(container.children).map((el) => blockToLines(el).join('\n')).join('\n\n');
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
 * file/gọi mammoth.js/splitPlainTextIntoParagraphs()/sanitizeDocumentHtml()/hiện cảnh báo trước
 * khi tới đây — hàm này chỉ lưu NGUYÊN VẸN, 1 tiến trình).
 * @param {string} documentKey
 * @param {{filename: string, title: string, content: string|string[], format: 'txt'|'docx', createdBy: 'upload'|'user'}} record
 */
async function saveDocumentRecord(documentKey, record) {
    await setDocumentRecord(documentKey, { ...record, addedAt: Date.now() }); // data layer
}

/**
 * Đổi nội dung 1 tài liệu 'user' đã có — đọc lại record trước (giữ nguyên các field khác), CHỈ ghi
 * đè `content` (chuỗi HTML ĐÃ sanitizeDocumentHtml() từ nơi gọi). KHÔNG tự kiểm tra
 * `createdBy === 'user'` ở đây (Rule 1: đó là 1 QUYẾT ĐỊNH nghiệp vụ khác, thuộc về nơi gọi —
 * workflow tự kiểm tra trước khi gọi hàm này).
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
 * trả về CÓ THỂ là `string[]` (.txt) HOẶC `string` (.docx/user) — dùng `resolveDocumentHtml(doc)`
 * ở nơi ĐỌC để quy về HTML sẵn sàng hiển thị, KHÔNG tự dùng thẳng ở đây.
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
