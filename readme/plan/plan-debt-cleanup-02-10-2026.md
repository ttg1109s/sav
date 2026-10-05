# Plan dọn nợ kỹ thuật sau đợt Playlist 10000 item (lập 02/10/2026)

Nguồn: bảng nợ mục **"Rà 'file đã đụng' — đợt Playlist 10000 item (02/10/2026)"** trong
[core-legacy-audit.md](./core-legacy-audit.md). Plan này chỉ sắp xếp CÁCH và THỨ TỰ trả nợ. Nó không thay đổi rule
nào ([core-function-conventions.md](./core-function-conventions.md), [event-bus-flow.md](./event-bus-flow.md) mục 7).

## 1. Phạm vi

| Nhóm | File | Số chỗ (quét tự động) |
|---|---|---|
| Ngoài phạm vi đợt Playlist (mới bị đổi dòng gọi) | `app-boot.js`, `file-manager-storage.js`, `player-controls.js`, `player.js`, `video-player.js`, `photo-player.js` (đều `event/workflow/`) | ~180 |
| Nợ còn lại của đợt Playlist | `event/workflow/playlist.js`, `visual-bg-common.js`, `visual-bg-video.js` | ~182 |
| Core tự đọc DB (Rule 3b) | `core/file-manager/video.js` (5 hàm), `core/file-manager/image.js` (4 hàm) | 9 hàm |

Số đếm đã loại guard `return/continue/break/throw` và nhóm kiểm DOM ref null. Một phần vẫn có thể là guard viết dạng
khối, nên con số thật chỉ biết khi đọc từng chỗ.

**Ngoài plan:** `core/playlist/actions.js` (2 chỗ core gọi `attachCoverFallback()`) và các core di sản khác chưa bị đụng.
Rule 0.5 giữ nguyên với nhóm này: chỉ sửa khi đụng thật.

## 2. Nguyên tắc cho mọi đợt

1. **Không đổi hành vi.** Mỗi đợt chỉ đổi CẤU TRÚC (rẽ nhánh, chỗ đọc state, chỗ tạo tài nguyên). Lỗi thật phát hiện
   giữa chừng được ghi lại riêng và hỏi Giang, không sửa lẫn vào.
2. **1 đợt = 1–2 file.** Giang test trên máy xong mới sang đợt sau. Đợt rủi ro cao chia nhỏ tiếp (xem mục 4).
3. **Thân nhánh giữ nguyên văn.** Khi tách 1 nhánh thành method riêng thì copy y nguyên thân nhánh, chỉ đổi điểm vào. Diff
   phải đọc được theo kiểu "khối này dời sang đây".
4. **Kiểm tra trước khi giao:**
   - `node --check` mọi file đổi.
   - Boot app thật trong Chromium (shim CDN + IndexedDB nạp sẵn dữ liệu, harness của đợt Playlist), chạy kịch bản của
     đợt, 0 lỗi JS.
   - Liệt kê rõ phần harness KHÔNG kiểm được (phát audio thật, decode video, iOS) thành checklist cho Giang test trên máy.
5. **Đầu ra mỗi đợt:**
   - 1 patch zip chỉ chứa file đổi; `?v=` của file đổi được nâng (index.html, và subtitle-editor.html nếu file có nạp ở đó).
   - Cập nhật bảng nợ trong core-legacy-audit.md: gạch mục xong, ghi mục phát sinh.
   - Log Rule 4 thiếu ở hàm bị đụng thì bổ sung luôn.

## 3. Bộ khuôn sửa (dùng thống nhất mọi đợt)

