/**
 * core/subtitle/subtitles-ui.js — Core NGHIỆP VỤ dựng UI cho danh sách dòng phụ đề (Rule 5,
 * core-function-conventions.md) — hậu tố `-ui` vì TỰ `createElement` dựng cụm DOM MỚI (mỗi dòng
 * sub là 1 card), khác `core/subtitle/subtitles.js` (thuần business logic, không đụng DOM).
 *
 * MỚI (10/07/2026, Subtitle Editor trang riêng) — layout theo yêu cầu Giang, THAY "chế độ sửa" ẩn/
 * hiện qua click cũ bằng LUÔN LUÔN sửa được tại chỗ (textarea không rời):
 * ```
 * -----------------
 * Line content (textarea, luôn sửa được)
 * -----------------
 * 🕐 Time range   |   ✓ áp dụng   ✕ xoá
 * ```
 * `renderSubtitleLines()` tự gắn TOÀN BỘ sự kiện (Rule 5a — gom cuối hàm), callback CHỈ nhận tham
 * số (`onApply`/`onRemove`/`onPullTime`) — KHÔNG gọi core khác (không gọi
 * `core/subtitle/subtitles.js`, Workflow tự làm việc phối hợp đó).
 *
 * NẠP SAU: lang/lang.js (t()).
 */

/**
 * @param {HTMLElement} containerEl
 * @param {Array<{id: string, text: string, startStr: string, endStr: string}>} subtitles
 * @param {{onApply: (id: string, changes: {text: string, startStr: string, endStr: string}) => void, onRemove: (id: string) => void}} callbacks
 */
function renderSubtitleLines(containerEl, subtitles, callbacks) {
    containerEl.replaceChildren();
    const cards = subtitles.map((sub) => {
        const card = document.createElement('div');
        card.className = 'sub-line-card border-b border-white/5 px-4 py-3 hover:bg-white/5 transition-colors';
        card.dataset.subId = sub.id;

        const textArea = document.createElement('textarea');
        textArea.rows = 2;
        textArea.className = 'w-full bg-transparent text-sm text-slate-100 resize-none outline-none placeholder:text-slate-500';
        textArea.value = sub.text;
        textArea.placeholder = t('subtitleEditor.line.placeholder');
        card.appendChild(textArea);

        const divider = document.createElement('div');
        divider.className = 'border-t border-white/10 my-2';
        card.appendChild(divider);

        const footer = document.createElement('div');
        footer.className = 'flex items-center justify-between gap-2';
        card.appendChild(footer);

        // 2 input thời gian LUÔN sửa được (KHÔNG còn ẩn sau "chế độ sửa" như bản cũ — vẫn CÙNG Ý
        // NGHĨA `edit-start-${id}`/`edit-end-${id}` cũ, chỉ đổi chỗ hiển thị).
        const timeWrap = document.createElement('div');
        timeWrap.className = 'flex items-center gap-1.5 shrink-0';
        const startInput = document.createElement('input');
        startInput.type = 'text';
        startInput.value = sub.startStr;
        startInput.className = 'w-[92px] text-center text-[11px] font-mono text-sky-300 bg-black/40 border border-white/10 rounded px-1 py-0.5 outline-none focus:border-sky-500';
        const arrow = document.createElement('span');
        arrow.className = 'text-slate-500 text-xs';
        arrow.textContent = '→';
        const endInput = document.createElement('input');
        endInput.type = 'text';
        endInput.value = sub.endStr;
        endInput.className = 'w-[92px] text-center text-[11px] font-mono text-sky-300 bg-black/40 border border-white/10 rounded px-1 py-0.5 outline-none focus:border-sky-500';
        timeWrap.appendChild(startInput);
        timeWrap.appendChild(arrow);
        timeWrap.appendChild(endInput);
        footer.appendChild(timeWrap);

        const actionsWrap = document.createElement('div');
        actionsWrap.className = 'flex items-center gap-1.5 shrink-0';
        footer.appendChild(actionsWrap);

        const applyBtn = document.createElement('button');
        applyBtn.type = 'button';
        applyBtn.title = t('subtitleEditor.line.btnApply');
        applyBtn.className = 'w-7 h-7 flex items-center justify-center rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 transition-colors';
        applyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>';
        actionsWrap.appendChild(applyBtn);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.title = t('subtitleEditor.line.btnRemove');
        removeBtn.className = 'w-7 h-7 flex items-center justify-center rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 transition-colors';
        removeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" /></svg>';
        actionsWrap.appendChild(removeBtn);

        containerEl.appendChild(card);
        return { sub, card, textArea, startInput, endInput, applyBtn, removeBtn };
    });

    // --- addEventListener: gom cuối hàm (Rule 5a) — callback CHỈ nhận tham số, không gọi core khác ---
    cards.forEach(({ sub, textArea, startInput, endInput, applyBtn, removeBtn }) => {
        applyBtn.addEventListener('click', () => callbacks.onApply(sub.id, { text: textArea.value, startStr: startInput.value, endStr: endInput.value }));
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
