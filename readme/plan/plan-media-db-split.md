# Plan — Tách Blob khỏi bản ghi media + gộp thống kê vào meta media

> Đặt tại `readme/plan-media-db-split.md`. Trạng thái: **ĐÃ DUYỆT (06/10/2026)** — đang làm theo mục 8.
> Phạm vi: 2 việc gộp chung 1 dự án vì dùng chung 1 lần chuyển dữ liệu:
> **(A)** tách Blob ra store riêng theo từng loại media (mục 2.1); **(B)** đưa `songStats` (+ điểm Game) vào bản ghi meta của từng media.

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

### 0.5 Giang chốt (06/10/2026)
- **Giữ IndexedDB** — không chuyển Blob sang OPFS (đã cân nhắc OPFS, bỏ).
- **Mỗi loại media có 3 store riêng: meta / media blob / thumb blob** (Song, Video, Photo → 9 store, xem mục 2.1).
- **Không chuyển dữ liệu cũ, không xử lý gộp gì cả** ("xoá đi cài lại là xong") — nâng `DB_VERSION` thì xoá thẳng
  store cũ, không modal, không cảnh báo (mục 4). Bỏ toàn bộ phần chuyển dữ liệu / H-R / record dạng cũ / gộp thống kê cũ.
- **(B) thống kê + điểm Game vào meta: làm cùng đợt.**
- Liên quan (đã làm): mỗi file media tối đa **500MB** — cả upload lẫn media app tự tạo (ghi âm, cắt đoạn, xuất video,
  sửa ảnh, chụp khung hình); zip > 500MB tự chia nhiều phần, modal tải hiện từng phần.

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

| Loại | Meta (dữ liệu thường, KHÔNG Blob) | Media blob (file chính) | Thumb blob (ảnh nhỏ) |
|---|---|---|---|
| song | `songs` | `song_blobs` | `song_thumbs` — field `cover` |
| video | `videos` | `video_blobs` | `video_thumbs` — field `thumbBlob`, `thumbFullBlob` |
| photo | `images` | `image_blobs` | `image_thumbs` — field `thumbBlob` |

**Key** (Giang chốt 06/10/2026 — KHÔNG dùng array key): **cả 3 store dùng chung key media như hiện nay** (chuỗi
`slugify()`), mỗi media đúng 1 entry mỗi store.
- media blob: value = Blob file chính.
- thumb blob: value = **object chứa mọi thumb của media đó** (`{ cover }` / `{ thumbBlob, thumbFullBlob }` / `{ thumbBlob }`).
  Bất biến: luôn ghi **cả object với Blob MỚI** — không bao giờ đọc thumb lên rồi ghi lại (đúng lớp lỗi round-trip).
  Thực tế đã khớp: fix thumbnail / thay file video luôn tạo lại cả 2 thumb; Song chỉ có `cover`; Photo chỉ có `thumbBlob`.

Danh sách field thumb mỗi loại: hằng số `THUMB_FIELDS_BY_TYPE` trong service/db.js — nguồn sự thật DUY NHẤT.

(Bản nháp trước đặt 1 store `media_blobs` chung cho cả 3 loại với key `[type, key, field]` — đã thay bằng bảng trên.)

### 2.2 Bản ghi meta — field mới

| Field | Kiểu | Ghi chú |
|---|---|---|
| `stats` | `{ count, totalTime }` | thay `meta.songStats[key]` |
| `game` | `{ [mode]: { [difficulty]: [{time, score}] } }` | Song đã có sẵn field này; Video/Photo mới có |

Mọi field cũ giữ nguyên tên (`filename`, `tag`, `subtitles`, `folder`, `customName`, `album`, `duration`, `width`, `height`, `addedAt`, `thumbFullBlack`...).

### 2.3 Bất biến

- **Create**: ghi meta + media blob + mọi thumb của loại đó trong **1 transaction** (3 store).
- **Update meta**: read-modify-write chỉ store meta; hàm ghi tự **gạt bỏ field Blob** nếu lọt vào (phòng thủ).
- **Update Blob**: chỉ ghi đúng store/field truyền vào (file chính hoặc từng thumb).
- **Delete**: xoá entry `key` ở cả 3 store trong 1 transaction.

