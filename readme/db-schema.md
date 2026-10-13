# IndexedDB — schema và API (DB v6)

Tài liệu thường trực của tầng dữ liệu `service/db.js`. Đọc cùng [core-function-conventions.md](./core-function-conventions.md)
Rule 3b (core chỉ được gọi hàm GHI; hàm ĐỌC thuộc Workflow).

- Tên DB: `musicPlayerDB`, `DB_VERSION = 6`. Thư viện: `idb-keyval` (CDN) qua accessor dùng chung 1 connection
  (`makeStoreAccessor()` / `makeMultiStoreAccessor()` — tự mở lại connection + thử lại 1 lần khi connection chết).
- Nâng từ v1–v5 lên v6: **không chuyển dữ liệu** — xoá store media cũ (`songs`/`videos`/`images` bản cũ) và 2 khoá thống kê
  cũ trong `meta` (`songStats`, `gameScores`); người dùng nạp lại thư viện. Các store khác giữ nguyên.

## 1. Store

### 1.1 Media — 3 store cho mỗi loại

| Loại | Meta (dữ liệu thường, KHÔNG Blob) | Media blob (file chính) | Thumb blob |
|---|---|---|---|
| song | `songs` | `song_blobs` | `song_thumbs` — `{ cover }` |
| video | `videos` | `video_blobs` | `video_thumbs` — `{ thumbBlob, thumbFullBlob }` |
| photo | `images` | `image_blobs` | `image_thumbs` — `{ thumbBlob }` |

- Cả 3 store dùng chung **key media** (chuỗi `slugify(filename)`, trùng tên khác file thì thêm `-2`, `-3`… —
  `resolveMediaKey()`); mỗi media đúng 1 entry mỗi store. Key 3 loại có thể trùng nhau (cùng slug) — luôn đi kèm `type`.
- Bảng tên store: `MEDIA_STORES_BY_TYPE`; danh sách field thumb: `THUMB_FIELDS_BY_TYPE` — nguồn sự thật duy nhất, trong
  `service/db.js`.

Field chính của bản ghi meta:

| Field | Ghi chú |
|---|---|
| `filename`, `tag`, `customName`, `album`, `duration`, `width`, `height`, `addedAt`, `subtitles` (Song), `karaoke` trong từng dòng phụ đề… | Dữ liệu thường |
| `folder` | `{ [folderId]: position }` — vị trí trong `folder_song.list` (xem 1.2) |
| `stats` | `{ count, totalTime }` — lượt nghe / thời gian nghe của chính media này |
| `game` | `{ [mode]: { [difficulty]: [{ time, score }] } }` — điểm Game |

Xoá media là xoá luôn thống kê và điểm Game của nó (cùng nằm trong meta).

### 1.2 Store khác

| Store | Key | Value |
|---|---|---|
| `meta` | tên khoá | Cấu hình bền (config các domain, preset EQ/Motion/Filter…), `folderIndex`, `deletedFolderIds`, `activePlayListFolder`, `totalListenSeconds`, cờ migrate 1 lần… |
| `folders` | folderId | `{ id, name, type, excludeFromMainPlaylist, isReadOnly, applyFilter, filterConfig }` |
| `folder_song` | folderId | `{ list: [key|null, …], empty }` — gỡ item = tombstone `null`, không splice |
| `languages` | mã ngôn ngữ | Gói ngôn ngữ người dùng tải lên (`en` nằm cứng trong `lang/lang.js`) |

Schema Folder chi tiết: docstring đầu `core/file-manager/folder.js`.

## 2. Bất biến

1. **Blob chỉ ghi khi tạo mới hoặc khi nội dung thật sự đổi.** Sửa dữ liệu thường (tag, phụ đề, folder, thống kê, điểm
   Game) chỉ chạm store meta — không bao giờ đọc Blob lên rồi ghi lại (lớp lỗi "round-trip Blob": WebKit làm chết blob URL
   đang phát).
2. **Tạo mới**: meta + media blob + mọi thumb ghi trong **1 transaction** (3 store).
3. **Sửa meta**: đọc-sửa-ghi CHỈ store meta; hàm ghi tự gạt bỏ field Blob nếu lọt vào.
4. **Sửa Blob**: chỉ ghi đúng store truyền vào. Thumb luôn ghi **cả object, toàn Blob mới** (thiếu field là lỗi lập trình).
5. **Xoá**: xoá entry ở cả 3 store trong 1 transaction.
6. Transaction IndexedDB **tự commit khi gặp `await` ngoài IDB** → đọc file / `arrayBuffer()` phải xong TRƯỚC khi gọi hàm ghi.

## 3. API `service/db.js`

### 3.1 Đọc (chỉ Workflow gọi)

