/**
 * core/config.js — Default + domain AppConfig (service/state.js) của mọi cấu hình lưu bền, cùng các hàm thuần quanh
 * vizConfig: parse/merge/di trú bản đã lưu, bản backup, ghi localStorage, fallback nền media, suy style đang chọn.
 * Đọc localStorage/IndexedDB, hẹn giờ backup và các bước áp lúc boot: event/workflow/config.js (`workflowConfig`).
 *
 * File không giữ giá trị runtime — mọi giá trị sống trong `appConfig`. Z_INDEX/MODES/EQ_*... ở service/state/*.js.
 *
 * NẠP SAU: service/state.js (AppConfig), service/state/visualizer-runtime.js (EFFECT_GROUPS/GROUP_STYLE_FIELD/MODES),
 * service/state/auto-switch.js (AUTO_SWITCH_VISUAL_MIN/MAX_SECONDS).
 */

        /** 14 kiểu nổ pháo hoa — nguồn duy nhất cho tên kiểu: DEFAULT_CUSTOM_EFFECT.lighting.enabledStyles,
         * components/custom-effect-drawer.js (checkbox) và core/visualizer/types/lighting.js (bảng hàm explode*, key khớp y hệt). */
        const FIREWORKS_STYLE_KEYS = [
            'cluster', 'kamuro', 'horsetail', 'spiral', 'doublering', 'ghost',
            'chrysanthemum', 'willow', 'heart', 'ring', 'crossette', 'palm', 'crackle', 'strobe',
        ];

        /**
         * Custom Effect: key = group (khớp cfg.type: bar/lighting/rain/shape/vortex/connector), mỗi group mang bộ config riêng.
         * 5 field màu (mode/solidColor/dynA/dynB/gradientPalette) có ở mọi group (luật màu: core/visualizer/effect-paint.js); blur chỉ ở group
         * thật sự đọc nó (CUSTOM_EFFECT_NO_BLUR, core/custom-effect.js). Style con đang chọn lưu ở field riêng của group
         * (GROUP_STYLE_FIELD); field nhiều style cùng dùng lưu riêng theo style trong `byStyle[style]` — giá trị dưới đây là
         * mặc định (CUSTOM_EFFECT_PER_STYLE_FIELDS + resolveEffectConfig(), core/custom-effect.js).
         */
        const DEFAULT_CUSTOM_EFFECT = {
            bar: {
                mode: 'solid', solidColor: '#ffffff', dynA: '#ec4899', dynB: '#3b82f6', gradientPalette: [], blurEnabled: true, blurIntensity: 100,
                barStyle: 'mirror', minH: 4, maxH: 400, mirrorBarCount: 32,
                barFillRatio: 0.6, barCornerRadius: 3,
                // Mirror (core/visualizer/groups/bar/mirror.js): thân bướm = bội số gap (1-6), nâng treble trên 1kHz (dB/quãng
                // tám), làm mượt kề (0 = tắt).
                mirrorCenterGap: 2, mirrorTilt: 3, mirrorSmoothSpread: 0,
                cascadeBaseAlpha: 0.2, cascadeKeyCount: 64,
                // Black Hole dùng chung minH/maxH; barWidth kẹp 5-10px (cột rộng nhất vừa chạm nhau, core/visualizer/groups/bar/
                // black-hole.js); barTopRadius bo 2 góc đỉnh 0-5px.
                barWidth: 8, barTopRadius: 2, starCount: 200,
                radiusRatio: 0.13, radiusEnergyMult: 0.05, suctionBase: 0.2, suctionEnergyMult: 2.5,
                flareThreshold: 0.65,
                hawkingEnabled: true, // tia bức xạ Hawking khi beat mạnh
                // Dot (core/visualizer/groups/bar/dot.js); maxH ở trên dùng cho kiểu tác động 'height'.
                dotCount: 40, dotShape: 'line', dotImpactMode: 'radius', dotLineVibrate: true,
                // Rắn bò + bẻ góc 2 nhánh kiểu 'height' ('none'|'gt'|'lt'|'slash'|'backslash', góc độ).
                dotMoving: false, dotBend: 'none', dotBendAngle: 35, dotMoveType: 'snake', // 'snake' | 'dna'
                dotSwell: 100, // độ phình dot kiểu 'radius', % (50-300)
            },
            lighting: {
                mode: 'solid', solidColor: '#ffffff', dynA: '#ec4899', dynB: '#3b82f6', gradientPalette: [], blurEnabled: true, blurIntensity: 100,
                lightingStyle: 'thunder',
                // Chớp toàn màn hình — cùng 3 field với group rain (CUSTOM_EFFECT_FLASH_FIELDS, core/custom-effect.js), lưu riêng theo style.
                flashEnabled: true, flashThreshold: 0.35, flashMaxOpacity: 0.8,
                // Style "thunder" (tia sét)
                boltThreshold: 0.4, boltSpawnChance: 0.2, maxBoltCount: 5,
                boltFadeSpeed: 0.04, boltHorizontalDeviation: 120, boltSegmentLength: 60,
                // Style "fireworks" — enabledStyles/customTexts không qua dropdown style (core/custom-effect.js);
                // maxConcurrentRockets = trần số rocket bay cùng lúc.
                particleCount: 140, burstPower: 1.0, gravity: 0.06, autoLaunchDensity: 50,
                maxConcurrentRockets: 12,
                // Finale chỉ kích hoạt theo detectMusicTransition() (core/audio-analysis.js): sectionWindowBeats/fluxThreshold là
                // tham số của nó; cửa sổ ngắn cố định 2 nhịp (_fwUpdateFinaleTrigger(), event/workflow/visualizer-render.js).
                finaleEnabled: true,
                sectionWindowBeats: 12, fluxThreshold: 0.5,
                enabledStyles: [...FIREWORKS_STYLE_KEYS],
                customTexts: [],
            },
            rain: {
                mode: 'solid', solidColor: '#ffffff', dynA: '#ec4899', dynB: '#3b82f6', gradientPalette: [],
                rainStyle: 'glass',
                // Chớp toàn màn hình — cùng 3 field với group lighting, lưu riêng theo style.
                flashEnabled: true, flashThreshold: 0.4, flashMaxOpacity: 0.4,
                glassCityOpacity: 100, glassCityVisible: true, glassMoonVisible: true,
                glassDropDensity: 250, glassStreakFrequency: 20,
                streetDensity: 220, streetBuildingScale: 1.0,
                // Street Light chỉ dùng tuyết; bật/tắt hướng gió (tắt = rơi thẳng).
                streetWindEnabled: true,
                // Comet Meteor Shower — Canvas 2D, thuộc group falling (registry key rain).
                cometMaxMeteors: 18, cometSpawnRate: 3, cometTailLength: 100, cometDustPerMeteor: 8,
                cometBrightness: 1, cometGlow: 16, cometSpeed: 220, cometAudioSensitivity: 0.8, cometBeatBurst: true,
                cometDirectionMode: 'diagonal', cometDirectionAngle: 315,
                cometApproachSpeed: 0.28, cometPerspectiveStrength: 0.85, cometNearScale: 3,
                cometSpawnSpread: 70, cometBehindMountains: 0.55,
                cometMountainLayerCount: 3, cometMountainOpacity: 70, cometHorizonHeight: 22,
                cometMountainColor: '#101827',
                // Đèn thêm vào 3 cột gốc (tối đa 8) — generateStreetScene(), core/canvas-scene-setup.js; mỗi đèn
                // xPercent/heightPx/flareScale riêng.
                customLamps: [],
            },
            shape: {
                mode: 'solid', solidColor: '#ffffff', dynA: '#ec4899', dynB: '#3b82f6', gradientPalette: [],
                shapeStyle: 'rubik',
                cubeSizeRatio: 0.08, pitchSensitivity: 0.9, rotationEnergyThreshold: 0.35, layerTurnSpeed: 0.08,
                // Clock (core/visualizer/groups/shape/clock.js): kích thước (tỉ lệ cạnh ngắn), tốc độ bánh răng (rad/s: nền +
                // theo năng lượng). Blur chỉ style clock đọc (CUSTOM_EFFECT_BLUR_STYLES, core/custom-effect.js).
                clockSizeRatio: 0.8, clockGearSpeedBase: 0.4, clockGearSpeedEnergyMult: 2.5,
                clockCaseVisible: true, clockTicksVisible: true,
                clockGlassVisible: true,
                // Con lắc: bật/tắt, bóng mờ của dây, chiều dài (% tối đa vừa màn hình, 20-100).
                clockPendulumEnabled: true, clockPendulumTrail: true, clockPendulumLength: 70,
                // Nền mặt số: bật -> bìa bài đang phát; clockBgImageKey = ảnh thư viện thay bìa (null = bìa); độ đục 0-1.
                clockBgEnabled: false, clockBgImageKey: null, clockBgOpacity: 0.6,
                blurEnabled: true, blurIntensity: 60,
            },
            vortex: {
                mode: 'solid', solidColor: '#ffffff', dynA: '#ec4899', dynB: '#3b82f6', gradientPalette: [],
                vortexStyle: 'rings', tunnelRingCount: 60,
                warpSpeedBase: 10, warpSpeedEnergyMult: 40,
                // Ống rẽ 8 hướng khi nhạc chuyển đoạn (event/workflow/visualizer/vortex.js::_steerTunnel()); tắt = ống thẳng.
                redirectEnabled: true,
                sectionWindowBeats: 12, fluxThreshold: 0.5,
                barsRingCount: 40, barsPerRing: 24, barsTwistFactor: 2.4,
                waveRotationBase: 0.01, waveRotationEnergyMult: 0.05, waveScaleBase: 0.8, waveScaleEnergyMult: 0.4,
            },
            connector: {
                mode: 'solid', solidColor: '#ffffff', dynA: '#ec4899', dynB: '#3b82f6', gradientPalette: [],
                connectorStyle: 'circuit', // style duy nhất
                glowEnabled: true, glowIntensity: 55, // % — 55% × 4 = bloom 2.2
                fireThreshold: 0.55,
                lateralInhibitStrength: 70, // mức đè ngưỡng láng giềng khi 1 chip bắn, xem core/custom-effect.js
                nodeCount: 32, maxConcurrentSignals: 60, trailLength: 20, // nodeCount = số chip = tổng chân mỗi chip
                circuitSpeedBase: 80, circuitSpeedEnergyMult: 60,
                cameraShiftEnabled: true, sectionWindowBeats: 12, fluxThreshold: 0.5,
                // Circuit: số chân phóng tối đa mỗi lần bắn, độ sáng đường mạch, camera 'orbit' | 'follow' | 'fixed' + vị trí/góc
                // camera cố định (X/Y dời, Z khoảng cách, xoay ngang/dọc theo độ).
                maxPinsPerFire: 3, traceOpacity: 0.35,
                cameraMode: 'orbit',
                camPosX: 0, camPosY: 0, camPosZ: 150, camRotY: 35, camRotX: 20,
            },
        };


        const DEFAULT_VIZ_CONFIG = {
            type: 'bar',
            customEffect: DEFAULT_CUSTOM_EFFECT,
            bgImage: '', bgBlur: 0, // bgBlur không còn được đọc — giữ field cho data cũ hợp lệ
            // Kính màn Playlist khi nền Morphin là Background media: độ nhoè backdrop (px, 10-40), độ đục nền trắng (%, 5-40).
            appGlassBlur: 36, appGlassTint: 10,
            // 'light' | 'dark' | 'none' (Morphin không nền) | 'gradient' (gradientFrom/To) | 'background' (ảnh/video thư viện,
            // bgMediaKind/bgMediaKey) — chốt tại event/workflow/theme.js::commitThemeMode().
            themeMode: 'dark',
            gradientFrom: '#6366f1', gradientTo: '#ec4899',
            // Kiểu nền chọn gần nhất khi ở Morphin ('none' | 'gradient' | 'background'; '' = chưa chọn) — vào lại Morphin dùng nó.
            morphinLastMode: '',
            // Nền media: tham chiếu item thư viện — bgMediaKind 'photo' | 'video' | '', bgMediaKey = key item. Item mất -> lúc boot
            // về bgFallbackMode (nền 'none' | 'gradient' chọn gần nhất trước khi vào media; computeAppBgMediaFallback()).
            bgMediaKind: '', bgMediaKey: '', bgFallbackMode: 'gradient',
            // Runtime (blob: URL sống 1 phiên, không lưu, boot reset về ''): bgImage = ảnh nền, bgVideo = video nền, bgMediaThumb =
            // thumb full-res của video (poster, preview card, lấy màu status bar/preloader).
            bgVideo: '', bgMediaThumb: '',
            // eqPresetId = preset EQ đang chọn (core/eq-presets.js).
            volume: 100, eqPresetId: 'flat',
            // Tốc độ phát chung Song/Video Player (0.5/1/1.2/1.5/2); VBG chỉ theo khi videoSyncPlaybackSpeed.
            playbackSpeed: 1,
            visualEnabled: true,
            // Độ khó đã chọn theo từng game { [gameId]: 'easy'|'medium'|'hard' } (core/gameplay/catalog.js); vắng = 'hard'.
            // Chép sang appState.gameplayDifficulty lúc armed (event/workflow/game-catalog.js::armGame()).
            gameplayDifficultyByGame: {},
            keepScreenOn: true,
            // Auto-Switch Effect (core/auto-switch-visual.js):
            //   - autoSwitchVisualListBy: 'group' | 'style' — danh sách đang dùng.
            //   - autoSwitchVisualGroupList [{key, enabled, style: 'random'|<style>}] / autoSwitchVisualStyleList [{key, enabled}] —
            //     thứ tự = thứ tự kéo thả; rỗng = chuẩn hoá lúc boot theo EFFECT_GROUPS/MODES.
            //   - autoSwitchVisualMode: 'sequential' (theo thứ tự danh sách) | 'random' (trong các mục đã tick).
            //   - autoSwitchVisualTimeMode: 'fixed' | 'perMedia' (mỗi song/video/photo mới).
            //   - autoSwitchVisualFixedKind: 'const' (SecondsFixed) | 'random' (SecondsRandomMin..SecondsRandom).
            //   - Giây kẹp [10, 3600] (AUTO_SWITCH_VISUAL_MIN/MAX_SECONDS, service/state/auto-switch.js).
            autoSwitchVisualEnabled: false,
            autoSwitchVisualListBy: 'style',
            autoSwitchVisualGroupList: [],
            autoSwitchVisualStyleList: [],
            autoSwitchVisualMode: 'sequential',
            autoSwitchVisualTimeMode: 'fixed',
            autoSwitchVisualFixedKind: 'const',
            autoSwitchVisualSecondsFixed: 30,
            autoSwitchVisualSecondsRandomMin: 10,
            autoSwitchVisualSecondsRandom: 60,
            // Phụ đề lúc phát (event/workflow/subtitle-display.js, Settings > Display > Subtitles).
            subtitlesEnabled: true,
            subtitleBoxCss: '', // CSS từ Element Style Editor cho khung #subtitle-frame (chỉ áp khi subtitleUseCustomStyling)
            subtitleUseCustomStyling: false, // false = chỉ màu + cỡ chữ (2 field dưới, cỡ 8-16px chọn ở UI)
            subtitleDefaultFontSize: 16,
            subtitleDefaultColor: '#ffffff',
            // Comming/In/Outing — chung mọi dòng, khung giờ neo start/end từng dòng (core/subtitle/subtitle-transition.js).
            // valueMs có dấu, biên [-5000, 5000].
            subtitleCommingEffect: 'none', subtitleCommingValueMs: 0,
            subtitleInEffect: 'none',
            subtitleOutingEffect: 'none', subtitleOutingValueMs: 0,
            // Karaoke (dòng có timing đã Apply ở Subtitle Editor) — core/subtitle/subtitle-karaoke-display.js.
            subtitleKaraokeEnabled: true,
            subtitleKaraokeMode: 'kf',             // 'k' | 'kf' | 'vanish' | 'reveal'
            subtitleKaraokeDissolve: 'fade',       // hiệu ứng tan/hiện cho vanish/reveal: 'fade' | 'dust' | 'smoke'
            subtitleKaraokeColor: '#facc15',       // màu phần đã hát — riêng karaoke, ưu tiên hơn style phụ đề
            subtitleKaraokeActiveEffect: 'none',   // 'none' | 'swell' | 'bounceUp' | 'dropDown' | 'squashX' | 'squashY'
            subtitleKaraokeSquashDirection: 'in',  // squashX/Y: 'in' thu vào | 'out' phóng ra
            subtitleKaraokeOutline: false,         // viền từ đang hát
            subtitleKaraokeOutlineWidth: 2,        // px
            subtitleKaraokeOutlineOpacity: 1,      // 0..1 (độ mờ viền)
            subtitleKaraokeOutlineGlow: 0.6,       // 0..1 (độ sáng quầng)
            subtitleKaraokeOutlineBlur: 6,         // px (độ nhoè quầng)
            subtitleKaraokePointer: false,
            subtitleKaraokePointerShape: 'default', // 'default' | 'pointer' | 'text' | 'crosshair' (vẽ lại kiểu CSS cursor)
            // 3 toggle hiện/ẩn UI chrome màn Visualizer (core/visualizer-ui-visibility.js).
            bottomPlayerVisible: true, playlistButtonVisible: true, controlCenterButtonVisible: true,
            // Settings > Theme > Player control (core/player-control-style.js): kiểu nền 'glass' | 'floating' | 'none', độ đục
            // 20-100 (%), bìa trong nút Play, khoảng cách phụ đề ↔ mép trên thanh (px).
            playerControlBgStyle: 'glass', playerControlOpacity: 100, playerControlCoverPlay: true,
            playerControlSubtitleGap: 16,
            // Cử chỉ (event/workflow/visualizer-gesture.js): mỗi hướng vuốt/tap 1 hành động ('next'/'prev'/'playPause'/
            // 'openPlaylist'/'none' = tắt, hoặc 'actionSlot1/2/3').
            gestureActionSwipeUp: 'next', gestureActionSwipeDown: 'prev',
            gestureActionSwipeLeft: 'prev', gestureActionSwipeRight: 'next',
            gestureActionTapSingle: 'playPause', gestureActionTapDouble: 'openPlaylist',
            gestureEdgeTopEnabled: true,
            // Tap 3 lần — cùng miền giá trị với tap 1/2; mặc định 'none'.
            gestureTripleTapTarget: 'none',
            // 3 Action slot cố định, mỗi slot gán 1 nút Control Center (key khớp GESTURE_TRIPLE_TAP_TARGET_ELS) — vuốt/tap chọn
            // 'actionSlotN' để bấm nút đó. 'none' = chưa gán.
            gestureActionSlot1: 'none', gestureActionSlot2: 'none', gestureActionSlot3: 'none',
            // Seek-hold: giữ tay nửa trái/phải màn hình (ngưỡng kích hoạt cố định SEEK_HOLD_ACTIVATE_MS) -> cứ mỗi
            // gestureSeekHoldIntervalMs lại tua gestureSeekStepMs, tới khi thả tay hoặc chạm biên.
            gestureSeekHoldEnabled: true, gestureSeekStepMs: 2000, gestureSeekHoldIntervalMs: 2000,
        };

        /**
         * Visual Background — đúng 1 nguồn `source`: `list` là bản copy key (imageKey/videoKey) lúc chọn, chỉ đổi khi bấm
         * "Làm tươi". Số item còn sống quyết định: 0 -> chỉ nền màu, 1 -> phát tĩnh, >1 -> cycle theo listPlaybackMode/
         * nextOrder. `list` có thể chứa `null` (key đã xoá, chờ dọn — advanceVisualBgList(), core/visual-bg-common.js).
         * Nền màu (colorMode/solidColor/gradient*) độc lập với source, luôn là lớp dưới cùng.
         * Lưu `meta.visualBgConfig`, đọc lại lúc boot qua workflowVisualBg.loadPersistedSettingsOnBoot().
         */
        const DEFAULT_VISUAL_BG_CONFIG = {
            // Toggle tổng: tắt chỉ dỡ media ảnh/video, lớp màu (+ Movement) vẫn sơn; bật lại nạp từ đầu (workflowVisualBg.toggleEnabled()).
            enabled: true,
            type: 'photo',                  // 'photo' | 'video' — đổi type = gỡ hẳn source cũ (khác kiểu key)

            source: {
                originKind: null,           // null | 'single' | 'group' — CHỈ để nút "Làm tươi" biết đọc lại từ đâu
                originId: null,             // imageKey/videoKey/albumId/folderId của origin
                list: [],                   // bản copy key thật đang phát/hiện
                // videoKey -> { enabled, volumePercent }: tiếng của video nền (phát native, không qua EQ), chỉ khi type 'video'.
                // Xoá khi đổi type/clearSource() — getVisualBgVideoAudioSetting()/setVisualBgVideoAudioSetting(), core/visual-bg-video.js.
                videoAudio: {},
            },

            // Nguồn mới chọn/Làm tươi lúc đang có media active: xếp hàng ở đây, áp ở lượt kế tiếp (video hết/đổi bài/tick
            // slideshow — workflowVisualBg._checkAndApplyPendingSource()); chỉ giữ 1 pending, chọn tiếp thì đè. originKind null = trống.
            pending: {
                originKind: null,           // null | 'single' | 'group'
                originId: null,
                list: [],                   // đã resolve sẵn (key thật) lúc queue — áp KHÔNG đọc lại DB lần 2
            },

            listPlaybackMode: 'perSong',    // 'perSong' | 'slideshow' — chỉ có ý nghĩa khi list.length > 1
            nextOrder: 'random',            // 'random' | 'sequential' | 'playlist' — thứ tự dựng list lúc chọn/Làm tươi + bước cycle

            // Thời lượng mỗi item khi đang cycle slideshow (video lẫn ảnh): 'duration' = độ dài tự nhiên (video phát hết; ảnh theo
            // field `duration` riêng), 'fixtime' = mọi item đúng durationSeconds (video chỉ bị cắt nếu dài hơn). 1 nguồn / perSong
            // luôn theo độ dài tự nhiên — resolveVisualBgItemDurationSource() (core/visual-bg-common.js).
            durationMode: 'duration',        // 'duration' | 'fixtime'
            durationSeconds: 5,              // 0.5-60s, bước 0.1s — dùng khi durationMode 'fixtime'

            // ---- Nền MÀU — độc lập, luôn active ----
            colorMode: 'solid',             // 'solid' | 'gradient'
            solidColor: '#000000',
            gradientAngleDeg: 180,
            gradientStops: [
                { color: '#000000', position: 0 },
                { color: '#1e3a8a', position: 100 },
            ],
            // Movement (chỉ khi colorMode 'gradient'): 'time' = xoay đều 1 vòng mỗi rotateDurationMs; 'audio' = góc xoay và độ
            // giãn stop (computeGradientStopSpread(), core/visual-bg-common.js) dao động theo smoothedEnergy. "Tráo màu" chạy song song:
            // mỗi colorSwapIntervalMs tráo ngẫu nhiên màu giữa các stop (planGradientColorSwap()), chuyển trong colorSwapTransitionMs.
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

            // Preset Motion gắn cho ảnh (core/motion-presets.js); null = không transition/Ken Burns.
            motionPresetId: null,
            // Video nền theo tốc độ phát chung (playbackSpeed) hay giữ 1x — chỉ khi type 'video'.
            videoSyncPlaybackSpeed: false,
            // Cách media VBG lấp khung, riêng Video/Photo: 'fill' (lấp đầy giữ tỉ lệ, cắt dư) | 'stretch' | 'trueMax' — cùng giá trị
            // với Player (PLAYER_RESOLUTION_MODES, core/player-display-settings.js) nhưng độc lập (workflowVisualBg.changeResolutionMode()).
            videoResolutionMode: 'fill',
            photoResolutionMode: 'fill',
        };

        const DEFAULT_READER_CONFIG = {
            fontFamily: 'system-ui',
            fontSize: 18,
            bgColor: '#000000',
            textColor: '#ffffff',
            opacity: 0.85,
        };

        /**
         * Settings > Playlist (Nguồn/Kiểu xem/Sắp xếp), lưu `meta.playlistConfig`. Cố ý không gồm 3 field "Giải phóng bộ nhớ"
         * (thao tác phá dữ liệu — reset về mặc định an toàn mỗi lần mở panel).
         */
        const DEFAULT_PLAYLIST_CONFIG = {
            activeMediaSource: 'song',
            displaySortMode: 'az',
            isGridView: false,
        };

        /** Shuffle/Repeat/hiện Stats panel của trình phát. */
        const DEFAULT_PLAYER_CONFIG = {
            isShuffle: false,
            repeatMode: 0,
            isStatsPanelVisible: true,
        };

        /** Theme màu toàn app (core/ui-theme/*.js) — độc lập với viz.themeMode (chỉ là nền phía sau Playlist/Visualizer). */
        const DEFAULT_UI_THEME_CONFIG = {
            activeUiTheme: 'light', // 'light' | 'dark' | 'morphin' — xem UI_THEME_REGISTRY, core/ui-theme/registry.js
        };

        /**
         * Settings > Visualizer Screen > Player — Video/Photo đang phát làm nội dung chính (khác domain 'player' Shuffle/Repeat
         * và VBG). `*ResolutionMode`: 'fill' | 'stretch' | 'trueMax' (PLAYER_RESOLUTION_MODES, core/player-display-settings.js;
         * áp ở core/player-display-apply.js, cùng mode cho 2 layer A/B của Video). `*PresetId`: preset Motion gắn cho từng vai trò
         * (PLAYER_MOTION_SLOTS) — videoShowingPresetId lái cả Point Move lẫn React Beat của Video; null = chưa gắn.
         */
        const DEFAULT_PLAYER_DISPLAY_CONFIG = {
            videoResolutionMode: 'fill',
            videoTransitionNextPresetId: null,
            videoTransitionPrevPresetId: null,
            videoShowingPresetId: null,
            photoResolutionMode: 'fill',
            photoTransitionNextPresetId: null,
            photoTransitionPrevPresetId: null,
            photoPointMovePresetId: null,
            // Zoom mode (kính lúp Control Center), mỗi kind 1 bộ, lưu bền: x, y = tỉ lệ khung (core/player-zoom.js); {1,0,0} = gốc.
            videoZoom: { scale: 1, x: 0, y: 0 },
            photoZoom: { scale: 1, x: 0, y: 0 },
        };

        /**
         * Settings > System > Pagination, lưu `meta.paginationConfig` (event/workflow/pagination.js). Mỗi nơi 1 bộ trong `places`:
         * `enabled` (false = không phân trang), `pageSize` 1..200, `style` 'arrow' | 'list' | 'full' | 'loadMore'. Key khớp
         * PAGINATION_PLACES (core/pagination.js); nơi mới thêm tự nhận mặc định lúc boot.
         */
        const DEFAULT_PAGINATION_PLACE = { enabled: false, pageSize: 20, style: 'full' };
        const DEFAULT_PAGINATION_CONFIG = {
            places: {
                statisTopList: { ...DEFAULT_PAGINATION_PLACE },
                debugConsole: { ...DEFAULT_PAGINATION_PLACE },
                folderBrowser: { ...DEFAULT_PAGINATION_PLACE },
                motionPresets: { ...DEFAULT_PAGINATION_PLACE },
                filterPresets: { ...DEFAULT_PAGINATION_PLACE },
                eqPresets: { ...DEFAULT_PAGINATION_PLACE },
            },
        };

        /**
         * Settings > System > Ghi âm, lưu `meta.recorderConfig` (event/workflow/recorder.js). `mode` 'speaker' (chỉ mic) |
         * 'headphones' (nhạc gốc + mic); `latencyMs` trễ nhánh nhạc 0..500 (clampRecorderLatencyMs()); `countInSec` 0/3/5;
         * `quality` 'standard' | 'high' | 'max' (core/recorder.js).
         */
        const DEFAULT_RECORDER_CONFIG = {
            mode: 'speaker',
            latencyMs: 100,
            countInSec: 3,
            quality: 'standard',
        };

        /**
         * Settings > Troubleshooting > Performance HUD, lưu `meta.perfHudConfig` (event/workflow/perf-hud.js). `style` 'strip' |
         * 'detail' (PERF_HUD_STYLES, core/perf-hud.js); `orientation` chỉ cho strip; `position` {left, top} lần kéo cuối, null = mặc định.
         */
        const DEFAULT_PERF_HUD_CONFIG = {
            enabled: false,
            style: 'strip',
            orientation: 'horizontal',
            position: null,
        };

        AppConfig.defineDomain('viz', {
            schema: {
                type: 'string', customEffect: 'object',
                bgImage: 'string', bgBlur: 'number', appGlassBlur: 'number', appGlassTint: 'number',
                themeMode: 'string', gradientFrom: 'string', gradientTo: 'string',
                morphinLastMode: 'string', bgMediaKind: 'string', bgMediaKey: 'string', bgFallbackMode: 'string', bgVideo: 'string', bgMediaThumb: 'string',
                volume: 'number', eqPresetId: 'string', playbackSpeed: 'number',
                visualEnabled: 'boolean',
                gameplayDifficultyByGame: 'object',
                keepScreenOn: 'boolean',
                autoSwitchVisualEnabled: 'boolean', autoSwitchVisualMode: 'string', autoSwitchVisualTimeMode: 'string',
                autoSwitchVisualListBy: 'string', autoSwitchVisualGroupList: 'array', autoSwitchVisualStyleList: 'array',
                autoSwitchVisualFixedKind: 'string',
                autoSwitchVisualSecondsFixed: 'number', autoSwitchVisualSecondsRandomMin: 'number', autoSwitchVisualSecondsRandom: 'number',
                subtitlesEnabled: 'boolean',
                subtitleBoxCss: 'string',
                subtitleUseCustomStyling: 'boolean',
                subtitleDefaultFontSize: 'number', subtitleDefaultColor: 'string',
                subtitleCommingEffect: 'string', subtitleCommingValueMs: 'number',
                subtitleInEffect: 'string',
                subtitleOutingEffect: 'string', subtitleOutingValueMs: 'number',
                subtitleKaraokeEnabled: 'boolean', subtitleKaraokeMode: 'string', subtitleKaraokeDissolve: 'string',
                subtitleKaraokeColor: 'string', subtitleKaraokeActiveEffect: 'string', subtitleKaraokeSquashDirection: 'string',
                subtitleKaraokeOutline: 'boolean', subtitleKaraokeOutlineWidth: 'number', subtitleKaraokeOutlineOpacity: 'number',
                subtitleKaraokeOutlineGlow: 'number', subtitleKaraokeOutlineBlur: 'number',
                subtitleKaraokePointer: 'boolean', subtitleKaraokePointerShape: 'string',
                bottomPlayerVisible: 'boolean', playlistButtonVisible: 'boolean', controlCenterButtonVisible: 'boolean',
                playerControlBgStyle: 'string', playerControlOpacity: 'number', playerControlCoverPlay: 'boolean',
                playerControlSubtitleGap: 'number',
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
                enabled: 'boolean', // toggle tổng
                type: 'string',
                source: 'object', // { originKind: nullable-string, originId: nullable-string, list: array }
                pending: 'object', // { originKind: nullable-string, originId: nullable-string, list: array } — xem DEFAULT_VISUAL_BG_CONFIG.pending
                listPlaybackMode: 'string', nextOrder: 'string',
                colorMode: 'string', solidColor: 'string', gradientAngleDeg: 'number',
                gradientStops: 'object',
                gradientMovement: 'object',
                durationMode: 'string', durationSeconds: 'number',
                motionPresetId: 'nullable-string',
                videoSyncPlaybackSpeed: 'boolean',
                videoResolutionMode: 'string', photoResolutionMode: 'string',
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

        AppConfig.defineDomain('uiTheme', {
            schema: {
                activeUiTheme: 'string',
            },
            defaults: DEFAULT_UI_THEME_CONFIG,
        });

        AppConfig.defineDomain('playerDisplay', {
            schema: {
                videoResolutionMode: 'string',
                videoTransitionNextPresetId: 'nullable-string',
                videoTransitionPrevPresetId: 'nullable-string',
                videoShowingPresetId: 'nullable-string',
                photoResolutionMode: 'string',
                photoTransitionNextPresetId: 'nullable-string',
                photoTransitionPrevPresetId: 'nullable-string',
                photoPointMovePresetId: 'nullable-string',
                videoZoom: 'object', // {scale, x, y} hệ tỉ lệ
                photoZoom: 'object',
            },
            defaults: DEFAULT_PLAYER_DISPLAY_CONFIG,
        });

        AppConfig.defineDomain('pagination', {
            schema: {
                places: 'object',
            },
            defaults: DEFAULT_PAGINATION_CONFIG,
        });

        AppConfig.defineDomain('recorder', {
            schema: {
                mode: 'string',
                latencyMs: 'number',
                countInSec: 'number',
                quality: 'string',
            },
            defaults: DEFAULT_RECORDER_CONFIG,
        });

        AppConfig.defineDomain('perfHud', {
            schema: {
                enabled: 'boolean',
                style: 'string',
                orientation: 'string',
                position: 'any', // {left, top} | null
            },
            defaults: DEFAULT_PERF_HUD_CONFIG,
        });

        // Seed mọi domain ngay lúc nạp file (trước khi tạo accessor bên dưới — access() domain chưa seed sẽ cảnh báo) và trước
        // `workflowConfig.loadOnBoot()` (event/workflow/config.js) merge cấu hình đã lưu đè lên.
        appConfig.seed('viz');
        appConfig.seed('visualBg');
        appConfig.seed('reader');
        appConfig.seed('playlist');
        appConfig.seed('player');
        appConfig.seed('uiTheme');
        appConfig.seed('playerDisplay');
        appConfig.seed('pagination');
        appConfig.seed('recorder');
        appConfig.seed('perfHud');

        /** Accessor dùng khắp core/event cho từng domain — xem AppConfig.access(). */
        const appConfigViz = appConfig.access('viz');
        const appConfigVisualBg = appConfig.access('visualBg');
        const appConfigReader = appConfig.access('reader');
        const appConfigPlaylist = appConfig.access('playlist');
        const appConfigPlayer = appConfig.access('player');
        const appConfigUiTheme = appConfig.access('uiTheme');
        const appConfigPlayerDisplay = appConfig.access('playerDisplay');
        const appConfigPagination = appConfig.access('pagination'); // Settings > System > Pagination
        const appConfigRecorder = appConfig.access('recorder'); // Settings > System > Ghi âm
        const appConfigPerfHud = appConfig.access('perfHud'); // Settings > Troubleshooting > Performance HUD

        /** Khoá localStorage của vizConfig (bản V20 cũ chỉ còn đọc lúc boot). */
        const VIZ_CONFIG_STORAGE_KEY = 'visualMasterConfigV21';
        const VIZ_CONFIG_LEGACY_STORAGE_KEY = 'visualMasterConfigV20';

        /** timeMode cũ của Auto-Switch -> giá trị mới (field không có = giữ nguyên). */
        const AUTO_SWITCH_LEGACY_TIME_MODE = {
            random: { timeMode: 'fixed', fixedKind: 'random' },
            duration: { timeMode: 'perMedia' },
        };

        /** Reset vizConfig về default (Workflow tự lưu + reload sau). */
        function restoreDefaultVizConfig() {
            appConfigViz.restoreDefaults();
        }

        /** Reset visualBgConfig về default (event/workflow/settings-misc.js::confirmRestoreDefaults() tự lưu + reload sau). */
        function restoreDefaultVisualBgConfig() {
            appConfigVisualBg.restoreDefaults();
        }

        /** Ghi vizConfig vào localStorage — nguồn lưu chính, đồng bộ (bản backup IndexedDB do Workflow hẹn giờ ghi).
         * @param {object} cfg - appConfigViz.getAll() */
        function writeVizConfigToStorage(cfg) {
            localStorage.setItem(VIZ_CONFIG_STORAGE_KEY, JSON.stringify(cfg));
        }

        /** Bản backup IndexedDB (meta.configBackup) — bỏ 3 blob: URL chỉ sống trong 1 phiên. @param {object} cfg @returns {object} */
        function buildVizConfigBackup(cfg) {
            const { bgImage, bgVideo, bgMediaThumb, ...persistable } = cfg;
            return persistable;
        }

        /** Chuỗi JSON đã lưu -> object; rỗng/hỏng -> {} (giữ default). @param {string|null} raw @returns {object} */
        function parseSavedVizConfig(raw) {
            if (!raw) return {};
            try {
                const obj = JSON.parse(raw);
                return obj && typeof obj === 'object' ? obj : {};
            } catch (e) {
                return {};
            }
        }

        /** Cấu hình đã lưu đè lên cấu hình hiện tại (default vừa seed) — field thiếu giữ default. @param {object} current
         * @param {object} saved @returns {object} */
        function mergeSavedVizConfig(current, saved) {
            return { ...current, ...saved };
        }

        /**
         * Di trú + chuẩn hoá vizConfig vừa nạp (sửa thẳng `cfg` — dùng làm mutator của appConfigViz.mutateAll()). Mỗi bước
         * chỉ chạy khi gặp dữ liệu cũ tương ứng, chạy lại trên dữ liệu đã sạch là vô hại. Chuẩn hoá danh sách group/style của
         * Auto-Switch theo registry do Workflow gọi riêng ngay sau (normalizeAutoSwitch*List(), core/auto-switch-visual.js).
         * @param {object} cfg
         */
        function migrateVizConfig(cfg) {
            // eqMode/manualEq cũ -> eqPresetId (5 preset gốc giữ id; 'manual' về Default).
            if (!cfg.eqPresetId) cfg.eqPresetId = (cfg.eqMode && cfg.eqMode !== 'manual') ? cfg.eqMode : 'flat';
            delete cfg.eqMode; delete cfg.manualEq;
            // Visualizer đã bỏ -> 'bar'.
            if (cfg.type === 'synthesia' || cfg.type === 'firefly_forest' || cfg.type === 'seasons' || cfg.type === 'wave') cfg.type = 'bar';

            // 'black hole' (type riêng cũ) -> style của group 'bar'; 'rubik' -> group 'shape'. Chạy TRƯỚC bước merge
            // DEFAULT_CUSTOM_EFFECT dưới (default không còn 2 khoá này — không di trú trước thì tinh chỉnh cũ bị bỏ quên).
            if (cfg.customEffect) {
                if (cfg.customEffect['black hole']) {
                    const wasActive = cfg.type === 'black hole';
                    cfg.customEffect.bar = { ...cfg.customEffect['black hole'], ...cfg.customEffect.bar };
                    if (wasActive) cfg.customEffect.bar.barStyle = 'black hole';
                    delete cfg.customEffect['black hole'];
                }
                if (cfg.customEffect['rubik']) {
                    cfg.customEffect.shape = { ...cfg.customEffect['rubik'], shapeStyle: 'rubik' };
                    delete cfg.customEffect['rubik'];
                }
            }
            if (cfg.type === 'black hole') cfg.type = 'bar';
            else if (cfg.type === 'rubik') cfg.type = 'shape';

            // customEffect: đủ mọi effect từ default + field đã lưu; save rất cũ còn field phẳng ở gốc cfg -> chuyển vào đúng effect.
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
            // Xoá trường style Street Light cũ; hiệu ứng này chỉ còn Snow.
            if (next.rain) delete next.rain.streetRainStyle;
            // rain.glassFlash -> flashEnabled (chỉ khi save cũ chưa có flashEnabled); luôn xoá glassFlash.
            const savedRain = cfg.customEffect && cfg.customEffect.rain;
            if (next.rain && next.rain.glassFlash != null) {
                if (!savedRain || savedRain.flashEnabled == null) next.rain.flashEnabled = !!next.rain.glassFlash;
                delete next.rain.glassFlash;
            }
            // Clock: 2 toggle clockPendulum/clockRingsVisible -> clockAccessory (bước trung gian) -> clockPendulumEnabled;
            // xoá khoá thừa của các bản đã bỏ (nguồn kim, lật thân, vòng Time scan, độ nhạy vạch phổ).
            const savedShape = cfg.customEffect && cfg.customEffect.shape;
            if (next.shape && savedShape && savedShape.clockAccessory == null && (savedShape.clockPendulum != null || savedShape.clockRingsVisible != null)) {
                next.shape.clockAccessory = savedShape.clockPendulum === true ? 'pendulum' : savedShape.clockRingsVisible === false ? 'none' : 'rings';
            }
            if (next.shape) { delete next.shape.clockPendulum; delete next.shape.clockRingsVisible; }
            if (next.shape) delete next.shape.clockHandsSource;
            if (next.shape) delete next.shape.clockFlip;
            if (next.shape && savedShape && savedShape.clockPendulumEnabled == null && savedShape.clockAccessory != null) {
                next.shape.clockPendulumEnabled = savedShape.clockAccessory === 'pendulum';
            }
            // Black Hole: độ rộng cột kẹp 5-10px.
            if (next.bar && next.bar.barWidth != null) next.bar.barWidth = Math.max(5, Math.min(10, Number(next.bar.barWidth) || 8));
            if (next.shape) ['clockAccessory', 'clockRingWidth', 'clockRingRadius', 'clockRingBgOpacity', 'clockTickGain'].forEach((k) => { delete next.shape[k]; });
            cfg.customEffect = next;
            delete cfg.mode; delete cfg.solidColor; delete cfg.dynA; delete cfg.dynB; delete cfg.blurEnabled;
            delete cfg.barStyle; delete cfg.vortexStyle; delete cfg.rainStyle; delete cfg.glassFlash;
            delete cfg.minH; delete cfg.maxH; delete cfg.barWidth; delete cfg.mirrorBarCount;
            delete cfg.rainGlassCityOpacity; delete cfg.rainGlassCityVisible; delete cfg.rainGlassMoonVisible; delete cfg.rainGlassWindowVisible;
            delete cfg.quality;

            // Nền: 'solid' đã bỏ -> 'none'; data chưa có morphinLastMode mà đang ở 1 kiểu nền Morphin -> nhớ kiểu đó.
            if (cfg.themeMode === 'solid') cfg.themeMode = 'none';
            if (cfg.bgFallbackMode === 'solid') cfg.bgFallbackMode = 'none';
            if (cfg.morphinLastMode === 'solid') cfg.morphinLastMode = 'none';
            delete cfg.bgSolidColor;
            if (!cfg.morphinLastMode && ['none', 'gradient', 'background'].includes(cfg.themeMode)) cfg.morphinLastMode = cfg.themeMode;
            delete cfg.bgImageEnabled;
            if (cfg.themeMode == null) cfg.themeMode = 'dark';
            if (!cfg.gradientFrom) cfg.gradientFrom = DEFAULT_VIZ_CONFIG.gradientFrom;
            if (!cfg.gradientTo) cfg.gradientTo = DEFAULT_VIZ_CONFIG.gradientTo;
            if (cfg.keepScreenOn == null) cfg.keepScreenOn = true;
            if (cfg.subtitlesEnabled == null) cfg.subtitlesEnabled = true;
            if (cfg.visualEnabled == null) cfg.visualEnabled = true;
            if (cfg.gameplayDifficultyByGame == null || typeof cfg.gameplayDifficultyByGame !== 'object') cfg.gameplayDifficultyByGame = {};
            // Game mode không lưu bền (trạng thái RAM) — dọn field cũ.
            delete cfg.gameplayModeEnabled;
            delete cfg.gameplayArmedGameId;

            // Auto-Switch Effect.
            if (cfg.autoSwitchVisualEnabled == null) cfg.autoSwitchVisualEnabled = false;
            if (cfg.autoSwitchVisualMode !== 'sequential' && cfg.autoSwitchVisualMode !== 'random') cfg.autoSwitchVisualMode = 'sequential';
            if (typeof cfg.autoSwitchVisualSeconds === 'number' && cfg.autoSwitchVisualSecondsFixed == null) cfg.autoSwitchVisualSecondsFixed = cfg.autoSwitchVisualSeconds;
            delete cfg.autoSwitchVisualSeconds;
            // timeMode cũ: 'random' -> 'fixed' + kiểu random (giữ SecondsRandom làm trần); 'duration' -> 'perMedia'.
            const legacyTime = AUTO_SWITCH_LEGACY_TIME_MODE[cfg.autoSwitchVisualTimeMode] || {};
            if (legacyTime.timeMode) cfg.autoSwitchVisualTimeMode = legacyTime.timeMode;
            if (legacyTime.fixedKind) cfg.autoSwitchVisualFixedKind = legacyTime.fixedKind;
            if (cfg.autoSwitchVisualTimeMode !== 'fixed' && cfg.autoSwitchVisualTimeMode !== 'perMedia') cfg.autoSwitchVisualTimeMode = 'fixed';
            if (cfg.autoSwitchVisualFixedKind !== 'const' && cfg.autoSwitchVisualFixedKind !== 'random') cfg.autoSwitchVisualFixedKind = 'const';
            delete cfg.autoSwitchVisualSecondsDuration;
            ['autoSwitchVisualSecondsFixed', 'autoSwitchVisualSecondsRandomMin', 'autoSwitchVisualSecondsRandom'].forEach((field) => {
                if (typeof cfg[field] !== 'number' || !isFinite(cfg[field])) cfg[field] = DEFAULT_VIZ_CONFIG[field];
                cfg[field] = Math.max(AUTO_SWITCH_VISUAL_MIN_SECONDS, Math.min(AUTO_SWITCH_VISUAL_MAX_SECONDS, Math.round(cfg[field])));
            });
            if (cfg.autoSwitchVisualSecondsRandomMin > cfg.autoSwitchVisualSecondsRandom) cfg.autoSwitchVisualSecondsRandom = cfg.autoSwitchVisualSecondsRandomMin;
            if (cfg.autoSwitchVisualListBy !== 'group' && cfg.autoSwitchVisualListBy !== 'style') cfg.autoSwitchVisualListBy = 'style';
            // Connector chỉ còn style 'circuit' (bỏ 'brain', 'synapse'): mọi lựa chọn style khác -> 'circuit'; dọn field riêng
            // của 2 style đã bỏ khỏi bucket connector và ô byStyle.
            const cn = (cfg.customEffect || {}).connector;
            const CONNECTOR_REMOVED_STYLES = ['brain', 'synapse'];
            const CONNECTOR_REMOVED_FIELDS = ['burstEnabled', 'neuronCount', 'synapseSpeedBase', 'synapseSpeedEnergyMult'];
            if (cn) cn.connectorStyle = 'circuit';
            if (cn) Object.keys(cn).forEach((k) => { if (k.indexOf('brain') === 0 || CONNECTOR_REMOVED_FIELDS.includes(k)) delete cn[k]; });
            if (cn && cn.byStyle) CONNECTOR_REMOVED_STYLES.forEach((st) => { delete cn.byStyle[st]; });
            // Bloom strength gộp vào Glow intensity: glowIntensity = bloomStrengthBase / 4 theo %, làm tròn bước 5 (ghi cả
            // byStyle.circuit — giá trị cũ ở đó mang nghĩa khác).
            if (cn && typeof cn.bloomStrengthBase === 'number') {
                const glowFromBloom = Math.max(0, Math.min(100, Math.round(cn.bloomStrengthBase / 4 * 100 / 5) * 5));
                cn.glowIntensity = glowFromBloom;
                if (cn.byStyle && cn.byStyle.circuit) cn.byStyle.circuit.glowIntensity = glowFromBloom;
            }
            if (cn) delete cn.bloomStrengthBase;
            if (cn) delete cn.bloomStrengthEnergyMult;
            // Bar mirror bỏ option "Peak caps".
            const barCfg = (cfg.customEffect || {}).bar;
            if (barCfg) delete barCfg.mirrorPeaks;
            if (barCfg && barCfg.byStyle) Object.keys(barCfg.byStyle).forEach((st) => { if (barCfg.byStyle[st]) delete barCfg.byStyle[st].mirrorPeaks; });
            cfg.autoSwitchVisualGroupList = (cfg.autoSwitchVisualGroupList || []).map((item) => (item && item.key === 'connector' && CONNECTOR_REMOVED_STYLES.includes(item.style) ? { ...item, style: 'circuit' } : item));
            cfg.autoSwitchVisualStyleList = (cfg.autoSwitchVisualStyleList || []).map((item) => (item && CONNECTOR_REMOVED_STYLES.includes(item.key) ? { ...item, key: 'circuit' } : item));
            delete cfg.subtitleStyle; // khung phụ đề cũ
        }

        /** Blob cần tạo URL theo loại nền media (video: thumb full-res, record cũ thiếu thì thumb vuông). */
        const APP_BG_MEDIA_BLOBS_BY_KIND = {
            photo: (record) => ({ image: record.blob, video: null, thumb: null }),
            video: (record) => ({ image: null, video: record.blob, thumb: record.thumbFullBlob || record.thumbBlob || null }),
        };

        /** Blob làm nền App từ record thư viện; record mất/thiếu blob -> null.
         * @param {'photo'|'video'} kind @param {object|null|undefined} record @returns {null|{image:?Blob, video:?Blob, thumb:?Blob}} */
        function pickAppBgMediaBlobs(kind, record) {
            if (!record || !record.blob) return null;
            return APP_BG_MEDIA_BLOBS_BY_KIND[kind](record);
        }

        /** Trường hợp nền media lúc boot: 'found' (resolve được) | 'broken' (có tham chiếu/đang ở mode 'background' mà không
         * resolve được) | 'none' (không dùng nền media). @param {object} cfg @param {boolean} hasMedia @returns {string} */
        function classifyAppBgMediaBoot(cfg, hasMedia) {
            if (hasMedia) return 'found';
            return cfg.bgMediaKey || cfg.themeMode === 'background' ? 'broken' : 'none';
        }

        /** Nền media không resolve được (item bị xoá/mất, hoặc config cũ ở mode 'background' chưa có `bgMediaKey`): gỡ URL +
         * tham chiếu hỏng, đang ở 'background' thì về kiểu nền đã chọn trước đó (`bgFallbackMode`: 'none' | 'gradient').
         * @param {object} cfg @returns {object} trường cần ghi */
        function computeAppBgMediaFallback(cfg) {
            return {
                bgImage: '', bgVideo: '', bgMediaThumb: '', bgMediaKey: '', bgMediaKind: '',
                themeMode: cfg.themeMode === 'background' ? (cfg.bgFallbackMode === 'none' ? 'none' : 'gradient') : cfg.themeMode,
            };
        }

        /** Vị trí style đang chọn trong MODES (12 style con phẳng) từ cfg.type (group) + field style riêng của group đó
         * (GROUP_STYLE_FIELD); field trống/lạ -> style mặc định của group; group lạ -> 'bar'; vẫn không thấy -> 0.
         * @param {object} cfg @returns {number} */
        function resolveModeIndexFromConfig(cfg) {
            const group = EFFECT_GROUPS[cfg.type] ? cfg.type : 'bar';
            const styleField = GROUP_STYLE_FIELD[group];
            const savedStyle = (cfg.customEffect[group] || {})[styleField];
            const savedIdx = MODES.indexOf(savedStyle);
            const defaultIdx = MODES.indexOf(DEFAULT_CUSTOM_EFFECT[group][styleField]);
            return savedIdx !== -1 ? savedIdx : Math.max(0, defaultIdx);
        }
