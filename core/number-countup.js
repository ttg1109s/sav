/**
 * core/number-countup.js — MỚI (21/09/2026, Giang yêu cầu "game có core animation number, dùng luôn
 * và tách thành core chung"). TÁCH phần TÍNH giá trị count-up ra khỏi `workflowGameplayEngine.
 * _startScoreCountUpAnimation()` (event/workflow/gameplay-engine.js — trước đây tự nhân `ratio =
 * step / STEPS` inline) thành 1 core THUẦN dùng chung: Game (điểm modal End) và panel Statistics
 * (event/workflow/statis-panel.js) cùng gọi.
 *
 * Phân vai theo Rule 3b (Core = THI HÀNH, Workflow = CHUẨN BỊ/ĐIỀU PHỐI):
 *   - File NÀY: chỉ TÍNH "ở bước `step`/`totalSteps` thì con số hiển thị là bao nhiêu" — không DOM,
 *     không timer, không appState (Rule 2), không gọi core khác (Rule 3a).
 *   - Vòng lặp timer: `event/workflow/number-countup.js` (`workflowNumberCountup.run()`, qua taskManager
 *     — Core CẤM dùng taskManager).
 *   - Ghi DOM: nơi dùng tự lo (Game: `renderScoreCountupFrame()` core/gameplay/engine-ui.js; Statistics:
 *     Workflow panel ghi thẳng `textContent`/`style.width` như nó vẫn ghi `innerHTML`).
 *
 * NẠP TRƯỚC: core/gameplay/engine-ui.js, event/workflow/gameplay-engine.js, event/workflow/statis-panel.js.
 */

/**
 * Giá trị hiển thị của 1 con số đang đếm lên ở bước `step` trên tổng `totalSteps` bước.
 *
 * `easePower` gộp "kiểu chạy" vào 1 công thức duy nhất, KHÔNG rẽ nhánh theo tên easing: `ratio = 1 -
 * (1 - linear)^easePower` — `1` = tuyến tính (đúng công thức cũ của Game), `3` = ease-out cubic (nhanh
 * lúc đầu, chậm dần khi tới đích — cảm giác "chốt số" mượt hơn, dùng ở Statistics).
 *
 * `step >= totalSteps` (hoặc `totalSteps` không hợp lệ) trả THẲNG `finalValue` — chốt ĐÚNG số cuối,
 * tránh sai số làm tròn dồn qua từng bước (đúng ý dòng "chốt đúng số cuối" cũ ở gameplay-engine.js).
 *
 * @param {number} finalValue - số đích
 * @param {number} step - bước hiện tại (0..totalSteps)
 * @param {number} totalSteps
 * @param {number} easePower - 1 = tuyến tính, >1 = ease-out (càng lớn càng dồn về đầu)
 * @param {number} decimals - số chữ số thập phân giữ lại (0 = số nguyên)
 * @returns {number}
 */
function computeCountupValue(finalValue, step, totalSteps, easePower, decimals) {
    if (!(totalSteps > 0) || step >= totalSteps) return finalValue;
    const linear = Math.max(0, step) / totalSteps;
    const ratio = 1 - Math.pow(1 - linear, easePower);
    const factor = Math.pow(10, decimals || 0);
    return Math.round(finalValue * ratio * factor) / factor;
}
