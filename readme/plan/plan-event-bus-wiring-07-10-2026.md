# Plan dọn nợ "Workflow tự gắn sự kiện" — bỏ qua Listener -> Router (lập 07/10/2026)

Nguồn: rà soát 07/10/2026 sau patch `sav-13-ui-batch-patch.zip` (Edit EQ). Plan này chỉ sắp xếp CÁCH và THỨ TỰ trả
nợ, KHÔNG đổi rule nào ([event-bus-flow.md](../event-bus-flow.md) mục 1, [core-function-conventions.md](../core-function-conventions.md)
Rule 5a). Nợ được ghi ở [core-legacy-audit.md](../core-legacy-audit.md), mục "Rà wiring sự kiện trong Workflow (07/10/2026)".

## 1. Vấn đề

`event-bus-flow.md` mục 1: CHỈ tầng Listener đăng ký sự kiện, và chỉ làm 1 việc là `eventBus.send()`. Luồng luôn đi
Listener -> (Block gate) -> Router -> Workflow. Danh sách miễn trừ đã audit (18 chỗ, `changelog/v11.md` mục 2) chỉ gồm:
lifecycle trình duyệt, `modalChoice`, vài chỗ dò duration/seek media 1 lần.

Một số Workflow vẫn tự `querySelector` + `addEventListener` lên nội dung Generic Drawer SAU MỖI lần vẽ, callback gọi
thẳng method của chính Workflow (hoặc core). Hậu quả:
- Bỏ qua Listener, Router và **Block gate** — 1 entry `event/block.js` sau này sẽ không chặn được các thao tác này.
- Không có `msg.type` -> không log/không dò được luồng như phần còn lại của app.
- Listener gắn lại mỗi lần vẽ lại (an toàn vì DOM cũ bị thay, nhưng dễ cộng dồn nếu sau này đổi sang vẽ tại chỗ).

Tiền lệ đã sửa đúng loại nợ này: `event/listener/custom-effect.js` (28/09/2026) — ủy quyền 1 lần trên
`genericDrawerBody`/`genericDrawerHeader`, bảng tuyến `match(target) -> send(el)`; `event/listener/motion-presets.js`
(kéo-thả bằng `setPointerCapture` qua Listener); `event/listener/auto-switch-visual.js`; resize visualizer qua
`event/listener/visualizer-viewport.js` (28/09/2026).

## 2. Phạm vi (rà tay 07/10/2026 — `grep addEventListener( event/workflow/`)

| Nhóm | File : dòng | Hiện trạng | Phân loại |
|---|---|---|---|
| **A — Wiring UI drawer, callback gọi thẳng** | `eq-presets.js` (10: back/close/add/row/apply/reset/name/slider/delete/pagination — `_wireListView()`/`_wireEditView()`) | Callback gọi `this.*` | **Vi phạm** |
| | `element-style-editor.js` (12: close, tab, change/input field, load font, font picker, apply, search, chọn font) | Callback gọi `this.*` + core (`setElementStyleActiveTab`) | **Vi phạm** |
| | `settings-misc.js:93` (nút X Debug Console) | Gọi thẳng `workflowGenericDrawerHelpers.closeFully()` | **Vi phạm** (nhỏ) |
| **B — Kéo-thả trong Workflow** | `visualizer-display.js:58-90` (`openAutoSwitchPanel()`: pointerdown/move/up/cancel trên tay cầm) | Tự gắn trong Workflow; phần commit đã `eventBus.send('autoSwitchVisual.item.move')`, phần nổi hàng/hover là DOM thuần | **Vi phạm** (lệch tầng) — khuôn chuẩn đã có ở Point Move |
| **C — Đăng ký ở file Workflow, callback chỉ `eventBus.send()`** | `file-manager-storage.js:143` (nút X Storage) | Đi qua Router đúng, chỉ sai NƠI đăng ký | Lệch tầng (nhẹ) |
| **D — Ô nhập trong modal động chỉ ghi draft cục bộ** | `motion-presets.js:812` (modal Timing X), `image-edit.js:925` (modal sửa chữ layer) | `input` -> biến `draftX`/`draftText` trong closure, nút Lưu của `modalChoice()` mới commit | **Cần Giang chốt** (mục 6) |
| **E — `window.resize` trong Workflow** | `gameplay.js:629` | Comment viện dẫn tiền lệ `core/canvas-scene-setup.js` — tiền lệ đó ĐÃ XOÁ 28/09/2026 (resize nay qua `event/listener/visualizer-viewport.js`) | **Vi phạm** (tiền lệ hết hiệu lực) |
| **F — Nửa sau bất đồng bộ của API media/ghi** | `video-player.js` (276, 282, 317, 660, 828), `visual-bg-video.js:207`, `player-controls.js:404`, `player.js` (`reloadCurrentSongKeepingPosition` loadedmetadata), `recorder.js:408` (`recorder.stop`), `video-thumb-extract.js` (3), `video-preview.js:125` (`window.error` khi chạy export) | `{ once:true }` chờ 1 mốc của chính phần tử media đang điều khiển, là 1 bước trong chuỗi await | **Cần Giang chốt** (mục 6) — cùng bản chất nhóm "dò media" đã miễn nhưng CHƯA audit |
| — | `recorder.js:299` (`track.ended`) | Callback chỉ `eventBus.send()` | Như nhóm C |
| **Ngoài phạm vi** | `subtitle-editor.js` (15) — trang riêng `subtitle-editor.html` | — | Xét ở đợt riêng nếu Giang muốn (trang đó có bus riêng không — cần kiểm) |
| **Ngoài phạm vi** | `core/*-ui.js` (Rule 5a: callback chỉ `eventBus.send` + gom cuối hàm) | — | Đã có khung audit Rule 5a riêng, không gộp vào plan này |

