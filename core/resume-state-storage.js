/**
 * Resume State Storage — lưu/đọc trạng thái phát nhạc qua localStorage khi tab/app bị ẩn, dùng
 * CHUNG với cơ chế "ẩn tab -> reload trang thật NGAY -> hỏi tiếp tục nghe" (ver 10 refine #3).
 *
 * BỐI CẢNH — TẠI SAO ĐỔI CƠ CHẾ NÀY:
 * Bản gốc chỉ reset MỌI THỨ trong RAM lúc tab bị ẩn rồi để app tiếp tục SỐNG ở background (không
 * reload) — khi quay lại tab, hỏi tiếp tục nghe bằng cách gọi lại playSong() trên CHÍNH runtime cũ.
 * Vấn đề: runtime đó (AudioContext, taskManager, các task nền...) có thể đã bị trình duyệt/hệ điều
 * hành can thiệp không nhất quán trong lúc tab ẩn đủ lâu (suspend JS, đóng AudioContext, giải phóng
 * bộ nhớ...) — đúng nguyên nhân hành vi "lúc phát ra tiếng bình thường, lúc thì không" dù bấm đúng
 * nút: logic ĐÚNG, nhưng MÔI TRƯỜNG RUNTIME nó chạy trên có thể đã hỏng theo cách không đoán trước.
 *
 * SỬA (bản này): KHÔNG còn tự làm gì khác ngoài lưu state + reload — bỏ hẳn hành vi "tự thân" cũ
 * (pause/reset UI/forceBackToPlaylistUI/dọn loadingShield...) vì RELOAD THẬT đã tự dọn sạch toàn bộ
 * DOM/RAM, không cần làm thủ công nữa. Quy trình mới, đúng yêu cầu:
 *   1. Tab/app bị ẨN -> lưu state đầy đủ + ĐẶT CỜ (xem dưới) -> pause() audio -> XÁC NHẬN đã pause
 *      thật -> location.reload() NGAY LÚC ẨN (không đợi quay lại tab mới reload).
 *   2. Trang mới load lại -> ĐỌC CỜ ngay từ đầu (trước cả khi playlist load xong từ DB) -> nếu cờ
 *      bật, hiện modal "Tiếp tục nghe?" NGAY (song song với loading-shield/initPlaylistFromDB() chạy
 *      ngầm) — nhưng 2 nút "Tiếp tục phát"/"Nghe lại" bị TẠM KHOÁ cho tới khi playlist load xong.
 *   3. Modal được xử lý xong (1 trong 3 lựa chọn) -> CHỈ LÚC ĐÓ mới tắt cờ. Quan trọng: nếu người
 *      dùng để modal treo đó, hoặc lại bấm reload tay, hoặc lại ẩn/hiện tab nhiều lần — cờ vẫn y
 *      nguyên true, quy trình hỏi vẫn lặp lại đúng y, KHÔNG liên quan gì đến việc đã load hay chưa
 *      load xong snapshot/playlist. Đây tách biệt HOÀN TOÀN với readResumeStateFromLocalStorage()
 *      (đọc DATA) — cờ là nguồn quyết định DUY NHẤT cho "có cần hỏi hay không".
 *
 * 2 KEY LOCALSTORAGE TÁCH BIỆT (quan trọng — đây là điểm sửa chính so với bản trước):
 *   - RESUME_FLAG_KEY: chỉ chứa '1' hoặc không tồn tại. ĐÂY LÀ NGUỒN DUY NHẤT quyết định "có hiện
 *     modal hay không" lúc khởi động — không suy luận từ có/không có snapshot, không suy luận từ
 *     biến RAM nào (biến RAM luôn mất sau reload, không đáng tin). Bật lúc ẩn tab (NẾU có gì đang
 *     phát), tắt CHỈ khi 1 trong 3 lựa chọn của modal được xử lý xong.
 *   - RESUME_STATE_STORAGE_KEY: chứa toàn bộ DATA cần để phục hồi (bài, vị trí, shuffle, video,
 *     auto-switch-marks...). Có thể đọc nhiều lần, không tự xoá — KHÔNG quyết định việc hiện modal.
 *
 * PHẢI nạp SAU: config.js. Các hàm ở đây được gọi từ wakelock.js (lúc ẩn tab) và
 * draw-visualizer.js (lúc khởi động, NGAY sau loadConfig() — KHÔNG đợi initPlaylistFromDB()).
 */
        const RESUME_STATE_STORAGE_KEY = 'sav_pendingResumeState_v1';
        const RESUME_FLAG_KEY = 'sav_resumeFlag_v1';

        function setResumeFlag() { try { localStorage.setItem(RESUME_FLAG_KEY, '1'); } catch (e) {} }
        function clearResumeFlag() { try { localStorage.removeItem(RESUME_FLAG_KEY); } catch (e) {} }
        function hasResumeFlag() { try { return localStorage.getItem(RESUME_FLAG_KEY) === '1'; } catch (e) { return false; } }

        /**
         * Lưu snapshot tối thiểu để phục hồi đúng trạng thái phát — gọi NGAY lúc tab/app vừa bị ẩn,
         * TRƯỚC khi audioPlayer.pause() (cần đọc currentTime THẬT lúc còn đang phát).
         * localStorage.setItem đồng bộ + rất nhanh (không phải Promise/IndexedDB), an toàn ngay cả
         * khi trình duyệt sắp suspend JS ngay sau đó.
         *
         * Lưu CẢ playlistOrder/displayOrder/shuffleIndices (không chỉ currentKey) vì 2 lý do:
         *   1. isShuffle/repeatMode CHỈ SỐNG TRONG RAM (không qua saveConfig()) — mất hẳn qua reload
         *      nếu không tự lưu riêng ở đây.
         *   2. shuffleIndices random MỖI LẦN updateShuffleArray() chạy — để app tự build lại sau
         *      reload sẽ đổi khác hoàn toàn thứ tự Next/Prev đang nghe dở theo shuffle.
         * KHÔNG lưu playlistOrder gốc — IndexedDB (nguồn chân lý) đã có sẵn, initPlaylistFromDB()
         * tự build lại đúng, lưu thêm là dư thừa.
         *
         * Cũng lưu videoCurrentTime (vị trí video nền, CHỈ nếu đang bật) và
         * autoSwitchVisualMarksSnapshot (mảng mốc auto-switch-visual mode 'duration', CHỈ nếu đang ở
         * mode đó) — 2 thứ này có "vị trí/tiến trình" riêng mà initPlaylistFromDB()/
         * startAutoSwitchVisualBranch() sẽ KHÔNG tự tính lại đúng được sau reload (video luôn bắt
         * đầu lại từ 0; marks bị build mới hoàn toàn nếu không gán đè, xoá hết các mốc đã "nhớ" visual
         * của đoạn đã nghe qua, phá vỡ tính nhất quán "tua qua tua lại không đổi ngẫu nhiên").
         *
         * Trả về true nếu ĐÃ LƯU THẬT (có bài đang phát), false nếu không có gì để lưu hoặc lưu lỗi.
         */
        function saveResumeStateToLocalStorage() {
            if (typeof appState === 'undefined' || appState.get('currentKey') === null) return false; // không có gì đang phát -> không cần lưu
            try {
                const snapshot = {
                    v: 2,
                    savedAt: Date.now(),
                    currentKey: appState.get('currentKey'),
                    currentTime: (typeof audioPlayer !== 'undefined' && audioPlayer) ? (audioPlayer.currentTime || 0) : 0,
                    isShuffle: !!appState.get('isShuffle'),
                    repeatMode: appState.get('repeatMode'),
                    shuffleIndices: appState.get('shuffleIndices').slice(),
                    displayOrder: appState.get('displayOrder').slice(),
                    // SỬA (v14) — `enabled && mediaType==='video'` (2 field đã xoá) -> `type==='video'`
                    // + còn ≥1 item sống trong `source.list`.
                    videoCurrentTime: (appConfigVisualBg.getAll().type === 'video' && appConfigVisualBg.getAll().source.list.some((k) => k !== null)
                        && typeof bgVideoElement !== 'undefined' && bgVideoElement)
                        ? (bgVideoElement.currentTime || 0) : null,
                    autoSwitchVisualMarksSnapshot: (appConfigViz.getAll() && appConfigViz.getAll().autoSwitchVisualEnabled
                        && appConfigViz.getAll().autoSwitchVisualTimeMode === 'duration'
                        && Array.isArray(appState.get('autoSwitchVisualMarks')) && appState.get('autoSwitchVisualMarks').length > 0)
                        ? appState.get('autoSwitchVisualMarks').slice() : null,
                };
                localStorage.setItem(RESUME_STATE_STORAGE_KEY, JSON.stringify(snapshot));
                return true;
            } catch (e) {
                // localStorage có thể đầy/bị chặn (Safari riêng tư...) — best-effort, bỏ qua lỗi,
                // không để việc lưu resume state làm gãy luồng ẩn tab chính.
                console.warn('[resume-state] Không lưu được resume state vào localStorage (bỏ qua):', e);
                return false;
            }
        }

        /** Đọc snapshot DATA đã lưu (nếu có) — KHÔNG liên quan gì đến cờ hiện modal (xem RESUME_FLAG_KEY). */
        function readResumeStateFromLocalStorage() {
            try {
                const raw = localStorage.getItem(RESUME_STATE_STORAGE_KEY);
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                if (!parsed || typeof parsed !== 'object' || !parsed.currentKey) return null;
                return parsed;
            } catch (e) {
                console.warn('[resume-state] Resume state trong localStorage bị hỏng/không đọc được (bỏ qua):', e);
                return null;
            }
        }

        function clearResumeStateFromLocalStorage() {
            try { localStorage.removeItem(RESUME_STATE_STORAGE_KEY); } catch (e) {}
        }

        /** Cache tạm snapshot đang chờ người dùng quyết định — sống từ lúc checkPendingResumeStateOnBoot()
         * gọi tới lúc applyResumeStateToRam()/discardPendingResumeState() được gọi (1 trong 3 lựa chọn).
         * STATE — xem service/state.js. */

        /**
         * Gọi lúc KHỞI ĐỘNG, NGAY SAU loadConfig() — KHÔNG đợi initPlaylistFromDB() (xem
         * draw-visualizer.js). CHỈ đọc RESUME_FLAG_KEY để quyết định có hiện modal hay không —
         * ĐÂY LÀ NGUỒN DUY NHẤT cho quyết định này, không suy luận từ snapshot/biến RAM nào khác.
         *
         * Nếu cờ bật: hiện modal NGAY (title tạm "..." nếu playlistCache chưa có dữ liệu — sẽ tự
         * cập nhật đúng tên bài lúc initPlaylistFromDB() xong, xem updateResumeModalTitleIfReady())
         * và disable 2 nút "Tiếp tục phát"/"Nghe lại" (giữ "Không" luôn bấm được — không cần đợi gì
         * để biết người dùng có muốn nghe tiếp hay không). enableResumeModalButtonsWhenPlaylistReady()
         * (gọi từ draw-visualizer.js, sau initPlaylistFromDB()) sẽ tự mở khoá 2 nút đó.
         *
         * KHÔNG áp BẤT KỲ gì vào RAM ở đây — shuffle/repeat/displayOrder/video/auto-switch-marks chỉ
         * được nạp vào RAM SAU KHI người dùng đã quyết định "Tiếp tục phát"/"Nghe lại" (xem
         * applyResumeStateToRam(), gọi từ showResumeChoiceModal() ở player-controls.js).
         */
        function checkPendingResumeStateOnBoot() {
            if (!hasResumeFlag()) return; // không có gì cần hỏi — nguồn quyết định DUY NHẤT, xem comment đầu file
            const snapshot = readResumeStateFromLocalStorage();
            if (!snapshot) {
                // Cờ bật nhưng data lại không có (hỏng/race hiếm) — không có gì để hỏi thật, tắt cờ
                // luôn để không kẹt hỏi mãi ở các lần mở app sau.
                clearResumeFlag();
                return;
            }
            appState.set('_pendingResumeSnapshot', snapshot);
            if (typeof appState !== 'undefined') appState.set('lastStoppedKey', snapshot.currentKey);
            if (typeof appState !== 'undefined') appState.set('lastStoppedTime', snapshot.currentTime || 0);
            // KHÔNG clearResumeFlag()/clearResumeStateFromLocalStorage() ở đây — chỉ tắt khi modal
            // đã được xử lý xong (1 trong 3 lựa chọn), đúng yêu cầu: để modal treo/lại reload tay/
            // lại ẩn-hiện tab nhiều lần đều không ảnh hưởng, quy trình hỏi vẫn nguyên vẹn.
            if (typeof showResumeChoiceModal === 'function') showResumeChoiceModal();
        }

        /**
         * Gọi từ draw-visualizer.js SAU KHI initPlaylistFromDB() xong — cập nhật lại tiêu đề modal
         * (nếu đang hiện với tiêu đề tạm vì playlistCache lúc mở modal chưa có dữ liệu), MỞ KHOÁ 2
         * nút "Tiếp tục phát"/"Nghe lại" (đã bị disable lúc showResumeChoiceModal() mở modal trước
         * khi playlist load xong — xem player-controls.js), và XỬ LÝ trường hợp bài đã lưu KHÔNG
         * CÒN tồn tại trong playlist (bị xoá ở phiên trước/phiên khác) — tự đóng modal + dọn cờ
         * luôn (coi như không có gì để hỏi, không thể "Tiếp tục phát" 1 bài không còn tồn tại).
         * No-op an toàn nếu không có modal nào đang mở (ví dụ người dùng đã bấm "Không" trước khi
         * playlist load xong).
         */
        function enableResumeModalButtonsWhenPlaylistReady() {
            const overlay = document.getElementById('modal-choice-overlay');
            if (!overlay) return; // không có modal đang mở -> không có gì để mở khoá
            const pendingKey = appState.get('_pendingResumeSnapshot') ? appState.get('_pendingResumeSnapshot').currentKey : null;
            if (pendingKey && typeof appState !== 'undefined' && !appState.get('playlistCache').has(pendingKey)) {
                // Bài đã lưu không còn tồn tại nữa -> không có gì để hỏi thật, tự đóng modal + dọn cờ.
                overlay.remove();
                appState.set('isResumeModalOpen', false);
                discardPendingResumeState();
                return;
            }
            overlay.querySelectorAll('button[data-resume-needs-playlist]').forEach(btn => {
                btn.disabled = false;
                btn.classList.remove('opacity-40', 'cursor-not-allowed');
            });
            if (typeof updateResumeModalTitleIfPending === 'function') updateResumeModalTitleIfPending();
        }

        /**
         * Áp dụng TOÀN BỘ state đã lưu vào RAM — gọi DUY NHẤT từ 2 nhánh "Tiếp tục phát"/"Nghe lại"
         * của showResumeChoiceModal() (player-controls.js), TRƯỚC khi playSong(key) chạy (cần
         * window._resumeAutoSwitchVisualMarks đã có sẵn trước khi startAutoSwitchVisualBranch() —
         * được playSong() tự kích hoạt qua event 'play' — đọc nó). KHÔNG gọi ở đâu khác — đây chính
         * là yêu cầu "chọn Không thì không áp gì cả, chỉ xoá cờ/snapshot".
         *
         * Thứ tự áp dụng:
         *   1. isShuffle/repeatMode/shuffleIndices/displayOrder — đè lên giá trị mặc định mà
         *      initPlaylistFromDB()/updateShuffleArray() đã build lúc khởi động.
         *   2. Video nền — set lại currentTime (chờ qua 'loadedmetadata' nếu video chưa sẵn sàng).
         *   3. Auto-switch-visual marks (mode 'duration') — đặt window._resumeAutoSwitchVisualMarks,
         *      đọc bởi startAutoSwitchVisualBranch() (auto-switch-visual.js) để gán đè trực tiếp,
         *      KHÔNG build mới (sẽ xoá hết các mốc đã "nhớ" visual của đoạn đã nghe qua).
         */
        function applyResumeStateToRam() {
            const snapshot = appState.get('_pendingResumeSnapshot');
            appState.set('_pendingResumeSnapshot', null);
            if (!snapshot) return;

            // ---- 1. Shuffle/Repeat/displayOrder ----
            appState.set('isShuffle', !!snapshot.isShuffle);
            appState.set('repeatMode', snapshot.repeatMode || 0);
            if (Array.isArray(snapshot.shuffleIndices) && snapshot.shuffleIndices.length > 0) {
                appState.set('shuffleIndices', snapshot.shuffleIndices.filter(k => appState.get('playlistCache').has(k)));
            }
            if (Array.isArray(snapshot.displayOrder) && snapshot.displayOrder.length > 0) {
                const filtered = snapshot.displayOrder.filter(k => appState.get('playlistCache').has(k));
                if (filtered.length > 0) appState.set('displayOrder', filtered);
            }
            // Đồng bộ UI nút Trộn bài/Lặp lại theo giá trị vừa phục hồi — dùng ĐÚNG class đã thấy ở
            // listener click của 2 nút này (player-controls.js).
            if (typeof btnShuffle !== 'undefined' && btnShuffle) {
                btnShuffle.classList.toggle('!text-sky-400', appState.get('isShuffle'));
                btnShuffle.classList.toggle('text-slate-400', !appState.get('isShuffle'));
            }
            // SỬA (05/09/2026, yêu cầu Giang "bỏ đánh dấu 1 đi, dùng icon repeat nhưng có số 1 ở
            // giữa") — `repeatBadge` (span góc riêng) ĐÃ XOÁ, thay bằng `repeatOneDigit` (`<text>`
            // NẰM TRONG icon repeat, components/visualizer-overlay.js) — cùng cơ chế class `hidden`.
            if (typeof btnRepeat !== 'undefined' && btnRepeat && typeof repeatOneDigit !== 'undefined' && repeatOneDigit) {
                if (appState.get('repeatMode') === 0) { btnRepeat.classList.remove('!text-sky-400'); btnRepeat.classList.add('text-slate-400'); repeatOneDigit.classList.add('hidden'); }
                else if (appState.get('repeatMode') === 1) { btnRepeat.classList.remove('text-slate-400'); btnRepeat.classList.add('!text-sky-400'); repeatOneDigit.classList.add('hidden'); }
                else if (appState.get('repeatMode') === 2) { btnRepeat.classList.add('!text-sky-400'); repeatOneDigit.classList.remove('hidden'); }
            }

            // ---- 2. Video nền — khôi phục đúng vị trí đang xem ----
            if (snapshot.videoCurrentTime !== null && snapshot.videoCurrentTime !== undefined
                && typeof bgVideoElement !== 'undefined' && bgVideoElement
                && appConfigVisualBg.getAll().type === 'video' && appConfigVisualBg.getAll().source.list.some((k) => k !== null)) { // SỬA (v14)
                const targetTime = snapshot.videoCurrentTime;
                const trySeek = () => { try { bgVideoElement.currentTime = targetTime; } catch (e) {} };
                if (bgVideoElement.readyState >= 1) trySeek();
                else bgVideoElement.addEventListener('loadedmetadata', trySeek, { once: true });
            }

            // ---- 3. Auto-switch-visual marks (mode 'duration') — gán đè mảng đã lưu ----
            if (Array.isArray(snapshot.autoSwitchVisualMarksSnapshot) && snapshot.autoSwitchVisualMarksSnapshot.length > 0) {
                if (typeof window !== 'undefined') window._resumeAutoSwitchVisualMarks = snapshot.autoSwitchVisualMarksSnapshot;
            }

            // Đã áp dụng xong vào RAM -> tắt cờ + dọn data, quy trình hỏi cho phiên này đã hoàn tất.
            clearResumeFlag();
            clearResumeStateFromLocalStorage();
        }

        /** Gọi từ nhánh "Không" của showResumeChoiceModal() — KHÔNG áp gì vào RAM, chỉ tắt cờ + dọn data. */
        function discardPendingResumeState() {
            appState.set('_pendingResumeSnapshot', null);
            clearResumeFlag();
            clearResumeStateFromLocalStorage();
        }