| Hàm | Ghi chú |
|---|---|
| `getMediaRecord(type, key)`, `getSongRecord` / `getVideoRecord` / `getImageRecord(key)` | Ghép meta + blob + thumb trong 1 transaction, trả record hình dạng gộp |
| `get{Song,Video,Image}RecordsByKeys(keys, onProgress)`, `getAll{Song,Video,Image}Records(onProgress)` | Đọc gộp hàng loạt |
| `getMediaMeta(type, key)`, `getAllMediaMeta(type)` | CHỈ meta (không mở Blob) — `getAllMediaMeta` gộp `key` vào từng phần tử |
| `resolveMediaKey(type, filename, fallbackSlug)`, `resolve{Song,Video,Image}Key(filename)` | Sinh key (đọc meta để tránh trùng; cùng `filename` thì trả đúng key cũ để ghi đè) |
| `getAll{Song,Video,Image}Keys()`, `getMeta`, `getFolderRecord`, `getFolderSongMap`, `getAllFolderKeys`, `getAllFolderSongKeys`, `getLanguagePack`… | Đọc store khác |

### 3.2 Ghi (Core được gọi)

| Hàm | Dùng cho |
|---|---|
| `createMediaRecord(type, key, record)` | Tạo mới / ghi đè trọn: tự tách `blob` + field thumb theo `THUMB_FIELDS_BY_TYPE` |
| `updateMediaMeta(type, key, mutate)` | Sửa dữ liệu thường — `mutate(meta)` đồng bộ, thuần, trả meta mới |
| `updateMediaMetaBatch([{ type, key, mutate }])` | Nhiều media (nhiều loại) trong 1 transaction — flush thống kê, xoá/thêm folder, dọn mồ côi |
| `setMediaBlob(type, key, blob)` | Đổi file chính (sửa ảnh, thay file video, upload ghi đè) |
| `setMediaThumbs(type, key, thumbs)` | Đổi thumb (fix thumbnail, đổi cover) — đủ mọi field của loại, Blob mới hoặc `null` (mọi field `null` = xoá entry thumb) |
| `deleteMediaRecord(type, key)`, `clearAllMediaOfType(type)` | Xoá 1 media / mọi media 1 loại (cả 3 store) |
| `setMeta`/`delMeta`, `setFolderRecord`/`deleteFolderRecord`, `setFolderSongMap`/`deleteFolderSongMap`, `setLanguagePack`… | Ghi store khác |

`rematerializeBlob(blob)`: chép Blob vào RAM thành Blob mới — dùng khi ghi một Blob vừa ĐỌC từ IndexedDB sang bản ghi khác
(cover của bản ghi âm, đoạn cắt trong Subtitle editor), cho file Song vừa chọn lúc upload (file tạm của trình chọn file trên
iOS), và để decode trong Subtitle editor. Không dùng trong đường sửa dữ liệu thường (không còn đọc Blob lên để ghi lại).

## 4. Thống kê nghe

- Nguồn bền: `meta.stats` của từng media (mục 1.1). RAM: `appState.mediaStatsMap` (Map, key `type:key` — `mediaStatsKey()`,
  core/listen-stats.js) + `appState.mediaStatsDirtyKeys` (Set key vừa đổi).
- `workflowListenStats` (event/workflow/listen-stats.js): `loadAll()` lúc boot (đọc `getAllMediaMeta` × 3), `bumpPlayCount`,
  `addListenTime` (đồng hồ nghe `startClock`/`stopClock`), `forget`/`forgetType` (chỉ dọn RAM — record xoá thì stats mất
  theo), `flush()` ghi các key bẩn qua `updateMediaMetaBatch` (hẹn 4 s; lúc đóng tab `event/workflow/app-cleanup.js` gọi ngay).

## 5. Thay nội dung file đang được dùng — request `mediaInUse`

Thay **Blob** của media đang phát/đang hiện có thể làm chết blob URL đang dùng (sửa meta thì không). Quy ước:

- Nơi thay file (upload ghi đè, Video editor "Ghi đè", sửa ảnh "Ghi đè", fix thumbnail…) ghi DB xong CHỈ bắn
  `eventBus.send({ router: 'mediaInUse', type: 'mediaInUse.contentReplaced', payload: { type, key } })` — không tự kiểm ai
  đang dùng.
- `workflowMediaInUse.handleContentReplaced(type, key)` (event/workflow/media-in-use.js) tự đọc state để biết media đang
  được dùng ở đâu rồi gọi hàm nạp lại của workflow chủ quản (object map, không if/else nghiệp vụ):

| Nơi đang dùng | Nạp lại bằng |
|---|---|
| Node Playlist (đúng Nguồn, có trong `playlistCache`) | trỏ `cover` sang thumb mới + vẽ lại node |
| Player chính — Song / Video / Photo | `workflowPlayer.reloadCurrentSongKeepingPosition()` / `workflowVideoPlayer.reloadCurrentVideoKeepingPosition()` / `workflowPhotoPlayer.reloadCurrentPhoto()` |
| Visual Background (không ở Player Video/Photo, đúng item đang chạy) | `workflowVisualBg.reloadCurrentVideoKeepingPosition()` / `reloadCurrentPhoto()` |

Media không được dùng ở đâu -> không làm gì.

← [Quay lại README](../README.md)
