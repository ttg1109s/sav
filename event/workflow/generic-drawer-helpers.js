/**
 * event/workflow/generic-drawer-helpers.js — GỘP LẠI (31/07/2026, Giang chỉ ra: "xây Generic Drawer
 * mà vẫn phải nhân bản là vô lý") — `closeFully()` từng bị chép nguyên văn ở 7 file Workflow
 * (document-reader/file-manager-photo/file-manager-video/file-manager-folder-browser/playlist/
 * image-edit/video-editor); `buildSimpleHeaderHtml()` chép ở 2 file (file-manager-photo/image-edit).
 * Gộp về ĐÚNG 1 chỗ, mọi nơi gọi qua `workflowGenericDrawerHelpers.xxx()`.
 *
 * VẪN phải là Workflow (không phải core/generic-drawer.js) — Rule 5a: Core không được tự
 * `addEventListener` cho DOM tĩnh (`genericDrawerPanel`), trừ 3 điều kiện hạ tầng dùng chung ĐÃ QUA
 * AUDIT chính thức (xem readme/event-bus-flow.md, mục "Vì sao core/modal-choice.js được miễn") —
 * file này CHƯA qua audit đó, không tự nhận miễn trừ.
 *
 * `video-editor.js` KHÔNG gọi thẳng `closeFully()` — nó cần thêm side-effect riêng
 * (`_destroyShiftWaveform()`/`_renderAllTracks()`/...) quanh cùng lõi này, vẫn giữ
 * `_closeGenericDrawerFully()` riêng nhưng thân hàm giờ gọi `closeFully()` thay vì chép lại lõi.
 *
 * NẠP SAU: core/generic-drawer.js, dom-refs.js (genericDrawerPanel), lang/lang.js (t()).
 */
const workflowGenericDrawerHelpers = {

    /** Trượt Generic Drawer xuống rồi ẩn hẳn sau `transitionend` (Core `core/generic-drawer.js`
     * KHÔNG được tự `addEventListener` cho DOM tĩnh, xem docstring đầu file). */
    closeFully() {
        closeGenericDrawer(); // core/generic-drawer.js
        genericDrawerPanel.addEventListener('transitionend', function onTransitionEnd() {
            genericDrawerPanel.removeEventListener('transitionend', onTransitionEnd);
            hideGenericDrawerImmediately(); // core/generic-drawer.js
        }, { once: true });
    },

    /** headerHtml đơn giản "tiêu đề + nút X đóng" — dùng cho Generic Drawer không cần action nào
     * khác ở header (List/Read của Document Reader có header riêng, phức tạp hơn, KHÔNG dùng hàm
     * này). @param {string} title @returns {string} */
    buildSimpleHeaderHtml(title) {
        return `
            <div class="flex justify-between items-center px-5 pb-3 border-b border-slate-200">
                <h3 class="text-base font-bold text-slate-900">${title}</h3>
                <button id="btn-generic-drawer-close" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500" title="${t('common.close')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        `;
    },
};
