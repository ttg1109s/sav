/**
 * event/workflow/settings-stack-nav.js — "THẰNG THỰC THI CUỐI" của router "settingsStackNav".
 *
 * Cụm ĐIỀU HƯỚNG DÙNG CHUNG cho TOÀN BỘ panel con của Settings (About/Visualizer/Slideshow/
 * Subtitle/.../File Manager — bất kể panel nào đang mở) — nút Back trong header dùng chung (xem
 * components/settings-drawer.js) LUÔN gọi về ĐÚNG hàm ở đây, không phân biệt panel nào đang hiện.
 * Panel cụ thể (About, Visualizer...) chỉ cần lo phần MỞ (push + việc riêng của nó, vd About cần
 * tính thống kê) — xem event/workflow/settings-misc.js::openAbout() làm ví dụ.
 *
 * Nút Close (X, id="close-drawer") KHÔNG có message riêng ở cụm này — nó đã có sẵn dây nối
 * 'playerControls.settingsDrawer.close' từ trước (event/listener,router/player-controls.js), giữ
 * NGUYÊN, chỉ cập nhật workflowPlayerControls.closeSettingsDrawerAndResetStack() để reset ngăn xếp
 * về Main CÙNG LÚC đóng khung ngoài — xem file đó, KHÔNG tạo listener thứ 2 trùng lặp trên cùng 1
 * nút.
 *
 * Cần taskManager (Rule 3: CHỈ Workflow được dùng) để chờ đúng SETTINGS_STACK_TRANSITION_MS trước
 * khi xoá hẳn DOM panel vừa trượt ra — core/settings-panel-stack.js (core UI thuần) chỉ trigger
 * animation + trả về phần tử, KHÔNG tự taskManager.
 *
 * NẠP SAU: core/settings-panel-stack.js, core/dom-refs.js (settingsStackTitle...).
 */
const workflowSettingsStackNav = {

    /** Ứng với msg.type = 'settingsStackNav.back.click' — pop panel đang mở, DÙNG CHUNG mọi panel. */
    back() {
        const removedPanelEl = popSettingsPanel(t('settingsDrawer.title'));
        if (!removedPanelEl) return; // đã ở Main, không có gì để pop (nút Back đang ẩn nên khó xảy ra, guard cho chắc)
        taskManager.once(() => { removedPanelEl.remove(); }, SETTINGS_STACK_TRANSITION_MS, 'popSettingsPanel');
    }
};
