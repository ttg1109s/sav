/**
 * Component: thân modal "Tải xuống nhiều phần zip" (MỚI 06/10/2026, Giang yêu cầu "khi zip lớn hơn 500MB thì
 * chia thành nhóm rồi zip, xong hiển thị các file zip lẻ ở modal download, tuân thủ theme key").
 *
 * `renderZipPartsBody(rows, progressText)` — bodyHtml cho modalChoice() (core/modal-choice-ui.js), đặt dưới câu
 * tóm tắt (tham số `text` của modalChoice): 1 dòng tiến độ "Đã tải x/n" + danh sách từng phần (tên, dung lượng,
 * số file, nút Tải xuống, nhãn "Đã tải"). Mọi màu đi qua `data-uitk` (core/ui-theme/*.js) — modalChoice() tự áp theme lúc dựng DOM.
 * Chỉ là template: chuỗi dữ liệu (tên file, dung lượng) do Workflow định dạng + escape sẵn
 * (event/workflow/zip-download.js). Tương tác wire ở core/zip-download-ui.js::wireZipPartsBody().
 *
 * Danh sách giới hạn chiều cao (style inline — class max-h-* tương ứng CHƯA có trong assets/css/tailwind.css,
 * tránh phải rebuild CSS) và tự cuộn khi có nhiều phần.
 */

/**
 * @param {Array<{filenameHtml: string, sizeText: string, countText: string}>} rows - đã escape sẵn
 * @param {string} progressText - "Đã tải 0 / n"
 * @returns {string}
 */
function renderZipPartsBody(rows, progressText) {
    const rowsHtml = rows.map((row, index) => `
                <div class="flex items-center gap-3 rounded-xl border p-3" data-zip-part-row="${index}" data-uitk="cardBg cardBorder">
                    <div class="flex-1 min-w-0">
                        <div class="text-sm font-medium truncate" data-uitk="textPrimary">${row.filenameHtml}</div>
                        <div class="text-xs mt-0.5" data-uitk="textSecondary">${row.sizeText} · ${row.countText}</div>
                        <div class="hidden text-xs font-semibold mt-0.5" data-zip-part-done data-uitk="successText">✓ ${t('common.export.partDownloaded')}</div>
                    </div>
                    <button type="button" class="shrink-0 px-3 py-2 rounded-lg text-sm font-semibold transition-colors" data-zip-part-index="${index}" data-uitk="btnPrimaryBg btnPrimaryHoverBg textOnAccent">${t('common.export.readyBtnDownload')}</button>
                </div>`).join('');
    return `
        <div class="flex flex-col gap-3">
            <p id="zip-parts-progress" class="text-xs font-semibold" data-uitk="textSecondary">${progressText}</p>
            <div class="flex flex-col gap-2 overflow-y-auto" style="max-height:50vh">${rowsHtml}
            </div>
        </div>
    `;
}
