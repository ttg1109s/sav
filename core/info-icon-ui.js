/**
 * core/info-icon-ui.js — Core-UI DÙNG CHUNG: 1 icon nhỏ "i" chèn cạnh BẤT KỲ tiêu đề/label nào, bấm
 * vào hiện 1 popup giải thích ngắn (text thuần + nút X đóng) — không cần dựng riêng modalChoice()
 * đầy đủ nút bấm chỉ để hiện 1 dòng chú thích. MỚI (phản hồi Giang — "thêm 1 hàm core chung phụ trợ
 * tạo icon (i) nhỏ, click hiện text phù hợp, gồm cả nút X"). Nơi dùng đầu tiên: cạnh tiêu đề "Motion"
 * ở Settings > Visualizer Screen > Player (components/settings/player-display-settings.js).
 *
 * `infoIconHtml(text)` — hàm THUẦN trả về 1 chuỗi HTML `<button>` nhỏ, nhúng thẳng vào BẤT KỲ
 * template tĩnh nào ở components/*.js (Rule 5d, core-function-conventions.md) — `text` được tự
 * escapeHtml() sẵn vào `data-info-text`, nơi gọi KHÔNG cần tự lo escape. Click do
 * event/listener/info-icon.js bắt DELEGATED trên `document.body` (1 chỗ DUY NHẤT cho TOÀN app — nơi
 * dùng `infoIconHtml()` không cần tự wire thêm gì), qua event/router/info-icon.js ->
 * workflowInfoIcon.show() (event/workflow/info-icon.js) -> `showInfoPopup()` dưới đây.
 *
 * `showInfoPopup(text)` — Core-UI dựng popup (Rule 5a: cụm DOM MỚI tự tạo, `addEventListener` gom
 * cuối hàm, callback KHÔNG gọi core khác). CÙNG khuôn `core/modal-choice-ui.js` (overlay/card/uitk/
 * Z_INDEX, dismiss khi bấm ra ngoài overlay) — nút X dùng ĐÚNG svg "M6 18L18 6M6 6l12 12" +
 * `data-uitk="headerCloseHover headerCloseIcon"` đã dùng thống nhất cho MỌI nút đóng khác trong app
 * (header Generic Drawer, EQ Presets, Custom Effect, Element Style Editor...).
 *
 * NẠP SAU: service/z-index.js (Z_INDEX), core/modal-choice-ui.js (escapeHtml()),
 * core/ui-theme/apply-ui.js (applyUiThemeToDom(), _activeUiThemeKeyList).
 */

/** @param {string} text - nội dung giải thích, văn bản THUẦN (KHÔNG hỗ trợ HTML, khác modalChoice()
 * — escapeHtml() ngay tại đây nên nơi gọi không cần tự lo). @returns {string} */
function infoIconHtml(text) {
    return `<button type="button" class="info-icon-btn inline-flex items-center justify-center h-[18px] w-[18px] rounded-full text-[10px] font-bold leading-none shrink-0" data-uitk="accentIconBoxBg accentIconBoxText" data-info-text="${escapeHtml(text)}">i</button>`;
}

/** Core-UI: dựng + hiện popup giải thích (text thuần + nút X đóng). @param {string} text */
function showInfoPopup(text) {
    // Tự đóng popup cũ (nếu lỡ có, hiếm khi xảy ra vì mỗi lần đều xoá hẳn DOM ngay sau khi đóng) —
    // cùng phòng hờ như modalChoice().
    const stale = document.getElementById('info-popup-overlay');
    if (stale) stale.remove();

    const overlay = document.createElement('div');
    overlay.id = 'info-popup-overlay';
    overlay.className = 'fixed inset-0 backdrop-blur-sm flex items-center justify-center px-5';
    overlay.dataset.uitk = 'overlayBg';
    overlay.style.zIndex = String(Z_INDEX.INFO_POPUP);

    const card = document.createElement('div');
    card.className = 'rounded-2xl w-full max-w-sm p-4 shadow-2xl flex items-start gap-3';
    card.dataset.uitk = 'modalCardBg modalCardBorder';

    const textEl = document.createElement('p');
    textEl.className = 'text-sm leading-relaxed flex-1';
    textEl.dataset.uitk = 'modalBodyText';
    textEl.textContent = text; // textContent, KHÔNG innerHTML — text nhận từ dataset đã tự giải mã HTML entity qua parser, gán thẳng làm text thuần, không cần escape lại
    card.appendChild(textEl);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'w-7 h-7 flex items-center justify-center rounded-full transition-colors shrink-0';
    closeBtn.dataset.uitk = 'headerCloseHover headerCloseIcon';
    closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
    card.appendChild(closeBtn);

    overlay.appendChild(card);

    // --- addEventListener: gom cuối hàm (Rule 5a — cụm DOM MỚI tự tạo bên trong chính hàm này) ---
    function closeModal() { overlay.remove(); }
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target !== overlay) return; // chỉ tính click ĐÚNG lên overlay, không phải lên card/nút bên trong
        closeModal();
    });

    document.body.appendChild(overlay);
    if (typeof applyUiThemeToDom === 'function') applyUiThemeToDom(overlay, _activeUiThemeKeyList);
}
