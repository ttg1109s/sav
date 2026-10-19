/**
 * event/workflow/timeout.js — tiện ích hẹn giờ dùng chung cho Workflow (qua taskManager, không timer thô):
 *   - `race(promise, ms, label)` — đua 1 Promise với hạn giờ cho các bước "bắt tay" có thể treo im lặng thay vì lỗi
 *     (createWritable() trên vài bản Safari, Worker khởi động, nạp script).
 *   - `heartbeat(ms, onTick)` — gọi `onTick` mỗi `ms` tới khi hàm trả về được gọi (log tiến độ cho Debug Console).
 * Dùng ở index.html (event/workflow/streaming-zip.js) và pages/video-editor.html (event/workflow/video-preview.js).
 *
 * NẠP SAU: service/task-manager.js.
 */
const workflowTimeout = {
    _heartbeatSeq: 0,

    /** @param {Promise<T>} promise @param {number} ms @param {string} label - ghi vào lỗi "Hết thời gian chờ (label)"
     * @returns {Promise<T>} @template T */
    race(promise, ms, label) {
        return new Promise((resolve, reject) => {
            const timer = taskManager.once(() => reject(new Error(`Hết thời gian chờ (${label})`)), ms);
            promise.then((value) => { timer.kill(); resolve(value); }, (err) => { timer.kill(); reject(err); });
        });
    },

    /** @param {number} ms @param {() => void} onTick @returns {() => void} hàm dừng */
    heartbeat(ms, onTick) {
        const name = `heartbeat_${this._heartbeatSeq++}`;
        taskManager.addNew(name, { time: ms, exe: onTick, mode: 'timeout', count: 0 });
        taskManager.operator(name, 'enabled');
        return () => taskManager.kill(name);
    },
};
