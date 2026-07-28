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
const workflowPlaylist = {

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
        window.playSong(sorted[0]);
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
     * MỚI (ver12 "Song/Video Unification", Batch 6, mục 6d, phản hồi Giang) — 2 hành động RIÊNG
     * của Video trong menu 3 chấm (Set làm nền / Sửa video) — CÙNG PRECEDENT với
     * openSubtitleEditorForSongMenu() ngay trên (đọc key đang mở menu, đóng menu, TÁI DÙNG NGUYÊN
     * `workflowFileManagerVideo.setVideoAsBackground()`/`navigateToVideoEdit()` — 2 hàm nghiệp vụ
     * ĐÃ CÓ SẴN từ "File Manager → Video" cũ, KHÔNG viết lại, chỉ đổi nơi gọi, đúng CHỐT mục 6d).
     */
    async setActiveMenuVideoAsBackground() {
        const key = playlistStore.get('songActionMenuKey');
        if (!key) return;
        closeSongActionMenu();
        await workflowFileManagerVideo.setVideoAsBackground(key); // event/workflow/file-manager-video.js — Workflow gọi Workflow miền khác, tự do
    },

    navigateToActiveMenuVideoEdit() {
        const key = playlistStore.get('songActionMenuKey');
        if (!key) return;
        closeSongActionMenu();
        workflowFileManagerVideo.navigateToVideoEdit(key);
    },

    async openAddToFolderPickerForSongMenu() {
        const key = playlistStore.get('songActionMenuKey');
        if (!key) return;
        closeSongActionMenu();

        await this._openFolderPickerDrawer(async (folderId) => {
            let result;
            // SỬA (ver12 "Song/Video Unification", phản hồi Giang 28/07/2026) — TRƯỚC ĐÂY hardcode
            // 'song' (giải thích cũ: "chỉ Song mới gọi addSongsToFolder()") — SAI, thực ra nút
            // "Thêm vào thư mục" trong menu 3 chấm LUÔN hiển thị bất kể đang browse nguồn nào
            // (template KHÔNG gate theo mediaType), nên Video CŨNG đi qua đúng đường này. Đọc
            // `activeMediaSource` (Batch 1, service/state/playlist.js) — Playlist chỉ browse ĐÚNG 1
            // nguồn tại 1 thời điểm nên toàn bộ item đang hiển thị (kể cả `key` 1-bài này) luôn
            // cùng loại với nguồn đang active.
            const mediaType = appState.get('activeMediaSource') === 'video' ? 'video' : 'song';
            await withLoadingShield(t('common.loading.savingInfo'), async () => {
                result = await addSongsToFolder([key], folderId, mediaType); // core có sẵn (core/file-manager/folder.js)
            });
            if (result.status === 'typeMismatch') {
                await alertModal(t('fileManager.folderPicker.typeMismatch'));
                return;
            }
            // SỬA 03/07/2026 (đợt 3): KHÔNG còn tự áp dụng ngay vào Playlist đang chạy — thêm bài
            // không đổi "folder nào đang active", chỉ đổi DỮ LIỆU trong nó. Lần tải trang kế tiếp
            // (hoặc lần bấm "Áp dụng" kế tiếp) sẽ tự đọc đúng danh sách mới — xem
            // event/workflow/playlist-scope.js.
            await alertModal(tFormat('fileManager.folderPicker.addSuccess', { count: 1 }));
        });
    },

    /**
     * "Thêm vào thư mục" (chọn nhiều) — cùng `_openFolderPickerDrawer()` với bản 1-bài ở trên, chỉ
     * khác `onPick` (nhiều key + thoát chế độ chọn).
     */
    async openAddToFolderPicker() {
        const keys = Array.from(appState.get('selectedSongKeys'));
        if (keys.length === 0) return;

        await this._openFolderPickerDrawer(async (folderId) => {
            let result;
            // SỬA (phản hồi Giang 28/07/2026) — cùng lý do ở openAddToFolderPickerForSongMenu()
            // ngay trên: đọc activeMediaSource thay vì hardcode 'song'.
            const mediaType = appState.get('activeMediaSource') === 'video' ? 'video' : 'song';
            await withLoadingShield(t('common.loading.savingInfo'), async () => {
                result = await addSongsToFolder(keys, folderId, mediaType); // core có sẵn (core/file-manager/folder.js)
            });
            if (result.status === 'typeMismatch') {
                await alertModal(t('fileManager.folderPicker.typeMismatch'));
                return;
            }
            // SỬA 03/07/2026 (đợt 3): KHÔNG còn tự áp dụng ngay vào Playlist đang chạy — xem lý do
            // ở finishAdd() bản 1-bài phía trên (openAddToFolderPickerForSongMenu).
            this._exitSelectionMode();
            await alertModal(tFormat('fileManager.folderPicker.addSuccess', { count: keys.length }));
        });
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

    _folderPickerFolders: [], // danh sách folder ĐANG hiển thị trong grid — cache RAM, chỉ dùng lúc Drawer đang mở
    _folderPickerEditingId: null, // folderId đang ở chế độ sửa tên (null = không có)
    _folderPickerOnPick: null, // callback(folderId) — set bởi entry method (openAddToFolderPickerForSongMenu/openAddToFolderPicker), gọi khi user CHỌN xong 1 folder

    /** Mở Drawer lần đầu — đọc danh sách folder, vẽ grid, wire sự kiện. */
    async _openFolderPickerDrawer(onPick) {
        this._folderPickerFolders = await listFolders(); // core có sẵn, CÓ return, DÙNG ngay dưới
        this._folderPickerEditingId = null;
        this._folderPickerOnPick = onPick;
        this._renderFolderPickerGrid(true);
    },

    /** Vẽ lại grid (mở lần đầu HOẶC sau khi thêm/sửa tên 1 folder) — `isFirstOpen` quyết định
     * open vs update Generic Drawer (core/generic-drawer.js — 2 hàm khác nhau tuỳ Drawer đang đóng
     * hay đã mở sẵn, xem docstring ở đó). */
    _renderFolderPickerGrid(isFirstOpen) {
        const itemsHtml = renderItemList(null, this._folderPickerFolders, itemTemplateFolderTile, { editingFolderId: this._folderPickerEditingId }); // components/items.js
        // SỬA (14/07/2026, Giang yêu cầu) — justify-center -> justify-start (căn trái thay vì căn
        // giữa cả cụm khi hàng cuối chưa đầy).
        const bodyHtml = `<div class="flex flex-wrap justify-start gap-4 p-5">${itemsHtml}${buildAddFolderTileHtml()}</div>`; // components/items.js
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
        this._wireFolderPickerEvents();
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

    /** Wire lại TOÀN BỘ sự kiện SAU MỖI lần vẽ grid (nội dung genericDrawerBody bị thay hoàn
     * toàn mỗi lần) — mọi callback CHỈ bắn eventBus.send(), KHÔNG gọi thẳng tên hàm nào (Rule 5a
     * MỚI). Input sửa tên (nếu đang có) tự focus + select ngay — KHÔNG qua eventBus (đây là hành
     * vi UI thuần "đặt con trỏ vào ô vừa hiện ra", không phải 1 hành động nghiệp vụ). */
    _wireFolderPickerEvents() {
        const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
        if (closeBtn) closeBtn.addEventListener('click', () => {
            eventBus.send({ router: 'playlist', type: 'playlist.folderPicker.close.click', payload: {} });
        });

        genericDrawerBody.querySelectorAll('.generic-item-folder-tile').forEach((tileEl) => {
            tileEl.addEventListener('click', () => {
                eventBus.send({ router: 'playlist', type: 'playlist.folderPicker.tile.click', payload: { folderId: tileEl.dataset.folderId } });
            });
        });

        const addTileEl = genericDrawerBody.querySelector('#generic-folder-picker-add-tile');
        if (addTileEl) addTileEl.addEventListener('click', () => {
            eventBus.send({ router: 'playlist', type: 'playlist.folderPicker.addTile.click', payload: {} });
        });

        const renameInputEl = genericDrawerBody.querySelector('.generic-folder-tile-rename-input');
        if (renameInputEl) {
            renameInputEl.focus();
            renameInputEl.select();
            const commit = () => {
                eventBus.send({ router: 'playlist', type: 'playlist.folderPicker.rename.commit', payload: { folderId: renameInputEl.closest('[data-folder-id]').dataset.folderId, name: renameInputEl.value } });
            };
            renameInputEl.addEventListener('blur', commit);
            renameInputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') renameInputEl.blur(); }); // Enter -> blur -> tự trigger commit ở trên, không lặp lại logic
        }
    },

    /** msg.type = 'playlist.folderPicker.tile.click' — user CHỌN xong 1 folder (có sẵn hoặc vừa
     * tạo, không quan trọng — mọi tile đều "chọn được" như nhau). */
    async pickFolderInPicker(folderId) {
        const onPick = this._folderPickerOnPick;
        this.closeFolderPicker();
        if (onPick) await onPick(folderId);
    },

    /** msg.type = 'playlist.folderPicker.close.click'. */
    closeFolderPicker() {
        this._folderPickerOnPick = null;
        this._closeGenericDrawerFully();
    },

    /** msg.type = 'playlist.folderPicker.addTile.click' — tạo NGAY 1 folder tên tự động (không
     * trùng tên bất kỳ folder nào đang có), thêm vào cache RAM, vẽ lại grid với tile MỚI ở chế độ
     * sửa tên (focus sẵn, xem _wireFolderPickerEvents()). KHÔNG tự "chọn" folder này luôn — user
     * vẫn cần tap vào tile (sau khi sửa tên xong) như MỌI tile khác để hoàn tất việc chọn, giữ
     * đúng 1 mô hình tương tác duy nhất cho toàn bộ grid (tạo ≠ chọn, tách 2 hành động RÕ RÀNG). */
    async createFolderInPicker() {
        const defaultName = this._computeDefaultFolderName();
        // SỬA (14/07/2026, tự audit lại Rule 3) — createFolder() đổi chữ ký, không còn tự
        // resolveFolderId() nội bộ, xem docstring createFolder() (core/file-manager/folder.js).
        const folderId = await resolveFolderId(defaultName); // core
        const result = await createFolder(folderId, defaultName); // core có sẵn (core/file-manager/folder.js)
        if (result.status !== 'ok') return; // hiếm — trùng tên dù đã tự tính tên không trùng (race hiếm gặp), im lặng bỏ qua
        this._folderPickerFolders.push({ id: result.folderId, name: defaultName });
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

    /** Cùng pattern `_closeGenericDrawerFully()` ở event/workflow/document-reader.js —
     * `closeGenericDrawer()` (core) CHỈ trượt xuống + mờ overlay, KHÔNG tự ẩn hẳn (Rule 5a: core
     * không được tự addEventListener cho DOM TĨNH) — Workflow tự nghe `transitionend` rồi gọi
     * `hideGenericDrawerImmediately()` để ẩn hẳn. */
    _closeGenericDrawerFully() {
        closeGenericDrawer(); // core/generic-drawer.js
        genericDrawerPanel.addEventListener('transitionend', function onTransitionEnd() {
            genericDrawerPanel.removeEventListener('transitionend', onTransitionEnd);
            hideGenericDrawerImmediately(); // core/generic-drawer.js
        }, { once: true });
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
        const isVideo = appState.get('activeMediaSource') === 'video';

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
            const getRecordFn = isVideo ? getVideoRecord : getSongRecord; // service/db.js
            const deletedKeys = [];
            for (const key of keys) {
                const record = await getRecordFn(key);
                if (!record) continue; // guard: đã bị xoá từ trước (hiếm, race) — bỏ qua, không chặn cả lô
                await removeSongFromAllFolders(record); // core có sẵn (core/file-manager/folder.js) — nhận record THÔ qua tham số, generic cho cả Song/Video
                if (isVideo) await deleteVideo(key); // core/file-manager/video.js
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

        // MỚI (FIX 28/07/2026, phản hồi Giang "Video chỉ 1 chế độ chọn nhiều file, bỏ dropdown,
        // input luôn") — đổi chỗ 2 nút "Thêm" ở header: ẩn #btn-upload-audio (Song, mở dropdown 2
        // lựa chọn), hiện #btn-upload-video (Video, <label> bọc thẳng input, mở picker NATIVE luôn,
        // xem components/playlist-view.js + event/listener/playlist.js).
        btnUploadAudio.classList.add('hidden');
        btnUploadVideo.classList.remove('hidden');

        const videoRecords = await listVideos(); // core/file-manager/video.js, CÓ return, DÙNG ngay dưới -> Workflow gọi Core hợp lệ (Rule 3)
        const keys = buildVideoPlaylistCache(videoRecords); // core/playlist/loader.js (MỚI, Batch 1), CÓ return, DÙNG ngay dưới
        appState.set('playlistOrder', keys);
        console.log(`writer: "switchToVideoSource", page: "playlistOrder", content: "${keys.length} video"`);

        updateShuffleArray();      // core có sẵn (core/playlist/order.js)
        recomputeDisplayOrder();   // core có sẵn (core/playlist/order.js)
        recomputeRenderOrder();    // core có sẵn (core/playlist/order.js)
        renderPlaylistDiff();      // core có sẵn (core/playlist/render.js)
        updateEmptyState();        // core có sẵn (core/playlist/render.js)
    },

    /**
     * Đổi Nguồn về lại Song — TÁI DÙNG NGUYÊN `scanValidSongsFromDB()` (core/playlist/loader.js,
     * hàm Song hiện có, KHÔNG sửa gì — nguyên tắc riêng của plan), rồi vẽ lại UI y hệt
     * switchToVideoSource(). Cùng lý do KHÔNG reset displaySortMode — xem docstring hàm đó.
     */
    async switchToSongSource() {
        appState.set('activeMediaSource', 'song');
        console.log(`writer: "switchToSongSource", page: "activeMediaSource", content: "song"`);

        // MỚI (FIX 28/07/2026, "bỏ dropdown Video, input luôn") — đổi chỗ ngược lại với
        // switchToVideoSource() ngay trên: hiện #btn-upload-audio, ẩn #btn-upload-video.
        btnUploadVideo.classList.add('hidden');
        btnUploadAudio.classList.remove('hidden');

        const keys = await scanValidSongsFromDB(); // core có sẵn (core/playlist/loader.js, Song, KHÔNG đụng), CÓ return, DÙNG ngay dưới
        appState.set('playlistOrder', keys);
        console.log(`writer: "switchToSongSource", page: "playlistOrder", content: "${keys.length} bài hát"`);

        updateShuffleArray();
        recomputeDisplayOrder();
        recomputeRenderOrder();
        renderPlaylistDiff();
        updateEmptyState();
    }
};
