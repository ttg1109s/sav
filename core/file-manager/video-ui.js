/**
 * core/file-manager/video-ui.js — MỚI (21/07/2026), File Manager -> Video.
 *
 * XOÁ (ver12 "Song/Video Unification", Batch 5, mục 6c, 27/07/2026) — `openVideoPreviewModal()`
 * (modal xem video full-screen cũ, ĐÃ CHẾT từ 21/07/2026 — bị thay bằng dropdown
 * `openVideoTileActionMenu()`) XOÁ HẲN, thay bằng `openVideoInfoModal()` (tab "Chi tiết" riêng).
 *
 * XOÁ TIẾP (phản hồi Giang 28/07/2026) — `openVideoInfoModal()` CŨNG xoá hẳn, KHÔNG viết lại: phát
 * hiện modal Details/Edit/Cover CÓ SẴN của Playlist (`core/playlist/actions.js::
 * openSongEditModal()`) đã tự mở được cho CẢ Video (Batch 1, Adapter khiến playlistCache của Video
 * dùng chung shape với Song) — chỉ là CHƯA video-aware. Sửa thẳng hàm đó video-aware (tab "Chi
 * tiết" đổi thành thông số kỹ thuật, tab "Sửa" chỉ còn 1 ô customName, tab "Ảnh bìa" ẩn hẳn) THAY
 * VÌ giữ 2 hệ thống "Chi tiết" song song (1 ở Playlist, 1 ở File Manager) — tránh lệch dữ liệu
 * (Play Count/Listened chỉ hoạt động đúng ở modal của Playlist). Lựa chọn "Chi tiết" trong dropdown
 * tile File Manager → Video (`openVideoTileActionMenu()`, event/workflow/file-manager-video.js)
 * cũng đã bỏ theo — panel File Manager → Video này SẼ BỊ XOÁ HẲN ở 6d (chờ Batch 6 "Upload theo
 * Nguồn tại Playlist"), không đáng xây/giữ 1 đường dùng tạm.
 *
 * File này hiện KHÔNG có hàm nào — giữ lại (rỗng) để không phải sửa index.html nếu sau này thật sự
 * cần 1 hàm dựng UI riêng cho Video. Xoá tay nếu Giang muốn dọn hẳn.
 */