## 3. Khuôn sửa

| Mã | Dạng gặp | Sửa thành |
|---|---|---|
| **W1** | Workflow `querySelector(...).addEventListener(..., () => this.x())` trên nội dung Generic Drawer | `event/listener/<cụm>.js`: 1 lần ủy quyền trên `genericDrawerBody` (`input`/`change`/`click`) + `genericDrawerHeader` (`click`), bảng tuyến `{ match, send }` như `custom-effect.js`. Router thêm case `<cụm>.<phần tử>.<sự kiện>`. Workflow: XOÁ hàm `_wire*()`, thân các method giữ nguyên văn. |
| **W2** | Nút chrome header dùng id CHUNG (`#btn-generic-drawer-close`/`-back`/`-save`) | KHÔNG match theo id (mọi drawer đều có) — thêm attribute riêng của cụm (`data-eq-close`, `data-eq-back`, `data-ese-close`...) như `data-ce-close`. Giữ id cũ (có thể còn chỗ khác đọc). |
| **W3** | Phần tử lặp (hàng preset, slider từng kênh) | `data-*` mang khoá (`data-eq-id`, `data-index` + class hook `eq-band-slider`), Listener đọc dataset làm payload. |
| **W4** | Kéo-thả bằng pointer trong Workflow | Theo khuôn Point Move: Listener bắt `pointerdown` trên tay cầm (delegate) -> `setPointerCapture` -> `pointermove`/`pointerup` về đúng tay cầm, mỗi pha 1 `msg.type`; Workflow giữ phiên kéo (`_xDrag`) + tô DOM. |
| **W5** | `window.resize` trong Workflow | Thêm 1 consumer vào luồng `visualizer-viewport` có sẵn (router gọi thêm `workflowGameplay._handleLayoutResize()`), KHÔNG tạo listener resize thứ 2. |
| **W6** | Callback đã chỉ `eventBus.send()` nhưng đăng ký trong Workflow | Dời đăng ký sang Listener của cụm (delegate), Router/Workflow không đổi. |

Ràng buộc khi sửa:
- Listener KHÔNG đọc `appState`, KHÔNG rẽ nhánh nghiệp vụ — chỉ đọc giá trị/dataset phần tử làm payload.
- Tuyến không khớp drawer của mình -> bỏ qua (drawer khác dùng chung `genericDrawerBody`). Selector phải đủ riêng
  (id/attribute có tiền tố cụm) để không bắt nhầm.
- Không đổi hành vi, không đổi thứ tự bước (cùng nguyên tắc plan-debt-cleanup-02-10-2026.md mục 2).

## 4. Các đợt

### Đợt 1 — EQ (`eq-presets.js`) — rủi ro THẤP, làm trước
- Áp W1 + W2 + W3 cho List (close, add, row, phân trang đã qua `wirePaginationControls` — giữ) và Edit (back, apply,
  reset, name `input`/`change`, slider `input`/`change`, delete).
- File: `components/eq-presets-drawer.js` (attribute `data-eq-*`), `event/listener/eq-presets.js`,
  `event/router/eq-presets.js`, `event/workflow/eq-presets.js` (xoá `_wireListView()`/`_wireEditView()`; nút X list
  đang gọi `closeDrawer()`).
- Nền: bản EQ của `sav-13-ui-batch-patch.zip` (đã bỏ Save, slider ngang, Apply khoá).
- **Test máy:** mở EQ (giữ 1.5s), tạo preset, đổi tên (rời ô), kéo slider preset đang dùng (nghe đổi ngay), Apply ->
  modal -> bấm lại "đang áp dụng", Khôi phục mặc định, Xoá, phân trang, X đóng; mở drawer KHÁC (Custom Effect,
  Storage) để chắc listener EQ không bắt nhầm.

