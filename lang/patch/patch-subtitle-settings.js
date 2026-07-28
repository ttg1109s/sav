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
    // SỬA (10/07/2026, Subtitle Editor chuyển sang trang riêng): TOÀN BỘ key soạn thảo cũ
    // (title/btnClose/btnUpload/btnAutoTiming/btnAddSub/btnApplySub/listHeading/btnExportSrt/
    // listEmpty/editor.*/newLine.defaultText/autoTiming.defaultText) ĐÃ XOÁ — tương ứng bên
    // `subtitleEditor.*` (lang/patch/patch-subtitle-editor.js, dùng ở subtitle-editor.html).
    // `subtitleModal.noSongPlaying` CŨNG ĐÃ XOÁ (10/07/2026, lần 2) — nút "Sub" giờ CHỈ toggle
    // bật/tắt (không cần bài đang phát), không còn cảnh báo "chưa phát bài nào" nữa.

    // Batch D2 (06/07/2026) — 'subtitleSettingsDrawer.backToSettings.title' XOÁ, dùng CHUNG
    // 'settingsDrawer.back.title' (Batch D1, lang/patch/patch-settings-misc.js) cho mọi panel.
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
    // Batch D4 (06/07/2026) — 'slideshowSettingsDrawer.backToSettings.title' XOÁ, dùng CHUNG
    // 'settingsDrawer.back.title' (Batch D1) cho mọi panel.
    'slideshowSettingsDrawer.title': 'Slideshow Background',
    // VIẾT LẠI (Batch 9, 04/07/2026, mục 4) — gộp 2 section cũ ("Album"/"Playback") thành 1; 2 nút
    // "Choose album"/"Turn off" thay bằng 1 toggle "enable" duy nhất + hàng "album đang chạy".
    // SỬA (18/07/2026, phản hồi Giang — "tái cấu trúc panel theo nhóm mục") — 'sectionTitle' (1
    // tiêu đề DUY NHẤT cho cả panel) ĐÃ XOÁ, thay bằng 3 tiêu đề nhóm riêng.
    'slideshowSettingsDrawer.groupAlbum.title': 'Album',
    'slideshowSettingsDrawer.groupTransition.title': 'Transition',
    'slideshowSettingsDrawer.groupKenBurns.title': 'Ken Burns',
    'slideshowSettingsDrawer.enable.label': 'Use slideshow',
    'slideshowSettingsDrawer.enable.hint': 'Toggle on to pick an album; toggle off just stops it',
    'slideshowSettingsDrawer.albumPicker.title': 'Choose an album',
    'slideshowSettingsDrawer.albumPicker.empty': 'No albums yet. Create one in Photo & Album first.',
    'slideshowSettingsDrawer.mode.label': 'Next photo order',
    'slideshowSettingsDrawer.mode.sequential': 'Sequential',
    'slideshowSettingsDrawer.mode.random': 'Random',
    // MỚI (04/07/2026, mục 5 phản hồi Giang).
    'slideshowSettingsDrawer.photoPerSong.label': 'Photo per song',
    'slideshowSettingsDrawer.photoPerSong.hint': 'Change photo when the song changes, not on a timer',
    'slideshowSettingsDrawer.interval.label': 'Seconds per photo',
    'slideshowSettingsDrawer.interval.hint': 'Minimum 5 seconds',
    // MỚI (18/07/2026, phản hồi Giang) — tiêu đề modal picker (core/time-picker-modal.js).
    'slideshowSettingsDrawer.interval.pickerTitle': 'Seconds per photo',
    'slideshowSettingsDrawer.transition.label': 'Transition effect',
    'slideshowSettingsDrawer.transition.fade': 'Fade',
    'slideshowSettingsDrawer.transition.slideLeft': 'Slide left',
    'slideshowSettingsDrawer.transition.slideRight': 'Slide right',
    'slideshowSettingsDrawer.transition.zoomIn': 'Zoom in',
    'slideshowSettingsDrawer.transition.zoomOut': 'Zoom out',
    'slideshowSettingsDrawer.transition.wipe': 'Wipe',
    'slideshowSettingsDrawer.transition.flip': 'Flip (3D)',
    'slideshowSettingsDrawer.transition.blur': 'Blur cross-fade',
    'slideshowSettingsDrawer.transition.rotateFade': 'Rotate + fade',
    'slideshowSettingsDrawer.transition.curtain': 'Curtain',
    'slideshowSettingsDrawer.transition.circleReveal': 'Circle reveal',
    'slideshowSettingsDrawer.transition.glitch': 'Glitch',
    // MỚI (Ken Burns, 18/07/2026, phản hồi Giang) — toggle ĐỘC LẬP, tách khỏi transition select.
    'slideshowSettingsDrawer.kenBurns.label': 'Ken Burns',
    'slideshowSettingsDrawer.kenBurns.hint': 'Slow pan/zoom on each photo — works together with any transition above',
    // MỚI ("Nhóm 2", 18/07/2026, phản hồi Giang) — 13 chế độ Ken Burns, THAY HẲN "Nhóm 1" (8 biến
    // thể random tự động, không chọn được).
    'slideshowSettingsDrawer.kenBurnsMode.label': 'Movement style',
    'slideshowSettingsDrawer.kenBurnsMode.groupPan': 'Pan only',
    'slideshowSettingsDrawer.kenBurnsMode.panLeft': 'Pan left',
    'slideshowSettingsDrawer.kenBurnsMode.panRight': 'Pan right',
    'slideshowSettingsDrawer.kenBurnsMode.panTop': 'Pan up',
    'slideshowSettingsDrawer.kenBurnsMode.panBottom': 'Pan down',
    'slideshowSettingsDrawer.kenBurnsMode.panRandom': 'Pan (random direction)',
    'slideshowSettingsDrawer.kenBurnsMode.groupZoom': 'Zoom only (center)',
    'slideshowSettingsDrawer.kenBurnsMode.zoomIn': 'Zoom in',
    'slideshowSettingsDrawer.kenBurnsMode.zoomOut': 'Zoom out',
    'slideshowSettingsDrawer.kenBurnsMode.zoomRandom': 'Zoom (random in/out)',
    'slideshowSettingsDrawer.kenBurnsMode.groupZoomPan': 'Zoom + pan',
    'slideshowSettingsDrawer.kenBurnsMode.zoomPanLeft': 'Zoom + pan left',
    'slideshowSettingsDrawer.kenBurnsMode.zoomPanRight': 'Zoom + pan right',
    'slideshowSettingsDrawer.kenBurnsMode.zoomPanTop': 'Zoom + pan up',
    'slideshowSettingsDrawer.kenBurnsMode.zoomPanBottom': 'Zoom + pan down',
    'slideshowSettingsDrawer.kenBurnsMode.zoomPanRandom': 'Zoom + pan (random direction)',

    // MỚI (18/07/2026, phản hồi Giang — "thêm thời gian transition giữa 2 ảnh").
    'slideshowSettingsDrawer.transitionDuration.label': 'Transition duration',
    'slideshowSettingsDrawer.transitionDuration.hint': 'How long the crossfade itself takes (0:01–1:00)',
    'slideshowSettingsDrawer.transitionDuration.pickerTitle': 'Transition duration',
    'slideshowSettingsDrawer.transitionRatio.label': 'In/Out ratio',
    // Nhãn xem trước SỐNG — {in}/{out} tính lại mỗi lần kéo slider (xem
    // event/workflow/slideshow.js::_updateTransitionRatioLabel()), KHÁC key .label tĩnh ngay trên.
    'slideshowSettingsDrawer.transitionRatio.previewFormat': 'In {in}s / Out {out}s',
    'slideshowSettingsDrawer.transitionEasing.label': 'Easing',
    'slideshowSettingsDrawer.transitionEasing.linear': 'Linear (no easing)',
    'slideshowSettingsDrawer.transitionEasing.ease': 'Ease',
    'slideshowSettingsDrawer.transitionEasing.easeIn': 'Ease in',
    'slideshowSettingsDrawer.transitionEasing.easeOut': 'Ease out',
    'slideshowSettingsDrawer.transitionEasing.easeInOut': 'Ease in-out',

    // Tái tổ chức (07/07/2026, phản hồi Giang mục 4) — section cũ "Playlist & Background" TÁCH
    // làm 2: "Playlist" (file này, chỉ còn view/sort) + "Background" (KEY MỚI, xem
    // components/settings/playlist-background.js — nay CHỈ chứa phần Nền).
    // Tái tổ chức (07/07/2026, phản hồi Giang mục 4) — section cũ "Playlist & Background" TÁCH
    // làm 2: "Playlist" (file này, chỉ còn view/sort) + "Background" (components/settings/
    // playlist-background.js — nay CHỈ chứa phần Nền). Mục 3 (MỞ ĐẦU THEME THẬT) — "Background"
    // ĐỔI HẲN thành "Theme" (components/settings/theme.js), 'settingsBackground.sectionTitle' XOÁ
    // (thay bằng 4 key `settingsTheme.*` dưới đây).
    'settingsPlaylistBg.sectionTitle': 'Playlist',
    'settingsTheme.sectionTitle': 'Theme',
    'settingsTheme.light': 'Light',
    'settingsTheme.dark': 'Dark',
    'settingsTheme.background': 'Background',
    'settingsTheme.gradient': 'Gradient',
    'settingsTheme.gradient.label': 'Colors',
    'settingsPlaylistBg.viewMode.label': 'View',
    'settingsPlaylistBg.viewMode.list': 'List',
    'settingsPlaylistBg.viewMode.grid': 'Grid',
    // MỚI (ver12 "Song/Video Unification", Batch 1) — select "Nguồn" (Song/Video).
    'settingsPlaylistBg.mediaSource.label': 'Source',
    'settingsPlaylistBg.mediaSource.song': 'Song',
    'settingsPlaylistBg.mediaSource.video': 'Video',
    'settingsPlaylistBg.sortMode.label': 'Sort',
    'settingsPlaylistBg.sortMode.az': 'Name A → Z',
    'settingsPlaylistBg.sortMode.za': 'Name Z → A',
    // [SỬA — Giang chốt "dùng chung hết" 4 kiểu sort cho CẢ Song lẫn Video] newest/oldest giờ
    // DÙNG CHUNG cho cả 2 nguồn (trước đây RIÊNG cho Video) — 'default' (giữ nguyên thứ tự thêm)
    // ĐÃ XOÁ khỏi option list vì vô nghĩa khi đã có 4 kiểu rõ ràng này.
    'settingsPlaylistBg.sortMode.newest': 'Newest first',
    'settingsPlaylistBg.sortMode.oldest': 'Oldest first',
    // MỚI (phản hồi Giang, mục 5 — "thêm dòng folder đang active source") — dòng đọc-thôi hiển thị
    // thư mục đang Apply làm Scope cho Playlist (components/settings/playlist-view.js).
    'settingsPlaylistBg.activeFolder.label': 'Active folder',
    'settingsPlaylistBg.activeFolder.none': 'None',
    'settingsPlaylistBg.videoEnable.label': 'Use Video Background',
    'settingsPlaylistBg.videoEnable.hint': 'Toggle on to pick a video; toggle off just hides it (kept for next time)',
    'settingsPlaylistBg.videoEnable.blockedByPlayerMode': 'Turn off Video Player mode first (File Manager -> Video) before using a background video.',
    // MỚI (03/07/2026, mục 2) — Ảnh nền tĩnh cho màn Visualizer, KHÁC ảnh nền Playlist ngay dưới.
    'settingsPlaylistBg.visualBgImage.label': 'Use Visualizer background image',
    'settingsPlaylistBg.visualBgImage.hint': 'Toggle on to pick a photo; toggle off just hides it (kept for next time)',
    // Đổi tên (07/07/2026, phản hồi Giang mục 3) — tên cũ "Use playlist background image" không
    // còn đúng bản chất từ sau batch "nền chung" (06/07/2026): ảnh này giờ hiện CẢ Playlist LẪN
    // Settings, không riêng Playlist nữa.
    'settingsPlaylistBg.bgImageEnable.label': 'App background image',
    'settingsPlaylistBg.bgBlur.label': 'Background blur',

    'settingsVisualizer.sectionTitle': 'Visualizer',
    'settingsVisualizer.type.label': 'Effect type',
    'settingsVisualizer.type.bar': 'Bar',
    'settingsVisualizer.type.lightning': 'Lightning',
    'settingsVisualizer.type.rubik': 'Rubik',
    'settingsVisualizer.type.vortex': 'Vortex (Tunnel)',
    'settingsVisualizer.type.blackHole': 'Black Hole',
    'settingsVisualizer.type.rain': 'Rain',
    // MỚI (20/07/2026, plan-space-galaxy.md Phần B) — thêm lại 'space' vào select Kiểu hiệu ứng.
    'settingsVisualizer.type.space': 'Space (Galaxy)',
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
