/**
 * core/config.js — TÁI CẤU TRÚC 25/07/2026 (đợt tái cấu trúc state). File này giờ CHỈ còn 2 việc:
 *   (1) Giữ 3 bản DEFAULT_VIZ_CONFIG/DEFAULT_SLIDESHOW_CONFIG/DEFAULT_READER_CONFIG (bản CHUẨN,
 *       ĐÃ GỘP — xem đối chiếu bên dưới) + đăng ký chúng làm domain của AppConfig
 *       (service/state.js) qua `AppConfig.defineDomain()`.
 *   (2) Toàn bộ hàm nghiệp vụ THUẦN xoay quanh config: `seedConfig()` (MỚI, seed lần đầu lúc
 *       boot — gọi từ event/workflow/app-boot.js), `restoreDefaultVizConfig()` (MỚI, gộp từ
 *       core/app-recovery.js::executeRestoreDefaults() — chỉ phần reset vizConfig, KHÔNG gồm
 *       saveConfig()/reload() — 2 việc đó vẫn ở app-recovery.js), `saveConfig()`/`loadConfig()`/
 *       2 hàm backup (giữ NGUYÊN vai trò/hành vi migrate cũ, chỉ đổi lớp truy cập từ
 *       `appState.get/set/mutate('vizConfig', ...)` sang `appConfigViz.getAll()/.setAll()/
 *       .mutateAll()` — cầu nối tương thích của AppConfig, xem service/state.js).
 *
 * FILE NÀY KHÔNG CÒN GIỮ GIÁ TRỊ RUNTIME NÀO — mọi giá trị SỐNG nằm trong `appConfig`
 * (service/state.js). Cũng KHÔNG CÒN giữ: global error-handler (dời sang
 * event/listener,router,workflow/app-boot.js — xem readme/event-bus-flow.md), Z_INDEX (dời sang
 * service/z-index.js — TRƯỚC đây object này chưa ai đọc thật, giờ 4 file overlay đã đổi qua đọc
 * thật), và 6 hằng số dùng chéo domain khác (MODES/PERFORMANCE_PROFILES/DEFAULT_VINYL/EQ_FREQS/
 * EQ_LABELS/EQ_PRESETS/APP_CONFIG — nay sống trong đúng package service/state/*.js tương ứng,
 * KHÔNG còn bản sao riêng ở đây — bản sao cũ CHÍNH LÀ nguồn gốc bug lệch dữ liệu đã phát hiện lúc
 * thảo luận đợt này: MODES thiếu 'space', PERFORMANCE_PROFILES thiếu 6 field galaxy* so với bản
 * đang dùng thật ở file này TRƯỚC KHI tái cấu trúc — giờ chỉ còn 1 nguồn duy nhất/domain).
 *
 * ĐỐI CHIẾU DEFAULT_VIZ_CONFIG (đợt tái cấu trúc 25/07/2026) — trước đây có 2 bản lệch nhau
 * (file này vs CONST.DEFAULT_VIZ_CONFIG cũ ở service/state.js): bản file này thiếu
 * `visualBgImageEnabled`/`visualBgImage` (thêm ở bản service/state.js, batch 03/07/2026) — bản
 * DƯỚI ĐÂY đã gộp đủ cả 2, dùng làm NGUỒN DUY NHẤT từ nay.
 *
 * PHẢI nạp SAU: service/state.js (cần class AppConfig).
 */

        const DEFAULT_VIZ_CONFIG = {
            quality: 'high', type: 'bar', barStyle: 'mirror', vortexStyle: 'rings', rainStyle: 'glass', glassFlash: true, mode: 'solid',
            // (bgColor XOÁ — v13: "màu nền màn Visualizer" đã dời sang `visualBgConfig` cùng 3
            //  nguồn nền kia, xem DEFAULT_VISUAL_BG_CONFIG. `solidColor` bên dưới là thứ KHÁC HẲN —
            //  màu vẽ của visualizer, không phải nền.)
            solidColor: '#ffffff', dynA: '#ec4899', dynB: '#3b82f6',
            minH: 4, maxH: 400, barWidth: 4, bgImage: '', bgBlur: 0, bgImageEnabled: false,
            // 'light' | 'dark' | 'background' (ảnh nền tuỳ chỉnh, TỰ kéo theo bgImageEnabled=true) |
            // 'gradient' (2 màu gradientFrom/gradientTo ngay dưới) — chọn qua event/router/theme.js,
            // chốt tại event/workflow/theme.js::_commitThemeMode(). Mặc định 'dark'.
            themeMode: 'dark',
            gradientFrom: '#6366f1', gradientTo: '#ec4899',
            mirrorBarCount: 32,
            volume: 100, eqMode: 'flat', manualEq: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            // XOÁ (v13 Batch A — "Visual Background unification"): videoBgEnabled/videoBgUrl/
            // visualBgImageEnabled/visualBgImage ĐÃ DỜI HẲN sang domain config RIÊNG `visualBg`
            // (DEFAULT_VISUAL_BG_CONFIG bên dưới) — 3 tính năng nền màn Visualizer (video nền/ảnh
            // nền tĩnh/slideshow album) gộp thành 1. KHÔNG giữ lại field cũ song song.
            visualEnabled: true,
            keepScreenOn: true,
            // Tự động đổi hiệu ứng Visualizer theo thời gian (ver 10) — xem core/auto-switch-visual.js.
            //   - autoSwitchVisualMode: 'sequential' (tuần tự/cố định theo MODES) | 'random'.
            //   - autoSwitchVisualTimeMode: 'fixed' (c1) | 'random' (c2) | 'duration' (c3).
            //   - 3 field SỐ GIÂY RIÊNG cho từng mode — KHÔNG dùng chung 1 field (bị ghi đè mất
            //     giá trị của mode khác mỗi khi đổi qua lại).
            autoSwitchVisualEnabled: false,
            autoSwitchVisualMode: 'sequential',
            autoSwitchVisualTimeMode: 'fixed',
            autoSwitchVisualSecondsFixed: 30,
            autoSwitchVisualSecondsRandom: 30,
            autoSwitchVisualSecondsDuration: 30,
            subtitlesEnabled: true,
            subtitleStyle: {
                bgColor: '#000000', bgOpacity: 0.4,
                borderColor: '#ffffff', borderOpacity: 0.1, borderWidth: 1, borderRadius: 16,
                textColor: '#ffffff', fontSize: 8, lineHeight: 1.3, letterSpacing: 0,
            },
        };

        // XOÁ (v13 Batch C) — `DEFAULT_SLIDESHOW_CONFIG` + domain `slideshow` ĐÃ GỘP HẲN vào
        // `DEFAULT_VISUAL_BG_CONFIG.slideshow` ngay bên dưới. 2 field `mode`/`photoPerSong` KHÔNG
        // được mang theo: chúng đã bị thay bởi `nextOrder`/`listPlaybackMode` ở PANEL CHA (Visual
        // Background) — dùng chung cho cả nhánh "theo từng bài" lẫn "trình chiếu", thay vì mỗi
        // nhánh một field riêng như trước.

        /**
         * MỚI (v13, plan-v13-visual-background-unification.md mục 1) — domain config RIÊNG cho
         * "Visual Background": GỘP 3 tính năng nền màn Visualizer từng rời rạc thành 1
         *   (1) Video nền tĩnh loop      — `vizConfig.videoBgEnabled/videoBgUrl` (ĐÃ XOÁ)
         *   (2) Ảnh nền tĩnh             — `vizConfig.visualBgImageEnabled/visualBgImage` (ĐÃ XOÁ)
         *   (3) Slideshow album ảnh      — domain `slideshow` + `appState.activeBackgroundAlbum` (ĐÃ XOÁ)
         * Domain RIÊNG (KHÔNG nhét lại vào `vizConfig`) đúng tinh thần "chọn domain phù hợp" đã
         * chốt ở DEFAULT_PLAYLIST_CONFIG/DEFAULT_PLAYER_CONFIG.
         *
         * KHÔNG MIGRATE dữ liệu cũ (Giang chốt) — người dùng cũ mở lại app sẽ thấy Visual
         * Background TẮT, chọn lại nguồn từ đầu. Lý do kỹ thuật cộng thêm: cơ chế cũ COPY Blob thô
         * vào `meta.videoBg`/`meta.visualBgImage` mà KHÔNG lưu key nguồn, nên `singleVideoKey`/
         * `singleImageKey` (tham chiếu bằng KEY, không phải bản sao Blob) vốn dĩ không thể suy ra
         * ngược từ dữ liệu cũ.
         *
         * PERSIST: `meta.visualBgConfig` (IndexedDB, cùng khuôn domain `slideshow` cũ) — đọc lại
         * lúc boot qua `workflowVisualBg.loadPersistedSettingsOnBoot()`. KHÔNG dùng lớp
         * localStorage như domain `viz` (tần suất đổi thấp, chỉ thao tác Settings thủ công).
         * KHÔNG field nào ở đây là blob: URL runtime — 2 object URL sống trong AppState
         * (`visualBgVideoObjectUrl`/`visualBgImageObjectUrl`, service/state/visual-bg.js), tạo lại
         * mỗi session từ KEY, nên toàn bộ object này persist được nguyên vẹn.
         */
        const DEFAULT_VISUAL_BG_CONFIG = {
            enabled: false,                 // toggle TỔNG — thay 3 toggle rời cũ
            // 'color' = KHÔNG ảnh/video, chỉ nền màu (đơn sắc hoặc gradient) — mặc định, thay chỗ
            // của `vizConfig.bgColor` cũ. Nền màu LUÔN được vẽ làm lớp dưới cùng kể cả khi đang
            // dùng ảnh/video, nên 3 field màu bên dưới có ý nghĩa ở MỌI mediaType.
            mediaType: 'color',             // 'color' | 'image' | 'video'
            sourceMode: 'single',           // 'single' | 'list'

            // Nguồn đã chọn. CHỈ field khớp mediaType×sourceMode hiện tại có ý nghĩa; 3 field còn
            // lại GIỮ NGUYÊN giá trị (không xoá) để đổi qua đổi lại không mất lựa chọn trước đó.
            singleImageKey: '',             // imageKey  — single + image
            singleVideoKey: '',             // videoKey  — single + video
            listAlbumId: null,              // albumId   — list + image (thay `activeBackgroundAlbum` cũ)
            listFolderId: null,             // folderId (type='video') — list + video

            // CHỈ đọc khi mediaType='image'. Video "list" chỉ có ĐÚNG 1 kiểu phát (loop + đổi theo
            // next/prev/end bài hát) nên KHÔNG có lựa chọn này.
            listPlaybackMode: 'perSong',    // 'perSong' | 'slideshow'
            // Quy tắc chọn NGUỒN KẾ TIẾP trong list — DÙNG CHUNG cho perSong/slideshow (ảnh) LẪN
            // list video. 'playlist' = áp cùng tiêu chí `appConfigPlaylist.displaySortMode`.
            nextOrder: 'random',            // 'random' | 'sequential' | 'playlist'

            // Sub-setting CHỈ dùng khi mediaType='image' + sourceMode='list' +
            // listPlaybackMode='slideshow' — thu gọn từ DEFAULT_SLIDESHOW_CONFIG cũ (BỎ mode/
            // photoPerSong: thay bằng nextOrder/listPlaybackMode ở trên).
            // ---- Nền MÀU (dời từ `vizConfig.bgColor`, mở rộng thêm gradient) ----
            colorMode: 'solid',             // 'solid' | 'gradient'
            solidColor: '#000000',          // == giá trị mặc định cũ của vizConfig.bgColor
            gradientAngleDeg: 180,          // góc xoay linear-gradient, 0 = từ dưới lên (chuẩn CSS)
            // 2..7 chặng màu. `position` là % TUYỆT ĐỐI trên trục gradient (0-100) — Giang chốt
            // dùng %, nên "tỉ lệ dải này so với dải kia" = hiệu 2 position liền nhau, người dùng
            // chỉnh trực tiếp bằng con số thay vì nhập tỉ lệ tương đối.
            gradientStops: [
                { color: '#000000', position: 0 },
                { color: '#1e3a8a', position: 100 },
            ],

            slideshow: {
                intervalSeconds: 5,
                transitionType: 'fade',
                transitionDurationMs: 1000,
                transitionInOutRatio: 50,
                transitionEasing: 'ease',
                kenBurnsEnabled: false,
                kenBurnsMode: 'zoomPanRandom',
            },
        };

        const DEFAULT_READER_CONFIG = {
            fontFamily: 'system-ui',
            fontSize: 18,
            bgColor: '#000000',
            textColor: '#ffffff',
            opacity: 0.85,
        };

        /**
         * MỚI (phản hồi Giang, mục 5 "Đồng bộ lại config Playlist Settings") — domain config RIÊNG
         * cho 3 lựa chọn ở Settings → Playlist (Nguồn/Kiểu xem/Sắp xếp, components/settings/
         * playlist-view.js) — trước đây 3 field này CHỈ sống trong AppState runtime
         * (activeMediaSource/isGridView/displaySortMode — service/state/playlist.js,
         * service/state/app-misc.js), KHÔNG hề được lưu bền, mất hết sau F5/mở lại app.
         * CHỦ Ý KHÔNG gồm 3 field "Giải phóng bộ nhớ" (mediaScope/downloadEnabled/deleteEnabled,
         * event/router/file-manager-song.js) — router đó ĐÃ CHỦ ĐỘNG reset 3 field này về mặc định
         * an toàn mỗi lần mở lại panel (comment gốc: "tránh quên đã bật sẵn 2 toggle nguy hiểm từ
         * lần mở trước") — đây là quyết định AN TOÀN đã có chủ đích cho 1 hành động PHÁ HUỶ DỮ LIỆU
         * (xoá/tải rồi xoá), lưu bền lại sẽ VÔ HIỆU HOÁ đúng lớp bảo vệ đó. Persist qua IndexedDB
         * trực tiếp (`meta.playlistConfig`), KHÔNG qua localStorage debounce như domain 'viz' — tần
         * suất đổi 3 field này thấp (thao tác Settings thủ công), cùng khuôn domain 'slideshow'
         * (event/workflow/slideshow.js::loadPersistedSettingsOnBoot()).
         */
        const DEFAULT_PLAYLIST_CONFIG = {
            activeMediaSource: 'song',
            displaySortMode: 'az',
            isGridView: false,
        };

        /**
         * MỚI (phản hồi Giang, mục 3 — "thêm nhớ trạng thái shuffle/repeat/stats của icon Control
         * Center visualizer") — domain config RIÊNG cho 3 icon toggle trong Visualizer Control
         * Center (`#btn-shuffle`/`#btn-repeat`/`#btn-toggle-stats-panel`, components/visualizer-
         * overlay.js) — trước đây `isShuffle`/`repeatMode` (package `shuffle-repeat`)/
         * `isStatsPanelVisible` (package `app-misc`) CHỈ sống trong AppState runtime, KHÔNG hề được
         * lưu bền, mất hết sau F5/mở lại app. Domain RIÊNG (không gộp vào `playlist`, dù cùng
         * khuôn) vì đây là nhóm preference của TRÌNH PHÁT (player controls), khác hẳn "duyệt/sắp
         * xếp Playlist" về mặt ý nghĩa — tách domain cho rõ, đúng tinh thần "chọn domain phù hợp"
         * Giang đã chốt ở mục 5 (Playlist Settings) trước đó.
         */
        const DEFAULT_PLAYER_CONFIG = {
            isShuffle: false,
            repeatMode: 0,
            isStatsPanelVisible: true,
        };

        AppConfig.defineDomain('viz', {
            schema: {
                quality: 'string', type: 'string', barStyle: 'string', vortexStyle: 'string', rainStyle: 'string', glassFlash: 'boolean', mode: 'string',
                solidColor: 'string', dynA: 'string', dynB: 'string',
                minH: 'number', maxH: 'number', barWidth: 'number', bgImage: 'string', bgBlur: 'number', bgImageEnabled: 'boolean',
                themeMode: 'string', gradientFrom: 'string', gradientTo: 'string',
                mirrorBarCount: 'number',
                volume: 'number', eqMode: 'string', manualEq: 'array',
                visualEnabled: 'boolean',
                keepScreenOn: 'boolean',
                autoSwitchVisualEnabled: 'boolean', autoSwitchVisualMode: 'string', autoSwitchVisualTimeMode: 'string',
                autoSwitchVisualSecondsFixed: 'number', autoSwitchVisualSecondsRandom: 'number', autoSwitchVisualSecondsDuration: 'number',
                subtitlesEnabled: 'boolean', subtitleStyle: 'object',
            },
            defaults: DEFAULT_VIZ_CONFIG,
        });

        AppConfig.defineDomain('visualBg', {
            schema: {
                enabled: 'boolean', mediaType: 'string', sourceMode: 'string',
                singleImageKey: 'string', singleVideoKey: 'string',
                listAlbumId: 'nullable-string', listFolderId: 'nullable-string',
                listPlaybackMode: 'string', nextOrder: 'string',
                colorMode: 'string', solidColor: 'string', gradientAngleDeg: 'number',
                gradientStops: 'object',
                slideshow: 'object',
            },
            defaults: DEFAULT_VISUAL_BG_CONFIG,
        });

        AppConfig.defineDomain('reader', {
            schema: {
                fontFamily: 'string', fontSize: 'number', bgColor: 'string', textColor: 'string', opacity: 'number',
            },
            defaults: DEFAULT_READER_CONFIG,
        });

        AppConfig.defineDomain('playlist', {
            schema: {
                activeMediaSource: 'string', displaySortMode: 'string', isGridView: 'boolean',
            },
            defaults: DEFAULT_PLAYLIST_CONFIG,
        });

        AppConfig.defineDomain('player', {
            schema: {
                isShuffle: 'boolean', repeatMode: 'number', isStatsPanelVisible: 'boolean',
            },
            defaults: DEFAULT_PLAYER_CONFIG,
        });

        /** Seed CẢ 3 domain config NGAY TẠI ĐÂY — lúc nạp core/config.js (SỬA 27/07/2026, trước
         * đây gọi trễ hơn từ event/workflow/app-boot.js lúc DOMContentLoaded, để hở 1 khoảng giữa
         * lúc tạo accessor bên dưới và lúc seed thật sự -> access() console.warn "chưa seed()" 3
         * lần mỗi lần boot dù KHÔNG có đọc/ghi nào thật sự xảy ra trong khoảng hở đó). Gọi TRƯỚC 3
         * dòng tạo accessor ngay dưới đây, nên `appConfigViz`/`appConfigSlideshow`/`appConfigReader`
         * luôn được tạo SAU KHI domain tương ứng đã seed — accessor không còn "rỗng" ngày nào nữa.
         * VẪN chạy TRƯỚC `loadConfig()` (gọi từ event/workflow/app-boot.js, còn xa mới nạp/chạy tới
         * — xem index.html) nên thứ tự "seed trước, merge localStorage đè lên sau" không đổi. */
        function seedConfig() {
            appConfig.seed('viz');
            appConfig.seed('visualBg');
            appConfig.seed('reader');
            appConfig.seed('playlist');
            appConfig.seed('player');
        }
        seedConfig();

        /** Accessor tiện dụng, dùng khắp core/event cho 5 domain config — xem AppConfig.access(). */
        const appConfigViz = appConfig.access('viz');
        const appConfigVisualBg = appConfig.access('visualBg');
        const appConfigReader = appConfig.access('reader');
        const appConfigPlaylist = appConfig.access('playlist');
        const appConfigPlayer = appConfig.access('player');

        /** Reset vizConfig về default (gộp từ core/app-recovery.js::executeRestoreDefaults() cũ —
         * CHỈ phần reset, KHÔNG gồm saveConfig()/reload(), 2 việc đó vẫn ở app-recovery.js). */
        function restoreDefaultVizConfig() {
            appConfigViz.restoreDefaults();
        }

        /**
         * LƯU CONFIG (v7) — 2 lớp: (1) localStorage — nguồn ghi chính, đồng bộ, tức thì; (2)
         * IndexedDB (meta.configBackup) — bản sao lưu, ghi debounce (2s yên tĩnh). KHÔNG backup
         * bgImage/videoBgUrl (blob: URL chỉ sống trong 1 session).
         */
        function saveConfig() {
            localStorage.setItem('visualMasterConfigV21', JSON.stringify(appConfigViz.getAll()));
            scheduleConfigBackup();
        }

        function scheduleConfigBackup() {
            taskManager.once(flushConfigBackup, 2000, 'configBackupFlush');
        }
        function flushConfigBackup() {
            taskManager.kill('configBackupFlush');
            const { bgImage, ...persistable } = appConfigViz.getAll(); // loại trừ blob: URL runtime
            setMeta('configBackup', persistable).catch(e => console.warn('[config] Lưu configBackup (IndexedDB) lỗi:', e));
        }

        /**
         * Đọc lại ẢNH NỀN PLAYLIST/APP từ IndexedDB (meta.bgImage), tự sửa trạng thái "on ảo" nếu
         * config nói đang bật nhưng IndexedDB không còn Blob tương ứng.
         * ĐỔI TÊN + THU HẸP (v13 Batch A) — trước đây tên `loadBackgroundAssets()` (số nhiều) vì
         * lo CẢ `meta.videoBg` (video nền màn Visualizer) — nhánh đó ĐÃ DỜI sang domain `visualBg`
         * (workflowVisualBg.loadPersistedSettingsOnBoot(), resolve từ `singleVideoKey` chứ không
         * còn đọc 1 bản sao Blob ở `meta.videoBg`). Tên mới phản ánh ĐÚNG việc còn lại: chỉ 1 asset,
         * chỉ ảnh nền Playlist.
         */
        async function loadPlaylistBgImageAsset() {
            const imgBlob = await getMeta('bgImage');
            appConfigViz.mutateAll(cfg => {
                if (cfg.bgImageEnabled && !imgBlob) {
                    cfg.bgImageEnabled = false;
                } else if (imgBlob && cfg.bgImageEnabled) {
                    cfg.bgImage = URL.createObjectURL(imgBlob);
                }
            });
        }

        /**
         * Đồng bộ TOÀN BỘ UI Cài đặt theo vizConfig hiện tại (sau khi nạp/migrate xong) — điều
         * phối duy nhất, gọi các hàm "init UI" của TỪNG MODULE CON qua guard `typeof === 'function'`.
         */
        async function loadConfig() {
            let saved = localStorage.getItem('visualMasterConfigV21') || localStorage.getItem('visualMasterConfigV20');
            // FALLBACK (v7): localStorage rỗng NHƯNG IndexedDB còn bản backup -> phục hồi NGAY vào
            // localStorage rồi nạp tiếp như thường.
            if (!saved) {
                try {
                    const backup = await getMeta('configBackup');
                    if (backup && typeof backup === 'object') {
                        saved = JSON.stringify(backup);
                        localStorage.setItem('visualMasterConfigV21', saved);
                        console.warn('[config] localStorage rỗng — đã phục hồi cấu hình từ bản backup IndexedDB.');
                    }
                } catch (e) { console.warn('[config] Không đọc được configBackup (IndexedDB):', e); }
            }
            if (saved) { try { appConfigViz.setAll({ ...appConfigViz.getAll(), ...JSON.parse(saved) }); } catch(e) {} }
            appConfigViz.mutateAll(cfg => {
                if(!cfg.manualEq) cfg.manualEq = [0,0,0,0,0,0,0,0,0,0];
                if(cfg.vortexStyle === 'tardis' || cfg.vortexStyle === 'classic' || cfg.vortexStyle === 'dust') cfg.vortexStyle = 'rings';
                // Cấu hình cũ từng có rainStyle 'classic', visualizer 'synthesia'/'firefly_forest'/'seasons'/'wave' đã
                // bị loại bỏ — quy về giá trị tương đương gần nhất để không vỡ trải nghiệm của người dùng cũ.
                if (cfg.rainStyle === 'classic') cfg.rainStyle = 'glass';
                if (cfg.type === 'synthesia') { cfg.type = 'bar'; cfg.barStyle = 'cascade'; }
                if (cfg.type === 'firefly_forest' || cfg.type === 'seasons' || cfg.type === 'wave') cfg.type = 'bar';
                if (!cfg.barStyle) cfg.barStyle = 'mirror';
                if (cfg.mirrorBarCount == null) cfg.mirrorBarCount = 32;
                if (cfg.bgImageEnabled == null) cfg.bgImageEnabled = false;
                // Người dùng CŨ đã bật sẵn ảnh nền trước khi có khái niệm Theme -> suy luận
                // themeMode='background' luôn.
                if (cfg.themeMode == null) cfg.themeMode = cfg.bgImageEnabled ? 'background' : 'dark';
                if (!cfg.gradientFrom) cfg.gradientFrom = DEFAULT_VIZ_CONFIG.gradientFrom;
                if (!cfg.gradientTo) cfg.gradientTo = DEFAULT_VIZ_CONFIG.gradientTo;
                if (cfg.keepScreenOn == null) cfg.keepScreenOn = true;
                if (cfg.subtitlesEnabled == null) cfg.subtitlesEnabled = true;
                if (cfg.visualEnabled == null) cfg.visualEnabled = true;
                // Auto-switch-visual (ver 10) — migrate field mới + validate lại ngưỡng tối thiểu.
                if (cfg.autoSwitchVisualEnabled == null) cfg.autoSwitchVisualEnabled = false;
                if (cfg.autoSwitchVisualMode !== 'sequential' && cfg.autoSwitchVisualMode !== 'random') cfg.autoSwitchVisualMode = 'sequential';
                if (!['fixed', 'random', 'duration'].includes(cfg.autoSwitchVisualTimeMode)) cfg.autoSwitchVisualTimeMode = 'fixed';
                // MIGRATE field cũ `autoSwitchVisualSeconds` (nếu config cũ còn sót lại) sang cả 3 field mới.
                if (typeof cfg.autoSwitchVisualSeconds === 'number') {
                    if (cfg.autoSwitchVisualSecondsFixed == null) cfg.autoSwitchVisualSecondsFixed = cfg.autoSwitchVisualSeconds;
                    if (cfg.autoSwitchVisualSecondsRandom == null) cfg.autoSwitchVisualSecondsRandom = cfg.autoSwitchVisualSeconds;
                    if (cfg.autoSwitchVisualSecondsDuration == null) cfg.autoSwitchVisualSecondsDuration = cfg.autoSwitchVisualSeconds;
                    delete cfg.autoSwitchVisualSeconds;
                }
                ['autoSwitchVisualSecondsFixed', 'autoSwitchVisualSecondsRandom', 'autoSwitchVisualSecondsDuration'].forEach((field) => {
                    if (typeof cfg[field] !== 'number' || cfg[field] < AUTO_SWITCH_VISUAL_MIN_SECONDS) {
                        cfg[field] = Math.max(AUTO_SWITCH_VISUAL_MIN_SECONDS, DEFAULT_VIZ_CONFIG[field]);
                    }
                });
                if (!cfg.subtitleStyle) cfg.subtitleStyle = { ...DEFAULT_VIZ_CONFIG.subtitleStyle };
                else cfg.subtitleStyle = { ...DEFAULT_VIZ_CONFIG.subtitleStyle, ...cfg.subtitleStyle };
                // Cấu hình cũ (trước khi thang cỡ chữ đổi thành 8-16px) có thể đã lưu giá trị lớn hơn.
                cfg.subtitleStyle.fontSize = Math.min(16, Math.max(8, cfg.subtitleStyle.fontSize));
            });

            bgBlurSlider.value = appConfigViz.getAll().bgBlur; valBgBlurDisplay.textContent = appConfigViz.getAll().bgBlur + 'px';

            // bgImage là blob: URL runtime, tạo lại mỗi session từ IndexedDB — luôn reset về rỗng
            // TRƯỚC khi loadPlaylistBgImageAsset() đọc lại Blob thật.
            // (v13 Batch A — `videoBgUrl` KHÔNG còn ở đây; video nền màn Visualizer do domain
            // `visualBg` tự resolve/áp dụng, xem event/workflow/visual-bg.js.)
            appConfigViz.mutateAll(cfg => { cfg.bgImage = ''; });
            await loadPlaylistBgImageAsset();
            saveConfig();
            updatePlaylistBg();
            workflowTheme.refreshThemeCardUI();

            volumeSlider.value = appConfigViz.getAll().volume; valVolumeDisplay.textContent = appConfigViz.getAll().volume + '%';
            if(appState.get('masterGainNode')) appState.get('masterGainNode').gain.value = appConfigViz.getAll().volume / 100;

            { let idx = MODES.indexOf(appConfigViz.getAll().type); if (idx === -1) idx = 0; appState.set('currentModeIndex', idx); }
            updateDOMBackground(); updatePlaylistBg(); updateColorMenuUI(); updateTypeUI();

            if (typeof initEqualizerUIFromConfig === 'function') initEqualizerUIFromConfig();
            if (typeof initVisualizerMiscSettingsUIFromConfig === 'function') initVisualizerMiscSettingsUIFromConfig();
            if (typeof initSubtitleToggleUIFromConfig === 'function') initSubtitleToggleUIFromConfig();
            if (typeof initAutoSwitchCycleButtonFromConfig === 'function') initAutoSwitchCycleButtonFromConfig();
        }
