/**
 * event/workflow/app-boot.js — chuỗi bước khởi động app (`app.boot` sau DOMContentLoaded). Thứ tự các bước có ràng buộc,
 * ghi ngay tại từng bước. Seed config chạy sớm hơn, lúc nạp core/config.js.
 */
const workflowAppBoot = {
    async boot() {
        // App luôn mở ở Playlist: đưa sân khấu Visualizer ra khỏi cây render ngay từ đầu.
        workflowPlayerControls.offstageVisualStageOnBoot();
        await loadConfig();
        workflowAutoSwitchVisual.syncLockedControls(); // event/workflow/auto-switch-visual.js — khoá đổi hiệu ứng tay theo Auto-Switch đã lưu
        workflowHud.syncSpeedUI(appConfigViz.getAll().playbackSpeed); // event/workflow/hud.js — badge tốc độ trên nút Speed
        // Kích hoạt style đã lưu (nhãn icon, vizConfig, scene WebGL nếu cần).
        workflowVisualizerRender.activateCurrentStyle(); // event/workflow/visualizer-render.js
        workflowSubtitleDisplay.initFromConfig(); // event/workflow/subtitle-display.js — cờ bật/tắt, style khung, karaoke
        // Gỡ Service Worker tải file lớn đời cũ còn sót trên máy (không await).
        this._retireLegacyDownloadServiceWorker();
        // Áp UI theme càng sớm càng tốt, trước khi Generic Drawer nào kịp mở; domain độc lập, không await.
        if (typeof workflowUiTheme !== 'undefined') workflowUiTheme.loadPersistedUiThemeOnBoot();
        // Tô nút nav tab Media ngay khung hình đầu (sau dòng nạp theme ở trên).
        workflowAppPanelNav.paintActiveTab('media'); // event/workflow/app-panel-nav.js
        // PHẢI chạy trước `workflowVisualBg.loadPersistedSettingsOnBoot()`: migrate cấu hình Motion cũ (nhúng trong
        // `meta.visualBgConfig.slideshow`) thành preset đầu tiên và ghi `motionPresetId` vào `meta.visualBgConfig`.
        if (typeof workflowMotionPresets !== 'undefined') await workflowMotionPresets.loadPresetsOnBoot();
        // Player display (Resolution + Motion lúc phát Video/Photo) — domain độc lập.
        if (typeof workflowPlayerDisplaySettings !== 'undefined') await workflowPlayerDisplaySettings.loadPersistedPlayerDisplayOnBoot();
        // Pagination — nạp trước khi danh sách phân trang nào kịp dựng (mọi danh sách dựng sau boot).
        if (typeof workflowPagination !== 'undefined') await workflowPagination.loadPersistedPaginationOnBoot();
        if (typeof workflowRecorder !== 'undefined') await workflowRecorder.loadPersistedConfigOnBoot(); // Ghi âm (meta.recorderConfig)
        // Performance HUD: khôi phục cấu hình + bật lại nếu lần trước đang bật. Không await — độc lập.
        if (typeof workflowPerfHud !== 'undefined') workflowPerfHud.loadPersistedConfigOnBoot(); // event/workflow/perf-hud.js
        // Không await: nền (kể cả video) áp ngầm, Playlist không phải chờ nền nạp xong.
        if (typeof workflowVisualBg !== 'undefined') workflowVisualBg.loadPersistedSettingsOnBoot();

        // Dọn 4 khoá meta mồ côi của cơ chế nền cũ (có bản sao Blob ảnh/video lớn). Không chặn boot.
        purgeVisualBgLegacyMeta(); // core/file-manager/cleanup.js
        // AWAIT: `workflowFolder.list()` giả định `meta.folderIndex` đã đúng — migrate xong TRƯỚC khi người dùng mở được
        // Folder Browser/Add to Folder; `activePlayListFolder` dạng cũ (string phẳng) -> {song,video,photo} TRƯỚC mọi chỗ
        // đọc field này ngay dưới.
        await workflowFolder.migrateOnBoot(); // event/workflow/folder.js
        // Nạp vào appState (schema object nhờ migrate ngay trên) — mọi chỗ đọc về sau đi qua appState.
        appState.set('activePlayListFolder', (await getMeta('activePlayListFolder')) || { song: null, video: null, photo: null });
        await workflowListenStats.loadAll(); // event/workflow/listen-stats.js — thống kê nằm trong meta từng media

        // Khôi phục Nguồn/Sắp xếp/Kiểu xem TRƯỚC khi nạp playlistCache — phải biết `activeMediaSource` trước.
        if (typeof workflowPlaylist !== 'undefined') await workflowPlaylist.loadPersistedPlaylistConfigOnBoot();
        // Khôi phục `playlistFilterConfig` TRƯỚC khối Scope ngay dưới (applyAllSongsScope()/applyFolderScope() lọc theo nó).
        if (typeof workflowPlaylist !== 'undefined') await workflowPlaylist.loadPersistedFilterConfigOnBoot();

        // Khôi phục 3 toggle Control Center (shuffle/repeat/stats) — độc lập với dòng trên.
        if (typeof workflowPlayerControls !== 'undefined') await workflowPlayerControls.loadPersistedPlayerConfigOnBoot();

        // Nạp/seed meta.eqPresets — await để appState.eqPresets sẵn sàng trước khi người dùng kịp bấm phát (audio graph
        // chỉ dựng ở lần phát đầu tiên).
        if (typeof workflowEqPresets !== 'undefined') await workflowEqPresets.loadPresetsOnBoot();

        // Khai báo Audio Session 'playback' TRƯỚC lần phát đầu tiên (iOS chọn loại session lúc bắt đầu phát).
        if (typeof workflowAppVisibility !== 'undefined') workflowAppVisibility.registerAudioSessionOnBoot(); // event/workflow/app-visibility.js

        // Nạp playlistCache theo `activeMediaSource` vừa khôi phục: applyFolderScope()/applyAllSongsScope()
        // (event/workflow/playlist-scope.js) tự lo nạp đúng phạm vi + Filter + render + badge cho cả 3 Nguồn.
        const bootMediaSource = (typeof appState !== 'undefined') ? appState.get('activeMediaSource') : 'song';
        if (bootMediaSource === 'song') {
            // Phòng thủ "Clear All bị gián đoạn" (đóng tab/crash giữa lúc xoá) — chạy lại trước khi đọc playlist;
            // clearAllStoredData() idempotent.
            const wasClearing = await getMeta('clearingInProgress');
            if (wasClearing) {
                await withLoadingShield(t('common.playlist.cleaningUpPrevious'), async () => {
                    await workflowFileManagerStorage.clearAllStoredData(); // event/workflow/file-manager-storage.js
                });
            }
        }
        // Progress "x/y bài" chỉ cho Song; hiện ở lần onProgress đầu tiên — thư viện/folder rỗng thì không bao giờ hiện.
        let bootOnProgress;
        if (bootMediaSource === 'song') {
            let shownLoadingOverlay = false;
            bootOnProgress = (done, total) => {
                if (!shownLoadingOverlay) { workflowPlaylistRender.showPlaylistLoading(0, total); shownLoadingOverlay = true; } // tự fade out khi list dựng xong
                updatePlaylistLoading(done, total);
            };
        }
        if (typeof workflowPlaylistScope !== 'undefined') {
            const folderIdForCurrentSource = appState.get('activePlayListFolder')[bootMediaSource];
            if (folderIdForCurrentSource) {
                await workflowPlaylistScope.applyFolderScope(folderIdForCurrentSource, bootMediaSource, bootOnProgress);
            } else {
                // Chạy cả khi không có Scope để lọc Exclude (chỉ ảnh hưởng view "Tất cả") đúng ngay từ boot.
                await workflowPlaylistScope.applyAllSongsScope(bootMediaSource, bootOnProgress);
            }
        }
        // Cuộn tới bài vừa sửa phụ đề (quay lại từ subtitle-editor.html) — sau khi đã nạp cache.
        workflowPlaylistRender.scrollToSongIfPending(); // event/workflow/playlist-render.js


        // Chốt ẩn lớp loading Playlist — no-op nếu chưa từng hiện (Nguồn không phải Song) hoặc đã ẩn.
        workflowPlaylistRender.hidePlaylistLoading(); // event/workflow/playlist-render.js

        // Ẩn preloader full-screen khi Playlist đã thật sự dựng xong — sau mọi bước Scope/Filter/render.
        hideAppPreloader(document.documentElement); // core/loading-shield-util.js
    },

    /** Gỡ Service Worker + cache tải file lớn đời cũ còn sót trên máy đã cài. Không có `navigator.serviceWorker`
     * (file://, HTTP thường) thì chưa từng cài -> bỏ qua. Xoá ở đợt 13 (ver 14). */
    _retireLegacyDownloadServiceWorker() {
        if (!navigator.serviceWorker) return;
        navigator.serviceWorker.getRegistrations()
            .then((registrations) => retireLegacyDownloadServiceWorker(registrations)) // core/file-manager/cleanup.js
            .catch((err) => console.warn('[app-boot] Không gỡ được Service Worker đời cũ (bỏ qua):', err));
    },
};
