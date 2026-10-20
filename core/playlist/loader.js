/**
 * core/playlist/loader.js — menu "Thêm nhạc" + dựng `playlistCache`/`songNameIndex` từ record đã đọc (Song/Video/Photo).
 * Đọc DB, chuẩn hoá tên, thứ tự gọi: event/workflow/playlist-scope.js. Đọc thời lượng file mới: event/workflow/audio-duration.js.
 * Chốt FileList + reset input upload nằm ở event/listener/playlist.js (timing của sự kiện 'change').
 */

        // ===================== Menu "Thêm nhạc": Chọn file / Chọn cả thư mục =====================
        // Dùng chung #song-action-overlay để đóng khi bấm ra ngoài (mỗi lúc chỉ 1 trong #song-action-menu /
        // #upload-action-menu hiện). 2 mục là <label> bọc input thật (components/playlist-view.js) — click label tự mở hộp
        // chọn file, không gọi input.click() bằng JS. Đóng menu sau khi bấm label: workflowPlaylist.closeUploadMenuAfterLabelClick().
        function closeUploadActionMenu() {
            uploadActionMenu.classList.add('hidden');
            songActionOverlay.classList.add('hidden');
        }

        /** Mở menu "Thêm nhạc", neo dưới #btn-upload-audio (lật lên nếu tràn đáy màn hình). */
        function openUploadActionMenu() {
            const rect = btnUploadAudio.getBoundingClientRect();
            const menuWidth = 208;
            let left = rect.right - menuWidth;
            if (left < 8) left = 8;
            let top = rect.bottom + 8;
            const viewportH = window.innerHeight || 800;
            if (top + 110 > viewportH) top = rect.top - 110 - 8;
            uploadActionMenu.style.left = `${left}px`;
            uploadActionMenu.style.top = `${top}px`;
            uploadActionMenu.classList.remove('hidden');
            songActionOverlay.classList.remove('hidden');
        }

        /** Thời lượng đọc từ thẻ `<audio>` tạm: số hữu hạn -> giữ, còn lại (NaN/Infinity/lỗi/hết giờ) -> 0.
         * @param {number} duration @returns {number} */
        function resolveProbedAudioDuration(duration) {
            return Number.isFinite(duration) ? duration : 0;
        }

        /**
         * Shape dựng cache cho Video/Photo — chỉ dữ liệu, không chứa hàm. Thêm loại media mới: 1 entry ở đây + 1 entry
         * `MEDIA_DB_ACCESSOR` (event/workflow/playlist-scope.js).
         * - `coverFromOwnBlob`: thiếu `thumbBlob` thì dùng chính `record.blob` làm bìa (Photo) hay để null (Video).
         * - `durationFallback`: `record.duration || durationFallback`. Photo = 5, khớp `DURATION_MIN_SEC`
         *   (core/file-manager/image.js) — đổi hằng đó thì sửa theo.
         * - `extraFields`: field phụ copy thẳng từ record (thiếu -> 0) — Photo có `width`/`height` (modal Chi tiết, nhãn "WxH").
         * - `logLabel`: nhãn trong console.log.
         */
        const MEDIA_ADAPTER_SHAPE = {
            video: { coverFromOwnBlob: false, durationFallback: 0, extraFields: [], logLabel: 'Video' },
            photo: { coverFromOwnBlob: true, durationFallback: 5, extraFields: ['width', 'height'], logLabel: 'Photo' },
        };

        /**
         * Thay toàn bộ `playlistCache`/`songNameIndex` bằng record Video/Photo, chuẩn hoá về đúng shape của Song (render,
         * sort, tìm kiếm, Filter dùng chung). Record thiếu blob gốc bị bỏ. `cover` là Blob thô — node Playlist tự tạo/thu
         * hồi object URL lúc render.
         * @param {Array<{key:string, blob:Blob, thumbBlob?:Blob, width?:number, height?:number, duration?:number, filename:string, album?:string|null, addedAt:number}>} records
         * @param {'video'|'photo'} mediaType
         * @param {string[]} titles - tên hiển thị từng record (customName, hoặc filename bỏ đuôi), cùng chỉ số với `records`
         * @param {string[]} nameKeys - `normalizeSongName(titles[i])` (core/song-search.js), cùng chỉ số
         * @returns {string[]} key đã nạp, đúng thứ tự records (chưa sort)
         */
        function buildAdaptedPlaylistCache(records, mediaType, titles, nameKeys) {
            const shape = MEDIA_ADAPTER_SHAPE[mediaType];
            const entries = [];
            const names = [];
            records.forEach((record, i) => {
                if (!record.blob) return; // record hỏng/thiếu blob gốc
                const entry = {
                    filename: record.filename,
                    tag: { title: titles[i], artist: '', album: record.album || '' },
                    cover: record.thumbBlob || (shape.coverFromOwnBlob ? record.blob : null),
                    duration: record.duration || shape.durationFallback,
                    addedAt: record.addedAt,
                    mediaType,
                    size: record.blob.size || 0,
                };
                shape.extraFields.forEach((field) => { entry[field] = record[field] || 0; });
                entries.push([record.key, entry]);
                names.push([record.key, nameKeys[i]]);
            });
            appState.mutate('playlistCache', (m) => { m.clear(); entries.forEach(([key, entry]) => m.set(key, entry)); });
            console.log(`writer: "buildAdaptedPlaylistCache", page: "playlistCache", content: "nạp lại ${entries.length} ${shape.logLabel}"`);
            appState.mutate('songNameIndex', (m) => { m.clear(); names.forEach(([key, name]) => m.set(key, name)); });
            console.log(`writer: "buildAdaptedPlaylistCache", page: "songNameIndex", content: "nạp lại ${names.length} ${shape.logLabel}"`);
            return entries.map(([key]) => key);
        }

        /**
         * Lọc record Song hợp lệ: chưa bị đánh dấu hỏng (`confirmedBrokenKeys`, xác nhận qua modal lỗi lúc phát), có `blob`
         * + `tag`, MIME hợp lệ (`isQuickValidMime()`, service/db.js — tiện ích thuần). Video/Photo chỉ cần guard `!record.blob`
         * trong `buildAdaptedPlaylistCache()`.
         * @param {Array<{key:string, blob?:Blob, tag?:object}>} records @param {Set<string>} confirmedBrokenKeys
         * @returns {Array} record hợp lệ, giữ nguyên thứ tự
         */
        function filterValidSongRecords(records, confirmedBrokenKeys) {
            return records.filter((record) =>
                !confirmedBrokenKeys.has(record.key) &&
                record.blob &&
                record.tag &&
                isQuickValidMime(record.blob.type)
            );
        }

        /**
         * Thay toàn bộ `playlistCache`/`songNameIndex` bằng record Song. Khác Video/Photo: `tag`/`cover` là dữ liệu ID3 thật
         * (đọc lúc upload), dùng thẳng. `mediaType: 'song'` bắt buộc — các bảng tra theo loại media (vd
         * `MEDIA_DELETE_ACCESSOR`, event/workflow/playlist.js) cần giá trị thật.
         * @param {Array<{key:string, blob:Blob, tag:object, cover?:Blob, duration:number, filename:string, addedAt:number}>} records - đã qua `filterValidSongRecords()`
         * @param {string[]} nameKeys - `normalizeSongName(records[i].tag.title)` (core/song-search.js), cùng chỉ số
         * @returns {string[]} key đã nạp, đúng thứ tự records (chưa sort)
         */
        function buildSongPlaylistCache(records, nameKeys) {
            appState.mutate('playlistCache', (m) => {
                m.clear();
                records.forEach((record) => m.set(record.key, {
                    filename: record.filename,
                    tag: record.tag,
                    cover: record.cover,
                    duration: record.duration,
                    addedAt: record.addedAt,
                    size: record.blob.size || 0,
                    mediaType: 'song',
                }));
            });
            console.log(`writer: "buildSongPlaylistCache", page: "playlistCache", content: "nạp lại ${records.length} bài hát"`);
            appState.mutate('songNameIndex', (m) => { m.clear(); records.forEach((record, i) => m.set(record.key, nameKeys[i])); });
            console.log(`writer: "buildSongPlaylistCache", page: "songNameIndex", content: "nạp lại ${records.length} bài hát"`);
            return records.map((record) => record.key);
        }
