/**
 * event/workflow/playlist.js — "THẰNG THỰC THI CUỐI" của router "playlist".
 *
 * QUY TẮC (giống workflow/storage.js):
 *   - Workflow KHÔNG tự nghĩ ra logic nghiệp vụ mới — toàn bộ logic xử lý dữ liệu đã tồn tại SẴN
 *     dưới dạng hàm core thuần ở playlist/actions.js. Workflow chỉ là 1 CHUỖI GỌI các hàm đó
 *     ("chân tay") — đưa đúng data hàm nào cần, hàm nào không cần thì không đưa.
 *   - withLoadingShield() và alertModal()/modalChoice() ĐẶT Ở TẦNG NÀY — core hoàn toàn không
 *     biết 2 thứ này tồn tại.
 *   - QUY TẮC SHIELD/MODAL: alertModal() KHÔNG bao giờ gọi BÊN TRONG callback của
 *     withLoadingShield() — luôn gọi SAU KHI shield đã đóng hẳn.
 *
 * Ban đầu (ver 11) chỉ 2 msg.type của router "playlist" cần phối hợp >1 hàm core (hoặc cần
 * shield) -> giao cho workflow xử lý ở đây: 'playlist.playbackError.delete' và 'playlist.edit.save'.
 * Ver 12 "Multi Media" (plan-v12-multimedia.md mục 4.b1) thêm 4 method cho "Chọn nhiều" (Phát đã
 * chọn/Xuất ZIP/Thêm vào thư mục/Xoá hàng loạt) — xem khối riêng cuối file. Mọi msg.type còn lại
 * router tự gọi thẳng 1 hàm core, KHÔNG đi qua workflow (xem router/playlist.js).
 */
/** DỜI từ event/workflow/file-manager-video.js (file đó đã xoá) — cạnh thumbnail vuông cố định
 * cho video upload, dùng bởi `uploadVideos()`/`_extractVideoThumbAndMeta()` bên dưới. */
const VIDEO_THUMBNAIL_SIZE = 320;

/** MỚI (Giang yêu cầu — Photo tích hợp duration như Song/Video) — trần của time-picker mở ở
 * `openPhotoEditDurationPicker()` (dưới). SỬA (Giang chỉ ra đúng — modal `openTimePickerModal()`,
 * core/time-picker-modal.js, KHÔNG hề tự áp giới hạn gì — `maxMs` chỉ là 1 tham số config, nơi gọi
 * (TỨC file này) tự chọn giá trị) — hằng số dưới KHÔNG phải "trần của widget", mà là lựa chọn CỦA
 * RIÊNG chỗ gọi này. Ràng buộc THẬT DUY NHẤT nằm ở `buildColumn()` (core/time-picker-modal.js):
 * `count` dòng của cột thô nhất PHẢI hữu hạn (vòng lặp `appendChild()` DOM thật, không ảo hoá) —
 * truyền `Infinity` sẽ treo trình duyệt (tạo vô hạn phần tử).
 * SỬA (Giang yêu cầu — format đổi 'm-s' -> 'h-m-s') — cột thô nhất giờ là 'h' (giờ), TRẦN TỰ NHIÊN
 * (`TIME_PICKER_UNIT_CAP.h`, core/time-picker-modal.js) đã là 24 — `count = Math.max(naturalCap,
 * countFromMaxMs)` nên bất kỳ `maxMs` nào ≤ 24 giờ đều cho ĐÚNG 24 dòng giờ (0-23), trần tự nhiên
 * tự thắng, không cần chọn số to hơn nữa. Đặt thẳng 24 giờ cho rõ ý, RỘNG HƠN RẤT NHIỀU bất kỳ giá
 * trị nào computePhotoDuration() (event/workflow/file-manager-photo.js) thực tế tạo ra (~vài phút
 * ngay cả ảnh RAW cỡ trăm MB) — không phải cố tình giới hạn thấp.
 */
const PHOTO_EDIT_DURATION_PICKER_MAX_MS = 24 * 60 * 60 * 1000; // 24 giờ

/** MỚI (phản hồi Giang — "1 khung, không nhân bản, VMState theo activeMediaSource") — `accept`
 * của 2 input DÙNG CHUNG (`fileInput`/`folderInput`, core/dom-refs.js — #media-upload/
 * #media-upload-folder) đổi ĐỘNG theo Nguồn, xem `workflowPlaylist._applyUploadInputAccept()`. */
const UPLOAD_ACCEPT_BY_SOURCE = {
    song: '.mp3,.wav,.ogg,.m4a,.aac,.flac,audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/aac,audio/flac',
    video: 'video/*',
    photo: 'image/*',
};

