/**
 * core/gameplay/circle-mode-ui.js — Core-ui (Rule 5c, hậu tố `-ui`) cho Circle mode: TOÀN BỘ hàm ở
 * đây thao tác DOM, KHÔNG appState.get() (Rule 2), KHÔNG gọi core/nghiệp vụ nào khác (Rule 3a) —
 * mọi dữ liệu (danh sách wave đã tính radius, điểm, tier...) do Workflow (event/workflow/
 * gameplay.js) chuẩn bị sẵn rồi truyền vào tham số.
 *
 * `syncCircleWaveElements()`/`showTapTierPopup()` tự `createElement` cụm DOM MỚI (số lượng chạy
 * runtime, không tĩnh) -> ĐÚNG diện Rule 5d cuối ("phần thật sự động về số lượng") — được phép,
 * KHÔNG cần qua components/*.js + instantiateComponent() (đó là cho khung TĨNH không đổi, xem
 * core/gameplay/circle-mode.js không liên quan phần này). `addEventListener` (Rule 5a) trong
 * `showTapTierPopup()` CHỈ có 1 callback `el.remove()` — dọn DOM của chính phần tử vừa tạo, KHÔNG
 * gọi core/eventBus nào khác, gom cuối hàm.
 */

        /**
         * Đồng bộ DOM cụm wave-ring theo danh sách {id, radius} Workflow đã tính (mỗi frame). Wave
         * không còn trong `radiusEntries` (đã tap hoặc đã miss) -> xoá phần tử tương ứng khỏi DOM.
         * `container` PHẢI đã tồn tại sẵn từ template (components/gameplay-overlay.js, Rule 5d).
         */
        function syncCircleWaveElements(container, radiusEntries) {
            const seenIds = new Set();
            for (const entry of radiusEntries) {
                seenIds.add(String(entry.id));
                let el = container.querySelector(`[data-wave-id="${entry.id}"]`);
                if (!el) {
                    el = document.createElement('div');
                    el.className = 'gameplay-wave-ring';
                    el.dataset.waveId = String(entry.id);
                    container.appendChild(el);
                }
                const diameter = entry.radius * 2;
                el.style.width = `${diameter}px`;
                el.style.height = `${diameter}px`;
                // Highlight nhẹ khi đã vào vùng hợp lệ bấm — `entry.armed` do Workflow tính sẵn
                // (biết `gap` từ cfg, hàm này không nhận gap riêng để tránh trùng nguồn tính toán).
                el.classList.toggle('gameplay-wave-ring--armed', entry.armed === true);
            }
            container.querySelectorAll('[data-wave-id]').forEach((el) => {
                if (!seenIds.has(el.dataset.waveId)) el.remove();
            });
        }

        /** Xoá TOÀN BỘ wave-ring hiện có (dùng lúc start()/replay() — reset sạch DOM trước phiên mới). */
        function clearCircleWaveElements(container) {
            container.querySelectorAll('[data-wave-id]').forEach((el) => el.remove());
        }

        /** Hiện text tier (PERFECT/EXCELLENT/.../MISS) thoáng qua rồi tự dọn (CSS animation, xem
         * assets/css/gameplay.css .gameplay-tier-popup) — addEventListener CHỈ để tự remove(), gom
         * cuối hàm, không gọi gì khác (Rule 5a). */
        function showTapTierPopup(container, tierLabel, tierClassSuffix) {
            const el = document.createElement('div');
            el.className = `gameplay-tier-popup gameplay-tier-popup--${tierClassSuffix}`;
            el.textContent = tierLabel;
            container.appendChild(el);

            el.addEventListener('animationend', () => el.remove());
        }

        /** Cập nhật HUD điểm/combo góc màn hình (text thuần, phần tử TĨNH có sẵn từ template). */
        function updateGameplayHud(hudScoreEl, hudComboEl, totalScore, circleCount, comboStreak) {
            const avg = circleCount > 0 ? (totalScore / circleCount) : 0;
            hudScoreEl.textContent = avg.toFixed(2);
            hudComboEl.textContent = comboStreak > 1 ? `x${comboStreak}` : '';
        }

        /** Hiện layer + set kích thước vòng tròn tâm ĐÚNG bằng centerRadius trong config — tránh
         * lệch giữa số JS (GAMEPLAY_CIRCLE_CONFIG.centerRadius) và 1 con số CSS hardcode riêng. */
        function showCircleGameplayLayer(layerEl, centerCircleEl, centerRadius) {
            const diameter = centerRadius * 2;
            centerCircleEl.style.width = `${diameter}px`;
            centerCircleEl.style.height = `${diameter}px`;
            layerEl.classList.remove('hidden');
        }
        function hideCircleGameplayLayer(layerEl) {
            layerEl.classList.add('hidden');
        }

        function showGameplayReadyScreen(screenEl) {
            screenEl.classList.remove('hidden');
        }
        function hideGameplayReadyScreen(screenEl) {
            screenEl.classList.add('hidden');
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

        /** Điền + hiện màn hình kết quả cuối bài (Replay/Next/End) — phần tử TĨNH có sẵn từ template. */
        function showScoreScreen(screenEl, finalScoreEl, finalScore) {
            finalScoreEl.textContent = finalScore.toFixed(3);
            screenEl.classList.remove('hidden');
        }
        function hideScoreScreen(screenEl) {
            screenEl.classList.add('hidden');
        }
