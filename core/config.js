/**
 * Hằng số cấu hình toàn cục: APP_CONFIG, PERFORMANCE_PROFILES, danh sách EQ, MODES, DEFAULT_VIZ_CONFIG.
 * (Trích từ file gốc, dòng 1-25 trong khối <script>)
 */
        // FIX (ver 8 refine #2 — yêu cầu "đặt console.log/alert nếu có lỗi"): bắt TOÀN BỘ lỗi
        // runtime không được try/catch ở bất kỳ đâu khác trong app — kể cả lỗi xảy ra ngay lúc
        // nạp script (ví dụ 1 phần tử DOM bị thiếu id khiến dom-refs.js trả về null, rồi 1 file
        // core/playlist nào đó gọi .addEventListener trên null) — những lỗi NHƯ VẬY trước đây làm
        // TOÀN BỘ script phía sau dừng nạp HOÀN TOÀN và im lặng (không alert, không log gì hiện ra
        // màn hình), đúng kiểu "không tải được file/thư mục" mà người dùng gặp (mọi tính năng phía
        // sau điểm lỗi, kể cả nạp nhạc, ngừng hoạt động mà không có dấu hiệu gì). Đặt SỚM NHẤT có
        // thể (đầu file core đầu tiên, NGAY SAU components/main.js) để bắt được lỗi của chính các
        // file core/playlist/visualizer nạp SAU nó. Chỉ alert 1 LẦN DUY NHẤT (qua cờ `_hasShownFatalErrorAlert`)
        // để tránh spam nhiều hộp thoại liên tiếp khi 1 lỗi gốc kéo theo nhiều lỗi phụ.
        // FIX (patch alert -> silent): trước đây còn alert() text lỗi cho người dùng — bỏ hẳn theo
        // yêu cầu, giữ SILENT hoàn toàn ở tầng global error handler này. Lý do: đây là handler bắt
        // MỌI lỗi runtime chưa được catch ở bất kỳ đâu trong app (window.addEventListener('error')),
        // có thể bắn ra rất nhiều lần liên tiếp với các lỗi vụn vặt không ảnh hưởng người dùng (ví
        // dụ lỗi từ 1 extension trình duyệt, lỗi nguồn ngoài không phải code app) — hiện hộp thoại
        // cho mọi trường hợp này dễ gây phiền hơn là giúp ích. console.error(...) ngay trên vẫn ghi
        // đầy đủ context+err vào console — đủ để dev tự mở DevTools kiểm tra khi cần debug, không
        // mất thông tin, chỉ không làm phiền người dùng cuối bằng hộp thoại nữa.
        let _hasShownFatalErrorAlert = false;
        function _reportFatalError(context, err) {
            console.error(`[FATAL] ${context}:`, err);
            _hasShownFatalErrorAlert = true; // giữ lại cờ phòng trường hợp code khác đang đọc biến này
        }
        window.addEventListener('error', (e) => {
            _reportFatalError(`${e.filename || 'script'}:${e.lineno || '?'}`, e.error || e.message);
        });
        window.addEventListener('unhandledrejection', (e) => {
            _reportFatalError('Promise bị reject nhưng không ai .catch()', e.reason);
        });

        // MỚI (Giai đoạn 1, rewrite Photo/Album, mục 2 — fix bug Generic Drawer không che nút close)
        // — bảng z-index TẬP TRUNG. Root cause bug cũ: mỗi overlay tự gán số z-index riêng rải rác
        // từng file (Image Preview z-130, Generic Drawer mặc định z-128, action-menu z-131, modal-
        // choice z-200...) — không ai đối chiếu chung 1 chỗ, dễ lặp lại lỗi lệch thứ tự lớp khi thêm
        // overlay mới. MỌI overlay/modal/drawer MỚI (album carousel, cover picker chuyển vào Generic
        // Drawer — Giai đoạn 3/4) PHẢI tra bảng này qua `element.style.zIndex = String(Z_INDEX.xxx)`
        // (KHÔNG dùng class Tailwind tĩnh kiểu `z-[130]` — không interpolate được hằng số JS lúc
        // runtime, đúng cách core/generic-drawer.js đang làm). Overlay CŨ (chưa migrate) giữ nguyên
        // số hiện tại, sẽ đổi dần khi giai đoạn liên quan đụng tới file đó — KHÔNG đổi hàng loạt ở
        // đây để tránh rủi ro ngoài phạm vi Giai đoạn 1.
        const Z_INDEX = {
            APP_STACK: 60,                  // #app-stack (main.js) — mốc tham chiếu thấp nhất
            GENERIC_DRAWER: 128,             // core/generic-drawer.js — panel; overlay tự dùng GENERIC_DRAWER - 1
            IMAGE_PREVIEW: 130,              // core/file-manager/photo-ui.js::openImagePreviewModal()
            IMAGE_CAROUSEL_PICKER: 130,      // core/file-manager/photo-ui.js::openImageCarouselPickerModal()
            // ĐÃ GỠ (Giai đoạn 4) — PHOTO_UI_IMAGE_PICKER (z-130, modal picker cover bài hát riêng)
            // không còn tồn tại — picker "thêm ảnh vào album"/"chọn bìa bài hát" giờ DÙNG CHUNG
            // Generic Drawer (event/workflow/file-manager-photo.js::_openImagePickerDrawer()), tự
            // dùng GENERIC_DRAWER (128) ngay trên, không cần entry riêng trong bảng này nữa.
            IMAGE_ACTION_MENU_DRAWER: 131,   // event/workflow/file-manager-photo.js::_openImageActionMenu() — Generic Drawer mở TRÊN Image Preview
            MODAL_CHOICE: 200,               // core/modal-choice.js — luôn cao nhất
        };

        const APP_CONFIG = { fftSizeStandard: 256, fftSizeHighRes: 2048, fftSizePitch: 2048, bpmMinWaitTime: 250 };
        // MỚI (19/07/2026, visualizer "Drifting Space") — 4 field spaceStars/spaceGalaxyStars/
        // spaceDetail/spaceMeteorPool thêm vào CẢ 3 mức, cùng tinh thần scale theo quality như các
        // field khác trong bảng này (mật độ starfield/galaxy, độ chi tiết khối cầu hành tinh-sao,
        // số lượng thiên thạch tối đa cùng lúc trong pool tái sử dụng — xem core/webgl/three-space.js).
        // MỚI (viết lại LẦN 2, 19/07/2026, phản hồi Giang "sao lấm chấm to dần khi tiến tới") —
        // thêm spaceFieldStars: số sao lớp "tái sinh" (sliding window như tRings Vortex), KHÁC
        // spaceStars (nền tĩnh xa, không tái sinh).
        const PERFORMANCE_PROFILES = {
            high: { stars: 200, tunnelRings: 60, glassDrops: 250, bldMult: 1.0, streakProb: 0.8, blurMult: 1.0, streetRain: 220, spaceStars: 2200, spaceGalaxyStars: 3500, spaceDetail: 28, spaceMeteorPool: 24, spaceFieldStars: 220 },
            medium: { stars: 100, tunnelRings: 35, glassDrops: 100, bldMult: 1.5, streakProb: 0.9, blurMult: 0.5, streetRain: 130, spaceStars: 1200, spaceGalaxyStars: 2000, spaceDetail: 18, spaceMeteorPool: 14, spaceFieldStars: 120 },
            low: { stars: 40, tunnelRings: 15, glassDrops: 40, bldMult: 2.5, streakProb: 0.95, blurMult: 0, streetRain: 70, spaceStars: 500, spaceGalaxyStars: 900, spaceDetail: 10, spaceMeteorPool: 6, spaceFieldStars: 60 } 
        };
        const DEFAULT_VINYL = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0OCIgZmlsbD0iIzFlMjkzYiIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjE2IiBmaWxsPSIjMGYxNzJhIi8+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iMTUiIGZpbGw9IiNjYmQ1ZTEiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0IiBmaWxsPSIjMGYxNzJhIi8+PC9zdmc+';
        const EQ_FREQS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
        const EQ_LABELS = ['32', '64', '125', '250', '500', '1K', '2K', '4K', '8K', '16K'];
        const EQ_PRESETS = {
            'flat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'bass_boost': [6, 5, 4, 1, 0, 0, 0, 0, 0, 0], 'pop': [-2, -1, 0, 2, 4, 4, 2, 0, -1, -2],
            'rock': [5, 4, 3, 1, -1, -1, 1, 2, 3, 4], 'acoustic': [2, 1, 0, 0, 1, 2, 3, 4, 3, 2], 'electronic': [5, 4, 1, -1, -2, 0, 1, 3, 4, 5],
            'manual': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        };

        const MODES = ['bar', 'lightning', 'rubik', 'vortex', 'black hole', 'rain', 'space'];

        // Auto-switch-visual (ver 10): ngưỡng tối thiểu HARDCODE cho mọi cách tính thời gian giữa
        // 2 lần đổi hiệu ứng — người dùng KHÔNG thể điền thấp hơn mức này, validate ở cả input UI
        // (auto-switch-visual.js) lẫn lúc đọc lại config cũ/hỏng (đề phòng giá trị bị sửa tay
        // trong localStorage/IndexedDB). Cùng 1 hằng số dùng cho:
        //   - mode 'fixed' (c1): chính là khoảng giây cố định người điền — không cho < ngưỡng này.
        //   - mode 'random' (c2): cận DƯỚI của khoảng random — max là số người điền.
        //   - mode 'duration' (c3): SỐ CHIA CỐ ĐỊNH cho duration bài hát (vd: bài 450s / 10 = 45s/lần
        //     đổi) — KHÔNG phải ngưỡng tối thiểu ở đây, người dùng KHÔNG điền/can thiệp được gì cả.
        const AUTO_SWITCH_VISUAL_MIN_SECONDS = 10;

        const DEFAULT_VIZ_CONFIG = {
            quality: 'high', type: 'bar', barStyle: 'mirror', vortexStyle: 'rings', rainStyle: 'glass', glassFlash: true, spaceGlassFrame: true, mode: 'solid', 
            bgColor: '#000000', solidColor: '#ffffff', dynA: '#ec4899', dynB: '#3b82f6', 
            minH: 4, maxH: 400, barWidth: 4, bgImage: '', bgBlur: 0, bgImageEnabled: false,
            // MỚI (07/07/2026, phản hồi Giang — mở đầu Theme thật) — LOẠI TRỪ NHAU:
            // 'light' | 'dark' | 'background' (dùng ảnh nền tuỳ chỉnh, tái dùng bgImage/bgBlur/
            // bgImageEnabled đã có sẵn — 'background' TỰ kéo theo bgImageEnabled=true) |
            // 'gradient' (MỚI 09/07/2026, phản hồi Giang mục 1 — mode RIÊNG, KHÔNG chung với
            // 'background', dùng 2 màu gradientFrom/gradientTo ngay dưới) — chọn qua
            // event/router/theme.js (VirtualMachineState), chốt tại
            // event/workflow/theme.js::_commitThemeMode(). MẶC ĐỊNH 'dark' — app hiện tại LUÔN
            // tối, đúng hành vi cũ trước khi có lựa chọn này. 'light' CHƯA áp dụng lại giao diện
            // sáng thật (chỉ mới lưu lựa chọn + UI chọn — việc tô lại màu TOÀN APP theo 'light' là
            // việc RIÊNG, làm theo từng đợt Settings -> Playlist -> phần còn lại, xem báo cáo cuối
            // batch này).
            themeMode: 'dark',
            // 2 màu cho mode 'gradient' (MỚI 09/07/2026) — áp `linear-gradient(135deg, from, to)`
            // lên `#app-bg`, xem core/color-utils.js::updatePlaylistBg(). Mặc định 1 cặp tím-hồng
            // trung tính, không phụ thuộc màu Visualizer (dynA/dynB) — 2 field RIÊNG, cố ý KHÔNG
            // dùng chung với dynA/dynB dù cùng khái niệm "2 màu gradient": dynA/dynB là màu thanh
            // Visualizer, đổi vì lý do khác hẳn (gu nhạc/hiệu ứng) — gộp chung sẽ khiến đổi 1 cái
            // vô tình ảnh hưởng cái kia, không phải hành vi Giang yêu cầu.
            gradientFrom: '#6366f1', gradientTo: '#ec4899',
            mirrorBarCount: 32,
            volume: 100, eqMode: 'flat', manualEq: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            videoBgEnabled: false, videoBgUrl: '',
            // Bật/tắt riêng cho VISUAL (canvas hiệu ứng) — ver 8 refine: TÁCH HẲN khỏi video nền
            // (trước đây field này tên `videoHideVisual`, chỉ có tác dụng khi video nền đang bật).
            // Giờ độc lập hoàn toàn: tắt -> luôn ẩn canvas + dừng tính toán vẽ, BẤT KỂ có video nền
            // hay không; nền hiển thị khi đó là nền THẬT đang được chọn (video nền nếu đang bật,
            // nếu không thì màu nền `bgColor`) — xem updateVisualVisibility() ở color-utils.js.
            visualEnabled: true,
            keepScreenOn: true,
            // Tự động đổi hiệu ứng Visualizer theo thời gian (ver 10) — xem auto-switch-visual.js.
            //   - autoSwitchVisualEnabled : bật/tắt tổng.
            //   - autoSwitchVisualMode    : 'sequential' (tuần tự/cố định theo MODES) | 'random'.
            //   - autoSwitchVisualTimeMode: 'fixed' (c1) | 'random' (c2) | 'duration' (c3).
            //   - 3 field SỐ GIÂY RIÊNG cho từng mode — KHÔNG dùng chung 1 field, vì mỗi mode diễn
            //     giải số khác hẳn nhau (khoảng cố định / cận TRÊN của random / số chia cho độ dài
            //     bài) — dùng chung sẽ bị GHI ĐÈ mất giá trị của mode khác mỗi khi người dùng đổi
            //     qua đổi lại giữa các mode (đã xảy ra ở bản đầu, sửa lại ở đây):
            //     autoSwitchVisualSecondsFixed (c1), autoSwitchVisualSecondsRandom (c2, cận trên —
            //     cận dưới luôn AUTO_SWITCH_VISUAL_MIN_SECONDS cố định), autoSwitchVisualSecondsDuration
            //     (c3, số chia trong công thức duration/X — tự kẹp ≤ round(duration/2) lúc build mốc).
            autoSwitchVisualEnabled: false,
            autoSwitchVisualMode: 'sequential',
            autoSwitchVisualTimeMode: 'fixed',
            autoSwitchVisualSecondsFixed: 30,
            autoSwitchVisualSecondsRandom: 30,
            autoSwitchVisualSecondsDuration: 30,
            // Hiện/ẩn phụ đề (ver 8 refine) — chuyển từ biến in-memory isSubtitlesEnabled (mất khi
            // tải lại trang) sang field lưu trong vizConfig, đồng bộ với mọi setting khác.
            subtitlesEnabled: true,
            subtitleStyle: {
                bgColor: '#000000', bgOpacity: 0.4,
                borderColor: '#ffffff', borderOpacity: 0.1, borderWidth: 1, borderRadius: 16,
                textColor: '#ffffff', fontSize: 8, lineHeight: 1.3, letterSpacing: 0
            }
        };
        // vizConfig — STATE, khởi tạo thật trong service/state.js (appState.set('vizConfig',
        // { ...CONST.DEFAULT_VIZ_CONFIG }), dùng CONST.DEFAULT_VIZ_CONFIG riêng của chính
        // service/state.js — không phụ thuộc DEFAULT_VIZ_CONFIG ở file này, xem service/state.js).

        /**
         * LƯU CONFIG (v7) — 2 lớp:
         *   (1) localStorage — NGUỒN GHI CHÍNH, đồng bộ, tức thì. saveConfig() được gọi RẤT dày
         *       (mỗi lần kéo 1 slider màu/EQ/sub-style...) nên phải giữ đồng bộ & rẻ, không thể đổi
         *       thẳng sang IndexedDB (async) cho lớp này — sẽ tạo hàng trăm transaction/giây lúc kéo.
         *   (2) IndexedDB (meta.configBackup) — BẢN SAO LƯU, ghi DEBOUNCE (giống cơ chế đã có ở
         *       listen-stats.js: gom nhiều thay đổi liên tiếp thành 1 lần ghi sau 2s yên tĩnh).
         *       Mục đích DUY NHẤT: phòng trường hợp browser tự xoá localStorage (ví dụ Safari iOS
         *       xoá dữ liệu site ít dùng để nhường chỗ, hoặc người dùng xoá "Clear browsing data"
         *       nhưng không đụng IndexedDB) — xem loadConfig() để biết luồng phục hồi.
         *
         * KHÔNG backup `bgImage`/`videoBgUrl`: đây là blob: URL chỉ sống trong 1 session (tạo lại
         * mỗi lần loadBackgroundAssets() chạy), lưu vào bản backup là vô nghĩa và có thể trỏ tới
         * blob: URL đã chết ở session sau.
         *
         * ĐÃ CHUYỂN từ core/equalizer-settings.js (cũ) — đây là hạ tầng CHUNG cho TOÀN BỘ
         * vizConfig (EQ, visualizer, subtitle style, video nền...), không riêng EQ, nên hợp lý
         * hơn khi đặt cùng nhà với khai báo `vizConfig`/`DEFAULT_VIZ_CONFIG` ở trên.
         */
        function saveConfig() {
            localStorage.setItem('visualMasterConfigV21', JSON.stringify(appState.get('vizConfig')));
            scheduleConfigBackup();
        }

        function scheduleConfigBackup() {
            // taskManager.once() với tên cố định tự huỷ bản cũ + đặt lại từ đầu (addNew() validate
            // tự kill() task trùng tên) — đúng hành vi debounce, không cần biến timer riêng nữa.
            taskManager.once(flushConfigBackup, 2000, 'configBackupFlush');
        }
        function flushConfigBackup() {
            taskManager.kill('configBackupFlush');
            const { bgImage, videoBgUrl, ...persistable } = appState.get('vizConfig'); // loại trừ blob: URL runtime
            setMeta('configBackup', persistable).catch(e => console.warn('[config] Lưu configBackup (IndexedDB) lỗi:', e));
        }

        /**
         * Đọc lại ảnh nền & video nền từ IndexedDB (meta.bgImage / meta.videoBg), tự sửa trạng thái
         * "on ảo" nếu config nói đang bật nhưng IndexedDB không còn Blob tương ứng (mục 6 plan).
         * Áp dụng đồng nhất cho CẢ ảnh và video.
         *
         * Batch "nền chung" (07/07/2026) — BỎ `saveConfig()`/`updatePlaylistBg()`/
         * `handleVideoBackground()` nội bộ (Rule 3) — dời ra caller (`loadConfig()` ngay dưới,
         * chỗ DUY NHẤT gọi hàm này — legacy code, KHÔNG thuộc diện phải refactor toàn bộ, chỉ dời
         * đúng phần liên quan tới hàm này).
         */
        async function loadBackgroundAssets() {
            const [imgBlob, videoBlob] = await Promise.all([
                getMeta('bgImage'),
                getMeta('videoBg')
            ]);

            appState.mutate('vizConfig', cfg => {
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

            // (07/07/2026 — HOTFIX 4: dòng `bgImageEnableToggle.checked = ...` ĐÃ XOÁ — checkbox
            // "App background image" cũ không còn tồn tại trong DOM (thay bằng 3 card Theme), tham
            // chiếu thẳng biến CHƯA TỪNG KHAI BÁO ném `ReferenceError` NGAY LẬP TỨC, chặn đứng toàn
            // bộ phần còn lại của loadConfig() — CÙNG PATTERN đã xảy ra với 9 dòng Visualizer Settings
            // (xem HOTFIX ngay dưới). UI Theme (3 card) đã được đồng bộ riêng bởi
            // `workflowTheme.refreshThemeCardUI()` gọi ở cuối loadConfig() — không cần thay thế gì.
            videoEnableToggle.checked = appState.get('vizConfig').videoBgEnabled;
        }

        /**
         * Đồng bộ TOÀN BỘ UI Cài đặt theo vizConfig hiện tại (sau khi nạp/migrate xong) — ĐIỀU
         * PHỐI DUY NHẤT, gọi các hàm "init UI" của TỪNG MODULE CON qua guard `typeof === 'function'`
         * (đúng pattern đã dùng với initAutoSwitchCycleButtonFromConfig() — xem core/auto-switch-visual.js,
         * core/subtitle/subtitle-style-settings.js, core/equalizer.js). KHÔNG tự đụng DOM ref của
         * module khác trực tiếp ở đây — mỗi module tự lo đồng bộ UI CỦA NÓ.
         */
        async function loadConfig() {
            let saved = localStorage.getItem('visualMasterConfigV21') || localStorage.getItem('visualMasterConfigV20');
            // FALLBACK (v7): localStorage rỗng (lần đầu mở MÁY THẬT MỚI, hoặc browser đã tự xoá
            // localStorage để nhường chỗ cho dữ liệu khác) NHƯNG IndexedDB còn bản backup -> đây là
            // dấu hiệu mất localStorage ngoài ý muốn (không phải người dùng mới thật), phục hồi lại
            // NGAY vào localStorage rồi nạp tiếp như thường — người dùng không mất cấu hình đã chỉnh.
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
            if (saved) { try { appState.set('vizConfig', { ...appState.get('vizConfig'), ...JSON.parse(saved) }); } catch(e) {} }
            appState.mutate('vizConfig', cfg => {
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
                // MỚI (07/07/2026) — người dùng CŨ đã bật sẵn ảnh nền trước khi có khái niệm Theme
                // này -> suy luận themeMode='background' luôn (không mặc định 'dark' rồi lại vẫn
                // hiện ảnh nền mâu thuẫn nhau).
                if (cfg.themeMode == null) cfg.themeMode = cfg.bgImageEnabled ? 'background' : 'dark';
                // MỚI (09/07/2026) — cấu hình cũ (trước khi có mode 'gradient') không có 2 field
                // này -> điền mặc định, tránh 'undefined' lọt vào chuỗi CSS linear-gradient().
                if (!cfg.gradientFrom) cfg.gradientFrom = DEFAULT_VIZ_CONFIG.gradientFrom;
                if (!cfg.gradientTo) cfg.gradientTo = DEFAULT_VIZ_CONFIG.gradientTo;
                if (cfg.keepScreenOn == null) cfg.keepScreenOn = true;
                if (cfg.subtitlesEnabled == null) cfg.subtitlesEnabled = true;
                if (cfg.visualEnabled == null) cfg.visualEnabled = true;
                // Auto-switch-visual (ver 10) — migrate field mới + validate lại ngưỡng tối thiểu
                // (phòng giá trị bị sửa tay/hỏng trong bản JSON cũ thấp hơn AUTO_SWITCH_VISUAL_MIN_SECONDS).
                if (cfg.autoSwitchVisualEnabled == null) cfg.autoSwitchVisualEnabled = false;
                if (cfg.autoSwitchVisualMode !== 'sequential' && cfg.autoSwitchVisualMode !== 'random') cfg.autoSwitchVisualMode = 'sequential';
                if (!['fixed', 'random', 'duration'].includes(cfg.autoSwitchVisualTimeMode)) cfg.autoSwitchVisualTimeMode = 'fixed';
                // 3 field RIÊNG cho từng mode (xem giải thích ở trên) — validate ĐỘC LẬP từng cái,
                // không dùng chung 1 field nữa (bug bản đầu: đổi mode A rồi mode B sẽ ghi đè mất giá
                // trị đã lưu của mode A). MIGRATE field cũ `autoSwitchVisualSeconds` (nếu config cũ từ
                // trước khi tách field còn sót lại trong localStorage/IndexedDB) sang cả 3 field mới —
                // dùng đúng giá trị cũ làm điểm khởi đầu cho cả 3, hợp lý hơn reset về default cứng.
                if (typeof cfg.autoSwitchVisualSeconds === 'number') {
                    if (cfg.autoSwitchVisualSecondsFixed == null) cfg.autoSwitchVisualSecondsFixed = cfg.autoSwitchVisualSeconds;
                    if (cfg.autoSwitchVisualSecondsRandom == null) cfg.autoSwitchVisualSecondsRandom = cfg.autoSwitchVisualSeconds;
                    if (cfg.autoSwitchVisualSecondsDuration == null) cfg.autoSwitchVisualSecondsDuration = cfg.autoSwitchVisualSeconds;
                    delete cfg.autoSwitchVisualSeconds; // dọn field cũ, không lưu lại nữa từ lần saveConfig() kế tiếp
                }
                ['autoSwitchVisualSecondsFixed', 'autoSwitchVisualSecondsRandom', 'autoSwitchVisualSecondsDuration'].forEach((field) => {
                    if (typeof cfg[field] !== 'number' || cfg[field] < AUTO_SWITCH_VISUAL_MIN_SECONDS) {
                        cfg[field] = Math.max(AUTO_SWITCH_VISUAL_MIN_SECONDS, DEFAULT_VIZ_CONFIG[field]);
                    }
                });
                // Dữ liệu cũ (trước ver 8) có thể còn field `videoHideVisual` (đã loại bỏ, thay bằng
                // `visualEnabled` độc lập khỏi video nền) — không cần migrate giá trị qua, vì ý nghĩa
                // 2 field khác nhau (cũ: ẩn visual CHỈ khi có video; mới: ẩn visual LUÔN LUÔN khi tắt).
                // Field thừa này vô hại nếu còn tồn tại trong bản JSON cũ, JS đơn giản bỏ qua nó.
                if (!cfg.subtitleStyle) cfg.subtitleStyle = { ...DEFAULT_VIZ_CONFIG.subtitleStyle };
                else cfg.subtitleStyle = { ...DEFAULT_VIZ_CONFIG.subtitleStyle, ...cfg.subtitleStyle };
                // Cấu hình cũ (trước khi thang cỡ chữ đổi thành 8-16px) có thể đã lưu giá trị lớn hơn —
                // giới hạn lại để khớp với range slider hiện tại, tránh lệch giữa dữ liệu và UI.
                cfg.subtitleStyle.fontSize = Math.min(16, Math.max(8, cfg.subtitleStyle.fontSize));
            });

            bgBlurSlider.value = appState.get('vizConfig').bgBlur; valBgBlurDisplay.textContent = appState.get('vizConfig').bgBlur + 'px';

            // bgImage/videoBgUrl giờ là blob: URL runtime, tạo lại mỗi session từ IndexedDB — KHÔNG
            // sống sót qua reload, nên luôn reset về rỗng ở đây TRƯỚC khi loadBackgroundAssets() đọc
            // lại Blob thật và tự sửa trạng thái "on ảo" nếu cần (mục 6).
            appState.mutate('vizConfig', cfg => { cfg.bgImage = ''; cfg.videoBgUrl = ''; });
            await loadBackgroundAssets();
            saveConfig();
            updatePlaylistBg(); // dùng chung cho CẢ Playlist lẫn Settings (playlist-bg giờ vật lý dùng chung — xem components/app-view-stack.js)
            workflowTheme.refreshThemeCardUI(); // MỚI (07/07/2026, mở đầu Theme thật) — đồng bộ 3 card + hàng blur lúc boot
            handleVideoBackground();

            // HOTFIX (07/07/2026 — bug do Giang báo, đã xác nhận): 9 dòng đồng bộ UI panel
            // Visualizer Settings (quality/bgColor/colorMode/solidColor*/dynColor*/maxHeight/
            // barWidth/mirrorCount/vortexStyle/barStyle/rainStyle/glassFlash) ĐÃ XOÁ HẲN khỏi đây
            // — sót từ Batch D3 (06/07/2026): panel Visualizer Settings đã chuyển sang push/pop
            // động (core/settings-panel-stack.js), 15 dom-refs tương ứng (qualitySelect/
            // bgColorPicker/colorModeSelect/solidColor*/dynColor*/maxHeightSlider/barWidthSlider/
            // valMax.../mirrorCountSlider/valMirrorCountDisplay/vortexStyleSelect/barStyleSelect/
            // rainStyleSelect/glassFlashToggle) ĐÃ XOÁ khỏi core/dom-refs.js — nhưng 9 dòng NÀY ở
            // loadConfig() (hàm boot, KHÔNG có try/catch) vẫn gọi thẳng, không qua guard
            // `typeof === 'function'` như các module khác — ném `ReferenceError` NGAY LẬP TỨC,
            // CHẶN ĐỨNG toàn bộ phần còn lại của `loadConfig()` (kể cả `initEqualizerUIFromConfig()`
            // phía dưới — giải thích "EQ không hiển thị") VÀ toàn bộ chuỗi boot phía SAU
            // `await loadConfig()` (core/visualizer/draw-visualizer.js, DOMContentLoaded — không có
            // try/catch bọc ngoài) — bao gồm `initPlaylistFromDB()` (giải thích "mất dữ liệu song/
            // ảnh sau reload": dữ liệu VẪN CÒN trong IndexedDB, chỉ là không bao giờ được ĐỌC LẠI
            // vào UI vì boot bị crash giữa chừng). KHÔNG cần thay thế bằng gì — giá trị các input
            // này giờ đồng bộ MỖI LẦN panel mở, xem event/workflow/visualizer-display.js::
            // openPanel() (đã tự đọc appState.get('vizConfig') + querySelector bên trong panel).

            volumeSlider.value = appState.get('vizConfig').volume; valVolumeDisplay.textContent = appState.get('vizConfig').volume + '%';
            if(appState.get('masterGainNode')) appState.get('masterGainNode').gain.value = appState.get('vizConfig').volume / 100;

            { let idx = MODES.indexOf(appState.get('vizConfig').type); if (idx === -1) idx = 0; appState.set('currentModeIndex', idx); }
            updateDOMBackground(); updatePlaylistBg(); updateColorMenuUI(); updateTypeUI();

            // Mỗi module con tự lo đồng bộ UI CỦA NÓ (EQ, misc settings visualizer, subtitle
            // style) — gọi qua guard vì thứ tự nạp các module này SAU config.js (xem index.html).
            if (typeof initEqualizerUIFromConfig === 'function') initEqualizerUIFromConfig();
            if (typeof initVisualizerMiscSettingsUIFromConfig === 'function') initVisualizerMiscSettingsUIFromConfig();
            if (typeof initSubtitleToggleUIFromConfig === 'function') initSubtitleToggleUIFromConfig(); // ĐỔI TÊN Batch D2 (cũ: initSubtitleStyleSettingsUIFromConfig) — xem core/subtitle/subtitle-style-settings.js
            if (typeof initAutoSwitchCycleButtonFromConfig === 'function') initAutoSwitchCycleButtonFromConfig(); // ĐỔI TÊN Batch D3 (cũ: initAutoSwitchVisualUI) — phần đồng bộ panel dời sang workflowVisualizerDisplay.openPanel()
        }
