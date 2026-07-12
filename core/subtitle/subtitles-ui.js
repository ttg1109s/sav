/**
 * core/subtitle/subtitles-ui.js — Core NGHIỆP VỤ dựng UI cho danh sách dòng phụ đề (Rule 5,
 * core-function-conventions.md) — hậu tố `-ui` vì TỰ `createElement` dựng cụm DOM MỚI (mỗi dòng
 * sub là 1 card), khác `core/subtitle/subtitles.js` (thuần business logic, không đụng DOM).
 *
 * SỬA (12/07/2026, yêu cầu Giang, mục 7 — "tận dụng thuật toán diff node như playlist render") —
 * TRƯỚC ĐÂY `renderSubtitleLines()` luôn `containerEl.replaceChildren()` rồi dựng lại TOÀN BỘ
 * TOÀN BỘ card mỗi lần gọi — dù chỉ 1 dòng đổi giờ/text, CẢ danh sách "nhấp nháy" lại từ đầu (mất
 * vị trí cuộn, mất focus nếu đang gõ dòng khác). Đổi sang CÙNG thuật toán `renderPlaylistDiff()`
 * (core/playlist/render.js): 1 Map bền vững `subId -> card DOM` (Workflow giữ, truyền vào MỖI lần
 * gọi qua tham số `cardNodesById` — KHÔNG tự tạo Map mới trong hàm này) — node NÀO không đổi dữ
 * liệu thì GIỮ NGUYÊN 100% (không rebuild, không mất focus/scroll), chỉ thêm/xoá/dời ĐÚNG những
 * node cần. GIỐNG HỆT quy ước playlist: khi 1 dòng cụ thể đổi DỮ LIỆU (text/giờ), Workflow tự
 * `cardNodesById.delete(id)` TRƯỚC khi gọi lại renderSubtitleLines() — đánh dấu "dòng này cần dựng
 * lại card mới", các dòng KHÁC không đụng gì (xem event/workflow/subtitle-editor.js::
 * _commitLineText()/_applyLineTime()/_removeLine() — CÙNG PATTERN refreshSongNode() bên playlist).
 *
 * -----------------
 * Line content (input 1 dòng, luôn sửa được — auto-commit khi rời ô/blur, KHÔNG còn nút ✓ riêng)
 * -----------------  <- divider LIỀN VIỀN (card không padding ngang, divider full-bleed)
 * 🕐 [nút giờ start] → [nút giờ end]   |   ▶ nghe thử   ✕ xoá
 *
 * Nút giờ start/end là <button> (KHÔNG phải <input type=text> gõ tay) — bấm vào mở modal "bánh xe
 * cuộn số" (xem workflowSubtitleEditor.openTimePickerModal()).
 *
 * Hỗ trợ "chế độ chọn dòng" (selection.active = true, tool "Shift") — mỗi card đổi sang có ô tròn
 * chọn ở đầu, bấm NGUYÊN card để chọn/bỏ chọn (mọi input/nút khác dùng `pointer-events-none` —
 * KHÔNG dùng `disabled`, vì phần tử `disabled` triệt tiêu hẳn sự kiện click tại chỗ, không nổi bọt
 * lên `card` được nữa).
 *
 * `renderSubtitleLines()`/`buildLineCard()` tự gắn TOÀN BỘ sự kiện (Rule 5a — gom cuối hàm),
 * callback CHỈ nhận tham số — KHÔNG gọi core khác.
 *
 * NẠP SAU: lang/lang.js (t()).
 */

/** Tạo 1 card MỚI HOÀN TOÀN cho 1 dòng phụ đề — mọi listener gắn NGAY TẠI ĐÂY (đóng gói closure
 * theo ĐÚNG `sub` lúc dựng — an toàn vì Workflow LUÔN dựng lại card mới bất cứ khi nào dữ liệu dòng
 * này đổi, xem docstring đầu file). */
