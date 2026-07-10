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
 * core/file-manager/document.js) — mỗi khối top-level LÀ 1 ĐƠN VỊ KHÔNG BAO GIỜ bị cắt đôi giữa 2
 * trang. Đánh đổi: nếu 1 khối dài hơn cả khung đọc, khối đó vẫn được xếp TRỌN vào 1 trang (tràn
 * khỏi khung nhìn thấy) — chấp nhận được (mục 4 plan-v12-extended.md), giống cách hầu hết
 * pagination engine thật làm (vd epub.js).
 *
 * Core THUẦN — tuân Rule 1-4: KHÔNG gọi hàm core nào khác (chỉ dùng API DOM có sẵn của trình
 * duyệt để dựng/đo/huỷ DOM tạm), KHÔNG tự appState.get(), KHÔNG dùng taskManager.
 *
 * NẠP SAU: không phụ thuộc gì (core THUẦN, tự dựng/huỷ DOM tạm, không cần core/dom-refs.js).
 */

/**
 * Tính 1 "trang" (slot) kế tiếp bắt đầu từ `cursor` (chỉ số khối 0-based) của `contentHtml`.
 * @param {string} contentHtml - chuỗi HTML ĐÃ sanitize (dãy phẳng các block h1-h6/p/ul/ol/blockquote,
 *        xem resolveDocumentHtml()/sanitizeDocumentHtml() — core/file-manager/document.js).
 * @param {number} cursor - chỉ số khối bắt đầu đo (0 = từ đầu tài liệu).
 * @param {{width: number, height: number, className: string}} pageSize - kích thước khung đọc
 *        THẬT (đo bằng clientWidth/clientHeight nơi gọi) + class Tailwind ÁP Y HỆT khung thật (cỡ
 *        chữ/line-height/padding — ảnh hưởng trực tiếp chiều cao đo được, PHẢI khớp tuyệt đối).
 * @returns {{slotHtml: string, nextCursor: number, isLastSlot: boolean}}
 */
function computeNextDocumentReaderSlot(contentHtml, cursor, pageSize) {
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

    if (blocks.length === 0 || cursor >= blocks.length) {
        return { slotHtml: '', nextCursor: blocks.length, isLastSlot: true };
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
    document.body.appendChild(measureEl);

    let endIndex = cursor;
    for (let i = cursor; i < blocks.length; i++) {
        measureEl.appendChild(blocks[i].cloneNode(true));
        endIndex = i + 1;
        if (i > cursor && measureEl.scrollHeight > pageSize.height) {
            // Khối vừa thêm làm TRÀN khung VÀ đây KHÔNG PHẢI khối đầu tiên của trang -> bỏ lại,
            // dồn sang trang sau. (Nếu TRÀN ngay ở khối ĐẦU TIÊN — i === cursor — vẫn GIỮ, chấp
            // nhận tràn, xem docstring đầu file.)
            measureEl.removeChild(measureEl.lastChild);
            endIndex = i;
            break;
        }
    }

    const slotHtml = Array.from(measureEl.children).map((el) => el.outerHTML).join('');
    document.body.removeChild(measureEl);

    return { slotHtml, nextCursor: endIndex, isLastSlot: endIndex >= blocks.length };
}
