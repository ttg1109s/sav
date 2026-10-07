# Quy ước dùng TaskManager

> Đọc cùng [core-function-conventions.md](./core-function-conventions.md) Rule 3 (ranh giới Core/Workflow) — file
> NÀY tập trung riêng vào TaskManager (API + ai được dùng). Đồng bộ 07/10/2026 (chốt ver 13): bỏ ngoại lệ
> `tab-hide-reload.js` (file đã gỡ), thêm phạm vi Web Worker, khối inline Preloader, `requestAnimationFrame` thô
> (chờ chốt). Vi phạm hiện có: [sổ vi phạm](./core-legacy-audit.md) mục 4.3.

## 1. TUYỆT ĐỐI cấm `setInterval`/`setTimeout` thô trong toàn bộ app

**Không có ngoại lệ.** Mọi nhu cầu chạy code sau N ms (1 lần) hoặc lặp lại (nhiều lần) — dù là
animation 300ms, debounce lưu config, đóng menu sau khi bấm ra ngoài, đếm giây nghe nhạc, hay 1 vòng
lặp sống suốt đời app như Motion runner/auto-switch-visual — **PHẢI đăng ký qua `taskManager`**
(`service/task-manager.js`, instance global `taskManager`). KHÔNG được gọi thẳng
`window.setInterval()`/`window.setTimeout()`/`setInterval()`/`setTimeout()` ở BẤT KỲ đâu khác.

Lý do: `taskManager` là NGUỒN QUẢN LÝ TIMER TẬP TRUNG DUY NHẤT của app — cho phép `pauseAll()`/
`resumeAll()` toàn bộ timer đang chạy chỉ bằng 1 lệnh (ẩn/quay lại tab), và cho phép audit/debug
"app này đang có bao nhiêu timer sống, timer nào" chỉ bằng cách đọc `taskManager.plan`. Rải
`setTimeout` thô ở nhiều nơi phá vỡ hoàn toàn khả năng đó.

**Không còn ngoại lệ nào trong code app.** Ngoại lệ cũ `core/tab-hide-reload.js` (debounce 50 ms lúc ẩn tab) đã gỡ
cùng file đó. Các chỗ còn `setTimeout`/`setInterval` thô là vi phạm, liệt kê ở sổ vi phạm (mục "Timer thô").

**Phạm vi:**

- **Web Worker** (`core/workers/*.js`) nằm ngoài kiến trúc (Giang chốt 07/10/2026) — worker chạy luồng riêng, không
  có `taskManager`; timer bên trong worker không tính.
- **Khối inline Preloader** đầu `<body>` của `index.html` dùng `setTimeout` thô (hẹn giờ an toàn + gỡ phần tử sau
  fade) — chạy TRƯỚC khi `service/task-manager.js` được nạp nên không thể dùng `taskManager`. **Chưa chốt** có tính là
  ngoại lệ hay không ([script-load-order.md](./script-load-order.md) giải thích khối này).
- **`requestAnimationFrame` thô** — mục này chỉ ghi `setTimeout`/`setInterval`, nhưng `taskManager` đã có mode
  `raf` (mục 4b). 10 chỗ `requestAnimationFrame` thô (chờ 1–2 khung hình để trình duyệt layout) đang để **chờ chốt**
  trong sổ, chưa tính FAIL.
- `subtitle-editor.html` và `video-editor.html` đều nạp `service/task-manager.js` — không có lý do "trang không có
  taskManager".

## 2. CHỈ Workflow (`event/workflow/*.js`) được dùng `taskManager`

**Core (`core/**/*.js`) TUYỆT ĐỐI KHÔNG được dùng `taskManager` dưới bất kỳ hình thức nào** —
`addNew()`, `once()`, `pause()`, `resume()`, `kill()`, `operator()`, `isTaskRunning()`, đọc trực
tiếp `taskManager.plan` — KHÔNG cái nào được phép xuất hiện trong 1 function core/nghiệp vụ MỚI viết
hoặc bị ĐỤNG TỚI (sửa) kể từ 04/07/2026. Đây là 1 phần của Rule 3 mới (`core-function-conventions.md`)
— timer/interval/timeout là công cụ ĐIỀU PHỐI (orchestration), đúng vai trò Workflow, không phải
Core thuần (Core chỉ nhận tham số, trả kết quả/thao tác DOM tức thời, không "hẹn giờ" gì cả).

