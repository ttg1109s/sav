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
                folderDetailSongCount: 'number', // số bài đang hiển thị trong Folder Detail Drawer — dùng bởi Block gate (event/block.js)
                selectionMode: 'boolean',                // chế độ chọn nhiều (checkbox) trong Playlist
                selectedSongKeys: 'set',                 // tập songKey đang được chọn khi selectionMode = true
                // true = displayOrder hiện đang là 1 "section" (tập con vừa chọn-rồi-phát qua
                // playSelectedSongs(), event/workflow/playlist.js), KHÁC hẳn displayOrder
                // top-level. Tự về false khi recomputeDisplayOrder() chạy.
                sectionQueueActive: 'boolean',
                activeBackgroundAlbum: 'nullable-string', // albumId đang dùng làm nền slideshow, null = không dùng
                pageCurrentFolderSongList: 'number',         // trang ĐANG xem của danh sách folder -> Song
                pageCurrentFolderDetailSongList: 'number',   // trang ĐANG xem của danh sách bài BÊN TRONG 1 folder
                pageCurrentDocumentList: 'number',           // trang ĐANG xem của danh sách tài liệu Documents
                // folderId của folder VỪA bị đổi (xoá bài/remove-all/apply/unapply) trong lúc đang
                // xem Folder Detail — null = không có gì cần vá.
                staleFolderListRowId: 'nullable-string',
            },
            buildDefaults() {
                return {
                    activePlayListFolder: null,
                    folderDetailSongCount: 0,
                    selectionMode: false,
                    selectedSongKeys: new Set(),
                    sectionQueueActive: false,
                    activeBackgroundAlbum: null,
                    pageCurrentFolderSongList: 0,
                    pageCurrentFolderDetailSongList: 0,
                    pageCurrentDocumentList: 0,
                    staleFolderListRowId: null,
                };
            },
        });
