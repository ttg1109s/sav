/**
 * event/router/slideshow.js — Router tên "slideshowSettings", tự đăng ký với eventBus lúc nạp.
 * Batch 8, ver 12 "Multi Media" — Slideshow nền Visual (nguồn nền thứ 3).
 *
 * VIẾT LẠI (Batch 9, 04/07/2026, mục 4 phản hồi Giang) — 2 case cũ 'pickAlbum.click'/
 * 'clearAlbum.click' (2 nút riêng) ĐÃ BỎ, thay bằng 'enable.change' (1 toggle DUY NHẤT, cùng cơ
 * chế đã thống nhất cho Video/Ảnh nền ở mục 1) + 'albumPicker.overlay.click' (huỷ panel). ĐƠN GIẢN
 * HOÁ THÊM (04/07/2026, đợt 2) — bỏ hẳn case 'currentAlbumRow.click' (hàng "album đang chạy" đã bỏ
 * theo phản hồi Giang) — đổi album khi đang bật: gạt Off rồi gạt lại On.
 *
 * Batch D4 (Settings restructure, 06/07/2026) — 'open' ĐỔI TÊN 'openPanel.click' (khớp quy ước
 * push panel dùng CHUNG mọi cụm Settings khác — About/Subtitle/Visualizer). Case 'close' ĐÃ XOÁ —
 * đóng dùng CHUNG 'settingsStackNav.back.click' cho MỌI panel (xem event/router/settings-stack-
 * nav.js) — panel chọn Album ('albumPicker.overlay.click') KHÔNG đổi, vẫn của riêng cụm này (đó
 * là 1 overlay ĐỘC LẬP, không phải panel Settings Stack — xem docstring components/slideshow-
 * settings-drawer.js).
 *
 * Toàn bộ msg.type ở đây chỉ cần gọi thẳng 1 hàm (đóng/mở drawer = DOM thuần, gọi thẳng; còn lại
 * đều ≥2 bước phụ thuộc thứ tự — đọc DB + set state + persist meta + đồng bộ UI — nên giao hết cho
 * `workflowSlideshow`, không có case nào cần VirtualMachineState (không có case nào rẽ nhánh theo
 * appState KHÁC ngoài chính msg.payload của nó).
 *
 * NẠP SAU: event/bus.js, event/workflow/slideshow.js (workflowSlideshow), core/settings-panel-
 * stack.js (pushSettingsPanel). NẠP TRƯỚC: event/listener/slideshow.js.
 */
const routerSlideshowSettings = (() => {
    /** @param {import('../bus.js').EventMessage} msg */
    function handle(msg) {
        switch (msg.type) {
            case 'slideshowSettings.openPanel.click':
                workflowSlideshow.openPanel(); // >1 hàm core nối tiếp (push + đọc DB + vẽ) -> workflow
                break;

            // (case 'close' ĐÃ XOÁ — Batch D4, dùng CHUNG 'settingsStackNav.back.click')

            // MỚI (Batch 9, mục 4) — 1 toggle DUY NHẤT thay 2 nút Chọn/Tắt cũ.
            case 'slideshowSettings.enable.change':
                workflowSlideshow.onEnableToggleChange(msg.payload.checked); // >1 hàm core -> workflow
                break;

            // MỚI (Batch 9, mục 4) — bấm ra ngoài panel chọn Album (huỷ, không chọn gì).
            case 'slideshowSettings.albumPicker.overlay.click':
                workflowSlideshow.cancelAlbumPicker(); // >1 hàm core (đóng panel + có thể trả toggle) -> workflow
                break;

            // MỚI (31/07/2026, Giang chỉ ra "core tạo ra addEventListener chứ không phải
            // workflow") — bấm 1 album trong lưới picker (core/file-manager/photo-ui.js::
            // renderSlideshowAlbumPickerGrid(), KHÔNG còn nhận callback `onSelect` đục nữa).
            case 'slideshowSettings.albumPicker.tile.click':
                workflowSlideshow.selectAlbumFromPicker(msg.payload.albumId);
                break;

            case 'slideshowSettings.mode.change':
                workflowSlideshow.changeMode(msg.payload.value); // >1 bước (set + persist) -> workflow
                break;

            // MỚI (04/07/2026, mục 5) — toggle "Photo per song".
            case 'slideshowSettings.photoPerSong.change':
                workflowSlideshow.changePhotoPerSong(msg.payload.checked); // >1 bước (set + persist + đổi cơ chế tick) -> workflow
                break;

            // SỬA (18/07/2026, phản hồi Giang) — input số cũ ĐỔI thành nút bấm mở modal picker
            // (core/time-picker-modal.js) — workflow tự mở modal + tự xử lý kết quả trong 1 hàm.
            case 'slideshowSettings.interval.openPicker':
                workflowSlideshow.openIntervalPicker(); // >1 bước (mở modal + xử lý callback) -> workflow
                break;

            case 'slideshowSettings.transitionType.change':
                workflowSlideshow.changeTransitionType(msg.payload.value); // >1 bước (set + persist + áp DOM + ẩn/hiện hàng tỉ lệ) -> workflow
                break;

            // MỚI (18/07/2026, phản hồi Giang — mục "thêm thời gian transition giữa 2 ảnh").
            case 'slideshowSettings.transitionDuration.openPicker':
                workflowSlideshow.openTransitionDurationPicker(); // >1 bước (mở modal + xử lý callback) -> workflow
                break;

            case 'slideshowSettings.transitionRatio.preview':
                workflowSlideshow.previewTransitionRatio(msg.payload.value); // >1 bước (đọc appState + tính toán + cập nhật DOM) -> workflow
                break;

            case 'slideshowSettings.transitionRatio.change':
                workflowSlideshow.changeTransitionRatio(msg.payload.value); // >1 bước (set + persist + đồng bộ nhãn) -> workflow
                break;

            case 'slideshowSettings.transitionEasing.change':
                workflowSlideshow.changeTransitionEasing(msg.payload.value); // >1 bước (validate + set + persist) -> workflow
                break;

            // MỚI (Ken Burns, 18/07/2026, phản hồi Giang) — toggle độc lập, tách khỏi transitionType.
            case 'slideshowSettings.kenBurns.change':
                workflowSlideshow.changeKenBurnsEnabled(msg.payload.checked); // >1 bước (set + persist + đồng bộ hàng select) -> workflow
                break;

            // MỚI ("Nhóm 2", 18/07/2026, phản hồi Giang) — 13 chế độ, THAY HẲN "Nhóm 1".
            case 'slideshowSettings.kenBurnsMode.change':
                workflowSlideshow.changeKenBurnsMode(msg.payload.value); // >1 bước (validate + set + persist) -> workflow
                break;

            default:
                console.warn(`[routerSlideshowSettings] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('slideshowSettings', routerSlideshowSettings);
