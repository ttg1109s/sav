/**
 * event/block.js — DUY NHẤT nơi khai báo điều kiện CHẶN message trước khi vào router (cơ chế ở event/bus.js:
 * `registerBlock()` + `isBlocked()` trong send()). File này CHỈ chứa DATA đăng ký — không logic so sánh/loop.
 *
 * Chỉ dùng Block khi điều kiện chặn dùng ở ≥2 entry point cho cùng 1 ý nghĩa nghiệp vụ, HOẶC bản chất là CHẶN HẲN (không
 * chạy gì khi điều kiện đúng). Chọn "chạy cái gì" theo state thì dùng VirtualMachineState (readme/event-bus-flow.md mục 4C).
 *
 * FORMAT:
 *   eventBus.registerBlock('router.action.event', [
 *       // mảng NGOÀI = NHÓM — 1 nhóm đúng là CHẶN (OR)
 *       [
 *           // mảng TRONG = điều kiện — TẤT CẢ đúng thì nhóm mới tính (AND)
 *           { field: 'isActiveFolderReadOnly', operator: '===', value: true },
 *       ],
 *   ], { notify: 'Lý do chặn' }); // notify/groupNotify tuỳ chọn — không có thì chặn im lặng
 *
 * `field`: key appState (path lồng được), `payload.xxx` hoặc `<domain>Config.xxx` (event/bus.js::resolveFieldPath()).
 * `operator`: '===' | '!==' | '>' | '<' | '>=' | '<=' | 'in' | 'notIn' (service/operation.js).
 *
 * NẠP: ngay sau event/bus.js, TRƯỚC toàn bộ workflow/router/listener theo cụm (readme/script-load-order.md).
 */

// ===================== Folder Read-only =====================
// Chặn mở menu upload khi folder đang Scope của Nguồn hiện tại là read-only (upload tự gắn vào folder active).
// `isActiveFolderReadOnly` luôn khớp Nguồn đang hiển thị (service/state/file-manager.js).
eventBus.registerBlock('playlist.uploadMenu.open', [
    [
        { field: 'isActiveFolderReadOnly', operator: '===', value: true },
    ],
], { notify: t('fileManager.folderBrowser.uploadBlockedReadOnly') });

// ===================== Generic Drawer — chặn mở chồng khi đang mở =====================
// Generic Drawer chỉ có 1 bodyHtml tại 1 thời điểm — mở chồng sẽ ghi đè drawer đang hiện. `isGenericDrawerOpen` do
// core/generic-drawer.js ghi đúng nhịp mở/đóng thật. Tính năng MỚI nào mở Generic Drawer phải tự đăng ký 1 dòng ở đây.

// "Thêm vào thư mục" (menu 1 item). Không gate 'playlist.selection.moreMenu.select' — msg.type đó dùng chung nhiều hành động.
eventBus.registerBlock('playlist.actionMenu.addToFolder', [
    [
        { field: 'isGenericDrawerOpen', operator: '===', value: true },
    ],
]);

// Danh sách Layer của trình sửa ảnh (icon Layer trên header modal ảnh).
eventBus.registerBlock('imageEdit.layers.click', [
    [
        { field: 'isGenericDrawerOpen', operator: '===', value: true },
    ],
]);

// ===================== Visual Background =====================
// Chỉ mở panel Visual Background khi Playlist đang ở Nguồn Song (VBG chỉ áp dụng cho Song).
eventBus.registerBlock('visualBg.openPanel.click', [
    [{ field: 'activeMediaSource', operator: '!==', value: 'song' }],
], { notify: t('visualBgSettingsDrawer.blockedByNotSongSource') });

// ===================== Video Player mode — sự kiện của #bg-video =====================
// `bgVideoElement` vừa là màn Video Player vừa là video nền trang trí (VBG). 5 sự kiện của nó chỉ thuộc Video Player khi
// đang ở mode đó — lúc chỉ là nền trang trí thì chặn hẳn (event/listener/video-player.js chỉ gửi).
const VIDEO_PLAYER_MODE_OFF_BLOCK = [
    [{ field: 'isVideoPlayerMode', operator: '!==', value: true }],
];
eventBus.registerBlock('playerControls.video.play', VIDEO_PLAYER_MODE_OFF_BLOCK);
eventBus.registerBlock('playerControls.video.pause', VIDEO_PLAYER_MODE_OFF_BLOCK);
eventBus.registerBlock('playerControls.video.loadedmetadata', VIDEO_PLAYER_MODE_OFF_BLOCK);
eventBus.registerBlock('playerControls.video.timeupdate', VIDEO_PLAYER_MODE_OFF_BLOCK);
eventBus.registerBlock('playerControls.video.ended', VIDEO_PLAYER_MODE_OFF_BLOCK);
// Ngược lại: 2 sự kiện của #bg-video thuộc VBG chỉ khi KHÔNG ở Video Player mode (event/listener/visual-bg.js chỉ gửi).
const VIDEO_PLAYER_MODE_ON_BLOCK = [
    [{ field: 'isVideoPlayerMode', operator: '===', value: true }],
];
eventBus.registerBlock('visualBg.video.ended', VIDEO_PLAYER_MODE_ON_BLOCK);
eventBus.registerBlock('visualBg.video.timeupdate', VIDEO_PLAYER_MODE_ON_BLOCK);

// ===================== Ghi âm =====================
// Bắt đầu ghi — chặn hẳn khi: đã có phiên ghi (mọi phase khác 'idle', kể cả modal nghe lại), đang Photo Player (phát im
// lặng, nút cũng đã ẩn), hoặc đang ở Game Mode (2 chế độ cùng chiếm 'ended' + khoá điều khiển, loại trừ nhau).
// Xem event/workflow/recorder.js.
eventBus.registerBlock('recorder.start.click', [
    [{ field: 'recordPhase', operator: '!==', value: 'idle' }],
    [{ field: 'isPhotoPlayerMode', operator: '===', value: true }],
    [{ field: 'gameplayPhase', operator: '!==', value: 'idle' }],
]);

// Đang có phiên ghi -> chặn đổi/tua bài từ MỌI lối vào còn lại ngoài overlay: Media Session màn hình khoá (Next/Prev),
// thanh player (đã khoá CSS), cử chỉ (đã bị overlay che). Cùng 1 ý nghĩa ở ≥2 entry point.
const RECORDER_SESSION_ACTIVE_BLOCK = [
    [{ field: 'recordPhase', operator: '!==', value: 'idle' }],
];
eventBus.registerBlock('playerControls.next.click', RECORDER_SESSION_ACTIVE_BLOCK);
eventBus.registerBlock('playerControls.prev.click', RECORDER_SESSION_ACTIVE_BLOCK);
eventBus.registerBlock('playerControls.playPause.click', RECORDER_SESSION_ACTIVE_BLOCK);
eventBus.registerBlock('playerControls.restart.click', RECORDER_SESSION_ACTIVE_BLOCK);

// ===================== Performance HUD =====================
// Nhật ký chạm (event/listener/perf-hud.js nghe MỌI cú chạm) — HUD tắt thì chặn hẳn. Đọc domain AppConfig 'perfHud'
// (bus tự nhận diện gốc 'perfHudConfig').
eventBus.registerBlock('perfHud.app.pointerdown', [
    [{ field: 'perfHudConfig.enabled', operator: '!==', value: true }],
]);
