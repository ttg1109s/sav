/**
 * core/settings-panel-stack.js — Ngăn xếp (stack) panel cho Settings.
 *
 * === VIẾT LẠI (06/07/2026, phản hồi Giang sau khi xem UI thật — sửa lại thiết kế Batch D1) ===
 * Thiết kế CŨ (Batch D1): panel mới trượt CHE LÊN panel cũ (panel cũ đứng yên `left:0`, bị che
 * khuất chứ không di chuyển) + header DÙNG CHUNG 1 khối ngoài panel, đổi text NGAY LẬP TỨC lúc
 * push/pop trong khi panel còn đang trượt — Giang chỉ ra 2 vấn đề:
 *   1. Panel cũ vẫn nằm-nguyên-dưới (chỉ bị che) => vẫn phải tự lo nền/ảnh CHO TỪNG panel riêng
 *      nếu muốn nền chung hiện đúng (về bản chất nhiều lớp đè lên nhau, không phải slider thật).
 *   2. Header đổi chữ TỨC THÌ trong khi body còn đang chạy animation kéo — 2 thứ lệch nhịp nhau,
 *      UX kém (khác hẳn Cài đặt iOS thật — search screenshot Giang gửi 06/07/2026: header luôn
 *      trượt CÙNG NHỊP với nội dung, vì header là 1 phần của MÀN HÌNH đang trượt, không phải 1
 *      thanh cố định đứng ngoài đổi rời rạc).
 *
 * THIẾT KẾ MỚI — SLIDER THẬT (2 panel luôn cùng di chuyển 1 lúc):
 *   - Mỗi panel (kể cả Main) giờ TỰ MANG header CỦA CHÍNH NÓ (title + nút Back/Close) NGAY TRONG
 *     thân panel — xem `_buildPanelInnerHtml()` — nên header luôn trượt ĐÚNG NHỊP với nội dung
 *     (header là 1 phần của cùng khối DOM đang animate `left`, không tách rời nữa). Mục 3 phản hồi
 *     Giang: "Header được nhét vào luôn body."
 *   - PUSH (mở panel con): panel HIỆN TẠI (đang ở `left:0`) trượt SANG TRÁI (`left:-100%`) —
 *     KHÔNG xoá, vẫn nằm chờ ngoài màn hình bên trái. Panel MỚI tạo ở `left:100%` (ngoài màn hình
 *     phải), tiêm HTML, ép reflow, rồi trượt vào `left:0` — CÙNG LÚC với panel hiện tại trượt trái
 *     (2 panel di chuyển ĐỒNG THỜI, đúng cảm giác "chuyển sang slide kế tiếp", KHÔNG phải "che
 *     lên"). Mục 2 phản hồi Giang: "trượt từ panel x sang y".
 *   - POP (bấm Back): panel ĐANG HIỆN (`left:0`) trượt PHẢI (`left:100%`) — panel LIỀN TRƯỚC (đang
 *     chờ sẵn ở `left:-100%` từ lúc push) trượt vào lại `left:0` — CÙNG LÚC. Sau khi animation
 *     xong, panel vừa rời đi (đang ở `left:100%`) mới bị XOÁ HẲN khỏi DOM (Workflow tự
 *     `taskManager.once()` — core UI thuần này KHÔNG tự taskManager, xem Rule 3). Mục 2 phản hồi
 *     Giang: "khi back thì trượt về slider trước -> xoá panel" — CHỈ xoá panel rời đi, panel liền
 *     trước KHÔNG bị dựng lại từ đầu (đã nằm sẵn đó, chỉ trượt vào).
 *   - Main (panel gốc, index 0 trong `settingsPanelStackEntries`) KHÔNG BAO GIỜ bị pop/xoá — chỉ
 *     `resetSettingsStackToMain()` (đóng hẳn Settings) mới xoá MỌI panel phía trên Main.
 *
 * MANG TƯ DUY Generic Drawer (core/generic-drawer.js, Nhóm A mục 2) NHƯNG KHÔNG dùng chung — bản
 * chất khác: Generic Drawer chỉ swap 2 trạng thái (List <-> Read), còn Settings cần NGĂN XẾP thật,
 * độ sâu tuỳ ý (Main -> Song -> Folder Detail là 2 cấp, xem event/workflow/file-manager-song.js).
 *
 * Core UI THUẦN (không phải core nghiệp vụ, giống core/generic-drawer.js/document-ui.js) — KHÔNG
 * thuộc phạm vi Rule 1-4 (core-function-conventions.md, chỉ áp cho core NGHIỆP VỤ có quyết định
 * dữ liệu) NHƯNG vẫn viết sạch: mọi hàm chỉ nhận tham số, không tự appState.get(), không tự
 * taskManager — nhất quán phong cách toàn bộ core dù được miễn Rule 1-4.
 *
 * QUAN TRỌNG — 8 khu vực ĐÃ migrate trước batch này (About/Subtitle/Visualizer/Slideshow/Song/
 * Folder Detail/Photo/Documents) KHÔNG cần sửa GÌ CẢ: `pushSettingsPanel({title, bodyHtml,
 * fullBleed})` GIỮ NGUYÊN chữ ký y hệt — chỉ phần TRIỂN KHAI BÊN TRONG file này đổi (header giờ
 * nhét vào panel thay vì đọc/ghi 1 khối chung bên ngoài).
 *
 * NẠP SAU: core/dom-refs.js (settingsStackBody, settingsStackPanelMain).
 */

