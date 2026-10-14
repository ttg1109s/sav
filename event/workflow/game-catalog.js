/**
 * event/workflow/game-catalog.js — Workflow của router "gameCatalog": Game Panel (App Panel tab "Game", danh sách card —
 * components/game-panel.js). Sở hữu: mở panel + vẽ list, arm/disarm 1 game (nút Play/Exit trên card), xoay độ khó (nút độ
 * khó trên card). Phiên chơi thật thuộc event/workflow/gameplay-engine.js (+ workflow từng mode) — file này chỉ gọi vào.
 *
 * `gameplayArmedGameId` là AppState session-only (không lưu); độ khó từng game (`gameplayDifficultyByGame`, core/config.js)
 * là PERSISTENT — saveConfig() ở đúng cycleDifficulty(). Mỗi thao tác vẽ lại toàn bộ list (catalog chỉ vài game) kèm chấm
 * báo "Game Mode" trên nút Game ở bottom nav (theo `gameplayArmedGameId != null`, không theo `gameplayPhase`).
 *
 * NẠP SAU: core/gameplay/catalog.js, components/game-panel.js, core/gameplay/game-panel-ui.js, core/gameplay/engine.js
 * (setGameplayArmedGameId, setGameDifficultyPreference), core/config.js (appConfigViz, saveConfig), core/app-panel-nav.js,
 * core/placeholder-panel.js, core/ui-theme/apply-ui.js, event/workflow/placeholder-panels.js,
 * event/workflow/gameplay-engine.js, core/dom-refs.js. NẠP TRƯỚC: event/router/game-catalog.js.
 */
const workflowGameCatalog = {

    /** 'appPanelNav.game.click' (gọi thẳng từ workflowAppPanelNav.openGame()). Vẽ list trước rồi mới hiện panel — tránh khung
     * rỗng chớp lên. */
    openPanel() {
        this.renderList();
        showPlaceholderPanel(gamePanel); // core/placeholder-panel.js
    },

    /** Vẽ lại list + chấm báo ở bottom nav theo armed game / pha phiên / độ khó từng game. */
    renderList() {
        const { gameplayPhase, gameplayArmedGameId } = appState.get(['gameplayPhase', 'gameplayArmedGameId']);
        const view = computeGamePanelView(GAMEPLAY_GAMES_CATALOG, gameplayArmedGameId, gameplayPhase, appConfigViz.getAll().gameplayDifficultyByGame); // core/gameplay/catalog.js
        setGamePanelListHtml(gamePanelList, renderGamePanelListHtml(view)); // core/gameplay/game-panel-ui.js + components/game-panel.js
        applyUiThemeToDom(gamePanelList, _activeUiThemeKeyList); // core/ui-theme/apply-ui.js — nội dung dựng động (data-uitk)
        setAppBottomNavGameIndicator(view.hasArmedGame); // core/app-panel-nav.js
    },

    /**
     * 'gameCatalog.card.play.click' — arm game vừa bấm (session-only). Game KHÁC đang armed -> bỏ qua (nút Play đã disabled,
     * vẫn tự kiểm state thật). Đồng bộ độ khó của phiên (`gameplayDifficulty`) theo độ khó đã lưu của game này, đóng Game
     * Panel (đúng hành động nút X), có Song/Video đang nạp -> vào game luôn (đang phát Photo thì chờ media kế).
     */
    armGame(gameId) {
        const { gameplayArmedGameId: armedGameId, currentKey, isPhotoPlayerMode } = appState.get(['gameplayArmedGameId', 'currentKey', 'isPhotoPlayerMode']);
        if (armedGameId && armedGameId !== gameId) return;

        setGameplayArmedGameId(gameId); // core/gameplay/engine.js

        const savedDifficulty = resolveGameDifficulty(appConfigViz.getAll().gameplayDifficultyByGame, gameId); // core/gameplay/catalog.js
        appState.set('gameplayDifficulty', savedDifficulty, { skipCheck: true });
        console.log(`writer: "workflowGameCatalog.armGame", page: "gameplayDifficulty", content: "${savedDifficulty}"`);

        workflowPlaceholderPanels.close(gamePanel); // event/workflow/placeholder-panels.js
        this.renderList();

        if (shouldStartArmedGameNow(currentKey, isPhotoPlayerMode)) workflowGameplayEngine.startMode(gameId); // core/gameplay/catalog.js + event/workflow/gameplay-engine.js
    },

    /** 'gameCatalog.card.exit.click' — disarm; đang chơi đúng game này -> thoát luôn phiên đang chạy. */
    disarmGame(gameId) {
        setGameplayArmedGameId(null); // core/gameplay/engine.js

        const gameplayMode = appState.get('gameplayMode');
        if (gameplayMode === gameId) workflowGameplayEngine.exitActiveMode(); // event/workflow/gameplay-engine.js

        this.renderList();
    },

    /** 'gameCatalog.card.difficulty.click' — xoay easy -> medium -> hard cho đúng game vừa bấm, lưu PERSISTENT. Có game armed
     * (bất kỳ) -> bỏ qua (độ khó khoá lúc armed; field phiên `gameplayDifficulty` chỉ đồng bộ ở armGame()). */
    cycleDifficulty(gameId) {
        if (appState.get('gameplayArmedGameId') != null) return;

        const current = resolveGameDifficulty(appConfigViz.getAll().gameplayDifficultyByGame, gameId); // core/gameplay/catalog.js
        setGameDifficultyPreference(gameId, computeNextGameDifficulty(current)); // core/gameplay/engine.js + catalog.js
        saveConfig(); // core/config.js

        this.renderList();
    },
};
