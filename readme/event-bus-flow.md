# Luồng kiến trúc `/event/` — sơ đồ đầy đủ (ver 12)

> Tài liệu này mô tả ĐÚNG luồng thật đang chạy trong code, không phải kế hoạch. Đọc cùng
> [folder-structure.md](./folder-structure.md) (cấu trúc thư mục), [where-to-edit.md](./where-to-edit.md)
> (sửa ở đâu khi cần thêm tính năng) và [script-load-order.md](./script-load-order.md) (thứ tự nạp
> `<script>`).

## Sơ đồ tổng quan

```
Listener (DOM/tab/window/...)
        │  eventBus.send(msg)
        ▼
┌─────────────────────────────────────────────────────────────────┐
│ event/bus.js                                                    │
│                                                                   │
│  Block gate (event/block.js — DATA, CÓ 1 entry thật: xem mục 2) │
│  isBlocked(msg.type)? ──── true ────▶  DỪNG, KHÔNG vào Router   │
│       │ false                          (im lặng, đúng thiết kế) │
└───────┼───────────────────────────────────────────────────────┘
        ▼
    Router.handle(msg)
        │  switch (msg.type)
        ▼
    ┌───────────────────────────── case cụ thể ─────────────────────────────┐
    │                                                                        │
    │  (A) gọi thẳng 1 hàm CORE          (B) giao WORKFLOW      (C) VirtualMachineState.run([...])
    │      KHÔNG cần đọc appState            cần chuẩn bị state/     rẽ nhánh theo state, CHẠY
    │      nào để nuôi Core                  service cho Core (dù     NHIỀU callback nếu nhiều rule
    │      (xem mục 4A)                       1 hàm), HOẶC ≥2 lời     cùng khớp — mỗi callback là
    │                                         gọi nối tiếp phụ thuộc   CORE hoặc WORKFLOW tuỳ rule
    │                                         nhau (xem mục 4B)
    └────────────────────────────────────────────────────────────────────────┘
                                                                          │
                                                             mỗi rule khớp gọi callback()
                                                                          ▼
                                                              core function  hoặc  workflow method
```

**2 điểm rẽ nhánh khác nhau, đừng nhầm** (Router switch/if tay đọc `appState` KHÔNG còn là 1
nhánh riêng — mọi rẽ nhánh theo state trong case đều đi qua `VirtualMachineState`, xem mục 4C):

| Tầng | Chạy khi nào | Biết `appState` không | Trả về / hành vi | Có thể chọn "chạy cái gì" không |
|---|---|---|---|---|
| **Block** (`event/block.js` + `bus.js`) | Trước khi vào Router | Có (đọc để quyết định chặn) | boolean — chặn hẳn hoặc không | **KHÔNG** — chỉ chặn/không chặn, không chọn đích |
| **`VirtualMachineState`** | Trong 1 case | KHÔNG (router tự đọc, truyền `state` sẵn vào rule) | gọi 0..N callback | Có — 1 rule khớp (đơn đích) hay nhiều rule khớp (đa đích) đều cùng 1 API |

## 1. Listener — nguồn trigger

DOM (`click`/`change`/`input`...), `tab`/`window` lifecycle (`visibilitychange`/`pagehide`/
`beforeunload`...), hoặc nguồn khác (`audioPlayer` media events). Chỉ làm 1 việc: đăng ký sự kiện
+ gọi `eventBus.send({ router, type, payload })`. KHÔNG chứa logic nghiệp vụ, KHÔNG đọc `appState`
để quyết định gì (đó là việc của Block/Router/VirtualMachineState phía sau).

> **[MỚI, 20/07/2026, plan-space-galaxy.md Phần A]** Vòng lặp render chính
> (`event/workflow/visualizer-render.js`) là 1 TRƯỜNG HỢP RIÊNG, đứng NGOÀI sơ đồ
> Listener→Router→Core/Workflow ở trên: Workflow đó tự đăng ký task `taskManager` mode `raf`
> (`service/task-manager.js`, MỚI) và tự "tick" 60 lần/giây, KHÔNG có Listener nào gửi
> `eventBus.send()`, KHÔNG có Router nào `switch(msg.type)`. Đây vẫn ĐÚNG định nghĩa vai trò
> Workflow (tự đọc `appState`, tự quyết định gọi Core nào, xem mục 4B dưới) — chỉ khác nguồn
> "kích hoạt" là 1 vòng lặp tự nuôi sống (`taskManager` mode `raf`) thay vì 1 sự kiện DOM rời rạc.
> Điểm khởi động DUY NHẤT của vòng lặp này là `core/audio-engine.js::setupAudioContext()` gọi
> `workflowVisualizerRender.start()` — 1 ngoại lệ Core-gọi-Workflow ĐÃ ĐÁNH DẤU RÕ (xem comment
> tại đó), KHÔNG phải tiền lệ cho phép Core gọi Workflow ở nơi khác.

