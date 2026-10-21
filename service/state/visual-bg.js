/**
 * service/state/visual-bg.js — STATE runtime domain "visual-bg" (không persist). Lựa chọn của người dùng (type, nguồn,
 * màu…) sống ở CONFIG domain `visualBg` (core/config.js::DEFAULT_VISUAL_BG_CONFIG, lưu `meta.visualBgConfig`): config
 * giữ KEY bền qua nhiều phiên, state giữ thứ chết theo phiên. Object URL của `bgVideoElement` do workflowVideoPlayer
 * (event/workflow/video-player.js) sở hữu.
 *
 * PHẢI nạp SAU service/state.js.
 */
AppState.definePackage('visual-bg', {
    schema: {
        // blob: URL của ảnh nền tĩnh đang gán vào `#visual-bg-image` — '' = chưa gán.
        visualBgImageObjectUrl: 'string',
        // Khung gradient Movement mới nhất (workflowVisualBg._tickGradientMovement()) — null khi Movement không chạy. Canvas
        // 2D vẽ khớp gradient đang hiển thị qua workflowVisualBg.canvasFillStyle() (vd event/workflow/visualizer/rain.js).
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
