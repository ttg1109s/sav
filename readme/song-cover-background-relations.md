# Quan hệ tham chiếu: Ảnh bìa bài hát ↔ Ảnh nền Playlist ↔ Ảnh nền Visual

> Tài liệu ĐIỀU TRA (chưa code) — chuẩn bị cho mục 4.c/4.d của `plan-v12-multimedia.md` (dùng
> chung 1 `openImagePicker({ target, onSelect })` đọc từ store `images` cho 3 đích: tab "Ảnh bìa"
> khi sửa thông tin bài hát, "Đặt ảnh nền" Playlist, "Đặt ảnh nền" Visual). Mục đích: làm rõ CÁC
> LOẠI quan hệ tham chiếu + hệ quả CRUD chéo TRƯỚC khi code, đúng tinh thần đã áp dụng cho
> folder↔song (`readme/core-legacy-audit.md`/`plan-v12-multimedia.md` mục 4.b1) và album↔ảnh
> (`plan-v12-multimedia-update-2.md` mục 1.4) — tránh vừa code vừa phát hiện quan hệ giữa chừng.
> KHÔNG thay thế quyết định thật lúc code batch đó — chỉ liệt kê hiện trạng + đề xuất, còn nhiều câu
> hỏi vẫn CẦN Giang chốt (mục 4 cuối file).

## 1. Hiện trạng — CẢ 3 tính năng đều CHƯA đụng tới store `images` mới

| Tính năng | Field lưu | Cơ chế | Nơi set | Nơi đọc |
|---|---|---|---|---|
| Ảnh bìa bài hát | `songRecord.cover` (store `songs`) | Upload File trực tiếp → embed thẳng `Blob` vào record | `core/playlist/actions.js` (tab "Ảnh bìa" modal sửa thông tin) | `core/playlist/actions.js` (record player + Media Session artwork), `core/playlist/render.js` (thumbnail danh sách), `core/id3-export.js` (`buildTaggedBlob` — ghi APIC lúc Export) |
| Ảnh nền Playlist | `vizConfig.bgImage` (runtime, `blob:` URL) + `meta.bgImage` (store `meta`, `Blob` gốc) | Upload File trực tiếp → lưu `Blob` vào `meta`, mỗi session tự `URL.createObjectURL()` lại | `core/visualizer/visualizer-display.js` (Settings) | `core/color-utils.js` (`updateDOMBackground` — set CSS `background-image` cho `#playlist-bg`) |
| Ảnh nền Visual | **CHƯA TỒN TẠI** — `vizConfig.visualBgImage` mới nêu ở `plan-v12-multimedia-update-2.md` mục 3, thuộc bước z-index nền Visual (chưa code) | — | — | — |

**Kết luận quan trọng:** cả 3 đều là cơ chế "nhúng thẳng" (embed) độc lập, KHÔNG liên quan gì tới
store `images`/`albums` (batch 3) — khác hẳn Album (vốn sinh ra ĐÃ tham chiếu qua `imageKeys`).
Nghĩa là khi thêm picker, đây là 1 cuộc **MIGRATE cơ chế lưu trữ**, không chỉ "thêm 1 UI mới" — rủi
ro cao hơn Album vì đụng vào dữ liệu/luồng đã có sẵn (bài hát cũ, cấu hình cũ), không phải tính
năng tinh khôi từ đầu.

## 2. Loại quan hệ nếu dùng chung `images` store — so 2 khuôn đã có sẵn trong project

| | Folder ↔ Song (`folder_song`, có tombstone) | Album ↔ Ảnh (`albumRecord.imageKeys`, KHÔNG tombstone) |
|---|---|---|
| Chiều tham chiếu | 2 CHIỀU — `folderRecord.list[pos]` VÀ `songRecord.folder[folderId]` (back-ref) | 1 CHIỀU — chỉ `albumRecord.imageKeys`, ảnh KHÔNG biết mình thuộc album nào |
| Vì sao cần back-ref | Cần xoá 1 bài → dọn NGAY khỏi mọi folder nó thuộc (nếu không có back-ref phải quét toàn bộ folder) | Không cần — số album nhỏ (người dùng tự tạo), quét toàn bộ lúc `deleteImage()` là đủ rẻ (xem `core/file-manager/image.js`) |

