/**
 * core/gameplay/game-panel-ui.js — MỚI (02/09/2026, Giang yêu cầu "nối game mode vào game overlay
 * đang coming soon"). Core-ui (Rule 5c, hậu tố `-ui`) DÙNG CHUNG cho Game Panel (App Panel tab
 * "Game" — THAY hẳn placeholder "coming soon" cũ, xem components/game-panel.js). Hàm CHỈ dựng
 * chuỗi HTML — KHÔNG `addEventListener` (gắn tương tác là việc của Workflow, xem
 * event/workflow/game-catalog.js), KHÔNG `appState.get()`/`appConfigViz.getAll()` (Rule 2) — mọi
 * state cần đọc do Workflow tự đọc rồi truyền vào tham số.
 *
 * ĐÚNG 1 hàm (`buildGamePanelListHtml`) dựng TOÀN BỘ list — mỗi card render INLINE ngay trong
 * `.map()` (cùng khuôn `buildResultBodyHtml()::hitGrid` / `buildDifficultySelectorHtml()::buttons`,
 * engine-ui.js) — KHÔNG tách hàm con riêng cho 1 card: Core cấm gọi Core khác (Rule 3a), và 1 card
 * không tự có vòng lặp nào bên trong để đạt điều kiện "hàm con phục vụ vòng lặp" (Rule 3c) — toàn
 * bộ vẫn ĐÚNG 1 quy trình "vẽ danh sách game", không phải nhiều nghiệp vụ khác nhau ghép lại.
 *
 * TRẠNG THÁI 1 card — suy thuần từ tham số, chỉ CHỌN BIẾN THỂ trình bày (cùng bản chất "active/
 * inactive" mà `buildDifficultySelectorHtml()` đã làm), KHÔNG phải rẽ nhánh nghiệp vụ khác nhau:
 *   - `armedGameId` khác id game NÀY (game KHÁC đang armed) -> khoá thẻ: nút Play mờ + disabled,
 *     độ khó cũng khoá, `title` gợi ý "thoát game đang armed trước".
 *   - `armedGameId` === id NÀY, `gameplayPhase` là 'countdown'/'playing' -> ĐANG CHƠI THẬT: badge
 *     "LIVE" nhấp nháy trên cover, nút đổi thành Exit.
 *   - `armedGameId` === id NÀY, phase khác ('idle'/'ready'/'ended') -> đã armed nhưng CHƯA/KHÔNG
 *     còn phát thật (chờ bài kế tiếp) -> badge "Armed" tĩnh, nút vẫn là Exit.
 *   - `armedGameId` null -> bình thường, nút Play + độ khó đều bấm được cho MỌI card.
 * Độ khó (`difficulty`) CHỈ sửa được khi `armedGameId` null — mọi card DÙNG CHUNG ĐÚNG 1 field
 * `gameplayDifficulty` (service/state/gameplay-runtime.js, vì Rule 4 "không chơi 2 game cùng lúc"
 * nên tại 1 thời điểm chỉ có ĐÚNG 1 độ khó đang có ý nghĩa) — khoá nút lại khi đã armed để tránh
 * sửa ngầm giá trị đang dùng cho phiên đang chờ/đang chơi thật.
 *
 * Cover — `coverImageUrl` (catalog.js) hiện LUÔN `null` (chưa có ảnh thật) -> luôn rơi vào nhánh
 * gradient + icon trang trí (`coverGradientClass`/`coverIconSvg`). Nhánh `<img>` viết SẴN cho lúc
 * catalog có ảnh thật sau này — `coverImageUrl` là data TĨNH do dev tự khai trong catalog.js
 * (KHÔNG phải người dùng upload), nên nội suy thẳng vào `src` KHÔNG cần `escapeHtml()` (khác
 * `title` bài hát ở buildResultBodyHtml(), đó là dữ liệu người dùng — xem docstring hàm đó).
 */
