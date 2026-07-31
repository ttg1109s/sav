/**
 * event/block.js — DUY NHẤT nơi khai báo điều kiện CHẶN message trước khi vào router (cơ chế
 * thật nằm ở event/bus.js: `blocks` Map + `registerBlock()` + `evalCondition()` trong send()).
 * File này CHỈ chứa DATA đăng ký — không viết logic so sánh/loop ở đây.
 *
 * KHI NÀO 1 msg.type CẦN block ở đây (KHÔNG phải cứ có state là dùng — xem rule đã chốt):
 *   - Điều kiện chặn phải dùng ở ≥2 router khác nhau cho CÙNG 1 ý nghĩa nghiệp vụ (tránh lệch
 *     logic giữa các entry point), HOẶC
 *   - Bản chất là CHẶN HẲN (không chạy gì cả khi điều kiện đúng) — không phải chọn giữa nhiều
 *     workflow khác nhau (trường hợp đó dùng switch/if trong router case, hoặc
 *     event/virtual-machine-state.js — xem event/virtual-machine-state.js).
 *
 * FORMAT đăng ký:
 *   eventBus.registerBlock('router.action.event', [
 *       // mảng NGOÀI = danh sách NHÓM — chỉ cần 1 nhóm đúng là CHẶN (OR giữa các nhóm)
 *       [
 *           // mảng TRONG = danh sách điều kiện — TẤT CẢ phải đúng thì nhóm này mới tính (AND)
 *           { field: 'domain.fieldName', operator: '===', value: true },
 *       ],
 *   ]);
 *
 * `field` đọc qua appState, hỗ trợ path lồng bất kỳ độ sâu (vd 'vizConfig.autoSwitchVisualEnabled').
 * `operator`: '===' | '!==' | '>' | '<' | '>=' | '<=' | 'in' | 'notIn' (xem service/operation.js).
 *
 * NẠP: ngay sau event/bus.js, TRƯỚC toàn bộ workflow/router/listener theo cụm (xem
 * readme/script-load-order.md).
 *
 * [Khung mới tạo — CHƯA có entry nào đăng ký. Việc wire các bug/case cụ thể (vd
 * autoSwitchVisualEnabled chặn cycleMode.click/visualizerType.change) cần rà soát phạm vi riêng
 * trước khi thêm vào đây, chưa làm trong patch này.]
 */

// ===================== fileManagerFolderBrowser — chặn "Áp dụng cho Playlist" khi folder rỗng =====
// XOÁ (Batch 5, "Song/Video Unification" mục 6e) — msg.type 'fileManagerSong.folder.
// applyToPlaylist.click' KHÔNG CÒN TỒN TẠI: toggle Scope trong Folder Browser (Generic Drawer) giờ
// gọi THẲNG `workflowFileManagerFolderBrowser._enableScope()`, không qua eventBus nữa — Block gate
// không còn message nào để chặn. Thay bằng guard clause thẳng trong `_enableScope()` (cùng điều
// kiện cũ) + `disabled` attribute trên checkbox (đã có từ Batch 4), xem docstring đầu
// event/workflow/file-manager-folder-browser.js.

// ===================== Generic Drawer — chặn mở chồng khi đang mở =====================
// MỚI (13/07/2026, Giang yêu cầu) — Generic Drawer dùng CHUNG cho nhiều tính năng (hiện Document
// Picker/Reader — event/workflow/document-reader.js), CHỈ 1 bodyHtml tại 1 thời điểm. Nếu 2 nơi
// cùng lúc gọi mở (vd người dùng bấm liên tiếp rất nhanh, hoặc 1 tính năng khác sau này cũng mở
// Generic Drawer trong lúc Document Picker đang hiện), lần mở SAU sẽ ghi đè bodyHtml của lần mở
// TRƯỚC — âm thầm hỏng cả 2. Bản chất là CHẶN HẲN (không chọn giữa nhiều tiến trình khác nhau, chỉ
// không cho chạy khi đã mở) — đúng tiêu chí dùng Block gate. `isGenericDrawerOpen`
// (service/state.js) do core/generic-drawer.js tự ghi true/false đúng nhịp mở/đóng thật (xem
// docstring ở đó). Tính năng MỚI nào sau này cũng mở Generic Drawer PHẢI tự đăng ký thêm 1 dòng
// tương tự ở đây cho msg.type của nó, KHÔNG tự suy luận miễn trừ.
eventBus.registerBlock('documentPicker.open.click', [
    [
        { field: 'isGenericDrawerOpen', operator: '===', value: true },
    ],
]);

