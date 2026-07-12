/**
 * event/router/subtitle-editor.js — Router tên "subtitleEditor", tự đăng ký với eventBus. Trang
 * `subtitle-editor.html` DUY NHẤT dùng router này (KHÔNG nạp ở `index.html`).
 */
const routerSubtitleEditor = (() => {
    function handle(msg) {
        switch (msg.type) {
            // Sửa/xoá từng dòng (nút ✓/✕ render động trong renderSubtitleLines()) KHÔNG đi qua
            // đây — Workflow tự truyền callback trực tiếp lúc gọi renderSubtitleLines() (CÙNG
            // PATTERN Document Picker, core/generic-drawer.js) vì nội dung/số lượng dòng đổi liên
            // tục, không phải DOM tĩnh phù hợp cho listener→bus→router.
            case 'subtitleEditor.autoTiming.click': {
                workflowSubtitleEditor.handleAutoTimingClick();
                break;
            }

            case 'subtitleEditor.addLine.click': {
                workflowSubtitleEditor.addNewLine();
                break;
            }

            case 'subtitleEditor.importSrt.change': {
                workflowSubtitleEditor.importSrtFile(msg.payload.file);
                break;
            }

            case 'subtitleEditor.exportSrt.click': {
                workflowSubtitleEditor.exportSrt();
                break;
            }

            case 'subtitleEditor.createLineFromSelection.click': {
                workflowSubtitleEditor.createLineFromSelection();
                break;
            }

            // MỚI (yêu cầu Giang) — mở modal hỏi số dòng muốn chia this._region hiện tại thành.
            case 'subtitleEditor.split.click': {
                workflowSubtitleEditor.openSplitModal();
                break;
            }

            // MỚI (yêu cầu Giang, mục 1) — cắt vùng chọn hiện tại thành file .mp3 thật.
            case 'subtitleEditor.cutMp3.click': {
                workflowSubtitleEditor.cutMp3FromRegion();
                break;
            }

            case 'subtitleEditor.playSelection.click': {
                workflowSubtitleEditor.playSelection();
                break;
            }

            case 'subtitleEditor.save.click': {
                workflowSubtitleEditor.saveToDatabase();
                break;
            }

            // MỚI (11/07/2026, yêu cầu Giang, mục 2).
            case 'subtitleEditor.waveformPlayPause.click': {
                workflowSubtitleEditor.togglePlayPause();
                break;
            }

            // MỚI (yêu cầu Giang, mục 1/2/6) — tự tính seek qua toạ độ + API cuộn thật của
            // WaveSurfer, thay cho cơ chế click-to-seek nội bộ đang lỗi (xem comment ở listener).
            case 'subtitleEditor.seek.click': {
                workflowSubtitleEditor.seekFromClick(msg.payload.clickXInViewport);
                break;
            }

            case 'subtitleEditor.toggleDebugPanel.click': {
                workflowSubtitleEditor.toggleDebugPanel();
                break;
            }

            // MỚI (yêu cầu Giang, mục 3) — nút "Copy all" trong bảng debug log.
            case 'subtitleEditor.copyDebugLog.click': {
                workflowSubtitleEditor.copyDebugLogToClipboard();
                break;
            }

            // MỚI (yêu cầu Giang, mục 2) — chốt start/end vùng chọn = vị trí phát hiện tại.
            case 'subtitleEditor.regionSetStart.click': {
                workflowSubtitleEditor.setRegionStartToCurrentTime();
                break;
            }

            case 'subtitleEditor.regionSetEnd.click': {
                workflowSubtitleEditor.setRegionEndToCurrentTime();
                break;
            }

            // MỚI (yêu cầu Giang, mục 5) — tool "Shift".
            case 'subtitleEditor.shift.click': {
                workflowSubtitleEditor.toggleShiftSelectionMode();
                break;
            }

            case 'subtitleEditor.shiftContinue.click': {
                workflowSubtitleEditor.openShiftModal();
                break;
            }

            case 'subtitleEditor.back.click': {
                workflowSubtitleEditor.back(); // CHỈ history.back() -> gọi thẳng cũng được, nhưng
                // gọi qua workflow cho ĐỒNG NHẤT với mọi hành động khác của trang này.
                break;
            }

            // MỚI (yêu cầu Giang) — tải lại KHÔNG dùng cache.
            case 'subtitleEditor.reloadNoCache.click': {
                workflowSubtitleEditor.reloadWithoutCache();
                break;
            }

            default:
                console.warn(`[routerSubtitleEditor] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('subtitleEditor', routerSubtitleEditor);
