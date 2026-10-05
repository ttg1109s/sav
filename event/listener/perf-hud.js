/**
 * event/listener/perf-hud.js — MỚI (05/10/2026) — Listener của cụm "perfHud" (Performance HUD).
 *
 * Mọi cú chạm trong app (pha capture trên document, passive — chỉ ghi nhận, không can thiệp) -> 'perfHud.app.pointerdown'
 * để Workflow ghi nhật ký chạm ra Debug console. Đăng ký 1 lần lúc nạp (thay cho việc service/perf-probe.js cũ tự
 * add/remove lúc bật/tắt); khi HUD tắt, Block gate (event/block.js, `perfHudConfig.enabled === false`) chặn message trước
 * Router — im lặng, không chạy gì.
 * Chạm trên CHÍNH HUD (kéo thả) wire riêng ở core/perf-hud-ui.js::mountPerfHud() (DOM động, Rule 5a).
 *
 * NẠP SAU: event/bus.js, event/block.js, event/router/perf-hud.js.
 */
document.addEventListener('pointerdown', (e) => {
    eventBus.send({ router: 'perfHud', type: 'perfHud.app.pointerdown', payload: { target: e.target } });
}, { capture: true, passive: true });
