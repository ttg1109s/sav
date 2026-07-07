/**
 * event/listener/settings-stack-nav.js — TẤT CẢ listener của cụm "settingsStackNav".
 *
 * VIẾT LẠI (06/07/2026, phản hồi Giang — slider thật, header nhét vào từng panel): nút Back
 * KHÔNG còn là 1 id TĨNH duy nhất — giờ MỖI panel con tự mang 1 nút Back riêng (class
 * `.settings-panel-back-btn`, tạo/xoá theo từng lần push/pop, xem core/settings-panel-stack.js).
 * ĐỔI sang DELEGATION trên `settingsStackBody` (phần tử ổn định, KHÔNG BAO GIỜ bị xoá) — CHUẨN đã
 * dùng cho mọi input bên trong panel con từ Batch D2 trở đi, giờ áp dụng luôn cho chính nút Back.
 *
 * NẠP SAU CÙNG (sau bus, core, workflow, router, VÀ SAU dom-refs.js).
 */

if (settingsStackBody) {
    settingsStackBody.addEventListener('click', (e) => {
        if (e.target.closest('.settings-panel-back-btn')) {
            eventBus.send({ router: 'settingsStackNav', type: 'settingsStackNav.back.click', payload: {} });
        }
    });
}
