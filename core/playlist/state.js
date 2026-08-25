/**
 * playlist/state.js — TRẠNG THÁI dùng chung cho toàn bộ module Playlist (state.js, order.js,
 * render.js, loader.js, actions.js, main.js).
 *
 * KIẾN TRÚC v6 — TÁCH RÕ 2 KHÁI NIỆM TỪNG BỊ TRỘN LẪN:
 *
 *   (A) DANH SÁCH HIỂN THỊ (UI)  → `renderOrder`
 *       Là thứ người dùng NHÌN THẤY trong màn Playlist. Về mặt ý nghĩa người dùng, nó chỉ là
 *       "danh sách bài hát đang có", LUÔN được sắp theo `displaySortMode` (+ lọc theo ô tìm
 *       kiếm) và LUÔN cập nhật NGAY khi thêm/xoá/sửa bài — KHÔNG phụ thuộc đang phát bài nào,
 *       KHÔNG phụ thuộc thuật toán hàng đợi phát.
 *
 *   (B) HÀNG ĐỢI PHÁT (logic) → `displayOrder`
 *       Là thứ tự Next/Prev sẽ đi qua khi KHÔNG trộn bài. Đây thuần tuý là logic phát: thêm bài
 *       lúc đang nghe thì nối vào CUỐI hàng đợi (pending) để không làm gãy mạch đang nghe, chỉ
 *       resort thật khi "chạm biên" (xem player-controls.js + order.js). Việc nối-vào-cuối này
 *       KHÔNG liên quan gì tới DOM/UI ở (A).
 *
 *   Trước v6, cả render lẫn Next/Prev đều dùng chung `displayOrder` nên UI bị phụ thuộc vào
 *   thuật toán hàng đợi (thêm bài lúc đang phát thì DOM không sắp xếp lại ngay). v6 tách hẳn:
 *   render đọc `renderOrder`, Next/Prev đọc `displayOrder`. Hai cái cùng sinh ra từ
 *   `playlistOrder` nhưng theo 2 quy tắc khác nhau, không buộc phải giống nhau từng bước.
 *
 * Các tên biến/hàm GLOBAL bên dưới được nhiều file khác (player-controls.js, storage-manager.js,
 * state-and-video-bg.js, component playlist-view) tham chiếu trực tiếp — GIỮ NGUYÊN TÊN khi tách
 * file để không phải sửa lan ra ngoài module.
 */

        // playlistOrder, displayOrder, renderOrder, playlistCache, songNameIndex,
        // confirmedBrokenKeys, currentKey, displaySortMode, pendingResortKeys, searchQuery,
        // domNodesByKey — STATE, xem service/state.js.

        // SỬA (Giang báo — "duration của photo vẫn hiển thị m:s dù time picker hỗ trợ hms") —
        // TRƯỚC ĐÂY luôn 2 cột (phút:giây), KHÔNG BAO GIỜ lên giờ dù giá trị vượt 60 phút (vd 75
        // phút -> "75:30" thay vì "1:15:30") — giờ Photo tính duration KHÔNG kẹp trần (event/
        // workflow/file-manager-photo.js::computePhotoDuration()) nên thực tế có thể vượt mốc này.
        // Thêm cột giờ CHỈ khi cần (>= 3600s) — dùng CHUNG cho Song/Video/Photo (hàm này không tách
        // theo mediaType), giá trị < 1 giờ hiển thị Y HỆT như trước (không đổi hành vi cũ).
        function formatTime(seconds) {
            if (isNaN(seconds)) return "0:00";
            const total = Math.floor(seconds);
            const hr = Math.floor(total / 3600);
            const min = Math.floor((total % 3600) / 60);
            const sec = total % 60;
            if (hr > 0) return `${hr}:${min < 10 ? '0' : ''}${min}:${sec < 10 ? '0' : ''}${sec}`;
            return `${min}:${sec < 10 ? '0' : ''}${sec}`;
        }

        // normalizeSongName() ĐÃ CHUYỂN sang core/song-search.js (23/07/2026, refactor phản hồi
        // Giang — Video Editor cần tái dùng nhưng không nạp appState) — dùng chung Playlist + Video
        // Editor, không còn bản riêng ở đây. Nạp core/song-search.js TRƯỚC file này trong index.html.
