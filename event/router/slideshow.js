/**
 * event/router/slideshow.js — Router tên "slideshowSettings", tự đăng ký với eventBus lúc nạp.
 * Batch 8, ver 12 "Multi Media" — Slideshow nền Visual (nguồn nền thứ 3).
 *
 * Toàn bộ msg.type ở đây chỉ cần gọi thẳng 1 hàm (đóng/mở drawer = DOM thuần, gọi thẳng; còn lại
 * đều ≥2 bước phụ thuộc thứ tự — đọc DB + set state + persist meta + đồng bộ UI — nên giao hết cho
 * `workflowSlideshow`, không có case nào cần VirtualMachineState (không có case nào rẽ nhánh theo
 * appState KHÁC ngoài chính msg.payload của nó).
 *
 * NẠP SAU: event/bus.js, event/workflow/slideshow.js (workflowSlideshow), core/dom-refs.js
 * (drawerSlideshowSettings). NẠP TRƯỚC: event/listener/slideshow.js.
 */
const routerSlideshowSettings = (() => {
    /** @param {import('../bus.js').EventMessage} msg */
    function handle(msg) {
        switch (msg.type) {
            case 'slideshowSettings.open':
                workflowSlideshow.openDrawer(); // >1 hàm core nối tiếp (DOM + đọc DB + vẽ) -> workflow
                break;

            case 'slideshowSettings.close':
                drawerSlideshowSettings.classList.add('translate-y-full'); // CHỈ 1 thao tác DOM thuần -> gọi thẳng
                break;

            case 'slideshowSettings.pickAlbum.click':
                workflowSlideshow.promptPickAlbum(); // >1 hàm core -> workflow
                break;

            case 'slideshowSettings.clearAlbum.click':
                workflowSlideshow.disableFromDrawer(); // >1 hàm core -> workflow
                break;

            case 'slideshowSettings.mode.change':
                workflowSlideshow.changeMode(msg.payload.value); // >1 bước (set + persist) -> workflow
                break;

            case 'slideshowSettings.interval.change':
                workflowSlideshow.changeInterval(msg.payload.value); // >1 bước (set + persist + reschedule task) -> workflow
                break;

            case 'slideshowSettings.transitionType.change':
                workflowSlideshow.changeTransitionType(msg.payload.value); // >1 bước (set + persist + áp DOM) -> workflow
                break;

            default:
                console.warn(`[routerSlideshowSettings] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('slideshowSettings', routerSlideshowSettings);
