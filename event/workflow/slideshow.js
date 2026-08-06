/**
 * event/workflow/slideshow.js — Slideshow nền Visual (nguồn nền thứ 3, Batch 8, ver 12
 * "Multi Media", plan-v12-multimedia.md mục 4.b3 + plan-v12-multimedia-update-3.md mục 1.2/2.4).
 *
 * `workflowSlideshow` đóng 2 VAI TRÒ:
 *   1. Workflow bình thường cho cụm router "slideshowSettings" (Settings Drawer — mở/đóng, chọn
 *      album, đổi mode/interval/transitionType) — xem event/router/slideshow.js.
 *   2. "Router" cho TASK LẶP TỰ SINH (`_tick()`, chạy qua taskManager, KHÔNG qua eventBus) — cùng
 *      tinh thần core/auto-switch-visual.js (`scheduleNextAutoSwitchVisualTimer`/`exe`): timer nội
 *      bộ là 1 nguồn trigger đứng NGOÀI `/event/` (event-bus-flow.md mục 1, ngoại lệ browser-
 *      lifecycle/timer nội bộ), nên `_tick()` được phép tự `appState.get()` rồi gọi thẳng hàm
 *      THUẦN ở core/file-manager/slideshow.js — ĐÚNG vai trò Router (đọc state, chọn hàm core nào
 *      chạy), KHÔNG phải core nghiệp vụ nên KHÔNG bị ràng buộc core-function-conventions.md Rule
 *      1-4. Workflow nói chung được phép đọc appState trực tiếp (không như core) — xem tiền lệ
 *      event/workflow/file-manager-song.js, event/workflow/playlist.js.
 *
 * PAUSE/RESUME theo `vizConfig.videoBgEnabled` VÀ trạng thái phát nhạc — VIẾT LẠI (04/07/2026, mục
 * 2 phản hồi Giang, BỎ watchdog poll 3s/lần; MỞ RỘNG 18/07/2026, mục 1 phản hồi Giang — thêm điều
 * kiện nhạc đang phát): trước đây `_tick()` tự đọc `videoBgEnabled` MỖI LẦN CHẠY + có 1 task
 * "canh chừng" riêng (`_startWatchdog()`) đọc mỗi 3s để tự resume — Giang chỉ ra ĐÚNG: đã có sẵn
 * sự kiện click bật/tắt video (`event/workflow/visualizer-control-center.js`) để biết CHÍNH XÁC
 * lúc nào cần pause/resume, poll lại appState mỗi 3s là THỪA. Giờ `syncPlaybackGate()` (GỘP CHUNG
 * 2 hàm riêng `pauseForVideoBg()`/`resumeFromVideoBg()` đời trước — 18/07/2026) được GỌI TRỰC TIẾP
 * từ CẢ 2 nguồn (video bật/tắt THÀNH CÔNG — visualizer-control-center.js; VÀ audio play/pause —
 * core/player-controls.js), event-driven, KHÔNG còn polling nào cả — engine CHỈ "chạy" khi CẢ HAI
 * điều kiện đúng cùng lúc (xem `_shouldBeRunning()`). KHÔNG đụng `enableVideoBackground()`/
 * `disableVideoBackgroundState()`/`applyUploadedVideoBg()` (code DI SẢN đã có nợ Rule 3 sẵn — cùng
 * lý do đã ghi ở core/state-and-video-bg.js, KHÔNG thêm lời gọi void mới vào các hàm đó).
 *
 * PERSIST: `meta.slideshowConfig` + `meta.activeBackgroundAlbum` (service/db.js, getMeta/setMeta) —
 * đọc lại lúc boot qua `loadPersistedSettingsOnBoot()`, gọi từ core/visualizer/draw-visualizer.js
 * (DOMContentLoaded). KHÔNG dùng lớp localStorage như `vizConfig` (đổi hiếm — chỉ lúc mở Settings
 * Drawer, không cần đồng bộ nhanh kiểu kéo slider).
 *
 * CASCADE "xoá album đang dùng làm nguồn slideshow" — xem `clearActiveAlbum()`, gọi từ
 * event/workflow/file-manager-photo.js::deleteAlbumFromList() (đổi tên ở Giai đoạn 3b, rewrite Photo/Album) khi album vừa xoá trùng
 * `activeBackgroundAlbum` (mục 4 bước 2, plan-v12-multimedia-update-3.md).
 *
 * "PHOTO PER SONG" (MỚI 04/07/2026, mục 5 phản hồi Giang) — `slideshowConfig.photoPerSong=true`:
 * THAY task đếm giờ cố định (`SLIDESHOW_TASK`) bằng task poll `appState.get('currentKey')` mỗi 1s
 * (v13 Batch D) — KHÔNG dùng task nào: `advanceForSongChange()` được gọi THẲNG lúc bài hát đổi
 * thật (core/playlist/actions.js::playSong(), chỉ khi key ĐỔI so với bài trước) nên seek trong CÙNG
 * bài không kích hoạt đổi ảnh. `intervalSeconds` bị bỏ qua hoàn toàn ở chế độ này.
 *
 * NẠP SAU: core/file-manager/slideshow.js (SLIDESHOW_TRANSITION_TYPES, SLIDESHOW_TRANSITION_TYPES_NO_OUT,
 * SLIDESHOW_TRANSITION_MIN/MAX_TIME_MS, SLIDESHOW_TRANSITION_EASINGS, transitionSupportsInOutRatio,
 * computeSlideshowTransitionInOutMs, capSlideshowTransitionDurationMs, setSlideshowTransitionTiming,
 * pickNextSlideshowIndex*, setSlideshow*, startSlideshowTransitionVisuals,
 * finishSlideshowTransitionVisuals, resetSlideshowLayerClasses, computeSlideshowKenBurnsSafeBounds,
 * resolveSlideshowKenBurnsDirection, pickSlideshowKenBurnsKeyframes, startSlideshowKenBurnsAnimation,
 * stopSlideshowKenBurnsAnimation),
 * core/file-manager/album.js (getAlbumRecord/listAlbums — qua service/db.js), core/file-manager/image.js
 * (getImageRecord), core/file-manager/photo-ui.js (renderSlideshowAlbumPickerGrid — GIỮ NGUYÊN, giờ
 * vẽ vào genericDrawerBody thay vì panel tĩnh cũ), service/db.js (getMeta/setMeta), core/dom-refs.js
 * (slideshowContainer/slideshowLayer1/slideshowLayer2/slideshowLayer1Pan/slideshowLayer2Pan,
 * genericDrawerOverlay/Panel/Header/Body — Generic Drawer dùng chung, Giai đoạn 4),
 * core/settings-panel-stack.js (pushSettingsPanel), core/generic-drawer.js (openGenericDrawer/
 * closeGenericDrawer/hideGenericDrawerImmediately — Giai đoạn 4), components/slideshow-settings-
 * drawer.js (renderSlideshowPanelBody), service/task-manager.js (taskManager — CHỈ Workflow này
 * dùng, core không còn dùng kể từ 04/07/2026), service/state.js (appState).
 * NẠP TRƯỚC: event/router/slideshow.js, event/workflow/file-manager-photo.js (gọi
 * `workflowSlideshow.clearActiveAlbum()` trong cascade xoá album).
 *
 * === Batch D4 (Settings restructure, 06/07/2026) ===
 * Panel Settings (6 input enable/mode/photoPerSong/interval/transition/kenBurns) giờ PUSH/POP
 * động (core/settings-panel-stack.js) — KHÔNG còn `drawerSlideshowSettings`/6 dom-refs tĩnh (xem
 * core/dom-refs.js). File này KHÔNG cần refactor Rule 0.5 (mọi hàm ở đây ĐÃ LÀ Workflow — được
 * phép appState.get()/taskManager sẵn, core/file-manager/slideshow.js vốn ĐÃ Rule 1-4 đầy đủ từ
 * trước — không có core-gọi-core nào cần dời). CHỈ cần đổi CÁCH lấy tham chiếu DOM: dùng
 * `slideshowSettingsPanelEl` (biến module bên dưới, gán lúc `openPanel()`) thay vì dom-refs tĩnh —
 * các method (`refreshDrawerUI`/`changeInterval`/`changePhotoPerSong`/`onEnableToggleChange`/
 * `cancelAlbumPicker`) tự `.querySelector()` bên trong biến này. KHÔNG chủ động null-hoá biến này
 * lúc đóng panel (Back dùng CHUNG `settingsStackNav.back.click`, không biết gì về Slideshow) —
 * biến trỏ vào DOM node đã `.remove()` là VÔ HẠI vì không listener nào còn bắn sự kiện tới các
 * method đọc biến này khi panel đã đóng (delegation chỉ khớp id khi phần tử thật sự tồn tại/đang
 * hiển thị) — `openPanel()` GÁN LẠI biến này mỗi lần mở, luôn trỏ đúng panel MỚI NHẤT.
 *
 * VIẾT LẠI (Giai đoạn 4, rewrite Photo/Album, mục 1) — `TPL_SLIDESHOW_ALBUM_PICKER`/
 * `slideshowAlbumPicker*` dom-refs ĐÃ XOÁ — panel chọn Album giờ là Generic Drawer ĐỘNG (core/
 * generic-drawer.js), dựng lại mỗi lần mở qua `openAlbumPicker()`/`_closeAlbumPickerDrawer()` ngay
 * dưới, cùng hạ tầng dùng chung với menu action ảnh/picker ảnh Photo & Album.
 *
 * === Ken Burns (18/07/2026, phản hồi Giang) — VIẾT LẠI HOÀN TOÀN, KHÔNG migrate config cũ ===
 * `transitionType === 'kenburns'` (lựa chọn gộp chung vào 13 kiểu transition, đời trước) ĐÃ XOÁ
 * SẠCH — Ken Burns giờ là toggle ĐỘC LẬP `slideshowConfig.kenBurnsEnabled` (mặc định `false`),
 * dùng ĐƯỢC cùng lúc với BẤT KỲ kiểu transition nào (khác trước: chọn Ken Burns là mất quyền chọn
 * transition, khoá cứng về fade). Cơ chế: `_showFirstImage()`/`_tick()` giờ check
 * `cfg.kenBurnsEnabled` (KHÔNG còn check `cfg.transitionType`) để quyết định có gọi
 * `_activateKenBurns()` hay không — ĐỘC LẬP hoàn toàn với việc chọn transitionType nào.
 * Bật/tắt toggle CHỈ ảnh hưởng từ ẢNH KẾ TIẾP trở đi (Giang chốt: không ép reset ảnh đang hiện
 * hoạt — đúng tiền lệ `changeMode()`/`changeTransitionType()`, không đặc cách riêng cho Ken Burns).
 * Config cũ đã lưu (`transitionType: 'kenburns'`) tự nhiên bị bỏ qua bởi validate
 * `SLIDESHOW_TRANSITION_TYPES.includes()` ở `loadPersistedSettingsOnBoot()` (mảng đó đã bỏ
 * 'kenburns') — rơi về default 'fade', KHÔNG tự bật `kenBurnsEnabled` thay thế (Giang yêu cầu
 * không migrate, không giữ tương thích ngược).
 *
 * "NHÓM 2" (VIẾT LẠI TIẾP, cùng ngày 18/07/2026, THAY HẲN "Nhóm 1" — 8 biến thể random tự động,
 * không ai chọn được) — THÊM field `slideshowConfig.kenBurnsMode` (13 giá trị, xem
 * SLIDESHOW_KENBURNS_MODES ở core/file-manager/slideshow.js), người dùng tự chọn qua <select>
 * MỚI trong Settings (ẩn/hiện theo toggle `kenBurnsEnabled`, cùng khuôn `intervalRow` ẩn/hiện theo
 * `photoPerSong`). 3 giá trị *Random (panRandom/zoomRandom/zoomPanRandom) là META — mỗi lần ảnh
 * mới thành "current", `resolveSlideshowKenBurnsDirection()` (core) tự chọn ngẫu nhiên 1 direction
 * CỤ THỂ trong ĐÚNG nhóm con của nó (không lẫn nhóm — panRandom KHÔNG BAO GIỜ ra kết quả có zoom).
 * VIẾT LẠI LẦN 2 (BẢN ĐÚNG kỹ thuật "Nhóm 2", cùng ngày, Giang chỉ ra bản đầu CHỈ đúng phần chia
 * tuỳ chọn, CHƯA đúng phần kỹ thuật) — TOÀN BỘ animation giờ chạy bằng Web Animations API
 * (`panEl.animate()`, xem `startSlideshowKenBurnsAnimation()` core), KHÔNG còn CSS @keyframes/
 * classList — vì biên pan an toàn giờ TÍNH TỪ TỈ LỆ ẢNH THẬT (record.width/height) so với tỉ lệ
 * khung, mỗi ảnh 1 biên khác nhau, CSS tĩnh không biểu diễn được. Xem docstring đầy đủ ngay trên
 * các hàm core liên quan (core/file-manager/slideshow.js).
 *
 * KIẾN TRÚC 2 LỚP/LAYER (thay vì 1) — mỗi `slideshowLayerN` (ngoài, lo animation chuyển cảnh) giờ
 * bọc 1 `slideshowLayerNPan` (con, lo background-image + animation pan/zoom Ken Burns) — xem
 * docstring đầu assets/css/slideshow.css để biết lý do TÁCH (CSS chỉ giữ 1 `animation-name` hiệu
 * lực/phần tử, gộp chung sẽ đè lẫn nhau lúc cả 2 animation cùng chạy). HỆ QUẢ: `setSlideshowLayerImage()`
 * giờ LUÔN nhận layer CON (`_currentPanLayer()`/`_idlePanLayer()`, method mới ngay dưới, cùng khuôn
 * `_currentLayer()`/`_idleLayer()`) làm tham số — KỂ CẢ khi Ken Burns đang tắt (background-image
 * SỐNG cố định ở layer con bất kể Ken Burns bật/tắt, chỉ animation pan/zoom là có/không). Ken
 * Burns giờ chạy bằng Web Animations API (`startSlideshowKenBurnsAnimation()`/
 * `stopSlideshowKenBurnsAnimation()`, core/file-manager/slideshow.js, VIẾT LẠI LẦN 2 18/07/2026 —
 * xem docstring riêng ngay trên `_activateKenBurns()`) — cũng nhận layer CON, KHÔNG đổi chữ ký
 * hàm core (core vẫn "thuần", chỉ tham số truyền vào đổi ý nghĩa — Rule 2 vẫn giữ).
 */