### Đợt 2 — `settings-misc.js:93` + `file-manager-storage.js:143` + `recorder.js:299` — rủi ro THẤP
- W2/W6: nút X Debug Console và Storage sang Listener của cụm; `track.ended` (recorder) — xem mục 6 câu 2 (có thể
  xếp vào nhóm F).
- **Test máy:** X của Debug Console, X của Storage; rút tai nghe/mất mic khi đang ghi.

### Đợt 3 — `gameplay.js:629` (W5) — rủi ro THẤP
- Gỡ `window.addEventListener('resize', ...)`, router `visualizer-viewport` gọi thêm `workflowGameplay._handleLayoutResize()`.
  Kiểm lại phần comment "MỚI 08/09/2026" ngay dưới dòng 629 (xử lý bổ sung khi `resize` không bắn) — giữ nguyên cơ chế đó.
- **Test máy:** xoay màn hình giữa ván Game; mở/đóng bàn phím ảo trong lúc Game đang chạy.

### Đợt 4 — Auto-Switch kéo-thả (`visualizer-display.js`, W4) — rủi ro TRUNG BÌNH
- Chuyển 4 handler pointer sang `event/listener/auto-switch-visual.js` (đã delegate sẵn cho checkbox/select),
  `msg.type` `autoSwitchVisual.drag.start/move/end/cancel`, phiên kéo giữ ở Workflow — cùng khuôn
  `workflowMotionPresets.startPointMoveDrag()/movePointMoveDrag()/endPointMoveDrag()`.
- **Test máy:** kéo dời mục cả 2 chế độ List by (group/style), thả ra ngoài, kéo rồi cuộn, hủy giữa chừng.

### Đợt 5 — Element Style Editor (`element-style-editor.js`, 12 chỗ) — rủi ro TRUNG BÌNH
- W1 + W2 + W3. Callback tab đang gọi thẳng core `setElementStyleActiveTab()` -> chuyển thành method Workflow
  (`selectTab(tab)`: core + `_render()`), router gọi method đó.
- Font picker (search `input`, chọn font, back) là màn con trong cùng drawer — tuyến riêng, selector riêng.
- **Test máy:** đổi tab, sửa từng loại field (change/input), nạp font, mở font picker -> tìm -> chọn -> back, Apply, X.

### Đợt 6 — Nhóm D + F — chỉ làm SAU khi Giang chốt mục 6
- Nếu chốt "miễn trừ": bổ sung vào danh sách miễn trừ ở `event-bus-flow.md` mục 1 (có tên file, dòng, lý do) —
  KHÔNG sửa code.
- Nếu chốt "sửa": D -> Listener delegate trên `#modal-choice-body` theo id ô nhập; F -> đánh giá từng chỗ (đa số là
  1 bước trong chuỗi `await`, tách qua bus sẽ phá chuỗi — cần thiết kế riêng, hỏi lại trước khi viết code).

## 5. Thứ tự & đầu ra

`1 → 2 → 3 → 4 → 5 → (6 sau khi chốt)`

- EQ trước: vừa sửa xong, nhỏ, cấu trúc giống Custom Effect nhất — kiểm chứng khuôn W1–W3.
- 2, 3 nhỏ và độc lập, gom được nếu Giang muốn.
- 4, 5 có tương tác phức tạp (kéo-thả, màn con) — để sau khi khuôn đã ổn.

Mỗi đợt:
- `node --check` mọi file đổi; patch zip chỉ chứa file đổi, nâng `?v=` trong index.html (và subtitle-editor.html /
  video-editor.html nếu file có nạp ở đó).
- Gạch mục tương ứng trong bảng nợ ở core-legacy-audit.md.
- Thêm log Rule 4 còn thiếu ở method bị đụng (vd ghi state trong EQ đã có từ patch 07/10).

## 6. Cần Giang chốt trước khi bắt đầu

1. **Nhóm D** (ô nhập trong modal chỉ ghi draft cục bộ, chưa đụng state): coi là Listener hợp lệ của chính modal
   động (ghi miễn trừ), hay chuyển qua Listener -> Router?
2. **Nhóm F** (chờ mốc `{once:true}` của media/recorder trong chuỗi `await`): ghi thành miễn trừ chính thức trong
   `event-bus-flow.md` mục 1, hay sửa? `recorder.js:299` (`track.ended`, đã qua bus) xếp vào nhóm C hay F?
3. **`subtitle-editor.js`** (15 chỗ, trang riêng): có đưa vào plan này không?
4. **Nhịp:** giao từng đợt (test máy xong mới sang đợt sau) hay gộp đợt 1–3 thành 1 patch?
