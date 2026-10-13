/**
 * core/song-search.js — `normalizeSongName()`: chuẩn hoá tên để sort/tìm kiếm (bỏ dấu, hạ thường, trim). Dùng ở
 * event/workflow/playlist.js (dựng `songNameIndex`) và event/workflow/playlist-order.js (lọc tìm kiếm).
 */

/** Chuẩn hoá tên bài để sort A-Z/Z-A & tìm kiếm ổn định: bỏ dấu tiếng Việt, hạ thường, trim. */
function normalizeSongName(name) {
    return (name || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
