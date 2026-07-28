/**
 * core/file-manager/video.js — File Manager -> Video, MỚI (21/07/2026). Schema store 'videos' xem
 * comment DB_VERSION ở service/db.js: key = videoKey, value = { blob, thumbBlob, width, height,
 * duration, filename, addedAt, codec, fps, bitrate, audioCodec, audioBitrate, customName }.
 *
 * MỚI (ver12 "Song/Video Unification", Batch 5, mục 6c) — 6 field MỚI trên record:
 *   - `codec`/`fps`/`bitrate`/`audioCodec`/`audioBitrate` — PHÂN TÍCH SẴN qua mediainfo.js lúc
 *     upload (event/workflow/file-manager-video.js::_extractVideoMediaInfo()), lưu thẳng, KHÔNG
 *     tính lại mỗi lần hiện tab "Chi tiết". Rỗng/0 nếu phân tích thất bại (KHÔNG chặn upload).
 *     SỬA (phản hồi Giang 28/07/2026) — BỎ HẲN field `format` (định dạng container, vd "MPEG-4" —
 *     ít giá trị, hầu hết video đều .mp4) — THÊM `audioCodec`/`audioBitrate` (tab "Chi tiết" trước
 *     đó thiếu thông tin âm thanh).
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
 * KHÔNG có Album cho Video (Giang chốt — chỉ Photo mới có khái niệm Album) — `deleteVideo()` do đó
 * KHÔNG cần dọn cascade nào, đơn giản hơn `deleteImage()`.
 *
 * NẠP SAU: service/db.js (getVideoRecord/setVideoRecord/deleteVideoRecord/getAllVideoKeys/slugify).
 */

/**
 * Sinh videoKey DUY NHẤT từ tên file — CÙNG THUẬT TOÁN resolveImageKey()/resolveSongKey() (service/
 * db.js): slug chưa tồn tại -> dùng luôn; slug đã tồn tại + filename TRÙNG -> ghi đè cùng key; slug
 * đã tồn tại + filename KHÁC -> thêm hậu tố số.
 * @param {string} filename
 * @returns {Promise<string>}
 */
async function resolveVideoKey(filename) {
    const baseSlug = slugify(filename) || 'video'; // CÓ return, DÙNG ngay dưới -> hợp lệ Rule 3
    console.log(`[resolveVideoKey] callTo: "slugify", request: "chuẩn hoá tên file '${filename}' thành slug làm base cho key"`);
    let candidate = baseSlug;
    let suffix = 2;
    while (true) {
        const existing = await getVideoRecord(candidate); // data layer (service/db.js)
        if (!existing) return candidate;
        if (existing.filename === filename) return candidate; // cùng file -> ghi đè đúng key này
        candidate = `${baseSlug}-${suffix}`; suffix++;
    }
}

/**
 * Lưu 1 video mới (hoặc ghi đè nếu trùng filename — xem resolveVideoKey()). `thumbBlob`/`width`/
 * `height`/`duration` PHẢI tính SẴN trước khi gọi hàm này (Workflow — event/workflow/file-manager-
 * video.js::_extractVideoThumbAndMeta()) — hàm này (core) CHỈ ghi lại nguyên xi.
 *
 * MỚI (ver12 "Song/Video Unification", Batch 5, mục 6c) — tham số `mediaInfo` (codec/fps/bitrate/
 * audioCodec/audioBitrate — SỬA phản hồi Giang 28/07/2026: bỏ hẳn `format`/container, thêm 2 field
 * âm thanh cho "đủ thông tin", PHÂN TÍCH SẴN qua mediainfo.js — event/workflow/file-manager-video.js::
 * _extractVideoMediaInfo(), CÙNG lý do đặt ở Workflow như _extractVideoThumbAndMeta(): thư viện
 * ngoài + đọc Blob theo chunk, core không được đụng theo Rule 1-4). `customName` khởi tạo `null`
 * (chưa đặt tên hiển thị riêng — tab "Chi tiết" rơi về `filename` gốc khi hiện, xem
 * core/file-manager/folder.js::getFolderItemsForDisplay()/event/workflow/video-player.js).
 * @param {File|Blob} file - blob video GỐC (không resize).
 * @param {string} filename
 * @param {Blob} thumbBlob - khung hình đã chụp + resize sẵn, dùng cho lưới.
 * @param {number} width - chiều rộng video GỐC (px).
 * @param {number} height - chiều cao video GỐC (px).
 * @param {number} duration - thời lượng video (giây).
 * @param {{codec?: string, fps?: string, bitrate?: number, audioCodec?: string, audioBitrate?: number}} [mediaInfo] - rỗng
 *        nếu mediainfo.js phân tích thất bại (KHÔNG chặn upload, xem _extractVideoMediaInfo()) —
 *        các field rơi về chuỗi/0 rỗng.
 * @returns {Promise<string>} videoKey vừa lưu
 */
