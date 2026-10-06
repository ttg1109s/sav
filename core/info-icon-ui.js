/**
 * core/info-icon-ui.js — Core-UI DÙNG CHUNG: 1 icon nhỏ "i" chèn cạnh BẤT KỲ tiêu đề/label nào, bấm
 * vào hiện 1 POPOVER giải thích ngắn (text thuần + nút X) NGAY TẠI vị trí icon. MỚI (phản hồi Giang —
 * "thêm 1 hàm core chung phụ trợ tạo icon (i) nhỏ, click hiện text phù hợp, gồm cả nút X"). Nơi dùng: cạnh
 * tiêu đề "Motion" ở Settings > Visualizer Screen > Player, Settings > System > Recording.
 *
 * SỬA (06/10/2026, Giang: "(i) ấn vào không phải mở modal mà popover ngay vị trí của (i)") — thay popup giữa
 * màn (overlay đen + blur) bằng TOGGLETIP (mẫu Carbon/TPGi: bấm icon mới hiện, bấm lại icon hoặc bấm ra ngoài
 * thì đóng, nội dung `role="status"`). Vị trí kiểu Floating UI: ưu tiên NẰM DƯỚI icon, không đủ chỗ thì LẬT
 * lên trên; trượt ngang (shift) để luôn cách mép màn `INFO_POPOVER_EDGE_PX`. Không mũi tên (kiểu "rich tooltip"
 * Material 3) — card dùng modalCardBg của theme (Morphin là kính), mũi tên chồng lên kính trong suốt sẽ lộ mép.
 *
 * Bấm ra ngoài: 1 lớp "scrim" TRONG SUỐT (cụm DOM tự tạo — đúng Rule 5a, không gắn listener lên document/window)
 * phủ toàn màn, bấm vào = đóng + nuốt luôn cú bấm đó (giống popover iOS) — bấm lại đúng icon (i) cũng rơi vào
 * scrim nên tự thành "toggle" mà không cần Workflow giữ trạng thái. Scrim KHÔNG có màu/blur (không tốn compositor).
 *
 * `infoIconHtml(text)` — hàm THUẦN trả về 1 chuỗi HTML `<button>` nhỏ, nhúng thẳng vào BẤT KỲ
 * template tĩnh nào ở components/*.js (Rule 5d, core-function-conventions.md) — `text` được tự
 * escapeHtml() sẵn vào `data-info-text`, nơi gọi KHÔNG cần tự lo escape. Click do
 * event/listener/info-icon.js bắt DELEGATED trên `document.body` (1 chỗ DUY NHẤT cho TOÀN app), qua
 * event/router/info-icon.js -> workflowInfoIcon.show() (event/workflow/info-icon.js) -> `showInfoPopover()`.
 *
 * NẠP SAU: service/z-index.js (Z_INDEX), core/modal-choice-ui.js (escapeHtml()),
 * core/ui-theme/apply-ui.js (applyUiThemeToDom(), _activeUiThemeKeyList).
 */

const INFO_POPOVER_MAX_WIDTH_PX = 280; // bề rộng tối đa của popover
const INFO_POPOVER_EDGE_PX = 8;        // khoảng cách tối thiểu tới mép màn hình
const INFO_POPOVER_GAP_PX = 6;         // khoảng cách popover <-> icon

/** @param {string} text - nội dung giải thích, văn bản THUẦN (KHÔNG hỗ trợ HTML, khác modalChoice()
 * — escapeHtml() ngay tại đây nên nơi gọi không cần tự lo). @returns {string} */
function infoIconHtml(text) {
    return `<button type="button" class="info-icon-btn inline-flex items-center justify-center h-[18px] w-[18px] rounded-full text-[10px] font-bold leading-none shrink-0" data-uitk="accentIconBoxBg accentIconBoxText" data-info-text="${escapeHtml(text)}">i</button>`;
}

