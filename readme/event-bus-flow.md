# Luồng kiến trúc `/event/` — sơ đồ đầy đủ (ver 13)

> Tài liệu này mô tả ĐÚNG luồng thật đang chạy trong code, không phải kế hoạch. Đọc cùng
> [where-to-edit.md](./where-to-edit.md) (sửa ở đâu), [script-load-order.md](./script-load-order.md) (thứ tự nạp
> `<script>`), [core-function-conventions.md](./core-function-conventions.md) (quy tắc Core) và
> [core-legacy-audit.md](./core-legacy-audit.md) (sổ vi phạm hiện tại — chấm theo đúng các quy tắc ở đây).
>
> Đồng bộ 07/10/2026 (chốt ver 13): Block gate có `notify`/`groupNotify` và đường dẫn `payload.`/`<domain>Config.`;
> `VirtualMachineState.runAsync()`; ví dụ thay bằng code hiện có; mục 7 cập nhật theo các phán quyết 07/10
> (chấm theo nội dung nhánh, switch A/B, guard, Workflow không tự thi hành).

## Sơ đồ tổng quan

```
Listener (DOM/tab/window/...)
        │  eventBus.send(msg)
        ▼
┌─────────────────────────────────────────────────────────────────┐
│ event/bus.js                                                    │
│                                                                 │
│  Block gate (event/block.js — DATA, 10 entry: xem mục 2)        │
│  isBlocked(msg.type, payload)? ── true ──▶ DỪNG, KHÔNG vào Router│
│       │ false                     (im lặng, hoặc alert notify)  │
└───────┼─────────────────────────────────────────────────────────┘
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
| **`VirtualMachineState`** | Trong 1 case (hoặc trong Workflow, mục 7a) | KHÔNG (nơi gọi tự đọc, truyền `state` sẵn vào rule) | gọi 0..N callback | Có — 1 rule khớp (đơn đích) hay nhiều rule khớp (đa đích) đều cùng 1 API |

## 1. Listener — nguồn trigger

DOM (`click`/`change`/`input`...), `tab`/`window` lifecycle (`visibilitychange`/`pagehide`/
`beforeunload`...), hoặc nguồn khác (`audioPlayer` media events). Chỉ làm 1 việc: đăng ký sự kiện
+ gọi `eventBus.send({ router, type, payload })`. KHÔNG chứa logic nghiệp vụ, KHÔNG đọc `appState`,
KHÔNG sửa DOM, KHÔNG gọi Core/Workflow (đó là việc của Block/Router/Workflow phía sau).

**Ủy quyền (delegation) là hợp lệ:** 1 listener gắn trên phần tử cha, dùng `closest()` hoặc bảng tuyến
(`data-*` → `type`) chỉ để xác định phần tử nào được chạm rồi `eventBus.send` — không phải rẽ nhánh nghiệp vụ.
Khác với gọi trực tiếp ở chỗ số lệnh gắn ít hơn và phần tử dựng lại (innerHTML) không cần gắn lại; nội dung
callback vẫn chỉ là `send`.

Listener cũng có thể nằm trong hàm `wire*()` của file core `-ui.js` (DOM dựng động — xem Rule 5a,
[core-function-conventions.md](./core-function-conventions.md)): callback chỉ `eventBus.send`, gom cuối hàm.

**Vòng lặp `raf` — trường hợp riêng, ngoài Listener→Router:** `event/workflow/visualizer-render.js` và
`event/workflow/audio-analysis.js` tự đăng ký task `taskManager` mode `raf` (`service/task-manager.js`) và tự
"tick" mỗi khung hình — không có Listener nào gửi `eventBus.send()`, không có Router nào `switch(msg.type)`. Vẫn
đúng vai trò Workflow (tự đọc state, quyết định gọi Core nào); chỉ khác nguồn kích hoạt. Hai task: `audioAnalysis`
(phân tích audio, status bar, nhịp Game — luôn chạy) và `visualizerRender` (chỉ vẽ, tự đăng ký/kill theo Show
Visual). Điểm khởi động duy nhất: `workflowAudioEngine.setup()` (`event/workflow/audio-engine.js`) gọi
`workflowVisualizerRender.start()` — Workflow gọi Workflow; không còn Core nào gọi Workflow.

**Web Worker** (`core/workers/*.js`) nằm ngoài kiến trúc (Giang chốt 07/10/2026): hồi đáp `onmessage`/`onerror`
của worker do Workflow chủ quản gắn và xử lý trực tiếp, không đi qua Listener/Router, không chấm theo rule.

### Ngoại lệ `addEventListener` ngoài `/event/` còn hiệu lực

Danh sách gốc là 18 chỗ đã audit ở [changelog/v11.md](./changelog/v11.md) mục 2. Sau khi gỡ các file cũ
(`tab-hide-reload.js`, `app-cleanup.js` ở core, `resume-state-storage.js`, `state-and-video-bg.js`…), số còn lại
trong code là:

| File | Gắn gì | Lý do |
|---|---|---|
| `event/tab.js` | `beforeunload` trên `window` | Lifecycle trình duyệt |
| `core/wakelock.js` | `touchstart`/`click` `{ once: true }` trên `body` | Xin lại wakelock sau cử chỉ người dùng đầu tiên (yêu cầu của trình duyệt) |
| `core/playlist/loader.js`, `core/playlist/render.js` | Sự kiện media một lần (dò `duration`) | Đọc metadata, không phải tương tác người dùng |
| `core/modal-choice-ui.js` — `modalChoice()` | Click nút/overlay của mọi modal động | Hạ tầng dùng chung, xem 3 điều kiện ngay dưới |

`app.boot` đi qua `eventBus` như mọi cụm (`event/listener/app-boot.js` nghe `DOMContentLoaded`). Message
`app.fatalError` đã bỏ. Handler `error`/`unhandledrejection` toàn cục hiện **không có** trong `index.html`
(`core/fatal-error.js` chỉ còn comment) — ghi ở [changelog/v13.md](./changelog/v13.md) mục 7, chưa sửa.

**Vì sao `modalChoice()` được miễn — PHẢI ĐỦ CẢ 3 điều kiện, không phải "là UI nên miễn"**
(xem thêm [core-function-conventions.md Rule 5](./core-function-conventions.md)):

1. **Hạ tầng dùng CHUNG toàn app** — không gắn với 1 nghiệp vụ cụ thể (Song/Photo/Video...). File
   `addEventListener` chỉ phục vụ 1 tính năng (như `core/file-manager/photo-ui.js`) KHÔNG đạt điều kiện này, dù
   viết kỹ thuật y hệt.
2. **Callback bên trong `addEventListener` CHỈ gọi tham số nhận từ nơi gọi** —
   `btnEl.addEventListener('click', () => { closeModal(); if (typeof btnDef.onClick === 'function') btnDef.onClick(); })`
   — `modalChoice()` không gọi tên bất kỳ hàm core cụ thể nào khác, `onClick` là tham số mờ do nơi gọi truyền vào.
   Hàm VỪA `addEventListener` VỪA gọi thẳng tên 1 core khác trong callback thì VẪN vi phạm Rule 3 dù đạt điều kiện 1.
3. **Đã qua audit chính thức, có tên, có số liệu** — `changelog/v11.md` mục 2, không phải tự nhận trong docstring
   của chính file đó. File tự ghi "cùng pattern với `modalChoice()`" (vd `core/file-manager/folder-picker-ui.js`)
   **không** được miễn.

## 2. Block gate — chặn TRƯỚC khi vào Router

`eventBus.send(msg)` gọi `isBlocked(msg.type, msg.payload)` — tra các entry đăng ký qua
`eventBus.registerBlock(msgType, groups, options?)` trong `event/block.js` — TRƯỚC khi gọi `router.handle(msg)`.
Nếu khớp, `send()` `return` ngay — Router, Core, Workflow đều KHÔNG chạy.

**Chỉ dùng khi:**
- Điều kiện chặn dùng ở **≥2 entry point/router khác nhau** cho cùng 1 ý nghĩa nghiệp vụ (tránh lệch logic
  giữa các entry point — lý do ra đời cơ chế này, xem [v12.md](./changelog/v12.md) mục 1), HOẶC
- Bản chất là **chặn hẳn** (không chạy gì khi điều kiện đúng), không phải chọn giữa nhiều đích.

**KHÔNG dùng khi** cần chọn "workflow nào chạy" tuỳ state — Block chỉ trả boolean. Trường hợp đó thuộc mục 4C.

### Cú pháp

```js
eventBus.registerBlock('router.action.event', [
    // mảng NGOÀI = các NHÓM — 1 nhóm đúng là CHẶN (OR, dừng ở nhóm khớp đầu tiên)
    [
        // mảng TRONG = điều kiện — TẤT CẢ đúng thì nhóm mới tính (AND)
        { field: 'isActiveFolderReadOnly', operator: '===', value: true },
    ],
], { notify: 'Lý do chặn', groupNotify: ['Lý do nhóm 0', /* ... */] });
```

- **`field`** — đường dẫn lồng bất kỳ độ sâu. Gốc quyết định nguồn đọc (`resolveFieldPath()` trong `event/bus.js`):
  - `payload.xxx` — dữ liệu của chính message đang xét (vd "thứ sắp xoá có phải thứ đang được tham chiếu không").
  - `<domain>Config.xxx` — domain `AppConfig` đã đăng ký (vd `perfHudConfig.enabled` đọc
    `appConfig.access('perfHud').getAll().enabled`). Nhận diện tự động theo `AppConfig._domains`.
  - Tên khác — key `appState`.
- **`operator`** — `'===' | '!==' | '>' | '<' | '>=' | '<=' | 'in' | 'notIn'` (`service/operation.js`).
- **`value`** hoặc **`valueField`** — vế phải là giá trị cố định, hoặc 1 đường dẫn khác resolve cùng cách trên.
- **`options.notify`** — chặn thật thì tự `alertModal(notify)` (không chờ modal đóng). Không có → chặn im lặng.
- **`options.groupNotify[i]`** — thông báo riêng cho nhóm thứ `i` khớp đầu tiên; không có thì dùng `notify`.

### Entry hiện có (10)

| `msg.type` | Chặn khi | Thông báo |
|---|---|---|
| `playlist.uploadMenu.open` | Folder đang Scope là read-only (`isActiveFolderReadOnly`) | Có |
| `playlist.actionMenu.addToFolder` | Generic Drawer đang mở (`isGenericDrawerOpen`) | Im lặng |
| `visualBg.openPanel.click` | Nguồn Playlist không phải Song (`activeMediaSource !== 'song'`) | Có |
| `recorder.start.click` | Đang có phiên ghi, hoặc Photo Player mode, hoặc đang ở Game (3 nhóm OR) | Im lặng |
| `playerControls.next.click`, `.prev.click`, `.playPause.click`, `.restart.click` | Đang có phiên ghi (`recordPhase !== 'idle'`) — dùng chung `RECORDER_SESSION_ACTIVE_BLOCK` | Im lặng |
| `perfHud.app.pointerdown` | Perf HUD tắt (`perfHudConfig.enabled !== true`) | Im lặng |

Tính năng mới nào mở Generic Drawer phải tự đăng ký block cho `msg.type` của nó (khuôn
`playlist.actionMenu.addToFolder`), không tự suy luận miễn trừ.

## 3. Router — switch theo `msg.type`

Mỗi cụm (`playlist`, `visualizerDisplay`, `recorder`...) có đúng 1 router, tự
`eventBus.register(name, routerObject)` lúc nạp — 43 router hiện có (danh sách ở
[where-to-edit.md](./where-to-edit.md)). `handle(msg)` switch theo `msg.type` (namespace `<router>.<action>.<event>`),
mỗi case đi 1 trong 3 hướng ở mục 4. Router chỉ điều phối: không đọc `appState` để nuôi core, không gọi `service/`,
không tự tính dữ liệu cho bước sau.

### 3a. Đơn tuyến vs liên tuyến domain

Event bus hoàn toàn có thể hoạt động XUYÊN MIỀN — cần phân biệt 2 khái niệm:

- **Namespace/quản lý** (message của miền nào đăng ký ở đâu, router nào sở hữu tên đó, ai bảo trì) — chuyện
  "nơi chứa, thuộc về".
- **Khả năng phối hợp xuyên miền** (1 listener/router/workflow của miền này có được gọi sang miền khác không) —
  chuyện "có làm được, có nên làm không".

Giống 1 công ty nhiều phòng ban: mỗi phòng tự quản lý nhân viên của mình (namespace), nhưng không cấm các phòng phối
hợp cho 1 nghiệp vụ chung. Phối hợp đó gọi là **nghiệp vụ liên domain** — hợp lệ, miễn luồng thực thi vẫn LUÔN đi
đúng thứ tự **Listener → Router → Workflow** (không đảo ngược, không nhảy cóc tầng).

**TH1 — Đơn tuyến domain:** Listener của miền X gửi tới Router của ĐÚNG miền X, Router gọi Core/Workflow của
ĐÚNG miền X. Mặc định nên dùng khi không có lý do cụ thể để đi liên tuyến.

```
Listener(X) ──▶ Router(X) ──▶ Workflow(X) ──▶ Core(X)
```

Ví dụ thật (miền `settingsMisc`, nút "Xoá" của panel Debug Console):

```js
// core/settings-misc-ui.js — Listener (DOM động, wire lúc dựng panel; callback chỉ eventBus.send)
function wireDebugConsolePanelActions(panelEl) {
    const clearBtn = panelEl.querySelector('#btn-debug-console-clear');
    // ...
    clearBtn.addEventListener('click', () => eventBus.send({ router: 'settingsMisc', type: 'settingsMisc.debugConsole.clear.click', payload: {} }));
}

