/**
 * event/workflow/photo-gallery-window.js — ĐẬP ĐI LÀM LẠI (rewrite Photo/Album, Giang yêu cầu
 * "không dùng window virtual tự tạo nữa, dùng thư viện") — THAY HẲN event/workflow/virtual-list.js
 * + event/router,listener/virtual-list.js (hạ tầng scroll-based windowing tự viết, nguồn gốc hàng
 * loạt bug layout/lệch cuộn đã gặp — tự đo `scrollTop`/`clientWidth`/tự tính `offsetTop` bằng tay).
 *
 * KIẾN TRÚC MỚI — windowing cấp NHÓM NGÀY (KHÔNG phải cấp ảnh/pixel):
 *   1. Ảnh gom theo ngày (core/file-manager/image.js::groupImagesByDay(), hàm thuần) — MỖI nhóm là
 *      1 khối DOM ĐỘC LẬP (header ngày + `.fj-gallery` riêng), xếp dọc trong khung cuộn.
 *   2. `IntersectionObserver` (API trình duyệt gốc — KHÔNG tự nghe 'scroll'/tự đo `scrollTop` nào
 *      cả) gắn trên TỪNG khối nhóm — biết chính xác nhóm nào đang gần vùng nhìn, trình duyệt tự lo
 *      toàn bộ phần tính toán, không có lớp toán học thủ công nào để sai nữa.
 *   3. Nhóm vào vùng giữ (`rootMargin` — ~2 màn hình mỗi phía) -> dựng DOM thật (header + tile ảnh)
 *      + gọi `fjGallery()` (thư viện thật, thuật toán Flickr/Google Photos — xem CDN ở index.html)
 *      để layout justified THẬT bên trong nhóm đó.
 *   4. Nhóm RA khỏi vùng giữ -> ghi lại "mốc" (`offsetHeight` THẬT vừa đo được lúc nhóm còn hiển thị
 *      đầy đủ) -> revoke toàn bộ object URL trong nhóm -> thay nội dung bằng placeholder cao ĐÚNG
 *      bằng mốc đó (`el.style.height`) -> cuộn KHÔNG giật, không lệch vị trí các nhóm khác (khác
 *      hẳn bug cũ: mốc giờ là 1 con số THẬT đã đo, không phải suy ra từ công thức có thể sai).
 *   5. Placeholder quay lại gần vùng nhìn -> dựng lại y hệt bước 3, mốc cũ dùng làm chiều cao TẠM
 *      trong lúc build lại (đỡ giật) — sau khi `fjGallery()` chạy xong, đo lại `offsetHeight` THẬT
 *      ghi đè mốc (gần như luôn giống mốc cũ nếu nội dung nhóm không đổi).
 *
 * Click ảnh KHÔNG wire ở đây — vẫn đi ĐÚNG luồng cũ (delegated `data-image-key`, event/listener/
 * file-manager-photo.js cho lưới chính / wire trực tiếp trên `genericDrawerBody` cho picker, xem
 * event/workflow/file-manager-photo.js) — engine này CHỈ lo dựng/gỡ DOM, không quan tâm nghiệp vụ
 * click nào chạy sau đó.
 *
 * NẠP SAU: fjGallery (CDN, index.html), core/file-manager/image.js (groupImagesByDay).
 */
