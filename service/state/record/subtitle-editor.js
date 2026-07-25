/**
 * service/state/record/subtitle-editor.js — EventStore cho subtitle-editor.html (đợt tái cấu
 * trúc state, 25/07/2026). Trang này KHÔNG dùng AppState (chưa từng nạp service/state.js) —
 * KHÔNG có dòng appState.registry() nào ở đây, chỉ EventStore.
 *
 * `new EventStore('subtitleEditor')` — CHUẨN BỊ SẴN cho đợt SAU (chưa thuộc batch này): toàn bộ
 * ~25 field `_xxx` hiện đang nhúng thẳng làm property của `workflowSubtitleEditor` (event/workflow/
 * subtitle-editor.js) sẽ dời qua đây, TẠO instance ngay bây giờ để sẵn sàng, nhưng CHƯA đổi gì bên
 * trong event/workflow/subtitle-editor.js ở batch này.
 *
 * PHẢI nạp SAU: event/store.js.
 */
        const subtitleEditorStore = new EventStore('subtitleEditor');
