/**
 * core/settings-panel-stack-ui.js — Ngăn xếp (stack) panel cho Settings.
 *
 * ĐỔI TÊN (12/07/2026, audit Rule 5c — xem readme/changelog/v12.md mục 15) — file này TỰ TẠO panel
 * DOM MỚI (`_buildPanelInnerHtml()`, `document.createElement`) — đúng định nghĩa "dựng cụm UI mới"
 * của Rule 5, PHẢI có hậu tố `-ui.js` (trước đây tên `settings-panel-stack.js`, thiếu hậu tố — xoá
 * file cũ đó thủ công nếu còn sót). Đoạn docstring cũ tự nhận "Core UI THUẦN... KHÔNG thuộc phạm vi
 * Rule 1-4" — CÂU NÀY SAI, xem đoạn đã sửa lại cuối docstring này.
 *
 * === VIẾT LẠI (06/07/2026, phản hồi Giang sau khi xem UI thật — sửa lại thiết kế Batch D1) ===
 * Thiết kế CŨ (Batch D1): panel mới trượt CHE LÊN panel cũ (panel cũ đứng yên `left:0`, bị che
 * khuất chứ không di chuyển) + header DÙNG CHUNG 1 khối ngoài panel, đổi text NGAY LẬP TỨC lúc
 * push/pop trong khi panel còn đang trượt — Giang chỉ ra 2 vấn đề đã sửa lúc đó (panel cũ tự lo
 * nền riêng; header lệch nhịp animation).
 *
 * === VIẾT LẠI TIẾP (08/07/2026, HOTFIX 17, Giang chốt: "Áp dụng scrollLeft cho setting > sub-
 * setting thay vì move left position") ===
 * Bản 06/07/2026 tự animate `left` (`position: absolute`, CSS `transition: left 500ms`) — ĐÚNG
 * pattern gây hàng loạt bug đã dò ra ở HOTFIX 12-16 (cuộn Playlist<->Settings): tự tay animate 1
 * thuộc tính vị trí luôn tiềm ẩn xung đột với animation/rendering khác, không tận dụng được cơ chế
 * cuộn NATIVE của trình duyệt. Đổi hẳn sang CÙNG pattern đã chứng minh ổn định cho
 * `#side-left-container` (Playlist<->Settings) — cuộn ngang THẬT (`overflow-x`, `scrollTo()`):
 *   - `#settings-stack-body` giờ là khung cuộn ngang (`display:flex; overflow-x:hidden;`) — MỌI
 *     panel (kể cả Main) là 1 "trang" NẰM CẠNH NHAU theo thứ tự DOM (`flex-shrink:0; width:100%`),
 *     KHÔNG còn `position:absolute`/`left` tự animate nữa.
 *   - PUSH: panel mới APPEND vào CUỐI, rồi cuộn mượt sang nó.
 *   - POP: cuộn ngược về panel liền trước — Workflow vẫn tự chờ `SLIDER_PANEL_SCROLL_ESTIMATED_MS`
 *     (taskManager, Rule 3) rồi mới xoá DOM panel vừa trượt ra (KHÔNG đổi luồng workflow — xem
 *     event/workflow/settings-stack-nav.js).
 *   - `resetSettingsStackToMain()`: cuộn thẳng về vị trí 0, KHÔNG animation.
 *
 * === RÚT HÀM DÙNG CHUNG (09/07/2026, theo kế hoạch đã thống nhất) === Bản HOTFIX 17 ở trên tự viết
 * `scrollTo({left: clientWidth * index, behavior})` NGAY TRONG file này — TRÙNG logic với
 * `core/player-controls.js` (cũng tự viết `scrollTo()` riêng cho `#side-left-container`) — 2 bộ
 * logic song song làm cùng 1 việc. Rút đúng 2 hàm dùng chung ra `core/slider-panel-scroll.js`
 * (`getPositionStart(el)`/`scrollSliderTo(containerEl, position, animate)`), file này VÀ
 * `core/player-controls.js` giờ gọi THẲNG 2 hàm đó — không còn tính `clientWidth * index` tay (dùng
 * `getPositionStart(panelEl)` — vị trí layout THẬT của panel, không đoán qua index).
 *
 * THIẾT KẾ SLIDER (2 panel luôn cùng di chuyển 1 lúc, GIỮ NGUYÊN tinh thần bản 06/07 — chỉ đổi CƠ
 * CHẾ animate, không đổi CẢM GIÁC):
 *   - Mỗi panel (kể cả Main) TỰ MANG header CỦA CHÍNH NÓ (title + nút Back/Close) NGAY TRONG thân
 *     panel — xem `_buildPanelInnerHtml()` — header luôn trượt ĐÚNG NHỊP với nội dung (cùng 1 khối
 *     DOM cuộn theo cha, không tách rời).
 *   - PUSH (mở panel con): panel HIỆN TẠI vẫn nằm nguyên trong DOM (không xoá) — chỉ đơn giản là
 *     "trang" TRƯỚC panel mới trong khung cuộn ngang — cuộn sang phải 1 trang.
 *   - POP (bấm Back): cuộn ngược lại 1 trang — panel liền trước hiện lại ĐÚNG vị trí cũ, KHÔNG cần
 *     "khôi phục" gì (chưa hề bị xoá lúc push).
 *   - Main (panel gốc, index 0 trong `settingsPanelStackEntries`) KHÔNG BAO GIỜ bị pop/xoá — chỉ
 *     `resetSettingsStackToMain()` (đóng hẳn Settings) mới xoá MỌI panel phía trên Main.
 *
 * MANG TƯ DUY Generic Drawer (core/generic-drawer.js, Nhóm A mục 2) NHƯNG KHÔNG dùng chung — bản
 * chất khác: Generic Drawer chỉ swap 2 trạng thái (List <-> Read), còn Settings cần NGĂN XẾP thật,
 * độ sâu tuỳ ý (Main -> Song -> Folder Detail là 2 cấp, xem event/workflow/file-manager-song.js).
 *
 * File này DỰNG UI (Rule 5) — KHÔNG miễn Rule 1-4: mọi hàm ở đây vẫn tuân thủ đầy đủ (chỉ nhận
 * tham số, không tự `appState.get()`, không tự `taskManager`, không core-gọi-core) — chỉ CỘNG
 * THÊM yêu cầu riêng của Rule 5 (hậu tố `-ui.js`, `addEventListener` gom cuối hàm nếu có). Không có
 * khái niệm "core UI thuần đứng ngoài 4 rule" — xem đoạn debunk ở đầu `core-function-conventions.md`.
 *
 * QUAN TRỌNG — 8 khu vực ĐÃ migrate trước batch này (About/Subtitle/Visualizer/Slideshow/Song/
 * Folder Detail/Photo/Documents) KHÔNG cần sửa GÌ CẢ: `pushSettingsPanel({title, bodyHtml,
 * fullBleed})` GIỮ NGUYÊN chữ ký y hệt — chỉ phần TRIỂN KHAI BÊN TRONG file này đổi (cuộn ngang
 * thay vì animate `left`).
 *
 * NẠP SAU: core/dom-refs.js (settingsStackBody, settingsStackPanelMain), core/slider-panel-
 * scroll.js (getPositionStart, scrollSliderTo, SLIDER_PANEL_SCROLL_ESTIMATED_MS — hằng số ước
 * lượng thời gian cuộn giờ SỐNG Ở FILE ĐÓ, dùng chung cho mọi nơi cuộn, không còn hằng số riêng ở
 * file này nữa).
 */

