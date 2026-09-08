/**
 * service/state/file-manager.js — Package STATE domain "file-manager" (v12 "Multi Media").
 * KHÔNG chứa slideshowConfig/readerConfig — 2 field đó là CONFIG (đợt tái cấu trúc 25/07/2026
 * dời hẳn sang AppConfig, xem service/state.js + core/config.js: `appConfigSlideshow`/
 * `appConfigReader`), không còn là STATE_SCHEMA key ở đây nữa.
 * Xem cơ chế package ở service/state.js. PHẢI nạp SAU service/state.js.
 */
        AppState.definePackage('file-manager', {
            schema: {
                // SỬA (06/09/2026, Giang chốt "mỗi Nguồn tự nhớ folder đang áp dụng riêng") — đổi
                // từ 1 giá trị phẳng (chỉ 1 folder áp dụng được tại 1 thời điểm, mất dấu khi đổi
                // Nguồn) sang object theo TỪNG Nguồn — mỗi field null/undefined = Nguồn đó đang
                // "Tất cả bài"; có giá trị = đang scoping theo đúng folderId (CÙNG type) của Nguồn
                // đó. Đổi source không còn xoá mất lựa chọn Scope của Nguồn kia. Dữ liệu cũ (lưu
                // dạng string phẳng qua meta) tự migrate 1 lần lúc boot, xem
                // core/file-manager/folder.js::migrateActivePlayListFolderIfNeeded().
                activePlayListFolder: 'object', // {song: string|null, video: string|null, photo: string|null}
                // MỚI (06/09/2026, hợp nhất Folder vào Playlist, mục 4b — "Read-only" folder, dùng
                // Block gate chặn upload) — LUÔN phản ánh field `isReadOnly` của folder đang active
                // TẠI ĐÚNG `activeMediaSource` hiện tại (không phải object theo Nguồn như
                // `activePlayListFolder` — Block gate (event/block.js) chỉ đọc được field TĨNH, 1
                // giá trị phẳng là đủ vì tại 1 thời điểm chỉ có 1 Nguồn đang hiển thị/có thể upload).
                // Cập nhật ở event/workflow/playlist-scope.js::applyFolderScope()/applyAllSongsScope()
                // (chạy đúng lúc `activeMediaSource` thay đổi hoặc Scope đổi) VÀ ngay khi checkbox
                // "Read-only" ở Properties bị đổi trong lúc CHÍNH folder đó đang active (xem
                // event/workflow/file-manager-folder-browser.js::showFolderProperties()).
                isActiveFolderReadOnly: 'boolean',
                selectionMode: 'boolean',                // chế độ chọn nhiều (checkbox) trong Playlist
                // SỬA (07/09/2026, Giang chỉ ra "đằng nào cũng sửa, đổi tên đỡ nhầm" — cùng đợt đổi
                // deleteSongFromActionMenu/deleteSelectedSongs) — tên cũ `selectedSongKeys` gợi ý
                // CHỈ Song trong khi Selection Mode chọn được cả Video/Photo từ Batch 6.
                selectedMediaKeys: 'set',                // tập key đang được chọn khi selectionMode = true
                // true = displayOrder hiện đang là 1 "section" (tập con vừa chọn-rồi-phát qua
                // playSelectedSongs(), event/workflow/playlist.js), KHÁC hẳn displayOrder
                // top-level. Tự về false khi recomputeDisplayOrder() chạy.
                sectionQueueActive: 'boolean',
                // (activeBackgroundAlbum XOÁ — v13 Batch B: "album nào đang làm nền" giờ nằm
                //  trong `visualBgConfig.source` (v14: originId/list), KHÔNG còn bản sao trong AppState.)
                // XOÁ (06/09/2026, Giang chốt mục 3.6 — "bỏ hẳn màn Read") — pageCurrentFolderDetailSongList
                // (trang đang xem BÊN TRONG 1 folder, Folder Browser Read) mồ côi hoàn toàn cùng màn
                // hình đó — không còn phân trang gì cả, nội dung folder xem thẳng qua Playlist chính.
                // XOÁ (loại bỏ Document Reader khỏi app) — pageCurrentDocumentList (trang danh sách
                // tài liệu Documents) bỏ hẳn cùng tính năng.
                // XOÁ (chỉ 1 mặt canvas dùng chung xem/zoom/pan/edit modal xem ảnh, bỏ dropdown
                // "...") — imagePreviewMode ('view'/'zoom'/'edit') bỏ hẳn: không còn khái niệm
                // "mode" nào cả — Zoom (Panzoom) LUÔN bật sẵn suốt vòng đời modal, icon bút chì trên
                // header chỉ mở bảng công cụ (không "vào" gì), công cụ vẽ/chỉnh THẲNG lên canvas
                // đang xem. Xem event/workflow/file-manager-photo.js + event/workflow/image-edit.js.
                // XOÁ (29/07/2026, yêu cầu Giang) — storageAnySourceEnabled (từng phục vụ Block gate
                // chặn "Quét file lỗi khi chưa chọn nguồn nào") ĐÃ BỎ — nhánh quét giờ tự hỏi phạm
                // vi qua modalChoice()+dropdown riêng (event/workflow/file-manager-storage.js::
                // askScanBrokenScope()), không còn tình huống "rỗng" cần chặn nữa.
            },
            buildDefaults() {
                return {
                    activePlayListFolder: { song: null, video: null, photo: null },
                    isActiveFolderReadOnly: false,
                    selectionMode: false,
                    selectedMediaKeys: new Set(),
                    sectionQueueActive: false,
                };
            },
        });
