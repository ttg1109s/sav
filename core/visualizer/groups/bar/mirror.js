/**
 * core/visualizer/groups/bar/mirror.js — [LÀM PHẲNG, 05/09/2026, yêu cầu Giang] Style 'mirror'
 * tách riêng khỏi `core/visualizer/types/bar.js` cũ (trước đây gộp chung với 'cascade'). Nội dung
 * hàm GIỮ NGUYÊN 100%. Phản chiếu — dải cánh bướm, số lượng thanh mỗi bên TÙY CHỈNH 10-32 qua
 * setting (vizConfig.mirrorBarCount, mặc định 32), mỗi bar đối xứng trên/dưới quanh centerY. KHÔNG
 * còn vòng tròn ở tâm (đã bỏ). Có một BAR TRUNG TÂM nhỏ ngay tại centerX, đập theo beat nhạc
 * (không tĩnh) — bar này cách bar gần nhất của mỗi dải đúng bằng khoảng hở TỰ THÂN giữa các bar
 * trong dải (cùng "nhịp" khoảng cách như mọi cặp bar liền kề khác, không phải số px cố định tùy
 * ý), nên trông liền mạch tự nhiên thay vì để hai dải dính thẳng vào nhau qua tâm hoặc cách nhau
 * một khoảng tùy hứng. Hai bên (trái/phải) ĐỐI XỨNG GƯƠNG thật qua tâm: tại cùng một khoảng cách
 * từ tâm, bên trái và bên phải dùng CÙNG một bin tần số (binLeft === binRight) nên độ cao bar luôn
 * bằng nhau hai bên — đúng nghĩa "phản chiếu". Slot GẦN tâm lấy bin CAO (treble), slot XA tâm (gần
 * mép màn hình) lấy bin THẤP (bass, biên độ thường lớn hơn) -> bar có xu hướng cao dần khi ra xa
 * tâm, giống nhau ở cả hai cánh.
 *
 * THUẦN, không side-effect, không đọc appState/getActiveEffectConfig (rà soát Rule 3) — Workflow
 * (`_tickBar()`, event/workflow/visualizer-render.js) tự gom state rồi gọi, tự resolve màu qua
 * `getComputedColor()` rồi gọi `paintBarRects()` (core/visualizer/groups/bar/common.js) cho từng
 * lô rect trả về.
 *
 * NẠP SAU: core/visualizer/groups/bar/common.js (không phụ thuộc hàm, chỉ để đọc thứ tự nhất quán).
 */
const BAR_MIRROR_COUNT_PER_SIDE = 32;

/**
 * Tính khung hình BAR MIRROR — THUẦN, không side-effect, không đọc appState/getActiveEffectConfig.
 * @returns {{ bars: {colorArgs:number[], rects:object[]}[], center: {colorArgs:number[], rects:object[]} }}
 */
function computeBarMirrorFrame(cfg, canvasWidth, canvasHeight, dpr, vizDataArray, maxBin, beatScale, smoothedEnergy) {
    const centerX = canvasWidth / 2, centerY = canvasHeight / 2;
    const halfWidth = canvasWidth / 2;
    const maxBarLen = cfg.maxH * dpr * 0.5;

    // Số lượng thanh mỗi bên: tùy chỉnh 10-32 qua setting (mirrorBarCount). Mặc định 32
    // (hành vi gốc) nếu chưa từng đặt.
    const barCount = Math.max(10, Math.min(32, cfg.mirrorBarCount || BAR_MIRROR_COUNT_PER_SIDE));

    // Bề rộng mỗi slot chia đều toàn bộ nửa màn hình cho barCount thanh. Độ rộng thật của
    // mỗi bar là slotW = barSlotWidth * barFillRatio (tuỳ chỉnh) -> khoảng hở TỰ THÂN giữa
    // 2 bar liền kề trong cùng một dải là gapW = barSlotWidth * (1 - barFillRatio).
    const barSlotWidth = halfWidth / barCount;
    const slotW = barSlotWidth * cfg.barFillRatio;
    const gapW = barSlotWidth - slotW;
    const cornerR = cfg.barCornerRadius * dpr;

    // BAR TRUNG TÂM chiếm phần giữa rộng slotW; lấy đúng gapW làm khoảng cách với bar gần
    // nhất của mỗi dải (cùng "nhịp" khoảng hở tự thân như các bar khác) -> toàn bộ dải
    // trái/phải dịch ra xa tâm thêm (slotW/2 + gapW) so với khi không có bar trung tâm.
    const centerOffset = slotW / 2 + gapW;

    const bars = [];
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
        const len = val ? (val / 255) * maxBarLen : 0;

        const rx = centerX + distFromCenter;
        const lx = centerX - distFromCenter - slotW;

        bars.push({
            colorArgs: [i, barCount, val],
            rects: [
                { x: rx, y: centerY - len, w: slotW, h: len, cornerR },
                { x: rx, y: centerY, w: slotW, h: len, cornerR },
                { x: lx, y: centerY - len, w: slotW, h: len, cornerR },
                { x: lx, y: centerY, w: slotW, h: len, cornerR },
            ],
        });
    }

    // BAR TRUNG TÂM — nhỏ mặc định, đập theo beat nhạc thật (beatScale, không tĩnh). Cộng
    // một sàn nhỏ (minH) để luôn hiện hình ngay cả khi không có nhạc/biên độ = 0, cộng
    // thêm theo beatScale + smoothedEnergy (tỉ lệ centerBarBeatRatio, tuỳ chỉnh) để nhảy
    // động giống cách vòng tròn cũ từng đập.
    const centerScaledMinH = cfg.minH * dpr;
    const beatRatio = cfg.centerBarBeatRatio;
    const centerLen = centerScaledMinH + beatScale * maxBarLen * beatRatio + smoothedEnergy * maxBarLen * (1 - beatRatio);
    const center = {
        colorArgs: [0, barCount, Math.round(beatScale * 255)],
        rects: [
            { x: centerX - slotW / 2, y: centerY - centerLen, w: slotW, h: centerLen, cornerR },
            { x: centerX - slotW / 2, y: centerY, w: slotW, h: centerLen, cornerR },
        ],
    };

    return { bars, center };
}
