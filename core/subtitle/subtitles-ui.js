/**
 * core/subtitle/subtitles-ui.js — Core NGHIỆP VỤ dựng UI cho danh sách dòng phụ đề (Rule 5,
 * core-function-conventions.md) — hậu tố `-ui` vì TỰ `createElement` dựng cụm DOM MỚI (mỗi dòng
 * sub là 1 card), khác `core/subtitle/subtitles.js` (thuần business logic, không đụng DOM).
 *
 * VIẾT LẠI (12/07/2026, yêu cầu Giang — khôi phục chế độ sửa + nút Áp dụng):
 * ```
 * -----------------
 * Line content (bình thường: chữ ĐỌC-THÔI, bấm NGUYÊN card để vào chế độ sửa)
 * -----------------  <- KHÔNG còn vạch phân chia (mục 2, đã bỏ hẳn div border-t)
 * 🕐 start → end   |   ▶ nghe thử   ✕ xoá         (bình thường)
 * 🕐 [nút start] → [nút end]   |   ▶ nghe thử   ✕ Huỷ   ✓ Áp dụng   (ĐANG SỬA)
 * ```
 *
 * 3 MODE (`uiState.mode`): 'normal' | 'selecting' (tool Shift) | 'editing' (bấm vào 1 dòng để sửa).
 * - 'normal': text/giờ ĐỌC-THÔI, bấm NGUYÊN card -> vào 'editing' cho ĐÚNG dòng đó.
 * - 'selecting': ô tròn chọn, bấm NGUYÊN card để chọn/bỏ chọn (tool Shift).
 * - 'editing': CHỈ 1 dòng (uiState.editingId) ở dạng sửa được thật (input text + nút giờ mở modal
 *   bánh xe + ✓ Áp dụng/✕ Huỷ) — MỌI dòng KHÁC bị khoá hẳn (mờ + pointer-events-none, yêu cầu Giang
 *   mục 4 "chặn các line subtitles khác"). Giờ start/end hiển thị của dòng đang sửa là giá trị
 *   PENDING (uiState.editingPendingStart/End — CHƯA Apply, đồng bộ 2 chiều với this._region qua
 *   Workflow, xem event/workflow/subtitle-editor.js::_syncPendingFromRegion()), KHÔNG phải
 *   sub.start/end đã lưu.
 *
 * Nút ▶ có 2 icon (play/pause, class `.sub-line-play-icon`/`.sub-line-pause-icon`) — Workflow tự
 * đổi TRỰC TIẾP (không qua render lại) theo dòng nào ĐANG thật sự phát (mục 1 — nút ▶ dòng cũng
 * toggle được y hệt "Phát vùng chọn"/"[▶]" khung điều khiển).
 *
 * DIFF-RENDER (mục 7, tận dụng thuật toán renderPlaylistDiff() core/playlist/render.js) — 1 Map
 * bền vững `subId -> card DOM` (Workflow giữ, truyền vào MỖI lần gọi qua `cardNodesById`) — node
 * NÀO không đổi thì GIỮ NGUYÊN 100%, chỉ thêm/xoá/dời đúng những node cần. Đổi `mode` (normal <->
 * selecting <-> editing) đổi HẲN cấu trúc MỌI card -> Workflow tự `cardNodesById.clear()` trước khi
 * gọi lại trong trường hợp đó (xem enterLineEditMode()/_exitLineEditMode()/
 * toggleShiftSelectionMode()).
 *
 * `renderSubtitleLines()`/`buildLineCard()` tự gắn TOÀN BỘ sự kiện (Rule 5a — gom cuối hàm),
 * callback CHỈ nhận tham số — KHÔNG gọi core khác.
 *
 * NẠP SAU: lang/lang.js (t()), core/subtitle/subtitles.js (secToStr()).
 */

