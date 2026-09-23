/**
 * event/router/theme.js — Router tên "theme", tự đăng ký với eventBus lúc nạp (MỞ ĐẦU THEME THẬT,
 * 07/07/2026, phản hồi Giang mục 3).
 *
 * SỬA (17/07/2026, phản hồi Giang — SAI KIẾN TRÚC ở bản trước) — case 'theme.selectMode.click'
 * TRƯỚC ĐÂY gọi thẳng 1 hàm workflow duy nhất (`workflowTheme.selectThemeMode()`), rồi hàm đó tự
 * `appState.get()` + if/else BÊN TRONG để chọn "chạy gì" — ĐÚNG chỗ event-bus-flow.md mục 4C mô tả:
 * "Cần đọc appState KHÁC để quyết định CHẠY GÌ (chọn giữa các Core/Workflow khác nhau) — dù chỉ 1
 * điều kiện/1 đích hay nhiều — LUÔN dùng VirtualMachineState, không viết switch/if tay đọc appState
 * trong case nữa". SỬA: Router tự đọc `vizConfig` 1 lần, tính sẵn `needsNewBackgroundPhoto`, rồi
 * `VirtualMachineState.run()` chọn ĐÚNG 1 trong 3 method workflow (3 rule loại trừ nhau) — mỗi
 * method chỉ làm phần RIÊNG của nó rồi gọi chung `workflowTheme._commitThemeMode()` (phần "chốt
 * mode" DÙNG CHUNG cả 3 nhánh — xem event/workflow/theme.js).
 *
 * NẠP SAU: event/bus.js, event/virtual-machine-state.js,
 * event/workflow/theme.js (workflowTheme).
 * NẠP TRƯỚC: event/listener/theme.js.
 */
const routerTheme = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'theme.selectMode.click': {
                // SỬA 23/09/2026 (Giang báo "Morphin — bấm Photo/Video của Background media không hiện picker") — Router này KHÔNG được cập
                // nhật khi viết lại event/workflow/theme.js (21/09/2026): case cũ gọi `pickNewBackgroundImage()`/`reuseExistingBackgroundImage()`
                // (không còn tồn tại -> ném lỗi khi bấm card Background media), và THIẾU hẳn các case nút Photo/Video, ô màu Solid, picker
                // media, ẩn/hiện app (message rơi vào `default`, chỉ warn). Giờ khớp đúng các method hiện có của workflowTheme.
                // 2 rule loại trừ nhau theo `mode` (payload, không đọc appState): card khác media -> chốt mode; card media -> dùng lại item đã có
                // (chưa có item -> workflow tự bỏ qua, người dùng chọn qua nút Photo/Video bên dưới card).
                const { mode } = msg.payload;
                VirtualMachineState.run([
                    { state: mode, operation: '!==', value: 'background', callback: () => workflowTheme.applyNonBackgroundMode(mode) },
                    { state: mode, operation: '===', value: 'background', callback: () => workflowTheme.reuseExistingBackgroundMedia() },
                ]);
                break;
            }
            case 'theme.pickBackgroundMedia.click': // MỚI 23/09/2026 — nút Photo/Video dưới card Background media -> mở picker thư viện
                workflowTheme.pickBackgroundMedia(msg.payload.kind);
                break;
            case 'theme.mediaPicker.tile.click': // MỚI 23/09/2026 — bấm 1 item trong picker (openMediaPickerDrawerUi, msgPrefix 'theme.mediaPicker')
                workflowTheme.handleMediaPickerTileClick(msg.payload);
                break;
            case 'theme.mediaPicker.close.click': // MỚI 23/09/2026 — nút X của picker
                workflowTheme.handleMediaPickerCloseClick();
                break;
            case 'theme.appStackScreen.change':
                workflowTheme.onAppStackScreenChange();
                break;
            case 'theme.documentVisibility.change': // MỚI 23/09/2026 — trước đây thiếu case -> video nền không dừng khi ẩn app
                workflowTheme.onDocumentVisibilityChange();
                break;
            case 'theme.solidColor.input': // MỚI 23/09/2026 — trước đây thiếu case -> ô màu Solid không có tác dụng
                workflowTheme.setSolidColor(msg.payload.value);
                break;
            case 'theme.bgBlur.input': // MỚI 23/09/2026 — slider độ mờ ảnh nền (hàng riêng dưới 3 card, core/theme-background-ui.js)
                workflowTheme.setBgBlur(msg.payload.value);
                break;
            case 'theme.gradientFrom.input':
                workflowTheme.setGradientFrom(msg.payload.value);
                break;
            case 'theme.gradientTo.input':
                workflowTheme.setGradientTo(msg.payload.value);
                break;
            default:
                console.warn(`[routerTheme] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('theme', routerTheme);
