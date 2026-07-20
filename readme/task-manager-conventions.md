# Quy ước dùng TaskManager

> MỚI (04/07/2026, mục 7 phản hồi Giang). Đọc cùng `core-function-conventions.md` Rule 3 (VIẾT LẠI
> cùng ngày) — file đó định nghĩa ranh giới Core/Workflow nói chung, file NÀY tập trung riêng vào
> quy ước TaskManager (API + ai được dùng).

## 1. TUYỆT ĐỐI cấm `setInterval`/`setTimeout` thô trong toàn bộ app

**Không có ngoại lệ.** Mọi nhu cầu chạy code sau N ms (1 lần) hoặc lặp lại (nhiều lần) — dù là
animation 300ms, debounce lưu config, đóng menu sau khi bấm ra ngoài, đếm giây nghe nhạc, hay 1 vòng
lặp sống suốt đời app như slideshow/auto-switch-visual — **PHẢI đăng ký qua `taskManager`**
(`service/task-manager.js`, instance global `taskManager`). KHÔNG được gọi thẳng
`window.setInterval()`/`window.setTimeout()`/`setInterval()`/`setTimeout()` ở BẤT KỲ đâu khác.

Lý do: `taskManager` là NGUỒN QUẢN LÝ TIMER TẬP TRUNG DUY NHẤT của app — cho phép `pauseAll()`/
`resumeAll()` toàn bộ timer đang chạy chỉ bằng 1 lệnh (ẩn/quay lại tab), và cho phép audit/debug
"app này đang có bao nhiêu timer sống, timer nào" chỉ bằng cách đọc `taskManager.plan`. Rải
`setTimeout` thô ở nhiều nơi phá vỡ hoàn toàn khả năng đó.

**1 ngoại lệ ĐÃ BIẾT, giữ nguyên có chủ đích:** `core/tab-hide-reload.js::triggerHideAndReload()`
dùng `setTimeout` thô (debounce 50ms phân biệt "ẩn tab thật" vs F5/đóng tab) — code này chạy NGAY
TRONG lúc trang sắp bị unload/ẩn (`visibilitychange`/`pagehide`), cùng nhóm "browser lifecycle event
đứng ngoài `/event/`" đã có tiền lệ ở `event-bus-flow.md` — thời điểm này không đáng tin cậy để phụ
thuộc vào bất kỳ hạ tầng nào khác (kể cả `taskManager`).

> **[ĐÍNH CHÍNH 12/07/2026]** Từng ghi nhận 1 ngoại lệ thứ 2 ở đây cho
> `event/workflow/subtitle-editor.js` (5 chỗ `setTimeout`/`setInterval` thô, lý do "trang
> `subtitle-editor.html` không nạp `service/task-manager.js`") — SAI, đã kiểm tra lại kỹ hơn:
> `service/task-manager.js` KHÔNG có dependency gì cả (không cần `appState`, không cần
> `event/tab.js`, không cần bất kỳ file nào khác — đọc thẳng file đó xác nhận 0 tham chiếu
> `appState`/`document`). Coupling với `event/tab.js` mà lý do cũ viện dẫn KHÔNG CÓ THẬT — kiểm tra
> lại còn phát hiện thêm: `event/tab.js` **CHƯA TỪNG gọi `taskManager.pauseAll()`/`resumeAll()`**
> ở BẤT KỲ ĐÂU trong toàn bộ app, kể cả `index.html` (`pauseAll`/`resumeAll` chỉ được ĐỊNH NGHĨA
> trong `service/task-manager.js`, không nơi nào gọi tới — dead code). Đã sửa: thêm
> `service/task-manager.js` vào `subtitle-editor.html`, đổi cả 5 chỗ sang
> `taskManager.once()`/`addNew()` — **không còn ngoại lệ thứ 2 nữa**, chỉ còn đúng 1 ngoại lệ ở
> trên. KHÔNG quét thấy chỗ nào khác dùng `setTimeout`/`setInterval` thô ngoài
> `service/task-manager.js` (định nghĩa gốc) và ngoại lệ trên tại thời điểm viết tài liệu này.

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
(slideshow, auto-switch-visual, watchdog...) về bản chất LUÔN cần cả 2 thứ đó mỗi lần "tick" — đọc
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

Dùng cho ĐÚNG 1 trường hợp trong app hiện tại: `event/workflow/visualizer-render.js` (vòng lặp
render chính, thay `requestAnimationFrame(drawVisualizer)` thô trước đây nằm trong
`core/visualizer/draw-visualizer.js`, nay file đó đã RỖNG).

```js
// event/workflow/visualizer-render.js
taskManager.addNew('visualizerRender', { time: 0, exe: () => this._tick(), mode: 'raf', count: 0 });
taskManager.operator('visualizerRender', 'enabled');
```

`pause()`/`resume()`/`kill()` hoạt động y hệt 2 mode kia (dùng chung `pauseAll()`/`resumeAll()`
lúc tab ẩn/hiện, xem `event/tab.js`) — chỉ khác cơ chế hẹn giờ bên trong `Loop`, không cần biết gì
thêm ở tầng gọi.


## 5. Ví dụ ĐÚNG — Workflow tự tick, tự gọi core (mẫu chuẩn từ `event/workflow/slideshow.js`)

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

## 6. Nợ kỹ thuật đã biết (KHÔNG bắt buộc sửa ngay — theo Rule 0.5)

Rule 3 vừa SIẾT CHẶT hơn hẳn bản trước (từng cho phép Core dùng `taskManager.once()` cho lời gọi
"bất đồng bộ không chờ"). Các hàm Core LEGACY sau ĐANG dùng `taskManager` theo quy ước CŨ, viết TRƯỚC
04/07/2026 — KHÔNG bắt buộc sửa ngay (Rule 0.5: chỉ bắt buộc khi hàm đó bị ĐỤNG TỚI thật), nhưng
PHẢI đưa về tuân thủ ĐẦY ĐỦ (tách hẳn phần `taskManager` ra Workflow tương ứng, đúng mẫu mục 5) ngay
khi có nhu cầu sửa/mở rộng chúng:
- `core/auto-switch-visual.js` (`scheduleNextAutoSwitchVisualTimer`/`exe`).
- `core/state-and-video-bg.js` (`taskManager.once('hideVideoBgAfterFade')` trong `handleVideoBackground()`).
- Khả năng còn sót — CHƯA quét lại toàn bộ codebase sau khi Rule 3 đổi (việc quét lại quy mô lớn,
  cập nhật số liệu ở `readme/core-legacy-audit.md`, dời sang batch riêng nếu Giang muốn làm ngay).

← [core-function-conventions.md](core-function-conventions.md) (Rule 3 đầy đủ) ·
[core-legacy-audit.md](core-legacy-audit.md) (nợ kỹ thuật tổng hợp)
