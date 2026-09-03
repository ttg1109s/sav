/**
 * event/workflow/game-catalog.js — MỚI (02/09/2026, Giang yêu cầu "nối game mode vào game overlay
 * đang coming soon"). "THẰNG THỰC THI CUỐI" của router "gameCatalog" — điều phối Game Panel (App
 * Panel tab "Game", danh sách card kiểu appstore, xem components/game-panel.js +
 * core/gameplay/game-panel-ui.js).
 *
 * Sở hữu: mở panel + render list, arm/disarm 1 game (nút Play/Exit trên card), cycle độ khó (nút
 * độ khó trên card). KHÔNG sở hữu logic 1 PHIÊN chơi thật (spawn wave/countdown/tick...) — đó vẫn
 * là `workflowGameplay` (event/workflow/gameplay.js), file này chỉ gọi VÀO đó lúc cần (liên tuyến
 * domain, Workflow gọi Workflow miền khác, TH2 event-bus-flow.md mục 3a — Game Panel và phiên chơi
 * thật là 2 miền khác nhau dù cùng phục vụ chung 1 tính năng Game Mode).
 *
 * `gameplayArmedGameId` (AppState, session-only, mất khi reload — [SỬA 02/09/2026] Giang yêu cầu
 * "game mode không lưu, trạng thái tạm thời RAM"). NGƯỢC LẠI, độ khó đã chọn CHO TỪNG GAME
 * (`gameplayDifficultyByGame`, core/config.js) LÀ PERSISTENT — [MỚI 02/09/2026, Giang yêu cầu
 * "không lưu game mode on/off nhưng cũng phải lưu độ khó cho từng game"] file này GỌI saveConfig()
 * Ở ĐÚNG 1 chỗ (cycleDifficulty()) cho field đó — KHÔNG lẫn với `gameplayArmedGameId` (session).
 *
 * Mỗi thao tác (arm/disarm/cycle độ khó) RE-RENDER TOÀN BỘ list ngay sau khi ghi state xong (cùng
 * khuôn `workflowGameplayEngine._wireDifficultySelector()` cũ — outerHTML/innerHTML thay TOÀN BỘ
 * mỗi lần đổi, không patch riêng lẻ từng card) — đơn giản, luôn đồng bộ ĐÚNG appState/config hiện
 * hành, chấp nhận đánh đổi hiệu năng nhỏ (catalog hiện chỉ 1-vài game, re-render toàn bộ không đáng
 * kể). `renderList()` CÙNG LÚC đồng bộ luôn icon/chấm xanh báo hiệu "Game Mode" trên icon nút Game
 * ở bottom nav (`setAppBottomNavGameIndicator()`, core/app-panel-nav.js) — bám ĐÚNG
 * `gameplayArmedGameId != null`, KHÔNG phụ thuộc `gameplayPhase`.
 *
 * NẠP SAU: core/gameplay/catalog.js (GAMEPLAY_GAMES_CATALOG), core/gameplay/game-panel-ui.js
 * (buildGamePanelListHtml), core/gameplay/engine.js (setGameplayArmedGameId,
 * setGameDifficultyPreference), core/config.js (appConfigViz, saveConfig), core/app-panel-nav.js
 * (setAppBottomNavGameIndicator), core/placeholder-panel.js (showPlaceholderPanel),
 * event/workflow/placeholder-panels.js (workflowPlaceholderPanels.close), event/workflow/
 * gameplay.js (workflowGameplay.start/exitToPlaylist — gọi lúc arm có bài load sẵn / disarm đang
 * chơi đúng game đó), core/dom-refs.js (gamePanelList).
 * NẠP TRƯỚC: event/router/game-catalog.js.
 */