Ngoại lệ đã chốt từ trước (rule 2b.7 + audit đầy đủ ở [changelog/v11.md mục
2](./changelog/v11.md), 18/18 `addEventListener` ngoài `/event/` được liệt kê tên + lý do): browser
lifecycle events gắn thẳng trên `window`/`document` đứng NGOÀI `/event/` (`core/tab-hide-reload.js`,
`core/wakelock.js`, `core/app-cleanup.js`, `event/tab.js`) — không đổi ở ver 12. CỘNG THÊM (cùng
danh sách 18, hay bị bỏ sót khi chỉ đọc lướt): `core/modal-choice.js` (2 — click nút/overlay của
MỌI modal động) và vài chỗ dò `duration`/seek media 1 lần (`core/playlist/loader.js`/`render.js`,
`core/resume-state-storage.js`, `core/state-and-video-bg.js`).

**Vì sao `core/modal-choice.js` được miễn — PHẢI ĐỦ CẢ 3 điều kiện, không phải "là UI nên miễn"**
(xem thêm [core-function-conventions.md Rule 5](./core-function-conventions.md)):

1. **Hạ tầng dùng CHUNG toàn app** — không tách riêng theo 1 nghiệp vụ cụ thể nào (Song/Photo/
   Document...). Nếu 1 file `addEventListener` chỉ phục vụ ĐÚNG 1 tính năng (như
   `core/file-manager/document-ui.js`/`photo-ui.js`) thì KHÔNG đạt điều kiện này, dù viết kỹ thuật
   y hệt.
2. **Callback bên trong `addEventListener` CHỈ gọi tham số nhận từ nơi gọi** — đọc thẳng code:
   `btnEl.addEventListener('click', () => { closeModal(); if (typeof btnDef.onClick ===
   'function') btnDef.onClick(); })` — `modalChoice()` KHÔNG hề gọi tên bất kỳ hàm core cụ thể nào
   khác, `onClick` là 1 tham số MỜ (opaque) do nơi gọi tự truyền vào; bản thân hàm không biết và
   không cần biết `onClick` làm gì. Nếu 1 hàm VỪA `addEventListener` VỪA gọi thẳng tên 1 core file
   khác trong callback (như `document-ui.js` bản đầu Nhóm A gọi `resolveDocumentHtml()`) thì VẪN
   vi phạm Rule 3 dù đạt điều kiện 1.
3. **Đã qua audit chính thức, có tên, có số liệu** — `changelog/v11.md` mục 2, không phải tự nhận
   trong docstring của chính file đó. Một số file sau này (`folder-picker-ui.js`) từng tự ghi
   "cùng pattern với `modalChoice()`" để suy ra miễn trừ tương tự — **KHÔNG hợp lệ**, vì chưa từng
   qua audit, và (thường) không đạt điều kiện 1 (gắn với 1 nghiệp vụ cụ thể, không phải hạ tầng
   chung).

## 2. Block gate — chặn TRƯỚC khi vào Router

`eventBus.send(msg)` tra `event/block.js` (đăng ký qua `eventBus.registerBlock(msgType, groups)`)
TRƯỚC khi gọi `router.handle(msg)`. Nếu khớp block, `send()` `return` ngay — Router, Core, Workflow
đều KHÔNG chạy, không có ngoại lệ nào lọt qua.

**Chỉ dùng khi:**
- Điều kiện chặn dùng ở **≥2 router khác nhau** cho cùng 1 ý nghĩa nghiệp vụ (tránh lệch logic
  giữa các entry point — đây là lý do ra đời cơ chế này, xem case thật ở
  [v12.md](./changelog/v12.md) mục 1), HOẶC
- Bản chất là **chặn hẳn** (không chạy gì khi điều kiện đúng), không phải chọn giữa nhiều đích.

**KHÔNG dùng khi** cần chọn "workflow nào chạy" tuỳ state — Block chỉ trả boolean, không có chỗ
nào cho "gọi hàm gì". Trường hợp đó thuộc mục 4/5 dưới.

Xem cú pháp đầy đủ ở comment đầu `event/block.js`/`event/bus.js`.

## 3. Router — switch theo `msg.type`

