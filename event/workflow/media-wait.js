/**
 * event/workflow/media-wait.js — Workflow "mediaWait": danh sách LƯỢT CHỜ sự kiện của 2 phần tử media TĨNH (`audioPlayer`,
 * `bgVideoElement`). Workflow cần "đợi lần kế tiếp sự kiện X" (cổng seek, nạp lại giữ vị trí, khung đóng băng, kéo tua,
 * chờ khung hình thật, chờ media nạp đủ lúc vào Visualizer) thì đăng ký ở đây thay vì tự `addEventListener`. Sự kiện đi event/listener/media-wait.js →
 * event/router/media-wait.js → `notify()`.
 *
 * Lượt chờ CHỈ tính sự kiện tới SAU lúc đăng ký. Callback của `once()` chạy ĐỒNG BỘ ngay trong lúc trình duyệt xử lý sự
 * kiện (eventBus.send đồng bộ) — cùng thời điểm listener `{ once: true }`; Listener của cụm nạp SAU các Listener media
 * khác nên lượt chờ chạy SAU chúng (như listener gắn lúc app đang chạy).
 *
 * NẠP SAU: core/dom-refs.js (audioPlayer, bgVideoElement), service/task-manager.js. NẠP TRƯỚC: event/router/media-wait.js.
 */

/** Phần tử media tĩnh -> khoá `target` trong payload của Listener (event/listener/media-wait.js). */
const MEDIA_WAIT_TARGET_BY_ELEMENT = new Map([[audioPlayer, 'audio'], [bgVideoElement, 'bgVideo']]);

const workflowMediaWait = {
    _waiters: [], // { target, eventName, callback } — chờ lần kế tiếp sự kiện tới

    /** Gọi `callback` ĐÚNG 1 lần ở lần kế tiếp `mediaEl` bắn `eventName`.
     * @param {HTMLMediaElement} mediaEl - audioPlayer | bgVideoElement @param {string} eventName @param {() => void} callback
     * @returns {() => void} huỷ lượt chờ (gọi lặp vô hại) */
    once(mediaEl, eventName, callback) {
        const waiter = { target: MEDIA_WAIT_TARGET_BY_ELEMENT.get(mediaEl), eventName, callback };
        if (!waiter.target) console.warn('[workflow:mediaWait] phần tử không phải media tĩnh — lượt chờ sẽ không bao giờ tới:', mediaEl);
        this._waiters.push(waiter);
        return () => this._remove(waiter);
    },

    /** Đợi lần kế tiếp `eventName` hoặc hết `timeoutMs`. Hết giờ qua `taskManager.once(…, taskName)` — cùng tên thì lệnh
     * sau thay timeout lệnh trước; sự kiện tới trước thì timeout bắn sau đó không làm gì.
     * @param {HTMLMediaElement} mediaEl @param {string} eventName @param {number} timeoutMs @param {string} [taskName]
     * @returns {Promise<boolean>} true = sự kiện tới, false = hết giờ */
    wait(mediaEl, eventName, timeoutMs, taskName) {
        return new Promise((resolve) => {
            let settled = false;
            const finish = (ok) => {
                if (settled) return;
                settled = true;
                cancel();
                resolve(ok);
            };
            const cancel = this.once(mediaEl, eventName, () => finish(true));
            taskManager.once(() => finish(false), timeoutMs, taskName); // service/task-manager.js
        });
    },

    /** Đợi sự kiện ĐẦU TIÊN tới trong `eventNames` (không hạn giờ) — các lượt chờ còn lại tự huỷ.
     * @param {HTMLMediaElement} mediaEl @param {string[]} eventNames @returns {Promise<string>} tên sự kiện tới trước */
    waitFirst(mediaEl, eventNames) {
        return new Promise((resolve) => {
            const cancels = eventNames.map((eventName) => this.once(mediaEl, eventName, () => {
                cancels.forEach((cancel) => cancel());
                resolve(eventName);
            }));
        });
    },

    /** Ứng 'mediaWait.event' — gọi (theo thứ tự đăng ký) mọi lượt chờ khớp rồi xoá chúng.
     * @param {'audio'|'bgVideo'} target @param {string} eventName */
    notify(target, eventName) {
        const due = this._waiters.filter((w) => w.target === target && w.eventName === eventName);
        if (due.length === 0) return;
        this._waiters = this._waiters.filter((w) => !due.includes(w));
        due.forEach((w) => w.callback());
    },

    _remove(waiter) {
        this._waiters = this._waiters.filter((w) => w !== waiter);
    },
};
