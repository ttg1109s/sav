# Quy tắc viết function Core / nghiệp vụ — từ ver 12 trở đi

> **Áp dụng cho function MỚI viết hoặc được SỬA kể từ ver 12** — **[Đã chốt]** core di sản (~110
> file hiện có, phần lớn đang tự `appState.get()` trực tiếp, đúng theo quy ước cũ ở
> `service/state.js`) **giữ nguyên, KHÔNG rewrite/audit hồi tố**. Chỉ code mới viết hoặc bị đụng
> tới (sửa thật, không phải chỉ đọc lướt qua) từ ver 12 trở đi mới bắt buộc theo 5 rule dưới đây —
> **BAO GỒM hàm dựng UI (modal/drawer/toolbar)**, xem Rule 5 — KHÔNG có ngoại lệ "core UI thuần"
> nào đứng ngoài phạm vi 5 rule này.

Đọc cùng [event-bus-flow.md](./event-bus-flow.md) — tài liệu đó quy định luồng
`listener → router → core/workflow/VirtualMachineState`; tài liệu NÀY quy định riêng bên TRONG 1
function Core/nghiệp vụ được viết ra sao. Xem [core-legacy-audit.md](./core-legacy-audit.md) —
danh sách **nợ kỹ thuật chính thức**: function core di sản đang vi phạm 5 rule dưới đây (không bắt
buộc sửa ngay, chỉ bắt buộc khi function đó bị đụng tới thật — xem đầu file đó).

---

## Rule 1 — Đơn tuyến nghiệp vụ: 1 function core = đúng 1 chức năng

**Cấm:** `if/else`, `switch/case`, object-map chọn hàm — khi mục đích là chọn giữa **≥2 tiến
trình/logic nghiệp vụ khác nhau trong cùng 1 function**. Quy tắc này KHÔNG phân biệt điều kiện rẽ
nhánh lấy từ đâu (`appState`, tham số truyền vào, hay bất kỳ nguồn nào khác) — hễ nhánh đó tạo ra
1 tiến trình/logic KHÁC, vi phạm bất kể nguồn điều kiện là gì. Việc "chọn tiến trình nào chạy" không
còn là việc của 1 function core duy nhất — tách thành nhiều function đơn tuyến, để nơi gọi (Router/
`VirtualMachineState` nếu rẽ theo state — xem [event-bus-flow.md mục 4C](./event-bus-flow.md); hay
đơn giản là nơi gọi tự chọn đúng hàm nếu rẽ theo tham số) quyết định gọi hàm nào.

**KHÔNG bị cấm:** guard clause thuần (validate tham số đầu vào, early-return khi giá trị không
hợp lệ) — đó không phải "tiến trình khác nhau", chỉ là điều kiện tiên quyết để chạy ĐÚNG 1 tiến
trình duy nhất của hàm.

**Phép thử nhanh — xoá điều kiện `if` đó đi, hàm còn lại thế nào?**
- Vẫn còn nguyên ĐÚNG 1 kịch bản, chỉ mất phần "dừng sớm nếu chưa đủ điều kiện" → **guard clause,
  được phép.**
- Code không còn ý nghĩa, vì đang mô tả ≥2 kịch bản nghiệp vụ khác hẳn nhau (không phải 1 kịch
  bản có lối thoát sớm) → **rẽ nhánh tiến trình, KHÔNG được phép**, dù điều kiện đó lấy từ
  `appState`, tham số, hay bất cứ đâu.

```js
// ĐƯỢC — guard clause thuần, chỉ 1 tiến trình duy nhất khi hợp lệ
function applyVisualType(type) {
    const idx = MODES.indexOf(type);
    if (idx === -1) return; // chưa đủ điều kiện -> dừng, KHÔNG phải "tiến trình khác"
    appState.set('currentModeIndex', idx);
    updateTypeUI();
}
```

```js
// SAI — rẽ nhánh theo appState tạo ra 2 TIẾN TRÌNH khác nhau (khoá / áp dụng)
function applyVisualType(type) {
    if (appState.get('vizConfig').autoSwitchVisualEnabled) {
        return; // tiến trình 1: bị khoá
    }
    // tiến trình 2: áp dụng type mới
    const idx = MODES.indexOf(type);
    if (idx === -1) return;
    appState.set('currentModeIndex', idx);
    updateTypeUI();
}
```
Sửa đúng: bỏ hẳn nhánh `autoSwitchVisualEnabled` khỏi function (nó vi phạm luôn Rule 2 — đọc
`appState` trực tiếp) — hàm chỉ còn ĐÚNG 1 tiến trình như ví dụ "ĐƯỢC" ở trên; việc quyết định có
gọi hàm hay không (khi đang khoá) chuyển ra Router/`VirtualMachineState`.

