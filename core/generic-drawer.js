/**
 * core/generic-drawer.js — Core NGHIỆP VỤ tuân Rule 1-4 đầy đủ (SIẾT LẠI 10/07/2026 sau phản hồi
 * Giang — bản đầu Nhóm A từng gọi đây là "core UI thuần" ngoài phạm vi Rule 1-4, dựa theo 1 nhãn
 * đã có SẴN trong codebase cho document-ui.js/photo-ui.js — Giang xác nhận nhãn đó KHÔNG hợp lệ để
 * dùng làm cớ né Rule 1-4: dựng UI VẪN là 1 nhiệm vụ phải tuân rule như mọi core khác. File NÀY từ
 * giờ tuân ĐẦY ĐỦ: KHÔNG addEventListener (Workflow tự làm), KHÔNG gọi core khác — kể cả hàm KHÁC
 * trong CÙNG FILE (`openGenericDrawer()`/`updateGenericDrawer()` từng dùng chung 1 helper riêng
 * `_applyGenericDrawerConfig()` — ĐÃ INLINE lại thành 2 khối lặp độc lập, chấp nhận trùng vài dòng
 * để không có lời gọi core-gọi-core nào, kể cả nội bộ).
 *
 * Dùng chung MỚI (mục 2 plan-v12-extended.md) cho 1 drawer TRẮNG — **Phạm vi batch này: CHỈ
 * Document List+Reader dùng** (xem event/workflow/document-reader.js) — Settings/File Manager
 * Song/Photo/Folder Detail GIỮ NGUYÊN nav-stack riêng (core/settings-panel-stack.js), KHÔNG
 * migrate.
 *
 * Khung HTML (components/generic-drawer.js) lấy NGUYÊN từ components/document-picker-drawer.js CŨ
 * (ĐÃ XOÁ) — đổi id/class sang trung tính `generic-drawer*`.
 *
 * Drawer KHÔNG biết nội dung headerHtml/bodyHtml là gì (chỉ nhận chuỗi HTML có sẵn, gán thẳng vào
 * innerHTML) — Workflow tự querySelector bên trong SAU KHI gọi openGenericDrawer()/
 * updateGenericDrawer() để wire event (KHÔNG đi qua eventBus cho các nút động này — nội dung đổi
 * hoàn toàn giữa List/Read, khác kiểu delegation ổn định của Settings Panel Stack).
 *
 * z-index: tham số `zIndex` (mặc định 40) là z-index của PANEL — overlay LUÔN = zIndex - 1 (đúng
 * quy ước 39/40 đã dùng cho Document Picker Drawer cũ).
 *
 * NẠP SAU: core/dom-refs.js (genericDrawerOverlay/genericDrawerPanel/genericDrawerHeader/
 * genericDrawerBody).
 */

/**
 * Mở drawer LẦN ĐẦU (đang đóng -> mở) — set toàn bộ cấu hình + trượt lên.
 * @param {{height?: string, zIndex?: number, headerHtml: string, bodyHtml: string, bodyClass?: string}} config
 *   - height: mặc định '70vh' nếu không truyền.
 *   - zIndex: mặc định 40 (panel)/39 (overlay) nếu không truyền.
 */
function openGenericDrawer(config) {
    const panelZIndex = config.zIndex || 40;
    genericDrawerPanel.style.height = config.height || '70vh';
    genericDrawerPanel.style.zIndex = String(panelZIndex);
    genericDrawerOverlay.style.zIndex = String(panelZIndex - 1);
    genericDrawerHeader.innerHTML = config.headerHtml || '';
    genericDrawerBody.innerHTML = config.bodyHtml || '';
    genericDrawerBody.className = `flex-1 min-h-0 ${config.bodyClass || ''}`.trim(); // 'flex-1 min-h-0' LUÔN giữ, bodyClass CHỈ bổ sung

    genericDrawerOverlay.classList.remove('hidden');
    genericDrawerPanel.classList.remove('hidden');
    // Ép reflow trước khi bỏ translate-y-full — đảm bảo transition CHẠY (thêm/bỏ nhiều class
    // off-screen cùng lúc trong 1 tick JS có thể bị trình duyệt gộp, bỏ qua animation nếu không
    // ép reflow ở giữa).
    void genericDrawerPanel.offsetHeight;
    genericDrawerPanel.classList.remove('translate-y-full');
}

/**
 * Chuyển MƯỢT sang cấu hình MỚI trong khi ĐANG MỞ (không đóng/mở lại từ đầu) — cơ chế chuyển
 * List <-> Read (mục 2/4.1 plan-v12-extended.md). Drawer PHẢI đang mở trước khi gọi (nơi gọi tự
 * đảm bảo thứ tự — hàm này không tự kiểm tra vì đó là 1 QUYẾT ĐỊNH nghiệp vụ khác thuộc Workflow,
 * đúng Rule 1 — guard clause đó không thuộc về hàm này).
 * @param {{height?: string, zIndex?: number, headerHtml: string, bodyHtml: string, bodyClass?: string}} config
 */
function updateGenericDrawer(config) {
    const panelZIndex = config.zIndex || 40;
    genericDrawerPanel.style.height = config.height || '70vh';
    genericDrawerPanel.style.zIndex = String(panelZIndex);
    genericDrawerOverlay.style.zIndex = String(panelZIndex - 1);
    genericDrawerHeader.innerHTML = config.headerHtml || '';
    genericDrawerBody.innerHTML = config.bodyHtml || '';
    genericDrawerBody.className = `flex-1 min-h-0 ${config.bodyClass || ''}`.trim();
}

/** Đóng drawer (trượt xuống) — KHÔNG tự xoá header/body HTML (nơi gọi tự dọn state riêng của nó,
 * xem workflowDocumentReader._closeNow()). */
function closeGenericDrawer() {
    genericDrawerPanel.classList.add('translate-y-full');
}
