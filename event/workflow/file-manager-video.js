/**
 * event/workflow/file-manager-video.js — MỚI (21/07/2026), File Manager -> Video. "THẰNG THỰC THI
 * CUỐI" cho panel Video. Mirror event/workflow/file-manager-photo.js — NHƯNG đơn giản hơn hẳn:
 * KHÔNG có Album (Giang chốt), lưới CSS Grid full-width thay fjGallery justified (xem
 * event/workflow/video-gallery-window.js), menu action video chỉ có Xoá (core/file-manager/
 * video-ui.js::openVideoPreviewModal(), 2 nút X/thùng rác, KHÔNG cần Generic Drawer nhiều lựa chọn
 * như Photo).
 *
 * Batch 1 (module Video độc lập) — CHƯA có picker Generic Drawer cho "Use background video" (Batch
 * 2, xem event/workflow/visualizer-control-center.js).
 *
 * NẠP SAU: core/file-manager/video.js, core/file-manager/video-ui.js, core/settings-panel-stack-
 * ui.js (pushSettingsPanel), event/workflow/video-gallery-window.js.
 */
let fileManagerVideoPanelEl = null; // panel Video đang mở — null nếu đang đóng (cùng khuôn fileManagerPhotoPanelEl)

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
     * dễ audit "mọi tương tác đều qua eventBus"). */
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
        const successCount = fileArray.length - failedCount;
        await alertModal(tFormat('fileManager.video.uploadSuccess', { count: successCount }));
    },

    /** Ứng với 'fileManagerVideo.video.click' khi videoQuickDeleteMode=false (xem router). */
    async openVideoPreview(videoKey) {
        const record = await getVideoRecord(videoKey); // data layer (service/db.js)
        if (!record) return; // guard: video vừa bị xoá ở tab/thao tác khác
        const video = { key: videoKey, ...record };

        const modalHandle = openVideoPreviewModal(video, { // core/file-manager/video-ui.js
            onDelete: () => this._confirmDeleteSingleVideo(video, modalHandle),
        });
    },

    /** Hỏi xác nhận trước khi xoá 1 video từ modal xem — KHÔNG dùng chung với batch xoá nhanh (số
     * lượng cố định = 1, i18n riêng "xoá video này?"). */
    _confirmDeleteSingleVideo(video, modalHandle) {
        modalChoice( // core/modal-choice.js
            t('fileManager.video.deleteConfirm.desc'),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t('fileManager.video.deleteConfirm.confirmBtn'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: async () => {
                    modalHandle.close();
                    await withLoadingShield(t('common.loading.savingInfo'), async () => {
                        await deleteVideo(video.key); // core/file-manager/video.js
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
     * @param {Set<string>} quickDeleteSelectedKeys
     * @param {() => void} onConfirmed
     */
    async confirmQuickDeleteBatch(quickDeleteSelectedKeys, onConfirmed) {
        const keys = Array.from(quickDeleteSelectedKeys);
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
};
