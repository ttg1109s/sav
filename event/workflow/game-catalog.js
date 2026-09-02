/**
 * event/workflow/game-catalog.js — MỚI (02/09/2026, Giang yêu cầu "nối game mode vào game overlay
 * đang coming soon"). "THẰNG THỰC THI CUỐI" của router "gameCatalog" — điều phối Game Panel (App
 * Panel tab "Game", danh sách card kiểu appstore, xem components/game-panel.js +
 * core/gameplay/game-panel-ui.js).
 *
 * Sở hữu: mở panel + render list, arm/disarm 1 game (nút Play/Exit trên card), cycle độ khó (nút
 * độ khó trên card — dùng CHUNG field `gameplayDifficulty` sẵn có, service/state/
 * gameplay-runtime.js). KHÔNG sở hữu logic 1 PHIÊN chơi thật (spawn wave/countdown/tick...) — đó
 * vẫn là `workflowGameplay` (event/workflow/gameplay.js), file này chỉ gọi VÀO đó lúc cần (liên
 * tuyến domain, Workflow gọi Workflow miền khác, TH2 event-bus-flow.md mục 3a — Game Panel và
 * phiên chơi thật là 2 miền khác nhau dù cùng phục vụ chung 1 tính năng Game Mode).
 *
 * [SỬA — 02/09/2026, Giang yêu cầu "game mode không lưu, trạng thái tạm thời RAM"] `gameplayArmedGameId`
 * SỐNG Ở APPSTATE (service/state/gameplay-runtime.js, session-only, mất khi reload) — KHÔNG còn ở
 * AppConfig/vizConfig như bản đổi tên hồi sáng cùng ngày nữa, nên file này KHÔNG còn gọi
 * `saveConfig()` ở đâu cả (không có gì thuộc vizConfig để lưu trong cụm này).
 *
 * Mỗi thao tác (arm/disarm/cycle độ khó) RE-RENDER TOÀN BỘ list ngay sau khi ghi state xong (cùng
 * khuôn `workflowGameplayEngine._wireDifficultySelector()` cũ — outerHTML/innerHTML thay TOÀN BỘ
 * mỗi lần đổi, không patch riêng lẻ từng card) — đơn giản, luôn đồng bộ ĐÚNG appState hiện hành,
 * chấp nhận đánh đổi hiệu năng nhỏ (catalog hiện chỉ 1-vài game, re-render toàn bộ không đáng kể).
 * `renderList()` CÙNG LÚC đồng bộ luôn icon/chấm xanh báo hiệu "đang chơi Game Mode" trên icon nút
 * Game ở bottom nav (`setAppBottomNavGameIndicator()`, core/app-panel-nav.js, MỚI — Giang yêu cầu
 * "icon game ở nav phải biểu thị đang ở game mode", [SỬA cùng ngày] "chỉ 1 boolean true/false, không
 * chia phase") — 1 nguồn `gameplayPhase` DUY NHẤT nuôi CẢ list lẫn icon/chấm báo hiệu, không đọc
 * lại appState 2 lần cho 2 việc. [MỚI] `event/workflow/gameplay.js` (miền KHÁC, liên tuyến domain)
 * cũng gọi THẲNG `workflowGameCatalog.renderList()` ở MỌI mốc đổi `gameplayPhase` (start()/
 * _beginPlaying()/onSongEnded()/exitToPlaylist()) — icon/chấm nav đổi true/false chỉ có Ở ĐÓ mới
 * biết chính xác lúc nào phase đổi, cụm này không tự theo dõi được.
 *
 * NẠP SAU: core/gameplay/catalog.js (GAMEPLAY_GAMES_CATALOG), core/gameplay/game-panel-ui.js
 * (buildGamePanelListHtml), core/gameplay/engine.js (setGameplayArmedGameId), core/app-panel-nav.js
 * (setAppBottomNavGameIndicator), event/workflow/gameplay.js (workflowGameplay.start/
 * exitToPlaylist — gọi lúc arm có bài load sẵn / disarm đang chơi đúng game đó), core/dom-refs.js
 * (gamePanelList).
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

    /** Đọc ĐỦ state ảnh hưởng tới cách vẽ list (armed game/phase phiên/độ khó) RỒI gọi Core-ui —
     * đúng vai trò Workflow (Rule 3b: Core là tầng thi hành, Workflow là tầng chuẩn bị). Gọi lại sau
     * MỌI thao tác đổi state của cụm này (arm/disarm/cycle độ khó) VÀ từ MỌI mốc đổi `gameplayPhase`
     * bên event/workflow/gameplay.js (start()/_beginPlaying()/onSongEnded()/exitToPlaylist()) để
     * list + icon/chấm báo hiệu nav luôn khớp thực tế. */
    renderList() {
        const { gameplayPhase, gameplayDifficulty, gameplayArmedGameId } = appState.get(['gameplayPhase', 'gameplayDifficulty', 'gameplayArmedGameId']);
        gamePanelList.innerHTML = buildGamePanelListHtml(GAMEPLAY_GAMES_CATALOG, gameplayArmedGameId, gameplayPhase, gameplayDifficulty, t); // core-ui (game-panel-ui.js)
        // [SỬA — 02/09/2026, Giang chỉnh "chỉ quan tâm khi play -> true/false, không chia phase"] 1
        // boolean DUY NHẤT — true khi ĐANG CHƠI THẬT (`gameplayPhase !== 'idle'`), false mọi trường
        // hợp còn lại (kể cả đã armed nhưng chưa/không còn phát thật) — xem docstring đầy đủ ở
        // setAppBottomNavGameIndicator() (core/app-panel-nav.js).
        setAppBottomNavGameIndicator(gameplayPhase !== 'idle'); // core (app-panel-nav.js)
    },

    /** Ứng với 'gameCatalog.card.play.click' — armed ĐÚNG game vừa bấm (session-only, KHÔNG lưu).
     * Guard: đã có game KHÁC đang armed thì bỏ qua (phòng hờ — nút Play trên card đó vốn đã bị
     * disabled ở game-panel-ui.js, nhưng Workflow không tin tưởng mù DOM disabled, tự kiểm lại
     * state thật). Có bài/video load sẵn (`currentKey`) -> vào game LUÔN (KHÔNG còn modal chọn độ
     * khó/Start, xem event/workflow/gameplay.js::start() — độ khó đã chọn SẴN trên card trước khi
     * bấm Play rồi; start() TỰ đóng Game Panel nếu đang mở, xem docstring hàm đó). */
    armGame(gameId) {
        const armedGameId = appState.get('gameplayArmedGameId');
        if (armedGameId && armedGameId !== gameId) return;

        setGameplayArmedGameId(gameId); // core (engine.js)
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

    /** Ứng với 'gameCatalog.card.difficulty.click' — cycle easy -> medium -> hard -> easy. Guard:
     * đã có game armed (bất kỳ game nào) thì bỏ qua — độ khó khoá lại lúc đã armed (xem docstring
     * game-panel-ui.js mục "Độ khó"), tự kiểm lại state thật cùng lý do như armGame() ở trên. */
    cycleDifficulty() {
        if (appState.get('gameplayArmedGameId') != null) return;

        const order = ['easy', 'medium', 'hard'];
        const current = appState.get('gameplayDifficulty');
        const next = order[(order.indexOf(current) + 1) % order.length];
        appState.set('gameplayDifficulty', next, { skipCheck: true });
        console.log(`writer: "workflowGameCatalog.cycleDifficulty", page: "gameplayDifficulty", content: "${next}"`);

        this.renderList();
    },
};
