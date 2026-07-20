/**
 * Tính màu sắc theo dữ liệu tần số (getComputedColor) & cập nhật bảng thống kê BPM / Pitch / Energy.
 * (Trích từ file gốc, dòng 1016-1065 trong khối <script>)
 *
 * FIX (ver 10 refine, bổ sung — toggle ẩn/hiện dải BPM/Pitch/Energy, xem stats-panel-toggle.js):
 * mọi dòng ghi statBpm/statNote/statEnergy.textContent dưới đây đều bọc thêm điều kiện
 * `isStatsPanelVisible &&` ở ĐẦU — khi dải bị ẩn, bỏ qua đúng phần thao tác DOM đó (đỡ work vô
 * nghĩa khi không ai nhìn thấy), nhưng KHÔNG đụng tới phần TÍNH TOÁN logic phía sau (beatTimes/
 * fluxHistory/currentCalculatedBpm/rubikPitchAvg...) — các giá trị này được visual Rubik dùng,
 * phải tiếp tục chạy đúng bất kể dải số liệu có hiện hay không.
 */
        /**
         * MỚI (20/07/2026, plan-space-galaxy.md Phần A, mục A3) — 3 hàm Core THUẦN tách ra từ
         * đoạn tính `beatScale`/`smoothedEnergy`/`globalHueOffset` TRƯỚC ĐÂY nằm thẳng trong vòng
         * lặp `drawVisualizer()` (core/visualizer/draw-visualizer.js, nay đã RỖNG — logic dời sang
         * `event/workflow/visualizer-render.js::_tick()`). Mỗi hàm 1 việc, CHỈ nhận tham số, KHÔNG
         * tự `appState.get()` (Rule 2) — Workflow tự đọc appState rồi truyền vào, tự
         * `appState.set(..., { skipCheck: true })` lại kết quả trả về (hot path 60fps, MIỄN Rule 4
         * console.log — đúng ngoại lệ đã ghi ở `core-function-conventions.md` Rule 4).
         */

        /** Trung bình biên độ dải bass (bassCount phần tử đầu của vizDataArray), chuẩn hoá 0-1. */
        function computeBeatScale(vizDataArray, bassCount) {
            let bassSum = 0;
            for (let i = 0; i < bassCount; i++) bassSum += vizDataArray[i];
            return (bassSum / bassCount) / 255;
        }

        /** Làm mượt beatScale theo thời gian (EMA hệ số 0.15) — dùng cho mọi hiệu ứng cần phản ứng
         * "mượt" với nhạc thay vì giật theo từng khung hình thô. */
        function computeSmoothedEnergy(beatScale, prevSmoothedEnergy) {
            return prevSmoothedEnergy + (beatScale - prevSmoothedEnergy) * 0.15;
        }

        /** Tiến hue-cycle 1 bước (chỉ khi đang phát) — guard clause thuần (KHÔNG phải rẽ nhánh 2
         * tiến trình khác nhau theo Rule 1: xoá nhánh `if` đi, hàm vẫn còn ĐÚNG 1 kịch bản "tiến
         * hue", chỉ mất phần "dừng sớm nếu không phát nhạc"). */
        function computeNextGlobalHueOffset(current, beatScale, isPlaying) {
            if (!isPlaying) return current;
            return (current + 0.5 + (beatScale * 5)) % 360;
        }

        function getComputedColor(i, totalLength, dataValue) {
            const cfg = appState.get('vizConfig');
            if (cfg.mode === 'dynamic') return { fill: interpolateColor(cfg.dynA, cfg.dynB, i / totalLength), glow: interpolateColor(cfg.dynA, cfg.dynB, i / totalLength) };
            else if (cfg.mode === 'gradient') {
                let baseHue = (appState.get('globalHueOffset') + (i / totalLength) * 240) % 360;
                let finalHue = (baseHue + (dataValue / 255) * 80) % 360; let lightness = 40 + (dataValue / 255) * 30;
                return { fill: `hsla(${finalHue}, ${70 + (dataValue/255)*30}%, ${lightness}%, 0.9)`, glow: `hsl(${finalHue}, 100%, ${lightness+15}%)` };
            } else return { fill: cfg.solidColor, glow: cfg.solidColor };
        }

        function updateStatsDashboard(bufferLength) {
            const now = Date.now();
            let totalAmplitude = 0; let currentFlux = 0;
            const vizDataArray = appState.get('vizDataArray');
            const previousSpectrumArray = appState.get('previousSpectrumArray');
            for(let i=0; i<bufferLength; i++) {
                totalAmplitude += vizDataArray[i]; let diff = vizDataArray[i] - previousSpectrumArray[i];
                if (diff > 0) currentFlux += diff; previousSpectrumArray[i] = vizDataArray[i]; 
            }
            
            let energyPercent = Math.min(100, Math.round(((totalAmplitude / bufferLength) / 255) * 100 * 1.5)); 
            if (appState.get('isStatsPanelVisible')) statEnergy.textContent = energyPercent + '%'; 
            
            let isPlaying = !audioPlayer.paused && audioPlayer.currentTime > 0;

            if(isPlaying) {
                appState.mutate('fluxHistory', arr => { arr.push(currentFlux); if(arr.length > 45) arr.shift(); }, { skipCheck: true });
                const fluxHistory = appState.get('fluxHistory');
                let sumFlux = 0; for (let i=0; i<fluxHistory.length; i++) sumFlux += fluxHistory[i];
                runningFluxMean = sumFlux / fluxHistory.length; let fluxThreshold = runningFluxMean * 1.3;

                if (currentFlux > fluxThreshold && currentFlux > 150 && (now - lastBeatTime > APP_CONFIG.bpmMinWaitTime)) {
                    if (lastBeatTime > 0) { appState.mutate('beatTimes', arr => { arr.push(now - lastBeatTime); if (arr.length > 5) arr.shift(); }, { skipCheck: true }); }
                    lastBeatTime = now;
                    const beatTimes = appState.get('beatTimes');
                    if (beatTimes.length >= 2) {
                        let avgInterval = beatTimes.reduce((a, b) => a + b) / beatTimes.length;
                        let calcBpm = Math.round(60000 / avgInterval);
                        if (calcBpm > 40 && calcBpm < 220) appState.set('currentCalculatedBpm', calcBpm.toString(), { skipCheck: true });
                    }
                }
                if (appState.get('isStatsPanelVisible')) statBpm.textContent = appState.get('currentCalculatedBpm');

                if (energyPercent > 1) { 
                    const pitchTimeDomainArray = appState.get('pitchTimeDomainArray');
                    appState.get('analyserPitch').getFloatTimeDomainData(pitchTimeDomainArray);
                    // v7: YIN chạy trên Worker riêng (xem audio-engine.js) — gửi buffer đi (không
                    // chờ), rồi dùng NGAY kết quả mới nhất worker đã trả (latestPitchFrequency, có
                    // thể trễ vài khung hình so với buffer vừa gửi). Độ trễ này cộng dồn trên nền trễ
                    // vốn có của YIN (cần buffer ~46ms mới phân tích được) nên không cảm nhận được.
                    requestPitchDetection(pitchTimeDomainArray, appState.get('audioContext').sampleRate);
                    let frequency = appState.get('latestPitchFrequency');
                    if (frequency > 0) {
                        let midiNote = Math.round(12 * Math.log2(frequency / 440)) + 69;
                        if (midiNote > 0 && midiNote < 128) {
                            const noteStr = `${noteNames[midiNote % 12]}${Math.floor(midiNote / 12) - 1}`;
                            appState.set('lastValidNoteStr', noteStr, { skipCheck: true });
                            appState.set('lastValidNoteTime', now, { skipCheck: true });
                            if (appState.get('isStatsPanelVisible')) statNote.textContent = noteStr;
                            appState.set('lastValidMidiNote', midiNote, { skipCheck: true });
                            // Cập nhật pha tham chiếu (nốt trung bình động) cho visual Rubik — xoay tự
                            // thân sẽ so nốt hiện tại với pha này để quyết định nhanh/chậm. KHÔNG bọc
                            // isStatsPanelVisible — phải luôn tính dù dải số liệu có ẩn hay không.
                            appState.mutate('rubikPitchHistory', arr => { arr.push(midiNote); if (arr.length > 30) arr.shift(); }, { skipCheck: true });
                            const rubikPitchHistory = appState.get('rubikPitchHistory');
                            appState.set('rubikPitchAvg', rubikPitchHistory.reduce((a, b) => a + b, 0) / rubikPitchHistory.length, { skipCheck: true });
                        }
                    } else if (appState.get('lastValidNoteStr') && (now - appState.get('lastValidNoteTime') < 250)) { if (appState.get('isStatsPanelVisible')) statNote.textContent = appState.get('lastValidNoteStr');
                    } else { if (appState.get('isStatsPanelVisible')) statNote.textContent = "---"; }
                } else { if (appState.get('isStatsPanelVisible')) statNote.textContent = "---"; }
            } else { appState.set('currentCalculatedBpm', "---", { skipCheck: true }); if (appState.get('isStatsPanelVisible')) { statBpm.textContent = "---"; statNote.textContent = "---"; } }
        }