// event/router/settings-misc.js — Router
case 'settingsMisc.debugConsole.clear.click': {
    workflowSettingsMisc.clearDebugConsoleLog();
    break;
}

// event/workflow/settings-misc.js — Workflow
clearDebugConsoleLog() {
    clearDebugConsoleLogs(); // core/debug-console.js
    this._debugConsolePageIndex = 0;
    if (this._debugConsolePanelEl) this._renderDebugConsoleList(this._debugConsolePanelEl);
},

// core/debug-console.js — Core
function clearDebugConsoleLogs() {
    _debugConsoleBuffer.length = 0;
}
```

**TH2 — Liên tuyến domain:** Router(B) gọi Workflow(C); Workflow(C) gọi tiếp Workflow(D) hoặc Core(E) khác miền —
miễn mỗi bước chuyển tầng vẫn đúng vai trò của tầng đó.

```
Listener(X) ──▶ Router(B) ──▶ Workflow(C) ──▶ Workflow(D) ──▶ Core(D)
Listener(X) ──▶ Router(B) ──▶ Workflow(C) ──▶ Core(E)
```

Ví dụ thật 1 — Workflow miền `fileManagerFolderBrowser` gọi thẳng 2 Workflow miền khác, không viết lại logic
Scope:

```js
// event/workflow/file-manager-folder-browser.js
async applyFolderFromTile(folderId) {
    const mediaType = appState.get('activeMediaSource');
    await withLoadingShield(t('common.loading.generic'), async () => { // core/loading-shield-util.js
        await workflowPlaylistScope.persistScopeChoice(folderId, mediaType); // miền playlistScope
        await workflowPlaylistScope.applyFolderScope(folderId, mediaType);
        workflowPlaylistRender.scrollToCurrentOrTop();                       // miền playlistRender
    });
    this.closeBrowser();
},
```

Ví dụ thật 2 — Core dùng chung xuyên miền: `initCropSession()` (`core/media-transform.js`) được cả
`event/workflow/image-edit.js` (crop ảnh) lẫn `event/workflow/video-preview.js` (Video Editor) gọi thẳng.

Ràng buộc DUY NHẤT không đổi dù đi tuyến nào: **Core không được gọi Core khác** (Rule 3) — liên tuyến nới lỏng ai
được gọi tới Core từ tầng Workflow, KHÔNG nới lỏng việc Core tự gọi lẫn nhau.

**KHÔNG lạm dụng liên tuyến.** Trước khi gọi chéo, tự hỏi:

- Đích đến có thật là 1 nghiệp vụ ĐỘC LẬP, đúng thứ cần tái dùng nguyên vẹn — hay chỉ "tiện đường"?
- Tách `msg.type` riêng cho đúng miền (TH1) có thật sự phức tạp hơn, hay chỉ ngại thêm 1 case/1 hàm?
- Chuỗi gọi chéo càng dài (X→B→C→D…) càng khó truy "hành vi này bắt nguồn từ đâu, ai sở hữu".

## 4. Trong 1 case — 3 hướng có thể đi (không loại trừ nhau, chọn tuỳ nhu cầu case đó)

### (A) Gọi thẳng Core — message tự đủ nghĩa, KHÔNG cần đọc `appState` nào cho core

Chỉ khi case **không cần lấy bất kỳ giá trị `appState` nào** để đưa vào core — core chỉ cần `msg.payload` (hoặc
không cần tham số):
```js
case 'cluster.action.click':
    coreFunctionX(msg.payload);
    break;
