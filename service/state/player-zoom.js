/**
 * service/state/player-zoom.js — Package STATE domain "player-zoom" (MỚI 29/09/2026, Giang yêu cầu — icon kính
 * lúp trong Control Center bật Zoom mode cho Player Video/Photo). Xem cơ chế package ở service/state.js. PHẢI nạp
 * SAU service/state.js.
 *
 * `isPlayerZoomMode` — đang ở Zoom mode hay không (cử chỉ app tắt, cử chỉ zoom/pan bật). CHỈ event/workflow/
 * player-zoom.js ghi. Giá trị scale/x/y của cử chỉ đang chạy KHÔNG lưu ở đây — dữ liệu từng khung pointermove,
 * giữ trên object Workflow (cùng cách event/workflow/visualizer-gesture.js giữ `_startX/_startY`).
 */
AppState.definePackage('player-zoom', {
    schema: {
        isPlayerZoomMode: 'boolean',
    },
    buildDefaults() {
        return {
            isPlayerZoomMode: false,
        };
    },
});
