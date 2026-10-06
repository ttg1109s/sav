/**
 * core/file-manager/video.js — File Manager -> Video, MỚI (21/07/2026). Schema store 'videos' xem
 * comment DB_VERSION ở service/db.js: key = videoKey, value = { blob, thumbBlob, thumbFullBlob,
 * width, height, duration, filename, addedAt, customName, thumbFullBlack }.
 *
 * MỚI (19/09/2026) — `thumbFullBlack` (boolean, mặc định false/undefined): `true` = khung hình ĐẦU của
 * video này ĐÃ được chụp ĐÚNG (nhiều lần, vẽ được thật) nhưng vẫn ĐEN — đen THẬT của nội dung (fade-in
 * ...), không phải lỗi chụp. Scan broken (`workflowFileManagerStorage._scanBlackVideoThumbs()`) BỎ QUA
 * record có cờ này để không báo lỗi lặp vô tận sau khi đã sửa. Record cũ chưa có field = chưa biết,
 * scan sẽ đo lại thumb.
 *
 * XOÁ (29/07/2026, yêu cầu Giang mục 1/2 — "chỉ giữ filename/RESOLUTION/playcount/listened ở tab
 * Chi tiết") — 6 field mediainfo.js cũ (`format` đã bỏ trước đó 28/07, giờ bỏ NỐT `codec`/`fps`/
 * `bitrate`/`audioCodec`/`audioBitrate`) ĐÃ XOÁ HẲN khỏi schema — tab "Chi tiết" không còn hiện các
 * field này nữa (core/playlist/actions.js::openSongEditModal()) nên phân tích mediainfo.js (WASM,
 * CDN unpkg) lúc upload cũng bỏ theo (event/workflow/file-manager-video.js::
 * _extractVideoMediaInfo() ĐÃ XOÁ, cùng thẻ `<script>` CDN ở index.html). `saveVideo()` KHÔNG còn
 * tham số `mediaInfo` nữa.
 *
 * MỚI (29/07/2026, yêu cầu Giang mục 2 — "thêm thumbnail blob full RESOLUTION tại frame 1") —
 * `thumbFullBlob` (Blob|null): khung hình ĐẦU TIÊN (time=0) của video, chụp ở ĐÚNG kích thước GỐC
 * (KHÔNG center-crop vuông, KHÔNG resize) — TÁCH RIÊNG hoàn toàn với `thumbBlob` (vuông
 * `VIDEO_THUMBNAIL_SIZE`×`VIDEO_THUMBNAIL_SIZE`, chụp tại giây `min(1, duration/2)`, dùng cho lưới/
 * cover — GIỮ NGUYÊN 100%, KHÔNG bị thay thế). `null` cho video cũ (trước batch này) hoặc nếu
 * `canvas.toBlob()` hiếm khi lỗi — field PHỤ, không có cũng không chặn phát/hiển thị video.
 *
 * MỚI (ver12 "Song/Video Unification", Batch 5, mục 6c) — `customName`:
 *   - `customName` (string|null, mặc định null) — tên hiển thị người dùng TỰ đặt (tab "Chi tiết"),
 *     CHỈ hiển thị TRONG app (Playlist/Video Player/danh sách folder) — KHÔNG remux/nhúng vào file,
 *     download vẫn lấy theo `filename` GỐC. Video TẠO TRƯỚC batch này không có field này (undefined,
 *     coi như null) — mọi nơi ĐỌC để hiển thị PHẢI tự rơi về `customName || stripFileExtension(filename)`
 *     (SỬA phản hồi Giang 28/07/2026 — bỏ đuôi mở rộng khỏi tên hiển thị mặc định, xem
 *     stripFileExtension() bên dưới).
 *
 * CÙNG KHUÔN core/file-manager/image.js (Batch 3, Photo) — `thumbBlob`/`width`/`height` resize sẵn
 * lúc upload (event/workflow/file-manager-video.js::_extractVideoThumbAndMeta(), cần `<video>`/
 * `canvas` — DOM API, core không được đụng theo Rule 1-4). THÊM `duration` (giây, số thực) — riêng
 * của Video, đo cùng lúc lấy thumbnail.
 *
 * KHÔNG có Album cho Video (Giang chốt — chỉ Photo mới có khái niệm Album) — cascade dọn folder khi
 * xoá 1 video nằm ở tầng Workflow (`event/workflow/playlist.js::MEDIA_DELETE_ACCESSOR`), KHÔNG còn
 * ở đây (xem `deleteVideo()` — ĐÃ XOÁ, thay bằng `deleteVideoRecord()` thuần CRUD, service/db.js).
 *
 * NẠP SAU: service/db.js (createMediaRecord/updateMediaMeta/setMediaBlob/setMediaThumbs — API media 3 store, 06/10/2026).
 */

