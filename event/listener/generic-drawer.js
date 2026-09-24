/**
 * event/listener/generic-drawer.js — TẤT CẢ listener của cụm "genericDrawer" (MỚI 24/09/2026).
 * `genericDrawerBody` là phần tử TĨNH (core/dom-refs.js, không bao giờ bị xoá — chỉ nội dung bên trong đổi) nên
 * gắn thẳng 1 lần. `scroll` không nổi bọt -> chỉ bắt cuộn DỌC của chính body (cuộn ngang của carousel bên trong
 * không lọt vào đây). `passive` — không bao giờ chặn cuộn.
 *
 * NẠP SAU CÙNG (sau bus, core/dom-refs.js, event/router/generic-drawer.js).
 */

if (genericDrawerBody) {
    genericDrawerBody.addEventListener('scroll', () => {
        eventBus.send({ router: 'genericDrawer', type: 'genericDrawer.body.scroll', payload: {} });
    }, { passive: true });
}

// MỚI (24/09/2026) — THAY MutationObserver + requestAnimationFrame cũ sống NGAY trong core/generic-drawer.js (core tự
// nghe DOM tĩnh + tự quyết định đo lại — vi phạm Rule 5a/event bus). Chỉ chuyển thư: nội dung body đổi (thêm/bớt node,
// đổi class/style) -> Router 'genericDrawer' -> workflowGenericDrawerHelpers.onBodyMutated() lo co/giãn chiều cao.
if (genericDrawerBody) {
    new MutationObserver((mutations) => {
        eventBus.send({ router: 'genericDrawer', type: 'genericDrawer.body.mutate', payload: { mutations } });
    }).observe(genericDrawerBody, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
}
