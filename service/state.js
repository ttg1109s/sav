/**
 * service/state.js — Quản lý tập trung toàn bộ STATE (mutable) + CONST (readonly) của app.
 *
 * BỐI CẢNH: 93 biến + 16 hằng số hiện đang rải rác dạng `let`/`const` top-level trên ~20 file
 * core/ khác nhau (xem plan.md mục 3 — kết quả kiểm kê toàn project, phân 3 nhóm CHẾT/NỘI BỘ/
 * CHUNG). File này GOM nhóm CHUNG vào 1 chỗ có tổ chức, theo domain (playlist/player/visualizer
 * runtime/audio engine/...).
 *
 * CHƯA MIGRATE: các file core/ vẫn đang đọc/ghi qua biến global cũ — bước migrate từng file đọc/
 * ghi qua STATE.xxx/CONST.xxx sẽ làm sau, theo từng cụm riêng, SAU KHI file này được duyệt.
 *
 * KHÁC VỚI event/store.js (EventStore): EventStore chỉ quản lý "state context" — dữ liệu nhớ
 * giữa 2 message liên tiếp của 1 router trong /event/ (vd lastScanResults, songEditCurrentKey).
 * service/state.js quản lý state NGHIỆP VỤ TOÀN APP (currentKey, playlistOrder, vizConfig, state
 * runtime của visualizer...) — 2 phạm vi KHÔNG chồng lấn, KHÔNG gộp chung.
 *
 * THIẾT KẾ:
 *   - STATE: plain object thật, NHƯNG KHÔNG được truy cập trực tiếp (`STATE.xxx`) ở bất kỳ file
 *     nào ngoài service/state.js — kể cả đường ĐỌC. MỌI đọc/ghi (kể cả hot path 60fps vòng lặp
 *     vẽ visualizer) ĐỀU BẮT BUỘC đi qua class AppState, không có ngoại lệ.
 *   - CONST: Object.freeze thật — ghi vào sẽ silently fail (strict mode: throw) theo đúng ngữ
 *     nghĩa "không bao giờ đổi sau khởi tạo". CONST vẫn truy cập trực tiếp `CONST.xxx` bình
 *     thường (không thuộc phạm vi AppState — đây là hằng số readonly, không phải state).
 *   - class AppState: lớp quản lý có schema kiểu dữ liệu cho TỪNG key của STATE. 3 phương thức:
 *       • `appState.get(key)` — đọc giá trị hiện tại của 1 key. BẮT BUỘC dùng thay cho
 *         `STATE.xxx` ở MỌI nơi, kể cả bên trong vòng lặp 60fps — không có ngoại lệ skipCheck ở
 *         đường đọc (get() vốn đã không validate gì, chỉ trả thẳng `this._state[key]`, nên
 *         không có chi phí kiểu-dữ-liệu nào để bỏ qua; mục tiêu BẮT BUỘC qua get() là để KHÔNG
 *         CÒN tồn tại bất kỳ truy cập `STATE.xxx` trần nào ngoài file này, không phải vì lý do
 *         hiệu năng). MỚI (04/07/2026, phản hồi Giang) — `get()` CŨNG nhận `key` dạng ARRAY
 *         (`appState.get(['a', 'b'])` -> `{ a: ..., b: ... }`), gộp NHIỀU lần đọc vào 1 lệnh gọi
 *         thay vì phải gọi get() liên tục rồi tự gộp tay — hành vi string CŨ giữ NGUYÊN 100%,
 *         hoàn toàn tương thích ngược. Nhánh array uỷ quyền cho `_getMany()` (private) — xem
 *         comment ngay tại get().
 *       • `appState.set(key, value, options)` — gán TOÀN BỘ giá trị mới cho 1 key (thay cả
 *         reference). SAI KIỂU sẽ:
 *           1. console.warn chi tiết (key, kiểu mong đợi, kiểu thực nhận, giá trị thực nhận)
 *           2. KHÔNG ghi giá trị sai vào STATE (silent — giữ nguyên giá trị cũ)
 *           3. Nếu options.notifyUI === true: hiện thêm alertModal (core/modal-choice.js) với
 *              options.message (mặc định 1 câu chung chung nếu không truyền) — alertModal CHỈ
 *              được gọi khi notifyUI === true, mặc định false (sửa đổi state là việc của lập
 *              trình viên, không nên làm phiền người dùng cuối trừ khi chủ động bật).
 *       • `appState.mutate(key, mutatorFn, options)` — thao tác IN-PLACE lên collection đã có
 *         sẵn (vd `domNodesByKey.set(k, v)`, `pendingResortKeys.clear()`, `displayOrder.push(x)`,
 *         hoán vị phần tử mảng...), KHÔNG gán lại reference. Validate lại kiểu của collection
 *         SAU khi mutatorFn chạy xong (trừ khi skipCheck).
 *       • set() và mutate() (KHÔNG áp dụng cho get()) nhận `options.skipCheck = true` để BỎ
 *         QUA validate — CHỈ dùng cho hot path 60fps/vòng lặp taskManager tần suất cao (vòng lặp
 *         vẽ visualizer: beatTimes, smoothedEnergy, frameCounter, dpr, stars, raindrops,
 *         tCurrentWarpZ...; hoặc tick lặp lại qua taskManager như _listenTick), nơi chi phí gọi
 *         matchesType() mỗi lần không đáng và giá trị ghi vào đã được tính nội bộ (rủi ro sai
 *         kiểu thấp). Mặc định skipCheck = false cho MỌI key khác — kể cả các key rủi ro cao
 *         (snapshot trong resume-state-storage.js, các field liên quan PERFORMANCE_PROFILES)
 *         VẪN PHẢI validate bình thường, không được tự ý thêm skipCheck cho các key đó.
 *
 * PHẢI nạp TRƯỚC: core/config.js (vizConfig khởi tạo bằng { ...CONST.DEFAULT_VIZ_CONFIG }),
 *   và TRƯỚC toàn bộ core/ — vì rất nhiều file core sẽ migrate đọc CONST.MODES/CONST.EQ_PRESETS/...
 *   thay vì hằng số cục bộ của chính nó.
 * PHẢI nạp SAU: core/modal-choice.js (alertModal — dùng cho option notifyUI).
 */

        /** Schema kiểu dữ liệu cho từng key của STATE — dùng để validate trong appState.set(). */
        const STATE_SCHEMA = {
            // ── playlist ──────────────────────────────────────────────────────
            playlistOrder: 'array',
            displayOrder: 'array',
            renderOrder: 'array',
            playlistCache: 'map',
            songNameIndex: 'map',
            confirmedBrokenKeys: 'set',
            currentKey: 'nullable-string',
            displaySortMode: 'string',
            pendingResortKeys: 'set',
            searchQuery: 'string',
            domNodesByKey: 'map',

            // ── player ────────────────────────────────────────────────────────
            lastStoppedKey: 'nullable-string',
            lastStoppedTime: 'number',
            isResumeModalOpen: 'boolean',
            _isPlaylistReadyForResumeModal: 'boolean',
            _resumeModalPendingKey: 'nullable-string',
            _listenLastTick: 'number',
            pendingListenSeconds: 'number',

            // ── visualizer config ────────────────────────────────────────────
            vizConfig: 'object',
            currentModeIndex: 'number',

            // ── visualizer runtime (60fps hot path) ──────────────────────────
            smoothedEnergy: 'number',
            globalHueOffset: 'number',
            beatScale: 'number',
            vizDataArray: 'any',             // Uint8Array | undefined trước khi audio context init
            pitchTimeDomainArray: 'any',      // Uint8Array | undefined
            previousSpectrumArray: 'any',     // Float32Array | undefined
            beatTimes: 'array',
            fluxHistory: 'array',
            frameCounter: 'number',
            dpr: 'number',

            // ── visualizer scenes ─────────────────────────────────────────────
            stars: 'array',
            starFlashes: 'array',
            rubikCubes: 'array',
            rubikPitchHistory: 'array',
            rubikPitchAvg: 'number',
            raindrops: 'array',
            ripples: 'array',
            glassStaticDrops: 'array',
            glassStreaks: 'array',
            cityBuildings: 'array',
            activeLightnings: 'array',
            streetLamps: 'array',
            streetRain: 'array',
            streetGroundY: 'number',

            // ── three/vortex (THREE.js objects — chỉ kiểm tra non-null sau init) ─
            tScene: 'any',         // THREE.Scene | undefined trước initThreeJS()
            tCamera: 'any',        // THREE.Camera | undefined
            tRenderer: 'any',      // THREE.Renderer | undefined
            tInitialized: 'boolean',
            tCurrentWarpZ: 'number',
            tPathParams: 'object',
            tPathTarget: 'object',
            tGroupRings: 'any',    // THREE.Group | undefined
            tGroupBars: 'any',     // THREE.Group | undefined
            tGroupWaves: 'any',    // THREE.Group | undefined
            tRings: 'array',
            tBarsMesh: 'any',      // THREE.InstancedMesh | undefined
            tBarRingZs: 'array',
            tWaveMeshes: 'array',

            // ── audio engine ──────────────────────────────────────────────────
            audioContext: 'any',           // AudioContext | undefined trước setupAudioContext()
            analyser: 'any',               // AnalyserNode | undefined
            analyserPitch: 'any',          // AnalyserNode | undefined
            animationId: 'any',            // number (requestAnimationFrame id) | undefined
            masterGainNode: 'any',         // GainNode | undefined
            eqBandNodes: 'array',
            isSeeking: 'boolean',
            currentObjectURL: 'nullable-string',
            currentCoverObjectURL: 'nullable-string',
            pitchWorker: 'any',            // Worker | null
            pitchWorkerBusy: 'boolean',
            latestPitchFrequency: 'number',
            // MIGRATE (từ 3 biến window.lastValid* rải rác, cùng hot path 60fps với
            // currentCalculatedBpm/rubikPitchAvg — xem updateStatsDashboard() ở audio-analysis.js):
            lastValidNoteStr: 'nullable-string',
            lastValidNoteTime: 'number',
            lastValidMidiNote: 'nullable-number',

            // ── subtitle ──────────────────────────────────────────────────────
            subtitles: 'array',
            isSubtitlesEnabled: 'boolean',
            activeSubIds: 'set',
            editingSubId: 'any',           // string | null
            currentCalculatedBpm: 'string',
            autoSubStartTime: 'nullable-number',

            // ── shuffle/repeat ────────────────────────────────────────────────
            isShuffle: 'boolean',
            shuffleIndices: 'array',
            repeatMode: 'number',

            // ── video bg ──────────────────────────────────────────────────────
            _videoBgLoadedUrl: 'nullable-string',

            // ── wake lock / tab ───────────────────────────────────────────────
            nativeWakeLock: 'any',         // WakeLockSentinel | null
            _isRealUnloadHappening: 'boolean',

            // ── auto-switch ───────────────────────────────────────────────────
            autoSwitchVisualMarks: 'array',
            _lastMarksBuiltForKey: 'nullable-string',

            // ── listen stats ──────────────────────────────────────────────────
            songStatsMap: 'map',
            _songStatsDirty: 'boolean',

            // ── app/ui misc ───────────────────────────────────────────────────
            isGridView: 'boolean',
            isStatsPanelVisible: 'boolean',
            savLogoExpanded: 'boolean',
            isShieldBusy: 'boolean',
            isDestructiveTaskInProgress: 'boolean',
            _pendingResumeSnapshot: 'any',  // object | null
            dbReadyPromise: 'any',          // Promise — không validate sâu, chỉ tồn tại 1 lần lúc init

            // ── file manager / v12 "Multi Media" ─────────────────────────────────────
            // CHỐT 03/07/2026 (plan-v12-multimedia-decisions.md mục 1a/7): isFileManagerOpen/
            // fileManagerActiveTab (2 key mở/đóng overlay + tab đang chọn của bản overlay cấp cao
            // cũ) ĐÃ BỎ HẲN — không migrate, không giữ lại. File Manager giờ là 3 drawer con độc
            // lập, mỗi drawer tự quản lý mở/đóng bằng DOM class thuần (translate-y-full), giống
            // hệt About Drawer/Visualizer Settings Drawer — 2 drawer đó chưa từng cần appState
            // riêng cho "đang mở hay không", File Manager cũng vậy, không có lý do khác biệt.
            activePlayListFolder: 'nullable-string', // null/undefined = tất cả bài; có giá trị = đang scoping theo folderId
            folderDetailSongCount: 'number', // MỚI (03/07/2026, đợt 4) — số bài đang hiển thị trong Folder Detail Drawer, cập nhật mỗi lần vẽ lại; dùng bởi Block gate (event/block.js) để chặn "Áp dụng" khi folder rỗng
            selectionMode: 'boolean',                // chế độ chọn nhiều (checkbox) trong Playlist
            selectedSongKeys: 'set',                 // tập songKey đang được chọn khi selectionMode = true
            // MỚI (fix 03/07/2026, mục 3a/3b yêu cầu) — true = displayOrder hiện đang là 1 "section"
            // (tập con vừa chọn-rồi-phát qua playSelectedSongs(), event/workflow/playlist.js), KHÁC
            // hẳn displayOrder top-level (Tất cả bài/Theo folder). Dùng bởi 2 nút to "Phát"/"Trộn
            // bài" (event/workflow/playlist-empty-state.js) để biết cần "chèn lại top-level" trước
            // khi phát hay không, và bởi core/playlist/order.js::updateShuffleArrayFromQueue() (qua
            // event/workflow/player-controls.js) để Shuffle ở Control Center chỉ trộn ĐÚNG "hiện
            // hành" thay vì luôn nhảy về top-level. Tự về false bất kỳ khi nào recomputeDisplayOrder()
            // chạy (displayOrder quay lại phản ánh top-level thật) — xem core/playlist/order.js.
            sectionQueueActive: 'boolean',
            activeBackgroundAlbum: 'nullable-string', // albumId đang dùng làm nền slideshow, null = không dùng
            slideshowConfig: 'object',               // { mode, intervalSeconds, transitionType, photoPerSong, kenBurnsEnabled, kenBurnsMode, transitionDurationMs, transitionInOutRatio, transitionEasing } — xem CONST.DEFAULT_SLIDESHOW_CONFIG
            readerConfig: 'object',                  // { fontFamily, fontSize, bgColor, textColor, opacity } — xem CONST.DEFAULT_READER_CONFIG

            // ── generic drawer ────────────────────────────────────────────────
            // MỚI (13/07/2026) — khôi phục overlay + chặn mở chồng (Giang yêu cầu, xem
            // core/generic-drawer.js). isGenericDrawerOpen: true từ lúc openGenericDrawer() bắt
            // đầu tới lúc hideGenericDrawerImmediately() chạy xong (transition đóng đã hết hẳn) —
            // dùng bởi Block gate (event/block.js) để chặn mọi msg.type "mở Generic Drawer" khác
            // trong lúc đang mở, tránh 2 tính năng cùng lúc ghi đè bodyHtml của nhau.
            // ĐÃ GỠ (rewrite Photo/Album) — isGenericDrawerContentVirtual XOÁ HẲN cùng lúc bỏ hẳn
            // event/workflow,router,listener/virtual-list.js — picker ảnh Generic Drawer giờ dùng
            // event/workflow/photo-gallery-window.js (IntersectionObserver, không cần cờ gate nào).
            isGenericDrawerOpen: 'boolean',
            // MỚI (14/07/2026, Giang yêu cầu) — trang ĐANG xem của danh sách folder ở File Manager
            // -> Song (0-based, 10 folder/trang, xem event/workflow/file-manager-song.js +
            // core/pagination.js). Workflow tự đọc field này rồi TRUYỀN vào computePage() (core
            // THUẦN, không tự appState.get() — Rule 2) — tránh mỗi lần refreshSongTab() bị reset về
            // trang đầu (trước đây sống trong 1 property riêng của workflow, giờ gom vào appState
            // theo đúng tinh thần "state nghiệp vụ toàn app gom 1 chỗ" của chính file này).
            pageCurrentFolderSongList: 'number',
            // MỚI (14/07/2026, Giang yêu cầu) — trang ĐANG xem của danh sách bài BÊN TRONG 1 folder
            // (Folder Detail Drawer, 0-based, ~30 bài/trang, mode 'list') — CÙNG lý do/tinh thần với
            // pageCurrentFolderSongList ở trên, KHÁC field vì 2 danh sách độc lập (folder list vs
            // song list trong 1 folder cụ thể).
            pageCurrentFolderDetailSongList: 'number',
            // MỚI (14/07/2026, Giang yêu cầu) — trang ĐANG xem của danh sách tài liệu ở File
            // Manager -> Documents (0-based, 50 tài liệu/trang, mode 'list').
            pageCurrentDocumentList: 'number',
            // MỚI (14/07/2026, Giang yêu cầu — "xoá song trong folder xong back không render lại")
            // — folderId (dùng ĐÚNG `data-folder-id` đã có sẵn trên mỗi hàng, KHÔNG cần thêm
            // attribute mới) của folder VỪA bị đổi (xoá bài/remove-all/apply/unapply) TRONG LÚC
            // đang xem Folder Detail (nên danh sách folder — ĐANG BỊ CHE PHÍA SAU trong ngăn xếp —
            // không được vẽ lại ngay). `null` = không có gì cần vá. Workflow tự đọc/ghi (Rule 2) —
            // đọc lúc Back (workflowSettingsStackNav.back() gọi chéo sang
            // workflowFileManagerSong.refreshStaleFolderRowIfNeeded(), 2 Workflow khác miền gọi tự
            // do, không bị Rule 3), PHẢI đặt lại `null` NGAY sau khi vá xong (dù vá được hay không —
            // vd folder đó đang ở TRANG KHÁC lúc quay lại — để không lặp lại việc vá vô ích ở lần
            // Back kế tiếp).
            staleFolderListRowId: 'nullable-string',
        };

        /** Giá trị khởi tạo mặc định — copy NGUYÊN VẸN giá trị/kiểu thật từ source gốc. */
        function buildDefaultState() {
            return {
                // ── playlist ──────────────────────────────────────────────────
                playlistOrder: [],
                displayOrder: [],
                renderOrder: [],
                playlistCache: new Map(),
                songNameIndex: new Map(),
                confirmedBrokenKeys: new Set(),
                currentKey: null,
                displaySortMode: 'az',
                pendingResortKeys: new Set(),
                searchQuery: '',
                domNodesByKey: new Map(),

                // ── player ────────────────────────────────────────────────────
                lastStoppedKey: null,
                lastStoppedTime: 0,
                isResumeModalOpen: false,
                _isPlaylistReadyForResumeModal: false,
                _resumeModalPendingKey: null,
                _listenLastTick: 0,
                pendingListenSeconds: 0,

                // ── visualizer config ─────────────────────────────────────────
                // vizConfig gán THẬT ở dưới sau khi CONST đã sẵn sàng (xem cuối file) — đặt
                // {} tạm ở đây để key tồn tại sẵn trong schema/state ngay từ đầu.
                vizConfig: {},
                currentModeIndex: 0,

                // ── visualizer runtime (60fps hot path) ───────────────────────
                smoothedEnergy: 0,
                globalHueOffset: 0,
                beatScale: 0,
                vizDataArray: undefined,
                pitchTimeDomainArray: undefined,
                previousSpectrumArray: undefined,
                beatTimes: [],
                fluxHistory: [],
                frameCounter: 0,
                dpr: 1,

                // ── visualizer scenes ──────────────────────────────────────────
                stars: [],
                starFlashes: [],
                rubikCubes: [],
                rubikPitchHistory: [],
                rubikPitchAvg: 0,
                raindrops: [],
                ripples: [],
                glassStaticDrops: [],
                glassStreaks: [],
                cityBuildings: [],
                activeLightnings: [],
                streetLamps: [],
                streetRain: [],
                streetGroundY: 0,

                // ── three/vortex ────────────────────────────────────────────────
                tScene: undefined,
                tCamera: undefined,
                tRenderer: undefined,
                tInitialized: false,
                tCurrentWarpZ: 0,
                tPathParams: { freqX: 0.0012, freqY: 0.0009, ampX: 450, ampY: 300, phaseX: 0, phaseY: 0 },
                tPathTarget: { freqX: 0.0012, freqY: 0.0009, ampX: 450, ampY: 300, phaseX: 0, phaseY: 0 },
                tGroupRings: undefined,
                tGroupBars: undefined,
                tGroupWaves: undefined,
                tRings: [],
                tBarsMesh: undefined,
                tBarRingZs: [],
                tWaveMeshes: [],

                // ── audio engine ──────────────────────────────────────────────
                audioContext: undefined,
                analyser: undefined,
                analyserPitch: undefined,
                animationId: undefined,
                masterGainNode: undefined,
                eqBandNodes: [],
                isSeeking: false,
                currentObjectURL: null,
                currentCoverObjectURL: null,
                pitchWorker: null,
                pitchWorkerBusy: false,
                latestPitchFrequency: -1,
                lastValidNoteStr: null,
                lastValidNoteTime: 0,
                lastValidMidiNote: null,

                // ── subtitle ────────────────────────────────────────────────────
                subtitles: [],
                isSubtitlesEnabled: true,
                activeSubIds: new Set(),
                editingSubId: null,
                currentCalculatedBpm: '---',
                autoSubStartTime: null,

                // ── shuffle/repeat ──────────────────────────────────────────────
                isShuffle: false,
                shuffleIndices: [],
                repeatMode: 0,

                // ── video bg ──────────────────────────────────────────────────
                _videoBgLoadedUrl: null,

                // ── wake lock / tab ─────────────────────────────────────────────
                nativeWakeLock: null,
                _isRealUnloadHappening: false,

                // ── auto-switch ─────────────────────────────────────────────────
                autoSwitchVisualMarks: [],
                _lastMarksBuiltForKey: null,

                // ── listen stats ────────────────────────────────────────────────
                songStatsMap: new Map(),
                _songStatsDirty: false,

                // ── app/ui misc ─────────────────────────────────────────────────
                isGridView: false,
                // MỚI (07/07/2026) — true = đang ở màn Visualizer (không phải Playlist) lúc này.
                // Set ở core/player-controls.js::switchToVisualizer() (true)/
                // forceBackToPlaylistUI()+setVisualizerActiveFalse() (false, HOTFIX 10 —
                // forceBackToPlaylistUI() tự nó không còn set field này nữa, nơi gọi phải tự thêm
                // setVisualizerActiveFalse()). Từng còn được Settings đọc để quyết định mở/đóng
                // kiểu nào (cuộn mượt hay nhảy thẳng + trượt cả khối) — HOTFIX 11 (08/07/2026) bỏ
                // hẳn nhánh đó (xem event/router/player-controls.js), field này giờ CHỈ còn phục
                // vụ đúng mục đích gốc: theo dõi đang ở màn nào.
                isVisualizerActive: false,
                isStatsPanelVisible: true,
                savLogoExpanded: false,
                isShieldBusy: false,
                isDestructiveTaskInProgress: false,
                _pendingResumeSnapshot: null,
                dbReadyPromise: null, // gán thật ở db.js bằng appState.set('dbReadyPromise', openDatabase())

                // ── file manager / v12 "Multi Media" ────────────────────────────
                // (isFileManagerOpen/fileManagerActiveTab đã bỏ hẳn — xem comment ở khối schema
                // phía trên, mục 1a/7 CHỐT 03/07/2026)
                // readerConfig/slideshowConfig gán THẬT ở dưới sau khi CONST đã sẵn sàng (giống
                // vizConfig) — đặt {} tạm ở đây để key tồn tại sẵn trong schema/state ngay từ đầu.
                activePlayListFolder: null,
                sectionQueueActive: false,
                folderDetailSongCount: 0,
                selectionMode: false,
                selectedSongKeys: new Set(),
                activeBackgroundAlbum: null,
                slideshowConfig: {},
                readerConfig: {},

                // ── generic drawer ──────────────────────────────────────────────
                isGenericDrawerOpen: false,
                pageCurrentFolderSongList: 0,
                pageCurrentFolderDetailSongList: 0,
                pageCurrentDocumentList: 0,
                staleFolderListRowId: null,
            };
        }

        /** Hằng số readonly — copy NGUYÊN VẸN từ source gốc (config.js + các file khác). */
        const CONST = Object.freeze({
            APP_CONFIG: Object.freeze({ fftSizeStandard: 256, fftSizeHighRes: 2048, fftSizePitch: 2048, bpmMinWaitTime: 250 }),
            PERFORMANCE_PROFILES: Object.freeze({
                high:   Object.freeze({ stars: 200, tunnelRings: 60, glassDrops: 250, bldMult: 1.0, streakProb: 0.8,  blurMult: 1.0, streetRain: 220 }),
                medium: Object.freeze({ stars: 100, tunnelRings: 35, glassDrops: 100, bldMult: 1.5, streakProb: 0.9,  blurMult: 0.5, streetRain: 130 }),
                low:    Object.freeze({ stars: 40,  tunnelRings: 15, glassDrops: 40,  bldMult: 2.5, streakProb: 0.95, blurMult: 0,   streetRain: 70 }),
            }),
            DEFAULT_VINYL: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0OCIgZmlsbD0iIzFlMjkzYiIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjE2IiBmaWxsPSIjMGYxNzJhIi8+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iMTUiIGZpbGw9IiNjYmQ1ZTEiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0IiBmaWxsPSIjMGYxNzJhIi8+PC9zdmc+',
            EQ_PRESETS: Object.freeze({
                flat: Object.freeze([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), bass_boost: Object.freeze([6, 5, 4, 1, 0, 0, 0, 0, 0, 0]), pop: Object.freeze([-2, -1, 0, 2, 4, 4, 2, 0, -1, -2]),
                rock: Object.freeze([5, 4, 3, 1, -1, -1, 1, 2, 3, 4]), acoustic: Object.freeze([2, 1, 0, 0, 1, 2, 3, 4, 3, 2]), electronic: Object.freeze([5, 4, 1, -1, -2, 0, 1, 3, 4, 5]),
                manual: Object.freeze([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
            }),
            MODES: Object.freeze(['bar', 'lightning', 'rubik', 'vortex', 'black hole', 'rain']),
            AUTO_SWITCH_VISUAL_MIN_SECONDS: 10,
            DEFAULT_VIZ_CONFIG: Object.freeze({
                quality: 'high', type: 'bar', barStyle: 'mirror', vortexStyle: 'rings', rainStyle: 'glass', glassFlash: true, mode: 'solid',
                bgColor: '#000000', solidColor: '#ffffff', dynA: '#ec4899', dynB: '#3b82f6',
                minH: 4, maxH: 400, barWidth: 4, bgImage: '', bgBlur: 0, bgImageEnabled: false,
                // MỚI (09/07/2026) — `themeMode`/`gradientFrom`/`gradientTo` BỊ SÓT khỏi bản
                // DEFAULT_VIZ_CONFIG RIÊNG này từ batch Theme gốc (07/07/2026, chỉ thêm bên
                // core/config.js) — 2 nơi cùng tên nhưng KHÔNG dùng chung 1 object (xem comment ở
                // core/config.js::DEFAULT_VIZ_CONFIG), lẽ ra phải thêm CẢ 2 chỗ. Vô hại thực tế
                // (vizConfig luôn được `loadConfig()` merge/migrate lại default đúng ngay khi boot,
                // trước khi UI kịp render) nhưng ĐIỀN ĐỦ ở đây cho khớp schema/tránh field thiếu ở
                // bản khởi tạo thật đầu tiên (trước khi loadConfig() async kịp chạy xong).
                themeMode: 'dark', gradientFrom: '#6366f1', gradientTo: '#ec4899',
                mirrorBarCount: 32,
                volume: 100, eqMode: 'flat', manualEq: Object.freeze([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                videoBgEnabled: false, videoBgUrl: '',
                // MỚI (batch 03/07/2026) — nền tĩnh CHO MÀN VISUALIZER (khác hẳn bgImage ở trên,
                // vốn là nền cho màn Playlist/#playlist-bg). CÙNG CƠ CHẾ HỆT bgImage/videoBgUrl:
                // Blob THẬT lưu ở `meta.visualBgImage` (service/db.js), visualBgImage ở đây CHỈ là
                // blob: URL runtime resolve lại mỗi session (KHÔNG lưu trực tiếp field này, xem
                // core/config.js::flushConfigBackup()). Đặt qua menu "Đặt làm nền" trên ảnh
                // (event/workflow/file-manager-photo.js) chỉ đơn giản COPY Blob từ store `images`
                // sang `meta.visualBgImage` — giống hệt thao tác "chọn file rồi upload", chỉ khác
                // NGUỒN file (từ thư viện ảnh thay vì hộp thoại chọn file hệ điều hành). KHÔNG cần
                // field "tham chiếu" (imageKey) riêng — xoá ảnh khỏi File Manager sau đó KHÔNG ảnh
                // hưởng gì tới nền đã đặt (đã là 1 bản copy độc lập, giống ảnh bìa bài hát).
                visualBgImageEnabled: false, visualBgImage: '',
                visualEnabled: true,
                keepScreenOn: true,
                autoSwitchVisualEnabled: false,
                autoSwitchVisualMode: 'sequential',
                autoSwitchVisualTimeMode: 'fixed',
                autoSwitchVisualSecondsFixed: 30,
                autoSwitchVisualSecondsRandom: 30,
                autoSwitchVisualSecondsDuration: 30,
                subtitlesEnabled: true,
                subtitleStyle: Object.freeze({
                    bgColor: '#000000', bgOpacity: 0.4,
                    borderColor: '#ffffff', borderOpacity: 0.1, borderWidth: 1, borderRadius: 16,
                    textColor: '#ffffff', fontSize: 8, lineHeight: 1.3, letterSpacing: 0,
                }),
            }),
            RESUME_STATE_STORAGE_KEY: 'sav_pendingResumeState_v1',
            RESUME_FLAG_KEY: 'sav_resumeFlag_v1',
            TUNNEL_DEPTH: 3000,
            BARS_RINGS_COUNT: 40,
            BARS_PER_RING: 24,
            LISTEN_CLOCK_TASK: 'listenClock',
            AUTO_SWITCH_VISUAL_TASK_TIMER: 'autoSwitchVisualTimer',
            AUTO_SWITCH_VISUAL_TASK_MARKS: 'autoSwitchVisualMarks',
            SHIELD_FADE_MS: 200,
            // ── v12 "Multi Media" (plan-v12-multimedia.md mục 4.b3/4.e) ─────────────
            // [GIẢ ĐỊNH — cần bác xác nhận, xem câu hỏi 11 mục 6 của plan]: giữ readerConfig
            // TÁCH RIÊNG khỏi vizConfig (không gộp) — đơn giản hơn khi bước sau cần đọc/ghi độc
            // lập (Reader không nên phụ thuộc toàn bộ shape của vizConfig). Nếu bác chốt gộp
            // chung, đổi lại 1 chỗ này + bỏ key readerConfig riêng trong STATE_SCHEMA/STATE.
            DEFAULT_SLIDESHOW_CONFIG: Object.freeze({
                mode: 'sequential', // 'sequential' | 'random'
                intervalSeconds: 5, // tối thiểu 5s theo plan mục 4.b3 — CHỈ dùng khi photoPerSong=false
                transitionType: 'fade',
                photoPerSong: false, // MỚI (04/07/2026, mục 5 phản hồi Giang) — true: đổi ảnh THEO
                                      // bài hát (1 ảnh/1 bài, đổi đúng lúc bài hát đổi — kể cả seek
                                      // KHÔNG tính, chỉ tính đổi BÀI thật), bỏ qua intervalSeconds.
                kenBurnsEnabled: false, // MỚI (Ken Burns, 18/07/2026, phản hồi Giang) — pan/zoom
                                      // chậm SUỐT thời gian hiển thị, ĐỘC LẬP với transitionType
                                      // (dùng được cùng lúc với BẤT KỲ kiểu transition nào). Field
                                      // MỚI HOÀN TOÀN — KHÔNG migrate từ 'kenburns' đời trước (đã
                                      // gộp chung vào transitionType, nay xoá sạch không giữ
                                      // tương thích ngược).
                kenBurnsMode: 'zoomPanRandom', // MỚI ("Nhóm 2", 18/07/2026, phản hồi Giang) — 1
                                      // trong 13 SLIDESHOW_KENBURNS_MODES (core/file-manager/
                                      // slideshow.js) — THAY HẲN "Nhóm 1" (8 biến thể random tự
                                      // động, không chọn được). Mặc định 'zoomPanRandom' (đa dạng
                                      // nhất, gần giống cảm giác Nhóm 1 cũ nhất trong 13 lựa chọn).
                transitionDurationMs: 1000, // MỚI (18/07/2026, phản hồi Giang — "thêm thời gian
                                      // transition giữa 2 ảnh") — TỔNG thời gian 1 lượt chuyển
                                      // cảnh (1-60s, xem SLIDESHOW_TRANSITION_MIN/MAX_TIME_MS).
                                      // SỬA (18/07/2026, phản hồi Giang — phát hiện bug) — bản ĐẦU
                                      // để 900 (khớp hardcode CSS cũ) nhưng Giang đã chốt MIN là
                                      // 1000ms (1s) — 900 < 1000 VI PHẠM chính ràng buộc min vừa
                                      // đặt ra (mặc định cho cài mới đã sai ngay từ đầu). Đổi lên
                                      // đúng mốc MIN, KHÔNG cố giữ "liên tục" với giá trị cũ nữa.
                transitionInOutRatio: 50, // MỚI (18/07/2026) — % thời gian dành cho pha "in" (layer
                                      // mới), phần còn lại là "out" (layer cũ) — 50 = chia đều,
                                      // KHỚP ĐÚNG hành vi cũ (in/out luôn bằng nhau, cùng 900ms).
                                      // KHÔNG áp dụng cho 'wipe'/'curtain'/'circleReveal' (xem
                                      // SLIDESHOW_TRANSITION_TYPES_NO_OUT).
                transitionEasing: 'ease', // MỚI (18/07/2026) — 1 trong SLIDESHOW_TRANSITION_EASINGS
                                      // — 'ease' khớp ĐÚNG giá trị hardcode CSS cũ, giữ liên tục.
            }),
            DEFAULT_READER_CONFIG: Object.freeze({
                fontFamily: 'system-ui',
                fontSize: 18,
                bgColor: '#000000',
                textColor: '#ffffff',
                opacity: 0.85,
            }),
        });

        /**
         * Kiểm tra giá trị `value` có khớp kiểu mong đợi `expectedType` không.
         * Hỗ trợ: 'string' | 'number' | 'boolean' | 'array' | 'map' | 'set' | 'object'
         *         | 'nullable-string' | 'nullable-number' | 'any'.
         * 'any' luôn pass — dùng cho các field chứa instance phức tạp (THREE.js, AudioContext,
         * Worker...) mà việc validate kiểu cụ thể không thực tế/không có giá trị.
         */
        function matchesType(value, expectedType) {
            switch (expectedType) {
                case 'any': return true;
                case 'string': return typeof value === 'string';
                case 'number': return typeof value === 'number' && !Number.isNaN(value);
                case 'boolean': return typeof value === 'boolean';
                case 'array': return Array.isArray(value);
                case 'map': return value instanceof Map;
                case 'set': return value instanceof Set;
                case 'object': return value !== null && typeof value === 'object' && !Array.isArray(value);
                case 'nullable-string': return value === null || typeof value === 'string';
                case 'nullable-number': return value === null || (typeof value === 'number' && !Number.isNaN(value));
                default: return true; // schema thiếu entry -> không chặn, coi như 'any'
            }
        }

        class AppState {
            /**
             * @param {Object} initialState - object STATE khởi tạo (mutable)
             * @param {Object} schema - map key -> tên kiểu mong đợi (xem matchesType)
             */
            constructor(initialState, schema) {
                this._state = initialState; // KHÔNG copy — giữ cùng reference với STATE export ra ngoài
                this._schema = schema;
            }

            /**
             * Đọc giá trị hiện tại của 1 key. ĐÂY LÀ CÁCH DUY NHẤT được phép đọc STATE từ file
             * ngoài service/state.js — không có ngoại lệ cho hot path 60fps hay vòng lặp
             * taskManager tần suất cao. Không validate gì (trả thẳng `this._state[key]`), nên
             * không có overhead kiểu-dữ-liệu để cân nhắc bỏ qua như set()/mutate().
             */
            /**
             * Đọc giá trị hiện tại của 1 KEY (string, hành vi CŨ — không đổi) HOẶC NHIỀU key cùng
             * lúc (array, MỚI 04/07/2026 phản hồi Giang — tránh gọi get() liên tục nhiều lần rồi tự
             * gộp tay ở nơi gọi). Rule 1 (core-function-conventions.md) áp DỤNG TƯƠNG TỰ ở đây dù
             * đây không phải "hàm core": "đọc 1 key" và "đọc N key rồi gộp lại thành object" là 2
             * TIẾN TRÌNH khác nhau -> KHÔNG rẽ nhánh if/else rồi viết vòng lặp NGAY TRONG get(),
             * uỷ quyền hẳn nhánh array cho `_getMany()` riêng (private, dùng dấu `_` đầu tên theo
             * quy ước file này — xem `_notifyUI()`/`_getSchema()` nếu có).
             * @param {string|string[]} key
             * @returns {*} giá trị của key đó nếu truyền string; hoặc `{ [key]: value, ... }` nếu
             *   truyền array (key nào không tồn tại trong schema vẫn trả `undefined` cho key đó,
             *   KHÔNG throw/bỏ qua — giữ đúng hành vi get() 1 key vốn có).
             */
            get(key) {
                if (Array.isArray(key)) return this._getMany(key);
                return this._state[key];
            }

            /** Private: đọc NHIỀU key cùng lúc, dùng bởi get() khi nhận array — xem comment get(). */
            _getMany(keys) {
                const result = {};
                keys.forEach((k) => { result[k] = this._state[k]; });
                return result;
            }

            /** Snapshot toàn bộ state hiện tại (copy nông — dùng cho debug/log, KHÔNG dùng trong hot path). */
            getAll() {
                return { ...this._state };
            }

            /**
             * Ghi giá trị mới cho 1 key, CÓ validate kiểu theo schema (trừ khi skipCheck=true).
             *
             * @param {string} key
             * @param {*} value
             * @param {Object} [options]
             * @param {boolean} [options.notifyUI=false] - true thì khi sai kiểu, NGOÀI console.warn
             *   còn gọi alertModal() để báo UI. Mặc định false — sai kiểu chỉ log console, không
             *   làm phiền người dùng cuối (đa số trường hợp set() nằm trong code, không phải do
             *   thao tác trực tiếp của người dùng).
             * @param {string} [options.message] - nội dung tuỳ chỉnh hiển thị trong modal khi
             *   notifyUI=true. Không truyền thì dùng câu mặc định chung chung kèm tên key.
             * @param {boolean} [options.skipCheck=false] - true thì BỎ QUA validate kiểu, ghi
             *   thẳng `this._state[key] = value` không điều kiện. Dùng cho hot path 60fps (vòng
             *   lặp vẽ visualizer: beatTimes, smoothedEnergy, frameCounter, dpr, stars,
             *   raindrops, tCurrentWarpZ...) — nơi chi phí gọi matchesType() mỗi frame không
             *   đáng, và giá trị ghi vào đã được tính toán nội bộ (không phải dữ liệu ngoài như
             *   localStorage/JSON.parse nên rủi ro sai kiểu thấp). Mặc định false cho MỌI key
             *   khác — kể cả các key rủi ro cao (vd snapshot trong resume-state-storage.js,
             *   PERFORMANCE_PROFILES-liên-quan) vẫn PHẢI validate bình thường.
             * @returns {boolean} true nếu ghi thành công, false nếu bị từ chối do sai kiểu
             *   (skipCheck=true luôn trả về true, không bao giờ từ chối).
             */
            set(key, value, options) {
                options = options || {};
                const notifyUI = options.notifyUI === true; // mặc định false theo yêu cầu
                const skipCheck = options.skipCheck === true; // mặc định false — chỉ hot path mới bật

                if (skipCheck) {
                    this._state[key] = value;
                    return true;
                }

                const expectedType = this._schema[key];

                if (expectedType === undefined) {
                    console.warn(`[AppState.set] Key "${key}" không tồn tại trong schema — kiểm tra lại tên key (gõ sai?) hoặc bổ sung schema nếu đây là key mới hợp lệ.`);
                    if (notifyUI && typeof alertModal === 'function') {
                        alertModal(options.message || `Lỗi nội bộ: state key "${key}" không tồn tại trong schema.`, { title: 'Lỗi state' });
                    }
                    return false;
                }

                if (!matchesType(value, expectedType)) {
                    console.warn(
                        `[AppState.set] Sai kiểu dữ liệu cho key "${key}": mong đợi "${expectedType}", nhận "${typeof value}".`,
                        'Giá trị nhận được:', value,
                        '— GIỮ NGUYÊN giá trị cũ, không ghi đè.'
                    );
                    if (notifyUI && typeof alertModal === 'function') {
                        alertModal(
                            options.message || `Không thể cập nhật "${key}": dữ liệu không đúng định dạng.`,
                            { title: 'Lỗi dữ liệu' }
                        );
                    }
                    return false;
                }

                this._state[key] = value;
                return true;
            }

            /**
             * Thao tác IN-PLACE lên 1 collection (Map/Set/Array/Object) đã có sẵn trong STATE,
             * KHÔNG gán lại reference mới. Lý do cần API riêng (khác với set()): nhiều thao tác
             * đọc/ghi thật ra là mutate-in-place trên CÙNG 1 object đã tồn tại — ví dụ
             * `domNodesByKey.set(key, node)`, `pendingResortKeys.clear()`,
             * `confirmedBrokenKeys.delete(key)`, `displayOrder.push(k)`,
             * `shuffleIndices[i] = x` (hoán vị in-place) — set() (gán toàn bộ giá trị mới) không
             * khớp ngữ nghĩa và bắt buộc lúc nào cũng phải đi qua class AppState, không được gọi
             * thẳng `STATE.xxx.set(...)`/`STATE.xxx.push(...)` ở file ngoài.
             *
             * @param {string} key - key trong STATE, PHẢI đã tồn tại (không tạo mới).
             * @param {function(collection): void} mutatorFn - nhận chính object/array/map/set
             *   hiện có tại STATE[key], thực hiện thao tác in-place bên trong (không return gì,
             *   không gán lại biến mới).
             * @param {Object} [options]
             * @param {boolean} [options.skipCheck=false] - bỏ qua validate kiểu sau khi mutate
             *   (dùng cho hot path, giống set()). Mặc định false.
             * @returns {boolean} true nếu mutate xong (collection tồn tại + đúng kiểu sau khi
             *   mutate), false nếu key không tồn tại hoặc sai kiểu sau mutate (giữ nguyên warn).
             */
            mutate(key, mutatorFn, options) {
                options = options || {};
                const skipCheck = options.skipCheck === true;
                const collection = this._state[key];

                if (collection === undefined && !(key in this._state)) {
                    console.warn(`[AppState.mutate] Key "${key}" không tồn tại trong STATE — không thể mutate.`);
                    return false;
                }

                mutatorFn(collection);

                if (skipCheck) return true;

                const expectedType = this._schema[key];
                if (expectedType !== undefined && !matchesType(collection, expectedType)) {
                    console.warn(
                        `[AppState.mutate] Sau khi mutate, key "${key}" không còn đúng kiểu "${expectedType}" — kiểm tra lại mutatorFn.`,
                        'Giá trị hiện tại:', collection
                    );
                    return false;
                }
                return true;
            }
        }

        /** Object STATE thật — plain object, export trực tiếp để truy cập zero-cost. */
        const STATE = buildDefaultState();

        /** Instance quản lý — MỌI đường ghi vào STATE từ file khác PHẢI đi qua appState.set()/mutate(), không gán thẳng STATE.xxx = ... */
        const appState = new AppState(STATE, STATE_SCHEMA);

        /** vizConfig khởi tạo thật SAU khi CONST sẵn sàng — { ...DEFAULT_VIZ_CONFIG } đúng hành vi gốc.
         * FIX (yêu cầu Giang — "chỉnh EQ/Volume không có kết quả") — NGUYÊN NHÂN GỐC tìm được: field
         * `manualEq` trong DEFAULT_VIZ_CONFIG (xem khai báo phía trên) bị `Object.freeze()` RIÊNG
         * (ngoài việc CẢ object DEFAULT_VIZ_CONFIG cũng đã freeze ở tầng ngoài) — { ...spread } chỉ
         * copy NÔNG (shallow), field mảng bên trong vẫn là ĐÚNG reference frozen đó, không phải bản
         * sao mới. `appState.mutate('vizConfig', cfg => {...})` (service/state.js::mutate(), xem
         * docstring "thao tác IN-PLACE") KHÔNG clone gì cả — thao tác thẳng lên chính object đang
         * sống trong STATE. Router equalizer-settings.js làm đúng 1 việc duy nhất để lưu giá trị
         * band thủ công: `cfg.manualEq[index] = value;` — gán index lên 1 mảng ĐÃ BỊ FREEZE thì
         * THẤT BẠI ÂM THẦM (không strict mode, không lỗi, không cảnh báo — giá trị chỉ đơn giản
         * không đổi). Với NGƯỜI DÙNG MỚI/config chưa từng lưu `manualEq` riêng (loadConfig() ở
         * core/config.js chỉ điền default khi `!cfg.manualEq`, KHÔNG thay được 1 mảng đã tồn tại dù
         * đang bị đóng băng) — kéo từng thanh EQ thủ công KHÔNG BAO GIỜ thực sự lưu lại được, dù
         * `eqBandNodes[index].gain.value = value` (dòng NGAY SAU trong cùng router) vẫn tạm nghe
         * được ÂM THANH thay đổi ngay lúc kéo (thao tác riêng, không đụng cfg.manualEq) — khiến bug
         * càng khó nhận ra (nghe CÓ đổi tức thời, nhưng không lưu lại, mất ngay khi đổi mode qua lại
         * hoặc tải lại trang). FIX: tách riêng `manualEq` ra khỏi spread nông, tự tạo bản sao MẢNG
         * MỚI (KHÔNG đóng băng) cho vizConfig SỐNG THẬT — giữ nguyên `Object.freeze()` trên chính
         * DEFAULT_VIZ_CONFIG.manualEq (bản mẫu/hằng số, ĐÚNG nên đóng băng để không ai vô tình sửa
         * nhầm bản mẫu) — chỉ riêng bản đang sống trong STATE phải LUÔN là mảng độc lập, sửa được. */
        appState.set('vizConfig', { ...CONST.DEFAULT_VIZ_CONFIG, manualEq: [...CONST.DEFAULT_VIZ_CONFIG.manualEq] });
        // v12 "Multi Media" — cùng pattern với vizConfig ở trên.
        appState.set('slideshowConfig', { ...CONST.DEFAULT_SLIDESHOW_CONFIG });
        appState.set('readerConfig', { ...CONST.DEFAULT_READER_CONFIG });
