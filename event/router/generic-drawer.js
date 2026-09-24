/**
 * event/router/generic-drawer.js — Router tên "genericDrawer" (MỚI 24/09/2026), tự đăng ký với eventBus lúc nạp.
 * Nhánh: body Generic Drawer cuộn -> Workflow ghi nhớ vị trí cuộn theo màn đang gắn (xem
 * event/workflow/generic-drawer-helpers.js, khối "Nhớ vị trí cuộn theo màn").
 *
 * NẠP SAU: event/bus.js, event/workflow/generic-drawer-helpers.js.
 * NẠP TRƯỚC: event/listener/generic-drawer.js.
 */
const routerGenericDrawer = (() => {
    /** @param {import('../bus.js').EventMessage} msg */
    function handle(msg) {
        switch (msg.type) {

            case 'genericDrawer.body.scroll': {
                workflowGenericDrawerHelpers.trackScroll();
                break;
            }

            case 'genericDrawer.body.mutate': { // MỚI (24/09/2026) — co/giãn chiều cao theo nội dung đổi tại chỗ
                workflowGenericDrawerHelpers.onBodyMutated(msg.payload.mutations);
                break;
            }

            case 'genericDrawer.styles.change': { // MỚI (24/09/2026) — Tailwind CDN vừa sinh thêm CSS -> nhắm lại chiều cao
                workflowGenericDrawerHelpers.onStylesChanged();
                break;
            }

            default:
                console.warn(`[router:genericDrawer] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`);
        }
    }

    return { handle };
})();

eventBus.register('genericDrawer', routerGenericDrawer);
