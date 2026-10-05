# Plan — Tách Blob khỏi bản ghi media + gộp thống kê vào meta media

> Đặt tại `readme/plan-media-db-split.md`. Trạng thái: **NHÁP — chờ Giang chốt mục 11**.
> Phạm vi: 2 việc gộp chung 1 dự án vì dùng chung 1 lần chuyển dữ liệu:
> **(A)** tách mọi Blob ra store riêng `media_blobs`; **(B)** đưa `songStats` (+ điểm Game) vào bản ghi meta của từng media.

---

## 0. Bối cảnh

### 0.1 Lỗi gốc — "round-trip Blob"
3 store `songs` / `videos` / `images` đang chứa CHUNG file media (Blob, vài MB → vài trăm MB) với dữ liệu thường
(tên, tag, phụ đề, folder, điểm game...). Sửa 1 field thường = đọc nguyên record → sửa → **ghi lại nguyên record kèm Blob vừa đọc**.
Ghi lại Blob đọc từ chính IndexedDB làm backing file cũ bị thay ngay trong phiên:

- Blob URL **đang dùng** (media đang phát, ảnh đang hiện) chết → câm / mất hình / sự kiện `error` → modal "file hỏng".
- `rematerializeBlob()` (service/db.js) chỉ cứu được các lần **đọc sau** (URL mới), không cứu URL đang dùng —
  đã chứng minh qua bug Game mode (05/10/2026): Song câm khi phát lại, Video mất hình.
- Reset app thì bình thường (dữ liệu trên đĩa đúng, chỉ URL trong phiên chết).

### 0.2 Các chỗ đang dính (🔴 = chỉ sửa field thường mà ghi lại cả Blob)

| # | Chức năng | Loại | Hàm | `rematerializeBlob` |
|---|---|---|---|---|
| 1 | Sửa thông tin | Song | `core/playlist/actions.js::applySongEditAndSave` | có (`blob`, `cover`) |
| 2 | Sửa thông tin | Video | `core/playlist/actions.js::applyVideoEditAndSave` | có, **sót `thumbFullBlob`** |
| 3 | Sửa thông tin | Photo | `core/playlist/actions.js::applyPhotoEditAndSave` | có |
| 4 | Lưu phụ đề | Song | `event/workflow/subtitle-editor.js::saveToDatabase` | có `blob`, **sót `cover`** |
| 5 | Thêm vào folder | 3 loại | `core/file-manager/folder.js::addSongsToFolder` | **không** |
| 6 | Xoá folder (gỡ field mọi item) | 3 loại | `core/file-manager/folder.js::deleteFolder` | **không** |
| 7 | Dọn field folder mồ côi | Song | `core/file-manager/cleanup.js::cleanupOrphanedSongFolderFields` | **không** |
| 8 | Đổi tên video | Video | `core/file-manager/video.js::setVideoCustomName` | **không** |
| 9 | Lưu điểm Game | 3 loại | `event/workflow/gameplay-engine.js::persistScore` | có (bản lỗi 05/10) |

Kịch bản nghi cùng lỗi (chưa xác minh trên máy): thêm bài đang phát vào folder, lưu phụ đề / sửa info bài đang phát,
xoá folder chứa bài đang phát.

### 0.3 Lỗi trùng key thống kê
`mediaStatsMap` / `meta.songStats` dùng **key trần** (không phân loại media). Key sinh bằng `slugify()` — **bỏ đuôi file**
→ `Bài A.mp3` (Song) và `Bài A.mp4` (Video) cùng key `bai-a` → **lượt nghe + thời gian nghe đang cộng chung**
(sort / filter / bảng Statistics sai). Bài hát + MV cùng tên là trường hợp rất phổ biến.

### 0.4 Vì sao `songStats` từng tách ra
Header `core/listen-stats.js`: record chứa Blob → ghi lại mỗi vài giây để cập nhật `totalTime` quá nặng.
Sau khi (A) tách Blob, record meta nhẹ → lý do này hết → (B) khả thi.

---

## 1. Mục tiêu / Ngoài phạm vi

