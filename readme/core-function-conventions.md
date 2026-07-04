# Quy tắc viết function Core / nghiệp vụ — từ ver 12 trở đi

> **Áp dụng cho function MỚI viết hoặc được SỬA kể từ ver 12** — **[Đã chốt]** core di sản (~110
> file hiện có, phần lớn đang tự `appState.get()` trực tiếp, đúng theo quy ước cũ ở
> `service/state.js`) **giữ nguyên, KHÔNG rewrite/audit hồi tố**. Chỉ code mới viết hoặc bị đụng
> tới (sửa thật, không phải chỉ đọc lướt qua) từ ver 12 trở đi mới bắt buộc theo 3 rule dưới đây.

Đọc cùng [event-bus-flow.md](./event-bus-flow.md) — tài liệu đó quy định luồng
`listener → router → core/workflow/VirtualMachineState`; tài liệu NÀY quy định riêng bên TRONG 1
function Core/nghiệp vụ được viết ra sao. Xem [core-legacy-audit.md](./core-legacy-audit.md) —
danh sách **nợ kỹ thuật chính thức**: function core di sản đang vi phạm 4 rule dưới đây (không bắt
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

## Bảng tổng hợp

| Câu hỏi | Đúng luật ver 12 (cập nhật 04/07/2026) |
|---|---|
| Function có `if/else`/`switch` chọn giữa ≥2 TIẾN TRÌNH/logic nghiệp vụ khác nhau (bất kể điều kiện lấy từ `appState`, tham số, hay đâu khác)? | **KHÔNG được** — tách thành nhiều function đơn tuyến, để nơi gọi chọn |
| Function có guard clause thuần (validate, early-return, vẫn chỉ 1 tiến trình)? | **ĐƯỢC** — không phải Rule 1 |
| Function có tự `appState.get()` bên trong (kể cả dạng `get([...])` mới)? | **KHÔNG được** — nhận qua tham số |
| Function có tự `appState.set()`/`mutate()`? | **ĐƯỢC** — coi là API `service/`, không tính "gọi hàm core khác" |
| Function có tự gọi `service/db.js` (getMeta/setMeta/...)? | **ĐƯỢC** — cùng lý do trên |
| Function gọi 1 function core/nghiệp vụ KHÁC — bất kể có return value, có dùng giá trị đó, đồng bộ hay bất đồng bộ, có `await` hay không? | **CẤM TUYỆT ĐỐI** — mọi hình dạng đều chuyển ra Workflow, không còn ngoại lệ nào |
| Function core có dùng `taskManager` (once/addNew/...)? | **CẤM TUYỆT ĐỐI** — `taskManager` CHỈ dùng ở Workflow |
| Function có `appState.set()`/`mutate()`? | Bắt buộc `console.log` `writer/page/content` ngay dưới, TRỪ hot path 60fps |

← [Quay lại README](../README.md)
