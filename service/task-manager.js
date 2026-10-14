/**
 * service/task-manager.js — quản lý TẬP TRUNG mọi hẹn giờ của app (dịch vụ hạ tầng, không phải nghiệp vụ): mọi chờ N ms, lặp,
 * và chờ khung hình đều đăng ký qua instance `taskManager`, không gọi thẳng setTimeout/setInterval/requestAnimationFrame
 * (readme/task-manager-conventions.md). Chuyển thể từ bản gốc ES module (class Loop/TaskManager) sang global-script.
 *
 * 3 mode của `Loop`: 'timeout' (bù trôi — mọi task lặp thường dùng mode này), 'interval' (không dùng), 'raf'
 * (requestAnimationFrame, tự xin khung kế; `time` vô nghĩa nên bỏ qua validate time > 0).
 *
 * Các kiểu task:
 *   (A) Task LẶP sống lâu, tên cố định: addNew() + operator(name, 'enabled'), pause()/resume(), kill() khi dọn hẳn
 *       (vd 'listenClock', 'autoSwitchVisual', 'visualizerRender' mode 'raf').
 *   (B) Chờ N ms 1 lần (thay setTimeout): once(fn, ms, name?).
 *   (C) Chờ N khung hình 1 lần (thay requestAnimationFrame / rAF lồng nhau): onceFrame(fn, frames?, name?).
 *   (B)/(C): không có `name` -> tự sinh tên duy nhất; có `name` cố định -> gọi lại cùng tên tự huỷ bản cũ rồi đặt lại
 *   (debounce). Trả { name, kill() } để huỷ sớm.
 *
 * Chỉ Workflow được dùng `taskManager` (Core/Router/Listener không). Nạp sớm (trước core/workflow).
 */
        class Loop {
            /**
             * @param {number} time - Thời gian lặp (ms). Vô nghĩa khi mode = 'raf'.
             * @param {function} callback - Hàm thực thi
             * @param {string} mode - 'interval' | 'timeout' (bù giờ) | 'raf' (requestAnimationFrame)
             * @param {number} count - Số lần chạy (0 = vô hạn)
             */
            constructor(time = 0, callback = () => { }, mode = 'interval', count = 0) {
                this.time = time;
                this.callback = callback;
                this.mode = mode;
                this.count = count;
                this.currentCount = 0;

                this.timerId = null;
                this.isRunning = false;
                this.isBusy = false;
                this.expected = 0;
                this.lastTick = 0;
                this.isPaused = false;
                this.remainingTime = 0;
            }

            #tickCount() {
                if (!this.isRunning) return false;
                this.currentCount++;

                if (this.count > 0 && this.currentCount >= this.count) {
                    this.disabled();
                    return false;
                }
                return true;
            }

            #runInterval() {
                if (this.timerId) clearInterval(this.timerId);

                this.timerId = setInterval(() => {
                    if (!this.isRunning || this.isPaused) return;
                    if (this.isBusy) return;
                    this.isBusy = true;
                    this.lastTick = Date.now();

                    try {
                        this.callback();
                    } catch (error) {
                        console.error("TaskManager Interval Error:", error);
                    }

                    this.#tickCount();
                    this.isBusy = false;
                }, Math.max(10, this.time));
            }

            #runTimeout() {
                if (!this.isRunning) return;

                const now = Date.now();
                const drift = now - this.expected;

                if (drift > this.time) {
                    this.expected = now;
                }

                try {
                    this.callback();
                } catch (error) {
                    console.error("TaskManager Timeout Error:", error);
                }

                if (!this.#tickCount()) return;

                this.expected += this.time;
                const nextDelay = Math.max(10, this.time - drift);

                this.timerId = setTimeout(() => {
                    if (this.isRunning) this.#runTimeout();
                }, nextDelay);
            }

            /** Cùng cấu trúc #runTimeout() (chạy callback trước, tự xin lượt kế sau), hẹn bằng requestAnimationFrame. */
            #runRaf() {
                if (!this.isRunning || this.isPaused) return;
                if (this.isBusy) { // hiếm — 1 tick trước còn đang chạy (lỗi đồng bộ lạ), bỏ qua tick này, vẫn xin tick kế tiếp
                    this.timerId = requestAnimationFrame(() => { if (this.isRunning) this.#runRaf(); });
                    return;
                }
                this.isBusy = true;
                this.lastTick = Date.now();

                try {
                    this.callback();
                } catch (error) {
                    console.error("TaskManager Raf Error:", error);
                }

                this.isBusy = false;
                if (!this.#tickCount()) return; // count giới hạn đã hết -> #tickCount() tự disabled(), không xin tick nữa

                this.timerId = requestAnimationFrame(() => {
                    if (this.isRunning) this.#runRaf();
                });
            }

            enabled() {
                if (typeof this.callback !== 'function') {
                    console.error("TaskManager: Callback must be a function");
                    return;
                }
                // mode 'raf': `time` vô nghĩa (trình duyệt tự quyết định nhịp vẽ) — bỏ qua validate này.
                if (this.mode !== 'raf' && this.time <= 0) {
                    console.error("TaskManager: Time must be greater than 0");
                    return;
                }

                if (this.isRunning) return;
                this.isRunning = true;
                this.isPaused = false;
                this.currentCount = 0;
                this.isBusy = false;
                this.lastTick = Date.now();

                if (this.mode === 'interval') {
                    this.#runInterval();
                } else if (this.mode === 'timeout') {
                    this.expected = Date.now() + this.time;
                    this.timerId = setTimeout(() => {
                        if (this.isRunning) this.#runTimeout();
                    }, this.time);
                } else if (this.mode === 'raf') {
                    this.timerId = requestAnimationFrame(() => {
                        if (this.isRunning) this.#runRaf();
                    });
                }
            }

            disabled() {
                this.isRunning = false;
                this.isPaused = false;
                if (this.timerId) {
                    if (this.mode === 'interval') clearInterval(this.timerId);
                    else if (this.mode === 'raf') cancelAnimationFrame(this.timerId);
                    else clearTimeout(this.timerId);
                    this.timerId = null;
                }
            }

            pause() {
                if (!this.isRunning || this.isPaused) return;
                this.isPaused = true;

                const now = Date.now();
                if (this.mode === 'timeout') {
                    this.remainingTime = Math.max(0, this.expected - now);
                    clearTimeout(this.timerId);
                } else if (this.mode === 'raf') {
                    // raf không có "thời gian còn lại" — resume() xin lại khung mới ngay.
                    cancelAnimationFrame(this.timerId);
                } else {
                    this.remainingTime = Math.max(0, this.time - (now - this.lastTick));
                    clearInterval(this.timerId);
                }
                this.timerId = null;
            }

            resume() {
                if (!this.isRunning || !this.isPaused) return;
                this.isPaused = false;

                if (this.mode === 'raf') {
                    this.timerId = requestAnimationFrame(() => { if (this.isRunning) this.#runRaf(); });
                    return;
                }

                this.timerId = setTimeout(() => {
                    if (!this.isRunning || this.isPaused) return;

                    if (this.isBusy) return;
                    this.isBusy = true;
                    this.lastTick = Date.now();
                    try { this.callback(); } catch (e) { console.error("TaskManager Resume Error:", e); }
                    const continueLoop = this.#tickCount();
                    this.isBusy = false;

                    if (!continueLoop) return;

                    if (this.mode === 'interval') {
                        this.#runInterval();
                    } else {
                        // Đặt lịch như enabled() — gọi thẳng #runTimeout() ở đây sẽ chạy dư 1 tick (callback vừa chạy ở trên).
                        this.expected = Date.now() + this.time;
                        this.timerId = setTimeout(() => {
                            if (this.isRunning) this.#runTimeout();
                        }, this.time);
                    }
                }, this.remainingTime);
            }
        }

        class TaskManager {
            constructor(plan = {}, delayEnd = 120) {
                this.plan = plan;
                this.running = {};
                this.delayEnd = delayEnd;
            }

            #validate(taskName, config) {
                const { time, exe, mode, count } = config;

                if (!taskName) {
                    console.error("TaskManager: Task name is required");
                    return false;
                }

                // Trùng tên -> kill task cũ rồi ghi đè (không throw).
                if (this.plan[taskName]) {
                    this.kill(taskName);
                }

                // mode 'raf': `time` vô nghĩa — bỏ qua check time > 0 (cả ở đây lẫn Loop.enabled()).
                if (mode !== 'raf' && (typeof time !== 'number' || time <= 0)) {
                    console.error(`TaskManager: Invalid time for task ${taskName}`);
                    return false;
                }
                if (typeof exe !== 'function') {
                    console.error(`TaskManager: Executor must be a function for task ${taskName}`);
                    return false;
                }

                return true;
            }

            /** Task còn chạy thật: đối chiếu cả cờ `running` (đã enabled qua operator()) lẫn `Loop.isRunning` (Loop có
             * `count` giới hạn tự disabled() mà không báo lại cờ). Lưu ý: task đang pause vẫn trả true. */
            isTaskRunning(taskName) {
                const taskLoop = this.plan[taskName];
                return !!(taskLoop && this.running[taskName] && taskLoop.isRunning);
            }

            operator(taskName, mode) {
                const taskLoop = this.plan[taskName];
                if (!taskLoop) return;

                if (mode === 'enabled') {
                    if (!this.running[taskName]) {
                        this.running[taskName] = true;
                        taskLoop.enabled();
                    }
                } else if (mode === 'disabled') {
                    if (this.running[taskName]) {
                        this.running[taskName] = false;
                        taskLoop.disabled();
                    }
                }
            }

            addNew(taskName, config) {
                if (!this.#validate(taskName, config)) return; // Validate trả về false thay vì throw

                this.plan[taskName] = new Loop(
                    config.time,
                    config.exe,
                    config.mode,
                    config.count ?? 0
                );
                this.running[taskName] = false;
            }

            kill(taskName) {
                if (!this.plan[taskName]) return;
                this.operator(taskName, 'disabled');
                delete this.plan[taskName];
                delete this.running[taskName];
            }

            killAll() {
                Object.keys(this.plan).forEach(taskName => this.kill(taskName));
            }

            pause(taskName) {
                const taskLoop = this.plan[taskName];
                if (taskLoop && this.isTaskRunning(taskName)) {
                    taskLoop.pause();
                }
            }

            resume(taskName) {
                const taskLoop = this.plan[taskName];
                if (taskLoop && this.isTaskRunning(taskName)) {
                    taskLoop.resume();
                }
            }

            // ===================== Tiện ích bổ sung cho app (không có ở bản gốc) =====================

            /** Chạy `callback` 1 lần sau `ms` (thay setTimeout). Loop mode 'timeout', count 1, tự kill() khỏi `plan` ngay khi
             * chạy. Không `name` -> tên tự sinh; cùng `name` -> huỷ bản cũ, đặt lại (debounce). @returns {{name:string, kill:function}} */
            once(callback, ms, name) {
                const taskName = name || `once_${TaskManager._onceSeq++}`;
                this.addNew(taskName, {
                    time: ms,
                    exe: () => {
                        this.kill(taskName); // dọn khỏi plan/running ngay — không để task đã xong nằm lại
                        callback();
                    },
                    mode: 'timeout',
                    count: 1
                });
                this.operator(taskName, 'enabled');
                return {
                    name: taskName,
                    kill: () => this.kill(taskName)
                };
            }

            /**
             * Chạy `callback` 1 lần ở khung hình thứ `frames` kể từ bây giờ (thay requestAnimationFrame thô: frames 1 =
             * `requestAnimationFrame(fn)`, 2 = 2 lần lồng nhau — chờ trình duyệt layout/vẽ xong). Loop mode 'raf', count = frames,
             * tự kill() khỏi `plan` ngay khi chạy. `name` như once(). @returns {{name:string, kill:function}}
             * @param {function} callback @param {number} [frames=1] @param {string} [name]
             */
            onceFrame(callback, frames = 1, name) {
                const taskName = name || `onceFrame_${TaskManager._onceSeq++}`;
                const targetFrame = Math.max(1, Math.floor(frames) || 1);
                let frameIndex = 0;
                this.addNew(taskName, {
                    time: 0,
                    exe: () => {
                        frameIndex++;
                        if (frameIndex < targetFrame) return;
                        this.kill(taskName); // dọn khỏi plan/running ngay — không để task đã xong nằm lại
                        callback();
                    },
                    mode: 'raf',
                    count: targetFrame
                });
                this.operator(taskName, 'enabled');
                return {
                    name: taskName,
                    kill: () => this.kill(taskName)
                };
            }

            /** Tạm dừng TOÀN BỘ task đang chạy — dùng khi tab/app bị ẩn. */
            pauseAll() {
                Object.keys(this.running).forEach(taskName => this.pause(taskName));
            }

            /** Tiếp tục TOÀN BỘ task đang chạy — dùng khi tab/app hiện lại. */
            resumeAll() {
                Object.keys(this.running).forEach(taskName => this.resume(taskName));
            }
        }
        TaskManager._onceSeq = 0;

        /** Instance DUY NHẤT của app — không tự new TaskManager() ở nơi khác. */
        const taskManager = new TaskManager();
