# Sổ vi phạm kiến trúc — core rule, event bus, taskManager

> **Thay toàn bộ nội dung cũ** (bản audit 12/07/2026 và các mục nợ ghi thêm sau đó đã xoá hẳn). Đây là bản markdown của
> sổ vi phạm lập **07/10/2026 (chốt v13)** trên `sav-13-full-res`: gộp kết quả máy quét `architecture-audit.js` với review
> tay toàn bộ, kể cả phần máy quét bỏ sót. Khi máy quét và review mâu thuẫn, **review thắng**.
>
> Nguồn chuẩn: [event-bus-flow.md](./event-bus-flow.md), [core-function-conventions.md](./core-function-conventions.md),
> [task-manager-conventions.md](./task-manager-conventions.md). **Nợ cũ vẫn là FAIL** — không có miễn trừ "di sản";
> chính sách "chỉ sửa khi đụng tới" (Rule 0.5) chỉ quyết định *khi nào* sửa, không biến vi phạm thành hợp lệ.
>
> Cập nhật sổ: sửa xong 1 dòng thì xoá dòng đó; phát hiện mới thì thêm vào đúng bảng. Số dòng (`file:dòng`) là vị trí tại mốc
> 07/10/2026 — lệch dần khi file bị sửa, tra theo tên hàm.

## 1. Tổng quan

- **1312 FAIL** ở **142 file**; 10 chờ chốt; 874 dòng máy quét báo nhưng review loại (mục 5).

| Tầng | File vi phạm | Hàm / đơn vị vi phạm | Dòng code nằm trong hàm vi phạm |
|---|---|---|---|
| Core | 69 / 149 (46,3%) | 223 / 1172 (19,0%) | 2261 / 9398 (24,1%) |
| Workflow | 69 / 81 (85,2%) | 541 / 1619 (33,4%) | 3733 / 8957 (41,7%) |
| Router | 1 / 43 (2,3%) | 1 / 473 (0,2%) | 21 / 2222 (0,9%) |
| Listener | 3 / 37 (8,1%) | 9 / 318 (2,8%) | 22 / 1167 (1,9%) |
| Bus/Block/VM/Store | 0 / 5 (0,0%) | 0 / 6 (0,0%) | 0 / 150 (0,0%) |
| **Tổng** | 142 / 315 (45,1%) | 774 / 3588 (21,6%) | 6037 / 21894 (27,6%) |

Đơn vị: hàm ngoài cùng ở core/workflow (mỗi method của object workflow tính riêng; bỏ arrow trong bảng object map), từng `case` ở router, từng lệnh gắn sự kiện ở listener. Dòng code = dòng có mã thật (không tính dòng trống, dòng chỉ có comment). Không gồm `components/`, `service/`, `core/workers/`.

## 2. Cách chấm

- **Rule 1 (core) và §7 (workflow) — chấm theo nội dung nhánh, không xét điều kiện.** PASS khi nhánh chỉ dừng sớm (guard), chỉ tính giá trị vào biến cục bộ, chỉ kiểm tra phần tử tồn tại (`if (el) el.x()`), hoặc mọi nhánh ghi **đúng cùng tập vị trí** (thuộc tính, class, lời gọi, field của object kết quả) và chỉ khác giá trị. Lệch một vị trí là FAIL. `VirtualMachineState.run()` hay object map dùng trong core cũng là rẽ nhánh (Rule 1).
- **Switch A/B trên cùng một đối tượng** (play/pause, mở/đóng, hiện/ẩn, bật/tắt task, chọn/bỏ chọn, nạp/gỡ nền) và `if` bật/tắt một bước là **1 nghiệp vụ, không vi phạm** (Giang chốt 07/10/2026). Áp cho cả core lẫn workflow. Chỉ áp khi đúng là chuyển trạng thái A↔B; chọn hình vẽ, chọn luật tính, `moveTo`/`lineTo`, migrate dữ liệu… vẫn FAIL.
- **Guard có kèm việc rồi return:** chỉ báo lỗi (`alertModal`, `_showFatalError`…) rồi thoát = guard, PASS. Dọn/huỷ/đổi state rồi thoát, hoặc chuyển sang tiến trình khác (`back()`, `goToNextTrack()`, `_abortSeekGate()`…) rồi thoát = FAIL.
- **Listener:** ủy quyền bằng `closest()`/bảng tuyến rồi `eventBus.send` là hợp lệ. Đọc `appState`, sửa DOM, gọi Workflow/Core là vi phạm.
- **Rule 5a:** chỉ file `-ui.js` được gắn sự kiện; callback chỉ `eventBus.send` (được tính payload, `preventDefault`); listener gom cuối hàm (lệnh tra phần tử và `return` xen giữa không tính). Miễn đúng danh sách đã audit và `modalChoice()`. Gán `.onX =` tính như `addEventListener`.
- **Rule 3a:** mọi lời gọi hàm core khác, kể cả cùng file và lúc nạp file; trừ hàm con lồng của chính nó và `iconSvg()` từ file `-ui`.
- **Rule 5d:** mọi chuỗi markup HTML trong core thuộc `render*()` ở `components/` (tiền lệ 07/10/2026 dời HTML Playlist).
- **Workflow tự chứa nghiệp vụ:** Workflow chỉ chuẩn bị (đọc state, gọi service) và điều phối (chọn core/workflow, `taskManager`, ghi state, gửi bus). Tự ghi DOM, điều khiển media, vẽ canvas, dựng markup hay **tự tính toán** (kể cả phép nhỏ, kể cả hot path visualizer) là việc thi hành → FAIL. Hướng sửa: core thuần trả về nhiều kết quả một lần.
- **Workflow ≥2 key `appState`:** một lần thực thi method cần ≥2 giá trị thì phải gộp `appState.get([...])` (§4B).
- **Web Worker** (`core/workers/`) nằm ngoài kiến trúc, không tính (Giang chốt 07/10/2026).
- **Chờ chốt:** `requestAnimationFrame` thô — §1 task-manager-conventions.md chỉ ghi `setTimeout`/`setInterval`.

## 3. Tổng hợp theo rule

| Nhóm | Rule | FAIL | Chờ chốt |
|---|---|---|---|
| Core rule | Rule 1 — rẽ nhánh nghiệp vụ | 33 |  |
| Core rule | Rule 2 — Core tự appState.get() | 43 |  |
| Core rule | Rule 3a — Core gọi Core | 195 |  |
| Core rule | Rule 3b — Core tự đọc DB/service | 37 |  |
| Core rule | Rule 3b — Core tự đọc nguồn khác | 29 |  |
| Core rule | Rule 4 — ghi state thiếu console.log | 24 |  |
| Core rule | Rule 5a — Core gắn sự kiện | 72 |  |
| Core rule | Rule 5c — thiếu hậu tố -ui | 5 |  |
| Core rule | Rule 5d — template HTML trong core | 55 |  |
| Event bus | Listener gọi thẳng Workflow | 1 |  |
| Event bus | Listener làm việc ngoài eventBus.send | 1 |  |
| Event bus | Listener đọc appState | 7 |  |
| Event bus | Router tự chuẩn bị dữ liệu | 1 |  |
| Event bus | Workflow tự dựng template HTML | 20 |  |
| Event bus | Workflow tự gắn sự kiện | 73 |  |
| Event bus | Workflow tự thao tác DOM | 214 |  |
| Event bus | Workflow tự tính toán | 123 |  |
| Event bus | Workflow tự vẽ canvas | 14 |  |
| Event bus | Workflow tự điều khiển media | 49 |  |
| Event bus | Workflow §7: rẽ nhánh không dùng object map | 108 |  |
| Event bus | Workflow: ≥2 key không gộp get([…]) | 184 |  |
| TaskManager | Timer thô | 13 |  |
| TaskManager | requestAnimationFrame thô |  | 10 |
| TaskManager | taskManager dùng trong Core | 11 |  |
| **Tổng** | | **1312** | **10** |

## 4. Chi tiết

Cột "Nợ cũ": file đã có trong bản sổ nợ trước (12/07/2026) hay chưa — chỉ để xếp thứ tự xử lý.

### 4.1 Core rule

#### Rule 1 — rẽ nhánh nghiệp vụ (33)

| Vị trí | Hàm | Mô tả | Trạng thái | Nguồn | Nợ cũ | Ghi chú |
|---|---|---|---|---|---|---|
| `core/color-utils.js:152` | `updatePlaylistBg` | if-elseif: nhánh ghi/gọi khác chỗ — {set appBgImage.style.backgroundImage, set appBgBlurLayer.style.backgroundImage} / {set appBgBlurLayer.style.backgroundImage, set appBgImage.style.backgroundImage} / {set appBgBlurLayer.style.backgroundImage, set appBgImage.style.backgroundImage} | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/config.js:867` | `<anon>` | if-return: nhánh ghi/gọi khác chỗ — {set cfg.bgImage, set cfg.bgVideo} / {set cfg.bgImage, set cfg.bgVideo} | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/config.js:1029` | `<anon>` | if-elseif: nhánh ghi/gọi khác chỗ — {set cfg.autoSwitchVisualTimeMode, set cfg.autoSwitchVisualFixedKind} / {set cfg.autoSwitchVisualTimeMode} / {} | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/custom-effect.js:383` | `<anon>` | if-return: nhánh ghi/gọi khác chỗ — {set bucket[]} / {set byStyle[], set bucket.byStyle} | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/dropdown-menu.js:119` | `closeDropdownMenu` | if-return: nhánh ghi/gọi khác chỗ — {call overlay.remove} / {call overlay.remove, set menu.style.opacity} | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/element-style-editor.js:127` | `<anon>` | if-elseif: nhánh ghi/gọi khác chỗ — {set patch.box[]} / {set patch.box[]} / {set patch.box.background} | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/file-manager/folder.js:164` | `addSongsToFolder` | VirtualMachineState.run() ngay trong core: membershipState 'new' / 'tombstoned' / … → ghi folder/folderMap theo cách khác nhau | FAIL | Review (máy quét bỏ sót) | Có | VMState chỉ dành cho Router/Workflow; trong core là bảng chọn tiến trình = Rule 1 |
| `core/gameplay/engine.js:36` | `computeComboScoreGain` | if-return: nhánh ghi/gọi khác chỗ — {set resetAll[]} / {set newComboByTier[], set newComboByTier[]]} | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/modal-choice-ui.js:251` | `modalChoice` | if-else: nhánh ghi/gọi khác chỗ — {call _appendDropdownRow} / {call _appendButtonRow} | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/photo-editor-engine.js:250` | `drawShapeOnCanvas` | if-elseif: nhánh ghi/gọi khác chỗ — {call ctx.fillRect, call ctx.strokeRect} / {call ctx.beginPath, call ctx.ellipse} / {call ctx.beginPath, call ctx.moveTo} | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/photo-editor-engine.js:283` | `drawShapeOnCanvas` | if-else: nhánh ghi/gọi khác chỗ — {call ctx.moveTo} / {call ctx.lineTo} | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/rubik-math.js:16` | `<anon>` | if-elseif: nhánh ghi/gọi khác chỗ — {set rc.cy, set rc.cz} / {set rc.cx, set rc.cz} / {set rc.cx, set rc.cy} | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/streaming-zip.js:375` | `<anon>` | if-elseif: nhánh ghi/gọi khác chỗ — {call onProgress, call sendNextEntry} / {call worker.terminate} / {call worker.terminate} | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/subtitle/subtitle-karaoke-display-ui.js:42` | `<anon>` | if-return: nhánh ghi/gọi khác chỗ — {call block.appendChild, call document.createElement} / {call block.appendChild, call document.createElement} | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/subtitle/subtitle-karaoke-display-ui.js:43` | `<anon>` | if-return: nhánh ghi/gọi khác chỗ — {call block.appendChild} / {call document.createElement, set el.className} | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/subtitle/subtitles-ui.js:77` | `buildLineCard` | if-else: nhánh ghi/gọi khác chỗ — {call document.createElement, set textInput.type} / {call document.createElement, set textInput.className} | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/subtitle/subtitles-ui.js:105` | `buildLineCard` | if-else: nhánh ghi/gọi khác chỗ — {call document.createElement, set startBtn.type} / {call document.createElement, set startBtn.className} | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/subtitle/subtitles-ui.js:166` | `buildLineCard` | if-else: nhánh ghi/gọi khác chỗ — {call document.createElement, set cancelBtn.type} / {call document.createElement, set removeBtn.type} | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/subtitle/subtitles-ui.js:192` | `buildLineCard` | if-elseif: nhánh ghi/gọi khác chỗ — {call card.addEventListener} / {call startBtn.addEventListener, call endBtn.addEventListener} / {} | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/video-editor/filmstrip.js:40` | `buildCutFilmstripFrames` | if-return: nhánh ghi/gọi khác chỗ — {call input.dispose} / {call onProgress, call document.createElement} | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/video-editor/filmstrip.js:52` | `buildCutFilmstripFrames` | if-return: nhánh ghi/gọi khác chỗ — {call onProgress} / {call document.createElement, set out.width} | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/video-editor/webcodecs-engine.js:138` | `processVideo` | if-elseif: nhánh ghi/gọi khác chỗ — {set video.process, set video.processedWidth} / {set video.rotate, set video.flip} / {} | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/visualizer/groups/bar/black-hole.js:506` | `<anon>` | ternary: nhánh ghi/gọi khác chỗ — {call ctx.moveTo, call px} / {call ctx.lineTo, call px} | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/visualizer/groups/bar/common.js:33` | `<anon>` | if-else: nhánh ghi/gọi khác chỗ — {call ctx.fillRect} / {call ctx.beginPath, call ctx.roundRect} | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/visualizer/groups/bar/dot.js:378` | `paintDotAxisDot` | if-return: nhánh ghi/gọi khác chỗ — {set ctx.strokeStyle, set ctx.lineWidth} / {set ctx.fillStyle, call ctx.beginPath} | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/visualizer/groups/bar/dot.js:444` | `stepDotDnaPairs` | if-else: nhánh ghi/gọi khác chỗ — {set bonds[]} / {set levels[]} | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/visualizer/groups/lighting/fireworks.js:165` | `<anon>` | ternary: nhánh ghi/gọi khác chỗ — {call ctx.moveTo} / {call ctx.lineTo} | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/visualizer/groups/rain/street.js:170` | `advanceAndDrawRainRipples` | if-else: nhánh ghi/gọi khác chỗ — {call appState.mutate:'ripples'} / {call ctx.beginPath, call ctx.ellipse} | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/visualizer/groups/shape/clock.js:465` | `paintClockGear` | if-elseif: nhánh ghi/gọi khác chỗ — {call ctx.beginPath, call ctx.arc} / {set ctx.globalAlpha, call ctx.beginPath} / {} | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/visualizer/groups/shape/clock.js:488` | `paintClockGear` | if-else: nhánh ghi/gọi khác chỗ — {call ctx.moveTo} / {call ctx.lineTo} | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/visualizer/groups/shape/clock.js:552` | `paintClockBalance` | if-else: nhánh ghi/gọi khác chỗ — {call ctx.moveTo} / {call ctx.lineTo} | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/wakelock.js:33` | `requestWakeLock` | if-return: nhánh ghi/gọi khác chỗ — {call _enableNoSleepFallback} / {set _wakeLockRequestPending, call appState.set:'nativeWakeLock'} | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/webgl/three-connector.js:452` | `triggerCinematicCameraShift` | if-elseif: ORBIT/CLOSE animate camera.position + target, TRACK chỉ target | FAIL | Review (máy quét bỏ sót) | Có |  |

#### Rule 2 — Core tự appState.get() (43)

| Vị trí | Hàm | Mô tả | Trạng thái | Nguồn | Nợ cũ | Ghi chú |
|---|---|---|---|---|---|---|
| `core/loading-shield-util.js:18` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Có |  |
| `core/photo-player.js:115` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Không |  |
| `core/photo-player.js:131` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Không |  |
| `core/photo-player.js:134` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Không |  |
| `core/player-controls.js:390` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Có |  |
| `core/player-controls.js:391` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Có |  |
| `core/player-controls.js:515` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Có |  |
| `core/player-controls.js:515` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Có |  |
| `core/player-controls.js:528` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Có |  |
| `core/player-controls.js:528` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Có |  |
| `core/player-controls.js:528` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Có |  |
| `core/player-controls.js:529` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Có |  |
| `core/player-controls.js:546` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Có |  |
| `core/playlist/actions.js:97` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Có |  |
| `core/playlist/actions.js:129` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Có |  |
| `core/playlist/actions.js:129` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Có |  |
| `core/playlist/actions.js:129` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Có |  |
| `core/playlist/actions.js:168` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Có |  |
| `core/playlist/main.js:181` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Có |  |
| `core/playlist/main.js:186` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Có |  |
| `core/storage-manager.js:283` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Có |  |
| `core/storage-manager.js:400` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Có |  |
| `core/storage-manager.js:493` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Có |  |
| `core/video-player.js:86` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Không |  |
| `core/video-player.js:98` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Không |  |
| `core/video-player.js:99` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Không |  |
| `core/visual-bg-common.js:233` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Không |  |
| `core/visual-bg-common.js:234` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Không |  |
| `core/visualizer/draw/window-frame.js:8` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Không |  |
| `core/visualizer/draw/window-frame.js:8` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Không |  |
| `core/visualizer/draw/window-frame.js:15` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Không |  |
| `core/visualizer/draw/window-frame.js:16` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Không |  |
| `core/visualizer/draw/window-frame.js:17` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Không |  |
| `core/visualizer/draw/window-frame.js:17` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Không |  |
| `core/visualizer/draw/window-frame.js:20` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Không |  |
| `core/visualizer/draw/window-frame.js:20` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Không |  |
| `core/visualizer/draw/window-frame.js:20` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Không |  |
| `core/visualizer/effect-paint.js:22` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Có |  |
| `core/visualizer/effect-paint.js:47` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Có |  |
| `core/visualizer/visualizer-display.js:118` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Có |  |
| `core/wakelock.js:34` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Có |  |
| `core/wakelock.js:54` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Có |  |
| `core/wakelock.js:54` |  | appState.get() trong core — phải nhận qua tham số | FAIL | Máy quét | Có |  |

#### Rule 3a — Core gọi Core (195)

| Vị trí | Hàm | Mô tả | Trạng thái | Nguồn | Nợ cũ | Ghi chú |
|---|---|---|---|---|---|---|
| `core/app-panel-nav.js:27` | `setAppPanelNavActiveTab` | gọi resolveUiThemeClass() (core/ui-theme/registry.js) | FAIL | Máy quét | Không |  |
| `core/app-panel-nav.js:30` | `setAppPanelNavActiveTab` | gọi resolveUiThemeClass() (core/ui-theme/registry.js) | FAIL | Máy quét | Không |  |
| `core/app-settings-ui.js:116` | `wireAppSettingsSystem` | gọi wireAppSettingsMain() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/auto-switch-visual.js:227` | `initAutoSwitchCycleButtonFromConfig` | gọi updateCycleModeButtonState() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/auto-switch-visual.js:228` | `initAutoSwitchCycleButtonFromConfig` | gọi updateVisualizerTypeSelectState() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/color-utils.js:15` | `interpolateColor` | gọi hexToRgb() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/color-utils.js:15` | `interpolateColor` | gọi hexToRgb() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/color-utils.js:48` | `updateDOMBackground` | gọi buildVisualBgGradientCss() (core/visual-bg-common.js) | FAIL | Máy quét | Có |  |
| `core/color-utils.js:249` | `buildCanvasLinearGradient` | gọi computeCssGradientLine() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/config.js:780` | `<lúc nạp file>` | gọi seedConfig() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có | Gọi lúc nạp file (top-level) |
| `core/config.js:818` | `saveConfig` | gọi scheduleConfigBackup() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/config.js:865` | `loadPlaylistBgMediaAsset` | gọi resolveAppBgMedia() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/config.js:1066` | `loadConfig` | gọi normalizeAutoSwitchGroupList() (core/auto-switch-visual.js) | FAIL | Máy quét | Có |  |
| `core/config.js:1067` | `loadConfig` | gọi normalizeAutoSwitchStyleList() (core/auto-switch-visual.js) | FAIL | Máy quét | Có |  |
| `core/config.js:1088` | `loadConfig` | gọi loadPlaylistBgMediaAsset() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/config.js:1089` | `loadConfig` | gọi saveConfig() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/config.js:1090` | `loadConfig` | gọi updatePlaylistBg() (core/color-utils.js) | FAIL | Máy quét | Có |  |
| `core/config.js:1116` | `loadConfig` | gọi syncSpeedHudUI() (core/hud.js) | FAIL | Máy quét | Có |  |
| `core/config.js:1133` | `loadConfig` | gọi updateDOMBackground() (core/color-utils.js) | FAIL | Máy quét | Có |  |
| `core/config.js:1133` | `loadConfig` | gọi updatePlaylistBg() (core/color-utils.js) | FAIL | Máy quét | Có |  |
| `core/config.js:1133` | `loadConfig` | gọi updateProgressBarCSS() (core/visualizer/visualizer-display.js) | FAIL | Máy quét | Có |  |
| `core/config.js:1141` | `loadConfig` | gọi initAutoSwitchCycleButtonFromConfig() (core/auto-switch-visual.js) | FAIL | Máy quét | Có |  |
| `core/config.js:1145` | `loadConfig` | gọi setBottomPlayerVisible() (core/visualizer-ui-visibility.js) | FAIL | Máy quét | Có |  |
| `core/config.js:1146` | `loadConfig` | gọi setPlaylistButtonVisible() (core/visualizer-ui-visibility.js) | FAIL | Máy quét | Có |  |
| `core/config.js:1147` | `loadConfig` | gọi setControlCenterButtonVisible() (core/visualizer-ui-visibility.js) | FAIL | Máy quét | Có |  |
| `core/custom-effect.js:368` | `getActiveEffectConfig` | gọi getEffectConfig() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/custom-effect.js:395` | `getEffectBlurMult` | gọi getEffectConfig() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/custom-effect.js:402` | `getConnectorGlowMult` | gọi getEffectConfig() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/dropdown-menu.js:37` | `openDropdownMenu` | gọi _removeDropdownMenuImmediately() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/dropdown-menu.js:61` | `openDropdownMenu` | gọi closeDropdownMenu() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/dropdown-menu.js:72` | `openDropdownMenu` | gọi applyUiThemeToDom() (core/ui-theme/apply-ui.js) | FAIL | Máy quét | Không |  |
| `core/element-style-editor.js:184` | `applyElementStyleCssStringToDraft` | gọi parseElementStyleCssString() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/file-manager/cleanup.js:163` | `<lúc nạp file>` | gọi registerCleanupCheck() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có | Gọi lúc nạp file (top-level) |
| `core/file-manager/cleanup.js:164` | `<lúc nạp file>` | gọi registerCleanupCheck() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có | Gọi lúc nạp file (top-level) |
| `core/file-manager/cleanup.js:206` | `<lúc nạp file>` | gọi registerCleanupCheck() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có | Gọi lúc nạp file (top-level) |
| `core/file-manager/folder-picker-ui.js:63` | `openRenameFolderModal` | gọi applyUiThemeToDom() (core/ui-theme/apply-ui.js) | FAIL | Máy quét | Có |  |
| `core/file-manager/photo-ui.js:53` | `syncEditCanvasDisplaySize` | gọi computeCoverOrContain() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/file-manager/photo-ui.js:302` | `openImagePreviewModal` | gọi computeCoverOrContain() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/gameplay/circle-mode.js:243` | `findAvailableCell` | gọi rotateNeighborOffset90() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/hud.js:19` | `syncVolumeHudIcon` | gọi resolveVolumeIconLevel() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/hud.js:93` | `syncSpeedHudUI` | gọi syncSpeedHudSliderFill() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/hud.js:94` | `syncSpeedHudUI` | gọi formatPlaybackSpeedLabel() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/hud.js:96` | `syncSpeedHudUI` | gọi formatPlaybackSpeedLabel() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/info-icon-ui.js:46` | `infoIconHtml` | gọi escapeHtml() (core/modal-choice-ui.js) | FAIL | Máy quét | Không |  |
| `core/info-icon-ui.js:93` | `showInfoPopover` | gọi applyUiThemeToDom() (core/ui-theme/apply-ui.js) | FAIL | Máy quét | Không |  |
| `core/modal-choice-ui.js:114` | `alertModal` | gọi modalChoice() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/modal-choice-ui.js:147` | `_appendButtonRow` | gọi _buildCancelButton() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/modal-choice-ui.js:187` | `_appendDropdownRow` | gọi _buildCancelButton() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/modal-choice-ui.js:251` | `modalChoice` | gọi _appendDropdownRow() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/modal-choice-ui.js:252` | `modalChoice` | gọi _appendButtonRow() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/modal-choice-ui.js:268` | `modalChoice` | gọi applyUiThemeToDom() (core/ui-theme/apply-ui.js) | FAIL | Máy quét | Có |  |
| `core/motion-presets.js:171` | `buildBlankPointMove` | gọi generatePointMoveId() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/motion-presets.js:174` | `buildBlankPointMove` | gọi buildBlankPointMoveField() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/motion-presets.js:175` | `buildBlankPointMove` | gọi buildBlankPointMoveField() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/motion-presets.js:176` | `buildBlankPointMove` | gọi buildBlankPointMoveField() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/motion-presets.js:177` | `buildBlankPointMove` | gọi buildBlankPointMoveField() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/motion-presets.js:178` | `buildBlankPointMove` | gọi buildBlankPointMoveField() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/motion-presets.js:179` | `buildBlankPointMove` | gọi buildBlankPointMoveField() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/motion-presets.js:192` | `buildBlankMotionPreset` | gọi generateMotionPresetId() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/motion-presets.js:206` | `buildBlankMotionPreset` | gọi buildBlankPointMove() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/motion-presets.js:277` | `sanitizeMotionPreset` | gọi buildBlankMotionPreset() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/motion-presets.js:281` | `sanitizeMotionPreset` | gọi sanitizeMotionPointMoves() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/motion-presets.js:303` | `sanitizeMotionPreset` | gọi sanitizeMotionBeatReact() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/motion-presets.js:315` | `sanitizeMotionPointMoves` | gọi sanitizePointMove() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/motion-presets.js:315` | `sanitizeMotionPointMoves` | gọi buildBlankPointMove() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/motion-presets.js:324` | `sanitizePointMove` | gọi buildBlankPointMove() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/motion-presets.js:331` | `sanitizePointMove` | gọi sanitizePointMoveLinearField() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/motion-presets.js:332` | `sanitizePointMove` | gọi sanitizePointMoveLinearField() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/motion-presets.js:333` | `sanitizePointMove` | gọi sanitizePointMoveField() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/motion-presets.js:334` | `sanitizePointMove` | gọi sanitizePointMoveField() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/motion-presets.js:335` | `sanitizePointMove` | gọi sanitizePointMoveField() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/motion-presets.js:336` | `sanitizePointMove` | gọi sanitizePointMoveField() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/photo-player.js:76` | `updatePhotoPlayerTimeLabels` | gọi formatTime() (core/playlist/state.js) | FAIL | Máy quét | Không |  |
| `core/photo-player.js:77` | `updatePhotoPlayerTimeLabels` | gọi formatTime() (core/playlist/state.js) | FAIL | Máy quét | Không |  |
| `core/photo-player.js:120` | `<lúc nạp file>` | gọi computePhotoPlayerElapsedSec() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không | Gọi lúc nạp file (top-level) |
| `core/player-controls.js:307` | `applyPlaybackSpeedToActiveMedia` | gọi getActiveMediaElement() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/player-controls.js:368` | `toggleShuffle` | gọi syncShuffleUI() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/player-controls.js:391` | `cycleRepeatMode` | gọi syncRepeatUI() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/player-controls.js:514` | `handleAudioLoadedMetadata` | gọi formatTime() (core/playlist/state.js) | FAIL | Máy quét | Có |  |
| `core/player-controls.js:514` | `handleAudioLoadedMetadata` | gọi updateMediaPositionState() (cùng file) | FAIL | Máy quét | Có |  |
| `core/player-controls.js:515` | `handleAudioLoadedMetadata` | gọi applyPlaybackSpeedToActiveMedia() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/player-controls.js:529` | `handleAudioError` | gọi handlePlaybackError() (core/playlist/actions.js) | FAIL | Máy quét | Có |  |
| `core/player-controls.js:546` | `handleAudioTimeUpdate` | gọi updateProgressBarCSS() (core/visualizer/visualizer-display.js) | FAIL | Máy quét | Có |  |
| `core/player-controls.js:546` | `handleAudioTimeUpdate` | gọi formatTime() (core/playlist/state.js) | FAIL | Máy quét | Có |  |
| `core/player-controls.js:547` | `handleAudioTimeUpdate` | gọi updateMediaPositionState() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/player-controls.js:566` | `handleProgressBarSeeking` | gọi formatTime() (core/playlist/state.js) | FAIL | Máy quét | Có |  |
| `core/player-controls.js:566` | `handleProgressBarSeeking` | gọi updateProgressBarCSS() (core/visualizer/visualizer-display.js) | FAIL | Máy quét | Có |  |
| `core/player-controls.js:576` | `handleProgressBarSeekCommit` | gọi updateMediaPositionState() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/player-display-apply.js:54` | `applyVideoPlayerResolutionToDOM` | gọi resolvePlayerObjectFitCss() (core/player-display-settings.js) | FAIL | Máy quét | Không |  |
| `core/player-display-apply.js:94` | `applyVideoPlayerResolutionToLayerBDOM` | gọi resolvePlayerBackgroundSizeCss() (core/player-display-settings.js) | FAIL | Máy quét | Không |  |
| `core/player-display-apply.js:111` | `computePhotoPlayerBackgroundSizeCss` | gọi resolvePlayerBackgroundSizeCss() (core/player-display-settings.js) | FAIL | Máy quét | Không |  |
| `core/player-display-apply.js:162` | `detachVideoPlayerMotionFromSharedReactLayer` | gọi resetMotionEngineLayerClasses() (core/motion-engine.js) | FAIL | Máy quét | Không |  |
| `core/player-display-apply.js:166` | `detachVideoPlayerMotionFromSharedReactLayer` | gọi resetMotionEngineLayerClasses() (core/motion-engine.js) | FAIL | Máy quét | Không |  |
| `core/playlist/actions.js:207` | `<lúc nạp file>` | gọi attachCoverFallback() (core/playlist/render.js) | FAIL | Máy quét | Có | Gọi lúc nạp file (top-level) |
| `core/playlist/actions.js:291` | `closeSongEditModal` | gọi revokeSongEditPendingPreview() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/playlist/actions.js:306` | `changeSongEditCover` | gọi validateImageFile() (core/upload-validation.js) | FAIL | Máy quét | Có |  |
| `core/playlist/actions.js:308` | `changeSongEditCover` | gọi revokeSongEditPendingPreview() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/playlist/actions.js:311` | `changeSongEditCover` | gọi setSongEditCoverPreview() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/playlist/actions.js:317` | `removeSongEditCover` | gọi revokeSongEditPendingPreview() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/playlist/actions.js:319` | `removeSongEditCover` | gọi setSongEditCoverPreview() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/playlist/filter-presets.js:72` | `sanitizePlaylistFilterPresetsMap` | gọi sanitizePlaylistFilterPresets() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/playlist/filter-presets.js:73` | `sanitizePlaylistFilterPresetsMap` | gọi sanitizePlaylistFilterPresets() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/playlist/filter-presets.js:74` | `sanitizePlaylistFilterPresetsMap` | gọi sanitizePlaylistFilterPresets() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/playlist/filter-presets.js:85` | `sanitizePlaylistFilterActiveIdMap` | gọi findPlaylistFilterPresetById() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/playlist/filter.js:170` | `applyPlaylistFilter` | gọi _startOfLocalDayMs() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/playlist/filter.js:176` | `applyPlaylistFilter` | gọi _evaluateFilterRule() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/playlist/loader.js:214` | `buildAdaptedPlaylistCache` | gọi stripFileExtension() (core/file-manager/video.js) | FAIL | Máy quét | Có |  |
| `core/playlist/loader.js:226` | `buildAdaptedPlaylistCache` | gọi normalizeSongName() (core/song-search.js) | FAIL | Máy quét | Có |  |
| `core/playlist/loader.js:301` | `buildSongPlaylistCache` | gọi normalizeSongName() (core/song-search.js) | FAIL | Máy quét | Có |  |
| `core/playlist/main.js:181` | `<lúc nạp file>` | gọi PlaylistMain.initViewMode() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có | Gọi lúc nạp file (top-level) |
| `core/playlist/main.js:186` | `<lúc nạp file>` | gọi PlaylistMain.initMediaSource() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có | Gọi lúc nạp file (top-level) |
| `core/settings-carousel-ui.js:69` | `_applySettingsCarouselFocusStyles` | gọi _measureSettingsCarousel() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/settings-carousel-ui.js:107` | `initSettingsCarousel` | gọi _setSettingsCarouselScrollLeftInstant() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/settings-carousel-ui.js:107` | `initSettingsCarousel` | gọi _getSettingsCarouselCenterScrollLeft() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/settings-carousel-ui.js:119` | `startSettingsCarouselEntrance` | gọi _applySettingsCarouselFocusStyles() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/settings-carousel-ui.js:133` | `updateSettingsCarouselFocus` | gọi _applySettingsCarouselFocusStyles() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/settings-carousel-ui.js:141` | `settleSettingsCarouselLoop` | gọi _measureSettingsCarousel() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/settings-carousel-ui.js:148` | `settleSettingsCarouselLoop` | gọi _setSettingsCarouselScrollLeftInstant() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/settings-carousel-ui.js:155` | `getSettingsCarouselFocusCard` | gọi _measureSettingsCarousel() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/settings-carousel-ui.js:163` | `scrollSettingsCarouselTo` | gọi _getSettingsCarouselCenterScrollLeft() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/slider-input-modal.js:146` | `openSliderInputModal` | gọi applyUiThemeToDom() (core/ui-theme/apply-ui.js) | FAIL | Máy quét | Không |  |
| `core/song-search.js:39` | `songMatchesQuery` | gọi normalizeSongName() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/song-search.js:40` | `songMatchesQuery` | gọi normalizeSongName() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/song-search.js:41` | `songMatchesQuery` | gọi normalizeSongName() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/statis-panel-ui.js:151` | `buildStatisPanelBodyHtml` | gọi formatListenTime() (core/listen-stats.js) | FAIL | Máy quét | Không |  |
| `core/statis-panel-ui.js:191` | `buildStatisPanelBodyHtml` | gọi formatListenTime() (core/listen-stats.js) | FAIL | Máy quét | Không |  |
| `core/statis-panel-ui.js:207` | `buildStatisPanelBodyHtml` | gọi buildStatisPlayShareChartHtml() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/statis-panel-ui.js:230` | `buildStatisPanelBodyHtml` | gọi formatListenTime() (core/listen-stats.js) | FAIL | Máy quét | Không |  |
| `core/statis-panel-ui.js:237` | `buildStatisPanelBodyHtml` | gọi escapeHtml() (core/modal-choice-ui.js) | FAIL | Máy quét | Không |  |
| `core/storage-manager.js:217` | `_compressZipEntries` | gọi isStreamingZipAvailable() (core/streaming-zip.js) | FAIL | Máy quét | Có |  |
| `core/storage-manager.js:222` | `_compressZipEntries` | gọi buildZipStreamingToOpfs() (core/streaming-zip.js) | FAIL | Máy quét | Có |  |
| `core/storage-manager.js:264` | `isRecordCorrupted` | gọi readAudioDuration() (core/playlist/loader.js) | FAIL | Máy quét | Có |  |
| `core/storage-manager.js:287` | `scanAllSongsForCorruption` | gọi isRecordCorrupted() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/storage-manager.js:404` | `scanAllVideosForCorruption` | gọi isVideoRecordCorrupted() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/storage-manager.js:438` | `renderScanResultUI` | gọi escapeHtml() (core/modal-choice-ui.js) | FAIL | Máy quét | Có |  |
| `core/storage-manager.js:438` | `renderScanResultUI` | gọi escapeHtml() (core/modal-choice-ui.js) | FAIL | Máy quét | Có |  |
| `core/storage-manager.js:497` | `scanAllPhotosForCorruption` | gọi isImageRecordCorrupted() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/streaming-zip.js:90` | `_ensureZipJsLoaded` | gọi _withTimeout() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/streaming-zip.js:149` | `buildZipStreamingToOpfs` | gọi _ensureZipJsLoaded() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/streaming-zip.js:166` | `buildZipStreamingToOpfs` | gọi _writeViaMainThread() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/streaming-zip.js:175` | `buildZipStreamingToOpfs` | gọi _withTimeout() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/streaming-zip.js:177` | `buildZipStreamingToOpfs` | gọi _writeViaWorker() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/streaming-zip.js:301` | `_writeViaMainThread` | gọi _withTimeout() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/streaming-zip.js:309` | `_writeViaMainThread` | gọi _addEntryWithStallGuard() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/streaming-zip.js:323` | `_writeViaMainThread` | gọi _withTimeout() (cùng file) | FAIL | Máy quét | Không |  |
| `core/streaming-zip.js:331` | `_writeViaMainThread` | gọi _withTimeout() (cùng file) | FAIL | Máy quét | Không |  |
| `core/streaming-zip.js:365` | `_writeViaWorker` | gọi _withTimeout() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/subtitle/subtitles-ui.js:102` | `buildLineCard` | gọi secToStr() (core/subtitle/subtitles.js) | FAIL | Máy quét | Có |  |
| `core/subtitle/subtitles-ui.js:103` | `buildLineCard` | gọi secToStr() (core/subtitle/subtitles.js) | FAIL | Máy quét | Có |  |
| `core/subtitle/subtitles-ui.js:197` | `buildLineCard` | gọi secToStr() (core/subtitle/subtitles.js) | FAIL | Máy quét | Có |  |
| `core/subtitle/subtitles-ui.js:197` | `buildLineCard` | gọi secToStr() (core/subtitle/subtitles.js) | FAIL | Máy quét | Có |  |
| `core/subtitle/subtitles-ui.js:258` | `renderSubtitleLines` | gọi buildLineCard() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/subtitle/subtitles.js:45` | `parseSRT` | gọi strToSec() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/subtitle/subtitles.js:45` | `parseSRT` | gọi strToSec() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/subtitle/subtitles.js:70` | `createSubtitleLine` | gọi secToStr() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/subtitle/subtitles.js:70` | `createSubtitleLine` | gọi secToStr() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/subtitle/subtitles.js:85` | `computeUpdatedSubtitles` | gọi secToStr() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/subtitle/subtitles.js:86` | `computeUpdatedSubtitles` | gọi secToStr() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/subtitle/subtitles.js:114` | `shiftSubtitleTimes` | gọi secToStr() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/subtitle/subtitles.js:114` | `shiftSubtitleTimes` | gọi secToStr() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/theme-background-ui.js:103` | `buildThemeBackgroundCardsHtml` | gọi _themeBgCardUitk() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/theme-background-ui.js:104` | `buildThemeBackgroundCardsHtml` | gọi _themeBgPreviewStyle() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/theme-background-ui.js:118` | `buildThemeBackgroundCardsHtml` | gọi _themeGlassSliderHtml() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/theme-background-ui.js:119` | `buildThemeBackgroundCardsHtml` | gọi _themeGlassSliderHtml() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/theme-background-ui.js:155` | `patchThemeBackgroundCards` | gọi _themeBgCardUitk() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/theme-background-ui.js:159` | `patchThemeBackgroundCards` | gọi _themeBgPreviewStyle() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/theme-background-ui.js:181` | `patchThemeBackgroundCards` | gọi applyUiThemeToDom() (core/ui-theme/apply-ui.js) | FAIL | Máy quét | Không |  |
| `core/time-picker-modal.js:135` | `openTimePickerModal` | gọi parseTimePickerFormat() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/time-picker-modal.js:141` | `openTimePickerModal` | gọi computeTimePickerInitialIndices() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/time-picker-modal.js:318` | `openTimePickerModal` | gọi applyUiThemeToDom() (core/ui-theme/apply-ui.js) | FAIL | Máy quét | Không |  |
| `core/ui-theme/apply-ui.js:47` | `applyUiThemeToDom` | gọi resolveUiThemeClass() (core/ui-theme/registry.js) | FAIL | Máy quét | Không |  |
| `core/upload-validation.js:63` | `validateFileType` | gọi getFileExtension() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/upload-validation.js:69` | `validateAudioFile` | gọi validateFileType() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/upload-validation.js:72` | `validateImageFile` | gọi validateFileType() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/upload-validation.js:75` | `validateVideoFile` | gọi validateFileType() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/video-editor/opfs-temp.js:37` | `openVideoEditTempTarget` | gọi _withTimeoutVideoEditTemp() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/video-editor/webcodecs-engine.js:61` | `_mapCropRectToOutputFrame` | gọi _mapPointToOutputFrame() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/video-editor/webcodecs-engine.js:62` | `_mapCropRectToOutputFrame` | gọi _mapPointToOutputFrame() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/video-editor/webcodecs-engine.js:94` | `_buildCropProcess` | gọi _computeOutputFrameMatrix() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/video-editor/webcodecs-engine.js:140` | `processVideo` | gọi _mapCropRectToOutputFrame() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/video-editor/webcodecs-engine.js:141` | `processVideo` | gọi _buildCropProcess() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/video-player.js:50` | `setBgVideoElementForPlayerMode` | gọi setVideoBgGain() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/visual-bg-common.js:237` | `getVisualBgFillStyle` | gọi buildCanvasLinearGradient() (core/color-utils.js) | FAIL | Máy quét | Không |  |
| `core/visualizer-control-center.js:55` | `toggleControlCenter` | gọi closeControlCenter() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/visualizer-control-center.js:55` | `toggleControlCenter` | gọi openControlCenter() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/visualizer-control-center.js:59` | `handleControlCenterGridClick` | gọi closeControlCenter() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/visualizer-control-center.js:86` | `setVisualEnabled` | gọi saveConfig() (core/config.js) | FAIL | Máy quét | Có |  |
| `core/visualizer/effect-paint.js:22` | `getComputedColor` | gọi getActiveEffectConfig() (core/custom-effect.js) | FAIL | Máy quét | Có |  |
| `core/visualizer/effect-paint.js:28` | `getComputedColor` | gọi interpolateColor() (core/color-utils.js) | FAIL | Máy quét | Có |  |
| `core/visualizer/effect-paint.js:47` | `getActiveBlurMult` | gọi getActiveEffectConfig() (core/custom-effect.js) | FAIL | Máy quét | Có |  |
| `core/visualizer/groups/bar/black-hole.js:503` | `paintBlackHoleBurstBolt` | gọi createBlackHoleRayGradient() (cùng file) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/visualizer/visualizer-display.js:89` | `updateProgressBarCSS` | gọi getActiveEffectConfig() (core/custom-effect.js) | FAIL | Máy quét | Có |  |
| `core/visualizer/visualizer-display.js:149` | `openEffectPickerModal` | gọi modalChoice() (core/modal-choice-ui.js) | FAIL | Máy quét | Có |  |
| `core/wakelock.js:31` | `requestWakeLock` | gọi releaseWakeLock() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/wakelock.js:33` | `requestWakeLock` | gọi _enableNoSleepFallback() (cùng file) | FAIL | Review (máy quét bỏ sót) | Có |  |

