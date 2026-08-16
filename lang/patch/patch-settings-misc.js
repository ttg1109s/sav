/**
 * patch-settings-misc.js — patch default-language keys (tiếng Anh), phần settingsMisc + settingsDrawer + aboutDrawer + storageDrawer + settingsLanguage.
 *
 * Đây KHÔNG phải file JSON: project chạy qua file://, không thể fetch() file tĩnh, nên các
 * "patch" default-language được viết thành .js gán vào 1 biến global, để core/../lang.js (nay đã
 * dời sang /lang/lang.js) gom lại bằng Object.assign(). File này CHỈ chứa dữ liệu (key -> chuỗi
 * tiếng Anh), không chứa logic.
 *
 * Nạp TRƯỚC /lang/lang.js (xem index.html, khối nạp /lang/patch/*.js đứng trước /lang/lang.js).
 */
const LANG_PATCH_SETTINGS_MISC = {
    'settingsMisc.sectionTitle': 'Other',
    'settingsMisc.keepScreenOn.label': 'Keep screen on',
    'settingsMisc.keepScreenOn.hint': 'Prevents the screen from turning off during playback. Turn off to save battery (music still tries to keep playing in the background).',
    // MỚI (16/08/2026, Game Mode Circle v1) — checkbox toggle vizConfig.gameplayModeEnabled, KHÔNG
    // có hint (Giang yêu cầu bỏ mô tả, chỉ giữ label — components/settings/misc.js).
    'settingsMisc.gameMode.label': 'Game Mode',
    'settingsMisc.openAbout.label': 'About the player',
    'settingsMisc.troubleshootTitle': 'Troubleshooting',
    // MỚI (18/07/2026, Giang yêu cầu — "mục mới Settings > Misc, vào hiện console log").
    'settingsMisc.openDebugConsole.label': 'Debug console',
    'settingsMisc.debugConsole.title': 'Debug console',
    'settingsMisc.debugConsole.btnCopy': 'Copy all',
    'settingsMisc.debugConsole.btnClear': 'Clear',
    'settingsMisc.debugConsole.copiedMsg': 'Log copied to clipboard.',
    'settingsMisc.debugConsole.copyFailedMsg': "Couldn't copy — try selecting the text manually.",
    'settingsMisc.debugConsole.emptyMsg': 'No log entries yet.',
    'settingsMisc.restartApp.label': 'Restart app',
    'settingsMisc.restartApp.hint': 'Use this if the player freezes, gets stuck, or behaves abnormally. Does not affect saved music/playlist/settings.',
    'settingsMisc.restoreDefaults.label': 'Restore default settings',
    'settingsMisc.restoreDefaults.hint': 'Resets colors, effects, EQ, and other display customizations to defaults. Does NOT delete uploaded music/playlist.',
    'settingsMisc.clearCache.label': 'Clear JS/CSS cache',
    'settingsMisc.clearCache.hint': 'Use this if the app still looks/behaves like an older version after an update. Does not affect saved music/playlist/settings.',

    'settingsDrawer.title': 'System Settings',
    // Batch D1 (Settings restructure, 06/07/2026) — nút Back giờ DÙNG CHUNG cho mọi panel con
    // (core/settings-panel-stack.js), thay 9 key `*.backToSettings.title` rời rạc trước đây bằng
    // ĐÚNG 1 key ở đây. `aboutDrawer.backToSettings.title` XOÁ (không còn nơi nào dùng).
    // VIẾT LẠI (06/07/2026, slider thật — header nhét vào từng panel): `settingsDrawer.back.title`
    // ĐÃ XOÁ — nút Back giờ dùng `aria-label="Back"` cố định (không dịch) thay vì `title` qua t(),
    // vì core/settings-panel-stack.js (core UI thuần) không được biết gì về `lang/` — xem
    // _buildPanelInnerHtml().

    'aboutDrawer.title': 'About the player',
    'aboutDrawer.statsSectionTitle': 'Statistics',
    'aboutDrawer.statTotalSongs': 'Total songs',
    'aboutDrawer.statTotalDuration': 'Total song length',
    'aboutDrawer.statListenSeconds': 'Total listening time',
    'aboutDrawer.storageSectionTitle': 'Storage',
    'aboutDrawer.openStorage.label': 'Storage Management',
    'aboutDrawer.openStorage.hint': 'Storage used, free up space, clean up broken files',
    'aboutDrawer.introSectionTitle': 'About',
    'aboutDrawer.introBody': 'This player runs entirely in your browser — no server, nothing uploaded. Your music, covers, subtitles, and backgrounds are all stored locally on this device.',
    'aboutDrawer.warningSectionTitle': 'About stored data',
    'aboutDrawer.warning.deviceBound': 'Data is tied to <strong class="text-amber-300">this specific browser + device</strong> — it does not sync across other devices or browsers.',
    'aboutDrawer.warning.osCleanup': 'The OS may auto-clear this data when storage is low, especially on mobile.',
    'aboutDrawer.warning.offline': '<strong class="text-amber-300">Offline use:</strong> your data is safe, but without internet you can\'t reload the page to open the app and reach it.',
    'aboutDrawer.warning.recommendation': '<strong class="text-amber-300">Recommendation:</strong> keep your original mp3 files elsewhere too (Google Drive, your computer...). Treat this as a convenient cache, not your primary storage.',

    'storageDrawer.backToAbout.title': 'Back to About',
    'storageDrawer.title': 'Storage Management',
    'storageDrawer.statsSectionTitle': 'Statistics',
    'storageDrawer.statTotalSongs': 'Songs',
    // SỬA (phản hồi Giang, mục 1 — "UI dung lượng như Settings mobile OS") — giờ là TỔNG dung
    // lượng CẢ Song lẫn Video (thanh chia đoạn bên dưới) — không còn riêng "Storage used" cho mỗi
    // loại (2 dòng số byte tách rời cũ ĐÃ GỘP vào 1 thanh + chú giải, xem renderStorageStats()).
    'storageDrawer.statTotalBytes': 'Total storage',
    // MỚI (ver12 "Song/Video Unification", Batch 5, mục 6a) — thống kê Video song song Song.
    'storageDrawer.statTotalVideos': 'Videos',
    // MỚI (phản hồi Giang, mục 1) — nhãn NGẮN cho chú giải dưới thanh chia đoạn dung lượng (khác
    // statTotalSongs/statTotalVideos — 2 key đó giờ dùng làm nhãn dưới vòng tròn SỐ LƯỢNG, cần
    // ngắn gọn nhưng không nhất thiết trùng chữ với chú giải dung lượng).
    'storageDrawer.legendSongs': 'Music',
    'storageDrawer.legendVideos': 'Video',
    // MỚI (29/07/2026, yêu cầu Giang — panel "Quản lý lưu trữ" MỚI, mục 2a/2b) — legendSongs/
    // legendVideos ngay trên GIỜ DÙNG CHUNG cho CẢ chú giải thanh chia đoạn LẪN nhãn hàng trong
    // list số lượng (list 4 hàng THAY 2 "vòng tròn" cũ, xem components/file-manager-storage.js) —
    // 2 key MỚI này bổ sung cho ĐỦ 4 domain.
    'storageDrawer.legendPhotos': 'Photos',
    'storageDrawer.legendDocuments': 'Documents',
    // MỚI (29/07/2026, mục 2c) — tiêu đề section "Chọn mục xoá" (THAY "Free up storage" — giờ
    // gồm CẢ phần chọn nguồn LẪN 2 toggle hành động trong CÙNG 1 khối, không tách riêng nữa).
    // SỬA (29/07/2026, yêu cầu Giang) — đổi tên hiển thị thành "Delete & Backup" (khớp đúng ý
    // nghĩa 2 hành động chính của section: tải xuống SAO LƯU + xoá) — key TÊN giữ nguyên
    // ("selectSourceSectionTitle"), CHỈ đổi chuỗi hiển thị.
    'storageDrawer.selectSourceSectionTitle': 'Delete & Backup',
    // MỚI (29/07/2026) — tiền tố tên file .zip khi tải Photo/Document (Song/Video dùng
    // fileManager.song.storageAction.zipNameSong/zipNameVideo có sẵn, lang/patch/patch-file-
    // manager.js — GIỮ NGUYÊN, không đổi namespace cũ).
    'storageDrawer.zipNamePhoto': 'photos',
    'storageDrawer.zipNameDocument': 'documents',
    'storageDrawer.freeSpaceSectionTitle': 'Free up storage',
    // SỬA (ver12 "Song/Video Unification", Batch 5, mục 6b) — 'downloadThenClear.label/hint' và
    // 'clearNoDownload.label/hint' (2 nút tách rời cũ) ĐÃ XOÁ, thay bằng key MỚI ở
    // lang/patch/patch-file-manager.js (namespace fileManager.song.storageAction.*) — 3 field cấu
    // hình độc lập (phạm vi/tải xuống/xoá) + 1 nút "Thực hiện".
    'storageDrawer.brokenSectionTitle': 'Corrupted data',
    'storageDrawer.scanBroken.label': 'Scan & clean broken files',
    'storageDrawer.scanBroken.hint': "Finds songs whose data isn't a valid mp3 or can't be played, asks before deleting",
    // MỚI (29/07/2026, yêu cầu Giang — "mở modal choice có dropdown chọn loại scan") — nội dung
    // modal + option "Tất cả" của dropdown, xem event/workflow/file-manager-storage.js::
    // askScanBrokenScope(). XOÁ (cùng ngày) — key "blockedNoSource" (Block gate cũ chặn "chưa
    // chọn nguồn nào") không còn cần thiết — dropdown LUÔN có 1 giá trị, không có khái niệm rỗng.
    'storageDrawer.scanBroken.modalBody': 'Choose what to scan for broken/corrupted files:',
    'storageDrawer.scanBroken.scopeAll': 'Everything (Music, Video, Photos, Documents)',
    'storageDrawer.btnDeleteBroken': 'Delete these broken files',
    'storageDrawer.btnDismissScan': 'Dismiss',

    'settingsLanguage.sectionTitle': 'Language',
    'settingsLanguage.select.label': 'Display language',
    'settingsLanguage.upload.label': 'Upload a new language (.json)',
    'settingsLanguage.delete.label': 'Delete this language',
    'settingsLanguage.delete.confirm': 'Delete language "{name}"? After deleting, the app will switch back to English.',
    'settingsLanguage.upload.invalidFile': 'Invalid language file: missing "meta.code" or malformed JSON.',
    'settingsLanguage.upload.success': 'Added language "{name}" and applied it.',
    'settingsLanguage.upload.parseError': "Couldn't read this JSON file:\n\n{message}",
    'settingsLanguage.cannotDeleteEnglish': 'English (the original language) is always available and cannot be deleted.',
};
