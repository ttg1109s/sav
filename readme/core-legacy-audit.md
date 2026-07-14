# Nợ kỹ thuật: function Core di sản vi phạm quy tắc ver 12 (`readme/core-function-conventions.md`)

> **[Chính thức]** Toàn bộ function trong danh sách dưới đây được ghi nhận là **NỢ KỸ THUẬT** kể
> từ ver 12 — KHÔNG bắt buộc sửa ngay, nhưng khi 1 function trong danh sách bị đụng tới (sửa thật,
> không phải đọc lướt), phần bị sửa PHẢI tuân theo `core-function-conventions.md` (Rule 1-4 + Rule
> 5 cho hàm dựng UI). Mọi function/code **MỚI viết** từ ver 12 trở đi — dù trong `core/` hay bất kỳ
> thư mục nào khác — **bắt buộc tuân theo đầy đủ rule ngay từ đầu**, không được thêm vào danh sách
> nợ này.
>
> **[RE-SCAN 12/07/2026]** Bản gốc (viết trước cả Nhóm B/C/D/A — xem `changelog/v12.md` mục 3-8)
> quét **48 file `core/**/*.js`** (294 function top-level). Từ đó tới nay `core/` đã lên **66
> file** (+18, chủ yếu do Nhóm A "Documents" và tái cấu trúc Settings) — bản CŨ không còn phản ánh
> đúng hiện trạng, kể cả với các file ĐÃ audit từ trước (vd `core/player-controls.js` có thêm ít
> nhất 6 hàm mới — `setVisualizerActiveFalse`, `scrollSideLeftToSettingsSmooth`,
> `scrollSideLeftToPlaylistSmooth`, `updateMediaPositionState`, `startListenClock`,
> `handleProgressBarSeeking`/`handleProgressBarSeekCommit` — và mất hẳn `closeSettingsDrawer` cũ,
> đổi tên/thu hẹp thành `forceBackToPlaylistUI`; `core/canvas-scene-setup.js` có thêm
> `dataURItoBlobUrl`/`initRubik` chưa từng nằm trong bản audit gốc). Toàn bộ số liệu + bảng dưới
> đây là **QUÉT LẠI TỪ ĐẦU bằng script** (không sửa tay từng dòng số cũ), đối chiếu khớp 100% với 2
> hàm mẫu của bản gốc còn giữ nguyên hiện trạng (`core/app-cleanup.js::executeAppCleanup`,
> `core/audio-engine.js::setupAudioContext`) trước khi dùng cho toàn bộ 56 file — bảng này THAY THẾ
> HOÀN TOÀN bảng cũ, không phải bản vá thêm.
>
> Sinh bằng script quét cú pháp thật (brace-matching xác định đúng function TOP-LEVEL, bỏ qua hàm
> lồng bên trong hàm khác; loại bỏ nội dung comment/string/template trước khi quét regex) — KHÔNG
> phải liệt kê bằng mắt/suy đoán — nhưng Rule 1/3 vẫn cần xác nhận thủ công ở mức độ ghi rõ dưới
> đây (script không thể phán đoán ngữ nghĩa "có phải 2 tiến trình nghiệp vụ khác nhau" 100% chắc
> chắn).
>
> **[CẢNH BÁO kế thừa từ 04/07/2026]** Rule 3 hiện **CẤM TUYỆT ĐỐI mọi hình thức** core-gọi-core,
> chỉ còn ngoại lệ gọi `service/db.js`/`appState.set`/`mutate`. Cột R3 dưới đây quét theo đúng tiêu
> chí SIẾT CHẶT này (bare-call đồng bộ) — nhưng **CHƯA quét lời gọi qua `await`** (vẫn là giới hạn
> chưa giải quyết từ bản gốc) — coi cột R3 là **CẬN DƯỚI** (số vi phạm thật ≥ số liệt kê).

## Loại trừ hot-path (không đưa vào audit)

Toàn bộ hàm trong các file sau (chạy trong/được gọi trực tiếp mỗi khung hình từ vòng lặp
`requestAnimationFrame` ở `core/visualizer/draw-visualizer.js`) — DANH SÁCH KHÔNG ĐỔI so với bản
gốc, xác nhận lại không có file hot-path mới nào phát sinh:

- `core/visualizer/draw-visualizer.js`
- `core/visualizer/draw-helpers.js`
- `core/visualizer/types/bar.js`
- `core/visualizer/types/black-hole.js`
- `core/visualizer/types/lightning.js`
- `core/visualizer/types/rain.js`
- `core/visualizer/types/rubik.js`
- `core/visualizer/types/vortex.js`
- `core/three-vortex.js`
- `core/rubik-math.js`

Và 3 hàm cụ thể (nằm trong file KHÔNG hoàn toàn hot-path, nhưng bản thân hàm chạy mỗi frame):

- `core/audio-analysis.js :: updateStatsDashboard`
- `core/audio-analysis.js :: getComputedColor`
- `core/color-utils.js :: interpolateColor`

(`core/audio-analysis.js` sau khi loại 2 hàm trên không còn function top-level nào khác —
file 100% hot-path. `core/dom-refs.js` không có function nào — chỉ khai `const` tham chiếu DOM.)

## Thống kê tổng quan (quét lại 12/07/2026 — THAY số liệu cũ)

- Tổng file `core/**/*.js` hiện có: **66** (bản gốc: 48, +18) — sau loại hot-path: **56** file đưa
  vào audit (bản gốc: 38)
- Tổng function xét (đã loại hot-path): **366** / bản gốc **294** (+72, phần lớn tới từ 18 file mới
  của Nhóm A/D — xem chi tiết theo file bên dưới)
- **Rule 2** (tự `appState.get()` trong thân hàm): **90** / 366 (**25%** — bản gốc 103/266 = 39%)
- **Rule 1** — `else`/`switch` kèm `appState.get()` (strong, ưu tiên soát): **25** (gốc 22); chỉ
  `if` đơn không `else` (weak, độ ưu tiên thấp — xem Phụ lục cuối bài): **53** (gốc 61)
