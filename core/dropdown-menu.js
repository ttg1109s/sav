/**
 * core/dropdown-menu.js — Dropdown menu NEO THEO NÚT (KHÁC Generic Drawer — core/generic-drawer.js,
 * bottom sheet toàn chiều rộng màn hình). Dùng CHUNG cho MỌI nút "..." cần menu ngắn (vài lựa chọn)
 * hiện sát cạnh chính nút đó — Giang yêu cầu tách riêng để tái dùng, THAY vì viết riêng từng feature
 * (áp dụng đầu tiên cho menu ảnh Photo, nay là event/workflow/image-edit.js::openSaveMenu()).
 *
 * TÁI DÙNG đúng công thức định vị đã có sẵn ở `core/playlist/actions.js::openSongActionMenu()`
 * (đo `getBoundingClientRect()` của nút neo, tự lật lên trên nếu tràn màn hình dưới) — KHÔNG viết
 * lại thuật toán định vị mới, chỉ tổng quát hoá thành component dùng nhiều nơi. Component NÀY chưa
 * thay `openSongActionMenu()` (menu bài hát vẫn đọc state riêng `playlistStore` — khác kiến trúc,
 * đổi sang dùng chung sẽ là 1 refactor riêng, để dành nếu Giang xác nhận cần).
 *
 * `items`: `Array<{icon: string, name: string, callback: () => void, destructive?: boolean}>`.
 * `icon` là chuỗi SVG dán thẳng qua `innerHTML` — nơi GỌI (Workflow) tự chịu trách nhiệm an toàn
 * chuỗi (không có input người dùng chèn trực tiếp vào icon — tên hành động cố định trong code, khác
 * hẳn `escapeHtml()` bắt buộc cho dữ liệu người dùng nhập).
 * `callback` — hàm NÀY (core) CHỈ gọi `item.callback()` khi bấm, KHÔNG tự quyết định nghiệp vụ gì —
 * core nhận callback làm tham số, KHÔNG tự viết business logic (Rule 1). Nơi GỌI (Workflow) PHẢI
 * tự đảm bảo `callback` bên trong gọi `eventBus.send()` (Rule 5a — xem ví dụ ở
 * openSaveMenu()), KHÔNG viết thẳng nghiệp vụ trong `callback` — hàm dropdown này không ép
 * buộc được điều đó (chỉ là quy ước nơi gọi phải tuân thủ), nhưng bản thân addEventListener() bên
 * trong đây CHỈ gọi ĐÚNG 1 việc: đóng menu + gọi callback — không tự thêm nghiệp vụ nào khác.
 *
 * NẠP SAU: event/bus.js (không dùng trực tiếp ở đây, nhưng nơi gọi cần).
 */

/**
 * @param {HTMLElement} anchorEl - nút "..." vừa bấm, dùng để định vị menu ngay cạnh nó.
 * @param {Array<{icon: string, name: string, callback: () => void, destructive?: boolean}>} items
 * @param {{zIndex?: number}} [options] - MỚI (21/07/2026, cần cho menu ảnh Photo — mở TỪ TRONG modal
 *   xem ảnh full-screen `#image-preview-overlay`, z-130, xem core/file-manager/photo-ui.js —
 *   z-index MẶC ĐỊNH của dropdown (126/127) sẽ bị chính modal đó ĐÈ LÊN, ẩn mất). Không truyền ->
 *   giữ NGUYÊN 126/127 như trước (mọi nơi gọi cũ, KHÔNG cần đổi gì).
 */
function openDropdownMenu(anchorEl, items, options) {
    options = options || {};
    closeDropdownMenu(); // chỉ 1 menu mở tại 1 thời điểm — đóng cái cũ (nếu còn) trước khi dựng cái mới

    const overlay = document.createElement('div');
    overlay.id = 'dropdown-menu-overlay';
    overlay.className = 'fixed inset-0'; // z-index gán qua .style bên dưới (KHÔNG dùng class Tailwind động — bracket-notation động không được Play CDN JIT quét đúng, cùng quy ước Z_INDEX/Generic Drawer đã chốt, xem core/config.js)
    overlay.style.zIndex = String((options.zIndex || 127) - 1); // dưới action-menu ảnh (131, core/config.js::Z_INDEX)/modalChoice (200) — trên nội dung panel thường
    overlay.addEventListener('click', closeDropdownMenu);

    const menu = document.createElement('div');
    menu.id = 'dropdown-menu-panel';
    menu.className = 'fixed w-48 py-1.5 rounded-xl glass-modal shadow-2xl overflow-hidden';
    menu.style.zIndex = String(options.zIndex || 127);

    items.forEach((item) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-left hover:bg-white/10 transition-colors ${item.destructive ? 'text-rose-400' : 'text-slate-100'}`;
        btn.innerHTML = `<span class="w-4 h-4 shrink-0 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full">${item.icon}</span><span class="truncate">${item.name}</span>`;
        btn.addEventListener('click', () => {
            closeDropdownMenu();
            item.callback();
        });
        menu.appendChild(btn);
    });

    document.body.appendChild(overlay);
    document.body.appendChild(menu);

    // Định vị neo theo anchorEl — CÙNG công thức openSongActionMenu() (core/playlist/actions.js):
    // mặc định trồi xuống DƯỚI nút, tự lật lên TRÊN nếu không đủ chỗ phía dưới màn hình.
    const rect = anchorEl.getBoundingClientRect();
    const menuWidth = 192; // khớp w-48 (12rem = 192px)
    let left = rect.right - menuWidth;
    if (left < 8) left = 8;
    const estimatedHeight = items.length * 44 + 12; // ước lượng thô (mỗi mục ~44px + padding) — đủ để quyết định lật lên/xuống, không cần đo DOM thật
    let top = rect.bottom + 6;
    if (top + estimatedHeight > (window.innerHeight || 800)) top = rect.top - estimatedHeight - 6;
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
}

/** Đóng menu đang mở (nếu có) — an toàn gọi kể cả khi không có menu nào đang mở (no-op). */
function closeDropdownMenu() {
    const overlay = document.getElementById('dropdown-menu-overlay');
    const menu = document.getElementById('dropdown-menu-panel');
    if (overlay) overlay.remove();
    if (menu) menu.remove();
}
