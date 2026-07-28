/**
 * Stats Panel Toggle (ver 10 refine, bổ sung) — toggle ẩn/hiện dải BPM/Pitch/Energy (#stats-panel,
 * xem visualizer-overlay.js) qua nút mới trong Control Center (#btn-toggle-stats-panel).
 *
 * QUAN TRỌNG — TẠM DỪNG UPDATE DOM, KHÔNG TẠM DỪNG TOÀN BỘ TÍNH TOÁN: khi ẩn dải này, audio-analysis.js
 * (updateStatsDashboard(), chạy mỗi frame trong vòng lặp render chính) sẽ KHÔNG còn ghi
 * statBpm/statNote/statEnergy.textContent — đỡ phần thao tác DOM vô nghĩa khi không ai nhìn thấy
 * dải đó. NHƯNG hàm đó còn tính toán logic khác được CÁC VISUALIZER KHÁC dùng (rubikPitchAvg,
 * currentCalculatedBpm, beatTimes, fluxHistory...) — nếu tạm dừng nguyên cả hàm,
 * visual Rubik (xoay theo nốt nhạc trung bình động) sẽ ngưng hoạt động đúng dù không liên quan gì
 * tới việc dải số liệu có hiện hay không. Vì vậy biến isStatsPanelVisible CHỈ là 1 cờ ĐƠN GIẢN mà
 * audio-analysis.js tự đọc trước mỗi dòng ghi .textContent — không đụng/không bọc gì khác trong
 * luồng tính toán của hàm đó.
 *
 * SỬA (phản hồi Giang, mục 3 — "thêm nhớ trạng thái shuffle/repeat/stats của icon Control Center")
 * — ĐẢO quyết định cũ ngay dưới đây: trạng thái ẨN/HIỆN giờ CÓ lưu bền (domain AppConfig 'player',
 * core/config.js — CÙNG khuôn `isShuffle`/`repeatMode`, xem event/workflow/player-controls.js::
 * _persistPlayerConfig()/loadPersistedPlayerConfigOnBoot()) — Giang xác nhận đây giờ là 1 preference
 * lâu dài như Shuffle/Repeat, không còn coi là "tuỳ chọn xem tạm trong phiên" như nhận định cũ ngay
 * dưới (giữ nguyên đoạn cũ để đối chiếu lịch sử, không xoá).
 *
 * [Nhận định CŨ, KHÔNG còn áp dụng — giữ lại đối chiếu] Trạng thái ẨN/HIỆN không lưu vào vizConfig
 * (không cần persist qua reload — đây là tuỳ chọn xem tạm trong 1 phiên, giống độ scroll hay panel
 * nào đang mở, không phải 1 cấu hình lâu dài).
 *
 * PHẢI nạp TRƯỚC audio-analysis.js (file đó đọc isStatsPanelVisible) — xem index.html. Cần
 * dom-refs.js đã chạy (statsPanel/btnToggleStatsPanel/iconStatsPanelVisible/iconStatsPanelHidden).
 *
 * ÁP DỤNG /event/ (cụm "statsPanel"): `addEventListener` cũ đã CHUYỂN sang
 * event/listener/stats-panel.js, gửi message qua eventBus tới event/router/stats-panel.js (gọi
 * THẲNG hàm core toggleStatsPanelVisibility() dưới đây, không cần workflow vì chỉ 1 hàm core).
 * isStatsPanelVisible VẪN giữ nguyên là `let` toàn cục ở đây (KHÔNG đưa vào EventStore) — đây là
 * biến nghiệp vụ to toàn cục được audio-analysis.js đọc trực tiếp mỗi frame, không phải "state
 * context của 1 router" theo đúng phạm vi mục 2b.1. Việc gộp các global này vào service/state.js
 * sẽ làm ở 1 patch riêng sau, KHÔNG đụng ở cụm nhỏ này.
 */
        /** true = dải BPM/Pitch/Energy đang hiện (mặc định) — audio-analysis.js đọc cờ này trước
         * mỗi lần ghi DOM text, KHÔNG đụng gì tới phần tính toán logic khác trong hàm đó. Lưu trong
         * STATE (appState.get/set('isStatsPanelVisible')) — xem service/state.js. */

        /**
         * Core thuần: đảo trạng thái hiện/ẩn dải BPM/Pitch/Energy + đồng bộ icon + dọn số liệu cũ
         * khi ẩn. Không biết gì về eventBus/shield/modal — chỉ đọc/ghi DOM ref có sẵn từ dom-refs.js
         * và biến isStatsPanelVisible ở trên.
         */
        function toggleStatsPanelVisibility() {
            appState.set('isStatsPanelVisible', !appState.get('isStatsPanelVisible'));
            const visible = appState.get('isStatsPanelVisible');
            if (typeof statsPanel !== 'undefined' && statsPanel) statsPanel.classList.toggle('hidden', !visible);
            if (typeof iconStatsPanelVisible !== 'undefined' && iconStatsPanelVisible) iconStatsPanelVisible.classList.toggle('hidden', !visible);
            if (typeof iconStatsPanelHidden !== 'undefined' && iconStatsPanelHidden) iconStatsPanelHidden.classList.toggle('hidden', visible);
            // Khi ẨN trở lại: đưa 3 ô số liệu về "---"/"0%" ngay lúc ẩn (không để giá trị cũ
            // đứng yên "đông cứng" — dù không ai nhìn thấy lúc panel đang ẩn, vẫn nên sạch sẽ
            // đúng trạng thái ban đầu nếu HIỆN LẠI ngay sau đó trước khi audio-analysis.js kịp
            // ghi giá trị mới — tránh nhấp nháy 1 khung hình giá trị cũ từ trước khi ẩn).
            if (!visible) {
                if (typeof statBpm !== 'undefined' && statBpm) statBpm.textContent = '---';
                if (typeof statNote !== 'undefined' && statNote) statNote.textContent = '---';
                if (typeof statEnergy !== 'undefined' && statEnergy) statEnergy.textContent = '0%';
            }
        }