function buildGamePanelListHtml(games, armedGameId, gameplayPhase, difficulty, t) {
    if (games.length === 0) {
        return `<p class="text-sm text-slate-400 text-center py-14" data-i18n="gamePanel.comingSoon">${t('gamePanel.comingSoon')}</p>`;
    }

    const difficultyLocked = armedGameId != null;
    const difficultyGlyph = { easy: '●', medium: '●●', hard: '∞' };
    const difficultyAccent = {
        easy: 'text-emerald-300 bg-emerald-500/15 border-emerald-400/40',
        medium: 'text-amber-300 bg-amber-500/15 border-amber-400/40',
        hard: 'text-rose-300 bg-rose-500/15 border-rose-400/40',
    };

    const cards = games.map((game, index) => {
        const isArmed = armedGameId === game.id;
        const isLocked = armedGameId != null && !isArmed;
        const isLive = isArmed && (gameplayPhase === 'countdown' || gameplayPhase === 'playing');

        const actionBtn = isArmed
            ? `<button type="button" class="game-card-exit-btn shrink-0 w-11 h-11 rounded-full flex items-center justify-center bg-rose-500/90 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/20 transition-colors" data-game-id="${game.id}" aria-label="${t('gamePanel.card.exit')}">` +
                `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>` +
                `</button>`
            : `<button type="button" class="game-card-play-btn shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-colors ${isLocked ? 'bg-white/5 text-slate-500 cursor-not-allowed' : 'bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-500/20'}" data-game-id="${game.id}" ${isLocked ? 'disabled' : ''} aria-label="${t('gamePanel.card.play')}" ${isLocked ? `title="${t('gamePanel.card.lockedHint')}" data-i18n-title="gamePanel.card.lockedHint"` : ''}>` +
                `<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 ml-0.5"><path d="M8 5v14l11-7z"/></svg>` +
                `</button>`;

        const difficultyBtn = `<button type="button" class="game-card-difficulty-btn shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[11px] font-bold tracking-wide transition-colors ${difficultyAccent[difficulty]} ${difficultyLocked ? 'opacity-40 cursor-not-allowed' : 'hover:brightness-125'}" data-game-id="${game.id}" ${difficultyLocked ? 'disabled' : ''}>` +
            `<span class="font-mono leading-none">${difficultyGlyph[difficulty]}</span>` +
            `<span data-i18n="gameplayCircle.difficulty.${difficulty}">${t('gameplayCircle.difficulty.' + difficulty)}</span>` +
            `</button>`;

        const statusBadge = isLive
            ? `<span class="game-card-live-badge absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500 text-white text-[10px] font-bold tracking-widest"><span class="game-card-live-dot"></span><span data-i18n="gamePanel.card.live">${t('gamePanel.card.live')}</span></span>`
            : (isArmed ? `<span class="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-white/15 text-white text-[10px] font-bold tracking-widest backdrop-blur-sm" data-i18n="gamePanel.card.armed">${t('gamePanel.card.armed')}</span>` : '');

        const cover = game.coverImageUrl
            ? `<img src="${game.coverImageUrl}" alt="" class="absolute inset-0 w-full h-full object-cover">`
            : `<div class="absolute inset-0 bg-gradient-to-br ${game.coverGradientClass}"></div>` +
              `<svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5" class="w-14 h-14 relative z-10">${game.coverIconSvg}</svg>`;

        return `
            <div class="game-card glass-modal rounded-2xl overflow-hidden${isLocked ? ' opacity-60' : ''}" style="animation-delay:${index * 60}ms" data-game-id="${game.id}">
                <div class="game-card-cover relative h-28 flex items-center justify-center overflow-hidden">
                    ${cover}
                    <div class="game-card-cover-shine"></div>
                    ${statusBadge}
                </div>
                <div class="p-4 flex flex-col gap-2">
                    <div class="flex items-center justify-between gap-2">
                        <h3 class="text-base font-bold text-white truncate" data-i18n="${game.nameKey}">${t(game.nameKey)}</h3>
                        <div class="flex items-center gap-2 shrink-0">
                            ${actionBtn}
                            ${difficultyBtn}
                        </div>
                    </div>
                    <p class="text-xs text-slate-400 leading-relaxed" data-i18n="${game.descriptionKey}">${t(game.descriptionKey)}</p>
                </div>
            </div>
        `;
    }).join('');

    return `<div class="flex flex-col gap-4 p-4 pb-8">${cards}</div>`;
}
