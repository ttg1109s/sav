/**
 * event/workflow/photo-gallery-window.js — lưới ảnh justified (fjGallery) có windowing cấp NHÓM NGÀY, dùng cho các
 * picker ảnh trong Generic Drawer.
 *
 * Cơ chế:
 *   1. Ảnh gom theo ngày (groupImagesByDay()); mỗi nhóm là 1 khối DOM độc lập trong khung cuộn.
 *   2. `IntersectionObserver` trên từng khối (rootMargin ~2 màn hình mỗi phía) báo nhóm nào gần vùng nhìn.
 *   3. Nhóm vào vùng -> dựng header + tile, fjGallery layout, ghi "mốc" = chiều cao thật.
 *   4. Nhóm ra khỏi vùng -> thu hồi object URL, thay bằng placeholder cao đúng mốc (cuộn không giật).
 * Click tile không gắn ở đây — picker ủy quyền trên Generic Drawer (workflowGenericDrawerHelpers.mountMediaPicker()).
 *
 * NẠP SAU: core/file-manager/image.js, core/file-manager/gallery-window.js, core/file-manager/gallery-window-ui.js,
 * components/media-gallery.js, service/blob-url.js.
 */

const PHOTO_GALLERY_TILE_SPEC = { tileSelector: '.fj-gallery-item', keyName: 'imageKey', badgeSelector: '.photo-tile-badge', markedClass: 'photo-tile-marked' };
const PHOTO_DAY_GROUP_PLACEHOLDER_CLASS = 'photo-day-group-placeholder';

const workflowPhotoGalleryWindow = {
    _mounts: new Map(), // mountKey -> { mountKey, containerEl, groupRecords, observer, rowHeightPx, badgeMode, selectedKeys }

    /** Nhóm vào / ra vùng giữ của IntersectionObserver. */
    _GROUP_ACTION_BY_INTERSECTING: {
        true: (self, m, record) => self._loadGroup(m, record),
        false: (self, m, record) => self._unloadGroup(record),
    },

    /**
     * Dựng (lại từ đầu nếu đã có) khung nhóm ngày + IntersectionObserver cho 1 khung cuộn.
     * @param {string} mountKey - 'genericDrawer' (picker ảnh)
     * @param {{scrollEl: HTMLElement, images: Array, rowHeightPx: number, badgeMode?: 'multiSelect'|null, selectedKeys?: Set<string>|Map<string,number>}} config
     */
    mount(mountKey, { scrollEl, images, rowHeightPx, badgeMode, selectedKeys }) {
        this.unmount(mountKey);
        if (!scrollEl) return;

        const dayGroups = groupImagesByDay(sortImagesByAddedDateDesc(images)); // core/file-manager/image.js
        const { containerEl, groupEls } = mountGalleryWindowUi(scrollEl, renderGalleryWindowHtml('photo', dayGroups.map((g) => g.dayKey))); // core/file-manager/gallery-window-ui.js + components/media-gallery.js
        const groupRecords = dayGroups.map((group, i) => ({ dayKey: group.dayKey, addedAt: group.addedAt, images: group.images, el: groupEls[i], loaded: false, heightPx: null }));
        const m = { mountKey, containerEl, groupRecords, observer: null, rowHeightPx, badgeMode: badgeMode || null, selectedKeys: selectedKeys || new Set() };

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
    _buildTiles(m, images) {
        const states = computeGalleryTileStates(images.map((image) => image.key), m.badgeMode, m.selectedKeys); // core/file-manager/gallery-window.js
        return images.map((image, i) => ({
            key: image.key,
            src: createBlobUrl(image.thumbBlob || image.blob), // service/blob-url.js — record cũ chưa có thumbBlob
            width: image.width, height: image.height,
            alt: image.filename || '',
            marked: states[i].marked,
            badgeHtml: renderGalleryTileBadgeHtml('photo', states[i]), // components/media-gallery.js
        }));
    },

    /** Dựng nội dung thật cho 1 nhóm ngày (idempotent — observer có thể báo nhiều lần). */
    _loadGroup(m, record) {
        if (record.loaded) return;
        record.loaded = true;
        const html = renderPhotoDayGroupHtml({ // components/media-gallery.js
            onLight: m.mountKey === 'genericDrawer', // nền Generic Drawer sáng -> chữ header tối
            headerText: formatPhotoDayHeaderLabel(record.addedAt), // core/file-manager/image.js
            tiles: this._buildTiles(m, record.images),
        });
        fillGalleryDayGroupUi(record.el, PHOTO_DAY_GROUP_PLACEHOLDER_CLASS, html); // core/file-manager/gallery-window-ui.js
        record.heightPx = layoutPhotoDayGroupUi(record.el, m.rowHeightPx);
    },

    /** Gỡ nội dung 1 nhóm, thu hồi object URL, giữ chỗ bằng placeholder. */
    _unloadGroup(record) {
        if (!record.loaded) return;
        record.loaded = false;
        clearGalleryDayGroupUi(record.el, PHOTO_DAY_GROUP_PLACEHOLDER_CLASS, record.heightPx).forEach(revokeBlobUrl); // core/file-manager/gallery-window-ui.js + service/blob-url.js
    },

    /** Đổi chế độ badge / tập đã chọn của mount đang có — chỉ vẽ lại badge các nhóm đang hiển thị (nhóm placeholder tự
     * đúng khi tải lại), không dựng lại ảnh.
     * @param {string} mountKey @param {'multiSelect'|null} badgeMode @param {Set<string>|Map<string,number>} [selectedKeys] */
    setBadgeMode(mountKey, badgeMode, selectedKeys) {
        const m = this._mounts.get(mountKey);
        if (!m) return;
        m.badgeMode = badgeMode || null;
        m.selectedKeys = selectedKeys || new Set();
        m.groupRecords.filter((record) => record.loaded).forEach((record) => {
            const states = computeGalleryTileStates(record.images.map((image) => image.key), m.badgeMode, m.selectedKeys); // core/file-manager/gallery-window.js
            const tileByKey = new Map(states.map((state) => [state.key, { marked: state.marked, badgeHtml: renderGalleryTileBadgeHtml('photo', state) }]));
            setGalleryTileBadgesUi(record.el, PHOTO_GALLERY_TILE_SPEC, tileByKey); // core/file-manager/gallery-window-ui.js
        });
    },
};
