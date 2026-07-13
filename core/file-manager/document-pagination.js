/**
 * core/file-manager/document-pagination.js — Core NGHIỆP VỤ đúng nghĩa (chịu Rule 1-4 đầy đủ,
 * core-function-conventions.md), MỚI (10/07/2026, Nhóm A — mục 4 plan-v12-extended.md) — KHÁC HẲN
 * core/file-manager/document-ui.js (core UI thuần, ngoài phạm vi Rule 1-4). Ghi rõ ở đây để không
 * lẫn 2 loại: file NÀY tính TOÁN học (cắt HTML thành từng "trang"/slot vừa khít 1 khung đọc có
 * kích thước cho trước), KHÔNG đụng DOM Reader thật, KHÔNG biết Generic Drawer/
 * `#document-reader-pages` tồn tại — Workflow (event/workflow/document-reader.js) tự tiêm
 * `slotHtml` vào đâu tuỳ nó.
 *
 * THAY HẲN kỹ thuật CSS multi-column cũ (applyReaderPagination()/setReaderPageIndex(), đã xoá
 * khỏi document-ui.js) — giờ đo bằng 1 DOM TẠM (ẩn, dựng NGAY BÊN TRONG hàm rồi huỷ ngay sau khi
 * đo xong, style KHỚP khung đọc thật qua tham số `pageSize.className`).
 *
 * CẮT THEO KHỐI (h1-h6/p/ul/ol/blockquote — đúng khớp whitelist sanitizeDocumentHtml(), xem
 * core/file-manager/document.js) — mỗi khối top-level LÀ 1 ĐƠN VỊ, không bị cắt đôi giữa 2 trang
 * TRỪ 1 TRƯỜNG HỢP DUY NHẤT (xem "CẮT KÝ TỰ" bên dưới, MỚI 13/07/2026).
 *
 * CẮT KÝ TỰ (retry-cut, 13/07/2026, Giang báo — "1 khối > chiều cao trang thì tràn/không cuộn
 * được, UX kém") — TRƯỚC ĐÂY: nếu 1 khối tự nó đã cao hơn cả khung đọc (không còn khối nào khác để
 * dồn sang trang sau), khối đó vẫn được xếp TRỌN vào 1 trang, TRÀN khỏi khung nhìn thấy (chấp nhận
 * được với hầu hết pagination engine thật, vd epub.js, NHƯNG UX kém vì khung đọc ở đây không cuộn
 * được — phần tràn coi như MẤT). GIỜ: đúng khi rơi vào trường hợp đó (khối là khối ĐẦU TIÊN của 1
 * trang MÀ VẪN tràn), thử CẮT KÝ TỰ ngay trong khối đó — tìm điểm cắt để phần ĐẦU vừa khít trang,
 * phần CÒN LẠI tiếp tục ở (các) trang sau, cứ thế cho tới hết khối (xem `splitOversizedBlockToFit()`
 * + cursor mở rộng thành `{blockIndex, textOffset}` bên dưới). CHỈ khi khối không có ký tự nào để
 * cắt (vd toàn thẻ rỗng) mới lùi về hành vi CŨ (chấp nhận tràn nguyên khối).
 *
 * CURSOR — mở rộng từ số nguyên đơn (chỉ số khối) thành `{blockIndex, textOffset}` — `textOffset`
 * > 0 nghĩa là khối đó đang bị cắt dở từ lượt gọi trước, tiếp tục đọc từ ký tự đó. Vẫn nhận
 * `cursor` kiểu number CŨ để tương thích ngược (coi là `{blockIndex: cursor, textOffset: 0}`) — nơi
 * gọi (event/workflow/document-reader.js) không cần biết cấu trúc bên trong, chỉ CHUYỂN TIẾP
 * nguyên vẹn giá trị `nextCursor` nhận được ở lượt gọi trước, đúng tinh thần "cursor cơ hội" (opaque
 * token) đã có từ đầu.
 *
 * Core THUẦN — tuân Rule 1-4: KHÔNG tự appState.get(), KHÔNG dùng taskManager. Rule 3 (core không
 * gọi core khác): `sliceBlockByTextRange()`/`splitOversizedBlockToFit()` là 2 hàm PRIVATE của
 * CHÍNH file này, chỉ dùng nội bộ — chấp nhận gọi lẫn nhau (cùng file, cùng 1 đơn vị nghiệp vụ tách
 * đoạn, giống cách `sanitizeDocumentHtml()::walk()` là closure lồng bên trong — ở đây tách hàm
 * riêng cho dễ đọc/test nhưng KHÔNG xuất ra ngoài file, tinh thần tương đương).
 *
 * NẠP SAU: không phụ thuộc gì (core THUẦN, tự dựng/huỷ DOM tạm, không cần core/dom-refs.js).
 */

