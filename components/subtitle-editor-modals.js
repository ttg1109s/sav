/**
 * Component: phần thân (`bodyHtml` của modalChoice()) 2 modal nhập liệu của subtitle-editor.html — "Split" (chia vùng chọn
 * thành x dòng) và "Shift" (dịch giờ các dòng đã chọn). Chỉ trả chuỗi HTML, KHÔNG gắn sự kiện: Workflow giữ tham chiếu ô nhập
 * ngay sau khi mở modal và đọc `.value` / radio đang chọn trong `onClick` của nút xác nhận
 * (event/workflow/subtitle-editor.js::openSplitModal()/openShiftModal()).
 *
 * NẠP SAU: lang/lang.js (t()).
 */

/** Ô số dòng muốn chia (2–50, mặc định 2). */
function renderSubtitleSplitModalBody() {
    return `<input id="subtitle-split-count" type="number" min="2" max="50" value="2" inputmode="numeric" class="w-full text-center text-lg font-mono rounded-xl px-3 py-2 outline-none" data-uitk="inputBg inputBorder inputText">`;
}

/** Ô số giây dịch (cho phép gõ dấu trừ — dịch lùi) + 3 radio chọn áp dụng cho start / end / cả 2 (mặc định cả 2). Radio
 * gốc của trình duyệt — trạng thái chọn tự đổi, không cần listener. */
function renderSubtitleShiftModalBody() {
    const targets = [
        { key: 'both', label: t('subtitleEditor.shift.targetBoth') },
        { key: 'start', label: t('subtitleEditor.shift.targetStart') },
        { key: 'end', label: t('subtitleEditor.shift.targetEnd') },
    ];
    return `
        <div class="flex flex-col gap-3">
            <label for="subtitle-shift-amount" class="text-[11px] font-semibold uppercase tracking-wide" data-uitk="textSecondary">${t('subtitleEditor.shift.amountLabel')}</label>
            <input id="subtitle-shift-amount" type="number" step="0.1" value="0" inputmode="decimal" class="w-full text-center text-lg font-mono rounded-xl px-3 py-2 outline-none" data-uitk="inputBg inputBorder inputText">
            <span class="text-[11px] font-semibold uppercase tracking-wide" data-uitk="textSecondary">${t('subtitleEditor.shift.targetLabel')}</span>
            <div class="flex w-full p-1 rounded-xl gap-1" data-uitk="cardBg cardBorder">
                ${targets.map(({ key, label }) => `
                    <label class="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer" data-uitk="textPrimary">
                        <input type="radio" name="subtitle-shift-target" value="${key}"${key === 'both' ? ' checked' : ''} style="margin:0;accent-color:#0ea5e9">${label}
                    </label>`).join('')}
            </div>
        </div>
    `;
}
