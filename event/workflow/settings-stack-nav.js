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
 * XOÁ (Batch 5, "Song/Video Unification" mục 6e) — exception "xoá song trong folder xong back
 * không render lại" (`workflowFileManagerSong.refreshStaleFolderRowIfNeeded()`, gọi 14/07/2026)
 * KHÔNG còn ý nghĩa: Folder List (Settings-panel-stack) ĐÃ THAY bằng grid Generic Drawer
 * (event/workflow/file-manager-folder-browser.js) — List KHÔNG còn "đứng SAU/BỊ CHE" bởi Read nữa
 * (2 trạng thái CÙNG 1 Drawer, chuyển đổi qua `updateGenericDrawer()`), nên KHÔNG có DOM cũ nào
 * "stale" cần vá — mỗi lần quay lại List đều tự đọc dữ liệu mới qua `openList()`. `back()` giờ trở
 * lại ĐÚNG 1 việc: pop panel đang mở.
 *
 * XOÁ (loại bỏ Album khỏi Photo Panel) — exception "panel Photo đang lọc theo album -> bỏ lọc thay
 * vì pop hẳn" (17/07/2026) bỏ hẳn cùng tính năng — Photo không còn khái niệm lọc theo album,
 * `back()` giờ trở lại ĐÚNG 1 việc DUY NHẤT: pop panel đang mở, không còn ngoại lệ nào.
 *
 * NẠP SAU: core/settings-panel-stack-ui.js, core/slider-panel-scroll.js (SLIDER_PANEL_SCROLL_ESTIMATED_MS),
 * core/dom-refs.js (settingsStackBody).
 */
const workflowSettingsStackNav = {

    /** Ứng với msg.type = 'settingsStackNav.back.click' — pop panel đang mở, DÙNG CHUNG mọi panel. */
    back() {
        const removedPanelEl = popSettingsPanel();
        if (!removedPanelEl) return; // đã ở Main, không có gì để pop (nút Back không tồn tại ở Main nên khó xảy ra, guard cho chắc)
        // MỚI (phản hồi Giang, mục 3 — "gradient sub-panel chỉnh xong, back ra panel chính chưa cập
        // nhật swatch") — panel chính (`visualBgSettingsPanelEl`) chỉ tự vẽ swatch lúc mở/lúc chính
        // nó đổi field, KHÔNG tự biết sub-panel Gradient (`visualBgGradientPanelEl`, event/workflow/
        // visual-bg.js) vừa chỉnh gì — refresh lại NGAY khi xác định đúng panel vừa rời đi là nó.
        if (removedPanelEl === visualBgGradientPanelEl && typeof workflowVisualBg !== 'undefined') workflowVisualBg.refreshPanelUI();
        taskManager.once(() => { removedPanelEl.remove(); }, SLIDER_PANEL_SCROLL_ESTIMATED_MS, 'popSettingsPanel');
    }
};