// MỚI (Batch 5, "Song/Video Unification" mục 6e) — Folder Browser cũng mở Generic Drawer, đúng quy
// định ngay phía trên (mỗi msg.type "mở" tự đăng ký riêng 1 dòng).
eventBus.registerBlock('fileManagerFolderBrowser.open.click', [
    [
        { field: 'isGenericDrawerOpen', operator: '===', value: true },
    ],
]);

// MỚI (14/07/2026, tích hợp Add to Folder -> Generic Drawer grid) — 'playlist.actionMenu.addToFolder'
// là msg.type RIÊNG (không chia sẻ với hành động khác, khác 'playlist.selection.moreMenu.select'
// bản chọn nhiều — msg.type đó CHUNG cho cả play/export/addToFolder/delete qua payload.action, KHÔNG
// đăng ký block ở đây vì sẽ chặn nhầm cả 3 hành động còn lại). Lớp overlay (core/generic-drawer.js)
// đã chặn click xuyên qua VỀ MẶT HÌNH ẢNH khi Drawer đang mở — block này là lớp phòng thủ thứ 2.
eventBus.registerBlock('playlist.actionMenu.addToFolder', [
    [
        { field: 'isGenericDrawerOpen', operator: '===', value: true },
    ],
]);

// ===================== Video Player mode <-> Use background video — khoá chéo 2 chiều =====================
// MỚI (21/07/2026, Giang chỉ ra "Block đã có sẵn notify, sao phải tự viết alertModal") — 2 tính
// năng dùng CHUNG `bgVideoElement`, KHÔNG được cùng bật.
// [SỬA — ver12 "Song/Video Unification", Batch 2] Chiều "bật Video Player mode chặn bởi Video nền"
// TỪNG đăng ký ở msg.type 'fileManagerVideo.playerModeToggle.enable.click' (checkbox trong panel
// File Manager -> Video, ĐÃ BỎ HẲN — xem plan-v12-song-video-unification.md mục 3 + cleanup Batch
// 2). Entry point MỚI vào Video Player mode (`window.playSong()` dispatch theo `mediaType`,
// core/playlist/actions.js) tự `eventBus.send()` đúng msg.type dưới đây (xem event/router/
// video-player.js) — CHÍNH VÌ VẬY khôi phục lại được rule Block gate này (Giang chốt: "chọn Video
// thì cũng phải kiểm tra block gate mới được cho chọn"), chỉ đổi msg.type + key i18n, điều kiện và
// hành vi giữ NGUYÊN 100% so với chiều cũ.
eventBus.registerBlock('videoPlayer.startFromPlaylist.click', [
    [
        { field: 'vizConfig.videoBgEnabled', operator: '===', value: true },
    ],
], { notify: t('videoPlayer.startFromPlaylist.blockedByBgVideo') });

// Chiều CÒN LẠI (chặn bật Video nền khi Video Player mode đang chạy) GIỮ NGUYÊN, không đổi gì — vẫn
// đúng bất kể Video Player mode được vào bằng cách nào.
// MỞ RỘNG (phản hồi Giang, mục 4 — "Use video background chưa block nếu source là video") — thêm 1
// NHÓM ĐIỀU KIỆN nữa (OR — chỉ cần 1 nhóm đúng là chặn, xem format ở đầu file): Playlist đang browse
// Nguồn Video (`activeMediaSource==='video'`) — KHÔNG chỉ lúc `isVideoPlayerMode` (đã thật sự phát 1
// video) mới chặn, vì bgVideoElement dùng CHUNG cho cả 2 việc "phát Video nội dung chính" VÀ "làm
// nền trang trí" — đang browse Video (dù chưa bấm phát) cũng nên chặn trước cho nhất quán, tránh
// bật nền xong ngay sau đó bấm phát 1 video lại xung đột. `options.notify` CHỈ nhận 1 chuỗi DÙNG
// CHUNG cho MỌI nhóm khớp (event/bus.js không hỗ trợ notify riêng theo từng nhóm) — đổi lại câu chữ
// bao quát CẢ 2 lý do, đồng thời dọn luôn phần "(File Manager -> Video)" đã lỗi thời (panel đó xoá
// hẳn từ Batch 6, "Song/Video Unification").
eventBus.registerBlock('visualizerControlCenter.videoEnable.enable.click', [
    [
        { field: 'isVideoPlayerMode', operator: '===', value: true },
    ],
    [
        { field: 'activeMediaSource', operator: '===', value: 'video' },
    ],
], { notify: t('settingsPlaylistBg.videoEnable.blockedByPlayerMode') });

