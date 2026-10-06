/**
 * event/workflow/listen-stats.js — Workflow "listenStats" (MỚI 06/10/2026, plan-media-db-split.md mục 6, Giang duyệt —
 * Lượt 3): thống kê nghe/xem từng media + đồng hồ nghe.
 *
 * DỜI từ 2 file core (vi phạm Rule 2/3b — core tự appState.get, tự đọc DB, tự hẹn giờ):
 *   - core/listen-stats.js: loadSongStats/getSongStats/bumpSongPlayCount/addSongListenTime/removeSongStats/
 *     clearAllSongStats/scheduleSongStatsSave/flushSongStats -> loadAll/getStats/bumpPlayCount/addListenTime/forget/
 *     forgetType/_scheduleSave/flush (mọi API nhận thêm `type`).
 *   - core/player-controls.js: startListenClock/stopListenClock/_listenTick -> startClock/stopClock/_tick.
 *
 * LƯU: `stats = { count, totalTime }` trong META từng media (updateMediaMetaBatch, service/db.js — chỉ store meta). RAM:
 * `mediaStatsMap` key `type:key`. Ghi THROTTLE 4s như cũ (mốc tính từ lần đổi ĐẦU, không bị đẩy lùi), chỉ ghi các key
 * trong `mediaStatsDirtyKeys` (thường đúng 1 media đang phát). Media đã bị xoá thì lượt ghi tự bỏ qua (`notFound`).
 * Tổng giây nghe toàn app (`meta.totalListenSeconds`) giữ nguyên cơ chế cũ.
 *
 * NẠP SAU: service/db.js, service/state/listen-stats.js, core/listen-stats.js, core/playlist/render.js
 * (resolvePlayingMediaType — chỉ cần lúc chạy).
 */

const LISTEN_CLOCK_TASK = 'listenClock';
const LISTEN_STATS_SAVE_TASK = 'songStatsSaveFlush';

