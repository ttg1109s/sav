/**
 * event/workflow/app-boot.js — MỚI (25/07/2026, đợt tái cấu trúc state, mục "app-boot đi qua
 * eventBus"). Chuỗi ~15 bước boot dời NGUYÊN VẸN từ event/router/app-boot.js bản cũ (vốn dời từ
 * core/visualizer/draw-visualizer.js, 20/07/2026, plan-space-galaxy.md Phần A) — KHÔNG đổi thứ tự/
 * logic bên trong, chỉ đổi `appState.get/mutate('vizConfig', ...)` sang
 * `appConfigViz.getAll()/.mutateAll()` (cầu nối tương thích AppConfig, xem service/state.js).
 * [SỬA 27/07/2026] `seedConfig()` — trước đây gọi NGAY ĐẦU boot() ở đây — giờ dời hẳn sang
 * core/config.js (chạy ngay lúc nạp script, TRƯỚC khi accessor appConfigViz/... được tạo, xem
 * comment tại đó, lý do: xoá warning "chưa seed()" bắn lúc boot). boot() KHÔNG còn gọi
 * seedConfig() nữa — `loadConfig()` (dòng đầu tiên bên dưới) vẫn chạy SAU seed như cũ, chỉ khác
 * là seed đã xảy ra từ rất sớm (lúc nạp script), không còn ở đây nữa.
 *
 * File này (kế thừa quy chế miễn audit của draw-visualizer.js/event/router/app-boot.js cũ, xem
 * readme/core-legacy-audit.md) — thêm dòng mới vào đây KHÔNG phát sinh nghĩa vụ refactor cho
 * loadConfig()/loadBackgroundAssets().
 */