const PLAY_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" class="sub-line-play-icon h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>'
    + '<svg xmlns="http://www.w3.org/2000/svg" class="sub-line-pause-icon h-3.5 w-3.5 hidden" fill="currentColor" viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"></path></svg>';
const X_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" /></svg>';
const CHECK_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>';

/** Tạo 1 card MỚI HOÀN TOÀN cho 1 dòng phụ đề — mọi listener gắn NGAY TẠI ĐÂY (đóng gói closure
 * theo ĐÚNG `sub`/`uiState` lúc dựng — an toàn vì Workflow luôn `cardNodesById.clear()`/`.delete()`
 * đúng lúc dữ liệu/mode đổi, ép dựng lại card mới). */
function buildLineCard(sub, uiState, callbacks) {
    const isSelecting = uiState.mode === 'selecting';
    const isEditingThis = uiState.mode === 'editing' && uiState.editingId === sub.id;
    const isBlockedByOtherEdit = uiState.mode === 'editing' && uiState.editingId !== sub.id;
    const isChecked = isSelecting && uiState.selectedIds.has(sub.id);

    const card = document.createElement('div');
    card.className = 'sub-line-card border-b border-white/5 transition-colors flex';
    card.dataset.subId = sub.id;

    if (isSelecting) {
        card.classList.add('cursor-pointer');
        card.classList.add(isChecked ? 'bg-sky-900/25' : 'hover:bg-white/5');
    } else if (isEditingThis) {
        card.classList.add('bg-indigo-950/40', 'ring-1', 'ring-inset', 'ring-indigo-500/40');
    } else if (isBlockedByOtherEdit) {
        // MỚI (yêu cầu Giang, mục 4) — "chặn các line subtitles khác" lúc đang sửa 1 dòng.
        card.classList.add('opacity-40', 'pointer-events-none');
    } else {
        card.classList.add('cursor-pointer', 'hover:bg-white/5'); // bình thường — bấm để vào sửa
    }

    if (isSelecting) {
        const checkboxWrap = document.createElement('div');
        checkboxWrap.className = 'flex items-center pl-4';
        const checkbox = document.createElement('div');
        checkbox.className = 'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ' + (isChecked ? 'bg-sky-500 border-sky-500' : 'border-slate-500');
        if (isChecked) checkbox.innerHTML = CHECK_ICON_SVG.replace('h-3.5 w-3.5', 'h-3 w-3 text-white');
        checkboxWrap.appendChild(checkbox);
        card.appendChild(checkboxWrap);
    }

    const contentCol = document.createElement('div');
    contentCol.className = 'flex-1 min-w-0';
    card.appendChild(contentCol);

    // Text — SỬA (yêu cầu Giang, mục 3) — CHỈ là <input> thật lúc ĐANG sửa dòng này; bình thường
    // là chữ ĐỌC-THÔI (bấm NGUYÊN card để vào sửa, KHÔNG còn luôn-sửa-được như bản trước).
    const textWrap = document.createElement('div');
    textWrap.className = 'px-4 pt-3 pb-2';
    let textInput;
    if (isEditingThis) {
        textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.value = sub.text;
        textInput.placeholder = t('subtitleEditor.line.placeholder');
        textInput.className = 'w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500';
    } else {
        textInput = document.createElement('div');
        textInput.className = 'w-full text-sm ' + (sub.text ? 'text-slate-100' : 'text-slate-500 italic');
        textInput.textContent = sub.text || t('subtitleEditor.line.placeholder');
    }
    textWrap.appendChild(textInput);
    contentCol.appendChild(textWrap);

    // FIX (yêu cầu Giang, mục 2) — BỎ HẲN vạch phân chia giữa nội dung/footer (trước đây 1 div
    // border-t riêng) — không dựng element này nữa, nội dung nối liền thẳng vào footer.

    const footer = document.createElement('div');
    footer.className = 'flex items-center justify-between gap-2 px-4 pt-1 pb-3';
    contentCol.appendChild(footer);

    // Giờ start/end — SỬA (mục 3) — CHỈ là <button> mở modal bánh xe lúc ĐANG sửa; bình thường là
    // chữ ĐỌC-THÔI. Lúc đang sửa, hiển thị giá trị PENDING (uiState.editingPending*, CHƯA Apply).
    const timeWrap = document.createElement('div');
    timeWrap.className = 'flex items-center gap-1.5 shrink-0';
    const displayStartStr = isEditingThis ? secToStr(uiState.editingPendingStart) : sub.startStr; // core
    const displayEndStr = isEditingThis ? secToStr(uiState.editingPendingEnd) : sub.endStr; // core
    let startBtn, endBtn;
    if (isEditingThis) {
        startBtn = document.createElement('button');
        startBtn.type = 'button';
        startBtn.className = 'sub-line-start-btn w-[92px] text-center text-[11px] font-mono text-sky-300 bg-black/40 border border-white/10 rounded px-1 py-1 outline-none hover:border-sky-500 transition-colors';
        endBtn = document.createElement('button');
        endBtn.type = 'button';
        endBtn.className = 'sub-line-end-btn w-[92px] text-center text-[11px] font-mono text-sky-300 bg-black/40 border border-white/10 rounded px-1 py-1 outline-none hover:border-sky-500 transition-colors';
    } else {
        startBtn = document.createElement('span');
        startBtn.className = 'sub-line-start-btn w-[92px] text-center text-[11px] font-mono text-slate-400';
        endBtn = document.createElement('span');
        endBtn.className = 'sub-line-end-btn w-[92px] text-center text-[11px] font-mono text-slate-400';
    }
    startBtn.textContent = displayStartStr;
    endBtn.textContent = displayEndStr;
    const arrow = document.createElement('span');
    arrow.className = 'text-slate-500 text-xs';
    arrow.textContent = '→';
    timeWrap.appendChild(startBtn);
    timeWrap.appendChild(arrow);
    timeWrap.appendChild(endBtn);
    footer.appendChild(timeWrap);

    const actionsWrap = document.createElement('div');
    actionsWrap.className = 'flex items-center gap-1.5 shrink-0';
    footer.appendChild(actionsWrap);

    // ▶ nghe thử — LUÔN hiện (bình thường lẫn đang sửa), CHỈ tắt lúc bị khoá bởi dòng khác đang sửa.
    const playRangeBtn = document.createElement('button');
    playRangeBtn.type = 'button';
    playRangeBtn.title = t('subtitleEditor.line.btnPlayRange');
    playRangeBtn.className = 'w-7 h-7 flex items-center justify-center rounded-full bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 transition-colors' + (isSelecting || isBlockedByOtherEdit ? ' pointer-events-none opacity-40' : '');
    playRangeBtn.innerHTML = PLAY_ICON_SVG; // MỚI (mục 1) — 2 icon play/pause, Workflow tự đổi trực tiếp
    actionsWrap.appendChild(playRangeBtn);

    let cancelBtn, applyBtn, removeBtn;
    if (isEditingThis) {
        // MỚI (yêu cầu Giang, mục 3 — "khôi phục nút Áp dụng") — ✕ Huỷ (thoát sửa, không lưu) + ✓
        // Áp dụng (lưu text + giờ PENDING).
        cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.title = t('subtitleEditor.line.btnCancelEdit');
        cancelBtn.className = 'w-7 h-7 flex items-center justify-center rounded-full bg-slate-500/15 hover:bg-slate-500/25 text-slate-300 transition-colors';
        cancelBtn.innerHTML = X_ICON_SVG;
        actionsWrap.appendChild(cancelBtn);

        applyBtn = document.createElement('button');
        applyBtn.type = 'button';
        applyBtn.title = t('subtitleEditor.line.btnApply');
        applyBtn.className = 'w-7 h-7 flex items-center justify-center rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 transition-colors';
        applyBtn.innerHTML = CHECK_ICON_SVG;
        actionsWrap.appendChild(applyBtn);
    } else {
        removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.title = t('subtitleEditor.line.btnRemove');
        removeBtn.className = 'w-7 h-7 flex items-center justify-center rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 transition-colors' + (isSelecting || isBlockedByOtherEdit ? ' pointer-events-none opacity-40' : '');
        removeBtn.innerHTML = X_ICON_SVG;
        actionsWrap.appendChild(removeBtn);
    }

    // --- addEventListener: gom cuối hàm (Rule 5a) — callback CHỈ nhận tham số, không gọi core khác ---
    if (isSelecting) {
        card.addEventListener('click', () => callbacks.onToggleSelect(sub.id));
    } else if (isEditingThis) {
        startBtn.addEventListener('click', () => callbacks.onOpenTimePicker(sub.id, 'start', uiState.editingPendingStart));
        endBtn.addEventListener('click', () => callbacks.onOpenTimePicker(sub.id, 'end', uiState.editingPendingEnd));
        playRangeBtn.addEventListener('click', () => callbacks.onPlayRange(sub.id, secToStr(uiState.editingPendingStart), secToStr(uiState.editingPendingEnd)));
        cancelBtn.addEventListener('click', () => callbacks.onCancelEdit());
        applyBtn.addEventListener('click', () => callbacks.onApplyEdit(sub.id, textInput.value));
    } else if (isBlockedByOtherEdit) {
        // KHÔNG gắn gì cả — pointer-events-none ở `card` đã chặn hết tương tác (mục 4).
    } else {
        // Bình thường — bấm card để vào chế độ sửa; ▶/✕ dùng stopPropagation để bấm 2 nút này
        // KHÔNG lỡ trigger vào chế độ sửa.
        card.addEventListener('click', () => callbacks.onEnterEdit(sub.id));
        playRangeBtn.addEventListener('click', (e) => { e.stopPropagation(); callbacks.onPlayRange(sub.id, sub.startStr, sub.endStr); });
        removeBtn.addEventListener('click', (e) => { e.stopPropagation(); callbacks.onRemove(sub.id); });
    }

    return card;
}