- **Rule 3** (bare-statement tới hàm core khác không return): **80** (gốc 85 — số liệu KHÔNG so
  sánh trực tiếp được 1:1 vì phạm vi file khác nhau, nhưng cùng thứ tự độ lớn)
- Có ít nhất 1 vi phạm xác nhận (Rule 2, hoặc Rule 1-strong, hoặc Rule 3): **133** / 366 (**36%** —
  bản gốc 150/266 = 56%)
- **Rule 5** (5a/5b/5c, mới thêm 10/07/2026, chưa từng nằm trong đợt audit gốc): đã đọc thủ công
  toàn bộ 20 hàm có `addEventListener` + 4 candidate Rule 5b — 2 vi phạm 5c xác nhận
  (`modal-choice.js` đã biết, `settings-panel-stack.js` MỚI phát hiện — xem mục Rule 5 dưới), 3 vi
  phạm 5a nhưng thuộc core di sản (nợ kế thừa, không phải code mới), 0 vi phạm 5b sau khi loại hết
  false-positive.

**Nhận xét đáng chú ý:** tỉ lệ vi phạm GIẢM (56% → 36%) dù tổng số function tăng — vì phần lớn 18
file MỚI (viết trong Nhóm A "Documents" và tái cấu trúc Settings, SAU KHI Rule 1-4 đã có hiệu lực
từ 04/07) tuân thủ Rule 2/1 khá tốt: **0/132 hàm ở 28 file mới có vi phạm Rule 2 hoặc Rule 1-strong**
— chỉ còn 11 vi phạm Rule 3 (core-gọi-core bare-statement), tập trung ở `core/file-manager/
photo-ui.js` (9 lần — chuỗi hàm private `_loadNextMasonryChunk`/`_collapseFarMasonryChunks`/
`_fillMasonryTile`/`_observeLazyThumbnail`... gọi nhau trong cùng file, đúng nghĩa đen "core gọi
core" dù cùng 1 khối tính năng masonry) và `core/settings-panel-stack.js` (2 lần — `popSettingsPanel`/
`resetSettingsStackToMain` gọi `scrollSliderTo` từ `core/slider-panel-scroll.js`, core khác file).
Đây là bằng chứng thực tế đầu tiên cho thấy Rule 2/1 đang được tuân thủ tốt ở code mới — Rule 3 vẫn
là điểm yếu nhất (dễ vi phạm nhất vì phải nhớ đẩy MỌI lời gọi core→core ra Workflow, kể cả helper
riêng tư cùng file).

> **[GIẢI QUYẾT 14/07/2026, Patch mục 2 "Item + window ảo"]** — 9/11 vi phạm Rule 3 nêu trên (toàn
> bộ chuỗi `_loadNextMasonryChunk`/`_collapseFarMasonryChunks`/`_fillMasonryTile`/... ở
> `photo-ui.js`) KHÔNG còn tồn tại — XOÁ HẲN cả cụm hàm (không sửa tại chỗ), thay bằng hạ tầng dùng
> chung `components/items.js` (`computeVariableVirtualWindowRange()`/`renderItemList()`/
> `itemTemplateImageGridRow()`) + `core/file-manager/image.js::buildPhotoGridRows()`, điều phối hoàn
> toàn từ `event/workflow/file-manager-photo.js::setupPhotoGridWindow()` — đúng kiến trúc Workflow
> gọi 2 Core độc lập, không còn core-gọi-core nào trong cụm này. Số liệu tổng ở trên (11 vi phạm
> Rule 3, 133/366 tổng) là ẢNH CHỤP TẠI THỜI ĐIỂM AUDIT GỐC, KHÔNG cập nhật lại — chỉ 2 vi phạm còn
> lại ở `core/settings-panel-stack.js` là còn mở tính đến patch này.

## Phương pháp & độ tin cậy từng cột

| Cột | Cách xác định | Độ tin cậy |
|---|---|---|
| **R2** | Regex tìm `appState.get(` trong thân hàm (đã bỏ qua comment/string/template literal khi quét) | Cao — khách quan, đúng theo đúng câu chữ Rule 2 |
| **R1** | `strong` = có `else`/`switch` + có `appState.get()`; `weak` = chỉ `if` đơn không `else` | Trung bình — vẫn cần đọc để phân biệt guard clause thật (vd `if (idx === -1) return;`) khỏi rẽ nhánh 2 tiến trình thật (vd if/else chọn "khởi tạo mới" hay "resume") |
| **R3** | Bare-call-statement (`tenHam(...);` đứng riêng 1 dòng, không gán/return, không phải `.method()`) tới 1 hàm TOP-LEVEL khác đã xác nhận tồn tại trong `core/**/*.js` (không phân biệt cùng file hay khác file) | Trung bình — chỉ bắt được lời gọi ĐỒNG BỘ dạng câu lệnh riêng dòng. **CHƯA quét lời gọi `await`** — cần 1 lượt riêng nếu muốn đầy đủ tuyệt đối |
| **Rule 5 (5a/5b/5c)** | `addEventListener(` trong thân hàm (5a candidate); `classList.contains(...)`/`dataset.` làm điều kiện `if` (5b candidate, thô — chỉ bắt pattern phổ biến nhất); tên file so với có `createElement(` hay không (5c) | Thấp — MỚI thêm lần quét này, Rule 5 vốn cần đọc ngữ cảnh (callback có gọi core khác không, phần tử là mới tạo hay tĩnh có sẵn) mà regex không phán đoán được — xem mục riêng dưới, coi là DANH SÁCH CẦN SOÁT MẮT, không phải kết luận |

---

## Rule 5 (5a/5b/5c) — audit đầy đủ, đã đọc từng candidate xác nhận verdict (không còn "sơ bộ")

Bản trước (12/07/2026, cùng ngày) chỉ liệt kê 20 hàm có `addEventListener` + 4 candidate Rule 5b
làm danh sách CẦN ĐỌC — bản này đã đọc từng chỗ, kết luận rõ ràng thay vì để ngỏ.

### Rule 5a (`addEventListener`) — verdict cuối cùng

