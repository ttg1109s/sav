/**
 * event/workflow/audio-duration.js — `workflowAudioDuration.read(blob)`: đọc thời lượng 1 file nhạc qua thẻ `<audio>` tạm.
 * Dùng lúc nạp file mới (workflowPlaylist.uploadSongs()) và quét file lỗi (workflowFileManagerStorage._checkSongRecord()) —
 * không dùng lúc boot. Lỗi / hết giờ / không ra số hữu hạn -> 0.
 *
 * Thẻ tạm được giải phóng hẳn (pause -> gỡ src -> load(), core/dynamic-object-ui.js) rồi mới thu hồi URL: chỉ revoke thì iOS
 * vẫn giữ media player gốc (AVPlayer) của thẻ tới khi GC — quét nhiều bài là nhiều player mồ côi chạy song song audio chính
 * (khựng, rớt fps). Chỉ tải metadata, không buffer cả file.
 *
 * NẠP SAU: service/task-manager.js, service/blob-url.js, core/dynamic-object-ui.js, core/playlist/loader.js.
 */
const AUDIO_DURATION_PROBE_TIMEOUT_MS = 8000; // Safari iOS có thể không bắn 'loadedmetadata'/'error'

const workflowAudioDuration = {
    /** @param {Blob} blob @returns {Promise<number>} giây, 0 nếu không đọc được */
    async read(blob) {
        let url;
        try { url = createBlobUrl(blob); } // service/blob-url.js
        catch (err) { console.error('[audioDuration] Không tạo được object URL để đọc duration:', err); return 0; }
        const audioEl = createMetadataProbeAudioElement(); // core/dynamic-object-ui.js
        const errorWait = listenEventOnce(audioEl, 'error');
        const metaWait = loadMediaElementMetadata(audioEl, url);
        const duration = await new Promise((resolve) => {
            const timer = taskManager.once(() => resolve(NaN), AUDIO_DURATION_PROBE_TIMEOUT_MS);
            metaWait.promise.then(() => { timer.kill(); resolve(audioEl.duration); });
            errorWait.promise.then(() => { timer.kill(); resolve(NaN); });
        });
        metaWait.cancel();
        errorWait.cancel(); // gỡ trước khi giải phóng (load() rỗng có thể bắn lại 'error')
        releaseMediaElement(audioEl); // core/dynamic-object-ui.js
        revokeBlobUrl(url);
        return resolveProbedAudioDuration(duration); // core/playlist/loader.js
    },
};
