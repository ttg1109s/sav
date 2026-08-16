/**
 * core/gameplay/circle-mode-ui.js — Core-ui (Rule 5c, hậu tố `-ui`) cho Circle mode: TOÀN BỘ hàm ở
 * đây thao tác DOM, KHÔNG appState.get() (Rule 2), KHÔNG gọi core/nghiệp vụ nào khác (Rule 3a) —
 * mọi dữ liệu (danh sách wave đã tính radius/opacity/x/y, điểm, tier...) do Workflow (event/
 * workflow/gameplay.js) chuẩn bị sẵn rồi truyền vào tham số.
 *
 * SỬA (16/08/2026, đọc lại plan — mỗi note giờ là 1 CẶP circle (mục tiêu) + wave (co lại) ĐỘC LẬP,
 * ở vị trí (x,y) riêng, KHÔNG còn 1 vòng tròn tâm tĩnh dùng chung — xem docstring core/gameplay/
 * circle-mode.js) — `syncCircleWaveElements()` giờ tạo/xoá 1 WRAPPER (`.gameplay-note`) chứa CẢ 2
 * phần tử con (`.gameplay-target-circle` + `.gameplay-wave-ring`) cho mỗi note, xoá wrapper = xoá
 * CẢ CẶP cùng lúc (đúng yêu cầu "hết wave thì cả vòng đó phải biến mất"). Wave-ring giờ CÓ opacity
 * fade dần (hiệu ứng "wave fade circle" chuẩn — ripple: scale + opacity cùng biến thiên theo thời
 * gian, xem core/gameplay/circle-mode.js::computeWaveOpacity()).
 *
 * `syncCircleWaveElements()`/`showTapTierPopup()` tự `createElement` cụm DOM MỚI (số lượng chạy
 * runtime, không tĩnh) -> ĐÚNG diện Rule 5d cuối ("phần thật sự động về số lượng") — được phép,
 * KHÔNG cần qua components/*.js + instantiateComponent() (đó là cho khung TĨNH không đổi). `addEventListener`
 * (Rule 5a) trong `showTapTierPopup()` CHỈ có 1 callback dọn DOM phần tử vừa tạo, KHÔNG gọi
 * core/eventBus nào khác, gom cuối hàm.
 */

        /**
         * Đồng bộ DOM cụm note (circle+wave) theo danh sách {id, x, y, radius, opacity, armed}
         * Workflow đã tính (mỗi frame). Note không còn trong `entries` (đã tap hoặc đã miss) -> xoá
         * CẢ wrapper (circle+wave cùng biến mất). `container` PHẢI đã tồn tại sẵn từ template
         * (components/gameplay-overlay.js, Rule 5d).
         */
        function syncCircleWaveElements(container, entries) {
            const seenIds = new Set();
            for (const entry of entries) {
                seenIds.add(String(entry.id));
                let wrapper = container.querySelector(`[data-wave-id="${entry.id}"]`);
                if (!wrapper) {
                    wrapper = document.createElement('div');
                    wrapper.className = 'gameplay-note';
                    wrapper.dataset.waveId = String(entry.id);
                    wrapper.innerHTML = '<div class="gameplay-target-circle"></div><div class="gameplay-wave-ring"></div>';
                    container.appendChild(wrapper);
                }
                wrapper.style.left = `${entry.x}%`;
                wrapper.style.top = `${entry.y}%`;

                const ring = wrapper.querySelector('.gameplay-wave-ring');
                const diameter = entry.radius * 2;
                ring.style.width = `${diameter}px`;
                ring.style.height = `${diameter}px`;
                ring.style.opacity = String(entry.opacity);
                // Highlight nhẹ khi đã vào vùng hợp lệ bấm — `entry.armed` do Workflow tính sẵn
                // (biết `gap` từ cfg, hàm này không nhận gap riêng để tránh trùng nguồn tính toán).
                ring.classList.toggle('gameplay-wave-ring--armed', entry.armed === true);
            }
            container.querySelectorAll('[data-wave-id]').forEach((wrapper) => {
                if (!seenIds.has(wrapper.dataset.waveId)) wrapper.remove(); // xoá wrapper -> xoá CẢ circle lẫn wave cùng lúc
            });
        }

        /** Xoá TOÀN BỘ note hiện có (dùng lúc start()/replay() — reset sạch DOM trước phiên mới). */
        function clearCircleWaveElements(container) {
            container.querySelectorAll('[data-wave-id]').forEach((el) => el.remove());
        }

        /** Hiện text tier (PERFECT/EXCELLENT/.../MISS) thoáng qua NGAY TẠI vị trí (x,y) của note vừa
         * tap, rồi tự dọn (CSS animation, xem assets/css/gameplay.css .gameplay-tier-popup) —
         * addEventListener CHỈ để tự remove() anchor, gom cuối hàm, không gọi gì khác (Rule 5a). */
        function showTapTierPopup(container, tierLabel, tierClassSuffix, x, y) {
            const anchor = document.createElement('div');
            anchor.className = 'gameplay-tier-popup-anchor';
            anchor.style.left = `${x}%`;
            anchor.style.top = `${y}%`;

            const el = document.createElement('div');
            el.className = `gameplay-tier-popup gameplay-tier-popup--${tierClassSuffix}`;
            el.textContent = tierLabel;
            anchor.appendChild(el);
            container.appendChild(anchor);

            el.addEventListener('animationend', () => anchor.remove());
        }

        /** Cập nhật HUD điểm/combo góc màn hình (text thuần, phần tử TĨNH có sẵn từ template). */
        function updateGameplayHud(hudScoreEl, hudComboEl, totalScore, circleCount, comboStreak) {
            const avg = circleCount > 0 ? (totalScore / circleCount) : 0;
            hudScoreEl.textContent = avg.toFixed(2);
            hudComboEl.textContent = comboStreak > 1 ? `x${comboStreak}` : '';
        }

        /** Hiện layer + set đường kính vòng tròn mục tiêu (CSS var dùng chung cho MỌI note, đọc
         * bởi `.gameplay-target-circle`) ĐÚNG bằng centerRadius trong config — tránh lệch giữa số
         * JS (GAMEPLAY_CIRCLE_CONFIG.centerRadius) và 1 con số CSS hardcode riêng. */
        function showCircleGameplayLayer(layerEl, centerRadius) {
            layerEl.style.setProperty('--gameplay-target-diameter', `${centerRadius * 2}px`);
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
