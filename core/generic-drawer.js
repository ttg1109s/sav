/**
 * core/generic-drawer.js — Core UI THUẦN (giống core/file-manager/document-ui.js/photo-ui.js,
 * KHÔNG thuộc phạm vi Rule 1-4 core-function-conventions.md — rule đó chỉ áp cho core NGHIỆP VỤ)
 * cho 1 drawer TRẮNG dùng chung MỚI (mục 2 plan-v12-extended.md, 10/07/2026, Nhóm A). **Phạm vi
 * batch này: CHỈ Document List+Reader dùng** (xem event/workflow/document-reader.js) — Settings/
 * File Manager Song/Photo/Folder Detail GIỮ NGUYÊN nav-stack riêng (core/settings-panel-stack.js),
 * KHÔNG migrate.
 *
 * Khung HTML (components/generic-drawer.js) lấy NGUYÊN từ components/document-picker-drawer.js CŨ
 * (ĐÃ XOÁ — xoá tay nếu còn sót trên máy, xem readme Nhóm A) — đổi id/class sang trung tính
 * `generic-drawer*`.
 *
 * Drawer KHÔNG biết nội dung headerHtml/bodyHtml là gì (chỉ nhận chuỗi HTML có sẵn, gán thẳng vào
 * innerHTML) — Workflow tự querySelector bên trong SAU KHI gọi openGenericDrawer()/
 * updateGenericDrawer() để wire event (đúng quy ước "component tĩnh + dom-refs" sẵn có của app —
 * KHÔNG đi qua eventBus cho các nút động này, vì nội dung đổi hoàn toàn giữa List/Read, khác hẳn
 * kiểu delegation ổn định của Settings Panel Stack).
 *
 * z-index: tham số `zIndex` (mặc định 40) là z-index của PANEL — overlay LUÔN = zIndex - 1 (đúng
 * quy ước 39/40 đã dùng cho Document Picker Drawer cũ).
 *
 * NẠP SAU: core/dom-refs.js (genericDrawerOverlay/genericDrawerPanel/genericDrawerHeader/
 * genericDrawerBody).
 */

/** Gán CHUNG cho cả open/update — TÁCH riêng để 2 hàm public dưới đây không lặp lại cùng 1 khối
 * gán thuộc tính (guard clause thuần, KHÔNG phải "2 tiến trình khác nhau" — cùng 1 việc "gán cấu
 * hình vào DOM", chỉ khác NGỮ CẢNH gọi trước/sau nó — core UI thuần nên không bị Rule 1/3). */
function _applyGenericDrawerConfig(config) {
    const panelZIndex = config.zIndex || 40;
    genericDrawerPanel.style.height = config.height || '70vh';
    genericDrawerPanel.style.zIndex = String(panelZIndex);
    genericDrawerOverlay.style.zIndex = String(panelZIndex - 1);
    genericDrawerHeader.innerHTML = config.headerHtml || '';
    genericDrawerBody.innerHTML = config.bodyHtml || '';
    // Base layout ('flex-1 min-h-0') LUÔN giữ — bodyClass CHỈ bổ sung (overflow/padding/relative),
    // KHÔNG được ghi đè mất 2 class nền tảng này (xem components/generic-drawer.js).
    genericDrawerBody.className = `flex-1 min-h-0 ${config.bodyClass || ''}`.trim();
}

/**
 * Mở drawer LẦN ĐẦU (đang đóng -> mở) — set toàn bộ cấu hình + trượt lên.
 * @param {{height?: string, zIndex?: number, headerHtml: string, bodyHtml: string, bodyClass?: string}} config
 *   - height: mặc định '70vh' nếu không truyền.
 *   - zIndex: mặc định 40 (panel)/39 (overlay) nếu không truyền.
 */
function openGenericDrawer(config) {
    _applyGenericDrawerConfig(config);
    genericDrawerOverlay.classList.remove('hidden');
    genericDrawerPanel.classList.remove('hidden');
    // Ép reflow trước khi bỏ translate-y-full — đảm bảo transition CHẠY (cùng kỹ thuật
    // setDocumentPickerVisible() cũ — thêm/bỏ nhiều class off-screen cùng lúc trong 1 tick JS có
    // thể bị trình duyệt gộp, bỏ qua animation nếu không ép reflow ở giữa).
    void genericDrawerPanel.offsetHeight;
    genericDrawerPanel.classList.remove('translate-y-full');
}

/**
 * Chuyển MƯỢT sang cấu hình MỚI trong khi ĐANG MỞ (không đóng/mở lại từ đầu) — cơ chế chuyển
 * List <-> Read (mục 2/4.1 plan-v12-extended.md). Drawer PHẢI đang mở trước khi gọi (nơi gọi tự
 * đảm bảo thứ tự — hàm này không tự kiểm tra vì đó là 1 QUYẾT ĐỊNH nghiệp vụ khác thuộc Workflow).
 * @param {{height?: string, zIndex?: number, headerHtml: string, bodyHtml: string, bodyClass?: string}} config
 */
function updateGenericDrawer(config) {
    _applyGenericDrawerConfig(config);
}

/** Đóng drawer (trượt xuống) — KHÔNG tự xoá header/body HTML (nơi gọi tự dọn state riêng của nó,
 * xem workflowDocumentReader._closeNow()). */
function closeGenericDrawer() {
    genericDrawerPanel.classList.add('translate-y-full');
}
