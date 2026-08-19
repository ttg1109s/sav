/**
 * event/listener/photo-panel.js — Listener cụm "photoPanel" (MỚI). `#btn-photo-panel-close` được
 * dựng ĐỘNG mỗi lần `workflowFileManagerPhoto.openPanel()` chạy (ghi vào `settingsStackPanelMain.
 * innerHTML`) — nhưng bản thân `#photo-panel`/`#settings-stack-body` là DOM TĨNH có sẵn từ boot
 * (components/photo-panel.js), nên dùng DELEGATION trên `settingsStackBody` (ổn định, không bị
 * .remove()) thay vì gắn lại listener mỗi lần render — đúng chuẩn `settingsStackBody` đã dùng cho
 * mọi nút động khác (xem event/listener/file-manager-photo.js).
 *
 * NẠP SAU CÙNG (sau bus, core, workflow, router, VÀ SAU dom-refs.js).
 */

if (settingsStackBody) {
    settingsStackBody.addEventListener('click', (e) => {
        if (e.target.closest('#btn-photo-panel-close')) {
            eventBus.send({ router: 'photoPanel', type: 'photoPanel.close.click', payload: {} });
        }
    });
}
