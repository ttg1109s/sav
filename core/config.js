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
            bgColor: '#000000', solidColor: '#ffffff', dynA: '#ec4899', dynB: '#3b82f6',
            minH: 4, maxH: 400, barWidth: 4, bgImage: '', bgBlur: 0, bgImageEnabled: false,
            // 'light' | 'dark' | 'background' (ảnh nền tuỳ chỉnh, TỰ kéo theo bgImageEnabled=true) |
            // 'gradient' (2 màu gradientFrom/gradientTo ngay dưới) — chọn qua event/router/theme.js,
            // chốt tại event/workflow/theme.js::_commitThemeMode(). Mặc định 'dark'.
            themeMode: 'dark',
            gradientFrom: '#6366f1', gradientTo: '#ec4899',
            mirrorBarCount: 32,
            volume: 100, eqMode: 'flat', manualEq: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            videoBgEnabled: false, videoBgUrl: '',
            // Nền tĩnh CHO MÀN VISUALIZER (khác hẳn bgImage ở trên — nền cho màn Playlist). CÙNG
            // CƠ CHẾ HỆT bgImage/videoBgUrl: Blob thật lưu ở meta.visualBgImage (service/db.js),
            // field này CHỈ là blob: URL runtime resolve lại mỗi session (KHÔNG lưu trực tiếp, xem
            // flushConfigBackup() bên dưới).
            visualBgImageEnabled: false, visualBgImage: '',
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

        const DEFAULT_SLIDESHOW_CONFIG = {
            mode: 'sequential', // 'sequential' | 'random'
            intervalSeconds: 5, // tối thiểu 5s — CHỈ dùng khi photoPerSong=false
            transitionType: 'fade',
            photoPerSong: false, // true: đổi ảnh THEO bài hát (1 ảnh/1 bài), bỏ qua intervalSeconds
            kenBurnsEnabled: false, // pan/zoom chậm SUỐT thời gian hiển thị, ĐỘC LẬP với transitionType
            kenBurnsMode: 'zoomPanRandom', // 1 trong 13 SLIDESHOW_KENBURNS_MODES (core/file-manager/slideshow.js)
            transitionDurationMs: 1000, // TỔNG thời gian 1 lượt chuyển cảnh (1-60s)
            transitionInOutRatio: 50, // % thời gian dành cho pha "in" (layer mới)
            transitionEasing: 'ease', // 1 trong SLIDESHOW_TRANSITION_EASINGS
        };

        const DEFAULT_READER_CONFIG = {
            fontFamily: 'system-ui',
            fontSize: 18,
            bgColor: '#000000',
            textColor: '#ffffff',
            opacity: 0.85,
        };

        AppConfig.defineDomain('viz', {
            schema: {
                quality: 'string', type: 'string', barStyle: 'string', vortexStyle: 'string', rainStyle: 'string', glassFlash: 'boolean', mode: 'string',
                bgColor: 'string', solidColor: 'string', dynA: 'string', dynB: 'string',
                minH: 'number', maxH: 'number', barWidth: 'number', bgImage: 'string', bgBlur: 'number', bgImageEnabled: 'boolean',
                themeMode: 'string', gradientFrom: 'string', gradientTo: 'string',
                mirrorBarCount: 'number',
                volume: 'number', eqMode: 'string', manualEq: 'array',
                videoBgEnabled: 'boolean', videoBgUrl: 'string',
                visualBgImageEnabled: 'boolean', visualBgImage: 'string',
                visualEnabled: 'boolean',
                keepScreenOn: 'boolean',
                autoSwitchVisualEnabled: 'boolean', autoSwitchVisualMode: 'string', autoSwitchVisualTimeMode: 'string',
                autoSwitchVisualSecondsFixed: 'number', autoSwitchVisualSecondsRandom: 'number', autoSwitchVisualSecondsDuration: 'number',
                subtitlesEnabled: 'boolean', subtitleStyle: 'object',
            },
            defaults: DEFAULT_VIZ_CONFIG,
        });

        AppConfig.defineDomain('slideshow', {
            schema: {
                mode: 'string', intervalSeconds: 'number', transitionType: 'string', photoPerSong: 'boolean',
                kenBurnsEnabled: 'boolean', kenBurnsMode: 'string', transitionDurationMs: 'number',
                transitionInOutRatio: 'number', transitionEasing: 'string',
            },
            defaults: DEFAULT_SLIDESHOW_CONFIG,
        });

        AppConfig.defineDomain('reader', {
            schema: {
                fontFamily: 'string', fontSize: 'number', bgColor: 'string', textColor: 'string', opacity: 'number',
            },
            defaults: DEFAULT_READER_CONFIG,
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
            appConfig.seed('slideshow');
            appConfig.seed('reader');
        }
        seedConfig();

        /** Accessor tiện dụng, dùng khắp core/event cho 3 domain config — xem AppConfig.access(). */
        const appConfigViz = appConfig.access('viz');
        const appConfigSlideshow = appConfig.access('slideshow');
        const appConfigReader = appConfig.access('reader');

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
            const { bgImage, videoBgUrl, ...persistable } = appConfigViz.getAll(); // loại trừ blob: URL runtime
            setMeta('configBackup', persistable).catch(e => console.warn('[config] Lưu configBackup (IndexedDB) lỗi:', e));
        }

        /**
         * Đọc lại ảnh nền & video nền từ IndexedDB (meta.bgImage / meta.videoBg), tự sửa trạng
         * thái "on ảo" nếu config nói đang bật nhưng IndexedDB không còn Blob tương ứng.
         */
        async function loadBackgroundAssets() {
            const [imgBlob, videoBlob] = await Promise.all([
                getMeta('bgImage'),
                getMeta('videoBg')
            ]);

            appConfigViz.mutateAll(cfg => {
                if (cfg.bgImageEnabled && !imgBlob) {
                    cfg.bgImageEnabled = false;
                } else if (imgBlob && cfg.bgImageEnabled) {
                    cfg.bgImage = URL.createObjectURL(imgBlob);
                }

                if (cfg.videoBgEnabled && !videoBlob) {
                    cfg.videoBgEnabled = false;
                } else if (videoBlob && cfg.videoBgEnabled) {
                    cfg.videoBgUrl = URL.createObjectURL(videoBlob);
                }
            });

            videoEnableToggle.checked = appConfigViz.getAll().videoBgEnabled;
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

            // bgImage/videoBgUrl giờ là blob: URL runtime, tạo lại mỗi session từ IndexedDB — luôn
            // reset về rỗng TRƯỚC khi loadBackgroundAssets() đọc lại Blob thật.
            appConfigViz.mutateAll(cfg => { cfg.bgImage = ''; cfg.videoBgUrl = ''; });
            await loadBackgroundAssets();
            saveConfig();
            updatePlaylistBg();
            workflowTheme.refreshThemeCardUI();
            handleVideoBackground();

            volumeSlider.value = appConfigViz.getAll().volume; valVolumeDisplay.textContent = appConfigViz.getAll().volume + '%';
            if(appState.get('masterGainNode')) appState.get('masterGainNode').gain.value = appConfigViz.getAll().volume / 100;

            { let idx = MODES.indexOf(appConfigViz.getAll().type); if (idx === -1) idx = 0; appState.set('currentModeIndex', idx); }
            updateDOMBackground(); updatePlaylistBg(); updateColorMenuUI(); updateTypeUI();

            if (typeof initEqualizerUIFromConfig === 'function') initEqualizerUIFromConfig();
            if (typeof initVisualizerMiscSettingsUIFromConfig === 'function') initVisualizerMiscSettingsUIFromConfig();
            if (typeof initSubtitleToggleUIFromConfig === 'function') initSubtitleToggleUIFromConfig();
            if (typeof initAutoSwitchCycleButtonFromConfig === 'function') initAutoSwitchCycleButtonFromConfig();
        }