#### Rule 3b — Core tự đọc DB/service (37)

| Vị trí | Hàm | Mô tả | Trạng thái | Nguồn | Nợ cũ | Ghi chú |
|---|---|---|---|---|---|---|
| `core/config.js:842` |  | getImageRecord() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/config.js:847` |  | getVideoRecord() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/config.js:890` |  | getMeta() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/file-manager/cleanup.js:89` |  | getAllFolderKeys() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/file-manager/cleanup.js:89` |  | getAllFolderSongKeys() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/file-manager/folder.js:38` |  | getMeta() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/file-manager/folder.js:42` |  | getFolderRecord() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/file-manager/folder.js:57` |  | getMeta() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/file-manager/folder.js:59` |  | getFolderRecord() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/file-manager/folder.js:78` |  | getFolderRecord() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/file-manager/folder.js:81` |  | getMeta() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/file-manager/folder.js:83` |  | getFolderRecord() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/file-manager/folder.js:134` |  | getAllFolderKeys() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/file-manager/folder.js:193` |  | getFolderSongMap() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/file-manager/folder.js:216` |  | getFolderSongMap() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/file-manager/folder.js:236` |  | getFolderSongMap() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/file-manager/folder.js:262` |  | getFolderRecord() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/file-manager/folder.js:276` |  | getFolderRecord() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/file-manager/folder.js:290` |  | getFolderRecord() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/file-manager/folder.js:304` |  | getFolderRecord() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/file-manager/folder.js:332` |  | getMeta() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/file-manager/folder.js:334` |  | getFolderRecord() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/file-manager/folder.js:337` |  | getFolderSongMap() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/file-manager/folder.js:352` |  | getMeta() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/file-manager/folder.js:354` |  | getFolderRecord() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/file-manager/folder.js:364` |  | getMeta() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/file-manager/folder.js:367` |  | getAllFolderKeys() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/file-manager/folder.js:368` |  | getFolderRecord() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/file-manager/folder.js:388` |  | getMeta() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/file-manager/folder.js:391` |  | getMeta() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/file-manager/folder.js:394` |  | getFolderRecord() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/storage-manager.js:277` |  | getAllSongKeys() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/storage-manager.js:282` |  | getSongRecord() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/storage-manager.js:394` |  | getAllVideoKeys() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/storage-manager.js:399` |  | getVideoRecord() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/storage-manager.js:487` |  | getAllImageKeys() — đọc DB trong core | FAIL | Máy quét | Có |  |
| `core/storage-manager.js:492` |  | getImageRecord() — đọc DB trong core | FAIL | Máy quét | Có |  |

#### Rule 3b — Core tự đọc nguồn khác (29)

| Vị trí | Hàm | Mô tả | Trạng thái | Nguồn | Nợ cũ | Ghi chú |
|---|---|---|---|---|---|---|
| `core/auto-switch-visual.js:190` | `updateCycleModeButtonState` | appConfigViz.getAll() — Core tự đọc AppConfig | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/auto-switch-visual.js:209` | `updateVisualizerTypeSelectState` | appConfigViz.getAll() — Core tự đọc AppConfig | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/color-utils.js:33` | `updateDOMBackground` | appConfigVisualBg.getAll() — Core tự đọc AppConfig | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/color-utils.js:111` | `updatePlaylistBg` | appConfigViz.getAll() — Core tự đọc AppConfig | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/config.js:817` | `saveConfig` | appConfigViz.getAll() — Core tự đọc AppConfig | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/config.js:826` | `flushConfigBackup` | appConfigViz.getAll() — Core tự đọc AppConfig | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/config.js:864` | `loadPlaylistBgMediaAsset` | appConfigViz.getAll() — Core tự đọc AppConfig | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/config.js:885` | `loadConfig` | localStorage.getItem() — Core tự đọc | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/config.js:885` | `loadConfig` | localStorage.getItem() — Core tự đọc | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/config.js:902` | `loadConfig` | appConfigViz.getAll() — Core tự đọc AppConfig | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/config.js:1116` | `loadConfig` | appConfigViz.getAll() — Core tự đọc AppConfig | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/config.js:1125` | `loadConfig` | appConfigViz.getAll() — Core tự đọc AppConfig | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/config.js:1125` | `loadConfig` | appConfigViz.getAll() — Core tự đọc AppConfig | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/config.js:1127` | `loadConfig` | appConfigViz.getAll() — Core tự đọc AppConfig | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/config.js:1145` | `loadConfig` | appConfigViz.getAll() — Core tự đọc AppConfig | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/config.js:1146` | `loadConfig` | appConfigViz.getAll() — Core tự đọc AppConfig | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/config.js:1147` | `loadConfig` | appConfigViz.getAll() — Core tự đọc AppConfig | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/custom-effect.js:355` | `getEffectConfig` | appConfigViz.getAll() — Core tự đọc AppConfig | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/custom-effect.js:368` | `getActiveEffectConfig` | appConfigViz.getAll() — Core tự đọc AppConfig | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/player-controls.js:515` | `handleAudioLoadedMetadata` | appConfigViz.getAll() — Core tự đọc AppConfig | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/playlist/actions.js:185` | `getAndClearPlaybackErrorKey` | playlistStore.get() — Core tự đọc EventStore | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/playlist/actions.js:214` | `revokeSongEditPendingPreview` | playlistStore.get() — Core tự đọc EventStore | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/playlist/actions.js:329` | `captureSongEditFormState` | playlistStore.get() — Core tự đọc EventStore | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/playlist/actions.js:335` | `captureSongEditFormState` | playlistStore.get() — Core tự đọc EventStore | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/playlist/actions.js:346` | `captureVideoEditFormState` | playlistStore.get() — Core tự đọc EventStore | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/playlist/actions.js:378` | `capturePhotoEditFormState` | playlistStore.get() — Core tự đọc EventStore | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/playlist/actions.js:382` | `capturePhotoEditFormState` | playlistStore.get() — Core tự đọc EventStore | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/visual-bg-common.js:231` | `getVisualBgFillStyle` | appConfigVisualBg.getAll() — Core tự đọc AppConfig | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/wakelock.js:31` | `requestWakeLock` | appConfigViz.getAll() — Core tự đọc AppConfig | FAIL | Review (máy quét bỏ sót) | Có |  |

#### Rule 4 — ghi state thiếu console.log (24)

| Vị trí | Hàm | Mô tả | Trạng thái | Nguồn | Nợ cũ | Ghi chú |
|---|---|---|---|---|---|---|
| `core/config.js:1131` |  | appState.set() không có console.log ngay statement kế tiếp. | FAIL | Máy quét | Có |  |
| `core/loading-shield-util.js:25` |  | appState.set() không có console.log ngay statement kế tiếp. | FAIL | Máy quét | Có |  |
| `core/loading-shield-util.js:52` |  | appState.set() không có console.log ngay statement kế tiếp. | FAIL | Máy quét | Có |  |
| `core/photo-player.js:40` |  | appState.set() không có console.log ngay statement kế tiếp. | FAIL | Máy quét | Không |  |
| `core/photo-player.js:46` |  | appState.set() không có console.log ngay statement kế tiếp. | FAIL | Máy quét | Không |  |
| `core/photo-player.js:127` |  | appState.set() không có console.log ngay statement kế tiếp. | FAIL | Máy quét | Không |  |
| `core/photo-player.js:128` |  | appState.set() không có console.log ngay statement kế tiếp. | FAIL | Máy quét | Không |  |
| `core/photo-player.js:137` |  | appState.set() không có console.log ngay statement kế tiếp. | FAIL | Máy quét | Không |  |
| `core/photo-player.js:140` |  | appState.set() không có console.log ngay statement kế tiếp. | FAIL | Máy quét | Không |  |
| `core/player-controls.js:390` |  | appState.set() không có console.log ngay statement kế tiếp. | FAIL | Máy quét | Có |  |
| `core/player-controls.js:566` |  | appState.set() không có console.log ngay statement kế tiếp. | FAIL | Máy quét | Có |  |
| `core/player-controls.js:576` |  | appState.set() không có console.log ngay statement kế tiếp. | FAIL | Máy quét | Có |  |
| `core/playlist/loader.js:202` |  | appState.mutate() không có console.log ngay statement kế tiếp. | FAIL | Máy quét | Có |  |
| `core/playlist/loader.js:225` |  | appState.mutate() không có console.log ngay statement kế tiếp. | FAIL | Máy quét | Có |  |
| `core/playlist/loader.js:226` |  | appState.mutate() không có console.log ngay statement kế tiếp. | FAIL | Máy quét | Có |  |
| `core/playlist/loader.js:285` |  | appState.mutate() không có console.log ngay statement kế tiếp. | FAIL | Máy quét | Có |  |
| `core/playlist/loader.js:292` |  | appState.mutate() không có console.log ngay statement kế tiếp. | FAIL | Máy quét | Có |  |
| `core/playlist/loader.js:301` |  | appState.mutate() không có console.log ngay statement kế tiếp. | FAIL | Máy quét | Có |  |
| `core/rubik-math.js:13` |  | appState.mutate() không có console.log ngay statement kế tiếp. | FAIL | Máy quét | Có |  |
| `core/sav-logo.js:22` |  | appState.set() không có console.log ngay statement kế tiếp. | FAIL | Máy quét | Có |  |
| `core/video-player.js:27` |  | appState.set() không có console.log ngay statement kế tiếp. | FAIL | Máy quét | Không |  |
| `core/video-player.js:32` |  | appState.set() không có console.log ngay statement kế tiếp. | FAIL | Máy quét | Không |  |
| `core/wakelock.js:39` |  | appState.set() không có console.log ngay statement kế tiếp. | FAIL | Máy quét | Có |  |
| `core/wakelock.js:54` |  | appState.set() không có console.log ngay statement kế tiếp. | FAIL | Máy quét | Có |  |

#### Rule 5a — Core gắn sự kiện (72)

| Vị trí | Hàm | Mô tả | Trạng thái | Nguồn | Nợ cũ | Ghi chú |
|---|---|---|---|---|---|---|
| `core/app-settings-ui.js:202` | `wireAppSettingsPagination` | addEventListener: callback không gửi eventBus.send (gọi el.blur) | FAIL | Máy quét + review | Không |  |
| `core/dropdown-menu.js:43` | `openDropdownMenu` | addEventListener: file core không có hậu tố -ui tự gắn sự kiện; callback không gửi eventBus.send (gọi document.getElementById, overlay.remove, setTimeout); không gom cuối hàm (sau nó còn: const menu = document.createElement('div');) | FAIL | Máy quét + review | Không |  |
| `core/dropdown-menu.js:60` | `openDropdownMenu` | addEventListener: file core không có hậu tố -ui tự gắn sự kiện; callback không gửi eventBus.send (gọi closeDropdownMenu, item.callback); không gom cuối hàm (sau nó còn: document.body.appendChild(overlay);) | FAIL | Máy quét + review | Không |  |
| `core/file-manager/folder-picker-ui.js:68` | `openRenameFolderModal` | addEventListener: callback không gửi eventBus.send (gọi overlay.remove) | FAIL | Máy quét + review | Có |  |
| `core/file-manager/folder-picker-ui.js:69` | `openRenameFolderModal` | addEventListener: callback làm thêm ngoài eventBus.send: closeModal | FAIL | Máy quét + review | Có |  |
| `core/file-manager/folder-picker-ui.js:88` | `wireFolderPickerDrawerEvents` | addEventListener: không gom cuối hàm (sau nó còn: if (renameInputEl) {) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/file-manager/folder-picker-ui.js:91` | `wireFolderPickerDrawerEvents` | addEventListener: không gom cuối hàm (sau nó còn: if (renameInputEl) {) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/file-manager/folder-picker-ui.js:94` | `wireFolderPickerDrawerEvents` | addEventListener: không gom cuối hàm (sau nó còn: if (renameInputEl) {) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/file-manager/folder-picker-ui.js:101` | `wireFolderPickerDrawerEvents` | addEventListener: callback không gửi eventBus.send (gọi taskManager.once); không gom cuối hàm (sau nó còn: if (renameInputEl) {) | FAIL | Máy quét + review | Có |  |
| `core/file-manager/folder-picker-ui.js:108` | `wireFolderPickerDrawerEvents` | addEventListener: callback không gửi eventBus.send (gọi taskManager.kill); không gom cuối hàm (sau nó còn: if (renameInputEl) {) | FAIL | Máy quét + review | Có |  |
| `core/file-manager/folder-picker-ui.js:109` | `wireFolderPickerDrawerEvents` | addEventListener: callback không gửi eventBus.send (gọi taskManager.kill); không gom cuối hàm (sau nó còn: if (renameInputEl) {) | FAIL | Máy quét + review | Có |  |
| `core/file-manager/folder-picker-ui.js:110` | `wireFolderPickerDrawerEvents` | addEventListener: callback không gửi eventBus.send (gọi taskManager.kill); không gom cuối hàm (sau nó còn: if (renameInputEl) {) | FAIL | Máy quét + review | Có |  |
| `core/file-manager/folder-picker-ui.js:111` | `wireFolderPickerDrawerEvents` | addEventListener: không gom cuối hàm (sau nó còn: if (renameInputEl) {) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/file-manager/folder-picker-ui.js:118` | `wireFolderPickerDrawerEvents` | addEventListener: không gom cuối hàm (sau nó còn: if (renameInputEl) {) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/file-manager/folder-picker-ui.js:126` | `wireFolderPickerDrawerEvents` | addEventListener: callback không gửi eventBus.send (gọi renameInputEl.blur) | FAIL | Máy quét + review | Có |  |
| `core/file-manager/photo-ui.js:301` | `openImagePreviewModal` | addEventListener: callback không gửi eventBus.send (gọi computeCoverOrContain); không gom cuối hàm (sau nó còn: const computeInteractPos = (clientX, clientY) => {) | FAIL | Máy quét + review | Có |  |
| `core/file-manager/photo-ui.js:307` | `openImagePreviewModal` | addEventListener: không gom cuối hàm (sau nó còn: const computeInteractPos = (clientX, clientY) => {) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/file-manager/photo-ui.js:308` | `openImagePreviewModal` | addEventListener: không gom cuối hàm (sau nó còn: const computeInteractPos = (clientX, clientY) => {) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/file-manager/photo-ui.js:309` | `openImagePreviewModal` | addEventListener: không gom cuối hàm (sau nó còn: const computeInteractPos = (clientX, clientY) => {) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/file-manager/photo-ui.js:318` | `openImagePreviewModal` | addEventListener: không gom cuối hàm (sau nó còn: const computeInteractPos = (clientX, clientY) => {) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/file-manager/photo-ui.js:319` | `openImagePreviewModal` | addEventListener: không gom cuối hàm (sau nó còn: const computeInteractPos = (clientX, clientY) => {) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/file-manager/photo-ui.js:320` | `openImagePreviewModal` | addEventListener: không gom cuối hàm (sau nó còn: const computeInteractPos = (clientX, clientY) => {) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/file-manager/photo-ui.js:321` | `openImagePreviewModal` | addEventListener: không gom cuối hàm (sau nó còn: const computeInteractPos = (clientX, clientY) => {) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/file-manager/photo-ui.js:322` | `openImagePreviewModal` | addEventListener: không gom cuối hàm (sau nó còn: const computeInteractPos = (clientX, clientY) => {) | FAIL | Review (máy quét bỏ sót) | Có |  |
| `core/file-manager/photo-ui.js:325` | `openImagePreviewModal` | addEventListener: không gom cuối hàm (sau nó còn: const computeInteractPos = (clientX, clientY) => {) | FAIL | Máy quét + review | Có |  |
| `core/file-manager/photo-ui.js:331` | `openImagePreviewModal` | addEventListener: không gom cuối hàm (sau nó còn: const computeInteractPos = (clientX, clientY) => {) | FAIL | Máy quét + review | Có |  |
| `core/gameplay/engine-ui.js:121` | `showTapTierPopup` | addEventListener: callback không gửi eventBus.send (gọi anchor.remove) | FAIL | Máy quét + review | Không |  |
| `core/gameplay/engine-ui.js:145` | `showShatterEffect` | addEventListener: callback không gửi eventBus.send (gọi anchor.remove); không gom cuối hàm (sau nó còn: container.appendChild(anchor);) | FAIL | Máy quét + review | Không |  |
| `core/info-icon-ui.js:128` | `showInfoPopover` | addEventListener: callback không gửi eventBus.send (gọi scrim.remove) | FAIL | Máy quét + review | Không |  |
| `core/info-icon-ui.js:129` | `showInfoPopover` | addEventListener: callback không gửi eventBus.send (gọi closePopover) | FAIL | Máy quét + review | Không |  |
| `core/large-file-download.js:44` | `<lúc nạp file>` | addEventListener: file core không có hậu tố -ui tự gắn sự kiện; callback không gửi eventBus.send (gọi console.log) | FAIL | Máy quét + review | Không |  |
| `core/modal-choice-ui.js:136` | `_buildCancelButton` | addEventListener: callback không gửi eventBus.send (gọi closeModal, options.onCancel) | FAIL | Máy quét + review | Có |  |
| `core/modal-choice-ui.js:162` | `_appendButtonRow` | addEventListener: callback không gửi eventBus.send (gọi closeModal, btnDef.onClick); không gom cuối hàm (sau nó còn: card.appendChild(buttonRow);) | FAIL | Máy quét + review | Có |  |
| `core/modal-choice-ui.js:193` | `_appendDropdownRow` | addEventListener: callback không gửi eventBus.send (gọi closeModal, chosen.onClick); không gom cuối hàm (sau nó còn: row.appendChild(confirmBtn);) | FAIL | Máy quét + review | Có |  |
| `core/photo-editor-engine.js:34` | `decodeImageToCanvas` | img.onload =: file core không có hậu tố -ui tự gắn sự kiện; callback không gửi eventBus.send (gọi document.createElement, canvas.getContext('2d').drawImage, canvas.getContext) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/photo-editor-engine.js:46` | `decodeImageToCanvas` | img.onerror =: file core không có hậu tố -ui tự gắn sự kiện; callback không gửi eventBus.send (gọi URL.revokeObjectURL, reject) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/player-controls.js:165` | `waitMediaCanPlayThrough` | addEventListener: file core không có hậu tố -ui tự gắn sự kiện; callback không gửi eventBus.send (gọi EVENTS.forEach, resolve) | FAIL | Máy quét + review | Có |  |
| `core/point-move-timing-ui.js:154` | `buildPointMoveTimingCurveEl` | addEventListener: callback không gửi eventBus.send (gọi showLiveLabels) | FAIL | Máy quét + review | Không |  |
| `core/point-move-timing-ui.js:163` | `buildPointMoveTimingCurveEl` | addEventListener: callback làm thêm ngoài eventBus.send: draggingEl.setAttribute, showLiveLabels | FAIL | Máy quét + review | Không |  |
| `core/point-move-timing-ui.js:180` | `buildPointMoveTimingCurveEl` | addEventListener: callback làm thêm ngoài eventBus.send: hideLiveLabels | FAIL | Máy quét + review | Không |  |
| `core/slider-input-modal.js:125` | `openSliderInputModal` | addEventListener: file core không có hậu tố -ui tự gắn sự kiện; callback không gửi eventBus.send (gọi clamp); không gom cuối hàm (sau nó còn: document.body.appendChild(overlay);) | FAIL | Máy quét + review | Không |  |
| `core/slider-input-modal.js:129` | `openSliderInputModal` | addEventListener: file core không có hậu tố -ui tự gắn sự kiện; callback không gửi eventBus.send (gọi clamp); không gom cuối hàm (sau nó còn: document.body.appendChild(overlay);) | FAIL | Máy quét + review | Không |  |
| `core/slider-input-modal.js:135` | `openSliderInputModal` | addEventListener: file core không có hậu tố -ui tự gắn sự kiện; callback không gửi eventBus.send; không gom cuối hàm (sau nó còn: document.body.appendChild(overlay);) | FAIL | Máy quét + review | Không |  |
| `core/slider-input-modal.js:136` | `openSliderInputModal` | addEventListener: file core không có hậu tố -ui tự gắn sự kiện; callback không gửi eventBus.send (gọi overlay.remove); không gom cuối hàm (sau nó còn: document.body.appendChild(overlay);) | FAIL | Máy quét + review | Không |  |
| `core/slider-input-modal.js:137` | `openSliderInputModal` | addEventListener: file core không có hậu tố -ui tự gắn sự kiện; callback không gửi eventBus.send (gọi closeModal, config.onConfirm); không gom cuối hàm (sau nó còn: document.body.appendChild(overlay);) | FAIL | Máy quét + review | Không |  |
| `core/storage-manager.js:376` | `isVideoRecordCorrupted` | addEventListener: file core không có hậu tố -ui tự gắn sự kiện; callback không gửi eventBus.send (gọi safetyTimeout.kill, cleanup, missingReasons.push) | FAIL | Máy quét + review | Có |  |
| `core/storage-manager.js:377` | `isVideoRecordCorrupted` | addEventListener: file core không có hậu tố -ui tự gắn sự kiện; callback không gửi eventBus.send (gọi safetyTimeout.kill, cleanup, safeResolve) | FAIL | Máy quét + review | Có |  |
| `core/storage-manager.js:479` | `isImageRecordCorrupted` | addEventListener: file core không có hậu tố -ui tự gắn sự kiện; callback không gửi eventBus.send (gọi safetyTimeout.kill, cleanup, safeResolve) | FAIL | Máy quét + review | Có |  |
| `core/storage-manager.js:480` | `isImageRecordCorrupted` | addEventListener: file core không có hậu tố -ui tự gắn sự kiện; callback không gửi eventBus.send (gọi safetyTimeout.kill, cleanup, safeResolve) | FAIL | Máy quét + review | Có |  |
| `core/streaming-zip.js:93` | `_ensureZipJsLoaded` | script.onload =: file core không có hậu tố -ui tự gắn sự kiện; callback không gửi eventBus.send (gọi resolve); không gom cuối hàm (sau nó còn: _zipJsLoadPromise = ready.then(() => {) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/streaming-zip.js:94` | `_ensureZipJsLoaded` | script.onerror =: file core không có hậu tố -ui tự gắn sự kiện; callback không gửi eventBus.send (gọi reject); không gom cuối hàm (sau nó còn: _zipJsLoadPromise = ready.then(() => {) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/streaming-zip.js:355` | `_writeViaWorker` | worker.onmessage =: file core không có hậu tố -ui tự gắn sự kiện; callback không gửi eventBus.send (gọi console.log, resolve, reject) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/streaming-zip.js:361` | `_writeViaWorker` | worker.onerror =: file core không có hậu tố -ui tự gắn sự kiện; callback không gửi eventBus.send (gọi reject) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/streaming-zip.js:372` | `_writeViaWorker` | worker.onmessage =: file core không có hậu tố -ui tự gắn sự kiện; callback không gửi eventBus.send (gọi console.log, onProgress, sendNextEntry) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/streaming-zip.js:387` | `_writeViaWorker` | worker.onerror =: file core không có hậu tố -ui tự gắn sự kiện; callback không gửi eventBus.send (gọi worker.terminate, reject) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/subtitle/subtitles-ui.js:193` | `buildLineCard` | addEventListener: callback không gửi eventBus.send (gọi callbacks.onToggleSelect) | FAIL | Máy quét + review | Có |  |
| `core/subtitle/subtitles-ui.js:195` | `buildLineCard` | addEventListener: callback không gửi eventBus.send (gọi callbacks.onOpenTimePicker) | FAIL | Máy quét + review | Có |  |
| `core/subtitle/subtitles-ui.js:196` | `buildLineCard` | addEventListener: callback không gửi eventBus.send (gọi callbacks.onOpenTimePicker) | FAIL | Máy quét + review | Có |  |
| `core/subtitle/subtitles-ui.js:197` | `buildLineCard` | addEventListener: callback không gửi eventBus.send (gọi callbacks.onPlayRange, secToStr) | FAIL | Máy quét + review | Có |  |
| `core/subtitle/subtitles-ui.js:198` | `buildLineCard` | addEventListener: callback không gửi eventBus.send (gọi callbacks.onCancelEdit) | FAIL | Máy quét + review | Có |  |
| `core/subtitle/subtitles-ui.js:199` | `buildLineCard` | addEventListener: callback không gửi eventBus.send (gọi callbacks.onApplyEdit) | FAIL | Máy quét + review | Có |  |
| `core/subtitle/subtitles-ui.js:205` | `buildLineCard` | addEventListener: callback không gửi eventBus.send (gọi callbacks.onEnterEdit) | FAIL | Máy quét + review | Có |  |
| `core/subtitle/subtitles-ui.js:206` | `buildLineCard` | addEventListener: callback không gửi eventBus.send (gọi callbacks.onOpenKaraoke) | FAIL | Máy quét + review | Có |  |
| `core/subtitle/subtitles-ui.js:207` | `buildLineCard` | addEventListener: callback không gửi eventBus.send (gọi callbacks.onPlayRange) | FAIL | Máy quét + review | Có |  |
| `core/subtitle/subtitles-ui.js:208` | `buildLineCard` | addEventListener: callback không gửi eventBus.send (gọi callbacks.onRemove) | FAIL | Máy quét + review | Có |  |
| `core/time-picker-modal.js:191` | `openTimePickerModal` | addEventListener: file core không có hậu tố -ui tự gắn sự kiện; callback không gửi eventBus.send (gọi col.scrollTo); không gom cuối hàm (sau nó còn: const cols = units.map((u, i) => buildColumn(i, cu) | FAIL | Máy quét + review | Không |  |
| `core/time-picker-modal.js:194` | `openTimePickerModal` | addEventListener: file core không có hậu tố -ui tự gắn sự kiện; callback không gửi eventBus.send (gọi clearTimeout, setTimeout); không gom cuối hàm (sau nó còn: const cols = units.map((u, i) => buildColumn(i, cu) | FAIL | Máy quét + review | Không |  |
| `core/time-picker-modal.js:299` | `openTimePickerModal` | addEventListener: file core không có hậu tố -ui tự gắn sự kiện; callback không gửi eventBus.send (gọi overlay.remove); không gom cuối hàm (sau nó còn: document.body.appendChild(overlay);) | FAIL | Máy quét + review | Không |  |
| `core/time-picker-modal.js:300` | `openTimePickerModal` | addEventListener: file core không có hậu tố -ui tự gắn sự kiện; callback không gửi eventBus.send (gọi units.forEach, closeModal, config.onConfirm); không gom cuối hàm (sau nó còn: document.body.appendChild(overlay);) | FAIL | Máy quét + review | Không |  |
| `core/ui-theme/status-bar-color.js:58` | `sampleImageTopEdgeColor` | img.onload =: file core không có hậu tố -ui tự gắn sự kiện; callback không gửi eventBus.send (gọi resolve, document.createElement, canvas.getContext) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/ui-theme/status-bar-color.js:82` | `sampleImageTopEdgeColor` | img.onerror =: file core không có hậu tố -ui tự gắn sự kiện; callback không gửi eventBus.send (gọi resolve) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/visualizer/visualizer-display.js:168` | `openEffectPickerModal` | addEventListener: file core không có hậu tố -ui tự gắn sự kiện; callback không gửi eventBus.send (gọi renderStyleOptions) | FAIL | Máy quét + review | Có |  |

#### Rule 5c — thiếu hậu tố -ui (5)

| Vị trí | Hàm | Mô tả | Trạng thái | Nguồn | Nợ cũ | Ghi chú |
|---|---|---|---|---|---|---|
| `core/dropdown-menu.js:1` | `(cả file)` | createElement dựng menu (button/div) nhưng tên file không có -ui | FAIL | Máy quét + review | Không |  |
| `core/playlist/selection.js:1` | `(cả file)` | createElement tạo indicator chọn nhiều nhưng tên file không có -ui | FAIL | Máy quét + review | Có |  |
| `core/slider-input-modal.js:1` | `(cả file)` | createElement dựng modal nhưng tên file không có -ui | FAIL | Máy quét + review | Không |  |
| `core/time-picker-modal.js:1` | `(cả file)` | createElement dựng modal nhưng tên file không có -ui | FAIL | Máy quét + review | Không |  |
| `core/visualizer-gesture.js:1` | `(cả file)` | createElement tạo indicator seek-hold nhưng tên file không có -ui | FAIL | Máy quét + review | Không |  |

#### Rule 5d — template HTML trong core (55)

| Vị trí | Hàm | Mô tả | Trạng thái | Nguồn | Nợ cũ | Ghi chú |
|---|---|---|---|---|---|---|
| `core/dropdown-menu.js:59` |  | Chuỗi HTML 157 ký tự: `<span class="w-4 h-4 shrink-0 flex items-center justify-center [&>svg | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/file-manager/photo-ui.js:160` |  | Chuỗi HTML 396 ký tự: ` <div class="flex justify-center gap-3"> ${shapeTypes.map(s => ` <but | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Có | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/file-manager/photo-ui.js:178` |  | Chuỗi HTML 750 ký tự: ` <div class="flex justify-between items-center mb-3 text-sm"> <span i | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Có | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/file-manager/photo-ui.js:198` |  | Chuỗi HTML 614 ký tự: ` <button id="image-edit-context-cancel" type="button" class="w-9 h-9  | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Có | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/file-manager/photo-ui.js:226` |  | Chuỗi HTML 245 ký tự: ` <button type="button" data-crop-ratio="${r.key}" class="shrink-0 px- | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Có | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/file-manager/photo-ui.js:245` |  | Chuỗi HTML 719 ký tự: ` <div class="flex justify-between items-center w-full mb-3"> <div cla | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Có | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/gameplay/engine-ui.js:45` |  | Chuỗi HTML 110 ký tự: `<span class="gameplay-star${lit ? ' gameplay-star--lit' : ''}" style= | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/gameplay/engine-ui.js:48` |  | Chuỗi HTML 228 ký tự: ` <div> <div class="font-mono font-bold" id="gameplay-hit-${name}" dat | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/gameplay/engine-ui.js:55` |  | Chuỗi HTML 1010 ký tự: ` <div class="flex flex-col items-center gap-3"> <div class="w-full te | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/gameplay/game-panel-ui.js:62` |  | Chuỗi HTML 274 ký tự: `<button type="button" class="game-card-exit-btn shrink-0 w-11 h-11 ro | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/gameplay/game-panel-ui.js:65` |  | Chuỗi HTML 516 ký tự: `<button type="button" class="game-card-play-btn shrink-0 w-11 h-11 ro | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/gameplay/game-panel-ui.js:69` |  | Chuỗi HTML 366 ký tự: `<button type="button" class="game-card-difficulty-btn shrink-0 h-11 f | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/gameplay/game-panel-ui.js:70` |  | Chuỗi HTML 84 ký tự: `<span class="font-mono leading-none text-sm">${difficultyGlyph[diffic | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/gameplay/game-panel-ui.js:71` |  | Chuỗi HTML 114 ký tự: `<span data-i18n="gameplayCircle.difficulty.${difficulty}">${t('gamepl | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/gameplay/game-panel-ui.js:75` |  | Chuỗi HTML 291 ký tự: `<span class="game-card-live-badge absolute top-3 right-3 flex items-c | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/gameplay/game-panel-ui.js:76` |  | Chuỗi HTML 214 ký tự: `<span class="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-white | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/gameplay/game-panel-ui.js:80` |  | Chuỗi HTML 83 ký tự: `<div class="absolute inset-0 bg-gradient-to-br ${game.coverGradientCl | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/gameplay/game-panel-ui.js:83` |  | Chuỗi HTML 1133 ký tự: ` <div class="game-card rounded-2xl overflow-hidden${isLocked ? ' opac | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/info-icon-ui.js:46` |  | Chuỗi HTML 254 ký tự: `<button type="button" class="info-icon-btn inline-flex items-center j | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/pagination-ui.js:57` |  | Chuỗi HTML 1658 ký tự: ` <nav class="flex items-center justify-center gap-1 py-2" aria-label= | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/pagination-ui.js:83` |  | Chuỗi HTML 139 ký tự: '<span class="w-8 h-8 flex items-center justify-center text-xs select- | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/pagination-ui.js:84` |  | Chuỗi HTML 345 ký tự: `<button type="button" data-pagination-action="goto" data-page-index=" | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/pagination-ui.js:96` |  | Chuỗi HTML 139 ký tự: '<span class="w-8 h-8 flex items-center justify-center text-xs select- | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/pagination-ui.js:97` |  | Chuỗi HTML 345 ký tự: `<button type="button" data-pagination-action="goto" data-page-index=" | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/pagination-ui.js:99` |  | Chuỗi HTML 914 ký tự: ` <nav class="flex items-center justify-center gap-1 flex-wrap py-2" a | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/pagination-ui.js:118` |  | Chuỗi HTML 612 ký tự: ` <nav class="flex items-center justify-center py-2" aria-label="${t(' | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/playlist/render.js:89` |  | Chuỗi HTML 777 ký tự: ` <div class="w-full aspect-square relative mb-2.5"> <img ${view.cover | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Có | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/playlist/render.js:108` |  | Chuỗi HTML 680 ký tự: ` <img ${view.coverSrcAttr} loading="lazy" decoding="async" class="w-1 | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Có | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/statis-panel-ui.js:105` |  | Chuỗi HTML 274 ký tự: ` <div class="rounded-2xl p-4 mb-2 flex justify-center" data-uitk="car | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/statis-panel-ui.js:138` |  | Chuỗi HTML 223 ký tự: ` <div class="flex items-baseline justify-between mb-2"> <h3 class="te | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/statis-panel-ui.js:145` |  | Chuỗi HTML 2555 ký tự: ` <section class="mb-6"> ${sectionHeading('statisPanel.section.overvie | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/statis-panel-ui.js:182` |  | Chuỗi HTML 1398 ký tự: ` <div class="rounded-2xl p-3 flex-1 min-w-0 text-center" data-uitk="c | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/statis-panel-ui.js:200` |  | Chuỗi HTML 352 ký tự: `<button type="button" class="statis-share-btn w-7 h-6 rounded-md flex | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/statis-panel-ui.js:202` |  | Chuỗi HTML 189 ký tự: `<div class="flex p-0.5 gap-0.5 rounded-lg" data-uitk="btnNeutralBg">$ | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/statis-panel-ui.js:204` |  | Chuỗi HTML 290 ký tự: ` <section class="mb-6"> ${sectionHeading('statisPanel.section.mediaTy | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/statis-panel-ui.js:216` |  | Chuỗi HTML 285 ký tự: `<button type="button" class="statis-sort-btn flex-1 h-8 rounded-lg te | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/statis-panel-ui.js:221` |  | Chuỗi HTML 315 ký tự: `<button type="button" class="statis-filter-btn shrink-0 h-8 px-3 roun | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/statis-panel-ui.js:233` |  | Chuỗi HTML 975 ký tự: ` <div class="flex items-center gap-2.5 py-2 border-b last:border-b-0" | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/statis-panel-ui.js:245` |  | Chuỗi HTML 173 ký tự: `<span style="${STATIS_SMALL_TEXT_STYLE}" data-uitk="textSecondary">${ | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/statis-panel-ui.js:246` |  | Chuỗi HTML 369 ký tự: ` <section> ${sectionHeading('statisPanel.section.topMedia', topHint)} | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/statis-panel-ui.js:269` |  | Chuỗi HTML 102 ký tự: `<div class="rounded-2xl ${extraClass \|\| ''}" style="height:${heightPx | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/statis-panel-ui.js:271` |  | Chuỗi HTML 288 ký tự: `<div class="flex items-center gap-2.5 py-2"><div class="w-7 h-7 round | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/statis-panel-ui.js:273` |  | Chuỗi HTML 1081 ký tự: ` <div class="animate-pulse" aria-busy="true"> <section class="mb-6">  | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/storage-manager.js:438` |  | Chuỗi HTML 119 ký tự: `<div class="truncate"><span class="text-amber-400">●</span> ${escapeH | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Có | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/theme-background-ui.js:58` |  | Chuỗi HTML 537 ký tự: `<div> <div class="flex justify-between items-center mb-2"> <span clas | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/theme-background-ui.js:74` |  | Chuỗi HTML 177 ký tự: `<div class="w-8 h-8 rounded-full overflow-hidden shrink-0" data-uitk= | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/theme-background-ui.js:76` |  | Chuỗi HTML 220 ký tự: `<button type="button" data-theme-bg-pick="${kind}" class="h-8 px-2.5  | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/theme-background-ui.js:94` |  | Chuỗi HTML 96 ký tự: `<div class="absolute inset-0 flex items-center justify-center text-wh | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/theme-background-ui.js:95` |  | Chuỗi HTML 720 ký tự: ` <div data-theme-bg-empty class="${hasMedia ? 'hidden' : 'flex'} abso | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/theme-background-ui.js:101` |  | Chuỗi HTML 1036 ký tự: ` <div class="flex flex-col items-center gap-2 min-w-0"> <button type= | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/theme-background-ui.js:112` |  | Chuỗi HTML 983 ký tự: ` <div id="theme-bg-cards" class="px-4 pb-4 pt-3 border-t" data-uitk=" | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/visualizer-gesture.js:72` |  | Chuỗi HTML 343 ký tự: ` <div class="seek-hold-arrow text-white" style="font-size: 3.25rem; l | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Không | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/visualizer/visualizer-display.js:123` |  | Chuỗi HTML 131 ký tự: `<option value="${style}" ${style === preselectStyle ? 'selected' : '' | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Có | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/visualizer/visualizer-display.js:127` |  | Chuỗi HTML 129 ký tự: `<option value="${group}" ${group === currentGroup ? 'selected' : ''}> | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Có | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |
| `core/visualizer/visualizer-display.js:130` |  | Chuỗi HTML 950 ký tự: ` <div class="flex flex-col gap-3"> <div class="flex flex-col gap-1">  | FAIL | Review (máy quét bỏ sót; đoạn kiểm tra 5d của máy là code chết) | Có | Đã đọc: markup cấu trúc cố định, chỉ khác data → phải là render*() trong components/ (tiền lệ 07/10 dời HTML Playlist) |

### 4.2 Event bus

#### Listener gọi thẳng Workflow (1)

| Vị trí | Hàm | Mô tả | Trạng thái | Nguồn | Nợ cũ | Ghi chú |
|---|---|---|---|---|---|---|
| `event/listener/subtitle-editor.js:266` | `<lúc nạp file>` | workflowSubtitleEditor.init() gọi trực tiếp, không qua Router (app.boot ở index.html đã đi qua bus) | FAIL | Review (máy quét bỏ sót) | — |  |

#### Listener làm việc ngoài eventBus.send (1)

| Vị trí | Hàm | Mô tả | Trạng thái | Nguồn | Nợ cũ | Ghi chú |
|---|---|---|---|---|---|---|
| `event/listener/subtitle-editor.js:261` | `_updateToolbarArrowState` | Callback scroll tự đổi class mũi tên (DOM) thay vì gửi bus; dòng 262 còn gọi thẳng lúc nạp | FAIL | Máy quét + review | — |  |

#### Listener đọc appState (7)

| Vị trí | Hàm | Mô tả | Trạng thái | Nguồn | Nợ cũ | Ghi chú |
|---|---|---|---|---|---|---|
| `event/listener/video-player.js:21` | `callback listener` | Listener gọi appState.get() để quyết định có gửi hay không | FAIL | Máy quét | — |  |
| `event/listener/video-player.js:25` | `callback listener` | Listener gọi appState.get() để quyết định có gửi hay không | FAIL | Máy quét | — |  |
| `event/listener/video-player.js:29` | `callback listener` | Listener gọi appState.get() để quyết định có gửi hay không | FAIL | Máy quét | — |  |
| `event/listener/video-player.js:33` | `callback listener` | Listener gọi appState.get() để quyết định có gửi hay không | FAIL | Máy quét | — |  |
| `event/listener/video-player.js:37` | `callback listener` | Listener gọi appState.get() để quyết định có gửi hay không | FAIL | Máy quét | — |  |
| `event/listener/visual-bg.js:113` | `callback listener` | Listener gọi appState.get() để quyết định có gửi hay không | FAIL | Máy quét | — |  |
| `event/listener/visual-bg.js:121` | `callback listener` | Listener gọi appState.get() để quyết định có gửi hay không | FAIL | Máy quét | — |  |

#### Router tự chuẩn bị dữ liệu (1)

| Vị trí | Hàm | Mô tả | Trạng thái | Nguồn | Nợ cũ | Ghi chú |
|---|---|---|---|---|---|---|
| `event/router/playlist-empty-state.js:44` | `case 'playlistEmptyState.play.click'` | Router gọi core (resolvePlayingMediaType, isPlayingMediaListed) để tính state và tự chọn key phát (resumableKey \|\| displayOrder[0]) — việc chuẩn bị thuộc Workflow (§4B) | FAIL | Review (máy quét bỏ sót) | — |  |

#### Workflow tự dựng template HTML (20)

| Vị trí | Hàm | Mô tả | Trạng thái | Nguồn | Nợ cũ | Ghi chú |
|---|---|---|---|---|---|---|
| `event/workflow/app-settings.js:291` | `_renderTheme` | 1 chỗ: ` <div class="flex flex-col gap-2"> <div class="rounded-2xl fl | FAIL | Review (máy quét bỏ sót) | — | Markup → render*() trong components/ (Rule 5d) |
| `event/workflow/file-manager-folder-browser.js:75` | `_renderList` | 1 chỗ: `<div id="folder-browser-pagination" class="px-3 pb-3">${workflowPagination.buildControlsH | FAIL | Review (máy quét bỏ sót) | — | Markup → render*() trong components/ (Rule 5d) |
| `event/workflow/file-manager-photo.js:114` | `_buildImagePickerBodyHtml` | 1 chỗ: ` <div class="flex-1 min-h-0 overflow-y-auto relative" id="file-manager-image- | FAIL | Review (máy quét bỏ sót) | — | Markup → render*() trong components/ (Rule 5d) |
| `event/workflow/file-manager-storage.js:132` | `openPanel` | 1 chỗ: `<div class="p-4" data-uitk="textPrimary">${renderFileManagerStorageManagementPanelBody()} | FAIL | Review (máy quét bỏ sót) | — | Markup → render*() trong components/ (Rule 5d) |
| `event/workflow/file-manager-storage.js:529` | `askScanBrokenScope` | 1 chỗ: `${t('storageDrawer.scanBroken.modalBody')} <select id="modal-scan-scope" class="mt-3 w-fu | FAIL | Review (máy quét bỏ sót) | — | Markup → render*() trong components/ (Rule 5d) |
| `event/workflow/image-edit.js:130` | `_buildEditToolGridHtml` | 1 chỗ: ` <div class="grid grid-cols-5 gap-2 px-5 py-1"> ${tools.map(t | FAIL | Review (máy quét bỏ sót) | — | Markup → render*() trong components/ (Rule 5d) |
| `event/workflow/image-edit.js:923` | `editLayerTextContent` | 1 chỗ: `<textarea id="layer-edit-content-textarea" rows="3" class="w-full rounded-lg border borde | FAIL | Review (máy quét bỏ sót) | — | Markup → render*() trong components/ (Rule 5d) |
| `event/workflow/motion-presets.js:794` | `openPointMoveTimingNodeModal` | 1 chỗ: ` <label class="block text-xs mb-1" data-uitk="textMutedIcon">${escape | FAIL | Review (máy quét bỏ sót) | — | Markup → render*() trong components/ (Rule 5d) |
| `event/workflow/photo-player.js:244` | `playPhotoByKey` | 1 chỗ: `<img id="record-art" src="${this._thumbObjectUrl}" class="w-full h-full rounded-full obje | FAIL | Review (máy quét bỏ sót) | — | Markup → render*() trong components/ (Rule 5d) |
| `event/workflow/player.js:233` | `playMedia` | 1 chỗ: `<img id="record-art" src="${appState.get('currentCoverObjectURL')}" class="w-full h-full  | FAIL | Review (máy quét bỏ sót) | — | Markup → render*() trong components/ (Rule 5d) |
| `event/workflow/playlist-render.js:93` | `buildSongNode` | 3 chỗ: `${artist} <span class="opacity-50">·</span> ${durationLabel}` · `<div class="flex items-end gap-[2px] h-3 w-3"><div class="w-[3px] eq-1" data-uitk="eqBarB · `<div class="w-2 h-2 rounded-full shadow-[0_0_5px_rgba(14,165,233,0.8)]" data-uitk="btnPri | FAIL | Review (máy quét bỏ sót) | — | Markup → render*() trong components/ (Rule 5d) |
| `event/workflow/playlist.js:390` | `pickCoverFromVideoThumb` | 1 chỗ: ` <div class="flex-1 min-h-0 overflow-y-auto relative" id="${scrollId}">  | FAIL | Review (máy quét bỏ sót) | — | Markup → render*() trong components/ (Rule 5d) |
| `event/workflow/playlist.js:1715` | `_renderFolderPickerGrid` | 1 chỗ: `<p class="text-sm text-center py-10 px-6" data-uitk="textSecondary">${this._folderPickerE | FAIL | Review (máy quét bỏ sót) | — | Markup → render*() trong components/ (Rule 5d) |
| `event/workflow/playlist.js:1746` | `_buildFolderPickerHeaderHtml` | 3 chỗ: ` <select id="playlist-folder-picker-type" class="rounded-lg px-2 py-1 text-xs · ` <button type="button" id="playlist-folder-picker-confirm" class="text-xs fon · `<div class="flex items-center gap-2">${typeDropdownHtml}${confirmBtnHtml}</div>` | FAIL | Review (máy quét bỏ sót) | — | Markup → render*() trong components/ (Rule 5d) |
| `event/workflow/settings-misc.js:82` | `forceOpenDebugConsole` | 1 chỗ: `<div class="p-4" data-uitk="textPrimary">${renderDebugConsolePanelBody()}</div>` | FAIL | Review (máy quét bỏ sót) | — | Markup → render*() trong components/ (Rule 5d) |
| `event/workflow/subtitle-editor.js:57` | `_showFatalError` | 1 chỗ: `<p class="text-sm text-slate-400 text-center py-10">${message}</p>` | FAIL | Review (máy quét bỏ sót) | — | Markup → render*() trong components/ (Rule 5d) |
| `event/workflow/theme.js:71` | `_buildMediaPickerBodyHtml` | 1 chỗ: ` <div class="flex-1 min-h-0 overflow-y-auto relative" id="${scrollId}">  | FAIL | Review (máy quét bỏ sót) | — | Markup → render*() trong components/ (Rule 5d) |
| `event/workflow/video-player.js:610` | `playVideoByKey` | 1 chỗ: `<img id="record-art" src="${this._thumbObjectUrl}" class="w-full h-full rounded-full obje | FAIL | Review (máy quét bỏ sót) | — | Markup → render*() trong components/ (Rule 5d) |
| `event/workflow/visual-bg-common.js:1177` | `_buildMultiPickerBodyHtml` | 1 chỗ: ` <div class="flex-1 min-h-0 overflow-y-auto relative" id="${scrollId}">  | FAIL | Review (máy quét bỏ sót) | — | Markup → render*() trong components/ (Rule 5d) |
| `event/workflow/zip-download.js:65` | `serviceWorker` | 1 chỗ: '[zip-download] Tải qua Service Worker lỗi, rơi về <a download>:' | FAIL | Review (máy quét bỏ sót) | — | Markup → render*() trong components/ (Rule 5d) |

#### Workflow tự gắn sự kiện (73)

| Vị trí | Hàm | Mô tả | Trạng thái | Nguồn | Nợ cũ | Ghi chú |
|---|---|---|---|---|---|---|
| `event/workflow/element-style-editor.js:134` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm A |
| `event/workflow/element-style-editor.js:137` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm A |
| `event/workflow/element-style-editor.js:145` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm A |
| `event/workflow/element-style-editor.js:157` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm A |
| `event/workflow/element-style-editor.js:171` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm A |
| `event/workflow/element-style-editor.js:181` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm A |
| `event/workflow/element-style-editor.js:189` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm A |
| `event/workflow/element-style-editor.js:200` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm A |
| `event/workflow/element-style-editor.js:203` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm A |
| `event/workflow/element-style-editor.js:255` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm A |
| `event/workflow/element-style-editor.js:261` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm A |
| `event/workflow/element-style-editor.js:275` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm A |
| `event/workflow/eq-presets.js:179` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm A |
| `event/workflow/eq-presets.js:184` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm A |
| `event/workflow/eq-presets.js:186` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm A |
| `event/workflow/eq-presets.js:262` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm A |
| `event/workflow/eq-presets.js:266` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm A |
| `event/workflow/eq-presets.js:272` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm A |
| `event/workflow/eq-presets.js:276` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm A |
| `event/workflow/eq-presets.js:277` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm A |
| `event/workflow/eq-presets.js:281` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm A |
| `event/workflow/eq-presets.js:282` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm A |
| `event/workflow/eq-presets.js:286` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm A |
| `event/workflow/file-manager-photo.js:171` | `resizeImageForThumbnail` | img.onload = … (dạng gán handler) trong Workflow | FAIL | Review (máy quét bỏ sót) | — | Không thuộc danh sách 18 chỗ đã audit |
| `event/workflow/file-manager-photo.js:187` | `resizeImageForThumbnail` | img.onerror = … (dạng gán handler) trong Workflow | FAIL | Review (máy quét bỏ sót) | — | Không thuộc danh sách 18 chỗ đã audit |
| `event/workflow/file-manager-storage.js:136` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm C (callback đã chỉ send) |
| `event/workflow/file-manager-storage.js:773` | `_classifyThumbBlob` | img.onload = … (dạng gán handler) trong Workflow | FAIL | Review (máy quét bỏ sót) | — | Không thuộc danh sách 18 chỗ đã audit |
| `event/workflow/file-manager-storage.js:774` | `_classifyThumbBlob` | img.onerror = … (dạng gán handler) trong Workflow | FAIL | Review (máy quét bỏ sót) | — | Không thuộc danh sách 18 chỗ đã audit |
| `event/workflow/gameplay.js:629` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm E (window.resize) |
| `event/workflow/image-edit.js:925` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm D — Giang chốt: bỏ listener input, đọc .value trong onClick |
| `event/workflow/motion-presets.js:801` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm D — Giang chốt: bỏ listener input, đọc .value trong onClick |
| `event/workflow/player-controls.js:483` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm F — Giang chốt: miễn trừ chỉ theo audit chính thức → không miễn |
| `event/workflow/player.js:355` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm F — Giang chốt: miễn trừ chỉ theo audit chính thức → không miễn |
| `event/workflow/recorder.js:297` | `_beginCapture` | this._mediaRecorder.ondataavailable = … (dạng gán handler) trong Workflow | FAIL | Review (máy quét bỏ sót) | — | Không thuộc danh sách 18 chỗ đã audit |
| `event/workflow/recorder.js:299` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 (track.ended, callback chỉ send) |
| `event/workflow/recorder.js:408` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm F — Giang chốt: miễn trừ chỉ theo audit chính thức → không miễn |
| `event/workflow/recorder.js:485` | `_measureLatency` | graph.processor.onaudioprocess = … (dạng gán handler) trong Workflow | FAIL | Review (máy quét bỏ sót) | — | Không thuộc danh sách 18 chỗ đã audit |
| `event/workflow/settings-misc.js:86` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm A |
| `event/workflow/subtitle-editor.js:561` | `importSrtFile` | reader.onload = … (dạng gán handler) trong Workflow | FAIL | Review (máy quét bỏ sót) | — | Không thuộc danh sách 18 chỗ đã audit |
| `event/workflow/subtitle-editor.js:687` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Giang chốt: tính cả subtitle-editor |
| `event/workflow/subtitle-editor.js:690` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Giang chốt: tính cả subtitle-editor |
| `event/workflow/subtitle-editor.js:693` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Giang chốt: tính cả subtitle-editor |
| `event/workflow/subtitle-editor.js:698` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Giang chốt: tính cả subtitle-editor |
| `event/workflow/subtitle-editor.js:707` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Giang chốt: tính cả subtitle-editor |
| `event/workflow/subtitle-editor.js:715` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Giang chốt: tính cả subtitle-editor |
| `event/workflow/subtitle-editor.js:949` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Giang chốt: tính cả subtitle-editor |
| `event/workflow/subtitle-editor.js:950` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Giang chốt: tính cả subtitle-editor |
| `event/workflow/subtitle-editor.js:951` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Giang chốt: tính cả subtitle-editor |
| `event/workflow/subtitle-editor.js:952` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Giang chốt: tính cả subtitle-editor |
| `event/workflow/subtitle-editor.js:1359` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Giang chốt: tính cả subtitle-editor |
| `event/workflow/subtitle-editor.js:1360` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Giang chốt: tính cả subtitle-editor |
| `event/workflow/subtitle-editor.js:1828` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Giang chốt: tính cả subtitle-editor |
| `event/workflow/subtitle-editor.js:1830` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Giang chốt: tính cả subtitle-editor |
| `event/workflow/subtitle-editor.js:1838` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Giang chốt: tính cả subtitle-editor |
| `event/workflow/video-player.js:293` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm F — Giang chốt: miễn trừ chỉ theo audit chính thức → không miễn |
| `event/workflow/video-player.js:299` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm F — Giang chốt: miễn trừ chỉ theo audit chính thức → không miễn |
| `event/workflow/video-player.js:334` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm F — Giang chốt: miễn trừ chỉ theo audit chính thức → không miễn |
| `event/workflow/video-player.js:678` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm F — Giang chốt: miễn trừ chỉ theo audit chính thức → không miễn |
| `event/workflow/video-player.js:889` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm F — Giang chốt: miễn trừ chỉ theo audit chính thức → không miễn |
| `event/workflow/video-player.js:890` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm F — Giang chốt: miễn trừ chỉ theo audit chính thức → không miễn |
| `event/workflow/video-player.js:996` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm F — Giang chốt: miễn trừ chỉ theo audit chính thức → không miễn |
| `event/workflow/video-preview.js:125` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm F — Giang chốt: miễn trừ chỉ theo audit chính thức → không miễn |
| `event/workflow/video-preview.js:139` | `_loadVideoEditorScriptOnce` | el.onload = … (dạng gán handler) trong Workflow | FAIL | Review (máy quét bỏ sót) | — | Không thuộc danh sách 18 chỗ đã audit |
| `event/workflow/video-preview.js:140` | `_loadVideoEditorScriptOnce` | el.onerror = … (dạng gán handler) trong Workflow | FAIL | Review (máy quét bỏ sót) | — | Không thuộc danh sách 18 chỗ đã audit |
| `event/workflow/video-thumb-extract.js:55` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm F — Giang chốt: miễn trừ chỉ theo audit chính thức → không miễn |
| `event/workflow/video-thumb-extract.js:253` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm F — Giang chốt: miễn trừ chỉ theo audit chính thức → không miễn |
| `event/workflow/video-thumb-extract.js:258` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm F — Giang chốt: miễn trừ chỉ theo audit chính thức → không miễn |
| `event/workflow/visual-bg-video.js:207` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm F — Giang chốt: miễn trừ chỉ theo audit chính thức → không miễn |
| `event/workflow/visualizer-display.js:58` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm B (kéo-thả) |
| `event/workflow/visualizer-display.js:67` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm B (kéo-thả) |
| `event/workflow/visualizer-display.js:89` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm B (kéo-thả) |
| `event/workflow/visualizer-display.js:90` |  | addEventListener trong Workflow — bỏ qua Listener → Router (và Block gate) | FAIL | Máy quét (REVIEW) → review | — | Plan 07/10 nhóm B (kéo-thả) |
| `event/workflow/visualizer/shape.js:293` | `_loadClockBgImage` | img.onload = … (dạng gán handler) trong Workflow | FAIL | Review (máy quét bỏ sót) | — | Không thuộc danh sách 18 chỗ đã audit |

#### Workflow tự thao tác DOM (214)

| Vị trí | Hàm | Mô tả | Trạng thái | Nguồn | Nợ cũ | Ghi chú |
|---|---|---|---|---|---|---|
| `event/workflow/app-settings.js:170` | `_renderPlaylist` | 2 chỗ: mediaSourceSelect.value = … · viewModeSelect.value = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/app-settings.js:305` | `_renderTheme` | 1 chỗ: body.querySelector('#app-settings-ui-theme-select').value = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/app-settings.js:362` | `setPlaylistFilterListPage` | 1 chỗ: genericDrawerBody.scrollTop = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/app-settings.js:371` | `setMotionListPage` | 1 chỗ: genericDrawerBody.scrollTop = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/audio-engine.js:111` | `_applyVolumeGain` | 1 chỗ: volumeGainNode.gain.value = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/element-style-editor.js:263` | `_wireFontPicker` | 1 chỗ: list.innerHTML = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/eq-presets.js:196` | `setListPage` | 1 chỗ: genericDrawerBody.scrollTop = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/eq-presets.js:297` | `_previewBandGain` | 1 chỗ: valEl.textContent = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/eq-presets.js:320` | `_commitName` | 1 chỗ: nameInput.value = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/file-manager-folder-browser.js:92` | `setListPage` | 1 chỗ: genericDrawerBody.scrollTop = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/file-manager-photo.js:106` | `_openImagePickerDrawer` | 1 chỗ: emptyEl.classList.toggle() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/file-manager-photo.js:176` | `resizeImageForThumbnail` | 5 chỗ: document.createElement() · canvas.width = … · canvas.height = … … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/file-manager-storage.js:231` | `_startStorageCountup` | 1 chỗ: el.textContent = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/file-manager-storage.js:262` | `updateStorageActionUI` | 3 chỗ: el.checked = … · executeBtn.disabled = … · executeBtn.textContent = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/file-manager-storage.js:775` | `_classifyThumbBlob` | 2 chỗ: img.src = … · img.removeAttribute() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/filter-rule-edit.js:17` | `seconds` | 1 chỗ: el.textContent = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/filter-rule-edit.js:18` | `text` | 1 chỗ: el.value = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/filter-rule-edit.js:19` | `numeric` | 1 chỗ: el.value = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/filter-rule-edit.js:66` | `syncUi` | 3 chỗ: enableEl.checked = … · opEl.value = … · modeEl.value = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/filter-rule-edit.js:135` | `_setRowBodyEnabledUi` | 2 chỗ: bodyBlockEl.classList.toggle() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/filter-rule-edit.js:145` | `_setRowModeUi` | 2 chỗ: rangeBlock.classList.toggle() · singleBlock.classList.toggle() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/game-catalog.js:54` | `renderList` | 1 chỗ: gamePanelList.innerHTML = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/gameplay.js:113` | `start` | 1 chỗ: activeEl.currentTime = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/gameplay.js:550` | `replay` | 1 chỗ: activeEl.currentTime = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/gameplay.js:585` | `exitToPlaylist` | 1 chỗ: activeEl.currentTime = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/generic-drawer-helpers.js:137` | `_setScrollState` | 1 chỗ: genericDrawerBody.scrollTop = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/generic-drawer-helpers.js:144` | `restoreScroll` | 1 chỗ: genericDrawerBody.scrollTop = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/gesture-settings.js:25` | `openPanel` | 14 chỗ: panelEl.querySelector('#setting-gesture-action-swipe-up').value = … · panelEl.querySelector('#setting-gesture-action-swipe-down').value = … · panelEl.querySelector('#setting-gesture-action-swipe-left').value = … … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/gesture-settings.js:101` | `_openSeekTimePicker` | 1 chỗ: el.textContent = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/hud.js:20` | `openVolume` | 2 chỗ: volumeHudSlider.value = … · visualizerVolumeHud.classList.remove() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/hud.js:37` | `openSpeed` | 1 chỗ: visualizerSpeedHud.classList.remove() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/hud.js:83` | `_scheduleAutoHide` | 1 chỗ: panelEl.classList.add() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/image-edit.js:82` | `ensureEditSessionReady` | 2 chỗ: handle.baseCanvas.getContext('2d').drawImage() · handle.renderCanvas.getContext('2d').drawImage() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/image-edit.js:188` | `openAdjustTool` | 4 chỗ: handle.adjustLabelEl.textContent = … · handle.adjustSliderEl.value = … · handle.adjustValueEl.textContent = … … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/image-edit.js:204` | `updateAdjustSlider` | 1 chỗ: handle.adjustValueEl.textContent = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/image-edit.js:213` | `exitAdjustTool` | 1 chỗ: handle.adjustPopup.classList.add() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/image-edit.js:225` | `_renderEditPreview` | 1 chỗ: handle.renderCanvas.getContext('2d').putImageData() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/image-edit.js:284` | `exitSubTool` | 8 chỗ: handle.interactCanvas.getContext('2d').clearRect() · handle.contextBar.classList.add() · handle.contextApplyBtn.classList.remove() … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/image-edit.js:309` | `_startCropTool` | 5 chỗ: handle.header.classList.add() · handle.contextBar.classList.remove() · handle.contextApplyBtn.classList.remove() … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/image-edit.js:424` | `applyCropTool` | 2 chỗ: handle.baseCanvas.getContext('2d').drawImage() · handle.renderCanvas.getContext('2d').drawImage() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/image-edit.js:451` | `_startDrawTool` | 9 chỗ: handle.header.classList.add() · handle.contextBar.classList.remove() · handle.contextApplyBtn.classList.remove() … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/image-edit.js:490` | `selectDrawBrush` | 2 chỗ: handle.drawBrushBtn.classList.replace() · handle.drawEraserBtn.classList.replace() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/image-edit.js:500` | `selectDrawEraser` | 2 chỗ: handle.drawEraserBtn.classList.replace() · handle.drawBrushBtn.classList.replace() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/image-edit.js:553` | `_startTextTool` | 9 chỗ: handle.header.classList.add() · handle.contextBar.classList.remove() · handle.contextApplyBtn.classList.remove() … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/image-edit.js:588` | `updateTextDrag` | 3 chỗ: handle.floatingText.style.left = … · handle.floatingText.style.top = … · handle.floatingText.style.transform = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/image-edit.js:643` | `_startShapeTool` | 5 chỗ: handle.header.classList.add() · handle.contextBar.classList.remove() · handle.contextApplyBtn.classList.add() … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/image-edit.js:673` | `selectShapeType` | 4 chỗ: handle.shapeTypePopup.classList.add() · handle.contextBar.classList.remove() · handle.contextApplyBtn.classList.remove() … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/image-edit.js:800` | `_openLayerActionMenuAt` | 1 chỗ: anchorEl.remove() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/image-edit.js:954` | `_exportEditedBlob` | 1 chỗ: document.createElement() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/motion-beat-react-runner.js:197` | `_tick` | 1 chỗ: target.style.transform = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/motion-beat-react-runner.js:226` | `stop` | 1 chỗ: target.style.transform = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/motion-point-move-runner.js:164` | `_applyStaticPointMoveAtZero` | 1 chỗ: target.style.transform = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/motion-presets.js:150` | `_syncEditUI` | 11 chỗ: ratioRow.classList.toggle() · directionRow.classList.toggle() · zoomDirectionRow.classList.toggle() … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/motion-presets.js:185` | `_updateTransitionRatioLabel` | 1 chỗ: labelEl.textContent = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/motion-presets.js:280` | `openTransitionDurationPicker` | 1 chỗ: btn.textContent = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/motion-presets.js:509` | `previewPointMoveFieldSingle` | 1 chỗ: inputEl.value = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/motion-presets.js:546` | `_syncPointMoveEditUI` | 4 chỗ: singleWrap.style.display = … · rangeWrap.style.display = … · singleInputWrap.classList.toggle() … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/motion-presets.js:576` | `_paintPointMoveRangeFill` | 2 chỗ: fillEl.style.left = … · fillEl.style.width = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/motion-presets.js:583` | `_setInputValueById` | 1 chỗ: el.value = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/motion-presets.js:608` | `commitPointMoveNumberInput` | 1 chỗ: inputEl.value = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/motion-presets.js:637` | `startPointMoveDrag` | 2 chỗ: handleEl.setPointerCapture() · document.body.style.userSelect = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/motion-presets.js:647` | `movePointMoveDrag` | 1 chỗ: drag.rowEl.style.transform = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/motion-presets.js:658` | `endPointMoveDrag` | 1 chỗ: document.body.style.userSelect = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/motion-presets.js:673` | `_paintDropTarget` | 1 chỗ: rowEl.dataset.uitk = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/motion-presets.js:715` | `_renderTimingCurve` | 2 chỗ: containerEl.innerHTML = … · containerEl.appendChild() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/motion-presets.js:729` | `_patchTimingPreview` | 1 chỗ: nodeEl.setAttribute() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/motion-presets.js:772` | `stepPointMoveTimingZoom` | 2 chỗ: zoomableEl.style.transform = … · labelEl.textContent = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/motion-presets.js:865` | `changeBeatReactField` | 2 chỗ: inputEl.value = … · sliderEl.value = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/motion-presets.js:882` | `commitBeatReactMaxInput` | 1 chỗ: inputEl.value = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/motion-presets.js:1027` | `setPickerPage` | 1 chỗ: genericDrawerBody.scrollTop = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/motion-transition-runner.js:116` | `runTransition` | 2 chỗ: outgoingEl.classList.remove() · incomingEl.classList.add() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/photo-gallery-window.js:48` | `mount` | 7 chỗ: document.createElement() · containerEl.className = … · scrollEl.appendChild() … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/photo-gallery-window.js:84` | `unmount` | 1 chỗ: m.containerEl.remove() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/photo-gallery-window.js:113` | `_loadGroup` | 21 chỗ: record.el.style.height = … · record.el.classList.remove() · record.el.innerHTML = … … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/photo-gallery-window.js:175` | `_unloadGroup` | 3 chỗ: record.el.innerHTML = … · record.el.style.height = … · record.el.classList.add() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/photo-gallery-window.js:199` | `setBadgeMode` | 4 chỗ: oldBadge.remove() · itemEl.classList.remove() · itemEl.appendChild() … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/photo-gallery-window.js:224` | `setTileBadge` | 3 chỗ: tileEl.classList.toggle() · oldBadge.remove() · tileEl.appendChild() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/photo-player.js:244` | `playPhotoByKey` | 1 chỗ: recordContainer.innerHTML = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/photo-player.js:400` | `reloadCurrentPhoto` | 1 chỗ: recordArtEl.src = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/player-controls.js:71` | `photo` | 1 chỗ: activeEl.currentTime = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/player-controls.js:657` | `restartCurrentTrack` | 1 chỗ: activeEl.currentTime = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/player.js:233` | `playMedia` | 1 chỗ: recordContainer.innerHTML = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/playlist-render.js:58` | `true` | 1 chỗ: node.classList.add() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/playlist-render.js:117` | `buildSongNode` | 3 chỗ: document.createElement() · wrapper.dataset.key = … · wrapper.dataset.coverPending = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/playlist-render.js:154` | `renderPlaylistFull` | 2 chỗ: playlistContainer.innerHTML = … · playlistContainer.appendChild() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/playlist-render.js:215` | `_destroyNode` | 1 chỗ: node.remove() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/playlist-render.js:221` | `_revealNode` | 1 chỗ: node.classList.remove() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/playlist-render.js:237` | `_placeNodeAfter` | 1 chỗ: playlistContainer.insertBefore() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/playlist-render.js:250` | `refreshSongNode` | 2 chỗ: newNode.classList.toggle() · oldNode.replaceWith() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/playlist.js:407` | `pickCoverFromVideoThumb` | 1 chỗ: emptyEl.classList.toggle() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/playlist.js:622` | `replaceCurrentCoverUrl` | 1 chỗ: recordArtEl.src = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/playlist.js:647` | `openPhotoEditDurationPicker` | 1 chỗ: songEditPhotoDurationValueEl.textContent = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/playlist.js:855` | `uploadSongs` | 1 chỗ: playlistEmpty.classList.add() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/playlist.js:2078` | `switchSource` | 3 chỗ: playlistSearchInput.placeholder = … · btnPlaylistEmptyPlay.classList.remove() · btnPlaylistEmptyShuffle.classList.remove() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/playlist.js:2185` | `loadPersistedPlaylistConfigOnBoot` | 3 chỗ: playlistSearchInput.placeholder = … · btnPlaylistEmptyPlay.classList.remove() · btnPlaylistEmptyShuffle.classList.remove() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/playlist.js:2229` | `openSortPanel` | 3 chỗ: panelEl.querySelector('#setting-playlist-sort-name').value = … · panelEl.querySelector('#setting-playlist-sort-stat-field').value = … · panelEl.querySelector('#setting-playlist-sort-stat-direction').value = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/playlist.js:2243` | `_syncSortStatDependents` | 1 chỗ: el.classList.toggle() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/recorder.js:544` | `_openReview` | 1 chỗ: this._previewEl.src = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/recorder.js:583` | `seekPreview` | 1 chỗ: el.currentTime = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/recorder.js:614` | `_stopPreviewElement` | 1 chỗ: el.removeAttribute() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/settings-misc.js:163` | `_renderDebugConsoleList` | 3 chỗ: listEl.innerHTML = … · paginationEl.innerHTML = … · listEl.scrollTop = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/statis-panel.js:53` | `openPanel` | 1 chỗ: statisPanelBody.innerHTML = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/statis-panel.js:133` | `renderContent` | 1 chỗ: statisPanelBody.innerHTML = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/statis-panel.js:150` | `_startCountup` | 2 chỗ: el.style.width = … · el.textContent = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:50` | `init` | 1 chỗ: editorTitleEl.textContent = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:56` | `_showFatalError` | 2 chỗ: editorTitleEl.textContent = … · linesContainerEl.innerHTML = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:139` | `_initWaveform` | 5 chỗ: waveformControlsEl.classList.remove() · iconWaveformPlay.classList.add() · iconWaveformPause.classList.remove() … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:193` | `_showWaveformError` | 1 chỗ: waveformErrorEl.classList.remove() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:201` | `_updateRegionTimeDisplay` | 2 chỗ: waveformRegionStartEl.textContent = … · waveformRegionEndEl.textContent = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:210` | `_updateCurrentTimeDisplay` | 1 chỗ: waveformCurrentTimeEl.textContent = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:278` | `toggleDebugPanel` | 1 chỗ: waveformDebugPanelEl.classList.toggle() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:293` | `_renderDebugLog` | 8 chỗ: waveformDebugLogEl.replaceChildren() · document.createElement() · waveformDebugLogEl.appendChild() … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:332` | `_copyTextViaFallback` | 4 chỗ: document.createElement() · ta.style.position = … · ta.style.opacity = … … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:368` | `_renderLines` | 1 chỗ: subEmptyStateEl.classList.toggle() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:435` | `_removeLine` | 1 chỗ: node.remove() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:450` | `_syncPendingFromRegion` | 2 chỗ: startBtn.textContent = … · endBtn.textContent = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:462` | `_updateWaveformControlsBlockState` | 2 chỗ: el.classList.toggle() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:523` | `handleAutoTimingClick` | 2 chỗ: iconAutoTimingIdle.classList.add() · iconAutoTimingRecording.classList.remove() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:538` | `_resetAutoTiming` | 2 chỗ: iconAutoTimingRecording.classList.add() · iconAutoTimingIdle.classList.remove() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:582` | `exportSrt` | 1 chỗ: document.createElement() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:605` | `_scrollLineIntoView` | 1 chỗ: node.scrollIntoView() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:785` | `_initKaraokeMiniWaveform` | 1 chỗ: loadingEl.classList.add() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:848` | `_decodeKaraokeSourceHiRes` | 1 chỗ: ctx.close() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:855` | `_showKaraokeWaveformError` | 2 chỗ: el.classList.remove() · loadingEl.classList.add() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:901` | `_renderKaraokeRegions` | 13 chỗ: document.createElement() · label.textContent = … · label.style.cssText = … … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:982` | `_positionKaraokeKnobs` | 2 chỗ: knob.style.transform = … · knob.style.display = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:993` | `_onKaraokeKnobPointerDown` | 1 chỗ: knob.firstChild.style.transform = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:1011` | `_onKaraokeKnobPointerUp` | 1 chỗ: knob.firstChild.style.transform = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:1046` | `_syncKaraokeMiniScrollUi` | 1 chỗ: slider.value = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:1068` | `_setupKaraokeMiniScroll` | 5 chỗ: document.createElement() · style.dataset.karaokeMini = … · scrollEl.style.setProperty() … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:1103` | `_syncKaraokeWordInputs` | 1 chỗ: input.value = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:1136` | `_toggleKaraokeWordPlay` | 1 chỗ: highlight.element.style.pointerEvents = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:1237` | `_updateKaraokeWordPlayIcons` | 2 chỗ: playIcon.classList.toggle() · pauseIcon.classList.toggle() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:1245` | `_setKaraokeWordPlayEnabled` | 1 chỗ: btn.disabled = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:1276` | `_rebuildLineCard` | 1 chỗ: node.remove() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:1306` | `openSplitModal` | 37 chỗ: document.createElement() · overlay.id = … · overlay.className = … … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:1358` | `closeModal` | 2 chỗ: overlay.remove() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:1510` | `_updatePlaybackIcons` | 4 chỗ: iconPlayRegionPlay.classList.toggle() · iconPlayRegionPause.classList.toggle() · playIcon.classList.toggle() … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:1570` | `cutMp3FromRegion` | 4 chỗ: btnCutMp3.dataset.busy = … · btnCutMp3.classList.add() · btnCutMp3.classList.remove() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:1653` | `_downloadCutBlob` | 1 chỗ: document.createElement() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:1720` | `_renderShiftBar` | 3 chỗ: shiftSelectionBarEl.classList.toggle() · shiftSelectionCountEl.textContent = … · btnShiftContinue.classList.toggle() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-editor.js:1733` | `openShiftModal` | 56 chỗ: document.createElement() · overlay.id = … · overlay.className = … … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-style-settings.js:21` | `refresh` | 8 chỗ: panel.querySelector('#setting-subtitle-use-custom-styling').checked = … · panel.querySelector('#setting-subtitle-default-fontsize').value = … · panel.querySelector('#setting-subtitle-default-color').value = … … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-style-settings.js:86` | `_syncCustomStylingVisibility` | 2 chỗ: genericDrawerBody.querySelector('#setting-open-subtitle-styling').classList.toggle() · genericDrawerBody.querySelector('#setting-subtitle-default-fields').classList.toggle() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/subtitle-style-settings.js:96` | `_syncMagnitudeButton` | 2 chỗ: btn.dataset.ms = … · btn.textContent = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/theme.js:64` | `pickBackgroundMedia` | 1 chỗ: emptyEl.classList.toggle() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/ui-theme.js:132` | `_mirrorBootBackdrop` | 1 chỗ: preloaderEl.style.background = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/ui-theme.js:144` | `_applyPageLevelTheme` | 1 chỗ: document.documentElement.style.colorScheme = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-frame-capture.js:15` | `captureToPhoto` | 1 chỗ: sourceCanvas.toBlob() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-gallery-window.js:33` | `mount` | 7 chỗ: document.createElement() · containerEl.className = … · scrollEl.appendChild() … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-gallery-window.js:68` | `unmount` | 1 chỗ: m.containerEl.remove() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-gallery-window.js:95` | `_loadGroup` | 23 chỗ: record.el.style.height = … · record.el.classList.remove() · record.el.innerHTML = … … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-gallery-window.js:142` | `_unloadGroup` | 3 chỗ: record.el.innerHTML = … · record.el.style.height = … · record.el.classList.add() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-gallery-window.js:162` | `setBadgeMode` | 4 chỗ: oldBadge.remove() · tileEl.classList.remove() · tileEl.appendChild() … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-gallery-window.js:183` | `setTileBadge` | 3 chỗ: tileEl.classList.toggle() · oldBadge.remove() · tileEl.appendChild() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-motion-surface.js:55` | `showBridgeLayer` | 1 chỗ: visualBgImageElement.classList.add() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-player.js:186` | `swapBgVideoSource` | 10 chỗ: visualBgImageElement.classList.add() · bgVideoElement.style.opacity = … · bgVideoElement.style.transform = … … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-player.js:357` | `showStaticBgThumb` | 3 chỗ: bgVideoElement.classList.add() · bgVideoElement.removeAttribute() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-player.js:379` | `clearBgVideoSource` | 4 chỗ: bgVideoElement.classList.add() · bgVideoElement.removeAttribute() · bgVideoElement.style.opacity = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-player.js:442` | `startFromPlaylist` | 1 chỗ: visualizerSolidBg.style.backgroundColor = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-player.js:610` | `playVideoByKey` | 1 chỗ: recordContainer.innerHTML = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-player.js:709` | `handleVideoPlayState` | 3 chỗ: iconPlay.classList.add() · iconPause.classList.remove() · recordArtDynamic.classList.remove() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-player.js:726` | `handleVideoPauseState` | 3 chỗ: iconPlay.classList.remove() · iconPause.classList.add() · recordArtDynamic.classList.add() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-player.js:740` | `handleVideoLoadedMetadata` | 1 chỗ: durationTimeDisplay.textContent = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-player.js:756` | `handleVideoTimeUpdate` | 2 chỗ: progressBar.value = … · currentTimeDisplay.textContent = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-player.js:786` | `handleVideoSeeking` | 1 chỗ: currentTimeDisplay.textContent = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-preview.js:118` | `_loadVideoEditorScriptOnce` | 4 chỗ: document.createElement() · el.remove() · el.src = … … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-preview.js:294` | `handleMetadataLoaded` | 4 chỗ: this._modalHandle.cropCanvasEl.width = … · this._modalHandle.cropCanvasEl.height = … · this._modalHandle.posterEl.classList.add() … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-preview.js:351` | `_renderFilmstripCells` | 5 chỗ: framesEl.innerHTML = … · document.createElement() · cell.className = … … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-preview.js:403` | `_renderTrimPositions` | 7 chỗ: this._modalHandle.dimLeftEl.style.width = … · this._modalHandle.dimRightEl.style.width = … · this._modalHandle.rangeBorderEl.style.left = … … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-preview.js:506` | `_renderPlayheadPosition` | 2 chỗ: this._modalHandle.playheadEl.style.left = … · this._modalHandle.currentTimeLabelEl.textContent = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-preview.js:540` | `_renderOuterSeek` | 4 chỗ: h.seekFillEl.style.width = … · h.seekThumbEl.style.left = … · h.seekCurrentLabelEl.textContent = … … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-preview.js:578` | `handleVideoPlayState` | 1 chỗ: this._modalHandle.overlayEl.classList.toggle() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-preview.js:642` | `_setActiveTool` | 2 chỗ: this._modalHandle.overlayEl.dataset.tool = … · this._modalHandle.toolTitleEl.textContent = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-preview.js:703` | `_syncCropCanvasBox` | 6 chỗ: canvas.style.position = … · canvas.style.left = … · canvas.style.top = … … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-preview.js:725` | `_renderRatioButtonsActiveState` | 1 chỗ: btn.classList.toggle() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-preview.js:740` | `_renderFlipButtonState` | 2 chỗ: this._modalHandle.flipBtn.classList.toggle() · this._modalHandle.ratioFlipBtn.classList.toggle() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-preview.js:862` | `_renderTransformPreview` | 1 chỗ: videoEl.style.transform = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-preview.js:872` | `_fitCardToContent` | 4 chỗ: cardEl.style.width = … · cardEl.style.height = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-preview.js:912` | `_applyCroppedPreview` | 17 chỗ: cropViewEl.style.right = … · cropViewEl.style.bottom = … · cropViewEl.style.width = … … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-preview.js:1007` | `handleSaveModeSelect` | 1 chỗ: this._modalHandle.saveModeLabelEl.textContent = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-thumb-extract.js:80` | `probeFrame` | 5 chỗ: document.createElement() · probeCanvas.width = … · probeCanvas.height = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-thumb-extract.js:110` | `_grabFullFrame` | 6 chỗ: document.createElement() · canvas.width = … · canvas.height = … … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-thumb-extract.js:125` | `_canvasToJpegBlob` | 3 chỗ: canvas.toBlob() · canvas.width = … · canvas.height = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-thumb-extract.js:200` | `_captureSquareThumb` | 6 chỗ: document.createElement() · canvas.width = … · canvas.height = … … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/video-thumb-extract.js:241` | `extract` | 2 chỗ: document.createElement() · videoEl.removeAttribute() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/visual-bg-common.js:555` | `refreshSource` | 4 chỗ: btn.disabled = … · btn.classList.add() · btn.classList.remove() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/visual-bg-common.js:614` | `openDurationSecondsPicker` | 1 chỗ: btn.textContent = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/visual-bg-common.js:661` | `changeGradientAngle` | 1 chỗ: visualBgGradientPanelEl.querySelector('#visual-bg-gradient-angle-value').textContent = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/visual-bg-common.js:673` | `changeGradientStop` | 1 chỗ: visualBgGradientPanelEl.querySelector(`[data-visual-bg-stop-label="${index}"]`).textConten | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/visual-bg-common.js:696` | `openGradientPanel` | 14 chỗ: visualBgGradientPanelEl.querySelector('#setting-visual-bg-gradient-angle').value = … · visualBgGradientPanelEl.querySelector('#visual-bg-gradient-angle-value').textContent = … · visualBgGradientPanelEl.querySelector('#visual-bg-gradient-movement-options').classList.to … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/visual-bg-common.js:724` | `_renderGradientStopRows` | 2 chỗ: listEl.innerHTML = … · visualBgGradientPanelEl.querySelector('#setting-visual-bg-gradient-add').classList.toggle( | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/visual-bg-common.js:730` | `_paintGradientPreview` | 1 chỗ: visualBgGradientPanelEl.querySelector('#visual-bg-gradient-preview').style.backgroundImage | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/visual-bg-common.js:846` | `toggleGradientMovement` | 1 chỗ: visualBgGradientPanelEl.querySelector('#visual-bg-gradient-movement-options').classList.to | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/visual-bg-common.js:856` | `changeGradientMovementMode` | 2 chỗ: visualBgGradientPanelEl.querySelector('#visual-bg-gradient-movement-time-block').classList · visualBgGradientPanelEl.querySelector('#visual-bg-gradient-movement-audio-block').classLis | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/visual-bg-common.js:872` | `openGradientMovementDurationPicker` | 1 chỗ: visualBgGradientPanelEl.querySelector('#visual-bg-gradient-movement-duration-value').textC | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/visual-bg-common.js:890` | `toggleGradientColorSwap` | 1 chỗ: visualBgGradientPanelEl.querySelector('#visual-bg-gradient-colorswap-options').classList.t | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/visual-bg-common.js:904` | `openGradientColorSwapIntervalPicker` | 1 chỗ: visualBgGradientPanelEl.querySelector('#visual-bg-gradient-colorswap-interval-value').text | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/visual-bg-common.js:920` | `openGradientColorSwapTransitionPicker` | 1 chỗ: visualBgGradientPanelEl.querySelector('#visual-bg-gradient-colorswap-transition-value').te | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/visual-bg-common.js:967` | `refreshPanelUI` | 21 chỗ: listPlaybackSelect.value = … · nextOrderSelect.value = … · playbackGroup.classList.toggle() … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/visual-bg-common.js:1114` | `_refreshSourceNameLabel` | 4 chỗ: refreshBtn.classList.toggle() · clearBtn.classList.toggle() · labelEl.textContent = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/visual-bg-common.js:1194` | `_syncPickerConfirmButton` | 2 chỗ: btn.disabled = … · btn.textContent = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/visual-bg-photo-motion.js:159` | `updateBackgroundSize` | 1 chỗ: panEl.style.backgroundSize = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/visual-bg-photo-motion.js:172` | `_staticReveal` | 2 chỗ: panEl.style.backgroundSize = … · layerEl.classList.add() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/visual-bg-photo-motion.js:193` | `_showNext` | 2 chỗ: incomingPan.style.backgroundSize = … · outgoingPan.style.backgroundSize = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/visual-bg-photo-motion.js:225` | `stop` | 1 chỗ: panEl.style.backgroundSize = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/visual-bg-photo.js:203` | `openPickPhoto` | 1 chỗ: emptyEl.classList.toggle() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/visual-bg-video.js:225` | `_playVideoKey` | 1 chỗ: bgVideoElement.classList.remove() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/visual-bg-video.js:553` | `_refreshVideoAudioRowButtons` | 3 chỗ: iconBtn.innerHTML = … · display.textContent = … · display.dataset.uitk = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/visual-bg-video.js:607` | `openPickVideo` | 1 chỗ: emptyEl.classList.toggle() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/visualizer-display.js:28` | `openDisplayPanel` | 6 chỗ: panelEl.querySelector('#setting-visual-enable').checked = … · panelEl.querySelector('#setting-subtitles-enabled').checked = … · panelEl.querySelector('#setting-stats-panel-enable').checked = … … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/visualizer-display.js:57` | `openAutoSwitchPanel` | 5 chỗ: hoverEl.style.outline = … · document.body.style.userSelect = … · rowEl.style.transform = … | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/visualizer-gesture.js:256` | `_clickControlCenterTarget` | 1 chỗ: targetEl.click() | FAIL | Review (máy quét bỏ sót) | — | Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |
| `event/workflow/visualizer/shape.js:294` | `_loadClockBgImage` | 1 chỗ: img.src = … | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Ghi DOM là việc thi hành → hàm core (-ui) nhận phần tử qua tham số (where-to-edit: "sửa DOM tại chỗ: core/…-ui.js") |

#### Workflow tự tính toán (123)

| Vị trí | Hàm | Mô tả | Trạng thái | Nguồn | Nợ cũ | Ghi chú |
|---|---|---|---|---|---|---|
| `event/workflow/audio-analysis.js:55` | `<lúc nạp file>` | 1 chỗ: Math.ceil() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/audio-analysis.js:181` | `_tick` | 1 chỗ: Math.floor() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/audio-analysis.js:277` | `_acceptTempoEstimate` | 1 chỗ: Math.round() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/audio-analysis.js:292` | `_detectPitch` | 1 chỗ: Math.round() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/audio-analysis.js:320` | `_track` | 2 chỗ: Math.min() · Math.max() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/audio-analysis.js:369` | `_trackLoudness` | 1 chỗ: Math.max() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/audio-analysis.js:396` | `_applyChord` | 1 chỗ: Math.max() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/audio-analysis.js:442` | `_resetPitchRingsOnGap` | 1 chỗ: Math.abs() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/custom-effect.js:190` | `setSolidColor` | 1 chỗ: regex /^#[0-9A-F]{6}$/i | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/file-manager-folder-browser.js:238` | `_showFolderProperties` | 1 chỗ: .reduce() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/file-manager-photo.js:174` | `resizeImageForThumbnail` | 4 chỗ: Math.max() · Math.round() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/filter-rule-edit.js:100` | `openTimePicker` | 1 chỗ: Math.round() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/gameplay.js:345` | `_spawnOneWaveAtPitch` | 3 chỗ: Math.floor() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/gameplay.js:396` | `_trySpawnWave` | 1 chỗ: Math.min() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/gameplay.js:443` | `_rebuildPitchCellMap` | 1 chỗ: Math.floor() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/generic-drawer-helpers.js:74` | `_startHeightAnim` | 1 chỗ: Math.abs() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/generic-drawer-helpers.js:187` | `_retargetHeight` | 2 chỗ: Math.abs() · Math.max() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/image-edit.js:252` | `_editFitGeometry` | 2 chỗ: Math.min() · Math.max() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/image-edit.js:512` | `_drawStroke` | 1 chỗ: Math.max() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/image-edit.js:738` | `layerPointerMove` | 1 chỗ: Math.hypot() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/image-edit.js:887` | `_applyLayerStyleCssString` | 2 chỗ: Math.round() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/motion-beat-react-runner.js:184` | `_tick` | 1 chỗ: Math.min() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/motion-point-move-runner.js:143` | `_deriveLivePointMoveTarget` | 2 chỗ: Math.max() · Math.min() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/motion-point-move-runner.js:195` | `_activatePointMoveAll` | 1 chỗ: .sort() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/motion-point-move-runner.js:281` | `liveToggle` | 2 chỗ: Math.min() · Math.max() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/motion-presets.js:272` | `openTransitionDurationPicker` | 3 chỗ: Math.min() · Math.max() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/motion-presets.js:294` | `changeTransitionRatio` | 2 chỗ: Math.max() · Math.min() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/motion-presets.js:385` | `_nextAppendedTimingX` | 1 chỗ: Math.max() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/motion-presets.js:696` | `_computeTimingPoints` | 1 chỗ: .sort() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/motion-presets.js:768` | `stepPointMoveTimingZoom` | 2 chỗ: Math.max() · Math.min() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/motion-presets.js:815` | `_commitPointMoveTimingModal` | 2 chỗ: Math.max() · Math.min() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/motion-transition-runner.js:141` | `runTransition` | 1 chỗ: Math.max() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/pagination.js:65` | `getPlaceSettings` | 3 chỗ: Math.round() · Math.max() · Math.min() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/pagination.js:89` | `pageIndexOfItem` | 1 chỗ: Math.floor() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/pagination.js:143` | `changePlacePageSize` | 3 chỗ: Math.round() · Math.max() · Math.min() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/perf-hud.js:285` | `_trackTapBlock` | 1 chỗ: Math.max() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/photo-duration.js:61` | `compute` | 1 chỗ: Math.round() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/player-controls.js:362` | `runGatedSeek` | 2 chỗ: Math.abs() · Math.round() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/player.js:356` | `reloadCurrentSongKeepingPosition` | 1 chỗ: Math.min() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/playlist-order.js:127` | `_shuffleIndicesIfEnabled` | 1 chỗ: Math.floor() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/playlist-render.js:445` | `_scrollToKeyInstant` | 1 chỗ: Math.abs() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/playlist.js:645` | `openPhotoEditDurationPicker` | 1 chỗ: Math.round() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/playlist.js:900` | `uploadSongs` | 1 chỗ: regex /\.[^/.]+$/ | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/recorder.js:489` | `_measureLatency` | 1 chỗ: Math.max() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/recorder.js:499` | `_concatSamples` | 1 chỗ: .reduce() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/recorder.js:583` | `seekPreview` | 2 chỗ: Math.max() · Math.min() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/statis-panel.js:87` | `_loadData` | 7 chỗ: .reduce() · Math.floor() · Math.round() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/statis-panel.js:125` | `renderContent` | 1 chỗ: .sort() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/subtitle-display.js:218` | `_collectActiveLines` | 1 chỗ: Math.min() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/subtitle-display.js:256` | `_applyCommingPhase` | 1 chỗ: Math.max() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/subtitle-display.js:272` | `_applyOutingPhase` | 1 chỗ: Math.max() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/subtitle-display.js:437` | `_ensureKaraokeFx` | 1 chỗ: Math.min() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/subtitle-editor.js:120` | `_initWaveform` | 1 chỗ: Math.min() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/subtitle-editor.js:231` | `seekFromClick` | 2 chỗ: Math.max() · Math.min() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/subtitle-editor.js:247` | `_seekWithRetry` | 1 chỗ: Math.abs() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/subtitle-editor.js:263` | `zoomIn` | 2 chỗ: Math.min() · Math.round() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/subtitle-editor.js:269` | `zoomOut` | 2 chỗ: Math.max() · Math.round() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/subtitle-editor.js:489` | `openTimePickerModal` | 5 chỗ: Math.min() · Math.max() · Math.round() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/subtitle-editor.js:629` | `openKaraokeDrawer` | 1 chỗ: Math.round() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/subtitle-editor.js:758` | `_initKaraokeMiniWaveform` | 3 chỗ: Math.max() · Math.ceil() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/subtitle-editor.js:969` | `_getKaraokeMiniGeometry` | 1 chỗ: Math.max() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/subtitle-editor.js:1037` | `_onKaraokeMiniScrollInput` | 1 chỗ: Math.round() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/subtitle-editor.js:1046` | `_syncKaraokeMiniScrollUi` | 1 chỗ: Math.round() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/subtitle-editor.js:1090` | `_onKaraokeWordMsChange` | 1 chỗ: Math.max() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/subtitle-editor.js:1189` | `_tickKaraokeWordProgress` | 3 chỗ: Math.min() · Math.max() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/subtitle-editor.js:1205` | `_scrollKaraokeMiniIntoView` | 2 chỗ: Math.min() · Math.max() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/subtitle-editor.js:1598` | `_encodeMp3FromRegion` | 8 chỗ: Math.max() · Math.floor() · Math.min() … | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/subtitle-editor.js:1639` | `_showCutResultModal` | 1 chỗ: regex /[:,]/g | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/subtitle-style-settings.js:95` | `_syncMagnitudeButton` | 1 chỗ: Math.abs() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/subtitle-style-settings.js:108` | `openMagnitudePicker` | 1 chỗ: Math.abs() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/theme.js:217` | `buildBackgroundCardState` | 4 chỗ: Math.max() · Math.min() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/ui-theme.js:122` | `_mirrorBootBackdrop` | 1 chỗ: regex /^#[0-9a-fA-F]{3,8}$/ | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/video-player.js:679` | `reloadCurrentVideoKeepingPosition` | 1 chỗ: Math.min() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/video-player.js:1009` | `_clampSeekTarget` | 2 chỗ: Math.min() · Math.max() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/video-preview.js:193` | `_formatVideoPreviewTime` | 3 chỗ: Math.max() · Math.floor() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/video-preview.js:214` | `_setShieldPercent` | 3 chỗ: Math.max() · Math.min() · Math.round() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/video-preview.js:333` | `_computeFilmstripThumbSize` | 2 chỗ: Math.max() · Math.round() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/video-preview.js:442` | `_seekToClientX` | 4 chỗ: Math.max() · Math.min() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/video-preview.js:457` | `handleTrimDragMove` | 4 chỗ: Math.max() · Math.min() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/video-preview.js:528` | `_seekOuterToClientX` | 2 chỗ: Math.max() · Math.min() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/video-preview.js:538` | `_renderOuterSeek` | 3 chỗ: Math.max() · Math.min() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/video-preview.js:666` | `_getRotateTransform` | 2 chỗ: Math.min() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/video-preview.js:761` | `_toCropCanvasCoords` | 2 chỗ: Math.cos() · Math.sin() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/video-preview.js:875` | `_fitCardToContent` | 5 chỗ: Math.min() · Math.max() · Math.floor() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/video-preview.js:908` | `_applyCroppedPreview` | 1 chỗ: Math.min() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/video-preview.js:1044` | `_buildNewFilename` | 1 chỗ: regex /\.[^/.]+$/ | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/video-thumb-extract.js:66` | `_seekVideoTo` | 1 chỗ: Math.abs() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/video-thumb-extract.js:109` | `_grabFullFrame` | 6 chỗ: Math.min() · Math.sqrt() · Math.max() … | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/video-thumb-extract.js:194` | `_captureSquareThumb` | 2 chỗ: Math.min() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/visual-bg-common.js:120` | `loadPersistedSettingsOnBoot` | 8 chỗ: Math.max() · Math.min() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/visual-bg-common.js:183` | `advanceList` | 1 chỗ: Math.floor() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/visual-bg-common.js:608` | `openDurationSecondsPicker` | 2 chỗ: Math.max() · Math.round() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/visual-bg-common.js:787` | `_tickGradientMovement` | 2 chỗ: Math.min() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/visual-bg-photo.js:57` | `_computePhotoAdvanceMs` | 2 chỗ: Math.max() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/visual-bg-video.js:208` | `reloadCurrentVideoKeepingPosition` | 1 chỗ: Math.min() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/visual-bg-video.js:325` | `_computeVideoPointMoveAdvanceMs` | 1 chỗ: Math.min() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/visualizer-gesture.js:181` | `handleTouchMove` | 1 chỗ: Math.hypot() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/visualizer-gesture.js:192` | `handleTouchEnd` | 1 chỗ: Math.hypot() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/visualizer-gesture.js:317` | `_runSeekTick` | 1 chỗ: Math.abs() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/visualizer-render.js:175` | `_detectMediaSeek` | 1 chỗ: Math.abs() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/visualizer/bar.js:44` | `true` | 4 chỗ: Math.sqrt() · Math.min() · Math.max() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/visualizer/bar.js:100` | `onResize` | 1 chỗ: Math.max() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/visualizer/bar.js:141` | `_drawBlackHole` | 2 chỗ: Math.min() · Math.max() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/visualizer/bar.js:167` | `_paintBlackHoleFlare` | 1 chỗ: Math.round() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/visualizer/bar.js:200` | `_paintBlackHoleBurstRays` | 1 chỗ: Math.floor() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/visualizer/bar.js:257` | `_resolveBlackHoleHalfCount` | 1 chỗ: Math.max() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/visualizer/bar.js:275` | `_closeBlackHoleSeam` | 1 chỗ: Math.max() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/visualizer/bar.js:306` | `_drawDot` | 3 chỗ: Math.max() · Math.round() · Math.min() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/visualizer/bar.js:399` | `_syncDotSnakeSpacing` | 1 chỗ: Math.abs() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/visualizer/bar.js:454` | `_buildDotSpawn` | 1 chỗ: Math.max() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/visualizer/bar.js:466` | `_stepDotVibration` | 1 chỗ: Math.min() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/visualizer/connector.js:99` | `_build` | 1 chỗ: Math.min() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/visualizer/connector.js:202` | `_beginWebglFrame` | 2 chỗ: Math.max() · Math.min() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/visualizer/connector.js:333` | `_resolvePitchNodeIndex` | 1 chỗ: Math.pow() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/visualizer/lighting.js:93` | `_spawnBolt` | 1 chỗ: Math.floor() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/visualizer/lighting.js:111` | `_drawFireworks` | 3 chỗ: Math.floor() · Math.min() · Math.max() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/visualizer/lighting.js:148` | `_explodeRocket` | 3 chỗ: Math.max() · Math.round() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/visualizer/lighting.js:186` | `_launchOne` | 2 chỗ: Math.min() · Math.max() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/visualizer/shape.js:88` | `_drawRubik` | 2 chỗ: Math.min() · .sort() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/visualizer/shape.js:137` | `_drawClock` | 2 chỗ: Math.min() · Math.sin() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/visualizer/shape.js:223` | `_paintClockPendulum` | 1 chỗ: Math.sin() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/zip-download.js:109` | `compressInParts` | 2 chỗ: Math.round() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |
| `event/workflow/zip-download.js:139` | `_presentParts` | 2 chỗ: .reduce() | FAIL | Review (máy quét bỏ sót) | — | Phép tính/chuẩn hoá → core thuần trả giá trị (K4/K5) |

#### Workflow tự vẽ canvas (14)

| Vị trí | Hàm | Mô tả | Trạng thái | Nguồn | Nợ cũ | Ghi chú |
|---|---|---|---|---|---|---|
| `event/workflow/file-manager-photo.js:180` | `resizeImageForThumbnail` | 1 chỗ: ctx.drawImage() | FAIL | Review (máy quét bỏ sót) | — | Vẽ là thi hành → core vẽ nhận ctx qua tham số |
| `event/workflow/image-edit.js:508` | `_drawStroke` | 9 chỗ: ctx.beginPath() · ctx.moveTo() · ctx.lineTo() … | FAIL | Review (máy quét bỏ sót) | — | Vẽ là thi hành → core vẽ nhận ctx qua tham số |
| `event/workflow/image-edit.js:532` | `applyDrawTool` | 4 chỗ: baseCtx.clearRect() · baseCtx.drawImage() · renderCtx.clearRect() … | FAIL | Review (máy quét bỏ sót) | — | Vẽ là thi hành → core vẽ nhận ctx qua tham số |
| `event/workflow/image-edit.js:935` | `_renderLayers` | 1 chỗ: ctx.clearRect() | FAIL | Review (máy quét bỏ sót) | — | Vẽ là thi hành → core vẽ nhận ctx qua tham số |
| `event/workflow/image-edit.js:957` | `_exportEditedBlob` | 2 chỗ: ctx.drawImage() | FAIL | Review (máy quét bỏ sót) | — | Vẽ là thi hành → core vẽ nhận ctx qua tham số |
| `event/workflow/video-thumb-extract.js:86` | `probeFrame` | 1 chỗ: ctx.drawImage() | FAIL | Review (máy quét bỏ sót) | — | Vẽ là thi hành → core vẽ nhận ctx qua tham số |
| `event/workflow/visualizer-render.js:348` | `_drawFrame` | 1 chỗ: ctx.clearRect() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Vẽ là thi hành → core vẽ nhận ctx qua tham số |
| `event/workflow/visualizer/bar.js:118` | `_drawCascade` | 1 chỗ: ctx.shadowBlur = … | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Vẽ là thi hành → core vẽ nhận ctx qua tham số |
| `event/workflow/visualizer/bar.js:294` | `_drawMirror` | 1 chỗ: ctx.shadowBlur = … | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Vẽ là thi hành → core vẽ nhận ctx qua tham số |
| `event/workflow/visualizer/bar.js:365` | `_drawDot` | 1 chỗ: ctx.shadowBlur = … | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Vẽ là thi hành → core vẽ nhận ctx qua tham số |
| `event/workflow/visualizer/rain.js:75` | `_drawGlass` | 5 chỗ: ctx.globalAlpha = … · ctx.fillStyle = … · ctx.fillRect() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Vẽ là thi hành → core vẽ nhận ctx qua tham số |
| `event/workflow/visualizer/rain.js:124` | `_paintBackdrop` | 2 chỗ: ctx.fillStyle = … · ctx.fillRect() | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Vẽ là thi hành → core vẽ nhận ctx qua tham số |
| `event/workflow/visualizer/rain.js:160` | `_drawStreet` | 1 chỗ: ctx.globalAlpha = … | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Vẽ là thi hành → core vẽ nhận ctx qua tham số |
| `event/workflow/visualizer/shape.js:167` | `_drawClock` | 8 chỗ: ctx.save() · ctx.translate() · ctx.scale() … | FAIL | Review (máy quét bỏ sót) | — | Hot path visualizer. Vẽ là thi hành → core vẽ nhận ctx qua tham số |

#### Workflow tự điều khiển media (49)

| Vị trí | Hàm | Mô tả | Trạng thái | Nguồn | Nợ cũ | Ghi chú |
|---|---|---|---|---|---|---|
| `event/workflow/app-visibility.js:120` | `_enforcePlayerMediaPaused` | 1 chỗ: bgVideoElement.pause() | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/app-visibility.js:134` | `_restorePlayerMedia` | 1 chỗ: bgVideoElement.play() | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/file-manager-storage.js:86` | `clearAllStoredData` | 2 chỗ: audioPlayer.pause() · audioPlayer.src = … | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/gameplay.js:112` | `start` | 1 chỗ: activeEl.pause() | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/gameplay.js:144` | `_beginPlaying` | 2 chỗ: activeEl.play() | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/gameplay.js:549` | `replay` | 1 chỗ: activeEl.pause() | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/gameplay.js:584` | `exitToPlaylist` | 1 chỗ: activeEl.pause() | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/photo-player.js:128` | `startFromPlaylist` | 2 chỗ: audioPlayer.pause() · bgVideoElement.pause() | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/player-controls.js:72` | `photo` | 1 chỗ: activeEl.play() | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/player-controls.js:339` | `runGatedSeek` | 4 chỗ: mediaEl.pause() · mediaEl.load() · mediaEl.currentTime = … … | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/player-controls.js:440` | `playAfterSeekGate` | 1 chỗ: mediaEl.play() | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/player-controls.js:605` | `goToNextTrack` | 1 chỗ: activeEl.pause() | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/player.js:171` | `playMedia` | 4 chỗ: audioPlayer.play() · audioPlayer.pause() · audioPlayer.src = … | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/player.js:352` | `reloadCurrentSongKeepingPosition` | 3 chỗ: audioPlayer.play() · audioPlayer.currentTime = … · audioPlayer.src = … | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/playlist.js:243` | `deleteMediaFromActionMenu` | 2 chỗ: audioPlayer.pause() · audioPlayer.src = … | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/playlist.js:1898` | `deleteSelectedMedia` | 2 chỗ: audioPlayer.pause() · audioPlayer.src = … | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/recorder.js:70` | `false` | 1 chỗ: el.pause() | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/recorder.js:238` | `_runCountIn` | 1 chỗ: activeEl.pause() | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/recorder.js:331` | `_ensureMediaPlaying` | 1 chỗ: activeEl.play() | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/recorder.js:349` | `_stopRecording` | 1 chỗ: activeEl.pause() | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/recorder.js:462` | `runCalibration` | 1 chỗ: activeEl.pause() | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/recorder.js:588` | `_playPreview` | 1 chỗ: el.play() | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/recorder.js:613` | `_stopPreviewElement` | 2 chỗ: el.pause() · el.load() | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/recorder.js:700` | `_resumeMedia` | 1 chỗ: activeEl.play() | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/video-player.js:136` | `swapBgVideoSource` | 4 chỗ: bgVideoElement.pause() · bgVideoElement.poster = … · bgVideoElement.src = … … | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/video-player.js:356` | `showStaticBgThumb` | 2 chỗ: bgVideoElement.pause() · bgVideoElement.src = … | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/video-player.js:378` | `clearBgVideoSource` | 2 chỗ: bgVideoElement.pause() · bgVideoElement.src = … | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/video-player.js:437` | `startFromPlaylist` | 1 chỗ: audioPlayer.pause() | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/video-player.js:481` | `exitVideoPlayerMode` | 1 chỗ: bgVideoElement.load() | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/video-player.js:524` | `playVideoByKey` | 1 chỗ: bgVideoElement.play() | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/video-player.js:679` | `reloadCurrentVideoKeepingPosition` | 1 chỗ: bgVideoElement.currentTime = … | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/video-player.js:699` | `togglePlayPauseVideo` | 1 chỗ: bgVideoElement.pause() | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/video-player.js:774` | `handleVideoSeeking` | 1 chỗ: bgVideoElement.pause() | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/video-player.js:998` | `_flushScrubSeek` | 1 chỗ: bgVideoElement.currentTime = … | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/video-preview.js:444` | `_seekToClientX` | 1 chỗ: this._modalHandle.videoEl.currentTime = … | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/video-preview.js:464` | `handleTrimDragMove` | 2 chỗ: this._modalHandle.videoEl.currentTime = … | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/video-preview.js:497` | `handleVideoTimeUpdate` | 1 chỗ: this._modalHandle.videoEl.currentTime = … | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/video-preview.js:530` | `_seekOuterToClientX` | 1 chỗ: this._modalHandle.videoEl.currentTime = … | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/video-preview.js:553` | `handleCaptureClick` | 1 chỗ: videoEl.pause() | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/video-preview.js:584` | `handleMediaTapClick` | 2 chỗ: videoEl.play() · videoEl.pause() | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/video-thumb-extract.js:68` | `_seekVideoTo` | 1 chỗ: videoEl.currentTime = … | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/video-thumb-extract.js:165` | `_captureFirstFrame` | 5 chỗ: videoEl.pause() · videoEl.play() | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/video-thumb-extract.js:242` | `extract` | 4 chỗ: videoEl.muted = … · videoEl.pause() · videoEl.load() … | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/visual-bg-video.js:93` | `_restartCurrentVideoInPlace` | 3 chỗ: bgVideoElement.muted = … · bgVideoElement.currentTime = … · bgVideoElement.play() | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/visual-bg-video.js:208` | `reloadCurrentVideoKeepingPosition` | 1 chỗ: bgVideoElement.currentTime = … | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/visual-bg-video.js:220` | `_playVideoKey` | 1 chỗ: bgVideoElement.muted = … | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/visual-bg-video.js:389` | `_applyVideoPlaybackSpeedSetting` | 1 chỗ: bgVideoElement.playbackRate = … | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/visual-bg-video.js:396` | `_applyVideoAudioSettingToElement` | 2 chỗ: bgVideoElement.muted = … · bgVideoElement.volume = … | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |
| `event/workflow/visual-bg-video.js:430` | `_resumeVideoWithDelayedAudio` | 2 chỗ: bgVideoElement.muted = … · bgVideoElement.play() | FAIL | Review (máy quét bỏ sót) | — | play/pause/src/currentTime là thi hành → core nhận phần tử media qua tham số |

#### Workflow §7: rẽ nhánh không dùng object map (108)

| Vị trí | Hàm | Mô tả | Trạng thái | Nguồn | Nợ cũ | Ghi chú |
|---|---|---|---|---|---|---|
| `event/workflow/app-boot.js:159` | `boot` | if-else: {call workflowPlaylistScope.applyFolderScope} / {call workflowPlaylistScope.applyAllSongsScope} | FAIL | Review (máy quét bỏ sót) | — | Rẽ ≥2 tiến trình — phải viết object map / VirtualMachineState |
| `event/workflow/app-settings.js:75` | `back` | if-return: {call close} / {call prev} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/app-settings.js:156` | `handleCarouselCardTap` | if-return: {call scrollSettingsCarouselTo} / {set _mainCarouselIndex} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/app-settings.js:221` | `_renderPlaylistFilterEdit` | if-return: {call back} / {call _render, call renderPlaylistFilterEditBody} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/app-settings.js:269` | `handlePaginationPlaceChange` | if-elseif: {call workflowPagination.changePlaceEnabled} / {call workflowPagination.changePlacePageSize} / {call workflowPagination.changePlaceStyle} | FAIL | Review (máy quét bỏ sót) | — | Rẽ ≥2 tiến trình — phải viết object map / VirtualMachineState |
| `event/workflow/app-settings.js:379` | `_renderMotionPicker` | if-return: {call back} / {call _render, call renderMotionPickerBody} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/app-settings.js:392` | `_renderMotionEdit` | if-return: {call back} / {call _render, call renderMotionEditBody} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/app-settings.js:405` | `_renderPointMoveList` | if-return: {call back} / {call _render, call renderPointMoveListBody} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/app-settings.js:414` | `_renderPointMoveEdit` | if-return: {call back} / {call _render, call renderPointMoveEditBody} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/app-settings.js:427` | `_renderPointMoveTiming` | if-return: {call back} / {call _render, call renderPointMoveTimingBody} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/element-style-editor.js:99` | `_render` | if-return: {call _renderFontPicker} / {call renderElementStyleEditorHeader, call renderElementStyleEditorBody} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/element-style-editor.js:161` | `<anon>` | if-else: {call _render} / {call _updatePreview} | FAIL | Review (máy quét bỏ sót) | — | Rẽ ≥2 tiến trình — phải viết object map / VirtualMachineState |
| `event/workflow/element-style-editor.js:301` | `_close` | if-else: {call _onClose} / {call workflowGenericDrawerHelpers.closeFully} | FAIL | Review (máy quét bỏ sót) | — | Rẽ ≥2 tiến trình — phải viết object map / VirtualMachineState |
| `event/workflow/eq-presets.js:122` | `onCycleClick` | if-return: {set _cycleHoldFired} / {call cyclePreset} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/eq-presets.js:317` | `_commitName` | if-return: {set _draftName, set nameInput.value} / {call appState.set:'eqPresets', call setMeta} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/file-manager-storage.js:440` | `_runStorageActionForSource` | if-return: {call _downloadZipFor, call withLoadingShield} / {call _downloadZipFor, call withLoadingShield} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/file-manager-storage.js:451` | `_runStorageActionForSource` | if-return: {call _downloadZipFor, call withLoadingShield} / {call _downloadZipFor, call withLoadingShield} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/gameplay-engine.js:60` | `_countdownTick` | if-return: {call appState.set:'gameplayCountdownValue', call showGameplayCountdown} / {call hideGameplayCountdown, call onComplete} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/gameplay.js:446` | `_rebuildPitchCellMap` | if-elseif: {call generateRowMajorOrder} / {call generateColumnMajorOrder} / {call generateBoustrophedonRowOrder} | FAIL | Review (máy quét bỏ sót) | — | Rẽ ≥2 tiến trình — phải viết object map / VirtualMachineState |
| `event/workflow/generic-drawer-helpers.js:74` | `_startHeightAnim` | if-return: {set _heightAnimEndAt} / {call animateGenericDrawerHeight, set _heightAnimFromPx} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/generic-drawer-helpers.js:183` | `_retargetHeight` | if-return: {call settleGenericDrawerHeightPx, call animateGenericDrawerHeight} / {call settleGenericDrawerHeightPx, call _startHeightAnim} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/generic-drawer-helpers.js:187` | `_retargetHeight` | if-return: {call animateGenericDrawerHeight} / {call _startHeightAnim} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/hud.js:71` | `selectSpeed` | if-elseif: {call workflowPlayerDisplaySettings.resyncVideoPlayerPointMovePreset} / {call workflowVisualBg.onGlobalPlaybackSpeedChanged} / {} | FAIL | Review (máy quét bỏ sót) | — | Rẽ ≥2 tiến trình — phải viết object map / VirtualMachineState |
| `event/workflow/image-edit.js:148` | `openEditTool` | if-return: {call openAdjustTool} / {call _startCropTool, call _startDrawTool} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/image-edit.js:149` | `openEditTool` | if-return: {call _startCropTool} / {call _startDrawTool, call _startTextTool} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/image-edit.js:150` | `openEditTool` | if-return: {call _startDrawTool} / {call _startTextTool, call _startShapeTool} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/image-edit.js:151` | `openEditTool` | if-return: {call _startTextTool} / {call _startShapeTool} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/image-edit.js:607` | `applyTextTool` | if-return: {call exitSubTool} / {call _editFitGeometry, call _layers.push} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/image-edit.js:721` | `layerPointerDown` | if-return: {set _selectedLayerIndex} / {set _selectedLayerIndex, set _layerDragMoved} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/image-edit.js:885` | `_applyLayerStyleCssString` | if-else: {set layer.color, set layer.fontSizePx} / {set layer.fillColor, set layer._lastFillColor} | FAIL | Review (máy quét bỏ sót) | — | Rẽ ≥2 tiến trình — phải viết object map / VirtualMachineState |
| `event/workflow/image-edit.js:937` | `_renderLayers` | if-else: {call drawTextOnCanvas} / {call drawShapeOnCanvas} | FAIL | Review (máy quét bỏ sót) | — | Rẽ ≥2 tiến trình — phải viết object map / VirtualMachineState |
| `event/workflow/motion-beat-react-runner.js:136` | `_tick` | if-return: {call stop} / {call audioAnalysis.beatScale, call _rollEffectiveMax} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/motion-point-move-runner.js:223` | `_runActivate` | if-return: {call _activatePointMoveOne} / {call _activatePointMoveAll} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/photo-player.js:209` | `playPhotoByKey` | if-return: {call workflowPlayerControls.goToNextTrack} / {call _revokeObjectUrls, set _thumbObjectUrl} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/photo-player.js:305` | `_photoPlayerTick` | if-return: {call eventBus.send} / {call updatePhotoPlayerTimeLabels} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/player-controls.js:344` | `runGatedSeek` | if-return: {call _abortSeekGate} / {call _waitMediaEvent, call mediaEl.load} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/player-controls.js:351` | `runGatedSeek` | if-return: {call _abortSeekGate} / {call _waitMediaEvent, set mediaEl.currentTime} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/player-controls.js:365` | `runGatedSeek` | if-return: {call _abortSeekGate} / {call gateHooks.afterSeek, call _setMasterGainForSeekGate} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/player-controls.js:439` | `playAfterSeekGate` | if-return: {set _seekGatePlayRequested} / {call mediaEl.play} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/player-controls.js:553` | `handlePlayPauseClick` | if-return: {call workflowPlayer.playMedia} / {call togglePlayPause} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/player-controls.js:600` | `goToNextTrack` | if-return: {call appState.set:'playbackStoppedAtPlaylistEnd', call activeEl.pause} / {call workflowPlaylistOrder.recomputeDisplayOrder} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/player-controls.js:656` | `restartCurrentTrack` | if-return: {set activeEl.currentTime, call workflowPhotoPlayer.onClockRestarted} / {call runGatedSeek, call updateMediaPositionState} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/player-display-settings.js:143` | `changeResolutionMode` | if-elseif: {call applyVideoPlayerResolutionToDOM, call applyVideoPlayerResolutionToLayerBDOM} / {call workflowPhotoPlayer.refreshResolution} / {} | FAIL | Review (máy quét bỏ sót) | — | Rẽ ≥2 tiến trình — phải viết object map / VirtualMachineState |
| `event/workflow/player.js:92` | `playMedia` | if-return: {call eventBus.send} / {call workflowPhotoPlayer.playPhotoByKey, call workflowPhotoPlayer.startFromPlaylist} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/player.js:135` | `playMedia` | if-return: {call workflowPhotoPlayer.playPhotoByKey, call workflowPhotoPlayer.startFromPlaylist} / {call workflowPlayerControls.showTrackChange, call audioPlayer.play} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/player.js:137` | `playMedia` | if-else: {call workflowPhotoPlayer.playPhotoByKey} / {call workflowPhotoPlayer.startFromPlaylist} | FAIL | Review (máy quét bỏ sót) | — | Rẽ ≥2 tiến trình — phải viết object map / VirtualMachineState |
| `event/workflow/player.js:162` | `playMedia` | if-return: {call workflowPlayerControls.showTrackChange, call audioPlayer.play} / {call requestWakeLock, call withLoadingShield} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/player.js:211` | `<anon>` | if-return: {call workflowPlaylistOrder.removeKeyFromDisplay} / {call appState.set:'currentKey', call workflowAutoSwitchVisual.onMediaChanged} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/playlist-empty-state.js:62` | `resetToTopLevelThenShuffle` | if-else: {call btnShuffle.click} / {call updateShuffleArrayFromQueue} | FAIL | Review (máy quét bỏ sót) | — | Rẽ ≥2 tiến trình — phải viết object map / VirtualMachineState |
| `event/workflow/playlist-empty-state.js:84` | `reshuffleTopLevelAlways` | if-else: {call btnShuffle.click} / {call updateShuffleArrayFromQueue} | FAIL | Review (máy quét bỏ sót) | — | Rẽ ≥2 tiến trình — phải viết object map / VirtualMachineState |
| `event/workflow/playlist.js:232` | `<anon>` | if-elseif: {call workflowVideoPlayer.exitVideoPlayerMode, call appState.set:'currentKey'} / {call appState.set:'currentObjectURL', call appState.set:'currentCoverObjectURL'} / {} | FAIL | Review (máy quét bỏ sót) | — | Rẽ ≥2 tiến trình — phải viết object map / VirtualMachineState |
| `event/workflow/playlist.js:1189` | `uploadPhotos` | if-else: {call workflowPlaylistScope.applyFolderScope} / {call workflowPlaylistScope.applyAllSongsScope} | FAIL | Review (máy quét bỏ sót) | — | Rẽ ≥2 tiến trình — phải viết object map / VirtualMachineState |
| `event/workflow/playlist.js:1364` | `exportSongWithTag` | if-elseif: {call alertModal} / {call alertModal, call workflowZipDownload.promptSingle} / {call workflowZipDownload.promptSingle} | FAIL | Review (máy quét bỏ sót) | — | Rẽ ≥2 tiến trình — phải viết object map / VirtualMachineState |
| `event/workflow/playlist.js:1493` | `exportActiveMenuItem` | if-elseif: {call exportVideoFile} / {call exportImageFile} / {call exportSongWithTag} | FAIL | Review (máy quét bỏ sót) | — | Rẽ ≥2 tiến trình — phải viết object map / VirtualMachineState |
| `event/workflow/playlist.js:1762` | `pickFolderInPicker` | if-return: {call _folderPickerSelectedIds.splice, call _folderPickerSelectedIds.push} / {call closeFolderPicker, call onPick} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/playlist.js:1804` | `closeFolderPicker` | if-else: {call onClose} / {call workflowGenericDrawerHelpers.closeFully} | FAIL | Review (máy quét bỏ sót) | — | Rẽ ≥2 tiến trình — phải viết object map / VirtualMachineState |
| `event/workflow/playlist.js:1884` | `deleteSelectedMedia` | if-else: {call workflowVideoPlayer.exitVideoPlayerMode, call appState.set:'currentKey'} / {call appState.set:'currentObjectURL', call appState.set:'currentCoverObjectURL'} | FAIL | Review (máy quét bỏ sót) | — | Rẽ ≥2 tiến trình — phải viết object map / VirtualMachineState |
| `event/workflow/recorder.js:184` | `start` | if-return: {call _abortStart} / {call _beginCapture, call _releaseCaptureResources} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/recorder.js:647` | `save` | if-return: {call alertModal, call _endSession} / {call workflowPlaylist.addRecordedSong, call alertModal} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/statis-panel.js:150` | `paintFrame` | if-else: {set el.style.width} / {set el.textContent} | FAIL | Review (máy quét bỏ sót) | — | Rẽ ≥2 tiến trình — phải viết object map / VirtualMachineState |
| `event/workflow/subtitle-editor.js:248` | `<anon>` | if-else: {call onSeeked} / {call _seekWithRetry} | FAIL | Review (máy quét bỏ sót) | — | Rẽ ≥2 tiến trình — phải viết object map / VirtualMachineState |
| `event/workflow/subtitle-editor.js:503` | `onConfirm` | if-else: {call appState.set:'_editingPendingStart'} / {call appState.set:'_editingPendingEnd'} | FAIL | Review (máy quét bỏ sót) | — | Rẽ ≥2 tiến trình — phải viết object map / VirtualMachineState |
| `event/workflow/subtitle-editor.js:520` | `handleAutoTimingClick` | if-else: {call _clearLineRangeStopHandler, call appState.set:'_autoSubStartTime'} / {call appState.set:'_subtitles', call sortSubtitlesByStart} | FAIL | Review (máy quét bỏ sót) | — | Rẽ ≥2 tiến trình — phải viết object map / VirtualMachineState |
| `event/workflow/subtitle-editor.js:1186` | `_tickKaraokeWordProgress` | if-return: {call _stopKaraokeWordPlayback} / {call highlight.setOptions, call _scrollKaraokeMiniIntoView} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/theme.js:65` | `pickBackgroundMedia` | if-else: {call workflowFileManagerPhoto.setupPhotoGridWindow} / {call workflowVideoGalleryWindow.mount} | FAIL | Review (máy quét bỏ sót) | — | Rẽ ≥2 tiến trình — phải viết object map / VirtualMachineState |
| `event/workflow/theme.js:80` | `_teardownMediaPicker` | if-elseif: {call workflowPhotoGalleryWindow.unmount} / {call workflowVideoGalleryWindow.unmount} / {} | FAIL | Review (máy quét bỏ sót) | — | Rẽ ≥2 tiến trình — phải viết object map / VirtualMachineState |
| `event/workflow/video-player.js:138` | `swapBgVideoSource` | if-return: {set _swapInProgress} / {call decodeForcedBgThumb, set _forcedBgObjectUrl} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/video-player.js:274` | `<anon>` | if-else: {call bgVideoElement.addEventListener} / {call bgVideoElement.addEventListener, call taskManager.once} | FAIL | Review (máy quét bỏ sót) | — | Rẽ ≥2 tiến trình — phải viết object map / VirtualMachineState |
| `event/workflow/video-player.js:519` | `playVideoByKey` | if-return: {call workflowPlayerControls.showTrackChange, call bgVideoElement.play} / {call withLoadingShield} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/video-player.js:570` | `<anon>` | if-return: {set _skipToNextAfterShield} / {call appState.set:'currentKey', call workflowAutoSwitchVisual.onMediaChanged} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/video-player.js:687` | `refreshVideoPlaylistIfActive` | if-else: {call workflowPlaylistScope.applyFolderScope} / {call workflowPlaylistScope.applyAllSongsScope} | FAIL | Review (máy quét bỏ sót) | — | Rẽ ≥2 tiến trình — phải viết object map / VirtualMachineState |
| `event/workflow/video-player.js:932` | `_refreshFrozenSeekFrame` | if-return: {set _seekFreezeRefreshPending} / {set _seekFreezeRefreshing, call _captureSeekFrameToLayerB} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/video-player.js:992` | `onDone` | if-return: {set _scrubPendingTarget} / {call _refreshFrozenSeekFrame, call _flushScrubSeek} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/video-preview.js:167` | `_ensureMediabunnyLoaded` | if-return: {set window.Mediabunny, delete window._videoEditorScriptPromises[]} / {set window._videoEditorAacChecked, call _loadVideoEditorScriptOnce} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/video-preview.js:222` | `bootFromUrl` | if-return: {call alertModal, call _leaveToPlaylist} / {call open, call _leaveToPlaylist} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/video-preview.js:267` | `<anon>` | if-return: {call _disposeModal} / {call pct, call _renderFilmstripFrames} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/video-preview.js:452` | `handleTrimDragMove` | if-return: {call _seekToClientX} / {call _seekOuterToClientX, call appState.set:'videoPreviewCutStart'} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/video-preview.js:453` | `handleTrimDragMove` | if-return: {call _seekOuterToClientX} / {call appState.set:'videoPreviewCutStart', set _modalHandle.videoEl.currentTime} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/video-preview.js:461` | `handleTrimDragMove` | if-else: {call appState.set:'videoPreviewCutStart', set _modalHandle.videoEl.currentTime} / {call appState.set:'videoPreviewCutEnd', set _modalHandle.videoEl.currentTime} | FAIL | Review (máy quét bỏ sót) | — | Rẽ ≥2 tiến trình — phải viết object map / VirtualMachineState |
| `event/workflow/video-preview.js:608` | `handleToolOpen` | if-else: {call _syncCropCanvasBox, call _drawCropOverlay} / {call _renderTrimPositions, call _renderPlayheadPosition} | FAIL | Review (máy quét bỏ sót) | — | Rẽ ≥2 tiến trình — phải viết object map / VirtualMachineState |
| `event/workflow/video-preview.js:858` | `_renderTransformPreview` | if-return: {call _applyCroppedPreview} / {set cropViewEl.style[], set videoEl.style[]} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/video-preview.js:1089` | `<anon>` | if-else: {call replaceVideoMedia} / {call saveVideo, call _attachToActiveVideoFolder} | FAIL | Review (máy quét bỏ sót) | — | Rẽ ≥2 tiến trình — phải viết object map / VirtualMachineState |
| `event/workflow/video-preview.js:1136` | `handleClose` | if-return: {call _reallyClose} / {call modalChoice} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/video-thumb-extract.js:178` | `_captureFirstFrame` | if-elseif: {call consider, call _grabFullFrame} / {call videoEl.play, call _sleep} / {} | FAIL | Review (máy quét bỏ sót) | — | Rẽ ≥2 tiến trình — phải viết object map / VirtualMachineState |
| `event/workflow/visual-bg-common.js:140` | `loadPersistedSettingsOnBoot` | if-else: {call _checkAndApplyPendingSource} / {call applyCurrentVisualBg} | FAIL | Review (máy quét bỏ sót) | — | Rẽ ≥2 tiến trình — phải viết object map / VirtualMachineState |
| `event/workflow/visual-bg-common.js:179` | `advanceList` | if-return: {call shuffleVisualBgList, set [],reshuffled[]]} / {call advanceVisualBgList} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/visual-bg-common.js:222` | `_applyCurrentVisualBgNow` | if-return: {call _applyVideo} / {call _applyPhoto} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/visual-bg-common.js:290` | `advanceForSongChange` | if-return: {call _advanceVideo} / {call _photoTick} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/visual-bg-common.js:326` | `syncPlaybackToAudio` | if-return: {call syncVisualBgVideoPlayback, call workflowVisualBgPhotoMotion.pause} / {call _playVideoKey, call _resumeVideoWithDelayedAudio} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/visual-bg-common.js:333` | `syncPlaybackToAudio` | if-return: {call _playVideoKey} / {call _resumeVideoWithDelayedAudio} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/visual-bg-common.js:337` | `syncPlaybackToAudio` | if-return: {call _revertToPlaceholder} / {call syncVisualBgVideoPlayback, call workflowVideoMotionSurface.pause} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/visual-bg-common.js:359` | `toggleEnabled` | if-return: {call _checkAndApplyPendingSource} / {call applyCurrentVisualBg} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/visual-bg-common.js:504` | `_resolveAndCommitSource` | if-return: {call appConfigVisualBg.mutateAll, call clearSource} / {call _diffKeyLists, call _effectiveCount} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/visual-bg-common.js:512` | `_resolveAndCommitSource` | if-return: {call appConfigVisualBg.mutateAll, call _persist} / {call _commitSourceNow} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/visual-bg-photo-motion.js:134` | `showImage` | if-return: {set _getBeatPresetFn, call _showNext} / {call _staticReveal} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/visual-bg-photo.js:108` | `_showCurrentPhoto` | if-return: {call markVisualBgListItemMissing, call persistSourceListMutation} / {set _photoRecord, call revokeBlobUrl} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/visual-bg-photo.js:116` | `_showCurrentPhoto` | if-return: {call revokeBlobUrl} / {call _currentMotionPreset, call workflowVisualBgPhotoMotion.showImage} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/visual-bg-photo.js:181` | `_photoTick` | if-return: {call selfHealEmptySource} / {call persistSourceListMutation, set _listIndex} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/visual-bg-video.js:81` | `_onVideoEnded` | if-return: {call _restartCurrentVideoInPlace} / {call _checkAndApplyPendingSource, call _advanceVideo} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/visual-bg-video.js:114` | `_advanceVideo` | if-return: {call selfHealEmptySource} / {set _listIndex, call appConfigVisualBg.mutateAll} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/visual-bg-video.js:121` | `_advanceVideo` | if-return: {call _killVideoFixTimeTimer, call _hideVideoOnly} / {call _playVideoKey} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/visual-bg-video.js:266` | `_playVideoKey` | if-return: {call _markCurrentMissing} / {set _currentVideoKey, call updateDOMBackground} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/visual-bg-video.js:344` | `_activateVideoPointMove` | if-else: {call workflowVideoMotionSurface.activatePointMoveForNewContent} / {call workflowVideoMotionSurface.activatePointMoveForPresetChange} | FAIL | Review (máy quét bỏ sót) | — | Rẽ ≥2 tiến trình — phải viết object map / VirtualMachineState |
| `event/workflow/visual-bg-video.js:414` | `_markCurrentMissing` | if-return: {call clearSource} / {call appConfigVisualBg.mutateAll, call _persist} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/visualizer-gesture.js:187` | `handleTouchEnd` | if-return: {call _stopSeekHold} / {call taskManager.kill} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/visualizer-gesture.js:208` | `handleTouchCancel` | if-return: {call _stopSeekHold} / {call taskManager.kill} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/visualizer-gesture.js:226` | `_resolveTap` | if-return: {set _tapCount, call taskManager.kill} / {call taskManager.once} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |
| `event/workflow/visualizer-gesture.js:274` | `_dispatchGestureAction` | if-return: {call _clickControlCenterTarget} / {call run} | FAIL | Review (máy quét bỏ sót) | — | Nhánh chạy việc khác (dọn/chuyển hướng/tiến trình khác) rồi return — không phải guard thuần |

#### Workflow: ≥2 key không gộp get([…]) (184)

| Vị trí | Hàm | Mô tả | Trạng thái | Nguồn | Nợ cũ | Ghi chú |
|---|---|---|---|---|---|---|
| `event/workflow/app-boot.js:18` | `boot` | 2 lần appState.get cho 2 key ('activeMediaSource', 'activePlayListFolder') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/app-cleanup.js:15` | `run` | 5 lần appState.get cho 5 key ('animationId', 'audioContext', 'currentObjectURL', 'currentCoverObjectURL'…) — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/app-settings.js:168` | `<anon>` | 2 lần appState.get cho 2 key ('activeMediaSource', 'isGridView') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/app-settings.js:183` | `_renderPlaylistSort` | 2 lần appState.get cho 2 key ('activeMediaSource', 'displayStatSortField') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/app-settings.js:194` | `_renderPlaylistFilterList` | 3 lần appState.get cho 3 key ('activeMediaSource', 'playlistFilterPresets', 'playlistFilterActivePresetId') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/app-settings.js:217` | `_renderPlaylistFilterEdit` | 2 lần appState.get cho 2 key ('playlistFilterPresets', 'playlistFilterActivePresetId') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/app-visibility.js:66` | `exitBackground` | 2 lần appState.get cho 2 key ('isVideoPlayerMode', 'audioContext') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/app-visibility.js:89` | `_reacquireWakeLockIfPlaying` | 2 lần appState.get cho 2 key ('isPhotoPlayerMode', 'photoPlayerPaused') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/app-visibility.js:104` | `_keepAliveTick` | 4 lần appState.get cho 4 key ('isVideoPlayerMode', 'isPhotoPlayerMode', 'audioContext', 'isBackgroundSuspended') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/app-visibility.js:117` | `_enforcePlayerMediaPaused` | 3 lần appState.get cho 3 key ('isVideoPlayerMode', 'isPhotoPlayerMode', 'photoPlayerPaused') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/app-visibility.js:132` | `_restorePlayerMedia` | 3 lần appState.get cho 3 key ('isVideoPlayerMode', 'isPhotoPlayerMode', 'photoPlayerPaused') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/auto-switch-visual.js:163` | `_isMediaPlaying` | 2 lần appState.get cho 2 key ('isPhotoPlayerMode', 'isVideoPlayerMode') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/auto-switch-visual.js:251` | `onMediaChanged` | 2 lần appState.get cho 2 key ('currentKey', '_autoSwitchLastMediaKey') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/element-style-editor.js:98` | `_render` | 3 lần appState.get cho 3 key ('eseActiveTab', 'eseDraft', 'eseLoadedGoogleFonts') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/element-style-editor.js:189` | `<anon>` | 2 lần appState.get cho 2 key ('eseDraft', 'eseLoadedGoogleFonts') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/eq-presets.js:130` | `cyclePreset` | 2 lần appState.get cho 2 key ('eqPresets', 'eqBandNodes') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/eq-presets.js:362` | `_resetEditToDefault` | 2 lần appState.get cho 2 key ('eqPresets', 'eqBandNodes') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/eq-presets.js:383` | `_deletePreset` | 3 lần appState.get cho 2 key ('eqPresets', 'eqBandNodes') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/file-manager-folder-browser.js:270` | `_isActiveScopeFolder` | 2 lần appState.get cho 2 key ('activeMediaSource', 'activePlayListFolder') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/file-manager-folder-browser.js:287` | `_reloadAllViewIfShowing` | 2 lần appState.get cho 2 key ('activeMediaSource', 'activePlayListFolder') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/file-manager-storage.js:66` | `clearAllStoredData` | 5 lần appState.get cho 3 key ('currentKey', 'currentObjectURL', 'currentCoverObjectURL') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/file-manager-storage.js:393` | `_resetVideoRuntimeStateAfterClear` | 2 lần appState.get cho 2 key ('isVideoPlayerMode', 'activeMediaSource') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/game-catalog.js:74` | `armGame` | 2 lần appState.get cho 2 key ('gameplayArmedGameId', 'currentKey') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/gameplay.js:96` | `start` | 2 lần appState.get cho 2 key ('isVideoPlayerMode', 'isPhotoPlayerMode') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/gameplay.js:132` | `_beginPlaying` | 2 lần appState.get cho 2 key ('isVideoPlayerMode', 'isPhotoPlayerMode') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/gameplay.js:150` | `handleTap` | 4 lần appState.get cho 7 key ('gameplayPhase', 'isVideoPlayerMode', 'isPhotoPlayerMode', 'gameplayWaves'…) — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/gameplay.js:192` | `tick` | 6 lần appState.get cho 9 key ('gameplayPhase', 'isVideoPlayerMode', 'isPhotoPlayerMode', 'gameplayWaves'…) — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/gameplay.js:492` | `onSongEnded` | 3 lần appState.get cho 8 key ('gameplayTotalScore', 'gameplayCircleCount', 'gameplayHitCounts', 'gameplayDifficulty'…) — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/gameplay.js:547` | `replay` | 2 lần appState.get cho 2 key ('isVideoPlayerMode', 'isPhotoPlayerMode') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/gameplay.js:577` | `exitToPlaylist` | 2 lần appState.get cho 2 key ('isVideoPlayerMode', 'isPhotoPlayerMode') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/hud.js:65` | `selectSpeed` | 3 lần appState.get cho 2 key ('isVideoPlayerMode', 'isPhotoPlayerMode') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/listen-stats.js:88` | `flush` | 2 lần appState.get cho 2 key ('mediaStatsDirtyKeys', 'mediaStatsMap') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/listen-stats.js:137` | `_tick` | 7 lần appState.get cho 5 key ('_listenLastTick', 'pendingListenSeconds', 'currentKey', 'isVideoPlayerMode'…) — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/media-in-use.js:68` | `handleContentReplaced` | 5 lần appState.get cho 5 key ('isVideoPlayerMode', 'isPhotoPlayerMode', 'activeMediaSource', 'playlistCache'…) — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/photo-player.js:101` | `startFromPlaylist` | 2 lần appState.get cho 2 key ('currentKey', 'isVideoPlayerMode') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/photo-player.js:272` | `togglePlayPausePhoto` | 2 lần appState.get cho 4 key ('photoPlayerPaused', 'photoPlayerElapsedBeforePauseSec', 'photoPlayerStartedAtMs', 'photoPlayerClockHeld') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/photo-player.js:299` | `_photoPlayerTick` | 3 lần appState.get cho 5 key ('photoPlayerPaused', 'photoPlayerClockHeld', 'photoPlayerElapsedBeforePauseSec', 'photoPlayerStartedAtMs'…) — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/photo-player.js:349` | `_onPhotoShown` | 2 lần appState.get cho 2 key ('isPhotoPlayerMode', 'photoPlayerClockHeld') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/photo-player.js:358` | `onClockRestarted` | 2 lần appState.get cho 2 key ('isPhotoPlayerMode', 'photoPlayerPaused') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/photo-player.js:366` | `refreshPointMovePreset` | 2 lần appState.get cho 2 key ('isPhotoPlayerMode', 'photoPlayerPaused') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/player-controls.js:170` | `_waitCurrentMediaReady` | 2 lần appState.get cho 2 key ('isVideoPlayerMode', 'isPhotoPlayerMode') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/player-controls.js:579` | `goToNextTrack` | 2 lần appState.get cho 9 key ('isVideoPlayerMode', 'isPhotoPlayerMode', 'repeatMode', 'isShuffle'…) — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/player-controls.js:625` | `goToPrevTrack` | 2 lần appState.get cho 8 key ('isVideoPlayerMode', 'isPhotoPlayerMode', 'isShuffle', 'currentKey'…) — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/player-controls.js:757` | `toggleShuffleAndReshuffle` | 3 lần appState.get cho 3 key ('isShuffle', 'displayOrder', 'playlistOrder') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/player-controls.js:786` | `_persistPlayerConfig` | 3 lần appState.get cho 3 key ('isShuffle', 'repeatMode', 'isStatsPanelVisible') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/player-controls.js:803` | `loadPersistedPlayerConfigOnBoot` | 2 lần appState.get cho 2 key ('isShuffle', 'repeatMode') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/player-display-settings.js:137` | `changeResolutionMode` | 2 lần appState.get cho 2 key ('isVideoPlayerMode', 'isPhotoPlayerMode') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/player-display-settings.js:204` | `changeMotionSlot` | 2 lần appState.get cho 2 key ('isVideoPlayerMode', 'isPhotoPlayerMode') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/player.js:66` | `playMedia` | 5 lần appState.get cho 4 key ('playlistCache', 'isPhotoPlayerMode', 'currentKey', 'gameplayArmedGameId') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/player.js:196` | `<anon>` | 11 lần appState.get cho 6 key ('isVideoPlayerMode', 'currentObjectURL', 'currentCoverObjectURL', 'currentKey'…) — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/player.js:341` | `reloadCurrentSongKeepingPosition` | 3 lần appState.get cho 3 key ('currentKey', 'currentObjectURL', 'currentCoverObjectURL') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist-empty-state.js:32` | `resetToTopLevelThenPlay` | 4 lần appState.get cho 4 key ('displayOrder', 'playlistOrder', 'isShuffle', 'currentKey') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist-empty-state.js:56` | `resetToTopLevelThenShuffle` | 5 lần appState.get cho 4 key ('isShuffle', 'displayOrder', 'playlistOrder', 'shuffleIndices') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist-empty-state.js:83` | `reshuffleTopLevelAlways` | 5 lần appState.get cho 4 key ('isShuffle', 'displayOrder', 'playlistOrder', 'shuffleIndices') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist-filter-presets.js:59` | `_recomputeLiveConfig` | 3 lần appState.get cho 3 key ('playlistFilterPresets', 'playlistFilterActivePresetId', 'playlistFilterAppliedConfig') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist-filter-presets.js:74` | `_persist` | 4 lần appState.get cho 4 key ('playlistFilterPresets', 'playlistFilterActivePresetId', 'playlistFilterAppliedConfig', 'playlistFilterAppliesToFolder') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist-filter-presets.js:101` | `createNew` | 2 lần appState.get cho 2 key ('activeMediaSource', 'playlistFilterPresets') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist-filter-presets.js:202` | `selectPreset` | 4 lần appState.get cho 4 key ('playlistFilterPresets', 'playlistFilterActivePresetId', 'playlistFilterAppliedConfig', 'playlistFilterAppliesToFolder') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist-filter-presets.js:238` | `_deletePresetById` | 2 lần appState.get cho 2 key ('playlistFilterActivePresetId', 'playlistFilterPresets') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist-filter-presets.js:257` | `_clearActiveState` | 3 lần appState.get cho 3 key ('playlistFilterActivePresetId', 'playlistFilterAppliedConfig', 'playlistFilterAppliesToFolder') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist-order.js:59` | `removeKeyFromDisplay` | 2 lần appState.get cho 2 key ('playlistOrder', 'displayOrder') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist-render.js:87` | `buildSongNode` | 4 lần appState.get cho 4 key ('playlistCache', 'currentKey', 'activeMediaSource', 'isGridView') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist-render.js:140` | `_applySelectionLayer` | 3 lần appState.get cho 2 key ('selectionMode', 'selectedMediaKeys') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist-render.js:151` | `renderPlaylistFull` | 3 lần appState.get cho 2 key ('domNodesByKey', 'renderOrder') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist-render.js:180` | `_renderPlaylistDiffInPlace` | 9 lần appState.get cho 3 key ('renderOrder', 'playlistOrder', 'domNodesByKey') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist-render.js:290` | `syncItemBlockSize` | 2 lần appState.get cho 2 key ('renderOrder', 'domNodesByKey') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist-render.js:345` | `scrollToCurrentOrTop` | 3 lần appState.get cho 3 key ('currentKey', 'activeMediaSource', 'renderOrder') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist-render.js:357` | `_playingMediaType` | 2 lần appState.get cho 2 key ('isVideoPlayerMode', 'isPhotoPlayerMode') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist-render.js:367` | `syncPlayButtonPlayingState` | 3 lần appState.get cho 3 key ('currentKey', 'activeMediaSource', 'displayOrder') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist-scope.js:160` | `applyFolderScope` | 9 lần appState.get cho 7 key ('activePlayListFolder', 'isActiveFolderReadOnly', 'playlistCache', 'playlistOrder'…) — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist-scope.js:228` | `applyAllSongsScope` | 6 lần appState.get cho 4 key ('playlistCache', 'playlistOrder', 'mediaStatsMap', 'playlistFilterConfig') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist-scope.js:269` | `_syncActiveFolderBadge` | 2 lần appState.get cho 2 key ('activePlayListFolder', 'activeMediaSource') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist.js:196` | `deleteMediaFromActionMenu` | 3 lần appState.get cho 3 key ('playlistCache', 'currentKey', 'isVideoPlayerMode') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist.js:221` | `<anon>` | 5 lần appState.get cho 3 key ('isVideoPlayerMode', 'currentObjectURL', 'currentCoverObjectURL') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist.js:551` | `_syncEditedVideoRuntime` | 2 lần appState.get cho 2 key ('playlistCache', 'currentKey') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist.js:566` | `_syncEditedPhotoRuntime` | 2 lần appState.get cho 2 key ('playlistCache', 'currentKey') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist.js:586` | `_syncEditedSongRuntime` | 3 lần appState.get cho 3 key ('playlistCache', 'currentKey', 'currentCoverObjectURL') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist.js:665` | `_exitSelectionMode` | 2 lần appState.get cho 2 key ('selectedMediaKeys', 'domNodesByKey') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist.js:677` | `toggleSelectionMode` | 4 lần appState.get cho 3 key ('selectionMode', 'selectedMediaKeys', 'domNodesByKey') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist.js:699` | `toggleSongSelectionAndRefresh` | 4 lần appState.get cho 3 key ('selectedMediaKeys', 'domNodesByKey', 'selectionMode') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist.js:1154` | `uploadPhotos` | 3 lần appState.get cho 3 key ('activeMediaSource', 'activePlayListFolder', 'playlistOrder') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist.js:1234` | `playSelectedSongs` | 4 lần appState.get cho 10 key ('selectedMediaKeys', 'displaySortMode', 'displayStatSortField', 'displayStatSortDirection'…) — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist.js:1605` | `openAddToFolderPicker` | 2 lần appState.get cho 2 key ('selectedMediaKeys', 'activeMediaSource') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist.js:1874` | `deleteSelectedMedia` | 8 lần appState.get cho 6 key ('selectedMediaKeys', 'activeMediaSource', 'currentKey', 'isVideoPlayerMode'…) — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist.js:1907` | `<anon>` | 2 lần appState.get cho 2 key ('playlistOrder', 'displayOrder') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist.js:1965` | `removeSelectedSongsFromFolder` | 4 lần appState.get cho 4 key ('selectedMediaKeys', 'activeMediaSource', 'activePlayListFolder', 'isActiveFolderReadOnly') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist.js:1976` | `<anon>` | 2 lần appState.get cho 2 key ('playlistOrder', 'displayOrder') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist.js:2000` | `removeSongFromFolderMenu` | 3 lần appState.get cho 3 key ('activeMediaSource', 'activePlayListFolder', 'isActiveFolderReadOnly') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist.js:2007` | `<anon>` | 2 lần appState.get cho 2 key ('playlistOrder', 'displayOrder') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist.js:2087` | `_dropDomNodesIfSourceChanged` | 2 lần appState.get cho 2 key ('activeMediaSource', 'domNodesByKey') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist.js:2147` | `_persistPlaylistConfig` | 5 lần appState.get cho 5 key ('activeMediaSource', 'displaySortMode', 'displayStatSortField', 'displayStatSortDirection'…) — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist.js:2227` | `openSortPanel` | 3 lần appState.get cho 3 key ('displaySortMode', 'displayStatSortField', 'displayStatSortDirection') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/playlist.js:2277` | `syncPlaylistSettingsUI` | 2 lần appState.get cho 2 key ('isGridView', 'activeMediaSource') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/recorder.js:342` | `_stopRecording` | 2 lần appState.get cho 2 key ('recordPhase', 'isVideoPlayerMode') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/recorder.js:454` | `runCalibration` | 2 lần appState.get cho 3 key ('recordPhase', 'audioContext', 'isVideoPlayerMode') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-display.js:276` | `_syncDisplayVisibility` | 2 lần appState.get cho 2 key ('activeSubIds', 'karaokeFxDirty') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-display.js:314` | `_realignKaraokePointer` | 2 lần appState.get cho 2 key ('karaokePointerLineId', 'karaokeRenderConfig') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-display.js:341` | `_tickKaraoke` | 3 lần appState.get cho 3 key ('karaokeLastMediaTime', 'karaokeRenderConfig', 'karaokeLines') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-display.js:465` | `_tickKaraokeParticles` | 3 lần appState.get cho 3 key ('karaokeFxDirty', 'karaokeParticles', 'karaokeSprites') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-display.js:475` | `_clearKaraokeFx` | 2 lần appState.get cho 2 key ('karaokeFx', 'karaokeSprites') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-display.js:489` | `_stopKaraokeLoopIfIdle` | 2 lần appState.get cho 2 key ('karaokeLines', 'karaokeFxDirty') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:60` | `_initWaveform` | 13 lần appState.get cho 4 key ('_timelinePlugin', '_zoomLevel', '_regionsPlugin', '_wavesurfer') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:116` | `<anon>` | 3 lần appState.get cho 3 key ('_wavesurfer', '_regionsPlugin', '_region') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:261` | `zoomIn` | 4 lần appState.get cho 2 key ('_wavesurfer', '_zoomLevel') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:267` | `zoomOut` | 4 lần appState.get cho 2 key ('_wavesurfer', '_zoomLevel') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:349` | `_renderLines` | 10 lần appState.get cho 7 key ('_subtitles', '_editingLineId', '_isShiftSelectionMode', '_shiftSelectedIds'…) — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:376` | `enterLineEditMode` | 7 lần appState.get cho 5 key ('_editingLineId', '_isShiftSelectionMode', '_subtitles', '_region'…) — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:394` | `applyLineEdit` | 5 lần appState.get cho 4 key ('_editingLineId', '_editingPendingStart', '_editingPendingEnd', '_subtitles') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:432` | `_removeLine` | 3 lần appState.get cho 2 key ('_subtitles', '_lineCardNodesById') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:443` | `_syncPendingFromRegion` | 9 lần appState.get cho 5 key ('_region', '_editingLineId', '_editingCardEl', '_editingPendingStart'…) — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:483` | `openTimePickerModal` | 4 lần appState.get cho 3 key ('_wavesurfer', '_editingPendingStart', '_editingPendingEnd') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:498` | `onConfirm` | 3 lần appState.get cho 2 key ('_editingLineId', '_region') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:518` | `handleAutoTimingClick` | 6 lần appState.get cho 3 key ('_wavesurfer', '_autoSubStartTime', '_subtitles') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:577` | `exportSrt` | 4 lần appState.get cho 3 key ('_subtitles', '_record', '_songKey') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:591` | `createLineFromSelection` | 4 lần appState.get cho 2 key ('_region', '_subtitles') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:676` | `_isKaraokeLineApplied` | 2 lần appState.get cho 2 key ('_karaokeEditingLineId', '_subtitles') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:735` | `_initKaraokeMiniWaveform` | 7 lần appState.get cho 5 key ('_karaokeInitToken', '_karaokeLineStart', '_karaokeLineEnd', '_karaokeWords'…) — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:810` | `_getKaraokeSourceAudio` | 3 lần appState.get cho 3 key ('_karaokeSourceAudio', '_wavesurfer', '_record') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:861` | `_destroyKaraokeMiniWaveform` | 4 lần appState.get cho 2 key ('_karaokeWavesurfer', '_karaokeAudioUrl') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:892` | `_renderKaraokeRegions` | 5 lần appState.get cho 5 key ('_karaokeRegionsPlugin', '_karaokeMiniReady', '_karaokeLabelRegions', '_karaokeMarkerRegions'…) — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:960` | `_getKaraokeMiniGeometry` | 2 lần appState.get cho 2 key ('_karaokeWavesurfer', '_karaokeMiniDurationSec') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:1017` | `_applyKaraokeBoundaryDrag` | 3 lần appState.get cho 3 key ('_karaokeWords', '_karaokeMarkerRegions', '_karaokeLabelRegions') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:1114` | `_toggleKaraokeWordPlay` | 4 lần appState.get cho 4 key ('_karaokeMiniReady', '_karaokePlayingIndex', '_karaokeWords', '_karaokeRegionsPlugin') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:1165` | `_ensureKaraokeSegmentBuffer` | 2 lần appState.get cho 2 key ('_karaokeSegmentBuffer', '_karaokeSegment') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:1183` | `_tickKaraokeWordProgress` | 6 lần appState.get cho 6 key ('_karaokeAudioCtx', '_karaokeHighlightRegion', '_karaokePlayingIndex', '_karaokePlayStartSec'…) — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:1212` | `_stopKaraokeWordPlayback` | 2 lần appState.get cho 2 key ('_karaokeSourceNode', '_karaokeHighlightRegion') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:1252` | `applyKaraokeDrawer` | 3 lần appState.get cho 3 key ('_karaokeEditingLineId', '_karaokeWords', '_subtitles') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:1264` | `unapplyKaraokeDrawer` | 2 lần appState.get cho 2 key ('_karaokeEditingLineId', '_subtitles') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:1375` | `_splitRegionIntoLines` | 4 lần appState.get cho 2 key ('_region', '_subtitles') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:1409` | `playLineRange` | 4 lần appState.get cho 4 key ('_wavesurfer', '_editingLineId', '_editingPendingStart', '_editingPendingEnd') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:1426` | `_togglePlayRange` | 4 lần appState.get cho 3 key ('_isPlayingRegion', '_activePlaybackLineId', '_wavesurfer') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:1441` | `_playRangeAndStop` | 2 lần appState.get cho 2 key ('_wavesurfer', '_lineRangeStopHandler') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:1473` | `<anon>` | 5 lần appState.get cho 3 key ('_activePlaybackLineId', '_isPlayingRegion', '_wavesurfer') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:1482` | `<anon>` | 5 lần appState.get cho 3 key ('_activePlaybackLineId', '_isPlayingRegion', '_wavesurfer') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:1492` | `_clearLineRangeStopHandler` | 3 lần appState.get cho 2 key ('_lineRangeStopHandler', '_wavesurfer') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:1506` | `_updatePlaybackIcons` | 7 lần appState.get cho 4 key ('_isPlayingRegion', '_wavesurfer', '_activePlaybackLineId', '_lineCardNodesById') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:1532` | `setRegionStartToCurrentTime` | 7 lần appState.get cho 2 key ('_region', '_wavesurfer') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:1549` | `setRegionEndToCurrentTime` | 7 lần appState.get cho 2 key ('_region', '_wavesurfer') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:1567` | `cutMp3FromRegion` | 4 lần appState.get cho 2 key ('_region', '_wavesurfer') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:1635` | `_showCutResultModal` | 4 lần appState.get cho 3 key ('_region', '_record', '_songKey') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:1662` | `_insertCutBlobAsNewSong` | 7 lần appState.get cho 3 key ('_record', '_songKey', '_region') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:1696` | `toggleShiftSelectionMode` | 4 lần appState.get cho 3 key ('_editingLineId', '_isShiftSelectionMode', '_lineCardNodesById') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:1708` | `toggleLineSelection` | 4 lần appState.get cho 2 key ('_shiftSelectedIds', '_lineCardNodesById') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:1719` | `_renderShiftBar` | 3 lần appState.get cho 2 key ('_isShiftSelectionMode', '_shiftSelectedIds') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:1854` | `_applyShift` | 4 lần appState.get cho 3 key ('_subtitles', '_shiftSelectedIds', '_lineCardNodesById') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:1872` | `saveToDatabase` | 2 lần appState.get cho 2 key ('_subtitles', '_songKey') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/video-player.js:514` | `playVideoByKey` | 2 lần appState.get cho 2 key ('currentKey', 'gameplayArmedGameId') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/video-player.js:531` | `<anon>` | 2 lần appState.get cho 2 key ('currentKey', 'gameplayArmedGameId') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/video-player.js:684` | `refreshVideoPlaylistIfActive` | 3 lần appState.get cho 3 key ('activeMediaSource', 'activePlayListFolder', 'playlistOrder') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/video-preview.js:331` | `_computeFilmstripThumbSize` | 2 lần appState.get cho 2 key ('videoPreviewNativeW', 'videoPreviewNativeH') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/video-preview.js:374` | `_refillMissingFilmstripFrames` | 2 lần appState.get cho 2 key ('videoPreviewFilmstripFrames', 'videoPreviewRecord') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/video-preview.js:395` | `_renderTrimPositions` | 3 lần appState.get cho 3 key ('videoPreviewSourceDuration', 'videoPreviewCutStart', 'videoPreviewCutEnd') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/video-preview.js:428` | `handleTrimTrackPointerDown` | 2 lần appState.get cho 2 key ('videoPreviewActiveDrag', 'videoPreviewIsPlaying') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/video-preview.js:438` | `_seekToClientX` | 3 lần appState.get cho 3 key ('videoPreviewSourceDuration', 'videoPreviewCutStart', 'videoPreviewCutEnd') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/video-preview.js:449` | `handleTrimDragMove` | 4 lần appState.get cho 4 key ('videoPreviewActiveDrag', 'videoPreviewSourceDuration', 'videoPreviewCutStart', 'videoPreviewCutEnd') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/video-preview.js:494` | `handleVideoTimeUpdate` | 2 lần appState.get cho 2 key ('videoPreviewCutEnd', 'videoPreviewCutStart') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/video-preview.js:515` | `handleOuterSeekPointerDown` | 2 lần appState.get cho 2 key ('videoPreviewSourceDuration', 'videoPreviewIsPlaying') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/video-preview.js:525` | `_seekOuterToClientX` | 2 lần appState.get cho 2 key ('videoPreviewCutStart', 'videoPreviewCutEnd') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/video-preview.js:535` | `_renderOuterSeek` | 2 lần appState.get cho 2 key ('videoPreviewCutStart', 'videoPreviewCutEnd') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/video-preview.js:601` | `handleToolOpen` | 2 lần appState.get cho 2 key ('videoPreviewActiveTool', 'videoPreviewHasUnsavedChanges') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/video-preview.js:659` | `_getRotateTransform` | 4 lần appState.get cho 4 key ('videoPreviewRotateDeg', 'videoPreviewFlipH', 'videoPreviewNativeW', 'videoPreviewNativeH') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/video-preview.js:694` | `_syncCropCanvasBox` | 2 lần appState.get cho 2 key ('videoPreviewNativeW', 'videoPreviewNativeH') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/video-preview.js:834` | `handleFlipClick` | 2 lần appState.get cho 2 key ('videoPreviewFlipH', 'videoPreviewActiveTool') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/video-preview.js:869` | `_fitCardToContent` | 2 lần appState.get cho 2 key ('videoPreviewNativeW', 'videoPreviewNativeH') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/video-preview.js:881` | `_computeContentSize` | 2 lần appState.get cho 2 key ('videoPreviewActiveTool', 'videoPreviewRotateDeg') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/video-preview.js:899` | `_applyCroppedPreview` | 4 lần appState.get cho 4 key ('videoPreviewNativeW', 'videoPreviewNativeH', 'videoPreviewRotateDeg', 'videoPreviewFlipH') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/video-preview.js:947` | `_reallyReset` | 4 lần appState.get cho 4 key ('videoPreviewNativeW', 'videoPreviewNativeH', 'videoPreviewCropSession', 'videoPreviewSourceDuration') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/video-preview.js:966` | `_buildSnapshot` | 5 lần appState.get cho 5 key ('videoPreviewCropSession', 'videoPreviewRotateDeg', 'videoPreviewFlipH', 'videoPreviewCutStart'…) — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/video-preview.js:1019` | `_computeCropRect` | 3 lần appState.get cho 3 key ('videoPreviewCropSession', 'videoPreviewNativeW', 'videoPreviewNativeH') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/video-preview.js:1028` | `_buildProcessParams` | 8 lần appState.get cho 8 key ('videoPreviewRecord', 'videoPreviewCutStart', 'videoPreviewCutEnd', 'videoPreviewSourceDuration'…) — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/visual-bg-common.js:197` | `applyCurrentVisualBg` | 2 lần appState.get cho 2 key ('isVideoPlayerMode', 'isPhotoPlayerMode') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/visual-bg-common.js:317` | `syncPlaybackToAudio` | 3 lần appState.get cho 3 key ('isVideoPlayerMode', 'isPhotoPlayerMode', 'playbackStoppedAtPlaylistEnd') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/visual-bg-common.js:1088` | `changeResolutionMode` | 2 lần appState.get cho 2 key ('isVideoPlayerMode', 'isPhotoPlayerMode') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/visualizer-gesture.js:286` | `_activateSeekHold` | 2 lần appState.get cho 2 key ('isVideoPlayerMode', 'currentKey') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/visualizer-gesture.js:330` | `_stopSeekHold` | 2 lần appState.get cho 2 key ('currentKey', 'isVideoPlayerMode') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/visualizer/connector.js:155` | `_disposeScene` | 2 lần appState.get cho 6 key ('cnInitialized', 'cnScene', 'cnCamera', 'cnControls'…) — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/visualizer/connector.js:167` | `onResize` | 2 lần appState.get cho 3 key ('cnInitialized', 'cnCamera', 'cnComposer') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/visualizer/connector.js:180` | `onNewMedia` | 2 lần appState.get cho 2 key ('cnInitialized', 'cnChips') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/visualizer/connector.js:281` | `_clearCircuitSignals` | 2 lần appState.get cho 2 key ('cnActiveSignalsCircuit', 'cnGroupCircuit') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/visualizer/rain.js:60` | `_drawGlass` | 2 lần appState.get cho 2 key ('glassStaticDrops', 'glassStreaks') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/visualizer/rain.js:130` | `_drawStreet` | 4 lần appState.get cho 4 key ('streetRain', 'streetGroundY', 'streetLamps', 'ripples') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/visualizer/vortex.js:118` | `_syncTunnelStraightness` | 2 lần appState.get cho 2 key ('tInitialized', 'tPathTarget') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/visualizer/vortex.js:153` | `_renderTunnel` | 6 lần appState.get cho 7 key ('tInitialized', 'tCurrentWarpZ', 'tPathParams', 'tPathTarget'…) — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/visualizer/vortex.js:199` | `_rebaseWarpZ` | 3 lần appState.get cho 3 key ('tRings', 'tWaveMeshes', 'tBarRingZs') — phải gộp 1 lần get([…]) | FAIL | Review (máy quét bỏ sót) | — |  |

### 4.3 TaskManager

#### Timer thô (13)

| Vị trí | Hàm | Mô tả | Trạng thái | Nguồn | Nợ cũ | Ghi chú |
|---|---|---|---|---|---|---|
| `core/dropdown-menu.js:124` | `closeDropdownMenu` | setTimeout() thô — phải qua taskManager (task-manager-conventions.md §1) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/large-file-download.js:130` | `triggerLargeFileDownloadViaServiceWorker` | setTimeout() thô — phải qua taskManager (task-manager-conventions.md §1) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/streaming-zip.js:115` | `_withTimeout` | setTimeout() thô — phải qua taskManager (task-manager-conventions.md §1) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/streaming-zip.js:146` | `buildZipStreamingToOpfs` | setInterval() thô — phải qua taskManager (task-manager-conventions.md §1) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/streaming-zip.js:174` | `buildZipStreamingToOpfs` | setInterval() thô — phải qua taskManager (task-manager-conventions.md §1) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/streaming-zip.js:240` | `_addEntryWithStallGuard` | setInterval() thô — phải qua taskManager (task-manager-conventions.md §1) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/streaming-zip.js:249` | `_addEntryWithStallGuard` | setTimeout() thô — phải qua taskManager (task-manager-conventions.md §1) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/streaming-zip.js:296` | `_writeViaMainThread` | setInterval() thô — phải qua taskManager (task-manager-conventions.md §1) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/streaming-zip.js:319` | `_writeViaMainThread` | setInterval() thô — phải qua taskManager (task-manager-conventions.md §1) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/time-picker-modal.js:196` | `openTimePickerModal` | setTimeout() thô — phải qua taskManager (task-manager-conventions.md §1) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `core/video-editor/opfs-temp.js:20` | `_withTimeoutVideoEditTemp` | setTimeout() thô — phải qua taskManager (task-manager-conventions.md §1) | FAIL | Review (máy quét bỏ sót) | Không |  |
| `event/workflow/image-edit.js:727` | `layerPointerDown` | setTimeout() thô — phải qua taskManager (task-manager-conventions.md §1) | FAIL | Review (máy quét bỏ sót) | — |  |
| `event/workflow/visual-bg-common.js:639` | `_commitColorChange` | setTimeout() thô — phải qua taskManager (task-manager-conventions.md §1) | FAIL | Review (máy quét bỏ sót) | — |  |

#### requestAnimationFrame thô (10)

| Vị trí | Hàm | Mô tả | Trạng thái | Nguồn | Nợ cũ | Ghi chú |
|---|---|---|---|---|---|---|
| `core/color-utils.js:217` | `forceGlassRepaint` | requestAnimationFrame thô — taskManager có mode raf; §1 chỉ ghi rõ setTimeout/setInterval | Chờ chốt | Review (máy quét bỏ sót) | Có |  |
| `core/dropdown-menu.js:95` | `openDropdownMenu` | requestAnimationFrame thô — taskManager có mode raf; §1 chỉ ghi rõ setTimeout/setInterval | Chờ chốt | Review (máy quét bỏ sót) | Không |  |
| `core/time-picker-modal.js:330` | `openTimePickerModal` | requestAnimationFrame thô — taskManager có mode raf; §1 chỉ ghi rõ setTimeout/setInterval | Chờ chốt | Review (máy quét bỏ sót) | Không |  |
| `core/time-picker-modal.js:331` | `openTimePickerModal` | requestAnimationFrame thô — taskManager có mode raf; §1 chỉ ghi rõ setTimeout/setInterval | Chờ chốt | Review (máy quét bỏ sót) | Không |  |
| `core/video-player.js:131` | `decodeForcedBgThumb` | requestAnimationFrame thô — taskManager có mode raf; §1 chỉ ghi rõ setTimeout/setInterval | Chờ chốt | Review (máy quét bỏ sót) | Không |  |
| `core/video-player.js:131` | `decodeForcedBgThumb` | requestAnimationFrame thô — taskManager có mode raf; §1 chỉ ghi rõ setTimeout/setInterval | Chờ chốt | Review (máy quét bỏ sót) | Không |  |
| `event/workflow/playlist-render.js:414` | `scrollToSongIfPending` | requestAnimationFrame thô — taskManager có mode raf; §1 chỉ ghi rõ setTimeout/setInterval | Chờ chốt | Review (máy quét bỏ sót) | — |  |
| `event/workflow/subtitle-editor.js:1576` | `cutMp3FromRegion` | requestAnimationFrame thô — taskManager có mode raf; §1 chỉ ghi rõ setTimeout/setInterval | Chờ chốt | Review (máy quét bỏ sót) | — |  |
| `event/workflow/video-player.js:851` | `_captureAndFreezeSeekFrame` | requestAnimationFrame thô — taskManager có mode raf; §1 chỉ ghi rõ setTimeout/setInterval | Chờ chốt | Review (máy quét bỏ sót) | — |  |
| `event/workflow/video-player.js:851` | `_captureAndFreezeSeekFrame` | requestAnimationFrame thô — taskManager có mode raf; §1 chỉ ghi rõ setTimeout/setInterval | Chờ chốt | Review (máy quét bỏ sót) | — |  |

#### taskManager dùng trong Core (11)

| Vị trí | Hàm | Mô tả | Trạng thái | Nguồn | Nợ cũ | Ghi chú |
|---|---|---|---|---|---|---|
| `core/config.js:822` |  | taskManager chỉ thuộc Workflow (Rule 3 + task-manager-conventions §2) | FAIL | Máy quét | Có |  |
| `core/config.js:825` |  | taskManager chỉ thuộc Workflow (Rule 3 + task-manager-conventions §2) | FAIL | Máy quét | Có |  |
| `core/file-manager/folder-picker-ui.js:103` |  | taskManager chỉ thuộc Workflow (Rule 3 + task-manager-conventions §2) | FAIL | Máy quét | Có |  |
| `core/file-manager/folder-picker-ui.js:108` |  | taskManager chỉ thuộc Workflow (Rule 3 + task-manager-conventions §2) | FAIL | Máy quét | Có |  |
| `core/file-manager/folder-picker-ui.js:109` |  | taskManager chỉ thuộc Workflow (Rule 3 + task-manager-conventions §2) | FAIL | Máy quét | Có |  |
| `core/file-manager/folder-picker-ui.js:110` |  | taskManager chỉ thuộc Workflow (Rule 3 + task-manager-conventions §2) | FAIL | Máy quét | Có |  |
| `core/loading-shield-util.js:41` |  | taskManager chỉ thuộc Workflow (Rule 3 + task-manager-conventions §2) | FAIL | Máy quét | Có |  |
| `core/playlist/loader.js:43` |  | taskManager chỉ thuộc Workflow (Rule 3 + task-manager-conventions §2) | FAIL | Máy quét | Có |  |
| `core/playlist/loader.js:125` |  | taskManager chỉ thuộc Workflow (Rule 3 + task-manager-conventions §2) | FAIL | Máy quét | Có |  |
| `core/storage-manager.js:375` |  | taskManager chỉ thuộc Workflow (Rule 3 + task-manager-conventions §2) | FAIL | Máy quét | Có |  |
| `core/storage-manager.js:478` |  | taskManager chỉ thuộc Workflow (Rule 3 + task-manager-conventions §2) | FAIL | Máy quét | Có |  |

## 5. Máy quét báo nhưng review loại

| Rule máy | Lý do loại | Số dòng |
|---|---|---|
| CORE-1 | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng | 665 |
| CORE-5A | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) | 99 |
| EV-LISTENER-1 | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) | 42 |
| CORE-3A | Gọi phương thức của phần tử media/zipWriter/animation trùng tên hàm core (vd bgVideoElement.pause()) — không phải core | 18 |
| CORE-5C | createElement canvas/a/video/script/link để xử lý hoặc tải file — không phải dựng UI | 11 |
| CORE-5A | Ngoại lệ đã audit: nằm trong danh sách 18 chỗ đã audit (changelog/v11.md mục 2) | 10 |
| CORE-4 | Hot path 60fps (vòng vẽ visualizer) — ngoại lệ chính thức của Rule 4 | 9 |
| CORE-5B | Rule chấm theo điều kiện bị bỏ — Rule 1 chấm theo nội dung nhánh đã bao (guard = PASS) | 9 |
| EV-LISTENER-1 | Trùng với dòng "Listener đọc appState" (EV-LISTENER-2) — gộp, không đếm 2 lần | 7 |
| CORE-1 | Switch A/B trên cùng một đối tượng (play/pause, mở/đóng, hiện/ẩn…) = 1 nghiệp vụ — phán quyết Giang 07/10 | 4 |

<details><summary>Danh sách đầy đủ (874 dòng)</summary>

| Rule máy | Vị trí | Lý do |
|---|---|---|
| CORE-1 (FAIL) | `core/color-utils.js:180` | Switch A/B trên cùng một đối tượng (play/pause, mở/đóng, hiện/ẩn…) = 1 nghiệp vụ — phán quyết Giang 07/10 |
| CORE-1 (FAIL) | `core/player-controls.js:333` | Switch A/B trên cùng một đối tượng (play/pause, mở/đóng, hiện/ẩn…) = 1 nghiệp vụ — phán quyết Giang 07/10 |
| CORE-1 (FAIL) | `core/visual-bg-video.js:17` | Switch A/B trên cùng một đối tượng (play/pause, mở/đóng, hiện/ẩn…) = 1 nghiệp vụ — phán quyết Giang 07/10 |
| CORE-1 (FAIL) | `core/visualizer-control-center.js:55` | Switch A/B trên cùng một đối tượng (play/pause, mở/đóng, hiện/ẩn…) = 1 nghiệp vụ — phán quyết Giang 07/10 |
| CORE-1 (REVIEW) | `core/about-stats.js:42` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/app-panel-nav.js:26` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/app-panel-nav.js:29` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/app-panel-nav.js:41` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/app-settings-ui.js:199` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/audio-analysis.js:148` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/audio-analysis.js:313` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/audio-analysis.js:338` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/audio-analysis.js:369` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/audio-analysis.js:453` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/audio-analysis.js:458` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/audio-analysis.js:464` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/audio-analysis.js:493` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/audio-analysis.js:502` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/audio-analysis.js:502` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/audio-analysis.js:524` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/audio-analysis.js:542` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/audio-analysis.js:550` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/audio-analysis.js:597` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/audio-segment.js:85` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/audio-tempo.js:62` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/audio-tempo.js:132` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/audio-tempo.js:165` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/audio-tempo.js:198` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/audio-tempo.js:205` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/audio-tempo.js:207` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/audio-tempo.js:221` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/audio-tempo.js:229` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/auto-switch-visual.js:84` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/auto-switch-visual.js:87` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/auto-switch-visual.js:99` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/auto-switch-visual.js:118` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/auto-switch-visual.js:135` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/auto-switch-visual.js:136` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/auto-switch-visual.js:143` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/auto-switch-visual.js:144` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/auto-switch-visual.js:238` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/auto-switch-visual.js:243` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/auto-switch-visual.js:248` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/auto-switch-visual.js:253` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/auto-switch-visual.js:258` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/auto-switch-visual.js:260` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/auto-switch-visual.js:267` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/auto-switch-visual.js:273` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/auto-switch-visual.js:310` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/canvas-scene-setup.js:41` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/canvas-scene-setup.js:41` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/canvas-scene-setup.js:65` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/canvas-scene-setup.js:65` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/canvas-scene-setup.js:66` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/canvas-scene-setup.js:66` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/canvas-scene-setup.js:68` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/canvas-scene-setup.js:68` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/color-utils.js:9` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/color-utils.js:47` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/color-utils.js:51` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/color-utils.js:124` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/color-utils.js:125` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/color-utils.js:152` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/color-utils.js:162` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/config.js:850` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/config.js:865` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/config.js:874` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/config.js:911` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/config.js:935` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/config.js:941` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/config.js:973` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/config.js:973` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/config.js:1029` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/config.js:1064` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/config.js:1065` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/config.js:1125` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/custom-effect.js:141` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/custom-effect.js:396` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/custom-effect.js:403` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/dropdown-menu.js:58` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/dropdown-menu.js:93` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/dropdown-menu.js:123` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/element-style-editor.js:63` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/element-style-editor.js:63` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/element-style-editor.js:75` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/element-style-editor.js:81` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/element-style-editor.js:116` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/element-style-editor.js:127` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/element-style-editor.js:128` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/element-style-editor.js:129` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/element-style-editor.js:131` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/element-style-editor.js:136` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/element-style-editor.js:138` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/element-style-editor.js:141` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/element-style-editor.js:143` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/element-style-editor.js:145` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/element-style-editor.js:145` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/element-style-editor.js:146` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/element-style-editor.js:148` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/element-style-editor.js:150` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/element-style-editor.js:152` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/element-style-editor.js:154` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/element-style-editor.js:156` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/element-style-editor.js:158` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/element-style-editor.js:160` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/element-style-editor.js:162` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/element-style-editor.js:164` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/eq-presets.js:40` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/file-manager/cleanup.js:145` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/file-manager/cleanup.js:193` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/file-manager/folder.js:161` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/file-manager/folder.js:163` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/file-manager/folder.js:212` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/file-manager/folder.js:212` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/file-manager/folder.js:239` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/file-manager/folder.js:239` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/file-manager/folder.js:353` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/file-manager/folder.js:395` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/file-manager/image.js:93` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/file-manager/photo-ui.js:40` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/file-manager/photo-ui.js:373` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/file-manager/video.js:150` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/file-manager/video.js:150` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/file-manager/video.js:217` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/file-manager/video.js:230` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/gameplay/circle-mode.js:35` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/gameplay/circle-mode.js:50` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/gameplay/circle-mode.js:78` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/gameplay/circle-mode.js:80` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/gameplay/circle-mode.js:92` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/gameplay/circle-mode.js:94` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/gameplay/circle-mode.js:108` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/gameplay/circle-mode.js:111` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/gameplay/circle-mode.js:123` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/gameplay/circle-mode.js:126` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/gameplay/circle-mode.js:142` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/gameplay/circle-mode.js:155` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/gameplay/circle-mode.js:208` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/gameplay/circle-mode.js:236` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/gameplay/circle-mode.js:348` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/gameplay/engine-ui.js:45` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/gameplay/engine-ui.js:110` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/gameplay/engine.js:11` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/gameplay/engine.js:80` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/gameplay/game-panel-ui.js:61` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/gameplay/game-panel-ui.js:65` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/gameplay/game-panel-ui.js:65` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/gameplay/game-panel-ui.js:65` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/gameplay/game-panel-ui.js:65` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/gameplay/game-panel-ui.js:69` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/gameplay/game-panel-ui.js:69` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/gameplay/game-panel-ui.js:74` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/gameplay/game-panel-ui.js:76` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/gameplay/game-panel-ui.js:78` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/gameplay/game-panel-ui.js:84` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/generic-drawer.js:49` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/hud.js:68` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/hud.js:71` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/info-icon-ui.js:102` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/info-icon-ui.js:108` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/info-icon-ui.js:113` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/info-icon-ui.js:117` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/info-icon-ui.js:119` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/media-picker-drawer-ui.js:86` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/media-picker-drawer-ui.js:88` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/media-picker-drawer-ui.js:90` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/media-transform.js:37` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/media-transform.js:61` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/media-transform.js:62` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/media-transform.js:63` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/media-transform.js:64` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/media-transform.js:65` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/media-transform.js:94` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/media-transform.js:95` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/media-transform.js:96` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/media-transform.js:97` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/media-transform.js:98` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/media-transform.js:99` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/media-transform.js:100` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/media-transform.js:100` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/media-transform.js:110` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/media-transform.js:111` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/media-transform.js:112` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/media-transform.js:113` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/media-transform.js:114` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/media-transform.js:118` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/media-transform.js:118` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/modal-choice-ui.js:79` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/modal-choice-ui.js:112` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/modal-choice-ui.js:135` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/modal-choice-ui.js:192` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/modal-choice-ui.js:251` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-engine.js:218` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-engine.js:241` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-engine.js:514` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:277` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:278` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:282` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:284` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:286` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:287` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:288` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:289` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:290` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:291` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:292` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:293` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:294` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:295` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:296` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:297` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:299` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:300` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:301` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:315` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:326` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:328` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:329` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:345` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:347` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:360` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:361` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:362` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:364` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:380` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:381` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:382` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:383` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:384` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:385` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:388` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:390` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:392` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:395` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:396` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:398` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:399` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:402` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:403` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:405` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:406` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:409` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:410` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:412` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:413` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:446` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:460` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:472` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:477` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/motion-presets.js:478` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/pagination-ui.js:59` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/pagination-ui.js:62` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/pagination-ui.js:66` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/pagination-ui.js:69` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/pagination-ui.js:82` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/pagination-ui.js:84` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/pagination-ui.js:84` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/pagination-ui.js:95` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/pagination-ui.js:97` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/pagination-ui.js:97` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/pagination-ui.js:101` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/pagination-ui.js:105` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/perf-hud.js:33` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/perf-hud.js:34` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/perf-hud.js:35` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/perf-hud.js:41` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/perf-hud.js:46` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/perf-hud.js:59` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/perf-hud.js:60` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/perf-hud.js:61` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/perf-hud.js:92` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/perf-hud.js:99` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/perf-hud.js:116` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/perf-hud.js:144` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/perf-hud.js:144` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/photo-editor-engine.js:94` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/photo-editor-engine.js:94` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/photo-editor-engine.js:95` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/photo-editor-engine.js:95` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/photo-editor-engine.js:96` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/photo-editor-engine.js:96` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/photo-editor-engine.js:124` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/photo-editor-engine.js:124` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/photo-editor-engine.js:250` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/photo-editor-engine.js:253` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/photo-editor-engine.js:258` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/photo-editor-engine.js:263` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/photo-editor-engine.js:283` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/photo-player.js:90` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/player-controls.js:291` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/player-controls.js:384` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/player-controls.js:385` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/player-display-apply.js:92` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/player-display-apply.js:93` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/player-display-settings.js:54` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/player-display-settings.js:114` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/player-display-settings.js:161` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/player-zoom.js:129` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/actions.js:136` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/actions.js:136` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/actions.js:169` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/actions.js:350` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/actions.js:383` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/filter-presets.js:59` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/filter-presets.js:62` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/filter-presets.js:70` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/filter-presets.js:84` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/filter-presets.js:85` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/filter-presets.js:104` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/filter.js:83` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/filter.js:84` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/filter.js:86` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/filter.js:105` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/filter.js:167` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/filter.js:168` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/filter.js:169` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/filter.js:170` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/filter.js:171` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/filter.js:172` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/filter.js:173` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/filter.js:174` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/loader.js:31` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/loader.js:218` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/main.js:86` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/main.js:87` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/main.js:152` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/order.js:59` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/order.js:63` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/order.js:68` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/order.js:74` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/order.js:75` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/order.js:76` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/order.js:82` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/order.js:83` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/order.js:180` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/order.js:183` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/order.js:197` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/order.js:218` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/render.js:92` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/render.js:111` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/render.js:111` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/render.js:156` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/render.js:167` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/render.js:175` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/render.js:315` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/render.js:333` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/render.js:333` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/state.js:45` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/state.js:45` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/playlist/state.js:46` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/point-move-timing-ui.js:54` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/point-move-timing-ui.js:55` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/point-move-timing-ui.js:83` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/point-move-timing-ui.js:83` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/point-move-timing-ui.js:97` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/point-move-timing-ui.js:183` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/recorder-ui.js:41` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/recorder-ui.js:74` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/recorder-ui.js:98` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/recorder-ui.js:112` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/recorder.js:95` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/recorder.js:101` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/recorder.js:106` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/rubik-math.js:16` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/rubik-math.js:16` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/rubik-math.js:16` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/rubik-math.js:17` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/rubik-math.js:17` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/rubik-math.js:17` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/rubik-math.js:18` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/rubik-math.js:18` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/settings-carousel-ui.js:62` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/settings-carousel-ui.js:62` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/settings-carousel-ui.js:82` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/settings-carousel-ui.js:83` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/slider-panel-scroll.js:77` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/statis-panel-ui.js:90` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/statis-panel-ui.js:177` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/statis-panel-ui.js:178` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/statis-panel-ui.js:179` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/statis-panel-ui.js:200` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/statis-panel-ui.js:215` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/statis-panel-ui.js:216` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/statis-panel-ui.js:216` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/statis-panel-ui.js:221` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/statis-panel-ui.js:226` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/statis-panel-ui.js:231` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/statis-panel-ui.js:232` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/statis-panel-ui.js:235` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/statis-panel-ui.js:245` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/statis-panel-ui.js:245` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/storage-manager.js:83` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/storage-manager.js:84` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/storage-manager.js:87` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/storage-manager.js:94` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/storage-manager.js:95` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/storage-manager.js:156` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/storage-manager.js:159` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/storage-manager.js:284` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/storage-manager.js:289` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/storage-manager.js:401` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/storage-manager.js:406` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/storage-manager.js:428` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/storage-manager.js:494` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/storage-manager.js:499` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/streaming-zip.js:88` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/streaming-zip.js:243` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/streaming-zip.js:244` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/streaming-zip.js:358` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/streaming-zip.js:361` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/streaming-zip.js:375` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/streaming-zip.js:379` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/streaming-zip.js:387` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle-transition.js:44` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle-transition.js:45` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle-transition.js:61` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle-transition.js:62` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle-transition.js:65` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle-transition.js:66` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle-transition.js:86` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle-transition.js:87` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitle-karaoke-display-ui.js:70` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitle-karaoke-display.js:63` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitle-karaoke-display.js:109` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitle-karaoke-display.js:168` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitle-karaoke-display.js:169` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitle-karaoke-display.js:172` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitle-karaoke-display.js:173` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitle-karaoke-display.js:174` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitle-karaoke-display.js:175` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitle-karaoke-display.js:176` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitle-karaoke-display.js:177` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitle-karaoke-display.js:187` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitle-karaoke.js:25` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitle-karaoke.js:86` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitle-karaoke.js:111` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitle-karaoke.js:112` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitle-karaoke.js:117` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitle-karaoke.js:123` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitle-transition.js:44` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitle-transition.js:45` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitle-transition.js:61` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitle-transition.js:62` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitle-transition.js:65` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitle-transition.js:66` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitles-ui.js:46` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitles-ui.js:48` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitles-ui.js:49` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitles-ui.js:51` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitles-ui.js:62` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitles-ui.js:77` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitles-ui.js:85` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitles-ui.js:102` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitles-ui.js:103` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitles-ui.js:105` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitles-ui.js:137` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitles-ui.js:141` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitles-ui.js:161` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitles-ui.js:166` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitles-ui.js:186` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitles-ui.js:192` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitles-ui.js:194` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitles-ui.js:200` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/subtitle/subtitles-ui.js:261` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/theme-background-ui.js:45` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/theme-background-ui.js:52` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/theme-background-ui.js:94` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/theme-background-ui.js:95` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/theme-background-ui.js:96` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/theme-background-ui.js:100` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/theme-background-ui.js:106` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/theme-background-ui.js:116` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/time-picker-modal.js:81` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/time-picker-modal.js:98` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/time-picker-modal.js:181` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/ui-theme/apply-ui.js:38` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/ui-theme/icon-svg-ui.js:29` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/ui-theme/icon-svg-ui.js:30` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/ui-theme/icon-svg-ui.js:31` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/ui-theme/status-bar-color.js:32` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/upload-validation.js:48` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/video-editor/webcodecs-engine.js:50` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/video-editor/webcodecs-engine.js:73` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/video-editor/webcodecs-engine.js:73` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/video-editor/webcodecs-engine.js:131` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/video-editor/webcodecs-engine.js:133` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/video-editor/webcodecs-engine.js:138` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/video-editor/webcodecs-engine.js:145` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/video-editor/webcodecs-engine.js:160` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/video-editor/webcodecs-engine.js:161` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/video-editor/webcodecs-engine.js:164` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/video-editor/webcodecs-engine.js:173` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/video-player.js:50` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/video-player.js:53` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/video-player.js:99` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/video-player.js:130` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visual-bg-common.js:49` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visual-bg-common.js:84` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visual-bg-common.js:96` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visual-bg-common.js:235` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visual-bg-photo.js:18` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visual-bg-video.js:35` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visual-bg-video.js:37` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visual-bg-video.js:38` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visual-bg-video.js:54` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visual-bg-video.js:55` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer-gesture.js:31` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer-gesture.js:38` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer-gesture.js:78` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer-gesture.js:79` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer-gesture.js:80` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/beat-window.js:42` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/draw/screen-flash-alpha.js:29` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/effect-paint.js:28` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/effect-paint.js:29` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/effect-paint.js:48` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/frame-clock.js:9` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/black-hole.js:130` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/black-hole.js:155` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/black-hole.js:156` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/black-hole.js:170` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/black-hole.js:190` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/black-hole.js:207` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/black-hole.js:208` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/black-hole.js:219` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/black-hole.js:234` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/black-hole.js:254` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/black-hole.js:280` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/black-hole.js:369` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/black-hole.js:405` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/black-hole.js:409` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/black-hole.js:427` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/black-hole.js:428` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/black-hole.js:448` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/black-hole.js:506` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/black-hole.js:514` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/common.js:29` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/common.js:33` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/common.js:40` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:83` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:91` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:95` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:97` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:103` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:111` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:117` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:120` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:138` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:143` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:151` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:152` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:166` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:207` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:207` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:239` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:241` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:251` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:294` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:357` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:375` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:377` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:379` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:384` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:384` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:384` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:384` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:385` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:385` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:385` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:385` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:414` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:414` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:439` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/dot.js:444` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/mirror.js:78` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/mirror.js:92` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/bar/mirror.js:92` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/connector/circuit.js:50` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/connector/circuit.js:53` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/connector/circuit.js:78` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/connector/circuit.js:112` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/connector/circuit.js:113` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/connector/circuit.js:190` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/connector/circuit.js:191` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/connector/circuit.js:198` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/lighting/fireworks.js:93` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/lighting/fireworks.js:146` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/lighting/fireworks.js:165` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/lighting/fireworks.js:168` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/lighting/fireworks.js:320` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/lighting/fireworks.js:321` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/lighting/fireworks.js:412` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/lighting/fireworks.js:413` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/lighting/fireworks.js:455` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/rain/glass.js:82` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/rain/glass.js:84` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/rain/glass.js:87` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/rain/glass.js:105` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/rain/glass.js:119` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/rain/glass.js:120` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/rain/glass.js:120` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/rain/glass.js:121` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/rain/glass.js:131` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/rain/glass.js:132` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/rain/street.js:53` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/rain/street.js:99` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/rain/street.js:100` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/rain/street.js:104` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/rain/street.js:107` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/rain/street.js:112` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/rain/street.js:147` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/rain/street.js:170` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/shape/clock.js:115` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/shape/clock.js:115` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/shape/clock.js:115` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/shape/clock.js:115` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/shape/clock.js:135` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/shape/clock.js:169` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/shape/clock.js:170` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/shape/clock.js:216` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/shape/clock.js:217` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/shape/clock.js:220` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/shape/clock.js:221` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/shape/clock.js:222` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/shape/clock.js:223` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/shape/clock.js:224` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/shape/clock.js:232` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/shape/clock.js:258` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/shape/clock.js:259` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/shape/clock.js:273` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/shape/clock.js:276` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/shape/clock.js:315` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/shape/clock.js:426` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/shape/clock.js:432` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/shape/clock.js:465` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/shape/clock.js:488` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/shape/clock.js:552` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/shape/rubik.js:55` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/shape/rubik.js:70` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/shape/rubik.js:96` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/shape/rubik.js:97` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/groups/vortex/common.js:62` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/tonotopic.js:57` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/visualizer-display.js:76` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/visualizer-display.js:91` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/visualizer-display.js:91` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/visualizer-display.js:123` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/visualizer/visualizer-display.js:127` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/webgl/three-connector.js:45` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/webgl/three-connector.js:64` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/webgl/three-connector.js:118` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/webgl/three-connector.js:138` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/webgl/three-connector.js:138` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/webgl/three-connector.js:207` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/webgl/three-connector.js:247` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/webgl/three-connector.js:247` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/webgl/three-connector.js:247` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/webgl/three-connector.js:249` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/webgl/three-connector.js:283` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/webgl/three-connector.js:310` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/webgl/three-connector.js:313` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/webgl/three-connector.js:416` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/webgl/three-connector.js:416` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/webgl/three-connector.js:452` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/webgl/three-connector.js:457` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/webgl/three-vortex.js:108` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/webgl/three-vortex.js:108` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/webgl/three-vortex.js:109` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-1 (REVIEW) | `core/webgl/three-vortex.js:109` | Thay bằng chấm theo nội dung nhánh (review) — guard/chọn giá trị/kiểm tra tồn tại = PASS; còn lại đã có dòng riêng |
| CORE-3A (FAIL) | `core/color-utils.js:144` | Gọi phương thức của phần tử media/zipWriter/animation trùng tên hàm core (vd bgVideoElement.pause()) — không phải core |
| CORE-3A (FAIL) | `core/color-utils.js:181` | Gọi phương thức của phần tử media/zipWriter/animation trùng tên hàm core (vd bgVideoElement.pause()) — không phải core |
| CORE-3A (FAIL) | `core/color-utils.js:184` | Gọi phương thức của phần tử media/zipWriter/animation trùng tên hàm core (vd bgVideoElement.pause()) — không phải core |
| CORE-3A (FAIL) | `core/motion-engine.js:384` | Gọi phương thức của phần tử media/zipWriter/animation trùng tên hàm core (vd bgVideoElement.pause()) — không phải core |
| CORE-3A (FAIL) | `core/motion-engine.js:393` | Gọi phương thức của phần tử media/zipWriter/animation trùng tên hàm core (vd bgVideoElement.pause()) — không phải core |
| CORE-3A (FAIL) | `core/player-controls.js:333` | Gọi phương thức của phần tử media/zipWriter/animation trùng tên hàm core (vd bgVideoElement.pause()) — không phải core |
| CORE-3A (FAIL) | `core/player-controls.js:333` | Gọi phương thức của phần tử media/zipWriter/animation trùng tên hàm core (vd bgVideoElement.pause()) — không phải core |
| CORE-3A (FAIL) | `core/playlist/loader.js:38` | Gọi phương thức của phần tử media/zipWriter/animation trùng tên hàm core (vd bgVideoElement.pause()) — không phải core |
| CORE-3A (FAIL) | `core/storage-manager.js:370` | Gọi phương thức của phần tử media/zipWriter/animation trùng tên hàm core (vd bgVideoElement.pause()) — không phải core |
| CORE-3A (FAIL) | `core/visual-bg-video.js:17` | Gọi phương thức của phần tử media/zipWriter/animation trùng tên hàm core (vd bgVideoElement.pause()) — không phải core |
| CORE-3A (FAIL) | `core/visual-bg-video.js:17` | Gọi phương thức của phần tử media/zipWriter/animation trùng tên hàm core (vd bgVideoElement.pause()) — không phải core |
| CORE-3A (REVIEW) | `core/file-manager/folder-picker-ui.js:72` | Gọi phương thức của phần tử media/zipWriter/animation trùng tên hàm core (vd bgVideoElement.pause()) — không phải core |
| CORE-3A (REVIEW) | `core/modal-choice-ui.js:137` | Gọi phương thức của phần tử media/zipWriter/animation trùng tên hàm core (vd bgVideoElement.pause()) — không phải core |
| CORE-3A (REVIEW) | `core/modal-choice-ui.js:162` | Gọi phương thức của phần tử media/zipWriter/animation trùng tên hàm core (vd bgVideoElement.pause()) — không phải core |
| CORE-3A (REVIEW) | `core/modal-choice-ui.js:195` | Gọi phương thức của phần tử media/zipWriter/animation trùng tên hàm core (vd bgVideoElement.pause()) — không phải core |
| CORE-3A (REVIEW) | `core/modal-choice-ui.js:259` | Gọi phương thức của phần tử media/zipWriter/animation trùng tên hàm core (vd bgVideoElement.pause()) — không phải core |
| CORE-3A (REVIEW) | `core/slider-input-modal.js:138` | Gọi phương thức của phần tử media/zipWriter/animation trùng tên hàm core (vd bgVideoElement.pause()) — không phải core |
| CORE-3A (REVIEW) | `core/time-picker-modal.js:310` | Gọi phương thức của phần tử media/zipWriter/animation trùng tên hàm core (vd bgVideoElement.pause()) — không phải core |
| CORE-4 (REVIEW) | `core/visualizer/groups/bar/black-hole.js:67` | Hot path 60fps (vòng vẽ visualizer) — ngoại lệ chính thức của Rule 4 |
| CORE-4 (REVIEW) | `core/visualizer/groups/rain/glass.js:154` | Hot path 60fps (vòng vẽ visualizer) — ngoại lệ chính thức của Rule 4 |
| CORE-4 (REVIEW) | `core/visualizer/groups/rain/glass.js:176` | Hot path 60fps (vòng vẽ visualizer) — ngoại lệ chính thức của Rule 4 |
| CORE-4 (REVIEW) | `core/visualizer/groups/rain/glass.js:183` | Hot path 60fps (vòng vẽ visualizer) — ngoại lệ chính thức của Rule 4 |
| CORE-4 (REVIEW) | `core/visualizer/groups/rain/glass.js:188` | Hot path 60fps (vòng vẽ visualizer) — ngoại lệ chính thức của Rule 4 |
| CORE-4 (REVIEW) | `core/visualizer/groups/rain/street.js:65` | Hot path 60fps (vòng vẽ visualizer) — ngoại lệ chính thức của Rule 4 |
| CORE-4 (REVIEW) | `core/visualizer/groups/rain/street.js:98` | Hot path 60fps (vòng vẽ visualizer) — ngoại lệ chính thức của Rule 4 |
| CORE-4 (REVIEW) | `core/visualizer/groups/rain/street.js:156` | Hot path 60fps (vòng vẽ visualizer) — ngoại lệ chính thức của Rule 4 |
| CORE-4 (REVIEW) | `core/visualizer/groups/rain/street.js:171` | Hot path 60fps (vòng vẽ visualizer) — ngoại lệ chính thức của Rule 4 |
| CORE-5A (FAIL) | `core/file-manager/folder-picker-ui.js:125` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (FAIL) | `core/file-manager/photo-ui.js:379` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (FAIL) | `core/file-manager/photo-ui.js:380` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (FAIL) | `core/file-manager/photo-ui.js:392` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (FAIL) | `core/file-manager/photo-ui.js:452` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (FAIL) | `core/media-picker-drawer-ui.js:60` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (FAIL) | `core/pagination-ui.js:35` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (FAIL) | `core/playlist/loader.js:44` | Ngoại lệ đã audit: nằm trong danh sách 18 chỗ đã audit (changelog/v11.md mục 2) |
| CORE-5A (FAIL) | `core/playlist/loader.js:45` | Ngoại lệ đã audit: nằm trong danh sách 18 chỗ đã audit (changelog/v11.md mục 2) |
| CORE-5A (FAIL) | `core/recorder-ui.js:39` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (FAIL) | `core/settings-misc-ui.js:25` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (FAIL) | `core/settings-misc-ui.js:30` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (FAIL) | `core/wakelock.js:61` | Ngoại lệ đã audit: nằm trong danh sách 18 chỗ đã audit (changelog/v11.md mục 2) |
| CORE-5A (FAIL) | `core/wakelock.js:62` | Ngoại lệ đã audit: nằm trong danh sách 18 chỗ đã audit (changelog/v11.md mục 2) |
| CORE-5A (FAIL) | `core/zip-download-ui.js:23` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/app-settings-ui.js:17` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/app-settings-ui.js:19` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/app-settings-ui.js:26` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/app-settings-ui.js:45` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/app-settings-ui.js:46` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/app-settings-ui.js:47` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/app-settings-ui.js:48` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/app-settings-ui.js:48` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/app-settings-ui.js:50` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/app-settings-ui.js:72` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/app-settings-ui.js:75` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/app-settings-ui.js:89` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/app-settings-ui.js:91` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/app-settings-ui.js:94` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/app-settings-ui.js:107` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/app-settings-ui.js:108` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/app-settings-ui.js:109` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/app-settings-ui.js:133` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/app-settings-ui.js:135` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/app-settings-ui.js:137` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/app-settings-ui.js:154` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/app-settings-ui.js:155` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/app-settings-ui.js:156` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/app-settings-ui.js:157` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/app-settings-ui.js:158` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/app-settings-ui.js:159` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/app-settings-ui.js:164` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/app-settings-ui.js:166` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/app-settings-ui.js:168` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/app-settings-ui.js:174` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/app-settings-ui.js:183` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/app-settings-ui.js:199` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/folder-picker-ui.js:125` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/folder-picker-ui.js:146` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/folder-picker-ui.js:159` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/folder-picker-ui.js:160` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/photo-ui.js:389` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/photo-ui.js:392` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/photo-ui.js:451` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/photo-ui.js:452` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/video-ui.js:121` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/video-ui.js:124` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/video-ui.js:125` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/video-ui.js:126` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/video-ui.js:127` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/video-ui.js:128` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/video-ui.js:130` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/video-ui.js:131` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/video-ui.js:132` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/video-ui.js:133` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/video-ui.js:136` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/video-ui.js:137` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/video-ui.js:138` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/video-ui.js:139` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/video-ui.js:144` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/video-ui.js:145` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/video-ui.js:148` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/video-ui.js:149` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/video-ui.js:149` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/video-ui.js:152` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/video-ui.js:156` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/video-ui.js:158` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/video-ui.js:159` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/video-ui.js:162` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/video-ui.js:166` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/file-manager/video-ui.js:166` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/media-picker-drawer-ui.js:59` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/media-picker-drawer-ui.js:60` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/media-picker-drawer-ui.js:73` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/pagination-ui.js:35` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/perf-hud-ui.js:27` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/perf-hud-ui.js:28` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/perf-hud-ui.js:29` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/perf-hud-ui.js:30` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/perf-hud-ui.js:30` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/playlist/loader.js:44` | Ngoại lệ đã audit: nằm trong danh sách 18 chỗ đã audit (changelog/v11.md mục 2) |
| CORE-5A (REVIEW) | `core/playlist/loader.js:45` | Ngoại lệ đã audit: nằm trong danh sách 18 chỗ đã audit (changelog/v11.md mục 2) |
| CORE-5A (REVIEW) | `core/playlist/loader.js:45` | Ngoại lệ đã audit: nằm trong danh sách 18 chỗ đã audit (changelog/v11.md mục 2) |
| CORE-5A (REVIEW) | `core/playlist/render.js:40` | Ngoại lệ đã audit: nằm trong danh sách 18 chỗ đã audit (changelog/v11.md mục 2) |
| CORE-5A (REVIEW) | `core/recorder-ui.js:38` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/recorder-ui.js:39` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/settings-misc-ui.js:23` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/settings-misc-ui.js:24` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/settings-misc-ui.js:25` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/settings-misc-ui.js:30` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/theme-background-ui.js:130` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/theme-background-ui.js:131` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/theme-background-ui.js:133` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/theme-background-ui.js:135` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/theme-background-ui.js:137` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/theme-background-ui.js:139` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5A (REVIEW) | `core/wakelock.js:61` | Ngoại lệ đã audit: nằm trong danh sách 18 chỗ đã audit (changelog/v11.md mục 2) |
| CORE-5A (REVIEW) | `core/wakelock.js:62` | Ngoại lệ đã audit: nằm trong danh sách 18 chỗ đã audit (changelog/v11.md mục 2) |
| CORE-5A (REVIEW) | `core/zip-download-ui.js:23` | Hàm wire của file -ui: callback chỉ eventBus.send, listener gom cuối hàm (khuôn wireDebugConsolePanelActions ở event-bus-flow §3a) |
| CORE-5B | `core/color-utils.js:130` | Rule chấm theo điều kiện bị bỏ — Rule 1 chấm theo nội dung nhánh đã bao (guard = PASS) |
| CORE-5B | `core/color-utils.js:143` | Rule chấm theo điều kiện bị bỏ — Rule 1 chấm theo nội dung nhánh đã bao (guard = PASS) |
| CORE-5B | `core/color-utils.js:179` | Rule chấm theo điều kiện bị bỏ — Rule 1 chấm theo nội dung nhánh đã bao (guard = PASS) |
| CORE-5B | `core/player-controls.js:174` | Rule chấm theo điều kiện bị bỏ — Rule 1 chấm theo nội dung nhánh đã bao (guard = PASS) |
| CORE-5B | `core/player-controls.js:179` | Rule chấm theo điều kiện bị bỏ — Rule 1 chấm theo nội dung nhánh đã bao (guard = PASS) |
| CORE-5B | `core/settings-carousel-ui.js:77` | Rule chấm theo điều kiện bị bỏ — Rule 1 chấm theo nội dung nhánh đã bao (guard = PASS) |
| CORE-5B | `core/settings-carousel-ui.js:132` | Rule chấm theo điều kiện bị bỏ — Rule 1 chấm theo nội dung nhánh đã bao (guard = PASS) |
| CORE-5B | `core/settings-carousel-ui.js:140` | Rule chấm theo điều kiện bị bỏ — Rule 1 chấm theo nội dung nhánh đã bao (guard = PASS) |
| CORE-5B | `core/visual-bg-video.js:16` | Rule chấm theo điều kiện bị bỏ — Rule 1 chấm theo nội dung nhánh đã bao (guard = PASS) |
| CORE-5C | `core/element-style-editor.js:1` | createElement canvas/a/video/script/link để xử lý hoặc tải file — không phải dựng UI |
| CORE-5C | `core/id3-export.js:1` | createElement canvas/a/video/script/link để xử lý hoặc tải file — không phải dựng UI |
| CORE-5C | `core/large-file-download.js:1` | createElement canvas/a/video/script/link để xử lý hoặc tải file — không phải dựng UI |
| CORE-5C | `core/photo-editor-engine.js:1` | createElement canvas/a/video/script/link để xử lý hoặc tải file — không phải dựng UI |
| CORE-5C | `core/storage-manager.js:1` | createElement canvas/a/video/script/link để xử lý hoặc tải file — không phải dựng UI |
| CORE-5C | `core/streaming-zip.js:1` | createElement canvas/a/video/script/link để xử lý hoặc tải file — không phải dựng UI |
| CORE-5C | `core/ui-theme/status-bar-color.js:1` | createElement canvas/a/video/script/link để xử lý hoặc tải file — không phải dựng UI |
| CORE-5C | `core/video-editor/filmstrip.js:1` | createElement canvas/a/video/script/link để xử lý hoặc tải file — không phải dựng UI |
| CORE-5C | `core/video-editor/webcodecs-engine.js:1` | createElement canvas/a/video/script/link để xử lý hoặc tải file — không phải dựng UI |
| CORE-5C | `core/video-player-capture.js:1` | createElement canvas/a/video/script/link để xử lý hoặc tải file — không phải dựng UI |
| CORE-5C | `core/visualizer/groups/lighting/fireworks.js:1` | createElement canvas/a/video/script/link để xử lý hoặc tải file — không phải dựng UI |
| EV-LISTENER-1 | `event/listener/app-panel-nav.js:10` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/auto-switch-visual.js:71` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/auto-switch-visual.js:72` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/custom-effect.js:70` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/custom-effect.js:71` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/custom-effect.js:72` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/custom-effect.js:75` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/file-manager-storage.js:98` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/file-manager-storage.js:99` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/game-catalog.js:38` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/gameplay.js:23` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/gesture-settings.js:44` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/info-icon.js:10` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/motion-presets.js:156` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/motion-presets.js:157` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/motion-presets.js:158` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/motion-presets.js:159` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/motion-presets.js:160` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/motion-presets.js:161` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/motion-presets.js:162` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/motion-presets.js:163` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/motion-presets.js:166` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/playlist-filter-presets.js:84` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/playlist-filter-presets.js:85` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/playlist-filter-presets.js:86` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/playlist-filter-presets.js:87` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/playlist.js:48` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/playlist.js:58` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/playlist.js:179` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/playlist.js:191` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/playlist.js:276` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/playlist.js:314` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/sav-logo.js:27` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/statis-panel.js:38` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/subtitle-editor.js:165` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/subtitle-style-settings.js:29` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/subtitle-style-settings.js:37` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/subtitle-style-settings.js:55` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/video-player.js:20` | Trùng với dòng "Listener đọc appState" (EV-LISTENER-2) — gộp, không đếm 2 lần |
| EV-LISTENER-1 | `event/listener/video-player.js:24` | Trùng với dòng "Listener đọc appState" (EV-LISTENER-2) — gộp, không đếm 2 lần |
| EV-LISTENER-1 | `event/listener/video-player.js:28` | Trùng với dòng "Listener đọc appState" (EV-LISTENER-2) — gộp, không đếm 2 lần |
| EV-LISTENER-1 | `event/listener/video-player.js:32` | Trùng với dòng "Listener đọc appState" (EV-LISTENER-2) — gộp, không đếm 2 lần |
| EV-LISTENER-1 | `event/listener/video-player.js:36` | Trùng với dòng "Listener đọc appState" (EV-LISTENER-2) — gộp, không đếm 2 lần |
| EV-LISTENER-1 | `event/listener/visual-bg.js:97` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/visual-bg.js:98` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/visual-bg.js:100` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |
| EV-LISTENER-1 | `event/listener/visual-bg.js:112` | Trùng với dòng "Listener đọc appState" (EV-LISTENER-2) — gộp, không đếm 2 lần |
| EV-LISTENER-1 | `event/listener/visual-bg.js:120` | Trùng với dòng "Listener đọc appState" (EV-LISTENER-2) — gộp, không đếm 2 lần |
| EV-LISTENER-1 | `event/listener/visualizer-display.js:58` | Ủy quyền closest()/bảng tuyến chỉ để xác định phần tử rồi eventBus.send — không phải rẽ nhánh nghiệp vụ (review) |

</details>

← [Quay lại README](../README.md)
