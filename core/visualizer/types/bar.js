/**
 * Visual BAR — gộp 2 kiểu (trước đây là 2 visual riêng: "bar" và "synthesia"):
 *   - barStyle 'mirror'  : Phản chiếu — dải cánh bướm, số lượng thanh mỗi bên TÙY CHỈNH 10-32
 *     qua setting (vizConfig.mirrorBarCount, mặc định 32), mỗi bar đối xứng trên/dưới quanh
 *     centerY. KHÔNG còn vòng tròn ở tâm (đã bỏ). Có một BAR TRUNG TÂM nhỏ ngay tại centerX, đập
 *     theo beat nhạc (không tĩnh) — bar này cách bar gần nhất của mỗi dải đúng bằng khoảng hở TỰ
 *     THÂN giữa các bar trong dải (cùng "nhịp" khoảng cách như mọi cặp bar liền kề khác, không
 *     phải số px cố định tùy ý), nên trông liền mạch tự nhiên thay vì để hai dải dính thẳng vào
 *     nhau qua tâm hoặc cách nhau một khoảng tùy hứng. Hai bên (trái/phải) ĐỐI XỨNG GƯƠNG thật
 *     qua tâm: tại cùng một khoảng cách từ tâm, bên trái và bên phải dùng CÙNG một bin tần số
 *     (binLeft === binRight) nên độ cao bar luôn bằng nhau hai bên — đúng nghĩa "phản chiếu".
 *     Slot GẦN tâm lấy bin CAO (treble), slot XA tâm (gần mép màn hình) lấy bin THẤP (bass, biên
 *     độ thường lớn hơn) -> bar có xu hướng cao dần khi ra xa tâm, giống nhau ở cả hai cánh.
 *   - barStyle 'cascade' : Thác đổ — giữ nguyên cách vẽ của visual "synthesia" cũ (các "phím" rơi
 *     xuống đáy màn hình theo tần số). Độ dày mỗi phím tự tính theo độ rộng slot của bố cục 64
 *     phím, KHÔNG còn phụ thuộc setting "Độ dày thanh" (cùng lý do với 'mirror' ở trên).
 */
        const BAR_MIRROR_COUNT_PER_SIDE = 32;

        function drawBarMirror(ctx, perf) {
            const cfg = getActiveEffectConfig(); // core/custom-effect.js
            const dpr = appState.get('dpr');
            const vizDataArray = appState.get('vizDataArray');
            const centerX = canvas.width / 2, centerY = canvas.height / 2;
            const halfWidth = canvas.width / 2;
            const maxBarLen = cfg.maxH * dpr * 0.5;

            // Số lượng thanh mỗi bên: tùy chỉnh 10-32 qua setting (mirrorBarCount). Mặc định 32
            // (hành vi gốc) nếu chưa từng đặt.
            const barCount = Math.max(10, Math.min(32, cfg.mirrorBarCount || BAR_MIRROR_COUNT_PER_SIDE));

            // Bề rộng mỗi slot chia đều toàn bộ nửa màn hình cho barCount thanh. Độ rộng thật của
            // mỗi bar là slotW = barSlotWidth * 0.6 -> khoảng hở TỰ THÂN giữa 2 bar liền kề trong
            // cùng một dải là gapW = barSlotWidth * 0.4 (phần còn lại của slot).
            const barSlotWidth = halfWidth / barCount;
            const slotW = barSlotWidth * 0.6;
            const gapW = barSlotWidth - slotW;
            const maxBin = appState.get('analyser').frequencyBinCount * 0.5;

            // BAR TRUNG TÂM chiếm phần giữa rộng slotW; lấy đúng gapW làm khoảng cách với bar gần
            // nhất của mỗi dải (cùng "nhịp" khoảng hở tự thân như các bar khác) -> toàn bộ dải
            // trái/phải dịch ra xa tâm thêm (slotW/2 + gapW) so với khi không có bar trung tâm.
            const centerOffset = slotW / 2 + gapW;

            for (let i = 0; i < barCount; i++) {
                // Khoảng cách từ tâm tới vị trí slot hiện tại (cùng khoảng cho cả trái và phải).
                const distFromCenter = centerOffset + i * barSlotWidth;

                // ĐỐI XỨNG GƯƠNG THẬT: cùng khoảng cách từ tâm (cùng chỉ số slot i) -> cùng một
                // bin tần số cho cả hai bên (binLeft === binRight luôn). Slot GẦN tâm (i nhỏ) lấy
                // bin CAO (treble), slot XA tâm (i lớn, gần mép màn hình) lấy bin THẤP (bass). Vì
                // bass thường có biên độ lớn hơn treble, kết quả là bar XA tâm cao hơn, bar GẦN
                // tâm thấp hơn — đúng ý đồ ban đầu.
                const bin = Math.floor(((barCount - 1 - i) / barCount) * maxBin);
                const val = vizDataArray[bin] || 0;
                let len = val ? (val / 255) * maxBarLen : 0;

                const rx = centerX + distFromCenter;
                const lx = centerX - distFromCenter - slotW;

                const colors = getComputedColor(i, barCount, val);
                ctx.shadowBlur = 15 * dpr * perf.blurMult;
                ctx.shadowColor = perf.blurMult > 0 ? colors.glow : 'transparent';
                ctx.fillStyle = colors.fill;
                // Bên phải
                ctx.beginPath(); ctx.roundRect(rx, centerY - len, slotW, len, 3 * dpr); ctx.fill();
                ctx.beginPath(); ctx.roundRect(rx, centerY, slotW, len, 3 * dpr); ctx.fill();
                // Bên trái (gương — cùng giá trị len, cùng màu)
                ctx.beginPath(); ctx.roundRect(lx, centerY - len, slotW, len, 3 * dpr); ctx.fill();
                ctx.beginPath(); ctx.roundRect(lx, centerY, slotW, len, 3 * dpr); ctx.fill();
            }
            ctx.shadowBlur = 0;

            // BAR TRUNG TÂM — nhỏ mặc định, đập theo beat nhạc thật (beatScale, không tĩnh). Cộng
            // một sàn nhỏ (minH) để luôn hiện hình ngay cả khi không có nhạc/biên độ = 0, cộng
            // thêm theo beatScale + smoothedEnergy để nhảy động giống cách vòng tròn cũ từng đập.
            const centerScaledMinH = cfg.minH * dpr;
            const beatScale = appState.get('beatScale');
            const centerLen = centerScaledMinH + beatScale * maxBarLen * 0.7 + appState.get('smoothedEnergy') * maxBarLen * 0.3;
            const centerColors = getComputedColor(0, barCount, Math.round(beatScale * 255));
            ctx.shadowBlur = 15 * dpr * perf.blurMult;
            ctx.shadowColor = perf.blurMult > 0 ? centerColors.glow : 'transparent';
            ctx.fillStyle = centerColors.fill;
            ctx.beginPath(); ctx.roundRect(centerX - slotW / 2, centerY - centerLen, slotW, centerLen, 3 * dpr); ctx.fill();
            ctx.beginPath(); ctx.roundRect(centerX - slotW / 2, centerY, slotW, centerLen, 3 * dpr); ctx.fill();
            ctx.shadowBlur = 0;
        }

        function drawBarCascade(ctx, perf) {
            // Logic gốc của visual "synthesia" cũ — các "phím" trải đều theo chiều ngang, mỗi
            // phím rơi từ trên xuống đáy màn hình theo cường độ tần số tương ứng. Độ dày mỗi phím
            // không còn lấy từ setting "Độ dày thanh" (setting đó giờ chỉ dùng cho Black Hole) —
            // thay vào đó tự tính theo độ rộng slot (kw) để luôn khớp đều với bố cục 64 phím.
            const cfg = getActiveEffectConfig(); // core/custom-effect.js
            const dpr = appState.get('dpr');
            const vizDataArray = appState.get('vizDataArray');
            const scaledMinH = cfg.minH * dpr;
            const keysY = canvas.height; const NUM_KEYS = 64; const keyWidth = canvas.width / NUM_KEYS;
            for(let i=0; i<NUM_KEYS; i++) {
                let val = vizDataArray[i + 5] || 0; let finalHeight = scaledMinH + ((val / 255) * cfg.maxH * dpr);
                let kx = i * keyWidth; let kw = keyWidth * 0.8; let cx = kx + kw/2; const colors = getComputedColor(i, NUM_KEYS, val);
                ctx.shadowBlur = 10 * dpr * perf.blurMult; ctx.shadowColor = perf.blurMult > 0 ? colors.glow : 'transparent';
                ctx.fillStyle = colors.fill; ctx.globalAlpha = 0.2; ctx.fillRect(cx - kw/2, keysY - finalHeight, kw, finalHeight);
                ctx.globalAlpha = 1.0; ctx.beginPath(); ctx.roundRect(cx - kw/2, keysY - finalHeight, kw, Math.max(5, finalHeight * 0.1), 2*dpr); ctx.fill();
            }
            ctx.shadowBlur = 0;
        }

        function drawBar(ctx, perf) {
            if (getActiveEffectConfig().barStyle === 'cascade') drawBarCascade(ctx, perf);
            else drawBarMirror(ctx, perf);
        }
