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
    // Game Mode Circle v1 (MỚI 16/08/2026) — modalChoice() cho màn "Start"/"Kết quả" (KHÔNG dựng
    // overlay riêng nữa, xem event/workflow/gameplay.js).
    'gameplayCircle.ready.text': 'Tap right as the wave matches the center circle — the closer to the edge, the more points.',
    'gameplayCircle.ready.startLabel': 'Start',
    'gameplayCircle.difficulty.easy': 'Easy',
    'gameplayCircle.difficulty.medium': 'Medium',
    'gameplayCircle.difficulty.hard': 'Hard',
    'gameplayCircle.difficulty.hint.easy': 'One note at a time',
    'gameplayCircle.difficulty.hint.medium': 'Up to 2 notes can overlap',
    'gameplayCircle.difficulty.hint.hard': 'Notes overlap frequently',
    'gameplayCircle.ended.hitTier.perfect': 'Perfect',
    'gameplayCircle.ended.hitTier.excellent': 'Excellent',
    'gameplayCircle.ended.hitTier.good': 'Good',
    'gameplayCircle.ended.hitTier.bad': 'Bad',
    'gameplayCircle.ended.hitTier.miss': 'Miss',
    'gameplayCircle.ended.replayLabel': 'Replay',
    'gameplayCircle.ended.nextLabel': 'Next song',
    'gameplayCircle.ended.endLabel': 'Back to playlist',
    'gameplayCircle.ended.playCountLabel.singular': 'Played 1 time',
    'gameplayCircle.ended.playCountLabel.plural': 'Played {count} times',
    'videoPlayer.untitled': 'Untitled video',
    // MỚI (Giang yêu cầu — Photo tích hợp `duration` như Song/Video) — event/workflow/photo-player.js::playPhotoByKey().
    'photoPlayer.untitled': 'Untitled photo',
    // MỚI (ver12 "Song/Video Unification", Batch 2) — Block gate notify, xem event/block.js.
    'videoPlayer.startFromPlaylist.blockedByBgVideo': 'Turn off "Use Video Background" first (Settings) before playing a video from the Playlist.',
    'visualizerOverlay.cycleMode.title': 'Change effect',
    'visualizerOverlay.cycleMode.label': 'Effect',
    'visualizerOverlay.shuffle.title': 'Shuffle',
    'visualizerOverlay.shuffle.label': 'Shuffle',
    'visualizerOverlay.repeat.title': 'Repeat',
    'visualizerOverlay.repeat.label': 'Repeat',
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
    // (12/08/2026, tái thiết kế Custom Effect) — visualizerSettingsDrawer.title/
    // visualizerCustomEffectDrawer.title/quality.*/blurEnable.* ĐÃ BỎ HẲN (panel "Customize
    // Visualizer" + Custom Effect cũ + chế độ hiệu năng đều xoá). Nhãn field hình học/style con
    // GIỮ NGUYÊN key cũ, TÁI DÙNG trong Custom Effect Drawer mới (core/custom-effect.js).
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
    // (rainWindowVisible.label ĐÃ BỎ — khung cửa sổ giờ luôn hiện, không còn toggle)
    'visualizerSettingsDrawer.colorMode.label': 'Color mode',
    'visualizerSettingsDrawer.colorMode.solid': 'Solid color',
    'visualizerSettingsDrawer.colorMode.dynamic': '2-color blend',
    'visualizerSettingsDrawer.colorMode.gradient': 'Music-driven gradient',
    'visualizerSettingsDrawer.solidColor.label': 'Choose a solid color',
    'visualizerSettingsDrawer.dynamicColor.label': 'Choose 2 blend colors',

    // MỚI (12/08/2026) — Custom Effect Drawer (Generic Drawer, GIỮ 1.5s #btn-cycle-mode), xem
    // components/custom-effect-drawer.js + core/custom-effect.js. Field mới (giải phóng khỏi chế
    // độ hiệu năng đã bỏ, "đưa hết vào custom").
    'customEffectDrawer.styleLabel': 'Style',
    'customEffectDrawer.blurEnable': 'Glow / blur',
    'customEffectDrawer.blurIntensity': 'Glow intensity',
    'customEffectDrawer.field.starCount': 'Number of stars',
    'customEffectDrawer.field.glassDropDensity': 'Droplet density',
    'customEffectDrawer.field.glassStreakFrequency': 'Streak frequency',
    'customEffectDrawer.field.streetDensity': 'Rain density',
    'customEffectDrawer.field.streetBuildingScale': 'Building size',
    'customEffectDrawer.field.tunnelRingCount': 'Number of rings',
    'customEffectDrawer.field.starCountMin': 'Stars per galaxy (min)',
    'customEffectDrawer.field.starCountMax': 'Stars per galaxy (max)',
    'customEffectDrawer.field.nebulaCount': 'Nebula density',
    'customEffectDrawer.field.dustCount': 'Space dust density',
    'customEffectDrawer.field.mapNodeCount': 'Number of galaxies',
    'customEffectDrawer.field.mapRadius': 'Map radius',

    // MỚI (14/08/2026, "làm hết danh sách ứng viên custom" — Giang chốt) — field sâu, trước đây
    // hardcode trong từng file draw, giờ mở custom theo đúng danh sách đã thống nhất.
    'customEffectDrawer.field.barFillRatio': 'Bar/gap ratio',
    'customEffectDrawer.field.barCornerRadius': 'Bar corner radius',
    'customEffectDrawer.field.centerBarBeatRatio': 'Center bar beat mix',
    'customEffectDrawer.field.cascadeBaseAlpha': 'Cascade base opacity',
    'customEffectDrawer.field.cascadeKeyCount': 'Number of cascade keys',
    'customEffectDrawer.field.radiusRatio': 'Black hole radius',
    'customEffectDrawer.field.radiusEnergyMult': 'Radius energy reactivity',
    'customEffectDrawer.field.suctionBase': 'Base suction speed',
    'customEffectDrawer.field.suctionEnergyMult': 'Suction energy reactivity',
    'customEffectDrawer.field.flareThreshold': 'Flare trigger threshold',
    'customEffectDrawer.field.flashFadeSpeed': 'Flash fade speed',
    'customEffectDrawer.field.flashThreshold': 'Background flash threshold',
    'customEffectDrawer.field.boltThreshold': 'Bolt trigger threshold',
    'customEffectDrawer.field.boltSpawnChance': 'Bolt spawn chance',
    'customEffectDrawer.field.maxBoltCount': 'Max simultaneous bolts',
    'customEffectDrawer.field.boltFadeSpeed': 'Bolt fade speed',
    'customEffectDrawer.field.boltHorizontalDeviation': 'Bolt horizontal jaggedness',
    'customEffectDrawer.field.boltSegmentLength': 'Bolt segment length',
    'customEffectDrawer.field.cubeSizeRatio': 'Cube size',
    'customEffectDrawer.field.pitchSensitivity': 'Pitch spin sensitivity',
    'customEffectDrawer.field.rotationEnergyThreshold': 'Layer-turn trigger threshold',
    'customEffectDrawer.field.layerTurnSpeed': 'Layer-turn speed',
    'customEffectDrawer.field.warpSpeedBase': 'Base warp speed',
    'customEffectDrawer.field.warpSpeedEnergyMult': 'Warp speed energy reactivity',
    'customEffectDrawer.field.curveChangeChance': 'Tunnel curve change chance',
    'customEffectDrawer.field.barsRingCount': 'Number of bar rings',
    'customEffectDrawer.field.barsPerRing': 'Bars per ring',
    'customEffectDrawer.field.barsTwistFactor': 'Spiral twist amount',
    'customEffectDrawer.field.waveRotationBase': 'Base wave rotation speed',
    'customEffectDrawer.field.waveRotationEnergyMult': 'Wave rotation energy reactivity',
    'customEffectDrawer.field.waveScaleBase': 'Base wave scale',
    'customEffectDrawer.field.waveScaleEnergyMult': 'Wave scale energy reactivity',

    // Đèn tuỳ chỉnh (Rain, style street) — customEffect.rain.customLamps, tối đa 8.
    'customEffectDrawer.lamps.title': 'Custom street lamps',
    'customEffectDrawer.lamps.itemLabel': 'Lamp',
    'customEffectDrawer.lamps.remove': 'Remove',
    'customEffectDrawer.lamps.add': '+ Add lamp',
    'customEffectDrawer.lamps.x': 'Horizontal position',
    'customEffectDrawer.lamps.height': 'Post height',
    'customEffectDrawer.lamps.flare': 'Flare size',

    // MỚI (12/08/2026) — panel "Display" (Main "Visualizer Screen"), thay hẳn "Customize
    // Visualizer" — gộp "Hiện Visual" (trước ở Main) + 4 toggle UI chrome cũ vào 1 panel riêng.
    'settingsVisualizer.openDisplay.label': 'Display',
    'settingsVisualizer.openDisplay.hint': 'Show/hide the visualizer and on-screen UI elements',
    'visualizerDisplayPanel.title': 'Display',
    'visualizerAutoSwitchDrawer.title': 'Auto-Switch Effect',
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

    // MỚI — Element Style Editor (công cụ CHUNG dựng CSS box model + text style, xem event/
    // workflow/element-style-editor.js) — CHỈ dịch nhãn mô tả, KHÔNG dịch giá trị option là
    // keyword CSS thuần (px/solid/left/normal...), xem docstring đầu components/
    // element-style-editor-drawer.js.
    'elementStyleEditor.tab.box': 'Box',
    'elementStyleEditor.tab.text': 'Text',
    'elementStyleEditor.apply': 'Apply',
    'elementStyleEditor.box.width': 'Width',
    'elementStyleEditor.box.height': 'Height',
    'elementStyleEditor.box.padding': 'Padding',
    'elementStyleEditor.box.margin': 'Margin',
    'elementStyleEditor.box.background': 'Background', // MỚI (16/08/2026, mục 2)
    'elementStyleEditor.box.border': 'Border',
    'elementStyleEditor.box.opacity': 'Opacity',
    'elementStyleEditor.field.value': 'Value',
    'elementStyleEditor.field.mode': 'Mode',
    'elementStyleEditor.field.unit': 'Unit',
    'elementStyleEditor.mode.custom': 'Custom value',
    'elementStyleEditor.mode.fit': 'Fit content',
    'elementStyleEditor.mode.auto': 'Auto',
    // MỚI (15/08/2026, Giang chỉ ra "None là dropdown") — option "None" DÙNG CHUNG cho MỌI
    // dropdown trong Drawer (width/height mode + 6 field dropdown-thuần text) — bản thân dropdown
    // LÀM CÔNG TẮC, không cần checkbox riêng nữa (xem components/element-style-editor-drawer.js).
    'elementStyleEditor.mode.none': 'None',
    'elementStyleEditor.side.top': 'Top',
    'elementStyleEditor.side.right': 'Right',
    'elementStyleEditor.side.bottom': 'Bottom',
    'elementStyleEditor.side.left': 'Left',
    'elementStyleEditor.border.width': 'Thickness',
    'elementStyleEditor.border.style': 'Border style',
    'elementStyleEditor.border.color': 'Color',
    'elementStyleEditor.text.fontFamily': 'Font family',
    'elementStyleEditor.text.fontSize': 'Font size',
    'elementStyleEditor.text.fontWeight': 'Font weight',
    'elementStyleEditor.text.fontStyle': 'Font style',
    'elementStyleEditor.text.lineHeight': 'Line height',
    'elementStyleEditor.text.letterSpacing': 'Letter spacing',
    'elementStyleEditor.text.textAlign': 'Text align',
    'elementStyleEditor.text.textDecoration': 'Text decoration',
    'elementStyleEditor.text.textTransform': 'Text transform',
    'elementStyleEditor.text.whiteSpace': 'Line wrap',
    'elementStyleEditor.text.color': 'Text color',
    // MỚI (16/08/2026, mục 2 — Giang chỉ ra "chưa có text-shadow cho text").
    'elementStyleEditor.text.textShadow': 'Text shadow',
    'elementStyleEditor.textShadow.offsetX': 'Offset X (px)',
    'elementStyleEditor.textShadow.offsetY': 'Offset Y (px)',
    'elementStyleEditor.textShadow.blur': 'Blur (px)',
    'elementStyleEditor.textShadow.color': 'Color',
    'elementStyleEditor.font.source': 'Source',
    'elementStyleEditor.font.sourceSystem': 'System font',
    'elementStyleEditor.font.sourceGoogle': 'Google Font',
    'elementStyleEditor.font.name': 'Font name',
    'elementStyleEditor.font.namePlaceholder': 'e.g. Roboto',
    // MỚI (16/08/2026 — dropdown + search cho nguồn Google, core/google-fonts-list.js).
    'elementStyleEditor.font.searchPlaceholder': 'Search font…',
    'elementStyleEditor.font.noMatch': 'No matching font',
    'elementStyleEditor.font.weightToLoad': 'Weight to load',
    'elementStyleEditor.font.loadButton': 'Load Google Font (needs internet)',
    'elementStyleEditor.font.loadedNote': 'Loaded this session',
    // MỚI (16/08/2026 — Giang yêu cầu "ô preview cố định trong body drawer").
    'elementStyleEditor.preview.label': 'Preview',
    'elementStyleEditor.preview.sampleText': 'Sample subtitle text',

    // MỚI (15/08/2026, mục 3) — tiêu đề section "Thành phần" (gộp Stats panel + 3 toggle UI
    // chrome cố định) trong panel "Display" — xem components/settings/visualizer-display-panel.js.
    // SỬA (chốt LẦN 2, cùng ngày) — 2 key `section.display`/`section.controlUi` của bản trước ĐÃ
    // GỘP LẠI thành 1 key DUY NHẤT này (Giang yêu cầu bỏ tách riêng, gộp chung 1 section).
    'visualizerSettingsDrawer.section.components': 'Components',


};
