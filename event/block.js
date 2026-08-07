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
eventBus.registerBlock('visualBg.pickSource.click', [
    [
        { field: 'isGenericDrawerOpen', operator: '===', value: true },
    ],
]);

// ===================== Visual Background — chặn xoá NGUỒN ĐANG THAM CHIẾU (v13 Batch F) =========
// Quy tắc nghiệp vụ: thứ đang được `visualBgConfig` trỏ tới thì KHÔNG xoá được — phải bấm nút "Gỡ
// nguồn" trong Settings -> Visual Background trước. Áp dụng BẤT KỂ Visual Background đang bật hay
// tắt (Giang chốt): tham chiếu vẫn còn thì vẫn phải bảo vệ.
//
// CHỈ 4 msg.type dưới đây — đều là hành động có TARGET NGUYÊN KHỐI (đúng 1 đối tượng), nên chặn cả
// hành động là đúng nghĩa. Các đường xoá HÀNG LOẠT (delete mode ảnh, selection mode Playlist,
// clearAllPhotosData/clearAllVideosData) KHÔNG đăng ký ở đây: target của chúng là 1 TẬP, ref chỉ
// làm hỏng vài phần tử chứ không hỏng cả thao tác — Workflow tự loại phần tử bị tham chiếu ra khỏi
// tập rồi xoá phần còn lại (chuẩn bị dữ liệu, Rule 3b). Cùng 1 quy tắc, 2 điểm thực thi khác nhau
// vì hành động chia được hay không.
//
// Cả 4 đều so 1 id với 1 id qua `valueField` (vế phải cũng là đường dẫn — xem event/bus.js).
eventBus.registerBlock('playlist.actionMenu.delete.click', [
    [
        { field: 'payload.songKey', operator: '===', valueField: 'visualBgConfig.singleVideoKey' },
    ],
], { notify: t('visualBgSettingsDrawer.blockedDeleteInUse') });

eventBus.registerBlock('fileManagerPhoto.imageMenu.delete.click', [
    [
        { field: 'payload.imageKey', operator: '===', valueField: 'visualBgConfig.singleImageKey' },
    ],
], { notify: t('visualBgSettingsDrawer.blockedDeleteInUse') });

eventBus.registerBlock('fileManagerPhoto.albumList.delete.click', [
    [
        { field: 'payload.albumId', operator: '===', valueField: 'visualBgConfig.listAlbumId' },
    ],
], { notify: t('visualBgSettingsDrawer.blockedDeleteInUse') });

eventBus.registerBlock('fileManagerFolderBrowser.read.delete.click', [
    [
        { field: 'payload.folderId', operator: '===', valueField: 'visualBgConfig.listFolderId' },
    ],
], { notify: t('visualBgSettingsDrawer.blockedDeleteInUse') });

// CHIỀU NGƯỢC LẠI của khoá chéo (v13 Batch F, plan mục 4; SỬA Batch G) — Visual Background ĐANG BẬT
// thì không đổi nguồn Playlist sang Video được. ĐỐI XỨNG HOÀN TOÀN với luật ngay trên: cùng 1 xung
// đột (nguồn Video chiếm cả `#bg-video` lẫn `#visual-bg-image`), nên cùng KHÔNG kiểm `mediaType` —
// bật Visual Background bằng nguồn ảnh cũng xung đột y hệt.
eventBus.registerBlock('playlist.mediaSource.change', [
    [
        { field: 'payload.source', operator: '===', value: 'video' },
        { field: 'visualBgConfig.enabled', operator: '===', value: true },
    ],
], { notify: t('visualBgSettingsDrawer.blockedByVisualBgOn') });

// LỖ HỔNG BIÊN (v13, Giang phát hiện) — khoá `mediaSourceSelect` + block 'playlist.mediaSource.change'
// KHÔNG phủ hết: bật Scope cho 1 folder VIDEO rồi CHỌN "không tải lại ngay" thì phiên hiện tại vẫn
// đang ở nguồn Song (select chưa bị khoá) -> bật được Visual Background -> lần khởi động sau boot
// sequence áp Scope, nguồn thành Video trong khi nền vẫn đang on. Chặn ngay tại gốc: không cho bật
// Scope folder video khi Visual Background đang bật.
eventBus.registerBlock('fileManagerFolderBrowser.read.scope.change', [
    [
        { field: 'payload.checked', operator: '===', value: true },
        { field: 'payload.folderType', operator: '===', value: 'video' },
        { field: 'visualBgConfig.enabled', operator: '===', value: true },
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
        // SỬA (v13 Batch A) — `vizConfig.videoBgEnabled` ĐÃ GỘP vào domain config `visualBg`.
        // `resolveFieldPath()` (event/bus.js) tự nhận diện mọi domain AppConfig theo quy ước
        // `<domain>Config` nên path mới chạy được ngay, không cần sửa bus.
        { field: 'visualBgConfig.enabled', operator: '===', value: true },
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
// SỬA (v13 Batch A) — msg.type ĐỔI theo cụm router MỚI `visualBg` (toggle #setting-video-enable
// đã xoá; "Video nền" giờ là 1 tổ hợp của Visual Background). Điều kiện + notify GIỮ NGUYÊN 100%.
// Điều kiện GIỮ NGUYÊN (v13 Batch G) — KHÔNG kiểm `mediaType`, và đó là ĐÚNG: khi Playlist ở nguồn
// Video, video đang phát chiếm `#bg-video` VÀ bị cưỡng chế đặt thumb full-size vào `#visual-bg-image`
// (core/video-player.js::forceShowVisualBgImageForVideoPlayer()). CẢ HAI lớp mà Visual Background
// cần đều bị chiếm, nên KHÔNG nguồn nào dùng được — ảnh cũng vậy, không riêng video.
eventBus.registerBlock('visualBg.enable.on.click', [
    [
        { field: 'isVideoPlayerMode', operator: '===', value: true },
    ],
    [
        { field: 'activeMediaSource', operator: '===', value: 'video' },
    ],
], { notify: t('visualBgSettingsDrawer.blockedBySourceVideo') });

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
