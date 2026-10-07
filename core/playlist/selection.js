/**
 * core/playlist/selection.js — "Chọn nhiều" trong Playlist, ver 12 "Multi Media"
 * (plan-v12-multimedia.md mục 4.b1). Cụm event sở hữu: `playlist` (đã chốt).
 *
 * SỬA LẦN 2 (sau trao đổi Rule 1/VMState): bản trước có if/else CHỌN GIỮA 2 TIẾN TRÌNH khác nhau
 * nằm trong 1 hàm (bật/tắt chế độ chọn trong setSelectionMode(), chọn/bỏ-chọn trong
 * toggleSongSelection(), hiện/ẩn overlay trong applySelectionVisual()) — vi phạm Rule 1 (đây
 * không phải guard-clause early-return thuần, mà là 2 kịch bản hoàn chỉnh khác nhau). Tách hẳn
 * thành các hàm đơn tuyến, nơi cần CHỌN hàm nào chạy dùng VirtualMachineState.run() (đúng cơ chế
 * Rule 1 chỉ định), không viết if/else tay nữa.
 *
 * SỬA LẦN 1 (Rule 2): buildSongNode()/renderPlaylistFull()/renderPlaylistDiff() KHÔNG chạy trong
 * workflow, bị gọi THẲNG bởi core khác/router ở nhiều nơi khác — KHÔNG được sửa để tự
 * appState.get() selectionMode/selectedMediaKeys. Chỉ báo "đã chọn" là 1 lớp DOM-patch ĐỘC LẬP
 * hoàn toàn (hàm THUẦN dưới đây, nhận state qua tham số) — buildSongNode() giữ NGUYÊN VẸN bản gốc.
 *
 * Nơi ĐỌC appState rồi ĐIỀU PHỐI (set/mutate state -> patch DOM -> cập nhật action bar) là WORKFLOW
 * (event/workflow/playlist.js) — đúng vai trò được appState.get() tự do + gọi nhiều hàm nối tiếp.
 *
 * SỬA (24/09/2026) — "giới hạn đã biết" cũ (node dựng MỚI lúc đang chọn thiếu/lệch chỉ báo) đã xử lý:
 * `workflowPlaylistRender.buildSongNode()` tự gọi `showSelectionIndicator()` qua `_applySelectionLayer()` cho mọi
 * node vừa dựng khi selectionMode bật (event/workflow/playlist-render.js).
 *
 * NẠP SAU: core/dom-refs.js (selectionActionBar...). KHÔNG cần VirtualMachineState nữa — dispatch
 * theo selectionMode đã dời hẳn sang workflow (xem SỬA LẦN 3 bên dưới).
 */

// ===================== State — set/mutate thuần, KHÔNG rẽ nhánh tiến trình =====================

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

/** ĐỔI TÊN (07/09/2026, cùng lý do deleteSongFromActionMenu -> deleteMediaFromActionMenu) —
 * `selectSong`/`deselectSong` cũ chọn được cả Video/Photo từ Batch 6, tên gây hiểu lầm y hệt. */
function selectMedia(key) {
    appState.mutate('selectedMediaKeys', s => s.add(key));
    console.log(`writer: "selectMedia", page: "selectedMediaKeys", content: "add ${key}"`);
}

function deselectMedia(key) {
    appState.mutate('selectedMediaKeys', s => s.delete(key));
    console.log(`writer: "deselectMedia", page: "selectedMediaKeys", content: "delete ${key}"`);
}

// ===================== DOM-patch — hàm THUẦN, không I/O, không appState =====================

/**
 * SỬA LẦN 3 (sau trao đổi Rule 3): `refreshAllSelectionVisuals()` (đã BỎ khỏi file này) từng là 1
 * hàm core GỌI showSelectionIndicator()/hideSelectionIndicator() (void, không return) trong vòng
 * lặp — dù chọn hàm nào chạy qua VirtualMachineState (đúng Rule 1), bản thân việc "core gọi core
 * void để side-effect" VẪN vi phạm Rule 3, bất kể cơ chế chọn hàm là gì. VMState chỉ giải quyết
 * Rule 1, không "miễn" Rule 3. Sửa đúng: vòng lặp + VMState dispatch dời hẳn sang WORKFLOW
 * (event/workflow/playlist.js, toggleSelectionMode()) — nơi ĐƯỢC PHÉP gọi nhiều hàm core void nối
 * tiếp nhau (đúng vai trò "chân tay", không bị 4 rule ràng buộc). File này CHỈ còn giữ
 * showSelectionIndicator()/hideSelectionIndicator() — 2 hàm LÁ thật sự (không gọi core nào khác,
 * chỉ dùng DOM API của trình duyệt — KHÔNG tính là "core khác" theo Rule 3).
 */

