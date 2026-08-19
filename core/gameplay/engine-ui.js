/**
 * core/gameplay/engine-ui.js — Core-ui (Rule 5c, hậu tố `-ui`) DÙNG CHUNG mọi mode Game: bộ chọn
 * độ khó, sao kết quả, vòng tròn % điểm (nhiều lap màu khác nhau khi >100%), khung body modal kết
 * thúc. TOÀN BỘ hàm CHỈ dựng chuỗi HTML/SVG hoặc ghi text thuần vào element có sẵn — KHÔNG
 * `addEventListener` (việc gắn tương tác + đọc/ghi `appState` là của Workflow, xem
 * event/workflow/gameplay-engine.js), KHÔNG `appState.get()` (Rule 2).
 */

/** Bộ chọn độ khó (3 nút easy/medium/hard) + 1 dòng hint mô tả CƠ CHẾ khác nhau thật sự giữa các
 * độ khó (không chỉ tên gọi) — cập nhật khi đổi lựa chọn (Workflow tự wire, xem
 * event/workflow/gameplay-engine.js::_wireDifficultySelector()). [MỚI — cải tiến modal Start,
 * phản hồi Giang] trước đây modal không giải thích gì về khác biệt độ khó ngoài 3 cái tên. */
function buildDifficultySelectorHtml(currentDifficulty, t) {
    const levels = ['easy', 'medium', 'hard'];
    const buttons = levels.map((level) => {
        const active = level === currentDifficulty ? 'ring-2 ring-sky-400 bg-sky-500/20' : 'bg-slate-800 hover:bg-slate-700';
        return `<button type="button" data-difficulty="${level}" class="gameplay-difficulty-btn py-2 rounded-lg text-xs font-semibold transition-colors ${active}">${t('gameplayCircle.difficulty.' + level)}</button>`;
    }).join('');
    return `<div class="grid grid-cols-3 gap-2">${buttons}</div>` +
        `<p class="text-xs text-slate-400 text-center mt-2" id="gameplay-difficulty-hint">${t('gameplayCircle.difficulty.hint.' + currentDifficulty)}</p>`;
}

/** Vòng tròn % điểm — mỗi lap (core/gameplay/engine.js::computeScoreRingLaps()) 1 `<circle>` bán
 * kính giảm dần, màu riêng theo `palette` (cycle nếu nhiều lap hơn palette). `--ring-circumference`
 * (điểm xuất phát, rỗng hoàn toàn) và `--ring-target` (đích) là 2 CSS custom property đọc bởi
 * @keyframes gameplayRingFill (assets/css/gameplay.css) — animation tự chạy ngay khi DOM chèn xong,
 * KHÔNG cần JS toggle class. */
function buildScoreRingSvg(laps, palette) {
    const size = 120, cx = 60, cy = 60, baseRadius = 52, radiusStep = 11, strokeWidth = 7;
    const circles = laps.map((percent, i) => {
        const r = baseRadius - i * radiusStep;
        const circumference = 2 * Math.PI * r;
        const target = circumference * (1 - percent / 100);
        const color = palette[i % palette.length];
        const delayMs = i * 220;
        return `<circle class="gameplay-ring-track" cx="${cx}" cy="${cy}" r="${r}" stroke-width="${strokeWidth}"></circle>` +
            `<circle class="gameplay-ring-fill" cx="${cx}" cy="${cy}" r="${r}" stroke-width="${strokeWidth}" stroke="${color}" ` +
            `stroke-dasharray="${circumference} ${circumference}" stroke-dashoffset="${circumference}" ` +
            `style="--ring-circumference:${circumference};--ring-target:${target};animation-delay:${delayMs}ms" ` +
            `transform="rotate(-90 ${cx} ${cy})"></circle>`;
    }).join('');
    return `<svg class="gameplay-score-ring" viewBox="0 0 ${size} ${size}">${circles}</svg>`;
}

/** Khung body modal kết thúc — vòng tròn % (SVG, dựng qua buildScoreRingSvg()) LÀM NỀN, 2 dòng
 * điểm số (float chính to + thực/tổng nhỏ, cả 2 do Workflow tự chạy count-up sau khi mở modal qua
 * renderScoreCountupFrame()) chồng GIỮA vòng tròn, sao + breakdown tier bên dưới. KHÔNG có tiêu đề
 * (phản hồi Giang — nội dung tự thân đã rõ ngữ nghĩa). */