| Mã | Dạng gặp | Sửa thành |
|---|---|---|
| **K1** | `if (typeof workflowX !== 'undefined') workflowX.y()` / `typeof fn === 'function'` | Kiểm thứ tự nạp trong [script-load-order.md](./script-load-order.md) + index.html. Luôn nạp trước -> bỏ điều kiện (cùng cách đã bỏ `typeof applyUiThemeToDom`). Có trang không nạp (subtitle-editor.html) -> giữ, ghi lý do tại chỗ. |
| **K2** | Bước tuỳ chọn `if (x) doStep()` | Method riêng mở đầu bằng guard, nơi gọi gọi thẳng (mục 7). |
| **K3** | `if/else`, `else if`, 3 ngôi chọn 2 lời gọi hàm | Object map `X_BY_Y` cấp module, khoá boolean thật. Rẽ theo trạng thái app ngoài hot path -> có thể dùng `VirtualMachineState.run()` (mục 7a). |
| **K4** | Điều kiện nhiều vế / phép tính quyết định nhánh | Core THUẦN trả 1 giá trị trạng thái (vd `resolveNewSongsDisplayMode()`), Workflow tra map. |
| **K5** | Chuỗi "kiểm hợp lệ rồi gán" (`if (LIST.includes(saved.x)) cfg.x = saved.x`) | Core THUẦN `sanitizeXConfig(saved, defaults)` trả config mới, mỗi field là 1 phép CHỌN GIÁ TRỊ (`valid ? saved.x : def.x`). |
| **K6** | `if (url) { try { URL.revokeObjectURL(url) } catch {} }` lặp lại | `revokeBlobUrl()` (service/blob-url.js) trong method có guard; Workflow tạo URL qua `createBlobUrl()`. |
| **K7** | Core tự đọc DB / localStorage / appConfig | Workflow đọc rồi truyền vào; core chỉ GHI. Hàm core không còn nơi gọi -> xoá. |
| **K8** | Hot path 60fps | CHỈ object map + guard; không VMState, không log mỗi frame (Rule 4 ngoại lệ hot path). |
| **giữ** | `if (el) el.x = …` kiểm DOM ref null | Giữ nguyên — phòng vệ, không phải rẽ tiến trình (đã chốt ở đợt Playlist). |

## 4. Các đợt

### Đợt 2 — `photo-player.js` + `app-boot.js` (rủi ro THẤP, ~41 chỗ)
- `app-boot.js::boot()` (~22): phần lớn là K1 (khoảng 15 dòng `typeof workflowX !== 'undefined'`). Phần còn lại là
  nhánh Nguồn boot (Song có overlay tiến trình) và nhánh Scope folder / cả thư viện. Nhánh Scope dùng lại
  `SOURCE_SCOPE_APPLY_BY_HAS_FOLDER` của switchSource() bằng cách đưa map lên `workflowPlaylistScope`, không viết map thứ 2.
- `photo-player.js` (~19 / 7 hàm): `startFromPlaylist` (5), `exitPhotoPlayerMode` (4), `togglePlayPausePhoto` (4) —
  K2/K3; `_revokeObjectUrls` — K6.
- **Test máy:** boot cả 3 Nguồn (có / không Scope folder); phát ảnh từ Playlist; Play/Pause; thoát Photo mode khi đang
  phát; Next/Prev.

### Đợt 3 — `player.js` + `player-controls.js` (rủi ro CAO, ~40 chỗ) — chia 3a / 3b
- **3a `player.js::playMedia()` (~16):** đây là cổng phát duy nhất. Trong hàm có 3 nhóm rẽ, xử lý như sau:
  - **Phân luồng theo loại media** (photo mode mà bài không phải ảnh / video / ảnh / song): map theo `mediaType` + K4
    cho điều kiện "đang Photo mode mà bài không phải ảnh".
  - **Cùng key = bật/tắt** (`key === currentKey`): giữ thành 1 nhánh map riêng.
  - **Dọn object URL cũ** (2 dòng revoke + set null): K6.
  - Phần còn lại là các bước tuỳ chọn (Game Mode gate, mediaSession, đổi bài báo VBG...): K2.
  - Tách thân hàm thành vài method theo đúng thứ tự cũ. Thứ tự các bước phải giữ nguyên tuyệt đối (đã có bug lịch sử
    do đổi thứ tự).