**Mục tiêu**
1. Bất biến: **Blob chỉ ghi khi tạo mới hoặc khi nội dung thật sự đổi.** Sửa dữ liệu thường không bao giờ chạm Blob.
2. Xoá hẳn lớp lỗi round-trip → gỡ `rematerializeBlob()` ở mọi đường ghi.
3. Thống kê + điểm Game nằm trong bản ghi meta của từng media: xoá item là xoá luôn, hết trùng key giữa 3 loại.
4. Dữ liệu cũ chuyển 1 lần, an toàn, làm lại được nếu bị ngắt.

**Ngoài phạm vi**
- Đổi cách sinh key (`slugify`) — giữ nguyên.
- `totalListenSeconds` (tổng toàn app) — giữ ở `meta`.
- Store `folders` / `folder_song` / `languages` — không đổi.
- Store mồ côi `albums` / `documents` — giữ nguyên chính sách "không xoá cứng".

---

## 2. Thiết kế dữ liệu

### 2.1 Store sau khi tách (`DB_VERSION` 5 → 6)

| Store | Chứa | Key |
|---|---|---|
| `songs` / `videos` / `images` | **CHỈ** dữ liệu thường (không Blob) | key media (như cũ) |
| `media_blobs` (MỚI) | mỗi Blob là 1 entry riêng | **array key** `[type, key, field]` |

`type` ∈ `song` / `video` / `photo`. Array key cho phép xoá/đọc theo khoảng `[type, key]` bằng `IDBKeyRange.bound([type, key], [type, key, '\uffff'])`.

**Field Blob mỗi loại** (hằng số `MEDIA_BLOB_FIELDS` trong service/db.js — nguồn sự thật DUY NHẤT):

| Loại | Field |
|---|---|
| song | `blob`, `cover` |
| video | `blob`, `thumbBlob`, `thumbFullBlob` |
| photo | `blob`, `thumbBlob` |

Mỗi field 1 entry riêng → fix thumbnail video **không** chạm `blob` video (đang phát vẫn an toàn).

### 2.2 Bản ghi meta — field mới

| Field | Kiểu | Ghi chú |
|---|---|---|
| `schema` | `2` | đánh dấu đã chuyển; record thiếu field này = dạng cũ (Blob còn bên trong) |
| `stats` | `{ count, totalTime }` | thay `meta.songStats[key]` |
| `game` | `{ [mode]: { [difficulty]: [{time, score}] } }` | Song đã có sẵn field này; Video/Photo mới có |

Mọi field cũ giữ nguyên tên (`filename`, `tag`, `subtitles`, `folder`, `customName`, `album`, `duration`, `width`, `height`, `addedAt`, `thumbFullBlack`...).

### 2.3 Bất biến

- **Create**: ghi meta + mọi Blob trong **1 transaction** (2 store).
- **Update meta**: read-modify-write chỉ store meta; hàm ghi tự **gạt bỏ field Blob** nếu lọt vào (phòng thủ).
- **Update Blob**: chỉ ghi đúng field truyền vào.
- **Delete**: xoá meta + mọi entry `[type, key, *]` trong 1 transaction.

---

## 3. API mới — `service/db.js`

### 3.1 Hạ tầng
- `makeMultiStoreAccessor(storeNames)` — transaction nhiều store, cùng cơ chế tự mở lại connection + retry 1 lần như `makeStoreAccessor()`.
- `MEDIA_STORE_BY_TYPE = { song: 'songs', video: 'videos', photo: 'images' }`.
- Lưu ý kỹ thuật: transaction IndexedDB **tự commit khi await promise ngoài IDB** → mọi `arrayBuffer()` / đọc file phải xong **trước** khi mở transaction ghi.

### 3.2 Đọc

| Hàm | Ghi chú |
|---|---|
| `getSongRecord` / `getVideoRecord` / `getImageRecord` | **giữ chữ ký** — đọc gộp meta + Blob trong 1 transaction; record dạng cũ trả nguyên (Blob đã ở trong) |
| `get*RecordsByKeys`, `getAll*Records` | **giữ chữ ký**, đọc gộp |
| `getMediaMeta(type, key)` / `getAllMediaMeta(type)` | MỚI — chỉ meta (boot nạp stats, không mở Blob) |
| `getMediaBlob(type, key, field)` | MỚI — đọc 1 Blob |

→ khoảng 60 chỗ đọc ở khoảng 25 file **không phải sửa**.

### 3.3 Ghi

