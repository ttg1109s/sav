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
 * NẠP SAU: event/bus.js, event/virtual-machine-state.js, service/state.js (appState),
 * event/workflow/theme.js (workflowTheme).
 * NẠP TRƯỚC: event/listener/theme.js.
 */
const routerTheme = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'theme.selectMode.click': {
                const { mode } = msg.payload;
                const cfg = appConfigViz.getAll(); // đọc 1 lần — cần cho VMState quyết định CHẠY GÌ (mục 4C)
                // "Cần ảnh MỚI" = chưa từng chọn ảnh (bgImage rỗng) HOẶC đang bấm lại ĐÚNG card
                // Background trong lúc nó ĐANG active (muốn đổi ảnh khác) — xem docstring
                // workflowTheme.pickNewBackgroundImage().
                const needsNewBackgroundPhoto = mode === 'background' && (!cfg.bgImage || cfg.themeMode === 'background');
                VirtualMachineState.run([
                    { state: mode, operation: '!==', value: 'background', callback: () => workflowTheme.applyNonBackgroundMode(mode) },
                    { state: needsNewBackgroundPhoto, operation: '===', value: true, callback: () => workflowTheme.pickNewBackgroundImage() },
                    { state: (mode === 'background' && !needsNewBackgroundPhoto), operation: '===', value: true, callback: () => workflowTheme.reuseExistingBackgroundImage() },
                ]);
                break;
            }
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
