/**
 * playlist/actions.js — Hành động trên 1 bài: xoá, menu 3 chấm, và 3 modal (lỗi lúc phát / sửa
 * thông tin / xem thông tin chi tiết). Thông tin chi tiết v6 có thêm "Số lần nghe" + "Thời gian đã
 * nghe riêng" (xem listen-stats.js — key {count, totalTime}).
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
 * chú riêng) mà event/router/playlist.js + event/workflow/playlist.js gọi tới. `window.removeSong`
 * GIỮ NGUYÊN là hàm core toàn cục (gắn vào window) — KHÔNG tách vào /event/, vì được gọi từ RẤT
 * NHIỀU nơi trong toàn project như 1 API core công khai, không phải điểm bắt đầu của 1 lượt bấm
 * riêng.
 *
 * [SỬA — plan-playmedia-reorg.md] `window.playSong` ĐÃ DỜI KHỎI FILE NÀY, sang
 * `workflowPlayer.playMedia()` (event/workflow/player.js) — hàm đó chưa từng là Core thuần (đọc
 * DB bất đồng bộ, dựng UI, dispatch eventBus — đúng bản chất Workflow), chỉ SAI CHỖ Ở (global thay
 * vì method của Workflow có tổ chức). KHÔNG đổi 1 dòng logic, chỉ đổi chỗ ở — xem docstring đầu
 * event/workflow/player.js.
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
        /**
         * SỬA (ver12 "Song/Video Unification", Batch 6, mục 6d, phản hồi Giang) — TRƯỚC ĐÂY hàm
         * này hardcode `deleteSongRecord()` + kiểm tra "đang thực sự phát" qua `audioPlayer.paused`
         * — cả 2 SAI cho Video (record Video nằm store khác hẳn `deleteSongRecord()` không đọc
         * được — xoá ÂM THẦM KHÔNG THÀNH CÔNG dù UI tưởng đã xoá xong; Video phát qua
         * `bgVideoElement`, không phải `audioPlayer`, nên chốt chặn "đang phát" chưa từng kích hoạt
         * cho Video). Phát hiện lúc xoá dropdown tile "File Manager → Video" (đường xoá Video DUY
         * NHẤT từng hoạt động đúng, qua `confirmDeleteSingleVideo()` → `deleteVideo()`) — giờ nút
         * "Xoá" DÙNG CHUNG trong menu 3 chấm Playlist là đường xoá Video DUY NHẤT còn lại, phải
         * hoạt động đúng. Hàm này VỐN ĐÃ mixed core/workflow (dùng alertModal/withLoadingShield —
         * "core không biết shield/modal" không áp dụng ở đây từ trước) nên gọi thẳng
         * `workflowVideoPlayer.exitVideoPlayerMode()` (thay vì tự inline lại y hệt logic đó, vốn
         * cần đọc `_objectUrl`/`_thumbObjectUrl` riêng của Workflow đó) — nhất quán với cách file
         * này VỐN đã không tuân Rule 1-4 nghiêm ngặt cho hàm cụ thể này.
         */
        /**
         * MỞ RỘNG (hợp nhất Photo vào Playlist) — thêm nhánh Photo (store `images`, hàm xoá riêng
         * `deleteImage()` — core/file-manager/image.js). Photo KHÔNG BAO GIỜ là `currentKey` (Photo
         * không có khái niệm "đang phát" — chưa từng gọi playMedia()), nên `isActuallyPlaying`/khối
         * dọn player phía dưới tự nhiên không bao giờ kích hoạt cho Photo, không cần thêm nhánh gì
         * ở 2 chỗ đó.
         */
        window.removeSong = function(key) {
            const cached = appState.get('playlistCache').get(key);
            const title = cached && cached.tag && cached.tag.title ? cached.tag.title : (cached ? cached.filename : key);
            const mediaType = cached ? cached.mediaType : 'song'; // 'song'|'video'|'photo' — playlistCache.mediaType luôn có giá trị đúng cho item đang hiển thị thật (Adapter 3 nguồn đều set field này)
            const isVideo = mediaType === 'video';
            const isCurrent = key === appState.get('currentKey');
            const isActuallyPlaying = isVideo ? (appState.get('isVideoPlayerMode') && !bgVideoElement.paused) : !audioPlayer.paused;

            if (isCurrent && isActuallyPlaying) {
                // SỬA (phản hồi Giang, mục "ngôn ngữ theo ngữ cảnh Song/Video") — bản Song nói
                // "Pause the song first" — sai ngữ cảnh khi chặn xoá 1 Video đang phát.
                alertModal(tFormat(isVideo ? 'playlistView.songMenu.deleteBlockedPlayingVideo' : 'playlistView.songMenu.deleteBlockedPlaying', { title }));
                return;
            }

            return withLoadingShield(t('common.loading.deleting'), async () => {
                // MỚI (phát hiện thêm lúc sửa Video, phản hồi Giang) — TRƯỚC ĐÂY hàm này (kể cả
                // nhánh Song) KHÔNG dọn tham chiếu folder trước khi xoá record, khác hẳn
                // deleteSelectedSongs() (xoá hàng loạt, event/workflow/playlist.js) VỐN ĐÃ gọi
                // removeSongFromAllFolders() đúng thứ tự — để lại "ghost" trong folder_song nếu
                // bài/video đó đang nằm trong 1 folder. Sửa đối xứng cho CẢ 2 nhánh.
                // MỞ RỘNG (hợp nhất Photo) — 3 nhánh get/delete theo mediaType (trước đây thiếu
                // nhánh Photo sẽ khiến deleteSongRecord() gọi nhầm lên key không tồn tại trong store
                // `songs` — âm thầm KHÔNG xoá được gì, ảnh vẫn còn nguyên trong `images`).
                const getRecordFn = isVideo ? getVideoRecord : mediaType === 'photo' ? getImageRecord : getSongRecord;
                const record = await getRecordFn(key);
                if (record) await removeSongFromAllFolders(record); // core/file-manager/folder.js

                if (isVideo) await deleteVideo(key); // core/file-manager/video.js
                else if (mediaType === 'photo') await deleteImage(key); // core/file-manager/image.js
                else await deleteSongRecord(key);
                removeSongStats(key); // dọn luôn thống kê nghe của bài đã xoá — key-agnostic, dùng chung được cho Video/Photo
                removeKeyFromDisplay(key);

                if (isCurrent && isVideo) {
                    // Video đang là currentKey (đã pause, hoặc chưa từng phát) — dọn bgVideoElement/
                    // trạng thái Video Player mode qua ĐÚNG hàm đã có sẵn (event/workflow/
                    // video-player.js), tránh tự inline lại (cần _objectUrl riêng của Workflow đó).
                    if (appState.get('isVideoPlayerMode')) await workflowVideoPlayer.exitVideoPlayerMode();
                    appState.set('currentKey', null);
                    playerTitle.textContent = t('bottomPlayer.noSongSelected'); playerArtist.textContent = '---';
                } else if (isCurrent) {
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

        // [SỬA — plan-playmedia-reorg.md] `window.playSong` (thân hàm đầy đủ, switchScreen
        // option, guard video, withLoadingShield...) ĐÃ DỜI sang `workflowPlayer.playMedia()`
        // (event/workflow/player.js) — KHÔNG đổi 1 dòng logic, chỉ đổi chỗ ở. Xem docstring đầu
        // file đó để biết đầy đủ lý do + toàn bộ danh sách nơi gọi.

        // ===================== Menu 3 chấm dùng chung =====================
        // songActionMenu/songActionOverlay: dùng lại biến từ core/dom-refs.js (quy ước chung,
        // KHÔNG tự getElementById ở đây nữa — xem khối "Playlist actions" trong dom-refs.js).
        // songActionMenuKey: state context "đang mở menu cho bài nào" — sống trong playlistStore
        // (event/store.js), KHÔNG còn là biến `let` closure riêng của file này, để router (khi
        // cần đọc/ghi cùng state) và core đều thấy ĐÚNG 1 nguồn duy nhất.

        /**
         * Gate hiện/ẩn theo `cached.mediaType`: Video ẩn "Sửa phụ đề" (không áp dụng — Video không
         * dùng subtitle-editor kiểu Song), HIỆN "Sửa video" (mở Video Editor). Đọc thẳng
         * `playlistCache` (đã có sẵn ngay tại đây, KHÔNG cần fetch gì thêm) — guard `cached` rỗng
         * thì coi như Song (giữ hành vi cũ, không chặn mở menu chỉ vì thiếu cache).
         * SỬA (Batch "Export dọn nợ kiến trúc", phản hồi Giang) — "Xuất file" giờ LUÔN hiện (áp
         * dụng được cho cả Video, xem exportVideoFile()) — không còn ẩn theo isVideo nữa.
         * XOÁ (phản hồi Giang — "bỏ luôn set background cho dropdown của video đi") — "Set làm nền"
         * đã bỏ hẳn khỏi dropdown Video.
         * MỚI (phản hồi Giang, mục "ngôn ngữ theo ngữ cảnh Song/Video") — nhãn "Xoá" đổi chữ động
         * (Song/Video) qua `#song-menu-delete-label`.
         * MỞ RỘNG (hợp nhất Photo vào Playlist, CHỐT Giang "giữ nguyên nút 3 chấm") — Photo ẩn
         * "Sửa phụ đề" (giống Video) VÀ "Chi tiết"/"Xuất file" (chưa có view/export riêng cho Photo
         * — 2 hành động đó đọc/ghi tag ID3 kiểu Song, không áp dụng được, tránh mở ra hành động lỗi
         * thay vì hiện rồi báo lỗi khi bấm). "Thêm vào thư mục"/"Xoá" GIỮ NGUYÊN — cả 2 đã hoạt
         * động đúng cho Photo (Folder type='photo' MỚI; window.removeSong() đã thêm nhánh photo).
         */
        function openSongActionMenu(key, anchorBtn) {
            playlistStore.set({ songActionMenuKey: key });
            const cached = appState.get('playlistCache').get(key);
            const isVideo = !!(cached && cached.mediaType === 'video');
            const isPhoto = !!(cached && cached.mediaType === 'photo');
            songMenuBtnEditSubtitles.classList.toggle('hidden', isVideo || isPhoto);
            // SỬA (Giang yêu cầu — Photo tích hợp duration như Song/Video, "thêm action detail cho
            // dropdown của photo") — TRƯỚC ĐÂY "Chi tiết" (songMenuBtnEdit) ẩn hẳn cho Photo (ảnh
            // chưa có duration/count/size gì đáng xem) — giờ HIỆN LẠI, openSongEditModal() (dưới)
            // đã có nhánh Photo riêng.
            if (songMenuBtnEdit) songMenuBtnEdit.classList.toggle('hidden', false);
            // SỬA (phản hồi Giang — Batch "Export dọn nợ kiến trúc") — "Xuất file" giờ áp dụng CHO
            // CẢ Video (exportVideoFile(), bỏ qua bước gắn tag ID3 — xem event/workflow/playlist.js)
            // — KHÔNG còn ẩn khi isVideo nữa.
            // SỬA (Giang yêu cầu — "thêm export file/download ảnh vào dropdown action menu photo
            // playlist") — TRƯỚC ĐÂY dòng này CÒN `songMenuBtnRestore.classList.toggle('hidden',
            // isPhoto)` — ẨN hẳn nút "Xuất file" mỗi khi menu đang mở là của Photo (dropdown Photo
            // do đó KHÔNG hề có lựa chọn download ảnh nào cả). Giờ bỏ hẳn điều kiện `isPhoto` đó —
            // nút LUÔN hiện cho cả 3 loại (Song/Video/Photo), `exportActiveMenuItem()` (event/
            // workflow/playlist.js) tự rẽ đúng nhánh theo `activeMediaSource` (thêm nhánh 'photo' ->
            // `exportImageFile()`, cùng khuôn nhánh 'video' đã có).
            if (songMenuBtnRestore) songMenuBtnRestore.classList.remove('hidden');
            // songMenuBtnSetBgVideo ĐÃ XOÁ khỏi dropdown (phản hồi Giang — bỏ hẳn "Set làm nền").
            songMenuBtnEditVideo.classList.toggle('hidden', !isVideo);
            // MỚI (Giang yêu cầu — Photo tích hợp duration như Song/Video, "thêm dropdown edit
            // image -> mở openImagePreview()") — mirror songMenuBtnEditVideo ngay trên.
            if (songMenuBtnEditImage) songMenuBtnEditImage.classList.toggle('hidden', !isPhoto);
            // MỚI (phản hồi Giang, mục "ngôn ngữ theo ngữ cảnh Song/Video") — nhãn nút "Xoá" đổi
            // chữ đúng loại item đang mở menu (trước đây LUÔN nói "Delete song" kể cả khi xoá Video).
            // MỞ RỘNG (hợp nhất Photo) — thêm nhánh photo.
            const deleteLabelEl = songActionMenu.querySelector('#song-menu-delete-label');
            if (deleteLabelEl) deleteLabelEl.textContent = t(isVideo ? 'playlistView.songMenu.deleteVideo' : isPhoto ? 'playlistView.songMenu.deletePhoto' : 'playlistView.songMenu.delete');

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

        // XOÁ (v13 Batch F) — `handleSongActionMenuSelect(action)`: vừa TỰ ĐỌC `playlistStore`
        // (Rule 2) vừa if/else giữa 2 nghiệp vụ khác hẳn nhau — xoá bài / mở modal sửa (Rule 1).
        // 4 hành động trước đó (addToFolder/editSubtitles/editVideoFile/restore) đã lần lượt tách ra
        // msg.type riêng để NÉ hàm này thay vì sửa; nay 2 hành động cuối tách nốt
        // ('playlist.actionMenu.delete.click'/'.edit.click' -> workflowPlaylist), hàm hết lý do tồn tại.

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

        /**
         * SỬA (ver12 "Song/Video Unification", phản hồi Giang 28/07/2026) — modal này DÙNG CHUNG
         * cho cả Song lẫn Video (Batch 1: Adapter khiến playlistCache của Video có shape giống hệt
         * Song, `cached.mediaType` phân biệt) — TRƯỚC ĐÂY luôn hiện Title/Artist/Album/tab Cover dù
         * đang mở cho 1 VIDEO (rỗng vô nghĩa cho Artist/Album, tab Cover không áp dụng được cho
         * Video). Giờ rẽ nhánh theo `cached.mediaType`:
         *   - Video: tab "Chi tiết" đổi hẳn sang thông số kỹ thuật (tên file gốc/dung lượng/codec/
         *     độ phân giải/fps/thời lượng/bitrate/codec+bitrate âm thanh/ngày tải) + GIỮ Lượt phát/
         *     Đã nghe (dùng CHUNG mediaStatsMap, key-agnostic — xem core/listen-stats.js). Tab "Sửa"
         *     chỉ còn 1 ô "Tên hiển thị" (customName). Tab "Ảnh bìa" ẨN HẲN (Video không có khái
         *     niệm ảnh bìa tự chọn).
         *   - Song: GIỮ NGUYÊN 100% hành vi cũ.
         * Đọc `getVideoRecord()` (service/db.js, data layer — ngoại lệ Rule 3) để lấy field CHỈ có
         * trên record thô (customName/blob.size) — `playlistCache` (Adapter shape) không có field này.
         *
         * XOÁ (29/07/2026, yêu cầu Giang mục 1 — "chỉ giữ filename/RESOLUTION/playcount/listened")
         * — tab "Chi tiết" của Video RÚT GỌN CHỈ CÒN 4 field: tên file gốc, độ phân giải, lượt
         * phát, đã nghe — bỏ hẳn dung lượng/codec/fps/thời lượng/bitrate/codec+bitrate âm thanh/
         * ngày tải (7 field). Vì 5 trong số đó (codec/fps/bitrate/audioCodec/audioBitrate) CHỈ tồn
         * tại để phục vụ hiển thị ở đây, việc phân tích mediainfo.js (WASM) lúc upload cũng bỏ theo
         * (event/workflow/file-manager-video.js::_extractVideoMediaInfo() ĐÃ XOÁ) — `getVideoRecord()`
         * không còn trả các field đó nữa.
         */
        async function openSongEditModal(key) {
            const cached = appState.get('playlistCache').get(key); if (!cached) return;
            playlistStore.set({ songEditCurrentKey: key, songEditPendingCover: null });
            revokeSongEditPendingPreview(); // an toàn cho CẢ 3 nhánh — dọn preview còn sót từ lần mở TRƯỚC (nếu có)

            const isVideo = cached.mediaType === 'video';
            const isPhoto = cached.mediaType === 'photo';
            songEditTabBtnCover.classList.toggle('hidden', isVideo || isPhoto);
            songEditFieldsSongGroup.classList.toggle('hidden', isVideo || isPhoto);
            songEditFieldsVideoGroup.classList.toggle('hidden', !isVideo);
            // MỚI (Giang yêu cầu — Photo tích hợp duration như Song/Video, "thêm action detail cho
            // dropdown của photo") — nhóm field thứ 3, mirror ĐÚNG cách 2 nhóm trên toggle.
            if (songEditFieldsPhotoGroup) songEditFieldsPhotoGroup.classList.toggle('hidden', !isPhoto);

            const stats = getSongStats(key); // core/listen-stats.js — key-agnostic (Map<string,...>), dùng chung được cho videoKey/imageKey
            const emptyVal = t('playlistView.songInfo.empty');

            if (isVideo) {
                const videoRecord = await getVideoRecord(key); // service/db.js
                // FIX (Giang báo — "edit name chỉ là placeholder, cần chèn sẵn vào input") — TRƯỚC
                // ĐÂY .value luôn rỗng khi chưa từng đặt customName, filename chỉ nằm ở placeholder
                // (chữ xám, không phải giá trị thật) — giờ LUÔN điền .value bằng đúng tên ĐANG hiển
                // thị (customName nếu có, không thì filename bỏ đuôi mở rộng) — mở lên thấy tên
                // thật, sửa trực tiếp, không cần gõ lại từ đầu. Bỏ hẳn .placeholder (không còn cần
                // — .value đã luôn có nội dung khi record tồn tại).
                songEditCustomNameInput.value = videoRecord ? (videoRecord.customName || stripFileExtension(videoRecord.filename)) : ''; // core/file-manager/video.js
                songEditCustomNameInput.placeholder = '';
                // MỚI (Giang yêu cầu — "bổ sung field album edit ở details của video/photo") — mirror
                // ĐÚNG cách songEditAlbumInput của Song hoạt động (core/playlist/loader.js::
                // buildVideoPlaylistCache() đọc record.album vào cached.tag.album).
                if (songEditVideoAlbumInput) songEditVideoAlbumInput.value = videoRecord ? (videoRecord.album || '') : '';

                const resolutionText = (videoRecord && videoRecord.width && videoRecord.height) ? `${videoRecord.width}×${videoRecord.height}` : emptyVal;

                songEditTabDetails.innerHTML =
                    songInfoRowHtml('M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', 'bg-sky-500/15 text-sky-400', t('playlistView.songInfo.fieldFilename'), (videoRecord && videoRecord.filename) ? escapeHtml(videoRecord.filename) : emptyVal) +
                    songInfoRowHtml('M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4', 'bg-emerald-500/15 text-emerald-400', t('playlistView.songInfo.fieldResolution'), resolutionText) +
                    // MỚI (Giang yêu cầu — thêm field Album) — mirror ĐÚNG hàng Album của Song ngay dưới.
                    songInfoRowHtml('M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM3 9a9 9 0 0118 0', 'bg-fuchsia-500/15 text-fuchsia-400', t('playlistView.songInfo.fieldAlbum'), (videoRecord && videoRecord.album) || emptyVal) +
                    songInfoRowHtml('M9 19V6l12-3v13M5 21a2 2 0 100-4 2 2 0 000 4zm12-2a2 2 0 100-4 2 2 0 000 4z', 'bg-rose-500/15 text-rose-400', t('playlistView.songInfo.fieldPlayCount'), tFormat('playlistView.songInfo.fieldPlayCountValue', { n: stats.count })) +
                    songInfoRowHtml('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', 'bg-indigo-500/15 text-indigo-400', t('playlistView.songInfo.fieldListened'), formatListenTime(stats.totalTime)) +
                    // MỚI (mục 1e, phản hồi Giang — "detail modal thêm dung lượng") — formatBytes()
                    // có sẵn (core/about-stats.js, dùng chung với Quản lý dung lượng), đọc thẳng
                    // `cached.size` (core/playlist/loader.js, cùng đợt thêm với addedAt).
                    songInfoRowHtml('M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0l-2 7H6l-2-7m16 0H4', 'bg-teal-500/15 text-teal-400', t('playlistView.songInfo.fieldSize'), formatBytes(cached.size));
            } else if (isPhoto) {
                // MỚI (Giang yêu cầu — Photo tích hợp duration như Song/Video, "trong đó sẽ hiển thị
                // tên file, kích thước, duration, count, filesize" — ĐÚNG 5 field theo thứ tự Giang
                // liệt kê, KHÔNG có "Đã nghe" — ảnh không tính thời gian nghe, xem docstring đầu
                // event/workflow/photo-player.js). MỚI (Giang yêu cầu sau — thêm field Album) —
                // chèn thêm 1 hàng, KHÔNG đổi thứ tự 5 field gốc.
                const imageRecord = await getImageRecord(key); // service/db.js
                // FIX (Giang báo — "edit name chỉ là placeholder, cần chèn sẵn vào input") — CÙNG
                // lý do nhánh Video ngay trên.
                songEditPhotoNameInput.value = imageRecord ? (imageRecord.customName || stripFileExtension(imageRecord.filename)) : '';
                songEditPhotoNameInput.placeholder = '';
                if (songEditPhotoAlbumInput) songEditPhotoAlbumInput.value = imageRecord ? (imageRecord.album || '') : '';
                songEditPhotoDurationValueEl.textContent = formatTime(cached.duration);
                playlistStore.set({ songEditPendingPhotoDurationSec: cached.duration || 0 }); // pending riêng — chỉ ghi thật lúc bấm Lưu, cùng nguyên tắc pendingCover của Song

                const resolutionText = (cached.width && cached.height) ? `${cached.width}×${cached.height}` : emptyVal;

                songEditTabDetails.innerHTML =
                    songInfoRowHtml('M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', 'bg-sky-500/15 text-sky-400', t('playlistView.songInfo.fieldFilename'), (imageRecord && imageRecord.filename) ? escapeHtml(imageRecord.filename) : emptyVal) +
                    songInfoRowHtml('M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4', 'bg-emerald-500/15 text-emerald-400', t('playlistView.songInfo.fieldResolution'), resolutionText) +
                    songInfoRowHtml('M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM3 9a9 9 0 0118 0', 'bg-fuchsia-500/15 text-fuchsia-400', t('playlistView.songInfo.fieldAlbum'), (imageRecord && imageRecord.album) || emptyVal) +
                    songInfoRowHtml('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', 'bg-amber-500/15 text-amber-400', t('playlistView.songInfo.fieldDuration'), formatTime(cached.duration)) +
                    songInfoRowHtml('M9 19V6l12-3v13M5 21a2 2 0 100-4 2 2 0 000 4zm12-2a2 2 0 100-4 2 2 0 000 4z', 'bg-rose-500/15 text-rose-400', t('playlistView.songInfo.fieldPlayCount'), tFormat('playlistView.songInfo.fieldPlayCountValue', { n: stats.count })) +
                    songInfoRowHtml('M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0l-2 7H6l-2-7m16 0H4', 'bg-teal-500/15 text-teal-400', t('playlistView.songInfo.fieldSize'), formatBytes(cached.size));
            } else {
                songEditTitleInput.value = cached.tag.title || '';
                songEditArtistInput.value = cached.tag.artist || '';
                songEditAlbumInput.value = cached.tag.album || '';

                setSongEditCoverPreview(cached.cover ? URL.createObjectURL(cached.cover) : DEFAULT_VINYL);
                // Object URL trên chỉ sống trong lúc modal mở (preview ảnh HIỆN TẠI, không phải pending);
                // gán vào songEditPendingCoverPreviewUrl để được revoke đồng bộ lúc đóng modal/đổi ảnh.
                if (cached.cover) playlistStore.set({ songEditPendingCoverPreviewUrl: songEditCoverPreview.src });

                songEditTabDetails.innerHTML =
                    songInfoRowHtml('M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z', 'bg-sky-500/15 text-sky-400', t('playlistView.songInfo.fieldTitle'), cached.tag.title || emptyVal) +
                    songInfoRowHtml('M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', 'bg-violet-500/15 text-violet-400', t('playlistView.songInfo.fieldArtist'), cached.tag.artist || emptyVal) +
                    songInfoRowHtml('M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM3 9a9 9 0 0118 0', 'bg-emerald-500/15 text-emerald-400', t('playlistView.songInfo.fieldAlbum'), cached.tag.album || emptyVal) +
                    songInfoRowHtml('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', 'bg-amber-500/15 text-amber-400', t('playlistView.songInfo.fieldDuration'), formatTime(cached.duration)) +
                    songInfoRowHtml('M9 19V6l12-3v13M5 21a2 2 0 100-4 2 2 0 000 4zm12-2a2 2 0 100-4 2 2 0 000 4z', 'bg-rose-500/15 text-rose-400', t('playlistView.songInfo.fieldPlayCount'), tFormat('playlistView.songInfo.fieldPlayCountValue', { n: stats.count })) +
                    songInfoRowHtml('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', 'bg-indigo-500/15 text-indigo-400', t('playlistView.songInfo.fieldListened'), formatListenTime(stats.totalTime)) +
                    // MỚI (mục 1e) — CÙNG LÝ DO nhánh Video ngay trên.
                    songInfoRowHtml('M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0l-2 7H6l-2-7m16 0H4', 'bg-teal-500/15 text-teal-400', t('playlistView.songInfo.fieldSize'), formatBytes(cached.size));
            }

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
         * MỚI (ver12 "Song/Video Unification", phản hồi Giang 28/07/2026) — bản Video của
         * captureSongEditFormState() ngay trên. SỬA (Giang yêu cầu — "bổ sung field album edit") —
         * đọc thêm ô Album.
         * @returns {{key: string|null, customName: string, album: string}}
         */
        function captureVideoEditFormState() {
            const key = playlistStore.get('songEditCurrentKey');
            return {
                key,
                customName: songEditCustomNameInput.value.trim(),
                album: songEditVideoAlbumInput ? songEditVideoAlbumInput.value.trim() : '',
            };
        }

        /**
         * Bản Video của applySongEditAndSave() ngay trên — VIẾT RIÊNG (không gọi
         * core/file-manager/video.js::setVideoCustomName(), core gọi core khác file VẪN là core
         * gọi core — Rule 3 áp dụng bất kể ranh giới file) — inline 2 dòng ghi customName trực
         * tiếp tại đây.
         * FIX (Giang báo — sau khi Lưu tab "Sửa", cover mất + phát lỗi không hiển thị video) — CÙNG
         * GỐC BUG đã fix cho Song (`rematerializeBlob()`, service/db.js, xem comment ở
         * applySongEditAndSave() dưới) nhưng CHƯA từng áp dụng ở đây: `record.blob`/`record.thumbBlob`
         * đọc lên từ `getVideoRecord()` là Blob ROUND-TRIP qua IndexedDB — ghi lại NGUYÊN 2 Blob đó
         * (dù không đổi 1 byte nội dung) khiến backing file không ổn định trong CÙNG phiên (bug
         * Chromium) — thumbnail (record.thumbBlob, hiện ở item Playlist) vỡ NGAY, video (record.blob)
         * lỗi decode khi phát lại KHÔNG CẦN reload trang. Vật chất hoá lại CẢ 2 trước khi ghi.
         * FIX 2 (Giang báo tiếp — "vẫn bị lỗi... bị chèn cover mặc định") — bug trên CHỈ vá được
         * phần GHI XUỐNG DB; `cached.cover` (playlistCache, THỨ THẬT sự được dùng để vẽ lại item
         * ngay sau khi Lưu — xem core/playlist/render.js) vẫn là Blob CŨ, đọc TỪ TRƯỚC lúc modal mở
         * (khác reference với `record.thumbBlob` vừa rematerialize ở trên) — object URL tạo từ Blob
         * cũ đó decode lỗi (CÙNG root cause), `attachCoverFallback()` (render.js) bắt lỗi `onerror`
         * rồi tự thay bằng DEFAULT_VINYL — ĐÚNG triệu chứng "bị chèn cover mặc định". Fix: trỏ
         * `cached.cover` sang ĐÚNG Blob vừa rematerialize (chắc chắn ổn định) thay vì Blob cũ.
         * @param {string} key
         * @param {string} customName - rỗng = xoá tên riêng, rơi về filename gốc (đã bỏ đuôi mở
         *        rộng) khi hiển thị.
         * @param {string} album - rỗng = xoá album.
         * @returns {{status: 'notFound'|'ok'}}
         */
        async function applyVideoEditAndSave(key, customName, album) {
            const record = await getVideoRecord(key); // service/db.js
            if (!record) return { status: 'notFound' };
            record.customName = customName || null;
            record.album = album || null; // MỚI (Giang yêu cầu — field Album)
            if (record.blob) record.blob = await rematerializeBlob(record.blob); // service/db.js — FIX round-trip, xem docstring trên
            if (record.thumbBlob) record.thumbBlob = await rematerializeBlob(record.thumbBlob); // service/db.js — CÙNG lý do, thumbnail item Playlist
            await setVideoRecord(key, record); // service/db.js

            const displayName = record.customName || stripFileExtension(record.filename); // core/file-manager/video.js
            const cached = appState.get('playlistCache').get(key);
            if (cached) {
                cached.tag.title = displayName;
                cached.tag.album = record.album || ''; // MỚI — search/filter đọc field này (core/playlist/order.js, core/playlist/filter.js), đã hoạt động chung sẵn, chỉ cần field có dữ liệu
                cached.cover = record.thumbBlob || record.blob; // FIX 2 — trỏ sang Blob vừa rematerialize, xem docstring trên
            }
            appState.mutate('songNameIndex', m => m.set(key, normalizeSongName(displayName)));

            if (key === appState.get('currentKey')) {
                playerTitle.textContent = displayName;
                if ('mediaSession' in navigator) {
                    navigator.mediaSession.metadata = new MediaMetadata({ title: displayName, artist: '', artwork: [] });
                }
            }
            return { status: 'ok' };
        }

        /**
         * MỚI (Giang yêu cầu — Photo tích hợp duration như Song/Video) — bản Photo của
         * captureVideoEditFormState() ngay trên — đọc thêm `songEditPendingPhotoDurationSec` (KHÔNG
         * đọc trực tiếp từ input số tay — duration Photo sửa qua time-picker riêng, xem
         * event/workflow/playlist.js::openPhotoEditDurationPicker(), giá trị pending lưu tạm ở
         * playlistStore CHỈ ghi thật lúc bấm "Lưu", cùng nguyên tắc pendingCover của Song). SỬA
         * (Giang yêu cầu — "bổ sung field album edit") — đọc thêm ô Album.
         * @returns {{key: string|null, customName: string, durationSec: number, album: string}}
         */
        function capturePhotoEditFormState() {
            const key = playlistStore.get('songEditCurrentKey');
            return {
                key,
                customName: songEditPhotoNameInput.value.trim(),
                durationSec: playlistStore.get('songEditPendingPhotoDurationSec'),
                album: songEditPhotoAlbumInput ? songEditPhotoAlbumInput.value.trim() : '',
            };
        }

        /**
         * Bản Photo của applyVideoEditAndSave() ngay trên — VIẾT RIÊNG (cùng lý do Rule 3 đã giải
         * thích ở đó). Ghi CẢ `customName` LẪN `duration` LẪN `album` cùng lúc (1 nút Lưu cho cả
         * tab "Sửa").
         * FIX (Giang báo — sau khi Lưu tab "Sửa", cover mất + phát lỗi không hiển thị ảnh) — CÙNG
         * GỐC BUG applyVideoEditAndSave() ngay trên vừa fix (`rematerializeBlob()`, service/db.js)
         * — `record.blob`/`record.thumbBlob` round-trip qua IndexedDB, PHẢI vật chất hoá lại trước
         * khi ghi.
         * FIX 2 (Giang báo tiếp — "vẫn bị lỗi... bị chèn cover mặc định") — CÙNG GỐC applyVideoEditAndSave()'s
         * FIX 2 — `cached.cover` phải trỏ sang ĐÚNG Blob vừa rematerialize, xem docstring ở đó.
         * @param {string} key
         * @param {string} customName - rỗng = xoá tên riêng, rơi về filename gốc khi hiển thị.
         * @param {number} durationSec - giây, số thực, KHÔNG kẹp trần (Giang chốt "có min nhưng
         *        không max" — sàn DURATION_MIN_SEC đã tự áp trong openPhotoEditDurationPicker(),
         *        event/workflow/playlist.js, TRƯỚC khi giá trị này tới được đây).
         * @param {string} album - rỗng = xoá album.
         * @returns {{status: 'notFound'|'ok'}}
         */
        async function applyPhotoEditAndSave(key, customName, durationSec, album) {
            const record = await getImageRecord(key); // service/db.js
            if (!record) return { status: 'notFound' };
            record.customName = customName || null;
            record.duration = durationSec;
            record.album = album || null; // MỚI (Giang yêu cầu — field Album)
            if (record.blob) record.blob = await rematerializeBlob(record.blob); // service/db.js — FIX round-trip, xem docstring applyVideoEditAndSave()
            if (record.thumbBlob) record.thumbBlob = await rematerializeBlob(record.thumbBlob); // service/db.js — CÙNG lý do, thumbnail item Playlist
            await setImageRecord(key, record); // service/db.js

            const displayName = record.customName || stripFileExtension(record.filename);
            const cached = appState.get('playlistCache').get(key);
            if (cached) {
                cached.tag.title = displayName;
                cached.tag.album = record.album || ''; // MỚI — search/filter dùng chung sẵn, xem applyVideoEditAndSave()
                cached.duration = durationSec;
                cached.cover = record.thumbBlob || record.blob; // FIX 2 — xem docstring applyVideoEditAndSave()
            }
            appState.mutate('songNameIndex', m => m.set(key, normalizeSongName(displayName)));

            if (key === appState.get('currentKey')) {
                playerTitle.textContent = displayName;
                appState.set('photoPlayerDurationSec', durationSec, { skipCheck: true }); // event/workflow/photo-player.js đọc field này mỗi tick — ảnh ĐANG hiển thị đổi duration ngay, không cần đợi phát lại
                if ('mediaSession' in navigator) {
                    navigator.mediaSession.metadata = new MediaMetadata({ title: displayName, artist: '', artwork: [] });
                }
            }
            return { status: 'ok' };
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
            // FIX (Giang báo — sau khi Lưu tab "Sửa" mà KHÔNG đổi cover, cover mất) — TRƯỚC ĐÂY chỉ
            // rematerialize `record.blob`, bỏ sót `record.cover`: khi người dùng CHỈ sửa title/
            // artist (không đụng cover), `record.cover` ở đây vẫn NGUYÊN Blob round-trip từ
            // getSongRecord() phía trên (2 nhánh if/else if trên KHÔNG chạy) — CÙNG GỐC BUG với
            // record.blob ngay dưới (rematerializeBlob(), service/db.js), ghi lại nguyên xi cũng vỡ
            // y hệt. CHỈ rematerialize khi record.cover THỰC SỰ là Blob round-trip (không phải File
            // mới vừa gán ở nhánh trên, cũng không phải đã bị xoá) — dùng else if nối tiếp 2 nhánh
            // trên, tự loại 2 trường hợp đó.
            else if (record.cover) record.cover = await rematerializeBlob(record.cover);
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
        // riêng từ modal thông tin" (xuất file vẫn làm được qua "Xuất file" trong menu 3 chấm,
        // workflowPlaylist.exportSongWithTag()/exportVideoFile() — event/workflow/playlist.js,
        // Batch "Export dọn nợ kiến trúc" — không mất tính năng, chỉ gộp điểm vào).

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
