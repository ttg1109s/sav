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
 * không riêng About. 3 hàm THUẦN dưới đây (formatBytes/formatDurationLong/computeStats) GIỮ
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

        async function computeStats() {
            const keys = await getAllSongKeys();
            let totalSongs = 0, totalDuration = 0, totalBytes = 0;
            for (const key of keys) {
                const record = await getSongRecord(key);
                if (!record || !record.blob) continue;
                totalSongs++;
                totalDuration += record.duration || 0;
                totalBytes += record.blob.size + (record.cover ? record.cover.size : 0);
            }
            const totalListenSeconds = (await getMeta('totalListenSeconds')) || 0;
            return { totalSongs, totalDuration, totalListenSeconds, totalBytes };
        }

