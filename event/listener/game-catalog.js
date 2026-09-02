/**
 * event/listener/game-catalog.js — MỚI (02/09/2026). Listener cụm "gameCatalog". Card render ĐỘNG
 * (`.innerHTML` đổi hẳn mỗi lần armed/độ khó thay đổi, xem event/workflow/game-catalog.js::
 * renderList()) -> KHÔNG gắn listener trực tiếp lên từng nút (mất theo mỗi lần re-render) — dùng
 * DELEGATION trên `gamePanelList` (gốc TĨNH, mount 1 lần lúc boot), cùng khuôn
 * event/listener/file-manager-storage.js::handleFileManagerStorageDelegatedClick() (delegate trên
 * `genericDrawerBody`).
 *
 * `:not([disabled])` trong mỗi `closest()` — card khoá (game khác đang armed) / độ khó khoá (đã có
 * game armed) render nút với thuộc tính `disabled` thật (không chỉ CSS mờ) — trình duyệt tự
 * KHÔNG bắn `click` lên phần tử `disabled`, nhưng vẫn tự kiểm lại đây cho rõ ý định (nút bấm qua
 * `e.target.closest()` có thể là 1 `<svg>`/`<span>` con NẰM TRONG nút disabled, `closest()` vẫn
 * trả về nút cha disabled đó nếu không loại trừ tường minh).
 *
 * NẠP SAU CÙNG (sau bus, core, workflow, router, VÀ SAU dom-refs.js).
 */
function handleGamePanelListDelegatedClick(e) {
    const playBtn = e.target.closest('.game-card-play-btn:not([disabled])');
    if (playBtn) {
        eventBus.send({ router: 'gameCatalog', type: 'gameCatalog.card.play.click', payload: { gameId: playBtn.dataset.gameId } });
        return;
    }

    const exitBtn = e.target.closest('.game-card-exit-btn');
    if (exitBtn) {
        eventBus.send({ router: 'gameCatalog', type: 'gameCatalog.card.exit.click', payload: { gameId: exitBtn.dataset.gameId } });
        return;
    }

    const difficultyBtn = e.target.closest('.game-card-difficulty-btn:not([disabled])');
    if (difficultyBtn) {
        eventBus.send({ router: 'gameCatalog', type: 'gameCatalog.card.difficulty.click', payload: { gameId: difficultyBtn.dataset.gameId } });
        return;
    }
}

if (gamePanelList) {
    gamePanelList.addEventListener('click', handleGamePanelListDelegatedClick);
}
