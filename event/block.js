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
