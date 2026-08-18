/**
 * tab-hide-reload.js — Core THUẦN: pause audio/video + lưu resume-state + reload trang.
 *
 * Debounce + phân biệt "ẩn tab thật" vs "F5/đóng tab" (đọc _isRealUnloadHappening) nằm ở
 * event/tab.js::scheduleHideAndReload() — đó là orchestration chờ-rồi-đọc-lại-sau, thuộc về nơi
 * gọi (event/tab.js vốn đã là ngoại lệ đứng ngoài bus, tự đọc/ghi appState), KHÔNG phải Core (Rule 2
 * — Core chỉ nhận tham số, không tự appState.get()).
 *
 * KHÔNG chạy nếu đang ở Game Mode (`gameplayPhase !== 'idle'`) — reload giữa ván sẽ phá sạch phiên
 * chơi (DOM + state game mất hết, không cách nào khôi phục).
 *
 * PHẢI nạp SAU: core/resume-state-storage.js (saveResumeStateToLocalStorage, setResumeFlag),
 *   core/dom-refs.js (audioPlayer, bgVideoElement).
 * PHẢI nạp TRƯỚC: core/app-cleanup.js, event/tab.js.
 */
        const HIDE_RELOAD_DEBOUNCE_MS = 50;

        function pauseAndSaveResumeState(gameplayPhase) {
            if (gameplayPhase !== 'idle') return;

            // Pause trước khi lưu: đảm bảo currentTime đọc được là chính xác tại thời điểm dừng
            if (typeof audioPlayer !== 'undefined' && audioPlayer && !audioPlayer.paused) {
                audioPlayer.pause();
            }
            if (typeof bgVideoElement !== 'undefined' && bgVideoElement && !bgVideoElement.paused) {
                bgVideoElement.pause();
            }

            const didSave = (typeof saveResumeStateToLocalStorage === 'function') && saveResumeStateToLocalStorage();
            if (didSave && typeof setResumeFlag === 'function') setResumeFlag();

            location.reload();
        }