let slideshowSettingsPanelEl = null; // panel Settings Slideshow đang mở — null nếu đang đóng (Batch D4)

const SLIDESHOW_TASK = 'slideshowTimer';
// MỚI (04/07/2026, mục 5 phản hồi Giang) — task "canh chừng" đổi bài hát cho chế độ "Photo per
// song": poll appState.get('currentKey') (đúng field lưu songKey đang phát, xem
// core/player-controls.js) mỗi 1s, phát hiện ĐỔI THẬT (next/prev/tự next hết bài/chọn bài khác)
// thì mới đổi ảnh — so sánh KEY (không phải currentTime) nên seek trong CÙNG bài KHÔNG kích hoạt
// đổi ảnh (đúng yêu cầu "bù trừ theo seek").
// XOÁ (v13 Batch D) — `SLIDESHOW_SONG_WATCH_TASK` ('slideshowSongWatch'): task poll `currentKey`
// mỗi 1s ĐÃ BỎ HẲN, thay bằng HOOK gọi thẳng lúc bài hát đổi THẬT (core/playlist/actions.js::
// playSong() -> workflowVisualBg.onSongChanged() -> `advanceForSongChange()` bên dưới). Poll 1s
// vừa tốn 1 task chạy liên tục suốt phiên, vừa trễ tối đa 1 giây so với thời điểm đổi bài.