Mỗi cụm (`storage`, `playlist`, `visualizerDisplay`...) có đúng 1 router, tự
`eventBus.register(name, routerObject)` lúc nạp. `handle(msg)` switch theo `msg.type`
(namespace `<router>.<action>.<event>`), mỗi case đi 1 trong 3 hướng ở mục 4 dưới.

## 4. Trong 1 case — 3 hướng có thể đi (không loại trừ nhau, chọn tuỳ nhu cầu case đó)

### (A) Gọi thẳng Core — message tự đủ nghĩa, KHÔNG cần đọc `appState` nào cho core

Chỉ áp dụng khi case **không cần lấy bất kỳ giá trị `appState` nào** để đưa vào core — hàm core
chỉ cần đúng `msg.payload` (hoặc không cần tham số gì), hành vi không phụ thuộc bất kỳ state nào
khác:
```js
case 'cluster.action.click':
    coreFunctionX(msg.payload);
    break;
```
Nếu core cần bất kỳ giá trị `appState` nào ngoài `msg.payload` — dù chỉ 1 key, dù case chỉ gọi
đúng 1 hàm core — KHÔNG còn là (A) nữa, xem (B) ngay dưới.

### (B) Giao Workflow — cần ≥1 bước chuẩn bị (lấy state/gọi service) hoặc ≥2 lời gọi nối tiếp

**Workflow không chỉ được định nghĩa bằng SỐ BƯỚC.** Bản chất Workflow là tầng ĐIỀU PHỐI — nơi
duy nhất được phép vừa đọc `appState`/gọi `service/` vừa quyết định gọi Core nào — nên Workflow
cần thiết bất cứ khi nào 1 case phải hoàn thành 1 mục tiêu nghiệp vụ LỚN HƠN "gọi đúng 1 hàm với
đúng `msg.payload` nó có sẵn", bất kể việc đó gói gọn trong 1 bước hay nhiều bước:

- **≥2 lời gọi (core hoặc hàm khác) nối tiếp, có phụ thuộc thứ tự** — gọi ≥2 hàm mà **ít nhất 1
  hàm không có return được dùng** (chỉ tạo side-effect) và chạy **đồng bộ hoặc bất đồng bộ có chờ**
  (bước sau chạy sau khi bước trước đã chạy/hoàn thành) → LUÔN là Workflow, bất kể đơn giản hay
  phức tạp, có `shield`/`modal` hay không. `shield`/`modal` vẫn THƯỜNG xuất hiện (nhiều thao tác cần
  chờ — IndexedDB, network...) nhưng chỉ là 1 LÝ DO hay gặp, không còn là điều kiện quyết định.
- **CHUẨN BỊ state cho Core, dù chỉ gọi ĐÚNG 1 hàm core** — tự nó cũng là Workflow, không có ngoại
  lệ nào biện minh kiểu "chỉ 1 core nên không cần Workflow". Core không được tự `appState.get()`
  (Rule 2) — nghĩa là LUÔN có 1 tầng nào đó đứng ra đọc state rồi truyền vào, và tầng đó, theo
  đúng định nghĩa, CHÍNH LÀ Workflow — dù công việc "chuẩn bị" đó chỉ vỏn vẹn 1 dòng
  `appState.get(...)` rồi gọi thẳng core ngay sau. Router không tự làm việc này thay Workflow được
  — Router chỉ chuyển tiếp `msg`, không đọc `appState` để nuôi core.
- Cùng logic, **gọi `service/` (db.js, operation.js...) để chuẩn bị dữ liệu cho Core** cũng là
  Workflow, không phải ngoại lệ của Router — Router không tự gọi `service/` để chuẩn bị input cho
  Core.

**Ranh giới đếm "≥2 giá trị" là theo CẢ 1 lần thực thi Workflow, KHÔNG phải theo từng lời gọi Core
riêng lẻ.** Nếu 1 method Workflow gọi 2 Core khác nhau, mỗi Core chỉ cần ĐÚNG 1 giá trị `appState`
(2 core, 2 field khác nhau, không trùng) — vẫn PHẢI gộp thành 1 lần `appState.get([key1, key2])`
duy nhất ở đầu method, KHÔNG được tách thành 2 lần `get(key)` rời rạc (mỗi lần ngay trước lúc gọi
Core tương ứng). Đứng từ góc Workflow: tổng nhu cầu đọc state của CẢ method là 2 giá trị, bất kể
2 giá trị đó cuối cùng "đi" tới cùng 1 Core hay rẽ ra phục vụ 2 Core khác nhau — quy tắc mảng tính
theo tổng số giá trị Workflow cần lấy trong 1 lần chạy, không tính theo "core này cần bao nhiêu".
Chỉ khi CẢ method chỉ cần vỏn vẹn 1 giá trị `appState` duy nhất (dù để nuôi 1 hay nhiều Core) thì
mới gọi đơn `get(key)` như bình thường — quy tắc mảng bắt buộc ngay khi tổng số giá trị cần lấy
trong method đó từ 2 trở lên.

