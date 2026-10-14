/**
 * service/state/photo-player-mode.js — Package STATE domain "photo-player-mode" (Photo phát làm track, im lặng). Mẫu theo
 * service/state/video-player-mode.js; ảnh không có HTMLMediaElement nên có thêm "đồng hồ giả". Chỉ
 * event/workflow/photo-player.js ghi các field đồng hồ; core/photo-player.js tính từ chúng (nhận qua tham số).
 * PHẢI nạp SAU service/state.js.
 *
 * `isPhotoPlayerMode` — đang phát 1 ảnh làm track (mirror `isVideoPlayerMode`, không gộp thành 1 field 3 giá trị — xem
 * "derive `mode` cục bộ" ở event/router/player-controls.js).
 * `photoPlayerDurationSec` — thời lượng (giây) của ảnh đang hiện.
 * `photoPlayerElapsedBeforePauseSec` — giây đã phát tính tới lần pause/tua gần nhất (về 0 khi đổi ảnh).
 * `photoPlayerStartedAtMs` — mốc performance.now() bắt đầu đoạn đang chạy hiện tại.
 * `photoPlayerPaused` — người dùng đang dừng.
 * `photoPlayerClockHeld` — ảnh mới đang chạy Transition vào, đồng hồ chưa đếm (Giang chốt "Transition xong mới đếm"); khác
 * `photoPlayerPaused`: icon vẫn "đang phát".
 * `photoPlayerEnded` — đã báo hết ảnh (như HTMLMediaElement.ended): tick không báo lặp; Play lại thì phát từ đầu. Về false
 * khi đổi ảnh / tua / thoát mode.
 */
AppState.definePackage('photo-player-mode', {
    schema: {
        isPhotoPlayerMode: 'boolean',
        photoPlayerDurationSec: 'number',
        photoPlayerElapsedBeforePauseSec: 'number',
        photoPlayerStartedAtMs: 'number',
        photoPlayerPaused: 'boolean',
        photoPlayerClockHeld: 'boolean',
        photoPlayerEnded: 'boolean',
    },
    buildDefaults() {
        return {
            isPhotoPlayerMode: false,
            photoPlayerDurationSec: 0,
            photoPlayerElapsedBeforePauseSec: 0,
            photoPlayerStartedAtMs: 0,
            photoPlayerPaused: true,
            photoPlayerClockHeld: false,
            photoPlayerEnded: false,
        };
    },
});
