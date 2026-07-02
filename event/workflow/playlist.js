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

    /**
     * Ứng với msg.type = 'playlist.editCover.change' — cần validate (có thể trả lỗi) rồi QUYẾT
     * ĐỊNH có hiện alertModal hay không -> đủ phối hợp để là workflow, dù chỉ gọi 1 hàm core.
     * @param {{file: File}} payload
     */
    async changeCover(payload) {
        const { file } = payload;
        const result = changeSongEditCover(file); // core thuần, trả {status, reason?}
        if (result.status === 'invalid') {
            await alertModal(result.reason);
        }
    },

    /**
     * Ứng với msg.type = 'playlist.edit.save' — cần ĐỌC state form (key/newTag/pendingCover) rồi
     * PHỐI HỢP shield + hàm core lưu + (có thể) alertModal not-found + dọn dẹp UI sau khi lưu ->
     * rõ ràng là workflow (nhiều hàm, có rẽ nhánh theo status).
     */
    async executeSaveEdit() {
        // captureSongEditFormState() là core THUẦN, không shield — chỉ đọc dữ liệu hiện có của
        // form + playlistStore, không ghi gì cả.
        const { key, newTag, pendingCover } = captureSongEditFormState();
        if (!key) return; // không có modal nào đang mở -> no-op, giống hành vi gốc (if (!key) return;)

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
     */
    playSelectedSongs() {
        const keys = Array.from(appState.get('selectedSongKeys'));
        if (keys.length === 0) return; // guard — chưa chọn gì thì không làm gì

        const sorted = sortKeysByMode(keys); // core có sẵn, CÓ return, DÙNG NGAY dưới -> hợp lệ Rule 3
        appState.set('displayOrder', sorted);
        console.log(`writer: "playSelectedSongs", page: "displayOrder", content: "${sorted.length} bài đã chọn, sort theo displaySortMode hiện tại"`);
        appState.mutate('pendingResortKeys', s => s.clear());

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
     * Song song với openAddToFolderPicker() ở trên (chọn nhiều) — KHÔNG gộp chung 1 method vì 2
     * message trigger khác nhau (đơn lẻ đọc `songActionMenuKey` trong playlistStore, chọn nhiều
     * đọc `selectedSongKeys` trong appState) và cần đóng đúng menu tương ứng (songActionMenu vs
     * chế độ chọn nhiều) — viết chung sẽ phải rẽ nhánh theo "nguồn nào gọi tới", đúng thứ vi phạm
     * Rule 1 nếu đặt trong core, và không cần thiết ở tầng workflow (workflow không bị Rule 1 ràng
     * buộc, nhưng tách riêng vẫn rõ ràng hơn khi đọc).
     */
    async openAddToFolderPickerForSongMenu() {
        const key = playlistStore.get('songActionMenuKey');
        if (!key) return;
        closeSongActionMenu();

        const folders = await listFolders(); // core có sẵn, CÓ return, DÙNG ngay dưới

        const finishAdd = async (folderId) => {
            await withLoadingShield(t('common.loading.savingInfo'), async () => {
                await addSongsToFolder([key], folderId); // core có sẵn (core/file-manager/folder.js)
            });
            // SỬA 03/07/2026 (đợt 3): KHÔNG còn tự áp dụng ngay vào Playlist đang chạy — thêm bài
            // không đổi "folder nào đang active", chỉ đổi DỮ LIỆU trong nó. Lần tải trang kế tiếp
            // (hoặc lần bấm "Áp dụng" kế tiếp) sẽ tự đọc đúng danh sách mới — xem
            // event/workflow/playlist-scope.js.
            await alertModal(tFormat('fileManager.folderPicker.addSuccess', { count: 1 }));
        };

        openFolderPickerModal(folders, {
            onPickExisting: (folderId) => { finishAdd(folderId); },
            onCreateNew: async (name) => {
                const folderId = await createFolder(name); // core có sẵn, CÓ return, DÙNG ngay dưới
                await finishAdd(folderId);
            }
        });
    },

    /**
     * "Thêm vào thư mục" — liệt kê folder có sẵn (listFolders(), core/file-manager/folder.js) rồi
     * mở picker (openFolderPickerModal(), core/file-manager/folder-picker-ui.js — hàm dựng UI
     * thuần, không phải core nghiệp vụ). 2 callback của picker (chọn folder có sẵn / tạo mới) đều
     * gọi tiếp addSongsToFolder() — cùng 1 hành động, chỉ khác bước "có cần createFolder() trước
     * không", nên vẫn hợp lý gộp trong 1 workflow method thay vì tách 2 method riêng.
     */
    async openAddToFolderPicker() {
        const keys = Array.from(appState.get('selectedSongKeys'));
        if (keys.length === 0) return;

        const folders = await listFolders(); // core có sẵn, CÓ return, DÙNG ngay dưới

        const finishAdd = async (folderId) => {
            await withLoadingShield(t('common.loading.savingInfo'), async () => {
                await addSongsToFolder(keys, folderId); // core có sẵn (core/file-manager/folder.js)
            });
            // SỬA 03/07/2026 (đợt 3): KHÔNG còn tự áp dụng ngay vào Playlist đang chạy — xem lý do
            // ở finishAdd() bản 1-bài phía trên (openAddToFolderPickerForSongMenu).
            this._exitSelectionMode();
            await alertModal(tFormat('fileManager.folderPicker.addSuccess', { count: keys.length }));
        };

        openFolderPickerModal(folders, {
            onPickExisting: (folderId) => { finishAdd(folderId); },
            onCreateNew: async (name) => {
                const folderId = await createFolder(name); // core có sẵn, CÓ return, DÙNG ngay dưới
                await finishAdd(folderId);
            }
        });
    },

    /**
     * "Xoá hàng loạt" — ĐÚNG luồng bác chốt (câu 4 mục 6 plan): nếu bài đang phát nằm trong tập bị
     * xoá, ép DỪNG phát + về UI Playlist NGAY (không hỏi/không chặn, khác hẳn window.removeSong
     * đơn lẻ vốn chặn xoá nếu đang thực sự phát) -> bật shield -> xoá -> tắt shield -> modal "đã xoá".
     */
    async deleteSelectedSongs() {
        const keys = Array.from(appState.get('selectedSongKeys'));
        if (keys.length === 0) return;

        const currentKey = appState.get('currentKey');
        const wasPlayingSelected = currentKey != null && keys.includes(currentKey);

        if (wasPlayingSelected) {
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
        }

        let deletedCount = 0;
        await withLoadingShield(t('common.loading.deleting'), async () => {
            // Vòng lặp xoá ĐẶT THẲNG ở đây (workflow), KHÔNG bọc qua 1 lớp "core" giả — mỗi bước
            // (đọc record, cascade folder, xoá record, xoá stat) là 1 hàm core void nối tiếp nhau,
            // đúng vai trò workflow (Rule 3: core không được làm việc này, workflow thì được).
            const deletedKeys = [];
            for (const key of keys) {
                const record = await getSongRecord(key);
                if (!record) continue; // guard: đã bị xoá từ trước (hiếm, race) — bỏ qua, không chặn cả lô
                await removeSongFromAllFolders(record); // core có sẵn (core/file-manager/folder.js)
                await deleteSongRecord(key); // core CRUD thô (core/db.js)
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
    }
};