- **3b `player-controls.js`** (~24 / 10 hàm):
  - `runGatedSeek` (11): máy trạng thái seek gate (giữ / nhả, đổi src giữa chừng, Song vs Video). Mỗi lối thoát
    `abort → return false` là guard và giữ nguyên. Chỉ tách 2 nhánh Song / không Song + bước phát lại theo `shouldPlay`.
  - `goToNextTrack` / `goToPrevTrack` (3 + 3): K3.
- **Test máy:** phát / tạm dừng / bấm lại đúng bài; Next / Prev / auto-next cả 3 loại media; Game Mode armed; seek
  khi đang phát và khi đang dừng (Song + Video); seek liên tục nhanh; khoá màn hình + Media Session.

### Đợt 4 — `video-player.js` (rủi ro CAO, ~51 chỗ / 16 hàm)
- `swapBgVideoSource` (17): các bước tuỳ chọn theo `hooks` (onLayerBFilled / runTransition), cờ `isTransition` /
  `isSurfaceEntry` / `hideVideoUntilReady` / `skipAutoplay`, revoke 3 object URL.
  - K6 cho 3 URL.
  - K2 cho từng hook / cờ: mỗi bước 1 method có guard, gọi đúng thứ tự cũ.
  - Phần "transition hook có / không" -> K3.
- `playVideoByKey` (6), `showStaticBgThumb` (4), `clearBgVideoSource` (3), `startFromPlaylist` (3): K2/K3.
- **Test máy:** phát video từ Playlist / Next / Prev; chuyển cảnh có thumb full-res; VBG dùng chung surface với Video
  Player; video lỗi / thiếu; app ẩn rồi hiện; thoát Video mode.

### Đợt 5 — `file-manager-storage.js` + core `video.js` / `image.js` (rủi ro TRUNG BÌNH)
Gộp chung 1 đợt vì nơi gọi các hàm core tự đọc DB nằm phần lớn ở `file-manager-storage.js`.
- **Core (K7):**
  - `computeVideoStats` / `computeImageStats`: Workflow đọc record bằng `getAll{Video,Image}Records()` (đã có từ đợt
    Playlist, 1 transaction), core thuần chỉ cộng dung lượng từ mảng record. Đọc cả lô nhanh hơn hẳn vòng `await` tuần
    tự hiện tại.
  - `setVideoThumbnails`, `replaceVideoMedia` (nơi gọi: `video-preview.js`), `updateImageBlob`, `resolveImageKey`
    (nơi gọi: `image-edit.js`), `resolveVideoKey` (core gọi core trong `video.js`): Workflow đọc record / kiểm key trùng,
    core nhận record và ghi.
  - `setVideoCustomName`, `deleteImage`: **không còn nơi gọi** -> xoá (Giang xác nhận).
- **`file-manager-storage.js`** (~48 / 16 hàm): `clearAllStoredData` (7), `executeScanBroken` (5), 3 hàm
  execute*Broken (4 mỗi hàm), `_runStorageActionForSource` (4) — K2/K3; chọn hàm theo Nguồn -> map theo `mediaType`.
- **Test máy:** Quản lý lưu trữ (thống kê 3 Nguồn); quét / sửa / xoá bài lỗi; quét thumb video đen; Clear All khi đang
  phát; sửa ảnh (lưu đè + lưu bản mới); thay file video; zip tải về.

### Đợt 6 — `playlist.js` (rủi ro CAO, ~87 chỗ / 29 hàm, 2200 dòng) — chia 3 lượt
- **6a Upload** — `uploadSongs` (16), `uploadVideos` (3), `uploadPhotos` (4), `_captureFirstFrame` (7),
  `_probeVideoFrame` (3), `_captureSquareThumb` (1). `_captureFirstFrame` / `_probeVideoFrame` là chuỗi chờ khung hình
  (readyState / play-pause nudge) nên phải giữ y thứ tự; chỉ tách rẽ nhánh.