```js
// SAI — rẽ nhánh theo THAM SỐ (không đụng appState), vẫn tạo ra 2 TIẾN TRÌNH khác nhau -> vẫn vi phạm
function handleUpload(file, isVideo) {
    if (isVideo) {
        // tiến trình 1: xử lý video
        validateVideoFile(file);
        setMeta('videoBg', file);
    } else {
        // tiến trình 2: xử lý ảnh — KHÁC HẲN tiến trình 1, không phải cùng 1 kịch bản có lối thoát sớm
        validateImageFile(file);
        setMeta('imageBg', file);
    }
}
```
Sửa đúng: tách `handleVideoUpload(file)` và `handleImageUpload(file)` riêng, để nơi gọi (router/
workflow) tự chọn gọi hàm nào — bất kể `isVideo` tới từ đâu (tham số, tên field input, hay gì
khác), việc chọn hàm không thuộc về bên trong 1 function core.

## Rule 2 — Chỉ nhận tham số, không tự đọc `appState` — chỉ được GHI qua `set()`/`mutate()`

Function nghiệp vụ **KHÔNG được gọi `appState.get()`** trong thân hàm. Mọi dữ liệu cần dùng phải
được truyền vào qua tham số — nơi GỌI (router, callback trong `VirtualMachineState`, hoặc 1
function core khác) chịu trách nhiệm `appState.get()` trước, rồi truyền giá trị vào.

**ĐƯỢC PHÉP:**
- `appState.set(...)` / `appState.mutate(...)` — chỉ chặn chiều ĐỌC, không chặn chiều GHI (hàm
  vẫn tạo side-effect ra ngoài bình thường, chỉ không được tự ý ĐỌC state để quyết định hành vi).
  **Phải kèm `console.log` ngay dưới — xem Rule 4 dưới đây.**
- Biến nội bộ (`let`/`const` khai báo trong scope hàm) tự do, không giới hạn.

```js
// SAI — tự appState.get() bên trong
function saveConfig() {
    const cfg = appState.get('vizConfig');
    localforage.setItem('vizConfig', cfg);
}
```
```js
// ĐÚNG — nhận cfg qua tham số, nơi gọi tự appState.get('vizConfig') trước khi gọi hàm này
function saveConfig(cfg) {
    localforage.setItem('vizConfig', cfg);
}
```

## Rule 3 — Core CẤM TUYỆT ĐỐI gọi Core khác — CHỈ được gọi API `service/` (data layer + set/mutate)

**VIẾT LẠI TOÀN BỘ (04/07/2026, phản hồi Giang) — HUỶ BỎ ngoại lệ "return value" và ngoại lệ "bất
đồng bộ không chờ" từng có ở bản Rule 3 trước đây.** Chính sách MỚI, đơn giản hơn hẳn, không còn
trường hợp nào cần cân nhắc:

**1 function core TUYỆT ĐỐI KHÔNG được gọi bất kỳ function core/nghiệp vụ nào khác** — dù hàm kia
có return value hay không, dù A có dùng giá trị trả về hay không, dù gọi đồng bộ hay bất đồng bộ,
dù có `await` hay không. Không còn tiêu chí nào để "hợp lệ hoá" 1 lời gọi core→core nữa — **mọi
lời gọi core→core, bất kể hình dạng gì, đều phải chuyển ra Workflow.**

**NGOẠI LỆ DUY NHẤT — gọi API `service/` (hạ tầng, KHÔNG tính là "gọi hàm core khác"):**
- `service/db.js` — mọi hàm data layer (`getMeta`/`setMeta`/`getSongRecord`/`getAlbumRecord`/
  `getImageRecord`/`slugify`...).
- `appState.set(key, value)` / `appState.mutate(key, fn)` — **chỉ 2 hàm GHI này**, kèm
  `console.log` theo Rule 4 như cũ.
- **KHÔNG bao gồm** `appState.get()` (vẫn cấm theo Rule 2, không đổi) và **KHÔNG bao gồm
  `taskManager`** (xem lý do ngay dưới) — 2 thứ này KHÔNG nằm trong danh sách ngoại lệ.