const workflowSlideshow = {
    // Context RUNTIME của riêng engine (KHÔNG phải appState nghiệp vụ — chỉ bookkeeping của chính
    // task lặp, giống cách event/router/*.js giữ context bằng closure `let`; ở đây workflow đóng
    // vai trò Router cho task nên giữ luôn tại đây thay vì 1 router riêng không cần thiết).
    _images: [],           // Array<{key, blob, filename}> của album đang active, nạp lại mỗi start()
    _currentIndex: -1,     // index trong _images đang hiển thị ("current"), -1 = chưa có gì
    _currentObjectUrl: null,
    _layerToggle: false,   // false = layer1 đang 'current', true = layer2 đang 'current'
    // MỚI (18/07/2026, mục 1 phản hồi Giang — "chưa phát nhạc slideshow đã tự chạy") — có đang
    // THẬT SỰ hiện container + chạy task hay không (KHÁC `activeBackgroundAlbum` — cái đó chỉ nói
    // "có album được CHỌN", không nói "đang CHIẾU"). false = đã start() xong phần chuẩn bị (_images
    // nạp sẵn) nhưng ĐANG CHỜ nhạc phát lần đầu mới thật sự hiện — xem _reveal()/syncPlaybackGate().
    _isRevealed: false,
    // MỚI (18/07/2026, mục 2 phản hồi Giang — "mỗi lượt kế tiếp dù giống ảnh trước đó đều phải
    // ngẫu nhiên chứ không dùng vị trí cũ") — direction Ken Burns CỤ THỂ vừa dùng ở lượt kích hoạt
    // gần nhất (bất kể layer nào) — truyền vào resolveSlideshowKenBurnsDirection() làm excludeDirection.
    _lastKenBurnsDirection: null,

    _currentLayer() { return this._layerToggle ? slideshowLayer2 : slideshowLayer1; },
    _idleLayer() { return this._layerToggle ? slideshowLayer1 : slideshowLayer2; },
    // MỚI (Ken Burns, 18/07/2026) — layer CON tương ứng (mang background-image + animation pan/zoom
    // Ken Burns, xem docstring đầu file/assets/css/slideshow.css). CÙNG logic _layerToggle, chỉ đổi
    // đích đến (Pan thay vì layer ngoài).
    _currentPanLayer() { return this._layerToggle ? slideshowLayer2Pan : slideshowLayer1Pan; },
    _idlePanLayer() { return this._layerToggle ? slideshowLayer1Pan : slideshowLayer2Pan; },

    // MỚI (Ken Burns WAAPI, 18/07/2026) — Animation object (Web Animations API) đang chạy trên mỗi
    // layer con (null nếu layer đó chưa từng kích hoạt Ken Burns/đã dừng) — Workflow tự giữ để
    // `.cancel()` đúng lúc (đổi ảnh mới/tắt Ken Burns), xem stopSlideshowKenBurnsAnimation() core.
    _kenBurnsAnim1: null, // Animation trên slideshowLayer1Pan
    _kenBurnsAnim2: null, // Animation trên slideshowLayer2Pan

    _getKenBurnsAnim(panEl) { return panEl === slideshowLayer1Pan ? this._kenBurnsAnim1 : this._kenBurnsAnim2; },
    _setKenBurnsAnim(panEl, anim) {
        if (panEl === slideshowLayer1Pan) this._kenBurnsAnim1 = anim; else this._kenBurnsAnim2 = anim;
    },

    _computeIntervalMs() {
        return Math.max(5, appConfigVisualBg.getAll().slideshow.intervalSeconds) * 1000;
    },

    // XOÁ (v13 Batch E, plan mục 5 + mục 7) — `_computeImageDisplayDurationMs()` (ước lượng thời
    // lượng ảnh còn được nhìn thấy theo `audioPlayer.duration - currentTime`) ĐÃ BỎ HẲN. Nó chỉ tồn
    // tại vì chế độ "1 ảnh mỗi bài" từng phải TỰ ĐOÁN ảnh sẽ hiện bao lâu; từ Batch D nhịp đổi ảnh
    // do sự kiện đổi bài đẩy tới, nên con số ước lượng đó vừa vô nghĩa (bài 8 phút -> đặt Ken Burns
    // 8 phút trong khi người dùng có thể Next sau 5 giây) vừa không đáng tin ngay sau khi đổi bài
    // (`audioPlayer.duration` của bài MỚI có thể còn NaN tại thời điểm gọi).
    // 3 nơi từng gọi nó (duration Ken Burns, cap transition, maxMs của picker thời lượng) giờ dùng
    // `_computeIntervalMs()` — mốc DUY NHẤT, xác định, do người dùng đặt.

    /** MỚI (v13 Batch D) — "1 ảnh mỗi bài": đổi ảnh NGAY khi bài hát đổi thật. THAY HẲN
     * `_startSongWatcher()` (task poll `currentKey` mỗi 1s + tự so sánh với `_lastSeenSongKey`) —
     * việc "đã đổi bài hay chưa" giờ do NƠI ĐỔI tự báo, không cần dò.
     * Gọi CHÉO DOMAIN từ `workflowVisualBg.onSongChanged()` (điểm phân phối duy nhất cho mọi nguồn
     * nền phản ứng theo bài hát — ảnh danh sách lẫn video danh sách).
     * Guard clause: chưa reveal (chưa phát nhạc lần đầu/đang bị video nền che) thì bỏ qua — lượt
     * đầu tiên sẽ do `_reveal()` lo qua `_showFirstImage()`.
     * TÁI DÙNG NGUYÊN `_tick()` — không quan tâm lý do được gọi, đúng như bản watcher cũ đã làm. */
    advanceForSongChange() {
        if (!this._isRevealed) return; // guard: engine chưa thật sự chiếu
        if (appConfigVisualBg.getAll().listPlaybackMode !== 'perSong') return; // guard: đang ở chế độ Trình chiếu (đếm giờ), không đổi theo bài
        this._tick();
    },

    // ===================== Boot / persist =====================

    // XOÁ (v13 Batch C) — `loadPersistedSettingsOnBoot()` ĐÃ BỎ: domain config `slideshow` +
    // `meta.slideshowConfig` gộp hẳn vào `visualBgConfig.slideshow`, nên việc đọc lại + validate
    // lúc boot nằm gọn trong `workflowVisualBg.loadPersistedSettingsOnBoot()` (1 lần đọc meta duy
    // nhất cho cả nền lẫn cách chiếu). File này giờ CHỈ còn engine + panel "Tuỳ chỉnh Trình chiếu".

    // ===================== Điều khiển album nền =====================

    /** XOÁ (v13 Batch B) — `setActiveAlbum()`/`clearActiveAlbum()` ĐÃ BỎ: "album nào đang làm nền"
     * giờ là `visualBgConfig.listAlbumId` (domain `visualBg`), không còn `appState
     * .activeBackgroundAlbum` + `meta.activeBackgroundAlbum` song song. Nơi chọn album là bảng
     * "Chọn nguồn" (workflowVisualBg.selectAlbumFromPicker()); cascade "xoá album đang dùng" gọi
     * `workflowVisualBg.clearListAlbumIfMatches()`. Engine ở file này chỉ còn nhận lệnh
     * `start(albumId)`/`stop()` từ đó. */

    /** Đọc lại danh sách ảnh của 1 album (gọi lúc start(), phòng album vừa được thêm/gỡ ảnh ở
     * Photo & Album trong lúc slideshow đang chạy nền).
     * @param {string} albumId
     */
    async refreshImages(albumId) {
        const albumRecord = await getAlbumRecord(albumId); // data layer
        if (!albumRecord || !Array.isArray(albumRecord.imageKeys) || albumRecord.imageKeys.length === 0) {
            this._images = [];
            return;
        }
        const records = await Promise.all(albumRecord.imageKeys.map(async (key) => {
            const record = await getImageRecord(key); // data layer
            return record ? { key, ...record } : null;
        }));
        this._images = this._applyNextOrder(records.filter(Boolean));
    },

    /** MỚI (v13 Batch C) — dựng THỨ TỰ danh sách ảnh theo `visualBgConfig.nextOrder`:
     *   'sequential' -> GIỮ NGUYÊN thứ tự `albumRecord.imageKeys` = đúng THỜI GIAN THÊM VÀO ALBUM
     *                   (khác "ngày upload ảnh gốc" — `record.addedAt`), đúng yêu cầu plan mục 2c.
     *   'playlist'   -> CÙNG TIÊU CHÍ với Settings -> Playlist -> Sắp xếp (`displaySortMode`), đọc
     *                   TẠI ĐÂY chứ không lưu bản sao riêng.
     *   'random'     -> thứ tự mảng không quan trọng (mỗi lượt tự bốc ngẫu nhiên ở `_tick()`).
     * Workflow tự chọn gọi Core nào (2 core THUẦN đã tách sẵn theo Rule 1, core/visual-bg.js) —
     * KHÔNG nhét `mode` vào 1 core rồi if/else bên trong.
     * @param {Array} images
     * @returns {Array}
     */
    _applyNextOrder(images) {
        if (appConfigVisualBg.getAll().nextOrder !== 'playlist') return images; // guard: 2 chế độ kia dùng nguyên thứ tự album
        const mode = appConfigPlaylist.getAll().displaySortMode;
        const named = images.map((img) => ({ ...img, name: img.filename || img.key }));
        if (mode === 'newest' || mode === 'oldest') return sortVisualBgItemsByAddedAt(named, mode === 'newest'); // core/visual-bg.js
        return sortVisualBgItemsByName(named, mode === 'za'); // core/visual-bg.js
    },

    /** Bắt đầu (hoặc khởi động lại) engine cho 1 albumId.
     * VIẾT LẠI (04/07/2026, mục 5 phản hồi Giang) — rẽ nhánh theo `slideshowConfig.photoPerSong`:
     * 'perSong' -> đổi ảnh theo sự kiện đổi bài (`advanceForSongChange()`); 'slideshow' -> task đếm giờ.
     * VIẾT LẠI LẦN 2 (18/07/2026, mục 1 phản hồi Giang — "chưa phát nhạc slideshow đã tự chạy và
     * hiển thị ảnh rồi") — TÁCH phần "chuẩn bị" (nạp _images, reset index — LUÔN làm ngay) khỏi
     * phần "hiện + chạy" (`_reveal()`, CHỈ làm khi `_shouldBeRunning()` — nhạc đang phát THẬT +
     * video nền tắt). Nếu gọi start() lúc nhạc CHƯA phát (vd boot xong tự restore album đã lưu,
     * hoặc vừa chọn album trong Settings lúc nhạc đang pause) -> _images đã sẵn sàng nhưng
     * container VẪN ẨN, KHÔNG task nào chạy — chờ `syncPlaybackGate()` gọi `_reveal()` đúng lúc
     * nhạc bắt đầu phát lần đầu (xem handleAudioPlay(), core/player-controls.js).
     * @param {string} albumId
     */
    async start(albumId) {
        this.stop(); // dọn sạch task/DOM cũ trước khi bắt đầu lại (đổi album giữa lúc đang chạy)
        await this.refreshImages(albumId);
        if (this._images.length === 0) {
            setSlideshowContainerVisible(slideshowContainer, false); // core
            return; // album rỗng -> chưa có gì để chiếu; mở lại Settings Drawer / thêm ảnh xong sẽ tự refresh khi start() được gọi lại
        }
        this._currentIndex = -1;
        this._layerToggle = false;
        if (this._shouldBeRunning()) this._reveal();
        // Chưa đủ điều kiện (nhạc chưa phát/đang pause, hoặc video nền đang bật) -> để yên, container
        // ẩn, KHÔNG hiện ảnh nào — chờ syncPlaybackGate() gọi lại đúng lúc đủ điều kiện.
    },

    /** MỚI (18/07/2026, mục 1 phản hồi Giang) — tính xem engine CÓ NÊN đang "chạy" hay không, dựa
     * trên 2 điều kiện ĐỘC LẬP PHẢI ĐÚNG CÙNG LÚC: (1) audio đang phát THẬT (không chỉ có
     * currentKey — phải đọc thẳng `audioPlayer.paused`, tin cậy hơn appState có thể lệch nhịp) VÀ
     * (2) video nền KHÔNG đang bật (video luôn che kín, chạy slideshow phía dưới vô nghĩa — lý do
     * cũ của pauseForVideoBg()/resumeFromVideoBg(), giờ GỘP CHUNG vào đây thay vì 2 hàm riêng).
     * @returns {boolean}
     */
    _shouldBeRunning() {
        // SỬA (v13 Batch A) — `vizConfig.videoBgEnabled` ĐÃ GỘP vào `visualBgConfig`. Điều kiện
        // giữ NGUYÊN ý nghĩa: có VIDEO nền đang che kín thì chạy slideshow phía dưới là vô nghĩa.
        const visualBgCfg = appConfigVisualBg.getAll();
        return !audioPlayer.paused && !(visualBgCfg.enabled && visualBgCfg.mediaType === 'video');
    },

    /** MỚI (18/07/2026, mục 1 phản hồi Giang) — hiện container + ảnh đầu tiên + bắt đầu task lặp
     * (hoặc song-watcher) — gọi LẦN ĐẦU đúng lúc `_shouldBeRunning()` chuyển từ false -> true (từ
     * `start()` nếu nhạc ĐÃ phát sẵn, hoặc từ `syncPlaybackGate()` lúc nhạc BẮT ĐẦU phát). KHÔNG
     * gọi lại nếu ĐÃ revealed rồi (dùng `_resumeTicking()` thay — xem `syncPlaybackGate()`).
     * MỚI (mục 4 phản hồi Giang — "khi áp dụng slideshow thì phải ẩn background image, không tắt")
     * — ẨN `#visual-bg-image` (opacity 0, KHÔNG đụng `vizConfig.visualBgImageEnabled`/`visualBgImage`
     * trong state) — slideshow ĐÃ che nó bằng z-index rồi (xem core/state-and-video-bg.js), nhưng
     * ẩn tường minh để tránh lớp đó vẫn "sống" ngầm dưới lúc slideshow hiện. `stop()` tự khôi phục
     * lại ĐÚNG theo trạng thái `visualBgImageEnabled` của chính nó (KHÔNG tự ép bật lại nếu người
     * dùng vốn dĩ đã tắt nó từ trước). */
    _reveal() {
        if (this._isRevealed) return;
        this._isRevealed = true;
        // SỬA (v13 Batch A) — điều kiện "ảnh nền tĩnh đang bật" đọc từ `visualBgConfig`.
        if (visualBgImageElement && this._isStaticBgImageActive()) {
            visualBgImageElement.style.opacity = '0'; // core dom-ref trực tiếp — CHỈ ẩn, KHÔNG tắt state
        }
        setSlideshowContainerVisible(slideshowContainer, true); // core
        this._showFirstImage();
        // SỬA (v13 Batch D) — nhánh 'perSong' KHÔNG còn tạo task nào: nhịp đổi ảnh do sự kiện đổi
        // bài đẩy tới (`advanceForSongChange()`), không phải do đồng hồ. Chỉ nhánh 'slideshow' mới
        // cần task đếm giờ.
        if (appConfigVisualBg.getAll().listPlaybackMode !== 'perSong') {
            taskManager.kill(SLIDESHOW_TASK);
            taskManager.addNew(SLIDESHOW_TASK, { time: this._computeIntervalMs(), exe: () => this._tick(), mode: 'timeout', count: 0 });
            taskManager.operator(SLIDESHOW_TASK, 'enabled');
        }
    },

    /** MỚI (18/07/2026, mục 1 phản hồi Giang) — điểm ĐỒNG BỘ DUY NHẤT cho trạng thái "chạy" của
     * engine, gọi từ MỌI nguồn có thể ảnh hưởng (audio play/pause — core/player-controls.js;
     * video nền bật/tắt — event/workflow/visualizer-control-center.js). THAY HẲN 2 hàm riêng lẻ
     * cũ `pauseForVideoBg()`/`resumeFromVideoBg()` — gộp chung vào đây để 2 nguồn KHÔNG dẫm chân
     * nhau (vd nhạc resume nhưng video nền vẫn đang bật -> KHÔNG được chạy, chỉ 1 hàm duy nhất
     * kiểm tra CẢ HAI điều kiện mới quyết định đúng). Tự idempotent — gọi lại nhiều lần dù trạng
     * thái không đổi cũng không sao. */
    syncPlaybackGate() {
        if (!appConfigVisualBg.getAll().listAlbumId) return; // không có slideshow nào được chọn -> không có gì để sync
        const shouldRun = this._shouldBeRunning();
        if (shouldRun && !this._isRevealed) this._reveal();
        else if (shouldRun && this._isRevealed) this._resumeTicking();
        else if (!shouldRun && this._isRevealed) this._pauseTicking();
    },

    /** MỚI (18/07/2026, mục 1 phản hồi Giang) — tạm dừng task lặp + ĐÓNG BĂNG Ken Burns TẠI ĐÚNG
     * vị trí hiện tại (không cancel/reset — xem pauseSlideshowKenBurnsAnimation(), core). */
    _pauseTicking() {
        taskManager.pause(SLIDESHOW_TASK);
        pauseSlideshowKenBurnsAnimation(this._kenBurnsAnim1); // core
        pauseSlideshowKenBurnsAnimation(this._kenBurnsAnim2); // core
    },

    /** MỚI (18/07/2026, mục 1 phản hồi Giang) — chạy tiếp task lặp + Ken Burns từ ĐÚNG vị trí đã
     * đóng băng (không restart). */
    _resumeTicking() {
        if (taskManager.plan[SLIDESHOW_TASK]) taskManager.resume(SLIDESHOW_TASK);
        resumeSlideshowKenBurnsAnimation(this._kenBurnsAnim1); // core
        resumeSlideshowKenBurnsAnimation(this._kenBurnsAnim2); // core
    },

    /** Dừng hẳn engine — dọn task + ẩn container + revoke object URL.
     * VIẾT LẠI (04/07/2026, mục 3 — Rule 3 siết chặt): core không còn hàm gộp
     * `resetSlideshowLayers()` (từng tự gọi 2 hàm core khác bên trong, nay cấm) — Workflow tự lặp
     * qua 2 layer, tự gọi TỪNG hàm core cần thiết theo đúng thứ tự.
     * SỬA (Ken Burns WAAPI, 18/07/2026) — `setSlideshowLayerImage()`/`stopSlideshowKenBurnsAnimation()`
     * giờ nhận layer CON (Pan), `resetSlideshowLayerClasses()` vẫn nhận layer NGOÀI như cũ (2 việc
     * khác phần tử — xem docstring đầu file). Task `slideshowKenBurnsFreeze1`/`2` KHÔNG CÒN TỒN TẠI
     * (kỹ thuật CSS cũ cần tự "đóng băng" bằng tay — WAAPI `fill:'forwards'` tự làm việc đó, xem
     * docstring `startSlideshowKenBurnsAnimation()` core) — bỏ luôn 2 dòng `taskManager.kill()` đó.
     * SỬA LẦN 2 (18/07/2026, mục 1+4 phản hồi Giang) — reset `_isRevealed`/`_lastKenBurnsDirection`
     * (engine tắt hẳn = phải "chưa revealed" nếu start() lại) + KHÔI PHỤC Visual bg image (`#visual-
     * bg-image`) về ĐÚNG trạng thái `visualBgImageEnabled` của chính nó (mục 4 — chỉ ẨN lúc slideshow
     * chạy, KHÔNG tắt state, nên lúc dừng phải trả lại y như trước nếu nó vốn đang bật). */
    stop() {
        taskManager.kill(SLIDESHOW_TASK);
        setSlideshowContainerVisible(slideshowContainer, false); // core
        [[slideshowLayer1, slideshowLayer1Pan], [slideshowLayer2, slideshowLayer2Pan]].forEach(([layerEl, panEl]) => {
            setSlideshowLayerImage(panEl, ''); // core — layer CON
            stopSlideshowKenBurnsAnimation(panEl, this._getKenBurnsAnim(panEl)); // core — layer CON
            this._setKenBurnsAnim(panEl, null);
            resetSlideshowLayerClasses(layerEl); // core — layer NGOÀI
        });
        if (this._currentObjectUrl) { try { URL.revokeObjectURL(this._currentObjectUrl); } catch (e) {} this._currentObjectUrl = null; }
        this._currentIndex = -1;
        this._isRevealed = false;
        this._lastKenBurnsDirection = null;
        if (visualBgImageElement && this._isStaticBgImageActive()) {
            visualBgImageElement.style.opacity = '1'; // core dom-ref trực tiếp — khôi phục ĐÚNG trạng thái riêng của nó
        }
    },

    /** MỚI (v13 Batch A) — "ảnh nền tĩnh 1 tấm đang bật hay không", đọc từ domain config `visualBg`
     * (thay `vizConfig.visualBgImageEnabled` đã xoá). Dùng bởi `_reveal()`/`stop()` để ẩn/khôi phục
     * `#visual-bg-image` đúng theo trạng thái riêng của lớp đó, KHÔNG tự ép bật/tắt state. */
    _isStaticBgImageActive() {
        const cfg = appConfigVisualBg.getAll();
        return cfg.enabled && cfg.mediaType === 'image' && cfg.sourceMode === 'single';
    },

    /** Hiện ảnh ĐẦU TIÊN ngay lập tức lúc start() (KHÔNG chuyển cảnh — chỉ set thẳng lên layer
     * "current"), thay vì để màn hình trống chờ hết interval đầu tiên mới thấy gì.
     * SỬA (Ken Burns, 18/07/2026) — background-image set lên layer CON (`_currentPanLayer()`),
     * class `ss-current` vẫn gán lên layer NGOÀI (`_currentLayer()`) như cũ. Điều kiện kích hoạt
     * Ken Burns đổi từ `cfg.transitionType === 'kenburns'` sang `cfg.kenBurnsEnabled` — ĐỘC LẬP
     * với transitionType đang chọn. */
    _showFirstImage() {
        const image = this._images[0];
        if (!image) return;
        const objectUrl = URL.createObjectURL(image.blob);
        this._currentObjectUrl = objectUrl;
        this._currentIndex = 0;
        const layerEl = this._currentLayer();
        const panEl = this._currentPanLayer();
        setSlideshowLayerImage(panEl, objectUrl); // core — layer CON
        if (layerEl) layerEl.classList.add('ss-current');
        const cfg = appConfigVisualBg.getAll().slideshow;
        setSlideshowTransitionType(slideshowContainer, cfg.transitionType); // core
        if (cfg.kenBurnsEnabled) this._activateKenBurns(panEl, cfg.kenBurnsMode, image);
    },

    /**
     * MỚI (04/07/2026, mục 3 phản hồi Giang — Rule 3 siết chặt): Workflow (KHÔNG phải core) tự
     * chọn direction/tính bounds rồi gọi core tạo Animation — giữ đúng Rule 2 (core nhận mọi thứ
     * qua tham số, không tự đọc appState/window).
     * SỬA (Ken Burns, 18/07/2026) — nhận layer CON (Pan), KHÔNG phải layer ngoài.
     * VIẾT LẠI LẦN 2 ("Nhóm 2" WAAPI, 18/07/2026) — resolve direction + tính bounds từ ảnh thật.
     * VIẾT LẠI LẦN 3 (18/07/2026, "time-scaled magnitude" + fix "Photo per song" phản hồi Giang) —
     * (v13 Batch E) `durationMs` trở lại đọc `_computeIntervalMs()` — mốc duy nhất, xem khối
     * XOÁ `_computeImageDisplayDurationMs()` — rồi CAP 1 LẦN DUY NHẤT qua `capSlideshowKenBurnsDurationMs()`
     * (core) NGAY TẠI ĐÂY, dùng CHUNG kết quả đã cap cho CẢ `pickSlideshowKenBurnsKeyframes()` LẪN
     * `startSlideshowKenBurnsAnimation()` — 2 nơi PHẢI khớp nhau tuyệt đối (biên độ tính theo 1 con
     * số, animation chạy theo con số khác = lệch tốc độ, đúng bug gốc Giang phát hiện).
     * @param {HTMLElement} panEl - layer CON `.ss-kenburns-pan`.
     * @param {string} mode - 1 trong SLIDESHOW_KENBURNS_MODES (cfg.kenBurnsMode).
     * @param {{width?: number, height?: number}} image - ẢNH SẮP chiếu lên panEl (record đầy đủ,
     *   `width`/`height` là kích thước ẢNH GỐC — có thể thiếu ở record cũ, core tự fallback an toàn).
     */
    _activateKenBurns(panEl, mode, image) {
        const direction = resolveSlideshowKenBurnsDirection(mode, this._lastKenBurnsDirection); // core
        this._lastKenBurnsDirection = direction; // MỚI (mục 2) — nhớ lại cho lượt kế tiếp loại trừ
        const bounds = computeSlideshowKenBurnsSafeBounds(image ? image.width : 0, image ? image.height : 0, window.innerWidth, window.innerHeight); // core
        const durationMs = capSlideshowKenBurnsDurationMs(this._computeIntervalMs()); // core — cap 1 LẦN, dùng chung 2 nơi dưới
        const keyframes = pickSlideshowKenBurnsKeyframes(direction, bounds, durationMs); // core
        const anim = startSlideshowKenBurnsAnimation(panEl, keyframes, durationMs); // core
        this._setKenBurnsAnim(panEl, anim);
    },

    /** taskManager exe — đóng vai trò "Router" cho tick tự sinh (xem comment đầu file): tự đọc
     * appState rồi gọi hàm THUẦN ở core/file-manager/slideshow.js.
     * ĐƠN GIẢN HOÁ (04/07/2026, mục 2 phản hồi Giang) — bỏ hẳn check `videoBgEnabled` + pause() ở
     * đây: watchdog poll 3s/lần đã XOÁ (xem lý do ở `syncPlaybackGate()` phía trên) — task này giờ
     * CHỈ chạy khi thật sự KHÔNG bị pause từ bên ngoài, không cần tự kiểm tra lại nữa.
     * SỬA (Ken Burns, 18/07/2026) — background-image/Ken Burns thao tác lên layer CON
     * (`outgoingPan`/`incomingPan`), transition chuyển cảnh (class ss-layer-enter/exit) vẫn thao
     * tác lên layer NGOÀI (`outgoingLayer`/`incomingLayer`) như cũ. Điều kiện Ken Burns đổi sang
     * `cfg.kenBurnsEnabled` — ĐỘC LẬP với `cfg.transitionType`, nên chạy được cùng lúc với BẤT KỲ
     * kiểu transition nào (khác trước: 'kenburns' khoá cứng transition về fade).
     * VIẾT LẠI LẦN 2 (18/07/2026, phản hồi Giang — "thêm thời gian transition giữa 2 ảnh") —
     * TÍNH thời gian transition THẬT (kẹp theo `_computeIntervalMs()` — tránh xung đột
     * với lượt `_tick()` kế tiếp) + tách "in"/"out" theo tỉ lệ đã cấu hình (bỏ qua tỉ lệ, dùng
     * TOÀN BỘ `totalMs` làm "in" nếu kiểu transition hiện tại KHÔNG hỗ trợ pha "out" — xem
     * `transitionSupportsInOutRatio()`) — set ĐỘNG lên từng layer TRƯỚC khi
     * `startSlideshowTransitionVisuals()` thêm class (thứ tự BẮT BUỘC, xem docstring
     * `setSlideshowTransitionTiming()` core). Task cleanup giờ đợi `Math.max(inMs, outMs)`. */
    _tick() {
        if (this._images.length === 0) return; // album rỗng (ảnh vừa bị xoá hết) -> chờ, không lỗi

        const cfg = appConfigVisualBg.getAll().slideshow;
        // SỬA (v13 Batch C) — `slideshowConfig.mode` (sequential/random) ĐÃ XOÁ, thay bằng
        // `visualBgConfig.nextOrder` (random/sequential/playlist) ở panel cha. 'sequential' và
        // 'playlist' CÙNG đi tuần tự — chúng chỉ khác nhau ở THỨ TỰ mảng đã dựng sẵn
        // (`_applyNextOrder()`), không khác ở cách bước tiếp.
        const nextIndex = appConfigVisualBg.getAll().nextOrder === 'random'
            ? pickNextSlideshowIndexRandom(this._currentIndex, this._images.length)      // core
            : pickNextSlideshowIndexSequential(this._currentIndex, this._images.length); // core
        if (nextIndex === -1) return;

        const image = this._images[nextIndex];
        const objectUrl = URL.createObjectURL(image.blob);
        const outgoingLayer = this._currentLayer();
        const incomingLayer = this._idleLayer();
        const outgoingPan = this._currentPanLayer();
        const incomingPan = this._idlePanLayer();

        setSlideshowTransitionType(slideshowContainer, cfg.transitionType); // core
        setSlideshowLayerImage(incomingPan, objectUrl); // core — layer CON
        if (cfg.kenBurnsEnabled) this._activateKenBurns(incomingPan, cfg.kenBurnsMode, image);

        // MỚI (18/07/2026, mục "thêm thời gian transition") — tính in/out THẬT từ config, kẹp
        // theo thời gian ảnh sẽ hiển thị (tránh xung đột lượt _tick() kế tiếp).
        const totalMs = capSlideshowTransitionDurationMs(cfg.transitionDurationMs, this._computeIntervalMs()); // core
        const { inMs, outMs } = transitionSupportsInOutRatio(cfg.transitionType) // core
            ? computeSlideshowTransitionInOutMs(totalMs, cfg.transitionInOutRatio) // core
            : { inMs: totalMs, outMs: totalMs }; // 3 kiểu không có pha "out" -> bỏ qua tỉ lệ, dùng trọn totalMs cho "in"
        setSlideshowTransitionTiming(incomingLayer, inMs, cfg.transitionEasing); // core — PHẢI set TRƯỚC khi thêm class
        setSlideshowTransitionTiming(outgoingLayer, outMs, cfg.transitionEasing); // core

        // VIẾT LẠI (04/07/2026, mục 3 — Rule 3 siết chặt): trước đây gọi 1 hàm core duy nhất
        // (beginSlideshowTransition) TỰ taskManager.once() + TỰ gọi core khác bên trong — giờ CẤM.
        // Workflow tự làm cả 2 việc đó: gọi core "bắt đầu" NGAY, rồi TỰ taskManager.once() lịch
        // đúng lúc hết thời lượng THẬT (Math.max(inMs, outMs)) để tự gọi TỪNG hàm core "kết thúc".
        startSlideshowTransitionVisuals(outgoingLayer, incomingLayer); // core — layer NGOÀI
        const cleanupDelayMs = Math.max(inMs, outMs);
        taskManager.once(() => {
            setSlideshowLayerImage(outgoingPan, ''); // core — layer CON
            stopSlideshowKenBurnsAnimation(outgoingPan, this._getKenBurnsAnim(outgoingPan)); // core — layer CON (Ken Burns WAAPI)
            this._setKenBurnsAnim(outgoingPan, null);
            finishSlideshowTransitionVisuals(outgoingLayer, incomingLayer); // core — layer NGOÀI
        }, cleanupDelayMs, 'slideshowTransitionCleanup');

        if (this._currentObjectUrl) {
            const staleUrl = this._currentObjectUrl;
            taskManager.once(() => { try { URL.revokeObjectURL(staleUrl); } catch (e) {} }, cleanupDelayMs + 100, 'slideshowRevokeStale');
        }
        this._currentObjectUrl = objectUrl;
        this._currentIndex = nextIndex;
        this._layerToggle = !this._layerToggle;
    },

    // ===================== Settings Drawer (cụm router "slideshowSettings") =====================

    /** Ứng với 'slideshowSettings.openPanel.click' — push panel + vẽ lại UI. */
    async openPanel() {
        slideshowSettingsPanelEl = pushSettingsPanel({ title: t('slideshowSettingsDrawer.title'), bodyHtml: renderSlideshowPanelBody() });
        await this.refreshDrawerUI();
    },

    /** Vẽ lại toàn bộ UI Settings Drawer theo state hiện tại — gọi lúc mở drawer + sau mỗi lần
     * đổi album/mode/interval/transitionType.
     * VIẾT LẠI (Batch 9, 04/07/2026, mục 4; ĐƠN GIẢN HOÁ THÊM 04/07/2026 đợt 2 — bỏ hẳn hàng "album
     * đang chạy" theo phản hồi Giang) — 2 nút "Chọn Album"/"Tắt" cũ giờ CHỈ còn 1 toggle
     * (`setting-slideshow-enable`), phản ánh ĐÚNG BẰNG việc CÓ/KHÔNG có `activeBackgroundAlbum`.
     * Đổi album khi đang bật: gạt Off (xoá album) rồi gạt lại On (mở lại panel từ đầu). */
    async refreshDrawerUI() {
        if (!slideshowSettingsPanelEl) return; // panel đã đóng — an toàn bỏ qua (Batch D4)
        const cfg = appConfigVisualBg.getAll().slideshow;

        const intervalBtn = slideshowSettingsPanelEl.querySelector('#setting-slideshow-interval');
        const transitionSelect = slideshowSettingsPanelEl.querySelector('#setting-slideshow-transition');
        const kenBurnsToggle = slideshowSettingsPanelEl.querySelector('#setting-slideshow-kenburns');
        const kenBurnsModeRow = slideshowSettingsPanelEl.querySelector('#slideshow-kenburns-mode-row');
        const kenBurnsModeSelect = slideshowSettingsPanelEl.querySelector('#setting-slideshow-kenburns-mode');
        const transitionDurationBtn = slideshowSettingsPanelEl.querySelector('#setting-slideshow-transition-duration');
        const transitionRatioRow = slideshowSettingsPanelEl.querySelector('#slideshow-transition-ratio-row');
        const transitionRatioSlider = slideshowSettingsPanelEl.querySelector('#setting-slideshow-transition-ratio');
        const transitionEasingSelect = slideshowSettingsPanelEl.querySelector('#setting-slideshow-transition-easing');

        if (intervalBtn) intervalBtn.textContent = `${cfg.intervalSeconds}s`; // SỬA (18/07/2026) — nút bấm (textContent), không còn <input>.value
        if (transitionSelect) transitionSelect.value = cfg.transitionType;
        // MỚI (Ken Burns, 18/07/2026) — đồng bộ toggle độc lập, KHÔNG còn nằm trong transitionSelect.
        if (kenBurnsToggle) kenBurnsToggle.checked = !!cfg.kenBurnsEnabled;
        // MỚI ("Nhóm 2", 18/07/2026) — đồng bộ <select> 13 chế độ + ẩn hàng khi Ken Burns đang tắt
        // (không còn ý nghĩa gì lúc đó — cùng khuôn intervalRow ẩn/hiện theo photoPerSong).
        if (kenBurnsModeRow) kenBurnsModeRow.classList.toggle('hidden', !cfg.kenBurnsEnabled);
        if (kenBurnsModeSelect) kenBurnsModeSelect.value = cfg.kenBurnsMode;
        // MỚI (18/07/2026, mục "thêm thời gian transition") — đồng bộ nút thời gian + ẩn/hiện hàng
        // tỉ lệ theo ĐÚNG transitionType hiện tại (transitionSupportsInOutRatio(), core) + đồng bộ
        // slider + nhãn "In Xs / Out Ys" + easing.
        if (transitionDurationBtn) transitionDurationBtn.textContent = `${(cfg.transitionDurationMs / 1000).toFixed(1)}s`;
        if (transitionRatioRow) transitionRatioRow.classList.toggle('hidden', !transitionSupportsInOutRatio(cfg.transitionType)); // core
        if (transitionRatioSlider) transitionRatioSlider.value = cfg.transitionInOutRatio;
        this._updateTransitionRatioLabel(slideshowSettingsPanelEl, cfg.transitionInOutRatio);
        if (transitionEasingSelect) transitionEasingSelect.value = cfg.transitionEasing;
    },

    // XOÁ (v13 Batch B) — `onEnableToggleChange()`/`openAlbumPicker()`/`selectAlbumFromPicker()`/
    // `cancelAlbumPicker()`/`_closeAlbumPickerDrawer()` ĐÃ DỜI HẲN sang event/workflow/visual-bg.js
    // (bảng "Chọn nguồn"): việc chọn Album là chọn NGUỒN NỀN — nghiệp vụ của Visual Background, KHÔNG
    // phải của engine trình chiếu. 2 core dùng chung `renderAlbumPickerGrid()`/
    // `wireAlbumPickerDrawerActions()` (core/file-manager/photo-ui.js) GIỮ NGUYÊN, chỉ được tham số
    // hoá `routerName`/`msgPrefix` — KHÔNG viết bản sao nào.

    // XOÁ (v13 Batch C) — `changeMode()` (sequential/random) + `changePhotoPerSong()` ĐÃ BỎ: 2 lựa
    // chọn đó đã thành `nextOrder` (3 giá trị) + `listPlaybackMode` ở PANEL CHA "Visual Background"
    // (event/workflow/visual-bg.js), dùng chung cho cả nhánh ảnh lẫn video.

    /** SỬA (18/07/2026, phản hồi Giang — "setting chọn thời gian mở modal picker y như cách
     * subtitles làm") — THAY HẲN input số cũ (<input type="number">, đọc .value trực tiếp qua
     * changeInterval()) bằng modal "bánh xe cuộn số" DÙNG CHUNG (core/time-picker-modal.js).
     * `format: 's'` — CHỈ 1 cột giây, KHÔNG giới hạn modulo 60 (đơn vị THÔ NHẤT/DUY NHẤT trong
     * format), hiển thị thẳng giá trị thật 5-60 (đúng yêu cầu Giang: "hiển thị chỉ có mỗi s ví dụ
     * 5, 60, 120"). `minMs`/`maxMs` = 5000/60000 — KHỚP ĐÚNG SLIDESHOW_KENBURNS_MIN_TIME_MS/
     * MAX_TIME_MS (core/file-manager/slideshow.js) — 2 nơi PHẢI khớp nhau (Ken Burns time-scaling
     * tính theo ĐÚNG biên interval này).
     * Xác nhận -> persist + reschedule task (GIỮ NGUYÊN logic cũ của changeInterval(), chỉ đổi
     * NƠI giá trị `seconds` đến từ đâu — trước đọc thẳng input.value, giờ từ callback modal). */
    /** Ứng với nút "Thời gian mỗi ảnh" — mở modal chọn thời gian DÙNG CHUNG (core/time-picker-
     * modal.js), format 's', min 5s/max 60s.
     * SỬA (18/07/2026, phản hồi Giang — phát hiện bug: "chỉnh Seconds per photo xuống THẤP HƠN
     * transition đã đặt trước đó -> ô transition vẫn hiện giá trị CŨ, không tự hạ theo") — sau khi
     * persist `intervalSeconds` mới, TỰ KIỂM TRA + KẸP `transitionDurationMs` XUỐNG nếu đang VƯỢT
     * interval mới — tái dùng NGUYÊN `capSlideshowTransitionDurationMs()` (core, Math.min thuần) đã
     * có sẵn cho runtime, KHÔNG viết lại logic (Rule 3c — không trùng lặp core đã tồn tại). CHỈ
     * kẹp XUỐNG (không bao giờ đẩy LÊN) — tăng interval lại KHÔNG tự phục hồi transition về giá
     * trị cũ (không có "giá trị đúng" nào để phục hồi về, người dùng tự chỉnh lại nếu muốn dài hơn).
     * KHÔNG cần `event/virtual-machine-state.js` — đây là 1 luồng ĐƠN TUYẾN (interval đổi -> LUÔN
     * kiểm tra transition), không phải rẽ nhánh chọn giữa ≥2 workflow khác nhau tuỳ state (đúng
     * phạm vi VirtualMachineState) — nằm gọn trong 1 callback Workflow, đủ đơn giản không cần thêm
     * tầng nào khác. */
    openIntervalPicker() {
        if (!slideshowSettingsPanelEl) return;
        const cfg = appConfigVisualBg.getAll().slideshow;
        openTimePickerModal({ // core/time-picker-modal.js
            title: t('slideshowSettingsDrawer.interval.pickerTitle'),
            format: 's',
            valueMs: cfg.intervalSeconds * 1000,
            minMs: 5000,
            maxMs: 60000,
            onConfirm: async (resultMs) => {
                const v = Math.max(5, Math.round(resultMs / 1000));
                const newIntervalMs = v * 1000;
                let correctedTransitionMs = null; // MỚI — null = không cần sửa gì, có giá trị = ĐÃ bị kẹp xuống
                await workflowVisualBg.mutateSlideshowSetting((ss) => {
                    ss.intervalSeconds = v;
                    const cappedMs = capSlideshowTransitionDurationMs(ss.transitionDurationMs, newIntervalMs); // core — tái dùng NGUYÊN hàm đã có
                    if (cappedMs !== ss.transitionDurationMs) { ss.transitionDurationMs = cappedMs; correctedTransitionMs = cappedMs; }
                }, `intervalSeconds=${v}`);
                if (!slideshowSettingsPanelEl) return;
                const intervalBtn = slideshowSettingsPanelEl.querySelector('#setting-slideshow-interval');
                if (intervalBtn) intervalBtn.textContent = `${v}s`; // đồng bộ lại chữ trên nút
                // MỚI — nếu transitionDurationMs vừa bị kẹp xuống, đồng bộ LẠI nút + nhãn tỉ lệ
                // (phụ thuộc transitionDurationMs) — KHÔNG thì 2 chỗ này hiện SAI (giá trị cũ đã
                // không còn đúng nữa, đúng bug Giang phát hiện).
                if (correctedTransitionMs !== null) {
                    const transitionBtn = slideshowSettingsPanelEl.querySelector('#setting-slideshow-transition-duration');
                    if (transitionBtn) transitionBtn.textContent = `${(correctedTransitionMs / 1000).toFixed(1)}s`;
                    const ratioSlider = slideshowSettingsPanelEl.querySelector('#setting-slideshow-transition-ratio');
                    this._updateTransitionRatioLabel(slideshowSettingsPanelEl, ratioSlider ? Number(ratioSlider.value) : appConfigVisualBg.getAll().slideshow.transitionInOutRatio);
                }
                // Loop (task-manager.js) KHÔNG hỗ trợ đổi `time` giữa chừng của task count vô hạn —
                // tự kill + addNew lại với time mới, CÙNG lý do scheduleNextAutoSwitchVisualTimer()
                // làm ở core/auto-switch-visual.js.
                if (appConfigVisualBg.getAll().listAlbumId && taskManager.plan[SLIDESHOW_TASK]) {
                    taskManager.kill(SLIDESHOW_TASK);
                    taskManager.addNew(SLIDESHOW_TASK, { time: this._computeIntervalMs(), exe: () => this._tick(), mode: 'timeout', count: 0 });
                    taskManager.operator(SLIDESHOW_TASK, 'enabled');
                }
            },
        });
    },

    /** Ứng với select "Hiệu ứng chuyển cảnh" (12 kiểu — Ken Burns ĐÃ TÁCH khỏi danh sách này, xem
     * changeKenBurnsEnabled() ngay dưới).
     * @param {string} type
     */
    /** Ứng với select "Hiệu ứng chuyển cảnh" (12 kiểu — Ken Burns ĐÃ TÁCH khỏi danh sách này, xem
     * changeKenBurnsEnabled() ngay dưới).
     * SỬA (18/07/2026, phản hồi Giang — mục "thêm thời gian transition") — thêm ẩn/hiện hàng
     * "Tỉ lệ In/Out" NGAY khi đổi kiểu (KHÔNG chờ mở lại panel) — CÙNG KHUÔN
     * `changeKenBurnsEnabled()` tự toggle `#slideshow-kenburns-mode-row` ngay trong hàm, không gọi
     * cả `refreshDrawerUI()` cho 1 thay đổi nhỏ.
     * @param {string} type
     */
    async changeTransitionType(type) {
        if (!SLIDESHOW_TRANSITION_TYPES.includes(type)) return; // guard: giá trị lạ -> bỏ qua
        await workflowVisualBg.mutateSlideshowSetting((ss) => { ss.transitionType = type; }, `transitionType=${type}`); // event/workflow/visual-bg.js
        setSlideshowTransitionType(slideshowContainer, type); // core — áp ngay cho lần chuyển cảnh kế tiếp
        if (slideshowSettingsPanelEl) {
            const ratioRow = slideshowSettingsPanelEl.querySelector('#slideshow-transition-ratio-row');
            if (ratioRow) ratioRow.classList.toggle('hidden', !transitionSupportsInOutRatio(type)); // core
        }
    },

    /** MỚI (18/07/2026, phản hồi Giang — "thêm thời gian transition giữa 2 ảnh") — ứng với nút
     * "Thời gian chuyển cảnh" — mở modal chọn thời gian DÙNG CHUNG (core/time-picker-modal.js).
     * `format: 's-ms'` (giây + phần mười giây — giữ độ chính xác dưới giây). Min 1s (Giang chốt,
     * SLIDESHOW_TRANSITION_MIN_TIME_MS, core).
     * SỬA (18/07/2026, phản hồi Giang — phát hiện bug: "phải bị max theo seconds chứ, không thể
     * quay hơn, nhưng hiện tại có thể chọn lớn hơn") — Max KHÔNG còn cố định 60s nữa: transition
     * KHÔNG BAO GIỜ nên dài hơn chính thời gian ảnh sẽ hiển thị (nếu không, y hệt bug "chuyển cảnh
     * bị cắt ngang lượt kế tiếp" đã lường trước — capSlideshowTransitionDurationMs() ở `_tick()`
     * VẪN giữ làm lưới an toàn RUNTIME, nhưng để tránh cho phép CHỌN 1 giá trị vô nghĩa ngay từ đầu,
     * modal picker giờ tự kẹp Max = MIN(60s, thời gian ảnh hiển thị hiện tại —
     * `_computeIntervalMs()`).
     * SỬA LẦN 2 (21/07/2026, Giang chốt: "max input transition phải LUÔN nhỏ hơn seconds per photo
     * tối thiểu 1 đơn vị giây" — vd interval=5s thì max=4s, KHÔNG được bằng nhau) — trừ thêm 1000ms
     * khỏi `_computeIntervalMs()` TRƯỚC khi kẹp [MIN,MAX] — CÙNG công thức
     * `capSlideshowTransitionDurationMs()` (core, dùng lại y hệt logic, không viết trùng — Rule 3c).
     * Kẹp thêm 1 lớp an toàn `Math.max(MIN_TIME_MS, ...)` phòng trường hợp hiếm ảnh hiển thị CÒN LẠI
     * dưới 2s (photoPerSong, bài hát sắp hết) khiến max tính ra nhỏ hơn cả min — tránh modal nhận
     * biên [min,max] đảo ngược.
     * Xác nhận -> persist + đồng bộ nhãn nút + đồng bộ LẠI nhãn "Tỉ lệ In/Out" (phụ thuộc TỔNG
     * thời gian vừa đổi, xem `_updateTransitionRatioLabel()`). */
    openTransitionDurationPicker() {
        if (!slideshowSettingsPanelEl) return;
        const cfg = appConfigVisualBg.getAll().slideshow;
        const maxMs = Math.max(SLIDESHOW_TRANSITION_MIN_TIME_MS, Math.min(SLIDESHOW_TRANSITION_MAX_TIME_MS, this._computeIntervalMs() - 1000));
        openTimePickerModal({ // core/time-picker-modal.js
            title: t('slideshowSettingsDrawer.transitionDuration.pickerTitle'),
            format: 's-ms',
            valueMs: Math.min(cfg.transitionDurationMs, maxMs), // kẹp vị trí cuộn ban đầu luôn, tránh mở lên vượt max mới
            minMs: SLIDESHOW_TRANSITION_MIN_TIME_MS, // core
            maxMs, // ĐỘNG theo thời gian ảnh hiển thị hiện tại — KHÔNG còn cố định 60s
            onConfirm: async (resultMs) => {
                const v = Math.max(SLIDESHOW_TRANSITION_MIN_TIME_MS, Math.min(maxMs, resultMs));
                await workflowVisualBg.mutateSlideshowSetting((ss) => { ss.transitionDurationMs = v; }, `transitionDurationMs=${v}`);
                if (!slideshowSettingsPanelEl) return;
                const btn = slideshowSettingsPanelEl.querySelector('#setting-slideshow-transition-duration');
                if (btn) btn.textContent = `${(v / 1000).toFixed(1)}s`;
                const ratioSlider = slideshowSettingsPanelEl.querySelector('#setting-slideshow-transition-ratio');
                this._updateTransitionRatioLabel(slideshowSettingsPanelEl, ratioSlider ? Number(ratioSlider.value) : v);
            },
        });
    },

    /** Cập nhật nhãn "In Xs / Out Ys" hiển thị cạnh slider Tỉ lệ In/Out — đọc `transitionDurationMs`
     * hiện tại từ appState + `ratioPercent` truyền vào (KHÔNG đọc lại từ DOM slider — nơi gọi tự
     * quyết định dùng giá trị nào, xem 2 nơi gọi hàm này).
     * @param {HTMLElement} panelEl
     * @param {number} ratioPercent
     */
    _updateTransitionRatioLabel(panelEl, ratioPercent) {
        const labelEl = panelEl ? panelEl.querySelector('#slideshow-transition-ratio-label') : null;
        if (!labelEl) return;
        const cfg = appConfigVisualBg.getAll().slideshow;
        const { inMs, outMs } = computeSlideshowTransitionInOutMs(cfg.transitionDurationMs, ratioPercent); // core
        labelEl.textContent = tFormat('slideshowSettingsDrawer.transitionRatio.previewFormat', { in: (inMs / 1000).toFixed(1), out: (outMs / 1000).toFixed(1) });
    },

    /** Ứng với sự kiện 'input' (LIVE, đang kéo thả) trên slider Tỉ lệ In/Out — CHỈ cập nhật nhãn
     * hiển thị ngay lúc kéo, KHÔNG persist (persist thật ở `changeTransitionRatio()`, bắn lúc
     * 'change' — thả tay ra mới lưu, tránh ghi IndexedDB liên tục mỗi pixel kéo).
     * @param {number} ratioPercent
     */
    previewTransitionRatio(ratioPercent) {
        if (!slideshowSettingsPanelEl) return;
        this._updateTransitionRatioLabel(slideshowSettingsPanelEl, ratioPercent);
    },

    /** Ứng với sự kiện 'change' (thả tay) trên slider Tỉ lệ In/Out — persist + đồng bộ nhãn (khớp
     * giá trị đã kẹp, nếu có).
     * @param {number} ratioPercent
     */
    async changeTransitionRatio(ratioPercent) {
        const v = Math.max(0, Math.min(100, ratioPercent));
        await workflowVisualBg.mutateSlideshowSetting((ss) => { ss.transitionInOutRatio = v; }, `transitionInOutRatio=${v}`);
        if (slideshowSettingsPanelEl) this._updateTransitionRatioLabel(slideshowSettingsPanelEl, v);
    },

    /** Ứng với select "Easing" — 5 giá trị hợp lệ (SLIDESHOW_TRANSITION_EASINGS, core) — 'linear'
     * = Giang gọi "không easing" (tốc độ đều tăm tắp).
     * @param {string} easing
     */
    async changeTransitionEasing(easing) {
        if (!SLIDESHOW_TRANSITION_EASINGS.includes(easing)) return; // guard: giá trị lạ -> bỏ qua
        await workflowVisualBg.mutateSlideshowSetting((ss) => { ss.transitionEasing = easing; }, `transitionEasing=${easing}`);
    },

    /** MỚI (Ken Burns, 18/07/2026, phản hồi Giang) — ứng với toggle "Ken Burns" (ĐỘC LẬP với
     * transitionType, dùng ĐƯỢC cùng lúc với BẤT KỲ kiểu transition nào). CHỈ persist + đồng bộ
     * state — KHÔNG ép reset/dừng ảnh đang hiện hoạt (Giang chốt: bật/tắt áp dụng từ ẢNH KẾ TIẾP,
     * đúng tiền lệ `changeMode()`/`changeTransitionType()` — không đặc cách riêng cho Ken Burns).
     * Cơ chế tick tự nhiên (`_showFirstImage()`/`_tick()`) tự đọc lại field này mỗi lượt đổi ảnh —
     * TẮT giữa chừng: ảnh đang chạy cứ hiện hết BÌNH THƯỜNG (WAAPI tự giữ trạng thái cuối qua
     * `fill:'forwards'`, không cần task freeze nào cả — xem docstring core), layer outgoing ở lượt
     * `_tick()` kế tiếp tự gọi `stopSlideshowKenBurnsAnimation(outgoingPan, ...)` (code cleanup có
     * sẵn) → tự về gốc, không cần xử lý gì thêm ở đây.
     * SỬA ("Nhóm 2", 18/07/2026) — thêm ẩn/hiện hàng <select> chế độ, CÙNG KHUÔN
     * `changePhotoPerSong()` tự toggle `#slideshow-interval-row` ngay trong hàm (không gọi cả
     * `refreshDrawerUI()` cho 1 thay đổi nhỏ).
     * @param {boolean} checked
     */
    async changeKenBurnsEnabled(checked) {
        await workflowVisualBg.mutateSlideshowSetting((ss) => { ss.kenBurnsEnabled = checked; }, `kenBurnsEnabled=${checked}`);
        if (slideshowSettingsPanelEl) {
            const kenBurnsModeRow = slideshowSettingsPanelEl.querySelector('#slideshow-kenburns-mode-row');
            if (kenBurnsModeRow) kenBurnsModeRow.classList.toggle('hidden', !checked);
        }
    },

    /** MỚI ("Nhóm 2", 18/07/2026, phản hồi Giang) — ứng với <select> "Kiểu Ken Burns" (13 chế độ,
     * THAY HẲN "Nhóm 1" — 8 biến thể random tự động, không chọn được). CHỈ persist — cơ chế tick
     * tự nhiên tự đọc lại field này mỗi lượt kích hoạt Ken Burns (`_activateKenBurns()`), áp dụng
     * từ ẢNH KẾ TIẾP như mọi field khác trong slideshowConfig.
     * @param {string} mode - 1 trong SLIDESHOW_KENBURNS_MODES.
     */
    async changeKenBurnsMode(mode) {
        if (!SLIDESHOW_KENBURNS_MODES.includes(mode)) return; // guard: giá trị lạ -> bỏ qua
        await workflowVisualBg.mutateSlideshowSetting((ss) => { ss.kenBurnsMode = mode; }, `kenBurnsMode=${mode}`);
    },
};
