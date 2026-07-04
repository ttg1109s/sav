/**
 * Tham chiếu các phần tử DOM (getElementById) + toàn bộ biến trạng thái runtime toàn cục (audio, hiệu ứng, rubik, mưa phố, vortex...).
 * QUAN TRỌNG: phải nạp SAU KHI các component HTML (playlist-view, settings-drawer, ...) đã được chèn vào DOM, nếu không getElementById sẽ trả về null.
 * (Trích từ file gốc, dòng 26-99 trong khối <script>)
 * isGridView — STATE, xem service/state.js.
 */

        const fileInput = document.getElementById('audio-upload'), audioPlayer = document.getElementById('audio-player');
        // Input "Chọn cả thư mục" + "Chọn file nhạc" (ver 8 refine) — CẢ 2 đều nằm trong
        // #upload-action-menu (template playlist-view.js), mỗi input bọc trong 1 <label> riêng
        // (KHÔNG còn ở index.html ngoài #app-root, KHÔNG còn trigger bằng .click() qua JS — xem
        // comment ở playlist-view.js để biết lý do: 1 số trình duyệt/WebView chặn .click() gọi
        // gián tiếp lên input[type=file], chỉ click NATIVE thật lên label mới chắc chắn hoạt
        // động). Cùng xử lý chung qua handleAudioFiles() ở core/playlist/loader.js.
        const folderInput = document.getElementById('audio-upload-folder');
        const btnUploadAudio = document.getElementById('btn-upload-audio'), uploadActionMenu = document.getElementById('upload-action-menu');
        // Ver 12 "Multi Media" (plan-v12-multimedia.md mục 4.b1) — "Chọn nhiều" trong Playlist.
        const btnToggleSelection = document.getElementById('btn-toggle-selection');
        const selectionActionBar = document.getElementById('selection-action-bar'), selectionCountLabel = document.getElementById('selection-count-label');
        const btnSelectionMore = document.getElementById('btn-selection-more'), selectionMoreMenu = document.getElementById('selection-more-menu');
        // FIX (ver 8 refine #2): nếu 1 trong các id trên không khớp với template HTML thật (lỗi gõ
        // nhầm id, hoặc component nạp sai thứ tự khiến #app-root chưa có nội dung lúc dom-refs.js
        // chạy), getElementById trả về null — gọi .addEventListener trên null ở loader.js sẽ throw
        // ngay, dừng TOÀN BỘ script phía sau (kể cả core/playlist/visualizer chưa kịp nạp), đúng
        // triệu chứng "không tải được file/thư mục" (và mọi thứ khác) mà không rõ nguyên nhân. Log
        // rõ NGAY TẠI ĐÂY (đúng phần tử nào bị thiếu) trước khi lỗi mơ hồ xảy ra ở file khác.
        [['fileInput', fileInput, 'audio-upload'], ['folderInput', folderInput, 'audio-upload-folder'],
         ['btnUploadAudio', btnUploadAudio, 'btn-upload-audio'], ['uploadActionMenu', uploadActionMenu, 'upload-action-menu']]
            .forEach(([varName, el, id]) => {
                if (!el) console.error(`[dom-refs] KHÔNG tìm thấy #${id} trong DOM (biến ${varName} = null) — chức năng nạp nhạc sẽ lỗi ngay khi loader.js gắn event listener.`);
            });
        const canvas = document.getElementById('visualizer'), ctx = canvas.getContext('2d');
        const playlistView = document.getElementById('playlist-view'), visualizerUI = document.getElementById('visualizer-ui'), playerContainer = document.getElementById('player-container');
        const playlistBg = document.getElementById('playlist-bg');
        const playlistEmpty = document.getElementById('playlist-empty'), playlistContainer = document.getElementById('playlist-container');
        // 2 nút "Phát"/"Trộn bài" của empty-state (ver 11, cụm /event/ "playlistEmptyState") —
        // TRƯỚC ĐÂY dùng onclick="..." inline trong components/playlist-view.js (xem plan.md mục
        // 2b.8) — đã đổi sang id + addEventListener qua event/listener/playlist-empty-state.js.
        const btnPlaylistEmptyPlay = document.getElementById('btn-playlist-empty-play');
        const btnPlaylistEmptyShuffle = document.getElementById('btn-playlist-empty-shuffle');
        const btnBackPlaylist = document.getElementById('btn-back-playlist'), loadingShield = document.getElementById('loading-shield'), loadingText = document.getElementById('loading-text');
        const btnReturnVisual = document.getElementById('btn-return-visual');
        // "Control Center" của màn Visualizer (ver 8 refine) — thay cho dải dọc 6 nút cũ. Nút mở
        // ở góc trái, panel trượt từ trên xuống chứa grid icon; overlay mờ để bấm ra ngoài là đóng.
        const btnOpenControlCenter = document.getElementById('btn-open-control-center');
        const iconControlCenterDown = document.getElementById('icon-control-center-down');
        const controlCenterOverlay = document.getElementById('control-center-overlay');
        const visualizerControlCenter = document.getElementById('visualizer-control-center');
        
        const playPauseBtn = document.getElementById('play-pause-btn'), iconPlay = document.getElementById('icon-play'), iconPause = document.getElementById('icon-pause');
        const btnPrev = document.getElementById('btn-prev'), btnNext = document.getElementById('btn-next');
        const btnShuffle = document.getElementById('btn-shuffle'), btnRepeat = document.getElementById('btn-repeat'), repeatBadge = document.getElementById('repeat-badge');
        const progressBar = document.getElementById('progress-bar');
        const currentTimeDisplay = document.getElementById('current-time'), durationTimeDisplay = document.getElementById('duration-time');
        const playerTitle = document.getElementById('player-title'), playerArtist = document.getElementById('player-artist');
        const recordArt = document.getElementById('record-art'), recordContainer = document.getElementById('record-container');
        const statBpm = document.getElementById('stat-bpm'), statNote = document.getElementById('stat-note'), statEnergy = document.getElementById('stat-energy');
        // Toggle ẩn/hiện dải BPM/Pitch/Energy (ver 10 refine, bổ sung) — xem stats-panel-toggle.js.
        const statsPanel = document.getElementById('stats-panel');
        const btnToggleStatsPanel = document.getElementById('btn-toggle-stats-panel');
        const iconStatsPanelVisible = document.getElementById('icon-stats-panel-visible'), iconStatsPanelHidden = document.getElementById('icon-stats-panel-hidden');
        
        const drawerSettings = document.getElementById('drawer-settings'), btnSettings = document.getElementById('btn-settings'), btnSettingsPlaylist = document.getElementById('btn-settings-playlist'), closeDrawer = document.getElementById('close-drawer');
        // Drawer "Tùy chỉnh Visualizer" + "Tùy chỉnh Phụ đề" (ver 8 refine, mục 3) — cùng pattern
        // navigation stack với About/Storage Drawer, mở chồng lên #drawer-settings.
        const drawerVisualizerSettings = document.getElementById('drawer-visualizer-settings');
        const btnOpenVisualizerSettings = document.getElementById('setting-open-visualizer-settings');
        const btnBackVisualizerSettings = document.getElementById('btn-back-visualizer-settings');
        const visualizerTypeSelect = document.getElementById('setting-visualizer-type');
        const drawerSubtitleSettings = document.getElementById('drawer-subtitle-settings');
        const btnOpenSubtitleSettings = document.getElementById('setting-open-subtitle-settings');
        const btnBackSubtitleSettings = document.getElementById('btn-back-subtitle-settings');
        // Logo "SAV" góc trái Playlist (đối xứng với cụm icon góc phải).
        //
        // FIX (bug "bấm logo không ăn, có lúc bị zoom vào trang" — xem giải thích đầy đủ ở
        // comment trong playlist-view.js): bản trước dùng THUẦN CSS `:hover`/`group-hover`. Trên
        // mobile, phần tử này là <div> chữ thường (không phải <button>/<a>) — trình duyệt có thể
        // hiểu lầm 1 chạm là "double-tap vào đoạn văn bản" và ZOOM trang vào đúng đó, khiến toạ độ
        // Logo "SAV" — mở/thu chữ khi hover (desktop) hoặc tap (mobile). Logic ĐÃ CHUYỂN sang
        // core/sav-logo.js (cụm "savLogo", kiến trúc /event/) — chỉ giữ DOM ref ở đây theo đúng
        // quy ước "dom-refs.js là nơi DUY NHẤT gọi getElementById".
        const savLogo = document.getElementById('sav-logo');

        // Ver 10 refine: KHÔNG còn #btn-toggle-view/#icon-grid-view/#icon-list-view trong HTML —
        // "Kiểu xem" (grid/list) đã chuyển vào Settings (#setting-playlist-view-mode, xem
        // core/playlist/main.js: PlaylistMain.initViewMode()). Đã xoá 3 ref tương ứng ở đây.
        const btnCycleMode = document.getElementById('btn-cycle-mode'), modeBadge = document.getElementById('mode-badge');
        // "Tự động đổi hiệu ứng" (Settings, ver 10) — xem core/auto-switch-visual.js. FIX (kiến
        // trúc /event/, cụm "autoSwitchVisual"): 10 biến này TRƯỚC ĐÂY tự getElementById ngay
        // trong initAutoSwitchVisualUI() — vi phạm quy ước CHUNG. Gom về đây.
        const elAutoSwitchEnable = document.getElementById('setting-auto-switch-enable');
        const elAutoSwitchOptions = document.getElementById('auto-switch-options');
        const elAutoSwitchMode = document.getElementById('setting-auto-switch-mode');
        const elAutoSwitchTimeMode = document.getElementById('setting-auto-switch-time-mode');
        const elAutoSwitchBlockFixed = document.getElementById('auto-switch-time-fixed-block');
        const elAutoSwitchBlockRandom = document.getElementById('auto-switch-time-random-block');
        const elAutoSwitchBlockDuration = document.getElementById('auto-switch-time-duration-block');
        const elAutoSwitchSecondsFixed = document.getElementById('setting-auto-switch-seconds-fixed');
        const elAutoSwitchSecondsRandom = document.getElementById('setting-auto-switch-seconds-random');
        const elAutoSwitchSecondsDuration = document.getElementById('setting-auto-switch-seconds-duration');
        const qualitySelect = document.getElementById('setting-quality'), bgColorPicker = document.getElementById('bg-color-picker');
        const bgBlurSlider = document.getElementById('setting-bg-blur'), valBgBlurDisplay = document.getElementById('val-bg-blur');
        // MỚI (03/07/2026, mục 2) — Ảnh nền tĩnh cho màn Visualizer. FIX (04/07/2026, mục 1) — bỏ
        // ref nút "Chọn ảnh" riêng (đã xoá khỏi HTML, xem components/settings/playlist-background.js).
        const settingVisualBgImageEnableToggle = document.getElementById('setting-visual-bg-image-enable');
        const bgImageEnableToggle = document.getElementById('setting-bg-image-enable');
        const colorModeSelect = document.getElementById('setting-color-mode'), solidColorContainer = document.getElementById('solid-color-container'), solidColorPicker = document.getElementById('solid-color-picker'), solidColorText = document.getElementById('solid-color-text');
        const dynColorContainer = document.getElementById('dynamic-color-container'), dynColorA = document.getElementById('dyn-color-a'), dynColorB = document.getElementById('dyn-color-b');
        const maxHeightSlider = document.getElementById('setting-max-height'), barWidthSlider = document.getElementById('setting-bar-width'), valMaxDisplay = document.getElementById('val-max'), valWidthDisplay = document.getElementById('val-width');
        const blockMaxHeight = document.getElementById('block-max-height'), blockBarWidth = document.getElementById('block-bar-width');
        const blockVortex = document.getElementById('block-vortex'), vortexStyleSelect = document.getElementById('setting-vortex-style');
        const blockRain = document.getElementById('block-rain'), rainStyleSelect = document.getElementById('setting-rain-style'), glassFlashToggle = document.getElementById('setting-glass-flash');
        const blockBarStyle = document.getElementById('block-bar-style'), barStyleSelect = document.getElementById('setting-bar-style');
        const barMirrorOptions = document.getElementById('bar-mirror-options');
        const mirrorCountSlider = document.getElementById('setting-mirror-count'), valMirrorCountDisplay = document.getElementById('val-mirror-count');
        
        const volumeSlider = document.getElementById('setting-volume'), valVolumeDisplay = document.getElementById('val-volume');
        const eqSelect = document.getElementById('setting-eq'), eqSlidersWrapper = document.getElementById('eq-sliders-wrapper');

        const videoEnableToggle = document.getElementById('setting-video-enable'), videoUploadInput = document.getElementById('setting-video-upload'), bgVideoElement = document.getElementById('bg-video');
        // Nền tĩnh Visual (ảnh) — MỚI (batch 03/07/2026, hạ tầng z-index nền Visual).
        const visualBgImageElement = document.getElementById('visual-bg-image');
        // Slideshow nền Visual (nguồn nền thứ 3, Batch 8, ver 12 "Multi Media") — xem
        // core/file-manager/slideshow.js / event/workflow/slideshow.js.
        const slideshowContainer = document.getElementById('visual-slideshow-container');
        const slideshowLayer1 = document.getElementById('visual-slideshow-layer-1');
        const slideshowLayer2 = document.getElementById('visual-slideshow-layer-2');
        const btnOpenSlideshowSettings = document.getElementById('setting-open-slideshow-settings');
        const drawerSlideshowSettings = document.getElementById('drawer-slideshow-settings');
        const btnBackSlideshowSettings = document.getElementById('btn-back-slideshow-settings');
        // MỚI (Batch 9, 04/07/2026, mục 4) — toggle "Use slideshow" DUY NHẤT (THAY 2 nút "Chọn
        // Album"/"Tắt" cũ), hàng "album đang chạy" (bấm để mở lại panel đổi album) + panel chọn
        // Album kiểu "notify center" (xem components/slideshow-settings-drawer.js).
        const settingSlideshowEnableToggle = document.getElementById('setting-slideshow-enable');
        const slideshowSettingsAlbumName = document.getElementById('slideshow-settings-album-name');
        const slideshowCurrentAlbumRow = document.getElementById('slideshow-current-album-row');
        const slideshowCurrentAlbumThumb = document.getElementById('slideshow-current-album-thumb');
        const slideshowAlbumPickerOverlay = document.getElementById('slideshow-album-picker-overlay');
        const slideshowAlbumPickerPanel = document.getElementById('slideshow-album-picker-panel');
        const slideshowAlbumPickerGrid = document.getElementById('slideshow-album-picker-grid');
        const slideshowAlbumPickerEmpty = document.getElementById('slideshow-album-picker-empty');
        const slideshowModeSelect = document.getElementById('setting-slideshow-mode');
        const slideshowIntervalInput = document.getElementById('setting-slideshow-interval');
        const slideshowTransitionSelect = document.getElementById('setting-slideshow-transition');
        // "Tắt Visual" (ver 8 refine) — ĐỘC LẬP khỏi nhóm Video Background, đặt thành mục cài đặt
        // riêng (xem js/components/settings/playlist-background.js). id mới `setting-visual-enable`.
        const visualEnabledToggle = document.getElementById('setting-visual-enable');
        const keepScreenOnToggle = document.getElementById('setting-keep-screen-on');
        // Khắc phục sự cố (ver 10 refine, bổ sung) — xem js/core/app-recovery.js.
        const btnRestartApp = document.getElementById('setting-restart-app'), btnRestoreDefaults = document.getElementById('setting-restore-defaults');

        // Ngôn ngữ (Settings) — xem lang/language-settings.js.
        // FIX (kiến trúc /event/, cụm "languageSettings"): 3 biến này TRƯỚC ĐÂY tự getElementById
        // ngay trong lang/language-settings.js — vi phạm quy ước CHUNG (dom-refs.js PHẢI là nơi
        // DUY NHẤT gọi getElementById). Gom về đây.
        const settingLanguageSelect = document.getElementById('setting-language-select');
        const settingLanguageUpload = document.getElementById('setting-language-upload');
        const settingLanguageDelete = document.getElementById('setting-language-delete');

        const btnSubtitle = document.getElementById('btn-subtitle'), subToggleBadge = document.getElementById('sub-toggle-badge');
        const subtitleModal = document.getElementById('subtitle-modal'), btnCloseSubModal = document.getElementById('btn-close-sub-modal');
        const srtUpload = document.getElementById('srt-upload'), btnApplySub = document.getElementById('btn-apply-sub');
        const btnAddSub = document.getElementById('btn-add-sub'), btnExportSrt = document.getElementById('btn-export-srt');
        const subtitleDisplay = document.getElementById('subtitle-display'), subtitleFrame = document.getElementById('subtitle-frame'), subActiveLines = document.getElementById('sub-active-lines');
        const subListContainer = document.getElementById('sub-list-container'), subEmptyState = document.getElementById('sub-empty-state');
        const btnAutoTiming = document.getElementById('btn-auto-timing');
        const iconAutoTimingIdle = document.getElementById('icon-auto-timing-idle'), iconAutoTimingRecording = document.getElementById('icon-auto-timing-recording');
        // autoSubStartTime — STATE, xem service/state.js.

        // Toggle "Hiện phụ đề" (ver 8 refine) — chuyển từ #btn-toggle-sub trong modal sub về đây,
        // lưu vào vizConfig.subtitlesEnabled (xem equalizer-settings.js).
        const settingSubtitlesEnabled = document.getElementById('setting-subtitles-enabled');
        const settingSubBgColor = document.getElementById('setting-sub-bg-color'), settingSubBgOpacity = document.getElementById('setting-sub-bg-opacity'), valSubBgOpacity = document.getElementById('val-sub-bg-opacity');
        const settingSubBorderColor = document.getElementById('setting-sub-border-color'), settingSubBorderOpacity = document.getElementById('setting-sub-border-opacity'), valSubBorderOpacity = document.getElementById('val-sub-border-opacity');
        const settingSubBorderWidth = document.getElementById('setting-sub-border-width'), valSubBorderWidth = document.getElementById('val-sub-border-width');
        const settingSubBorderRadius = document.getElementById('setting-sub-border-radius'), valSubBorderRadius = document.getElementById('val-sub-border-radius');
        const settingSubTextColor = document.getElementById('setting-sub-text-color');
        const settingSubFontSize = document.getElementById('setting-sub-font-size'), valSubFontSize = document.getElementById('val-sub-font-size');
        const settingSubLineHeight = document.getElementById('setting-sub-line-height'), valSubLineHeight = document.getElementById('val-sub-line-height');
        const settingSubLetterSpacing = document.getElementById('setting-sub-letter-spacing'), valSubLetterSpacing = document.getElementById('val-sub-letter-spacing');

        let source; // biến NỘI BỘ (không thuộc STATE) — chỉ dùng trong audio-engine.js
        // audioContext, analyser, analyserPitch, animationId, masterGainNode, eqBandNodes,
        // isSeeking, dpr, currentObjectURL, currentCoverObjectURL, frameCounter, smoothedEnergy,
        // globalHueOffset, beatScale, vizDataArray, pitchTimeDomainArray, previousSpectrumArray,
        // beatTimes, fluxHistory — STATE, xem service/state.js.
        let smoothedBeatRadius = 0, smoothedPitchY = 0; // biến NỘI BỘ (không thuộc STATE)
        let lastBeatTime = 0, runningFluxMean = 0; // biến NỘI BỘ (không thuộc STATE)

        // currentModeIndex — STATE, xem service/state.js.
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        // stars, starFlashes, rubikCubes, rubikPitchHistory, rubikPitchAvg, raindrops, ripples,
        // glassStaticDrops, glassStreaks, cityBuildings, activeLightnings, streetLamps, streetRain,
        // streetGroundY — STATE, xem service/state.js.
        // (tunnelAngle, bgRaindrops — dead code: không được đọc/ghi ở bất kỳ đâu khác trong toàn
        // bộ project, đã xác nhận lúc dọn Patch K — xoá hẳn, không migrate.)
        let rubikRotX = 0, rubikRotY = 0, rubikAnim = { active: false, axis: 'x', layer: 0, angle: 0, dir: 1 }; // biến NỘI BỘ
        // Xoay TỰ THÂN của khối Rubik theo pitch (nốt nhạc):
        //   - rubikPitchHistory/rubikPitchAvg (STATE): nốt MIDI trung bình động gần đây, dùng làm
        //     "pha" tham chiếu — nốt hiện tại thấp hơn pha thì xoay chậm lại, cao hơn thì xoay nhanh lên.
        //   - rubikSelfSpinDirX/Y (biến NỘI BỘ): hướng xoay tự thân (1 hoặc -1) của mỗi trục, chọn
        //     ngẫu nhiên một lần khi khởi động rồi giữ cố định (chỉ tốc độ đổi theo nhạc, hướng
        //     không đảo liên tục).
        let rubikSelfSpinDirX = Math.random() > 0.5 ? 1 : -1, rubikSelfSpinDirY = Math.random() > 0.5 ? 1 : -1;
        // Xoay LỚP (kiểu 2) theo nốt cụ thể: mỗi 1 trong 12 nốt (C..B) map cố định ra 1 cặp
        // (trục x/y/z, lớp -1/0/1) — khi phát hiện nốt mới (đổi so với nốt vừa rồi) và năng lượng
        // nhạc đủ cao, kích hoạt lượt xoay lớp tương ứng thay cho chọn random như trước.
        const RUBIK_NOTE_TO_TURN = [
            { axis: 'x', layer: -1 }, { axis: 'x', layer:  0 }, { axis: 'x', layer:  1 }, // C, C#, D
            { axis: 'y', layer: -1 }, { axis: 'y', layer:  0 }, { axis: 'y', layer:  1 }, // D#, E, F
            { axis: 'z', layer: -1 }, { axis: 'z', layer:  0 }, { axis: 'z', layer:  1 }, // F#, G, G#
            { axis: 'x', layer: -1 }, { axis: 'y', layer:  1 }, { axis: 'z', layer:  0 }  // A, A#, B
        ];
        let rubikLastTurnNote = null; // biến NỘI BỘ (không thuộc STATE)

        // Rain - Street scene (đèn đường, hàng rào công viên, mưa phố)

        // ==========================================
        // VORTEX ENGINE (Three.js) — tScene, tCamera, tRenderer, tInitialized, tCurrentWarpZ
        // đều là STATE, xem service/state.js.
        // ==========================================

        // ===================== About Drawer (Về trình phát) =====================
        // FIX (kiến trúc /event/, cụm "settingsNav"): trước đây 3 biến này tự getElementById ngay
        // trong about-stats.js — vi phạm quy ước CHUNG (dom-refs.js PHẢI là nơi DUY NHẤT gọi
        // getElementById). Gom về đây, đúng style các khối khác. About là CHA của Storage trong
        // cây điều hướng Settings -> About -> Storage (xem khối Storage ngay dưới).
        const drawerAbout = document.getElementById('drawer-about');
        const btnOpenAbout = document.getElementById('setting-open-about');
        const btnBackAbout = document.getElementById('btn-back-about');
        const statAboutTotalSongs = document.getElementById('stat-about-total-songs');
        const statAboutTotalDuration = document.getElementById('stat-about-total-duration');
        const statAboutListenSeconds = document.getElementById('stat-about-listen-seconds');

        // ===================== Quản lý dung lượng (Storage Management) =====================
        // FIX (kiến trúc /event/): toàn bộ getElementById của cụm này TRƯỚC ĐÂY nằm rải rác ngay
        // trong storage-manager.js — vi phạm quy ước CHUNG của project là dom-refs.js PHẢI là nơi
        // DUY NHẤT gọi getElementById, mọi file khác chỉ dùng lại biến đã có ở đây. Gom về đúng 1
        // chỗ, theo đúng style các khối phía trên.
        // Ver 12 "Multi Media" — khung File Manager (THAY #drawer-storage/#btn-back-storage/
        // #setting-open-storage cũ, xem components/file-manager.js). Các id thống kê/dung lượng/
        // quét lỗi (stat-storage-*, btn-storage-*, storage-scan-*) GIỮ NGUYÊN bên dưới — không đổi.
        // Section "File Manager" trong Settings (3 hàng bấm vào) — CHỐT 03/07/2026, xem
        // plan-v12-multimedia-decisions.md mục 1a/7. Không còn overlay/tab-bar cấp cao nữa.
        const btnOpenFileManagerSong = document.getElementById('setting-open-file-manager-song');
        const btnOpenFileManagerPhoto = document.getElementById('setting-open-file-manager-photo');
        const btnOpenFileManagerDocument = document.getElementById('setting-open-file-manager-document');
        const drawerFileManagerSong = document.getElementById('drawer-file-manager-song');
        const btnBackFileManagerSong = document.getElementById('btn-back-file-manager-song');
        const drawerFileManagerPhoto = document.getElementById('drawer-file-manager-photo');
        const btnBackFileManagerPhoto = document.getElementById('btn-back-file-manager-photo');
        // Photo & Album — Batch 3 (03/07/2026)
        const btnFileManagerImageUploadTrigger = document.getElementById('btn-file-manager-image-upload-trigger');
        const fileManagerImageUploadInput = document.getElementById('file-manager-image-upload-input');
        const fileManagerAlbumStory = document.getElementById('file-manager-album-story');
        const fileManagerImageMasonry = document.getElementById('file-manager-image-masonry');
        const fileManagerImageEmpty = document.getElementById('file-manager-image-empty');
        // Photo & Album — batch tiếp theo (03/07/2026, mục 2.2/2.3): quản lý album đang lọc + chọn
        // nhiều ảnh để thêm vào album.
        const fileManagerAlbumManageBar = document.getElementById('file-manager-album-manage-bar');
        const fileManagerAlbumManageName = document.getElementById('file-manager-album-manage-name');
        const btnFileManagerAlbumAddImages = document.getElementById('btn-file-manager-album-add-images');
        // MỚI (Batch 8, slideshow) — "Dùng làm nền Slideshow" cho album đang lọc.
        const btnFileManagerAlbumSetSlideshowBg = document.getElementById('btn-file-manager-album-set-slideshow-bg');
        const btnFileManagerAlbumRename = document.getElementById('btn-file-manager-album-rename');
        const btnFileManagerAlbumDelete = document.getElementById('btn-file-manager-album-delete');
        const fileManagerImageSelectionBar = document.getElementById('file-manager-image-selection-bar');
        const fileManagerImageSelectionCount = document.getElementById('file-manager-image-selection-count');
        const btnFileManagerImageSelectionCancel = document.getElementById('btn-file-manager-image-selection-cancel');
        const btnFileManagerImageSelectionConfirm = document.getElementById('btn-file-manager-image-selection-confirm');
        const drawerFileManagerDocument = document.getElementById('drawer-file-manager-document');
        const btnBackFileManagerDocument = document.getElementById('btn-back-file-manager-document');
        const fileManagerNewFolderInput = document.getElementById('file-manager-new-folder-input');
        // Folder Detail Drawer (Phase 2, MỚI — mục 1b/c, CHỐT 03/07/2026)
        const drawerFileManagerFolderDetail = document.getElementById('drawer-file-manager-folder-detail');
        const btnBackFileManagerFolderDetail = document.getElementById('btn-back-file-manager-folder-detail');
        const fileManagerFolderDetailTitle = document.getElementById('file-manager-folder-detail-title');
        const btnFileManagerFolderApplyToPlaylist = document.getElementById('btn-file-manager-folder-apply-to-playlist');
        const fileManagerFolderDetailSongList = document.getElementById('file-manager-folder-detail-song-list');
        const fileManagerFolderDetailEmpty = document.getElementById('file-manager-folder-detail-empty');
        const btnFileManagerCreateFolder = document.getElementById('btn-file-manager-create-folder');
        const fileManagerFolderList = document.getElementById('file-manager-folder-list');
        const fileManagerFolderEmpty = document.getElementById('file-manager-folder-empty');
        const statStorageTotalSongs = document.getElementById('stat-storage-total-songs');
        const statStorageTotalBytes = document.getElementById('stat-storage-total-bytes');
        const btnDownloadThenClear = document.getElementById('btn-storage-download-then-clear');
        const btnClearNoDownload = document.getElementById('btn-storage-clear-no-download');
        const btnScanBroken = document.getElementById('btn-storage-scan-broken');
        const btnDeleteBroken = document.getElementById('btn-storage-delete-broken');
        const btnDismissScan = document.getElementById('btn-storage-dismiss-scan');
        const storageScanResult = document.getElementById('storage-scan-result');
        const storageScanSummary = document.getElementById('storage-scan-summary');
        const storageScanList = document.getElementById('storage-scan-list');

        // ===================== Playlist actions (menu 3 chấm, modal lỗi phát / sửa thông tin / thông tin chi tiết) =====================
        // FIX (kiến trúc /event/): toàn bộ getElementById của cụm này TRƯỚC ĐÂY nằm rải rác ngay
        // trong core/playlist/actions.js — vi phạm quy ước CHUNG của project là dom-refs.js PHẢI là nơi
        // DUY NHẤT gọi getElementById, mọi file khác chỉ dùng lại biến đã có ở đây. Gom về đúng 1
        // chỗ, theo đúng style các khối phía trên.
        //
        // NGOẠI LỆ CỐ Ý — KHÔNG đưa vào đây: #record-art. Phần tử này KHÔNG tĩnh — nó bị TẠO LẠI
        // HOÀN TOÀN mỗi lần đổi bài hát (core/playlist/actions.js gán recordContainer.innerHTML = ...,
        // xem window.playSong) và mỗi lần lưu sửa thông tin bài đang phát. Một biến `const` lấy 1
        // lần lúc khởi động (giống mọi biến khác trong file này) sẽ NHANH CHÓNG trở thành tham
        // chiếu tới 1 node đã bị gỡ khỏi DOM (stale reference) ngay sau lần đổi bài đầu tiên —
        // đây chính là lý do biến `recordArt` khai báo phía trên KHÔNG được dùng ở bất kỳ đâu
        // trong toàn project (dead code có từ trước patch này, không thuộc phạm vi dọn ở đây).
        // Mọi nơi cần truy cập #record-art (core/playlist/actions.js, đã tự document.getElementById
        // lại đúng lúc cần) tiếp tục làm vậy — đây là ngoại lệ HỢP LỆ của quy ước "dom-refs.js là
        // nơi DUY NHẤT gọi getElementById", áp dụng riêng cho phần tử bị tái tạo động qua innerHTML.
        const songActionMenu = document.getElementById('song-action-menu');
        const songActionOverlay = document.getElementById('song-action-overlay');
        const playbackErrorModal = document.getElementById('playback-error-modal');
        const playbackErrorFilename = document.getElementById('playback-error-filename');
        const btnPlaybackErrorKeep = document.getElementById('playback-error-keep');
        const btnPlaybackErrorDelete = document.getElementById('playback-error-delete');
        const songEditModal = document.getElementById('song-edit-modal');
        const songEditTitleInput = document.getElementById('song-edit-title');
        const songEditArtistInput = document.getElementById('song-edit-artist');
        const songEditAlbumInput = document.getElementById('song-edit-album');
        const songEditCoverPreview = document.getElementById('song-edit-cover-preview');
        const songEditCoverUploadInput = document.getElementById('song-edit-cover-upload');
        const songEditCoverPickLibraryBtn = document.getElementById('song-edit-cover-pick-library');
        const songEditCoverRemoveBtn = document.getElementById('song-edit-cover-remove');
        const songEditTabButtons = document.querySelectorAll('.song-edit-tab-btn');
        const songEditTabInfo = document.getElementById('song-edit-tab-info');
        const songEditTabCover = document.getElementById('song-edit-tab-cover');
        const btnSongEditCancel = document.getElementById('song-edit-cancel');
        const btnSongEditSave = document.getElementById('song-edit-save');
        const songInfoModal = document.getElementById('song-info-modal');
        const songInfoBody = document.getElementById('song-info-body');
        const btnSongInfoClose = document.getElementById('song-info-close');
        const btnSongInfoExport = document.getElementById('song-info-export');

        // ===================== Playlist main (sắp xếp, kiểu xem, ô tìm kiếm) =====================
        // FIX (kiến trúc /event/): toàn bộ getElementById của cụm này TRƯỚC ĐÂY nằm rải rác ngay
        // trong core/playlist/main.js — vi phạm quy ước CHUNG của project. Gom về đúng 1 chỗ.
        const sortSelect = document.getElementById('setting-playlist-sort-mode');
        const viewModeSelect = document.getElementById('setting-playlist-view-mode');
        const playlistSearchInput = document.getElementById('playlist-search-input');
        const playlistSearchClear = document.getElementById('playlist-search-clear');