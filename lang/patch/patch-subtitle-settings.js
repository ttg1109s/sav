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
    // XOÁ (mục 2, phản hồi Giang — "loại bỏ toàn bộ khung box, xoá toàn bộ tuỳ chọn") — 10 key
    // style khung/chữ (sectionTitle/bgColor/bgOpacity/borderColor/borderOpacity/borderWidth/
    // borderRadius/textColor/fontSize/lineHeight/letterSpacing) ĐÃ XOÁ HẾT — panel con giờ CHỈ
    // còn 1 toggle, dùng LẠI 'settingsSubtitleStyle.enable.*' có sẵn (xem cuối file). 'title' GIỮ
    // NGUYÊN (panel con vẫn cần tên hiển thị trên header).
    'subtitleSettingsDrawer.title': 'Subtitles',

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
    'settingsVisualizer.gesture.label': 'Gestures',
    'settingsVisualizer.gesture.hint': 'Swipe/tap controls on the Visualizer screen',
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
    // MỚI (12/08/2026, Giang yêu cầu mục 6 — "Movement") — gradient tự xoay/dao động theo thời
    // gian HOẶC theo nhạc, + tráo màu ngẫu nhiên định kỳ.
    'visualBgSettingsDrawer.gradientMovement.label': 'Movement',
    'visualBgSettingsDrawer.gradientMovement.enable.label': 'Enable movement',
    'visualBgSettingsDrawer.gradientMovement.enable.hint': 'Animates the gradient angle (and stop spread in audio mode) instead of holding it still',
    'visualBgSettingsDrawer.gradientMovement.mode.label': 'Movement mode',
    'visualBgSettingsDrawer.gradientMovement.mode.time': 'Steady rotation',
    'visualBgSettingsDrawer.gradientMovement.mode.audio': 'Audio-reactive',
    'visualBgSettingsDrawer.gradientMovement.duration.label': 'Full rotation every',
    'visualBgSettingsDrawer.gradientMovement.duration.pickerTitle': 'Full rotation time',
    'visualBgSettingsDrawer.gradientMovement.audioRotate.label': 'Rotation range (°)',
    'visualBgSettingsDrawer.gradientMovement.audioSpread.label': 'Stop spread range (%)',
    'visualBgSettingsDrawer.gradientMovement.rangeFrom': 'From',
    'visualBgSettingsDrawer.gradientMovement.rangeTo': 'To',
    'visualBgSettingsDrawer.gradientMovement.colorSwapSectionTitle': 'Color swap',
    'visualBgSettingsDrawer.gradientMovement.colorSwapEnable.label': 'Enable color swap',
    'visualBgSettingsDrawer.gradientMovement.colorSwapEnable.hint': 'Randomly swaps which stop gets which color, on a timer, with a smooth crossfade',
    'visualBgSettingsDrawer.gradientMovement.colorSwapInterval.label': 'Swap every',
    'visualBgSettingsDrawer.gradientMovement.colorSwapInterval.pickerTitle': 'Color swap interval',
    'visualBgSettingsDrawer.gradientMovement.colorSwapTransition.label': 'Crossfade duration',
    'visualBgSettingsDrawer.gradientMovement.colorSwapTransition.pickerTitle': 'Crossfade duration',
    'visualBgSettingsDrawer.pickSingle.photo': 'Choose one photo...',
    'visualBgSettingsDrawer.pickSingle.video': 'Choose one video...',
    'visualBgSettingsDrawer.pickGroup.photo': 'Choose an album...',
    'visualBgSettingsDrawer.pickGroup.video': 'Choose a folder...',
    'visualBgSettingsDrawer.refreshSource.title': 'Refresh from source',
    'visualBgSettingsDrawer.refreshSource.result': 'Refreshed: +{added} added, -{removed} removed. {total} item(s) total now.',
    'visualBgSettingsDrawer.refreshSource.resultUnchanged': 'Refreshed: no changes. {total} item(s) total.',
    'visualBgSettingsDrawer.refreshSource.resultCleared': 'The source no longer exists — Visual Background has been cleared.',
    // MỚI (09/08/2026, cơ chế pending) — modal thông báo khi chọn nguồn mới/Làm tươi TRONG LÚC
    // đang có photo/video active: nguồn mới KHÔNG áp ngay, xếp hàng chờ đúng "lượt kế tiếp" (video
    // hiện tại phát hết, hoặc ảnh chuyển cảnh kế) mới thay hẳn — 2 bản riêng theo ngữ cảnh type.
    'visualBgSettingsDrawer.pendingSource.photo': 'Got it — the new source will take effect starting from the next photo.',
    'visualBgSettingsDrawer.pendingSource.video': 'Got it — the new source will take effect once the current video finishes.',
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
    'visualBgSettingsDrawer.openSlideshow.hint': 'Transition + Photo Movement',
    // MỚI (08/08/2026) — sub-panel "Âm thanh Video" (bật/tắt + volume% audio riêng từng video).
    'visualBgSettingsDrawer.openVideoAudio.label': 'Video audio...',
    'visualBgSettingsDrawer.openVideoAudio.hint': 'Per-video sound, mixed under the main audio',
    'visualBgSettingsDrawer.videoAudio.hint': 'Turn on a video\'s own audio to play it alongside the main song, at the volume you set.',
    'visualBgSettingsDrawer.videoAudio.empty': 'No video in the current source yet.',
    // MỚI (08/08/2026, phản hồi Giang mục 2) — tiêu đề modal chọn volume dùng chung (core/slider-input-modal.js).
    'visualBgSettingsDrawer.videoAudio.volumeModal.title': 'Video volume',

    'slideshowSettingsDrawer.title': 'Slideshow Background',
    // VIẾT LẠI (Batch 9, 04/07/2026, mục 4) — gộp 2 section cũ ("Album"/"Playback") thành 1; 2 nút
    // "Choose album"/"Turn off" thay bằng 1 toggle "enable" duy nhất + hàng "album đang chạy".
    // SỬA (18/07/2026, phản hồi Giang — "tái cấu trúc panel theo nhóm mục") — 'sectionTitle' (1
    // tiêu đề DUY NHẤT cho cả panel) ĐÃ XOÁ, thay bằng 3 tiêu đề nhóm riêng.
    'slideshowSettingsDrawer.groupTransition.title': 'Transition',
    'slideshowSettingsDrawer.groupKenBurns.title': 'Photo Movement',
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
    'slideshowSettingsDrawer.kenBurns.label': 'Photo Movement',
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
    // MỚI (hợp nhất Photo vào Playlist).
    'settingsPlaylistBg.mediaSource.photo': 'Photo',
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
    // MỚI (mục 1d, Filter subpanel) — nút mở panel "Lọc" (Settings → Playlist).
    'settingsPlaylistBg.filter.label': 'Filter',
    // XOÁ (mục 1a, phản hồi Giang — "bỏ row active folder -> thêm vào dropdown của source") —
    // 'settingsPlaylistBg.activeFolder.label' (label của dòng đọc-thôi cũ) ĐÃ XOÁ — dòng đó không
    // còn tồn tại. '.none' GIỮ NGUYÊN — vẫn dùng làm text hiển thị khi record folder không đọc
    // được (core/playlist/main.js::updateActiveFolderUI()).
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

    'settingsVisualizer.sectionTitle': 'Visualizer Screen',
    // Đổi hiệu ứng qua #btn-cycle-mode/Action ở Control Center — không còn select "Effect type" ở
    // Settings. 7 key .type.bar/.../.space GIỮ NGUYÊN (dùng ở VISUALIZER_TYPE_LABEL_KEYS, core/
    // visualizer/visualizer-display.js + Custom Effect Drawer, core/custom-effect.js).
    'settingsVisualizer.type.bar': 'Bar',
    'settingsVisualizer.type.lightning': 'Lightning',
    'settingsVisualizer.type.rubik': 'Rubik',
    'settingsVisualizer.type.vortex': 'Vortex (Tunnel)',
    'settingsVisualizer.type.blackHole': 'Black Hole',
    'settingsVisualizer.type.rain': 'Rain',
    'settingsVisualizer.type.space': 'Space (Galaxy)',
    // MỚI (12/08/2026, mục 4f) — "Auto-Switch Effect", tách thành panel RIÊNG ngang hàng "Customize
    // Visualizer" — panel body: components/settings/visualizer-auto-switch-drawer.js.
    'settingsVisualizer.openAutoSwitch.label': 'Auto-Switch Effect',
    'settingsVisualizer.openAutoSwitch.hint': 'Automatically cycle through effects over time',
    'settingsVisualizer.visualEnable.label': 'Show visual',
    'settingsVisualizer.visualEnable.hint': 'Turn off to show only the background (video/image/color), hiding the visualizer effect without touching Video Background.',
    // MỚI (12/08/2026, mục 4b) — hàng "Làm mờ" MỚI, đứng NGAY SAU "Show visual" — dời từ card
    // "Custom Effect" (trước đây "Visualizer Geometry") sang ĐÂY, DÙNG LẠI ĐÚNG key
    // visualizerSettingsDrawer.blurEnable.* (không tạo key trùng nghĩa).
    // MỚI (Batch 8, 03/07/2026, slideshow nền Visual) — nút mở Slideshow Settings Drawer.

    // settingsAudioEq.* (UI Settings Volume/EQ tĩnh cũ) ĐÃ XOÁ HẲN — chuyển sang Control Center
    // (Volume HUD + EQ preset cycle/edit), xem lang/patch/patch-visualizer.js (eqPresets.*/
    // visualizerOverlay.volume.*/cycleEq.*).

    'settingsSubtitleStyle.sectionTitle': 'Subtitles',
    'settingsSubtitleStyle.enable.label': 'Show subtitles',
    'settingsSubtitleStyle.enable.hint': "Turn off to hide subtitles during playback, without deleting what you've written.",
    // MỚI (15/08/2026, mục 4a) — nút "Styling" trong panel con Phụ đề, mở Element Style Editor.
    'settingsSubtitleStyle.styling.label': 'Styling',
    'settingsSubtitleStyle.styling.hint': 'Customize the box that wraps subtitle lines (size, spacing, border, background...)',
    // MỚI (16/08/2026, mục 3 — Giang yêu cầu "toggle tuỳ chọn sử dụng hiển thị mặc định").
    'settingsSubtitleStyle.useCustom.label': 'Custom styling',
    'settingsSubtitleStyle.useCustom.hint': 'Turn on to customize the subtitle box via Styling below. Off uses the default look (font size + color adjustable underneath).',
    'settingsSubtitleStyle.defaultFontSize.label': 'Font size',
    'settingsSubtitleStyle.defaultColor.label': 'Text color',

    // MỚI (15/08/2026, mục 4b) — Comming/In/Outing, xem components/subtitle-settings-drawer.js
    // (_renderSubtitleTransitionSection()) + core/subtitle/subtitle-transition.js.
    'settingsSubtitleStyle.transition.sectionTitle': 'Entrance / Exit',
    'settingsSubtitleStyle.transition.hint': 'Value in seconds (± up to 5s). Actual effect is capped at 1/3 of each line\'s duration.',
    'settingsSubtitleStyle.comming.label': 'Comming',
    'settingsSubtitleStyle.in.label': 'In',
    'settingsSubtitleStyle.outing.label': 'Outing',
    'settingsSubtitleStyle.effect.none': 'None',
    'settingsSubtitleStyle.effect.fade': 'Fade',
    'settingsSubtitleStyle.effect.slide-up': 'Slide up',
    'settingsSubtitleStyle.effect.slide-down': 'Slide down',
    'settingsSubtitleStyle.effect.scale': 'Scale',
    'settingsSubtitleStyle.effect.pulse': 'Pulse',
    'settingsSubtitleStyle.effect.glow': 'Glow',
    // XOÁ (mục 2) — 'settingsSubtitleStyle.openDrawer.label'/'.hint' (nút "Tuỳ chỉnh" cũ mở drawer
    // 10 style) — panel con giờ chỉ có 1 toggle, mở thẳng qua nút trong panel "Display"
    // (visualizerDisplayPanel.title dùng chung, KHÔNG cần label/hint riêng — xem components/
    // settings/visualizer-display-panel.js, tái dùng 'settingsSubtitleStyle.sectionTitle'/
    // '.enable.hint' làm label/hint cho chính nút đó).

    // MỚI (mục 1b/1c, Sort subpanel) — panel "Sắp xếp": 2 trục. SỬA (mục 3, phản hồi Giang — "đổi
    // tên Listening stats thành Stats, tách field/hướng thành 2 dropdown riêng") — statMode.* (1
    // enum gộp field+hướng, 9 giá trị) ĐÃ XOÁ, thay bằng statField.* (5 giá trị, dropdown 1) +
    // statDirection.* (2 giá trị, dropdown 2, CHỈ hiện khi field khác 'none').
    'playlistSortPanel.title': 'Sort',
    'playlistSortPanel.nameMode.label': 'Name / date',
    'playlistSortPanel.statField.label': 'Stats',
    'playlistSortPanel.statField.none': 'None (use Name/date)',
    'playlistSortPanel.statField.count': 'Play count',
    'playlistSortPanel.statField.times': 'Listen time',
    'playlistSortPanel.statField.size': 'File size',
    'playlistSortPanel.statField.duration': 'Duration',
    'playlistSortPanel.statField.hint': 'When set, this decides the order first — Name/date only breaks ties.',
    'playlistSortPanel.statDirection.label': 'Order',
    'playlistSortPanel.statDirection.desc': 'High → low',
    'playlistSortPanel.statDirection.asc': 'Low → high',

    // MỚI (mục 1d, Filter subpanel) — panel "Lọc": field theo Nguồn, mô phỏng SQL WHERE...AND.
    'playlistFilterPanel.title': 'Filter',
    'playlistFilterPanel.field.name': 'Name',
    'playlistFilterPanel.field.album': 'Album',
    'playlistFilterPanel.field.artist': 'Artist',
    'playlistFilterPanel.field.addedAt': 'Date added',
    'playlistFilterPanel.field.count': 'Play count',
    'playlistFilterPanel.field.totalTime': 'Listen time',
    'playlistFilterPanel.field.duration': 'Duration',
    'playlistFilterPanel.field.size': 'File size (MB)',
    'playlistFilterPanel.op.eq': 'Is',
    'playlistFilterPanel.op.neq': 'Is not',
    'playlistFilterPanel.op.contains': 'Contains',
    'playlistFilterPanel.op.notContains': 'Does not contain',
    'playlistFilterPanel.mode.single': 'Single value',
    'playlistFilterPanel.mode.range': 'In range',
    // MỚI (15/08/2026, Giang yêu cầu "thêm in range và out range cho khoảng") — phủ định của
    // 'range': khớp bản ghi NẰM NGOÀI [from, to], xem _evaluateFilterRule() core/playlist/filter.js.
    'playlistFilterPanel.mode.outRange': 'Out of range',
    'playlistFilterPanel.rangeFrom': 'From',
    'playlistFilterPanel.rangeTo': 'To',
    'playlistFilterPanel.apply': 'Apply',
    'playlistFilterPanel.hint': 'Every field turned on is combined with AND. Changes are saved now — reload to see the filtered list.',
    'playlistFilterPanel.reloadPrompt': 'Filter saved. Reload now to apply it to your Playlist?',

};
