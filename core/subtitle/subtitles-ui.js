/**
 * core/subtitle/subtitles-ui.js — Core NGHIỆP VỤ dựng UI cho danh sách dòng phụ đề (Rule 5,
 * core-function-conventions.md) — hậu tố `-ui` vì TỰ `createElement` dựng cụm DOM MỚI (mỗi dòng
 * sub là 1 card), khác `core/subtitle/subtitles.js` (thuần business logic, không đụng DOM).
 *
 * VIẾT LẠI (11/07/2026, yêu cầu Giang — tương thích hệ waveform/toolbar mới + fix nút ✓ "vô dụng"):
 * ```
 * -----------------
 * Line content (input 1 dòng, luôn sửa được — auto-commit khi rời ô/blur, KHÔNG còn nút ✓ riêng)
 * -----------------  <- divider LIỀN VIỀN (card không padding ngang, divider full-bleed)
 * 🕐 [nút giờ start] → [nút giờ end]   |   ▶ nghe thử   ✕ xoá
 * ```
 * Nút giờ start/end giờ là <button> (KHÔNG còn <input type=text> gõ tay) — bấm vào mở modal
 * "bánh xe cuộn số" (xem workflowSubtitleEditor.openTimePickerModal()), tránh gõ sai định dạng
 * "HH:MM:SS,mmm" bằng bàn phím thường.
 *
 * Đã bỏ HẲN nút ✓ "Áp dụng" (Giang phản hồi: vô dụng/không rõ hoạt động hay không) — lý do gốc: vì
 * text/giờ "luôn sửa được tại chỗ" không có "chế độ sửa" riêng, nút ✓ tách biệt tạo cảm giác có
 * "trạng thái chưa lưu" nhưng KHÔNG có gì phân biệt trực quan giữa "đã ✓" và "gõ xong nhưng quên
 * ✓" — dễ mất bản sửa im lặng khi 1 hành động khác (Split/Thêm dòng/xoá dòng khác) trigger render
 * lại cả danh sách. Giờ auto-commit ngay khi rời ô (blur) cho text — giờ start/end auto-commit
 * ngay lúc bấm "Xong" trong modal bánh xe (không còn khái niệm "chờ Áp dụng" nữa).
 *
 * MỚI (yêu cầu Giang, tool "Shift") — hỗ trợ "chế độ chọn dòng" (selection.active = true): mỗi
 * card đổi sang có ô tròn chọn ở đầu, bấm NGUYÊN card để chọn/bỏ chọn (KHÔNG sửa nội dung được lúc
 * này — mọi input/nút khác `disabled`), tách biệt hẳn khỏi luồng sửa bình thường.
 *
 * `renderSubtitleLines()` tự gắn TOÀN BỘ sự kiện (Rule 5a — gom cuối hàm), callback CHỈ nhận tham
 * số — KHÔNG gọi core khác (không gọi `core/subtitle/subtitles.js`, Workflow tự làm việc phối hợp
 * đó).
 *
 * NẠP SAU: lang/lang.js (t()).
 */

/**
 * @param {HTMLElement} containerEl
 * @param {Array<{id: string, text: string, start: number, end: number, startStr: string, endStr: string}>} subtitles
 * @param {{
 *   onTextCommit: (id: string, text: string) => void,
 *   onRemove: (id: string) => void,
 *   onPlayRange: (startStr: string, endStr: string) => void,
 *   onOpenTimePicker: (id: string, kind: 'start'|'end', currentSeconds: number) => void,
 *   onToggleSelect: (id: string) => void
 * }} callbacks
 * @param {{active: boolean, selectedIds: Set<string>}} [selection] chế độ chọn dòng cho tool "Shift" (yêu cầu Giang)
 */
