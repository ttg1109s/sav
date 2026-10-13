/**
 * event/workflow/video-gallery-window.js — lưới video theo nhóm ngày, cùng cơ chế windowing với
 * event/workflow/photo-gallery-window.js; khác ở layout trong nhóm: CSS Grid cố định cột (`.video-grid`), tile tỉ lệ
 * đồng nhất, không cần kích thước gốc video. Click tile ủy quyền ở nơi mở picker.
 *
 * NẠP SAU: core/file-manager/video.js, core/file-manager/gallery-window.js, core/file-manager/gallery-window-ui.js,
 * components/media-gallery.js, service/blob-url.js.
 */

const VIDEO_GALLERY_TILE_SPEC = { tileSelector: '.video-tile', keyName: 'videoKey', badgeSelector: '.video-tile-badge', markedClass: 'video-tile-marked' };
const VIDEO_DAY_GROUP_PLACEHOLDER_CLASS = 'video-day-group-placeholder';

const workflowVideoGalleryWindow = {
    _mounts: new Map(), // mountKey -> { mountKey, containerEl, groupRecords, observer, badgeMode, selectedKeys }

    /** Nhóm vào / ra vùng giữ của IntersectionObserver. */
    _GROUP_ACTION_BY_INTERSECTING: {
        true: (self, m, record) => self._loadGroup(m, record),
        false: (self, m, record) => self._unloadGroup(record),
    },

    /**
     * Dựng (lại từ đầu nếu đã có) khung nhóm ngày + IntersectionObserver cho 1 khung cuộn.
     * @param {string} mountKey - 'genericDrawer' (picker video)
     * @param {{scrollEl: HTMLElement, videos: Array, badgeMode?: 'multiSelect'|null, selectedKeys?: Set<string>|Map<string,number>}} config
     */
    mount(mountKey, { scrollEl, videos, badgeMode, selectedKeys }) {
        this.unmount(mountKey);
        if (!scrollEl) return;

        const dayGroups = groupVideosByDay(sortVideosByAddedDateDesc(videos)); // core/file-manager/video.js
        const { containerEl, groupEls } = mountGalleryWindowUi(scrollEl, renderGalleryWindowHtml('video', dayGroups.map((g) => g.dayKey))); // core/file-manager/gallery-window-ui.js + components/media-gallery.js
        const groupRecords = dayGroups.map((group, i) => ({ dayKey: group.dayKey, addedAt: group.addedAt, videos: group.videos, el: groupEls[i], loaded: false, heightPx: null }));
        const m = { mountKey, containerEl, groupRecords, observer: null, badgeMode: badgeMode || null, selectedKeys: selectedKeys || new Set() };

        m.observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                const record = groupRecords.find((g) => g.el === entry.target);
                if (!record) return;
                this._GROUP_ACTION_BY_INTERSECTING[entry.isIntersecting](this, m, record);
            });
        }, { root: scrollEl, rootMargin: '200% 0px' });

        groupRecords.forEach((record) => m.observer.observe(record.el));
        this._mounts.set(mountKey, m);
    },

    /** Gỡ 1 mount — dừng observer, thu hồi object URL còn sống, xoá DOM. */
    unmount(mountKey) {
        const m = this._mounts.get(mountKey);
        if (!m) return;
        m.observer.disconnect();
        m.groupRecords.forEach((record) => this._unloadGroup(record));
        removeGalleryWindowUi(m.containerEl); // core/file-manager/gallery-window-ui.js
        this._mounts.delete(mountKey);
    },

    /** Tile + badge của 1 nhóm (tạo object URL thumb). */
    _buildTiles(m, videos) {
        const states = computeGalleryTileStates(videos.map((video) => video.key), m.badgeMode, m.selectedKeys); // core/file-manager/gallery-window.js
        return videos.map((video, i) => ({
            key: video.key,
            src: createBlobUrl(video.thumbBlob), // service/blob-url.js
            alt: video.filename || '',
            durationText: formatVideoDuration(video.duration), // core/file-manager/video.js
            marked: states[i].marked,
            badgeHtml: renderGalleryTileBadgeHtml('video', states[i]), // components/media-gallery.js
        }));
    },

    /** Dựng nội dung thật cho 1 nhóm ngày (idempotent — observer có thể báo nhiều lần). */
    _loadGroup(m, record) {
        if (record.loaded) return;
        record.loaded = true;
        const html = renderVideoDayGroupHtml({ // components/media-gallery.js
            onLight: m.mountKey === 'genericDrawer', // nền Generic Drawer sáng -> chữ header tối
            headerText: formatVideoDayHeaderLabel(record.addedAt), // core/file-manager/video.js
            tiles: this._buildTiles(m, record.videos),
        });
        fillGalleryDayGroupUi(record.el, VIDEO_DAY_GROUP_PLACEHOLDER_CLASS, html); // core/file-manager/gallery-window-ui.js
        record.heightPx = measureGalleryDayGroupHeightUi(record.el);
    },

    /** Gỡ nội dung 1 nhóm, thu hồi object URL, giữ chỗ bằng placeholder. */
    _unloadGroup(record) {
        if (!record.loaded) return;
        record.loaded = false;
        clearGalleryDayGroupUi(record.el, VIDEO_DAY_GROUP_PLACEHOLDER_CLASS, record.heightPx).forEach(revokeBlobUrl); // core/file-manager/gallery-window-ui.js + service/blob-url.js
    },

    /** Đổi chế độ badge / tập đã chọn của mount đang có — chỉ vẽ lại badge các nhóm đang hiển thị.
     * @param {string} mountKey @param {'multiSelect'|null} badgeMode @param {Set<string>|Map<string,number>} [selectedKeys] */
    setBadgeMode(mountKey, badgeMode, selectedKeys) {
        const m = this._mounts.get(mountKey);
        if (!m) return;
        m.badgeMode = badgeMode || null;
        m.selectedKeys = selectedKeys || new Set();
        m.groupRecords.filter((record) => record.loaded).forEach((record) => {
            const states = computeGalleryTileStates(record.videos.map((video) => video.key), m.badgeMode, m.selectedKeys); // core/file-manager/gallery-window.js
            const tileByKey = new Map(states.map((state) => [state.key, { marked: state.marked, badgeHtml: renderGalleryTileBadgeHtml('video', state) }]));
            setGalleryTileBadgesUi(record.el, VIDEO_GALLERY_TILE_SPEC, tileByKey); // core/file-manager/gallery-window-ui.js
        });
    },
};
