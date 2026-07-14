/**
 * event/listener/virtual-list.js — Listener 'scroll' DUY NHẤT, delegated ở `document` (capture —
 * 'scroll' KHÔNG bubble, phải bắt ở capture phase mới nghe được từ container con bất kỳ).
 *
 * SỬA 14/07/2026 (Giang chỉ ra: trước đó chỉ hardcode `genericDrawerBody`, khiến Photo & Album phải
 * tự addEventListener riêng ở Workflow — SAI, phá đúng luồng listener->bus->router->workflow) — giờ
 * ĐỌC `e.target.dataset.virtualScrollMount` (tự gắn bởi `workflowVirtualList.mount()`, xem
 * event/workflow/virtual-list.js) thay vì check id/selector cố định — container NÀO gọi `mount()`
 * cũng TỰ ĐỘNG được nghe scroll, không cần thêm khối listener riêng mỗi lần có tính năng mới.
 *
 * NẠP SAU: event/bus.js.
 */
document.addEventListener('scroll', (e) => {
    const mountKey = e.target.dataset && e.target.dataset.virtualScrollMount;
    if (!mountKey) return; // không phải container đang windowing -> bỏ qua
    eventBus.send({ router: 'virtualList', type: 'virtualList.scroll', payload: { mountKey } });
}, { capture: true, passive: true });