**TUÂN THỦ đầy đủ (14 hàm, file có hậu tố `-ui.js`, dựng modal/drawer/picker MỚI thật, callback chỉ
gọi tham số):** `core/file-manager/document-ui.js` (`buildDocumentTitleModal`, `renderDocumentList`,
`buildDocumentDetailModal`, `buildDocumentEditorSurface`, `buildDocumentEditorDrawer`),
`core/file-manager/folder-picker-ui.js` (`openFolderPickerModal`, `openRenameFolderModal`),
`core/file-manager/photo-ui.js` (`openRenameAlbumModal`, `openImageCarouselPickerModal`,
`openPhotoUiImagePickerModal`, `openImageLibraryPickerModal`, `renderSlideshowAlbumPickerGrid`,
`openCreateAlbumModal`, `openImagePreviewModal`), `core/subtitle/subtitles-ui.js` (`buildLineCard`
— tự ghi rõ "callback CHỈ nhận tham số" đúng Rule 5a, dòng ~180).

**TUÂN THỦ — thuộc 1 diện MIỄN TRỪ chưa được đặt tên chính thức trong Rule 5a (đề xuất bổ sung, xem
cuối mục này):** phần tử DOM tạo ra KHÔNG PHẢI "cụm UI hiển thị/tương tác" (modal/drawer/toolbar)
mà là **công cụ tạm/vô hình, tạo và huỷ trong CHÍNH hàm đó, không bao giờ gắn vào cây DOM hiển
thị**, dùng để gọi 1 API trình duyệt (đo layout, giải mã media, kích hoạt tải file):
- `core/playlist/loader.js :: readAudioDuration` — `const tempAudio = new Audio();` tạo MỚI ngay
  trong hàm, 2 listener (`loadedmetadata`/`error`) chỉ gọi biến cục bộ (`safeResolve`/`cleanup`),
  KHÔNG gọi core nào khác — callback sạch, phần tử KHÔNG BAO GIỜ gắn vào DOM thật.
- `core/id3-export.js` — `<a>` tạo tạm để kích hoạt tải file (`triggerDownload`), không gắn DOM.
- `core/file-manager/document-pagination.js` — 3 phần tử tạm (`sourceContainer`/`wrap`/`measureEl`)
  chỉ để ĐO layout, không gắn DOM, không listener.
- `core/file-manager/document.js` — phần tử tạm trong `sanitizeDocumentHtml()` dùng làm parser
  HTML (`container`/`span`), không gắn DOM, không listener.

**VI PHẠM XÁC NHẬN (KHÔNG đạt điều kiện miễn — gắn listener lên phần tử TĨNH có sẵn, không phải
cụm DOM mới):**
- `core/wakelock.js :: requestWakeLock` — gắn `'release'` lên `WakeLockSentinel` (native, không
  phải DOM tự tạo) + `'touchstart'`/`'click'` lên `document.body` (tĩnh, có sẵn từ trước). File
  này thuộc **core di sản** (đã có từ trước ver 12, nằm trong 48 file gốc) — theo đúng phạm vi áp
  dụng đã chốt ("chỉ code MỚI viết/sửa từ ver 12 bắt buộc"), đây là **nợ kỹ thuật kế thừa**, không
  phải vi phạm mới — chỉ bắt buộc sửa khi hàm này bị đụng tới thật.
- `core/resume-state-storage.js :: applyResumeStateToRam` — gắn `'loadedmetadata'` lên
  `bgVideoElement` (dom-ref tĩnh). Cùng diện core di sản như trên — nợ kỹ thuật kế thừa.
- `core/state-and-video-bg.js :: setupVideoBgSource` — gắn lên `bgVideoElement`, file tự ghi chú
  đây là pattern CŨ giữ nguyên từ trước ver 12 — nợ kỹ thuật kế thừa, không phải vi phạm mới.

**VI PHẠM XÁC NHẬN — thuộc code MỚI (không được miễn theo phạm vi legacy):** không hàm nào trong
14+ hàm compliant/miễn trừ ở trên vi phạm — 3 vi phạm còn lại đều là code **CŨ** (core di sản).
Không phát hiện vi phạm 5a nào trong code MỚI viết từ ver 12 trở đi.

**Đề xuất bổ sung Rule 5a (chưa viết vào `core-function-conventions.md`, cần Giang chốt trước khi
thêm chính thức):** thêm 1 diện miễn trừ thứ 3 (ngoài "hạ tầng dùng chung" kiểu `modal-choice.js`)
— **"phần tử DOM tạm/vô hình, KHÔNG BAO GIỜ gắn vào cây DOM hiển thị, tạo và huỷ trong cùng 1
hàm, chỉ dùng để gọi API trình duyệt (đo lường/giải mã/kích hoạt tải)"** — khác hẳn "cụm UI mới"
(modal/drawer/toolbar) mà Rule 5a gốc hình dung, nhưng cùng tinh thần an toàn (không có tương tác
người dùng nào cần audit). Đã xác nhận lặp lại ở ÍT NHẤT 4 file khác nhau (`loader.js`,
`id3-export.js`, `document-pagination.js`, `document.js`) — đủ để thành 1 pattern chính thức thay
vì mỗi file tự giải thích rời rạc bằng comment riêng.

**Core di sản, hợp lệ về bản chất nhưng chưa xếp loại chính thức (không phải "phần tử tạm vô hình"
như nhóm trên, cũng không phải cụm modal/drawer đầy đủ — nằm giữa 2 nhóm):**
`core/playlist/render.js :: attachCoverFallback` — gắn `'error'` lên `imgEl`, xác nhận `imgEl` LÀ
phần tử ảnh bìa MỚI tạo ngay trong `buildSongNode()` (hàm gọi tới đây, cùng file) khi dựng mỗi
dòng bài hát — đúng tinh thần "cụm DOM mới" (không phải phần tử tĩnh có sẵn), callback SẠCH (chỉ
tự gỡ listener + đổi `src`, không gọi core nào khác). Core di sản (đã có từ trước ver 12) nên
không bắt buộc đổi tên `-ui.js` ngay, nhưng về hành vi đã tuân thủ Rule 5a trọn vẹn nếu bị đụng lại.