/** Áp dấu "đã chọn" (tint + vòng có tick) cho 1 node nếu key đang được chọn, gỡ nếu không — vòng trống + ẩn menu 3 chấm là CSS (xem thân hàm).
 * SỬA 23/09/2026 (rà soát theme — mục "còn nợ" multi-select tint sky cứng) — thêm `themeClasses` ({tint, indicatorSelected}: chuỗi class
 * Tailwind ĐÃ TRA SẴN theo theme đang active, Workflow truyền vào — event/workflow/playlist.js::_selectionThemeClasses()). Hàm vẫn là LÁ:
 * không gọi core nào khác, không tự tra theme, chỉ thao tác classList. Class tint đã thêm được nhớ ở `data-selection-tint` để gỡ đúng
 * (kể cả khi theme đổi giữa lúc đang ở chế độ chọn). Vòng CHƯA chọn (đen mờ + viền trắng, đè ảnh bìa) cố định, không theo theme.
 * @param {{tint:string, indicatorSelected:string}} themeClasses */
function showSelectionIndicator(node, key, selectedMediaKeys, themeClasses) {
    if (!node) return; // guard: node không tồn tại (hiếm, race với render) — bỏ qua
    // SỬA (02/10/2026, tối ưu 10000 item) — vòng tròn TRỐNG + ẩn nút 3 chấm giờ do CSS vẽ cho MỌI item khi
    // #playlist-container có class `is-selecting` (applySelectionChrome() bên dưới; assets/css/layout-nav.css) — bật chế
    // độ chọn không còn phải tạo 1 element/ẩn 1 nút trên TỪNG node (đo 10000 item: ~1,4 s). Hàm này giờ chỉ lo phần
    // RIÊNG của item ĐÃ CHỌN: gỡ sạch dấu cũ, rồi nếu đang chọn thì tint + vòng có tick (đè đúng chỗ vòng trống của CSS).
    node.classList.remove(...(node.dataset.selectionTint || '').split(/\s+/).filter(Boolean)); // gỡ tint cũ (đọc lại từ data-selection-tint; chưa có -> danh sách rỗng)
    delete node.dataset.selectionTint;
    node.querySelectorAll('[data-role="selection-indicator"]').forEach((el) => el.remove()); // gỡ vòng có tick cũ (nếu có)
    if (!selectedMediaKeys.has(key)) return; // chưa chọn -> để CSS vẽ vòng trống

    const tint = themeClasses.tint.split(/\s+/).filter(Boolean);
    node.classList.add(...tint);
    node.dataset.selectionTint = tint.join(' ');

    const indicator = document.createElement('div');
    indicator.dataset.role = 'selection-indicator';
    indicator.className = `absolute top-2 left-2 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors border-transparent ${themeClasses.indicatorSelected}`;
    indicator.innerHTML = renderSelectionIndicatorCheckHtml(); // components/playlist-view.js — SỬA 07/10/2026: chuỗi icon dời khỏi core
    node.appendChild(indicator);
}

// XOÁ (02/10/2026, rà Rule 3a) — `_clearSelectionTint(node)` (hàm top-level riêng, show/hideSelectionIndicator() cùng
// gọi = core gọi core) — 3 dòng thân nhập thẳng vào 2 hàm đó.

/** Gỡ tint + vòng có tick của 1 node đã chọn — dùng khi thoát chế độ chọn (nút 3 chấm + vòng trống là CSS `is-selecting`). */
function hideSelectionIndicator(node) {
    if (!node) return; // guard
    // SỬA (02/10/2026) — không còn đụng nút 3 chấm (CSS `is-selecting` ẩn/hiện nó), chỉ gỡ phần riêng của item đã chọn.
    node.classList.remove(...(node.dataset.selectionTint || '').split(/\s+/).filter(Boolean)); // gỡ tint cũ (đọc lại từ data-selection-tint; chưa có -> danh sách rỗng)
    delete node.dataset.selectionTint;
    node.querySelectorAll('[data-role="selection-indicator"]').forEach((el) => el.remove());
}

