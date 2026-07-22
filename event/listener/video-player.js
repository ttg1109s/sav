/**
 * event/listener/video-player.js — TẤT CẢ listener của cụm "videoPlayer". MỚI (21/07/2026, mục 4).
 *
 * SỬA (21/07/2026, cùng ngày) — nút toggle "Play mode" (header Visualizer) ĐÃ DỜI sang panel File
 * Manager -> Video (Giang yêu cầu) — listener click của nó giờ NẰM Ở `event/workflow/file-manager-
 * video.js` (checkbox động, wire lúc panel mở, KHÔNG phải dom-refs tĩnh).
 *
 * SỬA LẦN 2 (21/07/2026, viết lại kiến trúc — audioPlayer không còn dùng cho video) — THÊM 5 sự
 * kiện NGUYÊN BẢN của `bgVideoElement` (play/pause/timeupdate/loadedmetadata/ended) — trước đây
 * TOÀN BỘ progress bar/current time/icon Play-Pause/auto-next đều bám theo sự kiện của `audioPlayer`
 * (element KHÔNG THỰC SỰ chạy khi nhận src là blob video trên 1 số trình duyệt/thiết bị — xem
 * docstring core/video-player.js). Giờ `bgVideoElement` tự bắn sự kiện CỦA CHÍNH NÓ, dispatch qua
 * message type RIÊNG (`playerControls.video.*` — KHÔNG trùng `playerControls.audio.*` của Song,
 * tránh phải branch VirtualMachineState ở NHỮNG case đó — chỉ 2 case progressBar seeking/
 * seekCommit BẮT BUỘC branch vì dùng CHUNG 1 DOM listener/message type với Song, xem event/router/
 * player-controls.js). Guard `appState.get('isVideoPlayerMode')` trong TỪNG listener — sự kiện của
 * `bgVideoElement` lúc CHỈ bật Video nền trang trí (không phải Player mode) phải là no-op.
 *
 * CỬ CHỈ VUỐT (Giang yêu cầu "nghiên cứu cử chỉ vuốt như TikTok") — vuốt DỌC trên `bgVideoElement`
 * lúc đang ở Video Player mode: vuốt LÊN (ngón tay di chuyển lên trên) = video kế tiếp (giống
 * TikTok "vuốt lên xem tiếp"), vuốt XUỐNG = video trước đó. Đo qua `touchstart`/`touchend` (đơn
 * giản, đủ dùng cho 1 lần vuốt trọn vẹn — KHÔNG cần `touchmove` vì không cần kéo-theo-ngón-tay/
 * preview video kế tiếp trong lúc vuốt, chỉ cần biết điểm đầu/cuối). Ngưỡng 60px — thấp hơn sẽ dễ
 * nhầm với chạm thường, cao hơn sẽ khó vuốt trên màn nhỏ.
 * DISPATCH THẲNG `playerControls.next.click`/`playerControls.prev.click` (KHÔNG phải msg.type
 * riêng của router này) — cùng Ý NGHĨA với bấm nút Next/Prev vật lý, tận dụng ĐÚNG nhánh
 * VirtualMachineState đã có ở event/router/player-controls.js (branch theo `isVideoPlayerMode`),
 * tránh phải viết 1 nhánh xử lý y hệt lần thứ 2 ở router này.
 * Guard `appState.get('isVideoPlayerMode')` ngay TRONG listener — vuốt trên `bgVideoElement` lúc
 * KHÔNG ở Player mode (vd đang chỉ bật Video nền trang trí) phải là no-op, không vô tình next/prev
 * bài hát đang nghe.
 *
 * NẠP SAU: core/dom-refs.js (bgVideoElement).
 */

if (bgVideoElement) {
    bgVideoElement.addEventListener('play', () => {
        if (!appState.get('isVideoPlayerMode')) return;
        eventBus.send({ router: 'playerControls', type: 'playerControls.video.play', payload: {} });
    });
    bgVideoElement.addEventListener('pause', () => {
        if (!appState.get('isVideoPlayerMode')) return;
        eventBus.send({ router: 'playerControls', type: 'playerControls.video.pause', payload: {} });
    });
    bgVideoElement.addEventListener('loadedmetadata', () => {
        if (!appState.get('isVideoPlayerMode')) return;
        eventBus.send({ router: 'playerControls', type: 'playerControls.video.loadedmetadata', payload: {} });
    });
    bgVideoElement.addEventListener('timeupdate', () => {
        if (!appState.get('isVideoPlayerMode')) return;
        eventBus.send({ router: 'playerControls', type: 'playerControls.video.timeupdate', payload: {} });
    });
    bgVideoElement.addEventListener('ended', () => {
        if (!appState.get('isVideoPlayerMode')) return;
        eventBus.send({ router: 'playerControls', type: 'playerControls.video.ended', payload: {} });
    });

    bgVideoElement.addEventListener('touchstart', (e) => {
        if (!appState.get('isVideoPlayerMode')) return; // guard: không ở Player mode -> vuốt không có ý nghĩa gì
        workflowVideoPlayer._swipeStartY = e.changedTouches[0].clientY;
    }, { passive: true });

    bgVideoElement.addEventListener('touchend', (e) => {
        if (!appState.get('isVideoPlayerMode')) return;
        if (workflowVideoPlayer._swipeStartY === null) return; // guard: touchstart không xảy ra trên chính element này (hiếm)
        const deltaY = e.changedTouches[0].clientY - workflowVideoPlayer._swipeStartY;
        workflowVideoPlayer._swipeStartY = null;
        const SWIPE_THRESHOLD_PX = 60;
        if (deltaY <= -SWIPE_THRESHOLD_PX) {
            eventBus.send({ router: 'playerControls', type: 'playerControls.next.click', payload: {} }); // vuốt LÊN = tiếp theo
        } else if (deltaY >= SWIPE_THRESHOLD_PX) {
            eventBus.send({ router: 'playerControls', type: 'playerControls.prev.click', payload: {} }); // vuốt XUỐNG = trước đó
        }
    }, { passive: true });
}
