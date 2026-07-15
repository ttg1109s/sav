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
    'settingsMisc.openAbout.label': 'About the player',
    'settingsMisc.troubleshootTitle': 'Troubleshooting',
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
    'storageDrawer.statTotalSongs': 'Total songs',
    'storageDrawer.statTotalBytes': 'Storage used',
    'storageDrawer.freeSpaceSectionTitle': 'Free up storage',
    'storageDrawer.downloadThenClear.label': 'Download all files (.zip) then delete',
    'storageDrawer.downloadThenClear.hint': 'Packs all original music into one zip file to download, then deletes everything from this device',
    'storageDrawer.clearNoDownload.label': 'Delete everything, no download',
    'storageDrawer.clearNoDownload.hint': 'Deletes all saved songs (background image/video is kept) — CANNOT be undone',
    'storageDrawer.brokenSectionTitle': 'Corrupted data',
    'storageDrawer.scanBroken.label': 'Scan & clean broken files',
    'storageDrawer.scanBroken.hint': "Finds songs whose data isn't a valid mp3 or can't be played, asks before deleting",
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
