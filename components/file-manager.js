/**
 * components/file-manager.js — 2 drawer con của File Manager (Song/Photo), ver 12 "Multi Media".
 * CHỐT LẠI 03/07/2026 (xem plan-v12-multimedia-decisions.md mục 1a/7, đè lên quyết định ban đầu ở
 * patch 02/07/2026):
 *
 * KHÔNG còn 1 overlay "File Manager" cấp cao với tab-bar 4 mục nữa. File Manager giờ chỉ là 1
 * SECTION bình thường trong Settings (xem components/settings/file-manager-section.js —
 * TPL_SETTINGS_FILE_MANAGER, 2 hàng Song/Photo), mỗi hàng bấm vào PUSH THẲNG sang 1 trong 2 khu
 * vực định nghĩa ở file này.
 *
 * === Batch D5 (Settings restructure, 06/07/2026) — Song + Folder Detail ===
 * 2 hàm `renderFileManagerSongPanelBody()`/`renderFileManagerFolderDetailPanelBody()` THAY 2 biến
 * `TPL_FILE_MANAGER_SONG_DRAWER`/`TPL_FILE_MANAGER_FOLDER_DETAIL_DRAWER` cũ — PUSH ĐỘNG vào Settings
 * Stack (core/settings-panel-stack.js), Song ở cấp 1, Folder Detail ở cấp 2 (đè lên Song, ngăn xếp
 * hỗ trợ sẵn độ sâu tuỳ ý). Folder Detail KHÔNG còn header bar riêng (title động = tên folder) —
 * header dùng CHUNG chỉ nhận title CỐ ĐỊNH lúc push, tên folder THẬT giờ hiển thị bằng 1 heading
 * NGAY TRONG BODY panel (`#file-manager-folder-detail-title`, cập nhật qua setFolderDetailTitle()
 * sau khi đọc DB xong — xem event/workflow/file-manager-song.js::refreshFolderDetail()).
 *
 * `TPL_FILE_MANAGER_PHOTO_DRAWER` ĐÃ đổi ở Batch D6 (06/07/2026) — `renderFileManagerPhotoPanelBody()`,
 * push động `fullBleed: true` (lưới ảnh tràn viền, xem core/settings-panel-stack.js).
 * CẢ 2 khu vực (Song/Folder Detail/Photo) giờ ĐỀU là hàm push động — file này KHÔNG còn biến
 * `TPL_FILE_MANAGER_*` nào cả.
 *
 * components/storage-drawer.js + biến TPL_STORAGE_DRAWER KHÔNG còn được mount (xem main.js) —
 * file cũ ĐỂ LẠI trong project làm tư liệu đối chiếu, KHÔNG xoá tự động, bác xoá tay khi rảnh.
 *
 * XOÁ (29/07/2026, yêu cầu Giang mục 1/2) — `renderFileManagerSongPanelBody()` (panel "Song &
 * Video" — nút "Duyệt thư mục" + thống kê + giải phóng bộ nhớ + dọn file lỗi) ĐÃ XOÁ HẲN khỏi file
 * này. Xem components/file-manager-storage.js (panel MỚI "Quản lý lưu trữ", THAY nội dung thống
 * kê/giải phóng bộ nhớ/dọn file lỗi, giờ gồm ĐỦ 4 domain) + components/settings/file-manager-
 * section.js (hàng "Song & Video" giờ mở THẲNG Generic Drawer duyệt thư mục).
 */

// ===================== Khu vực: Song — ĐÃ XOÁ (29/07/2026, yêu cầu Giang mục 1) =====================
// renderFileManagerSongPanelBody() (panel "Song & Video" — nút "Duyệt thư mục" + thống kê dung
// lượng + giải phóng bộ nhớ + dọn file lỗi) ĐÃ XOÁ HẲN. Hàng "Song & Video" ở section chính
// (components/settings/file-manager-section.js) giờ mở THẲNG Generic Drawer duyệt thư mục
// (event/workflow/file-manager-folder-browser.js::openList()) — nút "Duyệt thư mục" (từng đứng bên
// trong panel này) không còn cần thiết, panel bị bỏ hoàn toàn thay vì chỉ rút gọn. Thống kê dung
// lượng/giải phóng bộ nhớ/dọn file lỗi dồn sang panel MỚI "Quản lý lưu trữ" (renderFileManager
// StorageManagementPanelBody(), components/file-manager-storage.js — giờ gồm ĐỦ 4 domain Song/
// Video/Photo/Document, không riêng Song/Video như panel cũ) — xem event/workflow/file-manager-
// storage.js (workflow MỚI, THAY event/workflow/file-manager-song.js đã xoá).

// ===================== Khu vực: Folder (Phase 2, MỚI — mục 1b/c) — ĐÃ THAY =====================
// SỬA (Batch 5, "Song/Video Unification" mục 6e) — renderFileManagerFolderDetailPanelBody() (panel
// cấp 2 kiểu Settings-panel-stack, đè lên panel Song) ĐÃ XOÁ HẲN — nội dung tương đương giờ dựng
// TRỰC TIẾP bên trong event/workflow/file-manager-folder-browser.js (Generic Drawer, trạng thái
// Read — _buildReadHeaderHtml()/_buildReadBodyHtml()), không còn ở file template này nữa.

