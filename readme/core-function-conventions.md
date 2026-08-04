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

**Nguyên lý gốc (xem thêm Rule 3b):** Core là tầng THI HÀNH, không phải tầng CHUẨN BỊ — nó không tự
đi lấy/tạo cái mình cần dưới bất kỳ hình thức nào, mọi thứ cần đã phải có sẵn trong tham số. Rule
này áp dụng nguyên lý đó riêng cho `appState`.

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
trường hợp nào cần cân nhắc. **[CẤU TRÚC LẠI THÀNH 3a/3b/3c — 13/07/2026, phản hồi Giang]** —
KHÔNG đổi nội dung 3a/3b so với bản 04/07, CHỈ thêm 3c (hàm con phục vụ vòng lặp) là MỚI.

### 3a — Định nghĩa cứng: không thể gọi core trong core

**1 function core TUYỆT ĐỐI KHÔNG được gọi bất kỳ function core/nghiệp vụ nào khác** — dù hàm kia
có return value hay không, dù A có dùng giá trị trả về hay không, dù gọi đồng bộ hay bất đồng bộ,
dù có `await` hay không. Không còn tiêu chí nào để "hợp lệ hoá" 1 lời gọi core→core nữa — **mọi
lời gọi core→core, bất kể hình dạng gì, đều phải chuyển ra Workflow.**

### 3b — Nguyên lý: Core là tầng THI HÀNH, Workflow là tầng CHUẨN BỊ (viết lại 03/08/2026, phản hồi Giang)

**Core không có chức năng tự đi lấy/tạo cái mình cần dưới bất kỳ hình thức nào** — mọi input phải
đã có sẵn trong tham số, do Workflow chuẩn bị trước. Phép thử phân loại 1 lời gọi `service/`/
`appState`:

- **ĐỌC** (lấy về nguyên vẹn 1 giá trị để dùng/quyết định — dù nguồn là `appState`, DB, hay bất kỳ
  đâu) → CHUẨN BỊ, **cấm Core**, thuộc Workflow.
- **GHI/SỬA** (ghi đè lên state, hoặc sửa ngay tại chỗ lên chính cái vừa nhận — vd
  `instantiateComponent()` clone xong GHI ĐÈ slot, cùng bản chất `appState.mutate()`) → **Core được
  gọi**.
- **TẠO MỚI 1 tài nguyên/tham chiếu sống độc lập** (cần dọn sau — vd `createBlobUrl()`) → CHUẨN BỊ,
  **cấm Core**, thuộc Workflow. Việc DỌN tài nguyên đó lúc Core tự đóng vòng đời nó sở hữu
  (`revokeBlobUrl()`) vẫn được Core gọi — đó là dọn, không phải chuẩn bị.

Áp dụng NHẤT QUÁN mọi nguồn (appState/`service/db.js`/API trình duyệt...) và CẢ 2 loại core (thuần
lẫn `-ui.js`, Rule 5c) — không có ngoại lệ theo nguồn hay theo loại core.

**Danh sách cụ thể ĐƯỢC Core gọi (thuộc nhóm Ghi/Sửa):**
- `service/db.js` — CHỈ hàm ghi/xoá (`setMeta`/`setSongRecord`/`setImageRecord`/`setAlbumRecord`/
  `setDocumentRecord`/`setVideoRecord`/`setFolderRecord`/`setFolderSongMap`/`deleteXxxRecord`...).
  **CẤM** mọi hàm đọc (`getMeta`/`getSongRecord`/`getAlbumRecord`/`getImageRecord`/
  `getDocumentRecord`/`getVideoRecord`/`getFolderRecord`/`getFolderSongMap`/`getAll*Keys`...).
- `service/db.js::slugify(filename)` — sửa/biến đổi thẳng tham số nhận vào, không lấy thêm gì.
- `service/component-dynamic.js::instantiateComponent(html, slotMap)` — clone rồi GHI ĐÈ slot, cùng
  bản chất `mutate()`.
