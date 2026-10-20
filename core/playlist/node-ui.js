/**
 * core/playlist/node-ui.js — node DOM của danh sách Playlist: tạo node từ HTML dựng sẵn (renderGridSongNodeHtml()/
 * renderListSongNodeHtml(), components/playlist-view.js), ẩn/hiện/gỡ/đặt chỗ/thay node, dọn + gắn vào #playlist-container.
 * Hàm lá, nhận phần tử qua tham số; diff theo renderOrder ở event/workflow/playlist-render.js. Ảnh bìa của node:
 * core/playlist/render.js (setNodeCoverUrl/revokeNodeCoverUrl/attachCoverFallback).
 *
 * NẠP SAU: service/component-dynamic.js (instantiateComponent).
 */

/** Node Playlist từ HTML (1 phần tử gốc mang data-key/data-role). @param {string} html @returns {HTMLElement} */
function createSongNode(html) {
    const node = instantiateComponent(html).firstElementChild; // service/component-dynamic.js
    node._coverObjectUrl = null; // object URL ảnh bìa thật — gắn sau khi node lại gần khung nhìn
    return node;
}

/** `<img>` ảnh bìa của node (để gắn fallback lỗi ảnh). @param {HTMLElement} node @returns {HTMLImageElement|null} */
function findSongNodeCoverImg(node) {
    return node.querySelector('img');
}

/** Node bị Search/Filter lọc tạm — chỉ ẩn, giữ node + ảnh bìa đã tải. */
function hidePlaylistNode(node) {
    node.classList.add('hidden');
}

/** Hiện lại node đang ẩn tạm. @returns {HTMLElement} chính node */
function revealPlaylistNode(node) {
    node.classList.remove('hidden');
    return node;
}

function removePlaylistNode(node) {
    node.remove();
}

/** Đặt `node` ngay sau `prevNode` (đầu danh sách nếu null). Đã đúng chỗ thì thôi — insertBefore 1 node đã đúng chỗ vẫn
 * gỡ ra gắn lại (tốn layout + bắn MutationObserver vô ích). */
function placePlaylistNodeAfter(container, node, prevNode) {
    const expectedNextSibling = prevNode ? prevNode.nextSibling : container.firstChild;
    if (expectedNextSibling === node) return; // guard — đã đúng chỗ
    container.insertBefore(node, expectedNextSibling);
}

/** Thay node cũ bằng node dựng lại tại chỗ, giữ trạng thái ẩn tạm (tránh nháy hiện 1 khung hình rồi ẩn lại). */
function replacePlaylistNode(oldNode, newNode) {
    newNode.classList.toggle('hidden', oldNode.classList.contains('hidden'));
    oldNode.replaceWith(newNode);
}

function clearPlaylistContainer(container) {
    container.innerHTML = '';
}

function appendPlaylistNode(container, node) {
    container.appendChild(node);
}

/** DOM đang khớp domNodesByKey (số node con = số node đang quản lý) — lệch thì phải dựng lại toàn bộ.
 * @param {HTMLElement} container @param {Map<string, HTMLElement>} domNodesByKey @returns {boolean} */
function isPlaylistDomInSync(container, domNodesByKey) {
    return container.children.length === domNodesByKey.size;
}
