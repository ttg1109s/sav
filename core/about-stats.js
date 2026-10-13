/**
 * core/about-stats.js — hàm thuần cho thống kê panel About (event/workflow/settings-misc.js::openAbout()):
 * `formatBytes()` (dùng cả ở core/storage-manager.js, core/file-manager/document-ui.js), `summarizeSongLibrary()`.
 */
        function formatBytes(bytes) {
            if (!bytes) return '0 MB';
            const mb = bytes / (1024 * 1024);
            if (mb < 1024) return `${mb.toFixed(1)} MB`;
            return `${(mb / 1024).toFixed(2)} GB`;
        }

        /**
         * Tổng hợp thư viện nhạc từ record Workflow đã đọc (getAllSongRecords()) + tổng giây nghe. Bỏ qua record thiếu Blob.
         * @param {Array<object>} records @param {number} totalListenSeconds
         * @returns {{totalSongs: number, totalDuration: number, totalListenSeconds: number, totalBytes: number}}
         */
        function summarizeSongLibrary(records, totalListenSeconds) {
            const valid = records.filter((record) => record && record.blob);
            return {
                totalSongs: valid.length,
                totalDuration: valid.reduce((sum, record) => sum + (record.duration || 0), 0),
                totalListenSeconds,
                totalBytes: valid.reduce((sum, record) => sum + record.blob.size + (record.cover ? record.cover.size : 0), 0),
            };
        }

