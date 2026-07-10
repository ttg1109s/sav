/**
 * core/generic-drawer.js — Core NGHIỆP VỤ tuân Rule 1-5 đầy đủ (core-function-conventions.md) cho
 * 1 drawer TRẮNG dùng chung MỚI (mục 2 plan-v12-extended.md) — **Phạm vi batch này: CHỈ Document
 * List+Reader dùng** (xem event/workflow/document-reader.js) — Settings/File Manager Song/Photo/
 * Folder Detail GIỮ NGUYÊN nav-stack riêng (core/settings-panel-stack.js), KHÔNG migrate.
 *
 * SỬA (10/07/2026, phản hồi Giang) — BỎ HẲN lớp overlay (nền mờ che toàn màn hình): bản đầu có bug
 * `closeGenericDrawer()` chỉ trượt panel xuống, KHÔNG xoá lại `hidden` cho overlay -> overlay còn
 * `pointer-events-auto` che chắn TOÀN BỘ UI phía sau (visualizer không thao tác được gì) mãi mãi
 * sau lần đóng đầu tiên. Giang xác nhận lớp overlay này KHÔNG CẦN THIẾT cho tính năng này — bỏ
 * hẳn khỏi component (components/generic-drawer.js) VÀ file này, không chỉ sửa timing bug.
 *
 * Khung HTML (components/generic-drawer.js) lấy NGUYÊN từ components/document-picker-drawer.js CŨ
 * (ĐÃ XOÁ) — đổi id/class sang trung tính `generic-drawer*`.
 *
 * Drawer KHÔNG biết nội dung headerHtml/bodyHtml là gì (chỉ nhận chuỗi HTML có sẵn, gán thẳng vào
 * innerHTML) — Workflow tự querySelector bên trong SAU KHI gọi openGenericDrawer()/
 * updateGenericDrawer() để wire event (KHÔNG đi qua eventBus cho các nút động này).
 *
 * `hideGenericDrawerImmediately()` (MỚI) — ẩn hẳn panel (thêm `hidden`, không chỉ trượt xuống) —
 * Workflow tự gọi hàm này SAU KHI nghe `transitionend` trên panel (core/generic-drawer.js KHÔNG tự
 * addEventListener ở đây vì panel là DOM TĨNH có sẵn từ dom-refs.js, KHÔNG phải cụm DOM MỚI tự tạo
 * — không đạt điều kiện ngoại lệ Rule 5a, xem core-function-conventions.md).
 *
 * NẠP SAU: core/dom-refs.js (genericDrawerPanel/genericDrawerHeader/genericDrawerBody).
 */

/**
 * Mở drawer LẦN ĐẦU (đang đóng -> mở) — set toàn bộ cấu hình + trượt lên.
 * @param {{height?: string, zIndex?: number, headerHtml: string, bodyHtml: string, bodyClass?: string}} config
 *   - height: mặc định '70vh' nếu không truyền.
 *   - zIndex: mặc định 40 nếu không truyền (không còn khái niệm overlay -1 vì đã bỏ overlay).
 */
function openGenericDrawer(config) {
    genericDrawerPanel.style.height = config.height || '70vh';
    genericDrawerPanel.style.zIndex = String(config.zIndex || 40);
    genericDrawerHeader.innerHTML = config.headerHtml || '';
    genericDrawerBody.innerHTML = config.bodyHtml || '';
    genericDrawerBody.className = `flex-1 min-h-0 ${config.bodyClass || ''}`.trim(); // 'flex-1 min-h-0' LUÔN giữ, bodyClass CHỈ bổ sung

    genericDrawerPanel.classList.remove('hidden');
    // Ép reflow trước khi bỏ translate-y-full — đảm bảo transition CHẠY (thêm/bỏ nhiều class
    // off-screen cùng lúc trong 1 tick JS có thể bị trình duyệt gộp, bỏ qua animation nếu không
    // ép reflow ở giữa).
    void genericDrawerPanel.offsetHeight;
    genericDrawerPanel.classList.remove('translate-y-full');
}

/**
 * Chuyển MƯỢT sang cấu hình MỚI trong khi ĐANG MỞ (không đóng/mở lại từ đầu) — cơ chế chuyển
 * List <-> Read (mục 2/4.1 plan-v12-extended.md). Drawer PHẢI đang mở trước khi gọi.
 * @param {{height?: string, zIndex?: number, headerHtml: string, bodyHtml: string, bodyClass?: string}} config
 */
function updateGenericDrawer(config) {
    genericDrawerPanel.style.height = config.height || '70vh';
    genericDrawerPanel.style.zIndex = String(config.zIndex || 40);
    genericDrawerHeader.innerHTML = config.headerHtml || '';
    genericDrawerBody.innerHTML = config.bodyHtml || '';
    genericDrawerBody.className = `flex-1 min-h-0 ${config.bodyClass || ''}`.trim();
}

/** Đóng drawer (trượt xuống) — CHƯA thêm lại `hidden` (đợi transition xong, xem
 * `hideGenericDrawerImmediately()` — Workflow tự gọi 2 hàm này nối tiếp qua `transitionend`). */
function closeGenericDrawer() {
    genericDrawerPanel.classList.add('translate-y-full');
}

/** Ẩn HẲN panel (thêm `hidden`) — gọi SAU KHI transition trượt xuống đã xong (Workflow tự nghe
 * `transitionend` rồi gọi hàm này, xem event/workflow/document-reader.js). */
function hideGenericDrawerImmediately() {
    genericDrawerPanel.classList.add('hidden');
}
