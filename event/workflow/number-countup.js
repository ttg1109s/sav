/**
 * event/workflow/number-countup.js — MỚI (21/09/2026, Giang yêu cầu tách animation number của Game
 * thành thành phần dùng chung). Workflow DÙNG CHUNG: sở hữu VÒNG LẶP timer count-up (taskManager mode
 * 'interval' — CẤM setTimeout/setInterval thô, readme/task-manager-conventions.md) mà trước đây
 * `workflowGameplayEngine._startScoreCountUpAnimation()` tự viết riêng. Nơi gọi CHỈ truyền tên task +
 * số bước + callback vẽ 1 khung hình; phần TÍNH giá trị mỗi bước nằm ở `computeCountupValue()`
 * (core/number-countup.js) — nơi gọi tự gọi nó trong `onFrame` cho từng con số của mình.
 *
 * Dùng bởi: event/workflow/gameplay-engine.js (điểm modal End), event/workflow/statis-panel.js.
 *
 * NẠP SAU: service/task-manager.js, core/number-countup.js.
 * NẠP TRƯỚC: event/workflow/gameplay-engine.js, event/workflow/statis-panel.js.
 */
const NUMBER_COUNTUP_DEFAULT_STEPS = 24;
const NUMBER_COUNTUP_DEFAULT_INTERVAL_MS = 35;

const workflowNumberCountup = {
    /** Chạy `steps` khung hình cách nhau `intervalMs`; mỗi khung gọi `onFrame(step, steps)` với `step`
     * chạy 1..steps (khung cuối `step === steps` -> `computeCountupValue()` trả đúng số đích). Gọi lại
     * với CÙNG `taskName` tự huỷ lượt cũ (guard chống chạy chồng). Muốn dừng sớm: `taskManager.kill(taskName)`.
     * @param {string} taskName
     * @param {{steps?:number, intervalMs?:number, onFrame:function(number, number):void}} options */
    run(taskName, { steps, intervalMs, onFrame }) {
        const totalSteps = steps || NUMBER_COUNTUP_DEFAULT_STEPS;
        let step = 0;
        taskManager.kill(taskName);
        taskManager.addNew(taskName, {
            time: intervalMs || NUMBER_COUNTUP_DEFAULT_INTERVAL_MS, mode: 'interval', count: totalSteps,
            exe: () => {
                step++;
                onFrame(step, totalSteps);
                if (step >= totalSteps) taskManager.operator(taskName, 'disabled');
            },
        });
        taskManager.operator(taskName, 'enabled');
    },
};