---

## 3. API mới — `service/db.js`

### 3.1 Hạ tầng
- `makeMultiStoreAccessor(storeNames)` — transaction nhiều store, cùng cơ chế tự mở lại connection + retry 1 lần như `makeStoreAccessor()`.
- `MEDIA_STORES_BY_TYPE = { song: { meta: 'songs', blob: 'song_blobs', thumb: 'song_thumbs' }, video: {...}, photo: {...} }`.
- `THUMB_FIELDS_BY_TYPE = { song: ['cover'], video: ['thumbBlob', 'thumbFullBlob'], photo: ['thumbBlob'] }`.
- Lưu ý kỹ thuật: transaction IndexedDB **tự commit khi await promise ngoài IDB** → mọi `arrayBuffer()` / đọc file phải xong **trước** khi mở transaction ghi.

### 3.2 Đọc

| Hàm | Ghi chú |
|---|---|
| `getSongRecord` / `getVideoRecord` / `getImageRecord` | **giữ chữ ký** — đọc gộp meta + blob + thumb trong 1 transaction, trả record đúng hình dạng cũ |
| `get*RecordsByKeys`, `getAll*Records` | **giữ chữ ký**, đọc gộp |
| `getMediaMeta(type, key)` / `getAllMediaMeta(type)` | MỚI — chỉ meta (boot nạp stats, không mở Blob) |
| `getMediaBlob(type, key)` / `getMediaThumb(type, key, field)` | MỚI — đọc riêng file chính / 1 thumb |

→ khoảng 60 chỗ đọc ở khoảng 25 file **không phải sửa**.

### 3.3 Ghi

| Hàm | Dùng cho |
|---|---|
| `createMediaRecord(type, key, record)` | tạo mới: tự tách `blob` + field thumb theo `THUMB_FIELDS_BY_TYPE` |
| `updateMediaMeta(type, key, mutate)` | sửa dữ liệu thường |
| `updateMediaMetaBatch([{type, key, mutate}])` | flush thống kê, xoá folder, dọn mồ côi — 1 transaction nhiều store |
| `setMediaBlob(type, key, blob)` | đổi file chính (sửa ảnh, thay file video, upload ghi đè) |
| `setMediaThumbs(type, key, thumbs)` | đổi thumb (fix thumbnail, đổi cover) — `thumbs` PHẢI đủ mọi field của loại đó, toàn Blob mới (guard) |
| `deleteMediaRecord(type, key)` | xoá meta + mọi Blob |

`set*Record` / `delete*Record` cũ: **xoá hẳn** (Giang chốt 06/10/2026, không alias) — đường ghi cũ còn sót sẽ lỗi ngay
lúc chạy. Mọi chỗ đổi sang API mới phải **tuân core rule + event bus**: hàm core bị đụng mà đang tự gọi hàm ĐỌC của
service/db.js (`get*Record`, `getAll*Keys` — vi phạm Rule 3, nợ cũ ở `core/playlist/actions.js`, `core/file-manager/*`,
`core/storage-manager.js`...) thì dời phần đọc lên Workflow, core nhận record qua tham số; core chỉ còn gọi hàm GHI.

`rematerializeBlob()`: gỡ khỏi 6 đường ghi; **giữ** 2 chỗ chỉ để decode trong Subtitle editor (`_initWaveform`, `_decodeKaraokeSourceHiRes`) — không liên quan ghi.

---

## 4. Nâng cấp DB — KHÔNG chuyển dữ liệu (Giang chốt 06/10/2026)

`onupgradeneeded` khi `oldVersion < 6`: **xoá thẳng** store `songs` / `videos` / `images` cũ (đang chứa Blob) rồi tạo
lại đủ 9 store của mục 2.1; xoá luôn các key thống kê cũ trong `meta` (`songStats`, `gameScores` nếu có). Không modal,
không cảnh báo — máy chưa xoá app sẽ mất thư viện cũ (Giang chấp nhận: "xoá đi cài lại là xong"). Các store khác
(`meta` còn lại, `folders`, `folder_song`, `languages`...) giữ nguyên; field folder của media cũ mất theo store.

