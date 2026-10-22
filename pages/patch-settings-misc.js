/**
 * patch-settings-misc.js — patch default-language keys (tiếng Anh), phần settingsMisc + storageDrawer + settingsLanguage.
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
    // MỚI (16/08/2026, Game Mode Circle v1) — checkbox toggle vizConfig.gameplayArmedGameId
    // (nullable-string, [SỬA 02/09/2026] trước là boolean gameplayModeEnabled — xem core/config.js),
    // KHÔNG có hint (Giang yêu cầu bỏ mô tả, chỉ giữ label — components/settings/misc.js). Checkbox
    // này giờ chỉ là lối tắt legacy cho ĐÚNG game 'circle' — danh sách đầy đủ + nhiều game sau này
    // xem Game Panel (App Panel tab "Game", core/gameplay/game-panel-ui.js).
    'settingsMisc.gameMode.label': 'Game Mode',
    'settingsMisc.troubleshootTitle': 'Troubleshooting',
    // MỚI (18/07/2026, Giang yêu cầu — "mục mới Settings > Misc, vào hiện console log").
    'settingsMisc.openDebugConsole.label': 'Debug console',
    'settingsMisc.debugConsole.title': 'Debug console',
    'settingsMisc.debugConsole.btnCopy': 'Copy all',
    'settingsMisc.debugConsole.btnClear': 'Clear all', // SỬA 20/09/2026 — trước là 'Clear' (giờ có thêm nút xoá TỪNG dòng nên cần phân biệt)
    'settingsMisc.debugConsole.item.copy.title': 'Copy this line', // MỚI 20/09/2026
    'settingsMisc.debugConsole.item.remove.title': 'Remove this line', // MỚI 20/09/2026
    'settingsMisc.debugConsole.copiedMsg': 'Log copied to clipboard.',
    'settingsMisc.debugConsole.copyFailedMsg': "Couldn't copy — try selecting the text manually.",
    'settingsMisc.debugConsole.emptyMsg': 'No log entries yet.',
    'settingsMisc.restartApp.label': 'Restart app',
    'settingsMisc.restartApp.hint': 'Use this if the player freezes, gets stuck, or behaves abnormally. Does not affect saved music/playlist/settings.',
    'settingsMisc.restoreDefaults.label': 'Restore default settings',
    'settingsMisc.restoreDefaults.hint': 'Resets colors, effects, EQ, and other display customizations to defaults. Does NOT delete uploaded music/playlist.',
    'settingsMisc.clearCache.label': 'Clear JS/CSS cache',
    'settingsMisc.clearCache.hint': 'Use this if the app still looks/behaves like an older version after an update. Does not affect saved music/playlist/settings.',

    'storageDrawer.title': 'Storage Management',
    'storageDrawer.statsSectionTitle': 'Statistics',
    'storageDrawer.statTotalBytes': 'Total storage', // tổng Song + Video + Photo
    // Chú giải thanh chia đoạn, dùng chung cho nhãn hàng của list số lượng.
    'storageDrawer.legendSongs': 'Music',
    'storageDrawer.legendVideos': 'Video',
    'storageDrawer.legendPhotos': 'Photos',
    'storageDrawer.legendOther': 'Other (app data, temp files)', // usage của origin trừ media
    'storageDrawer.statFreeBytes': 'Available / Limit (estimated)',
    // Theo MDN "Storage quotas and eviction criteria": quota tính theo TỔNG dung lượng máy, có thể lệch cố ý chống fingerprint.
    'storageDrawer.statFreeBytesInfo': 'An estimate reported by the browser/OS, not the real free space on your device. The limit is based on your device\'s total storage, so when other apps fill up the device, the space SAV can actually use may be smaller than shown. If the device runs very low on storage, the system may also clear website data.',
    // Safari < 17 không có navigator.storage.estimate().
    'storageDrawer.legacyQuotaNote': "This browser (Safari before 17) doesn't report a limit, so the default of about 1 GB per site is shown. Past that, Safari asks for permission to store more.",
    // Chế độ lưu trữ theo navigator.storage.persisted() — app xin persist() lúc mở.
    'storageDrawer.persistLabel': 'Storage mode',
    'storageDrawer.persistOn': 'Persistent',
    'storageDrawer.persistOff': 'Best-effort (may be cleared)',
    'storageDrawer.persistInfo': "Persistent: the browser only deletes SAV's data when you do. Best-effort: the browser may clear it when the device runs low on storage, or (Safari) when the app hasn't been opened for a while. SAV requests persistent storage each time it starts; Chrome and Safari decide on their own (adding SAV to the Home Screen helps), Firefox asks you.",
    'storageDrawer.selectSourceSectionTitle': 'Delete & Backup', // section "Chọn mục xoá"
    // Tiền tố tên .zip khi tải Photo (Song/Video: fileManager.song.storageAction.zipName*, lang/patch/patch-file-manager.js).
    'storageDrawer.zipNamePhoto': 'photos',
    'storageDrawer.brokenSectionTitle': 'Corrupted data',
    'storageDrawer.scanBroken.label': 'Scan & clean broken files',
    // Chỉ file hỏng thật — sửa thumbnail video ở Settings > Troubleshooting.
    'storageDrawer.scanBroken.hint': "Finds files that can't be played or decoded, and asks before deleting",
    // Modal chọn phạm vi quét (event/workflow/file-manager-storage.js::askScanBrokenScope()).
    'storageDrawer.scanBroken.modalBody': 'Choose what to scan for broken/corrupted files:',
    'storageDrawer.scanBroken.scopeAll': 'Everything (Music, Video, Photos)',
    // Tên key giữ `btnFixBroken` (id/wire cũ) — nút chỉ xoá file hỏng.
    'storageDrawer.btnFixBroken': 'Delete these files',
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