- `appState.set(key, value)` / `appState.mutate(key, fn)` — kèm `console.log` theo Rule 4.
- `service/blob-url.js::revokeBlobUrl(url)` — CHỈ hàm này, KHÔNG gồm `createBlobUrl()` (tạo mới tài
  nguyên → thuộc Workflow, truyền url xuống Core làm tham số).

> **Nợ kỹ thuật (phát hiện lúc siết rule):** nhiều file `core/` hiện có (`playlist/loader.js`,
> `player-controls.js`, `storage-manager.js`, `file-manager/*.js`...) đang gọi thẳng `get*`/
> `getAll*Keys` của `service/db.js` — vi phạm rule mới. Không bắt sửa ngay (Rule 0.5,
> `core-legacy-audit.md`), chỉ bắt buộc khi đụng lại file đó.

**KHÔNG bao gồm** `appState.get()` và **KHÔNG bao gồm `taskManager`** (xem lý do ngay dưới) — 2 thứ
này KHÔNG nằm trong danh sách được Core gọi.

**`taskManager` CẤM HOÀN TOÀN trong core — CHỈ Workflow được dùng.** Trước đây core được phép dùng
`taskManager.once()` cho lời gọi "bất đồng bộ không chờ" (ví dụ `beginSlideshowTransition()` cũ) —
NGOẠI LỆ NÀY ĐÃ BỎ. Timer/interval/timeout là công cụ ĐIỀU PHỐI (orchestration) — đúng vai trò
Workflow, không phải core thuần.

### 3c — Hàm con phục vụ vòng lặp (MỚI, 13/07/2026, phản hồi Giang)

**1 function core được phép tự chứa hàm con** (closure lồng bên trong, KHÔNG phải hàm top-level
riêng — xem ví dụ `sanitizeDocumentHtml()::walk()`, `core/file-manager/document.js`) khi TẤT CẢ
điều kiện sau đều đúng:

1. **Chỉ giới hạn cho việc loop** — bản thân hàm con có chứa vòng lặp/đệ quy (`for`/`while`/tự gọi
   lại chính nó) để hoàn thành việc của nó. KHÔNG bắt buộc core cha phải gọi hàm con đó nhiều lần —
   chỉ cần chính hàm con cần cấu trúc lặp là đủ điều kiện này.
2. **Không trùng lặp logic với bất kỳ core nào khác đã có trong app** — nếu logic giống hệt 1 core
   đã tồn tại, PHẢI tái dùng core đó qua Workflow (không viết lại).
3. **Phép thử "1 phần nghiệp vụ" hay "1 nghiệp vụ khác"** — gọi hàm con đó ĐỘC LẬP, tách khỏi core
   cha, kết quả trả về có phải 1 GIÁ TRỊ HOÀN CHỈNH, tự nó có Ý NGHĨA NGHIỆP VỤ RIÊNG hay không?
   - CÓ → đó là 1 nghiệp vụ KHÁC (dù nhỏ) → PHẢI tách hẳn core riêng/top-level, KHÔNG được làm hàm
     con — hàm con đó CHỈ được phép là 1 PHẦN của nghiệp vụ core cha, không phải 1 nghiệp vụ khác
     sau khi bản thân core cha đã hoàn thành.
   - KHÔNG (chỉ là 1 giá trị TRUNG GIAN, vô nghĩa nếu đứng 1 mình, phải có core cha xử lý tiếp mới
     thành kết quả thật) → hợp lệ làm hàm con.
4. **Hàm con đó PHẢI tuân đủ Rule 1-4 y hệt core chính** — đơn tuyến (Rule 1), không tự
   `appState.get()` (Rule 2), không gọi core/hàm con nào khác ngoài chính nó (Rule 3, đệ quy áp
   dụng), ghi state qua `set()`/`mutate()` phải kèm `console.log` (Rule 4).

