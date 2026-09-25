/**
 * event/router/app-visibility.js — Router tên "appVisibility" (MỚI 25/09/2026, Giang yêu cầu "ẩn tab/PWA chỉ để audio
 * Song phát nền, đăng ký audio session, tạm dừng mọi render Visualizer ở chế độ không Game").
 *
 * 1 case duy nhất 'appVisibility.document.change' (payload `{ visible }` từ event/listener/app-visibility.js). Router tự
 * đọc `gameplayPhase` 1 lần, derive `phase` CỤC BỘ (cùng khuôn "derive mode cục bộ" ở event/router/player-controls.js)
 * rồi để VirtualMachineState chọn callback — 2 rule có thể CÙNG khớp lúc ẩn (đúng thiết kế):
 *   - 'hiddenIdle' | 'hiddenGame' -> luôn giữ tiếng Song (Audio Session + keep-alive AudioContext);
 *   - 'hiddenIdle'                -> THÊM chế độ nền tối giản (dừng render Visualizer/VBG/Video-Photo Player);
 *   - 'visible'                   -> tắt keep-alive + khôi phục những gì đã dừng.
 *
 * NẠP SAU: event/bus.js, event/virtual-machine-state.js, event/workflow/app-visibility.js.
 * NẠP TRƯỚC: event/listener/app-visibility.js.
 */
const routerAppVisibility = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'appVisibility.document.change': {
                const gameplayPhase = appState.get('gameplayPhase');
                const phase = msg.payload.visible ? 'visible' : (gameplayPhase === 'idle' ? 'hiddenIdle' : 'hiddenGame');
                VirtualMachineState.run([
                    { state: phase, operation: '!==', value: 'visible', callback: () => workflowAppVisibility.startBackgroundAudioKeepAlive() },
                    { state: phase, operation: '===', value: 'hiddenIdle', callback: () => workflowAppVisibility.enterBackgroundSuspend() },
                    { state: phase, operation: '===', value: 'visible', callback: () => workflowAppVisibility.exitBackground() },
                ]);
                break;
            }
            default:
                console.warn(`[routerAppVisibility] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('appVisibility', routerAppVisibility);
