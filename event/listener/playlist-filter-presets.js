/**
 * event/listener/playlist-filter-presets.js — Listener Playlist Filter: màn List/Edit preset (Settings) và các hàng
 * field rule dùng chung với màn "Cài đặt filter" của folder. Ủy quyền 1 lần trên `genericDrawerBody` — thay cho
 * các `addEventListener` từng gắn lại trong onMount của event/workflow/app-settings.js. Cùng khuôn
 * event/listener/custom-effect.js (bảng tuyến `match`/`send`).
 *
 * Field rule (`data-filter-field`/`data-filter-prop`): khối chứa mang `data-filter-owner` quyết định router — màn
 * Edit preset và màn folder cùng markup nên PHẢI tách theo owner, không thì 1 thao tác bị xử lý ở cả 2 nơi. Nút
 * time-picker (`data-filter-time-trigger`) là 'click'; checkbox 'enabled' chỉ nghe 'change'; op/mode/value/valueTo
 * không nghe 'click'.
 *
 * NẠP SAU: event/bus.js, core/dom-refs.js (genericDrawerBody), event/router/playlist-filter-presets.js,
 * event/router/file-manager-folder-browser.js.
 */

const FILTER_EDIT_TARGET_BY_OWNER = {
    preset: { router: 'playlistFilterPresets', prefix: 'playlistFilterPresets' },
    folder: { router: 'fileManagerFolderBrowser', prefix: 'fileManagerFolderBrowser.filterEdit' },
};

/** 1 sự kiện trên hàng field rule -> router của owner. Trả true nếu đã xử lý (phần tử là field rule). */
function _pfFieldEvent(e) {
    const el = e.target.closest ? e.target.closest('[data-filter-field]') : null;
    if (!el) return false;
    const { filterField: field, filterProp: prop } = el.dataset;
    const ownerEl = el.closest('[data-filter-owner]');
    const target = ownerEl && FILTER_EDIT_TARGET_BY_OWNER[ownerEl.dataset.filterOwner];
    if (!field || !prop || !target) return true;
    if (el.hasAttribute('data-filter-time-trigger')) {
        if (e.type !== 'click') return true;
        eventBus.send({ router: target.router, type: `${target.prefix}.openTimePicker.click`, payload: { field, prop } });
        return true;
    }
    if (prop === 'enabled' && e.type !== 'change') return true;
    if (prop !== 'enabled' && e.type === 'click') return true;
    const value = prop === 'enabled' ? el.checked : el.value;
    eventBus.send({ router: target.router, type: `${target.prefix}.field.change`, payload: { field, prop, value } });
    return true;
}

function _pfClosest(target, selector) {
    return target.closest ? target.closest(selector) : null;
}

const PLAYLIST_FILTER_CLICK_ROUTES = [
    // Nút nhỏ trong 1 dòng đứng TRƯỚC tuyến dòng — khớp đầu tiên thắng.
    { match: (t) => _pfClosest(t, '[data-playlist-filter-quickselect]'), send: (el) => ['playlistFilterPresets.quickSelect.click', { id: el.dataset.playlistFilterQuickselect }] },
    { match: (t) => _pfClosest(t, '[data-playlist-filter-quickdelete]'), send: (el) => ['playlistFilterPresets.quickDelete.click', { id: el.dataset.playlistFilterQuickdelete }] },
    { match: (t) => _pfClosest(t, '[data-playlist-filter-quickunselect]'), send: () => ['playlistFilterPresets.quickUnselect.click', {}] },
    { match: (t) => _pfClosest(t, '[data-playlist-filter-tile]'), send: (el) => ['playlistFilterPresets.tile.click', { id: el.dataset.playlistFilterTile }] },
    { match: (t) => _pfClosest(t, '#btn-playlist-filter-list-add'), send: () => ['playlistFilterPresets.add.click', {}] },
    { match: (t) => _pfClosest(t, '#btn-playlist-filter-select'), send: () => ['playlistFilterPresets.select.click', {}] },
    { match: (t) => _pfClosest(t, '#btn-playlist-filter-delete'), send: () => ['playlistFilterPresets.delete.click', {}] },
    { match: (t) => _pfClosest(t, '#btn-playlist-filter-unselect'), send: () => ['playlistFilterPresets.unselect.click', {}] },
];

const PLAYLIST_FILTER_CHANGE_ROUTES = [
    { match: (t) => (t.id === 'playlist-filter-drawer-appliestofolder' ? t : null), send: (el) => ['playlistFilterPresets.appliesToFolder.change', { value: el.checked }] },
];

// 'focusout' thay 'blur' (blur không nổi bọt).
const PLAYLIST_FILTER_FOCUSOUT_ROUTES = [
    { match: (t) => (t.id === 'playlist-filter-drawer-name' ? t : null), send: (el) => ['playlistFilterPresets.name.change', { value: el.value }] },
];

/** Tra bảng tuyến của màn preset -> Router 'playlistFilterPresets'. */
function _pfDispatch(routes, e) {
    for (const route of routes) {
        const el = route.match(e.target);
        if (!el) continue;
        const [type, payload] = route.send(el);
        eventBus.send({ router: 'playlistFilterPresets', type, payload });
        return;
    }
}

/** click/change/input: field rule trước (router theo owner), không phải field thì tra bảng tuyến màn preset. */
function _pfFieldOrDispatch(routes, e) {
    if (_pfFieldEvent(e)) return;
    _pfDispatch(routes, e);
}

if (genericDrawerBody) {
    genericDrawerBody.addEventListener('click', (e) => _pfFieldOrDispatch(PLAYLIST_FILTER_CLICK_ROUTES, e));
    genericDrawerBody.addEventListener('change', (e) => _pfFieldOrDispatch(PLAYLIST_FILTER_CHANGE_ROUTES, e));
    genericDrawerBody.addEventListener('input', (e) => _pfFieldEvent(e));
    genericDrawerBody.addEventListener('focusout', (e) => _pfDispatch(PLAYLIST_FILTER_FOCUSOUT_ROUTES, e));
}
