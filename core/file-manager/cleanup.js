/**
 * core/file-manager/cleanup.js — Công cụ dọn rác chung File Manager (mục cuối cùng của
 * plan-v12-multimedia.md — cố ý dời tới khi mọi tính năng File Manager khác đã xong, vì mỗi tính
 * năng mới đều có thể phát sinh 1 kiểu quan hệ mồ côi riêng, viết registry TRƯỚC sẽ phải đoán mò).
 *
 * KHÁC HẲN `core/app-cleanup.js` (dọn tài nguyên PHIÊN LÀM VIỆC — animation frame/AudioContext/
 * object URL — lúc tab/app THẬT SỰ đóng): file NÀY dọn DỮ LIỆU TỒN ĐỌNG trong IndexedDB (tham
 * chiếu mồ côi tích luỹ qua nhiều phiên, do những góc khuất đã biết — xem từng hàm bên dưới) —
 * chạy khi người dùng CHỦ ĐỘNG bấm nút "Dọn dẹp dữ liệu" (Settings -> File Manager), KHÔNG tự động
 * chạy lúc boot (quét toàn bộ thư viện có thể chậm với thư viện lớn — để người dùng tự quyết định
 * lúc nào chạy, đúng tinh thần "công cụ").
 *
 * MỚI (10/09/2026, Giang yêu cầu) — `cleanupOrphanedZipTempFiles()` MỞ RỘNG phạm vi file này thêm 1
 * bậc: KHÔNG chỉ IndexedDB nữa mà còn quét rác OPFS (file .zip tạm bỏ dở khi phiên nén bị gián đoạn
 * — xem docstring hàm đó) — gọi thẳng `navigator.storage` (API trình duyệt gốc, KHÔNG tính "core
 * khác" theo Rule 1-4 ngay dưới, cùng tinh thần core/streaming-zip.js cũng gọi thẳng API này).
 *
 * REGISTRY: mỗi kiểu quan hệ mồ côi đăng ký 1 hàm quét+tự sửa riêng qua `registerCleanupCheck()` —
 * tính năng SAU NÀY phát sinh quan hệ mới chỉ cần viết thêm 1 hàm + đăng ký thêm 1 dòng, KHÔNG sửa
 * lại orchestration (event/workflow/file-manager-cleanup.js lặp qua registry, không biết/không cần
 * biết chi tiết từng check).
 *
 * Core THUẦN — tuân Rule 1-4 (siết chặt 04/07/2026): mỗi hàm CHỈ gọi service/db.js (dịch vụ hạ
 * tầng, KHÔNG tính "core khác" — xem giải thích gốc ở core/file-manager/folder.js dòng 6-15) HOẶC
 * API trình duyệt gốc (`navigator.storage`, KHÔNG phải core khác) và chỉ làm ĐÚNG 1 tiến trình
 * "phát hiện + tự sửa 1 KIỂU rác/quan hệ mồ côi cụ thể" (Rule 1).
 *
 * NẠP SAU: service/db.js.
 */

const _cleanupChecks = []; // Array<{ name: string, run: () => Promise<number> }> — run() trả số mục đã dọn

/**
 * Đăng ký 1 check dọn rác — gọi ở CUỐI file này cho từng hàm bên dưới (self-register lúc nạp
 * script, giống nhiều pattern self-init khác trong project).
 * @param {string} name - tên ngắn để hiện trong log/kết quả.
 * @param {() => Promise<number>} run - hàm quét+tự sửa, trả về SỐ MỤC đã dọn (0 nếu sạch).
 */
function registerCleanupCheck(name, run) {
    _cleanupChecks.push({ name, run });
}

/** Workflow (event/workflow/file-manager-cleanup.js) đọc registry qua hàm này — KHÔNG export
 * biến `_cleanupChecks` trực tiếp (giữ nguyên tắc "chỉ đọc qua hàm", tránh code ngoài sửa tay mảng). */
function getRegisteredCleanupChecks() {
    return _cleanupChecks;
}