| Hàm | Dùng cho |
|---|---|
| `createMediaRecord(type, key, record)` | tạo mới: tự tách field Blob theo `MEDIA_BLOB_FIELDS` |
| `updateMediaMeta(type, key, mutate)` | sửa dữ liệu thường; record dạng cũ → **chuyển record đó trước** (mục 4.4) rồi mới sửa |
| `updateMediaMetaBatch([{type, key, mutate}])` | flush thống kê, xoá folder, dọn mồ côi — 1 transaction nhiều store |
| `setMediaBlobs(type, key, { field: Blob })` | đổi nội dung thật (sửa ảnh, fix thumbnail, thay file) |
| `deleteMediaRecord(type, key)` | xoá meta + mọi Blob |

`set*Record` / `delete*Record` cũ: **xoá hẳn** sau Lượt 2 (đường ghi cũ còn sót sẽ lỗi ngay lúc chạy, không lặng lẽ tái tạo bug).
`delete*Record` có thể giữ làm alias mỏng gọi `deleteMediaRecord` nếu ít rủi ro hơn — Giang chốt.

`rematerializeBlob()`: gỡ khỏi 6 đường ghi; **giữ** 2 chỗ chỉ để decode trong Subtitle editor (`_initWaveform`, `_decodeKaraokeSourceHiRes`) — không liên quan ghi.

---

## 4. Chuyển dữ liệu (1 lần, lúc boot)

### 4.1 Điều kiện + thời điểm
- Chạy khi `meta.mediaSchemaVersion < 2`.
- Trong `event/workflow/app-boot.js`: **sau** `loadConfig()` / `migrateFolderIndexIfNeeded()`, **trước** `loadSongStats()`, trước khi nạp Playlist,
  trước bất kỳ media nào phát → không có URL nào đang dùng để làm chết.
- Hiện `withLoadingShield` có tiến độ `x/tổng` (preloader đang che sẵn, chỉ cần đổi chữ).
- Chỉ chạy ở `index.html`. `subtitle-editor.html` không chạy (xem 4.4).

### 4.2 Từng record (làm lại được)
Cho mỗi `type`, mỗi record **thiếu `schema: 2`**:
1. Ngoài transaction: lấy các Blob theo `MEDIA_BLOB_FIELDS` (xem 4.3 về cách lấy).
2. 1 transaction `readwrite` [store meta, `media_blobs`]:
   `put` từng Blob vào `[type, key, field]` → `put` meta (bỏ field Blob, gắn `schema: 2`, gắn `stats`/`game` từ 4.5).
3. Lỗi ở record nào → ghi log + để nguyên dạng cũ (đọc gộp vẫn đọc được), lần boot sau chạy lại.

Ghi tiến độ vào `meta.mediaMigrationProgress` (để log/resume), xong hết → `meta.mediaSchemaVersion = 2` → **`location.reload()`**
(mở connection IndexedDB mới, dứt điểm mọi Blob handle round-trip trong phiên).

### 4.3 Cách lấy Blob để ghi sang store mới — **cần chốt (mục 11)**

| Phương án | Cách | Ưu | Nhược |
|---|---|---|---|
| **H — Blob handle gốc + reload** | `put` thẳng Blob vừa đọc | không tốn RAM, nhanh | đúng kiểu round-trip; an toàn chỉ nhờ không có gì phát + reload ngay sau |
| **R — vật chất hoá** | `new Blob([await blob.arrayBuffer()])` | Blob tách hẳn file cũ | RAM đỉnh = cỡ file; video vài trăm MB trên iPhone có thể sập tab |

Đề xuất: **H**, kèm R cho file < 50 MB nếu thử máy thấy H không ổn. **Bắt buộc thử trên iPhone với bản sao thư viện thật** trước khi phát hành.

Quota: mỗi record tạm 2 bản trong lúc transaction chưa commit → đỉnh tăng thêm ~1 file lớn nhất.

### 4.4 Record dạng cũ gặp ngoài lượt chuyển
`updateMediaMeta()` thấy record thiếu `schema: 2` → chạy đúng bước 4.2 cho riêng record đó rồi mới sửa.
Áp cho `subtitle-editor.html` (mở trước khi index chuyển xong) và record lỗi ở lượt boot trước.
Rủi ro: record đó **đang phát** ở trang index → giữ quy tắc chung, xem mục 7 (nạp lại nguồn).

