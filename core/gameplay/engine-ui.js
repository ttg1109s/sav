/**
 * core/gameplay/engine-ui.js — ghi DOM dùng chung mọi mode Game: layer/đếm ngược, chữ tier nổi + hiệu ứng vỡ vụn, 2 dòng
 * điểm đếm-lên + breakdown tier của modal Kết quả (markup modal: components/gameplay-overlay.js). Không đọc appState, không
 * gọi core khác, không gắn listener.
 */

/** 1 khung đếm-lên 2 dòng điểm (main 3 số lẻ + sub thực/tổng). Modal đã đóng giữa chừng -> no-op. */
function renderScoreCountupFrame(mainValue, subValue, subMax) {
    const mainEl = document.getElementById('gameplay-score-main');
    const subEl = document.getElementById('gameplay-score-sub');
    if (mainEl) mainEl.textContent = mainValue.toFixed(3);
    if (subEl) subEl.textContent = `${subValue}/${subMax}`;
}

/** Ghi breakdown tier (1 lần lúc mở modal, không đếm-lên). */
function renderHitBreakdown(tierOrder, hitCounts) {
    for (const name of tierOrder) {
        const el = document.getElementById(`gameplay-hit-${name}`);
        if (el) el.textContent = String(hitCounts[name] || 0);
    }
}

/**
 * Chữ tier (PERFECT/…/MISS) nổi lên tại (x,y) px rồi tự gỡ khi CSS animation xong (`.gameplay-tier-popup`,
 * assets/css/gameplay.css) — chờ Promise `finished` của animation, không gắn listener. `comboStreak` > 1 -> "EXCELLENT x2",
 * chữ to + glow dần theo streak (`--combo-scale`, trần `cfg.comboPopupScaleMax`).
 */
async function showTapTierPopup(container, tierLabel, tierClassSuffix, x, y, comboStreak, cfg) {
    const anchor = document.createElement('div');
    anchor.className = 'gameplay-tier-popup-anchor';
    anchor.style.left = `${x}px`;
    anchor.style.top = `${y}px`;

    const el = document.createElement('div');
    el.className = `gameplay-tier-popup gameplay-tier-popup--${tierClassSuffix}`;
    if (comboStreak > 1) {
        el.textContent = `${tierLabel} x${comboStreak}`;
        el.style.setProperty('--combo-scale', Math.min(1 + (comboStreak - 1) * cfg.comboPopupScalePerStreak, cfg.comboPopupScaleMax));
        el.classList.add('gameplay-tier-popup--combo');
    } else {
        el.textContent = tierLabel;
    }
    anchor.appendChild(el);
    container.appendChild(anchor);

    await Promise.allSettled(anchor.getAnimations({ subtree: true }).map((a) => a.finished));
    anchor.remove();
}

/** Hiệu ứng vòng tròn vỡ vụn tại (x,y): mỗi mảnh bay theo `shards` (computeShatterShardLayout(), core/gameplay/engine.js),
 * gỡ cả cụm khi mọi mảnh xong animation (`.gameplay-shatter-shard`). @param {string} color - màu mảnh */
async function showShatterEffect(container, x, y, color, shards) {
    const anchor = document.createElement('div');
    anchor.className = 'gameplay-shatter-anchor';
    anchor.style.left = `${x}px`;
    anchor.style.top = `${y}px`;
    shards.forEach(({ angleDeg, distancePx }) => {
        const shard = document.createElement('span');
        shard.className = 'gameplay-shatter-shard';
        shard.style.background = color;
        shard.style.setProperty('--shard-angle', `${angleDeg}deg`);
        shard.style.setProperty('--shard-distance', `${distancePx}px`);
        anchor.appendChild(shard);
    });
    container.appendChild(anchor);

    await Promise.allSettled(anchor.getAnimations({ subtree: true }).map((a) => a.finished));
    anchor.remove();
}

function showGameplayLayer(layerEl) { layerEl.classList.remove('hidden'); }
function hideGameplayLayer(layerEl) { layerEl.classList.add('hidden'); }

/** Hiện/đổi số đếm ngược — chạy lại animation CSS bằng remove + reflow + add class. */
function showGameplayCountdown(screenEl, numberEl, value) {
    screenEl.classList.remove('hidden');
    numberEl.textContent = String(value);
    numberEl.classList.remove('is-pulsing');
    void numberEl.offsetWidth; // ép reflow để animation chạy lại từ đầu
    numberEl.classList.add('is-pulsing');
}
function hideGameplayCountdown(screenEl) { screenEl.classList.add('hidden'); }

/** Gán mode đang chơi lên `#gameplay-layer` (`data-game-mode`) — CSS (assets/css/gameplay-arrow.css) hiện stage Arrow hoặc
 * canvas + tap-surface Circle. Mỗi mode tự gọi lúc start(). */
function setGameplayLayerMode(layerEl, mode) {
    layerEl.dataset.gameMode = mode;
}

/** Ẩn/hiện thanh điều khiển phát nhạc đáy màn (#player-container nổi trên overlay Game) — mode Arrow cần đáy màn cho bàn
 * phím. Chỉ `visibility` (class `gameplay-controls-hidden`), không đụng class `hidden` của luồng điều hướng. */
function setGameplayPlayerBarHidden(playerContainerEl, hidden) {
    playerContainerEl.classList.toggle('gameplay-controls-hidden', hidden);
}
