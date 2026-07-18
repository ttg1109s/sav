/**
 * core/time-picker-modal.js — Core NGHIỆP VỤ tuân Rule 1-5 đầy đủ (core-function-conventions.md)
 * cho modal "bánh xe cuộn số" chọn thời gian, DÙNG CHUNG cho MỌI nơi cần chọn 1 khoảng thời gian
 * (KHÔNG riêng gì Subtitle Editor).
 *
 * TÁCH RA (18/07/2026, phản hồi Giang — "setting chọn thời gian mở modal picker y như cách
 * subtitles làm, đồng thời tách modal đó ra như 1 core thuần chung để tái sử dụng") — cơ chế
 * "bánh xe cuộn số" (scroll-snap, rubber-band kẹp biên, N cột phụ thuộc nhau theo tầng) TỪNG nằm
 * NGUYÊN VẸN bên trong `event/workflow/subtitle-editor.js::openTimePickerModal()` (chỉ có đúng 4
 * cột cố định hh/mm/ss/tenths) — giờ TỔNG QUÁT HOÁ thành N cột tuỳ theo tham số `format`, sống ở
 * ĐÂY. `event/workflow/subtitle-editor.js` giờ CHỈ còn 1 wrapper mỏng gọi vào đây (hành vi cũ GIỮ
 * NGUYÊN 100% — xem ghi chú "KHÔNG ĐỔI HÀNH VI" ở đó).
 *
 * THAM SỐ min/max: LUÔN nhận bằng MILI GIÂY (đơn vị canonical DUY NHẤT — Giang yêu cầu rõ: "Min
 * max này được quy đổi ra hết thành mili giây. Sau đó mới đọc format để xác định biên thực tế
 * theo định dạng") — hàm tự đọc `format` để quy đổi ra biên HIỂN THỊ thật cho từng cột, KHÔNG nhận
 * biên theo đơn vị hiển thị trực tiếp (tránh nhầm đơn vị giữa các nơi gọi khác nhau — nơi gọi Giây
 * (Slideshow) và nơi gọi Giờ-Phút-Giây-x100ms (Subtitle) đều truyền chung 1 đơn vị mili giây).
 *
 * `format`: chuỗi các đơn vị nối bằng "-", theo thứ tự THÔ -> MỊN. VÍ DỤ:
 *   - 'h-m-s-ms' — giờ, phút, giây, PHẦN MƯỜI GIÂY (Subtitle Editor dùng, giữ NGUYÊN hành vi cũ —
 *     token 'ms' ở đây là x100ms (0-9), KHÔNG phải mili giây thật 0-999 — 1 wheel 1000 dòng không
 *     thực tế cho UX cuộn tay, đây là diễn giải CHỦ Ý, không phải sơ suất).
 *   - 's' — CHỈ giây, KHÔNG giới hạn modulo 60 (vì là đơn vị THÔ NHẤT/DUY NHẤT trong format) —
 *     hiển thị thẳng giá trị thật (vd 5, 60, 120...) — Slideshow interval (5-60s) dùng dạng này.
 *   - 'm-s' — phút + giây (giây bị giới hạn 0-59 vì đã có phút đứng trước nó lo phần thô hơn).
 * QUY TẮC CHUNG: đơn vị ĐẦU TIÊN (thô nhất) trong format KHÔNG bị giới hạn modulo cố định — số
 * dòng cuộn của nó tính từ `maxMs` (bao nhiêu đơn vị đó thì tới hết `maxMs`). MỌI đơn vị SAU nó bị
 * giới hạn modulo tự nhiên (60 cho phút/giây, 10 cho phần mười giây, 24 cho giờ nếu giờ KHÔNG phải
 * đơn vị đầu — hiếm khi xảy ra trong thực tế vì giờ luôn đứng đầu nếu có mặt).
 *
 * NẠP SAU: lang/lang.js (t()) — file này chỉ gán text qua `textContent` (KHÔNG `innerHTML`), nên KHÔNG cần escapeHtml()/core/modal-choice.js.
 *
 * LƯU Ý RULE 3 (CẤM taskManager trong core) — 2 nơi dùng timer THUẦN của trình duyệt (KHÔNG phải
 * `taskManager` của project):
 *   1. Debounce "chờ lướt tay dừng hẳn rồi mới kẹp biên" — `setTimeout`/`clearTimeout` (bản gốc
 *      Subtitle Editor dùng `taskManager.once()`, hợp lệ vì đó là Workflow).
 *   2. Trì hoãn set vị trí cuộn ban đầu tới SAU khi layout đã chắc chắn xong — `requestAnimationFrame`
 *      (x2 liên tiếp, MỚI 18/07/2026 — fix bug "mở lần đầu hiện 0 0 0", xem cuối `openTimePickerModal()`).
 * CẢ 2 đều là timer PRIVATE, chỉ phục vụ tiểu tiết UI hoàn toàn NỘI BỘ trong chính các phần tử DOM
 * mà hàm này tự tạo ra, KHÔNG điều phối bất kỳ tiến trình nghiệp vụ nhiều bước nào xuyên file —
 * không vi phạm TINH THẦN Rule 3 (vốn nhắm tới việc core "giấu" orchestration nhiều bước qua
 * taskManager), dù có dùng timer.
 */