### 4.5 Gộp thống kê + điểm Game cũ
- `meta.songStats` (key trần): với mỗi key, tra 3 store:
  - có ở **1** store → gán `stats` vào record đó;
  - có ở **nhiều** store → số liệu đã cộng lẫn từ trước, không tách lại được → **gán cho Song** (đề xuất) + log danh sách key trùng;
  - không có ở store nào → bỏ (mồ côi) + log.
- `record.game` của Song: đã nằm trong meta → **không cần chuyển**.
- `meta.gameScores` (nếu làm Lượt 0): gộp vào `record.game` đúng loại, rồi xoá key.
- Xong: đổi tên `meta.songStats` → `meta.songStats_legacy` (giữ 1 phiên bản để phòng hoàn tác), xoá ở bản sau.

---

## 5. Đổi chỗ ghi (18 chỗ, 11 file)

| Loại | Chức năng | File::hàm | API mới |
|---|---|---|---|
| C | Upload bài | `event/workflow/playlist.js` (vòng upload) | `createMediaRecord('song')` |
| C | Ghi âm | `event/workflow/playlist.js::addRecordedSong` | `createMediaRecord('song')` |
| C | Cắt đoạn thành bài mới | `event/workflow/subtitle-editor.js::_insertCutBlobAsNewSong` | `createMediaRecord('song')` |
| C | Upload video | `core/file-manager/video.js::saveVideo` | `createMediaRecord('video')` |
| C | Upload ảnh / Lưu thành ảnh mới | `core/file-manager/image.js::saveImage` | `createMediaRecord('photo')` |
| 🔴 | Sửa thông tin Song | `core/playlist/actions.js::applySongEditAndSave` | `updateMediaMeta` (+ `setMediaBlobs({cover})` nếu đổi cover) |
| 🔴 | Sửa thông tin Video | `core/playlist/actions.js::applyVideoEditAndSave` | `updateMediaMeta` |
| 🔴 | Sửa thông tin Photo | `core/playlist/actions.js::applyPhotoEditAndSave` | `updateMediaMeta` |
| 🔴 | Lưu phụ đề | `event/workflow/subtitle-editor.js::saveToDatabase` | `updateMediaMeta` |
| 🔴 | Thêm vào folder | `core/file-manager/folder.js::addSongsToFolder` | `updateMediaMetaBatch` |
| 🔴 | Xoá folder | `core/file-manager/folder.js::deleteFolder` | `updateMediaMetaBatch` |
| 🔴 | Dọn folder mồ côi | `core/file-manager/cleanup.js::cleanupOrphanedSongFolderFields` | `updateMediaMetaBatch` |
| 🔴 | Đổi tên video | `core/file-manager/video.js::setVideoCustomName` | `updateMediaMeta` |
| 🔴 | Điểm Game | `event/workflow/gameplay-engine.js::persistScore` | `updateMediaMeta` |
| 🟡 | Upload ghi đè (giữ phụ đề) | `event/workflow/playlist.js` (vòng upload) | `setMediaBlobs` + `updateMediaMeta` |
| 🟡 | Sửa ảnh ghi đè | `core/file-manager/image.js::updateImageBlob` | `setMediaBlobs` + `updateMediaMeta` (width/height/duration) |
| 🟡 | Scan & fix thumbnail | `core/file-manager/video.js::setVideoThumbnails` | `setMediaBlobs({thumbBlob, thumbFullBlob})` + `updateMediaMeta` (thumbFullBlack) |
| 🟡 | Thay file video | `core/file-manager/video.js::replaceVideoMedia` | `setMediaBlobs` + `updateMediaMeta` |

**Delete**: các đường xoá hiện tại (`playlist.js` bảng theo loại, `executePlaybackErrorDelete`, `storage-manager.js::deleteCorrupted*` / `clearAll*Data`,
`file-manager-storage.js::clearAllStoredData`, `image.js::deleteImage`) đổi sang `deleteMediaRecord`. Hàm "xoá toàn bộ 1 loại" dùng
`clear()` store meta + xoá khoảng `[type]` trong `media_blobs`.

