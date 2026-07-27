/**
 * playlist/actions.js — Hành động trên 1 bài: phát (playSong), xoá, menu 3 chấm, và 3 modal
 * (lỗi lúc phát / sửa thông tin / xem thông tin chi tiết). Thông tin chi tiết v6 có thêm
 * "Số lần nghe" + "Thời gian đã nghe riêng" (xem listen-stats.js — key {count, totalTime}).
 *
 * Ver 8: modal "Sửa thông tin" có thêm tab "Ảnh bìa" (upload/xem trước/xóa cover) cạnh tab
 * "Thông tin" cũ. Ảnh chỉ được ÁP DỤNG THẬT (ghi vào record.cover trong IndexedDB) khi bấm
 * "Lưu" — chọn ảnh hay bấm "Xóa ảnh bìa" chỉ cập nhật preview + biến tạm songEditPendingCover,
 * "Hủy" sẽ bỏ hoàn toàn pending đó. Cover sau khi lưu tự động được ghi vào tag APIC lúc Xuất
 * tệp (xem id3-export.js, không cần sửa gì thêm ở đó).
 *
 * MIGRATE (kiến trúc /event/): toàn bộ addEventListener TRƯỚC ĐÂY nằm trong file này đã dời sang
 * event/listener/playlist.js — file này giờ CHỈ còn các hàm CORE THUẦN (không tự gọi
 * withLoadingShield/alertModal/confirm/document.getElementById, trừ ngoại lệ #record-art đã ghi
 * chú riêng) mà event/router/playlist.js + event/workflow/playlist.js gọi tới. window.playSong/
 * window.removeSong GIỮ NGUYÊN là hàm core toàn cục (gắn vào window) — KHÔNG tách vào /event/, vì
 * chúng được gọi từ RẤT NHIỀU nơi khác trong toàn project (core/player-controls.js next/prev,
 * components/playlist-view.js onclick inline HTML, modal "Tiếp tục nghe?"...) như 1 API core
 * công khai, không phải điểm bắt đầu của 1 lượt bấm riêng.
 *
 * STATE CONTEXT của các modal (đang mở bài nào, ảnh bìa đang chờ áp dụng gì...) sống trong
 * `playlistStore` (event/store.js) — xem comment chi tiết tại mỗi khối modal phía dưới.
 */
        const playlistStore = new EventStore('playlist');

        /**
         * Loại 1 key khỏi playlist (xoá tay / "Xóa luôn" / "Giữ lại" lúc phát lỗi). Cập nhật CẢ
         * nguồn chân lý, hàng đợi phát LẪN danh sách hiển thị rồi vẽ lại.
         */
        function removeKeyFromDisplay(key) {
            appState.set('playlistOrder', appState.get('playlistOrder').filter(k => k !== key));
            appState.set('displayOrder', appState.get('displayOrder').filter(k => k !== key));
            appState.mutate('pendingResortKeys', s => s.delete(key));
            appState.mutate('playlistCache', m => m.delete(key)); appState.mutate('songNameIndex', m => m.delete(key));
            updateShuffleArray();
            recomputeRenderOrder();
            renderPlaylistDiff();
            updateEmptyState();
        }

        /**
         * FIX: trước đây chặn xoá TUYỆT ĐỐI hễ key === currentKey, bất kể đang phát hay đang pause
         * — không nhất quán với clearAllStoredData() (storage-manager.js, "Xoá tất cả" trong Quản
         * lý dung lượng) vẫn xoá bài hiện tại bình thường (coi đó là trường hợp đặc biệt được phép).
         * Nay tách rõ 2 khái niệm: "đang là bài hiện tại" (currentKey) khác "đang thực sự phát ra
         * tiếng" (audioPlayer.paused === false) — CHỈ chặn xoá khi bài đó đang thực sự phát (lý do
         * gốc: tránh xoá thẳng tay file đang đọc dở dang khỏi IndexedDB ngay dưới audioPlayer, có
         * thể gây lỗi decode/giật) — pause rồi thì cho xoá như mọi bài khác, đồng thời tự dọn sạch
         * player/UI giống hệt cách clearAllStoredData() đã làm khi bài hiện tại biến mất.
         *
         * Luôn có modal thông báo kết quả (chặn vì đang phát / xoá thành công) — trước đây chặn
         * xong không có phản hồi gì, người dùng bấm Xoá nhưng bài vẫn còn nguyên trong list không
         * rõ vì sao.
         * @param {string} key
         */
        window.removeSong = function(key) {
            const cached = appState.get('playlistCache').get(key);
            const title = cached && cached.tag && cached.tag.title ? cached.tag.title : (cached ? cached.filename : key);
            const isCurrent = key === appState.get('currentKey');

            if (isCurrent && !audioPlayer.paused) {
                alertModal(tFormat('playlistView.songMenu.deleteBlockedPlaying', { title }));
                return;
            }

            return withLoadingShield(t('common.loading.deleting'), async () => {
                await deleteSongRecord(key);
                removeSongStats(key); // dọn luôn thống kê nghe của bài đã xoá
                removeKeyFromDisplay(key);

                if (isCurrent) {
                    // Bài vừa xoá là currentKey (đang pause) — dọn player/UI giống hệt khối tương ứng
                    // trong clearAllStoredData() (storage-manager.js) để không còn currentKey "ma".
                    if (appState.get('currentObjectURL')) { URL.revokeObjectURL(appState.get('currentObjectURL')); appState.set('currentObjectURL', null); }
                    if (appState.get('currentCoverObjectURL')) { URL.revokeObjectURL(appState.get('currentCoverObjectURL')); appState.set('currentCoverObjectURL', null); }
                    audioPlayer.pause(); audioPlayer.src = ''; appState.set('currentKey', null);
                    playerTitle.textContent = t('bottomPlayer.noSongSelected'); playerArtist.textContent = '---';
                    if (typeof killAllAutoSwitchVisualTasks === 'function') killAllAutoSwitchVisualTasks();
                    if (typeof forceBackToPlaylistUI === 'function') forceBackToPlaylistUI();
                    if (typeof setVisualizerActiveFalse === 'function') setVisualizerActiveFalse(); // MỚI (08/07/2026, HOTFIX 10) — forceBackToPlaylistUI() không còn tự set nữa
                }
            }).then(() => {
                // Shield đã đóng hẳn tới đây (cùng lý do đã giải thích ở window.playSong) — an toàn
                // để hiện modal, không bị #loading-shield (z-[200]) đè lên modalChoice (z-[130]).
                alertModal(tFormat('playlistView.songMenu.deleteSuccess', { title }));
            });
        };

        /**
         * FIX (03/07/2026, mục 5 yêu cầu — "next/prev không được cưỡng chế rời khỏi Playlist UI").
         * Thêm tham số THỨ 2 tuỳ chọn `options.switchScreen` (mặc định `true`, GIỮ NGUYÊN 100%
         * hành vi cũ cho MỌI lời gọi hiện có chưa truyền — bấm 1 bài trong danh sách, "Phát"/"Trộn
         * bài" ở header, modal "Tiếp tục nghe?"...). CHỈ `playNext()`/`playPrev()`
         * (core/player-controls.js) truyền `{ switchScreen: false }` — 2 hàm ĐÓ là nguồn DUY NHẤT
         * của next/prev "không phải người dùng chủ động chọn bài này" (bấm nút Next/Prev ở thanh
         * dưới — CHỈ hiện khi đã đang ở màn Visualizer, xem switchToVisualizer()/
         * forceBackToPlaylistUI() — hoặc tự động chuyển bài khi 1 bài kết thúc, handleAudioEnded()
         * -> playNext(false)). Vì nút Next/Prev chỉ hiện lúc ĐÃ ở Visualizer, "không switch" ở đó
         * vô hại (đang sẵn ở đó); còn tự động chuyển bài lúc đang xem Playlist thì "không switch"
         * đúng là điều cần sửa — 1 điều kiện `switchScreen: false` phủ ĐÚNG cả 2 trường hợp, không
         * cần biết màn hình nào đang hiện tại thời điểm gọi.
         *
         * GHI NHẬN THẲNG THẮN (không né tránh) — `window.playSong` là hàm CORE DI SẢN cực lớn,
         * nhiều chục vi phạm Rule 1/2/3 (chưa từng lọt vào readme/core-legacy-audit.md — có thể do
         * cách khai báo `window.playSong = function(){}` thay vì `function playSong(){}` khiến
         * script quét audit bỏ sót, KHÔNG có nghĩa là hàm này "sạch"). Đưa TOÀN BỘ hàm về đúng 4
         * rule (core-function-conventions.md mục 0.5) là việc LỚN hơn RẤT nhiều so với fix hẹp này
         * — Giang đã trực tiếp yêu cầu sửa lỗi cụ thể này ngay ("tiện fix"), nên xử lý CÓ CHỦ Ý
         * NGOÀI PHẠM VI mục 0.5 (không phải bỏ sót/làm tắt) — chỉ thêm ĐÚNG 1 tham số + bọc 2 lời
         * gọi `switchToVisualizer()` đã có sẵn trong 1 điều kiện, KHÔNG động gì khác trong thân hàm.
         * @param {string} key
         * @param {{switchScreen?: boolean}} [options]
         */
        window.playSong = function(key, options) {
            // ===================== Ver 12 "Song/Video Unification" — Batch 2 (mục 3) =====================
            // Guard clause ĐẦU hàm — hàm "phát nhạc hợp nhất" giờ đọc `cached.mediaType` (chuẩn hoá
            // bởi buildVideoPlaylistCache(), Batch 1) để quyết định delegate hẳn sang Video Player
            // mode hay tiếp tục luồng Song gốc bên dưới. Rule 1: đây là guard clause thuần — bỏ 2
            // khối if này đi, phần còn lại của hàm vẫn giữ NGUYÊN 100% ĐÚNG 1 kịch bản (phát Song),
            // không đổi bất kỳ dòng nào — đúng nguyên tắc riêng của plan "KHÔNG sửa/động code đang
            // phục vụ RIÊNG cho Song".
            const cachedForDispatch = appState.get('playlistCache').get(key);
            if (cachedForDispatch && cachedForDispatch.mediaType === 'video') {
                // SỬA (Giang chốt: "chọn Video thì cũng phải kiểm tra block gate mới được cho
                // chọn") — đi qua eventBus (router 'videoPlayer') THAY VÌ gọi thẳng
                // workflowVideoPlayer.startFromPlaylist() như bản đầu. Block gate (event/block.js)
                // CHỈ chặn được message đi qua eventBus.send(), không chặn được lời gọi hàm trực
                // tiếp — nên đường vào Video Player mode BẮT BUỘC phải đi qua bus tại ĐÚNG điểm
                // này để tái tạo khoá chéo với "Use Video Background" (vizConfig.videoBgEnabled)
                // mà checkbox cũ từng có (xem event/block.js). ĐẶT dispatch ở NGAY guard clause
                // này (không phải ở từng nơi gọi window.playSong()) vì đây là điểm DUY NHẤT chắc
                // chắn chặn được MỌI đường vào video: click 1 video trong Playlist, "Phát tất
                // cả"/"Trộn bài"/resume lúc activeMediaSource='video', VÀ (Giang chốt tiếp: "video
                // thừa hưởng cơ chế Playlist, không tạo cơ chế next/prev riêng") CẢ Next/Prev vật
                // lý/cử chỉ vuốt (playNext()/playPrev(), core/player-controls.js, DÙNG CHUNG với
                // Song) đều đi qua ĐÚNG dòng này mỗi lần chuyển bài — router 'videoPlayer' (event/
                // router/video-player.js) tự phân biệt "đã ở mode, chỉ đổi video" hay "vào mode lần
                // đầu" bằng VirtualMachineState theo isVideoPlayerMode.
                eventBus.send({ router: 'videoPlayer', type: 'videoPlayer.startFromPlaylist.click', payload: { key } });
                return;
            }
            if (appState.get('isVideoPlayerMode')) {
                // Đang ở Video Player mode nhưng vừa chọn phát 1 Song -> dọn sạch bgVideoElement/
                // state Video Player TRƯỚC (exitVideoPlayerMode() không await được gì bên trong —
                // an toàn gọi không chờ), rồi mới tiếp tục luồng Song y hệt bên dưới.
                workflowVideoPlayer.exitVideoPlayerMode(); // event/workflow/video-player.js
            }

            const switchScreen = !options || options.switchScreen !== false;
            if (key === appState.get('currentKey')) { if (switchScreen) switchToVisualizer(); if (audioPlayer.paused) audioPlayer.play(); return; }
            requestWakeLock();

            // display=false: chuyển bài chạy logic trong shield (khoá chồng lệnh) nhưng KHÔNG hiện
            // lớp che -> bỏ cú nháy đen bg-black/80 mỗi lần Next/Prev (rõ nhất khi có video nền).
            //
            // FIX (log 9->10): trước đây withLoadingShield() KHÔNG có .catch() ở đây, và mọi nơi
            // gọi window.playSong(...) (playPauseBtn, playNext/playPrev, click bài trong list) đều
            // gọi fire-and-forget (không await, không .catch()). Nếu thân hàm bên dưới throw — ví
            // dụ await getSongRecord(key) reject vì connection IndexedDB đã chết (xem giải thích
            // đầy đủ ở db.js, đã sửa thêm cơ chế tự mở lại connection + retry 1 lần ở đó) — lỗi đó
            // dừng hàm NGAY TẠI ĐÓ, audioPlayer.src/audioPlayer.play() ở các dòng sau KHÔNG BAO GIỜ
            // chạy tới (im lặng hoàn toàn, không alert, không crash gì khác — đúng kiểu "vẫn
            // next/prev được vì chỉ tính index trong RAM, nhưng không có tiếng vì không lấy được
            // blob thật từ IndexedDB"), rồi thoát ra ngoài dưới dạng unhandled promise rejection.
            // Sau khi db.js đã tự retry, trường hợp này hiếm xảy ra hơn nhiều, nhưng vẫn cần lớp
            // bảo vệ cuối: nếu thật sự thất bại (retry cũng lỗi, hoặc lỗi khác hẳn), alertModal()
            // đúng nguyên văn lỗi thay vì im lặng — cùng tinh thần đã áp dụng cho luồng upload.
            // FIX (patch alert -> alertModal): trước đây dùng alert() native (chặn luồng JS) — đổi
            // sang alertModal() (modal-choice.js) để không bị chặn/crash khi gọi đúng lúc 1
            // #loading-shield khác đang chạy (alert() native từng gây "đứng" cảm giác app crash).
            let notFoundAlert = false; // cờ mang ra ngoài withLoadingShield — KHÔNG await alertModal() ngay trong fn() của shield (xem giải thích dưới)
            return withLoadingShield(t('common.loading.switchingSong'), async () => {
                if (appState.get('currentObjectURL')) { URL.revokeObjectURL(appState.get('currentObjectURL')); appState.set('currentObjectURL', null); }
                if (appState.get('currentCoverObjectURL')) { URL.revokeObjectURL(appState.get('currentCoverObjectURL')); appState.set('currentCoverObjectURL', null); }
                audioPlayer.pause();
                const previousKey = appState.get('currentKey');

                const record = await getSongRecord(key);
                if (!record) {
                    removeKeyFromDisplay(key);
                    // FIX (xung đột shield/modal): KHÔNG await alertModal() ở đây — fn() này còn đang
                    // chạy TRONG withLoadingShield(), và isShieldBusy chỉ được giải phóng ở finally
                    // SAU KHI fn() resolve (xem loading-shield-util.js). alertModal() trả Promise chỉ
                    // resolve khi người dùng bấm OK -> nếu await ngay tại đây, #loading-shield (lớp
                    // che z-[200], phủ kín màn hình) sẽ TIẾP TỤC hiện + chặn pointer-events suốt thời
                    // gian modal đang mở (modalChoice() chỉ z-[130], thấp hơn, nằm DƯỚI lớp che) —
                    // người dùng thấy modal nhưng không bấm được nút OK, shield "treo" vô thời hạn vì
                    // đang tự chờ chính cái modal mà nó đang che. Đặt cờ, return ngay để fn() (và do
                    // đó isShieldBusy) đóng lại HẲN trước, rồi mới hiện modal ở ngoài (xem dưới).
                    notFoundAlert = true;
                    return;
                }

                appState.set('currentKey', key);
                appState.set('currentCoverObjectURL', record.cover ? URL.createObjectURL(record.cover) : DEFAULT_VINYL);
                appState.set('currentObjectURL', URL.createObjectURL(record.blob));
                audioPlayer.src = appState.get('currentObjectURL');

                playerTitle.textContent = record.tag.title; playerArtist.textContent = record.tag.artist;
                recordContainer.innerHTML = `<img id="record-art" src="${appState.get('currentCoverObjectURL')}" class="w-full h-full rounded-full object-cover shadow-lg relative z-20 ${audioPlayer.paused ? 'paused' : 'animate-spin-slow'}" alt="Record"><div class="absolute inset-0 m-auto w-3 h-3 bg-slate-900 rounded-full border border-slate-700 z-30"></div>`;
                // Ver 8 refine (mục 4): cover Blob có thể không decode được làm ảnh thật (ID3 cover
                // lỗi/cắt cụt, jsmediatags đọc nhầm định dạng...) -> <img> "vỡ" thay vì hiện vinyl
                // mặc định. attachCoverFallback() (định nghĩa ở render.js) gắn onerror tự fallback
                // về DEFAULT_VINYL — tái dùng đúng 1 hàm cho mọi nơi hiển thị cover trong app.
                attachCoverFallback(document.getElementById('record-art'));

                if ('mediaSession' in navigator) {
                    navigator.mediaSession.metadata = new MediaMetadata({
                        title: record.tag.title || "Visual Master",
                        artist: record.tag.artist || "Unknown Artist",
                        // Ver 8 refine (mục 4): dùng ĐÚNG record.cover.type thật (đã được validate
                        // ở loader.js, đảm bảo là MIME ảnh hợp lệ) thay cho hard-code 'image/jpeg'
                        // trước đây — khai báo sai MIME (ví dụ cover thật là PNG nhưng báo JPEG) có
                        // thể khiến hệ điều hành/màn hình khóa từ chối hiển thị artwork dù dữ liệu
                        // ảnh hoàn toàn hợp lệ. Fallback 'image/jpeg' chỉ dùng khi vì lý do nào đó
                        // record.cover.type rỗng (hiếm, nhưng Blob.type có thể rỗng trên 1 số trình
                        // duyệt cũ dù nội dung vẫn đúng).
                        artwork: record.cover ? [{ src: appState.get('currentCoverObjectURL'), sizes: '512x512', type: record.cover.type || 'image/jpeg' }] : []
                    });
                }

                bumpSongPlayCount(key); // +1 số lần nghe ngay khi bắt đầu phát bài mới

                audioPlayer.play(); if (switchScreen) switchToVisualizer();
                if (previousKey) refreshSongNode(previousKey);
                refreshSongNode(key);
                if (!appState.get('domNodesByKey').has(key)) renderPlaylistDiff();
                if (appState.get('currentKey')) btnReturnVisual.classList.remove('hidden');
                appState.set('beatTimes', []); appState.set('fluxHistory', []); appState.set('currentCalculatedBpm', "---"); statBpm.textContent = "---"; statNote.textContent = "---";
                // Reset trạng thái pitch worker — tránh hiện sót nốt nhạc của bài VỪA đổi trong vài
                // chục ms đầu (worker là bất đồng bộ, kết quả cũ có thể vẫn đang "bay" lúc đổi bài).
                appState.set('latestPitchFrequency', -1); appState.set('lastValidNoteStr', null); appState.set('lastValidNoteTime', 0); appState.set('lastValidMidiNote', null);
                appState.set('rubikPitchHistory', []); appState.set('rubikPitchAvg', 0);
                appState.set('raindrops', []); appState.set('ripples', []); appState.set('glassStaticDrops', []); appState.set('glassStreaks', []); appState.set('activeLightnings', []); appState.set('starFlashes', []);
                setupAudioContext(); updateTypeUI();

                appState.set('subtitles', record.subtitles ? record.subtitles.slice() : []);
                // SỬA (10/07/2026, Subtitle Editor chuyển sang trang riêng): resetAutoSub()/
                // renderSubList() ĐÃ XOÁ cùng modal cũ — không còn UI soạn phụ đề nào ở trang
                // chính để "reset trạng thái ghi âm timing"/"vẽ lại danh sách" nữa.
                // clearAllActiveSubBlocks() GIỮ NGUYÊN (core/subtitle/subtitle-display.js — hiển
                // thị phụ đề lúc phát, KHÔNG liên quan gì tới việc soạn nội dung).
                clearAllActiveSubBlocks();
            }, false).then(async () => {
                // Shield đã đóng HẲN (isShieldBusy = false) tới đây — an toàn để hiện modal, không
                // còn lớp che z-[200] nào đè lên modalChoice() (z-[130]) nữa.
                if (notFoundAlert) await alertModal(t('common.playSong.notFound'));
            }).catch(async err => {
                console.error(`[playlist] playSong("${key}") lỗi không xác định, nhạc có thể không phát ra tiếng được:`, err);
                const rawMsg = `${err && err.name ? err.name + ': ' : ''}${err && err.message ? err.message : String(err)}`;
                await alertModal(tFormat('common.playSong.error', { message: escapeHtml(rawMsg) }));
            });
        };

        // ===================== Menu 3 chấm dùng chung =====================
        // songActionMenu/songActionOverlay: dùng lại biến từ core/dom-refs.js (quy ước chung,
        // KHÔNG tự getElementById ở đây nữa — xem khối "Playlist actions" trong dom-refs.js).
        // songActionMenuKey: state context "đang mở menu cho bài nào" — sống trong playlistStore
        // (event/store.js), KHÔNG còn là biến `let` closure riêng của file này, để router (khi
        // cần đọc/ghi cùng state) và core đều thấy ĐÚNG 1 nguồn duy nhất.

        function openSongActionMenu(key, anchorBtn) {
            playlistStore.set({ songActionMenuKey: key });
            const rect = anchorBtn.getBoundingClientRect();
            const menuWidth = 192;
            let left = rect.right - menuWidth;
            if (left < 8) left = 8;
            let top = rect.bottom + 6;
            const viewportH = window.innerHeight || 800;
            if (top + 220 > viewportH) top = rect.top - 220 - 6;
            songActionMenu.style.left = `${left}px`;
            songActionMenu.style.top = `${top}px`;
            songActionMenu.classList.remove('hidden');
            songActionOverlay.classList.remove('hidden');
        }
        function closeSongActionMenu() {
            songActionMenu.classList.add('hidden');
            songActionOverlay.classList.add('hidden');
            playlistStore.set({ songActionMenuKey: null });
        }

        /**
         * Xử lý 1 lựa chọn trong menu 3 chấm (Xoá/Sửa/Khôi phục). Đọc key đang mở từ
         * playlistStore (KHÔNG nhận key qua tham số — menu chỉ có thể mở cho ĐÚNG 1 bài tại 1
         * thời điểm, state context này đã được openSongActionMenu() ghi lúc mở).
         * SỬA (10/07/2026): nhánh 'info' ĐÃ XOÁ — openSongInfoModal() không còn tồn tại (gộp vào
         * tab đầu của song-edit-modal, xem openSongEditModal()) — nút "info" cũng đã xoá khỏi
         * template nên nhánh đó vốn không còn cách nào để kích hoạt, chỉ dọn cho khỏi gọi nhầm 1
         * hàm không tồn tại nếu sau này có ai lỡ thêm lại nút cũ.
         * @param {string} action - 'delete' | 'edit' | 'restore'
         * @returns {{status: string}} 'noop' nếu không có menu nào đang mở, 'ok' nếu đã xử lý
         */
        function handleSongActionMenuSelect(action) {
            const key = playlistStore.get('songActionMenuKey');
            if (!key) return { status: 'noop' };
            closeSongActionMenu();
            if (action === 'delete') window.removeSong(key);
            else if (action === 'edit') openSongEditModal(key);
            else if (action === 'restore') exportSongWithTag(key);
            return { status: 'ok' };
        }

        // ===================== Modal: Bài hát lỗi lúc phát =====================
        // playbackErrorModal/playbackErrorFilename: dùng lại biến từ core/dom-refs.js.
        // playbackErrorKey: state context "modal đang nói về bài nào" — sống trong playlistStore.

        function handlePlaybackError(key) {
            playlistStore.set({ playbackErrorKey: key });
            const cached = appState.get('playlistCache').get(key);
            playbackErrorFilename.textContent = cached ? cached.filename : key;
            playbackErrorModal.classList.remove('hidden');
        }

        /**
         * Ứng với nút "Giữ lại" — CHỈ 1 hàm core đủ xử lý toàn bộ (không cần shield/modal) ->
         * router sẽ gọi thẳng hàm này, không cần workflow riêng.
         * @returns {{status: string}}
         */
        function confirmKeepBrokenSong() {
            const key = playlistStore.get('playbackErrorKey');
            if (!key) return { status: 'noop' };
            appState.mutate('confirmedBrokenKeys', s => s.add(key));
            removeKeyFromDisplay(key);
            playbackErrorModal.classList.add('hidden');
            playlistStore.set({ playbackErrorKey: null });
            return { status: 'ok' };
        }

        /**
         * Đọc + xoá state "đang hỏi xoá bài lỗi nào" và ẨN MODAL NGAY (thuần UI, không cần
         * shield) — workflow gọi hàm này TRƯỚC, lấy key trả về, rồi mới bọc shield quanh
         * deleteBrokenSongByKey(key) ở tầng workflow. Tách riêng để core không tự gọi
         * withLoadingShield bên trong (core không biết shield/modal tồn tại).
         * @returns {string|null} key đang chờ xoá, hoặc null nếu không có gì đang mở
         */
        function getAndClearPlaybackErrorKey() {
            const key = playlistStore.get('playbackErrorKey');
            if (!key) return null;
            playbackErrorModal.classList.add('hidden');
            playlistStore.set({ playbackErrorKey: null });
            return key;
        }

        /**
         * Hàm core THUẦN, nhận key qua tham số (KHÔNG tự đọc playlistStore) — để workflow có thể
         * bọc withLoadingShield() quanh đúng lệnh gọi này, đúng quy tắc "core không biết shield".
         * @param {string} key
         */
        async function deleteBrokenSongByKey(key) {
            await deleteSongRecord(key);
            removeSongStats(key);
            removeKeyFromDisplay(key);
        }

        // ===================== Modal: Sửa thông tin (Thông tin + Ảnh bìa) =====================
        // songEditModal và mọi input/nút bên trong: dùng lại biến từ core/dom-refs.js.
        // songEditCurrentKey/songEditPendingCover/songEditPendingCoverPreviewUrl: state context
        // "modal đang sửa bài nào, ảnh bìa đang chờ áp dụng gì" — sống trong playlistStore.
        // Ảnh bìa được áp dụng NGAY khi bấm "Lưu" (cùng 1 lượt ghi IndexedDB với title/artist/
        // album), KHÔNG ghi DB ngay lúc chọn file — để nút "Hủy" hoàn toàn không đổi gì, giống
        // hành vi 2 ô nhập text bên cạnh. 3 trạng thái: null (không đổi gì) | File (đặt ảnh mới)
        // | 'remove' (xóa ảnh, dùng lại DEFAULT_VINYL).
        // Ver 8 refine (mục 4): songEditCoverPreview là <img> CỐ ĐỊNH trong DOM (không bị tạo lại
        // qua innerHTML như #record-art) -> chỉ cần gắn onerror fallback 1 LẦN ở đây, không cần
        // gắn lại mỗi lần setSongEditCoverPreview() đổi src.
        attachCoverFallback(songEditCoverPreview);

        function setSongEditCoverPreview(url) {
            songEditCoverPreview.src = url || DEFAULT_VINYL;
        }

        function revokeSongEditPendingPreview() {
            const url = playlistStore.get('songEditPendingCoverPreviewUrl');
            if (url) { URL.revokeObjectURL(url); playlistStore.set({ songEditPendingCoverPreviewUrl: null }); }
        }

        /** MỚI (10/07/2026, gộp song-info-modal vào làm tab đầu — phản hồi Giang): tổng quát hoá
         * từ 2 tab (boolean isCover) sang 3 tab bằng map, dễ mở rộng thêm tab sau này hơn hẳn
         * boolean lồng nhau cũ. */
        function setSongEditTab(tab) {
            const panels = { details: songEditTabDetails, fields: songEditTabFields, cover: songEditTabCover };
            Object.keys(panels).forEach(name => {
                const isActive = name === tab;
                panels[name].classList.toggle('hidden', !isActive);
                panels[name].classList.toggle('flex', isActive && name === 'cover'); // CHỈ tab cover cần flex (ảnh + nút cạnh nhau), 2 tab còn lại flex-col mặc định trong class tĩnh
            });
            songEditTabButtons.forEach(btn => {
                const active = btn.dataset.editTab === tab;
                btn.classList.toggle('bg-white/10', active);
                btn.classList.toggle('text-white', active);
                btn.classList.toggle('shadow', active);
                btn.classList.toggle('text-slate-400', !active);
            });
            // MỚI (11/07/2026, yêu cầu Giang) — nút "Lưu" CHỈ có ý nghĩa ở 2 tab thật sự SỬA được
            // (Sửa/fields + Ảnh bìa/cover) — tab "Chi tiết" (details) đọc-thôi, hiện nút Lưu ở đó
            // gây hiểu lầm "bấm Lưu để lưu xem chi tiết" (vô nghĩa). Ẩn hẳn nút, KHÔNG chỉ disable
            // (disable vẫn chiếm chỗ + có thể gây thắc mắc "sao không bấm được").
            btnSongEditSave.classList.toggle('hidden', tab === 'details');
        }

        async function openSongEditModal(key) {
            const cached = appState.get('playlistCache').get(key); if (!cached) return;
            playlistStore.set({ songEditCurrentKey: key, songEditPendingCover: null });
            songEditTitleInput.value = cached.tag.title || '';
            songEditArtistInput.value = cached.tag.artist || '';
            songEditAlbumInput.value = cached.tag.album || '';

            revokeSongEditPendingPreview();
            setSongEditCoverPreview(cached.cover ? URL.createObjectURL(cached.cover) : DEFAULT_VINYL);
            // Object URL trên chỉ sống trong lúc modal mở (preview ảnh HIỆN TẠI, không phải pending);
            // gán vào songEditPendingCoverPreviewUrl để được revoke đồng bộ lúc đóng modal/đổi ảnh.
            if (cached.cover) playlistStore.set({ songEditPendingCoverPreviewUrl: songEditCoverPreview.src });

            // MỚI (10/07/2026) — nội dung tab "Chi tiết" (gộp từ song-info-modal cũ, xem
            // songInfoRowHtml() bên dưới) — giờ populate NGAY tại đây thay vì openSongInfoModal()
            // riêng (đã xoá).
            const stats = getSongStats(key); // { count, totalTime }
            const emptyVal = t('playlistView.songInfo.empty');
            songEditTabDetails.innerHTML =
                songInfoRowHtml('M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM3 9a9 9 0 0118 0', 'bg-sky-500/15 text-sky-400', t('playlistView.songInfo.fieldTitle'), cached.tag.title || emptyVal) +
                songInfoRowHtml('M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', 'bg-violet-500/15 text-violet-400', t('playlistView.songInfo.fieldArtist'), cached.tag.artist || emptyVal) +
                songInfoRowHtml('M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM3 9a9 9 0 0118 0', 'bg-emerald-500/15 text-emerald-400', t('playlistView.songInfo.fieldAlbum'), cached.tag.album || emptyVal) +
                songInfoRowHtml('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', 'bg-amber-500/15 text-amber-400', t('playlistView.songInfo.fieldDuration'), formatTime(cached.duration)) +
                songInfoRowHtml('M9 19V6l12-3v13M5 21a2 2 0 100-4 2 2 0 000 4zm12-2a2 2 0 100-4 2 2 0 000 4z', 'bg-rose-500/15 text-rose-400', t('playlistView.songInfo.fieldPlayCount'), tFormat('playlistView.songInfo.fieldPlayCountValue', { n: stats.count })) +
                songInfoRowHtml('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', 'bg-indigo-500/15 text-indigo-400', t('playlistView.songInfo.fieldListened'), formatListenTime(stats.totalTime));

            setSongEditTab('details'); // MẶC ĐỊNH mở tab "Chi tiết" trước (đúng yêu cầu Giang — Info là tab đầu)
            songEditModal.classList.remove('hidden');
        }

        function closeSongEditModal() {
            revokeSongEditPendingPreview();
            playlistStore.set({ songEditPendingCover: null });
            // FIX (04/07/2026, mục 3 phản hồi Giang) — bỏ dòng reset `songEditCoverUploadInput.value`
            // (input file Upload đã XOÁ hẳn khỏi template — chỉ còn nút "Choose photo" mở picker).
            songEditModal.classList.add('hidden');
        }

        /**
         * Validate + cập nhật preview cho 1 file ảnh bìa mới chọn. Hàm core THUẦN — KHÔNG tự gọi
         * alertModal() bên trong (khác bản gốc) — trả {status} để workflow tự quyết định hiện
         * modal lỗi hay không, đúng quy tắc "core không biết shield/modal tồn tại".
         * @param {File} file
         * @returns {{status: 'ok'|'invalid', reason?: string}}
         */
        function changeSongEditCover(file) {
            const check = validateImageFile(file);
            if (!check.valid) return { status: 'invalid', reason: check.reason };
            revokeSongEditPendingPreview();
            const previewUrl = URL.createObjectURL(file);
            playlistStore.set({ songEditPendingCover: file, songEditPendingCoverPreviewUrl: previewUrl });
            setSongEditCoverPreview(previewUrl);
            return { status: 'ok' };
        }

        /** Ứng với nút "Xóa ảnh bìa" — thuần state + preview, không cần shield/modal. */
        function removeSongEditCover() {
            revokeSongEditPendingPreview();
            playlistStore.set({ songEditPendingCover: 'remove' });
            setSongEditCoverPreview(DEFAULT_VINYL);
        }

        /**
         * Đọc state hiện tại của modal Sửa thông tin (key + giá trị input + pending cover) —
         * hàm core THUẦN, không shield. Workflow gọi hàm này TRƯỚC để lấy đủ data, rồi mới gọi
         * applySongEditAndSave(key, newTag, pendingCover) bọc trong withLoadingShield().
         * @returns {{key: string|null, newTag: Object, pendingCover: File|'remove'|null}}
         */
        function captureSongEditFormState() {
            const key = playlistStore.get('songEditCurrentKey');
            const newTag = {
                title: songEditTitleInput.value.trim() || t('common.songEdit.defaultTitle'),
                artist: songEditArtistInput.value.trim() || t('common.songEdit.defaultArtist'),
                album: songEditAlbumInput.value.trim()
            };
            const pendingCover = playlistStore.get('songEditPendingCover');
            return { key, newTag, pendingCover };
        }

        /**
         * Hàm core THUẦN, nhận toàn bộ data qua tham số (KHÔNG tự đọc playlistStore) — để
         * workflow bọc withLoadingShield() quanh đúng lệnh gọi này.
         * @param {string} key
         * @param {Object} newTag
         * @param {File|'remove'|null} pendingCover
         * @returns {{status: 'notFound'|'ok'}}
         */
        async function applySongEditAndSave(key, newTag, pendingCover) {
            const record = await getSongRecord(key);
            if (!record) return { status: 'notFound' };
            record.tag = { ...record.tag, ...newTag };
            // Ảnh bìa: File mới -> ghi thẳng Blob (File là 1 dạng Blob, lưu IndexedDB được luôn,
            // giống cách record.cover đã được ghi từ jsmediatags lúc nạp file ban đầu). 'remove'
            // -> xóa hẳn field cover (record không còn cover -> các nơi đọc cover tự fallback
            // DEFAULT_VINYL, đúng hành vi cũ khi 1 bài chưa từng có cover).
            if (pendingCover instanceof File) record.cover = pendingCover;
            else if (pendingCover === 'remove') delete record.cover;
            // FIX (decode lỗi khi nghe lại bài VỪA sửa info, không reload mới hết) — xem giải thích
            // đầy đủ tại rematerializeBlob() (db.js). record.blob ở đây là Blob round-trip từ
            // getSongRecord() phía trên, PHẢI vật chất hoá lại thành Blob mới trước khi ghi đè.
            if (record.blob) record.blob = await rematerializeBlob(record.blob);
            await setSongRecord(key, record);

            const cached = appState.get('playlistCache').get(key);
            if (cached) { cached.tag = record.tag; cached.cover = record.cover || null; }
            appState.mutate('songNameIndex', m => m.set(key, normalizeSongName(record.tag.title)));

            if (key === appState.get('currentKey')) {
                playerTitle.textContent = record.tag.title; playerArtist.textContent = record.tag.artist;
                if (appState.get('currentCoverObjectURL') && appState.get('currentCoverObjectURL').startsWith('blob:')) URL.revokeObjectURL(appState.get('currentCoverObjectURL'));
                appState.set('currentCoverObjectURL', record.cover ? URL.createObjectURL(record.cover) : DEFAULT_VINYL);
                // NGOẠI LỆ CỐ Ý: #record-art là phần tử ĐỘNG (tạo lại qua innerHTML mỗi lần đổi
                // bài) — không thể dùng biến cố định từ dom-refs.js, phải tự getElementById tại
                // chỗ cần (xem comment chi tiết ở khối "Playlist actions" trong dom-refs.js).
                const recordArtEl = document.getElementById('record-art');
                if (recordArtEl) {
                    recordArtEl.src = appState.get('currentCoverObjectURL');
                    // Gắn lại fallback mỗi khi đổi src (ver 8 refine, mục 4) — listener cũ tự
                    // gỡ sau 1 lần lỗi (xem attachCoverFallback ở render.js), nên ảnh MỚI vừa
                    // đổi sang cần listener mới của riêng nó để vẫn được bảo vệ.
                    attachCoverFallback(recordArtEl);
                }
                if ('mediaSession' in navigator) {
                    navigator.mediaSession.metadata = new MediaMetadata({
                        title: record.tag.title || "Visual Master",
                        artist: record.tag.artist || "Unknown Artist",
                        // Ver 8 refine (mục 4): dùng đúng record.cover.type thật, xem comment
                        // tương tự ở playSong() phía trên.
                        artwork: record.cover ? [{ src: appState.get('currentCoverObjectURL'), sizes: '512x512', type: record.cover.type || 'image/jpeg' }] : []
                    });
                }
            }
            return { status: 'ok' };
        }

        /**
         * Phần "dọn dẹp sau khi lưu" (vẽ lại danh sách, sắp xếp lại nếu cần) — core thuần, không
         * shield/modal, gọi SAU KHI applySongEditAndSave() đã resolve (workflow gọi nối tiếp).
         * @param {string} key
         */
        function refreshAfterSongEditSave(key) {
            refreshSongNode(key); // vẽ lại ảnh/tên mới ngay trong danh sách (ảnh cũ trong DOM không tự đổi)
            // Đổi tên -> ảnh hưởng sort: cập nhật cả hàng đợi phát (nếu az/za) lẫn danh sách hiển thị.
            if (appState.get('displaySortMode') === 'az' || appState.get('displaySortMode') === 'za') recomputeDisplayOrder();
            recomputeRenderOrder();
            renderPlaylistDiff();
        }

        // ===================== Chi tiết bài hát (gộp vào tab đầu của song-edit-modal, 10/07/2026) =====================
        // SỬA (phản hồi Giang): #song-info-modal cũ ĐÃ XOÁ — nội dung giờ populate thẳng vào
        // `songEditTabDetails` bên trong openSongEditModal() (xem phía trên). `songInfoRowHtml()`
        // GIỮ NGUYÊN (vẫn được dùng, chỉ đổi NƠI GỌI). `openSongInfoModal()`/`closeSongInfoModal()`/
        // `exportCurrentSongInfo()` ĐÃ XOÁ — không còn modal riêng nên không còn "đóng"/"xuất file
        // riêng từ modal thông tin" (xuất file vẫn làm được qua "Khôi phục" trong menu 3 chấm,
        // exportSongWithTag() — không mất tính năng, chỉ gộp điểm vào).

        /**
         * Dựng 1 dòng thông tin dạng "card" nhỏ (icon tròn màu + label + giá trị) — dùng trong tab
         * "Chi tiết" (đầu) của song-edit-modal.
         */
        function songInfoRowHtml(iconPath, accentClass, label, value) {
            return `
                <div class="flex items-center gap-3 bg-black/25 border border-white/5 rounded-xl px-3 py-2.5">
                    <div class="w-7 h-7 rounded-full ${accentClass} flex items-center justify-center shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${iconPath}" /></svg>
                    </div>
                    <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wide shrink-0 w-[88px]">${label}</span>
                    <span class="text-sm text-white text-right flex-1 break-all">${value}</span>
                </div>`;
        }
