/**
 * event/listener/file-manager-video.js — MỚI (21/07/2026).
 *
 * XOÁ (ver12 "Song/Video Unification", Batch 6, mục 6d, phản hồi Giang) — TOÀN BỘ listener của
 * panel "File Manager → Video" (nút mở panel `btnOpenFileManagerVideo`, delegate click lưới video,
 * delegate change input upload) ĐÃ XOÁ cùng lúc xoá panel đó — không còn phần tử DOM nào để wire.
 * Router "fileManagerVideo" (event/router/file-manager-video.js) giờ CHỈ còn 2 case của picker
 * Generic Drawer "Use background video" — picker đó tự wire TRỰC TIẾP trong Workflow
 * (event/workflow/file-manager-video.js::openVideoBgPicker(), gắn thẳng lên genericDrawerHeader/
 * Body lúc mở, KHÔNG qua delegate `settingsStackBody` — Generic Drawer là ANH EM của #app-stack,
 * không nằm trong đó) nên KHÔNG cần file listener riêng nào nữa.
 *
 * File này hiện KHÔNG có gì để wire — giữ lại (rỗng) để không phải sửa index.html nếu sau này
 * panel "File Manager → Video" (hoặc tương đương) cần listener riêng trở lại. Xoá tay nếu Giang
 * muốn dọn hẳn.
 */