// ===================== video-editor.html — chặn Thêm nhạc/Thêm chữ khi track đã phủ kín video =====================
// MỚI (24/07/2026, Giang yêu cầu "dùng Block thay vì Router", mục 2). `videoEditAudioTrackFull`/
// `videoEditTextTrackFull` (service/state.js) do event/workflow/video-editor.js tự ghi lại MỖI LẦN
// `_audioClips`/`_textClips` đổi (thêm/nhân bản/xoá/trim/tách) — true khi track đó đã phủ kín tới
// hết tổng thời lượng video hiện tại (`_totalDuration()`), không còn khoảng trống nào để thêm 1 clip
// mới có nghĩa (xem `_recomputeTrackFullFlags()`, event/workflow/video-editor.js). Bản chất CHẶN HẲN
// (không chọn giữa nhiều workflow khác nhau) — đúng tiêu chí dùng Block gate thay vì rẽ nhánh
// Router/Workflow.
eventBus.registerBlock('videoEdit.addMusic.open', [
    [
        { field: 'videoEditAudioTrackFull', operator: '===', value: true },
    ],
], { notify: t('videoEdit.addMusic.blockedTrackFull') });

eventBus.registerBlock('videoEdit.addText.click', [
    [
        { field: 'videoEditTextTrackFull', operator: '===', value: true },
    ],
], { notify: t('videoEdit.addText.blockedTrackFull') });

// ===================== Modal xem ảnh Photo — chặn đóng khi đang Zoom/Edit mode =====================
// MỚI (31/07/2026) — nút "..." dropdown LUÔN bấm được ở CẢ 3 mode (view/zoom/edit, KHÔNG disable),
// nên bản chất đúng "CHẶN HẲN" (không chạy gì cả khi điều kiện đúng, không phải chọn giữa nhiều
// workflow khác nhau — trường hợp đó dùng VirtualMachineState, xem event/router/file-manager-
// photo.js case 'fileManagerPhoto.imageMenu.action.click') — đúng tiêu chí dùng Block gate. Người
// dùng phải tự thoát Zoom/Edit qua dropdown TRƯỚC (bấm lại "Zoom"/"Edit", toggle về 'view') rồi mới
// bấm X đóng được — KHÔNG tự động lùi mode giúp (đơn giản hoá, nhất quán 1 quy tắc cho cả 2 mode
// thay vì Zoom/Edit xử lý khác nhau).
eventBus.registerBlock('fileManagerPhoto.imagePreview.close.click', [
    [
        { field: 'imagePreviewMode', operator: '!==', value: 'view' },
    ],
], { notify: t('fileManager.photo.image.closeBlockedByMode') });


// XOÁ (29/07/2026, yêu cầu Giang) — Block gate cho 'fileManagerStorage.scanBroken.click' (chặn khi
// storageAnySourceEnabled===false) ĐÃ BỎ HẲN — nhánh "Dọn file lỗi" giờ tự hỏi phạm vi quét qua
// modalChoice() + dropdown RIÊNG (event/workflow/file-manager-storage.js::askScanBrokenScope()),
// KHÔNG còn phụ thuộc 4 toggle "Delete & Backup" nữa — tình huống "chưa chọn nguồn nào" KHÔNG THỂ
// xảy ra nữa vì <select> LUÔN có 1 giá trị (mặc định "Tất cả"), không có khái niệm rỗng. Field
// `appState.storageAnySourceEnabled` (service/state/file-manager.js) cũng đã bỏ theo — không còn
// ai đọc/ghi.