Lý do tách riêng nhóm này: `service/db.js`/`appState.set`/`mutate` là **dịch vụ hạ tầng phục vụ
nghiệp vụ của core** (lưu trữ, ghi state) — bản thân chúng không chứa quyết định nghiệp vụ nào,
chỉ là công cụ core dùng để hoàn thành nghiệp vụ CỦA CHÍNH NÓ. Khác hẳn việc gọi 1 function core
KHÁC — nơi quyết định/nghiệp vụ nằm Ở BÊN TRONG hàm được gọi, không phải bên trong A.

**`taskManager` CẤM HOÀN TOÀN trong core — CHỈ Workflow được dùng.** Trước đây core được phép dùng
`taskManager.once()` cho lời gọi "bất đồng bộ không chờ" (ví dụ `beginSlideshowTransition()` cũ) —
NGOẠI LỆ NÀY ĐÃ BỎ. Timer/interval/timeout là công cụ ĐIỀU PHỐI (orchestration) — đúng vai trò
Workflow, không phải core thuần.

### Hệ quả — Workflow giờ PHẢI làm nhiều việc hơn: chuẩn bị data + gọi core + (nếu cần) lặp qua taskManager

Vì core không còn được tự gọi core khác hay tự đọc `appState`, **Workflow trở thành nơi DUY NHẤT
điều phối**:
1. **Chuẩn bị đầy đủ data mà core cần** trước khi gọi — nếu cần nhiều field `appState`, dùng
   `appState.get([keyA, keyB, ...])` (dạng ARRAY MỚI, xem `service/state.js`) thay vì gọi
   `appState.get()` nhiều lần rời rạc.
2. **Nếu core B cần kết quả của core A** — Workflow tự gọi A trước, lấy kết quả, rồi truyền vào
   làm tham số khi gọi B. Workflow đứng NGOÀI, gọi CẢ HAI, KHÔNG để A gọi B nội bộ.
3. **Nếu cần lặp lại (task lặp, ví dụ slideshow/auto-switch-visual)** — Workflow tự đăng ký qua
   `taskManager`, bên trong callback của task đó Workflow (không phải core) tự đọc `appState` +
   gọi các hàm core cần thiết theo đúng thứ tự, TỪNG hàm core gọi riêng lẻ từ Workflow — xem ví dụ
   dưới.

```js
// SAI — core tự gọi core khác (dù dùng return value) VÀ tự dùng taskManager
function beginTransition(outEl, inEl, durationMs) {
    inEl.classList.add('enter');
    taskManager.once(() => {           // SAI — taskManager cấm trong core
        setImage(outEl, '');           // SAI — core gọi core khác
        finishTransition(outEl, inEl); // SAI — core gọi core khác
    }, durationMs, 'cleanup');
}
```
```js
// ĐÚNG — 3 hàm core ĐỘC LẬP, không hàm nào gọi hàm kia; Workflow tự taskManager + tự gọi từng hàm
// core/....js (core thuần, KHÔNG hàm nào gọi hàm còn lại)
function startTransitionVisuals(outEl, inEl) { inEl.classList.add('enter'); }
function setImage(el, url) { el.style.backgroundImage = url ? `url(${url})` : ''; }
function finishTransitionVisuals(outEl, inEl) { /* dọn class, KHÔNG gọi setImage() ở đây */ }

// event/workflow/....js (Workflow — điều phối, ĐƯỢC dùng taskManager + appState.get())
startTransitionVisuals(outEl, inEl); // core
taskManager.once(() => {
    setImage(outEl, '');               // core — Workflow tự gọi, KHÔNG để core khác gọi hộ
    finishTransitionVisuals(outEl, inEl); // core
}, durationMs, 'cleanup');
```

**Bỏ hẳn yêu cầu `console.log("... callTo: ...")` cho core-gọi-core** (không còn trường hợp hợp lệ
nào để log) — Rule 4 (`console.log("writer: ...")` cho `set()`/`mutate()`) giữ NGUYÊN, không đổi.


---

## Rule 4 — `appState.set()`/`mutate()` PHẢI có `console.log` ngay dưới

Mọi lời gọi `appState.set(...)` hoặc `appState.mutate(...)` trong 1 function core phải có
`console.log` NGAY DƯỚI dòng gọi, đúng format:
```js
console.log(`writer: "<tên function>", page: "<state key>", content: "<value hoặc mô tả ngắn>"`);
```
- `writer` — tên function đang ghi state (giống `sender` ở Rule 3, đặt tên khác để phân biệt 2
  loại log: Rule 3 log LỜI GỌI, Rule 4 log GHI STATE).
