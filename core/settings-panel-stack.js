/**
 * core/settings-panel-stack.js — Ngăn xếp (stack) panel cho Settings (Batch D1, Nhóm D, phản hồi
 * Giang 06/07/2026 — "làm lại luôn Setting đi": SỬA GỐC thiết kế cũ (9 drawer con là sibling
 * `fixed inset-0` riêng, phân biệt nhau bằng z-index — xem lịch sử trước batch này) sang ĐÚNG 1
 * khung `#drawer-settings` duy nhất, mọi panel con sống BÊN TRONG nó qua ngăn xếp.
 *
 * MANG TƯ DUY Generic Drawer (core/generic-drawer.js, sẽ code ở Nhóm A mục 2) NHƯNG KHÔNG dùng
 * chung — bản chất khác: Generic Drawer chỉ swap 2 trạng thái (List <-> Read), còn Settings cần
 * NGĂN XẾP thật, độ sâu tuỳ ý (Main -> Song -> FolderDetail là 2 cấp, mục D4 sau này). Tách riêng
 * đúng tinh thần "mỗi hạ tầng lo đúng 1 việc, không ép dùng chung nếu bản chất khác".
 *
 * CƠ CHẾ (ĐÚNG như Giang mô tả 06/07/2026):
 *   push: tạo <div class="settings-stack-panel"> MỚI, `left: 100%` (che khuất bên phải, cùng
 *         `width` với #settings-stack-body) -> tiêm bodyHtml -> ép reflow -> đổi `left: 0` (CSS
 *         transition tự trượt vào) -> đổi header dùng CHUNG (title + hiện nút Back/ẩn nút Close).
 *   pop:  đổi `left: 100%` của panel đỉnh ngăn xếp (trượt ra) -> khôi phục header panel liền
 *         trước -> panel vừa trượt ra được TRẢ VỀ cho nơi gọi để tự lên lịch xoá DOM sau khi
 *         animation xong (taskManager CHỈ Workflow được dùng — xem Rule 3, core-function-
 *         conventions.md — nên việc "chờ rồi xoá" KHÔNG nằm trong file core UI thuần này).
 *
 * Core UI THUẦN (không phải core nghiệp vụ, giống core/generic-drawer.js/document-ui.js) — KHÔNG
 * thuộc phạm vi Rule 1-4 (core-function-conventions.md, chỉ áp cho core NGHIỆP VỤ có quyết định
 * dữ liệu) NHƯNG vẫn viết sạch: mọi hàm chỉ nhận tham số, không tự appState.get(), không tự
 * taskManager — nhất quán phong cách toàn bộ core dù được miễn Rule 1-4.
 *
 * `settingsPanelStackEntries` là state NỘI BỘ của riêng file này (RAM thuần, không phải nghiệp vụ
 * cần appState) — chỉ ghi nhớ {title, panelEl} từng cấp đang mở để phục hồi header lúc pop, đúng
 * vai trò 1 chi tiết triển khai ẩn của core UI này (không file nào khác cần biết/đọc mảng này).
 *
 * NẠP SAU: core/dom-refs.js (settingsStackTitle, btnSettingsStackBack, closeDrawer,
 * settingsStackBody).
 */

const SETTINGS_STACK_TRANSITION_MS = 500; // khớp duration-500 CSS đang dùng thống nhất toàn app

let settingsPanelStackEntries = [];

/**
 * Mở 1 panel mới, chồng lên panel hiện tại (trượt từ phải vào). Header dùng CHUNG đổi sang title
 * mới + hiện nút Back/ẩn nút Close (mọi panel con, bất kể cấp mấy, đều CHỈ có Back — giữ đúng hành
 * vi cũ của 9 drawer con trước đây, không phải panel con nào cũng thoát thẳng về ngoài cùng).
 * @param {{title: string, bodyHtml: string}} params - `title` ĐÃ dịch sẵn qua t() (nơi gọi tự lo
 *        i18n, file này không biết gì về `lang/`).
 * @returns {HTMLElement} panel vừa tạo — nơi gọi (Workflow) tự `querySelector` bên trong để wire
 *          event riêng của panel đó (đúng quy ước Generic Drawer: "component tĩnh + dom-refs").
 */
