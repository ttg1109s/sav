/**
 * event/workflow/video-gallery-window.js — MỚI (21/07/2026), File Manager -> Video. Giang chốt:
 * "cuộn liên tục kiểu Photo" (IntersectionObserver theo nhóm ngày) NHƯNG "grid full width" (tile tỉ
 * lệ ĐỒNG NHẤT, KHÔNG justified/masonry như Photo) — nên mirror ĐÚNG cơ chế windowing cấp NHÓM NGÀY
 * của event/workflow/photo-gallery-window.js (mount/unmount/IntersectionObserver/placeholder đo
 * offsetHeight thật), CHỈ thay bước layout BÊN TRONG mỗi nhóm: THAY `fjGallery()` (thư viện, layout
 * justified) bằng CSS Grid cố định cột (`.video-grid`, assets/css/style.css) — KHÔNG cần biết
 * width/height gốc của từng video để tính tỉ lệ (khác Photo).
 *
 * Click tile KHÔNG wire ở đây — đi qua eventBus (delegated `data-video-key`, event/listener/
 * file-manager-video.js) — engine này CHỈ lo dựng/gỡ DOM, không quan tâm nghiệp vụ click nào chạy
 * sau đó (CÙNG khuôn photo-gallery-window.js).
 *
 * NẠP SAU: core/file-manager/video.js (sortVideosByAddedDateDesc/groupVideosByDay/
 * formatVideoDayHeaderLabel/formatVideoDuration).
 */
