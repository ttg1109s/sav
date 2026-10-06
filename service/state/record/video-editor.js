/**
 * service/state/record/video-editor.js — Đăng ký account cho video-editor.html (MỚI 06/10/2026, trình sửa video tách
 * thành trang riêng). Cùng cơ chế service/state/record/subtitle-editor.js.
 *
 * appState.registry(...) — 2 package:
 *   - 'video-preview' — state của editor (service/state/video-preview.js; trước đây đăng ký trong account 'player' của
 *     index.html, giờ chỉ trang này nạp).
 *   - 'app-misc' — CHỈ vì `isShieldBusy` (core/loading-shield-util.js) + `dbReadyPromise` (service/db.js).
 *
 * PHẢI nạp SAU: service/state/video-preview.js, service/state/app-misc.js.
 */
        const APP_ACCOUNT = 'videoEditor';
        appState.registry(APP_ACCOUNT, ['video-preview', 'app-misc']);
