/**
 * service/state/playlist.js — Package STATE domain "playlist" (tách từ service/state.js, đợt
 * tái cấu trúc state 25/07/2026).
 *
 * Đăng ký qua `AppState.definePackage('playlist', { schema, buildDefaults })` — KHÔNG tự gộp vào
 * STATE sống ngay lúc nạp file này. Trang nào cần domain này PHẢI liệt kê 'playlist' trong
 * `appState.registry(account, [...])` (xem service/state/record/*.js) — lúc đó AppState mới thật
 * sự dựng STATE_SCHEMA/STATE từ package này. Xem docstring đầy đủ cơ chế ở service/state.js.
 *
 * PHẢI nạp SAU service/state.js (cần class AppState đã tồn tại).
 */
        /**
         * Khung mặc định của `playlistFilterConfig` — DANH SÁCH field hợp lệ theo từng Nguồn (song
         * có 3 field text + 4 field số/ngày; video CHỈ 1 field text "name" + CÙNG 4 field số/ngày
         * — video không có album/artist). Mọi field khởi tạo `null` (chưa áp filter nào). Đây LÀ
         * nguồn sự thật DUY NHẤT cho "field nào hợp lệ theo Nguồn" — core/playlist/filter.js (áp
         * dụng) và components/playlist-filter-drawer.js (dựng UI) đều đối chiếu ĐÚNG danh sách này
         * (lặp lại tên field ở đó cho mục đích dựng template tĩnh, KHÔNG import chéo — service/
         * state/ không phụ thuộc core/components, xem why-no-es6-module.md).
         */
        function clonePlaylistFilterConfigDefaults() {
            return {
                song: { name: null, album: null, artist: null, addedAt: null, count: null, totalTime: null, size: null, duration: null },
                video: { name: null, addedAt: null, count: null, totalTime: null, size: null, duration: null },
            };
        }

        AppState.definePackage('playlist', {
            schema: {
                playlistOrder: 'array',
                displayOrder: 'array',
                renderOrder: 'array',
                playlistCache: 'map',
                songNameIndex: 'map',
                confirmedBrokenKeys: 'set',
                currentKey: 'nullable-string',
                displaySortMode: 'string',
                pendingResortKeys: 'set',
                searchQuery: 'string',
                domNodesByKey: 'map',
                // MỚI (ver12 "Song/Video Unification", Batch 1, xem
                // plan-v12-song-video-unification.md mục 1) — 'song' | 'video'. Quyết định Playlist
                // đang browse nguồn nào (đổi qua Settings → Playlist → "Nguồn", xem event/workflow/
                // playlist.js::switchToVideoSource()/switchToSongSource()). Mặc định 'song' — hành
                // vi/UI hiện có của Song KHÔNG đổi gì khi field này giữ nguyên giá trị mặc định.
                activeMediaSource: 'string',
                // MỚI (Sort subpanel, mục 1b/1c) — trục sắp xếp THỨ 2, ĐỘC LẬP với displaySortMode
                // (trục tên/ngày ở trên) — xem core/playlist/order.js::sortKeysByMode(). 'none' =
                // không áp trục này (chỉ còn displaySortMode quyết định, hành vi CŨ giữ nguyên).
                // 'countDesc'|'countAsc'|'timesDesc'|'timesAsc' = trục CHÍNH, displaySortMode chỉ
                // còn vai trò phá thế bằng (tie-break) khi 2 bài có count/times bằng nhau.
                displayStatSortMode: 'string',
                // MỚI (Filter subpanel, mục 1d) — CHỈ áp dụng lúc playlistOrder được TÍNH LẠI (boot/
                // đổi Nguồn/đổi Scope — xem workflowPlaylist.switchToSongSource()/switchToVideoSource(),
                // workflowPlaylistScope.applyFolderScope()/applyAllSongsScope()), KHÔNG đụng
                // renderOrder/ô tìm kiếm (2 cơ chế TÁCH BIỆT, xem core/playlist/filter.js). Cấu
                // trúc: { song: { <field>: rule|null }, video: { <field>: rule|null } } — field rỗng
                // (null) = không áp. Xem DEFAULT_PLAYLIST_FILTER_CONFIG (core/playlist/filter.js)
                // cho danh sách field hợp lệ theo từng Nguồn.
                playlistFilterConfig: 'object',
            },
            buildDefaults() {
                return {
                    playlistOrder: [],
                    displayOrder: [],
                    renderOrder: [],
                    playlistCache: new Map(),
                    songNameIndex: new Map(),
                    confirmedBrokenKeys: new Set(),
                    currentKey: null,
                    displaySortMode: 'az',
                    pendingResortKeys: new Set(),
                    searchQuery: '',
                    domNodesByKey: new Map(),
                    activeMediaSource: 'song',
                    displayStatSortMode: 'none',
                    playlistFilterConfig: clonePlaylistFilterConfigDefaults(),
                };
            },
        });

        /** Ảnh đĩa vinyl mặc định (SVG base64) — dùng khi bài hát không có ảnh bìa riêng. Chỉ
         * domain playlist dùng (render.js/actions.js/loader.js) — không thuộc CONST dùng chung. */
        const DEFAULT_VINYL = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0OCIgZmlsbD0iIzFlMjkzYiIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjE2IiBmaWxsPSIjMGYxNzJhIi8+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iMTUiIGZpbGw9IiNjYmQ1ZTEiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0IiBmaWxsPSIjMGYxNzJhIi8+PC9zdmc+';