const workflowPhotoGalleryWindow = {
    _mounts: new Map(), // mountKey -> { scrollEl, containerEl, groupRecords, observer, rowHeightPx, badgeMode, selectedKeys }

    /**
     * Dựng (hoặc dựng LẠI TỪ ĐẦU nếu đã tồn tại — đơn giản/an toàn hơn cố vá lại incremental, vì
     * danh sách ảnh có thể đổi hoàn toàn giữa 2 lần gọi) toàn bộ khối nhóm-ngày + IntersectionObserver
     * cho 1 khung cuộn.
     * @param {string} mountKey - 'photoGrid' (lưới chính) hoặc 'genericDrawer' (picker ảnh).
     * @param {{scrollEl: HTMLElement, images: Array, rowHeightPx: number, badgeMode?: 'quickDelete'|'multiSelect'|null, selectedKeys?: Set<string>}} config
     */
    mount(mountKey, { scrollEl, images, rowHeightPx, badgeMode, selectedKeys }) {
        this.unmount(mountKey);
        if (!scrollEl) return;

        const sortedImages = sortImagesByAddedDateDesc(images); // core/file-manager/image.js
        const dayGroups = groupImagesByDay(sortedImages); // core/file-manager/image.js, hàm thuần

        const containerEl = document.createElement('div');
        containerEl.className = 'photo-gallery-window';
        scrollEl.appendChild(containerEl);

        const groupRecords = dayGroups.map((group) => {
            const groupEl = document.createElement('div');
            groupEl.className = 'photo-day-group';
            groupEl.dataset.dayKey = group.dayKey;
            containerEl.appendChild(groupEl);
            return { dayKey: group.dayKey, addedAt: group.addedAt, images: group.images, el: groupEl, loaded: false, heightPx: null };
        });

        const m = { mountKey, scrollEl, containerEl, groupRecords, observer: null, rowHeightPx, badgeMode: badgeMode || null, selectedKeys: selectedKeys || new Set() };

        // rootMargin ~200% chiều cao khung cuộn mỗi phía — giữ trước/sau ~2 màn hình (đúng vùng đệm
        // đã thống nhất, THAY "bufferPx" tự tính cũ — giá trị này trình duyệt tự quy đổi theo % kích
        // thước THẬT của `root`, không cần JS đo `clientHeight` tay).
        m.observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                const record = groupRecords.find((g) => g.el === entry.target);
                if (!record) return;
                if (entry.isIntersecting) this._loadGroup(m, record);
                else this._unloadGroup(record);
            });
        }, { root: scrollEl, rootMargin: '200% 0px' });

        groupRecords.forEach((record) => m.observer.observe(record.el));
        this._mounts.set(mountKey, m);
    },

    /** Gỡ 1 mount — dọn observer + revoke toàn bộ object URL còn sống + xoá DOM. */
    unmount(mountKey) {
        const m = this._mounts.get(mountKey);
        if (!m) return; // guard — gỡ 1 mount không tồn tại là no-op
        m.observer.disconnect();
        m.groupRecords.forEach((record) => this._unloadGroup(record));
        m.containerEl.remove();
        this._mounts.delete(mountKey);
    },

    /** Dựng 1 phần tử badge (chọn/xoá) — dùng CHUNG cho `_loadGroup()` (dựng tile mới) và
     * `setBadgeMode()` (đổi badge trên tile đã có) — tránh lặp SVG icon 2 nơi. */
    _createBadgeElement(badgeMode) {
        const badge = document.createElement('span');
        badge.className = `photo-tile-badge photo-tile-badge-${badgeMode === 'quickDelete' ? 'delete' : 'select'}`;
        badge.innerHTML = badgeMode === 'quickDelete'
            ? '<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>'
            : '<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>';
        return badge;
    },

    /** Dựng DOM thật (header + tile) cho 1 nhóm ngày + gọi fjGallery() layout — CHỈ khi nhóm đó
     * CHƯA đang tải (guard idempotent, IntersectionObserver có thể bắn nhiều lần cho cùng 1 target
     * nếu qua lại ranh giới liên tục). */
    _loadGroup(m, record) {
        if (record.loaded) return;
        record.loaded = true;
        record.el.style.height = ''; // bỏ placeholder cố định — nội dung thật tự quyết định chiều cao
        record.el.classList.remove('photo-day-group-placeholder');
        record.el.innerHTML = '';

        const headerEl = document.createElement('div');
        // SỬA (17/07/2026, Giang chỉ ra "màu chữ ngày tháng tương phản kém") — `.photo-day-header`
        // (assets/css/style.css) dùng màu CHỮ SÁNG (`#e2e8f0`), ĐÚNG khi nền TỐI (lưới ảnh chính,
        // mountKey 'photoGrid') nhưng SAI hẳn khi cùng class này render TRONG Generic Drawer
        // (mountKey 'genericDrawer' — nền LUÔN TRẮNG cố định, xem components/generic-drawer.js) —
        // chữ sáng trên nền trắng gần như vô hình. Thêm class bổ sung
        // `.photo-day-header--on-light` (chỉ áp khi mount TRONG Generic Drawer) đổi màu chữ sang
        // tối — KHÔNG đổi `.photo-day-header` gốc (vẫn đúng cho lưới ảnh chính, nền tối).
        headerEl.className = m.mountKey === 'genericDrawer' ? 'photo-day-header photo-day-header--on-light' : 'photo-day-header';
        headerEl.textContent = formatPhotoDayHeaderLabel(record.addedAt); // core/file-manager/image.js, hàm thuần
        record.el.appendChild(headerEl);

        const galleryEl = document.createElement('div');
        galleryEl.className = 'fj-gallery';
        record.el.appendChild(galleryEl);

        record.images.forEach((image) => {
            const itemEl = document.createElement('div');
            itemEl.className = 'fj-gallery-item';
            itemEl.dataset.imageKey = image.key;

            const img = document.createElement('img');
            const objectUrl = URL.createObjectURL(image.thumbBlob || image.blob); // fallback ảnh cũ chưa có thumbBlob
            img.src = objectUrl;
            if (image.width > 0) img.width = image.width; // fjGallery đọc attribute width/height để tính tỉ lệ TRƯỚC khi ảnh load xong — KHÔNG cần đợi decode mới layout được
            if (image.height > 0) img.height = image.height;
            img.alt = image.filename || '';
            itemEl.appendChild(img);

            if (m.badgeMode) {
                const badge = this._createBadgeElement(m.badgeMode);
                itemEl.appendChild(badge);
                if (m.selectedKeys.has(image.key)) itemEl.classList.add('photo-tile-marked');
            }

            galleryEl.appendChild(itemEl);
        });

        fjGallery(galleryEl, { // CDN, index.html — thư viện thật, THAY thuật toán tự viết cũ
            itemSelector: '.fj-gallery-item',
            rowHeight: m.rowHeightPx,
            rowHeightTolerance: 0.25,
            gutter: 2,
            lastRow: 'left',
            transitionDuration: '0s', // KHÔNG cần hiệu ứng khi VỪA dựng lại nhóm (tránh giật/lag lúc cuộn nhanh qua nhiều nhóm liên tiếp)
        });

        // Ghi "mốc" SAU khi layout xong — fjGallery đồng bộ (DOM-based, không async) nên đo được
        // NGAY trong cùng tick, không cần requestAnimationFrame chờ khung hình kế tiếp.
        record.heightPx = record.el.offsetHeight;
    },

    /** Gỡ DOM 1 nhóm ngày, thay bằng placeholder cao đúng bằng mốc đã đo — revoke object URL TRƯỚC
     * khi xoá (tránh rò rỉ RAM, đúng tinh thần đã áp dụng xuyên suốt rewrite này). */
    _unloadGroup(record) {
        if (!record.loaded) return;
        record.loaded = false;
        record.el.querySelectorAll('img').forEach((img) => { try { URL.revokeObjectURL(img.src); } catch (e) {} });
        record.el.innerHTML = '';
        if (record.heightPx) record.el.style.height = record.heightPx + 'px'; // giữ ĐÚNG chỗ trống — cuộn không giật
        record.el.classList.add('photo-day-group-placeholder');
    },

    /** MỚI (Giang chỉ ra "tại sao phải có refresh?" — bật/tắt chế độ badge KHÔNG cần đọc lại DB/dựng
     * lại lưới, dữ liệu ảnh không hề đổi) — đổi `badgeMode`/`selectedKeys` trên mount ĐANG có, CHỈ
     * cập nhật badge cho tile thuộc nhóm ĐANG hiển thị (nhóm placeholder tự đọc đúng `m.badgeMode`/
     * `m.selectedKeys` mới khi tải lại sau này qua `_loadGroup()`, KHÔNG cần đụng vào ở đây) — KHÔNG
     * revoke/tạo lại object URL nào, KHÔNG gọi fjGallery() lại (layout ảnh không đổi, chỉ thêm/bớt
     * badge phủ lên).
     * @param {string} mountKey
     * @param {'quickDelete'|'multiSelect'|null} badgeMode
     * @param {Set<string>} [selectedKeys]
     */
    setBadgeMode(mountKey, badgeMode, selectedKeys) {
        const m = this._mounts.get(mountKey);
        if (!m) return;
        m.badgeMode = badgeMode || null;
        m.selectedKeys = selectedKeys || new Set();
        m.groupRecords.forEach((record) => {
            if (!record.loaded) return; // nhóm placeholder — bỏ qua, tự đúng khi tải lại sau này
            record.el.querySelectorAll('.fj-gallery-item').forEach((itemEl) => {
                const oldBadge = itemEl.querySelector('.photo-tile-badge');
                if (oldBadge) oldBadge.remove();
                itemEl.classList.remove('photo-tile-marked');
                if (!m.badgeMode) return;
                itemEl.appendChild(this._createBadgeElement(m.badgeMode));
                if (m.selectedKeys.has(itemEl.dataset.imageKey)) itemEl.classList.add('photo-tile-marked');
            });
        });
    },

    /** MỚI — toggle badge 1 tile CỤ THỂ đã biết `imageKey` (gọi SAU khi Workflow đã mutate Set lựa
     * chọn) — patch DOM TRỰC TIẾP, KHÔNG cần dựng lại cả nhóm. Nếu tile đó hiện KHÔNG nằm trong vùng
     * đang tải (đã bị gỡ thành placeholder) thì bỏ qua im lặng — lần nhóm đó tải lại, `mount()` mới
     * (đọc lại `selectedKeys` từ Router/Workflow) sẽ tự vẽ ĐÚNG trạng thái, không cần đồng bộ ngay.
     * @param {string} mountKey
     * @param {string} imageKey
     * @param {boolean} isMarked
     */
    setTileBadge(mountKey, imageKey, isMarked) {
        const m = this._mounts.get(mountKey);
        if (!m) return;
        const tileEl = m.containerEl.querySelector(`[data-image-key="${CSS.escape(imageKey)}"]`);
        if (!tileEl) return; // nhóm chứa ảnh này hiện đang là placeholder — bỏ qua, xem docstring trên
        tileEl.classList.toggle('photo-tile-marked', isMarked);
    },
};
