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
         * v14 — Visual Background hợp nhất về ĐÚNG 1 đường source (Giang chốt, thay bản v13 4-field
         * song song enabled/mediaType/sourceMode/single*Key/list*Id).
         *
         * `source.list` là bản COPY key (imageKey/videoKey) tại THỜI ĐIỂM chọn — tách hẳn khỏi
         * album/folder gốc, chỉ đổi khi bấm "Làm tươi". 3 trạng thái tự suy ra từ SỐ LƯỢNG phần tử
         * còn sống trong list (không có field `enabled` riêng nữa):
         *   0 item  -> ẩn hẳn media, chỉ còn nền màu
         *   1 item  -> phát tĩnh, không cycle (dù origin là group)
         *   >1 item -> cycle theo `listPlaybackMode`/`nextOrder`
         * `source.list` có thể chứa `null` (key đã bị xoá, chờ dọn — xem advanceVisualBgList() core/
         * visual-bg.js).
         *
         * Màu (colorMode/solidColor/gradient*) tách hẳn khỏi source ảnh/video — mục riêng, LUÔN có
         * hiệu lực làm lớp dưới cùng, không phụ thuộc `type`/source rỗng hay không.
         *
         * KHÔNG MIGRATE dữ liệu v13 (đổi cấu trúc field hoàn toàn) — mở lại app sẽ thấy chưa chọn
         * nguồn, chọn lại từ đầu. PERSIST: `meta.visualBgConfig`, đọc lại lúc boot qua
         * `workflowVisualBg.loadPersistedSettingsOnBoot()`.
         */
        const DEFAULT_VISUAL_BG_CONFIG = {
            type: 'photo',                  // 'photo' | 'video' — đổi type = gỡ hẳn source cũ (khác kiểu key)

            source: {
                originKind: null,           // null | 'single' | 'group' — CHỈ để nút "Làm tươi" biết đọc lại từ đâu
                originId: null,             // imageKey/videoKey/albumId/folderId của origin
                list: [],                   // bản copy key thật đang phát/hiện
                // MỚI (08/08/2026, phản hồi Giang) — map videoKey -> { enabled, volumePercent }. CHỈ
                // có ý nghĩa khi `type==='video'` (áp dụng CẢ single lẫn list, Giang chốt) — video
                // đang phát nền có audio riêng (KHÔNG qua equalizer/audioEngine, phát native dưới
                // audio chính) khi `enabled=true`. Giữ NGUYÊN khi đổi source (self-heal lười, key
                // không còn dùng chỉ nằm im vô hại, không tự dọn — cùng triết lý null-sweep chỗ khác).
                // XOÁ HẲN khi `type` đổi hoặc `clearSource()` (source bị reset toàn bộ, key video
                // khác kiểu vô nghĩa). Xem core/visual-bg.js::getVisualBgVideoAudioSetting()/
                // setVisualBgVideoAudioSetting(), event/workflow/visual-bg.js (panel "Âm thanh Video").
                videoAudio: {},
            },

            // MỚI (09/08/2026, phản hồi Giang — "đổi nguồn giữa lúc đang cycle làm giật/mất khung
            // đang phát") — nguồn MỚI chọn/Làm tươi TRONG LÚC đang có media active (photo/video)
            // không ghi đè `source` ngay — xếp hàng ở đây, đợi đúng "lượt kế tiếp" (video hết/đổi
            // bài hát, hoặc tick slideshow kế) mới thật sự thay `source`, xem
            // `workflowVisualBg._checkAndApplyPendingSource()`. `originKind===null` = không có gì
            // đang chờ. Chọn nguồn mới trong lúc pending cũ CHƯA kịp áp -> ĐÈ LUÔN (Giang chốt, chỉ
            // giữ 1 pending duy nhất). List RỖNG (không có gì đang chạy) thì bỏ qua cơ chế này, áp
            // thẳng như trước — không có gì để "chờ" cả.
            pending: {
                originKind: null,           // null | 'single' | 'group'
                originId: null,
                list: [],                   // đã resolve sẵn (key thật) lúc queue — áp KHÔNG đọc lại DB lần 2
            },

            listPlaybackMode: 'perSong',    // 'perSong' | 'slideshow' — chỉ có ý nghĩa khi list.length > 1
            nextOrder: 'random',            // 'random' | 'sequential' | 'playlist' — thứ tự dựng list lúc chọn/Làm tươi + bước cycle

            // ---- Nền MÀU — độc lập, luôn active ----
            colorMode: 'solid',             // 'solid' | 'gradient'
            solidColor: '#000000',
            gradientAngleDeg: 180,
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
                type: 'string',
                source: 'object', // { originKind: nullable-string, originId: nullable-string, list: array }
                pending: 'object', // { originKind: nullable-string, originId: nullable-string, list: array } — xem DEFAULT_VISUAL_BG_CONFIG.pending
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