const workflowPlaylist = {

    /** MỚI (phản hồi Giang — "1 khung, không nhân bản, VMState theo activeMediaSource") — đổi
     * `accept` của 2 input upload DÙNG CHUNG theo Nguồn hiện tại. Gọi từ CẢ 3 hàm switchTo*Source()
     * LẪN loadPersistedPlaylistConfigOnBoot() (khôi phục Nguồn lúc boot) — 4 nơi DUY NHẤT
     * activeMediaSource có thể đổi giá trị.
     * @param {'song'|'video'|'photo'} source
     */
    _applyUploadInputAccept(source) {
        const accept = UPLOAD_ACCEPT_BY_SOURCE[source] || UPLOAD_ACCEPT_BY_SOURCE.song;
        if (fileInput) fileInput.accept = accept;
        if (folderInput) folderInput.accept = accept;
    },

    /** MỚI (v13 Batch F) — ứng với 'playlist.actionMenu.delete.click'. THAY nhánh `action==='delete'`
     * của core `handleSongActionMenuSelect()` (đã xoá).
     * @param {string} songKey - key do listener đọc sẵn từ `playlistStore` và đặt vào payload.
     */
    deleteSongFromActionMenu(songKey) {
        if (!songKey) return; // guard: menu không mở/không xác định được bài nào
        closeSongActionMenu(); // core/playlist/actions.js
        window.removeSong(songKey);
    },

    /** MỚI (v13 Batch F) — ứng với 'playlist.actionMenu.edit.click'. THAY nhánh `action==='edit'`.
     * KHÔNG nhận key qua payload: chỉ nhánh XOÁ mới cần key trong payload (để Block gate kiểm được
     * "bài này có đang làm Visual Background không"); nhánh sửa đọc thẳng `playlistStore` tại đây —
     * Workflow được phép đọc store. */
    openSongEditFromActionMenu() {
        const key = playlistStore.get('songActionMenuKey');
        if (!key) return; // guard: menu không mở
        closeSongActionMenu(); // core/playlist/actions.js
        openSongEditModal(key); // core/playlist/actions.js
    },

    /**
     * Ứng với msg.type = 'playlist.playbackError.delete' — cần ĐỌC state (key đang chờ xoá) rồi
     * PHỐI HỢP shield + hàm core xoá -> rõ ràng là workflow (>1 hàm).
     */
    async executePlaybackErrorDelete() {
        // getAndClearPlaybackErrorKey() là core THUẦN, không shield — đọc xong là ẩn modal ngay
        // (thuần UI), TRẢ VỀ key để workflow tự quyết định có cần xoá hay không.
        const key = getAndClearPlaybackErrorKey();
        if (!key) return; // không có gì đang mở -> no-op, giống hành vi gốc (if (!playbackErrorKey) return;)

        await withLoadingShield(t('common.loading.deleting'), async () => {
            await deleteBrokenSongByKey(key); // "tay" cần key -> đưa key
        });
        // Bản gốc KHÔNG hiện alertModal nào sau khi xoá xong ở luồng này — giữ đúng hành vi cũ,
        // không tự thêm thông báo mới.
    },

    /** MỚI (03/07/2026); VIẾT LẠI (04/07/2026, mục 3 phản hồi Giang — bỏ hẳn nút Upload, chỉ còn
     * "Choose photo") — mở picker chọn 1 ảnh có sẵn trong File Manager làm cover.
     *
     * VIẾT LẠI (Giai đoạn 4, rewrite Photo/Album, mục 4, Giang yêu cầu "render ở file manager photo
     * thế nào thì Generic Drawer như thế") — THAY HẲN `openPhotoUiImagePickerModal()` (modal riêng,
     * core/file-manager/photo-ui.js — ĐÃ XOÁ) bằng `workflowFileManagerPhoto.openCoverImagePicker()`
     * (Generic Drawer, TÁI DÙNG NGUYÊN hạ tầng picker vừa xây cho "thêm ảnh vào album" — event/
     * workflow/file-manager-photo.js, chỉ khác mode single-select). Workflow gọi Workflow miền khác,
     * TỰ DO theo event-bus-flow.md mục 4B — KHÔNG cần tự đọc `listImages()`/tự gọi
     * `setupPhotoGridWindow()` ở đây nữa (picker MỚI tự lo toàn bộ, kể cả đọc DB). */
    pickCoverFromLibrary() {
        workflowFileManagerPhoto.openCoverImagePicker((imageKey) => { // event/workflow/file-manager-photo.js
            this.applyCoverFromLibrary(imageKey);
        });
    },

    /** Callback của picker ở trên — bọc Blob đã có sẵn thành `File` rồi TÁI DÙNG NGUYÊN
     * changeSongEditCover() (không sửa gì ở core/playlist/actions.js — File LÀ MỘT Blob, luồng lưu/
     * export/hiển thị cover cũ chạy y nguyên, xem mục 2 tài liệu trên).
     * @param {string} imageKey
     */
    async applyCoverFromLibrary(imageKey) {
        const record = await getImageRecord(imageKey); // core có sẵn (service/db.js), CÓ return, DÙNG ngay dưới
        if (!record) return; // guard: ảnh vừa bị xoá ở tab/thao tác khác
        const file = new File([record.blob], record.filename, { type: record.blob.type });
        const result = changeSongEditCover(file); // core có sẵn, CÓ return, DÙNG ngay dưới -> hợp lệ Rule 3
        if (result.status === 'invalid') {
            await alertModal(result.reason);
        }
    },

    /**
     * Ứng với msg.type = 'playlist.edit.save' — cần ĐỌC state form (key/newTag/pendingCover) rồi
     * PHỐI HỢP shield + hàm core lưu + (có thể) alertModal not-found + dọn dẹp UI sau khi lưu ->
     * rõ ràng là workflow (nhiều hàm, có rẽ nhánh theo status).
     * SỬA (ver12 "Song/Video Unification", phản hồi Giang 28/07/2026) — rẽ nhánh Song/Video NGAY
     * ĐẦU (đọc `cached.mediaType` — quyết định "gọi cặp core nào", đúng tinh thần VMState ở Router
     * cho cấp Song/Video, nhưng đặt Ở ĐÂY vì cần đọc playlistStore.songEditCurrentKey TRƯỚC —
     * Router không có context đó). 2 nhánh gọi 2 CẶP core HOÀN TOÀN riêng (không core nào gọi core
     * khác) — song vẫn dùng chung `closeSongEditModal()`/`refreshAfterSongEditSave()` (2 hàm đó
     * hoàn toàn trung lập, không có gì "của riêng Song").
     */
    async executeSaveEdit() {
        const key = playlistStore.get('songEditCurrentKey');
        if (!key) return; // không có modal nào đang mở -> no-op, giống hành vi gốc
        const cached = appState.get('playlistCache').get(key);
        const isVideo = cached && cached.mediaType === 'video';
        const isPhoto = cached && cached.mediaType === 'photo';

        if (isVideo) {
            const { customName } = captureVideoEditFormState(); // core THUẦN
            let result;
            await withLoadingShield(t('common.loading.savingInfo'), async () => {
                result = await applyVideoEditAndSave(key, customName); // core THUẦN, nhận key/customName qua tham số
            });
            if (result.status === 'notFound') await alertModal(t('common.songEdit.notFound'));
            closeSongEditModal();
            refreshAfterSongEditSave(key); // core thuần, DÙNG CHUNG — không có gì "của riêng Song"
            return;
        }

        // MỚI (Giang yêu cầu — Photo tích hợp duration như Song/Video) — CÙNG KHUÔN nhánh Video
        // ngay trên, chỉ khác 2 field đọc/ghi (customName + durationSec thay vì chỉ customName).
        if (isPhoto) {
            const { customName, durationSec } = capturePhotoEditFormState(); // core THUẦN
            let result;
            await withLoadingShield(t('common.loading.savingInfo'), async () => {
                result = await applyPhotoEditAndSave(key, customName, durationSec); // core THUẦN
            });
            if (result.status === 'notFound') await alertModal(t('common.songEdit.notFound'));
            closeSongEditModal();
            refreshAfterSongEditSave(key);
            return;
        }

        // captureSongEditFormState() là core THUẦN, không shield — chỉ đọc dữ liệu hiện có của
        // form + playlistStore, không ghi gì cả.
        const { newTag, pendingCover } = captureSongEditFormState();

        let result;
        await withLoadingShield(t('common.loading.savingInfo'), async () => {
            // applySongEditAndSave() là core THUẦN, nhận key/newTag/pendingCover qua THAM SỐ
            // (không tự đọc playlistStore bên trong) -> an toàn để bọc shield quanh nó.
            result = await applySongEditAndSave(key, newTag, pendingCover);
        });

        // Shield đã đóng HẲN tới đây — an toàn để hiện modal (xem quy tắc shield/modal đầu file).
        if (result.status === 'notFound') {
            await alertModal(t('common.songEdit.notFound'));
        }

        closeSongEditModal(); // core thuần, thuần UI — đóng modal trong MỌI trường hợp (giống bản gốc)
        refreshAfterSongEditSave(key); // core thuần — vẽ lại danh sách/sắp xếp lại nếu cần
    },

    /** Ứng với click nút duration ở tab "Sửa" của nhóm field Photo — mở time-picker (core/time-
     * picker-modal.js, dùng chung với Slideshow/Visual Background gradient) thay vì input số tay
     * (Giang chỉ định "dùng time picker, có min nhưng không max"). SỬA (Giang yêu cầu — format
     * 'h-m-s', trước đây chỉ 'm-s') — thêm cột giờ. `maxMs` KHÔNG phải giới hạn của widget, chỉ là
     * 1 config nơi gọi tự chọn (xem docstring `PHOTO_EDIT_DURATION_PICKER_MAX_MS` đầu file) — 24
     * giờ, rộng hơn rất nhiều bất kỳ giá trị nào `computePhotoDuration()` (event/workflow/file-
     * manager-photo.js) thực tế tạo ra. Giá trị THẬT lưu trong DB không hề bị hàm nào clamp — nếu 1
     * ảnh có duration vượt 24 giờ (chưa từng xảy ra với công thức hiện tại), mở picker sẽ tự kẹp
     * hiển thị về 24 giờ, không đụng gì tới số đã lưu. Chỉ set `min` — không có ý định giới hạn
     * trên thật nào. */
    openPhotoEditDurationPicker() {
        const currentSec = playlistStore.get('songEditPendingPhotoDurationSec') || 0;
        openTimePickerModal({ // core/time-picker-modal.js
            title: t('playlistView.songEdit.durationPickerTitle'),
            format: 'h-m-s',
            valueMs: currentSec * 1000,
            minMs: DURATION_MIN_SEC * 1000, // event/workflow/file-manager-photo.js — CÙNG sàn computePhotoDuration() áp lúc upload
            maxMs: PHOTO_EDIT_DURATION_PICKER_MAX_MS, // xem docstring hằng số đầu file — KHÔNG phải trần widget, chỉ là config
            onConfirm: (resultMs) => {
                const resultSec = Math.round(resultMs / 1000 * 100) / 100;
                playlistStore.set({ songEditPendingPhotoDurationSec: resultSec });
                if (songEditPhotoDurationValueEl) songEditPhotoDurationValueEl.textContent = formatTime(resultSec); // core/playlist/state.js
            },
        });
    },

    // ===================== Ver 12 "Multi Media" — Chọn nhiều (plan-v12-multimedia.md mục 4.b1) =====================
    // Cụm sở hữu ĐÃ CHỐT: `playlist` (không phải `fileManagerSong`).
    //
    // SỬA (sau trao đổi Rule 1/2/VMState): render.js (buildSongNode/renderPlaylistFull/
    // renderPlaylistDiff) KHÔNG được sửa để tự đọc selectionMode/selectedSongKeys — những field đó
    // CHỈ ảnh hưởng 1 lớp DOM-patch riêng, tách hẳn theo tiến trình đơn tuyến (showSelectionIndicator/
    // hideSelectionIndicator/refreshAllSelectionVisuals/updateSelectionActionBar/applySelectionChrome,
    // core/playlist/selection.js — hàm THUẦN, nhận state qua tham số, tự chọn hàm nào chạy qua
    // VirtualMachineState thay vì if/else). Nơi ĐỌC appState rồi gọi các hàm thuần đó nối tiếp nhau
    // LÀ ĐÂY (workflow) — đúng vai trò được appState.get() tự do.

    /** Dọn dẹp DÙNG CHUNG khi thoát chế độ chọn (gọi từ 4 hành động dưới sau khi xong việc) —
     * KHÔNG phải core (workflow không bị 4 rule ràng buộc), chỉ là helper nội bộ tránh lặp code. */
    _exitSelectionMode() {
        disableSelectionMode();
        appState.get('domNodesByKey').forEach((node) => hideSelectionIndicator(node));
        updateSelectionActionBar(false, 0);
        applySelectionChrome(false);
    },

    /** Ứng với 'playlist.selection.toggle'. */
    toggleSelectionMode() {
        const enabled = !appState.get('selectionMode');
        VirtualMachineState.run([
            { state: enabled, operation: '===', value: true, callback: () => enableSelectionMode() },
            { state: enabled, operation: '===', value: false, callback: () => disableSelectionMode() },
        ]);
        const selectedSongKeys = appState.get('selectedSongKeys'); // đọc LẠI sau khi core ghi xong (disableSelectionMode có thể vừa clear nó)
        const domNodesByKey = appState.get('domNodesByKey');
        // Vòng lặp + chọn showSelectionIndicator/hideSelectionIndicator theo `enabled` ĐẶT Ở ĐÂY
        // (workflow), KHÔNG phải core — đây là ≥2 lời gọi core void nối tiếp nhau (đúng hình dạng
        // Workflow theo Rule 3/event-bus-flow.md mục 4B), workflow được phép làm việc này tự do.
        VirtualMachineState.run([
            { state: enabled, operation: '===', value: true, callback: () => domNodesByKey.forEach((node, key) => showSelectionIndicator(node, key, selectedSongKeys)) },
            { state: enabled, operation: '===', value: false, callback: () => domNodesByKey.forEach((node) => hideSelectionIndicator(node)) },
        ]);
        updateSelectionActionBar(enabled, selectedSongKeys.size);
        applySelectionChrome(enabled);
    },

    /** Ứng với 'playlist.item.playClick' khi selectionMode=true (xem router). */
    toggleSongSelectionAndRefresh(key) {
        const isCurrentlySelected = appState.get('selectedSongKeys').has(key);
        VirtualMachineState.run([
            { state: isCurrentlySelected, operation: '===', value: true, callback: () => deselectSong(key) },
            { state: isCurrentlySelected, operation: '===', value: false, callback: () => selectSong(key) },
        ]);

        const selectedSongKeys = appState.get('selectedSongKeys'); // đọc LẠI sau khi core ghi xong ở trên
        const node = appState.get('domNodesByKey').get(key);
        // Không cần VMState ở đây: đang Ở TRONG chế độ chọn (hàm này chỉ được router gọi khi
        // selectionMode=true, xem router/playlist.js), nên LUÔN showSelectionIndicator — việc
        // chọn/bỏ-chọn CHỈ đổi màu/tick bên trong nó (ternary trình bày thuần theo isSelected,
        // không phải rẽ nhánh tiến trình, khác hẳn quyết định BẬT/TẮT cả chế độ chọn ở trên).
        showSelectionIndicator(node, key, selectedSongKeys);
        updateSelectionActionBar(appState.get('selectionMode'), selectedSongKeys.size);
    },

    /** Ứng với 'playlist.uploadMenu.open' khi selectionMode=true (xem router) — CHỈ hiện modal,
     * không mở menu upload. alertModal() chỉ tồn tại ở tầng workflow (core không biết), nên dù chỉ
     * 1 lời gọi vẫn thuộc workflow, không thể gọi thẳng từ router. */
    async showUploadBlockedBySelectionModal() {
        await alertModal(t('playlistView.selection.uploadBlocked'));
    },

    // ===================== Upload Video — DỜI từ event/workflow/file-manager-video.js (phản hồi
    // Giang — file đó đã xoá hẳn, cụm này lúc đó CHỈ được gọi từ input riêng `#video-upload-input`
    // ở Playlist, nên chuyển thẳng về đây thay vì giữ 1 file/router/listener riêng chỉ để relay).
    // GIỮ NGUYÊN 100% thân hàm. [CẬP NHẬT — phản hồi Giang "1 khung, không nhân bản"] input riêng
    // đó ĐÃ XOÁ — giờ gọi từ `fileInput`/`folderInput` DÙNG CHUNG (case 'playlist.upload.
    // fileChange'/'playlist.upload.folderChange', event/router/playlist.js, VirtualMachineState
    // theo activeMediaSource) — xem docstring uploadVideos() ngay dưới. =====

    /** Chụp 1 khung hình + đọc thời lượng của 1 file video, crop VUÔNG cố định
     * `VIDEO_THUMBNAIL_SIZE`×`VIDEO_THUMBNAIL_SIZE` (center-crop cạnh dài về giữa) — đặt ở Workflow
     * (không phải core) vì cần `<video>`/`canvas` — DOM API, core không được đụng theo Rule 1-4.
     * Chụp khung hình tại giây `min(1, duration/2)` — tránh giây đầu tiên hay bị đen/mờ.
     * `width`/`height` trả về là kích thước GỐC của video (KHÔNG phải kích thước thumb).
     *
     * ĐỒNG THỜI chụp THÊM `thumbFullBlob`: khung hình ĐẦU VIDEO ở ĐÚNG kích thước GỐC (KHÔNG
     * center-crop vuông, KHÔNG resize) — TÁCH RIÊNG HẲN với `thumbBlob` (vuông, chụp ở giây
     * `min(1, duration/2)`, dùng cho lưới/cover).
     *
     * Kỹ thuật chụp full-res: nghe CẢ 3 sự kiện (`loadeddata`/`canplay`/`seeked`, cái nào tới trước
     * chụp trước, chụp thêm lần cũng vô hại nhờ cờ `fullFrameCaptured`) + ép trình duyệt SEEK THẬT
     * bằng cách gán `currentTime = 0.0001` RỒI `= 0` ngay sau + vẽ NGAY nếu khung hình đã sẵn có
     * (`readyState >= 2`) + "nhá" `play()`/`pause()` 1 lần nếu chưa đủ dữ liệu để ép trình duyệt
     * decode thật (một số engine không bắn `seeked` đáng tin cậy ngay tại time=0).
     * @param {File} file
     * @returns {Promise<{thumbBlob: Blob, thumbFullBlob: (Blob|null), width: number, height: number, duration: number}>}
     */
    _extractVideoThumbAndMeta(file) {
        return new Promise((resolve, reject) => {
            const objectUrl = URL.createObjectURL(file);
            const videoEl = document.createElement('video');
            videoEl.muted = true;
            videoEl.playsInline = true;
            let settled = false;
            let thumbFullBlob = null; // gán ở bước chụp full-res ĐẦU (trước thumb vuông)
            let fullFrameCaptured = false; // chặn chụp full-res quá 1 lần (3 sự kiện CÙNG nghe, xem docstring)
            const cleanup = () => { try { URL.revokeObjectURL(objectUrl); } catch (e) {} };
            const cleanupAndReject = (err) => { if (settled) return; settled = true; cleanup(); reject(err); };
            const safetyTimeout = taskManager.once(() => cleanupAndReject(new Error('[_extractVideoThumbAndMeta] timeout đọc video')), 8000);

            let nudgedFullRes = false; // chặn play()/pause() ép decode quá 1 lần

            // Bước 1/2 — chụp full-res ĐÚNG khung đầu video thật. QUAN TRỌNG: seek bước 2/2
            // (onSquareThumbSeeked) chỉ được đăng ký BÊN TRONG callback này (ngay trước khi seek
            // tiếp) — không đăng ký sẵn từ đầu, tránh khớp nhầm đúng sự kiện 'seeked' của bước 1.
            function captureFullResFrame() {
                if (settled || fullFrameCaptured) return;
                if (videoEl.readyState < 2) {
                    if (!nudgedFullRes) {
                        nudgedFullRes = true;
                        videoEl.addEventListener('playing', captureFullResFrame, { once: true });
                        videoEl.play().then(() => videoEl.pause()).catch(() => {});
                    }
                    return; // còn cơ hội ở lần bắn sau, KHÔNG set fullFrameCaptured
                }
                fullFrameCaptured = true;
                const width = videoEl.videoWidth, height = videoEl.videoHeight;
                const fullCanvas = document.createElement('canvas');
                fullCanvas.width = width; fullCanvas.height = height;
                fullCanvas.getContext('2d').drawImage(videoEl, 0, 0, width, height);
                fullCanvas.toBlob((blob) => {
                    if (settled) return;
                    thumbFullBlob = blob; // Blob|null — field PHỤ, không chặn nếu null
                    videoEl.addEventListener('seeked', onSquareThumbSeeked, { once: true }); // Bước 2/2 — đăng ký NGAY TRƯỚC lúc seek tiếp, không sớm hơn
                    videoEl.currentTime = Math.min(1, videoEl.duration / 2 || 0); // seek bước 2/2 — mốc cũ, cho thumb vuông
                }, 'image/jpeg', 0.92);
            }

            videoEl.addEventListener('loadedmetadata', () => {
                const width = videoEl.videoWidth, height = videoEl.videoHeight;
                if (!width || !height) { cleanupAndReject(new Error('[_extractVideoThumbAndMeta] video không có kích thước hợp lệ')); return; }
                videoEl.addEventListener('loadeddata', captureFullResFrame, { once: true });
                videoEl.addEventListener('canplay', captureFullResFrame, { once: true });
                videoEl.addEventListener('seeked', captureFullResFrame, { once: true });
                videoEl.currentTime = 0.0001; // ép trình duyệt SEEK THẬT (một số engine bỏ qua nếu currentTime đã sẵn là 0)
                videoEl.currentTime = 0; // rồi về ĐÚNG khung đầu tiên thật sự
                if (videoEl.readyState >= 2) captureFullResFrame(); // đã có sẵn khung hình (HAVE_CURRENT_DATA) — chụp ngay, phòng 3 sự kiện trên đã bắn TRƯỚC khi kịp đăng ký
            }, { once: true });

            // Bước seek 2/2 — mốc cũ `min(1, duration/2)`, chụp thumbBlob VUÔNG.
            function onSquareThumbSeeked() {
                if (settled) return;
                safetyTimeout.kill();
                const width = videoEl.videoWidth, height = videoEl.videoHeight;
                const side = Math.min(width, height);
                const sx = (width - side) / 2, sy = (height - side) / 2;
                const canvas = document.createElement('canvas');
                canvas.width = VIDEO_THUMBNAIL_SIZE; canvas.height = VIDEO_THUMBNAIL_SIZE;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(videoEl, sx, sy, side, side, 0, 0, VIDEO_THUMBNAIL_SIZE, VIDEO_THUMBNAIL_SIZE);
                canvas.toBlob((thumbBlob) => {
                    settled = true; cleanup();
                    if (!thumbBlob) { reject(new Error('[_extractVideoThumbAndMeta] canvas.toBlob trả về null')); return; }
                    resolve({ thumbBlob, thumbFullBlob, width, height, duration: videoEl.duration || 0 });
                }, 'image/jpeg', 0.85);
            }

            videoEl.addEventListener('error', () => cleanupAndReject(new Error('[_extractVideoThumbAndMeta] không đọc được video')), { once: true });
            videoEl.src = objectUrl;
        });
    },

    /** Ứng với 'playlist.upload.fileChange'/'playlist.upload.folderChange' khi activeMediaSource=
     * 'video' (SỬA — phản hồi Giang "1 khung, không nhân bản": trước đây có msg.type riêng
     * 'playlist.upload.videoFileChange' từ input riêng #video-upload-input, ĐÃ XOÁ — giờ dùng
     * CHUNG 2 input với Song/Photo, router (event/router/playlist.js) rẽ nhánh VirtualMachineState
     * theo activeMediaSource, cả 2 case đều gọi hàm NÀY — hàm không phân biệt file đến từ input
     * "chọn file" hay "chọn thư mục", chỉ cần 1 mảng File). Lỗi 1 file (vd file hỏng) KHÔNG chặn cả
     * lô upload — bắt riêng, bỏ qua đúng file đó, tiếp tục file sau (Rule 1: vẫn 1 tiến trình
     * "upload cả lô"). Hiện tiến trình "X/Y" qua `loadingText.textContent`, ĐÚNG pattern
     * `handleAudioFiles()` (Song, core/playlist/loader.js) — tái dùng NGUYÊN lang key
     * `common.upload.loadingProgress`.
     * @param {FileList|File[]} files
     */
    async uploadVideos(files) {
        const fileArray = Array.from(files);
        if (fileArray.length === 0) return;

        let failedCount = 0;
        await withLoadingShield(tFormat('common.upload.loadingProgress', { done: 1, total: fileArray.length }), async () => {
            for (let i = 0; i < fileArray.length; i++) {
                const file = fileArray[i];
                loadingText.textContent = tFormat('common.upload.loadingProgress', { done: i + 1, total: fileArray.length });
                try {
                    const { thumbBlob, thumbFullBlob, width, height, duration } = await this._extractVideoThumbAndMeta(file);
                    await saveVideo(file, file.name, thumbBlob, width, height, duration, thumbFullBlob); // core/file-manager/video.js
                } catch (err) {
                    console.error(`[uploadVideos] chụp thumbnail/lưu thất bại cho file "${file.name}":`, err);
                    failedCount++;
                }
            }
        });
        // input tự dọn value trong chính listener của nó (event/listener/playlist.js, fileInput/folderInput dùng chung).
        // MỚI (21/07/2026, Giang chỉ ra "không cập nhật lại list của video") — nếu Playlist đang
        // browse nguồn Video, làm mới playlistCache/playlistOrder NGAY để Next/Prev thấy được video
        // vừa upload — KHÔNG cần đổi Nguồn tắt/bật lại.
        await workflowVideoPlayer.refreshVideoPlaylistIfActive(); // event/workflow/video-player.js — tự guard activeMediaSource, no-op nếu Playlist không ở nguồn Video
        const successCount = fileArray.length - failedCount;
        await alertModal(tFormat('fileManager.video.uploadSuccess', { count: successCount }));
    },

    /** Ứng với 'playlist.upload.fileChange'/'playlist.upload.folderChange' khi activeMediaSource=
     * 'photo' — MỚI (phản hồi Giang "1 khung, không nhân bản" + "quá trình cũ của up photo có thể
     * tái dùng nhưng phải đúng quy trình mẫu của song/video đã làm ở giao diện playlist"). TÁI
     * DÙNG "quá trình cũ" ở đúng phần lõi (resize thumbnail — `workflowFileManagerPhoto.
     * resizeImageForThumbnail()`, event/workflow/file-manager-photo.js, Workflow gọi Workflow miền
     * khác, TỰ DO theo event-bus-flow.md mục 4B — KHÔNG viết lại thuật toán resize) + `saveImage()`
     * (core/file-manager/image.js, không đổi) — nhưng KHÔNG gọi thẳng `uploadImages()` (hàm đó
     * mang theo hành lý riêng của Photo Panel: check `photoPanel.classList.contains('hidden')`,
     * tự dọn `#file-manager-image-upload-input`, tự `this.refresh()` lưới CỦA NÓ, tự alertModal
     * theo ngữ cảnh Photo Panel — không khớp giao diện Playlist). Thân hàm NÀY viết MỚI, đúng
     * KHUÔN `uploadVideos()` ngay trên (shield + tiến trình "X/Y" + bắt lỗi riêng từng file + xong
     * thì tự làm mới `playlistOrder` nếu đang đứng ở Nguồn Photo — KHÔNG có hàm `refreshVideoPlaylistIfActive()`-
     * tương đương ở miền khác để gọi chéo, vì `switchToPhotoSource()` đã SẴN nằm CÙNG object này).
     * SỬA (Giang yêu cầu — Photo tích hợp `duration` như Song/Video) — thêm bước gọi
     * `workflowFileManagerPhoto.computePhotoDuration()` (cùng file với `resizeImageForThumbnail()`,
     * cùng lý do TỰ DO gọi chéo Workflow) TRƯỚC `saveImage()`, `saveImage()` giờ nhận thêm `duration`.
     * @param {FileList|File[]} files
     */
    async uploadPhotos(files) {
        const fileArray = Array.from(files);
        if (fileArray.length === 0) return;

        let failedCount = 0;
        await withLoadingShield(tFormat('common.upload.loadingProgress', { done: 1, total: fileArray.length }), async () => {
            for (let i = 0; i < fileArray.length; i++) {
                const file = fileArray[i];
                loadingText.textContent = tFormat('common.upload.loadingProgress', { done: i + 1, total: fileArray.length });
                try {
                    const { thumbBlob, width, height } = await workflowFileManagerPhoto.resizeImageForThumbnail(file); // event/workflow/file-manager-photo.js — tái dùng NGUYÊN thuật toán resize cũ
                    const duration = await workflowFileManagerPhoto.computePhotoDuration(file, width, height); // MỚI — Photo tích hợp duration như Song/Video (event/workflow/file-manager-photo.js)
                    await saveImage(file, file.name, thumbBlob, width, height, duration); // core/file-manager/image.js
                } catch (err) {
                    console.error(`[uploadPhotos] resize/lưu thất bại cho file "${file.name}":`, err);
                    failedCount++;
                }
            }
        });
        // input tự dọn value trong chính listener của nó (event/listener/playlist.js, fileInput/folderInput dùng chung).
        // Làm mới playlistOrder NGAY nếu Playlist đang đứng ở Nguồn Photo — CÙNG LÝ DO/CÙNG CÁCH SỬA
        // `refreshVideoPlaylistIfActive()` (event/workflow/video-player.js), nhưng viết TRỰC TIẾP ở
        // đây (không tách hàm riêng) vì `switchToPhotoSource()` đã SẴN cùng 1 object `workflowPlaylist`.
        if (appState.get('activeMediaSource') === 'photo') {
            const imageRecords = await listImages(); // core/file-manager/image.js
            const keys = buildPhotoPlaylistCache(imageRecords); // core/playlist/loader.js
            appState.set('playlistOrder', keys);
            console.log(`writer: "uploadPhotos", page: "playlistOrder", content: "${keys.length} ảnh (làm mới sau upload)"`);
            updateShuffleArray();
            recomputeDisplayOrder();
            recomputeRenderOrder();
            renderPlaylistDiff();
        }
        const successCount = fileArray.length - failedCount;
        await alertModal(tFormat('fileManager.photo.image.uploadSuccess', { count: successCount })); // tái dùng NGUYÊN lang key cũ của Photo Panel
    },

    /**
     * "Phát bài đã chọn" — áp displaySortMode hiện tại NHƯNG chỉ trong tập đã chọn (tái dùng
     * sortKeysByMode() có sẵn ở core/playlist/order.js, chỉ đổi input thành tập con).
     *
     * SỬA (fix 03/07/2026, mục 3a/3b yêu cầu) — đây chính là "section chọn bài -> phát" phải KHÁC
     * "danh sách phát của playlist": trước đây chỉ ghi đè displayOrder, không đánh dấu gì, khiến
     * app không còn cách nào biết "đang ở trong 1 section" để quay lại top-level. Giờ đặt
     * sectionQueueActive=true (đọc bởi 2 nút to Phát/Trộn bài — event/workflow/playlist-empty-state.js
     * — để biết cần chèn lại top-level trước khi phát) VÀ, nếu Shuffle đang BẬT sẵn từ trước khi
     * vào section này, resync NGAY shuffleIndices theo section mới (updateShuffleArrayFromQueue) —
     * tránh Next/Prev đầu tiên trong section "tràn" ngay sang top-level vì shuffleIndices cũ còn
     * thuộc phạm vi khác.
     */
    playSelectedSongs() {
        const keys = Array.from(appState.get('selectedSongKeys'));
        if (keys.length === 0) return; // guard — chưa chọn gì thì không làm gì

        // MỚI (ver12 Batch1) — sortKeysByMode() đổi chữ ký, nhận tham số thay vì tự appState.get()
        // (Rule 2, xem comment tại định nghĩa hàm, core/playlist/order.js) — gộp 1 lần get([...]).
        const { displaySortMode: mode, songNameIndex, playlistCache: cache } = appState.get(['displaySortMode', 'songNameIndex', 'playlistCache']);
        const sorted = sortKeysByMode(keys, mode, songNameIndex, cache); // core có sẵn, CÓ return, DÙNG NGAY dưới -> hợp lệ Rule 3
        appState.set('displayOrder', sorted);
        console.log(`writer: "playSelectedSongs", page: "displayOrder", content: "${sorted.length} bài đã chọn, sort theo displaySortMode hiện tại"`);
        appState.mutate('pendingResortKeys', s => s.clear());

        appState.set('sectionQueueActive', true);
        console.log(`writer: "playSelectedSongs", page: "sectionQueueActive", content: "true"`);
        if (appState.get('isShuffle')) {
            updateShuffleArrayFromQueue(sorted, appState.get('playlistOrder'), true); // core mới (order.js), CÓ tham số -> Rule 2 hợp lệ
        }

        this._exitSelectionMode(); // thoát chế độ chọn trước khi chuyển màn hình phát
        workflowPlayer.playMedia(sorted[0]); // [SỬA — plan-playmedia-reorg.md] thay window.playSong() cũ, Workflow gọi Workflow khác miền, tự do
    },

    /**
     * "Xuất ZIP" — build tag mới nhất cho từng bài (tái dùng buildTaggedBlob() có sẵn ở
     * core/id3-export.js), gom vào 1 file .zip (JSZip, đã có sẵn qua CDN) rồi tải xuống 1 lần —
     * KHÔNG gọi exportSongWithTag() có sẵn (mỗi lần tự bọc withLoadingShield() riêng — lồng shield
     * sẽ bị chặn bởi isShieldBusy, xem loading-shield-util.js).
     */
    async exportSelectedSongsZip() {
        const keys = Array.from(appState.get('selectedSongKeys'));
        if (keys.length === 0) return;

        let failedCount = 0;
        await withLoadingShield(t('common.loading.exportingFile'), async () => {
            const zip = new JSZip();
            for (const key of keys) {
                const record = await getSongRecord(key);
                if (!record) { failedCount++; continue; } // guard: bài không còn tồn tại (race) — bỏ qua
                try {
                    const taggedBlob = await buildTaggedBlob(record); // core có sẵn, CÓ return, DÙNG ngay dưới
                    zip.file(record.filename, taggedBlob);
                } catch (e) {
                    console.error('[workflow:playlist] Lỗi ghi tag lúc xuất ZIP hàng loạt, dùng file gốc thay thế:', e);
                    zip.file(record.filename, record.blob);
                    failedCount++;
                }
            }
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            triggerDownload(zipBlob, t('playlistView.selection.exportZipFilename')); // core có sẵn ở id3-export.js
        });

        this._exitSelectionMode();
        // Shield đã đóng HẲN tới đây — an toàn để hiện modal.
        if (failedCount > 0) await alertModal(t('playlistView.selection.exportPartialFail'));
    },

    /**
     * "Xuất file" — bản 1 file lẻ, dành cho Song. DỜI từ `core/id3-export.js::exportSongWithTag()`
     * (Batch "Export dọn nợ kiến trúc", phản hồi Giang) — hàm này tự đọc DB + tự bọc
     * `withLoadingShield()` + tự gọi `alertModal()`, đúng HÌNH DẠNG WORKFLOW, KHÔNG đổi 1 dòng logic
     * bên trong, chỉ đổi NƠI Ở cho đúng kiến trúc.
     */
    async exportSongWithTag(key) {
        // FIX (xung đột shield/modal): KHÔNG await alertModal() bên trong fn() của
        // withLoadingShield() — xem giải thích chi tiết ở event/workflow/player.js (workflowPlayer.playMedia,
        // [SỬA — plan-playmedia-reorg.md] dời từ core/playlist/actions.js::window.playSong() cũ).
        // Tóm tắt: isShieldBusy chỉ giải phóng SAU KHI fn() resolve, còn alertModal() chỉ resolve
        // khi người dùng bấm OK -> lồng vào nhau làm #loading-shield (z-[200]) treo, đè lên trên
        // modalChoice() (z-[130]) suốt thời gian chờ. Dùng cờ mang thông tin ra ngoài, hiện modal
        // SAU KHI withLoadingShield() đã resolve hoàn toàn.
        let resultFlag = null; // null = ổn (không cần báo gì) | 'notFound' | 'tagWriteFailed'
        let failedRecord = null; // giữ lại record gốc khi ghi tag lỗi — dùng để triggerDownload(record.blob,...) ở ngoài, tránh query lại DB lần 2
        await withLoadingShield(t('common.loading.exportingFile'), async () => {
            const record = await getSongRecord(key);
            if (!record) { resultFlag = 'notFound'; return; }
            try {
                const taggedBlob = await buildTaggedBlob(record); // core có sẵn (core/id3-export.js)
                triggerDownload(taggedBlob, record.filename); // core có sẵn (core/id3-export.js)
            } catch (e) {
                console.error('[workflow:playlist] Lỗi ghi tag lúc xuất file:', e);
                resultFlag = 'tagWriteFailed';
                failedRecord = record;
                // Giữ ĐÚNG thứ tự hành vi gốc: alertModal() chạy XONG rồi mới tới
                // triggerDownload(record.blob,...) — người dùng đọc thông báo lỗi TRƯỚC khi file
                // (chưa ghi tag) được tải xuống. Đưa triggerDownload này ra ngoài CÙNG với
                // alertModal() (xem dưới) để giữ đúng thứ tự đó.
            }
        });

        // Shield đã đóng HẲN tới đây — an toàn để hiện modal.
        if (resultFlag === 'notFound') {
            await alertModal(t('common.export.notFound'));
        } else if (resultFlag === 'tagWriteFailed') {
            await alertModal(t('common.export.tagWriteFailed'));
            triggerDownload(failedRecord.blob, failedRecord.filename);
        }
    },

    /**
     * "Xuất file" cho Video — bản 1 file lẻ, MỚI (Batch "Export dọn nợ kiến trúc", phản hồi Giang,
     * plan-v12-song-video-unification.md mục 6f) — CÙNG CẤU TRÚC exportSongWithTag() ngay trên,
     * CHỈ BỎ bước buildTaggedBlob() (Video không có 3 tag ID3, `customName` KHÔNG remux vào file —
     * đã chốt ở mục 6c/6f) — tải thẳng record.blob/record.filename GỐC.
     */
    async exportVideoFile(key) {
        let notFound = false;
        await withLoadingShield(t('common.loading.exportingFile'), async () => {
            const record = await getVideoRecord(key); // service/db.js
            if (!record) { notFound = true; return; }
            triggerDownload(record.blob, record.filename); // core có sẵn (core/id3-export.js)
        });
        if (notFound) await alertModal(t('common.export.notFound'));
    },

    /**
     * "Xuất ZIP" cho Video — bản hàng loạt, MỚI (cùng batch với exportVideoFile() ngay trên) — CÙNG
     * CẤU TRÚC exportSelectedSongsZip(), CHỈ BỎ bước gắn tag (zip thẳng record.blob/filename gốc,
     * không cần try/catch riêng vì không có bước ghi tag nào có thể lỗi).
     */
    async exportSelectedVideosZip() {
        const keys = Array.from(appState.get('selectedSongKeys'));
        if (keys.length === 0) return;

        let failedCount = 0;
        await withLoadingShield(t('common.loading.exportingFile'), async () => {
            const zip = new JSZip();
            for (const key of keys) {
                const record = await getVideoRecord(key); // service/db.js
                if (!record) { failedCount++; continue; } // guard: video không còn tồn tại (race) — bỏ qua
                zip.file(record.filename, record.blob);
            }
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            triggerDownload(zipBlob, t('playlistView.selection.exportZipFilenameVideo')); // core có sẵn ở id3-export.js
        });

        this._exitSelectionMode();
        if (failedCount > 0) await alertModal(t('playlistView.selection.exportPartialFail'));
    },

    /**
     * "Xuất file" cho ĐÚNG 1 item đang mở menu 3 chấm — MỚI (Batch "Export dọn nợ kiến trúc", phản
     * hồi Giang) — TÁCH RIÊNG khỏi handleSongActionMenuSelect() cũ (core/playlist/actions.js, đã có
     * sẵn nhánh if/else vi phạm Rule 1 — không mở rộng thêm, CÙNG PRECEDENT với addToFolder/
     * editSubtitles/navigateToActiveMenuVideoEdit ở trên: đọc key đang mở menu, đóng menu, rồi rẽ
     * theo `activeMediaSource` — CÙNG CÔNG THỨC openAddToFolderPickerForSongMenu() phía trên
     * (Playlist chỉ browse ĐÚNG 1 nguồn tại 1 thời điểm, item đang mở menu luôn cùng loại với nguồn
     * đang active) — Song -> exportSongWithTag() (kèm bước ghi tag ID3), Video -> exportVideoFile()
     * (bỏ qua bước tag).
     */
    async exportActiveMenuItem() {
        const key = playlistStore.get('songActionMenuKey');
        if (!key) return;
        closeSongActionMenu();
        const mediaType = appState.get('activeMediaSource') === 'video' ? 'video' : 'song';
        if (mediaType === 'video') await this.exportVideoFile(key);
        else await this.exportSongWithTag(key);
    },

    /**
     * MỚI (mục 1d, CHỐT 03/07/2026) — "Thêm vào thư mục" cho ĐÚNG 1 bài từ menu 3 chấm đơn lẻ.
     * Song song với openAddToFolderPicker() ở dưới (chọn nhiều) — KHÔNG gộp chung 1 method vì 2
     * message trigger khác nhau (đơn lẻ đọc `songActionMenuKey` trong playlistStore, chọn nhiều
     * đọc `selectedSongKeys` trong appState) và cần đóng đúng menu tương ứng (songActionMenu vs
     * chế độ chọn nhiều) — viết chung sẽ phải rẽ nhánh theo "nguồn nào gọi tới", đúng thứ vi phạm
     * Rule 1 nếu đặt trong core, và không cần thiết ở tầng workflow (workflow không bị Rule 1 ràng
     * buộc, nhưng tách riêng vẫn rõ ràng hơn khi đọc). CẢ 2 giờ dùng CHUNG `_openFolderPickerDrawer()`
     * (grid Generic Drawer, xem MỚI 14/07/2026 bên dưới) — chỉ khác `onPick` callback.
     */
    /**
     * MỚI (10/07/2026) — "Sửa phụ đề" trong menu 3 chấm: đọc key bài đang mở menu, đóng menu, rồi
     * TÁI DÙNG `workflowSubtitleModal.navigateToEditor()` (miền KHÁC — "subtitleModal" — nhưng
     * CÙNG logic điều hướng với nút Sub ở Control Center, xem giải thích đầy đủ ở đó VÀ
     * readme/event-bus-flow.md) — Workflow gọi Workflow khác MIỀN tự do, không bị Rule 3 (rule đó
     * CHỈ áp cho Core).
     */
    openSubtitleEditorForSongMenu() {
        const key = playlistStore.get('songActionMenuKey');
        if (!key) return;
        closeSongActionMenu();
        workflowSubtitleModal.navigateToEditor(key);
    },

    /**
     * "Sửa video" trong menu 3 chấm. SỬA (phản hồi Giang — dẹp tầng trung gian) — TRƯỚC ĐÂY gọi
     * `workflowFileManagerVideo.navigateToVideoEdit()` (hàm 1 dòng, chỉ relay tiếp sang
     * `workflowVideoPreview.open()`, KHÔNG làm gì thêm) — file `file-manager-video.js` đã xoá hẳn
     * (mọi logic thật của nó dời sang playlist.js/visualizer-control-center.js theo đúng người gọi
     * thật) nên gọi THẲNG `workflowVideoPreview.open()` ở đây, bỏ hẳn 1 tầng relay vô nghĩa.
     * XOÁ (phản hồi Giang — "bỏ luôn set background cho dropdown của video đi") —
     * `setActiveMenuVideoAsBackground()` (action "setAsBgVideo") đã bỏ hẳn cùng lúc với nút dropdown
     * tương ứng. TỰ AUDIT LẠI lúc xoá: `workflowFileManagerVideo.setVideoAsBackground()` tưởng còn
     * picker "Use background video" dùng — THỰC RA KHÔNG (picker tự inline logic riêng) — đã XOÁ
     * THẲNG hàm đó (0 lời gọi) cùng 2 lang key liên quan.
     */
    navigateToActiveMenuVideoEdit() {
        const key = playlistStore.get('songActionMenuKey');
        if (!key) return;
        closeSongActionMenu();
        workflowVideoPreview.open(key); // event/workflow/video-preview.js
    },

    /** MỚI (Giang yêu cầu — "thêm dropdown edit image -> mở openImagePreview()") — mirror ĐÚNG
     * khuôn navigateToActiveMenuVideoEdit() ngay trên, đích đến khác: modal xem/sửa ảnh (zoom/
     * crop/rotate) đã có sẵn từ trước khi Photo được unified vào Playlist. */
    navigateToActiveMenuPhotoEdit() {
        const key = playlistStore.get('songActionMenuKey');
        if (!key) return;
        closeSongActionMenu();
        workflowFileManagerPhoto.openImagePreview(key); // event/workflow/file-manager-photo.js
    },

    async openAddToFolderPickerForSongMenu() {
        const key = playlistStore.get('songActionMenuKey');
        if (!key) return;
        closeSongActionMenu();

        // SỬA (hợp nhất Photo vào Playlist) — `activeMediaSource` giờ LÀ ĐÚNG mediaType cần dùng
        // (3 giá trị hợp lệ duy nhất: song/video/photo — xem loadPersistedPlaylistConfigOnBoot()),
        // không cần ternary fallback nữa. TRUYỀN THÊM `options.folders` = danh sách ĐÃ LỌC theo ĐÚNG
        // type này (CHỐT Giang — "playlist source nào thì chỉ hiển thị type folder của source tương
        // ứng") — picker giờ KHÔNG còn hiện lẫn folder khác type (trước đây hiện TOÀN BỘ, chỉ báo
        // lỗi typeMismatch SAU KHI chọn nhầm — trải nghiệm kém).
        const mediaType = appState.get('activeMediaSource');
        await this._openFolderPickerDrawer(async (folderId) => {
            let result;
            await withLoadingShield(t('common.loading.savingInfo'), async () => {
                result = await addSongsToFolder([key], folderId, mediaType); // core có sẵn (core/file-manager/folder.js)
            });
            // XOÁ (hợp nhất Photo vào Playlist, cấu trúc folderIndex) — check `status==='typeMismatch'`
            // bỏ hẳn: addSongsToFolder() không còn trả trạng thái đó nữa (picker giờ CHỈ đưa vào
            // folder ĐÚNG type — không còn khả năng lệch để phải xử lý).
            // SỬA 03/07/2026 (đợt 3): KHÔNG còn tự áp dụng ngay vào Playlist đang chạy — thêm bài
            // không đổi "folder nào đang active", chỉ đổi DỮ LIỆU trong nó. Lần tải trang kế tiếp
            // (hoặc lần bấm "Áp dụng" kế tiếp) sẽ tự đọc đúng danh sách mới — xem
            // event/workflow/playlist-scope.js.
            // SỬA (phản hồi Giang, mục "ngôn ngữ theo ngữ cảnh Song/Video") — trước đây LUÔN
            // "Added X song(s)" kể cả khi vừa thêm Video. MỞ RỘNG (hợp nhất Photo) — thêm nhánh photo.
            await alertModal(tFormat(mediaType === 'video' ? 'fileManager.folderPicker.addSuccessVideo' : mediaType === 'photo' ? 'fileManager.folderPicker.addSuccessPhoto' : 'fileManager.folderPicker.addSuccess', { count: 1 }));
        }, { folders: await listFolders(mediaType) });
    },

    /**
     * "Thêm vào thư mục" (chọn nhiều) — cùng `_openFolderPickerDrawer()` với bản 1-bài ở trên, chỉ
     * khác `onPick` (nhiều key + thoát chế độ chọn).
     */
    async openAddToFolderPicker() {
        const keys = Array.from(appState.get('selectedSongKeys'));
        if (keys.length === 0) return;

        // SỬA (hợp nhất Photo vào Playlist) — cùng lý do openAddToFolderPickerForSongMenu() ngay
        // trên: đọc thẳng activeMediaSource + lọc danh sách folder theo ĐÚNG type.
        const mediaType = appState.get('activeMediaSource');
        await this._openFolderPickerDrawer(async (folderId) => {
            let result;
            await withLoadingShield(t('common.loading.savingInfo'), async () => {
                result = await addSongsToFolder(keys, folderId, mediaType); // core có sẵn (core/file-manager/folder.js)
            });
            // XOÁ (hợp nhất Photo vào Playlist, cấu trúc folderIndex) — cùng lý do bản 1-bài phía
            // trên: check `status==='typeMismatch'` bỏ hẳn.
            // SỬA 03/07/2026 (đợt 3): KHÔNG còn tự áp dụng ngay vào Playlist đang chạy — xem lý do
            // ở finishAdd() bản 1-bài phía trên (openAddToFolderPickerForSongMenu).
            this._exitSelectionMode();
            await alertModal(tFormat(mediaType === 'video' ? 'fileManager.folderPicker.addSuccessVideo' : mediaType === 'photo' ? 'fileManager.folderPicker.addSuccessPhoto' : 'fileManager.folderPicker.addSuccess', { count: keys.length }));
        }, { folders: await listFolders(mediaType) });
    },

    // ===================== Add to Folder — Generic Drawer grid (MỚI 14/07/2026) =====================
    // Trước đây: modal riêng (core/file-manager/folder-picker-ui.js::openFolderPickerModal() — ĐÃ
    // XOÁ HẲN 14/07/2026, không còn nơi gọi nào).
    // Giờ: Generic Drawer + grid folder (icon trên + tên dưới tối đa 2 dòng, xem
    // components/items.js::itemTemplateFolderTile()) + 1 tile "Tạo folder mới" cố định cuối grid
    // (buildAddFolderTileHtml()) — bấm vào tạo NGAY 1 folder tên tự động, vào thẳng chế độ sửa tên
    // (input, focus sẵn). Toàn bộ tương tác trong Drawer (tap chọn folder/tap tạo mới/sửa tên/đóng)
    // ĐỀU bắn qua eventBus (Rule 5a MỚI, readme/core-function-conventions.md — code MỚI viết từ
    // 13/07/2026 không còn ngoại lệ "gọi thẳng tham số" như modalChoice()).

    _folderPickerShowAddTile: true, // v13 — false khi nơi gọi không cho tạo folder mới giữa chừng
    _folderPickerEmptyMsg: '',      // v13 — câu hiển thị khi danh sách rỗng (rỗng = dùng grid trống như cũ)
    _folderPickerFolders: [], // danh sách folder ĐANG hiển thị trong grid — cache RAM, chỉ dùng lúc Drawer đang mở
    _folderPickerEditingId: null, // folderId đang ở chế độ sửa tên (null = không có)
    _folderPickerOnPick: null, // callback(folderId) — set bởi entry method (openAddToFolderPickerForSongMenu/openAddToFolderPicker), gọi khi user CHỌN xong 1 folder

    /** Mở Drawer lần đầu — đọc danh sách folder, vẽ grid, wire sự kiện. */
    async _openFolderPickerDrawer(onPick, options) {
        // SỬA (v13) — thêm `options` TUỲ CHỌN (không truyền -> hành vi CŨ y nguyên cho 2 luồng
        // "Thêm vào thư mục" của Playlist):
        //   `folders`     — danh sách ĐÃ LỌC SẴN do nơi gọi chuẩn bị (Rule 3b: lọc là chuẩn bị dữ
        //                   liệu, thuộc Workflow gọi; hàm này không tự biết tiêu chí của từng miền).
        //   `showAddTile` — false để bỏ tile "Tạo folder mới" (Visual Background: folder vừa tạo
        //                   luôn rỗng nên không bao giờ là nguồn hợp lệ, bày ra chỉ gây hiểu nhầm).
        //   `emptyMsg`    — câu hiển thị khi danh sách rỗng, thay vì grid trống trơn.
        //   `onClose`     — MỚI (phản hồi Giang — sửa lỗ hổng "Cancel picker thư mục Visual
        //                   Background không tự quay lại") — hàm gọi THAY VÌ `closeFully()` khi
        //                   đóng picker (dù bấm X HAY vừa CHỌN xong 1 tile — cả 2 đường đều đi qua
        //                   `closeFolderPicker()` bên dưới) — dùng bởi nơi gọi ĐANG SỐNG CHUNG
        //                   Generic Drawer với picker này (Visual Background, xem
        //                   event/workflow/visual-bg.js::openListFolderPicker()) để tự mở lại
        //                   đúng màn của mình thay vì đóng trắng cả Setting. KHÔNG truyền -> giữ
        //                   NGUYÊN hành vi cũ (đóng hẳn) cho 2 luồng Playlist tự thân.
        const opts = options || {};
        this._folderPickerFolders = opts.folders || await listFolders(); // core có sẵn, CÓ return, DÙNG ngay dưới
        this._folderPickerShowAddTile = opts.showAddTile !== false;
        this._folderPickerEmptyMsg = opts.emptyMsg || '';
        this._folderPickerEditingId = null;
        this._folderPickerOnPick = onPick;
        this._folderPickerOnClose = opts.onClose || null;
        this._renderFolderPickerGrid(true);
    },

    /** Vẽ lại grid (mở lần đầu HOẶC sau khi thêm/sửa tên 1 folder) — `isFirstOpen` quyết định
     * open vs update Generic Drawer (core/generic-drawer.js — 2 hàm khác nhau tuỳ Drawer đang đóng
     * hay đã mở sẵn, xem docstring ở đó). */
    _renderFolderPickerGrid(isFirstOpen) {
        const itemsHtml = renderItemList(null, this._folderPickerFolders, itemTemplateFolderTile, { editingFolderId: this._folderPickerEditingId }); // components/items.js
        // SỬA (14/07/2026, Giang yêu cầu) — justify-center -> justify-start (căn trái thay vì căn
        // giữa cả cụm khi hàng cuối chưa đầy).
        const addTileHtml = this._folderPickerShowAddTile ? buildAddFolderTileHtml() : ''; // components/items.js
        const bodyHtml = (this._folderPickerFolders.length === 0 && !this._folderPickerShowAddTile && this._folderPickerEmptyMsg)
            ? `<p class="text-sm text-slate-500 text-center py-10 px-6">${this._folderPickerEmptyMsg}</p>`
            : `<div class="flex flex-wrap justify-start gap-4 p-5">${itemsHtml}${addTileHtml}</div>`; // components/items.js
        const config = {
            // SỬA (14/07/2026, Giang báo — "layout grid thừa khoảng trống") — TRƯỚC ĐÂY height cố
            // định '60vh' bất kể có bao nhiêu folder, để lại khoảng trống lớn phía dưới khi chỉ có
            // vài tile. Giờ height:'auto' (panel tự co theo ĐÚNG nội dung thật) + maxHeight:'60vh'
            // (không bao giờ vượt quá, nội dung dài tự cuộn nhờ bodyClass overflow-y-auto có sẵn) —
            // xem docstring core/generic-drawer.js::openGenericDrawer(). Test thật bằng Chromium
            // xác nhận: ít item -> panel co nhỏ đúng theo nội dung; nhiều item -> kẹp đúng ở maxHeight.
            height: 'auto',
            maxHeight: '60vh',
            // SỬA (14/07/2026) — BỎ `zIndex: 40` cứng (thấp hơn #app-stack z-[60], gây Drawer bị đè
            // khi mở từ Playlist) — rơi về GENERIC_DRAWER_DEFAULT_Z_INDEX (128) mặc định, xem
            // docstring core/generic-drawer.js.
            headerHtml: this._buildFolderPickerHeaderHtml(),
            bodyHtml,
            bodyClass: 'overflow-y-auto',
        };
        if (isFirstOpen) openGenericDrawer(config); // core/generic-drawer.js
        else updateGenericDrawer(config); // core/generic-drawer.js
        wireFolderPickerDrawerEvents('playlist', 'playlist.folderPicker'); // core/file-manager/folder-picker-ui.js — hàm GỘP (v13 Batch B), msg.type KHÔNG đổi
    },

    _buildFolderPickerHeaderHtml() {
        return `
            <div class="flex justify-between items-center px-5 pb-3 border-b border-slate-200">
                <h3 class="text-base font-bold text-slate-900">${t('fileManager.folderPicker.title')}</h3>
                <button id="btn-generic-drawer-close" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500" title="${t('common.close')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        `;
    },

    /** msg.type = 'playlist.folderPicker.tile.click' — user CHỌN xong 1 folder (có sẵn hoặc vừa
     * tạo, không quan trọng — mọi tile đều "chọn được" như nhau). */
    async pickFolderInPicker(folderId) {
        const onPick = this._folderPickerOnPick;
        this.closeFolderPicker();
        if (onPick) await onPick(folderId);
    },

    /** msg.type = 'playlist.folderPicker.close.click'. SỬA (phản hồi Giang — sửa lỗ hổng picker
     * thư mục Visual Background) — ưu tiên `onClose` nếu nơi mở picker có truyền (xem docstring
     * `_openFolderPickerDrawer()`), mặc định vẫn đóng hẳn như cũ. */
    closeFolderPicker() {
        this._folderPickerOnPick = null;
        const onClose = this._folderPickerOnClose;
        this._folderPickerOnClose = null;
        if (onClose) onClose(); else workflowGenericDrawerHelpers.closeFully(); // event/workflow/generic-drawer-helpers.js
    },

    /** msg.type = 'playlist.folderPicker.addTile.click' — tạo NGAY 1 folder tên tự động (không
     * trùng tên bất kỳ folder CÙNG TYPE nào đang có trong grid), thêm vào cache RAM, vẽ lại grid
     * với tile MỚI ở chế độ sửa tên (focus sẵn, xem _wireFolderPickerEvents()). KHÔNG tự "chọn"
     * folder này luôn — user vẫn cần tap vào tile (sau khi sửa tên xong) như MỌI tile khác để hoàn
     * tất việc chọn, giữ đúng 1 mô hình tương tác duy nhất cho toàn bộ grid (tạo ≠ chọn, tách 2
     * hành động RÕ RÀNG).
     * CHỐT Giang (hợp nhất Photo vào Playlist) — "Playlist source nào -> tạo folder và gán luôn
     * type cho nó": type gán NGAY = `activeMediaSource` hiện tại (đọc thẳng, không cần biết context
     * nào gọi tới — hàm này CHỈ reachable từ 2 luồng Add-to-Folder gốc của Playlist, picker Visual
     * Background dùng `showAddTile: false` nên tile "+" không hề xuất hiện ở đó, xem
     * event/workflow/visual-bg.js::openListFolderPicker()).
     */
    async createFolderInPicker() {
        const mediaType = appState.get('activeMediaSource');
        const defaultName = this._computeDefaultFolderName();
        // SỬA (14/07/2026, tự audit lại Rule 3) — createFolder() đổi chữ ký, không còn tự
        // resolveFolderId() nội bộ, xem docstring createFolder() (core/file-manager/folder.js).
        const folderId = await resolveFolderId(defaultName, mediaType); // core
        const result = await createFolder(folderId, defaultName, mediaType); // core có sẵn (core/file-manager/folder.js)
        if (result.status !== 'ok') return; // hiếm — trùng tên dù đã tự tính tên không trùng (race hiếm gặp), im lặng bỏ qua
        this._folderPickerFolders.push({ id: result.folderId, name: defaultName, type: mediaType });
        this._folderPickerEditingId = result.folderId;
        this._renderFolderPickerGrid(false);
    },

    /** Tính tên mặc định KHÔNG trùng bất kỳ folder nào đang hiển thị trong grid — "Thư mục mới",
     * "Thư mục mới 2", "Thư mục mới 3"... */
    _computeDefaultFolderName() {
        const base = t('fileManager.folderPicker.defaultNewFolderName');
        const existingNames = new Set(this._folderPickerFolders.map((f) => f.name));
        if (!existingNames.has(base)) return base;
        let n = 2;
        while (existingNames.has(`${base} ${n}`)) n++;
        return `${base} ${n}`;
    },

    /** msg.type = 'playlist.folderPicker.rename.commit' — blur/Enter của ô sửa tên. Tên rỗng hoặc
     * giữ nguyên tên tự động -> bỏ qua (KHÔNG gọi renameFolder() vô ích), chỉ thoát chế độ sửa. */
    async commitFolderPickerRename(folderId, name) {
        this._folderPickerEditingId = null;
        const trimmed = (name || '').trim();
        const folder = this._folderPickerFolders.find((f) => f.id === folderId);
        if (trimmed && folder && trimmed !== folder.name) {
            const result = await renameFolder(folderId, trimmed); // core có sẵn
            if (result.status === 'ok') folder.name = trimmed;
            // 'duplicateName' (hiếm — user tự gõ trùng tên folder khác) -> im lặng giữ tên cũ,
            // không alertModal giữa lúc đang thao tác nhanh (khác hẳn form Sửa tên đầy đủ ở
            // Settings -> File Manager -> Song, nơi đó VẪN báo lỗi rõ ràng).
        }
        this._renderFolderPickerGrid(false);
    },

    /**
     * "Xoá hàng loạt" — ĐÚNG luồng bác chốt (câu 4 mục 6 plan): nếu bài đang phát nằm trong tập bị
     * xoá, ép DỪNG phát + về UI Playlist NGAY (không hỏi/không chặn, khác hẳn window.removeSong
     * đơn lẻ vốn chặn xoá nếu đang thực sự phát) -> bật shield -> xoá -> tắt shield -> modal "đã xoá".
     * SỬA (ver12 "Song/Video Unification", Batch 6, mục 6d, phản hồi Giang) — media-aware: chọn
     * nhiều CHỈ xảy ra trong ĐÚNG 1 nguồn tại 1 thời điểm (Playlist chỉ browse 1 nguồn) nên đọc
     * `activeMediaSource` MỘT LẦN cho CẢ LÔ, không cần kiểm tra từng key. TRƯỚC ĐÂY hardcode
     * getSongRecord/deleteSongRecord — Video sẽ ÂM THẦM không xoá được gì (record nằm store khác).
     */
    async deleteSelectedSongs() {
        const keys = Array.from(appState.get('selectedSongKeys'));
        if (keys.length === 0) return;
        const mediaType = appState.get('activeMediaSource'); // 'song'|'video'|'photo'
        const isVideo = mediaType === 'video';

        const currentKey = appState.get('currentKey');
        const wasPlayingSelected = currentKey != null && keys.includes(currentKey);

        if (wasPlayingSelected) {
            if (isVideo) {
                // Dừng player Video + dọn RAM — dùng ĐÚNG hàm có sẵn (event/workflow/video-
                // player.js), tránh tự inline lại logic cần _objectUrl riêng của Workflow đó.
                if (appState.get('isVideoPlayerMode')) await workflowVideoPlayer.exitVideoPlayerMode();
                appState.set('currentKey', null);
                playerTitle.textContent = t('bottomPlayer.noSongSelected'); playerArtist.textContent = '---';
                forceBackToPlaylistUI();
            } else {
                // Dừng player + dọn RAM — GIỐNG HỆT khối tương ứng trong window.removeSong() (đơn lẻ)/
                // clearAllStoredData() (storage-manager.js) khi currentKey biến mất, để không còn
                // currentKey "ma". Khác 2 nơi đó: KHÔNG kiểm tra audioPlayer.paused — ép dừng vô điều
                // kiện, đúng ý bác (không chặn/không hỏi, chỉ dừng rồi xoá).
                if (appState.get('currentObjectURL')) { URL.revokeObjectURL(appState.get('currentObjectURL')); appState.set('currentObjectURL', null); }
                if (appState.get('currentCoverObjectURL')) { URL.revokeObjectURL(appState.get('currentCoverObjectURL')); appState.set('currentCoverObjectURL', null); }
                audioPlayer.pause(); audioPlayer.src = ''; appState.set('currentKey', null);
                playerTitle.textContent = t('bottomPlayer.noSongSelected'); playerArtist.textContent = '---';
                if (typeof killAllAutoSwitchVisualTasks === 'function') killAllAutoSwitchVisualTasks();
                forceBackToPlaylistUI(); // "về playui" — ép UI về màn Playlist ngay, TRƯỚC khi hiện shield
                setVisualizerActiveFalse(); // MỚI (08/07/2026, HOTFIX 10) — forceBackToPlaylistUI() không còn tự set nữa
            }
        }

        let deletedCount = 0;
        await withLoadingShield(t('common.loading.deleting'), async () => {
            // Vòng lặp xoá ĐẶT THẲNG ở đây (workflow), KHÔNG bọc qua 1 lớp "core" giả — mỗi bước
            // (đọc record, cascade folder, xoá record, xoá stat) là 1 hàm core void nối tiếp nhau,
            // đúng vai trò workflow (Rule 3: core không được làm việc này, workflow thì được).
            // XOÁ (v14) — `splitVisualBgProtectedKeys()`/chặn video đang làm Visual Background:
            // nguồn giờ là 1 mảng key riêng của workflowVisualBg (đã copy tách khỏi Playlist), xoá
            // video gốc ở đây không cần biết gì tới nó — lần advance()/apply() kế tiếp bên đó tự
            // phát hiện record mất + tự chữa lành.
            // MỞ RỘNG (hợp nhất Photo vào Playlist) — thêm nhánh 'photo' (store `images`, hàm xoá
            // riêng deleteImage() — trước đây thiếu nhánh này sẽ khiến deleteSongRecord() gọi nhầm
            // lên key không tồn tại trong store `songs`, âm thầm KHÔNG xoá được gì).
            const getRecordFn = isVideo ? getVideoRecord : mediaType === 'photo' ? getImageRecord : getSongRecord; // service/db.js
            const deletedKeys = [];
            for (const key of keys) {
                const record = await getRecordFn(key);
                if (!record) continue; // guard: đã bị xoá từ trước (hiếm, race) — bỏ qua, không chặn cả lô
                await removeSongFromAllFolders(record); // core có sẵn (core/file-manager/folder.js) — nhận record THÔ qua tham số, generic cho cả Song/Video/Photo
                if (isVideo) await deleteVideo(key); // core/file-manager/video.js
                else if (mediaType === 'photo') await deleteImage(key); // core/file-manager/image.js
                else await deleteSongRecord(key); // core CRUD thô (service/db.js)
                removeSongStats(key); // core có sẵn (core/listen-stats.js)
                deletedKeys.push(key);
            }
            deletedCount = deletedKeys.length;

            // Đồng bộ appState (core THUẦN, xem core/playlist/bulk-actions.js) rồi vẽ lại — đọc
            // playlistOrder/displayOrder hiện tại TRƯỚC khi gọi (Rule 2: core không tự đọc).
            removeKeysFromDisplayState(deletedKeys, appState.get('playlistOrder'), appState.get('displayOrder'));
            updateShuffleArray(); // core có sẵn (core/playlist/order.js)
            recomputeRenderOrder(); // core có sẵn (core/playlist/order.js)
            renderPlaylistDiff(); // core có sẵn (core/playlist/render.js)
            updateEmptyState(); // core có sẵn (core/playlist/render.js)
        });

        this._exitSelectionMode();
        // Shield đã đóng HẲN tới đây — an toàn để hiện modal.
        await alertModal(tFormat('playlistView.selection.deleteSuccess', { count: deletedCount }));
    },

    // ===================== Ver 12 "Song/Video Unification" — Batch 1 (mục 1-2) =====================
    // Ứng với select "Nguồn" ở Settings → Playlist đổi giá trị (event/router/playlist.js dùng
    // VirtualMachineState chọn ĐÚNG 1 trong 2 method dưới đây, loại trừ nhau). CHỈ browse — CHƯA
    // đụng gì tới dispatch phát nhạc (Batch 2, xem plan-v12-song-video-unification.md mục 3).

    /**
     * Đổi Nguồn sang Video — nạp lại TOÀN BỘ playlistCache/playlistOrder từ store `videos` qua
     * Adapter (buildVideoPlaylistCache(), core/playlist/loader.js), rồi vẽ lại UI — TÁI DÙNG
     * NGUYÊN các hàm core đã phục vụ Song (recomputeDisplayOrder/RenderOrder, renderPlaylistDiff,
     * updateEmptyState, updateShuffleArray), không viết lại gì.
     * [SỬA — Giang chốt "dùng chung hết" 4 kiểu sort (az/za/newest/oldest) cho CẢ 2 nguồn] KHÔNG
     * còn reset `displaySortMode`/dựng lại option list nữa — sort mode giờ là 1 lựa chọn CHUNG,
     * độc lập với Nguồn, giữ nguyên qua lại giữa Song/Video (renderSongSortModeOptions()/
     * renderVideoSortModeOptions() ĐÃ XOÁ, core/playlist/order.js).
     */
    async switchToVideoSource() {
        appState.set('activeMediaSource', 'video');
        console.log(`writer: "switchToVideoSource", page: "activeMediaSource", content: "video"`);

        // SỬA (phản hồi Giang, mục 3 "loading shield không full view toàn app") — TRƯỚC ĐÂY dùng
        // showPlaylistLoading()/hidePlaylistLoading() (core/playlist/render.js): lớp phủ CHỈ nằm
        // trong `#playlist-loading-list` (absolute inset-0 CỦA vùng cuộn list, z-10) — không che
        // header/toàn app. Đổi sang withLoadingShield() (core/loading-shield-util.js) — `#loading-
        // shield` (fixed inset-0, z-[200]) che ĐÚNG toàn app, ĐỒNG THỜI finally{} của nó tự đảm
        // bảo tắt shield dù `fn()` bên trong ném lỗi (trước đây 1 lỗi giữa chừng sẽ để
        // showPlaylistLoading() treo vĩnh viễn vì hidePlaylistLoading() không bao giờ được gọi tới).
        await withLoadingShield(t('playlistView.loading.generic'), async () => {
            const videoRecords = await listVideos((done, total) => { // core/file-manager/video.js — MỚI, onProgress cho x/total
                loadingText.textContent = tFormat('playlistView.loading.withCountVideo', { done, total });
            });
            const keys = buildVideoPlaylistCache(videoRecords); // core/playlist/loader.js (MỚI, Batch 1), CÓ return, DÙNG ngay dưới
            // MỚI (mục 1d, Playlist Filter) — áp filter (nếu có) NGAY SAU khi playlistOrder vừa được
            // tính lại theo Nguồn Video, TRƯỚC updateShuffleArray()/recompute*Order() — xem docstring
            // đầu core/playlist/filter.js (đúng vị trí "Scope xong, Sort chưa chạy").
            const filteredKeys = applyPlaylistFilter(keys, appState.get('playlistCache'), appState.get('mediaStatsMap'), appState.get('playlistFilterConfig').video);
            appState.set('playlistOrder', filteredKeys);
            console.log(`writer: "switchToVideoSource", page: "playlistOrder", content: "${filteredKeys.length}/${keys.length} video (đã áp Filter)"`);

            updateShuffleArray();      // core có sẵn (core/playlist/order.js)
            recomputeDisplayOrder();   // core có sẵn (core/playlist/order.js)
            recomputeRenderOrder();    // core có sẵn (core/playlist/order.js)
            renderPlaylistDiff();      // core có sẵn (core/playlist/render.js)
            resetPlaylistScrollTop();  // core (MỚI, 29/07/2026, phản hồi Giang mục 2) — danh sách vừa đổi hẳn Nguồn, scrollTop cũ vô nghĩa -> về 0 tức thì
            updateEmptyState();        // core có sẵn (core/playlist/render.js)
        });
        // MỚI (phản hồi Giang, mục "ngôn ngữ theo ngữ cảnh Song/Video") — placeholder ô tìm kiếm
        // đổi theo Nguồn (Song có artist/album để tìm, Video thì không).
        if (playlistSearchInput) playlistSearchInput.placeholder = t('playlistView.search.placeholderVideo');
        // SỬA (phản hồi Giang — "1 khung, không nhân bản") — nút upload giờ DÙNG CHUNG cho cả 3
        // Nguồn (LUÔN hiện, không còn toggle 'hidden' theo Nguồn) — chỉ còn cần đổi `accept` của 2
        // input bên trong menu, xem _applyUploadInputAccept().
        this._applyUploadInputAccept('video');
        // MỚI (hợp nhất Photo vào Playlist) — SỬA (Giang yêu cầu — Photo tích hợp duration như
        // Song/Video, "bỏ ẩn cho 2 nút phát và shuffle") — TRƯỚC ĐÂY comment này nói "chỉ Photo mới
        // ẩn" (đúng lúc đó) — giờ CẢ 3 Nguồn đều LUÔN hiện 2 nút này (Photo đã có Play/Next-Prev/
        // Shuffle thật, không còn ẩn nữa — xem switchToPhotoSource()), dòng dưới vẫn giữ (vô hại,
        // luôn đúng) chỉ sửa lại comment cho khớp thực tế.
        if (btnPlaylistEmptyPlay) btnPlaylistEmptyPlay.classList.remove('hidden');
        if (btnPlaylistEmptyShuffle) btnPlaylistEmptyShuffle.classList.remove('hidden');
        await this._persistPlaylistConfig(); // MỚI (phản hồi Giang, mục 5) — lưu bền Nguồn để không mất sau reload
    },

    /**
     * Đổi Nguồn về lại Song — TÁI DÙNG NGUYÊN `scanValidSongsFromDB()` (core/playlist/loader.js,
     * hàm Song hiện có, KHÔNG sửa gì — nguyên tắc riêng của plan), rồi vẽ lại UI y hệt
     * switchToVideoSource(). Cùng lý do KHÔNG reset displaySortMode — xem docstring hàm đó.
     */
    async switchToSongSource() {
        // XOÁ (08/08/2026, phản hồi Giang — "đổi tab chỉ mở khoá panel, không có nghĩa video đang
        // phát bị VBG chèn ngay") — dòng `exitVideoPlayerMode()` từng đặt ở đây (thêm để né
        // event/block.js::'visualBg.openPanel.click' bị kẹt block) SAI: ép dừng video THẬT chỉ vì
        // đổi tab xem Playlist, đúng lúc video còn đang phát — video phải được phát tiếp tới khi tự
        // hết hoặc Next/Prev/chọn Song khác (đường thoát ĐÚNG đã có sẵn ở `workflowPlayer.
        // playMedia()`, event/workflow/player.js [SỬA — plan-playmedia-reorg.md, thay
        // window.playSong() cũ], dùng CHUNG cho next/prev). Panel giờ tự mở khoá
        // qua `activeMediaSource` (event/block.js), không cần ép thoát mode ở đây nữa.
        appState.set('activeMediaSource', 'song');
        console.log(`writer: "switchToSongSource", page: "activeMediaSource", content: "song"`);

        // SỬA (phản hồi Giang, mục 3 "loading shield không full view toàn app") — CÙNG LÝ DO/CÙNG
        // CÁCH SỬA switchToVideoSource() ngay trên — đổi showPlaylistLoading() (chỉ che vùng list)
        // sang withLoadingShield() (che toàn app, tự tắt qua finally{} dù fn() bên trong lỗi).
        await withLoadingShield(t('playlistView.loading.generic'), async () => {
            const keys = await scanValidSongsFromDB((done, total) => { // core có sẵn (core/playlist/loader.js, Song, KHÔNG đụng) — đã có onProgress từ trước, giờ nối vào shield toàn app
                loadingText.textContent = tFormat('playlistView.loading.withCount', { done, total });
            });
            // MỚI (mục 1d, Playlist Filter) — CÙNG LÝ DO switchToVideoSource() ngay trên.
            const filteredKeys = applyPlaylistFilter(keys, appState.get('playlistCache'), appState.get('mediaStatsMap'), appState.get('playlistFilterConfig').song);
            appState.set('playlistOrder', filteredKeys);
            console.log(`writer: "switchToSongSource", page: "playlistOrder", content: "${filteredKeys.length}/${keys.length} bài hát (đã áp Filter)"`);

            updateShuffleArray();
            recomputeDisplayOrder();
            recomputeRenderOrder();
            renderPlaylistDiff();
            resetPlaylistScrollTop();  // core (MỚI, 29/07/2026, phản hồi Giang mục 2) — cùng lý do switchToVideoSource(), scrollTop cũ vô nghĩa với danh sách vừa đổi hẳn Nguồn
            updateEmptyState();
        });
        if (playlistSearchInput) playlistSearchInput.placeholder = t('playlistView.search.placeholder');
        // SỬA (phản hồi Giang — "1 khung, không nhân bản") — cùng lý do switchToVideoSource().
        this._applyUploadInputAccept('song');
        // MỚI (hợp nhất Photo vào Playlist) — cùng lý do switchToVideoSource() ngay trên.
        if (btnPlaylistEmptyPlay) btnPlaylistEmptyPlay.classList.remove('hidden');
        if (btnPlaylistEmptyShuffle) btnPlaylistEmptyShuffle.classList.remove('hidden');
        await this._persistPlaylistConfig(); // MỚI (phản hồi Giang, mục 5) — lưu bền Nguồn để không mất sau reload
    },

    /**
     * Đổi Nguồn sang Photo — MỚI (hợp nhất Photo vào Playlist). Nạp lại TOÀN BỘ playlistCache/
     * playlistOrder từ store `images` qua Adapter (buildPhotoPlaylistCache(), core/playlist/
     * loader.js), rồi vẽ lại UI — TÁI DÙNG NGUYÊN 100% các hàm core đã phục vụ Song/Video
     * (recomputeDisplayOrder/RenderOrder, updateEmptyState, updateShuffleArray, renderPlaylistDiff()
     * -> buildSongNode()). CHỐT Giang: dùng HẲN UI Playlist Song/Video cho Photo, KHÔNG view riêng —
     * `renderPlaylistDiff()` KHÔNG rẽ nhánh gì cả, chạy Y HỆT Song/Video. Khác biệt DUY NHẤT nằm
     * trong shape dữ liệu Adapter tạo ra (`cover`=thumbBlob, `width`/`height` thay `duration` —
     * buildSongNode() tự đọc `cached.mediaType==='photo'` để hiện "WxH" thay vì thời lượng).
     * Không toggle #btn-upload-audio/#btn-upload-video (Photo chưa có nút upload riêng trong
     * Playlist — vẫn upload qua File Manager -> Photo như cũ) — ẩn CẢ 2 nút khi ở Nguồn này.
     */
    async switchToPhotoSource() {
        appState.set('activeMediaSource', 'photo');
        console.log(`writer: "switchToPhotoSource", page: "activeMediaSource", content: "photo"`);

        // SỬA (phản hồi Giang, mục 3 "loading shield không full view toàn app") — CÙNG LÝ DO/CÙNG
        // CÁCH SỬA switchToVideoSource()/switchToSongSource() ngay trên — đổi showPlaylistLoading()
        // (chỉ che vùng list) sang withLoadingShield() (che toàn app). Lợi ích PHỤ (mục 1, xem fix
        // loadPersistedFilterConfigOnBoot() cùng đợt): finally{} của withLoadingShield() tự tắt
        // shield dù fn() bên trong ném lỗi — trước đây showPlaylistLoading()/hidePlaylistLoading()
        // KHÔNG có cơ chế này, nên khi applyPlaylistFilter() ném lỗi giữa chừng (playlistFilterConfig.
        // photo undefined do dữ liệu lưu bền cũ thiếu key 'photo'), hidePlaylistLoading() không bao
        // giờ chạy tới -> treo loading vĩnh viễn, đúng hiện tượng Giang báo ở mục 1.
        await withLoadingShield(t('playlistView.loading.generic'), async () => {
            const imageRecords = await listImages((done, total) => { // core/file-manager/image.js — MỚI, onProgress cho x/total
                loadingText.textContent = tFormat('playlistView.loading.withCountPhoto', { done, total });
            });
            const keys = buildPhotoPlaylistCache(imageRecords); // core/playlist/loader.js (MỚI), CÓ return, DÙNG ngay dưới
            const filteredKeys = applyPlaylistFilter(keys, appState.get('playlistCache'), appState.get('mediaStatsMap'), appState.get('playlistFilterConfig').photo);
            appState.set('playlistOrder', filteredKeys);
            console.log(`writer: "switchToPhotoSource", page: "playlistOrder", content: "${filteredKeys.length}/${keys.length} ảnh (đã áp Filter)"`);

            updateShuffleArray();      // core có sẵn (core/playlist/order.js) — vô hại dù Photo chưa dùng Shuffle (CHỐT Giang: player controls ẩn hẳn ở Nguồn này, tạm hoãn)
            recomputeDisplayOrder();   // core có sẵn (core/playlist/order.js)
            recomputeRenderOrder();    // core có sẵn (core/playlist/order.js) — áp Search box + Sort lên trên Filter
            renderPlaylistDiff();      // core có sẵn (core/playlist/render.js) — CHẠY Y HỆT Song/Video, KHÔNG rẽ nhánh
            resetPlaylistScrollTop();  // core — danh sách vừa đổi hẳn Nguồn, scrollTop cũ vô nghĩa -> về 0 tức thì
            updateEmptyState();        // core có sẵn (core/playlist/render.js)
        });
        if (playlistSearchInput) playlistSearchInput.placeholder = t('playlistView.search.placeholderPhoto');
        // SỬA (phản hồi Giang — "1 khung, không nhân bản") — nút upload giờ DÙNG CHUNG cho cả 3
        // Nguồn (kể cả Photo — trước đây Photo hoàn toàn KHÔNG có upload trong Playlist, giờ có
        // qua chính khung này, xem uploadPhotos() bên dưới) — chỉ cần đổi `accept`.
        this._applyUploadInputAccept('photo');
        // SỬA (Giang yêu cầu — Photo tích hợp duration như Song/Video, "bỏ ẩn cho 2 nút phát và
        // shuffle") — TRƯỚC ĐÂY ẩn hẳn hàng "Phát/Trộn bài" vì Photo chưa có khái niệm "hàng đợi
        // phát" (comment cũ: "tạm hoãn, sẽ tính lại khi Slideshow áp dụng toàn app") — giờ Photo ĐÃ
        // có Play/Next-Prev/Shuffle thật (playMedia() nhánh 'photo', event/workflow/photo-player.js)
        // nên 2 nút này giờ hoạt động Y HỆT Song/Video — CHỦ ĐỘNG gỡ 'hidden' (không chỉ bỏ dòng
        // add cũ) để phòng trường hợp còn sót 'hidden' từ 1 lần switchToPhotoSource() TRƯỚC bản sửa
        // này (đã lưu bền qua reload) — cùng cách switchToVideoSource()/switchToSongSource() làm.
        if (btnPlaylistEmptyPlay) btnPlaylistEmptyPlay.classList.remove('hidden');
        if (btnPlaylistEmptyShuffle) btnPlaylistEmptyShuffle.classList.remove('hidden');
        await this._persistPlaylistConfig(); // MỚI (phản hồi Giang, mục 5) — lưu bền Nguồn để không mất sau reload
    },

    /**
     * "Sắp xếp" đổi giá trị (Settings → Playlist) — MỚI, tách khỏi router (phản hồi Giang, mục 5
     * "Đồng bộ lại config Playlist Settings"): trước đây router gọi thẳng `setDisplaySortMode()`
     * (đúng "1 hàm core" theo quy ước router này) — giờ cần thêm bước lưu bền
     * (`_persistPlaylistConfig()`), thành ≥2 bước -> đúng quy ước router "giao cho Workflow" (xem
     * docstring đầu event/router/playlist.js).
     */
    async changeSortMode(mode) {
        setDisplaySortMode(mode); // core có sẵn (core/playlist/order.js)
        await this._persistPlaylistConfig();
    },

    /** Trục (2) — field thống kê (mục 1b/1c, panel "Sắp xếp", dropdown (1)) — SỬA (mục 3) tách
     * khỏi hướng. CÙNG LÝ DO tách khỏi router như changeSortMode() ngay trên. */
    async changeStatSortField(field) {
        setDisplayStatSortField(field); // core có sẵn (core/playlist/order.js)
        // MỚI (mục 3) — hiện/ẩn dropdown (2) "hướng" NGAY khi đổi field — CHỈ có ý nghĩa khi field
        // khác 'none'. SỬA (đợt tái cấu trúc bottom nav App Panel) — panel Sắp xếp giờ sống trong
        // `genericDrawerBody` (core/generic-drawer.js), KHÔNG còn qua `peekTopSettingsPanel()`
        // (đó là stack CŨ, nay thuộc về Photo — xem event/workflow/app-settings.js).
        {
            const directionRow = genericDrawerBody.querySelector('[data-sort-direction-row]');
            if (directionRow) directionRow.classList.toggle('hidden', field === 'none');
        }
        await this._persistPlaylistConfig();
    },

    /** Trục (2) — hướng (mục 3, phản hồi Giang, dropdown (2), CHỈ hiện khi field khác 'none'). */
    async changeStatSortDirection(direction) {
        setDisplayStatSortDirection(direction); // core có sẵn (core/playlist/order.js)
        await this._persistPlaylistConfig();
    },

    /**
     * "Kiểu xem" đổi giá trị (Settings → Playlist) — CÙNG LÝ DO tách khỏi router như changeSortMode() ngay trên.
     * SỬA (05/08/2026, Rule 3a, phản hồi Giang "xử lý triệt để") — `setPlaylistViewMode()` (core/
     * playlist/main.js) KHÔNG còn tự gọi `renderPlaylistFull()` nội bộ (core gọi core, cấm) — 2
     * lời gọi core độc lập này giờ đứng CẠNH NHAU ở đây, đúng vai Workflow điều phối.
     */
    async changeViewMode(mode) {
        setPlaylistViewMode(mode); // core (core/playlist/main.js) — chỉ ghi isGridView + className
        renderPlaylistFull(); // core (core/playlist/render.js) — layout grid/list đổi cấu trúc node hoàn toàn, không diff được
        await this._persistPlaylistConfig();
    },

    /**
     * Ghi bền 3 lựa chọn "Playlist Settings" (Nguồn/Sắp xếp/Kiểu xem) vào `appConfigPlaylist` +
     * `meta.playlistConfig` (IndexedDB) — CÙNG KHUÔN domain 'slideshow' (event/workflow/
     * slideshow.js, setMeta trực tiếp mỗi lần đổi, KHÔNG debounce như domain 'viz' vì tần suất đổi
     * thấp). CHỦ Ý KHÔNG gồm 3 field "Giải phóng bộ nhớ" (mediaScope/downloadEnabled/deleteEnabled,
     * event/router/file-manager-song.js) — xem giải thích đầy đủ ở core/config.js::
     * DEFAULT_PLAYLIST_CONFIG (lưu bền sẽ vô hiệu hoá 1 lớp an toàn đã có chủ đích cho hành động
     * phá huỷ dữ liệu — router đó CHỦ ĐỘNG reset 3 field này mỗi lần mở panel).
     */
    async _persistPlaylistConfig() {
        appConfigPlaylist.setAll({
            activeMediaSource: appState.get('activeMediaSource'),
            displaySortMode: appState.get('displaySortMode'),
            // SỬA (mục 3) — displayStatSortMode (gộp) tách thành 2 field riêng.
            displayStatSortField: appState.get('displayStatSortField'),
            displayStatSortDirection: appState.get('displayStatSortDirection'),
            isGridView: appState.get('isGridView'),
        });
        await setMeta('playlistConfig', appConfigPlaylist.getAll());
    },

    /**
     * Khôi phục 3 lựa chọn "Playlist Settings" đã lưu bền LÚC BOOT — gọi từ event/workflow/
     * app-boot.js, TRƯỚC bước quyết định nạp playlistCache theo nguồn nào (LƯU Ý THỨ TỰ, phản hồi
     * Giang: phải biết `activeMediaSource` đã lưu TRƯỚC khi quyết định gọi initPlaylistFromDB()
     * (Song) hay tương đương switchToVideoSource() (Video) — xem app-boot.js). Đồng bộ lại UI 4
     * <select>/badge qua `this.syncPlaylistSettingsUI()` (đã có sẵn, chỉ gán lại theo appState) vì
     * lần gọi ĐẦU của nó (cuối core/playlist/main.js, lúc nạp script) chạy TRƯỚC khi hàm này kịp
     * đọc xong IndexedDB (bất đồng bộ) — không gọi lại thì UI hiện sai giá trị dù state runtime đã đúng.
     */
    async loadPersistedPlaylistConfigOnBoot() {
        const saved = await getMeta('playlistConfig');
        if (saved && typeof saved === 'object') {
            appConfigPlaylist.mutateAll((cfg) => Object.assign(cfg, saved));
        }
        const cfg = appConfigPlaylist.getAll();
        // SỬA (hợp nhất Photo vào Playlist) — ternary nhị phân cũ (bất kỳ giá trị nào khác 'video'
        // đều rơi về 'song') sẽ ÂM THẦM ép 'photo' đã lưu bền quay lại 'song' mỗi lần mở app — THAY
        // bằng danh sách hợp lệ tường minh, giá trị lạ/thiếu mới rơi về 'song' (mặc định an toàn).
        const validSources = ['song', 'video', 'photo'];
        appState.set('activeMediaSource', validSources.includes(cfg.activeMediaSource) ? cfg.activeMediaSource : 'song');
        appState.set('displaySortMode', cfg.displaySortMode || 'az');
        appState.set('displayStatSortField', cfg.displayStatSortField || 'none'); // SỬA (mục 3)
        appState.set('displayStatSortDirection', cfg.displayStatSortDirection || 'desc');
        appState.set('isGridView', !!cfg.isGridView);
        console.log(`writer: "loadPersistedPlaylistConfigOnBoot", page: "activeMediaSource/displaySortMode/isGridView", content: "khôi phục từ meta.playlistConfig"`);
        const restoredSource = appState.get('activeMediaSource');
        if (playlistSearchInput) playlistSearchInput.placeholder = t(restoredSource === 'video' ? 'playlistView.search.placeholderVideo' : restoredSource === 'photo' ? 'playlistView.search.placeholderPhoto' : 'playlistView.search.placeholder');
        // SỬA (phản hồi Giang — "1 khung, không nhân bản") — thay cho việc toggle 'hidden' giữa
        // btnUploadAudio/btnUploadVideo (2 nút riêng ĐÃ XOÁ), giờ chỉ cần đồng bộ lại `accept` của
        // 2 input DÙNG CHUNG theo đúng Nguồn vừa khôi phục — nút bấm mở menu LUÔN hiện, không đổi.
        this._applyUploadInputAccept(restoredSource);
        // MỚI (hợp nhất Photo vào Playlist) — cùng lý do, hàng "Phát/Trộn bài" cũng phải tự đồng bộ
        // ở đây (KHÔNG đi qua switchToPhotoSource() lúc boot). SỬA (Giang yêu cầu — "bỏ ẩn cho 2
        // nút phát và shuffle") — TRƯỚC ĐÂY toggle theo `restoredSource === 'photo'` (ẩn khi boot
        // thẳng vào Photo) — giờ Photo không còn ẩn 2 nút này nữa (xem switchToPhotoSource()), LUÔN
        // gỡ 'hidden' bất kể Nguồn nào, khớp đúng cách switchToVideoSource()/switchToSongSource()/
        // switchToPhotoSource() đều làm.
        if (btnPlaylistEmptyPlay) btnPlaylistEmptyPlay.classList.remove('hidden');
        if (btnPlaylistEmptyShuffle) btnPlaylistEmptyShuffle.classList.remove('hidden');
        await this.syncPlaylistSettingsUI();
    },

    // ===================== Ver 12 "Filter/Sort subpanel" (mục 1b/1c/1d) =====================

    /**
     * Khôi phục `playlistFilterConfig` đã lưu bền LÚC BOOT — gọi từ event/workflow/app-boot.js,
     * TRƯỚC khối Scope (applyAllSongsScope()/applyFolderScope() đọc field này để lọc
     * playlistOrder, xem event/workflow/playlist-scope.js) — CÙNG VỊ TRÍ/LÝ DO THỨ TỰ với
     * loadPersistedPlaylistConfigOnBoot() ngay trên. Không tìm thấy `meta.playlistFilterConfig`
     * (lần đầu mở app) -> giữ nguyên default rỗng đã seed sẵn ở buildDefaults()
     * (service/state/playlist.js) — mọi field `null`, applyPlaylistFilter() fast-path trả nguyên
     * playlistOrder, hành vi giống hệt trước khi có Filter.
     */
    async loadPersistedFilterConfigOnBoot() {
        const saved = await getMeta('playlistFilterConfig');
        if (saved && typeof saved === 'object' && saved.song && saved.video) {
            // SỬA (phản hồi Giang, mục 1 "treo loading khi đổi Nguồn sang Photo") — TRƯỚC ĐÂY
            // `appState.set('playlistFilterConfig', saved)` GHI ĐÈ HOÀN TOÀN bằng `saved`: dữ liệu
            // lưu bền TỪ TRƯỚC lúc Photo được hợp nhất vào Playlist chỉ có 2 key `song`/`video`,
            // hoàn toàn THIẾU key `photo` — khiến `appState.get('playlistFilterConfig').photo`
            // thành `undefined`, rồi `applyPlaylistFilter()` (core/playlist/filter.js) chạy
            // `Object.keys(undefined)` NÉM TypeError giữa chừng `switchToPhotoSource()`, dừng thực
            // thi TRƯỚC MỌI bước vẽ lại UI phía sau -> treo loading vĩnh viễn, ảnh không lên đúng
            // hiện tượng Giang báo. ĐÚNG lỗi này ĐÃ được sửa cho `activeMediaSource` ở hàm sinh đôi
            // `loadPersistedPlaylistConfigOnBoot()` ngay phía trên (danh sách `validSources` tường
            // minh, không rơi về mặc định) — sửa bỏ sót ở đây. Giờ MERGE `saved` LÊN TRÊN
            // `clonePlaylistFilterConfigDefaults()` (service/state/playlist.js — nguồn sự thật DUY
            // NHẤT cho "field nào hợp lệ theo Nguồn", cùng cách `appConfigViz` đang merge lúc khôi
            // phục, core/config.js dòng ~493) — Nguồn nào saved ĐÃ CÓ (song/video) dùng nguyên dữ
            // liệu saved; Nguồn MỚI thêm sau này mà saved CHƯA CÓ (photo) tự rơi về default rỗng
            // (mọi field null, applyPlaylistFilter() fast-path) thay vì undefined.
            appState.set('playlistFilterConfig', { ...clonePlaylistFilterConfigDefaults(), ...saved });
            console.log(`writer: "loadPersistedFilterConfigOnBoot", page: "playlistFilterConfig", content: "khôi phục từ meta.playlistFilterConfig (merge lên default để bù Nguồn mới thiếu trong dữ liệu cũ)"`);
        } else {
            // MỚI (mục 2, phản hồi Giang — "thêm log của filter xem") — log CẢ nhánh không có gì để
            // khôi phục (lần đầu dùng tính năng, hoặc dữ liệu hỏng) — để thấy đúng bước này CÓ chạy
            // và chạy NHANH, không phải nguồn treo boot.
            console.log(`writer: "loadPersistedFilterConfigOnBoot", page: "playlistFilterConfig", content: "không có gì để khôi phục — giữ default rỗng"`);
        }
    },

    /** Push panel "Sắp xếp" (mục 1b/1c; SỬA mục 3 — dropdown Stats tách field/hướng riêng, dropdown
     * hướng CHỈ hiện khi field khác 'none') — đồng bộ giá trị hiện tại lúc mở. SỬA (đợt tái cấu
     * trúc bottom nav + phân phối lại Settings) — KHÔNG còn `pushSettingsPanel()`, bodyHtml do
     * event/workflow/app-settings.js cung cấp SẴN qua `navigateTo()` — chỉ còn đồng bộ giá trị vào
     * `genericDrawerBody`. */
    openSortPanel() {
        const panelEl = genericDrawerBody;
        panelEl.querySelector('#setting-playlist-sort-name').value = appState.get('displaySortMode');
        const statField = appState.get('displayStatSortField');
        panelEl.querySelector('#setting-playlist-sort-stat-field').value = statField;
        panelEl.querySelector('#setting-playlist-sort-stat-direction').value = appState.get('displayStatSortDirection');
        panelEl.querySelector('[data-sort-direction-row]').classList.toggle('hidden', statField === 'none');
    },

    /** Push panel "Lọc" (mục 1d) — field hiện theo ĐÚNG Nguồn (song/video) đang active, đồng bộ
     * từ `playlistFilterConfig[source]` đã lưu. SỬA (đợt tái cấu trúc bottom nav + phân phối lại
     * Settings) — cùng khuôn openSortPanel() ngay trên. */
    openFilterPanel() {
        const source = appState.get('activeMediaSource');
        const panelEl = genericDrawerBody;
        this._syncFilterPanelUI(panelEl, source);
    },

    /** Đồng bộ toàn bộ field trong panel Lọc theo `playlistFilterConfig[source]` hiện tại — dùng
     * ĐÚNG data-attribute đã dựng ở components/playlist-filter-drawer.js (data-filter-row/
     * data-filter-prop) để tìm input, KHÔNG hard-code id từng field (field theo Nguồn khác nhau
     * về số lượng — xem PLAYLIST_FILTER_TEXT_FIELDS/PLAYLIST_FILTER_NUMERIC_FIELDS,
     * core/playlist/filter.js). */
    _syncFilterPanelUI(panelEl, source) {
        const rules = appState.get('playlistFilterConfig')[source];
        // MỚI (phản hồi Giang — "totalTime/duration dùng time picker, h:m:s") — kind 'seconds' là
        // NÚT (`<button>`, data-filter-time-trigger), set `.textContent` qua `_formatSecondsAsHms()`
        // — KHÁC mọi kind khác (`<input>`, set `.value` qua `_formatFilterNumberForInput()`).
        const setDisplay = (el, kind, value) => {
            if (!el) return;
            if (kind === 'seconds') el.textContent = _formatSecondsAsHms(value);
            else el.value = kind === 'text' ? (value || '') : _formatFilterNumberForInput(kind, value);
        };
        for (const field of Object.keys(rules)) {
            const rule = rules[field];
            const rowEl = panelEl.querySelector(`[data-filter-row="${field}"]`);
            if (!rowEl) continue;
            const kind = _filterFieldKind(field);
            const enableEl = rowEl.querySelector('[data-filter-prop="enabled"]');
            if (enableEl) enableEl.checked = !!rule;
            // FIX (bug — checkbox bị khoá theo cả row, Giang phát hiện) — CHỈ khoá phần
            // `data-filter-body` (control BÊN DƯỚI checkbox), KHÔNG khoá cả `rowEl` nữa — checkbox
            // enable nằm NGOÀI khối này nên luôn bấm lại được dù field đang tắt.
            const bodyEl = rowEl.querySelector('[data-filter-body]');
            if (bodyEl) {
                bodyEl.classList.toggle('opacity-40', !rule);
                bodyEl.classList.toggle('pointer-events-none', !rule);
            }
            if (!rule) continue;
            const opEl = rowEl.querySelector('[data-filter-prop="op"]');
            if (opEl && rule.op !== undefined) opEl.value = rule.op;
            const modeEl = rowEl.querySelector('[data-filter-prop="mode"]');
            if (modeEl && rule.mode !== undefined) modeEl.value = rule.mode;
            const rangeBlock = rowEl.querySelector('[data-filter-range-block]');
            const singleBlock = rowEl.querySelector('[data-filter-single-block]');
            // Field TEXT không có khối single/range (luôn 1 ô value DUY NHẤT) -> querySelector
            // thẳng trên rowEl là đủ, KHÔNG cần phân biệt khối.
            if (!rangeBlock && !singleBlock) {
                setDisplay(rowEl.querySelector('[data-filter-prop="value"]'), kind, rule.value);
                continue;
            }
            // Field SỐ/NGÀY/GIÂY — 2 khối CÙNG có 1 control data-filter-prop="value" (khác id) —
            // set ĐÚNG khối, để trống khối kia (không cần thiết, đang `hidden`).
            setDisplay(singleBlock && singleBlock.querySelector('[data-filter-prop="value"]'), kind, rule.value);
            setDisplay(rangeBlock && rangeBlock.querySelector('[data-filter-prop="value"]'), kind, rule.value);
            setDisplay(rangeBlock && rangeBlock.querySelector('[data-filter-prop="valueTo"]'), kind, rule.valueTo);
            if (rangeBlock && singleBlock && rule.mode !== undefined) {
                // SỬA (15/08/2026, thêm mode 'outRange') — range-block hiện cho MỌI mode KHÁC
                // 'single' (trước chỉ so === 'range'), vì 'outRange' dùng CHUNG khối 2 ô from/to.
                rangeBlock.classList.toggle('hidden', rule.mode === 'single');
                singleBlock.classList.toggle('hidden', rule.mode !== 'single');
            }
        }
    },

    /**
     * Ứng với nút mở time-picker (totalTime/duration, mục Filter) — mở `openTimePickerModal()`
     * (core/time-picker-modal.js, format 'h-m-s') đọc giá trị HIỆN TẠI từ state, `onConfirm` ghi
     * lại qua `setFilterField()` (tái dùng NGUYÊN, `rawValue` truyền dạng chuỗi giây — giống hệt
     * input thường) + cập nhật text hiển thị trên nút NGAY, không cần đợi mở lại panel.
     * @param {string} field - 'totalTime' | 'duration'
     * @param {string} prop - 'value' | 'valueTo'
     */
    openFilterTimePicker(field, prop) {
        const source = appState.get('activeMediaSource');
        const rule = appState.get('playlistFilterConfig')[source][field];
        if (!rule) return; // guard — field đang tắt (không nên xảy ra, nút bị pointer-events-none)
        const currentSeconds = (prop === 'valueTo' ? rule.valueTo : rule.value) || 0;
        openTimePickerModal({
            title: t(field === 'totalTime' ? 'playlistFilterPanel.field.totalTime' : 'playlistFilterPanel.field.duration'),
            format: 'h-m-s',
            valueMs: currentSeconds * 1000,
            minMs: 0,
            maxMs: 359999000, // 99:59:59 — đủ lớn cho mọi giá trị thực tế (thời lượng video/tổng giờ nghe)
            onConfirm: (resultMs) => {
                const seconds = Math.round(resultMs / 1000);
                this.setFilterField(field, prop, String(seconds));
                // SỬA (đợt tái cấu trúc bottom nav App Panel) — panel Lọc giờ sống trong genericDrawerBody, KHÔNG còn peekTopSettingsPanel() (xem ghi chú ở setFilterField()).
                const btn = genericDrawerBody.querySelector(`[data-filter-field="${field}"][data-filter-prop="${prop}"][data-filter-time-trigger]`);
                if (btn) btn.textContent = _formatSecondsAsHms(seconds);
            },
        });
    },

    /**
     * Ứng với 1 input BẤT KỲ trong panel Lọc đổi giá trị (mục 1d) — `prop` quyết định nhánh:
     *   - 'enabled' — bật/tắt field đó (bật -> tạo rule mặc định rỗng; tắt -> null hẳn).
     *   - 'op'/'mode' — đổi toán tử / đổi đơn-giá-trị↔range (numeric/date).
     *   - 'value'/'valueTo' — đổi giá trị (text giữ nguyên chuỗi; numeric/date/size tự parse qua
     *     `_parseFilterNumberInput()`, size nhập vào là MB, lưu bytes).
     * KHÔNG tự resort/re-render gì ở đây — Filter chỉ thật sự áp dụng lúc `applyFilterChanges()`
     * (nút "Áp dụng") + reload, xem docstring đầu core/playlist/filter.js.
     * @param {string} field @param {string} prop @param {string|boolean} rawValue
     */
    setFilterField(field, prop, rawValue) {
        const source = appState.get('activeMediaSource');
        const kind = _filterFieldKind(field);
        appState.mutate('playlistFilterConfig', (cfg) => {
            const bucket = cfg[source];
            if (!(field in bucket)) return; // guard — field không thuộc Nguồn hiện tại (không nên xảy ra, UI đã lọc sẵn theo Nguồn)
            if (prop === 'enabled') {
                bucket[field] = rawValue
                    ? (kind === 'text' ? { op: '===', value: '' } : { mode: 'single', op: '===', value: 0, valueTo: 0 })
                    : null;
                return;
            }
            const rule = bucket[field];
            if (!rule) return; // guard — field đang tắt, bỏ qua input ẩn (mờ/pointer-events-none phía UI)
            if (prop === 'op') rule.op = rawValue;
            else if (prop === 'mode') rule.mode = rawValue;
            else if (prop === 'value') rule.value = kind === 'text' ? rawValue : _parseFilterNumberInput(kind, rawValue);
            else if (prop === 'valueTo') rule.valueTo = _parseFilterNumberInput(kind, rawValue);
        });
        // Toggle mờ/khoá `data-filter-body` NGAY khi bật/tắt field — SỬA (đợt tái cấu trúc bottom
        // nav App Panel, bug "bật toggle vẫn không bấm được input") — panel Lọc giờ sống trong
        // `genericDrawerBody`, KHÔNG còn `peekTopSettingsPanel()` (stack CŨ, nay thuộc Photo —
        // tìm sai chỗ nên khối mở khoá KHÔNG BAO GIỜ chạy, dù checkbox đã bật).
        if (prop === 'enabled') {
            const rowEl = genericDrawerBody.querySelector(`[data-filter-row="${field}"]`);
            const bodyEl = rowEl && rowEl.querySelector('[data-filter-body]');
            if (bodyEl) {
                bodyEl.classList.toggle('opacity-40', !rawValue);
                bodyEl.classList.toggle('pointer-events-none', !rawValue);
            }
        }
        // Toggle hiện/ẩn khối single/range NGAY khi đổi 'mode' — SỬA (đợt tái cấu trúc bottom nav
        // App Panel) — panel Lọc giờ sống trong genericDrawerBody, KHÔNG còn peekTopSettingsPanel()
        // (CÙNG LÝ DO nhánh 'enabled' ở trên).
        if (prop === 'mode') {
            const rowEl = genericDrawerBody.querySelector(`[data-filter-row="${field}"]`);
            if (rowEl) {
                const rangeBlock = rowEl.querySelector('[data-filter-range-block]');
                const singleBlock = rowEl.querySelector('[data-filter-single-block]');
                if (rangeBlock && singleBlock) {
                    // SỬA (15/08/2026, thêm mode 'outRange') — CÙNG LOGIC nhánh _syncFilterPanelUI()
                    // ở trên (rule.mode !== undefined): hiện range-block cho mọi mode KHÁC 'single'.
                    rangeBlock.classList.toggle('hidden', rawValue === 'single');
                    singleBlock.classList.toggle('hidden', rawValue !== 'single');
                }
            }
        }
    },

    /** Nút "Áp dụng" panel Lọc — lưu bền NGAY (đọc thấy lần boot/đổi Nguồn/đổi Scope SAU) + hỏi
     * reload để thấy kết quả NGAY trong phiên đang chạy — CÙNG UX với Scope (mục "Filter đổi lúc
     * app đang chạy", phản hồi Giang), tái dùng thẳng modal chung đã có
     * (workflowPlaylistScope.askReloadToApplyNow(), event/workflow/playlist-scope.js). */
    async applyFilterChanges() {
        await setMeta('playlistFilterConfig', appState.get('playlistFilterConfig'));
        console.log(`writer: "applyFilterChanges", page: "playlistFilterConfig", content: "đã lưu bền"`);
        workflowPlaylistScope.askReloadToApplyNow(t('playlistFilterPanel.reloadPrompt'));
    },

    /**
     * MỚI (05/08/2026, Rule 3a, phản hồi Giang "xử lý triệt để... theo event bus, rule core") —
     * thay thế `PlaylistMain.init()` đã BỊ BỎ (core/playlist/main.js): hàm đó cũ gọi lần lượt 4
     * method core khác NGAY BÊN TRONG chính nó — core gọi core, vi phạm Rule 3a. Việc GỌI TUẦN TỰ
     * 4 method (điều phối, không phải nghiệp vụ) giờ chuyển hẳn ra đây — Workflow CHUẨN BỊ tham số
     * (`appState.get('isGridView')`) rồi gọi từng Core method riêng biệt, đúng Rule 3b.
     * Dùng lại ở MỌI nơi trước đây gọi `PlaylistMain.init()`: loadPersistedPlaylistConfigOnBoot()
     * ngay trên, và event/workflow/app-boot.js (2 chỗ khôi phục lệch loại folder Scope).
     */
    async syncPlaylistSettingsUI() {
        if (typeof PlaylistMain === 'undefined') return; // guard clause thuần (Rule 1) — giữ đúng kiểu phòng thủ cũ ở mọi nơi từng gọi PlaylistMain.init()
        PlaylistMain.initViewMode(appState.get('isGridView'));
        PlaylistMain.initMediaSource();
        await PlaylistMain.updateActiveFolderUI();
    }
};

