/**
 * event/listener/player-controls.js — TẤT CẢ listener thuộc "module Player Controls" (điều khiển
 * phát nhạc + sự kiện audioPlayer/progressBar) nằm CHUNG file này.
 *
 * QUY TẮC (giống listener/storage.js, listener/playlist.js — ẩn dụ "người gửi thư"):
 *   - Listener KHÔNG biết, KHÔNG quan tâm nội dung nghiệp vụ là gì.
 *   - Mỗi handler CHỈ làm 1 việc: gom đúng data cần gửi rồi gửi 1 message qua eventBus.send().
 *   - "Địa chỉ nhà" (msg.router) LUÔN là 'playerControls' cho mọi listener trong file này.
 *
 * KHÔNG tự document.getElementById trong file này — dùng lại biến đã có sẵn ở core/dom-refs.js.
 *
 * NẠP SAU CÙNG (sau bus, core/player-controls.js, router/player-controls.js, VÀ SAU dom-refs.js)
 * — cần cả eventBus.send() và mọi biến DOM đã sẵn sàng trước khi gắn addEventListener.
 */

// ===================== Click UI =====================
if (btnBackPlaylist) {
    btnBackPlaylist.addEventListener('click', () => {
        eventBus.send({ router: 'playerControls', type: 'playerControls.backToPlaylist.click', payload: {} });
    });
}

if (playPauseBtn) {
    playPauseBtn.addEventListener('click', () => {
        eventBus.send({ router: 'playerControls', type: 'playerControls.playPause.click', payload: {} });
    });
}

if (btnNext) {
    btnNext.addEventListener('click', () => {
        eventBus.send({ router: 'playerControls', type: 'playerControls.next.click', payload: {} });
    });
}

if (btnPrev) {
    btnPrev.addEventListener('click', () => {
        eventBus.send({ router: 'playerControls', type: 'playerControls.prev.click', payload: {} });
    });
}

// ===================== Media Session — Next/Prev ở thông báo, màn hình khoá, nút tai nghe =====================
// MỚI (25/09/2026, Giang yêu cầu "thiếu control next, prev ở thông báo, màn hình khoá") — BỎ một phần quyết định Ver 8
// (mục 2, "không còn setActionHandler nào", xem core/player-controls.js): CHỈ mở lại nexttrack/previoustrack. Gửi ĐÚNG
// message của nút Next/Prev trên màn hình (cùng cách cử chỉ vuốt đang làm, event/workflow/visualizer-gesture.js) -> đi
// chung Router/Workflow, tự đúng cho Song/Video/Photo + mọi gate sẵn có, không có đường xử lý riêng nào.
// seekbackward/seekforward gán null: iOS ưu tiên hiện nút tua ±10s nếu có handler tua -> bỏ để hiện nút chuyển bài.
// play/pause KHÔNG đăng ký: trình duyệt tự bật/tắt đúng phần tử media đang phát, sự kiện 'play'/'pause' nguyên bản vẫn
// đi qua listener audioPlayer/bgVideoElement như cũ.
// `navigator.mediaSession` là đối tượng tĩnh, đăng ký 1 lần lúc nạp. Hành động nào trình duyệt không hỗ trợ -> ném lỗi,
// bỏ qua từng cái riêng.
if ('mediaSession' in navigator) {
    const mediaSessionHandlers = [
        ['nexttrack', () => eventBus.send({ router: 'playerControls', type: 'playerControls.next.click', payload: {} })],
        ['previoustrack', () => eventBus.send({ router: 'playerControls', type: 'playerControls.prev.click', payload: {} })],
        ['seekbackward', null],
        ['seekforward', null],
    ];
    mediaSessionHandlers.forEach(([action, handler]) => {
        try { navigator.mediaSession.setActionHandler(action, handler); }
        catch (e) { console.warn(`[listener/player-controls] Media Session không hỗ trợ "${action}" (bỏ qua):`, e); }
    });
}

if (btnShuffle) {
    btnShuffle.addEventListener('click', () => {
        eventBus.send({ router: 'playerControls', type: 'playerControls.shuffle.click', payload: {} });
    });
}

if (btnRepeat) {
    btnRepeat.addEventListener('click', () => {
        eventBus.send({ router: 'playerControls', type: 'playerControls.repeat.click', payload: {} });
    });
}

// MỚI (25/09/2026, Giang yêu cầu) — icon "Phát lại" ở Control Center (thay "Prev quá 3s thì tua về đầu").
if (btnRestartTrack) {
    btnRestartTrack.addEventListener('click', () => {
        eventBus.send({ router: 'playerControls', type: 'playerControls.restart.click', payload: {} });
    });
}

// (btnSettings listener ĐÃ BỎ — HOTFIX 11, 08/07/2026: nút "Cài đặt" trong Control Center của
// Visualizer đã xoá hẳn khỏi DOM, xem components/visualizer-overlay.js. Settings giờ CHỈ mở được
// từ Playlist qua btnSettingsPlaylist ngay dưới.)

if (btnSettingsPlaylist) {
    btnSettingsPlaylist.addEventListener('click', () => {
        eventBus.send({ router: 'playerControls', type: 'playerControls.settingsDrawer.open', payload: {} });
    });
}

// (closeDrawer listener ĐÃ XOÁ — đợt tái cấu trúc bottom nav App Panel: `#close-drawer` không còn
// tồn tại, Settings giờ đóng qua nút X ĐỘNG trong headerHtml của Generic Drawer, wire trực tiếp
// bởi workflowAppSettings — đúng Rule 5a "nút động do Workflow tự dựng thì Workflow tự wire".)

// ===================== Sự kiện audioPlayer =====================
if (audioPlayer) {
    audioPlayer.addEventListener('play', () => {
        eventBus.send({ router: 'playerControls', type: 'playerControls.audio.play', payload: {} });
    });

    audioPlayer.addEventListener('pause', () => {
        eventBus.send({ router: 'playerControls', type: 'playerControls.audio.pause', payload: {} });
    });

    audioPlayer.addEventListener('ended', () => {
        eventBus.send({ router: 'playerControls', type: 'playerControls.audio.ended', payload: {} });
    });

    audioPlayer.addEventListener('loadedmetadata', () => {
        eventBus.send({ router: 'playerControls', type: 'playerControls.audio.loadedmetadata', payload: {} });
    });

    audioPlayer.addEventListener('error', () => {
        eventBus.send({ router: 'playerControls', type: 'playerControls.audio.error', payload: {} });
    });

    audioPlayer.addEventListener('timeupdate', () => {
        eventBus.send({ router: 'playerControls', type: 'playerControls.audio.timeupdate', payload: {} });
    });

    audioPlayer.addEventListener('seeked', () => {
        eventBus.send({ router: 'playerControls', type: 'playerControls.audio.seeked', payload: {} });
    });
}

// ===================== progressBar (kéo tay) =====================
if (progressBar) {
    progressBar.addEventListener('input', (e) => {
        eventBus.send({ router: 'playerControls', type: 'playerControls.progressBar.seeking', payload: { value: e.target.value } });
    });

    progressBar.addEventListener('change', (e) => {
        eventBus.send({ router: 'playerControls', type: 'playerControls.progressBar.seekCommit', payload: { value: e.target.value } });
    });
}