```
Core cần bất kỳ giá trị `appState` nào ngoài `msg.payload` — dù chỉ 1 key, dù chỉ 1 hàm core — thì là (B).

### (B) Giao Workflow — cần ≥1 bước chuẩn bị (lấy state/gọi service) hoặc ≥2 lời gọi nối tiếp

Workflow là tầng ĐIỀU PHỐI — nơi duy nhất vừa đọc `appState`/gọi `service/` vừa quyết định gọi Core nào:

- **≥2 lời gọi nối tiếp có phụ thuộc thứ tự** (ít nhất 1 hàm chỉ tạo side-effect, chạy đồng bộ hoặc async có chờ)
  → LUÔN là Workflow, bất kể có `shield`/`modal` hay không.
- **CHUẨN BỊ state cho Core, dù chỉ gọi ĐÚNG 1 hàm core** — Core không được tự `appState.get()` (Rule 2), nên tầng
  đứng ra đọc rồi truyền vào CHÍNH LÀ Workflow. Router không làm thay được.
- **Gọi `service/` (db.js, operation.js...) để chuẩn bị dữ liệu cho Core** — cũng là Workflow.

**Gộp đọc state: ranh giới "≥2 giá trị" tính theo CẢ 1 lần thực thi method Workflow**, không theo từng Core. Method
cần tổng ≥2 giá trị `appState` (dù nuôi 1 Core hay rẽ ra nhiều Core) → 1 lần `appState.get([key1, key2])` ở đầu
method; chỉ khi cả method cần đúng 1 giá trị mới dùng `get(key)` đơn.

**Ngoại lệ:** lời gọi bất đồng bộ KHÔNG chờ (fire-and-forget) không tạo phụ thuộc thứ tự — không bắt buộc Workflow
(miễn không cần `appState` nào để gọi).

```js
case 'cluster.action.change':
    workflowX.doThing(msg.payload);
    break;
