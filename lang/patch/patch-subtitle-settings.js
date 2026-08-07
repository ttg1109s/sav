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
    // ===================== MỚI (v13 Batch A) — namespace `visualBgSettingsDrawer.*` =========
    // Panel "Visual Background" — GỘP 3 tính năng nền màn Visualizer (video nền loop / ảnh nền
    // tĩnh / slideshow album) thành 1. 3 key `settingsPlaylistBg.videoEnable.*` +
    // `settingsPlaylistBg.visualBgImage.*` + `settingsVisualizer.slideshowSetting.*` cũ ĐÃ XOÁ
    // (2 toggle + 1 nút tương ứng không còn tồn tại trong Settings).
    'settingsVisualizer.visualBg.label': 'Visual Background',
    'settingsVisualizer.visualBg.hint': 'Photo or video behind the visualizer',
    'visualBgSettingsDrawer.title': 'Visual Background',
    'visualBgSettingsDrawer.groupSource.title': 'Source',
    'visualBgSettingsDrawer.groupColor.title': 'Background colour',
    'visualBgSettingsDrawer.type.label': 'Type',
    'visualBgSettingsDrawer.type.photo': 'Photo',
    'visualBgSettingsDrawer.type.video': 'Video',
    'visualBgSettingsDrawer.colorMode.label': 'Colour style',
    'visualBgSettingsDrawer.colorMode.solid': 'Solid',
    'visualBgSettingsDrawer.colorMode.gradient': 'Gradient',
    'visualBgSettingsDrawer.solidColor.label': 'Background colour',
    'visualBgSettingsDrawer.gradientAngle.label': 'Gradient angle',
    'visualBgSettingsDrawer.openGradient.label': 'Gradient settings...',
    'visualBgSettingsDrawer.gradientStops.label': 'Colour stops (2-7)',
    'visualBgSettingsDrawer.gradientStops.add': '+ Add stop',
    'visualBgSettingsDrawer.pickSingle.photo': 'Choose one photo...',
    'visualBgSettingsDrawer.pickSingle.video': 'Choose one video...',
    'visualBgSettingsDrawer.pickGroup.photo': 'Choose an album...',
    'visualBgSettingsDrawer.pickGroup.video': 'Choose a folder...',
    'visualBgSettingsDrawer.refreshSource.title': 'Refresh from source',
    'visualBgSettingsDrawer.refreshSource.result': 'Refreshed: +{added} added, -{removed} removed. {total} item(s) total now.',
    'visualBgSettingsDrawer.refreshSource.resultUnchanged': 'Refreshed: no changes. {total} item(s) total.',
    'visualBgSettingsDrawer.refreshSource.resultCleared': 'The source no longer exists — Visual Background has been cleared.',
    'visualBgSettingsDrawer.pickSource.none': 'Not selected yet',
    'visualBgSettingsDrawer.listPlaybackMode.label': 'Playback',
    'visualBgSettingsDrawer.listPlaybackMode.perSong': 'One per song',
    'visualBgSettingsDrawer.listPlaybackMode.slideshow': 'Slideshow',
    'visualBgSettingsDrawer.nextOrder.label': 'Next item order',
    'visualBgSettingsDrawer.nextOrder.random': 'Random',
    'visualBgSettingsDrawer.nextOrder.sequential': 'Sequential',
    'visualBgSettingsDrawer.nextOrder.playlist': 'Follow Playlist',
    'visualBgSettingsDrawer.albumPicker.title': 'Choose an album',
    'visualBgSettingsDrawer.albumPicker.empty': 'No album has more than one photo yet. Add photos in Photo & Album first.',
    'visualBgSettingsDrawer.folderPicker.title': 'Choose a video folder',
    'visualBgSettingsDrawer.folderPicker.emptyNoFolder': 'You have no video folders yet. Create one in File Manager > Folders and add videos to it first.',
    'visualBgSettingsDrawer.folderPicker.emptyTooFew': 'You have video folders, but none holds at least {count} videos yet. A list needs more than one video to rotate through — add more, or pick a single video instead.',
    'visualBgSettingsDrawer.openSlideshow.label': 'Slideshow options...',
    'visualBgSettingsDrawer.openSlideshow.hint': 'Transition + Ken Burns',

    'slideshowSettingsDrawer.title': 'Slideshow Background',
    // VIẾT LẠI (Batch 9, 04/07/2026, mục 4) — gộp 2 section cũ ("Album"/"Playback") thành 1; 2 nút
    // "Choose album"/"Turn off" thay bằng 1 toggle "enable" duy nhất + hàng "album đang chạy".
    // SỬA (18/07/2026, phản hồi Giang — "tái cấu trúc panel theo nhóm mục") — 'sectionTitle' (1
    // tiêu đề DUY NHẤT cho cả panel) ĐÃ XOÁ, thay bằng 3 tiêu đề nhóm riêng.
    'slideshowSettingsDrawer.groupTransition.title': 'Transition',
    'slideshowSettingsDrawer.groupKenBurns.title': 'Ken Burns',
    // MỚI (04/07/2026, mục 5 phản hồi Giang).
    'slideshowSettingsDrawer.interval.label': 'Seconds per photo',
    'slideshowSettingsDrawer.interval.hint': 'Minimum 5 seconds — transition below is always kept shorter than this',
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
    // MỚI (phản hồi Giang, mục 2 — "có folder active thì phải ẩn/block đổi Nguồn") — tooltip giải
    // thích lý do <select> bị khoá khi đang Apply 1 folder làm Scope cho Playlist.
    'settingsPlaylistBg.mediaSource.lockedByFolderScope': 'Turn off the active folder scope before changing Source.',
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
    // SỬA (phản hồi Giang, mục 4 — "Use video background chưa block nếu source là video") — dùng
    // CHUNG cho CẢ 2 lý do chặn (event/block.js không hỗ trợ notify riêng theo từng điều kiện) —
    // bỏ luôn tham chiếu "(File Manager -> Video)" đã lỗi thời (panel đó xoá hẳn từ Batch 6).
    'visualBgSettingsDrawer.blockedDeleteInUse': 'This item is currently used as your Visual Background. Open Settings > Visualizer > Visual Background and tap Release source first.',
    'visualBgSettingsDrawer.blockedBySourceVideo': 'Your Playlist is set to Video. While playing videos they fill the whole screen, so Visual Background cannot show. Switch the Playlist source back to Songs first.',
    'visualBgSettingsDrawer.blockedByVisualBgOn': 'Visual Background is on. Videos play full screen, so they would cover it. Turn Visual Background off first.',
    'visualBgSettingsDrawer.keptDeleteInUse': 'One item was kept because it is currently used as your Visual Background. Release it in Settings > Visualizer > Visual Background to delete it.',
    'visualBgSettingsDrawer.clearSource.title': 'Release source',
    // MỚI (03/07/2026, mục 2) — Ảnh nền tĩnh cho màn Visualizer, KHÁC ảnh nền Playlist ngay dưới.
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