/** 1 đơn vị = bao nhiêu mili giây — 'ms' ở đây CỐ Ý là PHẦN MƯỜI GIÂY (x100ms), xem docstring đầu
 * file để biết lý do (giữ đúng hành vi Subtitle Editor cũ, tránh wheel 1000 dòng phi thực tế). */
const TIME_PICKER_UNIT_MS = { h: 3600000, m: 60000, s: 1000, ms: 100 };
/** Trần modulo tự nhiên — CHỈ áp dụng cho đơn vị KHÔNG phải đơn vị đầu tiên (thô nhất) trong format. */
const TIME_PICKER_UNIT_CAP = { h: 24, m: 60, s: 60, ms: 10 };
/** Nhãn hiển thị dưới mỗi cột — mặc định theo token, dùng chung mọi nơi gọi (đơn giản, dễ đoán). */
const TIME_PICKER_UNIT_LABEL = { h: 'HH', m: 'MM', s: 'SS', ms: 'x100ms' };

/**
 * Core thuần: parse chuỗi `format` (vd 'h-m-s-ms') + `maxMs` thành mảng mô tả từng cột cuộn, theo
 * thứ tự THÔ -> MỊN.
 *
 * `count` (số dòng render) của đơn vị ĐẦU TIÊN (index 0, thô nhất) = MAX(trần tự nhiên của đơn vị
 * đó, số dòng suy ra từ `maxMs`) — KHÔNG đơn thuần lấy theo `maxMs` (bug đã bắt được lúc soát lại
 * trước khi giao: nếu chỉ lấy theo `maxMs`, Subtitle Editor — format 'h-m-s-ms', cột 'h' đứng đầu —
 * với 1 bài hát vài phút (`maxMs` nhỏ) sẽ chỉ còn ĐÚNG 1 dòng "00" cho cột giờ, MẤT HẲN wheel 24
 * dòng gốc — vi phạm thẳng yêu cầu Giang "kiểm tra lại cả subtitle editor đúng như ban đầu, chưa
 * tách"). Lấy MAX cả 2 phía giải quyết ĐÚNG cho CẢ 2 ca:
 *   - Subtitle ('h' đứng đầu, `maxMs` nhỏ hơn 24h rất nhiều) -> trần tự nhiên (24) THẮNG -> wheel
 *     giờ vẫn đủ 24 dòng y hệt bản gốc, không đổi hành vi.
 *   - Slideshow ('s' đứng đầu MỘT MÌNH, `maxMs` = 60000 hoặc hơn) -> số dòng suy từ `maxMs` THẮNG
 *     (61 dòng, hơn hẳn trần tự nhiên 60 của giây) -> hiển thị ĐÚNG tới giá trị thật yêu cầu (vd
 *     tới 60, hoặc xa hơn nếu maxMs lớn hơn — "5, 60, 120" theo đúng ví dụ Giang).
 * Mọi đơn vị SAU đơn vị đầu (KHÔNG topmost) LUÔN lấy trần tự nhiên (60 cho phút/giây, 10 cho phần
 * mười giây) — KHÔNG bao giờ bị ảnh hưởng bởi `maxMs`.
 * @param {string} format
 * @param {number} maxMs
 * @returns {Array<{token: string, unitMs: number, isTop: boolean, count: number, label: string}>}
 */