**Ngoại lệ:** lời gọi bất đồng bộ và KHÔNG chờ (fire-and-forget, không `await`) không tạo phụ
thuộc thứ tự — KHÔNG tính là Workflow, được gọi thẳng trong Core/Router như bình thường (miễn
không cần `appState` nào để gọi, đúng điều kiện (A) ở trên).

```js
case 'cluster.action.change':
    workflowX.doThing(msg.payload);
    break;
```

**Tái dùng Workflow giữa các miền khác nhau** [MỚI, 10/07/2026] — nếu 2 router KHÁC MIỀN (2 nguồn
listener khác nhau, vd `playlist` và `subtitleModal`) cần chạy **CÙNG 1 logic điều phối** (không
phải trùng hợp bề ngoài — thật sự cùng các bước, cùng thứ tự), KHÔNG bắt buộc mỗi miền phải tự viết
1 bản Workflow RIÊNG của chính nó — router miền A có thể gọi THẲNG method của `workflowB` (miền
khác), Workflow-gọi-Workflow là tự do, không bị Rule 3 (rule đó CHỈ áp cho Core). Chuyển 1 hàm từ
"riêng của workflowA" thành "dùng chung" khi phát hiện ≥2 nơi cần y hệt — KHÔNG cần đoán trước, viết
trùng lặp trước rồi gộp lại lúc phát hiện trùng vẫn ổn hơn tách sai chỗ từ đầu.

Ví dụ THẬT (Subtitle Editor, `event/workflow/subtitle-modal.js` + `event/workflow/playlist.js`) —
**CẬP NHẬT 10/07/2026 lần 2:** nút "Sub" ở Control Center (miền `subtitleModal`) đã đổi thành TOGGLE
bật/tắt thuần (không còn điều hướng, xem router — gọi thẳng core, không cần workflow cho việc đó
nữa), nhưng `navigateToEditor()` VẪN sống trong `workflowSubtitleModal` vì lối vào Subtitle Editor
DUY NHẤT còn lại (menu 3 chấm mỗi bài hát, miền `playlist`) vẫn cần nó — CHỈ CÒN 1 nơi gọi, nhưng ví
dụ này vẫn hữu ích để minh hoạ: hàm dùng chung có thể "sống ký gửi" trong 1 workflow file mà CHÍNH
router của file đó không còn dùng tới nữa, miễn còn ÍT NHẤT 1 miền khác cần nó.

```js
// event/workflow/subtitle-modal.js (miền "subtitleModal")
const workflowSubtitleModal = {
    navigateToEditor(songKey) { // DÙNG CHUNG — miền khác gọi thẳng được
        window.location.href = `subtitle-editor.html?song=${encodeSongKeyForUrl(songKey)}`;
    },
};

// event/workflow/playlist.js (miền "playlist" — KHÁC router hoàn toàn)
openSubtitleEditorForSongMenu() {
    const key = playlistStore.get('songActionMenuKey');
    if (!key) return;
    closeSongActionMenu();
    workflowSubtitleModal.navigateToEditor(key); // tái dùng THẲNG, không viết lại
},
```

### (C) `VirtualMachineState.run([...])` — MỌI rẽ nhánh theo state, kể cả đơn đích lẫn đa đích

Dùng khi 1 case cần đọc **1 hoặc nhiều field `appState` KHÁC** (không phải `msg.payload` của
chính nó) để quyết định chạy gì — **luôn qua `VirtualMachineState`, không viết switch/if tay đọc
`appState` trong case nữa**, kể cả khi chỉ có 1 điều kiện/1 đích duy nhất. Lý do đổi từ khuyến
nghị trước (từng cho phép switch/if tay nếu đơn đích): 1 API duy nhất cho "rẽ nhánh theo state"
dễ đọc/dễ audit hơn 2 cách viết khác nhau tuỳ case đơn hay đa đích — quét toàn bộ router chỉ cần
tìm `VirtualMachineState.run(` là ra hết chỗ nào đang rẽ nhánh theo state, không sót chỗ viết tay.