// DỜI (06/10/2026, plan-media-db-split.md) — `resolveVideoKey()` (core TỰ ĐỌC DB — vi phạm Rule 3) sang service/db.js
// (data layer, dùng chung `resolveMediaKey()` với Song/Photo). Workflow gọi nó rồi truyền key vào `saveVideo()`.
// XOÁ (06/10/2026) — `setVideoCustomName()`: không còn nơi nào gọi (tên riêng ghi qua tab "Sửa", core/playlist/actions.js).

/**
 * Lưu 1 video mới (hoặc ghi đè trọn nếu trùng filename — key do Workflow resolve sẵn qua `resolveVideoKey()`,
 * service/db.js). `thumbBlob`/`width`/`height`/`duration`/`thumbFullBlob` PHẢI tính SẴN (Workflow —
 * event/workflow/playlist.js::extractVideoThumbAndMeta()) — hàm này CHỈ ghi lại nguyên xi.
 * SỬA (06/10/2026, plan-media-db-split.md) — ghi qua `createMediaRecord('video', ...)` (tự tách meta / file / thumb
 * vào 3 store); nhận `videoKey` qua tham số thay vì tự resolve (Rule 3 — core không gọi hàm đọc).
 * `customName` khởi tạo `null` (tab "Chi tiết" rơi về `filename` gốc khi hiện).
 * @param {string} videoKey
 * @param {File|Blob} file - blob video GỐC (không resize), Blob MỚI (không đọc từ IndexedDB).
 * @param {string} filename
 * @param {Blob} thumbBlob - khung hình center-crop vuông + resize, dùng cho lưới/cover.
 * @param {number} width @param {number} height - kích thước video GỐC (px).
 * @param {number} duration - giây.
 * @param {Blob} [thumbFullBlob] - khung đầu tiên full resolution (`null` nếu không có).
 * @param {boolean} [thumbFullIsBlack] - khung đầu đen THẬT, xem docstring đầu file.
 * @returns {Promise<string>} videoKey
 */
async function saveVideo(videoKey, file, filename, thumbBlob, width, height, duration, thumbFullBlob, thumbFullIsBlack) {
    await createMediaRecord('video', videoKey, { // service/db.js
        blob: file, thumbBlob, thumbFullBlob: thumbFullBlob || null, width, height, duration, filename, addedAt: Date.now(),
        customName: null,
        thumbFullBlack: !!thumbFullIsBlack,
    });
    console.log(`[saveVideo] ghi video "${videoKey}" (${filename}) vào 3 store media`);
    return videoKey;
}

