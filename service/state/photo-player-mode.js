/**
 * service/state/photo-player-mode.js — Package STATE domain "photo-player-mode" (MỚI, Giang yêu
 * cầu — Photo tích hợp `duration` như Song/Video, chạy trong Playlist/visualizer thừa hưởng đúng
 * cơ chế Play/Next-Prev/Shuffle, im lặng hoàn toàn lúc hiển thị). Xem cơ chế package ở
 * service/state.js. PHẢI nạp SAU service/state.js.
 *
 * Mẫu THEO ĐÚNG service/state/video-player-mode.js (`isVideoPlayerMode`) — nhưng Photo KHÔNG có
 * HTMLMediaElement thật để đọc `currentTime`/`duration`/`paused` (ảnh tĩnh, không tự phát), nên
 * cần thêm 4 field "đồng hồ giả" TỰ VIẾT (thay cho việc đọc thẳng thuộc tính 1 <audio>/<video> thật
 * như Song/Video vẫn làm) — xem event/workflow/photo-player.js (nơi DUY NHẤT ghi 4 field này) và
 * core/photo-player.js (nơi ĐỌC để tính elapsed hiện tại, Rule 2 — nhận qua tham số, không tự đọc).
 *
 * `isPhotoPlayerMode` — cờ DUY NHẤT dùng ở Router/Core khác để biết "đang phát 1 ảnh làm track hay
 * không" (mirror ý nghĩa `isVideoPlayerMode`, KHÔNG gộp chung 1 field 3 giá trị — xem lý do tách ở
 * event/router/player-controls.js, mục "derive `mode` cục bộ", tránh 2 rule VirtualMachineState
 * cùng khớp).
 * `photoPlayerDurationSec` — duration (giây) của ảnh ĐANG hiển thị (đọc từ playlistCache lúc vào
 * mode, KHÔNG đổi cho tới khi chuyển ảnh khác).
 * `photoPlayerElapsedBeforePauseSec` — số giây đã "phát" TÍNH TỚI lần pause/seek gần nhất (cộng dồn
 * qua nhiều lần pause/resume của CÙNG 1 ảnh — reset về 0 mỗi lần chuyển ảnh mới).
 * `photoPlayerStartedAtMs` — mốc `performance.now()` lúc BẮT ĐẦU đoạn "đang chạy" hiện tại (sau lần
 * resume/seek gần nhất) — cộng với `photoPlayerElapsedBeforePauseSec` ra elapsed hiện tại lúc CHƯA
 * pause (xem `computePhotoPlayerElapsedSec()`, core/photo-player.js).
 * `photoPlayerPaused` — đang tạm dừng hay không (đồng hồ giả không tự trôi lúc `true`).
 */
AppState.definePackage('photo-player-mode', {
    schema: {
        isPhotoPlayerMode: 'boolean',
        photoPlayerDurationSec: 'number',
        photoPlayerElapsedBeforePauseSec: 'number',
        photoPlayerStartedAtMs: 'number',
        photoPlayerPaused: 'boolean',
    },
    buildDefaults() {
        return {
            isPhotoPlayerMode: false,
            photoPlayerDurationSec: 0,
            photoPlayerElapsedBeforePauseSec: 0,
            photoPlayerStartedAtMs: 0,
            photoPlayerPaused: true,
        };
    },
});