- **6b Xoá / Xuất** — `deleteMediaFromActionMenu` (7), `deleteSelectedMedia` (6), `exportSongWithTag` (4),
  `exportSelectedSongsZip` (4), `exportActiveMenuItem` (3), `exportSelected{Videos,Images}Zip` (3 mỗi hàm),
  `export{Video,Image}File` (2 mỗi hàm). Chọn hàm theo `mediaType` -> map.
- **6c Còn lại** — folder picker (`commitFolderPickerRename`, `pickFolderInPicker`, `_renderFolderPickerGrid`...),
  `executeSaveEdit` (3), `applyCoverFromLibrary`, `playSelectedSongs`, `loadPersistedPlaylistConfigOnBoot`...
- **Test máy (theo lượt):**
  - 6a: upload bài có / không tag-cover, video (thumb), ảnh, upload trùng tên.
  - 6b: xoá 1 / nhiều (đang phát / không), xuất từng loại + zip.
  - 6c: folder picker (tạo / đổi tên / chọn), sửa thông tin, chọn bìa từ thư viện, phát mục đã chọn.

### Đợt 7 — `visual-bg-common.js` + `visual-bg-video.js` (rủi ro CAO, ~95 chỗ) — chia 2 lượt
- **7a common:**
  - `loadPersistedSettingsOnBoot` (34): gần như toàn bộ là K5 -> core thuần `sanitizeVisualBgConfig(saved, defaults)`.
    Workflow chỉ còn đọc meta, gọi sanitize, ghi config.
  - `_tickGradientMovement` (8): **hot path**, K8.
  - `clearMediaLayers` (4), `syncPlaybackToAudio` (3), các `change*` / `_commit*`: K2/K3.
- **7b video** (~22 / 13 hàm): `_activateVideoPointMove`, `_advanceVideo`, `_applyVideo`, `_playVideoKey` (3 mỗi hàm),
  `_refreshVideoAudioRowButtons` (2)... K2/K3/K6.
- **Test máy:** boot với config VBG cũ (kể cả config hỏng / thiếu field); đổi type / nguồn / thứ tự / thời lượng;
  gradient chuyển động (FPS); VBG video + âm thanh video; đổi bài -> VBG next; app ẩn / hiện.

## 5. Thứ tự & lý do

`2 → 3a → 3b → 4 → 5 → 6a → 6b → 6c → 7a → 7b`

- **Đợt 2 trước:** rủi ro thấp, và kiểm chứng bộ khuôn K1–K7 trên code thật trước khi đụng luồng phát.
- **3 rồi 4:** `playMedia()` (3a) điều phối sang `video-player.js` / `photo-player.js`, nên làm cổng phát trước, rồi mới
  tới các player con. Đợt 2 đã xong `photo-player.js`, nên đợt 4 chỉ còn video.
- **5 trước 6:** đợt 5 dọn các hàm core đọc DB mà luồng upload / sửa (đợt 6) cũng gọi gián tiếp.
- **7 cuối:** VBG tách biệt nhất và có hot path, làm khi bộ khuôn đã ổn định.

## 6. Cần Giang chốt trước khi bắt đầu

1. **K1:** đồng ý bỏ các `typeof workflowX !== 'undefined'` khi đã xác minh thứ tự nạp (index.html) chứ?
2. **K3 theo trạng thái app:** ưu tiên object map hay `VirtualMachineState.run()` (cả 2 đều hợp lệ theo mục 7 / 7a)?
3. **Đợt 5:** xoá 2 hàm core không còn nơi gọi (`setVideoCustomName`, `deleteImage`)?
4. **Nhịp:** giao từng lượt (3a, 3b, 6a...) hay gộp cả đợt rồi test 1 lần?