/** Ngăn xếp panel — index 0 LUÔN là Main (KHÔNG BAO GIỜ bị pop, chỉ reset() mới xoá phần còn lại).
 * Gán giá trị khởi tạo NGAY khi file này chạy (nạp SAU dom-refs.js nên `settingsStackPanelMain` đã
 * tồn tại) — Main được dựng HTML tĩnh sẵn ở components/settings-drawer.js, ở đây chỉ "đăng ký" nó
 * vào ngăn xếp để push/pop sau này biết panel liền trước là ai. */
let settingsPanelStackEntries = [{ panelEl: settingsStackPanelMain }];

/**
 * Dựng HTML đầy đủ 1 panel (header + body) — DÙNG CHUNG cho mọi panel con (Main tự dựng header
 * riêng trong components/settings-drawer.js vì có nút Close thay vì Back, không gọi hàm này).
 * @param {string} title - ĐÃ dịch sẵn qua t() (nơi gọi tự lo i18n, file này không biết `lang/`).
 * @param {string} bodyHtml
 * @param {boolean} fullBleed - bỏ qua wrapper "max-w-2xl mx-auto space-y-5" + padding mặc định,
 *        dùng cho nội dung cố tình tràn viền (vd Photo — masonry ảnh, xem Batch D6).
 */
