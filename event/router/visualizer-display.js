/**
 * event/router/visualizer-display.js — Router tên "visualizerDisplay", tự đăng ký với eventBus
 * lúc nạp.
 *
 * PHẠM VI: toàn bộ 20 `addEventListener` cũ của core/visualizer/visualizer-display.js — kiểu hiệu ứng
 * (cycle button), chất lượng canvas, ảnh nền (upload/toggle/blur), màu sắc (mode/solid/dynamic),
 * style con (vortex/bar/rain), glass flash, kích thước bar/mirror, volume, EQ mode.
 *
 * === Batch D3 (Settings restructure, 06/07/2026) ===
 * 14/20 msg.type (panel Visualizer Settings, nay push/pop động) ĐỔI sang gọi workflow — core đã
 * refactor Rule 1-4 đầy đủ (Batch D2 CHỐT áp dụng chung), không còn tự gọi core khác nội bộ. THÊM
 * case MỚI 'openPanel.click' (push panel — trước đây thuộc router "visualizerMiscSettings", dời
 * VỀ ĐÚNG router của chính nó, cùng cách đã làm với Subtitle ở Batch D2).
 * 6 msg.type còn lại (bgImage toggle/bgBlur/quality... — SAI, quality ĐÃ dời) — Main/Control
 * Center tĩnh: bgImage.toggle (đã qua workflow từ trước), volume.input/eqMode.change/
 * cycleMode.click (gọi thẳng core, không đổi). Batch "nền chung" (07/07/2026) — bgBlur.input ĐỔI
 * sang workflow (core setBgBlur() nay Rule 1-4 đầy đủ, không còn tự gọi updatePlaylistBg()/
 * saveConfig() nội bộ).
 *
 * QUY TẮC RẼ NHÁNH (giống router/storage.js, router/playlist.js):
 *   - Nghiệp vụ chỉ cần ĐÚNG 1 HÀM CORE (không shield/modal) -> router gọi THẲNG, BỎ QUA workflow.
 *   - Nghiệp vụ cần shield/modal, HOẶC >1 hàm core nối tiếp -> router giao cho workflowVisualizerDisplay.
 *
 * STATE CONTEXT: không có — mọi msg.type đọc/ghi thẳng vizConfig (biến toàn cục đã có từ trước
 * /event/, NẰM NGOÀI phạm vi EventStore — xem event/store.js, "KHÔNG đưa các biến nghiệp vụ to
 * toàn cục của app vào đây").
 *
 * Cross-call (updateTypeUI có 3 nguồn: cycle button ở đây, select #setting-visualizer-type ở
 * equalizer-settings.js, timer auto-switch-visual.js) — GIỮ NGUYÊN lệnh gọi hàm trực tiếp như
 * trước /event/, KHÔNG thuộc phạm vi patch này (xem plan.md, đã chốt lùi việc đưa cross-call qua
 * bus tới khi 134 listener gốc tách xong hết).
 *
 * NẠP SAU: event/bus.js, core/visualizer/visualizer-display.js (cần toàn bộ hàm core ở trên),
 * core/settings-panel-stack.js (pushSettingsPanel), event/workflow/visualizer-display.js (cần
 * workflowVisualizerDisplay tồn tại). NẠP TRƯỚC: event/listener/visualizer-display.js.
 */
