/**
 * event/workflow/app-boot.js — chuỗi bước khởi động app (`app.boot` sau DOMContentLoaded). Thứ tự các bước có ràng buộc,
 * ghi ngay tại từng bước. Seed config chạy sớm hơn, lúc nạp core/config.js. Chạy sau khi MỌI script đã nạp nên gọi thẳng
 * mọi Workflow (không cần kiểm `typeof`).
 */
// Tiến trình nạp Playlist lúc boot — chỉ Song có lớp loading "x/y bài".
const BOOT_PLAYLIST_PROGRESS_BY_SOURCE = {
    song: () => workflowAppBoot._createSongLoadingProgress(),
    video: () => undefined,
    photo: () => undefined,
};

const workflowAppBoot = {
    async boot() {
        // App luôn mở ở Playlist: đưa sân khấu Visualizer ra khỏi cây render ngay từ đầu.
        workflowPlayerControls.offstageVisualStageOnBoot();
        await workflowConfig.loadOnBoot(); // event/workflow/config.js
        // Nền App Panel + nền màu Visualizer theo config vừa nạp (media nền đã resolve/fallback trong loadOnBoot()).
        workflowTheme.repaintAppBackground(); // event/workflow/theme.js
        workflowVisualBg.paintSolidBg(); // event/workflow/visual-bg-common.js
        workflowAutoSwitchVisual.syncLockedControls(); // event/workflow/auto-switch-visual.js — khoá đổi hiệu ứng tay theo Auto-Switch đã lưu
        workflowHud.syncSpeedUI(appConfigViz.getAll().playbackSpeed); // event/workflow/hud.js — badge tốc độ trên nút Speed
        // Kích hoạt style đã lưu (nhãn icon, vizConfig, scene WebGL nếu cần).
        workflowVisualizerRender.activateCurrentStyle(); // event/workflow/visualizer-render.js
        workflowSubtitleDisplay.initFromConfig(); // event/workflow/subtitle-display.js — cờ bật/tắt, style khung, karaoke
        // Áp UI theme càng sớm càng tốt, trước khi Generic Drawer nào kịp mở; domain độc lập, không await.
        workflowUiTheme.loadPersistedUiThemeOnBoot(); // event/workflow/ui-theme.js
        // Tô nút nav tab Media ngay khung hình đầu (sau dòng nạp theme ở trên).
        workflowAppPanelNav.paintActiveTab('media'); // event/workflow/app-panel-nav.js
        // PHẢI chạy trước `workflowVisualBg.loadPersistedSettingsOnBoot()`: migrate cấu hình Motion cũ (nhúng trong
        // `meta.visualBgConfig.slideshow`) thành preset đầu tiên và ghi `motionPresetId` vào `meta.visualBgConfig`.
        await workflowMotionPresets.loadPresetsOnBoot(); // event/workflow/motion-presets.js
        // Player display (Resolution + Motion lúc phát Video/Photo) — domain độc lập.
        await workflowPlayerDisplaySettings.loadPersistedPlayerDisplayOnBoot(); // event/workflow/player-display-settings.js
        // Pagination — nạp trước khi danh sách phân trang nào kịp dựng (mọi danh sách dựng sau boot).
        await workflowPagination.loadPersistedPaginationOnBoot(); // event/workflow/pagination.js
        await workflowRecorder.loadPersistedConfigOnBoot(); // event/workflow/recorder.js — meta.recorderConfig
        // Performance HUD: khôi phục cấu hình + bật lại nếu lần trước đang bật. Không await — độc lập.
        workflowPerfHud.loadPersistedConfigOnBoot(); // event/workflow/perf-hud.js
        // Không await: nền (kể cả video) áp ngầm, Playlist không phải chờ nền nạp xong.
        workflowVisualBg.loadPersistedSettingsOnBoot(); // event/workflow/visual-bg-common.js

        // Dọn 4 khoá meta mồ côi của cơ chế nền cũ (có bản sao Blob ảnh/video lớn). Không chặn boot.
        purgeVisualBgLegacyMeta(); // core/file-manager/cleanup.js
        // AWAIT: `workflowFolder.list()` giả định `meta.folderIndex` đã đúng — migrate xong TRƯỚC khi người dùng mở được
        // Folder Browser/Add to Folder; `activePlayListFolder` dạng cũ (string phẳng) -> {song,video,photo} TRƯỚC mọi chỗ
        // đọc field này ngay dưới.
        await workflowFolder.migrateOnBoot(); // event/workflow/folder.js
        // Nạp vào appState (schema object nhờ migrate ngay trên) — mọi chỗ đọc về sau đi qua appState.
        appState.set('activePlayListFolder', (await getMeta('activePlayListFolder')) || { song: null, video: null, photo: null });
        console.log(`writer: "workflowAppBoot.boot", page: "activePlayListFolder", content: "nạp từ meta"`);
        await workflowListenStats.loadAll(); // event/workflow/listen-stats.js — thống kê nằm trong meta từng media

        // Khôi phục Nguồn/Sắp xếp/Kiểu xem TRƯỚC khi nạp playlistCache — phải biết `activeMediaSource` trước.
        await workflowPlaylist.loadPersistedPlaylistConfigOnBoot(); // event/workflow/playlist.js
        // Khôi phục `playlistFilterConfig` TRƯỚC khối Scope ngay dưới (applyAllSongsScope()/applyFolderScope() lọc theo nó).
        await workflowPlaylist.loadPersistedFilterConfigOnBoot();

        // Khôi phục 3 toggle Control Center (shuffle/repeat/stats) — độc lập với dòng trên.
        await workflowPlayerControls.loadPersistedPlayerConfigOnBoot(); // event/workflow/player-controls.js

        // Nạp/seed meta.eqPresets — await để appState.eqPresets sẵn sàng trước khi người dùng kịp bấm phát (audio graph
        // chỉ dựng ở lần phát đầu tiên).
        await workflowEqPresets.loadPresetsOnBoot(); // event/workflow/eq-presets.js

        // Khai báo Audio Session 'playback' TRƯỚC lần phát đầu tiên (iOS chọn loại session lúc bắt đầu phát).
        workflowAppVisibility.registerAudioSessionOnBoot(); // event/workflow/app-visibility.js

        // Nạp playlistCache theo Nguồn + Scope vừa khôi phục (event/workflow/playlist-scope.js tự lo phạm vi + Filter + render +
        // badge cho cả 3 Nguồn; không có Scope vẫn chạy để lọc Exclude đúng ngay từ boot).
        const activeMediaSource = appState.get('activeMediaSource');
        await this._resumeInterruptedClearAll(activeMediaSource);
        await this._loadBootPlaylist(activeMediaSource);
        // Cuộn tới bài vừa sửa phụ đề (quay lại từ subtitle-editor.html) — sau khi đã nạp cache.
        workflowPlaylistRender.scrollToSongIfPending(); // event/workflow/playlist-render.js

        // Chốt ẩn lớp loading Playlist — no-op nếu chưa từng hiện (Nguồn không phải Song) hoặc đã ẩn.
        workflowPlaylistRender.hidePlaylistLoading(); // event/workflow/playlist-render.js

        // Ẩn preloader full-screen khi Playlist đã thật sự dựng xong — sau mọi bước Scope/Filter/render.
        hideAppPreloader(document.documentElement); // core/loading-shield-util.js
    },

    /** Phòng "Clear All bị gián đoạn" (đóng tab/crash giữa lúc xoá): chạy lại trước khi đọc playlist — chỉ Nguồn Song (cờ
     * `clearingInProgress`); clearAllStoredData() idempotent. @param {string} mediaSource */
    async _resumeInterruptedClearAll(mediaSource) {
        if (mediaSource !== 'song') return; // guard
        if (!(await getMeta('clearingInProgress'))) return; // guard — service/db.js
        await withLoadingShield(t('common.playlist.cleaningUpPrevious'), async () => { // core/loading-shield-util.js
            await workflowFileManagerStorage.clearAllStoredData(); // event/workflow/file-manager-storage.js
        });
    },

    /** Đọc Scope SAU bước Clear All dở dang (bước đó có thể xoá Scope đang nhớ). @param {string} mediaSource */
    async _loadBootPlaylist(mediaSource) {
        const folderId = appState.get('activePlayListFolder')[mediaSource];
        await workflowPlaylistScope.applyRememberedScope(folderId, mediaSource, BOOT_PLAYLIST_PROGRESS_BY_SOURCE[mediaSource]()); // event/workflow/playlist-scope.js
    },

    /** Tiến trình "x/y bài" lúc boot: lớp loading Playlist hiện ở lần báo đầu tiên (thư viện/folder rỗng thì không bao giờ hiện),
     * tự fade out khi list dựng xong. @returns {(done: number, total: number) => void} */
    _createSongLoadingProgress() {
        let shown = false;
        return (done, total) => {
            if (!shown) { workflowPlaylistRender.showPlaylistLoading(0, total); shown = true; } // event/workflow/playlist-render.js
            updatePlaylistLoading(done, total); // core/playlist/render.js
        };
    },
};