**Rule core** (core-function-conventions.md): `core/file-manager/*` và `core/playlist/actions.js` vẫn gọi data layer như hiện nay
(ngoại lệ Rule 3 đã có). `mutate` truyền vào `updateMediaMeta` phải thuần (không gọi core khác).

---

## 6. Thống kê — mức 2 (key RAM `type:key`)

### 6.1 `core/listen-stats.js` (viết lại phần lưu)
- `mediaStatsKey(type, key)` → `'song:bai-a'`; mọi API nhận `(type, key)`.
- `loadSongStats()` → đọc `getAllMediaMeta(type)` × 3 → dựng `mediaStatsMap`.
- `bumpSongPlayCount(type, key)` / `addSongListenTime(type, key, seconds)`: RAM như cũ + thêm vào `Set` key bẩn.
- `flushSongStats()`: throttle 4s **giữ nguyên**; ghi `updateMediaMetaBatch` cho đúng các key bẩn (thường 1).
- `removeSongStats()` → chỉ còn xoá RAM (`forgetMediaStats(type, key)`), không ghi DB (xoá record đã xoá stats).
- `clearAllSongStats()` → `updateMediaMetaBatch` bỏ `stats` mọi record 3 loại (có tiến độ) + xoá RAM.
- `service/state/listen-stats.js`: `_songStatsDirty` (boolean) → `_mediaStatsDirtyKeys` (Set) hoặc giữ biến module — Giang chốt.

### 6.2 Chỗ gọi

| Nhóm | File |
|---|---|
| Ghi (thêm `type`) | `event/workflow/player.js`, `event/workflow/video-player.js`, `event/workflow/photo-player.js`, `event/workflow/file-manager-photo.js`, `core/player-controls.js` (listen clock, 3 chỗ) |
| Xoá (gỡ / đổi `forgetMediaStats`) | `core/playlist/actions.js` (2), `core/playlist/bulk-actions.js` (2), `event/workflow/playlist.js` (5) |
| Đọc (đổi sang `type:key`) | `core/playlist/order.js`, `core/playlist/filter.js`, `event/workflow/playlist-order.js`, `event/workflow/playlist-scope.js`, `event/workflow/playlist.js`, `core/playlist/actions.js`, `components/statis-panel.js`, `core/statis-panel-ui.js`, `event/workflow/statis-panel.js`, `event/workflow/file-manager-photo.js`, `event/workflow/photo-player.js`, `event/workflow/video-player.js` |
| Boot / unload / Storage | `event/workflow/app-boot.js`, `core/app-cleanup.js`, `event/workflow/file-manager-storage.js` |

Nơi đọc theo Playlist lấy `type` từ `activeMediaSource`; Statistics đã tách sẵn theo 3 loại.

---

## 7. Media đang dùng + ghi Blob (🟡)

Với bất biến mới, chỉ 🟡 còn có thể làm chết URL đang dùng, và chỉ khi **đúng field đang được dùng** đổi:

| Thao tác | Field đổi | Đang dùng ở đâu | Xử lý |
|---|---|---|---|
| Upload ghi đè bài đang phát | `blob` | `audioPlayer` | nạp lại nguồn từ Blob mới (giữ vị trí nếu được) |
| Thay file video đang phát | `blob` | `bgVideoElement` | dừng + nạp lại qua luồng Video Player |
| Sửa ảnh đang hiện (Photo Player / VBG) | `blob`, `thumbBlob` | image surface | vẽ lại ảnh hiện tại |
| Fix thumbnail video đang phát | thumb | ảnh tĩnh nền | không ảnh hưởng video; làm tươi ảnh tĩnh |

Có thể gom vào 1 hàm Workflow `refreshInUseMediaIfAffected(type, key, fields)` — Giang chốt vị trí.

---

## 8. Lượt thực hiện

| Lượt | Nội dung | Phát hành? |
|---|---|---|
| **0** (hotfix) | Gỡ phần vật chất hoá Blob ở `persistScore()` (đang làm Video mất hình); tạm lưu điểm Game vào `meta.gameScores` (Lượt 1 gộp vào record). | Có — ngay |
| **1** | `service/db.js`: v6, `media_blobs`, accessor nhiều store, API mục 3, đọc gộp hỗ trợ dạng cũ; module chuyển dữ liệu (mục 4) + gắn vào boot + reload. | **Không** (phát hành chung Lượt 2) |
| **2** | Đổi 18 chỗ ghi (mục 5), đổi đường xoá, gỡ `set*Record` cũ + 6 chỗ `rematerializeBlob`; mục 7. | Có — cùng Lượt 1 |
| **3** | Thống kê mức 2 (mục 6). | Có |
| **4** | Sửa lỗi sau thử máy; cập nhật readme (`folder-structure.md`, `where-to-edit.md`, docstring đầu `service/db.js`, `core/listen-stats.js`). | Có |

