/**
 * patch-playlist.js — patch default-language keys (tiếng Anh), phần playlistView + bottomPlayer.
 *
 * Đây KHÔNG phải file JSON: project chạy qua file://, không thể fetch() file tĩnh, nên các
 * "patch" default-language được viết thành .js gán vào 1 biến global, để core/../lang.js (nay đã
 * dời sang /lang/lang.js) gom lại bằng Object.assign(). File này CHỈ chứa dữ liệu (key -> chuỗi
 * tiếng Anh), không chứa logic.
 *
 * Nạp TRƯỚC /lang/lang.js (xem index.html, khối nạp /lang/patch/*.js đứng trước /lang/lang.js).
 */
const LANG_PATCH_PLAYLIST = {
    'playlistView.logo.title': 'Simple Audio Visualizer',
    'playlistView.btnReturnVisual.title': 'Now playing (return)',
    'playlistView.btnUploadAudio.title': 'Add music',
    'playlistView.btnSettings.title': 'Settings',
    'playlistView.search.placeholder': 'Search songs, artists, albums...',
    // MỚI (phản hồi Giang, mục "ngôn ngữ theo ngữ cảnh Song/Video") — placeholder RIÊNG cho Video
    // (không có artist/album để tìm) — đổi qua JS khi Nguồn đổi, xem switchToVideoSource()/
    // switchToSongSource() (event/workflow/playlist.js).
    'playlistView.search.placeholderVideo': 'Search videos...',
    'playlistView.search.clear.title': 'Clear search',
    'playlistView.btnPlay': 'Play',
    'playlistView.btnShuffleAll': 'Shuffle',
    'playlistView.empty.noSongs': 'No songs yet. Add some music to get started.',
    'playlistView.empty.noSearchResults': 'No matching songs found.',
    // MỚI (phản hồi Giang, mục "ngôn ngữ theo ngữ cảnh Song/Video") — Playlist rỗng khi đang browse
    // Nguồn Video trước đây vẫn hiện "No songs yet" — đổi qua JS theo `activeMediaSource`, xem
    // updateEmptyState() (core/playlist/render.js).
    'playlistView.empty.noVideos': 'No videos yet. Add some videos to get started.',
    'playlistView.empty.noSearchResultsVideo': 'No matching videos found.',
    'playlistView.loading.generic': 'Loading data...',
    'playlistView.loading.withCount': 'Loading {done} / {total} songs...',
    'playlistView.songEdit.title': 'Details',
    // SỬA (10/07/2026, gộp #song-info-modal cũ vào tab đầu): 'tabInfo' cũ ĐỔI TÊN 'tabFields'
    // (tab title/artist/album SỬA được) — 'tabDetails' MỚI là tab đầu/mặc định, đọc-thôi.
    'playlistView.songEdit.tabDetails': 'Details',
    'playlistView.songEdit.tabFields': 'Edit',
    'playlistView.songEdit.tabCover': 'Cover',
    'playlistView.songEdit.fieldTitle': 'Title',
    'playlistView.songEdit.fieldArtist': 'Artist',
    'playlistView.songEdit.fieldAlbum': 'Album',
    // MỚI (ver12 "Song/Video Unification", phản hồi Giang 28/07/2026) — nhóm field Video (tab
    // "Sửa"), THAY 3 field Song ở trên khi cached.mediaType === 'video'.
    'playlistView.songEdit.fieldCustomName': 'Display name',
    'playlistView.songEdit.coverAlt': 'Cover art',
    // VIẾT LẠI (04/07/2026, mục 3 phản hồi Giang) — bỏ hẳn nút Upload riêng (key 'coverChoose' cũ
    // đã xoá) — chỉ còn 1 nút DUY NHẤT, đổi tên "Choose photo".
    'playlistView.songEdit.coverPickLibrary': 'Choose photo',
    'playlistView.songEdit.coverRemove': 'Remove cover',
    'playlistView.songEdit.coverHint': 'Accepts PNG, JPG or WEBP. The image is stored with the song in IndexedDB and written to the APIC tag on export.',
    'playlistView.songEdit.btnCancel': 'Cancel',
    'playlistView.songEdit.btnSave': 'Save',
    // SỬA (10/07/2026): 'songInfo.title'/'btnExport'/'btnClose' ĐÃ XOÁ — #song-info-modal không
    // còn là modal riêng (gộp vào tab "Details" ở trên, dùng chung nút Cancel/Save của
    // song-edit-modal). Các field bên dưới VẪN DÙNG (songInfoRowHtml() trong tab Details).
    'playlistView.songInfo.fieldTitle': 'Title',
    'playlistView.songInfo.fieldArtist': 'Artist',
    'playlistView.songInfo.fieldAlbum': 'Album',
    'playlistView.songInfo.fieldDuration': 'Duration',
    'playlistView.songInfo.fieldPlayCount': 'Play count',
    'playlistView.songInfo.fieldPlayCountValue': '{n} times',
    'playlistView.songInfo.fieldListened': 'Listened',
    // MỚI (mục 1e, phản hồi Giang — "detail modal thêm dung lượng") — DÙNG CHUNG cho CẢ Song lẫn
    // Video (songInfoRowHtml() ở cả 2 nhánh, core/playlist/actions.js::openSongEditModal()) —
    // KHÁC 'fieldFileSize' cũ (xoá 29/07/2026, mồ côi lúc đó) — key MỚI, có nơi dùng thật.
    'playlistView.songInfo.fieldSize': 'File size',
    'playlistView.songInfo.empty': '—',
    // MỚI (ver12 "Song/Video Unification", phản hồi Giang 28/07/2026) — tab "Chi tiết" của Video,
    // THAY Title/Artist/Album (giữ PlayCount/Listened — dùng chung key ở trên).
    // XOÁ (29/07/2026, yêu cầu Giang mục 1) — tab "Chi tiết" của Video RÚT GỌN chỉ còn filename/
    // resolution/playcount/listened — 7 key fieldFileSize/fieldCodec/fieldFps/fieldBitrate/
    // fieldAudioCodec/fieldAudioBitrate/fieldAddedAt (và fieldDuration riêng cho Video — Song vẫn
    // dùng chung field đó ở trên) không còn nơi nào dùng tới nữa, ĐÃ XOÁ khỏi đây — tránh key mồ côi.
    'playlistView.songInfo.fieldFilename': 'Original filename',
    'playlistView.songInfo.fieldResolution': 'Resolution',
    'playlistView.uploadMenu.pickFiles': 'Choose music files',
    'playlistView.uploadMenu.pickFolder': 'Choose a folder',
    // MỚI (ver12 "Song/Video Unification", Batch 6, mục 7) — "Thêm video", KHÔNG có bản "chọn cả
    // thư mục" cho Video (đã chốt — chỉ 1 lựa chọn).
    'playlistView.uploadMenu.pickVideoFiles': 'Choose video files',
    'playlistView.songMenu.title': 'Options',
    'playlistView.songMenu.edit': 'Details',
    // MỚI (10/07/2026) — mở Subtitle Editor (trang riêng).
    'playlistView.songMenu.editSubtitles': 'Edit subtitles',
    'playlistView.songMenu.export': 'Export file',
    // MỚI (ver12 "Song/Video Unification", Batch 6, mục 6d, phản hồi Giang) — hành động RIÊNG của
    // Video, THAY lựa chọn tương ứng đã mất khi xoá dropdown tile "File Manager → Video".
    // 'playlistView.songMenu.setAsBgVideo' ĐÃ XOÁ (phản hồi Giang — bỏ hẳn "Set làm nền" khỏi
    // dropdown Video).
    'playlistView.songMenu.editVideoFile': 'Edit video',
    'playlistView.songMenu.delete': 'Delete song',
    // MỚI (phản hồi Giang, mục "ngôn ngữ theo ngữ cảnh Song/Video") — dropdown Video dùng chung
    // template với Song (#song-action-menu) nhưng nhãn tĩnh vẫn luôn nói "song" — đổi chữ qua JS
    // (openSongActionMenu(), core/playlist/actions.js) dựa vào 2 key song song này.
    'playlistView.songMenu.deleteVideo': 'Delete video',
    'playlistView.songMenu.addToFolder': 'Add to Folder',
    'playlistView.songMenu.deleteBlockedPlaying': "Can't delete <b>{title}</b> while it's playing. Pause the song first, then try again.",
    'playlistView.songMenu.deleteBlockedPlayingVideo': "Can't delete <b>{title}</b> while it's playing. Pause the video first, then try again.",
    'playlistView.songMenu.deleteSuccess': 'Deleted <b>{title}</b>.',
    // ── Chọn nhiều (ver 12 "Multi Media", plan-v12-multimedia.md mục 4.b1) ──────────────
    // SỬA (phản hồi Giang, mục "ngôn ngữ theo ngữ cảnh Song/Video") — nói chung "songs" dù đang
    // browse Nguồn Video — đổi thành chữ trung lập, không cần thêm biến thể/JS riêng.
    'playlistView.selection.toggleTitle': 'Select items',
    'playlistView.selection.exitTitle': 'Cancel selection',
    'playlistView.selection.moreTitle': 'More actions',
    'playlistView.selection.countLabel': '{count} selected',
    'playlistView.selection.btnPlay': 'Play',
    'playlistView.selection.btnExport': 'Export ZIP',
    'playlistView.selection.btnAddToFolder': 'Add to folder',
    'playlistView.selection.btnDelete': 'Delete',
    'playlistView.selection.deleteSuccess': 'Deleted {count} song(s).',
    'playlistView.selection.exportZipFilename': 'songs.zip',
    // MỚI (Batch "Export dọn nợ kiến trúc", phản hồi Giang) — tên file zip RIÊNG cho Video (bulk
    // export selection, exportSelectedVideosZip() — event/workflow/playlist.js).
    'playlistView.selection.exportZipFilenameVideo': 'videos.zip',
    'playlistView.selection.exportPartialFail': 'Some files could not be re-tagged and were exported using their original tag.',
    'playlistView.selection.uploadBlocked': 'Exit selection mode before uploading files.',
    'playlistView.playbackError.title': "Can't play this song",
    'playlistView.playbackError.body': 'The file data may be corrupted or in an unsupported format. Keep it for later (in Storage Management) or delete it now?',
    'playlistView.playbackError.btnKeep': 'Keep',
    'playlistView.playbackError.btnDelete': 'Delete now',

    // SỬA (phản hồi Giang, mục "ngôn ngữ theo ngữ cảnh Song/Video") — chuỗi này dùng lại y hệt khi
    // dọn player Video (window.removeSong()/deleteSelectedSongs(), core/playlist/actions.js +
    // event/workflow/playlist.js) — "No song selected" sai ngữ cảnh, đổi chữ trung lập thay vì
    // thêm biến thể/JS riêng (đơn giản hơn, đúng cho cả 2 nguồn).
    'bottomPlayer.noSongSelected': 'Nothing playing',
    'bottomPlayer.btnPrev.title': 'Previous',
    'bottomPlayer.btnNext.title': 'Next',
};
