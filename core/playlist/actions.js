/**
 * core/playlist/actions.js — hành động trên 1 mục Playlist: menu 3 chấm, modal lỗi lúc phát, modal "Sửa thông tin"
 * (tab Chi tiết / Sửa / Ảnh bìa). Chỉ ghi DOM + tính dữ liệu thuần; shield/modal/đọc DB ở event/workflow/playlist.js,
 * sự kiện ở event/listener/playlist.js.
 *
 * State của các modal (đang mở mục nào, ảnh bìa đang chờ áp dụng gì…) sống trong `playlistStore` (event/store.js, tạo
 * ngay dưới) — Router/Core/Workflow cùng thấy 1 nguồn.
 */
        const playlistStore = new EventStore('playlist');

        // ===================== Menu 3 chấm dùng chung =====================
        // songActionMenu/songActionOverlay: core/dom-refs.js. songActionMenuKey (đang mở menu cho mục nào): playlistStore.

        /**
         * Ẩn/hiện mục theo `cached.mediaType` (đọc thẳng `playlistCache`; thiếu cache coi như Song):
         *   - "Sửa phụ đề": chỉ Song. "Sửa video": chỉ Video. "Edit image": chỉ Photo.
         *   - "Chi tiết", "Xuất file": luôn hiện (workflowPlaylist.exportActiveMenuItem() tự rẽ theo Nguồn).
         *   - "Gỡ khỏi thư mục": chỉ khi đang Scope 1 folder của Nguồn hiện tại và folder không Read-only (cùng điều kiện
         *     `canRemoveFromFolder` của Selection mode).
         *   - Nhãn "Xoá" đổi chữ theo loại mục (`#song-menu-delete-label`).
         */
        function openSongActionMenu(key, anchorBtn) {
            playlistStore.set({ songActionMenuKey: key });
            const cached = appState.get('playlistCache').get(key);
            const isVideo = !!(cached && cached.mediaType === 'video');
            const isPhoto = !!(cached && cached.mediaType === 'photo');
            songMenuBtnEditSubtitles.classList.toggle('hidden', isVideo || isPhoto);
            if (songMenuBtnEdit) songMenuBtnEdit.classList.toggle('hidden', false);
            if (songMenuBtnRestore) songMenuBtnRestore.classList.remove('hidden');
            songMenuBtnEditVideo.classList.toggle('hidden', !isVideo);
            if (songMenuBtnEditImage) songMenuBtnEditImage.classList.toggle('hidden', !isPhoto);
            if (songMenuBtnRemoveFromFolder) {
                const canRemoveFromFolder = appState.get('activePlayListFolder')[appState.get('activeMediaSource')] != null && !appState.get('isActiveFolderReadOnly');
                songMenuBtnRemoveFromFolder.classList.toggle('hidden', !canRemoveFromFolder);
            }
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

        // ===================== Modal: Bài hát lỗi lúc phát =====================
        // playbackErrorModal/playbackErrorFilename: core/dom-refs.js. playbackErrorKey (modal đang nói về mục nào): playlistStore.

        function handlePlaybackError(key) {
            playlistStore.set({ playbackErrorKey: key });
            const cached = appState.get('playlistCache').get(key);
            playbackErrorFilename.textContent = cached ? cached.filename : key;
            playbackErrorModal.classList.remove('hidden');
        }

        /**
         * Đọc + xoá state "đang hỏi xoá mục lỗi nào" và ẩn modal ngay. Workflow gọi trước, lấy key rồi tự bọc shield quanh
         * bước xoá.
         * @returns {string|null} key đang chờ xoá, hoặc null nếu không có gì đang mở
         */
        function getAndClearPlaybackErrorKey() {
            const key = playlistStore.get('playbackErrorKey');
            if (!key) return null;
            playbackErrorModal.classList.add('hidden');
            playlistStore.set({ playbackErrorKey: null });
            return key;
        }

        // ===================== Modal: Sửa thông tin (Thông tin + Ảnh bìa) =====================
        // songEditModal + input/nút bên trong: core/dom-refs.js. songEditCurrentKey/songEditPendingCover/
        // songEditPendingCoverPreviewUrl: playlistStore. Ảnh bìa chỉ ghi DB khi bấm "Lưu" (cùng lượt với tag) — "Hủy" không
        // đổi gì. pendingCover: null (không đổi) | File (ảnh mới) | 'remove' (xoá, dùng DEFAULT_VINYL).
        // songEditCoverPreview là <img> cố định trong DOM -> gắn fallback lỗi ảnh 1 lần ở đây.
        attachCoverFallback(songEditCoverPreview);

        function setSongEditCoverPreview(url) {
            songEditCoverPreview.src = url || DEFAULT_VINYL;
        }

        function revokeSongEditPendingPreview() {
            const url = playlistStore.get('songEditPendingCoverPreviewUrl');
            if (url) { URL.revokeObjectURL(url); playlistStore.set({ songEditPendingCoverPreviewUrl: null }); }
        }

        /** Chuyển tab modal Sửa thông tin (details / fields / cover). @param {string} tab */
        function setSongEditTab(tab) {
            const panels = { details: songEditTabDetails, fields: songEditTabFields, cover: songEditTabCover };
            Object.keys(panels).forEach(name => {
                const isActive = name === tab;
                panels[name].classList.toggle('hidden', !isActive);
                panels[name].classList.toggle('flex', isActive && name === 'cover'); // chỉ tab cover cần flex (ảnh + nút cạnh nhau)
            });
            // Chỉ đặt `aria-selected`; kiểu "đang chọn" do key theme `segmentTabActive` (variant `aria-selected:`) lo.
            songEditTabButtons.forEach(btn => {
                btn.setAttribute('aria-selected', String(btn.dataset.editTab === tab));
            });
            // Tab "Chi tiết" chỉ đọc -> ẩn hẳn nút Lưu.
            btnSongEditSave.classList.toggle('hidden', tab === 'details');
        }

        // Các bước ghi DOM của modal Sửa thông tin — Workflow (event/workflow/playlist.js::openSongEditModal()) đọc dữ liệu
        // rồi gọi lần lượt. Video/Photo ẩn tab Ảnh bìa; ô tên điền sẵn tên đang hiển thị; tab "Chi tiết" mở trước.

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
            songEditModal.classList.add('hidden');
        }

        /**
         * Validate + cập nhật preview cho 1 file ảnh bìa mới chọn. Trả {status} — Workflow quyết hiện modal lỗi.
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
         * Đọc state modal Sửa thông tin (key + giá trị input + pending cover) để Workflow lưu.
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
         * Bản Video của captureSongEditFormState(): tên riêng + album.
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
         * Meta mới sau khi sửa tab "Sửa" của Video. Workflow (event/workflow/playlist.js::executeSaveEdit()) truyền hàm
         * này vào `updateMediaMeta()` (service/db.js — chỉ ghi store meta, không ghi lại Blob).
         * @param {object} meta - meta hiện tại (KHÔNG có Blob)
         * @param {string} customName - rỗng = xoá tên riêng
         * @param {string} album - rỗng = xoá album
         * @returns {object} meta mới
         */
        function buildVideoEditMeta(meta, customName, album) {
            return { ...meta, customName: customName || null, album: album || null };
        }

        /**
         * Bản Photo của captureVideoEditFormState(): thêm thời lượng đang chờ (`songEditPendingPhotoDurationSec`, sửa qua
         * time-picker — event/workflow/playlist.js::openPhotoEditDurationPicker(), chỉ ghi thật lúc bấm "Lưu").
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
         * Meta mới sau khi sửa tab "Sửa" của Photo (tên riêng + thời lượng + album).
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
         * Meta mới sau khi sửa tag Song. Ảnh bìa không nằm trong meta: Workflow ghi store thumb qua `setMediaThumbs()` khi
         * người dùng chọn ảnh mới / xoá ảnh.
         * @param {object} meta
         * @param {Object} newTag - {title, artist, album}
         * @returns {object} meta mới
         */
        function buildSongEditMeta(meta, newTag) {
            return { ...meta, tag: { ...meta.tag, ...newTag } };
        }

