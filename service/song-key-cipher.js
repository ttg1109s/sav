/**
 * service/song-key-cipher.js — Mã hoá/giải mã `songKey` để nhét vào `?song=` khi mở
 * `subtitle-editor.html`. TÁCH RIÊNG (10/07/2026, phản hồi Giang) khỏi `service/db.js` — file đó
 * CHỈ nên thuần truy cập IndexedDB, cipher không phải I/O nên không thuộc về đó.
 *
 * "Mã hoá" ở đây thực chất là NGUỴ TRANG, KHÔNG phải bảo mật thật — app không có server giữ khoá bí
 * mật, ai đọc được JS đều đọc được `SONG_KEY_CIPHER_SALT`. Mục đích DUY NHẤT: tránh lộ trần tên
 * file gốc trên URL. XOR từng ký tự với salt (lặp vòng) rồi base64url (URL-safe, không cần
 * `encodeURIComponent` thêm lần nữa).
 *
 * ĐỔI `SONG_KEY_CIPHER_SALT` SẼ LÀM HỎNG MỌI LINK CŨ ĐÃ TẠO TRƯỚC ĐÓ — chỉ đổi nếu chắc chắn cần,
 * không có link nào đang lưu/chia sẻ dở.
 *
 * Dùng ở CẢ 2 trang: `index.html` (mã hoá lúc tạo link — nút "Sub" Control Center + menu 3 chấm
 * mỗi bài hát) LẪN `subtitle-editor.html` (giải mã lúc đọc `?song=`) — KHÔNG phụ thuộc gì (tự
 * chứa), an toàn nạp ở bất kỳ đâu, không cần theo sau `service/db.js`.
 */
const SONG_KEY_CIPHER_SALT = 'sav12-subtitle-editor';

function _xorWithSalt(str) {
    let out = '';
    for (let i = 0; i < str.length; i++) {
        out += String.fromCharCode(str.charCodeAt(i) ^ SONG_KEY_CIPHER_SALT.charCodeAt(i % SONG_KEY_CIPHER_SALT.length));
    }
    return out;
}

/** @param {string} songKey @returns {string} chuỗi URL-safe, dùng làm giá trị `?song=`. */
function encodeSongKeyForUrl(songKey) {
    const xored = _xorWithSalt(songKey);
    const base64 = btoa(unescape(encodeURIComponent(xored))); // hỗ trợ songKey ngoài phạm vi Latin1 (hiếm, nhưng an toàn)
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); // base64 -> base64url
}

/** @param {string} encoded - giá trị đọc từ `?song=`. @returns {string|null} songKey gốc, `null` nếu chuỗi hỏng. */
function decodeSongKeyFromUrl(encoded) {
    try {
        let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) base64 += '=';
        const xored = decodeURIComponent(escape(atob(base64)));
        return _xorWithSalt(xored); // XOR tự đối xứng — áp lại lần 2 trả về nguyên bản gốc
    } catch (e) {
        return null;
    }
}
