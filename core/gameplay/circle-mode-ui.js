/**
 * core/gameplay/circle-mode-ui.js — Core-ui (Rule 5c, hậu tố `-ui`) cho Circle mode: TOÀN BỘ hàm ở
 * đây thao tác canvas/DOM, KHÔNG appState.get() (Rule 2), KHÔNG gọi core/nghiệp vụ nào khác (Rule
 * 3a) — mọi dữ liệu (danh sách entry đã tính x/y/radius/opacity/màu, điểm, tier...) do Workflow
 * (event/workflow/gameplay.js) chuẩn bị sẵn rồi truyền vào tham số.
 *
 * Circle+wave vẽ bằng `<canvas id="gameplay-canvas">` (nền TRONG SUỐT — visualizer phía sau xuyên
 * qua được), KHÔNG còn DOM per-note. Vẽ 2 PASS mỗi frame để approach ring của note này đè lên target
 * circle note KHÁC không che mất target — pass 1 (drawApproachRings) LUÔN chạy trước pass 2
 * (drawTargetCircles), target circle mọi note vì vậy luôn nổi trên approach ring mọi note (kể cả
 * approach ring của chính note khác đè lên). Hit-test tap KHÔNG phụ thuộc canvas/DOM nào (thuần toạ
 * độ số học, xem findNearestNoteByPosition() trong circle-mode.js) nên thứ tự vẽ ở đây chỉ ảnh
 * hưởng thị giác, không ảnh hưởng bấm trúng/trượt.
 *
 * `showTapTierPopup()` vẫn DOM+CSS animation (text nổi PERFECT/MISS...) — `addEventListener` CHỈ để
 * tự remove() phần tử vừa tạo, KHÔNG gọi core/eventBus nào khác (Rule 5a).
 */

        /** Set kích thước canvas thật khớp devicePixelRatio (canvas không tự scale theo CSS như DOM)
         * — PHẢI gọi lại mỗi khi layer resize. Trả về kích thước CSS px (không nhân dpr) — Workflow
         * dùng số này để tính lưới pitch→ô (circle-mode.js::computeGridGeometry()), canvas tự vẽ
         * đúng theo toạ độ CSS px nhờ setTransform bên dưới, không cần nhân dpr thủ công ở nơi gọi. */
        function resizeGameplayCanvas(canvas) {
            const dpr = window.devicePixelRatio || 1;
            const widthPx = canvas.clientWidth;
            const heightPx = canvas.clientHeight;
            canvas.width = widthPx * dpr;
            canvas.height = heightPx * dpr;
            const ctx = canvas.getContext('2d');
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            return { widthPx, heightPx };
        }

        /** Xoá sạch khung hình trước (nền TRONG SUỐT — KHÔNG fillRect, để visualizer phía sau xuyên
         * qua). */
        function clearGameplayCanvas(ctx, widthPx, heightPx) {
            ctx.clearRect(0, 0, widthPx, heightPx);
        }

        /** Pass 1 — approach ring (wave co dần): glow mờ, KHÔNG viền cứng. `entries`:
         * [{x, y, radius, opacity, colorLight}]. */
        function drawApproachRings(ctx, entries) {
            for (const entry of entries) {
                ctx.save();
                ctx.globalAlpha = entry.opacity;
                ctx.beginPath();
                ctx.arc(entry.x, entry.y, entry.radius, 0, Math.PI * 2);
                ctx.fillStyle = entry.colorLight;
                ctx.shadowColor = entry.colorLight;
                ctx.shadowBlur = 20;
                ctx.fill();
                ctx.restore();
            }
        }

        /** Pass 2 — target circle cố định (đích chạm khớp), LUÔN vẽ sau (nổi trên) approach ring.
         * `entries`: [{x, y, centerRadius, colorMain}]. */
        function drawTargetCircles(ctx, entries) {
            for (const entry of entries) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(entry.x, entry.y, entry.centerRadius, 0, Math.PI * 2);
                ctx.fillStyle = entry.colorMain;
                ctx.shadowColor = entry.colorMain;
                ctx.shadowBlur = 10;
                ctx.fill();
                ctx.restore();
            }
        }

        /** Hiện text tier (PERFECT/EXCELLENT/.../MISS) thoáng qua NGAY TẠI vị trí (x,y) của note vừa
         * tap, rồi tự dọn (CSS animation, xem assets/css/gameplay.css .gameplay-tier-popup). x/y là
         * PX THẬT (khớp hệ toạ độ canvas) — container CSS position:absolute nên dùng px trực tiếp
         * qua left/top là đủ, không cần đổi % nữa. */
        function showTapTierPopup(container, tierLabel, tierClassSuffix, x, y) {
            const anchor = document.createElement('div');
            anchor.className = 'gameplay-tier-popup-anchor';
            anchor.style.left = `${x}px`;
            anchor.style.top = `${y}px`;

            const el = document.createElement('div');
            el.className = `gameplay-tier-popup gameplay-tier-popup--${tierClassSuffix}`;
            el.textContent = tierLabel;
            anchor.appendChild(el);
            container.appendChild(anchor);

            el.addEventListener('animationend', () => anchor.remove());
        }

        /** Cập nhật HUD combo góc màn hình — điểm số KHÔNG hiện lúc đang chơi (chỉ hiện ở modal kết
         * thúc, xem event/workflow/gameplay.js::onSongEnded()). */
        function updateGameplayHud(hudComboEl, comboStreak) {
            hudComboEl.textContent = comboStreak > 1 ? `x${comboStreak}` : '';
        }

        function showCircleGameplayLayer(layerEl) {
            layerEl.classList.remove('hidden');
        }
        function hideCircleGameplayLayer(layerEl) {
            layerEl.classList.add('hidden');
        }

        /** Hiện/đổi số đếm ngược — retrigger animation CSS bằng remove+reflow+add class (đọc
         * `offsetWidth` ép trình duyệt reflow ngay, KHÔNG phải hàm/timer nào — thuần đồng bộ). */
        function showGameplayCountdown(screenEl, numberEl, value) {
            screenEl.classList.remove('hidden');
            numberEl.textContent = String(value);
            numberEl.classList.remove('is-pulsing');
            void numberEl.offsetWidth; // ép reflow để animation chạy lại từ đầu
            numberEl.classList.add('is-pulsing');
        }
        function hideGameplayCountdown(screenEl) {
            screenEl.classList.add('hidden');
        }
