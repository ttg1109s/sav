/**
 * Subtitle Style Settings — toggle "Hiện phụ đề" + 8 input style (màu nền/viền/chữ, opacity,
 * kích thước, khoảng cách dòng/chữ) trong Settings > "Tùy chỉnh Phụ đề".
 *
 * ĐÃ TÁCH từ core/equalizer-settings.js (cũ, tên file gây nhầm) — đây là cấu hình HIỂN THỊ phụ
 * đề, không liên quan EQ. Gộp chung 1 file vì cùng là "điều khiển hiển thị phụ đề trong Settings"
 * (đã thống nhất, khác `core/subtitle/subtitles.js` — nội dung/sửa từng dòng sub, và
 * `core/subtitle/subtitle-display.js` — hiển thị realtime).
 *
 * === Batch D2 (Settings restructure, phản hồi Giang 06/07/2026) — REFACTOR ĐẦY ĐỦ Rule 1-4 ===
 * TRƯỚC ĐÂY 8 hàm set*Style* tự gọi `applySubtitleStyle()`/`saveConfig()` bên trong (core gọi
 * core, vi phạm Rule 3) VÀ tự ghi `valSubXxx.textContent` qua dom-refs TĨNH — panel Subtitle giờ
 * bị tạo/xoá động (core/settings-panel-stack.js) nên dom-refs tĩnh không còn hợp lệ (sẽ trỏ vào
 * DOM node đã bị `.remove()`, ghi vào đó không lỗi nhưng KHÔNG hiển thị gì — bug âm thầm).
 * Giang CHỐT (06/07/2026): refactor ĐẦY ĐỦ, áp dụng CHUNG cho MỌI panel còn lại có hình dạng này
 * (không hỏi lại từng batch) — xem plan-v12-batch-list.md.
 *
 * SỬA: 8 hàm giờ CHỈ làm ĐÚNG 1 việc (ghi state + đồng bộ DOM CỦA CHÍNH NÓ nếu có, nhận `displayEl`
 * qua tham số thay vì dom-refs tĩnh) — KHÔNG còn tự gọi `applySubtitleStyle()`/`saveConfig()`.
 * 2 lệnh gọi core đó giờ do event/workflow/subtitle-style-settings.js đảm nhiệm (Workflow gọi CẢ
 * BA hàm core theo thứ tự, xem file đó) — đúng Rule 3 (core KHÔNG được gọi core khác).
 * `initSubtitleStyleSettingsUIFromConfig()` (đồng bộ UI lúc mở) ĐÃ XOÁ — logic này giờ nằm ở
 * `workflowSubtitleStyleSettings.openPanel()` (Workflow tự đọc `appState.get('vizConfig')` rồi
 * `querySelector` bên TRONG panel vừa push để điền giá trị, không còn dom-refs tĩnh nào để gọi).
 *
 * `setSubtitlesEnabled()` GIỮ NGUYÊN KHÔNG ĐỔI — checkbox của nó sống ở Main (tĩnh, không di
 * chuyển), không gặp vấn đề dom-refs nói trên nên KHÔNG thuộc phạm vi refactor batch này.
 *
 * PHẢI nạp SAU: core/config.js (vizConfig/saveConfig), core/subtitle/subtitle-display.js
 * (applySubtitleStyle/updateSubToggleUI/clearAllActiveSubBlocks). KHÔNG còn cần core/dom-refs.js
 * cho 8 hàm set*Style* (nhận displayEl qua tham số) — vẫn cần cho settingSubtitlesEnabled.
 */
        /** Core thuần: ứng với toggle "Hiện phụ đề". */
        function setSubtitlesEnabled(checked) {
            appState.set('isSubtitlesEnabled', checked);
            appState.mutate('vizConfig', cfg => { cfg.subtitlesEnabled = appState.get('isSubtitlesEnabled'); });
            saveConfig();
            updateSubToggleUI();
            if (!appState.get('isSubtitlesEnabled')) clearAllActiveSubBlocks();
        }

        /** Core thuần: ứng với input màu nền phụ đề. */
        function setSubtitleStyleBgColor(value) {
            appState.mutate('vizConfig', cfg => { cfg.subtitleStyle.bgColor = value; });
        }

        /**
         * Core thuần: ứng với input độ mờ nền (0-100, lưu dạng 0-1).
         * @param {string} rawValue
         * @param {HTMLElement} [displayEl] - span hiển thị "%", nơi gọi (Workflow) tự
         *        `querySelector` bên trong panel đang mở rồi truyền vào — KHÔNG dùng dom-refs tĩnh
         *        (panel bị xoá/tạo lại mỗi lần đóng/mở, xem docstring đầu file).
         */
        function setSubtitleStyleBgOpacity(rawValue, displayEl) {
            const v = parseInt(rawValue);
            appState.mutate('vizConfig', cfg => { cfg.subtitleStyle.bgOpacity = v / 100; });
            if (displayEl) displayEl.textContent = v + '%';
        }

        /** Core thuần: ứng với input màu viền. */
        function setSubtitleStyleBorderColor(value) {
            appState.mutate('vizConfig', cfg => { cfg.subtitleStyle.borderColor = value; });
        }

        /** Core thuần: ứng với input độ mờ viền (0-100, lưu dạng 0-1). @param {HTMLElement} [displayEl] */
        function setSubtitleStyleBorderOpacity(rawValue, displayEl) {
            const v = parseInt(rawValue);
            appState.mutate('vizConfig', cfg => { cfg.subtitleStyle.borderOpacity = v / 100; });
            if (displayEl) displayEl.textContent = v + '%';
        }

        /** Core thuần: ứng với input độ rộng viền (px). @param {HTMLElement} [displayEl] */
        function setSubtitleStyleBorderWidth(rawValue, displayEl) {
            const v = parseInt(rawValue);
            appState.mutate('vizConfig', cfg => { cfg.subtitleStyle.borderWidth = v; });
            if (displayEl) displayEl.textContent = v;
        }

        /** Core thuần: ứng với input bo góc viền (px). @param {HTMLElement} [displayEl] */
        function setSubtitleStyleBorderRadius(rawValue, displayEl) {
            const v = parseInt(rawValue);
            appState.mutate('vizConfig', cfg => { cfg.subtitleStyle.borderRadius = v; });
            if (displayEl) displayEl.textContent = v;
        }

        /** Core thuần: ứng với input màu chữ. */
        function setSubtitleStyleTextColor(value) {
            appState.mutate('vizConfig', cfg => { cfg.subtitleStyle.textColor = value; });
        }

        /** Core thuần: ứng với input cỡ chữ (px). @param {HTMLElement} [displayEl] */
        function setSubtitleStyleFontSize(rawValue, displayEl) {
            const v = parseInt(rawValue);
            appState.mutate('vizConfig', cfg => { cfg.subtitleStyle.fontSize = v; });
            if (displayEl) displayEl.textContent = v;
        }

        /** Core thuần: ứng với input khoảng cách dòng (line-height). @param {HTMLElement} [displayEl] */
        function setSubtitleStyleLineHeight(rawValue, displayEl) {
            const v = parseFloat(rawValue);
            appState.mutate('vizConfig', cfg => { cfg.subtitleStyle.lineHeight = v; });
            if (displayEl) displayEl.textContent = v;
        }

        /** Core thuần: ứng với input khoảng cách chữ (letter-spacing). @param {HTMLElement} [displayEl] */
        function setSubtitleStyleLetterSpacing(rawValue, displayEl) {
            const v = parseFloat(rawValue);
            appState.mutate('vizConfig', cfg => { cfg.subtitleStyle.letterSpacing = v; });
            if (displayEl) displayEl.textContent = v;
        }

        /**
         * Đồng bộ UI Subtitle ở MAIN list lúc boot — CHỈ phần TĨNH không di chuyển (checkbox
         * "Hiện phụ đề" + badge `#sub-toggle-badge` ở Visualizer overlay), gọi từ loadConfig()
         * (core/config.js) qua guard `typeof === 'function'`, ĐỔI TÊN từ
         * `initSubtitleStyleSettingsUIFromConfig()` (Batch D2 — hàm cũ gộp cả phần Main lẫn phần
         * panel 8 slider; phần panel giờ tách sang `workflowSubtitleStyleSettings.openPanel()`,
         * xem docstring đầu file. `updateSubToggleUI()`/`applySubtitleStyle()` gọi thẳng ở đây vẫn
         * GIỮ NGUYÊN — hàm này chạy lúc BOOT (không phải trong panel push/pop), không thuộc phạm
         * vi refactor Rule 0.5 batch này).
         */
        function initSubtitleToggleUIFromConfig() {
            appState.set('isSubtitlesEnabled', appState.get('vizConfig').subtitlesEnabled !== false);
            if (typeof settingSubtitlesEnabled !== 'undefined' && settingSubtitlesEnabled) settingSubtitlesEnabled.checked = appState.get('isSubtitlesEnabled');
            updateSubToggleUI();
            applySubtitleStyle();
        }
