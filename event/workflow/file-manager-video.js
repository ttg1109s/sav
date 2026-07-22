/**
 * event/workflow/file-manager-video.js — MỚI (21/07/2026), File Manager -> Video. "THẰNG THỰC THI
 * CUỐI" cho panel Video. Mirror event/workflow/file-manager-photo.js — NHƯNG đơn giản hơn hẳn:
 * KHÔNG có Album (Giang chốt), lưới CSS Grid full-width thay fjGallery justified (xem
 * event/workflow/video-gallery-window.js).
 *
 * SỬA (21/07/2026, cùng ngày, Giang yêu cầu "bấm video KHÔNG phát trình chạy, chỉ hiện dropdown
 * menu") — bấm 1 tile (ngoài chế độ xoá nhanh) giờ mở dropdown (core/dropdown-menu.js, xem
 * `openVideoTileActionMenu()`) với 3 lựa chọn (Set as bg video/Edit video/Xoá) — THAY HẲN
 * `openVideoPreview()` (fullscreen player, `core/file-manager/video-ui.js::openVideoPreviewModal()`)
 * — file đó giờ KHÔNG còn ai gọi tới (nợ kỹ thuật đã biết, chưa xoá hẳn file, cùng tinh thần
 * "setAsSlideshowBackground() chưa có UI gọi tới" đã áp dụng cho Photo trước đây).
 *
 * NẠP SAU: core/file-manager/video.js, core/dropdown-menu.js, core/settings-panel-stack-
 * ui.js (pushSettingsPanel), event/workflow/video-gallery-window.js, event/workflow/video-player.js
 * (workflowVideoPlayer — enablePlayerModeFromPanel()/disablePlayerModeFromPanel() gọi trực tiếp,
 * Workflow gọi Workflow).
 */
let fileManagerVideoPanelEl = null; // panel Video đang mở — null nếu đang đóng (cùng khuôn fileManagerPhotoPanelEl)
let _videoPickerSession = null; // MỚI (Batch 2) — session picker Generic Drawer (chọn 1 video làm nền), cùng khuôn _imagePickerSession (file-manager-photo.js)

// Hệ số resize khung hình chụp làm thumbnail — CÙNG GIÁ TRỊ THUMBNAIL_SCALE_RATIO (file-manager-
// photo.js) để nhất quán độ nặng dữ liệu giữa 2 module Ảnh/Video, viết riêng biến (Rule 3: mỗi
// domain module tự chứa, không tham chiếu chéo file khác qua biến module-level).
const VIDEO_THUMBNAIL_SCALE_RATIO = 0.2;