---

## 5. Đổi chỗ ghi (18 chỗ, 11 file)

| Loại | Chức năng | File::hàm | API mới |
|---|---|---|---|
| C | Upload bài | `event/workflow/playlist.js` (vòng upload) | `createMediaRecord('song')` |
| C | Ghi âm | `event/workflow/playlist.js::addRecordedSong` | `createMediaRecord('song')` |
| C | Cắt đoạn thành bài mới | `event/workflow/subtitle-editor.js::_insertCutBlobAsNewSong` | `createMediaRecord('song')` |
| C | Upload video | `core/file-manager/video.js::saveVideo` | `createMediaRecord('video')` |
| C | Upload ảnh / Lưu thành ảnh mới | `core/file-manager/image.js::saveImage` | `createMediaRecord('photo')` |
| 🔴 | Sửa thông tin Song | `core/playlist/actions.js::applySongEditAndSave` | `updateMediaMeta` (+ `setMediaThumbs({cover})` nếu đổi cover) |
| 🔴 | Sửa thông tin Video | `core/playlist/actions.js::applyVideoEditAndSave` | `updateMediaMeta` |
| 🔴 | Sửa thông tin Photo | `core/playlist/actions.js::applyPhotoEditAndSave` | `updateMediaMeta` |
| 🔴 | Lưu phụ đề | `event/workflow/subtitle-editor.js::saveToDatabase` | `updateMediaMeta` |
| 🔴 | Thêm vào folder | `core/file-manager/folder.js::addSongsToFolder` | `updateMediaMetaBatch` |
| 🔴 | Xoá folder | `core/file-manager/folder.js::deleteFolder` | `updateMediaMetaBatch` |
| 🔴 | Dọn folder mồ côi | `core/file-manager/cleanup.js::cleanupOrphanedSongFolderFields` | `updateMediaMetaBatch` |
| 🔴 | Đổi tên video | `core/file-manager/video.js::setVideoCustomName` | `updateMediaMeta` |
| 🔴 | Điểm Game | `event/workflow/gameplay-engine.js::persistScore` | `updateMediaMeta` |
| 🟡 | Upload ghi đè (giữ phụ đề) | `event/workflow/playlist.js` (vòng upload) | `setMediaBlob` + `setMediaThumbs({cover})` + `updateMediaMeta` |
| 🟡 | Sửa ảnh ghi đè | `core/file-manager/image.js::updateImageBlob` | `setMediaBlob` + `setMediaThumbs({thumbBlob})` + `updateMediaMeta` (width/height/duration) |
| 🟡 | Scan & fix thumbnail | `core/file-manager/video.js::setVideoThumbnails` | `setMediaThumbs({thumbBlob, thumbFullBlob})` + `updateMediaMeta` (thumbFullBlack) |
| 🟡 | Thay file video | `core/file-manager/video.js::replaceVideoMedia` | `setMediaBlob` + `setMediaThumbs` + `updateMediaMeta` |

**Delete**: các đường xoá hiện tại (`playlist.js` bảng theo loại, `executePlaybackErrorDelete`, `storage-manager.js::deleteCorrupted*` / `clearAll*Data`,
`file-manager-storage.js::clearAllStoredData`, `image.js::deleteImage`) đổi sang `deleteMediaRecord`. Hàm "xoá toàn bộ 1 loại" dùng
`clear()` cả 3 store của loại đó (meta, blob, thumb).

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
- `service/state/listen-stats.js`: `_songStatsDirty` (boolean) → `mediaStatsDirtyKeys` (Set key `type:key`) — **nằm trong
  state** (Giang chốt 06/10/2026), ghi qua `appState.mutate()` kèm log (Rule 4; lượt ghi mỗi giây dùng `skipCheck` như cũ).

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

**Giang chốt (06/10/2026) — 1 "request trung tâm", tuân core rule + event bus:**
- Nơi quản lý thao tác thay file (Workflow upload / Video editor / Sửa ảnh / Fix thumbnail) ghi DB xong thì CHỈ bắn
  `eventBus.send({ router: 'mediaInUse', type: 'mediaInUse.contentReplaced', payload: { type, key } })` — không tự kiểm
  tra ai đang dùng, không tự nạp lại gì.
