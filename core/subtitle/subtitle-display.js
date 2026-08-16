/**
 * Hiển thị / đồng bộ phụ đề theo thời gian thực (processSubtitles).
 * (Trích từ file gốc, dòng 492-526 trong khối <script>)
 *
 * SỬA (mục 2, phản hồi Giang — "loại bỏ toàn bộ khung box, chỉ giữ text trắng + shadow, toàn bộ
 * tuỳ chọn -> xoá") — `updateSubToggleUI()`/`applySubtitleStyle()` ĐÃ XOÁ: checkbox "Hiện phụ đề"
 * giờ SỐNG ĐỘNG bên trong panel con (tự đồng bộ lúc MỞ panel, không cần hàm đẩy ngược trạng thái
 * ra DOM tĩnh nữa — xem workflowSubtitleStyleSettings.refresh(), event/workflow/subtitle-style-
 * settings.js). Khung nền phụ đề (bg/border/blur/shadow) không còn tồn tại kiểu HARDCODE — khung
 * `subtitleFrame` giờ style tuỳ chỉnh ĐƯỢC qua `vizConfig.subtitleBoxCss` (mục 4a, Element Style
 * Editor — xem core/subtitle/subtitle-style-settings.js::initSubtitleStateFromConfig()).
 *
 * SỬA (16/08/2026, mục 3 — Giang chỉ ra "tuỳ chỉnh Styling chưa thắng inline subtitle") —
 * `addActiveSubBlock()` KHÔNG còn hardcode class font/color/shadow trên TỪNG DÒNG `<p>` nữa (trước
 * đây `font-bold text-white text-lg sub-text-glow leading-snug` — property EXPLICIT trên con LUÔN
 * thắng property INHERITED từ cha bất kể specificity, nên style tuỳ chỉnh áp lên `subtitleFrame`
 * KHÔNG BAO GIỜ hiện ra được) — dòng `<p>` giờ TRẦN, kế thừa HOÀN TOÀN từ `subtitleFrame` (2 class
 * tĩnh làm sàn an toàn + inline tuỳ chỉnh/mặc định đè lên trên, xem components/
 * visualizer-overlay.js, core/subtitle/subtitle-style-settings.js::applySubtitleFrameStyle()).
 *
 * SỬA (15/08/2026, mục 4b) — hiệu ứng Comming/In/Outing CẤU HÌNH ĐƯỢC (dropdown None/hiệu ứng,
 * CHUNG 1 cài đặt cho mọi dòng — vizConfig.subtitleCommingEffect/subtitleInEffect/
 * subtitleOutingEffect (+2 field valueMs Comming/Outing), core/config.js) — THAY THẾ HẲN fade CSS
 * 300ms hardcode cũ (xoá ở đợt trước cùng ngày). Công thức tính
 * khung giờ THỰC TẾ (khác nhau mỗi dòng, lấy start/end CHÍNH dòng đó làm mốc neo) nằm ở core/
 * subtitle/subtitle-transition.js::computeSubtitleTransitionWindow() — file NÀY chỉ lo phần ÁP
 * DỤNG (tạo/xoá khối DOM, chuyển phase, gán CSS transition) mỗi tick 'timeupdate'.
 *
 * TẠI SAO CSS transition (browser tự nội suy) THAY VÌ tự tính progress mỗi khung hình bằng JS:
 * `processSubtitles()` chạy theo sự kiện 'timeupdate' của thẻ <audio> (core/player-controls.js::
 * handleAudioTimeUpdate()) — tick này KHÔNG đủ dày (trình duyệt thường chỉ bắn ~4-10 lần/giây,
 * KHÔNG phải 60fps) để tự set opacity/transform theo từng khung hình mà vẫn mượt. Thay vào đó:
 * lúc 1 dòng CHUYỂN phase (comming->in, in->outing), set 1 LẦN `transition-duration` khớp thời
 * gian CÒN LẠI của phase đó rồi đổi thẳng sang trạng thái CSS đích — trình duyệt tự nội suy mượt
 * suốt khoảng đó, không cần JS can thiệp thêm cho tới lần đổi phase tiếp theo.
 *
 * NẠP SAU: core/subtitle/subtitle-transition.js (computeSubtitleTransitionWindow(),
 * SUBTITLE_TRANSITION_EFFECTS, SUBTITLE_IN_EFFECTS), core/config.js (appConfigViz).
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

            // Đọc CHUNG 1 lần/tick — effect/valueMs Comming/In/Outing áp CHUNG cho mọi dòng (mục
            // 4b), KHÔNG lưu riêng từng dòng (KHÁC subtitleBoxCss, mục 4a — cả 2 đều đọc từ
            // vizConfig, chỉ khác VỊ TRÍ áp: box = 1 khung chung, comming/in/outing = TÍNH RIÊNG
            // khung giờ mỗi dòng dựa trên CHÍNH start/end dòng đó, xem docstring đầu file).
            const cfg = appConfigViz.getAll();

            // Tập các phụ đề đang trong khoảng hiệu lực tại thời điểm hiện tại — khoảng này giờ
            // CÓ THỂ RỘNG HƠN [s.start, s.end] gốc nếu Comming/Outing đang bật (dòng bắt đầu hiện
            // SỚM HƠN/kết thúc TRỄ HƠN mốc gốc, tuỳ dấu value — xem computeSubtitleTransitionWindow()).
            // Effect nào đang 'none' thì KHÔNG mở rộng phía đó (mốc giữ nguyên y hệt hành vi cũ).
            const nowActive = new Map(); // id -> { sub, commingWindow, outingWindow, phase }
            const subtitles = appState.get('subtitles');
            for (let i = 0; i < subtitles.length; i++) {
                const s = subtitles[i];
                const commingWindow = computeSubtitleTransitionWindow(s.start, cfg.subtitleCommingValueMs, s.start, s.end); // core/subtitle/subtitle-transition.js
                const outingWindow = computeSubtitleTransitionWindow(s.end, cfg.subtitleOutingValueMs, s.start, s.end);
                const commingOn = cfg.subtitleCommingEffect !== 'none';
                const outingOn = cfg.subtitleOutingEffect !== 'none';
                const activeFrom = commingOn ? commingWindow.from : s.start;
                const activeTo = outingOn ? outingWindow.to : s.end;
                if (currentTime < activeFrom || currentTime > activeTo) continue;
                const phase = (commingOn && currentTime < commingWindow.to) ? 'comming'
                    : (outingOn && currentTime >= outingWindow.from) ? 'outing'
                    : 'in';
                nowActive.set(s.id, { sub: s, commingWindow, outingWindow, phase });
            }

            let changed = false;
            const activeSubIds = appState.get('activeSubIds');

            // Dòng vừa hết hiệu lực: xoá khối DOM tương ứng NGAY — Outing (nếu bật) đã tự fade
            // mượt qua CSS transition TRƯỚC khi tới mốc này rồi (xem _applySubtitleBlockPhase()),
            // nên xoá thẳng không còn giật hình.
            activeSubIds.forEach(id => {
                if (!nowActive.has(id)) {
                    changed = true;
                    removeActiveSubBlock(id);
                }
            });

            // Dòng vừa bắt đầu hiệu lực: thêm khối DOM mới, chèn đúng vị trí theo thời gian
            // bắt đầu tăng dần (dòng bắt đầu trước nằm trên, dòng mới hơn thêm vào dưới).
            nowActive.forEach((entry, id) => {
                if (!activeSubIds.has(id)) {
                    changed = true;
                    addActiveSubBlock(entry, cfg, currentTime);
                }
            });

            appState.set('activeSubIds', new Set(nowActive.keys()), { skipCheck: true });

            // Cập nhật phase cho MỌI dòng đang active (mới tạo lẫn đã có sẵn từ tick trước) —
            // _applySubtitleBlockPhase() tự guard qua `block.dataset.phase`, KHÔNG bắn lại
            // transition nếu phase chưa đổi so với lần gọi trước.
            nowActive.forEach((entry, id) => {
                const block = document.getElementById(`sub-active-${id}`);
                if (block) _applySubtitleBlockPhase(block, entry, cfg, currentTime);
            });

            if (changed) {
                updateSubtitleFrameVisibility();
                // SỬA (10/07/2026, Subtitle Editor chuyển sang trang riêng): dòng cũ ở đây từng
                // "nếu modal soạn phụ đề đang mở, vẽ lại danh sách để cập nhật dòng đang active" —
                // subtitleModal (DOM)/renderSubList() ĐÃ XOÁ cùng modal, không còn gì ở TRANG
                // CHÍNH cần vẽ lại nữa (soạn thảo giờ ở subtitle-editor.html, trang RIÊNG).
            }
        }

        function addActiveSubBlock(entry, cfg, currentTime) {
            const sub = entry.sub;
            const block = document.createElement('p');
            block.id = `sub-active-${sub.id}`;
            block.dataset.subId = sub.id;
            block.dataset.start = sub.start;
            // SỬA (16/08/2026, mục 3 — Giang chỉ ra "tuỳ chỉnh Styling chưa thắng inline subtitle")
            // — KHÔNG còn hardcode class font/color/shadow ở ĐÂY nữa (trước đây `font-bold
            // text-white text-lg sub-text-glow leading-snug` — property EXPLICIT trên CHÍNH dòng
            // này LUÔN thắng property INHERITED từ #subtitle-frame, dù frame có set qua inline hay
            // không, nên style tuỳ chỉnh Element Style Editor áp lên frame KHÔNG BAO GIỜ hiện ra
            // được). Dòng <p> giờ KHÔNG còn class nào cho font/color/shadow — kế thừa HOÀN TOÀN từ
            // #subtitle-frame (2 class `sub-text-glow subtitle-default-appearance` làm sàn an
            // toàn, + inline tuỳ chỉnh/mặc định đè lên trên — xem components/visualizer-overlay.js,
            // core/subtitle/subtitle-style-settings.js::applySubtitleFrameStyle()).
            block.innerHTML = sub.text.replace(/\n/g, '<br>');

            // Chèn đúng vị trí theo start tăng dần trong số các khối đang hiển thị.
            let inserted = false;
            for (const child of subActiveLines.children) {
                if (parseFloat(child.dataset.start) > sub.start) { subActiveLines.insertBefore(block, child); inserted = true; break; }
            }
            if (!inserted) subActiveLines.appendChild(block);

            // `block.dataset.phase` CHƯA có -> lần gọi ĐẦU luôn set state đúng ngay (guard trong
            // _applySubtitleBlockPhase() chỉ chặn gọi TRÙNG phase, không chặn lần đầu).
            _applySubtitleBlockPhase(block, entry, cfg, currentTime);
        }

        /**
         * Đổi trạng thái CSS của 1 khối phụ đề theo phase hiện tại ('comming'|'in'|'outing') —
         * CHỈ làm gì đó nếu phase THỰC SỰ đổi so với lần gọi trước (dataset.phase) — tránh bắn lại
         * transition liên tục mỗi tick trong khi dòng vẫn đang ở nguyên 1 phase.
         *
         * `remainingMs` (thời gian CÒN LẠI tới mốc kết thúc phase) — dùng làm `transition-duration`
         * THAY VÌ luôn dùng trọn vẹn thời lượng cả khung — để khớp cả trường hợp vào phase NGAY
         * ĐÚNG biên (phát bình thường) LẪN vào phase GIỮA CHỪNG (tua/seek thẳng vào giữa khung
         * Comming/Outing) — cả 2 ca hiệu ứng đều kết thúc ĐÚNG lúc chạm mốc, không kết thúc sớm/muộn.
         * @param {HTMLElement} block
         * @param {{sub: Object, commingWindow: {from:number,to:number}, outingWindow: {from:number,to:number}, phase: string}} entry
         * @param {Object} cfg - appConfigViz.getAll()
         * @param {number} currentTime
         */
        function _applySubtitleBlockPhase(block, entry, cfg, currentTime) {
            if (block.dataset.phase === entry.phase) return;
            block.dataset.phase = entry.phase;
            block.classList.remove('sub-in-pulse', 'sub-in-glow'); // dọn class "In" cũ (nếu có) trước khi đổi phase

            if (entry.phase === 'comming') {
                const fx = SUBTITLE_TRANSITION_EFFECTS[cfg.subtitleCommingEffect]; // core/subtitle/subtitle-transition.js
                if (!fx) { block.style.cssText = 'opacity:1'; return; }
                const remainingMs = Math.max(0, (entry.commingWindow.to - currentTime) * 1000);
                block.style.cssText = fx.hiddenCss + ';transition:none';
                requestAnimationFrame(() => { block.style.cssText = `${fx.visibleCss};transition:all ${remainingMs}ms linear`; });
            } else if (entry.phase === 'in') {
                // Trạng thái ỔN ĐỊNH (hiện đầy đủ) — dùng ĐÚNG `visibleCss` của hiệu ứng Comming
                // (nếu có) làm nền, để không "giật" style giữa 2 hiệu ứng khác nhau lúc chuyển
                // phase comming->in (chỉ tắt transition, KHÔNG đổi giá trị cuối).
                const commingFx = SUBTITLE_TRANSITION_EFFECTS[cfg.subtitleCommingEffect];
                block.style.cssText = (commingFx ? commingFx.visibleCss : 'opacity:1') + ';transition:none';
                const inClass = SUBTITLE_IN_EFFECTS[cfg.subtitleInEffect]; // core/subtitle/subtitle-transition.js
                if (inClass) block.classList.add(inClass);
            } else if (entry.phase === 'outing') {
                const fx = SUBTITLE_TRANSITION_EFFECTS[cfg.subtitleOutingEffect];
                if (!fx) { block.style.cssText = 'opacity:0'; return; } // guard: hiếm khi lọt vào đây với effect 'none' (activeTo chỉ mở rộng khi effect khác 'none')
                const remainingMs = Math.max(0, (entry.outingWindow.to - currentTime) * 1000);
                block.style.cssText = 'opacity:1;transition:none';
                requestAnimationFrame(() => { block.style.cssText = `${fx.hiddenCss};transition:all ${remainingMs}ms linear`; });
            }
        }

        function removeActiveSubBlock(id) {
            const block = document.getElementById(`sub-active-${id}`);
            if (!block) return;
            block.remove();
            updateSubtitleFrameVisibility();
        }

        function clearAllActiveSubBlocks() {
            const activeSubIds = appState.get('activeSubIds');
            if (activeSubIds.size === 0) return;
            activeSubIds.forEach(id => removeActiveSubBlock(id));
            appState.set('activeSubIds', new Set());
        }

        const noSleep = new NoSleep(); // nativeWakeLock — STATE, xem service/state.js

