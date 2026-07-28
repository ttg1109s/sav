/**
 * event/workflow/settings-stack-nav.js — "THẰNG THỰC THI CUỐI" của router "settingsStackNav".
 *
 * Cụm ĐIỀU HƯỚNG DÙNG CHUNG cho TOÀN BỘ panel con của Settings (About/Visualizer/Slideshow/
 * Subtitle/.../File Manager — bất kể panel nào đang mở) — nút Back (mỗi panel tự mang 1 nút riêng,
 * xem core/settings-panel-stack.js) LUÔN gọi về ĐÚNG hàm ở đây, không phân biệt panel nào đang
 * hiện. Panel cụ thể (About, Visualizer...) chỉ cần lo phần MỞ (push + việc riêng của nó, vd About
 * cần tính thống kê) — xem event/workflow/settings-misc.js::openAbout() làm ví dụ.
 *
 * Nút Close (X, id="close-drawer") KHÔNG có message riêng ở cụm này — nó đã có sẵn dây nối
 * 'playerControls.settingsDrawer.close' từ trước (event/listener,router/player-controls.js), giữ
 * NGUYÊN — xem workflowPlayerControls.closeSettingsDrawer() (event/workflow/player-controls.js,
 * đổi tên ở HOTFIX 11 08/07/2026 khi bỏ nhánh "mở Settings từ Visualizer").
 *
 * VIẾT LẠI (06/07/2026, phản hồi Giang — slider thật): `popSettingsPanel()` KHÔNG còn cần tham số
 * `mainTitle` nữa — header giờ NẰM SẴN TRONG panel liền trước (chưa hề bị xoá lúc push, chỉ trượt
 * ra ngoài màn hình chờ), tự hiện lại đúng khi trượt vào, không cần "khôi phục" gì cả.
 *
 * Cần taskManager (Rule 3: CHỈ Workflow được dùng) để chờ đúng SLIDER_PANEL_SCROLL_ESTIMATED_MS
 * trước khi xoá hẳn DOM panel vừa trượt ra — core/settings-panel-stack.js (core UI thuần) chỉ
 * trigger animation + trả về phần tử, KHÔNG tự taskManager.
 *
 * VIẾT LẠI (09/07/2026): hằng số thời gian đổi từ `SETTINGS_STACK_TRANSITION_MS` (riêng của
 * settings-panel-stack.js, đã xoá) sang `SLIDER_PANEL_SCROLL_ESTIMATED_MS` (dùng chung, xem
 * core/slider-panel-scroll.js — cùng file vừa rút ra `getPositionStart`/`scrollSliderTo`).
 *
 * MỚI (14/07/2026, Giang yêu cầu) — từng thêm 1 exception ở `back()` cho File Manager Song (đã
 * xoá, xem ghi chú "XOÁ (Batch 5...)" bên dưới).
 *
 * MỚI (17/07/2026, Giang yêu cầu — "back mà album active thì quay UI chính chứ không phải setting
 * main") — CÙNG TINH THẦN exception ở trên (Workflow gọi Workflow/Router miền khác tự do), thêm 1
 * chặn NGAY ĐẦU `back()`: panel Photo đang lọc theo album + đang là panel TRÊN CÙNG -> bỏ lọc thay
 * vì pop hẳn. Khác exception 14/07 ở chỗ chặn này chạy TRƯỚC pop (có thể SKIP pop hẳn), không phải
 * chạy SAU. Cần 2 hàm mới, đọc THUẦN không tác dụng phụ, đều lazy-reference (không cần thứ tự nạp):
 * `peekTopSettingsPanel()` (core/settings-panel-stack-ui.js) và
 * `routerFileManagerPhoto.getActiveAlbumId()` (event/router/file-manager-photo.js).
 *
 * XOÁ (Batch 5, "Song/Video Unification" mục 6e) — exception "xoá song trong folder xong back
 * không render lại" (`workflowFileManagerSong.refreshStaleFolderRowIfNeeded()`, gọi 14/07/2026)
 * KHÔNG còn ý nghĩa: Folder List (Settings-panel-stack) ĐÃ THAY bằng grid Generic Drawer
 * (event/workflow/file-manager-folder-browser.js) — List KHÔNG còn "đứng SAU/BỊ CHE" bởi Read nữa
 * (2 trạng thái CÙNG 1 Drawer, chuyển đổi qua `updateGenericDrawer()`), nên KHÔNG có DOM cũ nào
 * "stale" cần vá — mỗi lần quay lại List đều tự đọc dữ liệu mới qua `openList()`. `back()` giờ trở
 * lại ĐÚNG 1 việc: pop panel đang mở.
 *
 * NẠP SAU: core/settings-panel-stack-ui.js, core/slider-panel-scroll.js (SLIDER_PANEL_SCROLL_ESTIMATED_MS),
 * core/dom-refs.js (settingsStackBody).
 */
const workflowSettingsStackNav = {

    /** Ứng với msg.type = 'settingsStackNav.back.click' — pop panel đang mở, DÙNG CHUNG mọi panel. */
    back() {
        // MỚI (17/07/2026, Giang yêu cầu) — panel Photo đang lọc theo 1 album
        // (`routerFileManagerPhoto.getActiveAlbumId()`, event/router/file-manager-photo.js) VÀ đang
        // là panel TRÊN CÙNG (`peekTopSettingsPanel()`, core/settings-panel-stack-ui.js — đọc thuần,
        // không tác dụng phụ) -> Back nghĩa là "bỏ lọc, về lại toàn bộ ảnh" NGAY TRÊN panel đó,
        // KHÔNG pop hẳn (đúng ý Giang: "back mà album active thì quay UI chính chứ không phải
        // setting main"). CẢ 2 điều kiện PHẢI ĐỦ — chỉ đọc `getActiveAlbumId()` không thôi sẽ bắt
        // NHẦM lúc đang Back từ 1 panel KHÁC (vd Album List sub-panel, đang push TRÊN panel Photo)
        // trong khi `activeAlbumId` vẫn còn set từ trước — trường hợp đó phải pop BÌNH THƯỜNG (rời
        // Album List, không đụng gì tới bộ lọc của panel Photo bên dưới).
        if (peekTopSettingsPanel() === fileManagerPhotoPanelEl && routerFileManagerPhoto.getActiveAlbumId()) {
            routerFileManagerPhoto.clearActiveAlbumFilter(); // event/router/file-manager-photo.js — Router tự mutate activeAlbumId của chính nó + gọi refresh()
            return;
        }

        const removedPanelEl = popSettingsPanel();
        if (!removedPanelEl) return; // đã ở Main, không có gì để pop (nút Back không tồn tại ở Main nên khó xảy ra, guard cho chắc)
        taskManager.once(() => { removedPanelEl.remove(); }, SLIDER_PANEL_SCROLL_ESTIMATED_MS, 'popSettingsPanel');
    }
};