/**
 * @param {HTMLElement} containerEl
 * @param {Array<{id: string, text: string, start: number, end: number, startStr: string, endStr: string}>} subtitles ĐÃ sắp xếp sẵn theo start (Workflow lo, xem sortSubtitlesByStart())
 * @param {{
 *   onEnterEdit: (id: string) => void,
 *   onApplyEdit: (id: string, text: string) => void,
 *   onCancelEdit: () => void,
 *   onRemove: (id: string) => void,
 *   onPlayRange: (id: string, startStr: string, endStr: string) => void,
 *   onOpenTimePicker: (id: string, kind: 'start'|'end', currentSeconds: number) => void,
 *   onToggleSelect: (id: string) => void
 * }} callbacks
 * @param {{
 *   mode: 'normal'|'selecting'|'editing',
 *   selectedIds: Set<string>,
 *   editingId: string|null,
 *   editingPendingStart: number|null,
 *   editingPendingEnd: number|null
 * }} uiState
 * @param {Map<string, HTMLElement>} cardNodesById Map BỀN VỮNG (Workflow giữ nguyên qua các lần
 *   gọi) — thiếu key nào thì hàm này TỰ dựng card mới cho key đó; Workflow tự `.clear()`/`.delete()`
 *   TRƯỚC khi gọi hàm này nếu muốn ép dựng lại (đổi mode -> clear() toàn bộ; đổi dữ liệu 1 dòng ->
 *   delete() đúng id đó).
 */
function renderSubtitleLines(containerEl, subtitles, callbacks, uiState, cardNodesById) {
    // Lưới an toàn — số con lệch số Map (trạng thái hỏng/lần đầu) -> dọn sạch, dựng lại từ đầu.
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
            card = buildLineCard(sub, uiState, callbacks);
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
