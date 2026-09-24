/**
 * event/workflow/generic-drawer-helpers.js — GỘP LẠI (31/07/2026, Giang chỉ ra: "xây Generic Drawer
 * mà vẫn phải nhân bản là vô lý") — `closeFully()` từng bị chép nguyên văn ở nhiều file Workflow
 * (file-manager-photo/file-manager-video/file-manager-folder-browser/playlist/image-edit/
 * video-editor). Gộp về ĐÚNG 1 chỗ, mọi nơi gọi qua `workflowGenericDrawerHelpers.xxx()`.
 *
 * SỬA (31/07/2026, Giang chỉ ra "core tạo ra addEventListener chứ không phải workflow") —
 * `buildSimpleHeaderHtml()` (trả headerHtml "tiêu đề + nút X", dùng bởi picker Ảnh/lưới tool Edit)
 * ĐÃ XOÁ khỏi đây — phần WIRE nút X đó bắt buộc là Core (Rule 5a), nên header HTML gộp LUÔN vào
 * chính hàm Core dựng+wire Drawer đó (core/media-picker-drawer-ui.js (nay: workflowGenericDrawerHelpers.mountMediaPicker())/
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
 * NẠP SAU: core/generic-drawer.js, dom-refs.js (genericDrawerPanel). Gọi lúc runtime (không cần thứ tự nạp):
 * service/task-manager.js, core/ui-theme/apply-ui.js, core/media-picker-drawer-ui.js.
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
    _scrollClamped: false, // MỚI (24/09/2026) — lần áp vị trí gần nhất bị trình duyệt kẹp (panel đang animate cao hơn đích) -> áp lại lúc animation xong

    // ===================== Animation chiều cao — MỚI (24/09/2026) =====================
    // Giang yêu cầu: đổi nội dung (`update()`) phải co/giãn chiều cao mượt CẢ 2 chiều (fade chéo từng thêm rồi BỎ theo
    // yêu cầu Giang cùng ngày);
    // "hiệu quả, đơn giản, không bug". Core (core/generic-drawer.js) chỉ còn các hàm 1 việc: đo, animate. Điều phối + hẹn giờ (taskManager, cấm trong core) nằm Ở ĐÂY.
    //   - Chiều cao animate bằng Web Animations API: xong tự trả về chiều cao thật theo nội dung -> không cần bước
    //     "nhả khoá", không kẹt px khi nội dung đổi về sau.
    //   - Nội dung đổi TẠI CHỖ sau khi gắn (onMount bỏ `hidden` các hàng, toggle nội bộ...) do Listener quan sát
    //     (event/listener/generic-drawer.js, MutationObserver) -> 'genericDrawer.body.mutate' -> `onBodyMutated()`:
    //     đang animate thì NHẮM LẠI đích mới trong thời gian còn lại, không thì animate từ chiều cao cũ.
    _heightPx: 0, // chiều cao THẬT gần nhất đã biết (đích của lần animate/đo gần nhất)
    _heightAnimEndAt: 0, // performance.now() lúc animation chiều cao hiện tại kết thúc (0 = không chạy)
    // SỬA (24/09/2026, Giang báo "giật") — nhớ đủ tham số animation đang chạy để khi phải huỷ tạm (đo lại lúc nội dung
    // đổi) mà đích KHÔNG đổi thì dựng lại y hệt + tua đúng chỗ, thay vì bắt đầu 1 animation mới từ giữa chừng (bản cũ:
    // đường cong chạy lại từ đầu -> vận tốc đổi đột ngột = khựng; xảy ra ngay sau MỖI lần đổi màn vì chính cú thay nội
    // dung cũng bắn 1 lượt 'genericDrawer.body.mutate').
    _heightAnimFromPx: 0,
    _heightAnimStartAt: 0,
    _heightAnimDurationMs: 0,

    /** @returns {boolean} hệ điều hành đang bật Giảm chuyển động -> tắt co/giãn + fade chéo. */
    _reduceMotion() {
        return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },

    /** Bắt đầu animate chiều cao (hoặc chỉ ghi nhận nếu không cần). @param {number} nowMs - performance.now() */
    _startHeightAnim(fromPx, toPx, durationMs, nowMs) {
        this._heightPx = toPx;
        if (durationMs <= 0 || Math.abs(fromPx - toPx) < 1) { this._heightAnimEndAt = 0; return; }
        animateGenericDrawerHeight(fromPx, toPx, durationMs); // core/generic-drawer.js
        this._heightAnimFromPx = fromPx;
        this._heightAnimStartAt = nowMs;
        this._heightAnimDurationMs = durationMs;
        this._heightAnimEndAt = nowMs + durationMs;
    },

    /** Gắn nội dung MỚI (mở Drawer, hoặc mở ĐÈ lên Drawer đang hiện). SỬA (24/09/2026) — giờ là lối DUY NHẤT để mở
     * Generic Drawer (mọi Workflow gọi hàm này, không gọi thẳng core): áp UI Theme sau khi gắn (core không được tự gọi
     * `applyUiThemeToDom()` — Rule 3), huỷ hẹn giờ ẩn còn treo của lần đóng trước.
     * @param {object} config - config của core + `scrollKey` (tuỳ chọn). */
    open(config) {
        const { scrollKey, scrollReset, ...drawerConfig } = config;
        taskManager.kill('genericDrawerHideAfterClose'); // đóng rồi mở lại trong < 300ms: không để hẹn giờ cũ ẩn mất Drawer mới
        taskManager.kill('genericDrawerHeightAnimEnd');
        if (genericDrawerPanel.classList.contains('hidden')) this._scrollMemo.clear(); // phiên mới
        // SỬA (24/09/2026, Giang báo "viền list item nháy sáng") — THỨ TỰ BẮT BUỘC: gắn nội dung -> áp theme -> MỚI tới
        // bước đọc layout (trượt vào ép reflow, đo, đặt scroll). Áp theme sau reflow = viền có transition chạy từ màu
        // mặc định sáng sang màu theme = nháy. Xem core/generic-drawer.js::mountGenericDrawerContent().
        mountGenericDrawerContent(drawerConfig); // core/generic-drawer.js
        applyUiThemeToDom(genericDrawerPanel, _activeUiThemeKeyList); // core/ui-theme/apply-ui.js
        openGenericDrawer(); // core/generic-drawer.js
        this._heightPx = settleGenericDrawerHeightPx(); // core/generic-drawer.js
        this._heightAnimEndAt = 0;
        this._setScrollState(scrollKey, 0);
    },

    /** Thay nội dung Drawer ĐANG mở — co/giãn chiều cao mượt. Cùng `scrollKey` (vẽ lại tại chỗ / quay lại) -> về vị
     * trí đã nhớ; `scrollReset` hoặc chưa từng nhớ -> 0. SỬA (24/09/2026) — lối DUY NHẤT để thay nội dung.
     * XOÁ (24/09/2026, Giang yêu cầu "bỏ crossfade") — fade chéo nội dung cũ/mới (lớp phủ + 3 hàm core begin/play/clear) bỏ hẳn; nội dung mới
     * thay NGAY, chỉ chiều cao animate.
     * @param {object} config - config của core + `scrollKey`/`scrollReset` (tuỳ chọn). */
    update(config) {
        const { scrollKey, scrollReset, ...drawerConfig } = config;
        const target = (scrollKey && !scrollReset && this._scrollMemo.has(scrollKey)) ? this._scrollMemo.get(scrollKey) : 0;
        const heightMs = this._reduceMotion() ? 0 : GENERIC_DRAWER_HEIGHT_ANIM_MS; // core/generic-drawer.js
        const nowMs = performance.now();
        const fromPx = readGenericDrawerHeightPx(); // core — chiều cao ĐANG hiển thị (kể cả giữa 1 animation trước)
        taskManager.kill('genericDrawerHeightAnimEnd');
        // SỬA (24/09/2026) — gắn -> áp theme NGAY, trước mọi bước đọc layout (lý do: xem `open()` ngay trên).
        mountGenericDrawerContent(drawerConfig); // core
        applyUiThemeToDom(genericDrawerPanel, _activeUiThemeKeyList); // core/ui-theme/apply-ui.js
        const toPx = settleGenericDrawerHeightPx(); // core
        this._startHeightAnim(fromPx, toPx, heightMs, nowMs);
        this._setScrollState(scrollKey, target);
        if (heightMs > 0) taskManager.once(() => this._endHeightAnim(), heightMs, 'genericDrawerHeightAnimEnd');
    },

    /** Hết thời gian co/giãn: áp lại vị trí cuộn nếu lúc gắn bị kẹp (panel đang cao hơn đích nên cuộn tối đa nhỏ hơn) và
     * người dùng chưa tự cuộn từ đó. (Đổi tên từ `_endCrossfade()` khi bỏ fade chéo.) */
    _endHeightAnim() {
        if (!this._scrollClamped) return;
        this._scrollClamped = false;
        const untouched = !this._scrollKey || this._scrollMemo.get(this._scrollKey) === undefined || this._scrollMemo.get(this._scrollKey) === genericDrawerBody.scrollTop;
        if (untouched) this.restoreScroll();
    },

    /** Ghi nhận nội dung vừa gắn cho bộ nhớ cuộn. */
    _setScrollState(scrollKey, target) {
        this._scrollKey = scrollKey || null;
        this._scrollAnchor = genericDrawerBody.firstChild;
        this._scrollTarget = target;
        genericDrawerBody.scrollTop = target; // áp SAU khi đo/huỷ animation (layout đã chốt)
        this._scrollClamped = genericDrawerBody.scrollTop < target;
    },

    /** Áp lại vị trí đích của lần gắn gần nhất — gọi SAU onMount/wire đồng bộ làm nội dung cao thêm (bỏ `hidden`
     * các hàng theo config...): lúc gắn nội dung còn thấp nên trình duyệt kẹp scrollTop nhỏ hơn đích. */
    restoreScroll() {
        genericDrawerBody.scrollTop = this._scrollTarget;
        this._scrollClamped = genericDrawerBody.scrollTop < this._scrollTarget;
    },

    /** Ứng với 'genericDrawer.body.scroll' — ghi vị trí hiện tại cho key của nội dung ĐANG gắn (bỏ qua nếu nội
     * dung đó đã bị 1 màn khác thay chỗ). */
    trackScroll() {
        if (!this._scrollKey || !this._scrollAnchor || this._scrollAnchor.parentNode !== genericDrawerBody) return;
        this._scrollMemo.set(this._scrollKey, genericDrawerBody.scrollTop);
    },

    /** MỚI (24/09/2026) — ứng với 'genericDrawer.body.mutate' (MutationObserver ở event/listener/generic-drawer.js,
     * THAY observer + requestAnimationFrame cũ sống trong core). Nội dung body vừa đổi -> chiều cao có thể đổi ->
     * animate mượt từ chiều cao đang hiển thị tới chiều cao thật mới.
     * @param {MutationRecord[]} mutations */
    onBodyMutated(mutations) {
        if (genericDrawerPanel.classList.contains('hidden')) return; // đo lúc display:none luôn ra 0
        // Vùng tự đánh dấu bỏ qua (vd carousel Settings Main đổi class liên tục lúc cuộn ngang, components/settings/app-settings-main.js).
        if (mutations.every((m) => m.target instanceof Element && m.target.closest('[data-gd-ignore-mutation]'))) return;
        const nowMs = performance.now();
        if (nowMs < this._heightAnimEndAt) {
            // Đang animate: huỷ tạm để đo chiều cao thật mới (animation phủ lên giá trị đo).
            const visualPx = readGenericDrawerHeightPx(); // core/generic-drawer.js
            const toPx = settleGenericDrawerHeightPx(); // core/generic-drawer.js
            if (Math.abs(toPx - this._heightPx) < 1) {
                // Đích KHÔNG đổi (thường gặp nhất — chính cú thay nội dung/áp theme bắn mutation) -> dựng lại y hệt, tua đúng chỗ.
                animateGenericDrawerHeight(this._heightAnimFromPx, this._heightPx, this._heightAnimDurationMs, nowMs - this._heightAnimStartAt); // core
                return;
            }
            // Đích đổi thật (onMount/toggle làm nội dung cao/thấp thêm) -> nhắm đích mới từ chiều cao đang hiển thị, kết thúc
            // đúng hạn cũ nhưng không ngắn hơn ~40% thời lượng (tránh "giật" tới đích khi đổi sát cuối).
            const remainingMs = Math.max(this._heightAnimEndAt - nowMs, GENERIC_DRAWER_HEIGHT_ANIM_MS * 0.4);
            this._startHeightAnim(visualPx, toPx, remainingMs, nowMs);
            return;
        }
        // Không animate: DOM đã đổi xong lúc callback chạy nên đo lúc này ra chiều cao MỚI — xuất phát từ chiều cao thật đã biết.
        const toPx = settleGenericDrawerHeightPx(); // core/generic-drawer.js
        this._startHeightAnim(this._heightPx, toPx, this._reduceMotion() ? 0 : GENERIC_DRAWER_HEIGHT_ANIM_MS, nowMs);
    },

    /** Trượt Generic Drawer xuống rồi ẩn hẳn khi trượt xong. SỬA (24/09/2026) — hẹn giờ bằng taskManager thay cho
     * `transitionend` gắn thẳng lên panel TĨNH (listener ngoài tầng Listener, không qua eventBus) — kèm sửa lỗi ngầm:
     * `transitionend` NỔI BỌT từ phần tử con (nút có `transition-colors`...) có thể ẩn Drawer sớm hơn cú trượt. */
    closeFully() {
        closeGenericDrawer(); // core/generic-drawer.js
        taskManager.kill('genericDrawerHeightAnimEnd');
        taskManager.once(() => hideGenericDrawerImmediately(), GENERIC_DRAWER_ANIM_MS, 'genericDrawerHideAfterClose'); // core/generic-drawer.js
        // Đóng hẳn = hết phiên nhớ cuộn/chiều cao.
        this._scrollMemo.clear();
        this._scrollKey = null;
        this._scrollAnchor = null;
        this._scrollTarget = 0;
        this._scrollClamped = false;
        this._heightAnimEndAt = 0;
    },

    /** MỚI (24/09/2026, dọn vi phạm Rule 3 của core/media-picker-drawer-ui.js — core gọi core mở Drawer) — mở/thay
     * picker Ảnh/Video (dùng chung File Manager Photo, Visual Background, Theme): lấy config từ core, gắn qua
     * `open()`/`update()` ở trên, rồi mới wire (core, Rule 5a — callback chỉ bắn eventBus).
     * @param {{routerName:string, msgPrefix:string, title:string, bodyHtml:string, tileSelector:string, tileDataKey:string, showConfirmButton?:boolean, updateInPlace?:boolean}} opts */
    mountMediaPicker(opts) {
        const config = buildMediaPickerDrawerConfig(opts.title, opts.bodyHtml); // core/media-picker-drawer-ui.js
        if (opts.updateInPlace) this.update(config); else this.open(config);
        wireMediaPickerDrawerUi(opts.routerName, opts.msgPrefix, opts.tileSelector, opts.tileDataKey); // core/media-picker-drawer-ui.js
        if (opts.showConfirmButton) wireMediaPickerConfirmButtonUi(opts.routerName, opts.msgPrefix); // core/media-picker-drawer-ui.js
    },
};