/**
 * MỒ CÔI #1 — `record.folder[folderId]` còn sót trên bài hát SAU KHI folder đã bị xoá, cho những
 * bài đã TOMBSTONE khỏi folder TRƯỚC lúc folder bị xoá (deleteFolder() chỉ dọn được bài đang
 * ACTIVE tại thời điểm xoá — xem giải thích đầy đủ ở core/file-manager/folder.js dòng 40-52,
 * "resolveFolderId() — SỬA 03/07/2026 đợt 5"). Dùng `meta.deletedFolderIds` (danh sách ĐẦY ĐỦ mọi
 * folderId từng bị xoá) để biết chính xác cần dọn field nào trên mỗi bài.
 * @returns {Promise<number>} số bài hát đã dọn field `folder[...]` mồ côi.
 */
async function cleanupOrphanedSongFolderFields() {
    const deletedFolderIds = (await getMeta('deletedFolderIds')) || []; // data layer
    if (deletedFolderIds.length === 0) return 0;
    const deletedSet = new Set(deletedFolderIds);

    const songKeys = await getAllSongKeys(); // data layer
    let fixedCount = 0;
    for (const key of songKeys) {
        const record = await getSongRecord(key); // data layer
        if (!record || !record.folder) continue;
        const staleIds = Object.keys(record.folder).filter((id) => deletedSet.has(id));
        if (staleIds.length === 0) continue;
        staleIds.forEach((id) => { delete record.folder[id]; });
        await setSongRecord(key, record); // data layer
        fixedCount++;
    }
    return fixedCount;
}

/**
 * MỒ CÔI #2 — `folder_song` map còn tồn tại dù `folders` record tương ứng đã bị xoá (lẽ ra
 * `deleteFolder()` xoá CẢ HAI cùng lúc — safety net phòng trường hợp bất thường: crash giữa chừng,
 * sửa tay IndexedDB...).
 * @returns {Promise<number>}
 */
async function cleanupOrphanedFolderSongMaps() {
    const [liveFolderIds, mapKeys] = await Promise.all([getAllFolderKeys(), getAllFolderSongKeys()]); // data layer
    const liveSet = new Set(liveFolderIds);
    let fixedCount = 0;
    for (const folderId of mapKeys) {
        if (liveSet.has(folderId)) continue;
        await deleteFolderSongMap(folderId); // data layer
        fixedCount++;
    }
    return fixedCount;
}

// XOÁ (loại bỏ Album khỏi Photo Panel) — MỒ CÔI #3 (`cleanupOrphanedAlbumImageKeys()`, dọn
// `albums.imageKeys` chứa key ảnh đã xoá) bỏ hẳn cùng tính năng — Album không còn tồn tại trong
// app, store 'albums' cũ không còn nơi nào đọc/ghi tới nữa (xem core/file-manager/image.js,
// event/workflow/visual-bg.js).

// XOÁ (v14) — `cleanupOrphanedActiveBackgroundAlbum()` (mồ côi #4, safety net cho
// `meta.activeBackgroundAlbum`) bỏ hẳn: khoá đó đã NGỪNG GHI từ v13 Batch B, và field nó tự đọc để
// so sánh (`visualBgConfig.listAlbumId`) cũng không còn tồn tại ở schema v14 — hàm đã thành no-op
// kép (đọc field không tồn tại -> luôn null -> luôn return 0). `purgeVisualBgLegacyMeta()` bên dưới
// đã tự xoá khoá này khỏi meta lúc boot, không cần cascade riêng nữa.

// XOÁ (loại bỏ Document Reader khỏi app) — MỒ CÔI #5 (`cleanupEmptyUserDocuments()`, tài liệu
// 'user' tạo rồi bỏ dở) bỏ hẳn cùng tính năng — store 'documents' không còn nơi nào trong app
// đọc/ghi tới nữa (xem service/db.js).

