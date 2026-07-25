/**
 * service/state/record/video-editor.js — Đăng ký account + EventStore cho video-editor.html
 * (đợt tái cấu trúc state, 25/07/2026). Thay cho đoạn `<script>` inline trước đây nằm ngay trong
 * video-editor.html.
 *
 * appState.registry(...) — CHỈ 3 package (thay vì "nạp trọn service/state.js rồi giới hạn quyền"
 * như bản cũ): 'generic-drawer' (isGenericDrawerOpen), 'app-misc' (dbReadyPromise),
 * 'video-editor' (videoEditAudioTrackFull/videoEditTextTrackFull) — ĐÚNG 4 key cũ, không thêm/bớt.
 *
 * `new EventStore('videoEditor')` — CHUẨN BỊ SẴN cho đợt SAU (chưa thuộc batch này): toàn bộ
 * ~30 field `_xxx` hiện đang nhúng thẳng làm property của `workflowVideoEditor` (event/workflow/
 * video-editor.js) sẽ dời qua đây (`videoEditorStore.get/set(...)` thay `this._xxx`) — TẠO instance
 * ngay bây giờ để sẵn sàng, nhưng CHƯA đổi gì bên trong event/workflow/video-editor.js ở batch này.
 *
 * PHẢI nạp SAU: service/state/generic-drawer.js, service/state/app-misc.js,
 * service/state/video-editor.js, event/store.js.
 */
        const APP_ACCOUNT = 'videoEditor';
        appState.registry(APP_ACCOUNT, ['generic-drawer', 'app-misc', 'video-editor']);

        const videoEditorStore = new EventStore('videoEditor');
