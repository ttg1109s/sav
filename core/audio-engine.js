/**
 * Khởi tạo AudioContext, chuỗi xử lý EQ (BiquadFilter nối tiếp), cầu nối Worker nhận diện cao độ YIN.
 * (Trích từ file gốc, dòng 973-1015 trong khối <script>)
 *
 * PITCH WORKER (v7): detectPitchYIN() đã dời sang core/pitch-worker.js, chạy trên thread riêng
 * — xem audio-analysis.js để biết cách kết quả bất đồng bộ được tiêu thụ. Khu vực dưới đây chỉ còn
 * lại "cầu nối": khởi tạo 1 Worker duy nhất, gửi buffer (transfer, không copy) kèm reqId, và giữ
 * lại kết quả mới nhất hợp lệ cho audio-analysis.js đọc.
 *
 * FIX (log 9->10, mục "play lại/Next/Prev không ra tiếng sau khi quay lại tab trên iOS"): nguyên
 * nhân gốc rễ THẬT là ở ĐÂY, không phải ở currentKey/isShieldBusy (đã sửa ở bản trước, vẫn đúng và
 * cần giữ). Trên iOS Safari, khi tab/app bị ẩn, AudioContext KHÔNG chuyển sang 'suspended' (trạng
 * thái do CHÍNH app tự gọi suspend() — resume() được) mà chuyển sang 'interrupted' — một trạng thái
 * THỨ BA, riêng của Safari, do HỆ ĐIỀU HÀNH áp đặt từ ngoài app (xem MDN BaseAudioContext.state).
 * setupAudioContext() (hàm này) trước đây CHỈ kiểm tra `audioContext.state === 'suspended'` ở nhánh
 * `else if` — bỏ sót hoàn toàn 'interrupted'. Vì audioContext là biến toàn cục chỉ được TẠO MỚI
 * đúng 1 lần (`if (!audioContext)`), mọi lượt gọi lại setupAudioContext() sau đó (Play, Next, Prev,
 * chọn bài trong playlist — TẤT CẢ đều đi qua playSong() -> setupAudioContext() ở cuối) chỉ rơi vào
 * nhánh else if, và else if đó KHÔNG khớp 'interrupted' -> không resume() -> graph âm thanh (analyser/
 * analyserPitch/EQ) vẫn nối với 1 context bị OS "ngắt" -> KHÔNG có tiếng phát ra, và
 * analyser.getByteFrequencyData()/analyserPitch.getFloatTimeDomainData() (dùng cho BPM/Pitch/Energy
 * ở audio-analysis.js) chỉ đọc được dữ liệu rỗng/cũ từ 1 context đã ngắt — giải thích ĐÚNG NGUYÊN
 * VĂN triệu chứng "nhạc không phát ra tiếng + BPM/Pitch/Energy không hoạt động" dù currentKey/icon
 * Play đã đúng (bản fix log 8->9 đã sửa đúng phần currentKey/isShieldBusy/UI, nhưng tầng AudioContext
 * bên dưới vẫn câm vì lỗ hổng riêng này) — và giải thích luôn vì sao Next/Prev "lây" cùng lỗi: mọi
 * đường đều dùng CHUNG 1 audioContext toàn cục, hỏng ở 1 chỗ là hỏng cho mọi bài sau đó.
 *
 * Sửa: thêm 'interrupted' vào điều kiện resume (gộp chung với 'suspended', cùng 1 cách xử lý —
 * resume() hợp lệ cho cả 2 trạng thái theo đúng spec). Không đổi gì khác trong hàm.
 */
        // pitchWorker, pitchWorkerBusy, latestPitchFrequency — STATE, xem service/state.js.
        let pitchReqCounter = 0;           // biến NỘI BỘ — tăng dần, đối chiếu reqId để loại bỏ hồi đáp cũ/lạc (hiếm, do giật khung)
        let latestPitchReqId = -1;         // biến NỘI BỘ

        function initPitchWorker() {
            if (appState.get('pitchWorker')) return;
            try {
                appState.set('pitchWorker', new Worker('core/pitch-worker.js'));
                appState.get('pitchWorker').onmessage = function(e) {
                    const { frequency, reqId } = e.data;
                    // Chỉ nhận kết quả nếu nó MỚI HƠN reqId đã ghi nhận gần nhất — phòng trường hợp
                    // hiếm 2 message bay đồng thời (giật khung) trả về không đúng thứ tự gửi.
                    if (reqId >= latestPitchReqId) { latestPitchReqId = reqId; appState.set('latestPitchFrequency', frequency); }
                    appState.set('pitchWorkerBusy', false);
                };
                appState.get('pitchWorker').onerror = function(err) {
                    console.error('[audio-engine] Lỗi pitch-worker, tắt phát hiện cao độ:', err);
                    appState.set('pitchWorker', null); appState.set('pitchWorkerBusy', false);
                };
            } catch (err) {
                console.error('[audio-engine] Không tạo được pitch-worker (trình duyệt không hỗ trợ Worker qua file://?):', err);
                appState.set('pitchWorker', null);
            }
        }

        /**
         * Gửi 1 khung pitchTimeDomainArray sang worker để phân tích — KHÔNG chờ kết quả (bất đồng
         * bộ). Bỏ qua nếu worker đang bận (request trước chưa hồi đáp) để hàng đợi message không bị
         * dồn lúc máy yếu — kết quả vẫn dùng tạm giá trị cũ (latestPitchFrequency), độ trễ thêm tối
         * đa vài khung hình, không gây lệch cảm nhận được (xem thảo luận độ trễ ở audio-analysis.js).
         *
         * QUAN TRỌNG — phải CLONE trước khi transfer: pitchTimeDomainArray là buffer TÁI SỬ DỤNG
         * (ghi đè mỗi frame bởi analyserPitch.getFloatTimeDomainData), nếu transfer thẳng buffer gốc
         * thì nó sẽ bị "neutered" (mất quyền sở hữu) ngay sau lần gửi đầu tiên và toàn bộ frame sau
         * sẽ ghi vào một buffer đã chết.
         */
        function requestPitchDetection(buf, sampleRate) {
            if (!appState.get('pitchWorker')) { initPitchWorker(); if (!appState.get('pitchWorker')) return; }
            if (appState.get('pitchWorkerBusy')) return;
            appState.set('pitchWorkerBusy', true);
            const clone = buf.slice(); // Float32Array.slice() cấp ArrayBuffer MỚI, an toàn để transfer
            pitchReqCounter++;
            appState.get('pitchWorker').postMessage({ buf: clone, sampleRate, reqId: pitchReqCounter }, [clone.buffer]);
        }

        function setupAudioContext() {
            if (!appState.get('audioContext')) {
                appState.set('audioContext', new (window.AudioContext || window.webkitAudioContext)());
                source = appState.get('audioContext').createMediaElementSource(audioPlayer);

                appState.set('analyser', appState.get('audioContext').createAnalyser()); appState.get('analyser').fftSize = APP_CONFIG.fftSizeStandard;
                appState.set('analyserPitch', appState.get('audioContext').createAnalyser()); appState.get('analyserPitch').fftSize = APP_CONFIG.fftSizePitch;

                appState.set('masterGainNode', appState.get('audioContext').createGain()); appState.get('masterGainNode').gain.value = appState.get('vizConfig').volume / 100;

                let prevNode = source; appState.set('eqBandNodes', []);
                EQ_FREQS.forEach(freq => {
                    let filter = appState.get('audioContext').createBiquadFilter();
                    filter.type = "peaking"; filter.frequency.value = freq; filter.Q.value = 1; filter.gain.value = 0;
                    prevNode.connect(filter); prevNode = filter; appState.mutate('eqBandNodes', arr => arr.push(filter));
                });

                applyEQPreset(appState.get('vizConfig').eqMode);
                prevNode.connect(appState.get('masterGainNode')); appState.get('masterGainNode').connect(appState.get('analyser')); appState.get('masterGainNode').connect(appState.get('analyserPitch')); appState.get('analyser').connect(appState.get('audioContext').destination);

                initPitchWorker();
                // MỚI (20/07/2026, plan-space-galaxy.md Phần A, mục A2) — `drawVisualizer()` cũ
                // (core/visualizer/draw-visualizer.js, nay đã RỖNG) ĐỔI thành
                // `workflowVisualizerRender.start()` — Core gọi Workflow, VI PHẠM KỸ THUẬT Rule 3,
                // NHƯNG ĐÃ ĐÁNH DẤU RÕ là ngoại lệ đã biết (nhất quán với việc `playSong()`, hàm
                // gọi `setupAudioContext()`, vốn dĩ đã Core-gọi-Core tràn lan từ trước —
                // `switchToVisualizer()`/`refreshSongNode()`/`renderPlaylistDiff()`/
                // `bumpSongPlayCount()`...). `taskManager.operator(name,'enabled')` tự guard
                // chống double-start (no-op nếu đã chạy) nên gọi `start()` từ đây an toàn tuyệt
                // đối, kể cả khi nhánh này không còn là nhánh "lần đầu" duy nhất chạy nó.
                allocateBuffers(); resizeCanvas(); workflowVisualizerRender.start(); updateDOMBackground();
            } else if (appState.get('audioContext').state === 'suspended' || appState.get('audioContext').state === 'interrupted') appState.get('audioContext').resume();
        }

