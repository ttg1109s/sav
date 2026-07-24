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

// ===================== fileManagerSong — chặn "Áp dụng cho Playlist" khi folder rỗng =====================
// MỚI (03/07/2026, đợt 4). `folderDetailSongCount` (service/state.js) được workflow
// (event/workflow/file-manager-song.js, refreshFolderDetail()) cập nhật MỖI LẦN vẽ lại Folder
// Detail Drawer — luôn khớp đúng số bài ĐANG hiển thị lúc người dùng có thể bấm nút, nên dùng được
// trực tiếp qua Block gate (chỉ đọc appState, không cần biết I/O IndexedDB nào). CHỈ chặn chiều
// "Áp dụng" (folder rỗng thì áp dụng vô nghĩa) — chiều "Bỏ áp dụng"
// (fileManagerSong.folder.unapplyFromPlaylist.click) KHÔNG bị chặn, luôn cho phép bất kể rỗng hay
// không (bỏ scope thì không có lý do gì cần chặn).
eventBus.registerBlock('fileManagerSong.folder.applyToPlaylist.click', [
    [
        { field: 'folderDetailSongCount', operator: '===', value: 0 },
    ],
], { notify: t('fileManager.song.folderDetail.applyBlockedEmpty') });

// ===================== Generic Drawer — chặn mở chồng khi đang mở =====================
// MỚI (13/07/2026, Giang yêu cầu) — Generic Drawer dùng CHUNG cho nhiều tính năng (hiện Document
// Picker/Reader — event/workflow/document-reader.js), CHỈ 1 bodyHtml tại 1 thời điểm. Nếu 2 nơi
// cùng lúc gọi mở (vd người dùng bấm liên tiếp rất nhanh, hoặc 1 tính năng khác sau này cũng mở
// Generic Drawer trong lúc Document Picker đang hiện), lần mở SAU sẽ ghi đè bodyHtml của lần mở
// TRƯỚC — âm thầm hỏng cả 2. Bản chất là CHẶN HẲN (không chọn giữa nhiều tiến trình khác nhau, chỉ
// không cho chạy khi đã mở) — đúng tiêu chí dùng Block gate. `isGenericDrawerOpen`
// (service/state.js) do core/generic-drawer.js tự ghi true/false đúng nhịp mở/đóng thật (xem
// docstring ở đó). CHỈ có đúng 1 msg.type "mở" hiện tại ('documentPicker.open.click') — tính năng
// MỚI nào sau này cũng mở Generic Drawer PHẢI tự đăng ký thêm 1 dòng tương tự ở đây cho msg.type
// của nó, KHÔNG tự suy luận miễn trừ.
eventBus.registerBlock('documentPicker.open.click', [
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
// năng dùng CHUNG `bgVideoElement`, KHÔNG được cùng bật. MỖI CHIỀU BẬT là 1 msg.type RIÊNG (KHÔNG
// còn 1 msg.type '.change' + payload checked — Block gate chỉ đọc appState, không đọc được payload,
// xem event/bus.js::evalCondition()) — cùng tiền lệ 'folder.applyToPlaylist.click' KHÁC
// 'folder.unapplyFromPlaylist.click' ở trên. Chiều "TẮT" (disable.click) KHÔNG đăng ký gì — luôn
// cho phép, không có gì cần khoá khi tắt.
eventBus.registerBlock('fileManagerVideo.playerModeToggle.enable.click', [
    [
        { field: 'vizConfig.videoBgEnabled', operator: '===', value: true },
    ],
], { notify: t('fileManager.video.playerModeToggle.blockedByBgVideo') });

eventBus.registerBlock('visualizerControlCenter.videoEnable.enable.click', [
    [
        { field: 'isVideoPlayerMode', operator: '===', value: true },
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
