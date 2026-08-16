/**
 * core/config.js — Giữ 3 bản DEFAULT_VIZ_CONFIG/DEFAULT_VISUAL_BG_CONFIG/DEFAULT_READER_CONFIG +
 * đăng ký domain AppConfig (service/state.js). Toàn bộ hàm nghiệp vụ thuần xoay quanh config:
 * seedConfig()/restoreDefaultVizConfig()/saveConfig()/loadConfig() + 2 hàm backup.
 *
 * FILE NÀY KHÔNG GIỮ GIÁ TRỊ RUNTIME — mọi giá trị SỐNG trong `appConfig` (service/state.js).
 * Z_INDEX/MODES/APP_CONFIG/EQ_* sống ở đúng package service/state/*.js tương ứng.
 *
 * (12/08/2026) Bỏ hẳn field phẳng dùng-chung-nhiều-effect + chế độ hiệu năng
 * (quality/PERFORMANCE_PROFILES) — xem `DEFAULT_CUSTOM_EFFECT` ngay dưới, mỗi effect tự mang bộ
 * config riêng.
 *
 * PHẢI nạp SAU: service/state.js (cần class AppConfig).
 */

        /**
         * Custom Effect (12/08/2026, tái thiết kế — bỏ hẳn tư duy panel-chung + chế độ hiệu năng).
         * 1 object DUY NHẤT, key = tên `type` (khớp MODES) — mỗi effect tự mang bộ config RIÊNG.
         * 4 field màu (mode/solidColor/dynA/dynB) LUÔN có ở MỌI effect (đọc bởi getComputedColor(),
         * core/audio-analysis.js). 2 field blur (blurEnabled/blurIntensity) CHỈ có ở effect thật sự
         * đọc chúng trong hàm vẽ — xem CUSTOM_EFFECT_NO_BLUR (core/custom-effect.js) cho danh sách
         * loại trừ. Mở qua GIỮ 1.5s #btn-cycle-mode (Generic Drawer, event/workflow/custom-effect.js).
         */
        const DEFAULT_CUSTOM_EFFECT = {
            bar: {
                mode: 'solid', solidColor: '#ffffff', dynA: '#ec4899', dynB: '#3b82f6', blurEnabled: true, blurIntensity: 100,
                barStyle: 'mirror', minH: 4, maxH: 400, mirrorBarCount: 32,
                barFillRatio: 0.6, barCornerRadius: 3, centerBarBeatRatio: 0.7,
                cascadeBaseAlpha: 0.2, cascadeKeyCount: 64,
            },
            'black hole': {
                mode: 'solid', solidColor: '#ffffff', dynA: '#ec4899', dynB: '#3b82f6', blurEnabled: true, blurIntensity: 100,
                minH: 4, maxH: 400, barWidth: 4, starCount: 200,
                radiusRatio: 0.13, radiusEnergyMult: 0.05, suctionBase: 0.2, suctionEnergyMult: 2.5,
                flareThreshold: 0.65, flashFadeSpeed: 0.08,
            },
            lightning: {
                mode: 'solid', solidColor: '#ffffff', dynA: '#ec4899', dynB: '#3b82f6', blurEnabled: true, blurIntensity: 100,
                flashThreshold: 0.35, boltThreshold: 0.4, boltSpawnChance: 0.2, maxBoltCount: 5,
                boltFadeSpeed: 0.04, boltHorizontalDeviation: 120, boltSegmentLength: 60,
            },
            rain: {
                mode: 'solid', solidColor: '#ffffff', dynA: '#ec4899', dynB: '#3b82f6',
                rainStyle: 'glass', glassFlash: true,
                glassCityOpacity: 100, glassCityVisible: true, glassMoonVisible: true,
                glassDropDensity: 250, glassStreakFrequency: 20,
                streetDensity: 220, streetBuildingScale: 1.0,
                // Đèn THÊM VÀO 3 cột gốc cố định (tối đa 8) — xem generateStreetScene(),
                // core/canvas-scene-setup.js. Mỗi đèn: xPercent/heightPx/flareScale riêng.
                customLamps: [],
            },
            rubik: {
                mode: 'solid', solidColor: '#ffffff', dynA: '#ec4899', dynB: '#3b82f6',
                cubeSizeRatio: 0.08, pitchSensitivity: 0.9, rotationEnergyThreshold: 0.35, layerTurnSpeed: 0.08,
            },
            vortex: {
                mode: 'solid', solidColor: '#ffffff', dynA: '#ec4899', dynB: '#3b82f6',
                vortexStyle: 'rings', tunnelRingCount: 60,
                warpSpeedBase: 10, warpSpeedEnergyMult: 40, curveChangeChance: 0.015,
                barsRingCount: 40, barsPerRing: 24, barsTwistFactor: 2.4,
                waveRotationBase: 0.01, waveRotationEnergyMult: 0.05, waveScaleBase: 0.8, waveScaleEnergyMult: 0.4,
            },
            space: {
                mode: 'solid', solidColor: '#ffffff', dynA: '#ec4899', dynB: '#3b82f6',
                starCountMin: 3800, starCountMax: 6000, nebulaCount: 35, dustCount: 1500,
                mapNodeCount: 70, mapRadius: 950,
            },
        };

        const DEFAULT_VIZ_CONFIG = {
            type: 'bar',
            customEffect: DEFAULT_CUSTOM_EFFECT,
            bgImage: '', bgBlur: 0, bgImageEnabled: false,
            // 'light' | 'dark' | 'background' (ảnh nền tuỳ chỉnh, TỰ kéo theo bgImageEnabled=true) |
            // 'gradient' (2 màu gradientFrom/gradientTo ngay dưới) — chọn qua event/router/theme.js,
            // chốt tại event/workflow/theme.js::_commitThemeMode(). Mặc định 'dark'.
            themeMode: 'dark',
            gradientFrom: '#6366f1', gradientTo: '#ec4899',
            // eqMode/manualEq (chế độ 'manual' + mảng gains riêng) ĐÃ BỎ HẲN — THAY bằng hệ thống
            // preset EQ lưu DB (core/eq-presets.js), preset ĐANG CHỌN chỉ còn 1 id đơn giản. Sửa
            // preset nào (kể cả "sửa thủ công") giờ ĐI QUA Edit EQ (Generic Drawer) áp dụng cho
            // ĐÚNG preset đó, không còn khái niệm "chế độ manual" riêng.
            volume: 100, eqPresetId: 'flat',
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
            // MỚI (15/08/2026, mục 4a — "box chung cho subtitles line") — chuỗi CSS build từ
            // Element Style Editor (core/element-style-editor.js), áp lên `subtitleFrame` (khung
            // BAO NGOÀI mọi dòng phụ đề đang active, id="subtitle-frame") — CHUNG cho mọi dòng,
            // KHÔNG áp riêng từng dòng (khác coming/in/outing, per-line — xem hội thoại). Rỗng =
            // chưa chỉnh gì, giữ nguyên chữ trắng + shadow mặc định (mục 2).
            subtitleBoxCss: '',
            // MỚI (16/08/2026, mục 3 — Giang yêu cầu "toggle tuỳ chọn sử dụng hiển thị mặc định,
            // On để áp dụng tuỳ chỉnh") — công tắc CHỌN 1 TRONG 2 kiểu hiển thị cho subtitleFrame:
            // false (mặc định) = dùng `subtitleDefaultFontSize`/`subtitleDefaultColor` ngay dưới +
            // nền chữ tĩnh CỐ ĐỊNH (font-weight/line-height/text-shadow, class
            // `.subtitle-default-appearance` + `.sub-text-glow`, assets/css/base.css); true = dùng
            // `subtitleBoxCss` (Element Style Editor đầy đủ, nút "Styling" CHỈ hiện khi bật cái
            // NÀY). Xem applySubtitleFrameStyle(), core/subtitle/subtitle-style-settings.js.
            subtitleUseCustomStyling: false,
            // MỚI (16/08/2026, mục 3 — "Nếu là mặc định cho phép chỉnh sửa cỡ chữ từ 8px-16px, cho
            // phép chỉnh color") — 2 field CHỈ có tác dụng lúc `subtitleUseCustomStyling === false`
            // — biên fontSize [8,16] ép ở UI (components/subtitle-settings-drawer.js), KHÔNG ép lại
            // ở đây (core không tự phán đúng/sai input, xem core-function-conventions.md).
            subtitleDefaultFontSize: 16,
            subtitleDefaultColor: '#ffffff',
            // MỚI (15/08/2026, mục 4b) — hiệu ứng Comming/In/Outing khi 1 dòng phụ đề bắt đầu/kết
            // thúc hiệu lực — CHUNG 1 cài đặt cho MỌI dòng (KHÔNG lưu riêng từng dòng, xem hội
            // thoại), nhưng KHUNG THỜI GIAN thực tế áp dụng được TÍNH RIÊNG mỗi dòng lúc phát, lấy
            // start/end của CHÍNH dòng đó làm mốc neo — xem core/subtitle/subtitle-transition.js.
            // valueMs CÓ DẤU (+/-), biên [-5000,5000] — dấu quyết định Comming/Outing "ăn" vào
            // TRƯỚC hay SAU mốc neo (xem ví dụ Giang trong hội thoại, computeSubtitleTransitionWindow()).
            subtitleCommingEffect: 'none', subtitleCommingValueMs: 0,
            subtitleInEffect: 'none',
            subtitleOutingEffect: 'none', subtitleOutingValueMs: 0,
            // 3 toggle RIÊNG hiện/ẩn UI chrome màn Visualizer (bỏ hẳn "full mode" gộp chung),
            // Settings -> Hiển thị Visualizer. NHẤT QUÁN với statsPanelVisible: đặt tên KHẲNG ĐỊNH
            // ("hiện"), mặc định BẬT (true) — KHÔNG đặt tên phủ định "hideX" mặc định tắt (đã sửa,
            // phản hồi Giang — "tên là hide Xxx rồi On/Off, không nhất quán với Stats"). Xem
            // core/visualizer-ui-visibility.js.
            bottomPlayerVisible: true, playlistButtonVisible: true, controlCenterButtonVisible: true,
            // Cử chỉ (event/workflow/visualizer-gesture.js). 4 hướng vuốt + 2 tap: mỗi cái 1 hành
            // động do người dùng chọn ('next'/'prev'/'playPause'/'openPlaylist'/'none') — chọn
            // 'none' là tắt cử chỉ đó, KHÔNG còn cờ boolean bật/tắt riêng. Cạnh trên/dưới KHÔNG đổi
            // (mở Control Center / gán 1 nút Control Center — ngoài phạm vi action picker này).
            gestureActionSwipeUp: 'next', gestureActionSwipeDown: 'prev',
            gestureActionSwipeLeft: 'prev', gestureActionSwipeRight: 'next',
            gestureActionTapSingle: 'playPause', gestureActionTapDouble: 'openPlaylist',
            gestureEdgeTopEnabled: true,
            // Tap 3 lần (MỚI, THAY THẾ vuốt cạnh dưới đã bỏ hẳn — phản hồi Giang) — SỬA
            // (12/08/2026, Giang yêu cầu "tap 3 dùng chung select giống tap/cử chỉ khác"): TRƯỚC
            // ĐÂY field này lưu 1 key nút Control Center (khớp GESTURE_TRIPLE_TAP_TARGET_ELS) —
            // giờ CÙNG miền giá trị với gestureActionTapSingle/Double (1 trong 5 GESTURE_ACTIONS
            // 'next'/'prev'/'playPause'/'openPlaylist'/'none' HOẶC 1 Action slot 'actionSlot1/2/3'
            // — event/workflow/visualizer-gesture.js). Muốn bấm thẳng 1 nút Control Center thì gán
            // nút đó cho 1 Action slot (gestureActionSlot1/2/3 bên dưới) rồi chọn slot đó ở đây.
            // Tap 3 lần — KHÔNG còn toggle bật/tắt riêng (phản hồi Giang) — chọn 'none' trong
            // dropdown tự nghĩa là tắt, CÙNG khuôn action picker (next/prev/.../'none'). Mặc định
            // 'none'.
            gestureTripleTapTarget: 'none',
            // MỚI (12/08/2026, Giang yêu cầu — "Action" cho Cử chỉ) — 3 "Slot" CỐ ĐỊNH (KHÔNG cho
            // thêm/bớt, giới hạn cứng = 3), mỗi Slot gán 1 nút Control Center (key khớp
            // GESTURE_TRIPLE_TAP_TARGET_ELS, event/workflow/visualizer-gesture.js) — rồi 7 dropdown
            // vuốt/tap/tap-3-lần phía trên (KHÔNG gồm seek/vuốt cạnh trên) có thêm 3 lựa chọn
            // 'actionSlot1/2/3' NGOÀI 5 lựa chọn mặc định next/prev/playPause/openPlaylist/none —
            // cho phép vuốt/tap/tap-3-lần TRỎ TỚI bất kỳ nút Control Center nào (không chỉ 4 hành
            // động media cơ bản). Mặc định 'none' cả 3 (chưa gán gì).
            gestureActionSlot1: 'none', gestureActionSlot2: 'none', gestureActionSlot3: 'none',
            // Seek-hold: giữ tay 3s ở nửa trái/phải màn hình -> tua lùi/tiến lặp lại theo bước
            // gestureSeekStepMs (mili giây), tới khi thả tay hoặc chạm biên 0/(thời lượng - 1s).
            // Seek-hold: giữ tay ở nửa trái/phải màn hình để tua lùi/tiến lặp lại. 3 THỜI GIAN
            // TÁCH BIỆT HOÀN TOÀN (phản hồi Giang):
            //   - Ngưỡng KÍCH HOẠT (2s): CỐ ĐỊNH, KHÔNG phải setting — xem SEEK_HOLD_ACTIVATE_MS,
            //     event/workflow/visualizer-gesture.js.
            //   - gestureSeekStepMs (Time 1): ĐƠN VỊ NHẢY mỗi lần seek — tua bao nhiêu.
            //   - gestureSeekHoldIntervalMs (Time 2): SAU KHI đã vào seek mode, giữ tiếp đủ Time 2
            //     thì mới kích hoạt 1 lệnh seek theo Time 1 — lặp lại liên tục (giữ Time 2 -> seek
            //     Time 1 -> giữ Time 2 -> seek Time 1...).
            gestureSeekHoldEnabled: true, gestureSeekStepMs: 2000, gestureSeekHoldIntervalMs: 2000,
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
            // MỚI (12/08/2026, Giang yêu cầu mục 6 — "Movement" cho gradient) — CHỈ có ý nghĩa khi
            // colorMode==='gradient'. 2 chế độ TÁCH BIỆT (chỉ 1 chạy tại 1 thời điểm, theo `mode`):
            //   'time'  — góc xoay CHẠY ĐỀU theo thời gian, hết đúng 1 vòng 360° sau
            //             `rotateDurationMs` rồi lặp lại — KHÔNG phụ thuộc audio.
            //   'audio' — góc xoay DAO ĐỘNG giữa audioRotateFrom/To, ĐỘ LỆCH vị trí % của các
            //             stop (co/giãn đối xứng quanh tâm 50%, xem computeGradientStopSpread(),
            //             core/visual-bg.js) DAO ĐỘNG giữa audioStopSpreadFrom/To — CẢ 2 cùng lúc
            //             bám theo `smoothedEnergy` (0-1, core/audio-analysis.js — ĐÃ ĐƯỢC LÀM MƯỢT
            //             sẵn, tránh giật hình theo từng khung hình thô, phù hợp driving 1 hiệu ứng
            //             nền LIÊN TỤC hơn hẳn beatScale thô — xem phân tích chọn thông số ở
            //             event/workflow/visual-bg.js::_tickGradientMovement()).
            // "Tráo màu" — ĐỘC LẬP với mode xoay ở trên, chạy song song nếu bật: cứ mỗi
            // `colorSwapIntervalMs` lại tráo NGẪU NHIÊN thứ tự màu giữa các stop (giữ nguyên vị trí
            // %, chỉ đổi CHỖ màu — shuffleGradientStopColors(), core/visual-bg.js), chuyển cảnh mượt
            // trong `colorSwapTransitionMs` (interpolateColor(), core/color-utils.js — ĐÃ CÓ SẴN,
            // dùng lại).
            gradientMovement: {
                enabled: false,
                mode: 'time',                       // 'time' | 'audio'
                rotateDurationMs: 10000,            // mode 'time' — 1000-60000 (picker 1s-60s)
                audioRotateFrom: 0, audioRotateTo: 360,
                audioStopSpreadFrom: 0, audioStopSpreadTo: 15,
                colorSwapEnabled: false,
                colorSwapIntervalMs: 10000,         // 1000-60000 (picker 1s-60s)
                colorSwapTransitionMs: 1000,        // 500-3000 (picker 500ms-3s)
            },

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
         * Domain config RIÊNG cho Shuffle/Repeat/Stats-panel-visible (`#btn-shuffle`/`#btn-repeat`,
         * components/visualizer-overlay.js — checkbox Stats dời sang Settings, xem
         * core/visualizer-ui-visibility.js) — trước đây `isShuffle`/`repeatMode`/`isStatsPanelVisible`
         * CHỈ sống trong AppState runtime, KHÔNG lưu bền, mất hết sau F5. Domain RIÊNG (không gộp
         * vào `playlist`) vì đây là nhóm preference của TRÌNH PHÁT, khác "duyệt/sắp xếp Playlist".
         */
        const DEFAULT_PLAYER_CONFIG = {
            isShuffle: false,
            repeatMode: 0,
            isStatsPanelVisible: true,
        };

        AppConfig.defineDomain('viz', {
            schema: {
                type: 'string', customEffect: 'object',
                bgImage: 'string', bgBlur: 'number', bgImageEnabled: 'boolean',
                themeMode: 'string', gradientFrom: 'string', gradientTo: 'string',
                volume: 'number', eqPresetId: 'string',
                visualEnabled: 'boolean',
                keepScreenOn: 'boolean',
                autoSwitchVisualEnabled: 'boolean', autoSwitchVisualMode: 'string', autoSwitchVisualTimeMode: 'string',
                autoSwitchVisualSecondsFixed: 'number', autoSwitchVisualSecondsRandom: 'number', autoSwitchVisualSecondsDuration: 'number',
                subtitlesEnabled: 'boolean',
                subtitleBoxCss: 'string',
                subtitleUseCustomStyling: 'boolean',
                subtitleDefaultFontSize: 'number', subtitleDefaultColor: 'string',
                subtitleCommingEffect: 'string', subtitleCommingValueMs: 'number',
                subtitleInEffect: 'string',
                subtitleOutingEffect: 'string', subtitleOutingValueMs: 'number',
                bottomPlayerVisible: 'boolean', playlistButtonVisible: 'boolean', controlCenterButtonVisible: 'boolean',
                gestureActionSwipeUp: 'string', gestureActionSwipeDown: 'string',
                gestureActionSwipeLeft: 'string', gestureActionSwipeRight: 'string',
                gestureActionTapSingle: 'string', gestureActionTapDouble: 'string',
                gestureEdgeTopEnabled: 'boolean', gestureTripleTapTarget: 'string',
                gestureActionSlot1: 'string', gestureActionSlot2: 'string', gestureActionSlot3: 'string',
                gestureSeekHoldEnabled: 'boolean', gestureSeekStepMs: 'number', gestureSeekHoldIntervalMs: 'number',
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
                gradientMovement: 'object',
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

        /** MỚI (12/08/2026, Giang chỉ ra 2a "Reset app default" THỰC RA là yêu cầu reset — không
         * phải loại trừ, mình hiểu ngược ở bản trước) — Reset visualBgConfig (Visual Background)
         * về default, CÙNG khuôn restoreDefaultVizConfig() ngay trên, khác domain. Gọi từ
         * event/workflow/settings-misc.js::confirmRestoreDefaults() — Workflow đó tự lo
         * persist(meta.visualBgConfig)/reload() sau (KHÔNG còn gộp saveConfig()+reload() ngay
         * trong core/app-recovery.js như executeRestoreDefaults() cũ — giờ phải đợi ghi ĐỦ 2
         * domain bất đồng bộ trước khi reload, không còn là 1 process Core làm gọn được nữa). */
        function restoreDefaultVisualBgConfig() {
            appConfigVisualBg.restoreDefaults();
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
                // Di trú eqMode/manualEq cũ (ĐÃ BỎ HẲN, xem core/eq-presets.js) sang eqPresetId
                // MỚI — 5 preset gốc giữ NGUYÊN id (flat/bass_boost/pop/rock/acoustic/electronic)
                // nên chọn lại đúng preset cũ; riêng 'manual' không còn preset nào tên vậy nữa,
                // về Default (gains riêng người dùng tự chỉnh trong 'manual' KHÔNG khôi phục được
                // — đánh đổi chấp nhận được, dự án cá nhân, không cần lớp di trú phức tạp hơn).
                if (!cfg.eqPresetId) cfg.eqPresetId = (cfg.eqMode && cfg.eqMode !== 'manual') ? cfg.eqMode : 'flat';
                delete cfg.eqMode; delete cfg.manualEq;
                // Cấu hình cũ từng có visualizer 'synthesia'/'firefly_forest'/'seasons'/'wave' đã bị
                // loại bỏ — quy về 'bar' để không vỡ trải nghiệm người dùng cũ.
                if (cfg.type === 'synthesia' || cfg.type === 'firefly_forest' || cfg.type === 'seasons' || cfg.type === 'wave') cfg.type = 'bar';

                // MIGRATE (12/08/2026, bỏ field phẳng cũ + chế độ hiệu năng) — customEffect() là
                // OBJECT MỚI, seed đủ 7 effect từ default rồi merge field CŨ (nếu save trước bản
                // này còn sót lại field phẳng ở gốc cfg) vào ĐÚNG effect tương ứng 1 lần duy nhất.
                const legacyType = Object.keys(DEFAULT_CUSTOM_EFFECT).includes(cfg.type) ? cfg.type : null;
                const next = {};
                for (const key in DEFAULT_CUSTOM_EFFECT) next[key] = { ...DEFAULT_CUSTOM_EFFECT[key], ...(cfg.customEffect && cfg.customEffect[key]) };
                if (!cfg.customEffect && legacyType && next[legacyType]) {
                    const t = next[legacyType];
                    if (cfg.mode) t.mode = cfg.mode;
                    if (cfg.solidColor) t.solidColor = cfg.solidColor;
                    if (cfg.dynA) t.dynA = cfg.dynA;
                    if (cfg.dynB) t.dynB = cfg.dynB;
                    if (cfg.blurEnabled != null) t.blurEnabled = cfg.blurEnabled;
                    if (cfg.barStyle) t.barStyle = cfg.barStyle;
                    if (cfg.vortexStyle) t.vortexStyle = cfg.vortexStyle;
                    if (cfg.rainStyle) t.rainStyle = cfg.rainStyle;
                    if (cfg.glassFlash != null) t.glassFlash = cfg.glassFlash;
                    if (cfg.minH != null) t.minH = cfg.minH;
                    if (cfg.maxH != null) t.maxH = cfg.maxH;
                    if (cfg.barWidth != null) t.barWidth = cfg.barWidth;
                    if (cfg.mirrorBarCount != null) t.mirrorBarCount = cfg.mirrorBarCount;
                    if (cfg.rainGlassCityVisible != null) t.glassCityVisible = cfg.rainGlassCityVisible;
                    if (cfg.rainGlassMoonVisible != null) t.glassMoonVisible = cfg.rainGlassMoonVisible;
                }
                cfg.customEffect = next;
                delete cfg.mode; delete cfg.solidColor; delete cfg.dynA; delete cfg.dynB; delete cfg.blurEnabled;
                delete cfg.barStyle; delete cfg.vortexStyle; delete cfg.rainStyle; delete cfg.glassFlash;
                delete cfg.minH; delete cfg.maxH; delete cfg.barWidth; delete cfg.mirrorBarCount;
                delete cfg.rainGlassCityOpacity; delete cfg.rainGlassCityVisible; delete cfg.rainGlassMoonVisible; delete cfg.rainGlassWindowVisible;
                delete cfg.quality;

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
                // XOÁ (mục 2, phản hồi Giang — "loại bỏ toàn bộ khung box, xoá toàn bộ tuỳ chọn")
                // — khối migrate `cfg.subtitleStyle` (2 dòng gán default + 1 dòng clamp fontSize)
                // ĐÃ BỎ HẲN: field không còn tồn tại trong DEFAULT_VIZ_CONFIG/schema nữa. Config cũ
                // của người dùng có thể còn sót `subtitleStyle` trong localStorage — vô hại, không
                // ai đọc field đó nữa (core/subtitle/subtitle-display.js không còn tham chiếu).
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

            if(appState.get('masterGainNode')) appState.get('masterGainNode').gain.value = appConfigViz.getAll().volume / 100;
            // Volume HUD (core/volume-hud.js) tự đồng bộ icon+slider MỖI LẦN MỞ (workflowVolumeHud.
            // open(), đọc appConfigViz tươi) — không cần đồng bộ UI tĩnh nào ở đây (khác bản cũ có
            // #setting-volume tĩnh từ lúc boot, đã xoá cùng UI Settings EQ/Volume cũ).

            { let idx = MODES.indexOf(appConfigViz.getAll().type); if (idx === -1) idx = 0; appState.set('currentModeIndex', idx); }
            updateDOMBackground(); updatePlaylistBg(); updateProgressBarCSS(); updateTypeUI();

            if (typeof initVisualizerMiscSettingsUIFromConfig === 'function') initVisualizerMiscSettingsUIFromConfig();
            if (typeof initSubtitleStateFromConfig === 'function') initSubtitleStateFromConfig();
            if (typeof initAutoSwitchCycleButtonFromConfig === 'function') initAutoSwitchCycleButtonFromConfig();
            // 3 toggle ẩn/hiện UI chrome màn Visualizer, tự áp lại lúc boot (khác setStatsPanelVisible()
            // — domain 'player' RIÊNG, tự áp qua workflowPlayerControls.loadPersistedPlayerConfigOnBoot(),
            // xem event/workflow/app-boot.js).
            if (typeof setBottomPlayerVisible === 'function') setBottomPlayerVisible(appConfigViz.getAll().bottomPlayerVisible !== false);
            if (typeof setPlaylistButtonVisible === 'function') setPlaylistButtonVisible(appConfigViz.getAll().playlistButtonVisible !== false);
            if (typeof setControlCenterButtonVisible === 'function') setControlCenterButtonVisible(appConfigViz.getAll().controlCenterButtonVisible !== false);
        }