const workflowAppBoot = {
    async boot() {
        await loadConfig();
        // Resolve `meta.visualBgImage` (Blob thật, ghi bởi "Đặt làm nền Visual" —
        // event/workflow/file-manager-photo.js) NGAY SAU loadConfig(). "Đặt làm nền Playlist"
        // ghi thẳng vào `meta.bgImage` — CÙNG Ô mà loadConfig()/loadBackgroundAssets() đã tự
        // resolve sẵn rồi, nên KHÔNG cần thêm dòng nào cho `bgImage` ở đây, chỉ còn `visualBgImage`.
        if (typeof getMeta === 'function') {
            const cfg = appConfigViz.getAll();
            if (cfg.visualBgImageEnabled) {
                const visualBgBlob = await getMeta('visualBgImage');
                if (visualBgBlob) {
                    const url = URL.createObjectURL(visualBgBlob);
                    appConfigViz.mutateAll(c => { c.visualBgImage = url; });
                    if (typeof applyVisualBgImageToDOM === 'function') applyVisualBgImageToDOM(true, url);
                    // Khối resolve lúc boot này set DOM/state trực tiếp thay vì gọi qua
                    // applyVisualBgImage() (hàm ĐÓ mới có dòng đồng bộ toggle.checked), nên tự
                    // đồng bộ lại toggle ở đây.
                    if (typeof settingVisualBgImageEnableToggle !== 'undefined' && settingVisualBgImageEnableToggle) settingVisualBgImageEnableToggle.checked = true;
                } else {
                    // Bật "on" nhưng không còn Blob (hiếm — xoá tay IndexedDB, hoặc dữ liệu
                    // lệch) -> tự sửa về "off ảo", cùng nguyên tắc loadBackgroundAssets() áp
                    // dụng cho bgImage/videoBgUrl.
                    appConfigViz.mutateAll(c => { c.visualBgImageEnabled = false; });
                    if (typeof settingVisualBgImageEnableToggle !== 'undefined' && settingVisualBgImageEnableToggle) settingVisualBgImageEnableToggle.checked = false;
                }
            } else if (typeof settingVisualBgImageEnableToggle !== 'undefined' && settingVisualBgImageEnableToggle) {
                settingVisualBgImageEnableToggle.checked = false; // đồng bộ rõ ràng cả nhánh "off"
            }
        }
        // Đọc lại slideshowConfig/activeBackgroundAlbum đã lưu (meta) + tự khởi động engine nếu
        // có album active — NGAY SAU khối resolve visualBgImage ở trên (cùng nhóm "khôi phục nền
        // lúc boot").
        if (typeof workflowSlideshow !== 'undefined') await workflowSlideshow.loadPersistedSettingsOnBoot();
        updateSubToggleUI();
        if (typeof checkPendingResumeStateOnBoot === 'function') checkPendingResumeStateOnBoot();
        if (typeof loadSongStats === 'function') await loadSongStats();

        // MỚI (phản hồi Giang, mục 5 "Đồng bộ lại config Playlist Settings") — khôi phục
        // Nguồn/Sắp xếp/Kiểu xem đã lưu bền TRƯỚC KHI quyết định nạp playlistCache theo nguồn nào
        // ngay dưới đây (LƯU Ý THỨ TỰ, phản hồi Giang: bắt buộc biết `activeMediaSource` đã lưu
        // TRƯỚC khi chọn initPlaylistFromDB() hay tương đương Video — đảo ngược thứ tự sẽ tái diễn
        // đúng bug ở mục 7 dưới đây).
        if (typeof workflowPlaylist !== 'undefined') await workflowPlaylist.loadPersistedPlaylistConfigOnBoot();

        // MỚI (phản hồi Giang, mục 3 "thêm nhớ trạng thái shuffle/repeat/stats") — khôi phục 3
        // icon toggle Control Center đã lưu bền — CÙNG NHÓM "khôi phục config đã lưu bền lúc boot"
        // với dòng playlist ngay trên, không phụ thuộc thứ tự với nhau (2 domain độc lập).
        if (typeof workflowPlayerControls !== 'undefined') await workflowPlayerControls.loadPersistedPlayerConfigOnBoot();

        // SỬA (fix bug "folder Video Apply -> Playlist trống", phản hồi Giang mục 7) — TRƯỚC ĐÂY
        // LUÔN initPlaylistFromDB() (chỉ nạp Song) bất kể activeMediaSource là gì, khiến
        // applyFolderScope() bên dưới so sánh key Video với 1 playlistCache toàn Song -> luôn lọc
        // ra 0 kết quả. Giờ nạp ĐÚNG playlistCache theo activeMediaSource vừa khôi phục ở trên.
        const bootMediaSource = (typeof appState !== 'undefined') ? appState.get('activeMediaSource') : 'song';
        if (bootMediaSource === 'video' && typeof listVideos === 'function' && typeof buildVideoPlaylistCache === 'function') {
            buildVideoPlaylistCache(await listVideos()); // core có sẵn (core/playlist/loader.js)
        } else {
            await initPlaylistFromDB();
        }
        // Khôi phục activePlayListFolder đã lưu bền (nếu có) NGAY SAU khi playlistCache đã đầy đủ
        // ĐÚNG nguồn ở trên.
        if (typeof getMeta === 'function' && typeof workflowPlaylistScope !== 'undefined') {
            const savedFolderId = await getMeta('activePlayListFolder');
            // SỬA (phản hồi Giang — "ai bảo file đấy được miễn, không đọc đầu plan à?") — bản
            // trước Ở ĐÂY từng tự ý bỏ VirtualMachineState, thay bằng if/else thường, viện dẫn nhầm
            // "file này miễn audit" (dòng miễn-audit đầu file CHỈ áp cho loadConfig()/
            // loadBackgroundAssets() CŨ, không cấp phép cho code MỚI né rule) — SAI theo đúng "LƯU
            // Ý BẮT BUỘC" đầu plan-v12-song-video-unification.md ("cần mở rộng 1 pattern kiến trúc
            // — dừng lại hỏi Giang trước"). Đã hỏi lại, Giang chốt: mở rộng
            // VirtualMachineState (thêm `runAsync()`, giữ nguyên `run()` đồng bộ — xem
            // event/virtual-machine-state.js) — DÙNG LẠI ĐÚNG VMState ở đây, `await` được nhờ
            // `runAsync()` trả `Promise.all()`.
            await VirtualMachineState.runAsync([
                // MỚI (Batch 4, "Song/Video Unification" mục 5) — trước đây no-op ("đã đúng Tất cả
                // bài sẵn từ initPlaylistFromDB()") — giờ CẦN chạy applyAllSongsScope() để lọc
                // Exclude (chỉ ảnh hưởng view "Tất cả") ngay từ lúc boot, xem
                // event/workflow/playlist-scope.js.
                { state: savedFolderId, operation: 'in', value: [null, undefined], callback: () => workflowPlaylistScope.applyAllSongsScope() },
                { state: savedFolderId, operation: 'notIn', value: [null, undefined], callback: async () => {
                    // MỚI (fix mục 7) — folder đã lưu HIẾM KHI lệch loại với activeMediaSource vừa
                    // khôi phục (dữ liệu cũ/lệch), nhưng nếu có thì TYPE CỦA FOLDER thắng tuyệt đối
                    // (tín hiệu cụ thể hơn 1 lựa chọn Nguồn chung chung) — tự sửa lại
                    // playlistCache/activeMediaSource TRƯỚC KHI applyFolderScope() so sánh key,
                    // tránh lặp lại đúng bug mục 7.
                    const folderRecord = typeof getFolderRecord === 'function' ? await getFolderRecord(savedFolderId) : null;
                    const folderType = folderRecord ? folderRecord.type : null;
                    const currentSource = appState.get('activeMediaSource');
                    if (folderType === 'video' && currentSource !== 'video') {
                        appState.set('activeMediaSource', 'video');
                        console.log(`writer: "boot", page: "activeMediaSource", content: "video (sửa lệch theo type folder đã Apply)"`);
                        buildVideoPlaylistCache(await listVideos());
                        if (typeof PlaylistMain !== 'undefined') PlaylistMain.init();
                    } else if (folderType === 'song' && currentSource !== 'song') {
                        appState.set('activeMediaSource', 'song');
                        console.log(`writer: "boot", page: "activeMediaSource", content: "song (sửa lệch theo type folder đã Apply)"`);
                        await initPlaylistFromDB();
                        if (typeof PlaylistMain !== 'undefined') PlaylistMain.init();
                    }
                    await workflowPlaylistScope.applyFolderScope(savedFolderId);
                } },
            ]);
        }
        // MỚI (fix bug #1, phản hồi Giang — "Active folder vẫn hiện none dù có folder đang active")
        // — PlaylistMain.init() (gọi TRONG loadPersistedPlaylistConfigOnBoot() ở trên VÀ lúc nạp
        // script core/playlist/main.js) đều chạy TRƯỚC KHI activePlayListFolder được khôi phục
        // XONG ở khối VirtualMachineState.runAsync() ngay trên (applyAllSongsScope()/
        // applyFolderScope() mới THẬT SỰ set đúng giá trị) — badge/khoá Nguồn ở Settings → Playlist
        // vì vậy luôn hiện sai (mặc định rỗng) cho tới khi Giang tự đổi Scope 1 lần trong phiên. Gọi
        // LẠI đúng 1 lần Ở ĐÂY, SAU CÙNG khối quyết định Scope (giờ đã `await` được nhờ
        // `runAsync()`, xem event/virtual-machine-state.js), để phản ánh đúng giá trị thật đã khôi
        // phục.
        if (typeof PlaylistMain !== 'undefined') await PlaylistMain.updateActiveFolderUI();
        if (typeof appState !== 'undefined') appState.set('_isPlaylistReadyForResumeModal', true);
        if (typeof enableResumeModalButtonsWhenPlaylistReady === 'function') enableResumeModalButtonsWhenPlaylistReady();
        // Cuộn tới bài vừa sửa phụ đề xong (quay lại từ subtitle-editor.html qua nút "←") — đặt
        // SAU CÙNG (đã initPlaylistFromDB() + khôi phục activePlayListFolder xong).
        if (typeof scrollToSongIfPending === 'function') scrollToSongIfPending();

        // MỚI (29/07/2026, yêu cầu Giang mục 2 — "toàn bộ video đã có sẵn -> tạo thumb full một
        // lần") — backfill 1 lần cho video CŨ (upload trước khi field `thumbFullBlob` ra đời) —
        // CỐ Ý KHÔNG `await`: chạy NGẦM sau khi mọi bước boot còn lại (kể cả render Playlist) đã
        // xong, không trì hoãn thời điểm app sẵn sàng tương tác nếu thư viện có nhiều video (mỗi
        // video cần load/seek/decode). 1 video lỗi không chặn video khác — tự log riêng, không
        // alertModal/loading-shield gì (chạy hoàn toàn im lặng, người dùng không cần biết).
        if (typeof workflowFileManagerVideo !== 'undefined') workflowFileManagerVideo.backfillMissingVideoThumbFull();
    },
};
