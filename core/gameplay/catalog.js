/**
 * core/gameplay/catalog.js — danh mục game cài sẵn hiển thị ở Game Panel (App Panel tab "Game", components/game-panel.js) +
 * các hàm thuần suy trạng thái card. Data tĩnh, không phải appState/AppConfig.
 *
 * `id` = giá trị `gameplayMode` dùng xuyên suốt (service/state/gameplay-runtime.js, `gameplayArmedGameId`,
 * `meta.game[mode]` khi lưu điểm — event/workflow/gameplay-engine.js::persistScore()), không có tầng ánh xạ ở giữa.
 * `coverIconSvg`: chỉ phần bên trong `<svg>` (template bọc `<svg viewBox="0 0 24 24">` chung). `coverGradientClass`: nền cover
 * khi chưa có ảnh (`coverImageUrl` chừa sẵn, hiện luôn null — data tĩnh do dev khai, không cần escapeHtml()).
 */
const GAMEPLAY_GAMES_CATALOG = Object.freeze([
    Object.freeze({
        id: 'circle',
        nameKey: 'gamePanel.catalog.circle.name',
        descriptionKey: 'gamePanel.catalog.circle.description',
        coverImageUrl: null,
        coverGradientClass: 'from-sky-500 via-indigo-500 to-violet-600',
        // 2 vòng tròn đồng tâm — wave co dần vào target circle.
        coverIconSvg: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/>',
    }),
    // Game "Arrow" (core/gameplay/arrow-mode.js, event/workflow/gameplay-arrow.js). Nền cover dùng class riêng
    // `game-cover-gradient-arrow` (assets/css/game-panel.css) — bộ màu này chưa có trong tailwind.css build sẵn.
    Object.freeze({
        id: 'arrow',
        nameKey: 'gamePanel.catalog.arrow.name',
        descriptionKey: 'gamePanel.catalog.arrow.description',
        coverImageUrl: null,
        coverGradientClass: 'game-cover-gradient-arrow',
        // La bàn 8 hướng — vòng ngoài + 4 mũi tên chính + 4 nhánh chéo.
        coverIconSvg: '<circle cx="12" cy="12" r="9.5"/><path d="M12 5.5v13M5.5 12h13"/><path d="M9.5 8L12 5.5 14.5 8M9.5 16l2.5 2.5 2.5-2.5M8 9.5L5.5 12 8 14.5M16 9.5l2.5 2.5-2.5 2.5"/><path d="M7.4 7.4l1.6 1.6M16.6 7.4L15 9M7.4 16.6L9 15M16.6 16.6L15 15"/>',
    }),
]);

const GAMEPLAY_DIFFICULTY_ORDER = Object.freeze(['easy', 'medium', 'hard']); // thứ tự xoay vòng của nút độ khó
const GAMEPLAY_DEFAULT_DIFFICULTY = 'hard'; // game chưa từng chọn độ khó

/**
 * Trạng thái hiển thị của Game Panel. Mỗi card: `isArmed` (game này đang armed -> nút Exit + badge), `isLocked` (game KHÁC
 * đang armed -> nút Play khoá), `isLive` (armed + đang đếm ngược/chơi thật -> badge LIVE, ngược lại badge Armed), `difficulty`
 * (độ khó đã lưu của game, thiếu -> mặc định), `difficultyLocked` (có game armed -> khoá nút độ khó mọi card).
 * @param {Array<object>} games - GAMEPLAY_GAMES_CATALOG @param {string|null} armedGameId @param {string} gameplayPhase
 * @param {Object<string,string>} difficultyByGameId - `gameplayDifficultyByGame` (core/config.js)
 * @returns {{ hasArmedGame: boolean, cards: Array<{game:object, index:number, isArmed:boolean, isLocked:boolean, isLive:boolean, difficulty:string, difficultyLocked:boolean}> }}
 */
function computeGamePanelView(games, armedGameId, gameplayPhase, difficultyByGameId) {
    const hasArmedGame = armedGameId != null;
    const isPlayingPhase = gameplayPhase === 'countdown' || gameplayPhase === 'playing';
    return {
        hasArmedGame,
        cards: games.map((game, index) => {
            const isArmed = armedGameId === game.id;
            return {
                game, index, isArmed,
                isLocked: hasArmedGame && !isArmed,
                isLive: isArmed && isPlayingPhase,
                difficulty: difficultyByGameId[game.id] || GAMEPLAY_DEFAULT_DIFFICULTY,
                difficultyLocked: hasArmedGame,
            };
        }),
    };
}

/** Độ khó đã lưu của 1 game (thiếu -> mặc định). @param {Object<string,string>} difficultyByGameId @param {string} gameId */
function resolveGameDifficulty(difficultyByGameId, gameId) {
    return difficultyByGameId[gameId] || GAMEPLAY_DEFAULT_DIFFICULTY;
}

/** Độ khó kế tiếp khi bấm nút độ khó: easy -> medium -> hard -> easy. @param {string} currentDifficulty */
function computeNextGameDifficulty(currentDifficulty) {
    return GAMEPLAY_DIFFICULTY_ORDER[(GAMEPLAY_DIFFICULTY_ORDER.indexOf(currentDifficulty) + 1) % GAMEPLAY_DIFFICULTY_ORDER.length];
}