async function saveVideo(file, filename, thumbBlob, width, height, duration, mediaInfo) {
    const videoKey = await resolveVideoKey(filename); // CÓ return, DÙNG ngay dưới -> hợp lệ Rule 3
    console.log(`[saveVideo] callTo: "resolveVideoKey", request: "sinh/tái dùng key duy nhất từ tên file '${filename}'"`);
    const info = mediaInfo || {};
    await setVideoRecord(videoKey, {
        blob: file, thumbBlob, width, height, duration, filename, addedAt: Date.now(),
        codec: info.codec || '', fps: info.fps || '', bitrate: info.bitrate || 0,
        audioCodec: info.audioCodec || '', audioBitrate: info.audioBitrate || 0, // MỚI (phản hồi Giang 28/07/2026) — bỏ hẳn `format`, thêm 2 field âm thanh
        customName: null,
    });
    return videoKey;
}

/**
 * Đặt/xoá tên hiển thị riêng (customName) cho 1 video — MỚI (Batch 5, mục 6c). CHỈ hiển thị TRONG
 * app (Playlist/Video Player/tab Chi tiết) — KHÔNG remux/nhúng vào file khi export (download vẫn
 * lấy theo `filename` GỐC, xem event/router/file-manager-video.js). Guard clause thuần (Rule 1):
 * video không tồn tại thì dừng sớm, KHÔNG phải rẽ nhánh tiến trình khác.
 * @param {string} videoKey
 * @param {string|null} customName - `null`/rỗng = xoá tên riêng, rơi về `filename` gốc khi hiện.
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
async function setVideoCustomName(videoKey, customName) {
    const record = await getVideoRecord(videoKey);
    if (!record) return { status: 'notFound' };
    record.customName = customName || null;
    await setVideoRecord(videoKey, record);
    return { status: 'ok' };
}

/**
 * Xoá hẳn 1 video khỏi thư viện. KHÔNG có cascade nào (Video không có Album) — khác hẳn
 * `deleteImage()` (core/file-manager/image.js).
 * @param {string} videoKey
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
async function deleteVideo(videoKey) {
    const record = await getVideoRecord(videoKey);
    if (!record) return { status: 'notFound' };
    await deleteVideoRecord(videoKey);
    return { status: 'ok' };
}

/**
 * Liệt kê toàn bộ video hiện có.
 * @returns {Promise<Array<{key: string, blob: Blob, thumbBlob: Blob, width: number, height: number, duration: number, filename: string, addedAt: number}>>}
 */
async function listVideos() {
    const keys = await getAllVideoKeys();
    const records = await Promise.all(keys.map(async (key) => {
        const record = await getVideoRecord(key);
        return record ? { key, ...record } : null;
    }));
    return records.filter(Boolean);
}

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
        totalBytes += record.blob.size + (record.thumbBlob ? record.thumbBlob.size : 0);
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