const workflowGameCatalog = {

    /** Ứng với 'appPanelNav.game.click' — gọi THẲNG từ workflowAppPanelNav.openGame() (liên tuyến
     * domain, KHÔNG qua eventBus vì cùng 1 hành động điều hướng, xem event/workflow/
     * app-panel-nav.js). Render list TRƯỚC rồi mới hiện panel — tránh 1 khung rỗng chớp lên trước
     * khi HTML kịp đổ vào. */
    openPanel() {
        this.renderList();
        showPlaceholderPanel(gamePanel); // core/placeholder-panel.js — vẫn dùng chung hiện/ẩn full-screen, KHÔNG cần viết lại riêng cho Game
    },

    /** Đọc ĐỦ state ảnh hưởng tới cách vẽ list (armed game/phase phiên/độ khó TỪNG GAME) RỒI gọi
     * Core-ui — đúng vai trò Workflow (Rule 3b: Core là tầng thi hành, Workflow là tầng chuẩn bị).
     * Gọi lại sau MỌI thao tác đổi state của cụm này (arm/disarm/cycle độ khó) để list + icon/chấm
     * báo hiệu nav luôn khớp thực tế. */
    renderList() {
        const { gameplayPhase, gameplayArmedGameId } = appState.get(['gameplayPhase', 'gameplayArmedGameId']);
        const difficultyByGameId = appConfigViz.getAll().gameplayDifficultyByGame; // core/config.js — PERSISTENT
        gamePanelList.innerHTML = buildGamePanelListHtml(GAMEPLAY_GAMES_CATALOG, gameplayArmedGameId, gameplayPhase, difficultyByGameId, t); // core-ui (game-panel-ui.js)
        setAppBottomNavGameIndicator(gameplayArmedGameId != null); // core (app-panel-nav.js)
    },

    /** Ứng với 'gameCatalog.card.play.click' — armed ĐÚNG game vừa bấm (session-only, KHÔNG lưu).
     * Guard: đã có game KHÁC đang armed thì bỏ qua (phòng hờ — nút Play trên card đó vốn đã bị
     * disabled ở game-panel-ui.js, nhưng Workflow không tin tưởng mù DOM disabled, tự kiểm lại
     * state thật).
     *
     * Đóng Game Panel NGAY TẠI ĐÂY, VÔ ĐIỀU KIỆN (ĐÚNG hành động nút X,
     * `workflowPlaceholderPanels.close()`) — KHÔNG phụ thuộc `workflowGameplay.start()` có được gọi
     * hay không.
     *
     * [MỚI — 02/09/2026, Giang yêu cầu "phải lưu độ khó đã chọn cho từng game"] Đồng bộ field PHIÊN
     * `gameplayDifficulty` (AppState, đọc bởi workflowGameplay lúc chơi thật) theo ĐÚNG độ khó đã
     * LƯU PERSISTENT cho game này (`gameplayDifficultyByGame[gameId]`) — phòng trường hợp field
     * phiên đang mang giá trị mặc định/game khác để lại, KHÔNG khớp lựa chọn đã lưu từ trước cho
     * ĐÚNG game này. Có bài/video load sẵn (`currentKey`) -> vào game LUÔN (KHÔNG còn modal chọn độ
     * khó/Start, xem event/workflow/gameplay.js::start()). */
    armGame(gameId) {
        const armedGameId = appState.get('gameplayArmedGameId');
        if (armedGameId && armedGameId !== gameId) return;

        setGameplayArmedGameId(gameId); // core (engine.js)

        const savedDifficulty = appConfigViz.getAll().gameplayDifficultyByGame[gameId] || 'hard';
        appState.set('gameplayDifficulty', savedDifficulty, { skipCheck: true });
        console.log(`writer: "workflowGameCatalog.armGame", page: "gameplayDifficulty", content: "${savedDifficulty}"`);

        workflowPlaceholderPanels.close(gamePanel); // event/workflow/placeholder-panels.js — liên tuyến domain, ĐÚNG hành động nút X, VÔ ĐIỀU KIỆN
        this.renderList();

        if (appState.get('currentKey')) workflowGameplay.start(gameId); // event/workflow/gameplay.js — liên tuyến domain
    },

    /** Ứng với 'gameCatalog.card.exit.click' — disarm. [Yêu cầu Giang mục 4 "phải thoát game đó ra
     * trước, đồng thời thoát game mode"] Đang chơi THẬT đúng game này (phase khác 'idle') -> thoát
     * hẳn phiên đang chạy LUÔN trong cùng 1 thao tác, không bắt bấm thêm nút exit trong overlay
     * nữa. */
    disarmGame(gameId) {
        setGameplayArmedGameId(null); // core (engine.js)

        const gameplayMode = appState.get('gameplayMode');
        if (gameplayMode === gameId) workflowGameplay.exitToPlaylist(); // event/workflow/gameplay.js — liên tuyến domain, tự set gameplayPhase='idle' + ẩn overlay

        this.renderList();
    },

    /** Ứng với 'gameCatalog.card.difficulty.click' — cycle easy -> medium -> hard -> easy CHO ĐÚNG
     * `gameId` vừa bấm (mỗi card độc lập, KHÔNG còn 1 field dùng chung mọi game). Guard: đã có game
     * armed (bất kỳ game nào) thì bỏ qua — độ khó khoá lại lúc đã armed (xem docstring
     * game-panel-ui.js mục "Độ khó"), tự kiểm lại state thật cùng lý do như armGame() ở trên.
     *
     * [MỚI — 02/09/2026, Giang yêu cầu "không lưu game mode on/off nhưng phải lưu độ khó cho từng
     * game"] Ghi PERSISTENT (`gameplayDifficultyByGame[gameId]`, core/config.js) + `saveConfig()`
     * NGAY — KHÁC field phiên `gameplayDifficulty` (AppState) mà armGame() mới là nơi đồng bộ (lúc
     * ĐÃ armed game này, xem docstring armGame()), tránh cycle độ khó trên 1 card CHƯA armed lại
     * ghi nhầm vào field phiên đang thuộc VỀ game khác. */
    cycleDifficulty(gameId) {
        if (appState.get('gameplayArmedGameId') != null) return;

        const order = ['easy', 'medium', 'hard'];
        const current = appConfigViz.getAll().gameplayDifficultyByGame[gameId] || 'hard';
        const next = order[(order.indexOf(current) + 1) % order.length];
        setGameDifficultyPreference(gameId, next); // core (engine.js)
        saveConfig(); // core (config.js)

        this.renderList();
    },
};
