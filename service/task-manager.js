/**
 * service/task-manager.js — CHUYỂN từ `service/task-manager.js` (04/07/2026, phản hồi Giang mục 2:
 * đây là DỊCH VỤ HẠ TẦNG dùng chung toàn app — quản lý timer, không phải NGHIỆP VỤ — nên thuộc
 * nhóm `service/` cùng `state.js`/`operation.js`, không phải `core/`). KHÔNG đổi logic bên trong,
 * chỉ đổi đường dẫn file + đường dẫn `<script>` trong index.html.
 *
 * TaskManager — quản lý TẬP TRUNG mọi setInterval/setTimeout của app, để KHÔNG còn timer nào
 * "trôi tự do" bên ngoài. Chuyển thể từ bản gốc (ES module, class Loop/TaskManager) sang dạng
 * global-script khớp với toàn bộ project (không build step, chạy thẳng qua file://, các file
 * chia sẻ global scope qua <script> tag thường) — bỏ `export`, giữ NGUYÊN tên 2 class + toàn bộ
 * logic lõi (không sửa gì bên trong Loop/TaskManager so với bản gốc).
 *
 * QUYẾT ĐỊNH THIẾT KẾ (theo yêu cầu "mọi interval/timeout — 1 lần hay lặp — đều phải qua task"):
 *   - Mọi nơi trong app, kể cả timeout BẮN-1-LẦN (animation 300ms, debounce save, đóng menu...),
 *     đều đăng ký qua `taskManager` thay cho gọi trực tiếp setTimeout/setInterval. Lý do: đồng bộ
 *     1 nguồn quản lý timer duy nhất — khi cần pause/resume TOÀN BỘ (ẩn/quay lại tab), chỉ cần 1
 *     lệnh `taskManager.pauseAll()`/`resumeAll()` thay vì phải nhớ rải rác từng nơi.
 *   - mode 'interval' KHÔNG dùng ở đâu trong app: ngay cả _listenTickHandle (giây nghe nhạc,
 *     trước đây setInterval) cũng đổi sang mode 'timeout' (bù trôi) — chấp nhận overhead bù giờ
 *     ở MỌI task để đổi lấy 1 API thống nhất duy nhất, đúng yêu cầu.
 *
 * MODE `raf` (MỚI, 20/07/2026, plan-space-galaxy.md Phần A) — nhánh THỨ 3 của `Loop`, bên cạnh
 * `interval`/`timeout`: dùng `requestAnimationFrame`/`cancelAnimationFrame` thay cho
 * `setTimeout`/`setInterval` — TỰ GỌI LẠI CHÍNH NÓ bên trong, y hệt cơ chế tự-tái-sinh của mode
 * `timeout` (KHÔNG liên quan gì tới `eventBus` — đây là nhầm lẫn ban đầu đã sửa lúc lập plan: đừng
 * lẫn "vòng lặp tự nuôi sống" với "bắn sự kiện"). Dùng cho vòng lặp render 60fps
 * (`event/workflow/visualizer-render.js`) — nơi DUY NHẤT hợp lệ để 1 Workflow đăng ký task này
 * (Core CẤM TUYỆT ĐỐI dùng `taskManager`, xem mục 2 dưới, không đổi gì cho mode `raf`).
 * `time` VÔ NGHĨA với mode này (trình duyệt tự quyết định nhịp vẽ, không hẹn giờ) — `addNew()`/
 * `enabled()` BỎ QUA việc validate `time > 0` riêng cho mode `raf` (xem `#validate()`/`enabled()`).
 *
 * 2 KIỂU TASK dùng trong app:
 *   (A) Task LẶP, SỐNG LÂU, có tên cố định, dùng pause()/resume() khi tab ẩn/hiện hoặc nhạc
 *       dừng/phát tiếp — ví dụ 'listenClock', 'autoSwitchVisual', 'visualizerRender' (mode `raf`).
 *       Đăng ký 1 lần qua addNew(), enabled() lúc cần bắt đầu, pause()/resume() xuyên suốt đời
 *       sống, kill() khi dọn hẳn.
 *   (B) Task BẮN 1 LẦN (thay cho setTimeout cũ) — đăng ký qua taskManager.once(fn, ms, name?):
 *         - Nếu KHÔNG truyền name: tự sinh tên duy nhất (dùng cho timeout "tạm", có thể cần huỷ
 *           sớm qua taskManager.kill(tênTrảVề) — ví dụ 2 timeout race nhau trong 1 Promise).
 *         - Nếu CÓ truyền name: gọi lại nhiều lần với CÙNG name tự huỷ bản cũ + đặt lại từ đầu —
 *           đúng hành vi debounce (_validate() của TaskManager đã tự kill task trùng tên).
 *       once() trả về { name, kill() } để gọi nơi gọi có thể huỷ task đó bất kỳ lúc nào (tương
 *       đương clearTimeout(timeoutId) cũ).
 *
 * PHẢI nạp SỚM trong index.html (ngay sau dom-refs.js, TRƯỚC mọi file core/playlist/visualizer
 * khác) vì hầu hết các file đó dùng taskManager.once()/addNew() ngay khi gắn listener.
 */
        class Loop {
            /**
             * @param {number} time - Thời gian lặp (ms). VÔ NGHĨA khi mode = 'raf' (xem đầu file).
             * @param {function} callback - Hàm thực thi
             * @param {string} mode - 'interval' (setInterval) hoặc 'timeout' (setTimeout bù giờ)
             *   hoặc 'raf' (MỚI — requestAnimationFrame, xem đầu file).
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

            /**
             * MỚI (mode 'raf') — y hệt cấu trúc #runTimeout() ở trên (chạy callback TRƯỚC, tự
             * tái-sinh bằng cách gọi lại chính nó SAU), chỉ thay setTimeout/nextDelay bằng
             * requestAnimationFrame (không có khái niệm "drift bù giờ" — mỗi lần trình duyệt sẵn
             * sàng vẽ là chạy ngay, không hẹn giờ trước).
             */
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
                    // mode 'raf' KHÔNG có khái niệm "thời gian còn lại tới lần chạy kế" (mỗi frame
                    // chạy NGAY khi trình duyệt cho phép, không hẹn giờ trước) — resume() chỉ cần
                    // xin lại 1 frame mới ngay lập tức, không dùng remainingTime.
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
                    // Không cần setTimeout trung gian như 2 mode kia — raf tự nhiên chạy vào frame
                    // kế tiếp trình duyệt vẽ, xin thẳng 1 frame mới là đủ (đúng tinh thần "resume
                    // tức thì" của mode này, không có gì để "bù trôi").
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
                        // FIX (bug double-tick): KHÔNG gọi this.#runTimeout() trực tiếp ở đây — hàm
                        // đó tự chạy callback() ngay khi được gọi (xem #runTimeout(), dùng cho
                        // chính setTimeout của nó), nên gọi nó đồng bộ ngay sau khi resume() VỪA
                        // chạy callback() ở dòng trên sẽ bắn dư 1 tick trong cùng 1 lượt. Đặt lại
                        // lịch giống đúng enabled() (this.timerId = setTimeout(...#runTimeout...,
                        // this.time)) — #runTimeout() CHỈ được gọi từ trong setTimeout của chính
                        // nó, không bao giờ gọi trực tiếp như một hàm "chạy callback ngay".
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

                // [FIX CRITICAL] Không bao giờ throw lỗi "Task already exists"
                // Thay vào đó, âm thầm kill task cũ và overwrite
                if (this.plan[taskName]) {
                    this.kill(taskName);
                }

                // mode 'raf': `time` vô nghĩa (trình duyệt tự quyết định nhịp vẽ, không hẹn giờ) —
                // BỎ QUA check time>0 cho mode này. FIX (bug thật, 20/07/2026 — Giang báo lỗi
                // console "TaskManager: Invalid time for task visualizerRender"): trước đó CHỈ
                // sửa `Loop.enabled()` bỏ qua check này — QUÊN MẤT `#validate()` ở ĐÂY, được gọi
                // từ `addNew()` NGAY TRƯỚC khi 1 `Loop` được `new` ra (xem `addNew()` bên dưới:
                // `if (!this.#validate(...)) return;` — return SỚM, `Loop` chưa kịp sinh ra thì
                // `enabled()` không bao giờ được gọi tới). Kết quả: `taskManager.addNew('visualizerRender',
                // { time: 0, mode: 'raf', ... })` bị chặn đứng NGAY TẠI ĐÂY, task không hề được
                // thêm vào `this.plan` — `operator(name, 'enabled')` sau đó chỉ no-op (task không
                // tồn tại) — vòng lặp render KHÔNG BAO GIỜ thực sự chạy dù không ném lỗi gì thêm.
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

            /**
             * FIX (bug): this.running[taskName] là 1 cờ ĐỘC LẬP, được set true/false CHỈ bởi
             * operator()/kill() — nhưng khi 1 Loop có `count` giới hạn (vd count: 1) tự chạy hết
             * và tự gọi disabled() NỘI BỘ (xem Loop.#tickCount()), KHÔNG có cơ chế nào báo lại cho
             * TaskManager biết để dọn this.running[taskName] — cờ đó vẫn đọc ra `true` mãi dù task
             * thật đã dừng từ lâu (Loop.isRunning đã là `false`). Mọi chỗ cần biết "task này còn
             * sống thật không" PHẢI đối chiếu CẢ HAI: cờ this.running[taskName] (lịch sử có
             * enabled() qua operator() chưa) VÀ this.plan[taskName].isRunning (trạng thái THẬT của
             * chính Loop instance, luôn đúng vì Loop tự cập nhật nó ở mọi nhánh enabled/disabled).
             * pause()/resume() bên dưới dùng helper này thay cho đọc thẳng this.running[taskName].
             */
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

            // ===================== Tiện ích bổ sung cho app (KHÔNG có ở bản gốc) =====================

            /**
             * once(callback, ms, name?) — thay thế trực tiếp cho setTimeout(callback, ms) cũ, nhưng
             * chạy qua đúng 1 Loop (mode 'timeout', count: 1, tự kill() khỏi this.plan ngay sau khi
             * chạy xong — không để rác task đã xong nằm lại trong this.plan/this.running).
             *
             * - Không truyền `name`: tự sinh tên duy nhất (taskName trả về trong kết quả) — dùng cho
             *   timeout "tạm/dùng 1 lần ở 1 chỗ", ví dụ 2 timeout race nhau trong cùng 1 Promise.
             * - Có truyền `name` cố định: gọi lại nhiều lần với CÙNG tên sẽ tự huỷ bản cũ (addNew()
             *   đã validate + kill task trùng tên) rồi đặt lại từ đầu — đúng hành vi debounce cũ
             *   (clearTimeout(timer); timer = setTimeout(fn, ms)).
             *
             * Trả về { name, kill() } — gọi .kill() tương đương clearTimeout(timeoutId) cũ.
             */
            once(callback, ms, name) {
                const taskName = name || `once_${TaskManager._onceSeq++}`;
                this.addNew(taskName, {
                    time: ms,
                    exe: () => {
                        // Dọn khỏi plan/running NGAY sau khi chạy — task 1 lần xong là kết thúc đời
                        // sống, không cần Loop.disabled() còn nằm sót trong this.plan (kill() đã tự
                        // gọi disabled() trước khi xoá, nhưng tại đây Loop tự #tickCount() ra false
                        // và tự enabled=false, không có ai gọi kill() để dọn khỏi this.plan/running
                        // — chủ động dọn ở đây để this.plan không phình to dần theo số lần once()).
                        this.kill(taskName);
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

        /** Instance DUY NHẤT dùng xuyên suốt toàn app — mọi file core/playlist/visualizer đều
         * đăng ký task qua biến global này, không tự new TaskManager() riêng ở đâu khác. */
        const taskManager = new TaskManager();