/**
 * MỒ CÔI #6 — file .zip tạm trong OPFS (thư mục `sav-zip-tmp/`, tên lặp lại Ở ĐÂY thay vì tham
 * chiếu `OPFS_ZIP_TEMP_DIR` (core/streaming-zip.js) — giữ đúng nguyên tắc "Core THUẦN" ở đầu file:
 * mỗi hàm dọn CHỈ phụ thuộc service/db.js, KHÔNG phụ thuộc core khác) bị BỎ LẠI khi phiên làm việc
 * bị gián đoạn giữa chừng lúc đang nén zip (app crash/đóng tab/mất điện thoại/lỗi mạng...) TRƯỚC KHI
 * `cleanupStreamingZipTemp()` (core/streaming-zip.js, chỉ chạy SAU khi người dùng đã tải/share xong)
 * kịp dọn — đây là lỗ hổng ĐÃ BIẾT TỪ TRƯỚC (ghi rõ trong docstring gốc core/streaming-zip.js:
 * "OPFS temp-file cleanup on an interrupted/crashed session is a known gap"), giờ vá bằng registry
 * dọn rác chung này thay vì để tích rác vô thời hạn.
 *
 * MỖI file tạm có tên dạng `zip-<timestamp>-<random>.zip` (xem `buildZipStreamingToOpfs()`, core/
 * streaming-zip.js) — LẤY TUỔI file từ chính `<timestamp>` nhúng sẵn trong tên (không cần đọc
 * metadata riêng) — CHỈ xoá file CŨ HƠN 1 giờ, tránh xoá NHẦM 1 file đang được GHI DỞ THẬT SỰ bởi 1
 * tab/cửa sổ KHÁC của CÙNG app đang mở song song (OPFS dùng chung theo origin, không tách riêng
 * theo tab) — 1 giờ đủ rộng so với bất kỳ zip nào thực tế có thể mất (kể cả rơi qua Path B).
 * @returns {Promise<number>} số file tạm đã dọn.
 */
async function cleanupOrphanedZipTempFiles() {
    if (typeof navigator === 'undefined' || !navigator.storage || typeof navigator.storage.getDirectory !== 'function') return 0; // OPFS không khả dụng -> chắc chắn không có gì để dọn
    const ZIP_TEMP_DIR_NAME = 'sav-zip-tmp'; // PHẢI khớp OPFS_ZIP_TEMP_DIR, core/streaming-zip.js
    const MAX_AGE_MS = 60 * 60 * 1000; // 1 giờ — xem giải thích ở docstring hàm này
    let fixedCount = 0;
    try {
        const root = await navigator.storage.getDirectory();
        const tmpDirHandle = await root.getDirectoryHandle(ZIP_TEMP_DIR_NAME, { create: false }).catch(() => null);
        if (!tmpDirHandle) return 0; // thư mục chưa từng được tạo -> sạch
        const now = Date.now();
        const staleNames = [];
        for await (const name of tmpDirHandle.keys()) {
            const match = /^zip-(\d+)-/.exec(name);
            const createdAt = match ? Number(match[1]) : 0;
            if (createdAt && (now - createdAt) < MAX_AGE_MS) continue; // còn quá mới -> có thể đang ghi dở THẬT, bỏ qua, để lần dọn sau tự xử lý
            staleNames.push(name);
        }
        for (const name of staleNames) {
            try {
                await tmpDirHandle.removeEntry(name);
                fixedCount++;
            } catch (e) { /* đang khoá (hiếm) — bỏ qua, thử lại lần dọn sau */ }
        }
    } catch (err) {
        console.warn('[file-manager/cleanup] Không quét được thư mục tạm zip OPFS (bỏ qua, không nghiêm trọng):', err);
    }
    return fixedCount;
}

registerCleanupCheck('orphanedSongFolderFields', cleanupOrphanedSongFolderFields);
registerCleanupCheck('orphanedFolderSongMaps', cleanupOrphanedFolderSongMaps);
registerCleanupCheck('orphanedZipTempFiles', cleanupOrphanedZipTempFiles);

/**
 * Dọn 4 khoá `meta` MỒ CÔI của cơ chế nền cũ (v13 Batch F) — đều đã ngừng ghi từ Batch A/B/C:
 *   meta.videoBg            — BẢN SAO Blob video nền (cơ chế cũ copy blob; v13 chỉ lưu KEY)
 *   meta.visualBgImage      — BẢN SAO Blob ảnh nền tĩnh (như trên)
 *   meta.activeBackgroundAlbum — album nền, thay bằng `visualBgConfig.source` (v14)
 *   meta.slideshowConfig    — domain config riêng, gộp vào `visualBgConfig.slideshow`
 * 2 khoá đầu là Blob THẬT, có thể chiếm hàng trăm MB — đây mới là phần đáng giá của việc dọn.
 * Gọi 1 LẦN lúc boot (event/workflow/app-boot.js). Idempotent: chạy lại không sao.
 * @returns {Promise<void>}
 */
async function purgeVisualBgLegacyMeta() {
    await Promise.all([
        delMeta('videoBg'),
        delMeta('visualBgImage'),
        delMeta('activeBackgroundAlbum'),
        delMeta('slideshowConfig'),
    ]); // service/db.js
}