Ví dụ hợp lệ: `sanitizeDocumentHtml()::walk()` (đệ quy) — `computeNextDocumentReaderSlot()::
sliceBlockByTextRange()`/`splitOversizedBlockToFit()`/`findWordBoundaryBefore()` (đều có vòng
lặp/đệ quy nội bộ, kết quả trả về là giá trị trung gian — vd `findWordBoundaryBefore()` chỉ trả 1
chỉ số, vô nghĩa nếu đứng riêng, phải phối hợp với `sliceBlockByTextRange()` mới thành 1 đoạn text
thật — xem `core/file-manager/document-pagination.js`).

### 3d — Wrapper cho API thư viện ngoài: hợp lệ có điều kiện, KHÔNG áp dụng được cho core khác (MỚI, 03/08/2026, phản hồi Giang)

Rule 3a/3b chỉ nói "core/nghiệp vụ của project" — KHÔNG cấm 1 function core gọi thẳng API 1 thư
viện NGOÀI project (CDN/vendor, vd Panzoom, Mediabunny). Nhưng đây KHÔNG PHẢI ngoại lệ MẶC ĐỊNH cho
mọi lời gọi thư viện — chỉ hợp lệ khi CẢ 2 đúng:

1. **Có lý do thật để cô lập thư viện** — dự tính CÓ THỂ đổi thư viện sau này mà không muốn mọi nơi
   gọi (Workflow) phải sửa theo — wrapper giữ NGUYÊN chữ ký hàm, chỉ viết lại THÂN khi đổi thư viện
   (xem `core/image-zoom.js`, đầu file).
2. **Được chỉ định/audit rõ trong docstring đầu file** (không suy diễn ngầm) — đúng tinh thần
   "Ngoại lệ ĐÃ audit chính thức" ở Rule 5a (`modalChoice()`) — không được tự nhận "giống file X đã
   có" để suy ra miễn trừ.

**KHÔNG áp dụng được lý do "cô lập thư viện" cho việc gọi 1 core KHÁC của project** — Rule 3a vẫn
CẤM TUYỆT ĐỐI, kể cả khi lời gọi đó núp dưới 1 hàm/file "trông như core" ở vị trí khác (Workflow,
`*-helpers.js`...). Đặt ở `event/workflow/` chỉ hợp lệ nếu hàm có ĐIỀU PHỐI/NGHIỆP VỤ THẬT (khuôn
`generic-drawer-helpers.js::closeFully()` — điều phối 2 lời gọi Core + đợi `transitionend`) — KHÔNG
hợp lệ nếu hàm CHỈ relay nguyên văn tham số sang 1 hàm khác (core hay thư viện ngoài) mà không thêm
quyết định/logic gì — đó là **hàm vô nghĩa**, PHẢI xoá, nơi cần gọi thẳng đích.

**Phép thử nhanh:** xoá hàm wrapper đi, thay mọi nơi gọi nó bằng gọi THẲNG hàm đích — hành vi có đổi
không?
- KHÔNG đổi (chỉ relay tham số 1:1) → **hàm vô nghĩa, xoá**.
- CÓ đổi (có logic/guard riêng, hoặc đích là thư viện ngoài ĐÃ audit theo mục 1-2 trên) → **hợp lệ,
  giữ**.

```js
// SAI — relay 1:1 sang core khác, "trông như Workflow" nhưng không điều phối gì
applySelect(session, ratio) {
    setCropSessionAspectRatio(session, ratio); // core/crop-selector.js — relay rỗng
},
```
```js
// ĐÚNG — có logic thật (guard clause + phép tính), không chỉ relay
applyFlip(session) {
    if (Number.isNaN(session.aspectRatio) || session.aspectRatio === 1) return;
    setCropSessionAspectRatio(session, 1 / session.aspectRatio); // core/crop-selector.js
},
```
```js
// ĐÚNG — wrapper thư viện ngoài ĐÃ audit (docstring nêu rõ lý do cô lập để sau này đổi thư viện)
function initPanzoomSession(el, options) {
    return Panzoom(el, options); // core/image-zoom.js, xem docstring đầu file
}
```
```js
// SAI — wrapper thư viện ngoài không có lý do/chưa audit, chỉ relay tiện tay
function playSound(src) {
    return Howler.play(src); // không có docstring nào nêu lý do cô lập
}
```

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