/**
 * MỚI (14/07/2026, mục cuối phản hồi Giang — "đem nút upload lên phải header") — `headerActionHtml`
 * (tuỳ chọn): chuỗi HTML 1 cụm hành động, đặt `absolute right-4` ĐỐI XỨNG nút Back (`absolute
 * left-4`) — trước đây header chỉ có Back + title, panel nào cần thêm nút riêng phải tự dựng 1
 * THANH NHỎ bên dưới header (xem lịch sử ở components/file-manager.js, Photo & Album). Nơi gọi
 * (Workflow) tự `querySelector` trong panel trả về để wire event, giống mọi nội dung body khác.
 */
function _buildPanelInnerHtml(title, bodyHtml, fullBleed, headerActionHtml) {
    const bodyWrapperClass = fullBleed
        ? 'flex-grow overflow-y-auto'
        : 'flex-grow overflow-y-auto px-4 py-4 sm:px-8 pb-20';
    const bodyInner = fullBleed ? bodyHtml : `<div class="max-w-2xl mx-auto space-y-5">${bodyHtml}</div>`;
    return `
        <div class="relative flex items-center justify-center px-14 py-3 sm:px-16 h-14 shrink-0">
            <button class="settings-panel-back-btn absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0" aria-label="Back">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h2 class="text-base sm:text-lg font-semibold text-white truncate text-center">${title}</h2>
            ${headerActionHtml ? `<div class="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 shrink-0">${headerActionHtml}</div>` : ''}
        </div>
        <div class="${bodyWrapperClass}">${bodyInner}</div>
    `;
}

/**
 * Mở 1 panel mới — panel MỚI append vào CUỐI khung cuộn ngang, rồi cuộn mượt sang nó (xem docstring
 * đầu file).
 * @param {{title: string, bodyHtml: string, fullBleed?: boolean, headerActionHtml?: string}} params
 * @returns {HTMLElement} panel vừa tạo — nơi gọi (Workflow) tự `querySelector` bên trong để wire
 *          event riêng của panel đó (đúng quy ước Generic Drawer: "component tĩnh + dom-refs").
 */
function pushSettingsPanel({ title, bodyHtml, fullBleed = false, headerActionHtml = '' }) {
    const panelEl = document.createElement('div');
    panelEl.className = 'settings-stack-panel w-full h-full flex-shrink-0 flex flex-col';
    panelEl.innerHTML = _buildPanelInnerHtml(title, bodyHtml, fullBleed, headerActionHtml);
    settingsStackBody.appendChild(panelEl);
    settingsPanelStackEntries.push({ panelEl });

    void panelEl.offsetWidth; // ép reflow — đảm bảo panel vừa append đã có layout thật trước khi đọc offsetLeft
    scrollSliderTo(settingsStackBody, getPositionStart(panelEl), true);
    return panelEl;
}

/**
 * Đóng panel trên cùng (bấm Back) — cuộn mượt VỀ panel liền trước (đang nằm sẵn trong DOM, chưa hề
 * bị xoá lúc push). KHÔNG tự xoá DOM ở đây (Rule 3 cấm taskManager trong core) — trả panel vừa rời
 * đi cho Workflow tự lên lịch xoá SAU khi animation xong.
 * @returns {HTMLElement|null} panel vừa rời đi (để Workflow lên lịch `.remove()`), `null` nếu đang
 *          ở Main (không có gì để pop).
 */
function popSettingsPanel() {
    if (settingsPanelStackEntries.length <= 1) return null; // đã ở Main
    const top = settingsPanelStackEntries.pop();
    const prev = settingsPanelStackEntries[settingsPanelStackEntries.length - 1]; // panel liền trước, luôn tồn tại (tối thiểu là Main)

    scrollSliderTo(settingsStackBody, getPositionStart(prev.panelEl), true);

    return top.panelEl;
}

/**
 * Đưa ngăn xếp về đáy (Main) NGAY LẬP TỨC, không animation — dùng lúc đóng hẳn Settings (nút
 * Close) để lần mở SAU LUÔN bắt đầu tại Main, không kẹt giữa chừng 1 panel con nào. Xoá DOM THẲNG
 * mọi panel phía trên Main (không cần chờ animation vì bản thân #drawer-settings cũng đang trượt
 * ẩn cùng lúc) + `scrollTo({left:0, behavior:'instant'})` TƯỜNG MINH (KHÔNG gán thẳng `.scrollLeft`
 * — xem cảnh báo HOTFIX 12 ở docstring đầu file) để đảm bảo về đúng trang Main.
 */
function resetSettingsStackToMain() {
    for (let i = 1; i < settingsPanelStackEntries.length; i++) {
        settingsPanelStackEntries[i].panelEl.remove();
    }
    settingsPanelStackEntries.length = 1; // giữ lại đúng Main (index 0)
    scrollSliderTo(settingsStackBody, 0, false);
}