const routerVisualizerDisplay = (() => {

    /** @param {import('../bus.js').EventMessage} msg */
    function handle(msg) {
        switch (msg.type) {

            case 'visualizerDisplay.openPanel.click': {
                workflowVisualizerDisplay.openPanel();
                break;
            }

            case 'visualizerDisplay.cycleMode.click': {
                cycleVisualizerType(); // tự kiểm tra autoSwitchVisualEnabled bên trong
                break;
            }

            case 'visualizerDisplay.quality.change': {
                const { value } = msg.payload;
                workflowVisualizerDisplay.setQuality(value);
                break;
            }

            // ===================== Ảnh nền (Main, KHÔNG di chuyển) =====================
            case 'visualizerDisplay.bgImage.toggle': {
                const { enabled } = msg.payload;
                workflowVisualizerDisplay.toggleBgImage({ enabled });
                break;
            }

            case 'visualizerDisplay.bgBlur.input': {
                // Batch "nền chung" (07/07/2026) — core setBgBlur() giờ Rule 1-4 đầy đủ (bỏ
                // updatePlaylistBg/saveConfig nội bộ) -> >1 hàm core -> workflow.
                const { value } = msg.payload;
                workflowVisualizerDisplay.setBgBlur(value);
                break;
            }

            // ===================== Màu sắc =====================
            // (case 'bgColor.input' XOÁ — v13: màu nền dời sang cụm router `visualBg`.)

            case 'visualizerDisplay.colorMode.change': {
                const { value } = msg.payload;
                workflowVisualizerDisplay.setColorMode(value);
                break;
            }

            case 'visualizerDisplay.solidColor.pickerInput': {
                const { value, crossEl } = msg.payload;
                workflowVisualizerDisplay.setSolidColorFromPicker(value, crossEl);
                break;
            }

            case 'visualizerDisplay.solidColor.textInput': {
                const { value, crossEl } = msg.payload;
                workflowVisualizerDisplay.setSolidColorFromText(value, crossEl); // tự validate format hex bên trong, no-op nếu sai
                break;
            }

            case 'visualizerDisplay.dynColorA.input': {
                const { value } = msg.payload;
                workflowVisualizerDisplay.setDynColorA(value);
                break;
            }

            case 'visualizerDisplay.dynColorB.input': {
                const { value } = msg.payload;
                workflowVisualizerDisplay.setDynColorB(value);
                break;
            }

            // ===================== Style con theo từng kiểu hiệu ứng =====================
            case 'visualizerDisplay.vortexStyle.change': {
                const { value } = msg.payload;
                workflowVisualizerDisplay.setVortexStyle(value);
                break;
            }

            case 'visualizerDisplay.barStyle.change': {
                const { value } = msg.payload;
                workflowVisualizerDisplay.setBarStyle(value);
                break;
            }

            case 'visualizerDisplay.rainStyle.change': {
                const { value } = msg.payload;
                workflowVisualizerDisplay.setRainStyle(value);
                break;
            }

            case 'visualizerDisplay.glassFlash.change': {
                const { checked } = msg.payload;
                workflowVisualizerDisplay.setGlassFlash(checked);
                break;
            }

            // ===================== Kích thước bar/mirror =====================
            case 'visualizerDisplay.maxHeight.input': {
                const { value, displayEl } = msg.payload;
                workflowVisualizerDisplay.setMaxHeight(value, displayEl);
                break;
            }

            case 'visualizerDisplay.barWidth.input': {
                const { value, displayEl } = msg.payload;
                workflowVisualizerDisplay.setBarWidth(value, displayEl);
                break;
            }

            case 'visualizerDisplay.mirrorCount.input': {
                const { value, displayEl } = msg.payload;
                workflowVisualizerDisplay.setMirrorCount(value, displayEl);
                break;
            }
            // (Phần B, Galaxy — 5 case spaceStyle/4 slider ĐÃ BỎ 21/07/2026, phản hồi Giang mục 1)

            // ===================== Volume / EQ (Main, KHÔNG di chuyển) =====================
            case 'visualizerDisplay.volume.input': {
                const { value } = msg.payload;
                setVolume(value);
                break;
            }

            case 'visualizerDisplay.eqMode.change': {
                const { value } = msg.payload;
                setEQMode(value);
                break;
            }

            default:
                console.warn(`[router:visualizerDisplay] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`);
        }
    }

    return { handle };
})();

eventBus.register('visualizerDisplay', routerVisualizerDisplay);