### Rule 5c (hậu tố `-ui.js`) — 2 vi phạm xác nhận, 1 ĐÃ SỬA

- **`core/modal-choice.js`** — đã ghi nhận từ trước (xem `core-function-conventions.md`), CHƯA sửa.
- **`core/settings-panel-stack.js` → `core/settings-panel-stack-ui.js` — ĐÃ SỬA (12/07/2026, cùng
  ngày phát hiện).** File này `document.createElement('div')` dựng MỚI panel Settings ĐỘNG (dòng
  104, `_buildPanelInnerHtml()`) — đúng định nghĩa "dựng cụm DOM mới" của Rule 5a/5c — nhưng KHÔNG
  có hậu tố `-ui.js`. Nghiêm trọng hơn: docstring đầu file (dòng 50) từng tự ghi **"Core UI
  THUẦN... KHÔNG thuộc phạm vi Rule 1-4"** — ĐÚNG CÂU mà Rule 5 (`core-function-conventions.md`,
  đoạn mở đầu) đã viết rõ là **"TUYÊN BỐ NÀY KHÔNG CÓ CĂN CỨ"**. Khác với 3 vi phạm 5a ở trên (core
  di sản, được miễn tạm), file này là **code MỚI** (viết 08/07/2026, Nhóm D) — KHÔNG thuộc diện
  legacy, phải sửa theo đúng tinh thần "code mới bắt buộc tuân thủ ngay từ đầu". Về mặt NỘI DUNG
  file vẫn khá sạch (không tự `appState.get()`, không `addEventListener`, không `taskManager` — tự
  nhận đúng) — vi phạm CHỈ nằm ở (a) tên file thiếu hậu tố, (b) dòng docstring viện dẫn sai câu chữ
  Rule 5 để tự miễn trừ. **Đã sửa:** đổi tên file thành `settings-panel-stack-ui.js` (cập nhật
  `<script src>` + comment tham chiếu trong `index.html`) + sửa lại docstring thành "tuân thủ Rule
  1-4 đầy đủ, CỘNG Rule 5 (dựng UI)". **Lưu ý:** file này vẫn còn 2 vi phạm Rule 3 KHÁC (gọi
  `scrollSliderTo()` từ `core/slider-panel-scroll.js`, xem bảng theo file bên dưới) — KHÔNG liên
  quan tới Rule 5c vừa sửa, vẫn còn mở.
- **Borderline, độ ưu tiên thấp (chỉ thêm ĐÚNG 1 phần tử nhỏ vào node có sẵn, không phải cụm
  modal/drawer/toolbar đầy đủ — chưa rõ có tính là "cụm DOM mới" theo tinh thần Rule 5c hay không):**
  `core/playlist/selection.js` (badge chỉ báo chọn, `node.appendChild(indicator)` lên node ĐÃ CÓ
  SẴN được truyền vào — code MỚI, Nhóm B/C), `core/equalizer.js::initEQSliders` (dựng cột slider
  EQ, nhưng chỉ 1/3 hàm trong file này dựng DOM — tiêu chí "TOÀN BỘ hoặc PHẦN LỚN" của Rule 5c chưa
  rõ có tính hay không).

### Rule 5b (`classList`/`dataset` làm điều kiện rẽ nhánh) — 0 vi phạm sau khi đọc kỹ

Cả 4 candidate từ lần quét trước đều là FALSE POSITIVE, đã đọc code xác nhận:
- `photo-ui.js :: _collapseFarMasonryChunks`/`_watchMasonryChunkForRestore` — `dataset.collapsed`
  dùng làm điều kiện GUARD (tránh collapse/expand trùng lặp một trạng thái đã đúng), KHÔNG phải
  chọn giữa 2 tiến trình nghiệp vụ khác nhau — đúng guard clause hợp lệ (cùng tinh thần ví dụ "ĐƯỢC"
  ở Rule 1).
- `subtitle-display.js :: addActiveSubBlock` — `child.dataset.start` dùng làm DỮ LIỆU số để sắp xếp
  vị trí chèn (thuật toán insertion sort), không phải cờ trạng thái rẽ nhánh — không phải Rule 5b.
- `visualizer-display.js :: updateTypeUI` — nhánh `if (cfg.type === 'vortex')` đọc `appState`
  (Rule 1 thường, đã có trong bảng Rule 1/2/3 phía dưới), KHÔNG phải `classList`/`dataset` — quét
  trước gán nhầm vào Rule 5b, thực ra không liên quan.

**Kết luận Rule 5b: sạch hoàn toàn** (0/366 function vi phạm) — không phát hiện chỗ nào lách Rule 1
qua đường DOM state.

---

## Danh sách theo file (Rule 2 xác nhận + Rule 1-strong + Rule 3 xác nhận) — QUÉT LẠI 12/07/2026

File nào không xuất hiện dưới đây nghĩa là **0 vi phạm phát hiện được** ở cả 3 rule (vẫn có thể có
function trong file đó, chỉ là sạch theo tiêu chí quét — không phải file rỗng).

### `core/about-stats.js`

_Không phát hiện vi phạm Rule 1 (strong)/2/3 nào — mọi function đều sạch theo tiêu chí quét._

### `core/app-cleanup.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `executeAppCleanup` | 16-45 | ✓ (5) | — | `releaseWakeLock` |

### `core/app-recovery.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `executeRestoreDefaults` | 38-42 | — | — | `saveConfig` |

### `core/audio-engine.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `initPitchWorker` | 35-54 | ✓ (3) | — | — |
| `requestPitchDetection` | 67-74 | ✓ (4) | — | — |
| `setupAudioContext` | 76-99 | ✓ (21) | ✓ | `allocateBuffers`, `applyEQPreset`, `initPitchWorker` |