- Router `mediaInUse` (event/router/media-in-use.js) giao cho `workflowMediaInUse.handleContentReplaced(type, key)`
  (event/workflow/media-in-use.js). Workflow này TỰ đọc state để biết media đó đang được dùng ở đâu — phát chính
  (Song: `currentKey` + nguồn Song; Player Video; Photo Player), đang chạy làm Visual Background (VBG Video/Photo),
  node trong Playlist (cover/thumb) — rồi TỰ quyết định xử lý: gọi đúng hàm nạp lại của workflow chủ quản (nạp nguồn
  mới từ DB, giữ vị trí phát + trạng thái phát/dừng; ảnh thì vẽ lại). Rẽ nhánh theo state bằng object map /
  `VirtualMachineState` (event-bus-flow.md mục 7/7a) — không if/else nghiệp vụ.
- Media không được dùng ở đâu -> không làm gì.


---

## 8. Lượt thực hiện

| Lượt | Nội dung |
|---|---|
| **1** | `service/db.js`: v6 + 9 store (mục 2.1, 4), accessor nhiều store, API mục 3. |
| **2** | Đổi 18 chỗ ghi (mục 5), đổi đường xoá, gỡ `set*Record` cũ + 6 chỗ `rematerializeBlob`; mục 7. |
| **3** | Thống kê + điểm Game vào meta (mục 6). |
| **4** | Sửa lỗi sau thử máy; cập nhật readme (`folder-structure.md`, `where-to-edit.md`, docstring đầu `service/db.js`, `core/listen-stats.js`). |

Lượt 1 + 2 + 3 **phát hành chung 1 lần** (Giang chốt làm cùng đợt; Lượt 1 đứng riêng thì đường ghi cũ ghi Blob ngược vào
store meta). Bỏ Lượt 0 (hotfix Game mode) — Lượt 2 sửa tận gốc.

---

## 9. Kiểm thử (iPhone, không DevTools — log qua Debug console)

**Nâng cấp / cài mới**
- [ ] Cài mới: upload Song + Video + Photo → phát / hiện đúng; Storage Management đếm đúng dung lượng.
- [ ] Máy còn DB v5: mở bản mới → thư viện rỗng, app chạy bình thường, Settings giữ nguyên.
- [ ] Mở `subtitle-editor.html`: đọc / lưu phụ đề / chèn đoạn cắt được.

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
| Máy chưa xoá app mất thư viện khi lên v6 | Đã chấp nhận | Giang chốt không chuyển dữ liệu |
| Sót 1 đường ghi cũ | Trung bình | xoá hẳn `set*Record` → lỗi lộ ngay khi chạy |
| Transaction tự commit giữa chừng | Trung bình | mọi `await` ngoài IDB (đọc file, `arrayBuffer()`) xong TRƯỚC khi mở transaction ghi |
| Thay file đang phát làm chết URL | Thấp | mục 7 |

---

## 11. Cần Giang chốt

Đã chốt (06/10/2026): Blob tách theo từng loại, 3 store/loại; không chuyển dữ liệu, xoá store cũ; (B) làm cùng đợt; bỏ
H/R, `songStats_legacy`, nút chạy lại chuyển dữ liệu, Lượt 0.

Chốt thêm (06/10/2026): key cả 3 store = key media, thumb là 1 object/media (mục 2.1); `set*Record`/`delete*Record`
xoá hẳn, tuân core rule + event bus (mục 3.3); key thống kê bẩn nằm trong state (mục 6.1).

Chốt cuối (06/10/2026): Giang **duyệt plan**; mục 7 = request trung tâm `mediaInUse` (bắn type + key, trung tâm tự
kiểm state + tự xử lý). Không còn điểm nào chờ chốt.