- `page` — đúng tên key `appState` bị ghi (vd `'currentModeIndex'`, `'vizConfig'`).
- `content` — với `set()`: giá trị mới được ghi; với `mutate()` (không có 1 "giá trị" đơn lẻ vì
  thao tác in-place lên collection): mô tả ngắn thao tác vừa làm (vd `"push filter mới vào
  eqBandNodes"`).

```js
function applyModeChange(idx) {
    appState.set('currentModeIndex', idx);
    console.log(`writer: "applyModeChange", page: "currentModeIndex", content: "${idx}"`);
}
```
```js
function addEqFilter(filter) {
    appState.mutate('eqBandNodes', arr => arr.push(filter));
    console.log(`writer: "addEqFilter", page: "eqBandNodes", content: "push filter mới vào mảng"`);
}
```

**Ngoại lệ bắt buộc — KHÔNG log trong hot path 60fps** (giống hệt lý do ở Rule 3): vòng vẽ
visualizer (`core/visualizer/draw-visualizer.js`) gọi `appState.set(..., { skipCheck: true })`
rất nhiều lần MỖI FRAME (`frameCounter`, `beatScale`, `smoothedEnergy`, `globalHueOffset`...) —
log từng lần sẽ spam console/tốn hiệu năng thật, KHÔNG áp dụng Rule 4 cho các lời gọi này.

## Rule 5 — Hàm dựng UI VẪN là hàm nghiệp vụ; `addEventListener` được phép NHƯNG phải gom cuối hàm; KHÔNG dùng DOM để rẽ nhánh

**[MỚI, 10/07/2026, phản hồi Giang]** Một số file trước đây (`core/file-manager/photo-ui.js`,
`core/file-manager/folder-picker-ui.js`, bản đầu `core/file-manager/document-ui.js`) tự ghi trong
docstring "hàm dựng UI thuần, không thuộc phạm vi 4 rule core-function-conventions.md" —
**TUYÊN BỐ NÀY KHÔNG CÓ CĂN CỨ trong tài liệu này, SAI, cần sửa khi file đó bị đụng tới lại (đúng
tinh thần nợ kỹ thuật — xem [core-legacy-audit.md](./core-legacy-audit.md)).** KHÔNG có khái niệm
"core UI thuần đứng ngoài rule" — dựng DOM/modal/drawer VẪN là 1 nhiệm vụ nghiệp vụ, chịu ĐẦY ĐỦ
Rule 1-4 ở trên, CỘNG THÊM 2 rule riêng dưới đây (đặc thù cho việc dựng UI có tương tác — Rule 1-4
gốc không lường tới DOM).

### 5a — `addEventListener`: cấm rải rác; cho phép NẾU dựng UI động — nhưng PHẢI gom cuối hàm

Core nói chung KHÔNG được tự `addEventListener` — đúng tinh thần "core không tự quyết định điều gì
xảy ra khi người dùng tương tác", việc đó thuộc Router/Workflow (xem
[event-bus-flow.md](./event-bus-flow.md)).

**Ngoại lệ:** hàm dựng ra 1 cụm DOM MỚI (modal/drawer/toolbar tự tạo bằng `createElement`, KHÔNG
phải phần tử tĩnh có sẵn từ `core/dom-refs.js`) — phần tử đó KHÔNG TỒN TẠI trước khi hàm chạy, nên
KHÔNG THỂ wire qua `event/listener/*.js` (không có gì để `document.getElementById` trước đó).
Trường hợp NÀY được phép `addEventListener` ngay trong hàm dựng UI, với 2 điều kiện BẮT BUỘC ĐỦ CẢ:

1. **Callback CHỈ được gọi tham số nhận từ nơi gọi** (đúng khuôn `modalChoice()` —
   `btnDef.onClick()`) — **TUYỆT ĐỐI KHÔNG gọi thẳng tên 1 hàm core/nghiệp vụ khác bên trong
   callback**, vẫn là Rule 3, KHÔNG có ngoại lệ thêm ở đây chỉ vì nằm trong `addEventListener`.