const workflowFileManagerVideo = {

    /** Ứng với 'fileManagerVideo.openPanel.click'. `fullBleed: true` — lưới video tràn viền, cùng
     * khuôn panel Photo. Trình tự: trượt xong HẲN -> bật shield -> tải DOM lưới -> tắt shield (cùng
     * lý do đã áp dụng cho Photo — đo DOM lúc panel còn đang trượt vào cho kết quả sai). */
    async openPanel() {
        fileManagerVideoPanelEl = pushSettingsPanel({
            title: t('fileManager.video.title'),
            bodyHtml: renderFileManagerVideoPanelBody(),
            fullBleed: true,
            headerActionHtml: this._buildHeaderActionHtml(),
        });
        this._wireHeaderActionEvents();

        await new Promise((resolve) => taskManager.once(resolve, SLIDER_PANEL_SCROLL_ESTIMATED_MS, 'fileManagerVideoOpenPanel')); // core/slider-panel-scroll.js

        await withLoadingShield(t('fileManager.video.loadingTitle'), async () => { // core/loading-shield-util.js
            await this.refresh();
        });
    },

    _buildHeaderActionHtml() {
        return `
            <button id="btn-file-manager-video-upload-trigger" class="w-8 h-8 flex items-center justify-center rounded-full bg-sky-500 hover:bg-sky-400 transition-colors text-white shrink-0" title="${t('fileManager.video.uploadTitle')}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
            </button>
            <button id="btn-file-manager-video-delete-mode" class="hidden w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0" title="${t('fileManager.video.quickDeleteTitle')}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
            <input type="file" id="file-manager-video-upload-input" accept="video/*" multiple class="hidden">
        `;
    },

    /** Wire 2 nút vừa dựng trong header — panel push CHỈ 1 LẦN/lần mở, wire Ở ĐÂY (không phải
     * `refresh()`, tránh gắn listener trùng nhiều lần lên CÙNG 1 nút tĩnh). Nút "+" dispatch qua
     * eventBus (KHÔNG gọi thẳng `.click()` input — Router quyết định, cùng khuôn Photo dù ở Video
     * không có branching nào để quyết định — vẫn giữ round-trip qua Router cho nhất quán kiến trúc,
     * dễ audit "mọi tương tác đều qua eventBus").
     * SỬA (21/07/2026, Giang yêu cầu "nút apply Video Player chuyển qua toggle ở Video UI") — thêm
     * wire checkbox `#setting-video-player-mode-enable` (nằm trong BODY, không phải header, nhưng
     * wire CHUNG ở đây cho đơn giản — panel push CHỈ 1 LẦN/lần mở).
     * SỬA LẦN 2 (21/07/2026, Giang chỉ ra: "Block (event/block.js) có sẵn tính năng notify, sao
     * phải tự viết alertModal?") — TÁCH message thành 2 loại RIÊNG `playerModeToggle.enable.click`/
     * `.disable.click` (THAY 1 message `.change` + payload `checked`) — Block gate CHỈ đọc được
     * appState (KHÔNG đọc được payload, xem docstring event/block.js/event/bus.js::evalCondition())
     * nên PHẢI có msg.type RIÊNG cho chiều "bật" mới đăng ký block được — CÙNG tiền lệ đã có sẵn
     * trong project (`fileManagerSong.folder.applyToPlaylist.click` KHÁC hẳn
     * `folder.unapplyFromPlaylist.click`, xem event/block.js). Checkbox giờ là "controlled toggle"
     * — LUÔN trả `.checked` về ĐÚNG giá trị THẬT (`appState.get('isVideoPlayerMode')`) NGAY trong
     * listener TRƯỚC KHI dispatch (không đợi biết bị chặn hay không) — nếu Block gate chặn thật,
     * checkbox đã về đúng trạng thái từ trước, KHÔNG nhấp nháy sai; nếu KHÔNG bị chặn và bật thành
     * công, `enablePlayerModeFromPanel()` tự set lại `.checked=true` SAU. */
    _wireHeaderActionEvents() {
        const uploadBtn = fileManagerVideoPanelEl.querySelector('#btn-file-manager-video-upload-trigger');
        if (uploadBtn) uploadBtn.addEventListener('click', () => {
            eventBus.send({ router: 'fileManagerVideo', type: 'fileManagerVideo.uploadTrigger.click', payload: {} });
        });
        // (change của uploadInput wire ở event/listener/file-manager-video.js — delegated qua settingsStackBody)
        const deleteModeBtn = fileManagerVideoPanelEl.querySelector('#btn-file-manager-video-delete-mode');
        if (deleteModeBtn) deleteModeBtn.addEventListener('click', () => {
            eventBus.send({ router: 'fileManagerVideo', type: 'fileManagerVideo.deleteMode.click', payload: {} });
        });

        const playerModeCheckbox = fileManagerVideoPanelEl.querySelector('#setting-video-player-mode-enable');
        if (playerModeCheckbox) {
            playerModeCheckbox.checked = appState.get('isVideoPlayerMode');
            playerModeCheckbox.addEventListener('change', (e) => {
                const intendedChecked = e.target.checked;
                e.target.checked = appState.get('isVideoPlayerMode'); // "controlled toggle" — xem docstring hàm
                eventBus.send({ router: 'fileManagerVideo', type: intendedChecked ? 'fileManagerVideo.playerModeToggle.enable.click' : 'fileManagerVideo.playerModeToggle.disable.click', payload: {} });
            });
        }
    },

    /** Ứng với 'fileManagerVideo.playerModeToggle.enable.click'. Block gate (event/block.js) ĐÃ tự
     * chặn + báo lý do NẾU Video nền trang trí đang bật (`vizConfig.videoBgEnabled`) TRƯỚC KHI
     * message này tới được đây — hàm NÀY không cần tự kiểm tra lại điều kiện đó nữa (SỬA 21/07/2026,
     * bỏ hẳn `if (...) { alertModal(...); return; }` cũ, xem lịch sử patch). */
    async enablePlayerModeFromPanel() {
        await workflowVideoPlayer.enterVideoPlayerMode(); // event/workflow/video-player.js — Workflow gọi Workflow, tự do theo event-bus-flow.md mục 4B
        if (fileManagerVideoPanelEl) {
            const checkboxEl = fileManagerVideoPanelEl.querySelector('#setting-video-player-mode-enable');
            if (checkboxEl) checkboxEl.checked = appState.get('isVideoPlayerMode'); // phản ánh ĐÚNG kết quả thật (có thể vẫn false nếu vd danh sách rỗng)
        }
    },

    /** Ứng với 'fileManagerVideo.playerModeToggle.disable.click' — luôn cho phép, không có gì cần khoá khi TẮT. */
    async disablePlayerModeFromPanel() {
        await workflowVideoPlayer.exitVideoPlayerMode();
        if (fileManagerVideoPanelEl) {
            const checkboxEl = fileManagerVideoPanelEl.querySelector('#setting-video-player-mode-enable');
            if (checkboxEl) checkboxEl.checked = false;
        }
    },

    /** Ứng với 'fileManagerVideo.uploadTrigger.click' (Router gọi thẳng, không cần VirtualMachineState
     * — chỉ 1 đích duy nhất, khác Photo vốn cần rẽ nhánh theo đang lọc album hay không). */
    triggerUploadInput() {
        if (!fileManagerVideoPanelEl) return;
        const uploadInput = fileManagerVideoPanelEl.querySelector('#file-manager-video-upload-input');
        if (uploadInput) uploadInput.click();
    },

    /** Đọc lại toàn bộ video, vẽ lại lưới + nút xoá nhanh. Dùng lại ở MỌI nơi cần vẽ lại lưới (mở
     * panel, upload xong, xoá xong, bật/tắt/xác nhận xoá nhanh) — cùng khuôn `refresh()` Photo.
     * @param {boolean} [videoQuickDeleteMode]
     * @param {Set<string>} [quickDeleteSelectedKeys]
     */
    async refresh(videoQuickDeleteMode = false, quickDeleteSelectedKeys = new Set()) {
        if (!fileManagerVideoPanelEl) return; // guard: panel đã đóng
        const videos = await listVideos(); // core/file-manager/video.js

        const emptyEl = fileManagerVideoPanelEl.querySelector('#file-manager-video-empty');
        if (emptyEl) emptyEl.classList.toggle('hidden', videos.length > 0);

        const deleteModeBtn = fileManagerVideoPanelEl.querySelector('#btn-file-manager-video-delete-mode');
        if (deleteModeBtn) deleteModeBtn.classList.toggle('hidden', videos.length === 0);
        this._updateQuickDeleteButtonTitle(quickDeleteSelectedKeys, videoQuickDeleteMode);

        const scrollEl = fileManagerVideoPanelEl.querySelector('#file-manager-video-scroll');
        workflowVideoGalleryWindow.mount('videoGrid', { // event/workflow/video-gallery-window.js
            scrollEl,
            videos,
            badgeMode: videoQuickDeleteMode ? 'quickDelete' : null,
            selectedKeys: quickDeleteSelectedKeys,
        });
    },

    /** Chụp 1 khung hình + đọc thời lượng của 1 file video, resize khung hình theo
     * `VIDEO_THUMBNAIL_SCALE_RATIO` — CÙNG lý do đặt ở Workflow (không phải core/file-manager/
     * video.js) như `_resizeImageForThumbnail()` (file-manager-photo.js): cần `<video>`/`canvas` —
     * DOM API, core không được đụng theo Rule 1-4.
     * Chụp khung hình tại giây `min(1, duration/2)` — tránh giây đầu tiên hay bị đen/mờ (video vừa
     * mở), cũng tránh vọt quá xa nếu video ngắn hơn 1 giây.
     * @param {File} file
     * @returns {Promise<{thumbBlob: Blob, width: number, height: number, duration: number}>}
     */
    _extractVideoThumbAndMeta(file) {
        return new Promise((resolve, reject) => {
            const objectUrl = URL.createObjectURL(file);
            const videoEl = document.createElement('video');
            videoEl.preload = 'metadata';
            videoEl.muted = true; // tránh xin quyền âm thanh không cần thiết lúc chỉ đọc metadata/chụp khung hình
            videoEl.playsInline = true;

            function cleanupAndReject(err) {
                URL.revokeObjectURL(objectUrl);
                reject(err);
            }

            videoEl.addEventListener('loadedmetadata', () => {
                const duration = videoEl.duration;
                const width = videoEl.videoWidth;
                const height = videoEl.videoHeight;
                if (!width || !height) { cleanupAndReject(new Error('[_extractVideoThumbAndMeta] video không có kích thước hợp lệ')); return; }
                videoEl.currentTime = Math.min(1, (duration || 0) / 2);
            }, { once: true });

            videoEl.addEventListener('seeked', () => {
                const width = videoEl.videoWidth;
                const height = videoEl.videoHeight;
                const targetWidth = Math.max(1, Math.round(width * VIDEO_THUMBNAIL_SCALE_RATIO));
                const targetHeight = Math.max(1, Math.round(height * VIDEO_THUMBNAIL_SCALE_RATIO));
                const canvas = document.createElement('canvas');
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(videoEl, 0, 0, targetWidth, targetHeight);
                URL.revokeObjectURL(objectUrl);
                canvas.toBlob((thumbBlob) => {
                    if (!thumbBlob) { reject(new Error('[_extractVideoThumbAndMeta] canvas.toBlob trả về null')); return; }
                    resolve({ thumbBlob, width, height, duration: videoEl.duration || 0 });
                }, 'image/jpeg', 0.82);
            }, { once: true });

            videoEl.addEventListener('error', () => cleanupAndReject(new Error('[_extractVideoThumbAndMeta] không đọc được video')), { once: true });
            videoEl.src = objectUrl;
        });
    },

    /** Ứng với 'fileManagerVideo.upload.change'. Lỗi 1 file (vd file hỏng) KHÔNG chặn cả lô upload
     * — bắt riêng, bỏ qua đúng file đó, tiếp tục file sau (Rule 1: vẫn 1 tiến trình "upload cả lô").
     * @param {FileList} files
     */
    async uploadVideos(files) {
        const fileArray = Array.from(files);
        if (fileArray.length === 0) return;

        let failedCount = 0;
        await withLoadingShield(t('common.loading.savingInfo'), async () => {
            for (const file of fileArray) {
                try {
                    const { thumbBlob, width, height, duration } = await this._extractVideoThumbAndMeta(file);
                    await saveVideo(file, file.name, thumbBlob, width, height, duration); // core/file-manager/video.js
                } catch (err) {
                    console.error(`[uploadVideos] chụp thumbnail/lưu thất bại cho file "${file.name}":`, err);
                    failedCount++;
                }
            }
        });
        if (fileManagerVideoPanelEl) {
            const uploadInput = fileManagerVideoPanelEl.querySelector('#file-manager-video-upload-input');
            if (uploadInput) uploadInput.value = ''; // cho phép chọn lại đúng file cũ ở lần sau
        }
        await this.refresh();
        // MỚI (21/07/2026, Giang chỉ ra "không cập nhật lại list của video") — nếu Video Player
        // mode ĐANG CHẠY (vẫn tới được panel này lúc video đang phát nền, xem event/workflow/
        // video-player.js::handleBackToPlaylistFromVideoMode()), làm mới `videoPlaylist` NGAY để
        // Next/Prev thấy được video vừa upload — KHÔNG cần tắt/bật lại mode.
        await workflowVideoPlayer.refreshVideoPlaylistIfActive(); // event/workflow/video-player.js — tự guard isVideoPlayerMode, no-op nếu không ở mode này
        const successCount = fileArray.length - failedCount;
        await alertModal(tFormat('fileManager.video.uploadSuccess', { count: successCount }));
    },

    /** Ứng với 'fileManagerVideo.video.click' khi videoQuickDeleteMode=false (xem router).
     * SỬA (21/07/2026, Giang yêu cầu "bấm vào video KHÔNG phát trình chạy, chỉ hiện dropdown menu")
     * — THAY HẲN `openVideoPreview()` (fullscreen player) cũ — giờ mở dropdown (core/dropdown-
     * menu.js) NGAY tại tile, 3 lựa chọn: Set as bg video / Edit video (placeholder) / Xoá.
     * @param {string} videoKey
     * @param {HTMLElement} anchorEl - tile vừa bấm, dùng để định vị dropdown.
     */
    openVideoTileActionMenu(videoKey, anchorEl) {
        const dispatch = (action) => eventBus.send({ router: 'fileManagerVideo', type: 'fileManagerVideo.tileMenu.action.click', payload: { action, videoKey } });
        openDropdownMenu(anchorEl, [ // core/dropdown-menu.js
            {
                icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"/></svg>',
                name: t('fileManager.video.btnSetAsBgVideo'),
                callback: () => dispatch('setAsBgVideo'),
            },
            {
                icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 3v3m0 0v12a1 1 0 001 1h12M6 6h12a1 1 0 011 1v12m0 0h-3m3 0v-3"/></svg>',
                name: t('fileManager.video.editVideo.label'),
                callback: () => dispatch('editVideo'),
            },
            {
                icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>',
                name: t('fileManager.video.btnDelete'),
                callback: () => dispatch('delete'),
                destructive: true,
            },
        ]);
    },

    /** Ứng với 'fileManagerVideo.tileMenu.action.click' action='setAsBgVideo' — set THẲNG 1 video
     * cụ thể làm "Use background video", KHÔNG qua picker Generic Drawer (Batch 2) — tắt hẳn 1 bước
     * (đã đang xem đúng video này rồi, không cần chọn lại). Cùng KHOÁ CHÉO với Video Player mode
     * (event/workflow/visualizer-control-center.js::enableVideoBackgroundToggle() — lý do đối
     * xứng: 2 tính năng dùng chung `bgVideoElement`, không được cùng bật).
     * SAO KHÔNG DÙNG Block gate (event/block.js) Ở ĐÂY (khác 2 chỗ enable.click kia) — msg.type
     * 'fileManagerVideo.tileMenu.action.click' DÙNG CHUNG cho CẢ 3 action (setAsBgVideo/editVideo/
     * delete) qua `payload.action` — đăng ký block trên msg.type này sẽ CHẶN NHẦM cả editVideo/
     * delete (2 action đó KHÔNG liên quan gì Video Player mode) — ĐÚNG tình huống event/block.js đã
     * tự ghi chú ("KHÔNG đăng ký block ở đây vì sẽ chặn nhầm cả hành động còn lại", xem entry
     * 'playlist.actionMenu.addToFolder'/'playlist.selection.moreMenu.select'). Giữ nguyên kiểm tra
     * thủ công trong hàm — ĐÚNG phạm vi Block gate không cover được, không phải bỏ sót.
     * @param {string} videoKey
     */
    async setVideoAsBackground(videoKey) {
        if (appState.get('isVideoPlayerMode')) {
            await alertModal(t('fileManager.video.setAsBgVideo.blockedByPlayerMode'));
            return;
        }
        const record = await getVideoRecord(videoKey); // service/db.js
        if (!record) return; // guard: video vừa bị xoá ở nơi khác
        await withLoadingShield(t('common.loading.savingVideoBg'), async () => {
            await setMeta('videoBg', record.blob); // service/db.js
            applyUploadedVideoBg(record.blob); // core/state-and-video-bg.js, di sản — tự set videoBgEnabled=true + đồng bộ UI + saveConfig()
        });
        if (typeof workflowSlideshow !== 'undefined') workflowSlideshow.syncPlaybackGate();
        await alertModal(t('fileManager.video.setAsBgVideo.success'));
    },

    /** Ứng với 'fileManagerVideo.tileMenu.action.click' action='editVideo' — MỚI (Batch 1, module
     * Video Editor), THAY placeholder cũ (`showEditVideoPlaceholder()`, chỉ alert "coming soon").
     * Điều hướng sang trang `video-editor.html`, CÙNG KHUÔN `workflowFileManagerPhoto.
     * navigateToImageEdit()` (`window.location.href` toàn trang, KHÔNG iframe/popup — 2 trang cùng
     * origin `file://`, dùng chung IndexedDB). TÁI DÙNG NGUYÊN `encodeSongKeyForUrl()`
     * (service/song-key-cipher.js) — hàm đó chỉ mã hoá 1 chuỗi key bất kỳ, không có gì đặc thù
     * "video".
     * @param {string} videoKey
     */
    navigateToVideoEdit(videoKey) {
        window.location.href = `video-editor.html?video=${encodeSongKeyForUrl(videoKey)}`; // service/song-key-cipher.js
    },

    /** Ứng với 'fileManagerVideo.tileMenu.action.click' action='delete' — hỏi xác nhận trước khi
     * xoá 1 video. SỬA (21/07/2026, Giang yêu cầu) — GUARD MỚI: video ĐANG PHÁT trong Video Player
     * mode (`currentVideoKey` trùng) -> CHẶN HẲN, báo lý do + yêu cầu chuyển video khác/tắt Player
     * mode trước — KHÔNG cho xoá (xoá Blob đang được `bgVideoElement`/`audioPlayer` tham chiếu sẽ
     * làm hỏng phát ngay lập tức).
     * SAO KHÔNG DÙNG Block gate — 2 lý do: (1) msg.type dùng chung cho 3 action, xem docstring
     * `setVideoAsBackground()` ngay trên; (2) điều kiện chặn cần SO SÁNH `currentVideoKey` (appState)
     * với `videoKey` (PAYLOAD của message) — Block gate chỉ so 1 field appState với 1 giá trị CỐ
     * ĐỊNH khai báo sẵn (`value`), KHÔNG so được appState với payload động — nằm ngoài khả năng biểu
     * đạt của Block gate, PHẢI giữ code thủ công.
     * @param {string} videoKey
     */
    async confirmDeleteSingleVideo(videoKey) {
        if (appState.get('isVideoPlayerMode') && appState.get('currentVideoKey') === videoKey) {
            await alertModal(t('fileManager.video.deleteConfirm.blockedByPlaying'));
            return;
        }
        modalChoice( // core/modal-choice.js
            t('fileManager.video.deleteConfirm.desc'),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t('fileManager.video.deleteConfirm.confirmBtn'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: async () => {
                    await withLoadingShield(t('common.loading.savingInfo'), async () => {
                        await deleteVideo(videoKey); // core/file-manager/video.js
                    });
                    await this.refresh();
                } },
            ],
            { title: t('fileManager.video.deleteConfirm.title') }
        );
    },

    /** Hỏi xác nhận TRƯỚC KHI bật chế độ xoá nhanh — cùng khuôn `promptQuickDeleteMode()` Photo. */
    promptQuickDeleteMode(onConfirm) {
        modalChoice( // core/modal-choice.js
            t('fileManager.video.quickDeleteConfirm.desc'),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t('fileManager.video.quickDeleteConfirm.confirmBtn'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: onConfirm },
            ],
            { title: t('fileManager.video.quickDeleteConfirm.title') }
        );
    },

    /** Bấm 1 video khi đang bật xoá nhanh — CHỈ toggle vào/ra Set, patch DOM TRỰC TIẾP đúng 1 tile,
     * KHÔNG `refresh()`/KHÔNG đọc/ghi DB — cùng khuôn `toggleQuickDeleteMarkInSet()` Photo.
     * @param {string} videoKey
     * @param {Set<string>} quickDeleteSelectedKeys
     */
    toggleQuickDeleteMarkInSet(videoKey, quickDeleteSelectedKeys) {
        const isNowMarked = !quickDeleteSelectedKeys.has(videoKey);
        if (isNowMarked) quickDeleteSelectedKeys.add(videoKey);
        else quickDeleteSelectedKeys.delete(videoKey);
        workflowVideoGalleryWindow.setTileBadge('videoGrid', videoKey, isNowMarked); // event/workflow/video-gallery-window.js
        this._updateQuickDeleteButtonTitle(quickDeleteSelectedKeys);
    },

    /** Bật/tắt chế độ xoá nhanh — CHỈ đổi màu/tiêu đề nút + badge trên tile đang hiển thị, KHÔNG đọc
     * lại DB/dựng lại lưới (dữ liệu video không đổi lúc này) — cùng khuôn `updateQuickDeleteModeUI()` Photo.
     * @param {boolean} videoQuickDeleteMode
     * @param {Set<string>} quickDeleteSelectedKeys
     */
    updateQuickDeleteModeUI(videoQuickDeleteMode, quickDeleteSelectedKeys) {
        if (!fileManagerVideoPanelEl) return;
        const deleteModeBtn = fileManagerVideoPanelEl.querySelector('#btn-file-manager-video-delete-mode');
        if (deleteModeBtn) {
            deleteModeBtn.classList.toggle('bg-rose-500', videoQuickDeleteMode);
            deleteModeBtn.classList.toggle('bg-white/10', !videoQuickDeleteMode);
        }
        this._updateQuickDeleteButtonTitle(quickDeleteSelectedKeys, videoQuickDeleteMode);
        workflowVideoGalleryWindow.setBadgeMode('videoGrid', videoQuickDeleteMode ? 'quickDelete' : null, quickDeleteSelectedKeys); // event/workflow/video-gallery-window.js
    },

    /** Patch chuỗi text title nút xoá nhanh — DÙNG CHUNG, tránh lặp logic 2 nơi.
     * @param {Set<string>} quickDeleteSelectedKeys
     * @param {boolean} [videoQuickDeleteMode] - mặc định true (gọi từ toggleQuickDeleteMarkInSet chỉ khi ĐANG bật mode).
     */
    _updateQuickDeleteButtonTitle(quickDeleteSelectedKeys, videoQuickDeleteMode = true) {
        if (!fileManagerVideoPanelEl) return;
        const deleteModeBtn = fileManagerVideoPanelEl.querySelector('#btn-file-manager-video-delete-mode');
        if (!deleteModeBtn) return;
        const baseTitle = t('fileManager.video.quickDeleteTitle');
        deleteModeBtn.title = (videoQuickDeleteMode && quickDeleteSelectedKeys.size > 0) ? `${baseTitle} (${quickDeleteSelectedKeys.size})` : baseTitle;
    },

    /** Xoá TOÀN BỘ video đã đánh dấu 1 LẦN (gộp N lần xoá thành đúng 1 round-trip + 1 `refresh()`
     * duy nhất) — cùng khuôn `confirmQuickDeleteBatch()` Photo.
     * SỬA (21/07/2026, Giang yêu cầu, mở rộng thêm guard cho batch — cùng lý do
     * `confirmDeleteSingleVideo()`) — video ĐANG PHÁT trong Video Player mode nằm TRONG lô đánh dấu
     * -> CHẶN HẲN cả lô (không xoá phần còn lại thay thế — đơn giản/an toàn hơn xoá 1 phần rồi báo
     * riêng), báo lý do, KHÔNG tự bỏ video đó ra rồi xoá phần còn lại.
     * @param {Set<string>} quickDeleteSelectedKeys
     * @param {() => void} onConfirmed
     */
    async confirmQuickDeleteBatch(quickDeleteSelectedKeys, onConfirmed) {
        const keys = Array.from(quickDeleteSelectedKeys);
        if (appState.get('isVideoPlayerMode') && keys.includes(appState.get('currentVideoKey'))) {
            await alertModal(t('fileManager.video.deleteConfirm.blockedByPlaying'));
            return;
        }
        modalChoice( // core/modal-choice.js
            tFormat('fileManager.video.quickDeleteBatchConfirm.confirm', { count: keys.length }),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t('fileManager.video.quickDeleteBatchConfirm.confirmBtn'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: async () => {
                    await withLoadingShield(t('common.loading.savingInfo'), async () => {
                        for (const key of keys) await deleteVideo(key); // core/file-manager/video.js
                    });
                    quickDeleteSelectedKeys.clear();
                    onConfirmed(); // Router tự đồng bộ videoQuickDeleteMode=false — ĐÚNG lúc này, không sớm hơn
                    await this.refresh(false, quickDeleteSelectedKeys);
                } },
            ],
            { title: t('fileManager.video.quickDeleteBatchConfirm.title') }
        );
    },

    // ===================== Batch 2 (21/07/2026) — Picker Generic Drawer cho "Use background
    // video" (event/workflow/visualizer-control-center.js::enableVideoBackgroundToggle()). Mirror
    // ĐÚNG `openCoverImagePicker()`/`_openImagePickerDrawer()` (file-manager-photo.js) — nhưng đơn
    // giản hơn hẳn: Video CHỈ có 1 chế độ picker DUY NHẤT (single-select, tap = chọn ngay) — Giang
    // chốt KHÔNG có "Upload mới ngay trong drawer" (khác Photo, đôi khi có confirmButton cho
    // multi-select album) — nên KHÔNG cần field `mode`/`showConfirmButton` nào trong session, đơn
    // giản hoá tối đa so với bản Photo. =====================================================

    /** Mở Generic Drawer chọn 1 video CÓ SẴN trong thư viện Video — DÙNG CHUNG cho MỌI nơi cần
     * "chọn 1 video làm nền" (hiện tại chỉ có Settings -> "Use background video", nhưng viết tổng
     * quát qua tham số `onSelect`/`onCancel`, không hardcode nghiệp vụ video nền ở ĐÂY — cùng triết
     * lý `openCoverImagePicker()` Photo).
     * @param {(videoKey: string) => void} onSelect
     * @param {() => void} [onCancel] - gọi khi đóng picker MÀ CHƯA chọn gì (nút X).
     */
    async openVideoBgPicker(onSelect, onCancel) {
        _videoPickerSession = { onSelect, onCancel, hasSelected: false };

        openGenericDrawer({ // core/generic-drawer.js
            height: '90vh',
            zIndex: Z_INDEX.GENERIC_DRAWER, // core/config.js — mặc định, không có modal nào khác mở đồng thời picker này
            headerHtml: this._buildVideoPickerHeaderHtml(t('fileManager.video.pickerTitle')),
            bodyHtml: this._buildVideoPickerBodyHtml(),
            bodyClass: 'flex flex-col',
        });

        const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
        if (closeBtn) closeBtn.addEventListener('click', () => {
            eventBus.send({ router: 'fileManagerVideo', type: 'fileManagerVideo.videoPicker.close.click', payload: {} });
        });

        // Click tile — delegated NGAY TRÊN genericDrawerBody (Generic Drawer là ANH EM của
        // #app-stack, KHÔNG nằm trong settingsStackBody — PHẢI tự wire riêng ở đây, cùng khuôn
        // `_openImagePickerDrawer()` Photo).
        genericDrawerBody.addEventListener('click', (e) => {
            const tile = e.target.closest('[data-video-key]');
            if (!tile) return;
            eventBus.send({ router: 'fileManagerVideo', type: 'fileManagerVideo.videoPicker.tile.click', payload: { videoKey: tile.dataset.videoKey } });
        });

        await new Promise((resolve) => {
            genericDrawerPanel.addEventListener('transitionend', function onOpenTransitionEnd() {
                genericDrawerPanel.removeEventListener('transitionend', onOpenTransitionEnd);
                resolve();
            }, { once: true });
        });

        const videos = await listVideos(); // core/file-manager/video.js
        if (!_videoPickerSession) return; // guard — user đóng picker RẤT NHANH trong lúc đang đọc DB

        const scrollEl = genericDrawerBody.querySelector('#file-manager-video-picker-scroll');
        const emptyEl = genericDrawerBody.querySelector('#file-manager-video-picker-empty');
        if (emptyEl) emptyEl.classList.toggle('hidden', videos.length > 0);
        workflowVideoGalleryWindow.mount('genericDrawer', { scrollEl, videos, badgeMode: null, selectedKeys: new Set() }); // event/workflow/video-gallery-window.js — single-select, KHÔNG badge, tap = chọn ngay
    },

    _buildVideoPickerHeaderHtml(title) {
        return `
            <div class="flex justify-between items-center px-5 pb-3 border-b border-slate-200">
                <h3 class="text-base font-bold text-slate-900">${title}</h3>
                <button id="btn-generic-drawer-close" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500" title="${t('common.close')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        `;
    },

    _buildVideoPickerBodyHtml() {
        return `
            <div class="flex-1 min-h-0 overflow-y-auto relative" id="file-manager-video-picker-scroll">
                <p id="file-manager-video-picker-empty" class="hidden text-sm text-slate-400 text-center py-10 px-6">${t('fileManager.video.empty')}</p>
            </div>
        `;
    },

    /** Ứng với 'fileManagerVideo.videoPicker.tile.click' — LUÔN single-select (khác Photo không cần
     * branch theo `mode`) — bấm là chọn NGAY, đóng drawer luôn.
     * @param {string} videoKey
     */
    handleVideoPickerTileClick(videoKey) {
        if (!_videoPickerSession) return; // guard: picker đã đóng (race hiếm, vd đóng đúng lúc tap)
        _videoPickerSession.hasSelected = true;
        const onSelect = _videoPickerSession.onSelect;
        this._teardownVideoPicker();
        onSelect(videoKey);
    },

    /** Ứng với 'fileManagerVideo.videoPicker.close.click' — đóng picker qua nút X (huỷ, chưa chọn
     * gì) — `onCancel` CHỈ gọi khi CHƯA `hasSelected` (tránh gọi 2 lần nếu race hiếm). */
    handleVideoPickerCloseClick() {
        if (!_videoPickerSession) return;
        const { onCancel, hasSelected } = _videoPickerSession;
        this._teardownVideoPicker();
        if (!hasSelected && typeof onCancel === 'function') onCancel();
    },

    /** Dọn session + unmount windowing (revoke object URL NGAY) + đóng drawer — DÙNG CHUNG cho MỌI
     * lối thoát picker (chọn xong/huỷ). */
    _teardownVideoPicker() {
        workflowVideoGalleryWindow.unmount('genericDrawer'); // event/workflow/video-gallery-window.js
        this._closeGenericDrawerFully();
        _videoPickerSession = null;
    },

    /** Trượt Generic Drawer xuống RỒI ẩn hẳn sau `transitionend` — cùng khuôn `_closeGenericDrawerFully()`
     * ở event/workflow/file-manager-photo.js (Core `core/generic-drawer.js` KHÔNG được tự
     * `addEventListener` cho DOM tĩnh, Rule 5a — chỉ Workflow được làm). Viết riêng bản của Video
     * (Rule 3: mỗi domain module tự chứa, không gọi chéo Workflow khác cho tiện ích nhỏ này). */
    _closeGenericDrawerFully() {
        closeGenericDrawer(); // core/generic-drawer.js
        genericDrawerPanel.addEventListener('transitionend', function onTransitionEnd() {
            genericDrawerPanel.removeEventListener('transitionend', onTransitionEnd);
            hideGenericDrawerImmediately(); // core/generic-drawer.js
        }, { once: true });
    },
};
