/**
 * service/state/visual-bg.js — Package STATE domain "visual-bg".
 *
 * CHỈ còn 1 giá trị RUNTIME (không persist được): blob: URL của ẢNH TĨNH đang áp dụng lên DOM. Bản
 * thân LỰA CHỌN của người dùng (type, nguồn...) sống ở CONFIG domain `visualBg`
 * (core/config.js::DEFAULT_VISUAL_BG_CONFIG, persist qua `meta.visualBgConfig`) — 2 nơi KHÁC nhau
 * về bản chất, không trộn: config lưu KEY (bền vững qua nhiều session), state giữ object URL
 * (chết theo session, phải resolve lại từ key mỗi lần boot).
 *
 * XOÁ (Giang chốt — bỏ hẳn hành vi video tự viết ở Visual Background) — `visualBgVideoObjectUrl`/
 * `visualBgVideoLoadedUrl` không còn tồn tại ở đây: vòng đời object URL của `bgVideoElement` (video
 * nền, dù Video Player mode thật hay Visual Background trang trí) giờ do ĐÚNG 1 nơi sở hữu —
 * `workflowVideoPlayer` (event/workflow/video-player.js, field `_objectUrl`/`_thumbObjectUrl`/
 * `_forcedBgObjectUrl` — instance field thường, không cần AppState vì domain đó không có Workflow
 * nào khác cần ĐỌC lại các URL này).
 *
 * PHẢI nạp SAU service/state.js.
 */
AppState.definePackage('visual-bg', {
    schema: {
        // blob: URL của ảnh nền tĩnh ĐANG gán vào `#visual-bg-image` — '' = chưa gán gì.
        visualBgImageObjectUrl: 'string',
        // Khung hình gradient Movement MỚI NHẤT đã tính (event/workflow/visual-bg.js::
        // _tickGradientMovement()) — null khi Movement không chạy. Cho phép visual 2D khác (canvas,
        // không phải DOM CSS) vẽ ĐÚNG khớp gradient đang hiển thị thay vì tự bịa màu riêng — xem
        // core/visual-bg.js::getVisualBgFillStyle(), dùng bởi core/visualizer/types/rain.js.
        visualBgGradientLiveAngle: 'nullable-number',
        visualBgGradientLiveStops: 'any',
    },
    buildDefaults() {
        return {
            visualBgImageObjectUrl: '',
            visualBgGradientLiveAngle: null,
            visualBgGradientLiveStops: null,
        };
    },
});
