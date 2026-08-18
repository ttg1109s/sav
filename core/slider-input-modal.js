/**
 * core/slider-input-modal.js — Core NGHIỆP VỤ tuân Rule 1-5 (core-function-conventions.md). MỚI
 * (08/08/2026, phản hồi Giang — panel "Âm thanh Video" của VBG: "thay vì 1 lần checkbox hiện ra
 * slider [riêng từng hàng], hiện icon volume + % -> nhấn vào đấy hiện modal chọn volume -> kéo
 * slider hoặc nhập số -> nhấn Apply mới áp dụng. Chỉ cần 1 modal dùng chung thay vì tạo list slider
 * cho mỗi bài").
 *
 * Modal ĐƠN GIẢN: 1 thanh trượt (range) + 1 ô nhập số, ĐỒNG BỘ 2 chiều (sửa cái này thì cái kia tự
 * cập nhật theo), kèm nút Huỷ/Áp dụng. TỔNG QUÁT — không riêng gì VBG audio volume, DÙNG CHUNG cho
 * MỌI nơi cần chọn 1 giá trị số trong khoảng qua modal (cùng tinh thần tổng quát hoá như
 * `core/time-picker-modal.js`, tách sẵn từ đầu thay vì đợi có nơi thứ 2 mới tách).
 *
 * CÙNG khuôn `core/modal-choice-ui.js`/`core/time-picker-modal.js`: dựng DOM bằng
 * `document.createElement` (KHÔNG dùng chuỗi innerHTML — tránh phải escape giá trị số), `addEventListener`
 * GOM CUỐI HÀM (Rule 5a — ngoại lệ hợp lệ cho cụm DOM ĐỘNG tự tạo bên trong CHÍNH hàm này lúc gọi,
 * khác với Listener TĨNH gắn 1 lần lúc app khởi động — cụm DOM này không tồn tại tới lúc hàm chạy
 * nên không thể gom về Listener như UI tĩnh khác). Input/output THUẦN qua tham số +
 * `config.onConfirm` callback — KHÔNG appState.get()/set(), KHÔNG eventBus, KHÔNG taskManager
 * ("Core thuần theo nghĩa callback", đúng tiền lệ modalChoice()/openTimePickerModal()).
 *
 * KHÔNG dùng `modalChoice()` (core/modal-choice-ui.js) làm nền — `text` của hàm đó chỉ nhận 1 khối
 * HTML tĩnh và ĐÓNG + XOÁ DOM NGAY khi bấm nút TRƯỚC KHI `onClick` chạy (xem docstring hàm đó) —
 * không có cách nào đọc lại giá trị slider/input NGAY LÚC bấm Apply nếu dựng qua đường đó, nên viết
 * riêng 1 modal độc lập (cùng khuôn `openTimePickerModal()`, không dùng chung `modalChoice()`).
 *
 * @param {{
 *   title: string,
 *   hintText?: string,            // dòng phụ dưới tiêu đề (vd tên video đang chỉnh)
 *   min?: number,                  // mặc định 0
 *   max?: number,                  // mặc định 100
 *   step?: number,                  // mặc định 1
 *   initialValue: number,
 *   unitSuffix?: string,           // hậu tố hiển thị cạnh ô nhập số (vd '%') — mặc định ''
 *   onConfirm: (value: number) => void,
 *   zIndex?: number,                // mặc định 130 (ngang modalChoice()/time-picker-modal)
 * }} config
 */
function openSliderInputModal(config) {
    const min = config.min ?? 0;
    const max = config.max ?? 100;
    const step = config.step ?? 1;
    const unitSuffix = config.unitSuffix || '';
    const zIndex = config.zIndex || 130;
    const clamp = (v) => Math.min(max, Math.max(min, v));
    let currentValue = clamp(Math.round(config.initialValue));

    const overlay = document.createElement('div');
    overlay.id = 'slider-input-modal-overlay';
    overlay.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center px-5';
    overlay.style.zIndex = String(zIndex);

    const card = document.createElement('div');
    card.className = 'bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-4';

    const titleEl = document.createElement('h3');
    titleEl.className = 'text-base font-bold text-white';
    titleEl.textContent = config.title || '';
    card.appendChild(titleEl);

    if (config.hintText) {
        const hintEl = document.createElement('p');
        hintEl.className = 'text-xs text-slate-400 truncate';
        hintEl.textContent = config.hintText;
        card.appendChild(hintEl);
    }

    const row = document.createElement('div');
    row.className = 'flex items-center gap-3';

    const sliderEl = document.createElement('input');
    sliderEl.type = 'range';
    sliderEl.min = String(min);
    sliderEl.max = String(max);
    sliderEl.step = String(step);
    sliderEl.value = String(currentValue);
    sliderEl.className = 'flex-1 accent-sky-500';
    row.appendChild(sliderEl);

    const numberWrap = document.createElement('div');
    numberWrap.className = 'flex items-center gap-1 shrink-0';
    const numberEl = document.createElement('input');
    numberEl.type = 'number';
    numberEl.min = String(min);
    numberEl.max = String(max);
    numberEl.step = String(step);
    numberEl.value = String(currentValue);
    numberEl.className = 'w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white text-right';
    numberWrap.appendChild(numberEl);
    if (unitSuffix) {
        const suffixEl = document.createElement('span');
        suffixEl.className = 'text-xs text-slate-400';
        suffixEl.textContent = unitSuffix;
        numberWrap.appendChild(suffixEl);
    }
    row.appendChild(numberWrap);
    card.appendChild(row);

    const buttonRow = document.createElement('div');
    buttonRow.className = 'flex gap-3 mt-1';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors';
    cancelBtn.textContent = t('common.cancel');
    buttonRow.appendChild(cancelBtn);
    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-bold transition-colors';
    applyBtn.textContent = t('common.apply');
    buttonRow.appendChild(applyBtn);
    card.appendChild(buttonRow);

    overlay.appendChild(card);

    // --- addEventListener: gom cuối hàm (Rule 5a — cụm DOM MỚI tự tạo bên trong chính hàm này, cùng khuôn openTimePickerModal()) ---
    function closeModal() { overlay.remove(); }
    sliderEl.addEventListener('input', () => {
        currentValue = clamp(Number(sliderEl.value));
        numberEl.value = String(currentValue);
    });
    numberEl.addEventListener('input', () => {
        const parsed = Number(numberEl.value);
        if (!Number.isFinite(parsed)) return; // đang gõ dở (vd vừa xoá hết) -> chưa ép clamp, đợi gõ tiếp/rời focus
        currentValue = clamp(parsed);
        sliderEl.value = String(currentValue);
    });
    numberEl.addEventListener('blur', () => { numberEl.value = String(currentValue); }); // rời focus -> luôn hiện đúng giá trị đã clamp (fix trường hợp gõ dở/quá biên còn sót lại)
    cancelBtn.addEventListener('click', closeModal);
    applyBtn.addEventListener('click', () => {
        closeModal();
        config.onConfirm(currentValue);
    });

    document.body.appendChild(overlay);
}
