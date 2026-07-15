/**
 * event/workflow/virtual-list.js — Windowing dùng CHUNG, nhiều "mount" (container) cùng lúc, phân
 * biệt bằng `mountKey` (vd 'photoGrid', 'genericDrawer'). Router (virtualList) gọi
 * `handleScroll(mountKey)` mỗi lần container tương ứng cuộn.
 *
 * SỬA 14/07/2026 (Giang chỉ ra: scroll KHÔNG được Workflow tự addEventListener, phải qua
 * listener->bus->router như mọi sự kiện tần suất cao khác — xem event/listener/virtual-list.js) —
 * file này TRƯỚC ĐÓ rỗng (chưa viết); nơi cần windowing thật (Photo & Album) từng tự
 * `addEventListener('scroll', ...)` ngay trong Workflow riêng của nó — SAI, đã bỏ.
 */
const workflowVirtualList = {
    _mounts: new Map(), // mountKey -> { scrollEl, sizerEl, windowEl, rows, rowHeights, templateFn, ctx }

    /** Gắn (hoặc cập nhật dữ liệu nếu đã gắn) 1 lưới windowing. Tự dựng "sizer + window" bên trong
     * `scrollEl` lúc đầu, tự dựng LẠI nếu `scrollEl` đổi (panel cũ đã đóng/DOM cũ đã mất, panel mở
     * lại tạo container mới — idempotent, không cần nơi gọi tự unmount() trước).
     * @param {string} mountKey
     * @param {{scrollEl: HTMLElement, rows: Array, computeRowHeights: (sizerEl: HTMLElement) => number[], templateFn: Function, ctx?: Object, windowId?: string, windowClassName?: string}} config
     * @returns {HTMLElement} windowEl — nơi renderItemList() ghi HTML vào.
     */
    mount(mountKey, { scrollEl, rows, computeRowHeights, templateFn, ctx, windowId, windowClassName }) {
        let m = this._mounts.get(mountKey);
        if (m && m.scrollEl !== scrollEl) { this.unmount(mountKey); m = null; } // container cũ đã mất -> dựng lại từ đầu
        if (!m) {
            scrollEl.dataset.virtualScrollMount = mountKey; // listener (event/listener/virtual-list.js) đọc attribute này, KHÔNG hardcode id/selector riêng từng feature
            const sizerEl = document.createElement('div');
            sizerEl.style.position = 'relative';
            const windowEl = document.createElement('div');
            if (windowId) windowEl.id = windowId;
            if (windowClassName) windowEl.className = windowClassName;
            windowEl.style.position = 'absolute';
            windowEl.style.top = '0';
            windowEl.style.left = '0';
            windowEl.style.right = '0';
            sizerEl.appendChild(windowEl);
            scrollEl.prepend(sizerEl);
            m = { scrollEl, sizerEl, windowEl };
            this._mounts.set(mountKey, m);
        }
        m.rows = rows;
        m.rowHeights = computeRowHeights(m.sizerEl); // đo SAU khi sizerEl đã ở trong DOM thật (clientWidth chính xác)
        m.templateFn = templateFn;
        m.ctx = ctx;
        this.redraw(mountKey);
        return m.windowEl;
    },

    /** Gỡ 1 mount — revoke mọi object URL còn sống trong window hiện tại, xoá sizer khỏi DOM. */
    unmount(mountKey) {
        const m = this._mounts.get(mountKey);
        if (!m) return; // guard — gỡ 1 mount không tồn tại là no-op
        m.windowEl.querySelectorAll('[data-has-object-url]').forEach((node) => {
            const img = node.querySelector('img');
            if (img && img.src) { try { URL.revokeObjectURL(img.src); } catch (e) {} }
        });
        m.sizerEl.remove();
        this._mounts.delete(mountKey);
    },

    /** Vẽ lại cửa sổ hiện tại của 1 mount — gọi lại khi CHỈ `ctx`/`rows` đổi (không cần mount() lại
     * từ đầu) HOẶC do Router gọi mỗi lần scroll (handleScroll() bên dưới). */
    redraw(mountKey) {
        const m = this._mounts.get(mountKey);
        if (!m) return; // guard — mount đã gỡ/chưa từng tồn tại
        const { startIdx, endIdx, offsetTop, totalHeight } = computeVariableVirtualWindowRange(m.rowHeights, m.scrollEl.scrollTop, m.scrollEl.clientHeight); // components/items.js
        m.sizerEl.style.height = totalHeight + 'px';
        m.windowEl.style.transform = `translateY(${offsetTop}px)`;
        m.windowEl.querySelectorAll('[data-has-object-url]').forEach((node) => {
            const img = node.querySelector('img');
            if (img && img.src) { try { URL.revokeObjectURL(img.src); } catch (e) {} }
        });
        renderItemList(m.windowEl, m.rows.slice(startIdx, endIdx), m.templateFn, m.ctx); // components/items.js
    },

    /** Router gọi mỗi lần 'scroll' — THROTTLE qua `requestAnimationFrame`, TỐI ĐA 1 `redraw()` MỖI
     * KHUNG HÌNH, thay vì gọi thẳng cho MỖI sự kiện 'scroll' thô.
     *
     * BUG FIX NGHIÊM TRỌNG (15/07/2026, Giang báo — "crash cả app vì tràn RAM") — bản trước gọi
     * `this.redraw(mountKey)` TRỰC TIẾP ở đây, không throttle gì cả. Sự kiện `scroll` gốc của trình
     * duyệt bắn RẤT DÀY lúc lướt nhanh/miết tay (fling) trên di động — có thể vài chục lần/giây,
     * KHÔNG đồng bộ với tần suất vẽ lại màn hình (~60fps). MỖI `redraw()` làm: revoke TOÀN BỘ object
     * URL đang có trong cửa sổ HIỆN TẠI (thường 20-40+ ảnh, tính cả buffer 600px 2 bên) RỒI tạo MỚI
     * HOÀN TOÀN từng đó object URL (kể cả ảnh KHÔNG hề đổi giữa 2 lần vẽ) + `innerHTML=` dựng lại
     * từng đó `<img>` — buộc trình duyệt DECODE LẠI TỪ ĐẦU từng đó ảnh. Lướt nhanh -> `redraw()` gọi
     * dồn dập hàng chục lần/giây -> hàng trăm/nghìn lượt decode ảnh xếp hàng nhanh hơn tốc độ trình
     * duyệt kịp giải phóng bitmap đã decode -> RAM phình lên rất nhanh -> crash trên thiết bị RAM
     * hạn chế (đặc biệt ảnh gốc độ phân giải cao). SỬA: gộp NHIỀU sự kiện 'scroll' liên tiếp trong
     * CÙNG 1 khung hình thành ĐÚNG 1 lần `redraw()` (kỹ thuật "rAF throttle" tiêu chuẩn cho sự kiện
     * tần suất cao) — `_redrawScheduledMountKeys` (Set, module-level) đánh dấu mount NÀO đang chờ
     * khung hình kế tiếp, tránh xếp chồng nhiều `requestAnimationFrame` cho CÙNG 1 mount. */
    _redrawScheduledMountKeys: new Set(),

    handleScroll(mountKey) {
        if (this._redrawScheduledMountKeys.has(mountKey)) return; // guard — đã có 1 redraw chờ khung hình kế tiếp cho mount này, KHÔNG xếp thêm
        this._redrawScheduledMountKeys.add(mountKey);
        requestAnimationFrame(() => {
            this._redrawScheduledMountKeys.delete(mountKey);
            this.redraw(mountKey);
        });
    },
};
