/**
 * core/playlist/selection.js — "Chọn nhiều" trong Playlist (cụm event `playlist`): ghi state chọn + các bước ghi DOM (dấu đã
 * chọn trên node, thanh hành động, dropup). Hàm lá, nhận state qua tham số; đọc appState, chọn hàm theo selectionMode,
 * lặp qua node là việc của Workflow (event/workflow/playlist.js, event/workflow/playlist-render.js::_applySelectionLayer()).
 *
 * Vòng tròn trống + ẩn nút 3 chấm của MỌI item là CSS theo class `is-selecting` của #playlist-container
 * (applySelectionChrome(); assets/css/layout-nav.css) — chỉ item ĐÃ chọn mới cần patch DOM.
 *
 * NẠP SAU: core/dom-refs.js (selectionActionBar...).
 */

// ===================== State =====================

function enableSelectionMode() {
    appState.set('selectionMode', true);
    console.log(`writer: "enableSelectionMode", page: "selectionMode", content: "true"`);
}

function disableSelectionMode() {
    appState.set('selectionMode', false);
    console.log(`writer: "disableSelectionMode", page: "selectionMode", content: "false"`);
    appState.mutate('selectedMediaKeys', s => s.clear());
    console.log(`writer: "disableSelectionMode", page: "selectedMediaKeys", content: "clear khi tắt chế độ chọn"`);
}

function selectMedia(key) {
    appState.mutate('selectedMediaKeys', s => s.add(key));
    console.log(`writer: "selectMedia", page: "selectedMediaKeys", content: "add ${key}"`);
}

function deselectMedia(key) {
    appState.mutate('selectedMediaKeys', s => s.delete(key));
    console.log(`writer: "deselectMedia", page: "selectedMediaKeys", content: "delete ${key}"`);
}

// ===================== DOM =====================

/**
 * Áp dấu "đã chọn" cho 1 node nếu key đang được chọn, gỡ nếu không: gỡ sạch dấu cũ, rồi nếu đang chọn thì thêm tint + vòng
 * có tick (đè đúng chỗ vòng trống của CSS). Class tint đã thêm nhớ ở `data-selection-tint` để gỡ đúng kể cả khi theme đổi
 * giữa lúc đang chọn.
 * @param {HTMLElement|null} node @param {string} key @param {Set<string>} selectedMediaKeys
 * @param {{tint: string, indicatorHtml: string}} selectionView - class tint theo theme + HTML vòng có tick
 *   (renderSelectionIndicatorHtml(), components/playlist-view.js), Workflow dựng sẵn (workflowPlaylist._selectionThemeClasses())
 */
function showSelectionIndicator(node, key, selectedMediaKeys, selectionView) {
    if (!node) return; // guard: node không tồn tại (hiếm, race với render)
    node.classList.remove(...(node.dataset.selectionTint || '').split(/\s+/).filter(Boolean)); // gỡ tint cũ (chưa có -> rỗng)
    delete node.dataset.selectionTint;
    node.querySelectorAll('[data-role="selection-indicator"]').forEach((el) => el.remove()); // gỡ vòng có tick cũ
    if (!selectedMediaKeys.has(key)) return; // chưa chọn -> để CSS vẽ vòng trống

    const tint = selectionView.tint.split(/\s+/).filter(Boolean);
    node.classList.add(...tint);
    node.dataset.selectionTint = tint.join(' ');
    node.insertAdjacentHTML('beforeend', selectionView.indicatorHtml);
}

/** Gỡ tint + vòng có tick của 1 node đã chọn — dùng khi thoát chế độ chọn. */
function hideSelectionIndicator(node) {
    if (!node) return; // guard
    node.classList.remove(...(node.dataset.selectionTint || '').split(/\s+/).filter(Boolean));
    delete node.dataset.selectionTint;
    node.querySelectorAll('[data-role="selection-indicator"]').forEach((el) => el.remove());
}

/** Thanh hành động: ẩn/hiện + nhãn số lượng. */
function updateSelectionActionBar(selectionMode, count) {
    if (!selectionActionBar) return;
    selectionActionBar.classList.toggle('hidden', !selectionMode);
    if (selectionCountLabel) selectionCountLabel.textContent = tFormat('playlistView.selection.countLabel', { count });
}

/**
 * Phần "chrome" ngoài node: class `is-selecting` trên container (CSS vẽ vòng trống + ẩn nút 3 chấm mọi item — gọi lại sau
 * mỗi lần container bị gán lại className khi đổi Grid/List), icon toggle đổi màu, nút tải lên làm mờ (Router đã chặn
 * 'playlist.uploadMenu.open' lúc đang chọn).
 */
function applySelectionChrome(selectionMode) {
    if (playlistContainer) playlistContainer.classList.toggle('is-selecting', selectionMode);
    if (btnToggleSelection) btnToggleSelection.classList.toggle('!text-sky-400', selectionMode);
    if (btnUploadAudio) btnUploadAudio.classList.toggle('opacity-40', selectionMode);
}

/**
 * Mở dropup hành động (Phát/Xuất ZIP/Thêm vào thư mục/Xoá[/Gỡ khỏi thư mục]) — luôn mở phía trên #btn-selection-more (nút
 * nằm sát đáy màn hình trong thanh hành động), dùng chung songActionOverlay để đóng khi bấm ra ngoài.
 * @param {boolean} [canRemoveFromFolder] - true = hiện mục "Gỡ khỏi thư mục" (đang Scope 1 folder).
 */
function openSelectionMoreMenu(canRemoveFromFolder) {
    if (!btnSelectionMore || !selectionMoreMenu) return; // guard
    const rect = btnSelectionMore.getBoundingClientRect();
    const menuWidth = 208;
    const left = Math.max(8, rect.right - menuWidth);
    selectionMoreMenu.style.left = `${left}px`;
    selectionMoreMenu.style.bottom = `${window.innerHeight - rect.top + 8}px`;
    selectionMoreMenu.classList.remove('hidden');
    songActionOverlay.classList.remove('hidden');
    const removeFromFolderBtn = selectionMoreMenu.querySelector('[data-menu-action="removeFromFolder"]');
    if (removeFromFolderBtn) removeFromFolderBtn.classList.toggle('hidden', !canRemoveFromFolder);
}

/** Đóng dropup hành động. */
function closeSelectionMoreMenu() {
    if (!selectionMoreMenu) return; // guard
    selectionMoreMenu.classList.add('hidden');
    songActionOverlay.classList.add('hidden');
}
