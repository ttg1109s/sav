/**
 * patch-visualizer.js — patch default-language keys (tiếng Anh), phần visualizerOverlay + visualizerSettingsDrawer + loadingShield.
 *
 * Đây KHÔNG phải file JSON: project chạy qua file://, không thể fetch() file tĩnh, nên các
 * "patch" default-language được viết thành .js gán vào 1 biến global, để core/../lang.js (nay đã
 * dời sang /lang/lang.js) gom lại bằng Object.assign(). File này CHỈ chứa dữ liệu (key -> chuỗi
 * tiếng Anh), không chứa logic.
 *
 * Nạp TRƯỚC /lang/lang.js (xem index.html, khối nạp /lang/patch/*.js đứng trước /lang/lang.js).
 */
const LANG_PATCH_VISUALIZER = {
    'visualizerOverlay.btnBackPlaylist.title': 'Back to list',
    'visualizerOverlay.btnControlCenter.title': 'Quick controls',
    'videoPlayer.untitled': 'Untitled video',
    // MỚI (ver12 "Song/Video Unification", Batch 2) — Block gate notify, xem event/block.js.
    'videoPlayer.startFromPlaylist.blockedByBgVideo': 'Turn off "Use Video Background" first (Settings) before playing a video from the Playlist.',
    'visualizerOverlay.cycleMode.title': 'Change effect',
    'visualizerOverlay.cycleMode.label': 'Effect',
    'visualizerOverlay.shuffle.title': 'Shuffle',
    'visualizerOverlay.shuffle.label': 'Shuffle',
    'visualizerOverlay.repeat.title': 'Repeat',
    'visualizerOverlay.repeat.label': 'Repeat',
    // MỚI (04/07/2026, tính năng Documents) — nút mở Reader trong Control Center.
    'visualizerOverlay.documentReader.title': 'Open document reader',
    'visualizerOverlay.documentReader.label': 'Reader',
    // MỚI (10/08/2026) — chụp khung hình bgVideoElement đang phát, lưu vào Photo. Chỉ hiện lúc
    // Video Player mode. (statsToggle.* ĐÃ XOÁ — toggle dời vào Settings, xem statsPanelEnable.*.)
    'visualizerOverlay.captureFrame.title': 'Capture frame as photo',
    'visualizerOverlay.captureFrame.label': 'Capture',
    'visualizerOverlay.volume.title': 'Volume',
    'visualizerOverlay.volume.label': 'Volume',
    'visualizerOverlay.cycleEq.title': 'Tap to switch EQ preset, hold 1.5s to edit',
    'visualizerOverlay.cycleEq.label': 'EQ preset',
    'eqPresets.title': 'EQ presets',
    'eqPresets.addButton.title': 'New preset',
    'eqPresets.defaultNewPresetName': 'New preset',
    'eqPresets.editTitle': 'Edit preset',
    'eqPresets.resetButton.title': 'Restore original values',
    'eqPresets.save': 'Save',
    'eqPresets.apply': 'Apply',
    'eqPresets.name.label': 'Name',
    'eqPresets.lockedHint': 'Default is read-only and cannot be edited or deleted.',
    'eqPresets.delete': 'Delete preset',
    'videoPlayer.captureFrame.success': 'Photo saved to your library.',
    'videoPlayer.captureFrame.failed': 'Could not capture this frame.',

    'visualizerSettingsDrawer.backToSettings.title': 'Back to Settings',
    'visualizerSettingsDrawer.title': 'Customize Visualizer',
    // FIX (12/08/2026, Giang yêu cầu tái cấu trúc Setting Main mục 4c/4d/4b) — "Visualizer
    // geometry" (card này) ĐÃ RỜI HẲN khỏi panel "Customize Visualizer", giờ là panel RIÊNG "Custom
    // Effect" (components/settings/visualizer-custom-effect-drawer.js, key title MỚI
    // visualizerCustomEffectDrawer.title bên dưới) — geometrySectionTitle GIỮ LẠI (không xoá,
    // KHÔNG còn nơi nào dùng) chỉ để đối chiếu lịch sử. quality.*/blurEnable.* GIỮ NGUYÊN — 2 hàng
    // đó dời sang card "Visualizer Screen" ở Main (components/settings/
    // visualizer-geometry-color.js), DÙNG LẠI ĐÚNG 2 key này, không tạo trùng.
    'visualizerSettingsDrawer.geometrySectionTitle': 'Visualizer geometry',
    'visualizerCustomEffectDrawer.title': 'Custom Effect',
    'visualizerSettingsDrawer.quality.label': 'Render quality',
    'visualizerSettingsDrawer.quality.high': 'High (smooth)',
    'visualizerSettingsDrawer.quality.medium': 'Medium',
    'visualizerSettingsDrawer.quality.low': 'Low (lightweight)',
    'visualizerSettingsDrawer.blurEnable.label': 'Glow / blur effects',
    'visualizerSettingsDrawer.blurEnable.hint': 'Independent from render quality — turn off for a crisper, flatter look',
    'visualizerSettingsDrawer.maxHeight.label': 'Max height',
    'visualizerSettingsDrawer.barWidth.label': 'Bar thickness (px)',
    'visualizerSettingsDrawer.vortexStyle.label': 'Vortex tunnel style',
    'visualizerSettingsDrawer.vortexStyle.rings': 'Light rings',
    'visualizerSettingsDrawer.vortexStyle.bars': '3D bar segments (Equalizer)',
    'visualizerSettingsDrawer.vortexStyle.wave': 'Wave noise (fade)',
    'visualizerSettingsDrawer.barStyle.label': 'Bar style',
    'visualizerSettingsDrawer.barStyle.mirror': 'Mirror (butterfly)',
    'visualizerSettingsDrawer.barStyle.cascade': 'Cascade',
    'visualizerSettingsDrawer.mirrorCount.label': 'Number of bars (per side)',
    'visualizerSettingsDrawer.rainStyle.label': 'Rain effect style',
    'visualizerSettingsDrawer.rainStyle.glass': 'Drips on glass',
    'visualizerSettingsDrawer.rainStyle.street': 'Street & park rain',
    'visualizerSettingsDrawer.glassFlash.label': 'Flash (glass & street lights)',
    'visualizerSettingsDrawer.rainCityOpacity.label': 'Big City opacity',
    'visualizerSettingsDrawer.rainCityVisible.label': 'Show Big City',
    'visualizerSettingsDrawer.rainMoonVisible.label': 'Show Moon',
    'visualizerSettingsDrawer.rainWindowVisible.label': 'Show window frame',
    // (Phần B, Galaxy — 6 key spaceStyle/4 slider tinh chỉnh ĐÃ BỎ 21/07/2026, phản hồi Giang mục 1)
    'visualizerSettingsDrawer.colorSectionTitle': 'Colors',
    'visualizerSettingsDrawer.bgColor.label': 'Black background color',
    'visualizerSettingsDrawer.colorMode.label': 'Waveform color mode',
    'visualizerSettingsDrawer.colorMode.solid': 'Solid color',
    'visualizerSettingsDrawer.colorMode.dynamic': '2-color blend',
    'visualizerSettingsDrawer.colorMode.gradient': 'Music-driven gradient',
    'visualizerSettingsDrawer.solidColor.label': 'Choose a solid color',
    'visualizerSettingsDrawer.dynamicColor.label': 'Choose 2 blend colors',
    // FIX (12/08/2026, mục 4f) — "Auto-switch effect" (card này) ĐÃ RỜI HẲN khỏi panel "Customize
    // Visualizer", giờ là panel RIÊNG (components/settings/visualizer-auto-switch-drawer.js, key
    // title MỚI visualizerAutoSwitchDrawer.title bên dưới) — autoSwitchSectionTitle GIỮ LẠI, không
    // còn nơi nào dùng, chỉ để đối chiếu lịch sử.
    'visualizerAutoSwitchDrawer.title': 'Auto-Switch Effect',
    'visualizerSettingsDrawer.autoSwitchSectionTitle': 'Auto-switch effect',
    'visualizerSettingsDrawer.autoSwitchEnable.label': 'Enable auto-switch',
    'visualizerSettingsDrawer.autoSwitchEnable.hint': 'Automatically switches to a different effect after a set interval, no manual taps needed. While enabled, the "Change effect" button in the Visualizer Control Center is temporarily locked (to avoid conflicting with manual switching).',
    'visualizerSettingsDrawer.autoSwitchMode.label': 'Switch order',
    'visualizerSettingsDrawer.autoSwitchMode.sequential': 'Sequential',
    'visualizerSettingsDrawer.autoSwitchMode.random': 'Random',
    'visualizerSettingsDrawer.autoSwitchTimeMode.label': 'Switch timing',
    'visualizerSettingsDrawer.autoSwitchTimeMode.fixed': 'Fixed',
    'visualizerSettingsDrawer.autoSwitchTimeMode.random': 'Random within a range',
    'visualizerSettingsDrawer.autoSwitchTimeMode.duration': 'Based on song length',
    'visualizerSettingsDrawer.autoSwitchFixed.label': 'Switch every (seconds), minimum 10s',
    'visualizerSettingsDrawer.autoSwitchRandom.label': 'Random from 10s up to (seconds)',
    'visualizerSettingsDrawer.autoSwitchDuration.label': 'Divide song length by (minimum 10s)',
    'visualizerSettingsDrawer.autoSwitchDuration.hint': 'Time between switches = song length / the number entered, recalculated for each song. The system caps this at half the song length, ensuring at least one switch happens during playback. Seeking forward/back still remembers the correct effect for each segment.',

    // MỚI (10/08/2026) — section "Hiển thị Visualizer": stats panel (dời từ nút Control Center) +
    // chế độ xem toàn màn hình (Task 3).
    'visualizerSettingsDrawer.displaySectionTitle': 'Display',
    'visualizerSettingsDrawer.statsPanelEnable.label': 'Show music stats',
    'visualizerSettingsDrawer.statsPanelEnable.hint': 'BPM, pitch and energy readout on the Visualizer screen',
    'visualizerSettingsDrawer.bottomPlayerEnable.label': 'Show bottom player bar',
    'visualizerSettingsDrawer.bottomPlayerEnable.hint': 'Play/pause, next/prev, progress bar and song info pinned at the bottom',
    'visualizerSettingsDrawer.playlistButtonEnable.label': 'Show Playlist button',
    'visualizerSettingsDrawer.playlistButtonEnable.hint': 'Quick button to jump back to your Playlist',
    'visualizerSettingsDrawer.controlCenterButtonEnable.label': 'Show Control Center button',
    'visualizerSettingsDrawer.controlCenterButtonEnable.hint': 'Quick button for effect, shuffle, repeat and more',
    'visualizerSettingsDrawer.uiToggleGroupHint': 'Turned off elements still reopen with a swipe from the screen edge.',

    'loadingShield.text': 'Processing...',

    // MỚI (10/08/2026) — panel Settings "Cử chỉ" (components/gesture-settings-drawer.js).
    'gestureSettings.title': 'Gestures',
    // MỚI (12/08/2026, Giang yêu cầu — "Action") — 3 Slot CỐ ĐỊNH, mỗi Slot gán 1 nút Control
    // Center, dùng làm đích cho 7 dropdown vuốt/tap/tap-3-lần bên dưới (xem docstring components/
    // gesture-settings-drawer.js). Nhãn "Slot 1/2/3" DÙNG CHUNG cho cả nhãn hàng (section Actions)
    // LẪN <option> tương ứng trong 7 dropdown đó — cố ý 1 chuỗi, đổi 1 chỗ khớp cả 2 nơi.
    // SỬA (12/08/2026, Giang yêu cầu "tránh nhãn Action X mà vẫn hiểu ý định") — "Action 1/2/3" ->
    // "Slot 1/2/3": "Action" lặp lại vô nghĩa với chính tiêu đề section "Actions" ngay trên, không
    // tự nói được đây là 1 "ngăn chứa" (gán 1 nút) chứ KHÔNG PHẢI bản thân 1 hành động — ý định đầy
    // đủ chuyển sang dòng hint mới `sectionActions.hint` (đặt 1 lần dưới tiêu đề section, đỡ phải
    // nhồi vào từng tên hàng).
    'gestureSettings.sectionActions': 'Actions',
    'gestureSettings.sectionActions.hint': 'Assign a Control Center button to each slot, then pick that slot from any gesture below',
    'gestureSettings.action.actionSlot1': 'Slot 1',
    'gestureSettings.action.actionSlot2': 'Slot 2',
    'gestureSettings.action.actionSlot3': 'Slot 3',
    'gestureSettings.sectionNav': 'Navigation',
    'gestureSettings.swipeUp.label': 'Swipe up',
    'gestureSettings.swipeDown.label': 'Swipe down',
    'gestureSettings.swipeLeft.label': 'Swipe left',
    'gestureSettings.swipeRight.label': 'Swipe right',
    'gestureSettings.sectionTap': 'Tap',
    'gestureSettings.tapSingle.label': 'Tap once',
    'gestureSettings.tapDouble.label': 'Tap twice',
    'gestureSettings.action.next': 'Next',
    'gestureSettings.action.prev': 'Previous',
    'gestureSettings.action.playPause': 'Play/Pause',
    'gestureSettings.action.openPlaylist': 'Open Playlist',
    'gestureSettings.action.none': 'None',
    'gestureSettings.sectionSeek': 'Seek',
    'gestureSettings.seekHoldEnable.label': 'Hold to seek',
    'gestureSettings.seekHoldEnable.hint': 'Hold the left/right half of the screen for 2s to start rewinding/fast-forwarding repeatedly',
    'gestureSettings.seekStep.label': 'Seek step',
    'gestureSettings.seekStep.pickerTitle': 'Seek step',
    'gestureSettings.seekHoldInterval.label': 'Hold time per step',
    'gestureSettings.seekHoldInterval.pickerTitle': 'Hold time per step',
    'gestureSettings.sectionEdge': 'Edge swipe',
    'gestureSettings.edgeTop.label': 'Swipe from top edge',
    'gestureSettings.edgeTop.hint': 'Opens the Control Center',
    // SỬA (12/08/2026, Giang yêu cầu "tap 3 dùng chung select giống tap/cử chỉ khác") — `.hint` cũ
    // ("Triggers the Control Center button chosen") ĐÃ BỎ — dropdown Tap 3 lần giờ dùng actionRow()
    // Y HỆT Tap đơn/đúp (components/gesture-settings-drawer.js), KHÔNG còn khối hint 2 dòng riêng.
    'gestureSettings.tripleTapTarget.label': 'Triple tap',
    'gestureSettings.tripleTapTarget.captureFrameOption': 'Capture (video only)',

};