function parseTimePickerFormat(format, maxMs) {
    return format.split('-').map((token, i) => {
        const unitMs = TIME_PICKER_UNIT_MS[token];
        const isTop = i === 0;
        const naturalCap = TIME_PICKER_UNIT_CAP[token];
        const countFromMaxMs = Math.max(1, Math.floor(maxMs / unitMs) + 1);
        const count = isTop ? Math.max(naturalCap, countFromMaxMs) : naturalCap;
        return { token, unitMs, isTop, count, label: TIME_PICKER_UNIT_LABEL[token] || token.toUpperCase() };
    });
}

/**
 * Core thuần: quy đổi `valueMs` thành mảng chỉ số CỤ THỂ cho từng cột (theo `units` đã parse) —
 * dùng để đặt vị trí cuộn ban đầu lúc mở modal. Đơn vị ĐẦU TIÊN lấy phần NGUYÊN (không modulo),
 * mọi đơn vị sau lấy PHẦN DƯ modulo count của chính nó.
 * @param {number} valueMs
 * @param {Array} units - từ parseTimePickerFormat().
 * @returns {number[]}
 */
function computeTimePickerInitialIndices(valueMs, units) {
    let remainingMs = Math.max(0, Math.round(valueMs));
    return units.map((u) => {
        const raw = Math.floor(remainingMs / u.unitMs);
        const idx = u.isTop ? Math.min(u.count - 1, raw) : Math.min(u.count - 1, raw);
        remainingMs -= idx * u.unitMs;
        return Math.max(0, idx);
    });
}

/**
 * Mở modal "bánh xe cuộn số" chọn thời gian — DÙNG CHUNG (tách từ Subtitle Editor, xem docstring
 * đầu file). Core THUẦN theo đúng nghĩa callback: KHÔNG appState.get()/set(), KHÔNG taskManager,
 * KHÔNG core-gọi-core khác — mọi input qua tham số, mọi output trả về qua `config.onConfirm`
 * (callback THUẦN, giống tiền lệ `modalChoice()` — core/modal-choice.js).
 *
 * Chặn THẬT việc cuộn ra ngoài [minMs,maxMs]: cho lướt tự do (giữ cảm giác cuộn mượt của native
 * scroll), rồi ngay khi lướt tay dừng hẳn (debounce 120ms), tự "snap" về mép gần nhất nếu đã vượt
 * biên (rubber-band). N cột phụ thuộc nhau theo tầng — bound của cột MỊN HƠN tính theo giá trị ỔN
 * ĐỊNH HIỆN TẠI của MỌI cột THÔ HƠN đứng trước nó — mỗi khi 1 cột thô hơn ổn định ở giá trị mới,
 * mọi cột mịn hơn tự kẹp lại theo bound mới ngay lập tức. Vẫn kẹp cứng lần cuối lúc bấm "Xong" để
 * luôn đúng dù cơ chế chặn cuộn có lỡ chưa kịp ổn định (bấm ngay sau khi vừa lướt xong).
 *
 * @param {{
 *   title: string,
 *   format: string,               // vd 'h-m-s-ms' | 's' | 'm-s' — thứ tự THÔ -> MỊN
 *   valueMs: number,               // giá trị hiện tại (mili giây)
 *   minMs: number,                 // biên dưới (mili giây)
 *   maxMs: number,                 // biên trên (mili giây)
 *   rangeHintText?: string,        // MỚI — dòng chú thích nhỏ dưới tiêu đề (vd "00:00:00,000 -
 *     00:05:23,120") — nơi gọi TỰ format theo domain riêng (secToStr() cho Subtitle, số giây thô
 *     cho Slideshow...) rồi truyền chuỗi ĐÃ FORMAT sẵn vào đây — modal chỉ hiển thị, không biết gì
 *     về cách format cụ thể (giữ Rule 1 — hàm này không cần biết ngữ cảnh domain của nơi gọi).
 *     Bỏ qua (không hiện dòng này) nếu không truyền.
 *   onConfirm: (resultMs: number) => void,
 *   zIndex?: number,               // mặc định 130 (ngang modalChoice())
 * }} config
 */