/**
 * @param {{title: string, bodyHtml: string, fullBleed?: boolean}} params - `fullBleed` (Batch D6,
 *        06/07/2026, MỚI) — bỏ qua wrapper "max-w-2xl mx-auto space-y-8" mặc định + padding
 *        `px-4 py-6 sm:px-8` của chính panel, dùng cho nội dung cố tình tràn viền (edge-to-edge) —
 *        vd panel Photo (masonry ảnh + story slider vốn thiết kế full-width, không phải form dạng
 *        card như Settings thường). Mặc định `false` (giữ nguyên hành vi mọi panel trước đó).
 */
function pushSettingsPanel({ title, bodyHtml, fullBleed = false }) {
    const panelEl = document.createElement('div');
    panelEl.className = fullBleed
        ? 'settings-stack-panel absolute top-0 left-0 w-full h-full overflow-y-auto flex flex-col'
        : 'settings-stack-panel absolute top-0 left-0 w-full h-full overflow-y-auto px-4 py-6 sm:px-8 pb-20';
    panelEl.style.left = '100%';
    panelEl.style.transition = `left ${SETTINGS_STACK_TRANSITION_MS}ms ease-in-out`;
    // Bọc sẵn 1 lớp wrapper GIỐNG HỆT Main (xem components/settings-drawer.js::build()) — mọi
    // panel con chỉ cần trả về HTML các <section>, KHÔNG cần tự lặp lại "max-w-2xl mx-auto
    // space-y-8" ở từng file component riêng (About, Visualizer... sau này). `fullBleed` bỏ qua
    // lớp bọc này — bodyHtml tự lo layout của chính nó.
    panelEl.innerHTML = fullBleed ? bodyHtml : `<div class="max-w-2xl mx-auto space-y-8">${bodyHtml}</div>`;
    settingsStackBody.appendChild(panelEl);
    void panelEl.offsetHeight; // ép reflow — bắt buộc để transition chạy đúng từ 100% -> 0, không bị gộp frame
    panelEl.style.left = '0';

    settingsStackTitle.textContent = title;
    btnSettingsStackBack.classList.remove('hidden');
    closeDrawer.classList.add('hidden');

    settingsPanelStackEntries.push({ title, panelEl });
    return panelEl;
}

/**
 * Đóng panel trên cùng ngăn xếp (trượt ra phải) + khôi phục header panel liền trước (hoặc header
 * gốc Main nếu đã về tới đáy ngăn xếp). KHÔNG tự xoá DOM ở đây (xem docstring đầu file — Rule 3
 * cấm taskManager trong core) — trả panel vừa trượt ra cho Workflow tự lên lịch xoá.
 * @param {string} mainTitle - title gốc của Main (t('settingsDrawer.title')) — nơi gọi tự truyền
 *        vào để phục hồi đúng khi ngăn xếp rỗng, file này không tự biết title gốc là gì.
 * @returns {HTMLElement|null} panel vừa trượt ra (để Workflow lên lịch `.remove()`), `null` nếu
 *          ngăn xếp đã rỗng (đang ở Main, không có gì để pop).
 */
function popSettingsPanel(mainTitle) {
    const top = settingsPanelStackEntries.pop();
    if (!top) return null;

    top.panelEl.style.left = '100%';

    const prevEntry = settingsPanelStackEntries[settingsPanelStackEntries.length - 1];
    if (prevEntry) {
        settingsStackTitle.textContent = prevEntry.title; // vẫn còn panel cha khác Main -> giữ Back
    } else {
        settingsStackTitle.textContent = mainTitle;
        btnSettingsStackBack.classList.add('hidden');
        closeDrawer.classList.remove('hidden');
    }
    return top.panelEl;
}

/**
 * Đưa ngăn xếp về đáy (Main) NGAY LẬP TỨC, không animation — dùng lúc đóng hẳn Settings (nút
 * Close) để lần mở SAU LUÔN bắt đầu tại Main, không kẹt giữa chừng 1 panel con nào. Xoá DOM THẲNG
 * (không cần chờ animation vì bản thân #drawer-settings cũng đang trượt ẩn cùng lúc, panel con có
 * biến mất đột ngột cũng không ai nhìn thấy).
 * @param {string} mainTitle - xem giải thích tham số cùng tên ở popSettingsPanel().
 */
function resetSettingsStackToMain(mainTitle) {
    settingsPanelStackEntries.forEach(entry => entry.panelEl.remove());
    settingsPanelStackEntries = [];
    settingsStackTitle.textContent = mainTitle;
    btnSettingsStackBack.classList.add('hidden');
    closeDrawer.classList.remove('hidden');
}
