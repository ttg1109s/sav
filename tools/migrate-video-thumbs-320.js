/**
 * tools/migrate-video-thumbs-320.js — MỚI (27/07/2026, ver12 "Song/Video Unification", Batch 3).
 *
 * ================================ TẠM THỜI — CHỈ DÙNG 1 LẦN ================================
 * Regen `thumbBlob` cho VIDEO CŨ (đã upload TRƯỚC batch này) sang đúng center-crop vuông 320×320
 * (khớp `VIDEO_THUMBNAIL_SIZE`, event/workflow/file-manager-video.js) — video cũ đang giữ thumb
 * theo tỉ lệ gốc (không vuông), giờ thống nhất với video mới.
 *
 * TỰ CHẠY (Giang yêu cầu) — KHÔNG cần bấm nút, KHÔNG phải file riêng mở tay nữa (bản trước là
 * `tools/migrate-video-thumbs-320.html`, ĐÃ XOÁ, thay bằng file này — chạy NGAY TRONG app chính,
 * cùng origin/IndexedDB connection, khỏi lo lệch origin `file://` giữa các thư mục).
 *
 * CHỈ CHẠY ĐÚNG 1 LẦN THẬT SỰ — tự ghi cờ `getMeta('videoThumb320MigrationDone')` sau khi xong,
 * mọi lần boot SAU đó thấy cờ `true` thì bỏ qua ngay, KHÔNG quét lại/ghi lại (tránh mỗi lần mở app
 * đều mất thời gian xử lý lại 100+ video vô ích).
 *
 * ================================ XOÁ Ở BATCH KẾ TIẾP ================================
 * Sau khi xác nhận đã chạy xong tốt (xem alert lúc hoàn tất, hoặc console log), Giang xoá:
 *   1. File này (tools/migrate-video-thumbs-320.js).
 *   2. Dòng `<script src="tools/migrate-video-thumbs-320.js...">` ở index.html.
 * Không cần xoá cờ `videoThumb320MigrationDone` trong `meta` store — vô hại nếu bỏ sót, chỉ là 1
 * key thừa không ai đọc nữa.
 *
 * NẠP SAU: service/db.js (getMeta/setMeta/getAllVideoKeys/getVideoRecord/setVideoRecord),
 * core/file-manager/video.js (không gọi hàm nào từ đây, chỉ cần DB đã sẵn), core/modal-choice.js
 * (alertModal — chỉ dùng lúc THẬT SỰ chạy xong lần đầu, không phải mỗi lần boot).
 */
(async function migrateVideoThumbsTo320() {
    const MIGRATION_FLAG_KEY = 'videoThumb320MigrationDone';
    const THUMB_SIZE = 320; // GIỐNG HỆT VIDEO_THUMBNAIL_SIZE (event/workflow/file-manager-video.js)

    try {
        const alreadyDone = await getMeta(MIGRATION_FLAG_KEY);
        if (alreadyDone) {
            console.log('[migrate-video-thumbs-320] Đã chạy xong từ trước (cờ meta = true) — bỏ qua.');
            return;
        }

        console.log('[migrate-video-thumbs-320] BẮT ĐẦU — regen thumbnail 320x320 cho video cũ...');
        const keys = await getAllVideoKeys(); // service/db.js
        let okCount = 0, failCount = 0;

        for (const key of keys) {
            try {
                const record = await getVideoRecord(key); // service/db.js
                if (!record || !record.blob) { failCount++; console.warn(`[migrate-video-thumbs-320] Bỏ qua "${key}" — record hỏng/thiếu blob gốc.`); continue; }
                record.thumbBlob = await regenThumbFromBlob(record.blob);
                await setVideoRecord(key, record); // service/db.js — CHỈ đổi thumbBlob, mọi field khác giữ nguyên
                okCount++;
            } catch (err) {
                failCount++;
                console.error(`[migrate-video-thumbs-320] Lỗi ở "${key}":`, err);
            }
        }

        await setMeta(MIGRATION_FLAG_KEY, true); // service/db.js — đánh dấu XONG dù có vài video lỗi, tránh quét lại từ đầu mỗi lần boot
        console.log(`[migrate-video-thumbs-320] HOÀN TẤT: ${okCount} thành công, ${failCount} lỗi/bỏ qua trên tổng ${keys.length} video.`);
        await alertModal(`Đã cập nhật thumbnail cho ${okCount}/${keys.length} video cũ (${failCount} lỗi/bỏ qua, xem console). Có thể xoá tools/migrate-video-thumbs-320.js + dòng script tương ứng trong index.html.`);
    } catch (err) {
        console.error('[migrate-video-thumbs-320] LỖI NGHIÊM TRỌNG, dừng migration:', err);
    }

    /** Center-crop THUMB_SIZE×THUMB_SIZE — Y HỆT logic trong event/workflow/file-manager-video.js::
     * _extractVideoThumbAndMeta() (Batch 3) — copy riêng ra đây (không import chung) vì file này là
     * tool tạm thời, không thuộc kiến trúc core/event chính thức của app.
     * @param {Blob} videoBlob
     * @returns {Promise<Blob>} thumbBlob mới, JPEG 320x320
     */
    function regenThumbFromBlob(videoBlob) {
        return new Promise((resolve, reject) => {
            const objectUrl = URL.createObjectURL(videoBlob);
            const videoEl = document.createElement('video');
            videoEl.preload = 'metadata';
            videoEl.muted = true;
            videoEl.playsInline = true;

            function cleanupAndReject(err) {
                URL.revokeObjectURL(objectUrl);
                reject(err);
            }

            videoEl.addEventListener('loadedmetadata', () => {
                const duration = videoEl.duration;
                if (!videoEl.videoWidth || !videoEl.videoHeight) { cleanupAndReject(new Error('video không có kích thước hợp lệ')); return; }
                videoEl.currentTime = Math.min(1, (duration || 0) / 2);
            }, { once: true });

            videoEl.addEventListener('seeked', () => {
                const width = videoEl.videoWidth;
                const height = videoEl.videoHeight;
                const cropSize = Math.min(width, height);
                const sx = (width - cropSize) / 2;
                const sy = (height - cropSize) / 2;
                const canvas = document.createElement('canvas');
                canvas.width = THUMB_SIZE;
                canvas.height = THUMB_SIZE;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(videoEl, sx, sy, cropSize, cropSize, 0, 0, THUMB_SIZE, THUMB_SIZE);
                URL.revokeObjectURL(objectUrl);
                canvas.toBlob((thumbBlob) => {
                    if (!thumbBlob) { reject(new Error('canvas.toBlob trả về null')); return; }
                    resolve(thumbBlob);
                }, 'image/jpeg', 0.82);
            }, { once: true });

            videoEl.addEventListener('error', () => cleanupAndReject(new Error('không đọc được video (file hỏng?)')), { once: true });
            videoEl.src = objectUrl;
        });
    }
})();