const workflowListenStats = {

    /** Boot (event/workflow/app-boot.js) — dựng `mediaStatsMap` từ meta của cả 3 loại (không mở Blob). */
    async loadAll() {
        try {
            const [song, video, photo] = await Promise.all(['song', 'video', 'photo'].map((type) => getAllMediaMeta(type))); // service/db.js
            const map = buildMediaStatsMap({ song, video, photo }); // core/listen-stats.js
            appState.set('mediaStatsMap', map);
            console.log(`writer: "workflowListenStats.loadAll", page: "mediaStatsMap", content: "${map.size} media có thống kê"`);
        } catch (e) {
            console.warn('[listen-stats] Không đọc được thống kê:', e);
            appState.set('mediaStatsMap', new Map());
        }
    },

    /** @param {'song'|'video'|'photo'} type @param {string} key @returns {{count: number, totalTime: number}} */
    getStats(type, key) {
        const stats = appState.get('mediaStatsMap').get(mediaStatsKey(type, key)); // core/listen-stats.js
        return stats ? { count: stats.count, totalTime: stats.totalTime } : { count: 0, totalTime: 0 };
    },

    /** +1 lượt phát/xem. @param {'song'|'video'|'photo'} type @param {string} key */
    bumpPlayCount(type, key) {
        if (!key) return;
        const statsKey = mediaStatsKey(type, key);
        appState.mutate('mediaStatsMap', (m) => {
            const current = m.get(statsKey) || { count: 0, totalTime: 0 };
            m.set(statsKey, { count: current.count + 1, totalTime: current.totalTime });
        });
        console.log(`writer: "workflowListenStats.bumpPlayCount", page: "mediaStatsMap", content: "${statsKey} +1"`);
        this._markDirty(statsKey);
        this._scheduleSave();
    },

    /** Cộng giây đã nghe — gọi MỖI GIÂY từ `_tick()`: bỏ validate (`skipCheck`) + không log từng lượt để giữ hiệu năng
     * (cùng ngoại lệ bản cũ). @param {'song'|'video'|'photo'} type @param {string} key @param {number} seconds */
    addListenTime(type, key, seconds) {
        if (!key || !(seconds > 0)) return;
        const statsKey = mediaStatsKey(type, key);
        appState.mutate('mediaStatsMap', (m) => {
            const current = m.get(statsKey) || { count: 0, totalTime: 0 };
            m.set(statsKey, { count: current.count, totalTime: current.totalTime + seconds });
        }, { skipCheck: true });
        this._markDirty(statsKey);
        this._scheduleSave();
    },

    /** Media vừa bị xoá hẳn — chỉ dọn RAM (thống kê trong DB mất cùng record). */
    forget(type, key) {
        const statsKey = mediaStatsKey(type, key);
        appState.mutate('mediaStatsMap', (m) => m.delete(statsKey));
        appState.mutate('mediaStatsDirtyKeys', (s) => s.delete(statsKey), { skipCheck: true });
        console.log(`writer: "workflowListenStats.forget", page: "mediaStatsMap", content: "-${statsKey}"`);
    },

    /** Xoá sạch thư viện 1 loại (Storage Management) — dọn RAM đúng loại đó. Trước đây "Xoá hết Song" xoá luôn thống kê của
     * Video/Photo (key gộp dùng chung) — giờ chỉ đúng loại. @param {'song'|'video'|'photo'} type */
    forgetType(type) {
        const prefix = `${type}:`;
        appState.mutate('mediaStatsMap', (m) => { [...m.keys()].filter((k) => k.startsWith(prefix)).forEach((k) => m.delete(k)); });
        appState.mutate('mediaStatsDirtyKeys', (s) => { [...s].filter((k) => k.startsWith(prefix)).forEach((k) => s.delete(k)); }, { skipCheck: true });
        console.log(`writer: "workflowListenStats.forgetType", page: "mediaStatsMap", content: "xoá mọi key ${prefix}*"`);
    },

    /** Ghi các key bẩn xuống meta NGAY (unload — event/tab.js; hoặc hết 4s throttle). Best-effort. */
    flush() {
        taskManager.kill(LISTEN_STATS_SAVE_TASK);
        const dirtyKeys = appState.get('mediaStatsDirtyKeys');
        if (dirtyKeys.size === 0) return;
        const statsMap = appState.get('mediaStatsMap');
        const items = [...dirtyKeys]
            .filter((statsKey) => statsMap.has(statsKey))
            .map((statsKey) => {
                const { type, key } = parseMediaStatsKey(statsKey); // core/listen-stats.js
                const source = statsMap.get(statsKey);
                const stats = { count: source.count, totalTime: source.totalTime }; // chốt giá trị NGAY lúc flush
                return { type, key, mutate: (meta) => ({ ...meta, stats }) };
            });
        appState.set('mediaStatsDirtyKeys', new Set());
        console.log(`writer: "workflowListenStats.flush", page: "mediaStatsDirtyKeys", content: "ghi ${items.length} media"`);
        updateMediaMetaBatch(items).catch((e) => console.warn('[listen-stats] Lưu thống kê lỗi:', e)); // service/db.js
    },

    _markDirty(statsKey) {
        appState.mutate('mediaStatsDirtyKeys', (s) => s.add(statsKey), { skipCheck: true }); // gọi mỗi giây — bỏ validate
    },

    /** THROTTLE (không phải debounce): chỉ đặt task nếu CHƯA có task chờ — mốc 4s tính từ lần đổi ĐẦU TIÊN (taskManager.once()
     * cùng tên sẽ tự huỷ + đặt lại từ đầu, nên phải tự kiểm `taskManager.plan` trước). Giữ nguyên hành vi bản cũ. */
    _scheduleSave() {
        if (taskManager.plan[LISTEN_STATS_SAVE_TASK]) return;
        taskManager.once(() => this.flush(), 4000, LISTEN_STATS_SAVE_TASK);
    },

    // ===================== Đồng hồ nghe — DỜI từ core/player-controls.js (06/10/2026), logic giữ nguyên =====================
    // Đo bằng performance.now() (độc lập thanh tiến trình — seek/buffer/tốc độ phát không làm sai), task lặp 1s mode
    // 'timeout' CHỈ chạy khi media thật sự đang phát; cộng delta vào cả tổng (meta.totalListenSeconds) lẫn từng media. Mỗi
    // lần phát là 1 phiên MỚI (kill + addNew, không resume()).

    startClock() {
        taskManager.kill(LISTEN_CLOCK_TASK); // phòng còn sót từ phiên trước
        appState.set('_listenLastTick', (typeof performance !== 'undefined' ? performance.now() : Date.now()));
        taskManager.addNew(LISTEN_CLOCK_TASK, { time: 1000, exe: () => this._tick(), mode: 'timeout', count: 0 });
        taskManager.operator(LISTEN_CLOCK_TASK, 'enabled');
    },

    stopClock() {
        if (!taskManager.isTaskRunning(LISTEN_CLOCK_TASK)) return;
        this._tick(); // chốt nốt phần lẻ kể từ tick gần nhất trước khi dừng
        taskManager.kill(LISTEN_CLOCK_TASK);
    },

    /** Chạy mỗi giây — ghi state bỏ validate (`skipCheck`) như bản cũ. Loại media đang phát lấy theo mode Player
     * (resolvePlayingMediaType) — key trùng giữa các loại không còn bị cộng nhầm. */
    _tick() {
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        let delta = (now - appState.get('_listenLastTick')) / 1000;
        appState.set('_listenLastTick', now, { skipCheck: true });
        if (!(delta > 0)) return;
        if (delta > 4) delta = 4; // tab bị treo/throttle nền rồi thức — không cộng vọt
        appState.set('pendingListenSeconds', appState.get('pendingListenSeconds') + delta, { skipCheck: true });
        const currentKey = appState.get('currentKey');
        const playingType = resolvePlayingMediaType(appState.get('isVideoPlayerMode'), appState.get('isPhotoPlayerMode')); // core/playlist/render.js
        if (currentKey) this.addListenTime(playingType, currentKey, delta);
        if (appState.get('pendingListenSeconds') < 5) return;
        const toFlush = appState.get('pendingListenSeconds');
        appState.set('pendingListenSeconds', 0, { skipCheck: true });
        // Best-effort — connection IndexedDB có thể bị hệ điều hành đóng lúc tab ẩn; luôn .catch() để không thành
        // "unhandled promise rejection" lặp mỗi giây (FIX log 9->10 của bản cũ).
        getMeta('totalListenSeconds')
            .then((v) => setMeta('totalListenSeconds', (v || 0) + toFlush))
            .catch((err) => console.warn('[listen-stats] Không ghi được totalListenSeconds (best-effort, bỏ qua):', err));
    },
};
