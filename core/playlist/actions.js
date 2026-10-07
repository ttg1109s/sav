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
 * chú riêng) mà event/router/playlist.js + event/workflow/playlist.js gọi tới.
 *
 * [SỬA 07/09/2026 — "đưa về chuẩn event bus + core rule"] `window.removeSong` (từng GIỮ Ở ĐÂY với
 * lý do "được gọi từ rất nhiều nơi như 1 API core công khai") ĐÃ DỜI HẲN sang
 * `event/workflow/playlist.js::deleteMediaFromActionMenu()` — kiểm tra lại toàn project cho thấy
 * CHỈ CÓ ĐÚNG 1 caller (chính hàm đó), không phải "rất nhiều nơi" như giả định ban đầu, nên lý do
 * giữ ở tầng Core không còn đúng — dời hẳn về nơi orchestration thật sự (Workflow, nơi
 * alertModal/withLoadingShield được phép dùng).
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

        // DỜI (24/09/2026, dọn nợ "Core gọi Workflow") — `removeKeyFromDisplay()` (tự appState.get/set + gọi
        // workflowPlaylistOrder/workflowPlaylistRender) sang event/workflow/playlist-order.js::
        // `workflowPlaylistOrder.removeKeyFromDisplay()`, thân giữ nguyên.

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
         * SỬA (07/09/2026, "đưa về chuẩn event bus + core rule") — `window.removeSong()` (thân hàm
         * đầy đủ: check "đang phát" + shield + rẽ nhánh mediaType + dọn player/UI) ĐÃ DỜI HẲN sang
         * `event/workflow/playlist.js::deleteMediaFromActionMenu()` — hàm đó là caller DUY NHẤT (xem
         * kiểm tra toàn project trước đợt sửa này), và bản thân hàm cũ VỐN ĐÃ mixed core/workflow
         * (tự gọi alertModal/withLoadingShield — vi phạm "core không biết shield/modal") nên gộp
         * thẳng vào caller thay vì giữ 2 lớp giả. Các bước con dưới đây (getRecordFn theo mediaType,
         * removeSongFromAllFolders/deleteRecord (registry)/removeSongStats/
         * removeKeyFromDisplay) VẪN core thuần, KHÔNG đổi gì — Workflow mới chỉ đổi CHỖ GỌI.
         */

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
         * động đúng cho Photo (Folder type='photo' MỚI; deleteMediaFromActionMenu() — event/
         * workflow/playlist.js — đã có nhánh photo).
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
            // XOÁ (06/10/2026, Giang) — dòng bật/tắt nút "View full thumbnail" của Video bỏ hẳn cùng action.
            // MỚI (06/09/2026, hợp nhất Folder vào Playlist) — chỉ hiện khi đang Scope 1 folder của
            // ĐÚNG Nguồn hiện tại VÀ folder đó không phải Read-only (mục 4b), CÙNG điều kiện
            // `canRemoveFromFolder` đã tính cho bản Selection mode (event/router/playlist.js, case
            // 'playlist.selection.moreMenu.open') — ở đây tính lại tại chỗ vì hàm này KHÔNG nhận
            // tham số ngoài (đã theo đúng chữ ký cũ, khớp mọi nơi gọi hiện có).
            if (songMenuBtnRemoveFromFolder) {
                const canRemoveFromFolder = appState.get('activePlayListFolder')[appState.get('activeMediaSource')] != null && !appState.get('isActiveFolderReadOnly');
                songMenuBtnRemoveFromFolder.classList.toggle('hidden', !canRemoveFromFolder);
            }
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

        // DỜI (24/09/2026) — `confirmKeepBrokenSong()` (tự đọc playlistStore + gọi removeKeyFromDisplay — core gọi
        // hàm đã dời sang Workflow) thay bằng event/workflow/playlist.js::`workflowPlaylist.keepBrokenSong()`
        // (tái dùng core `getAndClearPlaybackErrorKey()` ngay dưới).

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

        // DỜI (24/09/2026) — `deleteBrokenSongByKey()` (deleteSongRecord + removeSongStats + removeKeyFromDisplay —
        // core gọi core/Workflow) bỏ hẳn: 3 bước đứng cạnh nhau ở event/workflow/playlist.js::
        // `executePlaybackErrorDelete()` (cùng khuôn `deleteMediaFromActionMenu()`).

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
            // SỬA 21/09/2026 — CHỈ đặt `aria-selected`; kiểu "đang chọn" do key theme `segmentTabActive` (variant
            // `aria-selected:`) lo. TRƯỚC ĐÂY bật/tắt `bg-white/10`/`text-white`/`shadow`/`text-slate-400` bằng JS —
            // các class màu này ĐỤNG class `data-uitk` (nền trắng + chữ slate), trong CSS `text-white` và `bg-white/10`
            // sinh SAU nên thắng -> tab đang chọn chữ TRẮNG trên nền gần như trắng (tương phản thấp).
            songEditTabButtons.forEach(btn => {
                btn.setAttribute('aria-selected', String(btn.dataset.editTab === tab));
            });
            // MỚI (11/07/2026, yêu cầu Giang) — nút "Lưu" CHỈ có ý nghĩa ở 2 tab thật sự SỬA được
            // (Sửa/fields + Ảnh bìa/cover) — tab "Chi tiết" (details) đọc-thôi, hiện nút Lưu ở đó
            // gây hiểu lầm "bấm Lưu để lưu xem chi tiết" (vô nghĩa). Ẩn hẳn nút, KHÔNG chỉ disable
            // (disable vẫn chiếm chỗ + có thể gây thắc mắc "sao không bấm được").
            btnSongEditSave.classList.toggle('hidden', tab === 'details');
        }

        // DỜI (06/10/2026, dọn nợ Rule 2/3 — Giang yêu cầu "xử lý nốt nợ kỹ thuật") — `openSongEditModal()` (core tự
        // appState.get('playlistCache'), tự đọc DB getVideoRecord/getImageRecord, tự tạo blob URL, gọi ~10 hàm core khác) sang
        // event/workflow/playlist.js::openSongEditModal(). Ở đây chỉ còn các bước THI HÀNH ghi DOM, mỗi hàm đúng 1 việc,
        // Workflow gọi lần lượt. Giữ nguyên hành vi: Video/Photo ẩn tab Ảnh bìa; ô tên điền sẵn tên đang hiển thị
        // (customName hoặc filename bỏ đuôi); tab "Chi tiết" mở trước.

        /** Ẩn/hiện tab Ảnh bìa + 3 nhóm field theo loại media. @param {'song'|'video'|'photo'} mediaType */
        function toggleSongEditFieldGroups(mediaType) {
            const isVideo = mediaType === 'video';
            const isPhoto = mediaType === 'photo';
            songEditTabBtnCover.classList.toggle('hidden', isVideo || isPhoto);
            songEditFieldsSongGroup.classList.toggle('hidden', isVideo || isPhoto);
            songEditFieldsVideoGroup.classList.toggle('hidden', !isVideo);
            if (songEditFieldsPhotoGroup) songEditFieldsPhotoGroup.classList.toggle('hidden', !isPhoto);
        }

        /** Điền tab "Sửa" Video — tên đang hiển thị (ghi thẳng .value, không dùng placeholder) + album. */
        function fillVideoEditFields(displayName, album) {
            songEditCustomNameInput.value = displayName;
            songEditCustomNameInput.placeholder = '';
            if (songEditVideoAlbumInput) songEditVideoAlbumInput.value = album;
        }

        /** Điền tab "Sửa" Photo — tên + album + nhãn thời lượng (giá trị pending ghi ở playlistStore do Workflow lo). */
        function fillPhotoEditFields(displayName, album, durationText) {
            songEditPhotoNameInput.value = displayName;
            songEditPhotoNameInput.placeholder = '';
            if (songEditPhotoAlbumInput) songEditPhotoAlbumInput.value = album;
            songEditPhotoDurationValueEl.textContent = durationText;
        }

        /** Điền tab "Sửa" Song từ tag hiện tại (ảnh bìa preview do Workflow gán qua setSongEditCoverPreview()). */
        function fillSongEditFields(tag) {
            songEditTitleInput.value = tag.title || '';
            songEditArtistInput.value = tag.artist || '';
            songEditAlbumInput.value = tag.album || '';
        }

        /** Gán nội dung tab "Chi tiết" (HTML dựng sẵn từ renderSongInfoRowHtml() — components/playlist-view.js, gọi từ Workflow — giá trị người dùng đã escape). */
        function setSongEditDetailsHtml(html) {
            songEditTabDetails.innerHTML = html;
        }

        /** Hiện modal Sửa thông tin. */
        function showSongEditModal() {
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
         * SỬA (06/10/2026, plan-media-db-split.md — THAY `applyVideoEditAndSave()`, core cũ tự đọc DB + appState + DOM,
         * vi phạm Rule 2/3) — CHỈ còn phần tính dữ liệu THUẦN: meta mới sau khi sửa tab "Sửa" của Video. Workflow
         * (event/workflow/playlist.js::executeSaveEdit()) truyền hàm này vào `updateMediaMeta()` (service/db.js — chỉ ghi
         * store meta, KHÔNG ghi lại Blob nào nên hết hẳn lỗi round-trip cũ: cover mất / video lỗi decode sau khi Lưu).
         * @param {object} meta - meta hiện tại (KHÔNG có Blob)
         * @param {string} customName - rỗng = xoá tên riêng
         * @param {string} album - rỗng = xoá album
         * @returns {object} meta mới
         */
        function buildVideoEditMeta(meta, customName, album) {
            return { ...meta, customName: customName || null, album: album || null };
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
         * SỬA (06/10/2026, plan-media-db-split.md — THAY `applyPhotoEditAndSave()`, cùng lý do buildVideoEditMeta() ngay
         * trên) — meta mới sau khi sửa tab "Sửa" của Photo (tên riêng + thời lượng + album).
         * @param {object} meta
         * @param {string} customName - rỗng = xoá tên riêng
         * @param {number} durationSec - giây (sàn DURATION_MIN_SEC đã áp ở picker, không kẹp trần)
         * @param {string} album - rỗng = xoá album
         * @returns {object} meta mới
         */
        function buildPhotoEditMeta(meta, customName, durationSec, album) {
            return { ...meta, customName: customName || null, duration: durationSec, album: album || null };
        }

        /**
         * SỬA (06/10/2026, plan-media-db-split.md — THAY `applySongEditAndSave()`, cùng lý do buildVideoEditMeta() ở trên)
         * — meta mới sau khi sửa tag Song. Ảnh bìa KHÔNG nằm trong meta: Workflow tự ghi store thumb qua
         * `setMediaThumbs()` khi người dùng chọn ảnh mới / xoá ảnh (giữ nguyên thì không ghi gì).
         * @param {object} meta
         * @param {Object} newTag - {title, artist, album}
         * @returns {object} meta mới
         */
        function buildSongEditMeta(meta, newTag) {
            return { ...meta, tag: { ...meta.tag, ...newTag } };
        }

        // DỜI (24/09/2026, rà soát refresh DOM) — `refreshAfterSongEditSave()` (tự `appState.get()` + gọi 3 hàm
        // Workflow — thực chất là Workflow đặt nhầm trong core) sang event/workflow/playlist.js::
        // `workflowPlaylist._refreshAfterMediaEditSave()`, thân giữ nguyên.

        // ===================== Chi tiết bài hát (gộp vào tab đầu của song-edit-modal, 10/07/2026) =====================
        // SỬA (phản hồi Giang): #song-info-modal cũ ĐÃ XOÁ — nội dung giờ populate thẳng vào
        // `songEditTabDetails` bên trong openSongEditModal() (xem phía trên). `songInfoRowHtml()`
        // GIỮ NGUYÊN (vẫn được dùng, chỉ đổi NƠI GỌI). `openSongInfoModal()`/`closeSongInfoModal()`/
        // `exportCurrentSongInfo()` ĐÃ XOÁ — không còn modal riêng nên không còn "đóng"/"xuất file
        // riêng từ modal thông tin" (xuất file vẫn làm được qua "Xuất file" trong menu 3 chấm,
        // workflowPlaylist.exportSongWithTag()/exportVideoFile() — event/workflow/playlist.js,
        // Batch "Export dọn nợ kiến trúc" — không mất tính năng, chỉ gộp điểm vào).

        // DỜI (07/10/2026, rà soát SVG — Rule 5d) — `songInfoRowHtml()` (template 1 dòng tab "Chi tiết") sang
        // components/playlist-view.js::renderSongInfoRowHtml(), thân + ghi chú giữ nguyên.
