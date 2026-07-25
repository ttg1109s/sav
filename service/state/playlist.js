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
                };
            },
        });

        /** Ảnh đĩa vinyl mặc định (SVG base64) — dùng khi bài hát không có ảnh bìa riêng. Chỉ
         * domain playlist dùng (render.js/actions.js/loader.js) — không thuộc CONST dùng chung. */
        const DEFAULT_VINYL = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0OCIgZmlsbD0iIzFlMjkzYiIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjE2IiBmaWxsPSIjMGYxNzJhIi8+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iMTUiIGZpbGw9IiNjYmQ1ZTEiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0IiBmaWxsPSIjMGYxNzJhIi8+PC9zdmc+';
