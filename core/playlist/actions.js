/**
 * core/playlist/actions.js — hành động trên 1 mục Playlist: menu 3 chấm, modal lỗi lúc phát, modal "Sửa thông tin"
 * (tab Chi tiết / Sửa / Ảnh bìa). Chỉ ghi DOM + tính dữ liệu thuần; đọc state/DB, shield/modal ở event/workflow/playlist.js,
 * sự kiện ở event/listener/playlist.js.
 *
 * State của các modal (đang mở mục nào, ảnh bìa đang chờ áp dụng gì…) sống trong `playlistStore` (event/store.js, tạo
 * ngay dưới) — core chỉ GHI, Workflow đọc.
 */
        const playlistStore = new EventStore('playlist');

        // ===================== Menu 3 chấm dùng chung =====================
        // songActionMenu/songActionOverlay: core/dom-refs.js.

        /** Nhãn mục "Xoá" theo loại media. */
        const SONG_MENU_DELETE_LABEL_KEY = {
            song: 'playlistView.songMenu.delete',
            video: 'playlistView.songMenu.deleteVideo',
            photo: 'playlistView.songMenu.deletePhoto',
        };

        /**
         * Mục nào của menu 3 chấm hiện cho 1 mục Playlist. "Sửa phụ đề" chỉ Song, "Sửa video" chỉ Video, "Edit image" chỉ
         * Photo; "Gỡ khỏi thư mục" chỉ khi Nguồn đang Scope 1 folder không Read-only (cùng điều kiện Selection mode).
         * @param {'song'|'video'|'photo'} mediaType @param {string|null|undefined} activeFolderId - folder đang Scope của Nguồn hiện tại
         * @param {boolean} isActiveFolderReadOnly
         * @returns {{showEditSubtitles: boolean, showEditVideo: boolean, showEditImage: boolean, showRemoveFromFolder: boolean, deleteLabelKey: string}}
         */
        function resolveSongActionMenuView(mediaType, activeFolderId, isActiveFolderReadOnly) {
            return {
                showEditSubtitles: mediaType === 'song',
                showEditVideo: mediaType === 'video',
                showEditImage: mediaType === 'photo',
                showRemoveFromFolder: activeFolderId != null && !isActiveFolderReadOnly,
                deleteLabelKey: SONG_MENU_DELETE_LABEL_KEY[mediaType] || SONG_MENU_DELETE_LABEL_KEY.song,
            };
        }

        /**
         * Mở menu 3 chấm cho `key`, neo dưới `anchorBtn` (lật lên nếu tràn đáy màn hình).
         * @param {string} key @param {HTMLElement} anchorBtn @param {ReturnType<typeof resolveSongActionMenuView>} view
         */
        function openSongActionMenu(key, anchorBtn, view) {
            playlistStore.set({ songActionMenuKey: key });
            songMenuBtnEditSubtitles.classList.toggle('hidden', !view.showEditSubtitles);
            if (songMenuBtnEdit) songMenuBtnEdit.classList.toggle('hidden', false);
            if (songMenuBtnRestore) songMenuBtnRestore.classList.remove('hidden');
            songMenuBtnEditVideo.classList.toggle('hidden', !view.showEditVideo);
            if (songMenuBtnEditImage) songMenuBtnEditImage.classList.toggle('hidden', !view.showEditImage);
            if (songMenuBtnRemoveFromFolder) songMenuBtnRemoveFromFolder.classList.toggle('hidden', !view.showRemoveFromFolder);
            const deleteLabelEl = songActionMenu.querySelector('#song-menu-delete-label');
            if (deleteLabelEl) deleteLabelEl.textContent = t(view.deleteLabelKey);

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
         * Xoá 1 mục từ menu 3 chấm: tên hiển thị trong thông báo (tag title -> filename -> key; dữ liệu thô, nơi chèn vào HTML
         * phải escape), có bị chặn vì đang phát thật không (nhãn chặn theo loại), và phải dọn player kiểu nào nếu là mục đang
         * phát (Video: thoát Video Player; còn lại: dừng audio + dọn URL).
         * @param {string} key @param {object|undefined} cached @param {string|null} currentKey @param {boolean} isVideoPlayerMode
         * @param {boolean} isVideoPaused - bgVideoElement.paused @param {boolean} isAudioPaused - audioPlayer.paused
         * @returns {{title: string, mediaType: 'song'|'video'|'photo', blockedLabelKey: string|null, currentCleanup: 'video'|'song'|'none'}}
         */
        function resolveMediaDeletePlan(key, cached, currentKey, isVideoPlayerMode, isVideoPaused, isAudioPaused) {
            const mediaType = (cached && cached.mediaType) || 'song';
            const isVideo = mediaType === 'video';
            const isCurrent = key === currentKey;
            const isActuallyPlaying = isVideo ? (isVideoPlayerMode && !isVideoPaused) : !isAudioPaused;
            const blockedKey = isVideo ? 'playlistView.songMenu.deleteBlockedPlayingVideo' : 'playlistView.songMenu.deleteBlockedPlaying';
            const cleanupIfCurrent = isVideo ? 'video' : 'song';
            return {
                title: cached && cached.tag && cached.tag.title ? cached.tag.title : (cached ? cached.filename : key),
                mediaType,
                blockedLabelKey: isCurrent && isActuallyPlaying ? blockedKey : null,
                currentCleanup: isCurrent ? cleanupIfCurrent : 'none',
            };
        }

        // ===================== Modal: Bài hát lỗi lúc phát =====================
        // playbackErrorModal/playbackErrorFilename: core/dom-refs.js. playbackErrorKey (modal đang nói về mục nào): playlistStore.

        /** Mở modal lỗi lúc phát cho mục `key`. @param {string} key @param {string} filename - tên hiển thị (Workflow tra playlistCache) */
        function handlePlaybackError(key, filename) {
            playlistStore.set({ playbackErrorKey: key });
            playbackErrorFilename.textContent = filename;
            playbackErrorModal.classList.remove('hidden');
        }

        /** Ẩn modal lỗi lúc phát + xoá `playbackErrorKey` (Workflow đọc key trước khi gọi). */
        function closePlaybackErrorModal() {
            playbackErrorModal.classList.add('hidden');
            playlistStore.set({ playbackErrorKey: null });
        }

        // ===================== Modal: Sửa thông tin (Thông tin + Ảnh bìa) =====================
        // songEditModal + input/nút bên trong: core/dom-refs.js. Ảnh bìa chỉ ghi DB khi bấm "Lưu" (cùng lượt với tag) —
        // "Hủy" không đổi gì; ảnh chờ lưu (`songEditPendingCover`: null | File | 'remove') do Workflow ghi playlistStore.
        // Ảnh preview lỗi -> đĩa than mặc định: listener 'error' ở event/listener/playlist.js.

        /** @param {string|null} url - null -> đĩa than mặc định */
        function setSongEditCoverPreview(url) {
            songEditCoverPreview.src = url || DEFAULT_VINYL;
        }

        /** Chuyển tab modal Sửa thông tin (details / fields / cover). @param {string} tab */
        function setSongEditTab(tab) {
            const panels = { details: songEditTabDetails, fields: songEditTabFields, cover: songEditTabCover };
            Object.keys(panels).forEach(name => {
                const isActive = name === tab;
                panels[name].classList.toggle('hidden', !isActive);
                panels[name].classList.toggle('flex', isActive && name === 'cover'); // chỉ tab cover cần flex (ảnh + nút cạnh nhau)
            });
            // Kiểu "đang chọn" do key theme `segmentTabActive` (variant `aria-selected:`) lo.
            songEditTabButtons.forEach(btn => {
                btn.setAttribute('aria-selected', String(btn.dataset.editTab === tab));
            });
            btnSongEditSave.classList.toggle('hidden', tab === 'details'); // tab "Chi tiết" chỉ đọc
        }

        // Các bước ghi DOM của modal Sửa thông tin — Workflow (workflowPlaylist.openSongEditModal()) đọc dữ liệu rồi gọi lần
        // lượt. Video/Photo ẩn tab Ảnh bìa; ô tên điền sẵn tên đang hiển thị; tab "Chi tiết" mở trước.

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

        /** Điền tab "Sửa" Photo — tên + album + nhãn thời lượng. */
        function fillPhotoEditFields(displayName, album, durationText) {
            songEditPhotoNameInput.value = displayName;
            songEditPhotoNameInput.placeholder = '';
            if (songEditPhotoAlbumInput) songEditPhotoAlbumInput.value = album;
            songEditPhotoDurationValueEl.textContent = durationText;
        }

        /** Nhãn thời lượng đang chờ lưu ở tab "Sửa" Photo (sau khi chọn trong time-picker). @param {string} text */
        function setPhotoEditDurationText(text) {
            if (songEditPhotoDurationValueEl) songEditPhotoDurationValueEl.textContent = text;
        }

        /** Giá trị mở time-picker thời lượng Photo (ms). @param {number} currentSec @param {number} minSec @returns {{valueMs: number, minMs: number}} */
        function computePhotoEditPickerMs(currentSec, minSec) {
            return { valueMs: (currentSec || 0) * 1000, minMs: minSec * 1000 };
        }

        /** Giây chọn từ time-picker, làm tròn 2 chữ số thập phân. @param {number} resultMs @returns {number} */
        function resolvePickedPhotoDurationSec(resultMs) {
            return Math.round(resultMs / 1000 * 100) / 100;
        }

        /** Điền tab "Sửa" Song từ tag hiện tại. */
        function fillSongEditFields(tag) {
            songEditTitleInput.value = tag.title || '';
            songEditArtistInput.value = tag.artist || '';
            songEditAlbumInput.value = tag.album || '';
        }

        /** Gán nội dung tab "Chi tiết" (HTML từ renderSongInfoRowHtml() — components/playlist-view.js, giá trị người dùng đã escape). */
        function setSongEditDetailsHtml(html) {
            songEditTabDetails.innerHTML = html;
        }

        function showSongEditModal() {
            songEditModal.classList.remove('hidden');
        }

        function closeSongEditModal() {
            songEditModal.classList.add('hidden');
        }

        /** Tag mới từ tab "Sửa" Song (ô trống -> tên/nghệ sĩ mặc định). @returns {{title: string, artist: string, album: string}} */
        function readSongEditTagInputs() {
            return {
                title: songEditTitleInput.value.trim() || t('common.songEdit.defaultTitle'),
                artist: songEditArtistInput.value.trim() || t('common.songEdit.defaultArtist'),
                album: songEditAlbumInput.value.trim(),
            };
        }

        /** Tên riêng + album từ tab "Sửa" Video. @returns {{customName: string, album: string}} */
        function readVideoEditInputs() {
            return {
                customName: songEditCustomNameInput.value.trim(),
                album: songEditVideoAlbumInput ? songEditVideoAlbumInput.value.trim() : '',
            };
        }

        /** Tên riêng + album từ tab "Sửa" Photo (thời lượng chờ lưu nằm ở playlistStore). @returns {{customName: string, album: string}} */
        function readPhotoEditInputs() {
            return {
                customName: songEditPhotoNameInput.value.trim(),
                album: songEditPhotoAlbumInput ? songEditPhotoAlbumInput.value.trim() : '',
            };
        }

        /**
         * Meta mới sau khi sửa tab "Sửa" của Video — Workflow truyền hàm này vào `updateMediaMeta()` (service/db.js, chỉ
         * ghi store meta).
         * @param {object} meta - meta hiện tại (không có Blob) @param {string} customName - rỗng = xoá tên riêng
         * @param {string} album - rỗng = xoá album @returns {object} meta mới
         */
        function buildVideoEditMeta(meta, customName, album) {
            return { ...meta, customName: customName || null, album: album || null };
        }

        /**
         * Meta mới sau khi sửa tab "Sửa" của Photo (tên riêng + thời lượng + album).
         * @param {object} meta @param {string} customName - rỗng = xoá tên riêng
         * @param {number} durationSec - giây (sàn DURATION_MIN_SEC đã áp ở picker, không kẹp trần)
         * @param {string} album - rỗng = xoá album @returns {object} meta mới
         */
        function buildPhotoEditMeta(meta, customName, durationSec, album) {
            return { ...meta, customName: customName || null, duration: durationSec, album: album || null };
        }

        /**
         * Meta mới sau khi sửa tag Song. Ảnh bìa không nằm trong meta (Workflow ghi store thumb qua `setMediaThumbs()`).
         * @param {object} meta @param {Object} newTag - {title, artist, album} @returns {object} meta mới
         */
        function buildSongEditMeta(meta, newTag) {
            return { ...meta, tag: { ...meta.tag, ...newTag } };
        }

        /** Ảnh bìa chờ lưu -> việc ghi store thumb: File mới -> 'file'; 'remove' -> 'remove'; còn lại -> 'keep'.
         * @param {File|'remove'|null} pendingCover @returns {'file'|'remove'|'keep'} */
        function resolvePendingCoverChange(pendingCover) {
            return (pendingCover instanceof File && 'file') || (pendingCover === 'remove' && 'remove') || 'keep';
        }

        /** Media Session của bài Song vừa sửa tag: tên/nghệ sĩ (thiếu -> nhãn mặc định), artwork chỉ khi có ảnh bìa.
         * @param {{title: string, artist: string}} tag @param {Blob|null} cover @param {string|null} coverUrl
         * @returns {{title: string, artist: string, artwork: Array<{src: string, sizes: string, type: string}>}} */
        function resolveSongMediaSessionInfo(tag, cover, coverUrl) {
            return {
                title: tag.title || 'Visual Master',
                artist: tag.artist || 'Unknown Artist',
                artwork: cover ? [{ src: coverUrl, sizes: '512x512', type: cover.type || 'image/jpeg' }] : [],
            };
        }