const DOCUMENT_READER_SPLIT_MAX_TRIES = 6; // số lần thử tối đa khi nội suy điểm cắt ký tự cho 1 khối quá cao — hội tụ rất nhanh (2-3 lần) với văn bản thường

/**
 * Cắt 1 khối (block) THEO KÝ TỰ — trả về bản CLONE chỉ chứa phần text nằm trong [startOffset,
 * endOffset) (tính theo tổng số ký tự textContent, đúng thứ tự DOM). PRESERVE cấu trúc thẻ lồng
 * bên trong (vd `<b>`/`<i>`/`<a>` trong 1 `<p>`) bằng cách thao tác TRỰC TIẾP trên node thật (rỗng
 * hoá/cắt ngắn text node, KHÔNG cắt chuỗi HTML thô — tránh làm hỏng cặp thẻ mở/đóng).
 * @param {Element} block
 * @param {number} startOffset
 * @param {number} endOffset - Infinity = tới hết block
 * @returns {Element} bản clone đã cắt (có thể rỗng nếu [startOffset,endOffset) không giao với block)
 */
function sliceBlockByTextRange(block, startOffset, endOffset) {
    const clone = block.cloneNode(true);
    let consumed = 0;

    (function walk(node) {
        Array.from(node.childNodes).forEach((child) => {
            if (child.nodeType === Node.TEXT_NODE) {
                const text = child.textContent;
                const nodeStart = consumed;
                consumed += text.length;
                const keepFrom = Math.max(0, startOffset - nodeStart);
                const keepTo = Math.min(text.length, endOffset - nodeStart);
                child.textContent = (keepTo <= keepFrom) ? '' : text.slice(keepFrom, keepTo);
                return;
            }
            if (child.nodeType === Node.ELEMENT_NODE) walk(child);
        });
    })(clone);

    return clone;
}

/**
 * Thử tách 1 khối ĐƠN LẺ đã tự nó cao hơn `pageSize.height` — đoán điểm cắt ban đầu bằng NỘI SUY
 * tuyến tính (tỉ lệ chiều cao mục tiêu / chiều cao đo được của TOÀN khối ~ tỉ lệ số ký tự cần giữ —
 * xấp xỉ hợp lý, mật độ chữ/dòng tương đối đều trong 1 khối text thuần), rồi ĐO LẠI THẬT bằng DOM
 * (không tin suông phép nội suy) — nếu vẫn tràn/còn hụt nhiều, CO/GIÃN lại ĐÚNG theo tỉ lệ (chiều
 * cao mục tiêu / chiều cao vừa đo được) mỗi vòng, tối đa `DOCUMENT_READER_SPLIT_MAX_TRIES` lần.
 * @param {Element} block - khối GỐC (chưa cắt) đang cần tách.
 * @param {{width:number, height:number}} pageSize
 * @param {HTMLElement} measureEl - DOM tạm dùng để đo, PHẢI đang RỖNG lúc gọi hàm này.
 * @returns {{fittedClone: Element, charsUsed: number}|null} null nếu khối không có ký tự nào để cắt
 *   (vd toàn thẻ rỗng) — nơi gọi tự lùi về chấp nhận tràn nguyên khối trong trường hợp đó.
 */
