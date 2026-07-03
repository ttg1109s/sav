/**
 * event/router/visualizer-display.js — Router tên "visualizerDisplay", tự đăng ký với eventBus
 * lúc nạp.
 *
 * PHẠM VI: toàn bộ 20 `addEventListener` cũ của core/visualizer/visualizer-display.js — kiểu hiệu ứng
 * (cycle button), chất lượng canvas, ảnh nền (upload/toggle/blur), màu sắc (mode/solid/dynamic),
 * style con (vortex/bar/rain), glass flash, kích thước bar/mirror, volume, EQ mode.
 *
 * QUY TẮC RẼ NHÁNH (giống router/storage.js, router/playlist.js):
 *   - Nghiệp vụ chỉ cần ĐÚNG 1 HÀM CORE (không shield/modal) -> router gọi THẲNG, BỎ QUA workflow.
 *   - Nghiệp vụ cần shield/modal (đụng IndexedDB qua setMeta/delMeta, hoặc validate có thể fail)
 *     -> router giao cho workflowVisualizerDisplay (chỉ 'visualizerDisplay.bgImage.pickFromLibrary'
 *     và 'visualizerDisplay.bgImage.toggle' rơi vào nhánh này).
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
 * event/workflow/visualizer-display.js (cần workflowVisualizerDisplay tồn tại). NẠP TRƯỚC:
 * event/listener/visualizer-display.js.
 */
const routerVisualizerDisplay = (() => {

    /** @param {import('../bus.js').EventMessage} msg */
    function handle(msg) {
        switch (msg.type) {

            case 'visualizerDisplay.cycleMode.click': {
                cycleVisualizerType(); // tự kiểm tra autoSwitchVisualEnabled bên trong
                break;
            }

            case 'visualizerDisplay.quality.change': {
                const { value } = msg.payload;
                setVisualizerQuality(value);
                break;
            }

            // ===================== Ảnh nền =====================
            // FIX (03/07/2026, mục 1) — bỏ hẳn 'visualizerDisplay.bgImage.upload' (upload file trực
            // tiếp) — thay bằng picker chọn ảnh có sẵn trong File Manager.
            case 'visualizerDisplay.bgImage.pickFromLibrary': {
                // >1 hàm core nối tiếp (đọc danh sách ảnh + mở picker) -> workflow.
                workflowVisualizerDisplay.pickBgImageFromLibrary();
                break;
            }

            case 'visualizerDisplay.bgImage.toggle': {
                const { enabled } = msg.payload;
                // CẦN shield (đụng IndexedDB) -> giao workflow.
                workflowVisualizerDisplay.toggleBgImage({ enabled });
                break;
            }

            case 'visualizerDisplay.bgBlur.input': {
                const { value } = msg.payload;
                setBgBlur(value);
                break;
            }

            // ===================== Màu sắc =====================
            case 'visualizerDisplay.bgColor.input': {
                const { value } = msg.payload;
                setBgColor(value);
                break;
            }

            case 'visualizerDisplay.colorMode.change': {
                const { value } = msg.payload;
                setColorMode(value);
                break;
            }

            case 'visualizerDisplay.solidColor.pickerInput': {
                const { value } = msg.payload;
                setSolidColorFromPicker(value);
                break;
            }

            case 'visualizerDisplay.solidColor.textInput': {
                const { value } = msg.payload;
                setSolidColorFromText(value); // tự validate format hex bên trong, no-op nếu sai
                break;
            }

            case 'visualizerDisplay.dynColorA.input': {
                const { value } = msg.payload;
                setDynColorA(value);
                break;
            }

            case 'visualizerDisplay.dynColorB.input': {
                const { value } = msg.payload;
                setDynColorB(value);
                break;
            }

            // ===================== Style con theo từng kiểu hiệu ứng =====================
            case 'visualizerDisplay.vortexStyle.change': {
                const { value } = msg.payload;
                setVortexStyle(value);
                break;
            }

            case 'visualizerDisplay.barStyle.change': {
                const { value } = msg.payload;
                setBarStyle(value);
                break;
            }

            case 'visualizerDisplay.rainStyle.change': {
                const { value } = msg.payload;
                setRainStyle(value);
                break;
            }

            case 'visualizerDisplay.glassFlash.change': {
                const { checked } = msg.payload;
                setGlassFlash(checked);
                break;
            }

            // ===================== Kích thước bar/mirror =====================
            case 'visualizerDisplay.maxHeight.input': {
                const { value } = msg.payload;
                setMaxHeight(value);
                break;
            }

            case 'visualizerDisplay.barWidth.input': {
                const { value } = msg.payload;
                setBarWidth(value);
                break;
            }

            case 'visualizerDisplay.mirrorCount.input': {
                const { value } = msg.payload;
                setMirrorCount(value);
                break;
            }

            // ===================== Volume / EQ =====================
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
