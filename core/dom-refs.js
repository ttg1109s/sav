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
        // MỚI (07/07/2026, phản hồi Giang mục 2 — gộp Playlist+Settings) — khung cuộn ngang bọc
        // chung Playlist+Settings, xem components/app-view-stack.js.
        // HOTFIX 16 (08/07/2026) — thêm `appStack` (khung ngoài cùng, nhận lại toàn bộ transform/
        // vị trí responsive — xem assets/css/style.css) + `appBg` (lớp nền thuần, anh em với
        // `sideLeftContainer`, KHÔNG còn là hậu duệ của khung cuộn ngang nữa — xem docstring đầy
        // đủ ở components/app-view-stack.js). `sideLeftContainer` giờ CHỈ còn lo cuộn ngang.
        const appStack = document.getElementById('app-stack'), appBg = document.getElementById('app-bg');
        const sideLeftContainer = document.getElementById('side-left-container');
        const playlistView = document.getElementById('playlist-view'), visualizerUI = document.getElementById('visualizer-ui'), playerContainer = document.getElementById('player-container');
        // (playlistBg ĐÃ XOÁ — HOTFIX 15, 08/07/2026: div `#playlist-bg` riêng đã bỏ hẳn.
        // HOTFIX 16: background-image giờ set lên `appBg` (khai báo ngay trên, KHÔNG phải
        // `sideLeftContainer` như bản HOTFIX 15 ban đầu) — xem core/color-utils.js::
        // updatePlaylistBg().)
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
        // MỚI (04/07/2026, tính năng Documents) — nút mở Reader trong Control Center.
        const btnOpenDocumentReader = document.getElementById('btn-open-document-reader');
        const iconStatsPanelVisible = document.getElementById('icon-stats-panel-visible'), iconStatsPanelHidden = document.getElementById('icon-stats-panel-hidden');
        
        const drawerSettings = document.getElementById('drawer-settings'), btnSettingsPlaylist = document.getElementById('btn-settings-playlist'), closeDrawer = document.getElementById('close-drawer');
        // (btnSettings ĐÃ XOÁ — HOTFIX 11, 08/07/2026: nút "Cài đặt" trong Control Center của
        // Visualizer đã bỏ hẳn, xem components/visualizer-overlay.js. Settings giờ CHỈ mở được từ
        // Playlist qua btnSettingsPlaylist.)
        // Drawer "Tùy chỉnh Visualizer" + "Tùy chỉnh Phụ đề" (ver 8 refine, mục 3) — cùng pattern
        // navigation stack với About/Storage Drawer, mở chồng lên #drawer-settings.
        const drawerVisualizerSettings = document.getElementById('drawer-visualizer-settings');
        const btnOpenVisualizerSettings = document.getElementById('setting-open-visualizer-settings');
        // (btnBackVisualizerSettings ĐÃ XOÁ — Batch D3: Back dùng CHUNG btnSettingsStackBack.)
        const visualizerTypeSelect = document.getElementById('setting-visualizer-type');
        // (drawerSubtitleSettings/btnBackSubtitleSettings ĐÃ XOÁ — Batch D2: panel Subtitle giờ
        // động (core/settings-panel-stack.js), không còn drawer tĩnh riêng; Back dùng CHUNG
        // btnSettingsStackBack.) btnOpenSubtitleSettings GIỮ NGUYÊN — nút này vẫn tĩnh (Main).
        const btnOpenSubtitleSettings = document.getElementById('setting-open-subtitle-settings');
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
        // (10 const elAutoSwitch* ĐÃ XOÁ — Batch D3: section "Tự động đổi hiệu ứng" giờ sống động
        // BÊN TRONG panel Visualizer Settings, không còn DOM tĩnh — event/listener/auto-switch-
        // visual.js dùng delegation trên settingsStackBody thay vì đọc const ở đây.)
        const bgBlurSlider = document.getElementById('setting-bg-blur'), valBgBlurDisplay = document.getElementById('val-bg-blur');
        // MỚI (03/07/2026, mục 2) — Ảnh nền tĩnh cho màn Visualizer. FIX (04/07/2026, mục 1) — bỏ
        // ref nút "Chọn ảnh" riêng (đã xoá khỏi HTML, xem components/settings/playlist-background.js).
        const settingVisualBgImageEnableToggle = document.getElementById('setting-visual-bg-image-enable');
        // (bgImageEnableToggle ĐÃ XOÁ — 07/07/2026: checkbox "App background image" cũ không còn,
        // thay bằng 3 card Theme loại trừ nhau — xem components/settings/theme.js.)
        const themeModeCardLight = document.getElementById('theme-mode-card-light');
        const themeModeCardDark = document.getElementById('theme-mode-card-dark');
        const themeModeCardBackground = document.getElementById('theme-mode-card-background');
        const themeBgBlurRow = document.getElementById('theme-bg-blur-row');
        // MỚI (09/07/2026, mode "Gradient" riêng, phản hồi Giang mục 1) — card thứ 4, ĐỘC LẬP với
        // Background (ảnh) — xem components/settings/theme.js.
        const themeModeCardGradient = document.getElementById('theme-mode-card-gradient');
        const themeGradientRow = document.getElementById('theme-gradient-row');
        const themeGradientFromPicker = document.getElementById('setting-theme-gradient-from'), themeGradientToPicker = document.getElementById('setting-theme-gradient-to');
        // MỚI (09/07/2026, mục 2 — "card phản ánh ảnh/gradient được chọn") — 3 ref để
        // event/workflow/theme.js::refreshThemeCardUI() ghi trực tiếp background-image/gradient
        // THẬT vào mockup, thay vì mockup tĩnh cố định.
        const themeMockupBackground = document.getElementById('theme-mockup-background'), themeMockupBackgroundIcon = document.getElementById('theme-mockup-background-icon');
        const themeMockupGradient = document.getElementById('theme-mockup-gradient');
        // (qualitySelect/bgColorPicker/colorModeSelect/solidColor*/dynColor*/maxHeightSlider/
        // barWidthSlider/valMax.../blockMaxHeight/blockBarWidth/blockVortex/vortexStyleSelect/
        // blockRain/rainStyleSelect/glassFlashToggle/blockBarStyle/barStyleSelect/barMirrorOptions/
        // mirrorCountSlider/valMirrorCountDisplay ĐÃ XOÁ — Batch D3: toàn bộ panel Visualizer
        // Settings giờ sống động BÊN TRONG ngăn xếp, không còn DOM tĩnh — event/listener/
        // visualizer-display.js dùng delegation trên settingsStackBody thay vì đọc const ở đây.)
        
        const volumeSlider = document.getElementById('setting-volume'), valVolumeDisplay = document.getElementById('val-volume');
        const eqSelect = document.getElementById('setting-eq'), eqSlidersWrapper = document.getElementById('eq-sliders-wrapper');

        const videoEnableToggle = document.getElementById('setting-video-enable'), videoUploadInput = document.getElementById('setting-video-upload'), bgVideoElement = document.getElementById('bg-video');
        // Nền tĩnh Visual (ảnh) — MỚI (batch 03/07/2026, hạ tầng z-index nền Visual).
        // FIX (04/07/2026, mục 1a) — nền màu Settings (bgColor), TÁCH khỏi document.body.
        const visualizerSolidBg = document.getElementById('visualizer-solid-bg');
        const visualBgImageElement = document.getElementById('visual-bg-image');
        // Slideshow nền Visual (nguồn nền thứ 3, Batch 8, ver 12 "Multi Media") — xem
        // core/file-manager/slideshow.js / event/workflow/slideshow.js.
        const slideshowContainer = document.getElementById('visual-slideshow-container');
        const slideshowLayer1 = document.getElementById('visual-slideshow-layer-1');
        const slideshowLayer2 = document.getElementById('visual-slideshow-layer-2');
        // MỚI (Ken Burns, 18/07/2026) — layer CON bên trong mỗi slideshow-layer, mang
        // background-image + animation pan/zoom Ken Burns (TÁCH khỏi layer ngoài — layer ngoài chỉ
        // còn lo animation chuyển cảnh, xem docstring index.html/assets/css/slideshow.css).
        const slideshowLayer1Pan = document.getElementById('visual-slideshow-layer-1-pan');
        const slideshowLayer2Pan = document.getElementById('visual-slideshow-layer-2-pan');
        const btnOpenSlideshowSettings = document.getElementById('setting-open-slideshow-settings');
        // (drawerSlideshowSettings/btnBackSlideshowSettings ĐÃ XOÁ — Batch D4: panel Slideshow
        // Settings giờ động, không còn drawer tĩnh riêng; Back dùng CHUNG btnSettingsStackBack.)
        //
        // MỚI (Batch 9, 04/07/2026, mục 4) — panel chọn Album kiểu "notify center" — ĐỘC LẬP với
        // Settings Stack (KHÔNG di chuyển, xem components/slideshow-settings-drawer.js), 4 const
        // dưới đây GIỮ NGUYÊN tĩnh.
        // ĐÃ GỠ (Giai đoạn 4, rewrite Photo/Album, mục 1) — slideshowAlbumPickerOverlay/Panel/Grid/
        // Empty không còn tồn tại (panel chọn Album Slideshow giờ dùng Generic Drawer động, đọc lại
        // genericDrawerBody mỗi lần mở — xem event/workflow/slideshow.js::openAlbumPicker()).
        // (settingSlideshowEnableToggle/slideshowModeSelect/settingSlideshowPhotoPerSongToggle/
        // slideshowIntervalRow/slideshowIntervalInput/slideshowTransitionSelect
        // ĐÃ XOÁ — Batch D4: 5 input Settings giờ sống động BÊN
        // TRONG panel, không còn DOM tĩnh — event/listener/slideshow.js dùng delegation trên
        // settingsStackBody thay vì đọc const ở đây.)
        // "Tắt Visual" (ver 8 refine) — ĐỘC LẬP khỏi nhóm Video Background, đặt thành mục cài đặt
        // riêng (xem js/components/settings/playlist-background.js). id mới `setting-visual-enable`.
        const visualEnabledToggle = document.getElementById('setting-visual-enable');
        const keepScreenOnToggle = document.getElementById('setting-keep-screen-on');
        // Khắc phục sự cố (ver 10 refine, bổ sung) — xem js/core/app-recovery.js.
        const btnRestartApp = document.getElementById('setting-restart-app'), btnRestoreDefaults = document.getElementById('setting-restore-defaults'), btnClearCache = document.getElementById('setting-clear-cache');

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
        // (8 const settingSub*/valSub* ĐÃ XOÁ — Batch D2: 8 input style Subtitle giờ sống động
        // BÊN TRONG panel push/pop, không còn DOM tĩnh — event/listener/subtitle-style-
        // settings.js dùng delegation trên settingsStackBody thay vì đọc const ở đây.)

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

        // ===================== About (nay là 1 panel trong Settings Stack) =====================
        // Batch D1 (Settings restructure, phản hồi Giang 06/07/2026) — `drawer-about`/`btn-back-
        // about`/3 `stat-about-*` KHÔNG còn là DOM tĩnh nữa (About giờ là panel PUSH/POP động qua
        // core/settings-panel-stack.js, xem components/settings-drawer.js + about-drawer.js MỚI) —
        // BỎ HẲN 5 const cũ ở đây, vì lấy 1 lần lúc boot rồi sẽ tham chiếu tới DOM node đã bị
        // `.remove()` sau lần đóng About đầu tiên. 3 `stat-about-*` giờ được `querySelector` bên
        // TRONG panel vừa push, ngay tại nơi gọi (event/workflow/settings-misc.js::openAbout()) —
        // đúng quy ước Generic Drawer: "component tĩnh + dom-refs, nội dung động thì Workflow tự
        // querySelector sau khi gán". `btnOpenAbout` VẪN TĨNH (nút nằm trong Main, không bị xoá).
        const btnOpenAbout = document.getElementById('setting-open-about');

        // ===================== Settings Stack (khung dùng CHUNG mọi panel con) =====================
        // Batch D1 — SỬA GỐC thiết kế cũ (9 drawer con là sibling `fixed inset-0` riêng, phân biệt
        // bằng z-index) sang 1 khung #drawer-settings DUY NHẤT + ngăn xếp panel bên trong (xem
        // core/settings-panel-stack.js). `settingsStackBody` là điểm neo DUY NHẤT mà push/pop thao
        // tác — panel con (About, Visualizer sau này...) không tự biết #drawer-settings tồn tại.
        //
        // VIẾT LẠI (06/07/2026, phản hồi Giang — slider thật, header nhét vào từng panel):
        // `settingsStackTitle`/`btnSettingsStackBack` ĐÃ XOÁ — mỗi panel (kể cả Main) giờ TỰ MANG
        // header riêng (title + nút Back/Close NGAY TRONG THÂN panel), không còn 1 khối tiêu đề
        // TĨNH dùng chung nữa. Nút Back giờ là class `.settings-panel-back-btn` lặp lại ở MỌI
        // panel con (tạo/xoá theo từng lần push/pop) — nhận diện qua DELEGATION trên
        // `settingsStackBody`, xem event/listener/settings-stack-nav.js — KHÔNG còn 1 id tĩnh duy
        // nhất để gọi document.getElementById() ở đây được nữa.
        const settingsStackBody = document.getElementById('settings-stack-body');
        // `settingsStackPanelMain` — panel ĐÁY ngăn xếp (Main), TĨNH, KHÔNG BAO GIỜ bị xoá — core/
        // settings-panel-stack.js dùng làm phần tử KHỞI TẠO đầu tiên của `settingsPanelStackEntries`.
        const settingsStackPanelMain = document.getElementById('settings-stack-panel-main');
        // (settingsBg ĐÃ XOÁ — 07/07/2026: dùng CHUNG playlistBg với Playlist, xem components/
        // app-view-stack.js — không còn 2 phần tử nền riêng biệt cho 2 màn.)

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
        // MỚI (04/07/2026, mục 2 phản hồi Giang) — công cụ dọn rác chung File Manager.
        const btnFileManagerCleanupRun = document.getElementById('btn-file-manager-cleanup-run');
        // (drawerFileManagerSong/btnBackFileManagerSong ĐÃ XOÁ — Batch D5: panel Song giờ động,
        // Back dùng CHUNG btnSettingsStackBack.)
        // (drawerFileManagerPhoto/btnBackFileManagerPhoto ĐÃ XOÁ — Batch D6: panel Photo giờ
        // động, Back dùng CHUNG btnSettingsStackBack.)
        //
        // (btnFileManagerImageUploadTrigger/fileManagerImageUploadInput/fileManagerAlbumStory/
        // fileManagerImageMasonry/fileManagerImageEmpty/fileManagerAlbumManageBar/
        // fileManagerAlbumManageName/btnFileManagerAlbumAddImages/btnFileManagerAlbumSetSlideshowBg/
        // btnFileManagerAlbumRename/btnFileManagerAlbumDelete/fileManagerImageSelectionBar/
        // fileManagerImageSelectionCount/btnFileManagerImageSelectionCancel/
        // btnFileManagerImageSelectionConfirm ĐÃ XOÁ — Batch D6: toàn bộ panel-interior của Photo,
        // delegation trên settingsStackBody thay thế — xem event/listener/file-manager-photo.js.)
        // (drawerFileManagerDocument/btnFileManagerDocumentUpload/fileManagerDocumentUploadInput/
        // btnFileManagerDocumentCreate/fileManagerDocumentList/fileManagerDocumentEmpty ĐÃ XOÁ —
        // Batch D7 (batch CUỐI Nhóm D): panel Document giờ động, delegation trên settingsStackBody
        // thay thế — xem event/listener/file-manager-document.js.)
        // Nhóm A (10/07/2026, plan-v12-extended.md mục 2) — Generic Drawer (khung TRẮNG dùng
        // CHUNG cho Document List+Reader, THAY document-reader-*/document-picker-* cũ — xem
        // core/generic-drawer.js/components/generic-drawer.js). Header/Body RỖNG lúc boot —
        // Workflow (event/workflow/document-reader.js) tự gán nội dung + querySelector bên trong
        // để wire event MỖI LẦN render lại. SỬA (10/07/2026, phản hồi Giang): BỎ HẲN
        // `genericDrawerOverlay` (nền mờ che màn hình) — bản đầu có bug đóng drawer không xoá lại
        // `hidden` cho overlay, khiến nó che chắn UI mãi mãi sau lần đóng đầu tiên; Giang xác nhận
        // lớp này không cần thiết, bỏ hẳn khỏi component luôn (components/generic-drawer.js).
        // [KHÔI PHỤC 13/07/2026, Giang yêu cầu] — overlay quay lại, lần này core/generic-drawer.js
        // tự đồng bộ đúng nhịp mở/đóng (xem docstring đầu file đó), không lặp lại bug cũ.
        const genericDrawerOverlay = document.getElementById('generic-drawer-overlay');
        const genericDrawerPanel = document.getElementById('generic-drawer-panel');
        const genericDrawerHeader = document.getElementById('generic-drawer-header');
        const genericDrawerBody = document.getElementById('generic-drawer-body');
        // (btnBackFileManagerDocument ĐÃ XOÁ — Batch D7: Back dùng CHUNG btnSettingsStackBack.)
        // (fileManagerNewFolderInput ĐÃ XOÁ — Batch D5: panel Song giờ động.)
        //
        // (drawerFileManagerFolderDetail/btnBackFileManagerFolderDetail/fileManagerFolderDetailTitle/
        // btnFileManagerFolderApplyToPlaylist/fileManagerFolderDetailSongList/
        // fileManagerFolderDetailEmpty ĐÃ XOÁ — Batch D5: panel Folder Detail giờ động, Back dùng
        // CHUNG. `#file-manager-folder-detail-title` giờ nằm TRONG body panel — xem
        // event/workflow/file-manager-song.js::refreshFolderDetail().)
        //
        // (btnFileManagerCreateFolder/fileManagerFolderList/fileManagerFolderEmpty/
        // statStorageTotalSongs/statStorageTotalBytes/btnDownloadThenClear/btnClearNoDownload/
        // btnScanBroken/btnDeleteBroken/btnDismissScan/storageScanResult/storageScanSummary/
        // storageScanList ĐÃ XOÁ — Batch D5: tất cả panel-interior của Song, delegation trên
        // settingsStackBody thay thế — xem event/listener/file-manager-song.js.)


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
        const songEditCoverPickLibraryBtn = document.getElementById('song-edit-cover-pick-library');
        const songEditCoverRemoveBtn = document.getElementById('song-edit-cover-remove');
        const songEditTabButtons = document.querySelectorAll('.song-edit-tab-btn');
        // SỬA (10/07/2026, gộp song-info-modal vào làm tab đầu — phản hồi Giang): `songEditTabInfo`
        // (tab title/artist/album SỬA được) ĐỔI TÊN `songEditTabFields` — tên "info" giờ dành cho
        // tab MỚI (`songEditTabDetails`, đọc-thôi, gộp từ #song-info-modal cũ, ĐẶT ĐẦU/mặc định).
        // `songInfoModal`/`songInfoBody`/`btnSongInfoClose`/`btnSongInfoExport` ĐÃ XOÁ — không còn
        // modal riêng, nội dung populate thẳng vào `songEditTabDetails` trong openSongEditModal().
        const songEditTabDetails = document.getElementById('song-edit-tab-details');
        const songEditTabFields = document.getElementById('song-edit-tab-fields');
        const songEditTabCover = document.getElementById('song-edit-tab-cover');
        const btnSongEditCancel = document.getElementById('song-edit-cancel');
        const btnSongEditSave = document.getElementById('song-edit-save');

        // ===================== Playlist main (sắp xếp, kiểu xem, ô tìm kiếm) =====================
        // FIX (kiến trúc /event/): toàn bộ getElementById của cụm này TRƯỚC ĐÂY nằm rải rác ngay
        // trong core/playlist/main.js — vi phạm quy ước CHUNG của project. Gom về đúng 1 chỗ.
        const sortSelect = document.getElementById('setting-playlist-sort-mode');
        const viewModeSelect = document.getElementById('setting-playlist-view-mode');
        const playlistSearchInput = document.getElementById('playlist-search-input');
        const playlistSearchClear = document.getElementById('playlist-search-clear');