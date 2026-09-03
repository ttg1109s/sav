/**
 * patch-subtitle-settings.js — patch default-language keys (tiếng Anh), phần subtitleModal + subtitleSettingsDrawer + slideshowSettingsDrawer + settingsPlaylistBg + settingsVisualizer + settingsAudioEq + settingsSubtitleStyle.
 * MỚI (Batch 8, 03/07/2026): namespace `motionSettingsDrawer.*` (Motion Settings Drawer,
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

    // MỚI (Batch 8, 03/07/2026, slideshow nền Visual) — Slideshow Settings Drawer, SAU ĐÓ đổi hẳn
    // thành hệ "Cấu hình Motion" độc lập (29/08/2026) — xem components/motion-settings-drawer.js.
    // Batch D4 (06/07/2026) — 'motionSettingsDrawer.backToSettings.title' XOÁ, dùng CHUNG
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
    // MỚI (29/08/2026) — 3 nút chọn nguồn trực tiếp (thay "Chọn 1"/"Chọn nhóm" + dropdown Kiểu cũ,
    // xem components/visual-bg-settings-drawer.js). Cả 2 picker Video/Ảnh multi-select — nút xác
    // nhận trong header đếm số lượng đã chọn, dùng chung 1 key với {count}.
    'visualBgSettingsDrawer.pickVideo.label': 'Choose video...',
    'visualBgSettingsDrawer.pickPhoto.label': 'Choose photo...',
    'visualBgSettingsDrawer.pickFolder.label': 'Choose folder...',
    'visualBgSettingsDrawer.picker.confirm': 'Select ({count})',
    'visualBgSettingsDrawer.picker.confirmEmpty': 'Select',
    // MỚI (29/08/2026) — tên nguồn hiển thị ở Settings cho 2 originKind gộp nhiều (multi/
    // groupMulti, xem event/workflow/visual-bg.js::_readSourceDisplayName()) — KHÔNG có 1 cái tên
    // đơn lẻ nào để hiện, chỉ đếm số lượng.
    'visualBgSettingsDrawer.sourceLabel.multiVideo': '{count} video selected',
    'visualBgSettingsDrawer.sourceLabel.multiPhoto': '{count} photo selected',
    'visualBgSettingsDrawer.sourceLabel.groupMulti': '{count} folder(s) merged',
    'visualBgSettingsDrawer.refreshSource.title': 'Refresh from source',
    // SỬA (29/08/2026, Giang chốt "so sánh thay đổi phải nhất quán mọi nơi") — 3 key
    // 'refreshSource.result*' cũ đổi tên trung lập 'commitResult.*' — giờ DÙNG CHUNG cho cả nút
    // "Làm tươi" LẪN 3 nút Chọn nguồn mới (Video/Ảnh/Thư mục), không riêng "Làm tươi" nữa (xem
    // `_showCommitResultModal()`, event/workflow/visual-bg.js).
    'visualBgSettingsDrawer.commitResult.changed': '+{added} added, -{removed} removed. {total} item(s) total now.',
    'visualBgSettingsDrawer.commitResult.unchanged': 'No changes — {total} item(s) total.',
    'visualBgSettingsDrawer.commitResult.cleared': 'The source no longer exists — Visual Background has been cleared.',
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
    // MỚI (29/08/2026, dời "Seconds per photo" từ slideshow sang đây, dùng chung video/ảnh) —
    // `durationMode`: 'duration' (mặc định, độ dài TỰ NHIÊN của item — video phát hết thật, ảnh
    // dùng field `duration` RIÊNG của chính nó) hay 'fixtime' (CƯỠNG CHẾ mọi item hiện đúng
    // `durationSeconds` giây, dùng chung 1 số cho mọi item — video chỉ bị cắt nếu THẬT SỰ dài hơn).
    'visualBgSettingsDrawer.durationMode.label': 'Duration mode',
    'visualBgSettingsDrawer.durationMode.duration': 'Natural duration',
    'visualBgSettingsDrawer.durationMode.fixtime': 'Fixed time',
    'visualBgSettingsDrawer.durationSeconds.labelVideo': 'Seconds per video',
    'visualBgSettingsDrawer.durationSeconds.labelPhoto': 'Seconds per photo',
    'visualBgSettingsDrawer.durationSeconds.pickerTitle': 'Seconds per video/photo',
    // XOÁ (29/08/2026) — Album đã bỏ trước đó rồi (albumPicker.* chết từ lâu, dọn luôn nhân dịp sửa
    // khối này) — Photo giờ có Folder thật (chung hạ tầng Song/Video), không còn Album.
    // MỚI (29/08/2026) — nút "Thư mục" giờ multi-select + dropdown đổi loại (Video/Ảnh) ngay trong
    // header picker (xem event/workflow/playlist.js::_buildFolderPickerHeaderHtml()).
    'visualBgSettingsDrawer.folderPicker.title': 'Choose a folder',
    'visualBgSettingsDrawer.folderPicker.typeVideo': 'Video',
    'visualBgSettingsDrawer.folderPicker.typePhoto': 'Photo',
    'visualBgSettingsDrawer.folderPicker.emptyNoFolder.video': 'You have no video folders yet. Create one in File Manager > Folders and add videos to it first.',
    'visualBgSettingsDrawer.folderPicker.emptyNoFolder.photo': 'You have no photo folders yet. Create one in File Manager > Folders and add photos to it first.',
    'visualBgSettingsDrawer.folderPicker.emptyTooFew.video': 'You have video folders, but none holds at least {count} videos yet. A list needs more than one video to rotate through — add more, or pick a video directly instead.',
    'visualBgSettingsDrawer.folderPicker.emptyTooFew.photo': 'You have photo folders, but none holds at least {count} photos yet. A list needs more than one photo to rotate through — add more, or pick a photo directly instead.',
    // XOÁ (29/08/2026) — 'openSlideshow.label'/'openSlideshow.hint' bỏ hẳn cùng hàng UI "Slideshow
    // options..." đã gỡ khỏi panel VBG (Slideshow tách hệ Motion độc lập, System > Slideshow).
    // MỚI (08/08/2026) — sub-panel "Âm thanh Video" (bật/tắt + volume% audio riêng từng video).
    'visualBgSettingsDrawer.openVideoAudio.label': 'Video audio...',
    'visualBgSettingsDrawer.openVideoAudio.hint': 'Per-video sound, mixed under the main audio',
    'visualBgSettingsDrawer.videoAudio.hint': 'Turn on a video\'s own audio to play it alongside the main song, at the volume you set.',
    'visualBgSettingsDrawer.videoAudio.empty': 'No video in the current source yet.',
    // MỚI (08/08/2026, phản hồi Giang mục 2) — tiêu đề modal chọn volume dùng chung (core/slider-input-modal.js).
    'visualBgSettingsDrawer.videoAudio.volumeModal.title': 'Video volume',

    // XOÁ (29/08/2026) — 'motionSettingsDrawer.title' bỏ hẳn (không còn hàm nào gọi — màn Menu
    // dùng 'motionPresetsDrawer.menu.title' ngay dưới thay thế).
    // VIẾT LẠI (Batch 9, 04/07/2026, mục 4) — gộp 2 section cũ ("Album"/"Playback") thành 1; 2 nút
    // "Choose album"/"Turn off" thay bằng 1 toggle "enable" duy nhất + hàng "album đang chạy".
    // SỬA (18/07/2026, phản hồi Giang — "tái cấu trúc panel theo nhóm mục") — 'sectionTitle' (1
    // tiêu đề DUY NHẤT cho cả panel) ĐÃ XOÁ, thay bằng 3 tiêu đề nhóm riêng.
    'motionSettingsDrawer.groupTransition.title': 'Transition',
    // Point Move (thay Ken Burns, phản hồi Giang) — danh sách điểm chuyển động tự định nghĩa.
    'motionSettingsDrawer.groupPointMove.title': 'Point Move',
    // XOÁ (29/08/2026) — 3 key 'interval.*' ("Seconds per photo") bỏ hẳn cùng hàng UI đã dời sang
    // panel VBG cha — xem visualBgSettingsDrawer.durationSeconds.*/durationMode.* ngay dưới.
    // MỚI (29/08/2026, phản hồi Giang) — toggle "Có áp dụng Transition hay không", ĐỘC LẬP với việc
    // chọn hiệu ứng (select ngay dưới LUÔN hiện, kể cả tắt).
    'motionSettingsDrawer.transitionEnabled.label': 'Apply transition',
    'motionSettingsDrawer.transition.label': 'Transition effect',
    'motionSettingsDrawer.transition.fade': 'Fade',
    'motionSettingsDrawer.transition.slide': 'Slide',
    'motionSettingsDrawer.transition.wipe': 'Wipe',
    'motionSettingsDrawer.transition.flipCard': 'Flip card (3D)',
    'motionSettingsDrawer.transition.flipEdge': 'Flip page (3D)',
    'motionSettingsDrawer.transition.zoom': 'Zoom',
    'motionSettingsDrawer.transition.blur': 'Blur cross-fade',
    'motionSettingsDrawer.transition.rotateFade': 'Rotate + fade',
    'motionSettingsDrawer.transition.curtain': 'Curtain',
    'motionSettingsDrawer.transition.circleReveal': 'Circle reveal',
    'motionSettingsDrawer.transition.glitch': 'Glitch',
    'motionSettingsDrawer.transition.whipPan': 'Whip pan',
    'motionSettingsDrawer.transition.spin': 'Spin',
    // MỚI (30/08/2026, phản hồi Giang — gộp type có hướng) — 3 field phụ, mỗi field CHỈ hiện với
    // đúng nhóm type hỗ trợ, xem transitionSupportsDirection()/transitionSupportsZoomDirection()/
    // transitionSupportsSpinDirection() (core/motion-engine.js).
    'motionSettingsDrawer.transitionDirection.label': 'Direction',
    'motionSettingsDrawer.transitionDirection.left': 'Left',
    'motionSettingsDrawer.transitionDirection.right': 'Right',
    'motionSettingsDrawer.transitionDirection.up': 'Up',
    'motionSettingsDrawer.transitionDirection.down': 'Down',
    'motionSettingsDrawer.transitionDirection.random': 'Random',
    'motionSettingsDrawer.transitionZoomDirection.label': 'In/Out',
    'motionSettingsDrawer.transitionZoomDirection.in': 'In',
    'motionSettingsDrawer.transitionZoomDirection.out': 'Out',
    'motionSettingsDrawer.transitionZoomDirection.random': 'Random',
    'motionSettingsDrawer.transitionSpinDirection.label': 'Spin direction',
    'motionSettingsDrawer.transitionSpinDirection.clockwise': 'Clockwise',
    'motionSettingsDrawer.transitionSpinDirection.counterclockwise': 'Counterclockwise',
    'motionSettingsDrawer.transitionSpinDirection.random': 'Random',
    // BỔ SUNG (30/08/2026, phản hồi Giang — "thêm direction cho wipe"/"thêm cho Curtain direction")
    // — 2 field RIÊNG (left/right/up/down/random của wipe DÙNG LẠI key transitionDirection.* có
    // sẵn ngay trên — KHÔNG lặp lại nhãn, chỉ 4 hướng CHÉO mới cần key riêng).
    'motionSettingsDrawer.transitionWipeDirection.cornerTopLeft': 'Top-left corner',
    'motionSettingsDrawer.transitionWipeDirection.cornerTopRight': 'Top-right corner',
    'motionSettingsDrawer.transitionWipeDirection.cornerBottomLeft': 'Bottom-left corner',
    'motionSettingsDrawer.transitionWipeDirection.cornerBottomRight': 'Bottom-right corner',
    'motionSettingsDrawer.transitionCurtainDirection.horizontal': 'Horizontal',
    'motionSettingsDrawer.transitionCurtainDirection.vertical': 'Vertical',
    'motionSettingsDrawer.transitionCurtainDirection.diagonalRight': 'Diagonal right',
    'motionSettingsDrawer.transitionCurtainDirection.diagonalLeft': 'Diagonal left',
    // MỚI (30/08/2026, phản hồi Giang) — 2 field phụ CHỈ hiện khi transitionType là 'flipEdge', xem
    // event/workflow/motion-presets.js::_syncEditUI().
    'motionSettingsDrawer.edgeFlipVariant.label': 'Flip page style',
    'motionSettingsDrawer.edgeFlipVariant.open': 'Open',
    'motionSettingsDrawer.edgeFlipVariant.close': 'Close',
    // SỬA (30/08/2026, phản hồi Giang — đổi chữ "old" thành "before") — CHỈ đổi CHỮ hiển thị,
    // field JS vẫn tên `edgeFlipStaticOld` (không đổi, tránh xáo trộn không cần thiết).
    'motionSettingsDrawer.edgeFlipStaticOld.label': 'Keep before image still',
    // Point Move (thay Ken Burns, phản hồi Giang) — danh sách điểm chuyển động NGƯỜI DÙNG tự định
    // nghĩa (Linear X/Y, Rotate, Zoom, Flip X/Y), thay cho 13 chế độ Ken Burns cố định.
    'motionSettingsDrawer.pointMove.list.label': 'Point moves',
    'motionSettingsDrawer.pointMove.list.count': '{n} point move',
    'motionSettingsDrawer.pointMove.runMode.label': 'Run mode',
    'motionSettingsDrawer.pointMove.runMode.all': 'All move',
    'motionSettingsDrawer.pointMove.runMode.one': 'One move',
    'motionSettingsDrawer.pointMove.oneOrder.label': 'Pick order',
    'motionSettingsDrawer.pointMove.oneOrder.sequential': 'Sequential',
    'motionSettingsDrawer.pointMove.oneOrder.random': 'Random',
    'motionSettingsDrawer.pointMove.timing.label': 'Timing',
    'motionSettingsDrawer.pointMove.timing.hint': 'Drag each point to set when (left-right) and how strongly (up-down) it applies — or type exact numbers below.',
    'motionSettingsDrawer.pointMove.timing.xLabel': 'Time %',
    'motionSettingsDrawer.pointMove.timing.yLabel': 'Intensity',
    'motionSettingsDrawer.pointMove.add.label': 'Add point move',
    'motionSettingsDrawer.pointMove.itemName': 'Point move {n}',
    'motionSettingsDrawer.pointMove.edit.title': 'Edit point move',
    'motionSettingsDrawer.pointMove.field.mode.single': 'Single',
    'motionSettingsDrawer.pointMove.field.mode.randomRange': 'Random range',
    'motionSettingsDrawer.pointMove.field.linearX': 'Linear X',
    'motionSettingsDrawer.pointMove.field.linearY': 'Linear Y',
    'motionSettingsDrawer.pointMove.field.rotate': 'Rotate',
    'motionSettingsDrawer.pointMove.field.zoom': 'Zoom',
    'motionSettingsDrawer.pointMove.field.flipX': 'Flip X',
    'motionSettingsDrawer.pointMove.field.flipY': 'Flip Y',

    // MỚI (18/07/2026, phản hồi Giang — "thêm thời gian transition giữa 2 ảnh"). XOÁ
    // 'transitionDuration.hint' — dòng phụ dưới nhãn đã bỏ khỏi template.
    'motionSettingsDrawer.transitionDuration.label': 'Transition duration',
    'motionSettingsDrawer.transitionDuration.pickerTitle': 'Transition duration',
    'motionSettingsDrawer.transitionRatio.label': 'In/Out ratio',
    // Nhãn xem trước SỐNG — {in}/{out} tính lại mỗi lần kéo slider (xem
    // event/workflow/motion-presets.js::_updateTransitionRatioLabel()), KHÁC key .label tĩnh
    // ngay trên.
    'motionSettingsDrawer.transitionRatio.previewFormat': 'In {in}s / Out {out}s',
    'motionSettingsDrawer.transitionEasing.label': 'Easing',
    'motionSettingsDrawer.transitionEasing.linear': 'Linear (no easing)',
    'motionSettingsDrawer.transitionEasing.ease': 'Ease',
    'motionSettingsDrawer.transitionEasing.easeIn': 'Ease in',
    'motionSettingsDrawer.transitionEasing.easeOut': 'Ease out',
    'motionSettingsDrawer.transitionEasing.easeInOut': 'Ease in-out',

    // MỚI (29/08/2026, phản hồi Giang — hệ "Cấu hình Motion" độc lập, xem event/workflow/
    // motion-presets.js/components/motion-settings-drawer.js). Lối vào DUY NHẤT: System >
    // Motion — 2 mục con "Quản lý cấu hình"/"Áp dụng cấu hình". SỬA (29/08/2026, phản hồi Giang —
    // "tránh nhầm giữa tên mục Settings với chế độ Playback 'Slideshow' của VBG") — namespace
    // 'slideshowSettingsDrawer'/'slideshowPresetsDrawer' cũ đổi hẳn thành 'motionSettingsDrawer'/
    // 'motionPresetsDrawer' — Slideshow (chế độ Playback: perSong/slideshow, xem
    // visualBgSettingsDrawer.listPlaybackMode.slideshow ngay trên) KHÔNG đổi, vẫn "Slideshow" —
    // 2 khái niệm khác nhau, giờ khác tên hẳn, không còn trùng chữ.
    'motionPresetsDrawer.menu.title': 'Motion',
    'motionPresetsDrawer.menu.manage.label': 'Manage configurations',
    'motionPresetsDrawer.menu.manage.hint': 'Create, edit, or delete motion configurations',
    'motionPresetsDrawer.menu.apply.label': 'Apply configuration',
    'motionPresetsDrawer.menu.apply.hint': 'Choose which configuration each place uses',
    'motionPresetsDrawer.defaultName': 'Motion {n}',
    'motionPresetsDrawer.migratedName': 'Default',
    'motionPresetsDrawer.list.pickTitle': 'Choose a configuration',
    'motionPresetsDrawer.list.add.label': 'Add new configuration',
    'motionPresetsDrawer.list.delete.title': 'Delete',
    'motionPresetsDrawer.list.emptyManage': 'No configurations yet — add one to get started.',
    'motionPresetsDrawer.list.emptyPick': 'No configurations yet — create one under "Manage configurations" first.',
    'motionPresetsDrawer.edit.title': 'Edit configuration',
    'motionPresetsDrawer.edit.groupManage.title': 'Manage',
    'motionPresetsDrawer.edit.nameLabel': 'Name',
    'motionPresetsDrawer.edit.namePlaceholder': 'Configuration name',
    'motionPresetsDrawer.edit.reset.label': 'Reset to defaults',
    'motionPresetsDrawer.edit.delete.label': 'Delete this configuration',
    'motionPresetsDrawer.apply.photoVisualBg.label': 'Photo visual background',
    'motionPresetsDrawer.apply.notAttached': 'Not attached',
    'motionPresetsDrawer.apply.currentLabel': 'Current configuration',
    'motionPresetsDrawer.apply.detach.label': 'Detach',
    'motionPresetsDrawer.apply.pickButton': 'Choose configuration',

    // MỚI (29/08/2026, phản hồi Giang) — "React Beat Audio": pulse zoom/pan/rotate bắn theo beat nhạc.
    'motionPresetsDrawer.beatReact.groupTitle': 'React Beat Audio',
    'motionPresetsDrawer.beatReact.enabled.label': 'React to beat',
    'motionPresetsDrawer.beatReact.zoom.title': 'Zoom',
    'motionPresetsDrawer.beatReact.zoom.maxLabel': 'Zoom max',
    'motionPresetsDrawer.beatReact.pan.title': 'Pan',
    'motionPresetsDrawer.beatReact.pan.maxLabel': 'Pan max',
    'motionPresetsDrawer.beatReact.rotate.title': 'Rotate',
    'motionPresetsDrawer.beatReact.rotate.maxLabel': 'Rotate max',
    'motionPresetsDrawer.beatReact.direction.label': 'Direction',
    'motionPresetsDrawer.beatReact.reverse.label': 'Reverse (flip starting side)',
    'motionPresetsDrawer.beatReact.direction.left': 'Left only',
    'motionPresetsDrawer.beatReact.direction.right': 'Right only',
    'motionPresetsDrawer.beatReact.direction.leftToRight': 'Left \u2192 Right',
    'motionPresetsDrawer.beatReact.direction.rightToLeft': 'Right \u2192 Left',

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
    // SỬA (29/08/2026) — 1 message chung 'blockedBySourceVideo' cũ tách thành 2, ĐÚNG lý do chặn
    // thật (event/block.js dùng `groupNotify`, xem docstring registerBlock() — event/bus.js) — bug
    // gốc: message cũ luôn nói "đổi Playlist về Song" dù đôi khi Playlist ĐÃ ở Song (lý do chặn thật
    // là video nền vẫn đang phát, không phải sai Nguồn).
    'visualBgSettingsDrawer.blockedByNotSongSource': 'Visual Background only works while your Playlist source is set to Songs. Switch the Playlist source to Songs first.',
    'visualBgSettingsDrawer.blockedByVideoPlaying': 'A background video is still playing. Wait for it to finish, or change song, before picking a new source.',
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
    // Settings. 7 key .type.bar/.../.lighting (dùng ở VISUALIZER_TYPE_LABEL_KEYS, core/
    // visualizer/visualizer-display.js + Custom Effect Drawer, core/custom-effect.js).
    'settingsVisualizer.type.bar': 'Bar',
    'settingsVisualizer.type.rubik': 'Rubik',
    'settingsVisualizer.type.vortex': 'Vortex (Tunnel)',
    'settingsVisualizer.type.blackHole': 'Black Hole',
    'settingsVisualizer.type.rain': 'Rain',
    'settingsVisualizer.type.space': 'Space (Galaxy)',
    'settingsVisualizer.type.lighting': 'Lighting',
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