### `core/auto-switch-visual.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `pickNextAutoSwitchVisualType` | 60-68 | ✓ (2) | — | — |
| `applyAutoSwitchVisualType` | 71-77 | ✓ (1) | — | `saveConfig`, `updateTypeUI` |
| `computeAutoSwitchVisualTimerDelayMs` | 85-93 | ✓ (1) | — | — |
| `scheduleNextAutoSwitchVisualTimer` | 100-118 | ✓ (2) | — | `applyAutoSwitchVisualType` |
| `buildAutoSwitchVisualMarks` | 135-149 | ✓ (2) | — | — |
| `autoSwitchVisualMarksTick` | 156-182 | ✓ (1) | ✓ | `applyAutoSwitchVisualType` |
| `startAutoSwitchVisualBranch` | 220-241 | ✓ (2) | ✓ | `buildAutoSwitchVisualMarks`, `killAllAutoSwitchVisualTasks`, `scheduleNextAutoSwitchVisualTimer` |
| `onAutoSwitchVisualSongChanged` | 265-272 | ✓ (3) | — | `startAutoSwitchVisualBranch` |
| `syncAutoSwitchVisualPlayState` | 279-286 | ✓ (2) | ✓ | — |
| `updateCycleModeButtonState` | 311-320 | ✓ (1) | — | — |
| `initAutoSwitchCycleButtonFromConfig` | 349-351 | — | — | `updateCycleModeButtonState` |

### `core/canvas-scene-setup.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `allocateBuffers` | 5-10 | ✓ (5) | — | — |
| `resizeCanvas` | 21-48 | ✓ (4) | — | `generateStreetScene`, `initStars` |
| `getPlayerBarSafeHeight` | 54-56 | ✓ (1) | — | — |
| `generateStreetScene` | 58-90 | ✓ (2) | — | — |
| `initStars` | 92-104 | ✓ (2) | ✓ | — |

### `core/color-utils.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `updateDOMBackground` | 25-29 | ✓ (1) | ✓ | — |
| `updatePlaylistBg` | 56-70 | ✓ (1) | ✓ | — |

### `core/config.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `saveConfig` | 143-146 | ✓ (1) | — | `scheduleConfigBackup` |
| `flushConfigBackup` | 153-157 | ✓ (1) | — | — |
| `loadBackgroundAssets` | 169-196 | ✓ (1) | ✓ | — |
| `loadConfig` | 205-319 | ✓ (9) | ✓ | `handleVideoBackground`, `saveConfig`, `updateDOMBackground`, `updatePlaylistBg` |

### `core/equalizer.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `updateEQSlidersUI` | 26-30 | ✓ (1) | — | — |
| `initEqualizerUIFromConfig` | 38-43 | ✓ (3) | — | `applyEQPreset`, `initEQSliders`, `updateEQSlidersUI` |

### `core/file-manager/album.js`

_Không phát hiện vi phạm Rule 1 (strong)/2/3 nào — mọi function đều sạch theo tiêu chí quét._

### `core/file-manager/cleanup.js`

_Không phát hiện vi phạm Rule 1 (strong)/2/3 nào — mọi function đều sạch theo tiêu chí quét._

### `core/file-manager/document-pagination.js`

_Không phát hiện vi phạm Rule 1 (strong)/2/3 nào — mọi function đều sạch theo tiêu chí quét._

### `core/file-manager/document-ui.js`

_Không phát hiện vi phạm Rule 1 (strong)/2/3 nào — mọi function đều sạch theo tiêu chí quét._

### `core/file-manager/document.js`

_Không phát hiện vi phạm Rule 1 (strong)/2/3 nào — mọi function đều sạch theo tiêu chí quét._

### `core/file-manager/folder-detail-ui.js`

_Không phát hiện vi phạm Rule 1 (strong)/2/3 nào — mọi function đều sạch theo tiêu chí quét._

### `core/file-manager/folder-list-ui.js`

_Không phát hiện vi phạm Rule 1 (strong)/2/3 nào — mọi function đều sạch theo tiêu chí quét._

### `core/file-manager/folder-picker-ui.js`

_Không phát hiện vi phạm Rule 1 (strong)/2/3 nào — mọi function đều sạch theo tiêu chí quét._

### `core/file-manager/folder.js`

_Không phát hiện vi phạm Rule 1 (strong)/2/3 nào — mọi function đều sạch theo tiêu chí quét._

### `core/file-manager/image.js`

_Không phát hiện vi phạm Rule 1 (strong)/2/3 nào — mọi function đều sạch theo tiêu chí quét._

### `core/file-manager/nav.js`

_Không phát hiện vi phạm Rule 1 (strong)/2/3 nào — mọi function đều sạch theo tiêu chí quét._

### `core/file-manager/photo-ui.js`

> **[14/07/2026, Patch mục 2]** Bảng dưới là ẢNH CHỤP LỊCH SỬ tại thời điểm audit gốc — các hàng
> `renderImageMasonry`/`_loadNextMasonryChunk`/`_collapseFarMasonryChunks`/`_expandMasonryChunk`/
> `_buildMasonryTile`/`_fillMasonryTile` (và dòng số ở `openPhotoUiImagePickerModal` gọi
> `renderImageMasonry`) KHÔNG còn đúng — toàn bộ đã bị XOÁ HẲN, thay bằng
> `event/workflow/file-manager-photo.js::setupPhotoGridWindow()` (Workflow, không phải Core) gọi
> `components/items.js`. Giữ nguyên bảng để tham khảo lịch sử, KHÔNG xoá dòng.

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `renderAlbumStory` | 46-109 | — | — | `_observeLazyThumbnail` |
| `renderImageMasonry` | 156-186 | — | — | `_loadNextMasonryChunk`, `_teardownMasonryWatchers` |
| `_loadNextMasonryChunk` | 195-215 | — | — | `_collapseFarMasonryChunks`, `_watchMasonryChunkForRestore` |
| `_collapseFarMasonryChunks` | 218-225 | — | — | `_collapseMasonryChunk` |
| `_expandMasonryChunk` | 246-257 | — | — | `_fillMasonryTile` |
| `_buildMasonryTile` | 260-265 | — | — | `_fillMasonryTile` |
| `_fillMasonryTile` | 269-290 | — | — | `_observeLazyThumbnail` |
| `openPhotoUiImagePickerModal` | 554-607 | — | — | `renderImageMasonry` |
| `openImageLibraryPickerModal` | 628-681 | — | — | `_observeLazyThumbnail` |

