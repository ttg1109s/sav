/**
 * service/state/listen-stats.js — Package STATE domain "listen-stats". Xem cơ chế package ở
 * service/state.js. PHẢI nạp SAU service/state.js.
 *
 * SỬA (06/10/2026, plan-media-db-split.md mục 6.1, Giang chốt "nằm trong state"):
 *   - `mediaStatsMap`: key RAM đổi sang `type:key` (vd "song:bai-a") — xem core/listen-stats.js::mediaStatsKey().
 *   - `_songStatsDirty` (boolean — ghi lại TOÀN BỘ map mỗi lần) -> `mediaStatsDirtyKeys` (Set key `type:key` vừa đổi —
 *     chỉ ghi đúng meta của các media đó, xem event/workflow/listen-stats.js::flush()).
 */
        AppState.definePackage('listen-stats', {
            schema: {
                mediaStatsMap: 'map',
                mediaStatsDirtyKeys: 'set',
            },
            buildDefaults() {
                return {
                    mediaStatsMap: new Map(),
                    mediaStatsDirtyKeys: new Set(),
                };
            },
        });

        // LISTEN_CLOCK_TASK — khai ở event/workflow/listen-stats.js (đồng hồ nghe dời từ core/player-controls.js, 06/10/2026).
