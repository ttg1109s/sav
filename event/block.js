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
// applyToPlaylist.click' KHÔNG CÒN TỒN TẠI: toggle Scope trong Folder Browser (Generic Drawer) từng
// gọi THẲNG `workflowFileManagerFolderBrowser.enableScope()` (bỏ qua eventBus) một thời gian — Block
// gate không còn message nào để chặn lúc đó. SỬA (31/07/2026, Giang chỉ ra "core tạo ra
// addEventListener chứ không phải workflow") — đã khôi phục đi qua eventBus/Router
// ('fileManagerFolderBrowser.read.scope.change'), NHƯNG Block gate ở đây CHƯA đăng ký lại — guard
// clause thẳng trong `enableScope()` (cùng điều kiện cũ) + `disabled` attribute trên checkbox (Batch
// 4) vẫn đang là lớp phòng vệ chính, xem docstring đầu event/workflow/file-manager-folder-browser.js.

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

// MỚI (v13 Batch B) — nút "Chọn nguồn" của Visual Background mở Generic Drawer ở 3/4 tổ hợp
// (video+single, image+list, video+list). Tổ hợp còn lại (image+single) mở modal RIÊNG
// (`openImageLibraryPickerModal()`), không đụng Generic Drawer — nhưng chỉ có ĐÚNG 1 msg.type cho
// cả 4 nhánh (Router mới rẽ bằng VirtualMachineState) nên đăng ký 1 dòng là đủ, và chặn nhánh
// image+single lúc Drawer đang mở cũng đúng ý (không mở chồng 2 picker).
// SỬA (v14) — 1 msg.type 'visualBg.pickSource.click' cũ tách thành 2 ('pickSingleSource'/
// 'pickGroupSource', không còn tổ hợp sourceMode) — đăng ký lại cho CẢ HAI. Gộp LUÔN điều kiện
// "xung đột Video Player mode" (trước ở 'visualBg.enable.on.click', msg.type đó không còn tồn tại
// vì không còn toggle bật/tắt riêng — chọn nguồn giờ CHÍNH LÀ hành động "bật") vào CÙNG 2 dòng này
// — `options.notify` chỉ nhận 1 chuỗi dùng chung mọi nhóm khớp, chọn thông báo của nhóm PHỔ BIẾN
// hơn (xung đột Video Player), nhóm `isGenericDrawerOpen` vốn hiếm khi tự người dùng bấm trúng lúc
// picker đã mở nên chấp nhận đánh đổi nhỏ này (cùng đánh đổi đã có sẵn ở dòng cũ).
eventBus.registerBlock('visualBg.pickSingleSource.click', [
    [{ field: 'isGenericDrawerOpen', operator: '===', value: true }],
    [{ field: 'isVideoPlayerMode', operator: '===', value: true }],
    [{ field: 'activeMediaSource', operator: '===', value: 'video' }],
], { notify: t('visualBgSettingsDrawer.blockedBySourceVideo') });

eventBus.registerBlock('visualBg.pickGroupSource.click', [
    [{ field: 'isGenericDrawerOpen', operator: '===', value: true }],
    [{ field: 'isVideoPlayerMode', operator: '===', value: true }],
    [{ field: 'activeMediaSource', operator: '===', value: 'video' }],
], { notify: t('visualBgSettingsDrawer.blockedBySourceVideo') });

// ===================== Visual Background — chặn XOÁ nguồn đang tham chiếu =====================
// XOÁ HẲN (v14, Giang chốt mục 2) — 4 block cũ ('playlist.actionMenu.delete.click'/
// 'fileManagerPhoto.imageMenu.delete.click'/'fileManagerPhoto.albumList.delete.click'/
// 'fileManagerFolderBrowser.read.delete.click') từng chặn xoá ảnh/video/album/folder đang được
// Visual Background tham chiếu. KHÔNG còn cần: `source.list` giờ là bản COPY key tách hẳn khỏi
// nguồn gốc, xoá nguồn gốc không đụng gì tới bản copy đó — record mất được phát hiện LƯỜI (lazy)
// đúng lúc advance()/apply() cần tới, tự đánh dấu null rồi tự chữa lành (xem
// core/visual-bg.js::advanceVisualBgList(), event/workflow/visual-bg.js::_markCurrentMissing()).
// Không còn nút "Gỡ nguồn" nào bị bắt buộc bấm trước khi xoá nữa.

