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
// MỚI (13/07/2026, Giang yêu cầu) — Generic Drawer dùng CHUNG cho nhiều tính năng, CHỈ 1 bodyHtml
// tại 1 thời điểm. Nếu 2 nơi cùng lúc gọi mở (vd người dùng bấm liên tiếp rất nhanh, hoặc 1 tính
// năng khác sau này cũng mở Generic Drawer trong lúc 1 tính năng khác đang hiện), lần mở SAU sẽ ghi
// đè bodyHtml của lần mở TRƯỚC — âm thầm hỏng cả 2. Bản chất là CHẶN HẲN (không chọn giữa nhiều
// tiến trình khác nhau, chỉ không cho chạy khi đã mở) — đúng tiêu chí dùng Block gate.
// `isGenericDrawerOpen` (service/state.js) do core/generic-drawer.js tự ghi true/false đúng nhịp
// mở/đóng thật (xem docstring ở đó). Tính năng MỚI nào sau này cũng mở Generic Drawer PHẢI tự đăng
// ký thêm 1 dòng tương tự ở đây cho msg.type của nó, KHÔNG tự suy luận miễn trừ.
// XOÁ (loại bỏ Document Reader khỏi app) — đăng ký `documentPicker.open.click` bỏ hẳn cùng tính
// năng.

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

// XOÁ (v14, Giang chốt mục 2) — khoá chéo "Visual Background đang hiện media -> không đổi Nguồn
// Playlist sang Video" bỏ hẳn (đây từng là 2 block: 'playlist.mediaSource.change' +
// 'fileManagerFolderBrowser.read.scope.change' phòng lỗ hổng biên của nó). Đổi Nguồn/bật Scope
// Video giờ được phép tự do dù Visual Background đang hiện gì — xung đột giải quyết ở CHIỀU NGƯỢC
// LẠI, đúng lúc THẬT SỰ vào Video Player mode (`workflowVisualBg.clearMediaLayers()`, gọi từ
// event/workflow/video-player.js::startFromPlaylist() — dùng LUÔN cơ chế nhường `#bg-video` sẵn có
// của Video Player mode, không cần khoá phòng ngừa từ phía Playlist nữa).

// ===================== Video Player mode <-> Use background video — khoá chéo 2 chiều =====================
// 2 tính năng dùng CHUNG `bgVideoElement`, KHÔNG được cùng bật.
// XOÁ (v14, Giang chốt mục 2) — chiều "chặn VÀO Video Player mode khi Visual Background đang hiện
// media" ('videoPlayer.startFromPlaylist.click') bỏ hẳn: vào Video Player mode giờ LUÔN được phép,
// `startFromPlaylist()` tự gọi `workflowVisualBg.clearMediaLayers()` để nhường `bgVideoElement`
// (không đợi Block gate chặn trước nữa).
//
// Chiều CÒN LẠI (chặn MỞ panel/chọn nguồn Visual Background khi Playlist đang browse Video) — GIỮ,
// đổi msg.type theo router mới `visualBg` (không còn toggle bật/tắt riêng, chọn nguồn CHÍNH LÀ hành
// động cần chặn) + thêm chặn NGAY TỪ LÚC MỞ PANEL (Giang chốt mục 2 — "khoá vào sub setting visual
// background"), không chỉ chặn lúc bấm nút chọn nguồn bên trong.
// SỬA (08/08/2026, phản hồi Giang — "đổi tab Playlist chỉ mở khoá panel, không có nghĩa video đang
// phát bị VBG chèn ngay") — TÁCH riêng 2 việc: XEM panel (case này) chỉ còn phụ thuộc
// `activeMediaSource` (đang browse tab nào), KHÔNG còn phụ thuộc `isVideoPlayerMode` — đổi tab
// Playlist sang Song là mở khoá được panel ngay dù video vẫn đang phát nền thật. Việc ÁP DỤNG THẬT
// (chiếm bgVideoElement) vẫn bị chặn riêng ở 2 block 'visualBg.pickSingleSource.click'/
// 'pickGroupSource.click' ngay trên — 2 block ĐÓ mới là nơi cần giữ `isVideoPlayerMode`, xem
// `_resolveAndCommitSource()` (event/workflow/visual-bg.js) gọi thẳng `applyCurrentVisualBg()`.
eventBus.registerBlock('visualBg.openPanel.click', [
    [{ field: 'activeMediaSource', operator: '===', value: 'video' }],
], { notify: t('visualBgSettingsDrawer.blockedBySourceVideo') });


// ===================== Modal xem ảnh Photo — KHÔNG còn Block gate nào =====================
// XOÁ (chỉ 1 mặt canvas dùng chung xem/zoom/pan/edit, bỏ dropdown "...") — 3 block gate cũ
// ('fileManagerPhoto.imagePreview.close.click' chặn X khi khác 'view', 'fileManagerPhoto.
// imagePreview.zoomToggle.click' chặn Zoom khi đang Edit, 'imageEdit.toggle.click' chặn Edit khi
// đang Zoom) bỏ hẳn cùng khái niệm "mode loại trừ nhau" — không còn "mode" nào để tranh chấp: Zoom
// (Panzoom) LUÔN bật sẵn suốt vòng đời modal, công cụ Edit vẽ/chỉnh THẲNG lên chính canvas đang
// xem/zoom đó. Nút X đóng modal giờ LUÔN bấm được. Xem event/workflow/file-manager-photo.js +
// event/workflow/image-edit.js.


// XOÁ (29/07/2026, yêu cầu Giang) — Block gate cho 'fileManagerStorage.scanBroken.click' (chặn khi
// storageAnySourceEnabled===false) ĐÃ BỎ HẲN — nhánh "Dọn file lỗi" giờ tự hỏi phạm vi quét qua
// modalChoice() + dropdown RIÊNG (event/workflow/file-manager-storage.js::askScanBrokenScope()),
// KHÔNG còn phụ thuộc 4 toggle "Delete & Backup" nữa — tình huống "chưa chọn nguồn nào" KHÔNG THỂ
// xảy ra nữa vì <select> LUÔN có 1 giá trị (mặc định "Tất cả"), không có khái niệm rỗng. Field
// `appState.storageAnySourceEnabled` (service/state/file-manager.js) cũng đã bỏ theo — không còn
// ai đọc/ghi.