// ===================== Khu vực: Photo (Batch 3, 03/07/2026 — code thật) =====================
// Batch D6 (Settings restructure, 06/07/2026): TPL_FILE_MANAGER_PHOTO_DRAWER (khung `fixed
// inset-0 drawer-glass z-[90]` + header riêng) THAY bằng hàm `renderFileManagerPhotoPanelBody()`,
// PUSH ĐỘNG với `fullBleed: true` (lưới ảnh tràn viền, không dùng khung "max-w-2xl" mặc định — xem
// event/workflow/file-manager-photo.js::openPanel()).
//
// SỬA (14/07/2026, mục cuối, Giang yêu cầu):
//   1. Nút upload dời NGƯỢC LẠI lên header dùng chung (`headerActionHtml`, core/settings-panel-
//      stack-ui.js — MỚI thêm) — thanh nhỏ riêng đã bỏ hẳn. `#btn-file-manager-image-delete-mode`
//      (icon thùng rác, chế độ xoá nhanh — mục 2.2) ĐI CÙNG headerActionHtml, cả 2 nút build ở
//      event/workflow/file-manager-photo.js::openPanel() (không hardcode ở đây — trạng thái hiện/ẩn
//      của thùng rác phụ thuộc `images.length`, chỉ Workflow biết lúc mở panel).
//
// XOÁ (loại bỏ Album khỏi Photo Panel) — toàn bộ khối Album (nút mở Album List sub-panel, chip lọc
// album) bỏ hẳn cùng tính năng — panel Photo giờ CHỈ còn lưới ảnh phẳng, không còn khái niệm
// nhóm/lọc theo album. Sẽ thay bằng Folder Photo trong File Browser ở đợt riêng (pending).
function renderFileManagerPhotoPanelBody() {
    return `
        <!-- Lưới ảnh — Item + window ảo (Patch mục 2, 14/07/2026, THAY masonry chunk-based cũ). Khung
             CUỘN chỉ còn #file-manager-image-empty tĩnh (vị trí hiển thị GIỮ NGUYÊN như bản cũ) —
             Workflow (event/workflow/file-manager-photo.js::setupPhotoGridWindow()) tự dựng cấu trúc
             "sizer + window" (id="file-manager-image-masonry" GIỮ NGUYÊN trên phần tử grid thật bên
             trong, để listener click delegated không cần đổi selector) NGAY LÚC panel mở, chèn TRƯỚC
             #file-manager-image-empty — KHÔNG hardcode div masonry ở template tĩnh này nữa.
             SỬA (15/07/2026, Giang chỉ ra "layout chưa giống Google Photos") — BỎ px-3 py-3 (viền
             ngoài 12px) — Google Photos lưới ảnh SÁT MÉP MÀN HÌNH THẬT SỰ, không có viền ngoài nào
             (chỉ có khe hở 2px GIỮA các ô, xem .photo-grid ở assets/css/style.css). Text rỗng
             (#file-manager-image-empty) tự thêm px-6 RIÊNG (không dựa vào padding container nữa)
             để không dính sát mép khi không có ảnh nào. -->
        <div id="file-manager-image-scroll" class="flex-grow min-h-0 overflow-y-auto pb-20 relative">
            <p id="file-manager-image-empty" class="hidden text-sm text-slate-400 text-center py-10 px-6" data-i18n="fileManager.photo.image.empty">${t('fileManager.photo.image.empty')}</p>
        </div>
`;
}

// XOÁ (loại bỏ Album khỏi Photo Panel) — renderFileManagerAlbumListPanelBody() (Album List
// sub-panel) bỏ hẳn cùng tính năng — panel đó không còn tồn tại.

// ===================== Khu vực: Documents (04/07/2026 — code thật, thay placeholder) ========
// 2 nút upload TÁCH RIÊNG (không dùng chung 1 cơ chế "tự phân loại", đúng yêu cầu Giang — "mỗi cái
// một upload riêng cho dễ"): "Tải lên tài liệu" (chọn .txt/.docx có sẵn) và "Tạo tài liệu mới"
// ===================== Khu vực: Document — ĐÃ XOÁ (loại bỏ toàn bộ tính năng Document Reader khỏi
// app, theo yêu cầu Giang) — renderFileManagerDocumentPanelBody() cùng toàn bộ hạ tầng liên quan
// (core/file-manager/document*.js, event/*/document-reader.js, event/*/file-manager-document.js)
// XOÁ HẲN. ==========================================================================

// ===================== Khu vực: Video — ĐÃ XOÁ (ver12 "Song/Video Unification", Batch 6, mục 6d,
// phản hồi Giang) =====================================================
// renderFileManagerVideoPanelBody() (panel riêng "File Manager → Video") ĐÃ XOÁ HẲN — gộp vào
// "Song & Video" (renderFileManagerSongPanelBody() ở đầu file, Batch 5). Nghiệp vụ Video (upload/
// set nền/mở Video Editor/xoá) giờ vào từ Playlist (Batch 6, mục 7 + menu 3 chấm) — xem
// readme/changelog/v12.md.