Lượt 1 + 2 phải đi cùng: nếu chỉ có Lượt 1, đường ghi cũ (`set*Record`) sẽ ghi Blob ngược vào store meta.

---

## 9. Kiểm thử (iPhone, không DevTools — log qua Debug console)

**Chuyển dữ liệu**
- [ ] Bản sao thư viện thật (Song + Video lớn + Photo): chuyển xong, reload, mọi item phát / hiện đúng.
- [ ] Tắt app giữa lượt chuyển → mở lại → chạy tiếp, không mất / không nhân đôi.
- [ ] Mở `subtitle-editor.html` **trước** khi index chuyển: đọc / lưu phụ đề được.
- [ ] Storage Management: dung lượng trước / sau gần bằng nhau (không còn bản thừa sau khi xong).
- [ ] Log key thống kê trùng / mồ côi hiện trong Debug console.

**Lỗi cũ phải hết**
- [ ] Game mode: hết bài → về Playlist → phát lại đúng bài (Song, Video); nút Replay.
- [ ] Thêm bài đang phát vào folder; xoá folder chứa bài đang phát.
- [ ] Lưu phụ đề / sửa info bài đang phát → tiếp tục phát, Next / Prev rồi quay lại.
- [ ] Sửa tên video đang phát; Scan & fix thumbnail khi video đó đang phát.

**Thống kê**
- [ ] `Bài A.mp3` + `Bài A.mp4`: đếm riêng.
- [ ] Sort / filter theo lượt nghe, thời gian nghe đúng sau reload.
- [ ] Xoá item → không còn trong Statistics; "Xoá thống kê" xoá hết cả 3 loại.
- [ ] Đóng app giữa chừng: thời gian nghe gần nhất (≤ 4s) được ghi qua flush lúc unload.

**Khác**
- [ ] Export file đơn, zip toàn bộ; quét file hỏng; xoá file hỏng; Clear all.
- [ ] Restore default settings không đụng thư viện / thống kê.

---

## 10. Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Mất dữ liệu khi chuyển | Cao | mỗi record 1 transaction nguyên tử; lỗi → giữ dạng cũ; thử với bản sao trước |
| Sập tab vì RAM (phương án R) | Cao | ưu tiên H; R chỉ cho file nhỏ |
| H vẫn dính round-trip trên WebKit | Trung bình | không gì phát trong lúc chuyển + reload ngay; thử máy bắt buộc |
| Vượt quota giữa chừng | Trung bình | chuyển từng record; báo lỗi rõ + dừng, lần boot sau tiếp |
| Sót 1 đường ghi cũ | Trung bình | xoá hẳn `set*Record` → lỗi lộ ngay khi chạy |
| Boot lần đầu sau update lâu | Thấp | chỉ 1 lần, có tiến độ |
| Gán nhầm thống kê key trùng | Thấp | số liệu đã lẫn từ trước; log để Giang biết |

---

## 11. Cần Giang chốt

1. `media_blobs` 1 store chung (array key) — hay 3 store riêng (`song_blobs`, ...)?
2. Cách lấy Blob khi chuyển: **H** (handle gốc + reload) hay **R** (vật chất hoá) — hay H + R cho file nhỏ?
3. Thống kê key trùng nhiều loại: gán cho Song?
4. Giữ `meta.songStats_legacy` bao lâu (đề xuất: 1 phiên bản)?
5. `set*Record` / `delete*Record` cũ: xoá hẳn hay giữ alias?
6. Trạng thái key thống kê bẩn: đưa vào `service/state` hay biến module trong `core/listen-stats.js`?
7. Vị trí hàm nạp lại media đang dùng (mục 7).
8. Có cần nút "Chạy lại chuyển dữ liệu" trong Settings > Troubleshooting không?
9. Làm **Lượt 0** (hotfix Game mode) ngay?