function renderSubtitleLines(containerEl, subtitles, callbacks, selection) {
    containerEl.replaceChildren();
    const isSelecting = !!(selection && selection.active);
    const selectedIds = (selection && selection.selectedIds) || new Set();

    const cards = subtitles.map((sub) => {
        const isChecked = selectedIds.has(sub.id);

        const card = document.createElement('div');
        card.className = 'sub-line-card border-b border-white/5 transition-colors flex' + (isSelecting ? ' cursor-pointer' : ' hover:bg-white/5');
        if (isSelecting && isChecked) card.classList.add('bg-sky-900/25');
        card.dataset.subId = sub.id;

        // MỚI (tool "Shift") — ô tròn chọn, CHỈ dựng khi đang ở chế độ chọn dòng.
        if (isSelecting) {
            const checkboxWrap = document.createElement('div');
            checkboxWrap.className = 'flex items-center pl-4';
            const checkbox = document.createElement('div');
            checkbox.className = 'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ' + (isChecked ? 'bg-sky-500 border-sky-500' : 'border-slate-500');
            if (isChecked) checkbox.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>';
            checkboxWrap.appendChild(checkbox);
            card.appendChild(checkboxWrap);
        }

        const contentCol = document.createElement('div');
        contentCol.className = 'flex-1 min-w-0';
        card.appendChild(contentCol);

        // SỬA (yêu cầu Giang, mục 4) — <textarea> 2 dòng -> <input> 1 dòng (phụ đề thường ngắn,
        // 1 dòng đủ dùng, gõ/xem gọn hơn trên di động).
        const textWrap = document.createElement('div');
        textWrap.className = 'px-4 pt-3 pb-2';
        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.value = sub.text;
        textInput.placeholder = t('subtitleEditor.line.placeholder');
        // FIX — dùng `pointer-events-none` (KHÔNG dùng `disabled`) lúc đang chọn dòng: phần tử
        // `disabled` triệt tiêu HẲN sự kiện click ngay tại chỗ (không nổi bọt lên `card` phía trên
        // nữa) — bấm đúng vùng input/nút con lúc đang chọn dòng sẽ KHÔNG chọn được gì. `pointer-
        // events-none` chỉ khiến phần tử "trong suốt" với chuột/chạm — click tự động tính cho
        // `card` (tổ tiên gần nhất có pointer-events bật), đúng ý "bấm nguyên card để chọn".
        textInput.className = 'w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500' + (isSelecting ? ' pointer-events-none opacity-60' : '');
        textWrap.appendChild(textInput);
        contentCol.appendChild(textWrap);

        // FIX (yêu cầu Giang, mục 4 — "divider hở") — card KHÔNG còn padding ngang riêng (padding
        // giờ nằm ở textWrap/footer), nên divider full-bleed hết chiều rộng thật của card, KHÔNG
        // dừng lại ở mép padding cũ như trước — liền mạch với 2 cạnh trái/phải, không hở.
        const divider = document.createElement('div');
        divider.className = 'border-t border-white/10';
        contentCol.appendChild(divider);

        const footer = document.createElement('div');
        footer.className = 'flex items-center justify-between gap-2 px-4 pt-2 pb-3';
        contentCol.appendChild(footer);

        // SỬA (yêu cầu Giang, mục 4) — 2 ô giờ giờ là <button> (KHÔNG còn gõ tay được) — bấm mở
        // modal "bánh xe cuộn số" (workflowSubtitleEditor.openTimePickerModal()).
        const timeWrap = document.createElement('div');
        timeWrap.className = 'flex items-center gap-1.5 shrink-0';
        const startBtn = document.createElement('button');
        startBtn.type = 'button';
        startBtn.className = 'w-[92px] text-center text-[11px] font-mono text-sky-300 bg-black/40 border border-white/10 rounded px-1 py-1 outline-none hover:border-sky-500 transition-colors' + (isSelecting ? ' pointer-events-none opacity-60' : '');
        startBtn.textContent = sub.startStr;
        const arrow = document.createElement('span');
        arrow.className = 'text-slate-500 text-xs';
        arrow.textContent = '→';
        const endBtn = document.createElement('button');
        endBtn.type = 'button';
        endBtn.className = 'w-[92px] text-center text-[11px] font-mono text-sky-300 bg-black/40 border border-white/10 rounded px-1 py-1 outline-none hover:border-sky-500 transition-colors' + (isSelecting ? ' pointer-events-none opacity-60' : '');
        endBtn.textContent = sub.endStr;
        timeWrap.appendChild(startBtn);
        timeWrap.appendChild(arrow);
        timeWrap.appendChild(endBtn);
        footer.appendChild(timeWrap);

        const actionsWrap = document.createElement('div');
        actionsWrap.className = 'flex items-center gap-1.5 shrink-0';
        footer.appendChild(actionsWrap);

        // ▶ phát ĐÚNG [start, end] của dòng này rồi tự dừng lại (KHÔNG chạy tiếp qua dòng sau).
        const playRangeBtn = document.createElement('button');
        playRangeBtn.type = 'button';
        playRangeBtn.title = t('subtitleEditor.line.btnPlayRange');
        playRangeBtn.className = 'w-7 h-7 flex items-center justify-center rounded-full bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 transition-colors' + (isSelecting ? ' pointer-events-none opacity-40' : '');
        playRangeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>';
        actionsWrap.appendChild(playRangeBtn);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.title = t('subtitleEditor.line.btnRemove');
        removeBtn.className = 'w-7 h-7 flex items-center justify-center rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 transition-colors' + (isSelecting ? ' pointer-events-none opacity-40' : '');
        removeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" /></svg>';
        actionsWrap.appendChild(removeBtn);

        containerEl.appendChild(card);
        return { sub, card, textInput, startBtn, endBtn, playRangeBtn, removeBtn };
    });

    // --- addEventListener: gom cuối hàm (Rule 5a) — callback CHỈ nhận tham số, không gọi core khác ---
    cards.forEach(({ sub, card, textInput, startBtn, endBtn, playRangeBtn, removeBtn }) => {
        if (isSelecting) {
            // Chế độ chọn dòng: bấm NGUYÊN card để chọn/bỏ chọn — mọi input/nút con đã `disabled`
            // ở trên nên không có listener riêng nào tranh chấp với listener này.
            card.addEventListener('click', () => callbacks.onToggleSelect(sub.id));
            return;
        }
        // Auto-commit text NGAY khi rời ô (blur) — CHỈ khi có đổi thật (tránh render lại cả danh
        // sách nếu người dùng chỉ bấm vào rồi bấm ra mà không gõ gì).
        textInput.addEventListener('blur', () => {
            if (textInput.value !== sub.text) callbacks.onTextCommit(sub.id, textInput.value);
        });
        startBtn.addEventListener('click', () => callbacks.onOpenTimePicker(sub.id, 'start', sub.start));
        endBtn.addEventListener('click', () => callbacks.onOpenTimePicker(sub.id, 'end', sub.end));
        // Đọc sub.startStr/endStr trực tiếp (không còn ô gõ tay để đọc live value nữa — giờ CHỈ đổi
        // qua modal bánh xe, tại thời điểm bấm ▶ giá trị hiển thị LUÔN khớp đúng sub hiện tại).
        playRangeBtn.addEventListener('click', () => callbacks.onPlayRange(sub.startStr, sub.endStr));
        removeBtn.addEventListener('click', () => callbacks.onRemove(sub.id));
    });
}

/**
 * Tô sáng card của dòng ĐANG PHÁT (viền + nền nhẹ) — gọi mỗi lần `timeupdate` audio đổi dòng đang
 * active, KHÔNG render lại toàn bộ danh sách (chỉ toggle class, rẻ hơn nhiều so với gọi lại
 * `renderSubtitleLines()`). KHÔNG addEventListener — hàm THUẦN chỉ đổi classList.
 * @param {HTMLElement} containerEl @param {string|null} activeSubId
 */
function updateActiveSubtitleLineHighlight(containerEl, activeSubId) {
    containerEl.querySelectorAll('.sub-line-card').forEach((card) => {
        card.classList.toggle('bg-emerald-900/20', card.dataset.subId === activeSubId);
    });
}