### Tiến độ giao patch (không deploy riêng lẻ — chỉ deploy khi đủ Lượt 1 + 2 + 3)
- [x] Lượt 1 — `service/db.js` v6, 9 store, API mục 3 (sav-13-db-split-1-patch.zip).
- [x] Lượt 2a — mọi chỗ ghi/xoá sang API mới + dời phần đọc khỏi core bị đụng (Rule 3b) (sav-13-db-split-2a-patch.zip):
  `resolveVideoKey`/`resolveImageKey` dời về service/db.js (`resolveMediaKey`); core `saveVideo`/`saveImage` nhận key;
  `setVideoThumbnails`/`replaceVideoMedia`/`updateImageBlob` ghi riêng từng store; 3 `apply*EditAndSave` -> core thuần
  `build*EditMeta` + `workflowPlaylist._save*Edit`/`_syncEdited*Runtime`; `deleteFolder`/`addSongsToFolder` nhận dữ liệu
  qua tham số (`workflowPlaylist.addMediaToFolder`); `cleanupOrphanedSongFolderFields` do Workflow chuẩn bị; 3
  `deleteCorrupted*` gộp `deleteCorruptedMediaRecords`; bỏ `clearAllVideosData`/`clearAllPhotosData`/`setVideoCustomName`/
  `deleteImage` (chết hoặc thay bằng `clearAllMediaOfType`); điểm Game + phụ đề ghi qua `updateMediaMeta`.
- [x] Lượt 2b — request trung tâm `mediaInUse` (mục 7) (sav-13-db-split-2b-patch.zip): event/workflow/media-in-use.js +
  event/router/media-in-use.js; hàm nạp lại ở workflow chủ quản: `workflowPlayer.reloadCurrentSongKeepingPosition()`,
  `workflowVideoPlayer.reloadCurrentVideoKeepingPosition()`, `workflowPhotoPlayer.reloadCurrentPhoto()`,
  `workflowVisualBg.reloadCurrentVideoKeepingPosition()`/`reloadCurrentPhoto()` (+ getter `getCurrentVideoKey()`/
  `getCurrentPhotoKey()`); `workflowPlaylist.replaceCurrentCoverUrl()` thành public (dùng chung).
- [x] Lượt 3 — thống kê vào meta (mục 6) (sav-13-db-split-3-patch.zip; điểm Game đã vào meta ở Lượt 2a): Workflow mới
  `workflowListenStats` (event/workflow/listen-stats.js) = toàn bộ phần đọc state/DB/hẹn giờ của core/listen-stats.js cũ +
  đồng hồ nghe dời từ core/player-controls.js; core/listen-stats.js chỉ còn hàm thuần (`mediaStatsKey`/`parseMediaStatsKey`/
  `buildMediaStatsMap`/`formatListenTime`); state `mediaStatsDirtyKeys` thay `_songStatsDirty`; `sortKeysByMode`/
  `applyPlaylistFilter` nhận thêm `mediaType`; `openSongEditModal(key, stats)` nhận thống kê từ Workflow; flush lúc unload dời
  sang event/tab.js. `clearAllSongStats` bỏ (record bị xoá thì thống kê mất theo — chỉ dọn RAM bằng `forgetType`).

- [x] Dọn nợ kỹ thuật (Giang yêu cầu 06/10/2026, sav-13-debt-cleanup-patch.zip) — mọi hàm core đã đụng trong đợt này hết vi phạm
  Rule 2/3: `openSongEditModal` -> Workflow; `executeAppCleanup` -> event/workflow/app-cleanup.js (xoá core/app-cleanup.js);
  `computeStats`/`computeVideoStats`/`computeImageStats` -> thuần `summarize*Library(records)`; `estimateOriginStorage` ->
  Workflow; `renderStorageStats` nhận chuỗi định dạng sẵn; `triggerDownload`/`promptDownloadReady`/`_collectZipEntries`/
  `collectAll*ZipEntries` -> `workflowZipDownload.deliverFile()/promptSingle()/collectEntries()` + core thuần
  `shareFileViaSystem`/`clickDownloadAnchor`/`planZipEntries`; `handleAudioPause` không còn gọi `releaseWakeLock`.

**ĐỦ Lượt 1 + 2a + 2b + 3 + dọn nợ -> deploy được, thử theo mục 9.** Còn Lượt 4 (sửa lỗi sau thử máy + cập nhật readme).
