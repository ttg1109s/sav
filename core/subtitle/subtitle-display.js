/**
 * Hiển thị / đồng bộ phụ đề theo thời gian thực (updateSubToggleUI, processSubtitles).
 * (Trích từ file gốc, dòng 492-526 trong khối <script>)
 */
        /**
         * Cập nhật UI theo trạng thái isSubtitlesEnabled — ver 8 refine: nút "Bật/Tắt Sub" (trước
         * nằm trong modal quản lý phụ đề) đã chuyển thành checkbox #setting-subtitles-enabled
         * trong Cài đặt, nên hàm này giờ chỉ còn lo 2 việc: (1) badge xanh nhỏ trên icon "Phụ đề"
         * ở overlay (#sub-toggle-badge — vẫn là indicator hữu ích cho biết sub đang bật, KHÔNG
         * phải nút điều khiển), và (2) đồng bộ ngược checkbox Settings nếu trạng thái đổi từ nơi
         * khác (ví dụ subtitles.js tự bật lại sub khi người dùng tải file .srt mới — xem mục đó).
         */
        function updateSubToggleUI() {
            const enabled = appState.get('isSubtitlesEnabled');
            subToggleBadge.classList.toggle('hidden', !enabled);
            if (typeof settingSubtitlesEnabled !== 'undefined' && settingSubtitlesEnabled) settingSubtitlesEnabled.checked = enabled;
        }

        // Khung phụ đề chỉ thực sự hiện (chiếm chỗ trên màn hình) khi có ít nhất 1 dòng
        // đang active — tránh hiển thị 1 khung nền trống gây cảm giác "thiếu nội dung"
        // trong những đoạn nhạc không có phụ đề nào đang chạy.
        function updateSubtitleFrameVisibility() {
            if (subActiveLines.children.length > 0) subtitleDisplay.classList.remove('hidden');
            else subtitleDisplay.classList.add('hidden');
        }

        // Áp style khung (nền/viền/bo góc) + style chữ phụ đề từ vizConfig.subtitleStyle
        // lên DOM thật. Được gọi lúc loadConfig() và mỗi khi người dùng đổi 1 setting.
        function applySubtitleStyle() {
            const s = appState.get('vizConfig').subtitleStyle;
            const bgRgb = hexToRgb(s.bgColor);
            subtitleFrame.style.backgroundColor = `rgba(${bgRgb.r}, ${bgRgb.g}, ${bgRgb.b}, ${s.bgOpacity})`;
            const borderRgb = hexToRgb(s.borderColor);
            subtitleFrame.style.borderColor = `rgba(${borderRgb.r}, ${borderRgb.g}, ${borderRgb.b}, ${s.borderOpacity})`;
            subtitleFrame.style.borderWidth = `${s.borderWidth}px`;
            subtitleFrame.style.borderRadius = `${s.borderRadius}px`;
            subtitleFrame.style.backdropFilter = s.bgOpacity > 0 ? 'blur(12px)' : 'none';
            subActiveLines.style.color = s.textColor;
            subActiveLines.style.fontSize = `${s.fontSize}px`;
            subActiveLines.style.lineHeight = s.lineHeight;
            subActiveLines.style.letterSpacing = `${s.letterSpacing}px`;
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
            block.className = 'font-bold sub-text-glow leading-snug transition-opacity duration-300 opacity-0';
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

