/**
 * service/state/file-manager.js — Package STATE domain "file-manager" (v12 "Multi Media").
 * KHÔNG chứa slideshowConfig/readerConfig — 2 field đó là CONFIG (đợt tái cấu trúc 25/07/2026
 * dời hẳn sang AppConfig, xem service/state.js + core/config.js: `appConfigSlideshow`/
 * `appConfigReader`), không còn là STATE_SCHEMA key ở đây nữa.
 * Xem cơ chế package ở service/state.js. PHẢI nạp SAU service/state.js.
 */
        AppState.definePackage('file-manager', {
            schema: {
                activePlayListFolder: 'nullable-string', // null/undefined = tất cả bài; có giá trị = đang scoping theo folderId
                selectionMode: 'boolean',                // chế độ chọn nhiều (checkbox) trong Playlist
                selectedSongKeys: 'set',                 // tập songKey đang được chọn khi selectionMode = true
                // true = displayOrder hiện đang là 1 "section" (tập con vừa chọn-rồi-phát qua
                // playSelectedSongs(), event/workflow/playlist.js), KHÁC hẳn displayOrder
                // top-level. Tự về false khi recomputeDisplayOrder() chạy.
                sectionQueueActive: 'boolean',
                activeBackgroundAlbum: 'nullable-string', // albumId đang dùng làm nền slideshow, null = không dùng
                pageCurrentFolderDetailSongList: 'number',   // trang ĐANG xem của danh sách item BÊN TRONG 1 folder (Folder Browser Read, event/workflow/file-manager-folder-browser.js)
                pageCurrentDocumentList: 'number',           // trang ĐANG xem của danh sách tài liệu Documents
                // XOÁ (29/07/2026, yêu cầu Giang) — storageAnySourceEnabled (từng phục vụ Block gate
                // chặn "Quét file lỗi khi chưa chọn nguồn nào") ĐÃ BỎ — nhánh quét giờ tự hỏi phạm
                // vi qua modalChoice()+dropdown riêng (event/workflow/file-manager-storage.js::
                // askScanBrokenScope()), không còn tình huống "rỗng" cần chặn nữa.
            },
            buildDefaults() {
                return {
                    activePlayListFolder: null,
                    selectionMode: false,
                    selectedSongKeys: new Set(),
                    sectionQueueActive: false,
                    activeBackgroundAlbum: null,
                    pageCurrentFolderDetailSongList: 0,
                    pageCurrentDocumentList: 0,
                };
            },
        });