function buildResultBodyHtml({ ringSvg, starMax, starRating, hitCounts, tierOrder, tierLabels }) {
    const stars = Array.from({ length: starMax }, (_, i) => {
        const lit = i < starRating;
        return `<span class="gameplay-star${lit ? ' gameplay-star--lit' : ''}" style="animation-delay:${i * 180}ms">★</span>`;
    }).join('');

    const hitGrid = tierOrder.map((name) => `
        <div>
            <div class="font-mono font-bold text-white" id="gameplay-hit-${name}">0</div>
            <div class="text-[10px] text-slate-500">${tierLabels[name]}</div>
        </div>
    `).join('');

    return `
        <div class="flex flex-col items-center gap-3">
            <div class="relative w-[120px] h-[120px]">
                ${ringSvg}
                <div class="absolute inset-0 flex flex-col items-center justify-center">
                    <div class="font-mono text-2xl font-bold text-white" id="gameplay-score-main">0.000</div>
                    <div class="font-mono text-xs text-slate-400" id="gameplay-score-sub">0/0</div>
                </div>
            </div>
            <div class="flex gap-1 text-2xl">${stars}</div>
            <div class="grid grid-cols-5 gap-2 text-center w-full pt-2 border-t border-white/10">${hitGrid}</div>
        </div>
    `;
}

/** 1 khung hình count-up — ghi thẳng text 2 dòng điểm (main float + sub thực/tổng) VÀ breakdown
 * tier (nếu `hitCounts` có truyền — chỉ cần ghi 1 lần lúc cuối, không cần animate riêng). Element
 * không tồn tại (modal đã đóng giữa chừng — hiếm, người dùng bấm nút khác quá nhanh) -> no-op. */
function renderScoreCountupFrame(mainValue, subValue, subMax) {
    const mainEl = document.getElementById('gameplay-score-main');
    const subEl = document.getElementById('gameplay-score-sub');
    if (mainEl) mainEl.textContent = mainValue.toFixed(3);
    if (subEl) subEl.textContent = `${subValue}/${subMax}`;
}

/** Ghi breakdown hit-tier (perfect/excellent/good/bad/miss) — gọi 1 LẦN lúc mở modal, KHÔNG cần
 * animate (số nguyên nhỏ, count-up không thêm giá trị cảm nhận). */
function renderHitBreakdown(tierOrder, hitCounts) {
    for (const name of tierOrder) {
        const el = document.getElementById(`gameplay-hit-${name}`);
        if (el) el.textContent = String(hitCounts[name] || 0);
    }
}

/** Hiện text tier (PERFECT/EXCELLENT/.../MISS) thoáng qua tại (x,y) rồi tự dọn (CSS animation, xem
 * assets/css/gameplay.css .gameplay-tier-popup) — `addEventListener` CHỈ để tự remove() phần tử
 * vừa tạo (Rule 5a). x/y là PX THẬT khớp hệ toạ độ canvas gọi hàm này. */
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

/** HUD combo góc màn hình — điểm số không hiện lúc đang chơi, chỉ ở modal kết thúc. */
function updateGameplayHud(hudComboEl, comboStreak) {
    hudComboEl.textContent = comboStreak > 1 ? `x${comboStreak}` : '';
}

/** Cập nhật dòng hint mô tả cơ chế độ khó — gọi khi mở modal Start lẫn lúc đổi lựa chọn. */
function renderDifficultyHint(difficulty, t) {
    const hintEl = document.getElementById('gameplay-difficulty-hint');
    if (hintEl) hintEl.textContent = t('gameplayCircle.difficulty.hint.' + difficulty);
}

function showGameplayLayer(layerEl) { layerEl.classList.remove('hidden'); }
function hideGameplayLayer(layerEl) { layerEl.classList.add('hidden'); }

/** Hiện/đổi số đếm ngược — retrigger animation CSS bằng remove+reflow+add class (thuần đồng bộ). */
function showGameplayCountdown(screenEl, numberEl, value) {
    screenEl.classList.remove('hidden');
    numberEl.textContent = String(value);
    numberEl.classList.remove('is-pulsing');
    void numberEl.offsetWidth; // ép reflow để animation chạy lại từ đầu
    numberEl.classList.add('is-pulsing');
}
function hideGameplayCountdown(screenEl) { screenEl.classList.add('hidden'); }