/**
 * MỚI (18/09/2026, "Sửa file lỗi" — Storage → Scan broken) — thay thumb của 1 video ĐÃ TỒN TẠI (blob chính vẫn
 * phát được). Nơi gọi (`workflowFileManagerStorage.executeRepairBroken()`) tự chụp thumb mới rồi mới gọi hàm này.
 * SỬA (06/10/2026, plan-media-db-split.md) — không còn đọc/ghi lại nguyên record (Rule 3 + lỗi round-trip): cờ
 * `thumbFullBlack` ghi qua `updateMediaMeta()` (CHỈ store meta — cũng là bước kiểm tồn tại), 2 thumb MỚI ghi qua
 * `setMediaThumbs()` (CHỈ store thumb). Không đụng file chính.
 * @param {string} videoKey
 * @param {Blob} thumbBlob
 * @param {Blob} thumbFullBlob
 * @param {boolean} [thumbFullIsBlack]
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
async function setVideoThumbnails(videoKey, thumbBlob, thumbFullBlob, thumbFullIsBlack) {
    const metaResult = await updateMediaMeta('video', videoKey, (meta) => ({ ...meta, thumbFullBlack: !!thumbFullIsBlack })); // service/db.js
    if (metaResult.status === 'notFound') return { status: 'notFound' };
    await setMediaThumbs('video', videoKey, { thumbBlob, thumbFullBlob: thumbFullBlob || null }); // service/db.js
    console.log(`[setVideoThumbnails] ghi thumb mới cho video "${videoKey}"`);
    return { status: 'ok' };
}

/**
 * MỚI (Phase 1 editor video, 26/09/2026) — thay NỘI DUNG media của 1 video ĐÃ TỒN TẠI ("Lưu đè" từ modal sửa
 * Video), GIỮ NGUYÊN mọi field khác (`customName`, `addedAt`, `filename`, folder, thống kê...).
 * SỬA (06/10/2026, plan-media-db-split.md) — 3 bước ghi riêng từng store: meta (kích thước/thời lượng/cờ đen — cũng
 * là bước kiểm tồn tại), file chính, thumb. Báo "đang dùng" (nạp lại nếu video này đang phát/làm nền) là việc của
 * Workflow nơi gọi (request trung tâm `mediaInUse`), không phải của hàm này.
 * @param {string} videoKey
 * @param {{blob: Blob, thumbBlob: Blob, thumbFullBlob: (Blob|null), thumbFullIsBlack: boolean, width: number, height: number, duration: number}} media
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
async function replaceVideoMedia(videoKey, media) {
    const metaResult = await updateMediaMeta('video', videoKey, (meta) => ({ // service/db.js
        ...meta,
        thumbFullBlack: !!media.thumbFullIsBlack,
        width: media.width,
        height: media.height,
        duration: media.duration,
    }));
    if (metaResult.status === 'notFound') return { status: 'notFound' };
    await setMediaBlob('video', videoKey, media.blob); // service/db.js
    await setMediaThumbs('video', videoKey, { thumbBlob: media.thumbBlob, thumbFullBlob: media.thumbFullBlob || null }); // service/db.js
    console.log(`[replaceVideoMedia] ghi đè media video "${videoKey}" (giữ nguyên tên riêng/ngày thêm)`);
    return { status: 'ok' };
}

/**
 * SỬA (07/09/2026, Giang chỉ ra "đằng nào cũng sửa, đổi tên luôn đỡ nhầm") — hàm `deleteVideo()`
 * (tự dọn cascade folder rồi mới xoá record) ĐÃ XOÁ — không còn nơi nào gọi (kiểm tra lại toàn
 * project). Lý do xoá: Workflow (`event/workflow/playlist.js::MEDIA_DELETE_ACCESSOR`, dùng bởi
 * `deleteMediaFromActionMenu()`/`deleteSelectedMedia()`, VÀ `event/workflow/file-manager-storage.js::
 * executeDeleteBroken()`) giờ LUÔN tự gọi `removeSongFromAllFolders()` TRƯỚC khi xoá — ĐỒNG NHẤT
 * cho cả Song/Video/Photo — nên registry đó dùng THẲNG `deleteVideoRecord()` (service/db.js, CRUD
 * thô, KHÔNG cascade) thay vì hàm này, đối xứng với `deleteSongRecord()`/`deleteImageRecord()` (2
 * hàm đó CŨNG thuần CRUD, không cascade) — tránh 3 entry trong CÙNG 1 bảng có 3 "tầng" hành vi khác
 * nhau (2 thuần CRUD, 1 tự cascade) gây nhầm lẫn khi đọc code.
 */

// XOÁ (02/10/2026, Giang duyệt) — `listVideos()` (core TỰ ĐỌC DB — vi phạm Rule 3b; đọc MỖI record 1 transaction song
// song — thư viện lớn làm sập trang). Nơi gọi duy nhất (event/workflow/playlist-scope.js::PICKABLE_MEDIA_LISTER) giờ
// gọi thẳng `getAllVideoRecords()` (service/db.js — 1 transaction, cursor).

/**
 * Thống kê Video (số lượng, dung lượng) — MỚI (ver12 "Song/Video Unification", Batch 5, mục 6a),
 * mirror `computeStats()` (core/about-stats.js, Song) — CỐ Ý viết riêng bản của Video (Rule 3: core
 * cấm gọi core khác, kể cả hàm gần giống — cùng quy ước đã áp dụng cho `formatVideoDuration()`/
 * `groupVideosByDay()` trong chính file này).
 * @returns {Promise<{totalVideos: number, totalBytes: number}>}
 */
