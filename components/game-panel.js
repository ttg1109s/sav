/**
 * components/game-panel.js — Game Panel, ngang cấp Statis (bottom nav App Panel). Khung tĩnh `TPL_GAME_PANEL` (header + nút
 * Close + `#game-panel-list` rỗng) mount lúc boot; danh sách card dựng bởi renderGamePanelListHtml() dưới đây, đổ vào list qua
 * core/gameplay/game-panel-ui.js (event/workflow/game-catalog.js) mỗi lần mở panel hoặc đổi armed/độ khó.
 *
 * NẠP SAU: lang/lang.js (t), core/ui-theme/icon-svg-ui.js (iconSvg).
 */
const TPL_GAME_PANEL = `
    <div id="game-panel" class="hidden flex flex-col" style="z-index: 128;" data-uitk="panelBg">
        <div class="absolute top-0 left-0 right-0 flex items-center justify-center px-14 py-3 sm:px-16 h-14 z-10 border-b" data-uitk="dividerBorder">
            <h2 class="text-base sm:text-lg font-semibold truncate text-center" data-uitk="textPrimary" data-i18n="gamePanel.title">${t('gamePanel.title')}</h2>
            <button id="btn-game-panel-close" class="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full hover:bg-rose-500 hover:text-white transition-colors shrink-0" data-uitk="textPrimary">${iconSvg('x', 'h-5 w-5')}</button>
        </div>
        <div id="game-panel-list" class="flex-1 overflow-y-auto pt-14"></div>
    </div>
`;

const GAME_CARD_DIFFICULTY_GLYPH = { easy: '●', medium: '●●', hard: '∞' };
const GAME_CARD_DIFFICULTY_HUE = { easy: 'emerald', medium: 'amber', hard: 'rose' }; // key theme `chipTone:<hue>` (core/ui-theme/*.js)

/** Nút Play (khoá mờ khi game khác đang armed) hoặc Exit (game này đang armed). Nút cùng cao `h-11` với nút độ khó. */
function renderGameCardActionButtonHtml({ game, isArmed, isLocked }) {
    if (isArmed) {
        return `<button type="button" class="game-card-exit-btn shrink-0 w-11 h-11 rounded-full flex items-center justify-center bg-rose-500/90 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/20 transition-colors" data-game-id="${game.id}" aria-label="${t('gamePanel.card.exit')}">` +
            iconSvg('x', 'w-5 h-5') +
            `</button>`;
    }
    return `<button type="button" class="game-card-play-btn shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-colors ${isLocked ? 'cursor-not-allowed' : 'shadow-lg shadow-sky-500/20'}" data-uitk="${isLocked ? 'btnNeutralBg textMutedIcon' : 'btnPrimaryPillBg btnPrimaryPillHoverBg textOnAccent'}" data-game-id="${game.id}" ${isLocked ? 'disabled' : ''} aria-label="${t('gamePanel.card.play')}" ${isLocked ? `title="${t('gamePanel.card.lockedHint')}" data-i18n-title="gamePanel.card.lockedHint"` : ''}>` +
        iconSvg('play', 'w-5 h-5 ml-0.5') +
        `</button>`;
}

/** Nút xoay vòng độ khó (khoá khi có game armed). */
function renderGameCardDifficultyButtonHtml({ game, difficulty, difficultyLocked }) {
    return `<button type="button" class="game-card-difficulty-btn shrink-0 h-11 flex items-center gap-1.5 px-3.5 rounded-full border text-xs font-bold tracking-wide transition-colors ${difficultyLocked ? 'opacity-40 cursor-not-allowed' : 'hover:brightness-95'}" data-uitk="chipTone:${GAME_CARD_DIFFICULTY_HUE[difficulty]}" data-game-id="${game.id}" ${difficultyLocked ? 'disabled' : ''}>` +
        `<span class="font-mono leading-none text-sm">${GAME_CARD_DIFFICULTY_GLYPH[difficulty]}</span>` +
        `<span data-i18n="gameplayCircle.difficulty.${difficulty}">${t('gameplayCircle.difficulty.' + difficulty)}</span>` +
        `</button>`;
}

/** Badge góc cover: LIVE nhấp nháy (đang chơi thật) / Armed (chờ media) / không có. */
function renderGameCardStatusBadgeHtml({ isArmed, isLive }) {
    if (isLive) return `<span class="game-card-live-badge absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500 text-white text-[10px] font-bold tracking-widest"><span class="game-card-live-dot"></span><span data-i18n="gamePanel.card.live">${t('gamePanel.card.live')}</span></span>`;
    if (isArmed) return `<span class="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-white/85 text-slate-900 text-[10px] font-bold tracking-widest backdrop-blur-sm" data-i18n="gamePanel.card.armed">${t('gamePanel.card.armed')}</span>`;
    return '';
}

/** Cover: ảnh (khi catalog có `coverImageUrl`) hoặc nền gradient + icon trang trí. */
function renderGameCardCoverHtml(game) {
    if (game.coverImageUrl) return `<img src="${game.coverImageUrl}" alt="" class="absolute inset-0 w-full h-full object-cover">`;
    return `<div class="absolute inset-0 bg-gradient-to-br ${game.coverGradientClass}"></div>` +
        `<svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5" class="w-14 h-14 relative z-10">${game.coverIconSvg}</svg>`;
}

/** Danh sách card game. Catalog rỗng -> dòng "coming soon".
 * @param {ReturnType<typeof computeGamePanelView>} view - core/gameplay/catalog.js @returns {string} */
function renderGamePanelListHtml({ cards }) {
    if (cards.length === 0) {
        return `<p class="text-sm text-center py-14" data-uitk="emptyStateText" data-i18n="gamePanel.comingSoon">${t('gamePanel.comingSoon')}</p>`;
    }
    const cardsHtml = cards.map((card) => `
            <div class="game-card rounded-2xl overflow-hidden${card.isLocked ? ' opacity-60' : ''}" style="animation-delay:${card.index * 60}ms" data-game-id="${card.game.id}" data-uitk="cardBg cardBorder">
                <div class="game-card-cover relative h-28 flex items-center justify-center overflow-hidden">
                    ${renderGameCardCoverHtml(card.game)}
                    <div class="game-card-cover-shine"></div>
                    ${renderGameCardStatusBadgeHtml(card)}
                </div>
                <div class="p-4 flex flex-col gap-2">
                    <div class="flex items-center justify-between gap-2">
                        <h3 class="text-base font-bold truncate" data-i18n="${card.game.nameKey}" data-uitk="textPrimary">${t(card.game.nameKey)}</h3>
                        <div class="flex items-center gap-2 shrink-0">
                            ${renderGameCardActionButtonHtml(card)}
                            ${renderGameCardDifficultyButtonHtml(card)}
                        </div>
                    </div>
                    <p class="text-xs leading-relaxed" data-i18n="${card.game.descriptionKey}" data-uitk="textSecondary">${t(card.game.descriptionKey)}</p>
                </div>
            </div>
        `).join('');
    return `<div class="flex flex-col gap-4 p-4 pb-8">${cardsHtml}</div>`;
}
