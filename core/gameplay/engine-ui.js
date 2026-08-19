/**
 * core/gameplay/engine-ui.js — Core-ui (Rule 5c, hậu tố `-ui`) DÙNG CHUNG mọi mode Game: bộ chọn
 * độ khó, sao kết quả, vòng tròn % điểm (nhiều lap màu khác nhau khi >100%), khung body modal kết
 * thúc. TOÀN BỘ hàm CHỈ dựng chuỗi HTML/SVG hoặc ghi text thuần vào element có sẵn — KHÔNG
 * `addEventListener` (việc gắn tương tác + đọc/ghi `appState` là của Workflow, xem
 * event/workflow/gameplay-engine.js), KHÔNG `appState.get()` (Rule 2).
 */

/** Bộ chọn độ khó (3 nút easy/medium/hard) — icon minh hoạ ĐÚNG cơ chế thật (số vòng tròn ứng với
 * maxConcurrentWaves: Easy 1 vòng, Medium 2 vòng chồng, Hard ∞ — GAMEPLAY_CIRCLE_CONFIG.difficulty,
 * service/state/gameplay-runtime.js), màu accent riêng từng độ khó (xanh lá/cam/đỏ — quy ước màu độ
 * khó phổ biến), khối mô tả RIÊNG bên dưới (box nền + viền, không còn 1 dòng chữ trần) — cập nhật
 * khi đổi lựa chọn (Workflow tự wire, xem event/workflow/gameplay-engine.js::
 * _wireDifficultySelector()). [SỬA — cải tiến UI, phản hồi Giang] nút cũ chỉ có chữ, không icon,
 * không màu riêng, spacing hẹp — giờ mỗi nút là 1 khối vuông icon+nhãn, gap/padding rộng rãi hơn.
 *
 * Class Tailwind viết TƯỜNG MINH cho từng độ khó (KHÔNG nội suy `${accent}` vào giữa tên class) —
 * dù CDN Play (index.html) quét lại DOM sau khi chèn nên nội suy động nhiều khả năng vẫn ăn màu,
 * đây là hành vi KHÔNG có tiền lệ nào khác trong toàn project dùng, tránh rủi ro im lặng render sai
 * màu mà không cách nào phát hiện ngoài trình duyệt thật. */
