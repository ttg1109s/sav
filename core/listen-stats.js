/**
 * listen-stats.js — Thống kê NGHE RIÊNG TỪNG BÀI (mục 6 v6): mỗi bài có { count, totalTime }
 *   - count     : số lần bắt đầu phát bài đó (tăng khi playSong sang bài mới).
 *   - totalTime : tổng số giây đã thực sự nghe bài đó (cộng dồn theo delta thời gian thực ở
 *                 timeupdate, giống cách tính tổng `totalListenSeconds` toàn cục).
 *
 * LƯU Ở ĐÂU: trong store `meta` dưới 1 key gộp `songStats` = { [songKey]: {count, totalTime} },
 * KHÔNG nhét vào record bài hát. Lý do: record bài hát chứa cả `blob` mp3 (vài MB) — ghi đè record
 * mỗi 5 giây để cập nhật totalTime sẽ phải ghi lại cả blob, rất tốn I/O và dễ gây giật. Tách ra
 * 1 object nhẹ, ghi debounce, thì cập nhật liên tục vẫn mượt. Về mặt dữ liệu, mỗi bài vẫn có đúng
 * "key {count, totalTime}" như yêu cầu — chỉ là cư trú ở store meta cho hợp lý về hiệu năng.
 *
 * PHẢI nạp SAU db.js (cần getMeta/setMeta) và TRƯỚC playlist/* + player-controls.js (các file đó
 * gọi bumpSongPlayCount / addSongListenTime / getSongStats / removeSongStats / formatListenTime).
 */
        // mediaStatsMap, _songStatsDirty — STATE, xem service/state.js

        async function loadSongStats() {
            try {
                const raw = await getMeta('songStats');
                const map = new Map();
                if (raw && typeof raw === 'object') {
                    for (const k of Object.keys(raw)) {
                        const v = raw[k] || {};
                        map.set(k, { count: v.count || 0, totalTime: v.totalTime || 0 });
                    }
                }
                appState.set('mediaStatsMap', map);
            } catch (e) { console.warn('[listen-stats] Không đọc được songStats:', e); appState.set('mediaStatsMap', new Map()); }
        }

        function getSongStats(key) {
            const s = appState.get('mediaStatsMap').get(key);
            return s ? { count: s.count, totalTime: s.totalTime } : { count: 0, totalTime: 0 };
        }

        function _ensureStats(key) {
            let s = appState.get('mediaStatsMap').get(key);
            if (!s) { s = { count: 0, totalTime: 0 }; appState.mutate('mediaStatsMap', m => m.set(key, s), { skipCheck: true }); }
            return s;
        }

        function bumpSongPlayCount(key) {
            if (!key) return;
            appState.mutate('mediaStatsMap', m => { _ensureStats(key); m.get(key).count += 1; });
            scheduleSongStatsSave();
        }

        function addSongListenTime(key, seconds) {
            if (!key || !(seconds > 0)) return;
            appState.mutate('mediaStatsMap', m => { _ensureStats(key); m.get(key).totalTime += seconds; }, { skipCheck: true }); // chạy mỗi giây qua _listenTick() — bỏ qua validate để đảm bảo hiệu năng
            scheduleSongStatsSave();
        }

        function removeSongStats(key) {
            let deleted = false;
            appState.mutate('mediaStatsMap', m => { deleted = m.delete(key); });
            if (deleted) scheduleSongStatsSave(true);
        }

        function clearAllSongStats() {
            appState.set('mediaStatsMap', new Map());
            // Ghi thẳng object rỗng (không debounce) để Quản lý dung lượng thấy kết quả ngay.
            return setMeta('songStats', {});
        }

        /** Ghi debounce (mặc định 4s gom nhiều cập nhật thành 1 lần ghi). immediate=true ghi ngay. */
        function scheduleSongStatsSave(immediate) {
            appState.set('_songStatsDirty', true, { skipCheck: true }); // có thể gọi từ addSongListenTime (mỗi giây) — bỏ qua validate để đảm bảo hiệu năng
            if (immediate) { flushSongStats(); return; }
            // QUAN TRỌNG: giữ đúng hành vi THROTTLE cũ — chỉ đặt task nếu CHƯA có task nào đang chờ
            // (không phải debounce/reset-mỗi-lần-gọi). taskManager.once() với tên cố định sẽ TỰ HUỶ
            // + đặt lại từ đầu nếu gọi lại khi task cùng tên đang chạy (đúng cho debounce, SAI cho
            // throttle) — nên ở đây phải tự kiểm tra `taskManager.plan` trước, không gọi once() lại
            // nếu task đã tồn tại, để mốc 4s tính từ LẦN GỌI ĐẦU TIÊN không bị đẩy lùi liên tục.
            if (taskManager.plan['songStatsSaveFlush']) return;
            taskManager.once(flushSongStats, 4000, 'songStatsSaveFlush');
        }

        function flushSongStats() {
            taskManager.kill('songStatsSaveFlush');
            if (!appState.get('_songStatsDirty')) return;
            appState.set('_songStatsDirty', false);
            const obj = {};
            for (const [k, v] of appState.get('mediaStatsMap').entries()) obj[k] = { count: v.count, totalTime: v.totalTime };
            setMeta('songStats', obj).catch(e => console.warn('[listen-stats] Lưu songStats lỗi:', e));
        }

        /** Định dạng thời gian nghe thân thiện: "1 giờ 5 phút", "12 phút 30 giây", "45 giây". */
        function formatListenTime(totalSeconds) {
            const s = Math.floor(totalSeconds || 0);
            if (s <= 0) return t('common.listenTime.zero');
            const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60;
            if (h > 0) return tFormat('common.listenTime.hourMinute', { h, m });
            if (m > 0) return tFormat('common.listenTime.minuteSecond', { m, s: sec });
            return tFormat('common.listenTime.secondOnly', { s: sec });
        }