**Router (`event/router/*.js`) và Listener (`event/listener/*.js`) cũng KHÔNG dùng `taskManager`
trực tiếp** — không phải vì bị cấm tuyệt đối như Core, mà vì đúng phân vai: Router chỉ điều hướng
1 `msg.type` tới đúng chỗ (gọi thẳng core hoặc giao Workflow), Listener chỉ lắng nghe DOM event rồi
gửi message qua `eventBus` — không bên nào có lý do chính đáng để tự quản lý 1 task lặp/hẹn giờ.
Nếu 1 case trong Router "cần chờ N ms rồi làm gì đó", đó CHÍNH LÀ dấu hiệu case đó phải giao cho
Workflow, không phải lý do để Router tự gọi `taskManager`.

**Tóm lại — 1 hàng duy nhất, không có vùng xám:**

| Lớp | Được dùng `taskManager`? |
|---|---|
| Core (`core/**/*.js`) | **KHÔNG**, tuyệt đối |
| Router (`event/router/*.js`) | Không (không có lý do chính đáng) |
| Listener (`event/listener/*.js`) | Không (không có lý do chính đáng) |
| **Workflow (`event/workflow/*.js`)** | **CÓ — nơi DUY NHẤT được dùng** |
| Component/template (`components/*.js`) | Không (chỉ định nghĩa chuỗi HTML, không có logic) |

## 3. Vì sao lại là Workflow, không phải Core?

Theo Rule 3 mới: Core không được tự gọi Core khác, không được tự đọc `appState`. Một task lặp
(Motion runner, auto-switch-visual, keep-alive audio nền...) về bản chất LUÔN cần cả 2 thứ đó mỗi lần "tick" — đọc
`appState` để biết tình huống hiện tại, rồi gọi ĐÚNG (những) hàm core cần thiết theo tình huống đó.
Nếu để Core tự làm cả 2 việc này bên trong 1 `taskManager.once()`/`addNew()` của chính nó, Core đó
sẽ vừa vi phạm "không tự đọc appState" vừa vi phạm "không tự gọi Core khác" — 2 lần vi phạm cùng
lúc, đúng lý do `taskManager` bị đưa hẳn ra khỏi Core.

Workflow, ngược lại, ĐÃ được phép đọc `appState` và gọi nhiều hàm Core theo thứ tự (đó CHÍNH LÀ
định nghĩa vai trò Workflow) — nên nghiễm nhiên là nơi hợp lý để "vòng lặp" sống, tự tick, tự đọc
state, tự gọi core.

## 4. API `taskManager` — dùng lại nguyên bản `Loop`/`TaskManager` (`service/task-manager.js`)

```js
taskManager.addNew(name, { time, exe, mode, count });
// time: ms giữa các lần chạy (mode 'timeout') hoặc trước lần chạy đầu. VÔ NGHĨA với mode 'raf'
//       (xem ngay dưới) — có thể truyền 0, addNew()/enabled() tự bỏ qua validate time>0 cho mode này.
// exe:  function chạy — ĐÂY LÀ NƠI Workflow tự appState.get() + tự gọi core, KHÔNG đặt logic core trực tiếp trong 1 hàm core riêng rồi truyền vào đây.
// mode: 'timeout' (bù trôi, dùng cho MỌI task lặp thường trong app — xem service/task-manager.js,
//       KHÔNG dùng mode 'interval') hoặc 'raf' (MỚI, 20/07/2026 — requestAnimationFrame, xem mục 4b).
// count: 0 = lặp vô hạn cho tới khi kill(); >0 = số lần chạy giới hạn.
taskManager.operator(name, 'enabled');  // BẮT BUỘC gọi ngay sau addNew() để task thực sự chạy.
taskManager.pause(name);                // tạm dừng, giữ nguyên vị trí trong chu kỳ.
taskManager.resume(name);               // resume() TỰ GUARD nội bộ — gọi khi task KHÔNG hề paused là no-op AN TOÀN, không cần tự kiểm tra trước.
taskManager.kill(name);                 // huỷ hẳn, dọn khỏi taskManager.plan.
taskManager.isTaskRunning(name);        // LƯU Ý: vẫn trả `true` NGAY CẢ KHI task đang pause() — KHÔNG dùng hàm này để "phát hiện đang pause". Muốn biết có đang chạy thật hay không, kiểm tra `taskManager.plan[name]` tồn tại + tự theo dõi cờ riêng nếu cần phân biệt paused/running.

taskManager.once(fn, ms, name);         // task CHẠY 1 LẦN rồi tự kill — dùng thay setTimeout thô. Truyền `name` cố định + gọi lại nhiều lần = tự huỷ bản cũ, đặt lại từ đầu (đúng hành vi debounce). Không truyền `name`: tự sinh tên duy nhất, trả về { name, kill() } để nơi gọi tự huỷ sớm nếu cần.
```

### 4b. Mode `raf` (MỚI, 20/07/2026, plan-space-galaxy.md Phần A)

