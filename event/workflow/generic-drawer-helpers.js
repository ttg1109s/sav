/**
 * event/workflow/generic-drawer-helpers.js — GỘP LẠI (31/07/2026, Giang chỉ ra: "xây Generic Drawer
 * mà vẫn phải nhân bản là vô lý") — `closeFully()` từng bị chép nguyên văn ở nhiều file Workflow
 * (file-manager-photo/file-manager-video/file-manager-folder-browser/playlist/image-edit/
 * video-editor). Gộp về ĐÚNG 1 chỗ, mọi nơi gọi qua `workflowGenericDrawerHelpers.xxx()`.
 *
 * SỬA (31/07/2026, Giang chỉ ra "core tạo ra addEventListener chứ không phải workflow") —
 * `buildSimpleHeaderHtml()` (trả headerHtml "tiêu đề + nút X", dùng bởi picker Ảnh/lưới tool Edit)
 * ĐÃ XOÁ khỏi đây — phần WIRE nút X đó bắt buộc là Core (Rule 5a), nên header HTML gộp LUÔN vào
 * chính hàm Core dựng+wire Drawer đó (core/media-picker-drawer-helper.js::openMediaPickerDrawerUi()/
 * core/file-manager/photo-ui.js::openPhotoEditToolGridDrawerUi(), mỗi hàm tự có bản HTML riêng,
 * chấp nhận trùng lặp nhỏ — tránh 1 hàm Core gọi hàm Core khác chỉ để lấy string, Rule 3a không có
 * ngoại lệ nào cho việc đó).
 *
 * `closeFully()` VẪN ở Workflow (không phải core/generic-drawer.js) — đây KHÔNG phải wiring cho
 * tương tác người dùng (Rule 5a không áp) mà là ĐIỀU PHỐI tuần tự 2 lời gọi Core (`closeGenericDrawer()`
 * -> đợi `transitionend` -> `hideGenericDrawerImmediately()`) — đúng vai trò Workflow (cùng vai trò
 * `taskManager`, Rule 3b cấm `taskManager` trong Core).
 *
 * `video-editor.js` KHÔNG gọi thẳng `closeFully()` — nó cần thêm side-effect riêng
 * (`_destroyShiftWaveform()`/`_renderAllTracks()`/...) quanh cùng lõi này, vẫn giữ
 * `_closeGenericDrawerFully()` riêng nhưng thân hàm giờ gọi `closeFully()` thay vì chép lại lõi.
 *
 * NẠP SAU: core/generic-drawer.js, dom-refs.js (genericDrawerPanel).
 */
