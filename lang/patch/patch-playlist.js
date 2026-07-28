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
    'playlistView.heading': 'Songs',
    'playlistView.search.placeholder': 'Search songs, artists, albums...',
    'playlistView.search.clear.title': 'Clear search',
    'playlistView.btnPlay': 'Play',
    'playlistView.btnShuffleAll': 'Shuffle',
    'playlistView.empty.noSongs': 'No songs yet. Add some music to get started.',
    'playlistView.empty.noSearchResults': 'No matching songs found.',
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
    'playlistView.songInfo.empty': '—',
    // MỚI (ver12 "Song/Video Unification", phản hồi Giang 28/07/2026) — tab "Chi tiết" của Video,
    // THAY Title/Artist/Album (giữ Duration/PlayCount/Listened — dùng chung key ở trên). Bỏ hẳn
    // field "Format" (định dạng container, Giang yêu cầu bỏ — ít giá trị, hầu hết video .mp4).
    'playlistView.songInfo.fieldFilename': 'Original filename',
    'playlistView.songInfo.fieldFileSize': 'File size',
    'playlistView.songInfo.fieldCodec': 'Video codec',
    'playlistView.songInfo.fieldResolution': 'Resolution',
    'playlistView.songInfo.fieldFps': 'Frame rate',
    'playlistView.songInfo.fieldBitrate': 'Video bitrate',
    'playlistView.songInfo.fieldAudioCodec': 'Audio codec',
    'playlistView.songInfo.fieldAudioBitrate': 'Audio bitrate',
    'playlistView.songInfo.fieldAddedAt': 'Added on',
    'playlistView.uploadMenu.pickFiles': 'Choose music files',
    'playlistView.uploadMenu.pickFolder': 'Choose a folder',
    'playlistView.songMenu.title': 'Options',
    'playlistView.songMenu.edit': 'Details',
    // MỚI (10/07/2026) — mở Subtitle Editor (trang riêng).
    'playlistView.songMenu.editSubtitles': 'Edit subtitles',
    'playlistView.songMenu.export': 'Export file',
    'playlistView.songMenu.delete': 'Delete song',
    'playlistView.songMenu.addToFolder': 'Add to Folder',
    'playlistView.songMenu.deleteBlockedPlaying': "Can't delete <b>{title}</b> while it's playing. Pause the song first, then try again.",
    'playlistView.songMenu.deleteSuccess': 'Deleted <b>{title}</b>.',
    // ── Chọn nhiều (ver 12 "Multi Media", plan-v12-multimedia.md mục 4.b1) ──────────────
    'playlistView.selection.toggleTitle': 'Select songs',
    'playlistView.selection.exitTitle': 'Cancel selection',
    'playlistView.selection.moreTitle': 'More actions',
    'playlistView.selection.countLabel': '{count} selected',
    'playlistView.selection.btnPlay': 'Play',
    'playlistView.selection.btnExport': 'Export ZIP',
    'playlistView.selection.btnAddToFolder': 'Add to folder',
    'playlistView.selection.btnDelete': 'Delete',
    'playlistView.selection.deleteSuccess': 'Deleted {count} song(s).',
    'playlistView.selection.exportZipFilename': 'songs.zip',
    'playlistView.selection.exportPartialFail': 'Some files could not be re-tagged and were exported using their original tag.',
    'playlistView.selection.uploadBlocked': 'Exit selection mode before uploading files.',
    'playlistView.playbackError.title': "Can't play this song",
    'playlistView.playbackError.body': 'The file data may be corrupted or in an unsupported format. Keep it for later (in Storage Management) or delete it now?',
    'playlistView.playbackError.btnKeep': 'Keep',
    'playlistView.playbackError.btnDelete': 'Delete now',

    'bottomPlayer.noSongSelected': 'No song selected',
    'bottomPlayer.btnPrev.title': 'Previous',
    'bottomPlayer.btnNext.title': 'Next',
};
