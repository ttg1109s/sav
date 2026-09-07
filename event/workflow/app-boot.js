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
        // ở event/workflow/playlist.js::switchToXSource()) đều qua appState, không tự getMeta()
        // riêng lẻ (cùng khuôn playlistConfig/playlistFilterConfig ngay trên).
        appState.set('activePlayListFolder', (await getMeta('activePlayListFolder')) || { song: null, video: null, photo: null });
        // XOÁ (29/08/2026) — comment cũ "Domain slideshow đã gộp vào visualBgConfig.slideshow (v13
        // Batch C)" không còn đúng — Motion tách hẳn thành hệ preset độc lập (migrate ở dòng
        // `workflowMotionPresets.loadPresetsOnBoot()` phía trên), không còn nhúng trong VBG.
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
            // MỚI (hợp nhất Photo vào Playlist) — cùng lý do nhánh 'video' ngay trên: nạp ĐÚNG
            // playlistCache theo type TRƯỚC khi bước Scope ngay dưới chạy, tránh applyFolderScope()
            // giao (intersect) nhầm với 1 cache khác type (SỬA 06/09/2026 — comment cũ ở đây từng
            // nói "Photo không có Folder Scope" — SAI/lỗi thời, Photo có Folder Scope đầy đủ y hệt
            // Song/Video, xem event/workflow/playlist-scope.js).
            buildPhotoPlaylistCache(await listImages()); // core có sẵn (core/file-manager/image.js + core/playlist/loader.js)
        } else {
            await initPlaylistFromDB();
        }
        // Khôi phục activePlayListFolder đã lưu bền (nếu có) NGAY SAU khi playlistCache đã đầy đủ
        // ĐÚNG nguồn ở trên.
        // SỬA (06/09/2026, đổi schema activePlayListFolder theo Nguồn — {song,video,photo}) — bỏ
        // hẳn khối VirtualMachineState 3 nhánh "sửa lệch type" cũ (mục 7): dữ liệu cũ 1 giá trị
        // PHẲNG có thể lệch type với `activeMediaSource` vừa khôi phục (vd folder Video nhưng
        // Nguồn lại là Song) vì bản chất chỉ có 1 chỗ lưu DÙNG CHUNG cho mọi Nguồn — schema MỚI
        // mỗi Nguồn có field RIÊNG, `persistScopeChoice()`/`applyFolderScope()` LUÔN ghi ĐÚNG field
        // theo type của chính folder đó (xem event/workflow/playlist-scope.js) nên lệch type không
        // còn xảy ra được nữa VỀ MẶT CẤU TRÚC — chỉ còn cần đọc ĐÚNG field của
        // `activeMediaSource` hiện tại rồi áp hoặc bỏ scope, không cần "sửa" gì thêm.
        if (typeof workflowPlaylistScope !== 'undefined') {
            const currentSource = appState.get('activeMediaSource');
            const folderIdForCurrentSource = appState.get('activePlayListFolder')[currentSource];
            if (folderIdForCurrentSource) {
                await workflowPlaylistScope.applyFolderScope(folderIdForCurrentSource, currentSource);
            } else {
                // MỚI (Batch 4, "Song/Video Unification" mục 5) — CẦN chạy dù không có Scope, để
                // lọc Exclude (chỉ ảnh hưởng view "Tất cả") có tác dụng đúng ngay từ lúc boot.
                await workflowPlaylistScope.applyAllSongsScope(currentSource);
            }
        }
        // MỚI (fix bug #1, phản hồi Giang — "Active folder vẫn hiện none dù có folder đang active")
        // — workflowPlaylist.syncPlaylistSettingsUI() (gọi TRONG loadPersistedPlaylistConfigOnBoot()
        // ở trên VÀ lúc nạp script core/playlist/main.js — tên cũ PlaylistMain.init(), đã BỎ 05/08/2026
        // theo Rule 3a) đều chạy TRƯỚC KHI activePlayListFolder được khôi phục XONG ở khối
        // if/else Scope ngay trên (SỬA 06/09/2026 — trước là VirtualMachineState.runAsync(), đã đơn
        // giản hoá cùng đợt đổi schema per-source, xem comment ngay trên) — badge/khoá Nguồn ở
        // Settings → Playlist vì vậy luôn hiện sai (mặc định rỗng) cho tới khi Giang tự đổi Scope 1
        // lần trong phiên. Gọi LẠI đúng 1 lần Ở ĐÂY, SAU CÙNG khối quyết định Scope, để phản ánh
        // đúng giá trị thật đã khôi phục.
        // SỬA (06/09/2026, Giang chỉ ra bug) — truy vấn LẠI DOM sống thay vì biến toàn cục
        // `mediaSourceSelect` (dom-refs.js) đã XOÁ, xem docstring updateActiveFolderUI()
        // (core/playlist/main.js). Lúc boot chắc chắn `null` (Settings chưa mở) — no-op đúng ý.
        if (typeof PlaylistMain !== 'undefined') await PlaylistMain.updateActiveFolderUI(genericDrawerBody.querySelector('#setting-playlist-media-source'));
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