**Đề xuất cho cover/2 loại nền: dùng khuôn Album (1 chiều, KHÔNG back-ref trên `images`).** Lý do
mạnh hơn cả trường hợp Album: 1 ảnh trong store `images` có thể được DÙNG ĐỒNG THỜI bởi NHIỀU đích
khác loại nhau (vừa là cover của bài X, vừa là nền Playlist, vừa là nền Visual — không có gì cấm
việc này). Nếu chọn back-ref trên `images` (kiểu Folder), field đó phải là 1 cấu trúc HỖN HỢP nhiều
loại tham chiếu khác nhau (song cover / playlist bg / visual bg — mỗi loại lại có SỐ LƯỢNG khác
nhau: nhiều bài có thể share 1 ảnh cover, nhưng chỉ có ĐÚNG 1 ảnh nền Playlist tại 1 thời điểm) —
phức tạp không cần thiết. Ngược lại, quét từ phía "ảnh" ngược lên 3 đích (khi cần biết "ảnh này có
đang được dùng ở đâu không") vẫn rẻ: chỉ cần so `imageKey` với ĐÚNG 3 chỗ (scan toàn bộ `songs` +
đọc 2 field `vizConfig`), không phải quét lồng nhiều tầng như folder.

## 3. Vấn đề CRUD chéo cụ thể + đề xuất

### 3.1 — Xoá ảnh trong khi đang được dùng làm cover/nền → tham chiếu mồ côi