function splitOversizedBlockToFit(block, pageSize, measureEl) {
    const totalLen = block.textContent.length;
    if (totalLen === 0) return null;

    measureEl.appendChild(block.cloneNode(true));
    const fullHeight = measureEl.scrollHeight;
    measureEl.removeChild(measureEl.lastChild);
    if (fullHeight <= 0) return null;

    let guess = Math.max(1, Math.floor(totalLen * (pageSize.height / fullHeight)));
    let bestFit = null; // {chars, clone} — lần thử GẦN NHẤT đã vừa khít, giữ lại phòng vòng sau tệ hơn

    for (let attempt = 0; attempt < DOCUMENT_READER_SPLIT_MAX_TRIES; attempt++) {
        guess = Math.min(totalLen - 1, Math.max(1, guess)); // luôn giữ ÍT NHẤT 1 ký tự cho trang sau — đảm bảo cursor tiến tới, không kẹt vòng lặp
        const candidate = sliceBlockByTextRange(block, 0, guess);
        measureEl.appendChild(candidate);
        const measuredHeight = measureEl.scrollHeight;
        measureEl.removeChild(measureEl.lastChild);

        if (measuredHeight <= pageSize.height) {
            bestFit = { chars: guess, clone: candidate };
            if (measuredHeight >= pageSize.height * 0.97 || guess >= totalLen - 1) break; // đủ khít, hoặc đã hết chữ để nới thêm -> dừng
            guess = Math.min(totalLen - 1, guess + Math.max(1, Math.floor((totalLen - guess) * 0.15))); // vừa khít nhưng còn dư nhiều chỗ -> nới thêm thử tiếp
        } else {
            guess = Math.max(1, Math.floor(guess * (pageSize.height / measuredHeight))); // vẫn tràn -> co lại ĐÚNG theo tỉ lệ vừa đo (nội suy lại, không chia đôi mù)
            if (bestFit && guess <= bestFit.chars) break; // không hội tụ thêm được nữa -> dùng bản vừa khít gần nhất đã có
        }
    }

    if (!bestFit) bestFit = { chars: 1, clone: sliceBlockByTextRange(block, 0, 1) }; // hết lượt thử vẫn không vừa (hiếm — trang quá nhỏ so với cỡ chữ) -> LUÔN giữ tối thiểu 1 ký tự để đảm bảo tiến tới

    // Né cắt GIỮA 1 TỪ (Giang hỏi — text không justify nên dòng cuối không "dàn đều", nhưng cắt thô
    // theo ký tự vẫn có thể rơi giữa từ) — lùi điểm cắt về khoảng trắng GẦN NHẤT trước đó. CHỈ lùi
    // nếu mức hy sinh không quá lớn (tối đa 30% số ký tự vừa đo được, tối thiểu cho phép 40 ký tự) —
    // gặp 1 chuỗi cực dài không khoảng trắng (vd URL) mà điểm trắng gần nhất lại quá xa, thà chấp
    // nhận cắt giữa chuỗi đó còn hơn bỏ phí phần lớn trang. Điểm cắt MỚI luôn NHỎ HƠN hoặc bằng —
    // chắc chắn vẫn vừa trang, KHÔNG cần đo lại DOM.
    const snapped = findWordBoundaryBefore(block.textContent, bestFit.chars);
    const givingUp = bestFit.chars - snapped;
    if (snapped > 0 && givingUp > 0 && givingUp <= Math.max(40, bestFit.chars * 0.3)) {
        bestFit = { chars: snapped, clone: sliceBlockByTextRange(block, 0, snapped) };
    }

    return { fittedClone: bestFit.clone, charsUsed: bestFit.chars };
}

/**
 * Tìm vị trí NGAY SAU khoảng trắng gần nhất trước `offset` (trong phạm vi lùi tối đa 200 ký tự —
 * đừng lùi quá xa, tránh co hụt cả trang nếu gặp 1 chuỗi không khoảng trắng cực dài, vd URL). Không
 * tìm thấy trong phạm vi cho phép -> trả lại nguyên `offset` (nơi gọi tự hiểu là "chấp nhận cắt
 * giữa từ", hiếm khi xảy ra với văn bản thường).
 * @param {string} text
 * @param {number} offset
 * @returns {number}
 */
function findWordBoundaryBefore(text, offset) {
    const maxLookback = Math.min(offset, 200);
    for (let i = offset; i > offset - maxLookback; i--) {
        if (/\s/.test(text[i - 1])) return i;
    }
    return offset;
}

/**
 * Tính 1 "trang" (slot) kế tiếp bắt đầu từ `cursor` của `contentHtml`.
 * @param {string} contentHtml - chuỗi HTML ĐÃ sanitize (dãy phẳng các block h1-h6/p/ul/ol/blockquote,
 *        xem resolveDocumentHtml()/sanitizeDocumentHtml() — core/file-manager/document.js).
 * @param {number|{blockIndex:number, textOffset:number}} cursor - vị trí bắt đầu đo. Nhận cả kiểu
 *        number CŨ (tương thích ngược, = {blockIndex: cursor, textOffset: 0}) lẫn kiểu object MỚI.
 * @param {{width: number, height: number, className: string}} pageSize - kích thước khung đọc
 *        THẬT (đo bằng clientWidth/clientHeight nơi gọi) + class Tailwind ÁP Y HỆT khung thật (cỡ
 *        chữ/line-height/padding — ảnh hưởng trực tiếp chiều cao đo được, PHẢI khớp tuyệt đối).
 * @returns {{slotHtml: string, nextCursor: {blockIndex:number, textOffset:number}, isLastSlot: boolean}}
 */
