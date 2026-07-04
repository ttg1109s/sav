/**
 * patch-subtitle-settings.js — patch default-language keys (tiếng Anh), phần subtitleModal + subtitleSettingsDrawer + slideshowSettingsDrawer + settingsPlaylistBg + settingsVisualizer + settingsAudioEq + settingsSubtitleStyle.
 * MỚI (Batch 8, 03/07/2026): namespace `slideshowSettingsDrawer.*` (Slideshow Settings Drawer,
 * ver 12 "Multi Media") + key `settingsVisualizer.slideshowSetting.*` (nút mở drawer đó).
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

    // MỚI (Batch 8, 03/07/2026, slideshow nền Visual) — Slideshow Settings Drawer, xem
    // components/slideshow-settings-drawer.js.
    'slideshowSettingsDrawer.backToSettings.title': 'Back to Settings',
    'slideshowSettingsDrawer.title': 'Slideshow Background',
    // VIẾT LẠI (Batch 9, 04/07/2026, mục 4) — gộp 2 section cũ ("Album"/"Playback") thành 1; 2 nút
    // "Choose album"/"Turn off" thay bằng 1 toggle "enable" duy nhất + hàng "album đang chạy".
    'slideshowSettingsDrawer.sectionTitle': 'Slideshow',
    'slideshowSettingsDrawer.enable.label': 'Use slideshow',
    'slideshowSettingsDrawer.enable.hint': 'Toggle on to pick an album; toggle off just stops it',
    'slideshowSettingsDrawer.album.label': 'Album',
    'slideshowSettingsDrawer.album.none': 'No album selected',
    'slideshowSettingsDrawer.albumPicker.title': 'Choose an album',
    'slideshowSettingsDrawer.albumPicker.empty': 'No albums yet. Create one in Photo & Album first.',
    'slideshowSettingsDrawer.mode.label': 'Next photo order',
    'slideshowSettingsDrawer.mode.sequential': 'Sequential',
    'slideshowSettingsDrawer.mode.random': 'Random',
    'slideshowSettingsDrawer.interval.label': 'Seconds per photo',
    'slideshowSettingsDrawer.interval.hint': 'Minimum 5 seconds',
    'slideshowSettingsDrawer.transition.label': 'Transition effect',
    'slideshowSettingsDrawer.transition.fade': 'Fade',
    'slideshowSettingsDrawer.transition.slideLeft': 'Slide left',
    'slideshowSettingsDrawer.transition.slideRight': 'Slide right',
    'slideshowSettingsDrawer.transition.zoomIn': 'Zoom in',
    'slideshowSettingsDrawer.transition.zoomOut': 'Zoom out',
    'slideshowSettingsDrawer.transition.wipe': 'Wipe',
    'slideshowSettingsDrawer.transition.flip': 'Flip (3D)',
    'slideshowSettingsDrawer.transition.kenburns': 'Ken Burns (slow pan/zoom)',
    'slideshowSettingsDrawer.transition.blur': 'Blur cross-fade',
    'slideshowSettingsDrawer.transition.rotateFade': 'Rotate + fade',
    'slideshowSettingsDrawer.transition.curtain': 'Curtain',
    'slideshowSettingsDrawer.transition.circleReveal': 'Circle reveal',
    'slideshowSettingsDrawer.transition.glitch': 'Glitch',

    'settingsPlaylistBg.sectionTitle': 'Playlist & Background',
    'settingsPlaylistBg.viewMode.label': 'View',
    'settingsPlaylistBg.viewMode.list': 'List',
    'settingsPlaylistBg.viewMode.grid': 'Grid',
    'settingsPlaylistBg.sortMode.label': 'Sort',
    'settingsPlaylistBg.sortMode.default': 'Default (recently added)',
    'settingsPlaylistBg.sortMode.az': 'Name A → Z',
    'settingsPlaylistBg.sortMode.za': 'Name Z → A',
    'settingsPlaylistBg.videoEnable.label': 'Use Video Background',
    'settingsPlaylistBg.videoEnable.hint': 'Toggle on to pick a video; toggle off just hides it (kept for next time)',
    // MỚI (03/07/2026, mục 2) — Ảnh nền tĩnh cho màn Visualizer, KHÁC ảnh nền Playlist ngay dưới.
    'settingsPlaylistBg.visualBgImage.label': 'Use Visualizer background image',
    'settingsPlaylistBg.visualBgImage.hint': 'Toggle on to pick a photo; toggle off just hides it (kept for next time)',
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
    // MỚI (Batch 8, 03/07/2026, slideshow nền Visual) — nút mở Slideshow Settings Drawer.
    'settingsVisualizer.slideshowSetting.label': 'Slideshow background',
    'settingsVisualizer.slideshowSetting.hint': 'Cycle through an album as an animated background',

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
