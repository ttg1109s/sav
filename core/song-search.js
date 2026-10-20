/**
 * core/song-search.js — `normalizeSongName()`: chuẩn hoá tên để sort/tìm kiếm (bỏ dấu, hạ thường, trim). Dùng ở
 * event/workflow/playlist-scope.js (dựng `songNameIndex`), event/workflow/playlist.js (sửa tên / thêm bài) và
 * event/workflow/playlist-order.js (lọc tìm kiếm).
 */

/** Chuẩn hoá tên bài để sort A-Z/Z-A & tìm kiếm ổn định: bỏ dấu tiếng Việt, hạ thường, trim. */
function normalizeSongName(name) {
    return (name || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