/** Core-UI: dựng + hiện popover giải thích neo tại `anchorEl` (icon (i) vừa bấm).
 * @param {string} text @param {HTMLElement} anchorEl */
function showInfoPopover(text, anchorEl) {
    // Tự đóng popover cũ (nếu lỡ có) — cùng phòng hờ như modalChoice().
    const stale = document.getElementById('info-popover-scrim');
    if (stale) stale.remove();

    const scrim = document.createElement('div');
    scrim.id = 'info-popover-scrim';
    scrim.className = 'fixed inset-0';
    scrim.style.zIndex = String(Z_INDEX.INFO_POPUP);

    const popover = document.createElement('div');
    popover.setAttribute('role', 'status');
    popover.className = 'fixed rounded-xl p-3 shadow-2xl flex items-start gap-2';
    popover.dataset.uitk = 'modalCardBg modalCardBorder';
    popover.style.width = `${Math.min(INFO_POPOVER_MAX_WIDTH_PX, window.innerWidth - INFO_POPOVER_EDGE_PX * 2)}px`;
    popover.style.left = '0px';
    popover.style.top = '0px';
    popover.style.visibility = 'hidden'; // đo kích thước thật trước, đặt vị trí xong mới hiện

    const textEl = document.createElement('p');
    textEl.className = 'text-sm leading-relaxed flex-1';
    textEl.dataset.uitk = 'modalBodyText';
    textEl.textContent = text; // textContent, KHÔNG innerHTML — text nhận từ dataset đã tự giải mã HTML entity qua parser
    popover.appendChild(textEl);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'w-6 h-6 flex items-center justify-center rounded-full transition-colors shrink-0';
    closeBtn.dataset.uitk = 'headerCloseHover headerCloseIcon';
    closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
    popover.appendChild(closeBtn);

    scrim.appendChild(popover);
    document.body.appendChild(scrim);
    if (typeof applyUiThemeToDom === 'function') applyUiThemeToDom(scrim, _activeUiThemeKeyList); // theme áp TRƯỚC khi đo (padding/viền đổi kích thước)

    // --- Đặt vị trí: dưới icon, thiếu chỗ thì lật lên trên; kẹp ngang trong màn hình ---
    const anchorRect = anchorEl.getBoundingClientRect();
    const popW = popover.offsetWidth, popH = popover.offsetHeight;
    const viewW = window.innerWidth, viewH = window.innerHeight;
    const belowTop = anchorRect.bottom + INFO_POPOVER_GAP_PX;
    const aboveTop = anchorRect.top - INFO_POPOVER_GAP_PX - popH;
    const placeAbove = belowTop + popH > viewH - INFO_POPOVER_EDGE_PX && aboveTop >= INFO_POPOVER_EDGE_PX;
    const rawTop = placeAbove ? aboveTop : belowTop;
    const top = Math.max(INFO_POPOVER_EDGE_PX, Math.min(rawTop, viewH - INFO_POPOVER_EDGE_PX - popH));
    const anchorCenterX = anchorRect.left + anchorRect.width / 2;
    const left = Math.max(INFO_POPOVER_EDGE_PX, Math.min(anchorCenterX - popW / 2, viewW - INFO_POPOVER_EDGE_PX - popW));
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
    popover.style.transformOrigin = `${anchorCenterX - left}px ${placeAbove ? '100%' : '0%'}`; // phóng ra từ phía icon
    popover.style.visibility = '';
    if (typeof popover.animate === 'function') {
        popover.animate([{ opacity: 0, transform: 'scale(0.92)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 140, easing: 'ease-out' });
    }

    // --- addEventListener: gom cuối hàm (Rule 5a — cụm DOM MỚI tự tạo bên trong chính hàm này) ---
    function closePopover() { scrim.remove(); }
    closeBtn.addEventListener('click', closePopover);
    scrim.addEventListener('click', (e) => {
        if (e.target !== scrim) return; // bấm TRONG popover (chữ) thì giữ nguyên
        closePopover();
    });
}
