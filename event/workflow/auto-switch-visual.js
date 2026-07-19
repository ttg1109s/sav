/**
 * event/workflow/auto-switch-visual.js — "THẰNG THỰC THI CUỐI" của router "autoSwitchVisual".
 *
 * MỚI (Batch D3, Settings restructure, 06/07/2026) — TRƯỚC ĐÂY router gọi thẳng core (mỗi
 * msg.type chỉ cần 1 hàm, không cần workflow). GIỜ CẦN workflow vì core/auto-switch-visual.js đã
 * refactor Rule 1-4 đầy đủ (bỏ `saveConfig()`/`updateCycleModeButtonState()`/
 * `startAutoSwitchVisualBranch()`/`syncAutoSwitchTimeModeBlocks()` nội bộ) — mọi msg.type giờ là
 * >1 hàm core nối tiếp.
 *
 * NẠP SAU: core/auto-switch-visual.js, core/config.js (saveConfig).
 */
const workflowAutoSwitchVisual = {

    setEnabled(checked, optionsEl) {
        setAutoSwitchVisualEnabled(checked, optionsEl);
        saveConfig();
        updateCycleModeButtonState(); // khoá/mở #btn-cycle-mode NGAY khi người dùng bật/tắt
        updateVisualizerTypeSelectState(); // FIX BUG 19/07/2026 (mục 5) — khoá luôn select "Kiểu hiệu ứng"
        startAutoSwitchVisualBranch(); // bật -> khởi động đúng nhánh; tắt -> hàm tự kill hết vì shouldRun=false
    },

    setMode(value) {
        setAutoSwitchVisualMode(value);
        saveConfig();
        // KHÔNG cần khởi động lại gì — đổi cách CHỌN MỚI chỉ ảnh hưởng lần CHỌN MỚI kế tiếp.
    },

    setTimeMode(value, blockFixedEl, blockRandomEl, blockDurationEl) {
        setAutoSwitchVisualTimeMode(value);
        syncAutoSwitchTimeModeBlocks(value, blockFixedEl, blockRandomEl, blockDurationEl);
        saveConfig();
        startAutoSwitchVisualBranch(); // đổi NHÁNH hẳn -> kill nhánh cũ, khởi động nhánh mới từ đầu
    },

    setSecondsField(fieldName, rawValue, inputEl) {
        setAutoSwitchVisualSecondsField(fieldName, rawValue, inputEl);
        saveConfig();
        startAutoSwitchVisualBranch(); // đổi X giây -> áp dụng lại từ đầu cho nhánh đang chạy
    }
};
