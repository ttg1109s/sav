/**
 * core/auto-switch-visual.js — Tự động đổi hiệu ứng Visualizer: hàm THUẦN (nhận tham số, trả kết quả — Rule 1-3) +
 * setter chỉ mutate appConfigViz + 2 hàm đồng bộ trạng thái khoá của nút/ select đổi hiệu ứng tay. Phần ĐIỀU PHỐI
 * (taskManager, đọc appState, start/stop/pause/resume, áp visual + lưu config, phiên kéo thả) nằm ở
 * event/workflow/auto-switch-visual.js (workflowAutoSwitchVisual).
 *
 * 2 KHÁI NIỆM TÁCH BIỆT, KHÔNG GỘP CHUNG:
 *   (A) "Visual kế tiếp là gì": danh sách chạy theo GROUP hoặc STYLE (vizConfig.autoSwitchVisualListBy), mỗi danh sách
 *       có thứ tự RIÊNG do người dùng kéo thả + checkbox tham gia; group còn chọn 1 style cụ thể hoặc 'random' trong
 *       group. Cách chọn (vizConfig.autoSwitchVisualMode) = 'sequential' (theo thứ tự) | 'random' (trong các mục đã tick).
 *   (B) "Khi nào đổi" (vizConfig.autoSwitchVisualTimeMode):
 *       - 'fixed': ĐỒNG HỒ ĐỘC LẬP — 'const' (đủ X giây) | 'random' (X random lại mỗi vòng trong [min, max]), kẹp
 *         10s-1h; chạy xuyên qua nhiều media, KHÔNG reset khi đổi media; dừng khi media pause/app ẩn, không quan tâm
 *         currentTime/seek.
 *       - 'perMedia': đổi mỗi khi 1 media MỚI (song/video/photo) bắt đầu, không có đồng hồ.
 *
 * PHẢI nạp SAU: core/config.js (AUTO_SWITCH_VISUAL_MIN/MAX_SECONDS, MODES), core/dom-refs.js (btnCycleMode).
 */
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

        // ===================== Khoá đổi hiệu ứng tay khi Auto-Switch bật =====================

        /**
         * Nút "Đổi hiệu ứng" (#btn-cycle-mode, Control Center) theo vizConfig.autoSwitchVisualEnabled: Auto-Switch BẬT thì
         * chặn việc CHỌN effect tay (tránh xung đột với đổi tự động). KHÔNG đặt `disabled` (sẽ chặn luôn GIỮ 1.5s mở Custom
         * Effect Drawer) — chỉ làm mờ để báo trạng thái; CLICK bị chặn ở workflowCustomEffect.onCycleModeClick() (hiện
         * thông báo). Gọi lúc boot (initAutoSwitchCycleButtonFromConfig()) và mỗi lần bật/tắt Auto-Switch.
         */
        function updateCycleModeButtonState() {
            if (typeof btnCycleMode === 'undefined' || !btnCycleMode) return;
            const locked = appConfigViz.getAll().autoSwitchVisualEnabled === true;
            btnCycleMode.disabled = false;
            btnCycleMode.classList.toggle('opacity-50', locked);
            btnCycleMode.classList.remove('opacity-40', 'cursor-not-allowed');
        }

        /**
         * Select "Kiểu hiệu ứng" (#setting-visualizer-type) — đường đổi visual tay thứ 2: Auto-Switch BẬT thì khoá bằng
         * thuộc tính `disabled` thật + làm mờ. Gọi ở ĐÚNG những chỗ gọi updateCycleModeButtonState(). Truy vấn tươi (phần
         * tử có thể không tồn tại -> bỏ qua).
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
         * Đồng bộ boot-time trạng thái khoá đổi hiệu ứng tay theo `autoSwitchVisualEnabled` đã lưu (không phụ thuộc panel
         * Settings có đang mở hay không). Gọi từ loadConfig() (core/config.js) qua guard `typeof === 'function'`.
         */
        function initAutoSwitchCycleButtonFromConfig() {
            updateCycleModeButtonState();
            updateVisualizerTypeSelectState();
        }

        /** Core thuần: toggle bật/tắt (các tuỳ chọn trong panel luôn hiện). */
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

        /** Core thuần: kiểu của nhánh 'fixed' — 'const' | 'random'. */
        function setAutoSwitchVisualFixedKind(value) {
            appConfigViz.mutateAll(cfg => { cfg.autoSwitchVisualFixedKind = value === 'random' ? 'random' : 'const'; });
        }

        /** Core thuần: danh sách chạy theo 'group' | 'style'. */
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

        // ===================== Liên kết với trạng thái phát media =====================

        /** Việc cần làm với đồng hồ nhánh 'fixed' khi media
         * play/pause hoặc app vào/ra nền: 'off' (tính năng tắt / không có media / không phải nhánh 'fixed' -> dọn task),
         * 'start' (chưa từng có task -> bắt đầu), 'resume' / 'pause' (theo điều kiện được chạy). Hàm thuần, Workflow
         * tự đọc 3 giá trị đầu vào rồi rẽ bằng VirtualMachineState. */
        function resolveAutoSwitchSyncPhase(isFixedActive, hasTimerTask, isRunAllowed) {
            if (!isFixedActive) return 'off';
            if (!hasTimerTask) return 'start';
            return isRunAllowed ? 'resume' : 'pause';
        }


        // ===================== Kéo thả danh sách item =====================
        // Phép tính của phiên kéo; Workflow giữ phiên (workflowAutoSwitchVisual.startItemDrag()/moveItemDrag()/
        // endItemDrag()/cancelItemDrag()), DOM qua core/auto-switch-visual-ui.js.

        /** Core thuần: vị trí hàng có `data-as-row` = `key` trong danh sách khoá hàng (theo thứ tự DOM). -1 = không có.
         * @param {string[]} rowKeys @param {string} key @returns {number} */
        function findAutoSwitchRowIndexByKey(rowKeys, key) {
            return rowKeys.indexOf(key);
        }

        /** Core thuần: hàng đang nằm dưới `clientY` để làm đích thả — bỏ qua chính hàng đang kéo (`dragIndex`). -1 = không có.
         * @param {Array<{top:number,bottom:number}>} rects @param {number} clientY @param {number} dragIndex @returns {number} */
        function findAutoSwitchDropRowIndex(rects, clientY, dragIndex) {
            return rects.findIndex((rect, i) => i !== dragIndex && clientY >= rect.top && clientY <= rect.bottom);
        }

        /** Core thuần: CSS transform của hàng đang kéo — bám theo con trỏ theo trục dọc + phóng nhẹ (cảm giác "nhấc lên").
         * @param {number} startY @param {number} clientY @returns {string} */
        function computeAutoSwitchDragTransform(startY, clientY) {
            return `translateY(${clientY - startY}px) scale(1.02)`;
        }
