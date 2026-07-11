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
│  Block gate (event/block.js — DATA, hiện RỖNG)                  │
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
    │      không cần state gì cả             ≥2 lời gọi side-       rẽ nhánh theo state, CHẠY
    │      (Ví dụ 1 — xem mục 3)              effect nối tiếp,       NHIỀU callback nếu nhiều rule
    │                                         có phụ thuộc thứ tự   cùng khớp — mỗi callback là
    │                                                                 CORE hoặc WORKFLOW tuỳ rule
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

### (A) Gọi thẳng Core — không cần biết state gì

Đa số case hiện có. Message tự đủ nghĩa (dựa vào chính `msg.payload`, hoặc hành vi không đổi theo
state khác), gọi thẳng 1 hàm:
```js
case 'cluster.action.click':
    coreFunctionX(msg.payload);
    break;
```

### (B) Giao Workflow — ≥2 lời gọi side-effect nối tiếp, có thứ tự phụ thuộc nhau

**[Cập nhật — xem [core-function-conventions.md Rule 3](./core-function-conventions.md)]** Tiêu
chí cũ ("cần shield/modal, HOẶC ≥2 hàm core độc lập") đã **bỏ điều kiện shield/modal riêng biệt**
— giờ chỉ cần đúng hình dạng: gọi ≥2 hàm (core hoặc hàm khác) mà **ít nhất 1 hàm không có return
được dùng** (chỉ tạo side-effect) và chạy **đồng bộ hoặc bất đồng bộ có chờ** (tạo phụ thuộc thứ
tự — bước sau chạy sau khi bước trước đã chạy/hoàn thành) → LUÔN là Workflow, bất kể đơn giản hay
phức tạp, có `shield`/`modal` hay không. `shield`/`modal` vẫn THƯỜNG xuất hiện (nhiều thao tác cần
chờ — IndexedDB, network...) nhưng chỉ là 1 LÝ DO hay gặp, không còn là điều kiện quyết định.

**Ngoại lệ:** lời gọi bất đồng bộ và KHÔNG chờ (fire-and-forget, không `await`) không tạo phụ
thuộc thứ tự — KHÔNG tính là Workflow, được gọi thẳng trong Core/Router như bình thường.

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

Ví dụ THẬT (Subtitle Editor, `event/workflow/subtitle-modal.js` + `event/workflow/playlist.js`):
nút "Sub" ở Control Center (miền `subtitleModal`, sửa phụ đề bài ĐANG PHÁT) và nút "Sửa phụ đề"
trong menu 3 chấm mỗi bài hát (miền `playlist`, sửa phụ đề 1 bài BẤT KỲ trong danh sách) đều cần
đúng 1 việc: mã hoá `songKey` rồi điều hướng sang `subtitle-editor.html?song=...`. Thay vì viết 2
lần, `workflowPlaylist.openSubtitleEditorForSongMenu()` gọi thẳng
`workflowSubtitleModal.navigateToEditor(key)` — CHỈ 2 miền tự lo phần KHÁC nhau của mình (đọc
`songKey` từ đâu: `appState.get('currentKey')` hay `playlistStore.get('songActionMenuKey')`), phần
CHUNG (điều hướng) sống Ở ĐÚNG 1 CHỖ.

```js
// event/workflow/subtitle-modal.js (miền "subtitleModal")
const workflowSubtitleModal = {
    openEditor() {
        const currentKey = appState.get('currentKey');
        if (!currentKey) { alertModal(t('subtitleModal.noSongPlaying')); return; }
        this.navigateToEditor(currentKey);
    },
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
| Không cần biết state nào cả (kể cả chỉ dùng `msg.payload` của chính message)? | (A) gọi thẳng Core |
| Cần gọi ≥2 hàm nối tiếp, ít nhất 1 hàm void/side-effect, chạy đồng bộ hoặc async có chờ (tạo phụ thuộc thứ tự)? | (B) Workflow — bất kể đơn giản hay cần shield/modal |
| Cần đọc `appState` KHÁC để quyết định chạy gì — dù chỉ 1 điều kiện/1 đích hay nhiều? | (C) `VirtualMachineState` — LUÔN dùng, không viết switch/if tay đọc `appState` trong case nữa |
| Điều kiện chặn dùng ở ≥2 router, hoặc bản chất là chặn hẳn không chạy gì? | Block (`event/block.js`) — chặn TRƯỚC router, không phải trong case |

← [Quay lại README](../README.md)