function buildDifficultySelectorHtml(currentDifficulty, t) {
    const levels = Object.freeze([
        Object.freeze({
            level: 'easy', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="7"/></svg>',
            active: 'border-emerald-400 bg-emerald-500/15 text-emerald-300',
        }),
        Object.freeze({
            level: 'medium', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="12" r="6.5"/><circle cx="15" cy="12" r="6.5"/></svg>',
            active: 'border-amber-400 bg-amber-500/15 text-amber-300',
        }),
        Object.freeze({
            level: 'hard', icon: '<span class="text-xl leading-none">∞</span>',
            active: 'border-rose-400 bg-rose-500/15 text-rose-300',
        }),
    ]);
    const inactive = 'border-white/10 bg-slate-800/80 text-slate-400 hover:border-white/20 hover:bg-slate-800';
    const buttons = levels.map(({ level, icon, active }) => {
        const stateClass = level === currentDifficulty ? active : inactive;
        return `<button type="button" data-difficulty="${level}" class="gameplay-difficulty-btn flex flex-col items-center justify-center gap-1.5 px-3 py-3.5 rounded-xl border-2 transition-colors ${stateClass}">` +
            `<span class="w-6 h-6">${icon}</span>` +
            `<span class="text-xs font-semibold">${t('gameplayCircle.difficulty.' + level)}</span>` +
            `</button>`;
    }).join('');
    return `<div id="gameplay-difficulty-selector">` +
        `<div class="grid grid-cols-3 gap-3">${buttons}</div>` +
        `<div class="mt-3 px-3.5 py-2.5 rounded-lg bg-slate-800/60 border border-white/5">` +
        `<p class="text-xs text-slate-300 text-center leading-relaxed" id="gameplay-difficulty-hint">${t('gameplayCircle.difficulty.hint.' + currentDifficulty)}</p>` +
        `</div>` +
        `</div>`;
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

/** Khung body modal kết thúc — khối thông tin (title/thời lượng/độ khó/số lượt chơi ĐÚNG độ khó
 * này) TRÊN CÙNG, vòng tròn % (SVG, dựng qua buildScoreRingSvg()) LÀM NỀN, 2 dòng điểm số (float
 * chính to + thực/tổng nhỏ, cả 2 do Workflow tự chạy count-up sau khi mở modal qua
 * renderScoreCountupFrame()) chồng GIỮA vòng tròn, sao + breakdown tier bên dưới. KHÔNG có tiêu đề
 * (phản hồi Giang — nội dung tự thân đã rõ ngữ nghĩa). */
function buildResultBodyHtml({ ringSvg, starMax, starRating, hitCounts, tierOrder, tierLabels, title, durationLabel, difficultyLabel, playCountLabel }) {
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
            <div class="w-full text-center">
                <div class="text-sm font-semibold text-white truncate px-2">${title}</div>
                <div class="text-xs text-slate-400 mt-0.5">${durationLabel} · ${difficultyLabel} · ${playCountLabel}</div>
            </div>
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
 * vừa tạo (Rule 5a). x/y là PX THẬT khớp hệ toạ độ canvas gọi hàm này.
 *
 * [SỬA — phản hồi Giang "bỏ x Combo cố định, x combo ngay tại vị trí bay lên"] `comboStreak` (MỚI,
 * >1 mới hiện — streak RIÊNG của tier đó, xem computeComboScoreGain() core/gameplay/engine.js) gắn
 * NGAY vào popup ("EXCELLENT x2") thay vì 1 số riêng ở HUD góc màn hình (ĐÃ XOÁ). Chữ phóng to +
 * glow mạnh dần theo streak (`--combo-scale`, CSS đọc ở .gameplay-tier-popup--combo), trần
 * `cfg.comboPopupScaleMax` tránh chữ khổng lồ lúc streak rất cao. */
function showTapTierPopup(container, tierLabel, tierClassSuffix, x, y, comboStreak, cfg) {
    const anchor = document.createElement('div');
    anchor.className = 'gameplay-tier-popup-anchor';
    anchor.style.left = `${x}px`;
    anchor.style.top = `${y}px`;

    const el = document.createElement('div');
    el.className = `gameplay-tier-popup gameplay-tier-popup--${tierClassSuffix}`;
    if (comboStreak > 1) {
        el.textContent = `${tierLabel} x${comboStreak}`;
        const scale = Math.min(1 + (comboStreak - 1) * cfg.comboPopupScalePerStreak, cfg.comboPopupScaleMax);
        el.style.setProperty('--combo-scale', scale);
        el.classList.add('gameplay-tier-popup--combo');
    } else {
        el.textContent = tierLabel;
    }
    anchor.appendChild(el);
    container.appendChild(anchor);

    el.addEventListener('animationend', () => anchor.remove());
}

/** Hiệu ứng vòng tròn vỡ vụn — N mảnh nhỏ bay toả ra từ (x,y) rồi tự dọn (CSS animation). Gọi lúc
 * tap hoàn thành (chạm đúng note) HOẶC wave tự hết hạn (miss) — `color` khác nhau theo nơi gọi
 * (màu wave thật lúc tap trúng, màu đỏ cố định lúc miss, xem event/workflow/gameplay.js).
 * `addEventListener` CHỈ để tự remove() phần tử vừa tạo (Rule 5a) — đếm đủ N mảnh xong animation
 * mới remove() anchor (mỗi mảnh tự bắn animationend riêng, KHÔNG đợi mảnh chậm nhất qua timer). */
function showShatterEffect(container, x, y, color) {
    const anchor = document.createElement('div');
    anchor.className = 'gameplay-shatter-anchor';
    anchor.style.left = `${x}px`;
    anchor.style.top = `${y}px`;

    const shardCount = 8;
    let remaining = shardCount;
    for (let i = 0; i < shardCount; i++) {
        const angle = (360 / shardCount) * i + (Math.random() * 20 - 10);
        const distance = 26 + Math.random() * 14;
        const shard = document.createElement('span');
        shard.className = 'gameplay-shatter-shard';
        shard.style.background = color;
        shard.style.setProperty('--shard-angle', `${angle}deg`);
        shard.style.setProperty('--shard-distance', `${distance}px`);
        shard.addEventListener('animationend', () => {
            remaining--;
            if (remaining <= 0) anchor.remove();
        });
        anchor.appendChild(shard);
    }
    container.appendChild(anchor);
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