### `core/file-manager/slideshow.js`

_Không phát hiện vi phạm Rule 1 (strong)/2/3 nào — mọi function đều sạch theo tiêu chí quét._

### `core/generic-drawer.js`

_Không phát hiện vi phạm Rule 1 (strong)/2/3 nào — mọi function đều sạch theo tiêu chí quét._

### `core/id3-export.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `exportSongWithTag` | 33-66 | — | — | `triggerDownload` |

### `core/listen-stats.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `getSongStats` | 32-35 | ✓ (1) | — | — |
| `_ensureStats` | 37-41 | ✓ (1) | — | — |
| `bumpSongPlayCount` | 43-47 | — | — | `scheduleSongStatsSave` |
| `addSongListenTime` | 49-53 | — | — | `scheduleSongStatsSave` |
| `flushSongStats` | 80-87 | ✓ (2) | — | — |

### `core/loading-shield-util.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `withLoadingShield` | 17-54 | ✓ (1) | — | — |

### `core/modal-choice.js`

_Không phát hiện vi phạm Rule 1 (strong)/2/3 nào — mọi function đều sạch theo tiêu chí quét._

### `core/pitch-worker.js`

_Không phát hiện vi phạm Rule 1 (strong)/2/3 nào — mọi function đều sạch theo tiêu chí quét._

### `core/player-controls.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `playNext` | 47-67 | ✓ (16) | ✓ | `requestWakeLock` |
| `playPrev` | 69-85 | ✓ (13) | ✓ | `requestWakeLock` |
| `showResumeChoiceModal` | 196-264 | ✓ (7) | — | — |
| `updateResumeModalTitleIfPending` | 276-285 | ✓ (3) | — | — |
| `switchToVisualizer` | 287-321 | ✓ (1) | — | — |
| `handleBackToPlaylistClick` | 328-332 | — | — | `forceBackToPlaylistUI`, `setVisualizerActiveFalse` |
| `togglePlayPause` | 338-346 | ✓ (8) | ✓ | `requestWakeLock` |
| `cycleRepeatMode` | 380-385 | ✓ (4) | ✓ | — |
| `scrollSideLeftToSettingsSmooth` | 410-412 | — | — | `scrollSliderTo` |
| `scrollSideLeftToPlaylistSmooth` | 415-417 | — | — | `scrollSliderTo` |
| `_listenTick` | 451-477 | ✓ (6) | — | — |
| `stopListenClock` | 484-488 | — | — | `_listenTick` |
| `handleAudioPlay` | 495-505 | ✓ (2) | — | `startListenClock`, `syncVideoBgToAudio` |
| `handleAudioPause` | 511-519 | ✓ (2) | — | `releaseWakeLock`, `stopListenClock`, `syncVideoBgToAudio` |
| `handleAudioEnded` | 526-528 | — | — | `stopListenClock` |
| `handleAudioError` | 549-553 | ✓ (4) | — | `handlePlaybackError` |
| `handleAudioTimeUpdate` | 564-570 | ✓ (1) | — | — |

### `core/playlist/actions.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `removeKeyFromDisplay` | 30-39 | ✓ (2) | — | `recomputeRenderOrder`, `renderPlaylistDiff`, `updateEmptyState`, `updateShuffleArray` |
| `handleSongActionMenuSelect` | 259-267 | — | — | `closeSongActionMenu` |
| `handlePlaybackError` | 273-278 | ✓ (1) | — | — |
| `confirmKeepBrokenSong` | 285-293 | — | — | `removeKeyFromDisplay` |
| `deleteBrokenSongByKey` | 315-319 | — | — | `removeKeyFromDisplay`, `removeSongStats` |
| `openSongEditModal` | 367-395 | ✓ (1) | — | `revokeSongEditPendingPreview`, `setSongEditCoverPreview`, `setSongEditTab`, `songInfoRowHtml` |
| `closeSongEditModal` | 397-403 | — | — | `revokeSongEditPendingPreview` |
| `changeSongEditCover` | 412-420 | — | — | `revokeSongEditPendingPreview`, `setSongEditCoverPreview` |
| `removeSongEditCover` | 423-427 | — | — | `revokeSongEditPendingPreview`, `setSongEditCoverPreview` |
| `applySongEditAndSave` | 454-500 | ✓ (7) | ✓ | `attachCoverFallback` |
| `refreshAfterSongEditSave` | 507-513 | ✓ (2) | — | `recomputeRenderOrder`, `refreshSongNode`, `renderPlaylistDiff` |

### `core/playlist/bulk-actions.js`

_Không phát hiện vi phạm Rule 1 (strong)/2/3 nào — mọi function đều sạch theo tiêu chí quét._

### `core/playlist/loader.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `handleAudioFiles` | 38-176 | ✓ (1) | ✓ | `applyNewSongsToDisplayOrder`, `recomputeRenderOrder`, `renderPlaylistDiff`, `updateShuffleArray` |
| `scanValidSongsFromDB` | 288-305 | ✓ (1) | — | — |
| `initPlaylistFromDB` | 308-350 | — | — | `hidePlaylistLoading`, `recomputeDisplayOrder`, `recomputeRenderOrder`, `renderPlaylistDiff`, `showPlaylistLoading`, `updateEmptyState`, `updateShuffleArray` |

### `core/playlist/main.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `setPlaylistViewMode` | 59-65 | ✓ (1) | — | `renderPlaylistFull` |
| `handlePlaylistSearchInput` | 72-75 | — | — | `applySearchQuery` |
| `clearPlaylistSearch` | 78-83 | — | — | `applySearchQuery` |

### `core/playlist/order.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `liveKeys` | 12-14 | ✓ (2) | — | — |
| `sortKeysByMode` | 17-26 | ✓ (5) | — | — |
| `matchesSearch` | 28-35 | ✓ (5) | — | — |
| `applyNewSongsToDisplayOrder` | 78-92 | ✓ (3) | — | — |
| `updateShuffleArray` | 94-104 | ✓ (2) | — | — |
| `setDisplaySortMode` | 168-174 | — | — | `recomputeDisplayOrder`, `recomputeRenderOrder`, `renderPlaylistDiff` |