async function computeVideoStats() {
    const keys = await getAllVideoKeys();
    let totalVideos = 0, totalBytes = 0;
    for (const key of keys) {
        const record = await getVideoRecord(key);
        if (!record || !record.blob) continue;
        totalVideos++;
        totalBytes += record.blob.size + (record.thumbBlob ? record.thumbBlob.size : 0) + (record.thumbFullBlob ? record.thumbFullBlob.size : 0); // MỚI (29/07/2026) — cộng thêm thumbFullBlob (full-res, thường nặng hơn hẳn thumbBlob vuông) vào tổng dung lượng thật
    }
    return { totalVideos, totalBytes };
}

// ===================== Group theo ngày (windowing IntersectionObserver, cùng khuôn Photo) =========
// 2 hàm THUẦN dưới đây CHUẨN BỊ dữ liệu cho lưới Video — xem event/workflow/video-gallery-window.js.
// TRÙNG LOGIC với sortImagesByAddedDateDesc()/groupImagesByDay()/formatPhotoDayHeaderLabel() (core/
// file-manager/image.js) — CỐ Ý viết riêng bản của Video, KHÔNG gọi thẳng hàm bên image.js (Rule 3:
// core cấm gọi core khác) — mỗi domain module tự chứa, đúng quy ước sẵn có trong project.

/**
 * Sắp xếp danh sách video theo `addedAt` MỚI NHẤT lên đầu. Hàm THUẦN — không mutate mảng gốc.
 * @param {Array<{key:string, addedAt:number}>} videos
 * @returns {Array} bản sao MỚI đã sắp xếp
 */
function sortVideosByAddedDateDesc(videos) {
    return [...videos].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
}

/** Format nhãn header ngày hiển thị phía trên mỗi nhóm video (vd "Thứ Hai, 15 thg 7") — theo
 * `navigator.language`, dùng `Intl.DateTimeFormat` (built-in JS, không phải DOM API).
 * @param {number} addedAt - timestamp (ms) của 1 video BẤT KỲ trong nhóm ngày đó.
 * @returns {string}
 */
function formatVideoDayHeaderLabel(addedAt) {
    const d = new Date(addedAt || 0);
    const opts = { weekday: 'long', day: 'numeric', month: 'short' };
    if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
    return new Intl.DateTimeFormat(navigator.language, opts).format(d);
}

/**
 * Gom danh sách video ĐÃ sắp xếp (sortVideosByAddedDateDesc()) thành các NHÓM THEO NGÀY — đơn vị
 * windowing cấp NHÓM (IntersectionObserver) cho event/workflow/video-gallery-window.js. Hàm THUẦN.
 * @param {Array<{key:string, addedAt:number}>} sortedVideos
 * @returns {Array<{dayKey:string, addedAt:number, videos:Array}>}
 */
function groupVideosByDay(sortedVideos) {
    const groups = [];
    let currentGroup = null;
    let lastDayKey = null;
    for (const video of sortedVideos) {
        const d = new Date(video.addedAt || 0);
        const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (dayKey !== lastDayKey) {
            currentGroup = { dayKey, addedAt: video.addedAt, videos: [] };
            groups.push(currentGroup);
            lastDayKey = dayKey;
        }
        currentGroup.videos.push(video);
    }
    return groups;
}

/**
 * Cắt bỏ đuôi mở rộng (".mp4"/".mov"/...) khỏi filename — dùng ở MỌI nơi hiện "tên hiển thị" của 1
 * video (title lúc phát, danh sách folder, ô nhập customName...) khi CHƯA đặt customName riêng —
 * MỚI (phản hồi Giang 28/07/2026, "custom name phải bỏ đuôi mở rộng"). Pure, không I/O — coi như
 * ngoại lệ "hàm định dạng thuần" giống `formatVideoDuration()` ngay dưới (không phải core gọi core
 * nghiệp vụ — xem giải thích đầy đủ ở core/playlist/actions.js::openSongEditModal(), nơi gọi hàm
 * này cùng lý do; core/file-manager/video-ui.js — nơi giải thích GỐC — ĐÃ XOÁ ở Batch 6 mục 6d).
 * @param {string} filename
 * @returns {string}
 */
function stripFileExtension(filename) {
    if (!filename) return '';
    const dot = filename.lastIndexOf('.');
    return dot > 0 ? filename.slice(0, dot) : filename;
}

/**
 * Format số giây thành "m:ss" (vd 75 -> "1:15") — CÙNG STYLE `formatTime()` (core/playlist/
 * state.js) nhưng viết riêng bản của Video (Rule 3: core cấm gọi core khác, kể cả hàm gần giống).
 * @param {number} seconds
 * @returns {string}
 */
function formatVideoDuration(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}
