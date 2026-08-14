/**
 * Hiển thị / đồng bộ phụ đề theo thời gian thực (processSubtitles).
 * (Trích từ file gốc, dòng 492-526 trong khối <script>)
 *
 * SỬA (mục 2, phản hồi Giang — "loại bỏ toàn bộ khung box, chỉ giữ text trắng + shadow, toàn bộ
 * tuỳ chọn -> xoá") — `updateSubToggleUI()`/`applySubtitleStyle()` ĐÃ XOÁ: checkbox "Hiện phụ đề"
 * giờ SỐNG ĐỘNG bên trong panel con (tự đồng bộ lúc MỞ panel, không cần hàm đẩy ngược trạng thái
 * ra DOM tĩnh nữa — xem workflowSubtitleStyleSettings.refresh(), event/workflow/subtitle-style-
 * settings.js). Khung nền phụ đề (bg/border/blur/shadow) không còn tồn tại — `#subtitle-frame`
 * chỉ còn class layout (components/visualizer-overlay.js) — chữ trắng + shadow CỐ ĐỊNH qua class
 * tĩnh (`text-white sub-text-glow`, gắn thẳng ở addActiveSubBlock() bên dưới), không đọc config.
 */
        // Khung phụ đề chỉ thực sự hiện (chiếm chỗ trên màn hình) khi có ít nhất 1 dòng
        // đang active — tránh hiển thị 1 khung nền trống gây cảm giác "thiếu nội dung"
        // trong những đoạn nhạc không có phụ đề nào đang chạy.
        function updateSubtitleFrameVisibility() {
            if (subActiveLines.children.length > 0) subtitleDisplay.classList.remove('hidden');
            else subtitleDisplay.classList.add('hidden');
        }

        function processSubtitles(currentTime) {
            if (!appState.get('isSubtitlesEnabled')) { clearAllActiveSubBlocks(); return; }

            // Tập các phụ đề đang trong khoảng hiệu lực [start, end] tại thời điểm hiện tại.
            // Khác với trước (chỉ giữ 1 dòng active), giờ TẤT CẢ phụ đề chồng lấn nhau đều
            // được tính là active cùng lúc — mỗi dòng có 1 khối DOM riêng (append khi bắt đầu,
            // remove khi kết thúc), nên N dòng overlap có thể hiển thị đồng thời.
            const nowActive = new Map(); // id -> sub object
            const subtitles = appState.get('subtitles');
            for (let i = 0; i < subtitles.length; i++) {
                const s = subtitles[i];
                if (currentTime >= s.start && currentTime <= s.end) nowActive.set(s.id, s);
            }

            let changed = false;
            const activeSubIds = appState.get('activeSubIds');

            // Dòng vừa hết hiệu lực: fade-out rồi xoá khối DOM tương ứng.
            activeSubIds.forEach(id => {
                if (!nowActive.has(id)) {
                    changed = true;
                    removeActiveSubBlock(id);
                }
            });

            // Dòng vừa bắt đầu hiệu lực: thêm khối DOM mới, chèn đúng vị trí theo thời gian
            // bắt đầu tăng dần (dòng bắt đầu trước nằm trên, dòng mới hơn thêm vào dưới).
            nowActive.forEach((sub, id) => {
                if (!activeSubIds.has(id)) {
                    changed = true;
                    addActiveSubBlock(sub);
                }
            });

            appState.set('activeSubIds', new Set(nowActive.keys()), { skipCheck: true });

            if (changed) {
                updateSubtitleFrameVisibility();
                // SỬA (10/07/2026, Subtitle Editor chuyển sang trang riêng): dòng cũ ở đây từng
                // "nếu modal soạn phụ đề đang mở, vẽ lại danh sách để cập nhật dòng đang active" —
                // subtitleModal (DOM)/renderSubList() ĐÃ XOÁ cùng modal, không còn gì ở TRANG
                // CHÍNH cần vẽ lại nữa (soạn thảo giờ ở subtitle-editor.html, trang RIÊNG).
            }
        }

        function addActiveSubBlock(sub) {
            const block = document.createElement('p');
            block.id = `sub-active-${sub.id}`;
            block.dataset.subId = sub.id;
            block.dataset.start = sub.start;
            // MỚI (mục 2) — chữ trắng + shadow CỐ ĐỊNH (text-white + sub-text-glow, class
            // .sub-text-glow ở assets/css/base.css) — trước đây màu/cỡ chữ đọc từ
            // vizConfig.subtitleStyle (applySubtitleStyle(), ĐÃ XOÁ), giờ tĩnh hoàn toàn.
            block.className = 'font-bold text-white text-lg sub-text-glow leading-snug transition-opacity duration-300 opacity-0';
            block.innerHTML = sub.text.replace(/\n/g, '<br>');

            // Chèn đúng vị trí theo start tăng dần trong số các khối đang hiển thị.
            let inserted = false;
            for (const child of subActiveLines.children) {
                if (parseFloat(child.dataset.start) > sub.start) { subActiveLines.insertBefore(block, child); inserted = true; break; }
            }
            if (!inserted) subActiveLines.appendChild(block);

            requestAnimationFrame(() => block.classList.remove('opacity-0'));
        }

        function removeActiveSubBlock(id) {
            const block = document.getElementById(`sub-active-${id}`);
            if (!block) return;
            block.classList.add('opacity-0');
            taskManager.once(() => { block.remove(); updateSubtitleFrameVisibility(); }, 300);
        }

        function clearAllActiveSubBlocks() {
            const activeSubIds = appState.get('activeSubIds');
            if (activeSubIds.size === 0) return;
            activeSubIds.forEach(id => removeActiveSubBlock(id));
            appState.set('activeSubIds', new Set());
        }

        const noSleep = new NoSleep(); // nativeWakeLock — STATE, xem service/state.js

