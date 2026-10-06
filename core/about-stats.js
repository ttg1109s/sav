/**
 * Tính thống kê cho panel About (mục 7 PLAN_INDEXEDDB.md).
 * computeStats() chỉ liệt kê store `songs` (qua getAllSongKeys/db.js), không lẫn key của
 * store `meta` (playlistOrder, bgImage, videoBg, totalListenSeconds) vì 2 store đã tách riêng.
 *
 * Batch D1 (Settings restructure, 06/07/2026) — XOÁ `openAboutDrawerAndRenderStats()`/
 * `closeAboutDrawer()` (thao tác `classList` trên `#drawer-about` tĩnh cũ, KHÔNG còn tồn tại —
 * xem components/about-drawer.js/settings-drawer.js). Việc mở/render thống kê giờ ở
 * event/workflow/settings-misc.js::openAbout() (push panel + tự querySelector bên trong để điền
 * giá trị); việc đóng dùng CHUNG core/settings-panel-stack.js::popSettingsPanel() cho MỌI panel,
 * không riêng About. 3 hàm THUẦN dưới đây (formatBytes/formatDurationLong/summarizeSongLibrary — trước là computeStats) GIỮ
 * NGUYÊN — vẫn được dùng lại từ nơi gọi mới, và `formatBytes` còn dùng ở core/storage-manager.js +
 * core/file-manager/document-ui.js (KHÔNG được xoá).
 */
        function formatBytes(bytes) {
            if (!bytes) return '0 MB';
            const mb = bytes / (1024 * 1024);
            if (mb < 1024) return `${mb.toFixed(1)} MB`;
            return `${(mb / 1024).toFixed(2)} GB`;
        }

        function formatDurationLong(totalSeconds) {
            const s = Math.floor(totalSeconds || 0);
            const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60);
            if (h > 0) return tFormat('common.durationLong.hourMinute', { h, m });
            return tFormat('common.durationLong.minuteOnly', { m });
        }

        /**
         * THAY (06/10/2026, dọn nợ Rule 3b — Giang yêu cầu) `computeStats()` (core tự đọc DB, mỗi bài 1 transaction): giờ
         * THUẦN tổng hợp từ record Workflow đã đọc (getAllSongRecords() — 1 transaction) + tổng giây nghe (meta).
         * Bỏ qua record thiếu Blob (hỏng) như bản cũ.
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