### `core/playlist/render.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `buildSongNode` | 79-125 | ✓ (5) | ✓ | `attachCoverFallback` |
| `showPlaylistLoading` | 128-138 | — | — | `updatePlaylistLoading` |
| `updateEmptyState` | 151-168 | ✓ (2) | ✓ | — |
| `renderPlaylistFull` | 170-184 | ✓ (3) | ✓ | `updateEmptyState` |
| `renderPlaylistDiff` | 186-218 | ✓ (6) | ✓ | `renderPlaylistFull`, `revokeNodeCoverUrl`, `updateEmptyState` |
| `refreshSongNode` | 220-227 | ✓ (1) | — | `revokeNodeCoverUrl` |
| `scrollToSongIfPending` | 241-253 | ✓ (1) | — | — |
| `applySearchQuery` | 256-260 | — | — | `recomputeRenderOrder`, `renderPlaylistDiff` |

### `core/playlist/scope.js`

_Không phát hiện vi phạm Rule 1 (strong)/2/3 nào — mọi function đều sạch theo tiêu chí quét._

### `core/playlist/selection.js`

_Không phát hiện vi phạm Rule 1 (strong)/2/3 nào — mọi function đều sạch theo tiêu chí quét._

### `core/playlist/state.js`

_Không phát hiện vi phạm Rule 1 (strong)/2/3 nào — mọi function đều sạch theo tiêu chí quét._

### `core/resume-state-storage.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `saveResumeStateToLocalStorage` | 68-96 | ✓ (15) | — | — |
| `checkPendingResumeStateOnBoot` | 135-151 | — | — | `clearResumeFlag` |
| `enableResumeModalButtonsWhenPlaylistReady` | 163-179 | ✓ (3) | — | `discardPendingResumeState` |
| `applyResumeStateToRam` | 196-241 | ✓ (10) | ✓ | `clearResumeFlag`, `clearResumeStateFromLocalStorage` |
| `discardPendingResumeState` | 244-248 | — | — | `clearResumeFlag`, `clearResumeStateFromLocalStorage` |

### `core/sav-logo.js`

_Không phát hiện vi phạm Rule 1 (strong)/2/3 nào — mọi function đều sạch theo tiêu chí quét._

### `core/settings-panel-stack.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `popSettingsPanel` | 122-130 | — | — | `scrollSliderTo` |
| `resetSettingsStackToMain` | 139-145 | — | — | `scrollSliderTo` |

### `core/slider-panel-scroll.js`

_Không phát hiện vi phạm Rule 1 (strong)/2/3 nào — mọi function đều sạch theo tiêu chí quét._

### `core/state-and-video-bg.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `returnToVisualizer` | 37-39 | ✓ (1) | — | — |
| `validateVideoBgOnClose` | 69-76 | ✓ (1) | — | `handleVideoBackground` |
| `setupVideoBgSource` | 86-97 | ✓ (3) | — | — |
| `syncVideoBgToAudio` | 104-108 | ✓ (1) | ✓ | — |
| `handleVideoBackground` | 110-133 | ✓ (3) | ✓ | `setupVideoBgSource`, `syncVideoBgToAudio`, `updateDOMBackground` |
| `enableVideoBackground` | 136-139 | — | — | `handleVideoBackground` |
| `disableVideoBackgroundState` | 146-153 | — | — | `handleVideoBackground` |
| `setVisualEnabled` | 156-159 | — | — | `saveConfig` |
| `applyUploadedVideoBg` | 164-175 | — | — | `handleVideoBackground` |
| `applyVisualBgImage` | 242-254 | — | — | `applyVisualBgImageToDOM`, `saveConfig` |
| `disableVisualBgImageState` | 267-276 | — | — | `applyVisualBgImageToDOM`, `saveConfig` |

### `core/stats-panel-toggle.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `toggleStatsPanelVisibility` | 38-53 | ✓ (2) | — | — |

### `core/storage-manager.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `clearAllStoredData` | 89-121 | ✓ (5) | — | `renderPlaylistFull`, `saveConfig`, `updateShuffleArray` |
| `downloadAllSongsThenClear` | 132-154 | — | — | `triggerDownload` |
| `scanAllSongsForCorruption` | 184-201 | ✓ (1) | — | — |
| `deleteCorruptedSongs` | 211-218 | — | — | `removeKeyFromDisplay` |

### `core/subtitle/subtitle-display.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `updateSubToggleUI` | 13-17 | ✓ (1) | — | — |
| `applySubtitleStyle` | 29-42 | ✓ (1) | — | — |
| `processSubtitles` | 44-87 | ✓ (3) | — | `addActiveSubBlock`, `removeActiveSubBlock`, `updateSubtitleFrameVisibility` |
| `clearAllActiveSubBlocks` | 114-119 | ✓ (1) | — | — |

### `core/subtitle/subtitle-style-settings.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `setSubtitlesEnabled` | 18-24 | ✓ (2) | — | `saveConfig`, `updateSubToggleUI` |
| `initSubtitleToggleUIFromConfig` | 91-96 | ✓ (2) | — | `applySubtitleStyle`, `updateSubToggleUI` |

### `core/subtitle/subtitles-ui.js`

_Không phát hiện vi phạm Rule 1 (strong)/2/3 nào — mọi function đều sạch theo tiêu chí quét._

### `core/subtitle/subtitles.js`

_Không phát hiện vi phạm Rule 1 (strong)/2/3 nào — mọi function đều sạch theo tiêu chí quét._

### `core/tab-hide-reload.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `triggerHideAndReload` | 28-50 | ✓ (1) | — | — |

### `core/upload-validation.js`

_Không phát hiện vi phạm Rule 1 (strong)/2/3 nào — mọi function đều sạch theo tiêu chí quét._