// CHIỀU NGƯỢC LẠI của khoá chéo (v13 Batch F, plan mục 4; SỬA Batch G) — Visual Background ĐANG
// hiện media (ảnh/video) thì không đổi nguồn Playlist sang Video được. ĐỐI XỨNG HOÀN TOÀN với luật
// ngay trên: cùng 1 xung đột (nguồn Video chiếm cả `#bg-video` lẫn `#visual-bg-image`).
// SỬA (v14) — field cũ `visualBgConfig.enabled` không còn tồn tại; `registerBlock()` chỉ so được 1
// field đơn qua appState, không biểu diễn được "source.list còn item hay không" trực tiếp trên
// appConfigVisualBg — đổi sang đọc `isVisualBgMediaActive` (appState, service/state/visual-bg.js),
// do `workflowVisualBg.applyCurrentVisualBg()` tự đồng bộ mỗi lần áp lại nền.
eventBus.registerBlock('playlist.mediaSource.change', [
    [
        { field: 'payload.source', operator: '===', value: 'video' },
        { field: 'isVisualBgMediaActive', operator: '===', value: true },
    ],
], { notify: t('visualBgSettingsDrawer.blockedByVisualBgOn') });

// LỖ HỔNG BIÊN (v13, Giang phát hiện) — khoá `mediaSourceSelect` + block 'playlist.mediaSource.change'
// KHÔNG phủ hết: bật Scope cho 1 folder VIDEO rồi CHỌN "không tải lại ngay" thì phiên hiện tại vẫn
// đang ở nguồn Song (select chưa bị khoá) -> bật được Visual Background -> lần khởi động sau boot
// sequence áp Scope, nguồn thành Video trong khi nền vẫn đang on. Chặn ngay tại gốc: không cho bật
// Scope folder video khi Visual Background đang hiện media.
eventBus.registerBlock('fileManagerFolderBrowser.read.scope.change', [
    [
        { field: 'payload.checked', operator: '===', value: true },
        { field: 'payload.folderType', operator: '===', value: 'video' },
        { field: 'isVisualBgMediaActive', operator: '===', value: true },
    ],
], { notify: t('visualBgSettingsDrawer.blockedByVisualBgOn') });

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
        // SỬA (v14) — `visualBgConfig.enabled` không còn tồn tại, đổi sang `isVisualBgMediaActive`
        // (appState, đồng bộ bởi workflowVisualBg.applyCurrentVisualBg() — xem docstring field ở
        // service/state/visual-bg.js).
        { field: 'isVisualBgMediaActive', operator: '===', value: true },
    ],
], { notify: t('videoPlayer.startFromPlaylist.blockedByBgVideo') });

// Chiều CÒN LẠI (chặn dùng Video nền khi Video Player mode đang chạy/Playlist đang browse Video) —
// ĐÃ GỘP vào 2 block '"visualBg.pickSingleSource.click"'/'"visualBg.pickGroupSource.click"' phía trên
// (v14): không còn action "bật" riêng biệt ('"visualBg.enable.on.click"' đã xoá cùng toggle) — chọn
// nguồn giờ CHÍNH LÀ hành động cần chặn, nên chặn thẳng tại đó.

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

// ===================== Modal xem ảnh Photo — khoá chéo Zoom view <-> Edit =====================
// MỚI (31/07/2026, mục 3 phản hồi Giang) — 2 mode dùng CHUNG cụm DOM của modal xem ảnh (Edit decode
// ảnh vào canvas + ẩn hẳn `<img>`, Zoom lại cần init Panzoom NGAY trên chính `<img>` đó — bật đồng
// thời sẽ hỏng cả 2), KHÔNG được cùng bật — đúng tiêu chí dùng Block gate. "Zoom view" ở router
// `fileManagerPhoto`, "Edit" ở router `imageEdit` (event/workflow/image-edit.js, tách riêng
// 31/07/2026) — 2 msg.type khác router vẫn khoá chéo bình thường (Block gate tra theo msg.type,
// không phụ thuộc router). Người dùng phải tự thoát mode đang bật TRƯỚC (bấm lại đúng item trong
// dropdown, toggle về 'view') rồi mới bấm được mode còn lại.
eventBus.registerBlock('fileManagerPhoto.imagePreview.zoomToggle.click', [
    [
        { field: 'imagePreviewMode', operator: '===', value: 'edit' },
    ],
], { notify: t('fileManager.photo.image.zoomBlockedByEdit') });

eventBus.registerBlock('imageEdit.toggle.click', [
    [
        { field: 'imagePreviewMode', operator: '===', value: 'zoom' },
    ],
], { notify: t('fileManager.photo.image.editBlockedByZoom') });


// XOÁ (29/07/2026, yêu cầu Giang) — Block gate cho 'fileManagerStorage.scanBroken.click' (chặn khi
// storageAnySourceEnabled===false) ĐÃ BỎ HẲN — nhánh "Dọn file lỗi" giờ tự hỏi phạm vi quét qua
// modalChoice() + dropdown RIÊNG (event/workflow/file-manager-storage.js::askScanBrokenScope()),
// KHÔNG còn phụ thuộc 4 toggle "Delete & Backup" nữa — tình huống "chưa chọn nguồn nào" KHÔNG THỂ
// xảy ra nữa vì <select> LUÔN có 1 giá trị (mặc định "Tất cả"), không có khái niệm rỗng. Field
// `appState.storageAnySourceEnabled` (service/state/file-manager.js) cũng đã bỏ theo — không còn
// ai đọc/ghi.
