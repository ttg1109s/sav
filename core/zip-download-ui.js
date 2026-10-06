/**
 * core/zip-download-ui.js — Core-UI modal "Tải xuống nhiều phần zip" (MỚI 06/10/2026, Giang yêu cầu chia zip
 * >500MB thành nhiều phần và hiện từng file zip lẻ ở modal download).
 *
 * Rule 5c: `wireZipPartsBody()` gắn sự kiện lên DOM ĐỘNG (bodyHtml của modalChoice — tạo mới mỗi lần mở, không có
 * sẵn lúc boot nên không wire được ở event/listener/) -> hậu tố -ui. Các hàm còn lại chỉ ghi DOM nhận qua tham số,
 * không tự quyết định nghiệp vụ. Template: components/zip-download-parts.js. Điều phối:
 * event/workflow/zip-download.js.
 *
 * Trạng thái nút KHÔNG đổi `data-uitk` (giữ nguyên màu theme đã áp lúc mở modal) — chỉ đổi chữ, disabled/độ mờ
 * và ẩn/hiện nhãn "Đã tải" (data-uitk="successText") có sẵn trong template, nên không cần áp lại theme.
 *
 * NẠP SAU: event/bus.js chỉ cần lúc CLICK (không lúc nạp) — vị trí nạp tự do sau core/dom-refs.js.
 */

/**
 * Wire danh sách phần zip (Rule 5a — 1 listener uỷ quyền, gom cuối hàm, callback CHỈ eventBus.send). Chỉ số phần
 * đọc từ `data-zip-part-index` của nút vừa chạm để làm payload, không quyết định gì thêm.
 * @param {HTMLElement} bodyEl - #modal-choice-body
 */
function wireZipPartsBody(bodyEl) {
    // --- addEventListener: gom cuối hàm (Rule 5a) ---
    bodyEl.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-zip-part-index]');
        if (!btn || btn.disabled) return;
        eventBus.send({ router: 'zipDownload', type: 'zipDownload.part.click', payload: { index: Number(btn.dataset.zipPartIndex) } });
    });
}

/** Nút của hàng đang giao file cho hệ điều hành — khoá + mờ, đổi chữ.
 * @param {HTMLElement} rowEl - [data-zip-part-row] @param {string} label */
function markZipPartDownloading(rowEl, label) {
    const btn = rowEl.querySelector('[data-zip-part-index]');
    btn.disabled = true;
    btn.classList.add('opacity-40', 'cursor-not-allowed');
    btn.textContent = label;
}

/** Hàng đã tải xong — hiện nhãn "Đã tải", mở lại nút (cho phép tải lại) với chữ mới.
 * @param {HTMLElement} rowEl @param {string} againLabel */
function markZipPartDownloaded(rowEl, againLabel) {
    const btn = rowEl.querySelector('[data-zip-part-index]');
    btn.disabled = false;
    btn.classList.remove('opacity-40', 'cursor-not-allowed');
    btn.textContent = againLabel;
    rowEl.querySelector('[data-zip-part-done]').classList.remove('hidden');
}

/** Hàng chưa tải (người dùng huỷ Share Sheet) — trả nút về trạng thái ban đầu, KHÔNG đụng nhãn "Đã tải" (nếu
 * trước đó đã tải 1 lần thì nhãn vẫn giữ).
 * @param {HTMLElement} rowEl @param {string} label */
function markZipPartIdle(rowEl, label) {
    const btn = rowEl.querySelector('[data-zip-part-index]');
    btn.disabled = false;
    btn.classList.remove('opacity-40', 'cursor-not-allowed');
    btn.textContent = label;
}

/** @param {HTMLElement} progressEl - #zip-parts-progress @param {string} text */
function setZipPartsProgressText(progressEl, text) {
    progressEl.textContent = text;
}
