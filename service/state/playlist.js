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
         * — video không có album/artist; photo CHỈ 1 field text "name" + 3 field số/ngày — CHỐT
         * Giang: bỏ hẳn totalTime/duration cho Photo, ảnh không có khái niệm "lượt nghe/tổng thời
         * gian nghe" hay "thời lượng"). Mọi field khởi tạo `null` (chưa áp filter nào). Đây LÀ
         * nguồn sự thật DUY NHẤT cho "field nào hợp lệ theo Nguồn" — core/playlist/filter.js (áp
         * dụng) và components/playlist-filter-drawer.js (dựng UI) đều đối chiếu ĐÚNG danh sách này
         * (lặp lại tên field ở đó cho mục đích dựng template tĩnh, KHÔNG import chéo — service/
         * state/ không phụ thuộc core/components, xem why-no-es6-module.md).
         */
        function clonePlaylistFilterConfigDefaults() {
            // SỬA (Giang yêu cầu — "filter/search hỗ trợ field Album của video/photo") — thêm
            // `album` cho video/photo (TRƯỚC ĐÂY chỉ Song có); thêm `duration` cho photo (TRƯỚC ĐÂY
            // ẩn hẳn — Photo giờ có duration THẬT, xem components/playlist-filter-drawer.js).
            // `totalTime`/`artist` VẪN không thêm cho photo/video (không áp dụng — CHỐT Giang).
            return {
                song: { name: null, album: null, artist: null, addedAt: null, count: null, totalTime: null, size: null, duration: null },
                video: { name: null, album: null, addedAt: null, count: null, totalTime: null, size: null, duration: null },
                photo: { name: null, album: null, addedAt: null, count: null, size: null, duration: null },
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
                // playlist.js::switchSource()). Mặc định 'song' — hành
                // vi/UI hiện có của Song KHÔNG đổi gì khi field này giữ nguyên giá trị mặc định.
                activeMediaSource: 'string',
                // SỬA (mục 3, phản hồi Giang — "đổi tên Listening stats thành Stats, tách field/
                // hướng thành 2 dropdown riêng thay vì gộp 8 giá trị") — THAY displayStatSortMode
                // (1 enum gộp field+hướng, VD 'countDesc') bằng 2 field riêng, khớp đúng UI 2
                // dropdown (components/playlist-sort-drawer.js): dropdown (1) chọn field — 'none'|
                // 'count'|'times'|'size'|'duration'; dropdown (2) chọn hướng — 'desc'|'asc' — CHỈ
                // hiện/có ý nghĩa khi field khác 'none'. field='none' -> chỉ còn displaySortMode
                // (trục tên/ngày) quyết định, hành vi CŨ giữ nguyên. field khác 'none' -> LÀ trục
                // CHÍNH, displaySortMode chỉ còn vai trò phá thế bằng (tie-break) khi bằng nhau —
                // xem core/playlist/order.js::sortKeysByMode().
                displayStatSortField: 'string',
                displayStatSortDirection: 'string',
                // MỚI (Filter subpanel, mục 1d) — CHỈ áp dụng lúc playlistOrder được TÍNH LẠI (boot/
                // đổi Nguồn/đổi Scope — xem workflowPlaylist.switchSource(),
                // workflowPlaylistScope.applyFolderScope()/applyAllSongsScope()), KHÔNG đụng
                // renderOrder/ô tìm kiếm (2 cơ chế TÁCH BIỆT, xem core/playlist/filter.js). Cấu
                // trúc: { song: { <field>: rule|null }, video: { <field>: rule|null } } — field rỗng
                // (null) = không áp. Xem DEFAULT_PLAYLIST_FILTER_CONFIG (core/playlist/filter.js)
                // cho danh sách field hợp lệ theo từng Nguồn.
                playlistFilterConfig: 'object',
                // MỚI (08/09/2026, "Playlist Filter Presets" — thay hệ 1-bộ-rule-sống bằng preset
                // đặt tên, mirror hệ preset EQ/Motion) — `playlistFilterConfig` ở trên GIỜ LÀ giá
                // trị SỐNG SUY RA (KHÔNG còn tự lưu bền riêng, đọc bởi applyPlaylistFilter() như cũ,
                // KHÔNG đổi gì ở phía đọc) — được `workflowPlaylistFilterPresets._recomputeLiveConfig()`
                // (event/workflow/playlist-filter-presets.js) tính lại mỗi lúc boot/chọn preset.
                // SỬA (09/09/2026, phản hồi Giang — "mỗi source media 1 list filter khác nhau + mỗi
                // source có filter active khác nhau", tham khảo mẫu `activePlayListFolder` —
                // service/state/file-manager.js) — `playlistFilterPresets`/
                // `playlistFilterActivePresetId` giờ là OBJECT keyed theo Nguồn {song,video,photo}
                // (KHÔNG còn mảng/id PHẲNG dùng chung mọi Nguồn) — MỖI Nguồn có danh sách preset
                // RIÊNG + preset active RIÊNG. `playlistFilterPresets[source]` — mảng {id,name,
                // config} (config CHÍNH LÀ bucket rule của Nguồn đó, KHÔNG còn ôm cả 3 Nguồn như
                // bản 08/09 — xem docstring core/playlist/filter-presets.js).
                // `playlistFilterActivePresetId[source]` — preset ĐANG áp dụng cho Nguồn đó (null =
                // chưa chọn — KHÔNG còn công tắc tổng riêng, preset active TỰ LÀ trạng thái bật/
                // tắt). Thiếu preset active hợp lệ cho Nguồn nào thì
                // `playlistFilterConfig[source]` suy ra rỗng (hành vi giống hệt "chưa có Filter"
                // cho ĐÚNG Nguồn đó — Nguồn khác không ảnh hưởng).
                playlistFilterPresets: 'object',
                playlistFilterActivePresetId: 'object',
                // MỚI (09/09/2026, phản hồi Giang — "sửa preset đang active mà CHƯA bấm Áp dụng lại
                // thì KHÔNG được đổi filter thật đang chạy, chỉ preset lưu thay đổi thôi") — "ảnh
                // chốt" (snapshot), keyed theo Nguồn CÙNG 2 field trên — `playlistFilterAppliedConfig
                // [source]` = config lúc `selectPreset()` (nút "Chọn áp dụng") chạy LẦN GẦN NHẤT CHO
                // NGUỒN ĐÓ — TÁCH HẲN khỏi `playlistFilterPresets[source][i].config` (bản ĐANG sửa
                // dở, ghi thẳng mỗi lần đổi field, xem workflowPlaylistFilterPresets.setFilterField()).
                // `_recomputeLiveConfig()` đọc TỪ ĐÂY (KHÔNG đọc thẳng preset.config nữa) — sửa
                // field của preset đang active vẫn LƯU BÌNH THƯỜNG (không mất khi rời màn Edit) nhưng
                // filter thật sự áp dụng giữ NGUYÊN bản cũ tới khi bấm lại "Chọn áp dụng" (chụp ảnh
                // chốt MỚI, ghi đè field này). Field này VẪN CÙNG SHAPE `clonePlaylistFilterConfigDefaults()`
                // ({song:{...},video:{...},photo:{...}}) như trước — KHÔNG cần đổi vì đã sẵn keyed
                // theo Nguồn từ đầu.
                playlistFilterAppliedConfig: 'object',
                // MỚI (09/09/2026, phản hồi Giang — "checkbox 'có áp dụng cho thư mục hay không',
                // mặc định bật") — snapshot CỦA `preset.appliesToFolder` lúc `selectPreset()` chạy
                // lần gần nhất, keyed theo Nguồn CÙNG khuôn 3 field trên — TÁCH KHỎI
                // `playlistFilterPresets[source][i].appliesToFolder` (bản đang sửa dở) giống hệt
                // cách `playlistFilterAppliedConfig` tách khỏi `preset.config` — sửa checkbox của
                // preset đang active KHÔNG tự đổi hành vi thật cho tới khi bấm lại "Chọn áp dụng"/
                // "Cập nhật". Đọc bởi event/workflow/playlist-scope.js::applyFolderScope() — tắt
                // (`false`) thì Nguồn đó KHÔNG áp Filter lúc đang xem 1 thư mục cụ thể (vẫn áp bình
                // thường lúc xem "Tất cả", applyAllSongsScope() không đọc field này).
                playlistFilterAppliesToFolder: 'object',
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
                    displayStatSortField: 'none',
                    displayStatSortDirection: 'desc',
                    playlistFilterConfig: clonePlaylistFilterConfigDefaults(),
                    playlistFilterPresets: { song: [], video: [], photo: [] },
                    playlistFilterActivePresetId: { song: null, video: null, photo: null },
                    playlistFilterAppliedConfig: clonePlaylistFilterConfigDefaults(),
                    playlistFilterAppliesToFolder: { song: true, video: true, photo: true },
                };
            },
        });

        /** Ảnh đĩa vinyl mặc định (SVG base64) — dùng khi bài hát không có ảnh bìa riêng. Chỉ
         * domain playlist dùng (render.js/actions.js/loader.js) — không thuộc CONST dùng chung. */
        const DEFAULT_VINYL = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0OCIgZmlsbD0iIzFlMjkzYiIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjE2IiBmaWxsPSIjMGYxNzJhIi8+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iMTUiIGZpbGw9IiNjYmQ1ZTEiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0IiBmaWxsPSIjMGYxNzJhIi8+PC9zdmc+';