2. **Toàn bộ `addEventListener` phải gom lại 1 khối, đặt Ở CUỐI hàm** (sau khi cây DOM đã dựng
   xong hoàn toàn) — KHÔNG xen kẽ giữa các đoạn `createElement`/`appendChild`, để chỉ cần nhìn
   xuống cuối hàm là thấy NGAY toàn bộ hành vi tương tác, không phải dò từng dòng.

```js
// SAI — addEventListener xen kẽ rải rác giữa các đoạn dựng DOM
function buildXModal(data, onSave) {
    const overlay = document.createElement('div');
    const saveBtn = document.createElement('button');
    saveBtn.addEventListener('click', () => onSave(saveBtn.value)); // rải giữa chừng — khó rà soát
    overlay.appendChild(saveBtn);
    const cancelBtn = document.createElement('button');
    cancelBtn.addEventListener('click', () => overlay.remove()); // lại 1 chỗ khác nữa
    overlay.appendChild(cancelBtn);
    return overlay;
}
```
```js
// ĐÚNG — dựng DOM xong hoàn toàn TRƯỚC, addEventListener gom 1 khối Ở CUỐI
function buildXModal(data, onSave) {
    const overlay = document.createElement('div');
    const saveBtn = document.createElement('button');
    const cancelBtn = document.createElement('button');
    overlay.appendChild(saveBtn);
    overlay.appendChild(cancelBtn);

    // --- addEventListener: gom cuối hàm (Rule 5a) ---
    saveBtn.addEventListener('click', () => onSave(saveBtn.value)); // CHỈ gọi tham số, không gọi core khác
    cancelBtn.addEventListener('click', () => overlay.remove());

    return overlay;
}
```

### 5b — KHÔNG dùng trạng thái DOM làm điều kiện rẽ nhánh nghiệp vụ (lách Rule 1)

Rule 1 đã nói "không phân biệt điều kiện rẽ nhánh lấy từ đâu" — nhắc lại RÕ ở đây vì đây là lối
lách MỚI phát sinh khi core được phép đụng DOM (Rule 5a): **`classList.contains(...)`,
`dataset.xxx`, `querySelector(...)` có tồn tại hay không, `getComputedStyle(...)`... là 1 dạng
STATE giống hệt `appState` — dùng chúng làm điều kiện `if/else` để chọn giữa ≥2 tiến trình nghiệp
vụ khác nhau VẪN VI PHẠM Rule 1**, dù không hề đụng `appState.get()` nào (Rule 2 KHÔNG bắt được lỗi
này qua grep vì không có `appState.get(` để tìm — PHẢI tự rà bằng mắt).

```js
// SAI — dùng DOM (classList) làm điều kiện rẽ nhánh 2 tiến trình khác nhau — lách Rule 1
function toggleXPanel(panelEl) {
    if (panelEl.classList.contains('hidden')) {
        panelEl.classList.remove('hidden'); // tiến trình 1: mở
        panelEl.focus();
    } else {
        panelEl.classList.add('hidden'); // tiến trình 2: đóng — KHÁC HẲN tiến trình 1
    }
}
```
Sửa đúng: tách `openXPanel(panelEl)`/`closeXPanel(panelEl)` riêng, để nơi gọi (Workflow) tự đọc
`classList.contains(...)` RỒI chọn gọi đúng hàm — cùng khuôn "rẽ nhánh theo tham số" ở Rule 1, chỉ
khác nguồn đọc là DOM thay vì `appState`.

### 5c — File core chuyên dựng UI PHẢI có hậu tố `-ui` trong TÊN FILE

**[MỚI, 10/07/2026]** Core file mà TOÀN BỘ (hoặc phần lớn) hàm bên trong là hàm dựng UI theo nghĩa
Rule 5a (tạo cụm DOM MỚI bằng `createElement`, KHÔNG phải chỉ đọc/ghi `classList`/`style` lên phần
tử TĨNH có sẵn từ `core/dom-refs.js`) **PHẢI đặt tên file kết thúc bằng `-ui.js`** — vd
`document-ui.js`, `photo-ui.js`, `folder-picker-ui.js`, `folder-list-ui.js`, `folder-detail-ui.js`.
Mục đích: nhìn TÊN FILE là biết ngay Rule 5a/5b áp dụng cho file đó, không cần mở ra đọc mới biết.

**KHÔNG đặt hậu tố `-ui`** cho file chỉ thao tác trên DOM TĨNH có sẵn (đọc/ghi `classList`/`style`/
`innerHTML` của phần tử ĐÃ TỒN TẠI SẴN từ `core/dom-refs.js`, KHÔNG tự `createElement` cụm DOM mới)
— ví dụ `core/generic-drawer.js` (chỉ gán `innerHTML`/`style` lên `genericDrawerPanel` đã có sẵn,
không tự tạo phần tử mới) KHÔNG cần hậu tố này.

