/**
 * core/song-search.js — Core THUẦN (Rule 1-4 core-function-conventions.md), MỚI (23/07/2026,
 * refactor phản hồi Giang — module Video Editor cần tái dùng tìm kiếm bài hát của Playlist UI,
 * nhưng KHÔNG thể nạp `appState` — xem hội thoại đã chốt).
 *
 * TÁCH `normalizeSongName()` ra khỏi `core/playlist/state.js` (chuyển hẳn, không còn bản nào ở đó
 * nữa) + rút `songMatchesQuery()` từ logic so khớp cũ của `matchesSearch()`
 * (`core/playlist/order.js`, ĐÃ XOÁ hàm đó — xem `recomputeRenderOrder()` mới, giờ tự
 * `appState.get()` rồi gọi thẳng `songMatchesQuery()` ở đây, đúng vai Workflow gọi Core).
 *
 * Dùng ở CẢ 2 nơi:
 *   - `core/playlist/order.js::recomputeRenderOrder()` — Workflow (tự đọc/ghi `appState` trực
 *     tiếp), gọi hàm ở đây làm Core thuần.
 *   - `event/workflow/video-editor.js` (panel "Nhạc") — tự lấy `tag.title/artist/album` qua
 *     `getSongRecord()` (KHÔNG qua `playlistCache`/`appState`), gọi CHUNG 2 hàm này.
 *
 * NẠP TRƯỚC `core/playlist/state.js`/`order.js` ở `index.html`, và TRƯỚC
 * `event/workflow/video-editor.js` ở `video-editor.html`.
 *
 * Rule 2 — không đọc `appState`, chỉ nhận tham số. Rule 3 — không gọi core nào khác của project.
 */

/** Chuẩn hoá tên bài để sort A-Z/Z-A & tìm kiếm ổn định: bỏ dấu tiếng Việt, hạ thường, trim. */
function normalizeSongName(name) {
    return (name || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * So khớp 1 bài hát với query đã CHUẨN HOÁ SẴN (title/artist/album đưa vào ở dạng THÔ, hàm này tự
 * `normalizeSongName()` từng field trước khi so — nơi gọi KHÔNG cần tự chuẩn hoá 3 field đó).
 * @param {string} normalizedQuery - query NGƯỜI DÙNG đã qua `normalizeSongName()` từ trước (nơi gọi
 *   tự làm 1 lần, không lặp lại mỗi bài — xem `applySearchQuery()` ở `core/playlist/render.js`).
 * @param {string} title @param {string} artist @param {string} album
 * @returns {boolean}
 */
function songMatchesQuery(normalizedQuery, title, artist, album) {
    if (!normalizedQuery) return true; // guard — không có query -> khớp mọi bài
    return normalizeSongName(title).includes(normalizedQuery)
        || normalizeSongName(artist).includes(normalizedQuery)
        || normalizeSongName(album).includes(normalizedQuery);
}
