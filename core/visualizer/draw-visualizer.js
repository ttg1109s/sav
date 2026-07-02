/**
 * Vòng lặp render chính (requestAnimationFrame).
 *
 * File này CHỈ còn: cập nhật các biến phân tích âm thanh dùng chung mỗi khung hình (năng
 * lượng/beat/hue), rồi dispatch sang đúng hàm vẽ của visual đang chọn — tra trong object
 * VISUALIZER_DRAWERS thay vì một chuỗi if/else if dài. Logic vẽ thực tế của từng visual nằm ở
 * các file riêng trong js/visualizers/types/ (bar.js, lightning.js, rubik.js,
 * vortex.js, black-hole.js, rain.js).
 */

        // Tra cứu hàm vẽ theo vizConfig.type. Mỗi hàm nhận (ctx, perf, isPlaying, beatScale) —
        // không phải mọi hàm dùng hết các tham số này, nhưng ký hiệu được giữ đồng nhất để dễ
        // thêm visual mới sau này mà không phải sửa lại vòng lặp chính.
        const VISUALIZER_DRAWERS = {
            'bar':        (ctx, perf) => drawBar(ctx, perf),
            'lightning':  (ctx, perf, isPlaying) => drawLightning(ctx, perf, isPlaying),
            'rubik':      (ctx, perf, isPlaying) => drawRubik(ctx, perf, isPlaying),
            'black hole': (ctx, perf, isPlaying) => drawBlackHole(ctx, perf, isPlaying),
            'rain':       (ctx, perf, isPlaying) => drawRain(ctx, perf, isPlaying)
            // 'vortex' không nằm trong bảng này: nó render qua WebGL (canvas riêng, ba lớp scene
            // Three.js) và được cập nhật TRƯỚC khi canvas 2D được clear, xem drawVisualizer() dưới.
        };

        function drawVisualizer() {
            appState.set('animationId', requestAnimationFrame(drawVisualizer), { skipCheck: true });

            // "Tắt Visual" (ver 8 refine) — ĐỘC LẬP khỏi video nền: tắt -> luôn ẩn canvas + dừng
            // tính toán vẽ, để lộ ra nền THẬT đang được chọn (video nền nếu đang bật, ảnh/màu nền
            // nếu không) phía dưới. Vẫn phải tính toán phân tích âm thanh (BPM/Pitch/Energy ở
            // stats-panel dùng chung các biến này) mỗi khung hình — CHỈ bỏ qua phần vẽ canvas.
            //
            // (Ver 8 refine — lần 2: đã BỎ cờ isVisualForceHiddenByTab — khi tab/app bị ẩn giờ
            // resetPlayerToIdle() dừng hẳn nhạc + currentKey = null, không cần ẩn cưỡng chế visual
            // riêng nữa, vì không còn gì đang phát để mà vẽ. Xem wakelock.js.)
            const cfg = appState.get('vizConfig');
            const isVisualOff = cfg.visualEnabled === false;

            if (isVisualOff) {
                if (canvas.style.visibility !== 'hidden') {
                    canvas.style.visibility = 'hidden';
                    document.getElementById('webgl-canvas').style.visibility = 'hidden';
                }
            } else if (canvas.style.visibility === 'hidden') {
                canvas.style.visibility = '';
                document.getElementById('webgl-canvas').style.visibility = '';
            }

            appState.set('frameCounter', appState.get('frameCounter') + 1, { skipCheck: true });
            const perf = PERFORMANCE_PROFILES[cfg.quality];
            const vizDataArray = appState.get('vizDataArray');
            if(!vizDataArray) return;
            appState.get('analyser').getByteFrequencyData(vizDataArray);
            const bufferLength = appState.get('analyser').frequencyBinCount;
            
            const isPlaying = !audioPlayer.paused;
            let bassSum = 0; const bassCount = Math.floor(bufferLength * 0.1);
            for(let i = 0; i < bassCount; i++) bassSum += vizDataArray[i];
            appState.set('beatScale', (bassSum / bassCount) / 255, { skipCheck: true });
            appState.set('smoothedEnergy', appState.get('smoothedEnergy') + (appState.get('beatScale') - appState.get('smoothedEnergy')) * 0.15, { skipCheck: true });
            if (isPlaying) appState.set('globalHueOffset', (appState.get('globalHueOffset') + 0.5 + (appState.get('beatScale') * 5)) % 360, { skipCheck: true });
            
            updateStatsDashboard(bufferLength);

            // Mọi phần dưới đây CHỈ liên quan tới việc VẼ ra canvas (note bay, Vortex WebGL, các
            // visual 2D) — bỏ qua khi visual đang tắt, vì canvas đang invisible.
            if (isVisualOff) return;

            if (isPlaying && (cfg.quality === 'high' || cfg.quality === 'medium') && appState.get('smoothedEnergy') > 0.3 && Math.random() > 0.6) spawnFlyingNote();

            // ================== THREEJS VORTEX ENGINE ==================
            // Render qua canvas WebGL riêng (#webgl-canvas), TRƯỚC khi canvas 2D (#visualizer) được
            // clear ở dưới — 2 canvas xếp lớp lên nhau bằng CSS (xem styles.css, #webgl-canvas z-index).
            if (cfg.type === 'vortex') drawVortex(perf, isPlaying);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const drawFn = VISUALIZER_DRAWERS[cfg.type];
            if (drawFn) drawFn(ctx, perf, isPlaying, appState.get('beatScale'));
        }

        // Điểm khởi động thực sự của toàn bộ app. loadConfig() giờ là async (đọc ảnh/video nền
        // từ IndexedDB — mục 6 PLAN_INDEXEDDB.md). initPlaylistFromDB() đọc meta.playlistOrder +
        // tag/cover từng bài (KHÔNG đọc blob) để render danh sách ban đầu — thay cho playlist
        // luôn rỗng lúc load trang như bản cũ (mục 3.2).
        //
        // FIX (ver 10 refine #3, bổ sung — modal phải hiện NGAY từ đầu, không đợi load playlist
        // xong): checkPendingResumeStateOnBoot() (resume-state-storage.js) giờ gọi NGAY SAU
        // loadConfig(), KHÔNG đợi initPlaylistFromDB() như bản trước — modal "Tiếp tục nghe?" hiện
        // SONG SONG với lúc playlist đang load ngầm (không đợi loading xong mới thấy modal), nhưng
        // 2 nút "Tiếp tục phát"/"Nghe lại" trong modal đó bị tạm khoá (disabled) cho tới khi
        // initPlaylistFromDB() chạy xong — playSong(key) cần playlistCache/getSongRecord() sẵn sàng
        // mới hoạt động đúng. Nút "Không" không bị ảnh hưởng, luôn bấm được ngay từ đầu.
        //
        // _isPlaylistReadyForResumeModal=true (player-controls.js) + enableResumeModalButtonsWhenPlaylistReady()
        // (resume-state-storage.js) chạy SAU initPlaylistFromDB() — mở khoá 2 nút đó (nếu modal vẫn
        // còn đang mở) + sửa lại tiêu đề tạm (key) thành đúng tên bài thật.
        document.addEventListener('DOMContentLoaded', async () => {
            await loadConfig();
            updateSubToggleUI();
            if (typeof checkPendingResumeStateOnBoot === 'function') checkPendingResumeStateOnBoot();
            if (typeof loadSongStats === 'function') await loadSongStats();
            await initPlaylistFromDB();
            // MỚI (Phase 2, mục 2, CHỐT 03/07/2026) — khôi phục activePlayListFolder đã lưu bền
            // (nếu có) NGAY SAU initPlaylistFromDB() (playlistCache đã đầy đủ) — KHÔNG sửa
            // initPlaylistFromDB()/scanValidSongsFromDB() ở loader.js (code di sản, chưa qua 4
            // rule — xem plan-v12-multimedia-decisions.md, trao đổi 03/07/2026). File này
            // (draw-visualizer.js) được MIỄN audit hoàn toàn theo readme/core-legacy-audit.md
            // (nhóm loại trừ hot-path) nên thêm dòng dưới đây KHÔNG phát sinh nghĩa vụ refactor.
            // Gọi TRỰC TIẾP, KHÔNG qua eventBus — cùng quy ước với chính initPlaylistFromDB()/
            // loadConfig() (lifecycle boot, đứng ngoài /event/, xem event-bus-flow.md mục 1).
            if (typeof getMeta === 'function' && typeof workflowPlaylistScope !== 'undefined') {
                const savedFolderId = await getMeta('activePlayListFolder');
                VirtualMachineState.run([
                    { state: savedFolderId, operation: 'in', value: [null, undefined], callback: () => {} }, // đã đúng "Tất cả bài" sẵn từ initPlaylistFromDB(), không cần làm gì thêm
                    { state: savedFolderId, operation: 'notIn', value: [null, undefined], callback: () => workflowPlaylistScope.applyFolderScope(savedFolderId) },
                ]);
            }
            if (typeof appState !== 'undefined') appState.set('_isPlaylistReadyForResumeModal', true);
            if (typeof enableResumeModalButtonsWhenPlaylistReady === 'function') enableResumeModalButtonsWhenPlaylistReady();
        });
