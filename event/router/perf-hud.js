/**
 * event/router/perf-hud.js — MỚI (05/10/2026) — Router tên "perfHud" (Performance HUD), tự đăng ký với eventBus lúc nạp.
 * Thay 2 case 'settingsMisc.perfProbe.*' cũ (event/router/settings-misc.js — đã xoá) khi perf-probe rời service/.
 *
 * Nguồn message:
 *   - Màn Settings > Troubleshooting > Performance HUD — core/app-settings-ui.js::wireAppSettingsPerfHud() (Rule 5a).
 *   - Chạm trên chính HUD — core/perf-hud-ui.js::mountPerfHud() (Rule 5a).
 *   - Chạm bất kỳ trong app — event/listener/perf-hud.js (Block gate chặn khi HUD tắt, event/block.js).
 * Mọi case giao workflowPerfHud (cần config/taskManager/DOM của HUD) — (B) event-bus-flow.md mục 4.
 *
 * NẠP SAU: event/bus.js, event/workflow/perf-hud.js. NẠP TRƯỚC: event/listener/perf-hud.js.
 */
const routerPerfHud = (() => {
    function handle(msg) {
        switch (msg.type) {

            case 'perfHud.enabled.change': {
                workflowPerfHud.setEnabled(msg.payload.checked);
                break;
            }

            case 'perfHud.style.change': {
                workflowPerfHud.setStyle(msg.payload.style);
                break;
            }

            case 'perfHud.orientation.change': {
                workflowPerfHud.setOrientation(msg.payload.orientation);
                break;
            }

            // Chạm giữ để kéo (thay tay cầm kéo cũ).
            case 'perfHud.hud.pointerdown': {
                workflowPerfHud.onHudPointerDown(msg.payload);
                break;
            }

            case 'perfHud.hud.pointermove': {
                workflowPerfHud.onHudPointerMove(msg.payload);
                break;
            }

            case 'perfHud.hud.pointerup': { // cả pointercancel
                workflowPerfHud.onHudPointerUp(msg.payload);
                break;
            }

            // Nhật ký chạm ra Debug console.
            case 'perfHud.app.pointerdown': {
                workflowPerfHud.onAppPointerDown(msg.payload.target);
                break;
            }

            default:
                console.warn(`[router:perfHud] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`);
        }
    }

    return { handle };
})();

eventBus.register('perfHud', routerPerfHud);
