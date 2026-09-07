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
        // MỚI (29/08/2026, hệ Cấu hình Motion) — PHẢI chạy TRƯỚC dòng
        // `workflowVisualBg.loadPersistedSettingsOnBoot()` ngay dưới: hàm này tự migrate cấu hình
        // Motion CŨ (từng nhúng thẳng trong `meta.visualBgConfig.slideshow`) thành preset đầu
        // tiên + ghi thẳng `motionPresetId` vào CHÍNH `meta.visualBgConfig` — VBG đọc lại meta đó
        // NGAY SAU sẽ thấy đúng giá trị đã migrate, xem docstring loadPresetsOnBoot()
        // (event/workflow/motion-presets.js).
        if (typeof workflowMotionPresets !== 'undefined') await workflowMotionPresets.loadPresetsOnBoot();
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
        // MỚI (06/09/2026, đổi schema activePlayListFolder theo Nguồn) — migrate 1 lần dữ liệu cũ
        // (1 giá trị phẳng) sang object {song,video,photo}, PHẢI chạy TRƯỚC bất kỳ chỗ nào đọc
        // `meta.activePlayListFolder`/`appState.activePlayListFolder` ngay dưới trong file này.
        await migrateActivePlayListFolderIfNeeded(); // core/file-manager/folder.js
        // Nạp giá trị đã lưu bền (nay CHẮC CHẮN đúng schema object nhờ migrate ngay trên) vào
        // appState — mọi chỗ đọc `activePlayListFolder[type]` ngay dưới trong file này (và về sau
        // ở event/workflow/playlist.js::switchSource()) đều qua appState, không tự getMeta()
        // riêng lẻ (cùng khuôn playlistConfig/playlistFilterConfig ngay trên).
        appState.set('activePlayListFolder', (await getMeta('activePlayListFolder')) || { song: null, video: null, photo: null });
        // XOÁ (29/08/2026) — comment cũ "Domain slideshow đã gộp vào visualBgConfig.slideshow (v13
        // Batch C)" không còn đúng — Motion tách hẳn thành hệ preset độc lập (migrate ở dòng
        // `workflowMotionPresets.loadPresetsOnBoot()` phía trên), không còn nhúng trong VBG.
        if (typeof loadSongStats === 'function') await loadSongStats();

        // MỚI (phản hồi Giang, mục 5 "Đồng bộ lại config Playlist Settings") — khôi phục
        // Nguồn/Sắp xếp/Kiểu xem đã lưu bền TRƯỚC KHI quyết định nạp playlistCache theo nguồn nào
        // ngay dưới đây (LƯU Ý THỨ TỰ, phản hồi Giang: bắt buộc biết `activeMediaSource` đã lưu
        // TRƯỚC khi nạp cache — đảo ngược thứ tự sẽ tái diễn đúng bug ở mục 7 dưới đây).
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

        // SỬA (fix bug "folder Video Apply -> Playlist trống", phản hồi Giang mục 7) — nạp ĐÚNG
        // playlistCache theo `activeMediaSource` vừa khôi phục ở trên, KHÔNG cố định Song.
        // SỬA (07/09/2026, "workflow chuẩn dùng chung app boot + chuyển Nguồn", rồi "folder scope
        // đúng ngay từ List step") — `applyFolderScope()`/`applyAllSongsScope()` (event/workflow/
        // playlist-scope.js) giờ tự lo TOÀN BỘ: nạp cache ĐÚNG phạm vi (folder đang nhớ cho Nguồn
        // này nếu có, chỉ đọc phần đó — không còn đọc dư cả thư viện rồi mới lọc) + Filter + render
        // + badge — gọi 1 TRONG 2 hàm này là ĐỦ cho cả 3 Nguồn, không cần bước nạp cache riêng nữa.
        const bootMediaSource = (typeof appState !== 'undefined') ? appState.get('activeMediaSource') : 'song';
        if (bootMediaSource === 'song') {
            // PHÒNG THỦ "Clear All bị gián đoạn" (đóng tab/crash giữa lúc đang xoá — xem comment
            // đầy đủ ở clearAllStoredData(), core/storage-manager.js) — CHỈ Song cần, chạy TRƯỚC
            // khi đọc playlist. clearAllStoredData() an toàn để gọi lại (idempotent).
            const wasClearing = await getMeta('clearingInProgress');
            if (wasClearing) {
                await withLoadingShield(t('common.playlist.cleaningUpPrevious'), async () => {
                    await clearAllStoredData();
                });
            }
        }
        // Progress "x/y bài" CHỈ cho Song (Video/Photo boot im lặng, như cũ) — showPlaylistLoading()
        // chỉ bật ở LẦN GỌI ĐẦU TIÊN của onProgress; thư viện/folder rỗng thì onProgress không bao
        // giờ được gọi (không có key nào để lặp) -> lớp loading tự nhiên KHÔNG hiện, không cần
        // pre-check số lượng riêng.
        let bootOnProgress;
        if (bootMediaSource === 'song') {
            let shownLoadingOverlay = false;
            bootOnProgress = (done, total) => {
                if (!shownLoadingOverlay) { showPlaylistLoading(0, total); shownLoadingOverlay = true; } // core/playlist/render.js — tự fade out khi DOM list dựng xong (updateEmptyState(), trong applyFolderScope()/applyAllSongsScope())
                updatePlaylistLoading(done, total);
            };
        }
        if (typeof workflowPlaylistScope !== 'undefined') {
            const folderIdForCurrentSource = appState.get('activePlayListFolder')[bootMediaSource];
            if (folderIdForCurrentSource) {
                await workflowPlaylistScope.applyFolderScope(folderIdForCurrentSource, bootMediaSource, bootOnProgress);
            } else {
                // Chạy dù không có Scope, để lọc Exclude (chỉ ảnh hưởng view "Tất cả") có tác dụng
                // đúng ngay từ lúc boot.
                await workflowPlaylistScope.applyAllSongsScope(bootMediaSource, bootOnProgress);
            }
        }
        // Cuộn tới bài vừa sửa phụ đề xong (quay lại từ subtitle-editor.html qua nút "←") — đặt
        // SAU CÙNG (đã nạp cache + khôi phục activePlayListFolder xong).
        if (typeof scrollToSongIfPending === 'function') scrollToSongIfPending();

        // XOÁ (30/07/2026, cùng ngày) — `workflowFileManagerVideo.regenerateAllVideoThumbFull()`
        // (thêm rồi xoá NGAY TRONG CÙNG NGÀY, chạy ngầm 1 lần lúc boot quét lại toàn bộ video cũ) —
        // Giang chốt: kỹ thuật chụp khung đầu robust (readyState>=2 + play()/pause() nudge) chỉ áp
        // dụng cho video UPLOAD MỚI (event/workflow/file-manager-video.js::_extractVideoThumbAndMeta()),
        // không cần thêm 1 lượt quét lại video cũ nữa — xem lịch sử đầy đủ ở file đó.

        // "Chốt fade out" lớp `showPlaylistLoading()` (core/playlist/render.js) — AN TOÀN kể cả khi
        // Nguồn boot không phải Song (chưa từng show()) hoặc render xong renderOrder vẫn rỗng (mọi
        // record hỏng — `updateEmptyState()` chỉ tự hide khi renderOrder > 0, xem hàm đó) —
        // hidePlaylistLoading() tự no-op nếu lớp chưa từng hiện/đã ẩn.
        hidePlaylistLoading(); // core/playlist/render.js

        // MỚI (phản hồi Giang — "shield loading không full-screen + Video không có shield") — báo
        // cho preloader full-screen (index.html, đầu <body>) biết Playlist đã THẬT SỰ dựng xong (renderOrder
        // đã render ra DOM, không chỉ script tải xong) — preloader tự ẩn NGAY khi nhận được tín hiệu
        // này (nếu script cũng đã tải xong). Đặt Ở ĐÂY — SAU CÙNG mọi bước dựng Playlist (kể cả
        // Scope/Filter/render DOM) — để không còn khoảng hở "list trống nhưng header/nút đã hiện".
        if (typeof window.markPlaylistBootReady === 'function') window.markPlaylistBootReady();
    },
};