Nhánh THỨ 3 của `Loop`, bên cạnh `interval`/`timeout`: dùng `requestAnimationFrame`/
`cancelAnimationFrame` thay `setTimeout`/`setInterval` — tự gọi lại chính nó bên trong, y hệt cơ
chế tự-tái-sinh của mode `timeout` (`#runRaf()`, cấu trúc giống hệt `#runTimeout()`, chỉ đổi cơ
chế hẹn giờ). **KHÔNG liên quan gì tới `eventBus`** — đừng nhầm "vòng lặp tự nuôi sống qua
`taskManager`" với "bắn sự kiện qua `eventBus`", đây là 2 khái niệm độc lập.

Dùng cho 2 task `raf` của vòng Visualizer (thay `requestAnimationFrame(drawVisualizer)` thô trước đây):

- `audioAnalysis` — phân tích audio (FFT, beat/energy/hue, BPM/pitch/status bar, Game tick, nốt nhạc bay). LUÔN
  chạy, không dừng theo Show Visual (Game/React Beat/VBG đều đọc kết quả qua kho `audioAnalysis`,
  `service/audio-analysis.js`). Thuộc `event/workflow/audio-analysis.js` (`workflowAudioAnalysis`, hằng
  `AUDIO_ANALYSIS_TASK`). Việc gỡ nốt nhạc bay sau 1,5 s cũng hẹn giờ ở Workflow (`taskManager.once`).
- `visualizerRender` — CHỈ vẽ canvas 2D/WebGL, thuộc `event/workflow/visualizer-render.js`. Đăng ký/`kill()` tự động
  theo Show Visual (`_syncRenderTask()` gọi mỗi frame từ task phân tích). Tắt phải dùng `kill()`, KHÔNG dùng `pause()`.

`workflowVisualizerRender` điều phối vòng đời chung của cả 2 task (`start`/`stop`/`suspendForBackground`/
`resumeFromBackground`). Về Playlist trên màn <1024px chỉ tạm dừng 2 task này.

```js
// event/workflow/audio-analysis.js (workflowAudioAnalysis.start(), gọi từ workflowVisualizerRender.start())
taskManager.addNew(AUDIO_ANALYSIS_TASK, { time: 0, exe: () => this._tick(), mode: 'raf', count: 0 });
taskManager.operator(AUDIO_ANALYSIS_TASK, 'enabled');
// ...và trong _syncRenderTask(): addNew + operator('visualizerRender','enabled') khi Show Visual bật,
// taskManager.kill('visualizerRender') khi tắt.
```

`pause()`/`resume()`/`kill()` hoạt động y hệt 2 mode kia — chỉ khác cơ chế hẹn giờ bên trong `Loop`. Lưu ý:
`pauseAll()`/`resumeAll()` có trong API nhưng **không nơi nào gọi**; ẩn/hiện tab do `event/workflow/app-visibility.js`
xử lý từng task (gọi `workflowVisualizerRender.suspendForBackground()`/`resumeFromBackground()`, task keep-alive audio
nền riêng).


## 5. Ví dụ ĐÚNG — Workflow tự tick, tự gọi core

```js
// core/....js — hàm THUẦN, không đụng taskManager/appState, không gọi hàm khác trong file
function pickNextIndex(currentIndex, length) { /* ... */ }
function setLayerImage(el, url) { el.style.backgroundImage = url ? `url(${url})` : ''; }

// event/workflow/....js — Workflow: tự đăng ký task, tự đọc appState MỖI TICK, tự gọi core
const SOME_TASK = 'someLoop';
const workflowSomething = {
    start() {
        taskManager.kill(SOME_TASK);
        taskManager.addNew(SOME_TASK, { time: 5000, exe: () => this._tick(), mode: 'timeout', count: 0 });
        taskManager.operator(SOME_TASK, 'enabled');
    },
    stop() { taskManager.kill(SOME_TASK); },
    _tick() {
        const cfg = appState.get('someConfig'); // Workflow tự đọc appState — Core không được
        const next = pickNextIndex(this._current, this._items.length); // core
        setLayerImage(someLayerEl, this._items[next].url); // core
        this._current = next;
    },
};
```

## 6. Vi phạm hiện có

Không còn danh sách nợ riêng ở đây — mọi vi phạm TaskManager (timer thô, `taskManager` dùng trong Core,
`requestAnimationFrame` thô chờ chốt) nằm ở [sổ vi phạm](./core-legacy-audit.md) mục 4.3, cùng quy tắc "nợ cũ vẫn là
FAIL". `core/auto-switch-visual.js` đã sạch từ 25/09/2026 (điều phối dời về `event/workflow/auto-switch-visual.js`).

← [core-function-conventions.md](core-function-conventions.md) (Rule 3 đầy đủ) ·
[core-legacy-audit.md](core-legacy-audit.md) (nợ kỹ thuật tổng hợp)