const workflowGenericDrawerHelpers = {

    // ===================== Nhớ vị trí cuộn theo màn — MỚI (24/09/2026) =====================
    // Giang báo 2 lỗi: (1) vẽ lại TẠI CHỖ 1 màn trong Generic Drawer (đổi field -> dựng lại body) mất vị trí
    // cuộn; (2) quay về màn cũ (Back, hoặc đóng picker/editor con đã mượn Drawer) luôn về 0. Nguyên nhân:
    // `updateGenericDrawer()` (core) ép `scrollTop = 0` mỗi lần thay nội dung. Core giờ chỉ NHẬN `scrollTop`
    // qua tham số; nhớ theo màn nằm Ở ĐÂY (Workflow):
    //   - Màn tham gia đặt tên qua `config.scrollKey` (+ `config.scrollReset: true` cho màn ĐI TỚI) rồi gắn
    //     qua `open()`/`update()` dưới thay vì gọi thẳng core.
    //   - Vị trí được GHI LIÊN TỤC theo sự kiện `scroll` của body (Listener -> Router 'genericDrawer' ->
    //     `trackScroll()`), CHỈ khi nội dung đang gắn vẫn đúng là nội dung của key đó (`_scrollAnchor` còn là
    //     con của body) — nên picker/editor "ngoài" (gọi thẳng core, không key) chiếm tạm Drawer KHÔNG ghi đè
    //     vị trí của màn bị che; lúc màn đó vẽ lại (`update()` cùng key) về đúng chỗ đã rời đi.
    //   - Phiên nhớ: xoá sạch khi mở Drawer đang ĐÓNG (`open()`) và khi đóng hẳn (`closeFully()`).
    _scrollMemo: new Map(), // scrollKey -> scrollTop
    _scrollKey: null, // key của nội dung gắn GẦN NHẤT qua open()/update() (null = không tham gia)
    _scrollAnchor: null, // node đầu tiên của nội dung đó — bị tách khỏi body khi nội dung khác thay vào
    _scrollTarget: 0, // vị trí đích của lần gắn gần nhất — `restoreScroll()` áp lại

    /** Gắn nội dung MỚI (mở Drawer) — thay cho gọi thẳng `openGenericDrawer()` ở màn có `scrollKey`. Nội dung
     * mở mới luôn từ đầu; Drawer đang đóng -> phiên nhớ mới. @param {object} config - config của core + `scrollKey`. */
    open(config) {
        const { scrollKey, scrollReset, ...drawerConfig } = config;
        if (genericDrawerPanel.classList.contains('hidden')) this._scrollMemo.clear(); // phiên mới
        this._mountWithScroll(openGenericDrawer, drawerConfig, scrollKey, 0); // core/generic-drawer.js
    },

    /** Thay nội dung Drawer đang mở — thay cho gọi thẳng `updateGenericDrawer()` ở màn có `scrollKey`. Cùng key
     * (vẽ lại tại chỗ / quay lại) -> về vị trí đã nhớ; `scrollReset` hoặc chưa từng nhớ -> 0.
     * @param {object} config - config của core + `scrollKey`/`scrollReset`. */
    update(config) {
        const { scrollKey, scrollReset, ...drawerConfig } = config;
        const target = (scrollKey && !scrollReset && this._scrollMemo.has(scrollKey)) ? this._scrollMemo.get(scrollKey) : 0;
        this._mountWithScroll(updateGenericDrawer, drawerConfig, scrollKey, target); // core/generic-drawer.js
    },

    /** @param {(config:object) => void} mountFn - openGenericDrawer | updateGenericDrawer (core) */
    _mountWithScroll(mountFn, drawerConfig, scrollKey, target) {
        mountFn({ ...drawerConfig, scrollTop: target });
        this._scrollKey = scrollKey || null;
        this._scrollAnchor = genericDrawerBody.firstChild;
        this._scrollTarget = target;
    },

    /** Áp lại vị trí đích của lần gắn gần nhất — gọi SAU onMount/wire đồng bộ làm nội dung cao thêm (bỏ `hidden`
     * các hàng theo config...): lúc gắn nội dung còn thấp nên trình duyệt kẹp scrollTop nhỏ hơn đích. */
    restoreScroll() {
        genericDrawerBody.scrollTop = this._scrollTarget;
    },

    /** Ứng với 'genericDrawer.body.scroll' — ghi vị trí hiện tại cho key của nội dung ĐANG gắn (bỏ qua nếu nội
     * dung đó đã bị 1 màn ngoài không key thay chỗ). */
    trackScroll() {
        if (!this._scrollKey || !this._scrollAnchor || this._scrollAnchor.parentNode !== genericDrawerBody) return;
        this._scrollMemo.set(this._scrollKey, genericDrawerBody.scrollTop);
    },

    /** Trượt Generic Drawer xuống rồi ẩn hẳn sau `transitionend` (Core `core/generic-drawer.js`
     * KHÔNG được tự `addEventListener` cho DOM tĩnh, xem docstring đầu file). */
    closeFully() {
        closeGenericDrawer(); // core/generic-drawer.js
        genericDrawerPanel.addEventListener('transitionend', function onTransitionEnd() {
            genericDrawerPanel.removeEventListener('transitionend', onTransitionEnd);
            hideGenericDrawerImmediately(); // core/generic-drawer.js
        }, { once: true });
        // MỚI (24/09/2026) — đóng hẳn = hết phiên nhớ cuộn (xem khối "Nhớ vị trí cuộn" ở đầu object).
        this._scrollMemo.clear();
        this._scrollKey = null;
        this._scrollAnchor = null;
        this._scrollTarget = 0;
    },
};
