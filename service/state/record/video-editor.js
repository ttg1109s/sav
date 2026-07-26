/**
 * service/state/record/video-editor.js — Đăng ký account cho video-editor.html (đợt tái cấu
 * trúc state, 25/07/2026, lượt 2). Thay cho đoạn `<script>` inline trước đây nằm ngay trong
 * video-editor.html.
 *
 * appState.registry(...) — 3 package: 'generic-drawer' (isGenericDrawerOpen), 'app-misc'
 * (dbReadyPromise), 'video-editor' (34 key — 2 key cross-cutting cũ + 32 field state riêng của
 * trang, MỞ RỘNG lượt 2 — xem service/state/video-editor.js).
 *
 * KHÔNG còn EventStore ở trang này (lượt 1 dùng nhầm — EventStore chỉ dành cho "state context"
 * nhỏ giữa 2 message, không phải state nghiệp vụ toàn trang, xem docstring event/store.js) — toàn
 * bộ state của trang giờ qua đúng 1 cơ chế `appState` như mọi trang khác.
 *
 * PHẢI nạp SAU: service/state/generic-drawer.js, service/state/app-misc.js,
 * service/state/video-editor.js.
 */
        const APP_ACCOUNT = 'videoEditor';
        appState.registry(APP_ACCOUNT, ['generic-drawer', 'app-misc', 'video-editor']);
