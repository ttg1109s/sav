/**
 * service/state/record/subtitle-editor.js — Đăng ký account cho subtitle-editor.html (đợt tái
 * cấu trúc state, 25/07/2026, lượt 2). Trang này TRƯỚC ĐÂY chưa từng nạp `service/state.js` — giờ
 * CÓ, đúng cùng cơ chế `appState`/schema/registry() như mọi trang khác của app (lượt 1 dùng
 * EventStore cho 20 field state của trang — SAI ranh giới, đã sửa lại).
 *
 * appState.registry(...) — 2 package:
 *   - 'subtitle-editor' (20 key, xem service/state/subtitle-editor.js).
 *   - 'app-misc' — CHỈ vì `dbReadyPromise` (service/db.js tự phát hiện `typeof appState !==
 *     'undefined'` để chuyển sang dùng appState thay biến module-scope riêng — cùng lý do
 *     video-editor.html cần package này, xem service/state/record/video-editor.js). Trang này
 *     KHÔNG dùng các field khác của 'app-misc' (isGridView, isShieldBusy...).
 *
 * PHẢI nạp SAU: service/state/subtitle-editor.js, service/state/app-misc.js.
 */
        const APP_ACCOUNT = 'subtitleEditor';
        appState.registry(APP_ACCOUNT, ['subtitle-editor', 'app-misc']);