### `core/visualizer/visualizer-display.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `updateProgressBarCSS` | 51-56 | ✓ (1) | — | — |
| `cycleVisualizerType` | 73-76 | ✓ (2) | — | — |
| `updateTypeUI` | 89-143 | ✓ (5) | ✓ | `updateBarStyleUI` |
| `updateBarStyleUI` | 148-154 | ✓ (1) | — | — |
| `updateColorMenuUI` | 158-168 | ✓ (1) | ✓ | `updateProgressBarCSS` |
| `applyEQPreset` | 170-175 | ✓ (2) | — | — |
| `setVolume` | 340-345 | ✓ (3) | — | — |

### `core/visualizer/visualizer-misc-settings.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `initVisualizerMiscSettingsUIFromConfig` | 20-25 | ✓ (2) | — | — |

### `core/wakelock.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `requestWakeLock` | 16-22 | ✓ (2) | ✓ | — |
| `releaseWakeLock` | 24-29 | ✓ (2) | — | — |


---

## Phụ lục — Rule 1 "weak" (chỉ `if` đơn không `else`, ưu tiên thấp)

Nhiều khả năng là guard clause hợp lệ (được phép theo Rule 1) — liệt kê để tham khảo,
KHÔNG coi là vi phạm mặc định. Áp phép thử "xoá `if` đi, hàm còn lại có nguyên 1 kịch bản
không" (xem `core-function-conventions.md` Rule 1) trước khi kết luận. **53 hàm** (bản gốc: 61 —
không so sánh trực tiếp 1:1 được do phạm vi file khác nhau).

| File | Hàm | Dòng |
|---|---|---|
| `core/app-cleanup.js` | `executeAppCleanup` | 16-45 |
| `core/audio-engine.js` | `initPitchWorker` | 35-54 |
| `core/audio-engine.js` | `requestPitchDetection` | 67-74 |
| `core/auto-switch-visual.js` | `pickNextAutoSwitchVisualType` | 60-68 |
| `core/auto-switch-visual.js` | `applyAutoSwitchVisualType` | 71-77 |
| `core/auto-switch-visual.js` | `computeAutoSwitchVisualTimerDelayMs` | 85-93 |
| `core/auto-switch-visual.js` | `scheduleNextAutoSwitchVisualTimer` | 100-118 |
| `core/auto-switch-visual.js` | `buildAutoSwitchVisualMarks` | 135-149 |
| `core/auto-switch-visual.js` | `onAutoSwitchVisualSongChanged` | 265-272 |
| `core/auto-switch-visual.js` | `updateCycleModeButtonState` | 311-320 |
| `core/canvas-scene-setup.js` | `allocateBuffers` | 5-10 |
| `core/canvas-scene-setup.js` | `resizeCanvas` | 21-48 |
| `core/equalizer.js` | `updateEQSlidersUI` | 26-30 |
| `core/listen-stats.js` | `_ensureStats` | 37-41 |
| `core/listen-stats.js` | `flushSongStats` | 80-87 |
| `core/loading-shield-util.js` | `withLoadingShield` | 17-54 |
| `core/player-controls.js` | `showResumeChoiceModal` | 196-264 |
| `core/player-controls.js` | `updateResumeModalTitleIfPending` | 276-285 |
| `core/player-controls.js` | `switchToVisualizer` | 287-321 |
| `core/player-controls.js` | `_listenTick` | 451-477 |
| `core/player-controls.js` | `handleAudioPlay` | 495-505 |
| `core/player-controls.js` | `handleAudioPause` | 511-519 |
| `core/player-controls.js` | `handleAudioError` | 549-553 |
| `core/player-controls.js` | `handleAudioTimeUpdate` | 564-570 |
| `core/playlist/actions.js` | `openSongEditModal` | 367-395 |
| `core/playlist/actions.js` | `refreshAfterSongEditSave` | 507-513 |
| `core/playlist/loader.js` | `scanValidSongsFromDB` | 288-305 |
| `core/playlist/order.js` | `sortKeysByMode` | 17-26 |
| `core/playlist/order.js` | `matchesSearch` | 28-35 |
| `core/playlist/order.js` | `applyNewSongsToDisplayOrder` | 78-92 |
| `core/playlist/order.js` | `updateShuffleArray` | 94-104 |
| `core/playlist/render.js` | `refreshSongNode` | 220-227 |
| `core/playlist/render.js` | `scrollToSongIfPending` | 241-253 |
| `core/resume-state-storage.js` | `saveResumeStateToLocalStorage` | 68-96 |
| `core/resume-state-storage.js` | `enableResumeModalButtonsWhenPlaylistReady` | 163-179 |
| `core/state-and-video-bg.js` | `returnToVisualizer` | 37-39 |
| `core/state-and-video-bg.js` | `validateVideoBgOnClose` | 69-76 |
| `core/state-and-video-bg.js` | `setupVideoBgSource` | 86-97 |
| `core/stats-panel-toggle.js` | `toggleStatsPanelVisibility` | 38-53 |
| `core/storage-manager.js` | `clearAllStoredData` | 89-121 |
| `core/storage-manager.js` | `scanAllSongsForCorruption` | 184-201 |
| `core/subtitle/subtitle-display.js` | `updateSubToggleUI` | 13-17 |
| `core/subtitle/subtitle-display.js` | `processSubtitles` | 44-87 |
| `core/subtitle/subtitle-display.js` | `clearAllActiveSubBlocks` | 114-119 |
| `core/subtitle/subtitle-style-settings.js` | `setSubtitlesEnabled` | 18-24 |
| `core/subtitle/subtitle-style-settings.js` | `initSubtitleToggleUIFromConfig` | 91-96 |
| `core/tab-hide-reload.js` | `triggerHideAndReload` | 28-50 |
| `core/visualizer/visualizer-display.js` | `cycleVisualizerType` | 73-76 |
| `core/visualizer/visualizer-display.js` | `updateBarStyleUI` | 148-154 |
| `core/visualizer/visualizer-display.js` | `applyEQPreset` | 170-175 |
| `core/visualizer/visualizer-display.js` | `setVolume` | 340-345 |
| `core/visualizer/visualizer-misc-settings.js` | `initVisualizerMiscSettingsUIFromConfig` | 20-25 |
| `core/wakelock.js` | `releaseWakeLock` | 24-29 |

---

← [Quay lại core-function-conventions.md](./core-function-conventions.md)