**Đa đích (nhiều rule cùng khớp là đúng, không loại trừ nhau):**
```js
case 'cluster.action.click': {
    const someState = appState.get('someState'); // đọc 1 lần
    VirtualMachineState.run([
        { state: someState, operation: '===', value: 10, callback: () => coreOrWorkflowA(msg) },
        { state: someState, operation: '>=',  value: 10, callback: () => coreOrWorkflowB(msg) },
    ]);
    break;
}
```
`someState = 10` khớp CẢ HAI rule → CẢ HAI callback chạy — không phải chọn 1 trong 2.

> **Lưu ý thứ tự chạy:** khi ≥2 rule CÙNG khớp trong 1 lần `run()`, callback được gọi **tuần tự
> theo đúng thứ tự khai báo trong mảng, từ trên xuống dưới** (`run()` là vòng `for` thường, không
> chạy song song, không tự sắp xếp lại) — rule khai báo trước LUÔN chạy xong trước rule khai báo
> sau. Nếu 2 workflow/core cùng khớp có side-effect đụng nhau (vd cùng ghi 1 field `appState`,
> cùng động vào 1 vùng DOM), thứ tự viết trong mảng chính là thứ tự ai-ghi-đè-ai — cân nhắc kỹ khi
> sắp xếp, không coi 2 rule khớp cùng lúc là độc lập tuyệt đối về mặt thời gian chạy.

**Đơn đích (loại trừ nhau, giống switch/if cũ)** — viết y hệt cú pháp trên, chỉ khác các `value`
so sánh vốn đã loại trừ nhau tự nhiên (1 field không thể vừa `'dong'` vừa `'bac'` cùng lúc), nên
CHỈ 1 rule khớp — không cần cơ chế "dừng sớm" riêng, tự nhiên chỉ 1 callback chạy:
```js
case 'cluster.action.click': {
    const doorMaterial = appState.get('doorMaterial');
    VirtualMachineState.run([
        { state: doorMaterial, operation: '===', value: 'dong', callback: () => workflow1(msg) },
        { state: doorMaterial, operation: '===', value: 'bac',  callback: () => workflow2(msg) },
    ]);
    break;
}
```
Không rule nào khớp (vd `doorMaterial` mang giá trị lạ, chưa tính tới) → `run()` tự
`console.warn('[VirtualMachineState] run() — không rule nào khớp.', rules)` — thay hẳn cho nhánh
`default: console.warn(...)` từng viết tay trong switch, không cần viết lại.

## 5. `callback` trong `VirtualMachineState` gọi gì?

`VirtualMachineState` không biết Core hay Workflow là gì — `callback` là 1 arrow function router
tự viết, bên trong gọi thẳng hàm Core hoặc `workflowX.method()` tuỳ case đó cần gì (giống hệt
tiêu chí (A)/(B) ở mục 4, chỉ khác là được BỌC trong 1 rule thay vì gọi trực tiếp trong case).

## 6. Ngưỡng chọn (A) / (B) / (C) / Block — tóm tắt quyết định

| Câu hỏi | Chọn |
|---|---|
| Không cần đọc `appState` nào cả để nuôi Core (kể cả chỉ dùng `msg.payload` của chính message)? | (A) gọi thẳng Core |
| Cần đọc dù chỉ 1 giá trị `appState`/gọi `service/` để CHUẨN BỊ input cho Core — dù case chỉ gọi đúng 1 hàm? | (B) Workflow — "chuẩn bị state cho Core" tự nó là Workflow, không có ngoại lệ "1 core thì khỏi cần" |
| Cần gọi ≥2 hàm nối tiếp, ít nhất 1 hàm void/side-effect, chạy đồng bộ hoặc async có chờ (tạo phụ thuộc thứ tự)? | (B) Workflow — bất kể đơn giản hay cần shield/modal |
| Cần đọc `appState` KHÁC để quyết định CHẠY GÌ (chọn giữa các Core/Workflow khác nhau) — dù chỉ 1 điều kiện/1 đích hay nhiều? | (C) `VirtualMachineState` — LUÔN dùng, không viết switch/if tay đọc `appState` trong case nữa |
| Tổng cả 1 lần thực thi Workflow cần lấy ≥2 giá trị `appState` (dù để nuôi 1 Core hay rẽ ra nhiều Core khác nhau)? | `appState.get([key1, key2, ...])` dạng mảng — không gọi rời từng key theo từng Core |
| Điều kiện chặn dùng ở ≥2 router, hoặc bản chất là chặn hẳn không chạy gì? | Block (`event/block.js`) — chặn TRƯỚC router, không phải trong case |

← [Quay lại README](../README.md)