**Nếu 1 file VỪA có hàm nghiệp vụ thuần VỪA có hàm dựng UI (trộn lẫn)** — tách thành 2 file riêng
(1 file thường + 1 file `-ui.js`), KHÔNG giữ chung 1 file không có hậu tố mà bên trong lại có hàm
`createElement` dựng modal/drawer.

> **Ghi nhận nợ kỹ thuật phát hiện khi thêm rule này:** `core/modal-choice.js` tự `createElement`
> dựng modal (đúng định nghĩa Rule 5a) nhưng KHÔNG có hậu tố `-ui` trong tên — vi phạm Rule 5c.
> File này thuộc diện ngoại lệ đã audit ở Rule 5a/event-bus-flow.md (miễn `addEventListener`), NHƯNG
> đó là miễn Rule 5a, KHÔNG miễn Rule 5c (2 rule độc lập) — tên file vẫn sai quy ước. Theo Rule 0.5
> (`core-legacy-audit.md`): không bắt buộc đổi tên ngay, chỉ bắt buộc khi file đó bị đụng/sửa thật
> lần tới (đổi tên + cập nhật mọi nơi `<script src="core/modal-choice.js">` tham chiếu tới).

---

## Bảng tổng hợp

| Câu hỏi | Đúng luật ver 12 (cập nhật 04/07/2026) |
|---|---|
| Function có `if/else`/`switch` chọn giữa ≥2 TIẾN TRÌNH/logic nghiệp vụ khác nhau (bất kể điều kiện lấy từ `appState`, tham số, hay đâu khác)? | **KHÔNG được** — tách thành nhiều function đơn tuyến, để nơi gọi chọn |
| Function có guard clause thuần (validate, early-return, vẫn chỉ 1 tiến trình)? | **ĐƯỢC** — không phải Rule 1 |
| Function có tự `appState.get()` bên trong (kể cả dạng `get([...])` mới)? | **KHÔNG được** — nhận qua tham số |
| Function có tự `appState.set()`/`mutate()`? | **ĐƯỢC** — coi là API `service/`, không tính "gọi hàm core khác" |
| Function có tự gọi `service/db.js` (getMeta/setMeta/...)? | **ĐƯỢC** — cùng lý do trên |
| Function gọi 1 function core/nghiệp vụ KHÁC — bất kể có return value, có dùng giá trị đó, đồng bộ hay bất đồng bộ, có `await` hay không? | **CẤM TUYỆT ĐỐI** — mọi hình dạng đều chuyển ra Workflow, không còn ngoại lệ nào |
| Function core có `taskManager` (once/addNew/...)? | **CẤM TUYỆT ĐỐI** — `taskManager` CHỈ dùng ở Workflow |
| Function có `appState.set()`/`mutate()`? | Bắt buộc `console.log` `writer/page/content` ngay dưới, TRỪ hot path 60fps |
| Function dựng UI (modal/drawer/toolbar) có được coi là "core UI thuần, ngoài phạm vi rule"? | **KHÔNG** — dựng UI VẪN là hàm nghiệp vụ, chịu ĐẦY ĐỦ Rule 1-4 + Rule 5 (xem Rule 5) |
| Function có `addEventListener`? | **CẤM**, TRỪ hàm dựng ra cụm DOM MỚI (không tĩnh) — khi đó ĐƯỢC, nhưng callback chỉ gọi tham số (không gọi core khác) VÀ phải gom hết ở CUỐI hàm (Rule 5a) |
| Function dùng `classList`/`dataset`/`querySelector(...)` tồn tại hay không làm điều kiện chọn giữa ≥2 tiến trình khác nhau? | **KHÔNG được** — cùng vi phạm Rule 1, chỉ khác nguồn đọc là DOM thay vì `appState` (Rule 5b) |
| File core có hàm tự `createElement` dựng cụm DOM mới (modal/drawer/toolbar) — tên file cần gì? | **PHẢI kết thúc bằng `-ui.js`** (vd `document-ui.js`) — file chỉ thao tác DOM tĩnh có sẵn (`dom-refs.js`) thì KHÔNG cần (Rule 5c) |

← [Quay lại README](../README.md)