```

**Tái dùng Workflow giữa các miền** (TH2, mục 3a): 2 router khác miền cần CÙNG 1 logic điều phối thì gọi thẳng
method của workflow miền kia — Workflow-gọi-Workflow tự do (Rule 3 chỉ áp cho Core). Hàm dùng chung có thể "sống ký
gửi" trong workflow của miền mà chính router miền đó không còn dùng tới:

```js
// event/workflow/subtitle-modal.js
const workflowSubtitleModal = {
    navigateToEditor(songKey) {
        window.location.href = `subtitle-editor.html?song=${encodeSongKeyForUrl(songKey)}`; // service/song-key-cipher.js
    },
};

// event/workflow/playlist.js — miền khác
openSubtitleEditorForSongMenu() {
    const key = playlistStore.get('songActionMenuKey');
    if (!key) return;
    workflowPlaylist.closeActionMenu();
    workflowSubtitleModal.navigateToEditor(key);
},
```

### (C) `VirtualMachineState.run([...])` — MỌI rẽ nhánh theo state, kể cả đơn đích lẫn đa đích

Case cần đọc **1 hoặc nhiều field `appState` KHÁC** (không phải `msg.payload`) để quyết định chạy gì → **luôn qua
`VirtualMachineState`**, không viết switch/if tay đọc `appState` trong case, kể cả 1 điều kiện/1 đích. Quét toàn bộ
router chỉ cần tìm `VirtualMachineState.run(` là ra hết chỗ rẽ nhánh theo state.

**Đa đích (nhiều rule cùng khớp là đúng):**
```js
case 'cluster.action.click': {
    const someState = appState.get('someState');
    VirtualMachineState.run([
        { state: someState, operation: '===', value: 10, callback: () => coreOrWorkflowA(msg) },
        { state: someState, operation: '>=',  value: 10, callback: () => coreOrWorkflowB(msg) },
    ]);
    break;
}
```
`someState = 10` khớp CẢ HAI rule → CẢ HAI callback chạy.

> **Thứ tự chạy:** các rule khớp được gọi **tuần tự theo thứ tự khai báo** (vòng `for` thường) — rule trước chạy
> xong trước. 2 callback có side-effect đụng nhau thì thứ tự trong mảng chính là thứ tự ai-ghi-đè-ai.

**Đơn đích (loại trừ nhau)** — cùng cú pháp, các `value` tự loại trừ nên chỉ 1 rule khớp:
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
Không rule nào khớp → `run()` tự `console.warn('[VirtualMachineState] run() — không rule nào khớp.', rules)`.

**`runAsync(rules)`** — cùng cú pháp `run()`, trả `Promise.all(...)` kết quả của mọi callback khớp — dùng khi nơi gọi
cần `await` các nhánh xong rồi mới đi tiếp. `run()` giữ nguyên fire-and-forget, không trả gì.

## 5. `callback` trong `VirtualMachineState` gọi gì?

`VirtualMachineState` không biết Core hay Workflow là gì — `callback` là arrow function nơi gọi tự viết, bên trong
gọi thẳng hàm Core hoặc `workflowX.method()` tuỳ case (tiêu chí (A)/(B) ở mục 4, chỉ khác là được bọc trong 1 rule).

## 6. Ngưỡng chọn (A) / (B) / (C) / Block — tóm tắt quyết định

| Câu hỏi | Chọn |
|---|---|
| Không cần đọc `appState` nào để nuôi Core (chỉ dùng `msg.payload`)? | (A) gọi thẳng Core |
| Cần đọc dù chỉ 1 giá trị `appState`/gọi `service/` để CHUẨN BỊ input cho Core — dù chỉ 1 hàm? | (B) Workflow |
| Cần gọi ≥2 hàm nối tiếp, ít nhất 1 hàm side-effect, đồng bộ hoặc async có chờ? | (B) Workflow |
| Cần đọc `appState` KHÁC để quyết định CHẠY GÌ — dù 1 điều kiện hay nhiều? | (C) `VirtualMachineState` |
| Cả 1 lần thực thi Workflow cần ≥2 giá trị `appState`? | `appState.get([key1, key2, ...])` 1 lần |
| Điều kiện chặn dùng ở ≥2 entry point, hoặc bản chất là chặn hẳn? | Block (`event/block.js`) |

## 7. Bên trong Workflow — chỉ chuẩn bị và điều phối

### 7.1 Workflow không tự thi hành (Giang chốt 07/10/2026 — "tính hết")

Workflow chỉ làm 2 việc:

- **Chuẩn bị:** đọc `appState`/`appConfig`/kho `audioAnalysis`, gọi `service/` (DB, blob URL…).
- **Điều phối:** chọn Core/Workflow để gọi, đăng ký/dừng task `taskManager`, ghi state, gửi `eventBus`.

Mọi việc **thi hành** đều thuộc Core — Workflow tự làm là vi phạm (FAIL trong
[sổ vi phạm](./core-legacy-audit.md)), kể cả phép nhỏ và kể cả hot path visualizer:

| Việc | Ví dụ bị tính |
|---|---|
| Thao tác DOM | `el.style.x =`, `classList`, `textContent`, `innerHTML`, `appendChild`, `querySelector` để sửa |
| Dựng template HTML | Chuỗi markup trong Workflow |
| Gắn sự kiện | `addEventListener`, `.onX =` |
| Điều khiển media | `.play()`, `.pause()`, `.currentTime =`, `.src =` trên `audio`/`video` |
| Vẽ canvas | `ctx.fillRect`, `ctx.drawImage`… |
| Tính toán | `Math.*`, clamp, regex, `.reduce()`, chuẩn hoá, nội suy… |

Hướng sửa: gom thành **Core thuần trả về nhiều kết quả một lần** (1 object kết quả chứa mọi giá trị bước sau cần),
Workflow chỉ nhận rồi phân phát — tránh tách thành hàng chục core lẻ mỗi core 1 phép.

### 7.2 Rẽ nhánh — guard clause + object map

Workflow là tầng ĐIỀU PHỐI nên **được dùng object map** để chọn hàm (khác Core — Rule 1 CẤM object map/VMState chọn
tiến trình trong core). **Mọi rẽ nhánh nghiệp vụ trong Workflow viết bằng object map** (hoặc `VirtualMachineState`,
mục 7a) — không `if/else`, `else if`, `switch`, hay toán tử 3 ngôi chọn giữa 2 lời gọi hàm.

**Chấm theo NỘI DUNG nhánh, không xét điều kiện** (giống Rule 1 của Core). Phạm vi: mọi method trong
`event/workflow/*.js`, cả hot path. Code cũ chưa sửa vẫn là vi phạm (có trong sổ) — Rule 0.5 chỉ quyết định *khi nào*
sửa. Router (`switch (msg.type)` ở mục 3, `VirtualMachineState` ở mục 4C) KHÔNG đổi.

| Dạng | Chấm / viết thế nào |
|---|---|
| **Guard clause** — thoát sớm khi chưa đủ điều kiện: `if (!x) return;`, `continue`/`break`, `return false` của hàm vị từ | Giữ `if` — PASS |
| **Guard kèm báo lỗi** — chỉ `alertModal(...)`/thông báo rồi `return` | PASS |
| **Guard kèm việc khác** — dọn/huỷ/đổi state, hoặc chuyển tiến trình (`back()`, `goToNextTrack()`, `_abortSeekGate()`…) rồi `return` | FAIL — đó là 2 tiến trình, viết object map |
| **Switch A/B trên cùng 1 đối tượng** — play/pause, mở/đóng, hiện/ẩn, bật/tắt task, chọn/bỏ chọn, nạp/gỡ nền | 1 nghiệp vụ — PASS (Giang chốt 07/10/2026) |
| **Bước tuỳ chọn** — `if (flag) doStep();` (bật/tắt 1 bước, không có nhánh thay thế) | 1 nghiệp vụ — PASS (Giang chốt 07/10/2026). Tách method mở đầu bằng guard vẫn là cách viết tốt khi bước dài |
| **Mọi nhánh ghi ĐÚNG cùng tập vị trí, chỉ khác giá trị** | PASS — đó là chọn giá trị. Lệch 1 vị trí là FAIL |
| **Chọn GIÁ TRỊ dữ liệu**: `isVideo ? bgVideoElement : audioPlayer`, `MAP[key] \|\| MAP.fallback` | PASS — không rẽ tiến trình |
| **≥2 tiến trình khác nhau** theo 1 giá trị rời rạc (type/style/mode/tên/boolean...) — chọn hình vẽ, chọn luật tính, migrate dữ liệu… | Object map: `const X_BY_Y = { a: (...) => ..., b: (...) => ... }; X_BY_Y[key](...)` |
| **Điều kiện là PHÉP TÍNH** (ngưỡng năng lượng, xác suất, cửa sổ flux...) | Phép tính vào Core thuần trả giá trị/boolean (mục 7.1); Workflow dùng kết quả qua guard hoặc object map |

Quy ước viết object map:
- Đặt ở cấp module (`const` UPPER_SNAKE, đuôi `_BY_<KHOÁ>`), giá trị là arrow function gọi method/Core — nạp file
  không chạy gì, chỉ tra lúc chạy.
- Khoá boolean dùng thẳng giá trị boolean (JS tự đổi thành `'true'`/`'false'`) — biến khoá PHẢI là boolean thật.
- Khoá có thể không có trong bảng: guard `const fn = MAP[key]; if (!fn) return;`, hoặc
  `(MAP[key] || MAP.fallback)(...)`.
- Không dùng `VirtualMachineState.run()` trong hot path: mỗi lần gọi cấp phát mảng rule + closure mới, và
  `console.warn` mỗi khi không rule nào khớp.

Ví dụ thật — `event/workflow/audio-analysis.js`:

```js
// Tiến trình số liệu theo pha phát — object map, khoá do core thuần resolveAnalysisPlaybackPhase() trả
const AUDIO_STATS_BY_PHASE = {
    playing: (frame) => workflowAudioAnalysis._analyzePlayingStats(frame),
    held: () => workflowAudioAnalysis._breakTimeline(),
    stopped: () => workflowAudioAnalysis._stopPlayingStats(),
};
AUDIO_STATS_BY_PHASE[phase]({ nowPerf, onset });

// Điều kiện là phép tính — nằm trong Core thuần (core/audio-analysis.js)
const isBeat = isSpectralFluxBeat(d.flux, computeArrayMean(d.fluxHistory), frame.nowPerf, d.lastBeatTime, APP_CONFIG.bpmMinWaitTime);
```

(Chính file này vẫn còn vài phép `Math.*` lẻ — đã ghi trong sổ, mục "Workflow tự tính toán".)

### 7a. VirtualMachineState cho rẽ nhánh THEO TRẠNG THÁI ngoài hot path (28/09/2026, Giang chốt: auto-switch)

Ngoài hot path, rẽ nhánh **theo trạng thái** (chế độ player, màn đang hiện, pha đồng hồ...) trong Workflow **được viết
bằng `VirtualMachineState.run()`** — tương đương object map (vẫn là bảng rule, không `if/else`). Quy ước:
- Khai báo ĐỦ mọi giá trị trạng thái; trường hợp "không làm gì" có rule no-op có chủ đích (cùng khuôn
  `event/router/gameplay.js`).
- Cần giá trị trả về: callback gán vào biến cục bộ khai báo ngay trước `run()` (vd `_pickNextStyle()`), hoặc dùng
  `runAsync()` khi cần chờ.
- Điều kiện nhiều vế gộp thành 1 giá trị trạng thái bằng Core thuần trước (vd `resolveAutoSwitchSyncPhase()` trả
  `'off' | 'start' | 'resume' | 'pause'`).
- Hot path (vòng vẽ/phân tích mỗi frame) CHỈ object map + guard.
- VMState/object map **chỉ ở Workflow/Router** — dùng trong Core là rẽ nhánh (Rule 1).

Ví dụ thật — `event/workflow/auto-switch-visual.js::syncPlayState()`:

```js
const phase = resolveAutoSwitchSyncPhase(isFixedActive, !!taskManager.plan[AUTO_SWITCH_VISUAL_TASK_TIMER], this._isRunAllowed()); // core thuần
VirtualMachineState.run([
    { state: phase, operation: '===', value: 'off',    callback: () => this.killAllTasks() },
    { state: phase, operation: '===', value: 'start',  callback: () => this.startBranch() },
    { state: phase, operation: '===', value: 'resume', callback: () => taskManager.resume(AUTO_SWITCH_VISUAL_TASK_TIMER) },
    { state: phase, operation: '===', value: 'pause',  callback: () => taskManager.pause(AUTO_SWITCH_VISUAL_TASK_TIMER) },
]);
```

### 7b. Visualizer — áp mục 7 thế nào

- Style → hàm vẽ: registry `styles` của từng group (`event/workflow/visualizer/<group>.js`), host tra 1 lần/frame.
- Toggle Custom Effect (bật/tắt 1 lớp vẽ): method riêng mở đầu bằng guard (`_paintClockGlass()`, `_paintGlassCity()`...).
- Kết quả trạng thái của Core (`'destroy'/'arrive'`, `'split'/'alive'/'dead'`): object map theo kết quả
  (`CIRCUIT_SIGNAL_BY_RESULT`, `FIREWORKS_PARTICLE_BY_STATUS`).
- Điều kiện nhiều vế dùng chung nhiều nơi → Core (`shouldFireTonotopicNode()`, `isPitchNoteFresh()`,
  `computeFrameDeltaMs()`). Giữ đúng thứ tự tiêu thụ `Math.random()` (short-circuit) khi chuyển.
- Lệnh vẽ canvas và phép tính trong workflow group là vi phạm mục 7.1 — hướng sửa: core vẽ/tính của group nhận
  frame + config, trả kết quả gộp.

← [Quay lại README](../README.md)
