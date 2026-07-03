/**
 * patch-subtitle-settings.js — patch default-language keys (tiếng Anh), phần subtitleModal + subtitleSettingsDrawer + settingsPlaylistBg + settingsVisualizer + settingsAudioEq + settingsSubtitleStyle.
 *
 * Đây KHÔNG phải file JSON: project chạy qua file://, không thể fetch() file tĩnh, nên các
 * "patch" default-language được viết thành .js gán vào 1 biến global, để core/../lang.js (nay đã
 * dời sang /lang/lang.js) gom lại bằng Object.assign(). File này CHỈ chứa dữ liệu (key -> chuỗi
 * tiếng Anh), không chứa logic.
 *
 * Nạp TRƯỚC /lang/lang.js (xem index.html, khối nạp /lang/patch/*.js đứng trước /lang/lang.js).
 */
const LANG_PATCH_SUBTITLE_SETTINGS = {
    'subtitleModal.title': 'Manage Subtitles',
    'subtitleModal.btnClose': 'Close',
    'subtitleModal.btnUpload.title': 'Upload a (.srt) file',
    'subtitleModal.btnAutoTiming.title': 'Auto Timing',
    'subtitleModal.btnAddSub.title': 'Add subtitle line',
    'subtitleModal.btnApplySub.title': 'Apply & replay',
    'subtitleModal.listHeading': 'Lines:',
    'subtitleModal.btnExportSrt': 'Export .SRT file',
    'subtitleModal.listEmpty': 'No subtitles yet',
    'subtitleModal.editor.placeholder': 'Enter subtitle text...',
    'subtitleModal.editor.btnSave': 'Save',
    'subtitleModal.editor.btnDelete': 'Delete',
    'subtitleModal.newLine.defaultText': 'New subtitle line...',
    'subtitleModal.autoTiming.defaultText': '(Enter text...)',

    'subtitleSettingsDrawer.backToSettings.title': 'Back to Settings',
    'subtitleSettingsDrawer.title': 'Customize Subtitles',
    'subtitleSettingsDrawer.sectionTitle': 'Subtitle box & text',
    'subtitleSettingsDrawer.bgColor.label': 'Box background color',
    'subtitleSettingsDrawer.bgOpacity.label': 'Background opacity',
    'subtitleSettingsDrawer.borderColor.label': 'Box border color',
    'subtitleSettingsDrawer.borderOpacity.label': 'Border opacity',
    'subtitleSettingsDrawer.borderWidth.label': 'Border thickness (px)',
    'subtitleSettingsDrawer.borderRadius.label': 'Box corner radius (px)',
    'subtitleSettingsDrawer.textColor.label': 'Subtitle text color',
    'subtitleSettingsDrawer.fontSize.label': 'Font size (px)',
    'subtitleSettingsDrawer.lineHeight.label': 'Line height',
    'subtitleSettingsDrawer.letterSpacing.label': 'Letter spacing (px)',

    'settingsPlaylistBg.sectionTitle': 'Playlist & Background',
    'settingsPlaylistBg.viewMode.label': 'View',
    'settingsPlaylistBg.viewMode.list': 'List',
    'settingsPlaylistBg.viewMode.grid': 'Grid',
    'settingsPlaylistBg.sortMode.label': 'Sort',
    'settingsPlaylistBg.sortMode.default': 'Default (recently added)',
    'settingsPlaylistBg.sortMode.az': 'Name A → Z',
    'settingsPlaylistBg.sortMode.za': 'Name Z → A',
    'settingsPlaylistBg.videoEnable.label': 'Use Video Background',
    'settingsPlaylistBg.videoEnable.hint': 'Replace any background with a video',
    'settingsPlaylistBg.videoEnable.choose': 'Choose video',
    // MỚI (03/07/2026, mục 2) — Ảnh nền tĩnh cho màn Visualizer, KHÁC ảnh nền Playlist ngay dưới.
    'settingsPlaylistBg.visualBgImage.label': 'Use Visualizer background image',
    'settingsPlaylistBg.visualBgImage.hint': 'Static image behind the Visualizer screen',
    'settingsPlaylistBg.visualBgImage.choose': 'Choose image',
    'settingsPlaylistBg.bgImage.label': 'Playlist background image',
    'settingsPlaylistBg.bgImage.choose': 'Change image',
    'settingsPlaylistBg.bgImageEnable.label': 'Use playlist background image',
    'settingsPlaylistBg.bgBlur.label': 'Background blur',

    'settingsVisualizer.sectionTitle': 'Visualizer',
    'settingsVisualizer.type.label': 'Effect type',
    'settingsVisualizer.type.bar': 'Bar',
    'settingsVisualizer.type.lightning': 'Lightning',
    'settingsVisualizer.type.rubik': 'Rubik',
    'settingsVisualizer.type.vortex': 'Vortex (Tunnel)',
    'settingsVisualizer.type.blackHole': 'Black Hole',
    'settingsVisualizer.type.rain': 'Rain',
    'settingsVisualizer.openDrawer.label': 'Customize Visualizer',
    'settingsVisualizer.openDrawer.hint': 'Render quality, per-effect geometry, colors, auto-switch effect',
    'settingsVisualizer.visualEnable.label': 'Show visual',
    'settingsVisualizer.visualEnable.hint': 'Turn off to show only the background (video/image/color), hiding the visualizer effect without touching Video Background.',

    'settingsAudioEq.sectionTitle': 'Audio & Equalizer',
    'settingsAudioEq.volume.label': 'Master volume',
    'settingsAudioEq.mode.label': 'Equalizer mode',
    'settingsAudioEq.mode.flat': 'Default (Flat)',
    'settingsAudioEq.mode.bassBoost': 'Bass boost',
    'settingsAudioEq.mode.pop': 'Pop',
    'settingsAudioEq.mode.rock': 'Rock',
    'settingsAudioEq.mode.acoustic': 'Acoustic',
    'settingsAudioEq.mode.electronic': 'Electronic (EDM)',
    'settingsAudioEq.mode.manual': 'Manual',
    'settingsAudioEq.manualHeading': 'Frequency bands (Hz)',

    'settingsSubtitleStyle.sectionTitle': 'Subtitles',
    'settingsSubtitleStyle.enable.label': 'Show subtitles',
    'settingsSubtitleStyle.enable.hint': "Turn off to hide the subtitle box during playback, without deleting what you've written.",
    'settingsSubtitleStyle.openDrawer.label': 'Customize',
    'settingsSubtitleStyle.openDrawer.hint': 'Box background/border color, text color, font size, line/letter spacing',

};