function buildLineCard(sub, isSelecting, isChecked, callbacks) {
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

    const textWrap = document.createElement('div');
    textWrap.className = 'px-4 pt-3 pb-2';
    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.value = sub.text;
    textInput.placeholder = t('subtitleEditor.line.placeholder');
    textInput.className = 'w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500' + (isSelecting ? ' pointer-events-none opacity-60' : '');
    textWrap.appendChild(textInput);
    contentCol.appendChild(textWrap);

    // FIX (yêu cầu Giang, mục 4 đợt trước — "divider hở") — card KHÔNG còn padding ngang riêng
    // (padding giờ nằm ở textWrap/footer), divider full-bleed hết chiều rộng thật của card.
    const divider = document.createElement('div');
    divider.className = 'border-t border-white/10';
    contentCol.appendChild(divider);

    const footer = document.createElement('div');
    footer.className = 'flex items-center justify-between gap-2 px-4 pt-2 pb-3';
    contentCol.appendChild(footer);

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

    // --- addEventListener: gom cuối hàm (Rule 5a) — callback CHỈ nhận tham số, không gọi core khác ---
    if (isSelecting) {
        card.addEventListener('click', () => callbacks.onToggleSelect(sub.id));
    } else {
        textInput.addEventListener('blur', () => {
            if (textInput.value !== sub.text) callbacks.onTextCommit(sub.id, textInput.value);
        });
        startBtn.addEventListener('click', () => callbacks.onOpenTimePicker(sub.id, 'start', sub.start));
        endBtn.addEventListener('click', () => callbacks.onOpenTimePicker(sub.id, 'end', sub.end));
        playRangeBtn.addEventListener('click', () => callbacks.onPlayRange(sub.startStr, sub.endStr));
        removeBtn.addEventListener('click', () => callbacks.onRemove(sub.id));
    }

    return card;
}

/**
 * @param {HTMLElement} containerEl
 * @param {Array<{id: string, text: string, start: number, end: number, startStr: string, endStr: string}>} subtitles ĐÃ sắp xếp sẵn theo start (Workflow lo, xem sortSubtitlesByStart())
 * @param {{
 *   onTextCommit: (id: string, text: string) => void,
 *   onRemove: (id: string) => void,
 *   onPlayRange: (startStr: string, endStr: string) => void,
 *   onOpenTimePicker: (id: string, kind: 'start'|'end', currentSeconds: number) => void,
 *   onToggleSelect: (id: string) => void
 * }} callbacks
 * @param {{active: boolean, selectedIds: Set<string>}} [selection] chế độ chọn dòng cho tool "Shift"
 * @param {Map<string, HTMLElement>} cardNodesById Map BỀN VỮNG (Workflow giữ nguyên qua các lần
 *   gọi) — thiếu key nào thì hàm này TỰ dựng card mới cho key đó; Workflow tự `.delete(id)` TRƯỚC
 *   khi gọi hàm này nếu muốn ép dựng lại 1 dòng cụ thể (dữ liệu dòng đó vừa đổi).
 */
function renderSubtitleLines(containerEl, subtitles, callbacks, selection, cardNodesById) {
    const isSelecting = !!(selection && selection.active);
    const selectedIds = (selection && selection.selectedIds) || new Set();

    // Lưới an toàn — số con lệch số Map (trạng thái hỏng/lần đầu) -> dọn sạch, dựng lại từ đầu.
    // CÙNG lưới an toàn với renderPlaylistDiff() (core/playlist/render.js).
    if (containerEl.children.length !== cardNodesById.size) {
        containerEl.replaceChildren();
        cardNodesById.clear();
    }

    const idSet = new Set(subtitles.map((sub) => sub.id));
    for (const [id, node] of Array.from(cardNodesById.entries())) {
        if (!idSet.has(id)) {
            node.remove();
            cardNodesById.delete(id);
        }
    }

    let prevNode = null;
    subtitles.forEach((sub) => {
        let card = cardNodesById.get(sub.id);
        if (!card) {
            card = buildLineCard(sub, isSelecting, selectedIds.has(sub.id), callbacks);
            cardNodesById.set(sub.id, card);
        }
        const expectedNextSibling = prevNode ? prevNode.nextSibling : containerEl.firstChild;
        if (expectedNextSibling !== card) containerEl.insertBefore(card, expectedNextSibling);
        prevNode = card;
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
