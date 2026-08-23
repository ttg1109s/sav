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
 * appState.get() selectionMode/selectedSongKeys. Chỉ báo "đã chọn" là 1 lớp DOM-patch ĐỘC LẬP
 * hoàn toàn (hàm THUẦN dưới đây, nhận state qua tham số) — buildSongNode() giữ NGUYÊN VẸN bản gốc.
 *
 * Nơi ĐỌC appState rồi ĐIỀU PHỐI (set/mutate state -> patch DOM -> cập nhật action bar) là WORKFLOW
 * (event/workflow/playlist.js) — đúng vai trò được appState.get() tự do + gọi nhiều hàm nối tiếp.
 *
 * GIỚI HẠN ĐÃ BIẾT: nếu buildSongNode() tạo NODE MỚI trong lúc selectionMode đang bật, node mới đó
 * CHƯA có chỉ báo cho tới lần refreshAllSelectionVisuals() kế tiếp — trade-off chấp nhận được.
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
    appState.mutate('selectedSongKeys', s => s.clear());
    console.log(`writer: "disableSelectionMode", page: "selectedSongKeys", content: "clear khi tắt chế độ chọn"`);
}

function selectSong(key) {
    appState.mutate('selectedSongKeys', s => s.add(key));
    console.log(`writer: "selectSong", page: "selectedSongKeys", content: "add ${key}"`);
}

function deselectSong(key) {
    appState.mutate('selectedSongKeys', s => s.delete(key));
    console.log(`writer: "deselectSong", page: "selectedSongKeys", content: "delete ${key}"`);
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

/** Hiện chỉ báo đã/chưa chọn + ẩn menu 3 chấm cho 1 node. */
function showSelectionIndicator(node, key, selectedSongKeys) {
    if (!node) return; // guard: node không tồn tại (hiếm, race với render) — bỏ qua
    const menuBtn = node.querySelector('button[data-action="menu"]');
    if (menuBtn) menuBtn.classList.add('hidden'); // tránh 2 mục tiêu bấm cạnh tranh nhau

    const isSelected = selectedSongKeys.has(key);
    node.classList.toggle('bg-sky-500/10', isSelected);
    node.classList.add('relative'); // positioning context cho overlay — vô hại nếu đã có sẵn (grid view)

    let indicator = node.querySelector('[data-role="selection-indicator"]');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.dataset.role = 'selection-indicator';
        node.appendChild(indicator);
    }
    indicator.className = `absolute top-2 left-2 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-sky-500 border-sky-500' : 'bg-black/30 border-white/30'}`;
    indicator.innerHTML = isSelected ? '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>' : '';
}

/** Gỡ chỉ báo + hiện lại menu 3 chấm cho 1 node — dùng khi thoát chế độ chọn. */
function hideSelectionIndicator(node) {
    if (!node) return; // guard
    const menuBtn = node.querySelector('button[data-action="menu"]');
    if (menuBtn) menuBtn.classList.remove('hidden');
    node.classList.remove('bg-sky-500/10');
    const indicator = node.querySelector('[data-role="selection-indicator"]');
    if (indicator) indicator.remove();
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
    if (btnToggleSelection) btnToggleSelection.classList.toggle('!text-sky-400', selectionMode);
    // XOÁ (phản hồi Giang — "1 khung, không nhân bản") — dòng toggle `btnUploadVideo` bỏ hẳn cùng
    // lúc element đó bị xoá — nút upload giờ DÙNG CHUNG (btnUploadAudio) cho cả 3 Nguồn, dòng dưới
    // đã tự phủ hết mọi trường hợp, không cần dòng riêng cho Video nữa.
    if (btnUploadAudio) btnUploadAudio.classList.toggle('opacity-40', selectionMode);
}

/**
 * Mở dropup 4 hành động (Phát/Xuất ZIP/Thêm vào thư mục/Xoá) — CÙNG PATTERN định vị với
 * openSongActionMenu()/openUploadActionMenu() (core/playlist/actions.js, loader.js), CHỈ khác:
 * luôn mở PHÍA TRÊN #btn-selection-more bằng `bottom` (không cần nhánh "đủ chỗ bên dưới không" vì
 * nút này LUÔN nằm sát đáy màn hình trong thanh hành động — khác 2 menu kia có thể mở ở bất kỳ vị
 * trí cuộn nào). Hàm THUẦN UI, không I/O, không appState.
 */
function openSelectionMoreMenu() {
    if (!btnSelectionMore || !selectionMoreMenu) return; // guard
    const rect = btnSelectionMore.getBoundingClientRect();
    const menuWidth = 208;
    let left = rect.right - menuWidth;
    if (left < 8) left = 8;
    selectionMoreMenu.style.left = `${left}px`;
    selectionMoreMenu.style.bottom = `${window.innerHeight - rect.top + 8}px`;
    selectionMoreMenu.classList.remove('hidden');
    songActionOverlay.classList.remove('hidden');
}

/** Đóng dropup 4 hành động — dùng CHUNG songActionOverlay (xem comment ở openSelectionMoreMenu). */
function closeSelectionMoreMenu() {
    if (!selectionMoreMenu) return; // guard
    selectionMoreMenu.classList.add('hidden');
    songActionOverlay.classList.add('hidden');
}