const workflowVideoGalleryWindow = {
    _mounts: new Map(), // mountKey -> { scrollEl, containerEl, groupRecords, observer, badgeMode, selectedKeys }

    /**
     * Dựng (hoặc dựng LẠI TỪ ĐẦU nếu đã tồn tại) toàn bộ khối nhóm-ngày + IntersectionObserver cho
     * 1 khung cuộn.
     * @param {string} mountKey - 'videoGrid' (lưới chính) hoặc 'genericDrawer' (picker video, Batch 2).
     * @param {{scrollEl: HTMLElement, videos: Array, badgeMode?: 'quickDelete'|null, selectedKeys?: Set<string>}} config
     */
    mount(mountKey, { scrollEl, videos, badgeMode, selectedKeys }) {
        this.unmount(mountKey);
        if (!scrollEl) return;

        const sortedVideos = sortVideosByAddedDateDesc(videos); // core/file-manager/video.js
        const dayGroups = groupVideosByDay(sortedVideos); // core/file-manager/video.js, hàm thuần

        const containerEl = document.createElement('div');
        containerEl.className = 'video-gallery-window';
        scrollEl.appendChild(containerEl);

        const groupRecords = dayGroups.map((group) => {
            const groupEl = document.createElement('div');
            groupEl.className = 'video-day-group';
            groupEl.dataset.dayKey = group.dayKey;
            containerEl.appendChild(groupEl);
            return { dayKey: group.dayKey, addedAt: group.addedAt, videos: group.videos, el: groupEl, loaded: false, heightPx: null };
        });

        const m = { mountKey, scrollEl, containerEl, groupRecords, observer: null, badgeMode: badgeMode || null, selectedKeys: selectedKeys || new Set() };

        // rootMargin ~200% chiều cao khung cuộn mỗi phía — giữ trước/sau ~2 màn hình, CÙNG hằng số
        // đã dùng ở photo-gallery-window.js.
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

    /** Dựng 1 phần tử badge (xoá nhanh) — CHỈ mode 'quickDelete' (Video không có multi-select album
     * như Photo) — dùng CHUNG cho `_loadGroup()` và `setBadgeMode()`. */
    _createBadgeElement() {
        const badge = document.createElement('span');
        badge.className = 'video-tile-badge';
        badge.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>';
        return badge;
    },

    /** Dựng DOM thật (header ngày + grid tile CSS) cho 1 nhóm ngày — CHỈ khi nhóm đó CHƯA đang tải
     * (guard idempotent, IntersectionObserver có thể bắn nhiều lần cho cùng 1 target). KHÔNG gọi
     * fjGallery() (khác Photo) — `.video-grid` (assets/css/style.css) tự lo layout bằng CSS Grid cố
     * định cột, mỗi tile tỉ lệ đồng nhất (aspect-ratio CSS), không cần đo width/height gốc video. */
    _loadGroup(m, record) {
        if (record.loaded) return;
        record.loaded = true;
        record.el.style.height = ''; // bỏ placeholder cố định — nội dung thật tự quyết định chiều cao
        record.el.classList.remove('video-day-group-placeholder');
        record.el.innerHTML = '';

        const headerEl = document.createElement('div');
        headerEl.className = m.mountKey === 'genericDrawer' ? 'video-day-header video-day-header--on-light' : 'video-day-header';
        headerEl.textContent = formatVideoDayHeaderLabel(record.addedAt); // core/file-manager/video.js, hàm thuần
        record.el.appendChild(headerEl);

        const gridEl = document.createElement('div');
        gridEl.className = 'video-grid';
        record.el.appendChild(gridEl);

        record.videos.forEach((video) => {
            const tileEl = document.createElement('div');
            tileEl.className = 'video-tile';
            tileEl.dataset.videoKey = video.key;

            const img = document.createElement('img');
            const objectUrl = URL.createObjectURL(video.thumbBlob);
            img.src = objectUrl;
            img.alt = video.filename || '';
            tileEl.appendChild(img);

            const durationEl = document.createElement('span');
            durationEl.className = 'video-tile-duration';
            durationEl.textContent = formatVideoDuration(video.duration); // core/file-manager/video.js, hàm thuần
            tileEl.appendChild(durationEl);

            if (m.badgeMode) {
                const badge = this._createBadgeElement();
                tileEl.appendChild(badge);
                if (m.selectedKeys.has(video.key)) tileEl.classList.add('video-tile-marked');
            }

            gridEl.appendChild(tileEl);
        });

        record.heightPx = record.el.offsetHeight;
    },

    /** Gỡ DOM 1 nhóm ngày, thay bằng placeholder cao đúng bằng mốc đã đo — revoke object URL TRƯỚC
     * khi xoá (tránh rò rỉ RAM). */
    _unloadGroup(record) {
        if (!record.loaded) return;
        record.loaded = false;
        record.el.querySelectorAll('img').forEach((img) => { try { URL.revokeObjectURL(img.src); } catch (e) {} });
        record.el.innerHTML = '';
        if (record.heightPx) record.el.style.height = record.heightPx + 'px'; // giữ ĐÚNG chỗ trống — cuộn không giật
        record.el.classList.add('video-day-group-placeholder');
    },

    /** Bật/tắt chế độ xoá nhanh trên mount ĐANG có — KHÔNG revoke/tạo lại object URL nào, KHÔNG
     * dựng lại nhóm (chỉ thêm/bớt badge phủ lên) — cùng khuôn `setBadgeMode()` Photo.
     * @param {string} mountKey
     * @param {'quickDelete'|null} badgeMode
     * @param {Set<string>} [selectedKeys]
     */
    setBadgeMode(mountKey, badgeMode, selectedKeys) {
        const m = this._mounts.get(mountKey);
        if (!m) return;
        m.badgeMode = badgeMode || null;
        m.selectedKeys = selectedKeys || new Set();
        m.groupRecords.forEach((record) => {
            if (!record.loaded) return; // nhóm placeholder — bỏ qua, tự đúng khi tải lại sau này
            record.el.querySelectorAll('.video-tile').forEach((tileEl) => {
                const oldBadge = tileEl.querySelector('.video-tile-badge');
                if (oldBadge) oldBadge.remove();
                tileEl.classList.remove('video-tile-marked');
                if (!m.badgeMode) return;
                tileEl.appendChild(this._createBadgeElement());
                if (m.selectedKeys.has(tileEl.dataset.videoKey)) tileEl.classList.add('video-tile-marked');
            });
        });
    },

    /** Toggle badge 1 tile CỤ THỂ đã biết `videoKey` — patch DOM TRỰC TIẾP, KHÔNG dựng lại cả nhóm.
     * @param {string} mountKey
     * @param {string} videoKey
     * @param {boolean} isMarked
     */
    setTileBadge(mountKey, videoKey, isMarked) {
        const m = this._mounts.get(mountKey);
        if (!m) return;
        const tileEl = m.containerEl.querySelector(`[data-video-key="${CSS.escape(videoKey)}"]`);
        if (!tileEl) return; // nhóm chứa video này hiện đang là placeholder — bỏ qua
        tileEl.classList.toggle('video-tile-marked', isMarked);
    },
};