### 5a — `addEventListener`: cấm rải rác; cho phép NẾU dựng UI động — nhưng PHẢI gom cuối hàm VÀ callback CHỈ được bắn event bus

Core nói chung KHÔNG được tự `addEventListener` — đúng tinh thần "core không tự quyết định điều gì
xảy ra khi người dùng tương tác", việc đó thuộc Router/Workflow (xem
[event-bus-flow.md](./event-bus-flow.md)).

**Ngoại lệ:** hàm dựng ra 1 cụm DOM MỚI (modal/drawer/toolbar tự tạo bằng `createElement`, KHÔNG
phải phần tử tĩnh có sẵn từ `core/dom-refs.js`) — phần tử đó KHÔNG TỒN TẠI trước khi hàm chạy, nên
KHÔNG THỂ wire qua `event/listener/*.js` (không có gì để `document.getElementById` trước đó).
Trường hợp NÀY được phép `addEventListener` ngay trong hàm dựng UI, với 2 điều kiện BẮT BUỘC ĐỦ CẢ:

1. **[SỬA 13/07/2026, phản hồi Giang] Callback CHỈ được phép làm đúng 1 việc: gọi
   `eventBus.send({router, type, payload})`** — KHÔNG còn được phép "chỉ gọi tham số nhận từ nơi
   gọi" như bản trước (đó là khuôn CŨ của `modalChoice()`, giờ CHỈ còn là ngoại lệ đã audit riêng,
   xem cuối mục này). Không phân biệt DOM TĨNH (đăng ký trước lúc boot qua `event/listener/*.js`)
   hay DOM ĐỘNG (đăng ký ngay trong hàm dựng UI, đúng mục 5a này) — 2 kiểu chỉ khác THỜI ĐIỂM đăng
   ký trong bộ nhớ lúc khởi tạo, KHÔNG ảnh hưởng gì tới NỘI DUNG callback bên trong — không thể
   biện minh sự khác biệt tĩnh/động để né quy tắc. Callback gọi thẳng tên 1 hàm core/Workflow khác
   (kể cả qua tham số callback được truyền vào) đều là vi phạm Rule 3, KHÔNG có ngoại lệ thêm ở đây
   chỉ vì nằm trong `addEventListener`.
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
// SAI — gom cuối hàm ĐÚNG, nhưng callback gọi tham số thay vì bắn event bus (vi phạm điều kiện 1 MỚI)
function buildXModal(data, onSave) {
    const overlay = document.createElement('div');
    const saveBtn = document.createElement('button');
    const cancelBtn = document.createElement('button');
    overlay.appendChild(saveBtn);
    overlay.appendChild(cancelBtn);

    saveBtn.addEventListener('click', () => onSave(saveBtn.value)); // SAI — không qua eventBus
    cancelBtn.addEventListener('click', () => overlay.remove());

    return overlay;
}
```
```js
// ĐÚNG — dựng DOM xong hoàn toàn TRƯỚC, addEventListener gom 1 khối Ở CUỐI, callback CHỈ bắn eventBus
function buildXModal(data) {
    const overlay = document.createElement('div');
    const saveBtn = document.createElement('button');
    const cancelBtn = document.createElement('button');
    overlay.appendChild(saveBtn);
    overlay.appendChild(cancelBtn);

    // --- addEventListener: gom cuối hàm (Rule 5a) ---
    saveBtn.addEventListener('click', () => eventBus.send({ router: 'xModal', type: 'xModal.save.click', payload: { value: saveBtn.value } }));
    cancelBtn.addEventListener('click', () => eventBus.send({ router: 'xModal', type: 'xModal.cancel.click', payload: {} }));

    return overlay;
}
```

**Ngoại lệ ĐÃ audit chính thức, giữ nguyên — `core/modal-choice.js::modalChoice()`:** callback gọi
thẳng tham số `onClick` truyền vào lúc gọi hàm (không qua bus). Ngoại lệ này CHỈ áp dụng cho ĐÚNG
`modalChoice()` — bất kỳ file nào khác muốn miễn trừ tương tự PHẢI qua audit chính thức riêng,
KHÔNG được tự nhận "giống modalChoice()" để suy ra miễn trừ (tiền lệ bị bác chính xác pattern này ở
`folder-picker-ui.js`, xem [event-bus-flow.md](./event-bus-flow.md)).

> **Không hồi tố** — điều kiện 1 (MỚI) chỉ áp dụng cho hàm dựng UI MỚI viết/bị đụng thật từ thời
> điểm chốt rule này (13/07/2026) trở đi, đúng chính sách chung ở đầu tài liệu. Code hiện có ngoài
> `modalChoice()` (tương tác bên trong Generic Drawer ở `event/workflow/document-reader.js`,
> `core/file-manager/folder-picker-ui.js`, `buildDocumentEditorSurface()`, danh sách item động ở
> `components/items.js`...) GIỮ NGUYÊN, ghi nhận là nợ kỹ thuật, không bắt sửa ngay.

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

### 5d — Khung HTML tĩnh (không đổi giữa các lần mở) → `components/*.js`, không dựng bằng `createElement` (MỚI, 03/08/2026, phản hồi Giang)

Phần DOM của 1 modal/panel KHÔNG đổi giữa các lần mở/đóng (cùng cấu trúc, chỉ khác data hiển thị)
PHẢI tách thành template ở `components/*.js` — hoặc 1 hằng số chuỗi HTML tĩnh (khuôn
`TPL_GENERIC_DRAWER`, dùng khi mount 1 lần lúc boot), hoặc 1 hàm `render*()` trả về chuỗi HTML (khuôn
`renderAboutPanelBody()`, dùng khi tạo mới mỗi lần mở — hàm này được phép nội suy `t()`/data KHÔNG
đổi theo instance trực tiếp vào chuỗi, vì luôn chạy lại lúc mở, không bị "đông cứng" như hằng số
tĩnh). Phần THẬT SỰ khác theo từng instance (dữ liệu người dùng như filename, hay giá trị chỉ biết
sau khi có metadata) vẫn phải là slot rỗng, gán qua DOM API sau khi instantiate — không nội suy
thẳng vào chuỗi (tránh HTML injection).

**Instantiate template** (biến chuỗi HTML thành DOM thật) qua `service/component-dynamic.js::
instantiateComponent(html, slotMap)` (Rule 3b) — Core-ui tự soạn `slotMap` (nó biết cấu trúc DOM của
chính nó), gọi service này để clone + điền, rồi làm tiếp việc vốn có: append vào DOM, `addEventListener`
gom cuối hàm (Rule 5a), trả `handle`. KHÔNG tự viết lại `createElement`/`appendChild` để dựng cấu
trúc TĨNH nữa — chỉ còn cần cho phần THẬT SỰ động về số lượng (vd danh sách khung hình filmstrip,
tạo bằng vòng lặp runtime, chèn vào container đã có sẵn từ template).

---

## Bảng tổng hợp

| Câu hỏi | Đúng luật ver 12 (cập nhật 04/07/2026) |
|---|---|
| Function có `if/else`/`switch` chọn giữa ≥2 TIẾN TRÌNH/logic nghiệp vụ khác nhau (bất kể điều kiện lấy từ `appState`, tham số, hay đâu khác)? | **KHÔNG được** — tách thành nhiều function đơn tuyến, để nơi gọi chọn |
| Function có guard clause thuần (validate, early-return, vẫn chỉ 1 tiến trình)? | **ĐƯỢC** — không phải Rule 1 |
| Function có tự `appState.get()` bên trong (kể cả dạng `get([...])` mới)? | **KHÔNG được** — nhận qua tham số |
| Function có tự `appState.set()`/`mutate()`? | **ĐƯỢC** — coi là API `service/`, không tính "gọi hàm core khác" |
| Function có tự gọi `service/db.js` để GHI/XOÁ (`setMeta`/`setSongRecord`/`deleteXxxRecord`...)? | **ĐƯỢC** — cùng lý do trên |
| Function có tự gọi `service/db.js` để ĐỌC (`getMeta`/`getSongRecord`/`getAll*Keys`...)? | **CẤM TUYỆT ĐỐI** (siết 03/08/2026) — cùng lý do `appState.get()`, Workflow tự đọc rồi truyền tham số xuống. Áp dụng cả 2 loại core (thuần lẫn `-ui.js`) |
| Function core có tự gọi `service/component-dynamic.js::instantiateComponent()`? | **ĐƯỢC** — coi là API `service/` (Rule 3b), thuần cơ chế, không quyết định nghiệp vụ |
| Ai tạo Object URL cho Blob (`createBlobUrl()`)? | **Workflow** — nơi có Blob, truyền url xuống Core-ui làm tham số. Core-ui chỉ được gọi `revokeBlobUrl()` (dọn lúc đóng modal, gắn liền vòng đời DOM nó sở hữu) |
| Function gọi 1 function core/nghiệp vụ KHÁC — bất kể có return value, có dùng giá trị đó, đồng bộ hay bất đồng bộ, có `await` hay không? | **CẤM TUYỆT ĐỐI** — mọi hình dạng đều chuyển ra Workflow, không còn ngoại lệ nào |
| Function core có `taskManager` (once/addNew/...)? | **CẤM TUYỆT ĐỐI** — `taskManager` CHỈ dùng ở Workflow |
| Function core gọi thẳng API 1 thư viện NGOÀI project (CDN/vendor)? | **ĐƯỢC, có điều kiện** — chỉ khi có lý do cô lập để sau này đổi thư viện VÀ được audit rõ trong docstring (Rule 3d) |
| 1 hàm (dù đặt ở core hay Workflow) chỉ relay nguyên văn tham số sang 1 hàm khác, không thêm logic/điều phối gì? | **Hàm vô nghĩa — xoá**, gọi thẳng đích (Rule 3d) |
| Function có `appState.set()`/`mutate()`? | Bắt buộc `console.log` `writer/page/content` ngay dưới, TRỪ hot path 60fps |
| Function dựng UI (modal/drawer/toolbar) có được coi là "core UI thuần, ngoài phạm vi rule"? | **KHÔNG** — dựng UI VẪN là hàm nghiệp vụ, chịu ĐẦY ĐỦ Rule 1-4 + Rule 5 (xem Rule 5) |
| Function có `addEventListener`? | **CẤM**, TRỪ hàm dựng ra cụm DOM MỚI (không tĩnh) — khi đó ĐƯỢC, nhưng callback chỉ gọi tham số (không gọi core khác) VÀ phải gom hết ở CUỐI hàm (Rule 5a) |
| Function dùng `classList`/`dataset`/`querySelector(...)` tồn tại hay không làm điều kiện chọn giữa ≥2 tiến trình khác nhau? | **KHÔNG được** — cùng vi phạm Rule 1, chỉ khác nguồn đọc là DOM thay vì `appState` (Rule 5b) |
| File core có hàm tự `createElement` dựng cụm DOM mới (modal/drawer/toolbar) — tên file cần gì? | **PHẢI kết thúc bằng `-ui.js`** (vd `document-ui.js`) — file chỉ thao tác DOM tĩnh có sẵn (`dom-refs.js`) thì KHÔNG cần (Rule 5c) |
| Phần DOM không đổi giữa các lần mở/đóng (cùng cấu trúc, khác data) đặt ở đâu? | **`components/*.js`** (TPL_* tĩnh hoặc hàm `render*()`) — Core-ui KHÔNG tự `createElement` dựng lại, chỉ soạn `slotMap` rồi gọi `instantiateComponent()` (Rule 5d) |

← [Quay lại README](../README.md)
