/**
 * event/listener/virtual-list.js — Listener cho sự kiện 'scroll' của container đang windowing
 * (hiện chỉ `genericDrawerBody` — container KHÁC nào sau này cần windowing cũng đăng ký thêm
 * đúng 1 khối tương tự ở đây, xem event/workflow/virtual-list.js::mount()).
 *
 * CHỈ làm 1 việc: đăng ký sự kiện + gọi eventBus.send() — KHÔNG tự quyết định container này ĐANG
 * windowing thật hay không (đó là việc của Workflow, tự no-op nếu chưa mount() gì, xem
 * workflowVirtualList.handleScroll()).
 *
 * Tiền lệ: sự kiện TẦN SUẤT CAO không có ngoại lệ bỏ qua eventBus — audioPlayer 'timeupdate' (rất
 * dày, xem event/listener/player-controls.js) vẫn đi ĐÚNG qua eventBus.send() như mọi sự kiện
 * khác, không đặc cách. 'scroll' ở đây theo ĐÚNG tiền lệ đó, không tự viết tắt riêng trong Workflow.
 *
 * NẠP SAU: event/bus.js, core/dom-refs.js (genericDrawerBody).
 */
if (genericDrawerBody) {
    genericDrawerBody.addEventListener('scroll', () => {
        eventBus.send({
            router: 'virtualList',
            type: 'virtualList.scroll',
            payload: { scrollTop: genericDrawerBody.scrollTop, clientHeight: genericDrawerBody.clientHeight },
        });
    }, { passive: true });
}
