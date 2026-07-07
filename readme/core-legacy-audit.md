# Nợ kỹ thuật: function Core di sản vi phạm quy tắc ver 12 (`readme/core-function-conventions.md`)

> **[Chính thức]** Toàn bộ function trong danh sách dưới đây được ghi nhận là **NỢ KỸ THUẬT** kể
> từ ver 12 — KHÔNG bắt buộc sửa ngay, nhưng khi 1 function trong danh sách bị đụng tới (sửa thật,
> không phải đọc lướt), phần bị sửa PHẢI tuân theo `core-function-conventions.md` (4 rule: đơn
> tuyến nghiệp vụ, không tự đọc `appState`, core-gọi-core chỉ hợp lệ khi dùng return value, log
> `writer/page/content` khi set/mutate state). Mọi function/code **MỚI viết** từ ver 12 trở đi —
> dù trong `core/` hay bất kỳ thư mục nào khác — **bắt buộc tuân theo 4 rule ngay từ đầu**, không
> được thêm vào danh sách nợ này.
>
> Sinh bằng script quét cú pháp thật trên toàn bộ 48 file `core/**/*.js` (294 function
> top-level), KHÔNG phải liệt kê bằng mắt/suy đoán — nhưng Rule 1/3 vẫn cần xác nhận thủ
> công ở mức độ ghi rõ dưới đây (script không thể phán đoán ngữ nghĩa "có phải 2 tiến trình
> nghiệp vụ khác nhau" 100% chắc chắn).
>
> **[CẢNH BÁO 04/07/2026]** Rule 3 vừa được **VIẾT LẠI SIẾT CHẶT HƠN HẲN** (xem
> [core-function-conventions.md Rule 3](./core-function-conventions.md)): trước đây core-gọi-core
> HỢP LỆ nếu dùng return value (hoặc bất đồng bộ không chờ) — giờ **CẤM TUYỆT ĐỐI mọi hình thức**,
> chỉ còn ngoại lệ gọi `service/db.js`/`appState.set`/`mutate`. Số liệu "vi phạm Rule 3" trong
> bảng dưới đây **SINH RA TỪ TIÊU CHÍ CŨ (return-value)** — CHƯA quét lại theo tiêu chí mới, nên
> chắc chắn ĐANG BỊ ĐẾM THIẾU (nhiều hàm trước đây "hợp lệ" vì dùng return value giờ VI PHẠM).
> CHƯA re-scan toàn bộ — coi cột Rule 3 dưới đây là **CẬN DƯỚI** (số vi phạm thật ≥ số liệt kê),
> chỉ xử lý đúng khi hàm đó bị đụng tới thật (đúng tinh thần nợ kỹ thuật, không cần quét lại ngay).

## Loại trừ hot-path (không đưa vào audit)

Toàn bộ hàm trong các file sau (chạy trong/được gọi trực tiếp mỗi khung hình từ vòng lặp
`requestAnimationFrame` ở `core/visualizer/draw-visualizer.js`):

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

## Thống kê tổng quan

- Tổng function xét (đã loại hot-path): **266** / 294 function top-level trong `core/`
- **Rule 2** (tự `appState.get()` trong thân hàm) — xác nhận 100% cơ học: **103**
- **Rule 1** (nghi rẽ nhánh ≥2 tiến trình) — có `else`/`switch` kèm `appState.get()` (ưu tiên soát): **22**; chỉ `if` đơn không `else` (nhiều khả năng guard clause hợp lệ, độ ưu tiên thấp): **61**
- **Rule 3** (gọi hàm core khác dạng bare-statement, callee đã XÁC NHẬN qua code thật là KHÔNG return giá trị): **85**
- Có ít nhất 1 vi phạm xác nhận (Rule 2, hoặc Rule 1-strong, hoặc Rule 3): **150** / 266

## Phương pháp & độ tin cậy từng cột

| Cột | Cách xác định | Độ tin cậy |
|---|---|---|
| **R2** | Regex tìm `appState.get(` trong thân hàm (đã bỏ qua comment/string/template literal khi quét) | Cao — khách quan, đúng theo đúng câu chữ Rule 2 |
| **R1** | `strong` = có `else`/`switch` + có `appState.get()`; `weak` = chỉ `if` đơn không `else` | Trung bình — vẫn cần đọc để phân biệt guard clause thật (vd `if (idx === -1) return;`) khỏi rẽ nhánh 2 tiến trình thật (vd if/else chọn "khởi tạo mới" hay "resume") |
| **R3** | Bare-call-statement (`tenHam(...);` đứng riêng 1 dòng, không gán/return) tới 1 hàm core khác đã xác nhận **không có `return <giá trị>`** trong chính thân hàm đó | Trung bình — chỉ bắt được lời gọi ĐỒNG BỘ. **CHƯA quét lời gọi `await`** (thực tế có **84 lần `await`** rải trên **15 file** core — không hề ít) — những chuỗi `await fnA(); await fnB();`/`await fnA(); fnB();` này CŨNG cần soát riêng theo Rule 3 (await tạo phụ thuộc thứ tự = vẫn tính Workflow, không phải ngoại lệ — ngoại lệ CHỈ dành cho async KHÔNG chờ), nhưng nằm NGOÀI phạm vi pass này, cần 1 lượt quét riêng nếu cần đầy đủ |

---

## Danh sách theo file (Rule 2 xác nhận + Rule 1-strong + Rule 3 xác nhận)

### `core/app-cleanup.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `executeAppCleanup` | 16-45 | ✓ (5) | — | `releaseWakeLock` |

### `core/app-recovery.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `executeRestoreDefaults` | 32-36 | — | — | `saveConfig` |

### `core/audio-engine.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `initPitchWorker` | 35-54 | ✓ (3) | — | — |
| `requestPitchDetection` | 67-74 | ✓ (4) | — | — |
| `setupAudioContext` | 76-99 | ✓ (21) | ✓ | `allocateBuffers`, `applyEQPreset`, `initPitchWorker` |

### `core/auto-switch-visual.js`

> **[CẬP NHẬT Batch D3, 06/07/2026]** 4 hàm `set*`/`syncAutoSwitchTimeModeBlocks` ĐÃ REFACTOR đầy
> đủ Rule 1-4 (bỏ hẳn `saveConfig`/`updateCycleModeButtonState`/`startAutoSwitchVisualBranch` nội
> bộ — dời ra `event/workflow/auto-switch-visual.js`) — KHÔNG còn vi phạm Rule 3, cột "R3" cập
> nhật lại "—". `initAutoSwitchVisualUI` ĐỔI TÊN `initAutoSwitchCycleButtonFromConfig` + THU HẸP
> phạm vi (chỉ còn `updateCycleModeButtonState()`, phần đồng bộ panel dời sang
> `workflowVisualizerDisplay.openPanel()`) — VẪN nợ kỹ thuật phần còn lại (gọi
> `updateCycleModeButtonState`), ngoài phạm vi Batch D3 (không gắn với panel di chuyển). Số dòng
> KHÔNG re-scan bằng script — coi là gần đúng.

| Hàm | Dòng (gần đúng) | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `pickNextAutoSwitchVisualType` | ~50-58 | ✓ (2) | — | — |
| `applyAutoSwitchVisualType` | ~61-67 | ✓ (1) | — | `saveConfig`, `updateTypeUI` |
| `computeAutoSwitchVisualTimerDelayMs` | ~75-83 | ✓ (1) | — | — |
| `scheduleNextAutoSwitchVisualTimer` | ~90-108 | ✓ (2) | — | `applyAutoSwitchVisualType` |
| `buildAutoSwitchVisualMarks` | ~125-139 | ✓ (2) | — | — |
| `autoSwitchVisualMarksTick` | ~146-172 | ✓ (1) | ✓ | `applyAutoSwitchVisualType` |
| `startAutoSwitchVisualBranch` | ~210-231 | ✓ (2) | ✓ | `buildAutoSwitchVisualMarks`, `killAllAutoSwitchVisualTasks`, `scheduleNextAutoSwitchVisualTimer` |
| `onAutoSwitchVisualSongChanged` | ~255-262 | ✓ (3) | — | — |
| `syncAutoSwitchVisualPlayState` | ~269-276 | ✓ (2) | — | — |
| `updateCycleModeButtonState` | ~301-310 | ✓ (1) | — | — |
| `syncAutoSwitchTimeModeBlocks` | ~317-322 | — | — | — (Batch D3: nhận tham số, không còn đọc dom-refs tĩnh) |
| `initAutoSwitchCycleButtonFromConfig` (đổi tên Batch D3, cũ: `initAutoSwitchVisualUI`) | ~330-333 | — | — | `updateCycleModeButtonState` (nợ kỹ thuật còn lại, ngoài phạm vi batch) |
| `setAutoSwitchVisualEnabled` | ~339-342 | — | — | — (Batch D3: đã dời ra Workflow) |
| `setAutoSwitchVisualMode` | ~345-347 | — | — | — (Batch D3: đã dời ra Workflow) |
| `setAutoSwitchVisualTimeMode` | ~350-352 | — | — | — (Batch D3: đã dời ra Workflow) |
| `setAutoSwitchVisualSecondsField` | ~355-360 | — | — | — (Batch D3: đã dời ra Workflow) |

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
| `updateDOMBackground` | 18-22 | ✓ (1) | — | — |
| `updatePlaylistBg` | 24-28 | ✓ (1) | ✓ | — |

### `core/config.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `saveConfig` | 125-128 | ✓ (1) | — | `scheduleConfigBackup` |
| `flushConfigBackup` | 135-139 | ✓ (1) | — | — |
| `loadBackgroundAssets` | 146-170 | ✓ (2) | ✓ | `saveConfig`, `updatePlaylistBg` |
| `loadConfig` | 179-274 | ✓ (26) | — | `updateDOMBackground` |

### `service/db.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `makeStoreAccessor` | 116-127 | ✓ (2) | — | — |

### `core/equalizer.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `updateEQSlidersUI` | 26-30 | ✓ (1) | — | — |
| `initEqualizerUIFromConfig` | 38-43 | ✓ (3) | — | `applyEQPreset`, `initEQSliders`, `updateEQSlidersUI` |

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

### `core/player-controls.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `playNext` | 47-67 | ✓ (16) | ✓ | `requestWakeLock` |
| `playPrev` | 69-85 | ✓ (13) | ✓ | `requestWakeLock` |
| `showResumeChoiceModal` | 162-230 | ✓ (7) | — | — |
| `updateResumeModalTitleIfPending` | 242-251 | ✓ (3) | — | — |
| `switchToVisualizer` | 253-261 | ✓ (1) | — | — |
| `handleBackToPlaylistClick` | 268-271 | — | — | `forceBackToPlaylistUI` |
| `togglePlayPause` | 277-285 | ✓ (8) | ✓ | `requestWakeLock` |
| `toggleShuffle` | 291-293 | ✓ (3) | — | — |
| `cycleRepeatMode` | 299-304 | ✓ (4) | ✓ | — |
| `closeSettingsDrawer` | 318-320 | — | — | `validateVideoBgOnClose` |
| `_listenTick` | 353-379 | ✓ (6) | — | — |
| `stopListenClock` | 386-390 | — | — | `_listenTick` |
| `handleAudioPlay` | 397-407 | ✓ (2) | — | `startListenClock`, `syncVideoBgToAudio` |
| `handleAudioPause` | 413-421 | ✓ (2) | — | `releaseWakeLock`, `stopListenClock`, `syncVideoBgToAudio` |
| `handleAudioEnded` | 428-430 | — | — | `stopListenClock` |
| `handleAudioError` | 451-455 | ✓ (4) | — | — |
| `handleAudioTimeUpdate` | 466-472 | ✓ (1) | — | — |

### `core/playlist/actions.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `removeKeyFromDisplay` | 30-39 | ✓ (2) | — | `recomputeRenderOrder`, `renderPlaylistDiff`, `updateEmptyState`, `updateShuffleArray` |
| `handleSongActionMenuSelect` | 223-232 | — | — | `closeSongActionMenu` |
| `handlePlaybackError` | 238-243 | ✓ (1) | — | — |
| `confirmKeepBrokenSong` | 250-258 | — | — | `removeKeyFromDisplay` |
| `deleteBrokenSongByKey` | 280-284 | — | — | `removeKeyFromDisplay`, `removeSongStats` |
| `openSongEditModal` | 325-340 | ✓ (1) | — | `revokeSongEditPendingPreview`, `setSongEditCoverPreview`, `setSongEditTab` |
| `closeSongEditModal` | 342-347 | — | — | `revokeSongEditPendingPreview` |
| `changeSongEditCover` | 356-364 | — | — | `revokeSongEditPendingPreview`, `setSongEditCoverPreview` |
| `removeSongEditCover` | 367-371 | — | — | `revokeSongEditPendingPreview`, `setSongEditCoverPreview` |
| `applySongEditAndSave` | 398-444 | ✓ (7) | ✓ | `attachCoverFallback` |
| `refreshAfterSongEditSave` | 451-457 | ✓ (2) | — | `recomputeRenderOrder`, `refreshSongNode`, `renderPlaylistDiff` |
| `openSongInfoModal` | 480-493 | ✓ (1) | — | — |
| `exportCurrentSongInfo` | 506-511 | — | — | `closeSongInfoModal` |

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
| `applyNewSongsToDisplayOrder` | 65-79 | ✓ (3) | — | — |
| `updateShuffleArray` | 81-91 | ✓ (2) | — | — |
| `setDisplaySortMode` | 94-100 | — | — | `recomputeDisplayOrder`, `recomputeRenderOrder`, `renderPlaylistDiff` |

### `core/playlist/render.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `buildSongNode` | 50-92 | ✓ (3) | ✓ | `attachCoverFallback` |
| `showPlaylistLoading` | 95-105 | — | — | `updatePlaylistLoading` |
| `updateEmptyState` | 118-135 | ✓ (2) | ✓ | — |
| `renderPlaylistFull` | 137-151 | ✓ (3) | — | `updateEmptyState` |
| `renderPlaylistDiff` | 153-185 | ✓ (6) | — | `updateEmptyState` |
| `refreshSongNode` | 187-194 | ✓ (1) | — | `revokeNodeCoverUrl` |
| `applySearchQuery` | 197-201 | — | — | `recomputeRenderOrder`, `renderPlaylistDiff` |

### `core/resume-state-storage.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `saveResumeStateToLocalStorage` | 68-96 | ✓ (15) | — | — |
| `enableResumeModalButtonsWhenPlaylistReady` | 163-179 | ✓ (3) | — | `discardPendingResumeState` |
| `applyResumeStateToRam` | 196-241 | ✓ (10) | ✓ | `clearResumeFlag`, `clearResumeStateFromLocalStorage` |
| `discardPendingResumeState` | 244-248 | — | — | `clearResumeFlag`, `clearResumeStateFromLocalStorage` |

### `core/state-and-video-bg.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `returnToVisualizer` | 32-34 | ✓ (1) | — | — |
| `validateVideoBgOnClose` | 64-71 | ✓ (1) | — | `handleVideoBackground` |
| `setupVideoBgSource` | 81-92 | ✓ (3) | — | — |
| `syncVideoBgToAudio` | 99-103 | ✓ (1) | ✓ | — |
| `handleVideoBackground` | 105-128 | ✓ (3) | ✓ | `setupVideoBgSource`, `syncVideoBgToAudio`, `updateDOMBackground` |
| `enableVideoBackground` | 131-134 | — | — | `handleVideoBackground` |
| `disableVideoBackgroundState` | 138-145 | — | — | `handleVideoBackground` |
| `setVisualEnabled` | 148-151 | — | — | `saveConfig` |
| `applyUploadedVideoBg` | 156-167 | — | — | `handleVideoBackground` |

### `core/stats-panel-toggle.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `toggleStatsPanelVisibility` | 38-53 | ✓ (2) | — | — |

### `core/storage-manager.js`

> **[CẬP NHẬT Batch D5, 06/07/2026]** `downloadAllSongsThenClear`/`clearAllSongsNoDownload` ĐÃ BỎ
> lệnh gọi `renderStorageStats()` nội bộ (vốn THỪA — workflow luôn gọi lại `refreshSongTab()` sau
> 2 hàm này, tự vẽ lại stats đúng phần tử panel đang mở) — cột R3 cập nhật lại. `renderStorageStats`/
> `resetScanResultUI`/`renderScanResultUI` (không nằm trong bảng vì vốn không vi phạm rule nào)
> giờ nhận phần tử DOM qua tham số thay vì dom-refs tĩnh (panel Song nay push/pop động).

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `clearAllStoredData` | 78-109 | ✓ (5) | — | `renderPlaylistFull`, `saveConfig`, `updateShuffleArray` |
| `downloadAllSongsThenClear` | ~120-139 | — | — | `triggerDownload` (Batch D5: bỏ `renderStorageStats`, thừa) |
| `clearAllSongsNoDownload` | ~145-147 | — | — | — (Batch D5: bỏ `renderStorageStats`, thừa) |
| `scanAllSongsForCorruption` | 171-188 | ✓ (1) | — | — |
| `deleteCorruptedSongs` | 198-205 | — | — | `removeKeyFromDisplay` |

### `core/subtitle/subtitle-display.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `updateSubToggleUI` | 13-17 | ✓ (1) | — | — |
| `applySubtitleStyle` | 29-42 | ✓ (1) | — | — |
| `processSubtitles` | 44-84 | ✓ (4) | — | `addActiveSubBlock`, `removeActiveSubBlock` |
| `clearAllActiveSubBlocks` | 111-116 | ✓ (1) | — | — |

### `core/subtitle/subtitle-style-settings.js`

> **[CẬP NHẬT Batch D2, 06/07/2026]** 10 hàm `set*` dưới đây ĐÃ REFACTOR đầy đủ Rule 1-4 (bỏ hẳn
> `applySubtitleStyle()`/`saveConfig()` nội bộ — dời ra `event/workflow/subtitle-style-
> settings.js`) — KHÔNG còn vi phạm Rule 3, cột "R3" cập nhật lại "—". `initSubtitleStyleSettings-
> UIFromConfig` ĐỔI TÊN thành `initSubtitleToggleUIFromConfig` + THU HẸP phạm vi (chỉ còn đồng bộ
> checkbox Main + badge, phần 8 field style dời sang `workflowSubtitleStyleSettings.openPanel()`),
> VẪN CÒN nợ kỹ thuật (gọi `updateSubToggleUI`/`applySubtitleStyle`) — chưa refactor vì ngoài phạm
> vi Batch D2 (không phải hàm gắn với panel di chuyển). Số dòng bên dưới KHÔNG re-scan bằng script
> (đã đổi cấu trúc file thật) — coi là gần đúng, cần script quét lại nếu cần chính xác tuyệt đối.

| Hàm | Dòng (gần đúng, chưa re-scan) | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `setSubtitlesEnabled` | ~19-25 | ✓ (2) | — | `saveConfig`, `updateSubToggleUI` |
| `setSubtitleStyleBgColor` | ~28-30 | — | — | — (Batch D2: đã dời ra Workflow) |
| `setSubtitleStyleBgOpacity` | ~33-38 | — | — | — (Batch D2: đã dời ra Workflow) |
| `setSubtitleStyleBorderColor` | ~41-43 | — | — | — (Batch D2: đã dời ra Workflow) |
| `setSubtitleStyleBorderOpacity` | ~46-51 | — | — | — (Batch D2: đã dời ra Workflow) |
| `setSubtitleStyleBorderWidth` | ~54-59 | — | — | — (Batch D2: đã dời ra Workflow) |
| `setSubtitleStyleBorderRadius` | ~62-67 | — | — | — (Batch D2: đã dời ra Workflow) |
| `setSubtitleStyleTextColor` | ~70-72 | — | — | — (Batch D2: đã dời ra Workflow) |
| `setSubtitleStyleFontSize` | ~75-80 | — | — | — (Batch D2: đã dời ra Workflow) |
| `setSubtitleStyleLineHeight` | ~83-88 | — | — | — (Batch D2: đã dời ra Workflow) |
| `setSubtitleStyleLetterSpacing` | ~91-96 | — | — | — (Batch D2: đã dời ra Workflow) |
| `initSubtitleToggleUIFromConfig` (đổi tên, cũ: `initSubtitleStyleSettingsUIFromConfig`) | ~103-109 | ✓ (1) | — | `applySubtitleStyle`, `updateSubToggleUI` |

### `core/subtitle/subtitles.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `buildSRTString` | 33-35 | ✓ (1) | — | — |
| `renderSubList` | 37-87 | ✓ (3) | ✓ | — |
| `deleteSubItem` | 105-105 | ✓ (1) | — | — |
| `handleAutoTimingClick` | 114-126 | ✓ (2) | ✓ | — |
| `addNewSubLine` | 129-135 | ✓ (1) | — | — |
| `exportSubtitlesAsSrt` | 139-147 | ✓ (3) | — | — |
| `applySubtitlesAndClose` | 156-185 | ✓ (3) | — | `saveConfig`, `updateSubToggleUI` |
| `openSubtitleModal` | 189-192 | — | — | `renderSubList` |
| `closeSubtitleModalWithoutSaving` | 195-198 | — | — | `resetAutoSub` |

### `core/tab-hide-reload.js`

| Hàm | Dòng | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `triggerHideAndReload` | 28-50 | ✓ (1) | — | — |

### `core/visualizer/visualizer-display.js`

> **[CẬP NHẬT Batch D3, 06/07/2026]** `updateTypeUI`/`updateBarStyleUI`/`updateColorMenuUI` THÊM
> guard đầu hàm (panel Visualizer Settings nay push/pop động, có thể đang đóng — xem
> core/settings-panel-stack.js) — R3 giữ NGUYÊN như cũ (guard không đổi bản chất core-gọi-core,
> ngoài phạm vi Rule 0.5 batch này). 14 hàm `set*` (quality/bgColor/colorMode/solidColor.../
> dynColor.../vortexStyle/barStyle/rainStyle/glassFlash/maxHeight/barWidth/mirrorCount) ĐÃ
> REFACTOR ĐẦY ĐỦ Rule 1-4 — bỏ hẳn `resizeCanvas`/`updateDOMBackground`/`updateColorMenuUI`/
> `updateProgressBarCSS`/`updateVortexVisibility`/`updateBarStyleUI`/`saveConfig` nội bộ (dời ra
> `event/workflow/visualizer-display.js`) — KHÔNG còn vi phạm Rule 3. `setMaxHeight`/`setBarWidth`/
> `setMirrorCount` R2 giảm từ ✓(1) xuống "—" (không còn tự `appState.get()` lại để đọc display —
> nhận `displayEl` qua tham số, ghi thẳng giá trị local `v`). Số dòng dưới đây KHÔNG re-scan bằng
> script (đã đổi cấu trúc file thật) — coi là gần đúng.

| Hàm | Dòng (gần đúng) | R2 (`appState.get` — số lần) | R1-strong (else/switch) | R3 (gọi void xác nhận) |
|---|---|---|---|---|
| `updateProgressBarCSS` | ~28-33 | ✓ (1) | — | — |
| `cycleVisualizerType` | ~50-53 | ✓ (2) | — | — |
| `updateTypeUI` | ~63-107 | ✓ (5) | ✓ | `updateBarStyleUI`, `updateVortexVisibility` (KHÔNG đổi — chỉ thêm guard, xem ghi chú trên) |
| `updateBarStyleUI` | ~112-117 | ✓ (1) | — | — (đã thêm guard, không đổi vi phạm) |
| `updateColorMenuUI` | ~120-128 | ✓ (1) | ✓ | `updateProgressBarCSS` (KHÔNG đổi — chỉ thêm guard) |
| `applyEQPreset` | ~130-135 | ✓ (2) | — | — |
| `setVisualizerQuality` | ~138-140 | — | — | — (Batch D3: đã dời ra Workflow) |
| `applyBgImage` | ~148-158 | — | — | `updatePlaylistBg` (Main, KHÔNG di chuyển batch này) |
| `applyBgImageEnabled` | ~165-176 | — | — | `updatePlaylistBg` (Main, KHÔNG di chuyển batch này) |
| `setBgColor` | ~183-185 | — | — | — (Batch D3: đã dời ra Workflow) |
| `setColorMode` | ~191-193 | — | — | — (Batch D3: đã dời ra Workflow) |
| `setSolidColorFromPicker` | ~199-202 | — | — | — (Batch D3: đã dời ra Workflow) |
| `setSolidColorFromText` | ~209-214 | — | — | — (Batch D3: đã dời ra Workflow) |
| `setDynColorA` | ~217-219 | — | — | — (Batch D3: đã dời ra Workflow) |
| `setDynColorB` | ~222-224 | — | — | — (Batch D3: đã dời ra Workflow) |
| `setVortexStyle` | ~227-229 | — | — | — (Batch D3: đã dời ra Workflow) |
| `setBarStyle` | ~232-234 | — | — | — (Batch D3: đã dời ra Workflow) |
| `setRainStyle` | ~237-239 | — | — | — (Batch D3: đã dời ra Workflow) |
| `setGlassFlash` | ~242-244 | — | — | — (Batch D3: đã dời ra Workflow) |
| `setMaxHeight` | ~247-251 | — | — | — (Batch D3: R2 giảm từ ✓(1), đã dời saveConfig ra Workflow) |
| `setBarWidth` | ~254-258 | — | — | — (Batch D3: R2 giảm từ ✓(1), đã dời saveConfig ra Workflow) |
| `setMirrorCount` | ~261-265 | — | — | — (Batch D3: R2 giảm từ ✓(1), đã dời saveConfig ra Workflow) |
| `setVolume` | ~268-273 | ✓ (3) | — | — |

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
không" (xem `core-function-conventions.md` Rule 1) trước khi kết luận.

| File | Hàm | Dòng |
|---|---|---|
| `core/app-cleanup.js` | `executeAppCleanup` | 16-45 |
| `core/audio-engine.js` | `initPitchWorker` | 35-54 |
| `core/audio-engine.js` | `requestPitchDetection` | 67-74 |
| `core/auto-switch-visual.js` | `pickNextAutoSwitchVisualType` | 50-58 |
| `core/auto-switch-visual.js` | `applyAutoSwitchVisualType` | 61-67 |
| `core/auto-switch-visual.js` | `computeAutoSwitchVisualTimerDelayMs` | 75-83 |
| `core/auto-switch-visual.js` | `scheduleNextAutoSwitchVisualTimer` | 90-108 |
| `core/auto-switch-visual.js` | `buildAutoSwitchVisualMarks` | 125-139 |
| `core/auto-switch-visual.js` | `onAutoSwitchVisualSongChanged` | 255-262 |
| `core/auto-switch-visual.js` | `syncAutoSwitchVisualPlayState` | 269-276 |
| `core/auto-switch-visual.js` | `updateCycleModeButtonState` | 301-310 |
| `core/auto-switch-visual.js` | `initAutoSwitchCycleButtonFromConfig` (đổi tên Batch D3, cũ: `initAutoSwitchVisualUI`) | ~330-333 |
| `core/canvas-scene-setup.js` | `allocateBuffers` | 5-10 |
| `core/canvas-scene-setup.js` | `resizeCanvas` | 21-48 |
| `core/color-utils.js` | `updateDOMBackground` | 18-22 |
| `core/config.js` | `loadConfig` | 179-274 |
| `service/db.js` | `makeStoreAccessor` | 116-127 |
| `core/equalizer.js` | `updateEQSlidersUI` | 26-30 |
| `core/listen-stats.js` | `_ensureStats` | 37-41 |
| `core/listen-stats.js` | `flushSongStats` | 80-87 |
| `core/loading-shield-util.js` | `withLoadingShield` | 17-54 |
| `core/player-controls.js` | `showResumeChoiceModal` | 162-230 |
| `core/player-controls.js` | `updateResumeModalTitleIfPending` | 242-251 |
| `core/player-controls.js` | `switchToVisualizer` | 253-261 |
| `core/player-controls.js` | `_listenTick` | 353-379 |
| `core/player-controls.js` | `handleAudioPlay` | 397-407 |
| `core/player-controls.js` | `handleAudioPause` | 413-421 |
| `core/player-controls.js` | `handleAudioError` | 451-455 |
| `core/player-controls.js` | `handleAudioTimeUpdate` | 466-472 |
| `core/playlist/actions.js` | `openSongEditModal` | 325-340 |
| `core/playlist/actions.js` | `refreshAfterSongEditSave` | 451-457 |
| `core/playlist/actions.js` | `openSongInfoModal` | 480-493 |
| `core/playlist/loader.js` | `scanValidSongsFromDB` | 288-305 |
| `core/playlist/order.js` | `sortKeysByMode` | 17-26 |
| `core/playlist/order.js` | `matchesSearch` | 28-35 |
| `core/playlist/order.js` | `applyNewSongsToDisplayOrder` | 65-79 |
| `core/playlist/order.js` | `updateShuffleArray` | 81-91 |
| `core/playlist/render.js` | `renderPlaylistFull` | 137-151 |
| `core/playlist/render.js` | `renderPlaylistDiff` | 153-185 |
| `core/playlist/render.js` | `refreshSongNode` | 187-194 |
| `core/resume-state-storage.js` | `saveResumeStateToLocalStorage` | 68-96 |
| `core/resume-state-storage.js` | `enableResumeModalButtonsWhenPlaylistReady` | 163-179 |
| `core/state-and-video-bg.js` | `returnToVisualizer` | 32-34 |
| `core/state-and-video-bg.js` | `validateVideoBgOnClose` | 64-71 |
| `core/state-and-video-bg.js` | `setupVideoBgSource` | 81-92 |
| `core/stats-panel-toggle.js` | `toggleStatsPanelVisibility` | 38-53 |
| `core/storage-manager.js` | `clearAllStoredData` | 78-109 |
| `core/storage-manager.js` | `scanAllSongsForCorruption` | 171-188 |
| `core/subtitle/subtitle-display.js` | `updateSubToggleUI` | 13-17 |
| `core/subtitle/subtitle-display.js` | `processSubtitles` | 44-84 |
| `core/subtitle/subtitle-display.js` | `clearAllActiveSubBlocks` | 111-116 |
| `core/subtitle/subtitle-style-settings.js` | `setSubtitlesEnabled` | 19-25 |
| `core/subtitle/subtitle-style-settings.js` | `initSubtitleToggleUIFromConfig` (đổi tên Batch D2, cũ: `initSubtitleStyleSettingsUIFromConfig`) | ~103-109 |
| `core/subtitle/subtitles.js` | `exportSubtitlesAsSrt` | 139-147 |
| `core/subtitle/subtitles.js` | `applySubtitlesAndClose` | 156-185 |
| `core/tab-hide-reload.js` | `triggerHideAndReload` | 28-50 |
| `core/visualizer/visualizer-display.js` | `cycleVisualizerType` | 50-53 |
| `core/visualizer/visualizer-display.js` | `applyEQPreset` | 109-114 |
| `core/visualizer/visualizer-display.js` | `setVolume` | 246-251 |
| `core/visualizer/visualizer-misc-settings.js` | `initVisualizerMiscSettingsUIFromConfig` | 20-25 |
| `core/wakelock.js` | `releaseWakeLock` | 24-29 |

---

← [Quay lại core-function-conventions.md](./core-function-conventions.md)
