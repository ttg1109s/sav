/**
 * event/router/playlist-filter-presets.js — Router tên "playlistFilterPresets", tự đăng ký với
 * eventBus lúc nạp. Mọi msg.type của hệ "Playlist Filter Presets" (công tắc tổng/danh sách/sửa),
 * xem event/workflow/playlist-filter-presets.js (workflowPlaylistFilterPresets).
 *
 * NẠP SAU: event/bus.js, event/workflow/playlist-filter-presets.js.
 */
const routerPlaylistFilterPresets = (() => {
    function handle(msg) {
        switch (msg.type) {

            case 'playlistFilterPresets.enabledToggle.change':
                workflowPlaylistFilterPresets.setEnabled(msg.payload.checked);
                break;

            case 'playlistFilterPresets.openManage.click':
                workflowPlaylistFilterPresets.openList();
                break;

            case 'playlistFilterPresets.add.click':
                workflowPlaylistFilterPresets.createNew();
                break;

            case 'playlistFilterPresets.tile.click':
                workflowPlaylistFilterPresets.tileClick(msg.payload.id);
                break;

            case 'playlistFilterPresets.quickDelete.click':
                workflowPlaylistFilterPresets.quickDelete(msg.payload.id);
                break;

            case 'playlistFilterPresets.quickSelect.click':
                workflowPlaylistFilterPresets.quickSelect(msg.payload.id);
                break;

            case 'playlistFilterPresets.name.change':
                workflowPlaylistFilterPresets.setName(msg.payload.value);
                break;

            case 'playlistFilterPresets.field.change':
                workflowPlaylistFilterPresets.setFilterField(msg.payload.field, msg.payload.prop, msg.payload.value);
                break;

            case 'playlistFilterPresets.openTimePicker.click':
                workflowPlaylistFilterPresets.openFilterTimePicker(msg.payload.field, msg.payload.prop);
                break;

            case 'playlistFilterPresets.select.click':
                workflowPlaylistFilterPresets.selectPreset(msg.payload.id);
                break;

            case 'playlistFilterPresets.delete.click':
                workflowPlaylistFilterPresets.deletePreset(msg.payload.id);
                break;

            default:
                console.warn(`[router:playlistFilterPresets] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('playlistFilterPresets', routerPlaylistFilterPresets);