function computeNextDocumentReaderSlot(contentHtml, cursor, pageSize) {
    const cur = (typeof cursor === 'number') ? { blockIndex: cursor, textOffset: 0 } : (cursor || { blockIndex: 0, textOffset: 0 });

    const sourceContainer = document.createElement('div');
    sourceContainer.innerHTML = contentHtml || '';

    // Duyệt TOÀN BỘ childNodes (không chỉ .children) — phòng HTML nguồn còn sót text node rời rạc
    // ở top-level (vd mammoth.js đôi khi xuất text không bọc <p>) — bọc tạm vào <p> để KHÔNG mất
    // nội dung khi phân trang (chỉ dùng cục bộ ở đây, KHÔNG ghi ngược lại DB).
    const blocks = [];
    Array.from(sourceContainer.childNodes).forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) { blocks.push(node); return; }
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
            const wrap = document.createElement('p');
            wrap.textContent = node.textContent;
            blocks.push(wrap);
        }
    });

    if (blocks.length === 0 || cur.blockIndex >= blocks.length) {
        return { slotHtml: '', nextCursor: { blockIndex: blocks.length, textOffset: 0 }, isLastSlot: true };
    }

    // DOM tạm, KHÔNG gắn vào cây hiển thị thật (fixed + visibility hidden + đẩy ra ngoài màn hình)
    // — CHỈ dùng để đo scrollHeight, huỷ ngay sau khi đo xong.
    const measureEl = document.createElement('div');
    measureEl.className = pageSize.className || '';
    measureEl.style.position = 'fixed';
    measureEl.style.visibility = 'hidden';
    measureEl.style.pointerEvents = 'none';
    measureEl.style.left = '-9999px';
    measureEl.style.top = '0';
    measureEl.style.width = `${pageSize.width}px`;
    // FIX (10/07/2026 — bug "1 đoạn = 1 trang"): `pageSize.className` copy nguyên class của khung
    // đọc thật, trong đó có `h-full` (height:100%) — với `position:fixed`, `height:100%` phân giải
    // theo VIEWPORT (không phải pageSize.height mong muốn), làm `scrollHeight` LUÔN "phồng" lên cỡ
    // viewport. Ép `height: auto` ngay sau khi gán className (inline thắng class) để measureEl co
    // theo ĐÚNG nội dung thật.
    measureEl.style.height = 'auto';
    document.body.appendChild(measureEl);

    let endBlockIndex = cur.blockIndex;
    let endTextOffset = 0;

    for (let i = cur.blockIndex; i < blocks.length; i++) {
        const isFirstBlockOfPage = (i === cur.blockIndex);
        const sourceBlock = (isFirstBlockOfPage && cur.textOffset > 0) ? sliceBlockByTextRange(blocks[i], cur.textOffset, Infinity) : blocks[i];

        // Resume 1 khối bị cắt dở mà phần còn lại rỗng hẳn (hiếm, offset trùng đúng cuối khối) -> bỏ qua, sang khối kế.
        if (isFirstBlockOfPage && cur.textOffset > 0 && sourceBlock.textContent.trim().length === 0) {
            endBlockIndex = i + 1;
            continue;
        }

        measureEl.appendChild(sourceBlock.cloneNode(true));
        const currentHeight = measureEl.scrollHeight;

        if (currentHeight <= pageSize.height) {
            endBlockIndex = i + 1;
            endTextOffset = 0;
            continue; // còn chỗ (hoặc vừa khít) -> sang khối kế
        }

        // TRÀN.
        if (!isFirstBlockOfPage) {
            // KHÔNG PHẢI khối đầu tiên của trang -> bỏ lại, dồn NGUYÊN khối sang trang sau (như cũ).
            measureEl.removeChild(measureEl.lastChild);
            endBlockIndex = i;
            endTextOffset = 0;
            break;
        }

        // TRÀN và LÀ khối đầu tiên của trang — không còn khối nào khác để dồn -> thử CẮT KÝ TỰ.
        measureEl.removeChild(measureEl.lastChild);
        const splitResult = splitOversizedBlockToFit(sourceBlock, pageSize, measureEl);
        if (splitResult) {
            measureEl.appendChild(splitResult.fittedClone);
            endBlockIndex = i; // vẫn đứng ở khối NÀY (chưa dùng hết) cho trang sau
            endTextOffset = (isFirstBlockOfPage && cur.textOffset > 0 ? cur.textOffset : 0) + splitResult.charsUsed;
        } else {
            // Không có ký tự nào để cắt (vd toàn thẻ rỗng) -> lùi về hành vi CŨ: chấp nhận tràn nguyên khối.
            measureEl.appendChild(sourceBlock.cloneNode(true));
            endBlockIndex = i + 1;
            endTextOffset = 0;
        }
        break; // khối tràn (dù cắt được hay không) luôn là khối CUỐI của trang này
    }

    const slotHtml = Array.from(measureEl.children).map((el) => el.outerHTML).join('');
    document.body.removeChild(measureEl);

    return {
        slotHtml,
        nextCursor: { blockIndex: endBlockIndex, textOffset: endTextOffset },
        isLastSlot: endBlockIndex >= blocks.length && endTextOffset === 0,
    };
}