const SETTINGS_STACK_TRANSITION_MS = 500; // khớp duration-500 CSS đang dùng thống nhất toàn app

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
function _buildPanelInnerHtml(title, bodyHtml, fullBleed) {
    const bodyWrapperClass = fullBleed
        ? 'flex-grow overflow-y-auto'
        : 'flex-grow overflow-y-auto px-4 py-4 sm:px-8 pb-20';
    const bodyInner = fullBleed ? bodyHtml : `<div class="max-w-2xl mx-auto space-y-5">${bodyHtml}</div>`;
    return `
        <div class="flex justify-between items-center px-4 py-3 sm:px-6 border-b border-white/10 shrink-0 bg-black/40">
            <div class="flex items-center gap-2 min-w-0">
                <button class="settings-panel-back-btn w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0" aria-label="Back">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h2 class="text-base sm:text-lg font-bold tracking-wider text-white uppercase truncate">${title}</h2>
            </div>
        </div>
        <div class="${bodyWrapperClass}">${bodyInner}</div>
    `;
}

/**
 * Mở 1 panel mới — panel HIỆN TẠI trượt trái (chờ sẵn, không xoá), panel MỚI trượt vào từ phải,
 * CÙNG LÚC (xem docstring đầu file).
 * @param {{title: string, bodyHtml: string, fullBleed?: boolean}} params
 * @returns {HTMLElement} panel vừa tạo — nơi gọi (Workflow) tự `querySelector` bên trong để wire
 *          event riêng của panel đó (đúng quy ước Generic Drawer: "component tĩnh + dom-refs").
 */
function pushSettingsPanel({ title, bodyHtml, fullBleed = false }) {
    const currentTop = settingsPanelStackEntries[settingsPanelStackEntries.length - 1];

    const panelEl = document.createElement('div');
    panelEl.className = 'settings-stack-panel absolute top-0 left-0 w-full h-full flex flex-col';
    panelEl.style.left = '100%';
    panelEl.style.transition = `left ${SETTINGS_STACK_TRANSITION_MS}ms ease-in-out`;
    panelEl.innerHTML = _buildPanelInnerHtml(title, bodyHtml, fullBleed);
    settingsStackBody.appendChild(panelEl);
    void panelEl.offsetHeight; // ép reflow — bắt buộc để transition chạy đúng từ 100% -> 0, không bị gộp frame

    // 2 panel cùng trượt 1 lúc — panel hiện tại sang trái, panel mới vào từ phải.
    currentTop.panelEl.style.left = '-100%';
    panelEl.style.left = '0';

    settingsPanelStackEntries.push({ panelEl });
    return panelEl;
}

/**
 * Đóng panel trên cùng (bấm Back) — panel đang hiện trượt phải, panel liền trước (đang chờ sẵn ở
 * `left:-100%`) trượt vào lại, CÙNG LÚC. KHÔNG tự xoá DOM ở đây (Rule 3 cấm taskManager trong core)
 * — trả panel vừa trượt ra cho Workflow tự lên lịch xoá SAU khi animation xong.
 * @returns {HTMLElement|null} panel vừa trượt ra (để Workflow lên lịch `.remove()`), `null` nếu
 *          đang ở Main (không có gì để pop).
 */
function popSettingsPanel() {
    if (settingsPanelStackEntries.length <= 1) return null; // đã ở Main
    const top = settingsPanelStackEntries.pop();
    const prev = settingsPanelStackEntries[settingsPanelStackEntries.length - 1];

    top.panelEl.style.left = '100%';
    prev.panelEl.style.left = '0';

    return top.panelEl;
}

/**
 * Đưa ngăn xếp về đáy (Main) NGAY LẬP TỨC, không animation — dùng lúc đóng hẳn Settings (nút
 * Close) để lần mở SAU LUÔN bắt đầu tại Main, không kẹt giữa chừng 1 panel con nào. Xoá DOM THẲNG
 * mọi panel phía trên Main (không cần chờ animation vì bản thân #drawer-settings cũng đang trượt
 * ẩn cùng lúc) + đảm bảo Main về đúng `left:0` (phòng trường hợp đang dở dang ở `-100%`).
 */
function resetSettingsStackToMain() {
    for (let i = 1; i < settingsPanelStackEntries.length; i++) {
        settingsPanelStackEntries[i].panelEl.remove();
    }
    settingsPanelStackEntries.length = 1; // giữ lại đúng Main (index 0)
    settingsPanelStackEntries[0].panelEl.style.left = '0';
}