/** Patch thanh hành động (số lượng, ẩn/hiện) — hàm THUẦN, nhận đủ qua tham số. */
function updateSelectionActionBar(selectionMode, count) {
    if (!selectionActionBar) return;
    selectionActionBar.classList.toggle('hidden', !selectionMode);
    if (selectionCountLabel) selectionCountLabel.textContent = tFormat('playlistView.selection.countLabel', { count });
}

/**
 * Patch 2 nút "chrome" (không phải node bài hát): icon toggle đổi màu khi đang bật (đúng bug (a)
 * bác báo — icon không đổi để báo đang chọn), nút tải lên làm mờ khi đang chọn (đồng bộ VISUAL với
 * việc router đã CHẶN 'playlist.uploadMenu.open' lúc selectionMode=true — xem router/playlist.js).
 * Hàm THUẦN, nhận selectionMode qua tham số.
 */
function applySelectionChrome(selectionMode) {
    // MỚI (02/10/2026, tối ưu 10000 item) — 1 class trên container thay cho patch từng node: CSS vẽ vòng tròn trống + ẩn
    // nút 3 chấm cho mọi item (assets/css/layout-nav.css). Gọi lại sau mỗi lần container bị gán lại className (đổi
    // Grid/List — workflowPlaylist.changeViewMode()).
    if (playlistContainer) playlistContainer.classList.toggle('is-selecting', selectionMode);
    if (btnToggleSelection) btnToggleSelection.classList.toggle('!text-sky-400', selectionMode);
    // XOÁ (phản hồi Giang — "1 khung, không nhân bản") — dòng toggle `btnUploadVideo` bỏ hẳn cùng
    // lúc element đó bị xoá — nút upload giờ DÙNG CHUNG (btnUploadAudio) cho cả 3 Nguồn, dòng dưới
    // đã tự phủ hết mọi trường hợp, không cần dòng riêng cho Video nữa.
    if (btnUploadAudio) btnUploadAudio.classList.toggle('opacity-40', selectionMode);
}

/**
 * Mở dropup hành động (Phát/Xuất ZIP/Thêm vào thư mục/Xoá[/Gỡ khỏi thư mục]) — CÙNG PATTERN định vị
 * với openSongActionMenu()/openUploadActionMenu() (core/playlist/actions.js, loader.js), CHỈ khác:
 * luôn mở PHÍA TRÊN #btn-selection-more bằng `bottom` (không cần nhánh "đủ chỗ bên dưới không" vì
 * nút này LUÔN nằm sát đáy màn hình trong thanh hành động — khác 2 menu kia có thể mở ở bất kỳ vị
 * trí cuộn nào). Hàm THUẦN UI, không tự appState — Rule 2, nhận `canRemoveFromFolder` qua tham số
 * (MỚI 06/09/2026, hợp nhất Folder vào Playlist, Batch 5 — nơi gọi/Router tự tính, xem
 * event/router/playlist.js).
 * @param {boolean} [canRemoveFromFolder] - true = hiện mục "Gỡ khỏi thư mục" (đang Scope 1 folder).
 */
function openSelectionMoreMenu(canRemoveFromFolder) {
    if (!btnSelectionMore || !selectionMoreMenu) return; // guard
    const rect = btnSelectionMore.getBoundingClientRect();
    const menuWidth = 208;
    let left = rect.right - menuWidth;
    left = Math.max(8, left); // SỬA (02/10/2026) — kẹp mép trái bằng phép tính, không if
    selectionMoreMenu.style.left = `${left}px`;
    selectionMoreMenu.style.bottom = `${window.innerHeight - rect.top + 8}px`;
    selectionMoreMenu.classList.remove('hidden');
    songActionOverlay.classList.remove('hidden');
    // MỚI (06/09/2026) — mục "Gỡ khỏi thư mục" chỉ có ý nghĩa khi đang Scope 1 folder cụ thể.
    const removeFromFolderBtn = selectionMoreMenu.querySelector('[data-menu-action="removeFromFolder"]');
    if (removeFromFolderBtn) removeFromFolderBtn.classList.toggle('hidden', !canRemoveFromFolder);
}

/** Đóng dropup 4 hành động — dùng CHUNG songActionOverlay (xem comment ở openSelectionMoreMenu). */
function closeSelectionMoreMenu() {
    if (!selectionMoreMenu) return; // guard
    selectionMoreMenu.classList.add('hidden');
    songActionOverlay.classList.add('hidden');
}
