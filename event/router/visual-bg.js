/**
 * event/router/visual-bg.js — Router tên "visualBg", tự đăng ký với eventBus lúc nạp (v13,
 * plan-v13-visual-background-unification.md).
 *
 * MỌI case ở đây đều ≥2 bước phụ thuộc thứ tự (ghi config + persist IndexedDB + đồng bộ UI + áp
 * lại nền thật) -> giao hết cho `workflowVisualBg`, KHÔNG case nào gọi thẳng Core (điều kiện (A),
 * event-bus-flow.md mục 4A, không thoả).
 *
 * NGOẠI LỆ DUY NHẤT: case 'visualBg.pickSource.click' — rẽ theo tổ hợp `mediaType`×`sourceMode`
 * qua `VirtualMachineState.run()` (event-bus-flow.md mục 4C: MỌI rẽ nhánh theo state đều đi qua
 * đây, không viết switch/if tay trong case).
 *
 * NẠP SAU: event/bus.js, event/virtual-machine-state.js, event/workflow/visual-bg.js (workflowVisualBg).
 * NẠP TRƯỚC: event/listener/visual-bg.js.
 */
const routerVisualBg = (() => {
    /** @param {import('../bus.js').EventMessage} msg */
    function handle(msg) {
        switch (msg.type) {
            case 'visualBg.openPanel.click':
                workflowVisualBg.openPanel(); // push panel + đọc DB vẽ nhãn nguồn -> workflow
                break;

            // 2 case TÁCH RIÊNG (không phải 1 case + payload.checked) để Block gate đăng ký chặn
            // được ĐÚNG chiều "bật" — xem event/block.js + event/listener/visual-bg.js.
            case 'visualBg.enable.on.click':
                workflowVisualBg.changeEnabled(true);
                break;

            case 'visualBg.enable.off.click':
                workflowVisualBg.changeEnabled(false);
                break;

            case 'visualBg.mediaType.change':
                workflowVisualBg.changeMediaType(msg.payload.value);
                break;

            case 'visualBg.sourceMode.change':
                workflowVisualBg.changeSourceMode(msg.payload.checked);
                break;

            case 'visualBg.listPlaybackMode.change':
                workflowVisualBg.changeListPlaybackMode(msg.payload.value);
                break;

            case 'visualBg.nextOrder.change':
                workflowVisualBg.changeNextOrder(msg.payload.value);
                break;

            // "Chọn nguồn..." — rẽ theo TỔ HỢP `mediaType`×`sourceMode` (4 tổ hợp -> 4 picker khác
            // nhau). ĐÚNG phạm vi VirtualMachineState: rẽ nhánh theo GIÁ TRỊ STATE để CHỌN GỌI
            // callback nào, nằm ở tầng Router (KHÔNG viết if/else tay trong case, KHÔNG đẩy việc
            // chọn xuống 1 hàm Workflow "làm hết" — đó sẽ là rẽ nhánh sai tầng).
            // Ghép 2 field thành 1 chuỗi so sánh vì `VirtualMachineState.run()` so sánh MỘT giá trị
            // state cho mỗi rule — 4 rule loại trừ nhau tự nhiên, chỉ 1 callback chạy.
            case 'visualBg.pickSource.click': {
                const cfg = appConfigVisualBg.getAll();
                const combo = `${cfg.mediaType}:${cfg.sourceMode}`;
                VirtualMachineState.run([
                    { state: combo, operation: '===', value: 'image:single', callback: () => workflowVisualBg.openSingleImagePicker() },
                    { state: combo, operation: '===', value: 'video:single', callback: () => workflowVisualBg.openSingleVideoPicker() },
                    { state: combo, operation: '===', value: 'image:list',   callback: () => workflowVisualBg.openListAlbumPicker() },
                    { state: combo, operation: '===', value: 'video:list',   callback: () => workflowVisualBg.openListFolderPicker() },
                ]);
                break;
            }

            case 'visualBg.clearSource.click':
                workflowVisualBg.clearCurrentSource();
                break;

            // Kết quả 3 picker Generic Drawer (picker ảnh đơn là modal callback-based có sẵn, KHÔNG
            // đi qua bus — xem workflowVisualBg.openSingleImagePicker()).
            case 'visualBg.videoPicker.tile.click':
                workflowVisualBg.selectVideoFromPicker(msg.payload.videoKey);
                break;

            case 'visualBg.videoPicker.close.click':
                workflowVisualBg.cancelVideoPicker();
                break;

            case 'visualBg.albumPicker.tile.click':
                workflowVisualBg.selectAlbumFromPicker(msg.payload.albumId);
                break;

            case 'visualBg.albumPicker.cancel.click':
                workflowVisualBg.cancelAlbumPicker();
                break;

            // Bài hát vừa ĐỔI THẬT — gửi từ core/playlist/actions.js::playSong(), CHỈ khi key mới
            // khác key cũ (seek trong cùng bài không gửi). THAY task poll `currentKey` mỗi 1s.
            // `enabled` + `sourceMode` là ĐIỀU KIỆN CHUNG cho cả 2 nhánh -> guard clause; phần rẽ
            // theo `mediaType` mới là 2 nhánh ĐỘC LẬP THẬT -> VirtualMachineState.
            case 'visualBg.songChanged': {
                const bgCfg = appConfigVisualBg.getAll();
                if (!bgCfg.enabled || bgCfg.sourceMode !== 'list') break; // chỉ nguồn DANH SÁCH mới đổi theo bài
                VirtualMachineState.run([
                    { state: bgCfg.mediaType, operation: '===', value: 'image', callback: () => workflowSlideshow.advanceForSongChange() },
                    { state: bgCfg.mediaType, operation: '===', value: 'video', callback: () => workflowVisualBg.advanceListVideo() },
                ]);
                break;
            }

            // (2 case 'folderPicker.*' ĐÃ XOÁ — picker folder dùng
            // `workflowPlaylist._openFolderPickerDrawer()`, nó tự đóng Drawer + gọi onPick callback,
            // không đi qua bus của miền này.)

            // Sub-panel "Tuỳ chỉnh Trình chiếu" — tái dùng THẲNG Workflow miền `slideshowSettings`
            // (liên tuyến domain TH2, event-bus-flow.md mục 3a): panel đó là 1 nghiệp vụ ĐỘC LẬP đã
            // có sẵn, cần nguyên vẹn, KHÔNG viết lại bản sao trong miền này.
            case 'visualBg.openSlideshowPanel.click':
                workflowSlideshow.openPanel();
                break;

            default:
                console.warn(`[routerVisualBg] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('visualBg', routerVisualBg);
