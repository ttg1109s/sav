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
 * core/file-manager/document.js) — mỗi khối top-level LÀ 1 ĐƠN VỊ, KHÔNG bị cắt đôi giữa 2 trang
 * NẾU vừa đủ chỗ, TRỪ khi tràn (xem "CẮT KÝ TỰ" bên dưới).
 *
 * CẮT KÝ TỰ (retry-cut) — khi 1 khối gây TRÀN trang, thử cắt ký tự để phần ĐẦU vừa khít trang,
 * phần CÒN LẠI tiếp tục ở (các) trang sau (xem cursor mở rộng `{blockIndex, textOffset}` bên
 * dưới).
 *
 * [SỬA 13/07/2026, Giang báo — "chỉ cắt khối ĐẦU, khối THƯỜNG tràn giữa trang vẫn dồn nguyên
 * sang trang sau dù còn dư nhiều chỗ trên trang hiện tại -> thừa 1 dải trống lớn"] — bản trước CHỈ
 * thử cắt ký tự khi khối gây tràn ĐỒNG THỜI là khối ĐẦU TIÊN của trang (không còn khối nào khác để
 * dồn) — khối THƯỜNG (tự nó không quá cao, chỉ tràn vì đã có khối khác trước nó chiếm chỗ) luôn bị
 * dồn NGUYÊN sang trang sau, kể cả khi trang hiện tại còn thừa rất nhiều khoảng trống. Giờ LUÔN thử
 * cắt ký tự trước (bất kể vị trí khối, đầu hay giữa trang) — chỉ dồn nguyên khi thật sự KHÔNG cắt
 * được gì (khối rỗng, hết cách đo).
 *
 * [SỬA 13/07/2026, Giang báo — "cắt xong vẫn thừa dải trống, do lùi né-cắt-giữa-từ quá tay"] —
 * siết lại độ khít của retry-cut: ngưỡng dừng "đủ khít" nâng từ 97% lên 99% chiều cao trang, tăng
 * số lần thử tối đa (6 -> 9) để có thêm cơ hội hội tụ sát hơn, VÀ giảm mức lùi tối đa của bước né
 * cắt giữa từ (30%/40 ký tự -> 12%/20 ký tự) — vẫn né cắt giữa từ nhưng không hy sinh nhiều chỗ
 * trống như trước.
 *
 * CURSOR — mở rộng từ số nguyên đơn (chỉ số khối) thành `{blockIndex, textOffset}` — `textOffset`
 * > 0 nghĩa là khối đó đang bị cắt dở từ lượt gọi trước, tiếp tục đọc từ ký tự đó. Vẫn nhận
 * `cursor` kiểu number CŨ để tương thích ngược (coi là `{blockIndex: cursor, textOffset: 0}`) — nơi
 * gọi (event/workflow/document-reader.js) không cần biết cấu trúc bên trong, chỉ CHUYỂN TIẾP
 * nguyên vẹn giá trị `nextCursor` nhận được ở lượt gọi trước, đúng tinh thần "cursor cơ hội" (opaque
 * token) đã có từ đầu.
 *
 * Core THUẦN — tuân Rule 1-4: KHÔNG tự appState.get(), KHÔNG dùng taskManager. Rule 3 (core không
 * gọi core khác, "không phân biệt cùng file/khác file" — xem docstring core/file-manager/
 * document.js) — [SỬA 13/07/2026, tự audit lại] bản trước tách `sliceBlockByTextRange()`/
 * `splitOversizedBlockToFit()`/`findWordBoundaryBefore()` thành 3 HÀM TOP-LEVEL riêng rồi biện
 * minh "cùng file nên chấp nhận gọi lẫn nhau" — SAI, tự mâu thuẫn với chính quy tắc đã nêu (Rule 3
 * không phân biệt cùng file). Giờ CẢ 3 chuyển thành CLOSURE lồng THẲNG bên trong
 * `computeNextDocumentReaderSlot()` — đúng tinh thần `sanitizeDocumentHtml()::walk()` (closure nội
 * bộ, không phải "hàm khác").
 *
 * NẠP SAU: không phụ thuộc gì (core THUẦN, tự dựng/huỷ DOM tạm, không cần core/dom-refs.js).
 */

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
    const SPLIT_MAX_TRIES = 9; // số lần thử tối đa khi nội suy điểm cắt ký tự — hội tụ rất nhanh (2-3 lần) với văn bản thường
    const SPLIT_FIT_THRESHOLD = 0.99; // coi là "đủ khít" khi đạt ≥99% chiều cao trang — dừng nới thêm
    const WORD_BOUNDARY_MAX_LOOKBACK = 200; // đừng lùi quá xa khi né cắt giữa từ — tránh co hụt cả trang nếu gặp chuỗi không khoảng trắng cực dài (vd URL)
    const WORD_BOUNDARY_MAX_GIVEUP_RATIO = 0.12; // mức hy sinh tối đa (tỉ lệ số ký tự) khi né cắt giữa từ
    const WORD_BOUNDARY_MAX_GIVEUP_MIN = 20; // .. hoặc tối thiểu cho phép (ký tự), lấy MAX của 2 mức
    const MIN_SPLIT_GAP_RATIO = 0.12; // chỗ trống còn lại (tỉ lệ chiều cao trang) TỐI THIỂU mới đáng cắt 1 khối KHÔNG PHẢI khối đầu trang — dưới mức này thà dồn nguyên sang trang sau còn hơn tạo 1 mảnh vụn vài ký tự

    const cur = (typeof cursor === 'number') ? { blockIndex: cursor, textOffset: 0 } : (cursor || { blockIndex: 0, textOffset: 0 });

    /** Cắt 1 khối THEO KÝ TỰ — trả bản CLONE chỉ chứa phần text trong [startOffset, endOffset)
     * (tính theo tổng ký tự textContent, đúng thứ tự DOM). PRESERVE cấu trúc thẻ lồng (vd
     * `<b>`/`<i>`/`<a>`) bằng cách thao tác TRỰC TIẾP trên node thật (rỗng hoá/cắt ngắn text node,
     * KHÔNG cắt chuỗi HTML thô — tránh hỏng cặp thẻ mở/đóng).
     * @param {Element} block @param {number} startOffset @param {number} endOffset - Infinity = tới hết block
     * @returns {Element} */
    function sliceBlockByTextRange(block, startOffset, endOffset) {
        const clone = block.cloneNode(true);
        let consumed = 0;
        (function walkText(node) {
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
                if (child.nodeType === Node.ELEMENT_NODE) walkText(child);
            });
        })(clone);
        return clone;
    }

    /** Tìm vị trí NGAY SAU khoảng trắng gần nhất trước `offset` (lùi tối đa
     * WORD_BOUNDARY_MAX_LOOKBACK ký tự). Không tìm thấy trong phạm vi -> trả lại nguyên `offset`
     * (nơi gọi tự hiểu là "chấp nhận cắt giữa từ", hiếm khi xảy ra với văn bản thường).
     * @param {string} text @param {number} offset @returns {number} */
    function findWordBoundaryBefore(text, offset) {
        const maxLookback = Math.min(offset, WORD_BOUNDARY_MAX_LOOKBACK);
        for (let i = offset; i > offset - maxLookback; i--) {
            if (/\s/.test(text[i - 1])) return i;
        }
        return offset;
    }

    /** Thử tách 1 khối gây TRÀN trang — đoán điểm cắt ban đầu bằng NỘI SUY tuyến tính (tỉ lệ chiều
     * cao mục tiêu / chiều cao đo được của TOÀN khối ~ tỉ lệ số ký tự cần giữ), ĐO LẠI THẬT bằng
     * DOM, CO/GIÃN theo tỉ lệ vừa đo mỗi vòng (tối đa SPLIT_MAX_TRIES lần) tới khi đạt
     * SPLIT_FIT_THRESHOLD, rồi né cắt giữa từ (lùi về khoảng trắng gần nhất, giới hạn mức hy sinh).
     * @param {Element} block - khối GỐC (chưa cắt) đang cần tách.
     * @param {HTMLElement} measureEl - DOM tạm dùng để đo, PHẢI đang RỖNG lúc gọi hàm này.
     * @returns {{fittedClone: Element, charsUsed: number}|null} null nếu khối không có ký tự nào để
     *   cắt (vd toàn thẻ rỗng) — nơi gọi tự lùi về chấp nhận tràn nguyên khối trong trường hợp đó. */
    function splitOversizedBlockToFit(block, measureEl) {
        const totalLen = block.textContent.length;
        if (totalLen === 0) return null;

        measureEl.appendChild(block.cloneNode(true));
        const fullHeight = measureEl.scrollHeight;
        measureEl.removeChild(measureEl.lastChild);
        if (fullHeight <= 0) return null;

        let guess = Math.max(1, Math.floor(totalLen * (pageSize.height / fullHeight)));
        let bestFit = null; // {chars, clone} — lần thử GẦN NHẤT đã vừa khít, giữ lại phòng vòng sau tệ hơn

        for (let attempt = 0; attempt < SPLIT_MAX_TRIES; attempt++) {
            guess = Math.min(totalLen - 1, Math.max(1, guess)); // luôn giữ ÍT NHẤT 1 ký tự cho trang sau — đảm bảo cursor tiến tới, không kẹt vòng lặp
            const candidate = sliceBlockByTextRange(block, 0, guess);
            measureEl.appendChild(candidate);
            const measuredHeight = measureEl.scrollHeight;
            measureEl.removeChild(measureEl.lastChild);

            if (measuredHeight <= pageSize.height) {
                bestFit = { chars: guess, clone: candidate };
                if (measuredHeight >= pageSize.height * SPLIT_FIT_THRESHOLD || guess >= totalLen - 1) break; // đủ khít, hoặc đã hết chữ để nới thêm -> dừng
                guess = Math.min(totalLen - 1, guess + Math.max(1, Math.floor((totalLen - guess) * 0.15))); // vừa khít nhưng còn dư nhiều chỗ -> nới thêm thử tiếp
            } else {
                guess = Math.max(1, Math.floor(guess * (pageSize.height / measuredHeight))); // vẫn tràn -> co lại ĐÚNG theo tỉ lệ vừa đo (nội suy lại, không chia đôi mù)
                if (bestFit && guess <= bestFit.chars) break; // không hội tụ thêm được nữa -> dùng bản vừa khít gần nhất đã có
            }
        }

        if (!bestFit) bestFit = { chars: 1, clone: sliceBlockByTextRange(block, 0, 1) }; // hết lượt thử vẫn không vừa (hiếm — trang quá nhỏ so với cỡ chữ) -> LUÔN giữ tối thiểu 1 ký tự để đảm bảo tiến tới

        // Né cắt GIỮA 1 TỪ — lùi điểm cắt về khoảng trắng GẦN NHẤT trước đó. CHỈ lùi nếu mức hy
        // sinh không quá lớn — gặp 1 chuỗi cực dài không khoảng trắng (vd URL) mà điểm trắng gần
        // nhất lại quá xa, thà chấp nhận cắt giữa chuỗi đó còn hơn bỏ phí phần lớn trang.
        const snapped = findWordBoundaryBefore(block.textContent, bestFit.chars);
        const givingUp = bestFit.chars - snapped;
        if (snapped > 0 && givingUp > 0 && givingUp <= Math.max(WORD_BOUNDARY_MAX_GIVEUP_MIN, bestFit.chars * WORD_BOUNDARY_MAX_GIVEUP_RATIO)) {
            bestFit = { chars: snapped, clone: sliceBlockByTextRange(block, 0, snapped) };
        }

        return { fittedClone: bestFit.clone, charsUsed: bestFit.chars };
    }

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

        const heightBeforeBlock = measureEl.scrollHeight; // 0 nếu trang đang trống (khối đầu) — dùng để tính "còn bao nhiêu chỗ trống" ngay dưới
        measureEl.appendChild(sourceBlock.cloneNode(true));
        const currentHeight = measureEl.scrollHeight;

        if (currentHeight <= pageSize.height) {
            endBlockIndex = i + 1;
            endTextOffset = 0;
            continue; // còn chỗ (hoặc vừa khít) -> sang khối kế
        }

        // TRÀN — LUÔN thử CẮT KÝ TỰ trước (bất kể khối này có phải khối đầu tiên của trang hay
        // không — xem "SỬA 13/07/2026" ở docstring đầu file: khối THƯỜNG tràn giữa trang cũng cần
        // cắt để lấp hết chỗ trống còn lại, không chỉ dồn nguyên sang trang sau).
        measureEl.removeChild(measureEl.lastChild);

        // NHƯNG chỉ đáng cắt nếu chỗ trống CÒN LẠI đủ lớn (không tính khối đầu — trang đang trống
        // trơn, dù gap nhỏ vẫn PHẢI cắt/thử hết cách vì không còn lựa chọn nào khác) — gap quá nhỏ
        // (dưới MIN_SPLIT_GAP_RATIO chiều cao trang) mà vẫn cắt sẽ tạo ra 1 mảnh vụn vài ký tự,
        // TRÔNG TỆ HƠN là dồn nguyên khối sang trang sau (gap nhỏ vốn không phải "dải trống lớn" mà
        // Giang phàn nàn — không cần cố lấp bằng mọi giá).
        const remainingGap = pageSize.height - heightBeforeBlock;
        const isWorthSplitting = isFirstBlockOfPage || remainingGap >= pageSize.height * MIN_SPLIT_GAP_RATIO;
        const splitResult = isWorthSplitting ? splitOversizedBlockToFit(sourceBlock, measureEl) : null;

        if (splitResult) {
            measureEl.appendChild(splitResult.fittedClone);
            endBlockIndex = i; // vẫn đứng ở khối NÀY (chưa dùng hết) cho trang sau
            endTextOffset = (isFirstBlockOfPage && cur.textOffset > 0 ? cur.textOffset : 0) + splitResult.charsUsed;
        } else if (!isFirstBlockOfPage) {
            // Không cắt được gì (gap quá nhỏ không đáng cắt, HOẶC khối rỗng/lỗi đo) NHƯNG đã có
            // khối khác trước đó trên trang này -> dồn NGUYÊN khối sang trang sau (như hành vi gốc,
            // trang hiện tại vẫn còn nội dung hợp lệ).
            // (measureEl đã KHÔNG còn sourceBlock — đã removeChild TRƯỚC khi xét ở trên rồi.)
            endBlockIndex = i;
            endTextOffset = 0;
        } else {
            // Không cắt được gì VÀ LÀ khối đầu (trang trống trơn, không còn lựa chọn nào khác) ->
            // chấp nhận tràn nguyên khối (hiếm — vd khối gần như không có ký tự để cắt).
            measureEl.appendChild(sourceBlock.cloneNode(true));
            endBlockIndex = i + 1;
            endTextOffset = 0;
        }
        break; // khối tràn (dù cắt được, dồn sang trang sau, hay chấp nhận tràn) luôn là khối CUỐI của trang này
    }

    const slotHtml = Array.from(measureEl.children).map((el) => el.outerHTML).join('');
    document.body.removeChild(measureEl);

    return {
        slotHtml,
        nextCursor: { blockIndex: endBlockIndex, textOffset: endTextOffset },
        isLastSlot: endBlockIndex >= blocks.length && endTextOffset === 0,
    };
}
