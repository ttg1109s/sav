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
 * loadConfig()/loadPlaylistBgImageAsset().
 */
const workflowAppBoot = {
    async boot() {
        await loadConfig();
        // MỚI (29/08/2026, hệ Cấu hình Slideshow) — PHẢI chạy TRƯỚC dòng
        // `workflowVisualBg.loadPersistedSettingsOnBoot()` ngay dưới: hàm này tự migrate cấu hình
        // Slideshow CŨ (từng nhúng thẳng trong `meta.visualBgConfig.slideshow`) thành preset đầu
        // tiên + ghi thẳng `slideshowPresetId` vào CHÍNH `meta.visualBgConfig` — VBG đọc lại meta đó
        // NGAY SAU sẽ thấy đúng giá trị đã migrate, xem docstring loadPresetsOnBoot()
        // (event/workflow/slideshow-presets.js).
        if (typeof workflowSlideshowPresets !== 'undefined') await workflowSlideshowPresets.loadPresetsOnBoot();
        // SỬA (fix bug "bật vbg nguồn video -> playlist mãi mới render") — KHÔNG await ở đây nữa.
        // `loadPersistedSettingsOnBoot()` tự áp nền ngầm (video không còn chặn chờ 'playing' lúc
        // boot — xem event/workflow/visual-bg.js::_playVideoKey()); boot() chạy thẳng xuống playlist
        // ngay, không đứng chờ nền video nạp xong nữa.
        if (typeof workflowVisualBg !== 'undefined') workflowVisualBg.loadPersistedSettingsOnBoot();

        // MỚI (v13 Batch F) — dọn 4 khoá meta mồ côi của cơ chế nền cũ (2 trong đó là BẢN SAO Blob
        // ảnh/video, có thể hàng trăm MB). Chạy SAU khi đã nạp xong cấu hình mới, không await chặn
        // phần còn lại của boot vì nó không ảnh hưởng gì tới hiển thị.
        purgeVisualBgLegacyMeta(); // core/file-manager/cleanup.js
        // MỚI (hợp nhất Photo vào Playlist, cấu trúc folderIndex O(1)) — AWAIT (khác purge ngay
        // trên, không await được) vì `listFolders()` (core/file-manager/folder.js) từ nay LUÔN giả
        // định `meta.folderIndex` đã tồn tại đúng — phải chắc chắn migrate xong TRƯỚC KHI người
        // dùng có thể mở Folder Browser/Add to Folder (ngay sau boot), tránh race hiếm "index rỗng
        // tạm thời trong lúc đang build" khiến folder cũ hiện biến mất 1 nhịp.
        await migrateFolderIndexIfNeeded(); // core/file-manager/folder.js
        // XOÁ (29/08/2026) — comment cũ "Domain slideshow đã gộp vào visualBgConfig.slideshow (v13
        // Batch C)" không còn đúng — Slideshow tách hẳn thành hệ preset độc lập (migrate ở dòng
        // `workflowSlideshowPresets.loadPresetsOnBoot()` phía trên), không còn nhúng trong VBG.
        if (typeof checkPendingResumeStateOnBoot === 'function') checkPendingResumeStateOnBoot();
        if (typeof loadSongStats === 'function') await loadSongStats();

        // MỚI (phản hồi Giang, mục 5 "Đồng bộ lại config Playlist Settings") — khôi phục
        // Nguồn/Sắp xếp/Kiểu xem đã lưu bền TRƯỚC KHI quyết định nạp playlistCache theo nguồn nào
        // ngay dưới đây (LƯU Ý THỨ TỰ, phản hồi Giang: bắt buộc biết `activeMediaSource` đã lưu
        // TRƯỚC khi chọn initPlaylistFromDB() hay tương đương Video — đảo ngược thứ tự sẽ tái diễn
        // đúng bug ở mục 7 dưới đây).
        if (typeof workflowPlaylist !== 'undefined') await workflowPlaylist.loadPersistedPlaylistConfigOnBoot();
        // MỚI (mục 1d, Playlist Filter) — khôi phục `playlistFilterConfig` đã lưu bền TRƯỚC khối
        // Scope ngay dưới (applyAllSongsScope()/applyFolderScope() đọc field này để lọc
        // playlistOrder — xem event/workflow/playlist-scope.js) — CÙNG LÝ DO THỨ TỰ với dòng
        // activeMediaSource ngay trên.
        if (typeof workflowPlaylist !== 'undefined') await workflowPlaylist.loadPersistedFilterConfigOnBoot();

        // MỚI (phản hồi Giang, mục 3 "thêm nhớ trạng thái shuffle/repeat/stats") — khôi phục 3
        // icon toggle Control Center đã lưu bền — CÙNG NHÓM "khôi phục config đã lưu bền lúc boot"
        // với dòng playlist ngay trên, không phụ thuộc thứ tự với nhau (2 domain độc lập).
        if (typeof workflowPlayerControls !== 'undefined') await workflowPlayerControls.loadPersistedPlayerConfigOnBoot();

        // MỚI (phản hồi Giang — hệ thống preset EQ lưu DB) — nạp/seed meta.eqPresets TRƯỚC khi
        // audio graph có thể tồn tại (setupAudioContext() chỉ chạy SAU thao tác phát nhạc đầu
        // tiên của người dùng, luôn SAU boot() — không cần await chặn phần còn lại, nhưng vẫn await
        // ở đây để CHẮC CHẮN appState.eqPresets sẵn sàng trước khi người dùng kịp bấm phát, tránh
        // race hiếm gặp trên máy rất chậm).
        if (typeof workflowEqPresets !== 'undefined') await workflowEqPresets.loadPresetsOnBoot();

        // SỬA (fix bug "folder Video Apply -> Playlist trống", phản hồi Giang mục 7) — TRƯỚC ĐÂY
        // LUÔN initPlaylistFromDB() (chỉ nạp Song) bất kể activeMediaSource là gì, khiến
        // applyFolderScope() bên dưới so sánh key Video với 1 playlistCache toàn Song -> luôn lọc
        // ra 0 kết quả. Giờ nạp ĐÚNG playlistCache theo activeMediaSource vừa khôi phục ở trên.
        const bootMediaSource = (typeof appState !== 'undefined') ? appState.get('activeMediaSource') : 'song';
        if (bootMediaSource === 'video' && typeof listVideos === 'function' && typeof buildVideoPlaylistCache === 'function') {
            buildVideoPlaylistCache(await listVideos()); // core có sẵn (core/playlist/loader.js)
        } else if (bootMediaSource === 'photo' && typeof listImages === 'function' && typeof buildPhotoPlaylistCache === 'function') {
            // MỚI (hợp nhất Photo vào Playlist) — cùng lý do nhánh 'video' ngay trên, tránh lặp lại
            // đúng bug mục 7 (initPlaylistFromDB() chỉ nạp Song, applyFolderScope() bên dưới sẽ so
            // sánh nhầm key nếu activeMediaSource đã khôi phục là 'photo'). Photo không có Folder
            // Scope (Folder chỉ áp dụng Song/Video) nên KHÔNG cần nhánh sửa lệch type ở khối
            // VirtualMachineState bên dưới — chỉ cần nạp ĐÚNG playlistCache ở bước này là đủ.
            buildPhotoPlaylistCache(await listImages()); // core có sẵn (core/file-manager/image.js + core/playlist/loader.js)
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
            // loadPlaylistBgImageAsset() CŨ, không cấp phép cho code MỚI né rule) — SAI theo đúng "LƯU
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
                        // SỬA (05/08/2026, Rule 3a, phản hồi Giang "xử lý triệt để") — thay
                        // `PlaylistMain.init()` (đã BỎ, xem event/workflow/playlist.js) bằng
                        // `workflowPlaylist.syncPlaylistSettingsUI()`, cùng chỗ Workflow-to-Workflow
                        // được phép (khác domain: app-boot -> playlist).
                        if (typeof workflowPlaylist !== 'undefined') await workflowPlaylist.syncPlaylistSettingsUI();
                    } else if (folderType === 'song' && currentSource !== 'song') {
                        appState.set('activeMediaSource', 'song');
                        console.log(`writer: "boot", page: "activeMediaSource", content: "song (sửa lệch theo type folder đã Apply)"`);
                        await initPlaylistFromDB();
                        if (typeof workflowPlaylist !== 'undefined') await workflowPlaylist.syncPlaylistSettingsUI();
                    }
                    await workflowPlaylistScope.applyFolderScope(savedFolderId);
                } },
            ]);
        }
        // MỚI (fix bug #1, phản hồi Giang — "Active folder vẫn hiện none dù có folder đang active")
        // — workflowPlaylist.syncPlaylistSettingsUI() (gọi TRONG loadPersistedPlaylistConfigOnBoot()
        // ở trên VÀ lúc nạp script core/playlist/main.js — tên cũ PlaylistMain.init(), đã BỎ 05/08/2026
        // theo Rule 3a) đều chạy TRƯỚC KHI activePlayListFolder được khôi phục
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

        // XOÁ (30/07/2026, cùng ngày) — `workflowFileManagerVideo.regenerateAllVideoThumbFull()`
        // (thêm rồi xoá NGAY TRONG CÙNG NGÀY, chạy ngầm 1 lần lúc boot quét lại toàn bộ video cũ) —
        // Giang chốt: kỹ thuật chụp khung đầu robust (readyState>=2 + play()/pause() nudge) chỉ áp
        // dụng cho video UPLOAD MỚI (event/workflow/file-manager-video.js::_extractVideoThumbAndMeta()),
        // không cần thêm 1 lượt quét lại video cũ nữa — xem lịch sử đầy đủ ở file đó.

        // MỚI (phản hồi Giang — "shield loading không full-screen + Video không có shield") — báo
        // cho preloader full-screen (index.html, đầu <body>) biết Playlist đã THẬT SỰ dựng xong (renderOrder
        // đã render ra DOM, không chỉ script tải xong) — preloader tự ẩn NGAY khi nhận được tín hiệu
        // này (nếu script cũng đã tải xong). Đặt Ở ĐÂY — SAU CÙNG mọi bước dựng Playlist (kể cả
        // Scope/Filter/render DOM) — để không còn khoảng hở "list trống nhưng header/nút đã hiện".
        if (typeof window.markPlaylistBootReady === 'function') window.markPlaylistBootReady();
    },
};
