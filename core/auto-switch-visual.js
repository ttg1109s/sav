/**
 * Tự động đổi hiệu ứng Visualizer theo thời gian (ver 10).
 *
 * VIẾT LẠI (26/09/2026, Giang) — xem khối "VIẾT LẠI" ngay trên các hàm thuần bên dưới: danh sách group/style
 * kéo thả + checkbox, thời gian 'fixed' (const/random, 10s-1h) | 'perMedia'. Phần mô tả 2 nhánh 'fixed'/'random'
 * + 'duration' (mốc bài hát) ngay dưới là LỊCH SỬ — nhánh 'duration' ĐÃ BỎ, 'random' giờ là kiểu con của 'fixed'.
 *
 * QUAN TRỌNG — 2 KHÁI NIỆM HOÀN TOÀN TÁCH BIỆT, KHÔNG ĐƯỢC GỘP CHUNG:
 *
 *   (A) "Loại hình visual sắp tới là gì" — vizConfig.autoSwitchVisualMode ('sequential' | 'random').
 *       Chỉ quyết định CÁCH CHỌN kiểu kế tiếp, độc lập hoàn toàn với CÁCH TÍNH THỜI GIAN ở (B).
 *
 *   (B) "Tới giây nào thì nhảy sang visual khác" — vizConfig.autoSwitchVisualTimeMode, có 2 NHÁNH
 *       cơ chế khác nhau hẳn (không phải biến thể của nhau):
 *
 *       NHÁNH 1 — 'fixed' (c1) và 'random' (c2): ĐỒNG HỒ ĐỘC LẬP, không quan tâm bài nào đang
 *       phát, không quan tâm currentTime/duration của bài. Chỉ đơn giản: cứ đếm đủ X giây (c1: X
 *       cố định người điền; c2: X random lại mỗi vòng trong [10, X người điền]) là đổi, rồi đếm
 *       lại từ đầu — CHẠY XUYÊN QUA NHIỀU BÀI, không reset/không liên quan gì tới việc đổi bài hay
 *       vị trí cụ thể trong bài. Cơ chế: 1 task qua taskManager, mode 'timeout' (bù trôi), đếm lùi
 *       y hệt kiểu _listenTickHandle (player-controls.js) — pause()/resume() theo đúng audioPlayer
 *       play/pause (nhạc dừng thì đồng hồ phụ này cũng dừng, đúng cảm giác "không tính giờ chết"),
 *       nhưng KHÔNG đụng gì tới currentTime/seek — seek tới/lùi tuỳ ý không ảnh hưởng đồng hồ này.
 *
 *       NHÁNH 2 — 'duration' (c3): DUY NHẤT mode này thực sự gắn với KHUNG THỜI GIAN của bài đang
 *       phát — X người điền là số chia trong công thức (duration / X), hệ thống tự kẹp X không
 *       vượt round(duration/2) để đảm bảo LUÔN có tối thiểu 1 lần đổi xảy ra giữa bài (nếu không
 *       kẹp, X quá lớn so với duration sẽ làm phép chia ra 0 lần đổi — vô nghĩa với 1 tính năng
 *       "tự động đổi"). Vì mode này phụ thuộc TRỰC TIẾP vị trí trong bài, cần xử lý đúng khi người
 *       dùng SEEK (tua) tới/lùi tay: build trước 1 mảng mốc TUYỆT ĐỐI theo giây của bài (không
 *       phải khoảng cách tương đối), mỗi mốc TỰ NHỚ visual của riêng nó — lần đầu đi qua 1 đoạn
 *       mới chọn visual MỚI và ghi nhớ vào mốc đó; mọi lần SAU đó rơi lại đúng đoạn này (kể cả do
 *       tua lùi về) chỉ áp dụng LẠI đúng visual đã nhớ, KHÔNG chọn mới — tua qua tua lại vẫn nhất
 *       quán, không bị "nhảy ngẫu nhiên" mỗi lần đi qua lại 1 chỗ đã từng qua.
 *
 *       CHỈ 1 trong 2 nhánh chạy tại 1 thời điểm, theo đúng vizConfig.autoSwitchVisualTimeMode —
 *       2 task riêng (tên khác nhau trong taskManager), không bao giờ chạy đồng thời.
 *
 * Build lại marks (nhánh 2) khi: đổi bài (loadedmetadata, vì duration mới khác hẳn), hoặc đổi
 * autoSwitchVisualSecondsFixed/Random/Duration (field tương ứng nhánh đang chạy). Reset đồng hồ
 * (nhánh 1) khi: bật tính năng, đổi autoSwitchVisualTimeMode sang 'fixed'/'random', hoặc đổi field
 * giây tương ứng — KHÔNG reset khi đổi bài (đặc điểm cốt
 * lõi của nhánh 1: không quan tâm bài nào đang phát).
 *
 * PHẢI nạp SAU: core/config.js (AUTO_SWITCH_VISUAL_MIN_SECONDS, MODES), core/dom-refs.js
 * (currentModeIndex, audioPlayer), service/task-manager.js (taskManager), core/equalizer-settings.js
 * (saveConfig), core/visualizer/visualizer-display.js (updateTypeUI — ver 11: hàm này đã dời từ
 * player-controls.js sang đây, xem comment đầu file đó) — xem index.html.
 *
 * === Batch D3 (Settings restructure, 06/07/2026) ===
 * Panel Visualizer Settings (chứa cả section "Tự động đổi hiệu ứng") giờ PUSH/POP động — 4 hàm
 * `set*`/`syncAutoSwitchTimeModeBlocks()` REFACTOR ĐẦY ĐỦ Rule 1-4 theo CHỐT của Giang (Batch D2):
 * bỏ hẳn `saveConfig()`/`updateCycleModeButtonState()`/`startAutoSwitchVisualBranch()` nội bộ, dời
 * ra `event/workflow/auto-switch-visual.js`. `initAutoSwitchVisualUI()` cũ TÁCH LÀM 2: phần Control
 * Center (`#btn-cycle-mode`, KHÔNG di chuyển) đổi tên `initAutoSwitchCycleButtonFromConfig()`, vẫn
 * gọi từ loadConfig(); phần đồng bộ panel (7 field) dời sang
 * `workflowVisualizerDisplay.openPanel()` (core/visualizer/visualizer-display.js đảm nhiệm push
 * panel, sync CẢ 2 section trong CÙNG 1 panel — xem file đó).
 */
        // [SỬA — 25/09/2026, dọn nợ task-manager-conventions.md mục 6, làm cùng đợt "ẩn tab/PWA dừng render"] Toàn bộ
        // phần ĐIỀU PHỐI (taskManager, đọc appState, start/stop/pause/resume nhánh, áp visual + lưu config) ĐÃ DỜI sang
        // event/workflow/auto-switch-visual.js (workflowAutoSwitchVisual) theo đúng mẫu mục 5 của tài liệu đó. File này
        // giờ CHỈ còn hàm THUẦN (nhận tham số, trả kết quả — Rule 1-3). Hằng tên task AUTO_SWITCH_VISUAL_TASK_TIMER/
        // _MARKS dời theo. Đã XOÁ khỏi đây: applyAutoSwitchVisualType, scheduleNextAutoSwitchVisualTimer,
        // autoSwitchVisualMarksTick, killAllAutoSwitchVisualTasks, startAutoSwitchVisualBranch,
        // onAutoSwitchVisualSongChanged, syncAutoSwitchVisualPlayState (bản Workflow tương ứng: _applyType, _scheduleNextTimer,
        // _marksTick, killAllTasks, startBranch, onSongChanged, syncPlayState). Giải thích cơ chế 2 nhánh ở đầu file VẪN ĐÚNG.

        // ===================== VIẾT LẠI (26/09/2026, Giang "cải tiến lại Auto-Switch Effect") =====================
        // Danh sách chạy theo GROUP hoặc STYLE (vizConfig.autoSwitchVisualListBy), mỗi danh sách có thứ tự RIÊNG do
        // người dùng kéo thả + checkbox tham gia; group còn chọn 1 style cụ thể hoặc 'random' trong group. Cách chọn
        // kế tiếp (autoSwitchVisualMode) = 'sequential' (theo thứ tự danh sách) | 'random' (trong các mục đã tick).
        // Thời gian: 'fixed' (const | random [min,max], 10s-1h, time picker) | 'perMedia' (mỗi song/video/photo
        // mới). Mode cũ 'duration' (chia độ dài bài) + mảng mốc ĐÃ BỎ (config cũ migrate sang 'perMedia').
        // Mọi hàm dưới đây THUẦN (nhận tham số, trả kết quả) hoặc chỉ mutate appConfigViz (setter) — Rule 1-3.

        /** Chuẩn hoá danh sách GROUP đã lưu theo EFFECT_GROUPS hiện tại: giữ thứ tự mục còn hợp lệ, bỏ group
         * không còn tồn tại, thêm group mới vào CUỐI (tick sẵn, style 'random'); style không thuộc group -> 'random'.
         * @param {Array<{key:string, enabled:boolean, style:string}>} list @param {Object<string,string[]>} effectGroups
         * @returns {Array<{key:string, enabled:boolean, style:string}>} mảng MỚI */
        function normalizeAutoSwitchGroupList(list, effectGroups) {
            const out = [];
            const seen = {};
            (Array.isArray(list) ? list : []).forEach((item) => {
                if (!item || !effectGroups[item.key] || seen[item.key]) return;
                seen[item.key] = true;
                const style = effectGroups[item.key].includes(item.style) ? item.style : 'random';
                out.push({ key: item.key, enabled: item.enabled !== false, style });
            });
            Object.keys(effectGroups).forEach((key) => { if (!seen[key]) out.push({ key, enabled: true, style: 'random' }); });
            return out;
        }

        /** Chuẩn hoá danh sách STYLE đã lưu theo MODES hiện tại (cùng luật normalizeAutoSwitchGroupList()).
         * @param {Array<{key:string, enabled:boolean}>} list @param {string[]} allStyles - MODES @returns {Array} mảng MỚI */
        function normalizeAutoSwitchStyleList(list, allStyles) {
            const out = [];
            const seen = {};
            (Array.isArray(list) ? list : []).forEach((item) => {
                if (!item || !allStyles.includes(item.key) || seen[item.key]) return;
                seen[item.key] = true;
                out.push({ key: item.key, enabled: item.enabled !== false });
            });
            allStyles.forEach((key) => { if (!seen[key]) out.push({ key, enabled: true }); });
            return out;
        }

        /** Style kế tiếp theo danh sách STYLE. Chỉ xét mục đã tick; 'sequential' = mục ngay sau style đang chạy
         * (style đang chạy không nằm trong danh sách tick -> mục đầu); 'random' = ngẫu nhiên, khác style đang chạy
         * nếu có ≥2 mục. Không mục nào tick -> null (không đổi).
         * @param {Array<{key,enabled}>} styleList @param {'sequential'|'random'} selectMode @param {string} currentStyle
         * @returns {string|null} */
        function pickNextAutoSwitchStyleFromStyleList(styleList, selectMode, currentStyle) {
            const candidates = styleList.filter((item) => item.enabled).map((item) => item.key);
            if (candidates.length === 0) return null;
            const pos = candidates.indexOf(currentStyle);
            if (selectMode === 'random') {
                const pool = candidates.length > 1 ? candidates.filter((k) => k !== currentStyle) : candidates;
                return pool[Math.floor(Math.random() * pool.length)];
            }
            return candidates[(pos + 1) % candidates.length]; // pos -1 -> mục đầu
        }

        /** Style kế tiếp theo danh sách GROUP: chọn group kế (cùng luật sequential/random như danh sách style, so
         * với group của style đang chạy), rồi lấy style cố định của mục đó, hoặc 'random' = ngẫu nhiên trong group
         * (ưu tiên khác style đang chạy). Không mục nào tick -> null.
         * @param {Array<{key,enabled,style}>} groupList @param {'sequential'|'random'} selectMode @param {string} currentStyle
         * @param {Object<string,string>} styleToGroup @param {Object<string,string[]>} effectGroups @returns {string|null} */
        function pickNextAutoSwitchStyleFromGroupList(groupList, selectMode, currentStyle, styleToGroup, effectGroups) {
            const candidates = groupList.filter((item) => item.enabled);
            if (candidates.length === 0) return null;
            const currentGroup = styleToGroup[currentStyle];
            const pos = candidates.findIndex((item) => item.key === currentGroup);
            let next;
            if (selectMode === 'random') {
                const pool = candidates.length > 1 ? candidates.filter((item) => item.key !== currentGroup) : candidates;
                next = pool[Math.floor(Math.random() * pool.length)];
            } else {
                next = candidates[(pos + 1) % candidates.length];
            }
            if (next.style !== 'random') return next.style;
            const styles = effectGroups[next.key] || [];
            const pool = styles.length > 1 ? styles.filter((k) => k !== currentStyle) : styles;
            return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
        }

        /** Nhánh 'fixed' — số ms cho LẦN ĐẾM KẾ TIẾP: 'const' = autoSwitchVisualSecondsFixed; 'random' = ngẫu
         * nhiên LẠI mỗi vòng trong [autoSwitchVisualSecondsRandomMin, autoSwitchVisualSecondsRandom]. Luôn kẹp
         * [AUTO_SWITCH_VISUAL_MIN_SECONDS, AUTO_SWITCH_VISUAL_MAX_SECONDS].
         * @param {object} cfg - appConfigViz.getAll(). @returns {number} */
        function computeAutoSwitchVisualTimerDelayMs(cfg) {
            const clamp = (v) => Math.max(AUTO_SWITCH_VISUAL_MIN_SECONDS, Math.min(AUTO_SWITCH_VISUAL_MAX_SECONDS, Number(v) || AUTO_SWITCH_VISUAL_MIN_SECONDS));
            if (cfg.autoSwitchVisualFixedKind === 'random') {
                const lo = clamp(cfg.autoSwitchVisualSecondsRandomMin);
                const hi = Math.max(lo, clamp(cfg.autoSwitchVisualSecondsRandom));
                return (lo + Math.random() * (hi - lo)) * 1000;
            }
            return clamp(cfg.autoSwitchVisualSecondsFixed) * 1000;
        }

        // ===================== UI binding (Settings, section "Tự động đổi hiệu ứng") =====================

        /**
         * Đồng bộ trạng thái khoá/mở của nút "Đổi hiệu ứng" (#btn-cycle-mode, Control Center màn
         * Visualizer) theo ĐÚNG vizConfig.autoSwitchVisualEnabled hiện tại.
         *
         * YÊU CẦU MỚI: khi tự động đổi hiệu ứng đang BẬT, nút này phải vô hiệu HOÀN TOÀN — không
         * bấm được, bấm cũng không có tác dụng — tránh xung đột giữa đổi tự động (theo giờ) và
         * đổi tay (theo ý người dùng) cùng lúc. Trước đây nút luôn hoạt động bất kể auto-switch
         * đang bật hay tắt, đây CHÍNH là hành vi gây xung đột cần sửa.
         *
         * Đặt thuộc tính HTML `disabled` THẬT (không chỉ class CSS mờ) — input/button có
         * `disabled` tự động không nhận click/focus/keyboard ở tầng trình duyệt, là lớp chặn đáng
         * tin cậy nhất. player-controls.js (btnCycleMode click listener) vẫn tự kiểm tra thêm
         * `vizConfig.autoSwitchVisualEnabled` làm lớp chặn THỨ HAI — phòng trường hợp nút bị gọi
         * `.click()` bằng JS từ nơi khác (lúc đó thuộc tính `disabled` không chặn được vì đó chỉ
         * chặn tương tác CHUỘT/BÀN PHÍM THẬT của người dùng, không chặn gọi hàm JS trực tiếp).
         *
         * Gọi hàm này ở MỌI nơi autoSwitchVisualEnabled có thể thay đổi: đồng bộ UI lúc
         * initAutoSwitchVisualUI() chạy (kể cả mỗi lần loadConfig() — đảm bảo đúng trạng thái
         * ngay từ lúc mở app, không cần đợi người dùng vào Settings trước), và lúc listener
         * 'change' của toggle bật/tắt chạy.
         */
        function updateCycleModeButtonState() {
            // SỬA (26/09/2026, Giang "Auto-Switch On -> block CHỌN effect ở icon center") — KHÔNG còn `disabled`
            // cả nút: `disabled` chặn luôn GIỮ 1.5s (mở Custom Effect Drawer), không đúng ý chỉ chặn việc CHỌN
            // effect. Giờ chỉ làm mờ để báo trạng thái; CLICK bị chặn ở workflowCustomEffect.onCycleModeClick()
            // (hiện thông báo), GIỮ vẫn mở Custom Effect Drawer như thường.
            if (typeof btnCycleMode === 'undefined' || !btnCycleMode) return;
            const locked = appConfigViz.getAll().autoSwitchVisualEnabled === true;
            btnCycleMode.disabled = false;
            btnCycleMode.classList.toggle('opacity-50', locked);
            btnCycleMode.classList.remove('opacity-40', 'cursor-not-allowed');
        }

        /**
         * FIX BUG (19/07/2026, yêu cầu Giang — mục 5) — khi "Tự động đổi hiệu ứng" đang BẬT, select
         * "Kiểu hiệu ứng" (#setting-visualizer-type, Settings chính) VẪN chọn tay được, dù nút cycle
         * (#btn-cycle-mode, Control Center) đã bị khoá đúng — 2 đường CÙNG đổi visual tay nhưng chỉ
         * 1 đường được khoá, người dùng vẫn lách qua được bằng select. Khoá CẢ 2 nơi, CÙNG lý do và
         * CÙNG cách làm như updateCycleModeButtonState() ngay trên (thuộc tính `disabled` HTML thật,
         * không chỉ CSS mờ) — gọi hàm này ở ĐÚNG những chỗ đã gọi updateCycleModeButtonState().
         * Truy vấn TƯƠI (không dom-refs tĩnh) dù select này thực ra tĩnh từ lúc boot — chỉ để nhất
         * quán với các hàm truy vấn tươi khác trong file này.
         */
        function updateVisualizerTypeSelectState() {
            const selectEl = document.getElementById('setting-visualizer-type');
            if (!selectEl) return;
            const locked = appConfigViz.getAll().autoSwitchVisualEnabled === true;
            selectEl.disabled = locked;
            selectEl.classList.toggle('opacity-40', locked);
            selectEl.classList.toggle('cursor-not-allowed', locked);
        }


        /**
         * Đồng bộ boot-time PHẦN KHÔNG PHỤ THUỘC PANEL — nút cycle Control Center (#btn-cycle-mode)
         * theo `autoSwitchVisualEnabled` đã lưu. Batch D3 — ĐỔI TÊN từ `initAutoSwitchVisualUI()`
         * (hàm cũ gộp cả phần Control Center lẫn phần đồng bộ panel; phần panel giờ tách sang
         * `workflowVisualizerDisplay.openPanel()` vì panel không còn tồn tại lúc boot — gọi hàm cũ
         * lúc boot sẽ luôn no-op do guard `if (!elAutoSwitchEnable...) return` ở đầu, khiến
         * `updateCycleModeButtonState()` KHÔNG BAO GIỜ chạy được lúc boot nữa nếu để nguyên trong
         * cùng 1 hàm — tách riêng để phần Control Center luôn chạy đúng bất kể panel đóng/mở).
         * Gọi từ loadConfig() (core/config.js) qua guard `typeof === 'function'`.
         */
        function initAutoSwitchCycleButtonFromConfig() {
            updateCycleModeButtonState();
            updateVisualizerTypeSelectState(); // FIX BUG 19/07/2026 (mục 5) — xem docstring hàm này ở trên
        }

        /** Core thuần: toggle bật/tắt. SỬA (26/09/2026) — các tuỳ chọn LUÔN hiện (Giang), không còn ẩn/hiện khối. */
        function setAutoSwitchVisualEnabled(checked) {
            appConfigViz.mutateAll(cfg => { cfg.autoSwitchVisualEnabled = checked; });
        }

        /** Core thuần: cách chọn kế tiếp 'sequential' | 'random' (chạy trong danh sách). */
        function setAutoSwitchVisualMode(value) {
            appConfigViz.mutateAll(cfg => { cfg.autoSwitchVisualMode = value === 'random' ? 'random' : 'sequential'; });
        }

        /** Core thuần: nhánh thời gian 'fixed' | 'perMedia'. */
        function setAutoSwitchVisualTimeMode(value) {
            appConfigViz.mutateAll(cfg => { cfg.autoSwitchVisualTimeMode = value === 'perMedia' ? 'perMedia' : 'fixed'; });
        }

        /** Core thuần: kiểu của nhánh 'fixed' — 'const' | 'random'. MỚI 26/09/2026. */
        function setAutoSwitchVisualFixedKind(value) {
            appConfigViz.mutateAll(cfg => { cfg.autoSwitchVisualFixedKind = value === 'random' ? 'random' : 'const'; });
        }

        /** Core thuần: danh sách chạy theo 'group' | 'style'. MỚI 26/09/2026. */
        function setAutoSwitchVisualListBy(value) {
            appConfigViz.mutateAll(cfg => { cfg.autoSwitchVisualListBy = value === 'group' ? 'group' : 'style'; });
        }

        /** Core thuần: tick/bỏ tick 1 mục. @param {'group'|'style'} listBy @param {string} key @param {boolean} checked */
        function setAutoSwitchVisualItemEnabled(listBy, key, checked) {
            const field = listBy === 'group' ? 'autoSwitchVisualGroupList' : 'autoSwitchVisualStyleList';
            appConfigViz.mutateAll(cfg => {
                cfg[field] = (cfg[field] || []).map((item) => (item.key === key ? { ...item, enabled: !!checked } : item));
            });
        }

        /** Core thuần: style chạy cho 1 group ('random' hoặc 1 style của group đó). */
        function setAutoSwitchVisualGroupStyle(groupKey, style) {
            appConfigViz.mutateAll(cfg => {
                cfg.autoSwitchVisualGroupList = (cfg.autoSwitchVisualGroupList || []).map((item) => (item.key === groupKey ? { ...item, style } : item));
            });
        }

        /** Core thuần: kéo thả — dời mục `fromKey` tới ĐÚNG vị trí của mục `toKey` (các mục giữa dồn lên/xuống). */
        function moveAutoSwitchVisualItem(listBy, fromKey, toKey) {
            const field = listBy === 'group' ? 'autoSwitchVisualGroupList' : 'autoSwitchVisualStyleList';
            appConfigViz.mutateAll(cfg => {
                const list = (cfg[field] || []).slice();
                const from = list.findIndex((item) => item.key === fromKey);
                const to = list.findIndex((item) => item.key === toKey);
                if (from === -1 || to === -1 || from === to) return;
                const [moved] = list.splice(from, 1);
                list.splice(to, 0, moved);
                cfg[field] = list;
            });
        }

        /** Core thuần: ghi 1 trong 3 field thời gian (giây) từ time picker (ms), kẹp [10s, 1h]. Khoảng random luôn
         * giữ min <= max: đặt min vượt max -> kéo max lên theo; đặt max dưới min -> kéo min xuống theo.
         * @param {'autoSwitchVisualSecondsFixed'|'autoSwitchVisualSecondsRandomMin'|'autoSwitchVisualSecondsRandom'} fieldName
         * @param {number} valueMs */
        function setAutoSwitchVisualSeconds(fieldName, valueMs) {
            const v = Math.max(AUTO_SWITCH_VISUAL_MIN_SECONDS, Math.min(AUTO_SWITCH_VISUAL_MAX_SECONDS, Math.round(valueMs / 1000)));
            appConfigViz.mutateAll(cfg => {
                cfg[fieldName] = v;
                if (fieldName === 'autoSwitchVisualSecondsRandomMin' && cfg.autoSwitchVisualSecondsRandom < v) cfg.autoSwitchVisualSecondsRandom = v;
                if (fieldName === 'autoSwitchVisualSecondsRandom' && cfg.autoSwitchVisualSecondsRandomMin > v) cfg.autoSwitchVisualSecondsRandomMin = v;
            });
        }

        // ===================== Liên kết với trạng thái phát nhạc =====================
        // SỬA 25/09/2026 — play/pause/loadedmetadata của audioPlayer giờ đi Router -> event/workflow/player-controls.js
        // (handleAudioPlayEvent/handleAudioPauseEvent/handleAudioLoadedMetadataEvent) -> workflowAutoSwitchVisual.
        // syncPlayState()/onSongChanged(); core/player-controls.js KHÔNG còn gọi vào đây nữa.