function openTimePickerModal(config) {
    const ITEM_H = 44; // px — PHẢI khớp đúng h-11 (44px) của mỗi số trong CSS bên dưới
    const zIndex = config.zIndex || 130;
    const units = parseTimePickerFormat(config.format, config.maxMs);
    const minMs = Math.max(0, config.minMs || 0);
    const maxMs = Math.max(minMs, config.maxMs || 0);

    // Giá trị ỔN ĐỊNH hiện tại của từng cột (CHỈ cập nhật khi cột đó "ổn định" — xem onSettle bên
    // dưới) — dùng để tính bound cho các cột MỊN HƠN theo tầng.
    const currentValues = computeTimePickerInitialIndices(config.valueMs, units);

    /** Tính [min,max] (đơn vị THÔ của tầng đó) hợp lệ cho `levelIndex`, dựa trên giá trị ỔN ĐỊNH
     * HIỆN TẠI của các tầng THÔ HƠN (index < levelIndex). */
    function boundsFor(levelIndex) {
        let prefixMs = 0;
        for (let i = 0; i < levelIndex; i++) prefixMs += currentValues[i] * units[i].unitMs;
        const { unitMs, count } = units[levelIndex];
        let min = Math.max(0, Math.floor((minMs - prefixMs) / unitMs + 1e-9));
        let max = Math.min(count - 1, Math.floor((maxMs - prefixMs) / unitMs + 1e-9));
        if (min > max) { min = 0; max = count - 1; } // an toàn — hiếm khi xảy ra (làm tròn biên) -> bỏ giới hạn tầng này, logic lúc "Xác nhận" vẫn kẹp đúng
        return [min, max];
    }

    /** Dựng 1 cột cuộn — `onSettle(index)` gọi SAU KHI lướt tay dừng hẳn VÀ đã tự kẹp về đúng
     * [min,max] (nếu cần). Debounce bằng setTimeout THUẦN (KHÔNG taskManager — xem docstring đầu
     * file, Rule 3). */
    function buildColumn(levelIndex, initIndex) {
        const { count } = units[levelIndex];
        const col = document.createElement('div');
        col.className = 'time-picker-col flex-1 h-[132px] overflow-y-scroll snap-y snap-mandatory';
        col.style.scrollSnapStop = 'always';
        const topSpacer = document.createElement('div'); topSpacer.style.height = ITEM_H + 'px'; col.appendChild(topSpacer);
        const items = [];
        const padWidth = String(count - 1).length < 2 ? 2 : String(count - 1).length;
        for (let i = 0; i < count; i++) {
            const item = document.createElement('div');
            item.className = 'h-11 flex items-center justify-center snap-center text-lg font-mono text-white';
            item.textContent = String(i).padStart(padWidth, '0');
            col.appendChild(item);
            items.push(item);
        }
        const bottomSpacer = document.createElement('div'); bottomSpacer.style.height = ITEM_H + 'px'; col.appendChild(bottomSpacer);
        items.forEach((item, i) => item.addEventListener('click', () => col.scrollTo({ top: i * ITEM_H, behavior: 'smooth' })));

        let settleTimeoutId = null;
        col.addEventListener('scroll', () => {
            if (settleTimeoutId) clearTimeout(settleTimeoutId);
            settleTimeoutId = setTimeout(() => {
                const idx = Math.round(col.scrollTop / ITEM_H);
                const [min, max] = boundsFor(levelIndex);
                const clamped = Math.max(min, Math.min(max, idx));
                if (clamped !== idx) col.scrollTo({ top: clamped * ITEM_H, behavior: 'smooth' }); // "bật lại" mép gần nhất — rubber-band
                currentValues[levelIndex] = clamped;
                reclampFinerThan(levelIndex);
            }, 120);
        });
        return col;
    }

    const cols = units.map((u, i) => buildColumn(i, currentValues[i]));

    /** Cột `levelIndex` vừa ổn định ở giá trị mới -> MỌI cột MỊN HƠN (index > levelIndex) cần tự
     * kẹp lại NGAY (bound của chúng vừa đổi theo giá trị mới này). */
    function reclampFinerThan(levelIndex) {
        for (let i = levelIndex + 1; i < units.length; i++) {
            const idx = Math.round(cols[i].scrollTop / ITEM_H);
            const [min, max] = boundsFor(i);
            const clamped = Math.max(min, Math.min(max, idx));
            if (clamped !== idx) cols[i].scrollTo({ top: clamped * ITEM_H, behavior: 'smooth' });
            currentValues[i] = clamped;
        }
    }

    const overlay = document.createElement('div');
    overlay.id = 'time-picker-modal-overlay';
    overlay.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center px-5';
    overlay.style.zIndex = String(zIndex);

    const card = document.createElement('div');
    card.className = 'bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-3';

    const titleEl = document.createElement('h3');
    titleEl.className = 'text-base font-bold text-white';
    titleEl.textContent = config.title || '';
    card.appendChild(titleEl);

    if (config.rangeHintText) {
        const rangeHintEl = document.createElement('p');
        rangeHintEl.className = 'text-[11px] text-slate-400 font-mono';
        rangeHintEl.textContent = config.rangeHintText;
        card.appendChild(rangeHintEl);
    }

    const wheelWrap = document.createElement('div');
    wheelWrap.className = 'relative flex gap-1';
    const highlightBand = document.createElement('div');
    highlightBand.className = 'absolute inset-x-0 top-1/2 -translate-y-1/2 h-11 bg-white/10 rounded-lg pointer-events-none border-y border-white/20';
    wheelWrap.appendChild(highlightBand);
    cols.forEach((col) => wheelWrap.appendChild(col));
    card.appendChild(wheelWrap);

    const labelRow = document.createElement('div');
    labelRow.className = 'flex gap-1 text-[10px] text-slate-500 text-center';
    units.forEach((u) => {
        const span = document.createElement('span'); span.className = 'flex-1'; span.textContent = u.label; labelRow.appendChild(span);
    });
    card.appendChild(labelRow);

    const buttonRow = document.createElement('div');
    buttonRow.className = 'flex gap-3 mt-1';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors';
    cancelBtn.textContent = t('common.cancel');
    buttonRow.appendChild(cancelBtn);
    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-bold transition-colors';
    confirmBtn.textContent = t('common.ok');
    buttonRow.appendChild(confirmBtn);
    card.appendChild(buttonRow);

    overlay.appendChild(card);

    // --- addEventListener: gom cuối hàm (Rule 5a — cụm DOM MỚI tự tạo bên trong chính hàm này) ---
    function closeModal() { overlay.remove(); }
    cancelBtn.addEventListener('click', closeModal);
    confirmBtn.addEventListener('click', () => {
        let resultMs = 0;
        units.forEach((u, i) => {
            const idx = Math.round(cols[i].scrollTop / ITEM_H);
            resultMs += idx * u.unitMs;
        });
        // Kẹp cứng LẦN CUỐI vào [minMs, maxMs] trước khi dùng — LUÔN đúng dù cơ chế chặn cuộn ở
        // trên có lỡ chưa kịp "ổn định" (debounce 120ms) hay không (vd bấm "Xong" ngay khi vừa
        // lướt xong, chưa đủ 120ms).
        resultMs = Math.max(minMs, Math.min(maxMs, resultMs));
        closeModal();
        config.onConfirm(resultMs);
    });

    document.body.appendChild(overlay);

    // FIX BUG (18/07/2026, phản hồi Giang — "input ban đầu là 1 nhưng khi click vẫn là 0 0 0, tắt
    // đi ấn lần 2 mới đúng") — set `scrollTop` NGAY SAU `appendChild()` (như bản trước) đôi khi
    // KHÔNG có tác dụng: trình duyệt CHƯA CHẮC đã hoàn tất layout cho cột vừa chèn tại đúng thời
    // điểm đồng bộ đó (đặc biệt rõ với Tailwind CDN JIT — tiêm CSS cho class MỚI THẤY LẦN ĐẦU qua
    // MutationObserver, BẤT ĐỒNG BỘ, không kịp trong cùng 1 tick — cột có thể tạm thời cao 0px lúc
    // gán scrollTop, khiến giá trị bị bỏ qua/kẹp về 0). Lần MỞ THỨ 2 "đúng" vì lúc đó Tailwind đã
    // tiêm xong CSS cho các class đó từ lần trước — không phải do modal tự nhớ gì cả.
    // SỬA: trì hoãn qua REQUESTANIMATIONFRAME 2 LẦN LIÊN TIẾP (double rAF — mẫu hình chuẩn để chờ
    // "chắc chắn đã qua ít nhất 1 lượt layout/paint đầy đủ" của DOM vừa chèn, đáng tin cậy hơn hẳn
    // set ngay lập tức hay dùng setTimeout(0) đơn thuần — vẫn có thể chạy trước paint đầu tiên).
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            cols.forEach((col, i) => { col.scrollTop = currentValues[i] * ITEM_H; });
        });
    });
}
