/**
 * Khởi tạo AudioContext, chuỗi xử lý EQ (BiquadFilter nối tiếp), cầu nối Worker nhận diện cao độ YIN.
 * (Trích từ file gốc, dòng 973-1015 trong khối <script>)
 *
 * PITCH WORKER (v7): detectPitchYIN() đã dời sang core/workers/pitch-worker.js, chạy trên thread riêng
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
                appState.set('pitchWorker', new Worker('core/workers/pitch-worker.js'));
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

                appState.set('masterGainNode', appState.get('audioContext').createGain()); appState.get('masterGainNode').gain.value = appConfigViz.getAll().volume / 100;

                let prevNode = source; appState.set('eqBandNodes', []);
                EQ_FREQS.forEach(freq => {
                    let filter = appState.get('audioContext').createBiquadFilter();
                    filter.type = "peaking"; filter.frequency.value = freq; filter.Q.value = 1; filter.gain.value = 0;
                    prevNode.connect(filter); prevNode = filter; appState.mutate('eqBandNodes', arr => arr.push(filter));
                });

                // FIX (phản hồi Giang, hệ thống preset EQ mới) — applyEQPreset(mode) cũ (tra bảng
                // EQ_PRESETS tĩnh) ĐÃ XOÁ HẲN — tra preset theo id trong appState.eqPresets (nạp
                // lúc boot, event/workflow/eq-presets.js::loadPresetsOnBoot(), CHẮC CHẮN đã xong
                // trước khi setupAudioContext() có thể chạy lần đầu — chỉ xảy ra sau 1 thao tác
                // phát nhạc của người dùng, luôn SAU khi app-boot hoàn tất). Fallback [0*10] an
                // toàn nếu vì lý do gì đó chưa nạp kịp (không có preset nào tên vậy vẫn không vỡ).
                {
                    const eqPresets = appState.get('eqPresets');
                    const activePreset = findEqPresetById(eqPresets, appConfigViz.getAll().eqPresetId); // core/eq-presets.js
                    applyEqGains(appState.get('eqBandNodes'), activePreset ? activePreset.gains : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]); // core/eq-presets.js
                }
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


        // ===================== Phát nền khi ẩn tab/PWA (MỚI 25/09/2026, Giang yêu cầu) =====================
        // 2 hàm THUẦN dưới đây do event/workflow/app-visibility.js (workflowAppVisibility) gọi — KHÔNG tự đọc appState,
        // KHÔNG gọi hàm core nào khác, KHÔNG dùng taskManager (Rule 1-3).

        /**
         * Đăng ký Audio Session loại 'playback' (Audio Session API — Safari/iOS 16.4+, `navigator.audioSession`).
         * NGUYÊN NHÂN GỐC lỗi "ẩn app thì mất tiếng nhưng currentTime vẫn chạy, hết bài -> Next mới có tiếng lại":
         * `audioPlayer` đi QUA Web Audio (createMediaElementSource ở setupAudioContext()) nên tiếng thật phát ra từ
         * AudioContext; iOS mặc định xếp trang dùng Web Audio vào loại session KHÔNG được phát nền -> vừa ẩn app là
         * AudioContext bị hệ điều hành chuyển sang 'interrupted' (câm), còn <audio> vẫn chạy tiếp (currentTime vẫn
         * tăng). Next/Prev "chữa" được chỉ vì playSong() -> setupAudioContext() gọi resume(). Khai báo 'playback' =
         * báo iOS đây là app phát nhạc (giống app Music): được phát nền + hiện trên màn hình khoá. Hệ quả phụ (đúng
         * chuẩn app nhạc): tiếng phát cả khi gạt công tắc im lặng.
         * Idempotent — chỉ gán khi khác. Trình duyệt không hỗ trợ -> no-op.
         * @returns {boolean} true nếu trình duyệt hỗ trợ Audio Session API.
         */
        function applyPlaybackAudioSession() {
            if (typeof navigator === 'undefined' || !navigator.audioSession) return false;
            try {
                if (navigator.audioSession.type !== 'playback') {
                    navigator.audioSession.type = 'playback';
                    console.log('[audio-engine] Đã đăng ký navigator.audioSession.type = "playback"');
                }
            } catch (e) {
                console.warn('[audio-engine] Không đăng ký được audioSession (bỏ qua):', e);
            }
            return true;
        }

        /**
         * Lưới an toàn cho phát nền: AudioContext bị hệ điều hành ngắt ('interrupted' — riêng Safari) hoặc treo
         * ('suspended') trong lúc media VẪN đang phát -> resume() ngay (cùng điều kiện resume đã có ở
         * setupAudioContext()/togglePlayPause()). `shouldBeRunning` = false (không có gì đang phát) thì KHÔNG đụng —
         * không tự đánh thức context lúc người dùng đã pause.
         * @param {AudioContext|null|undefined} audioContext - appState.get('audioContext') do Workflow đọc sẵn.
         * @param {boolean} shouldBeRunning - media đang thật sự phát (Workflow tự tính).
         * @returns {string} trạng thái context lúc kiểm tra ('none' nếu chưa có context) — Workflow dùng để log.
         */
        function resumeAudioContextIfInterrupted(audioContext, shouldBeRunning) {
            if (!audioContext) return 'none';
            const state = audioContext.state;
            if (shouldBeRunning && (state === 'suspended' || state === 'interrupted')) {
                audioContext.resume().catch((err) => console.warn('[audio-engine] resume() AudioContext lỗi (bỏ qua):', err));
            }
            return state;
        }

        // ===================== Cổng seek v2 (MỚI 25/09/2026, Giang chọn "pause chờ hết đuôi cũ") =====================
        // 2 hàm THUẦN cho event/workflow/player-controls.js::runGatedSeek() — nhận node qua tham số (Rule 2), không
        // taskManager, không gọi hàm core khác.

        /**
         * Nối/ngắt NHÁNH RA LOA (`analyser` -> `destination`, cạnh DUY NHẤT tới loa trong graph — xem setupAudioContext()).
         * Ngắt = loa câm nhưng 2 analyser (đứng TRƯỚC điểm ngắt) VẪN nhận tín hiệu -> Workflow đo được lúc phần tiếng cũ
         * còn trong hàng đợi MediaElementSource của iOS chảy hết. KHÔNG thêm node nào vào graph. Ngắt khi chưa nối /
         * nối khi đã nối -> vô hại (Web Audio bỏ qua cạnh trùng, disconnect lỗi thì nuốt).
         * @param {AnalyserNode} analyser @param {AudioDestinationNode} destination @param {boolean} connected
         */
        function setAudioOutputConnected(analyser, destination, connected) {
            if (!analyser || !destination) return;
            if (connected) { analyser.connect(destination); return; }
            try { analyser.disconnect(destination); } catch (e) { /* chưa nối — bỏ qua */ }
        }

        /**
         * RMS tín hiệu thời gian hiện tại của 1 AnalyserNode (cửa sổ fftSize mẫu gần nhất).
         * @param {AnalyserNode} analyserNode @param {Float32Array} scratch - mảng tái dùng, dài >= fftSize
         * @returns {number}
         */
        function readAnalyserRms(analyserNode, scratch) {
            analyserNode.getFloatTimeDomainData(scratch);
            let sum = 0;
            for (let i = 0; i < analyserNode.fftSize; i++) sum += scratch[i] * scratch[i];
            return Math.sqrt(sum / analyserNode.fftSize);
        }