`core/file-manager/image.js::deleteImage()` HIỆN TẠI đã cascade dọn `albumRecord.imageKeys` (Batch
3) nhưng **CHƯA** biết gì về cover/2 loại nền (comment ngay trong file: "Phần dọn tham chiếu
vizConfig.bgImage/visualBgImage... thuộc Batch [z-index nền Visual], CHƯA code ở đây vì 2 field đó
CHƯA tồn tại"). Khi field đó ra đời, đây là quan hệ mồ côi CÙNG LOẠI với `record.folder[folderId]`
mồ côi đã ghi nhận ở `plan-v12-multimedia-update-2.md` mục 2.1 (registry `registerCleanupCheck` —
`core/app-cleanup.js`, dời xuống batch cuối) — **NHƯNG KHÁC Ở MỘT ĐIỂM QUAN TRỌNG:**

- `record.folder[folderId]` mồ côi là dữ liệu **TĨNH, không ai đọc lại** cho tới khi cố tình
  match — vô hại, dọn muộn (batch cuối) không sao.
- Cover/nền mồ côi là dữ liệu **ĐANG ĐƯỢC RENDER LIÊN TỤC** (cover hiện trên record player MỖI LẦN
  phát bài đó, nền Playlist hiện MỖI LẦN mở Playlist) — nếu không dọn/không có fallback, người dùng
  thấy NGAY ảnh vỡ (`<img>` báo lỗi/nền đen) mỗi lần mở app, không phải lỗi "âm thầm nằm chờ" như
  folder mồ côi.

**Đề xuất: XỬ LÝ KÉP, không đợi tới registry dọn rác batch cuối:**
1. **Chủ động (giống Album):** `deleteImage()` cascade dọn thẳng luôn CẢ 3 nơi (đổi `record.cover`/
   `cfg.bgImage`/`cfg.visualBgImage` về giá trị rỗng nếu đang trỏ đúng `imageKey` bị xoá) — cùng 1
   lượt quét, cùng chỗ đã cascade `albumRecord.imageKeys`, không cần đợi batch registry cuối cùng.
2. **Phòng thủ (bổ sung, KHÔNG thay thế mục 1):** nơi RENDER (record player, `#playlist-bg`, nền
   Visual mới) tự fallback về mặc định nếu resolve `imageKey` ra `null`/không tìm thấy — cùng
   pattern `attachCoverFallback()` đã có sẵn (`core/playlist/render.js`, xử lý cover Blob không
   decode được). Lớp phòng thủ này vẫn cần dù đã có (1), vì (1) chỉ chạy đúng lúc `deleteImage()`
   — các đường khác làm dữ liệu lệch (lỗi đồng bộ, import/restore thủ công...) vẫn nên có lưới an
   toàn cuối.

### 3.2 — Tương thích ngược: bài hát/cấu hình CŨ đã có cover/nền kiểu "nhúng thẳng" (Blob)

**Đề xuất mạnh: KHÔNG overload field cũ — thêm field MỚI riêng cho cơ chế reference:**
- `songRecord.coverImageKey` (mới, `string|null`) cạnh `songRecord.cover` (Blob, GIỮ NGUYÊN cho
  cover cũ/cover đọc từ ID3 lúc upload).
- `vizConfig.bgImageKey` (mới, persist qua `meta.bgImageKey`) cạnh `vizConfig.bgImage` (runtime
  `blob:` URL — vẫn giữ nguyên vai trò "giá trị đã resolve trong RAM", KHÔNG persist trực tiếp,
  đúng cơ chế loại trừ đã có sẵn ở `core/config.js`: `const { bgImage, videoBgUrl, ...persistable }
  = appState.get('vizConfig')`).
- `vizConfig.visualBgImageKey` (mới) — thiết kế THEO ĐÚNG khuôn trên NGAY TỪ ĐẦU (không có field cũ
  nào phải tương thích ngược vì tính năng chưa tồn tại).

**Thứ tự ưu tiên lúc RESOLVE (đọc để hiển thị), áp dụng cho cả 2 field cover/bgImage:** có
`coverImageKey`/`bgImageKey` → resolve từ store `images`; không có → fallback `record.cover`/
`meta.bgImage` (Blob cũ); không có gì → mặc định (`DEFAULT_VINYL`/không nền). Cách này migrate
ĐƯỢC bài hát/cấu hình cũ mà KHÔNG cần 1 script migrate dữ liệu hàng loạt nào — mỗi bài/cấu hình tự
"nâng cấp" khi người dùng chủ động đổi cover/nền qua picker mới (ghi `coverImageKey`, để nguyên
`record.cover` cũ luôn — không cần xoá, cover cũ trở thành "không dùng nữa" nhưng vô hại nếu còn).

### 3.3 — Tính năng HÀNG XÓM bị ảnh hưởng nếu đổi cơ chế cover (CẦN RÀ SOÁT KỸ khi code thật batch picker)

| File | Đang giả định gì về `record.cover` | Cần đổi gì nếu thêm `coverImageKey` |
|---|---|---|
| `core/id3-export.js` (`buildTaggedBlob`) | Đọc thẳng `record.cover` như 1 `Blob` để ghi tag APIC | Phải RESOLVE `coverImageKey` → `Blob` thật (đọc `images` store) TRƯỚC khi ghi tag, nếu có |
| `core/playlist/actions.js` (record player + Media Session artwork) | Đọc thẳng `record.cover` | Tương tự — resolve trước khi tạo `ObjectURL` |
| `core/playlist/render.js` (thumbnail + `attachCoverFallback`) | Đọc thẳng `record.cover` | Tương tự |

→ Đề xuất: viết 1 hàm resolve DÙNG CHUNG (vd `resolveSongCoverBlob(record)` — đọc `images` store
nếu có `coverImageKey`, fallback `record.cover`) thay vì sửa lặp lại logic resolve ở cả 3 nơi trên
— tránh 3 chỗ tự viết 3 kiểu fallback khác nhau (dễ lệch hành vi).

## 4. Câu hỏi CẦN Giang chốt trước khi code batch picker (chưa trả lời ở tài liệu này)

1. Đồng ý hướng "field mới `coverImageKey`/`bgImageKey`/`visualBgImageKey`, giữ nguyên field cũ cho
   tương thích ngược" (mục 3.2) hay muốn migrate hẳn 1 lần (viết script chuyển toàn bộ `record.cover`
   Blob cũ thành ảnh trong store `images` + xoá field cũ)?
2. `deleteImage()` cascade dọn cover/nền mồ côi (mục 3.1, điểm 1) — nếu 1 ảnh đang là cover của
   NHIỀU bài hát cùng lúc, xoá ảnh đó có nên cảnh báo trước (đếm số bài đang dùng) hay xoá thẳng
   như hành vi Album hiện tại (không cảnh báo, chỉ mất liên kết)?
3. 3 nguồn nền Visual (ảnh tĩnh/video/album-slideshow, xem câu hỏi #7 mục 6 `plan-v12-multimedia.md`)
   vẫn CHƯA chốt loại trừ lẫn nhau hay cho phép chồng — ảnh hưởng trực tiếp tới việc
   `visualBgImageKey` có cần thêm cờ enable riêng như `bgImageEnabled` hiện có không.
4. Hàm resolve dùng chung (mục 3.3) đặt ở đâu — `core/file-manager/image.js` (cùng nhà với
   `images` store) hay 1 file mới `core/cover-resolver.js`?

← [Quay lại README](../README.md)
