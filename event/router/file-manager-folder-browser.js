/**
 * event/router/file-manager-folder-browser.js — Router "fileManagerFolderBrowser" (Folder Browser trong Generic Drawer),
 * tự đăng ký với eventBus lúc nạp. Mọi case giao event/workflow/file-manager-folder-browser.js. Mở Folder
 * Browser đi qua tab Folder ('appPanelNav.folder.click' -> workflowAppPanelNav.openFolder() -> openList()).
 *
 * Nguồn message: lưới List
 * (wireFolderPickerDrawerEvents, msgPrefix 'fileManagerFolderBrowser.list'); dropdown giữ tay (openDropdownMenu);
 * modal đổi tên (openRenameFolderModal); modal Thuộc tính (wireFolderPropertiesModalUi); nút header màn Filter Edit
 * (wireFolderFilterEditUi) — đều ở core/file-manager/folder-picker-ui.js trừ dropdown; field rule của Filter Edit
 * (`filterEdit.field.change`/`filterEdit.openTimePicker.click`) từ delegate chung event/listener/playlist.js.
 *
 * NẠP SAU: event/bus.js, event/workflow/file-manager-folder-browser.js.
 */
const routerFileManagerFolderBrowser = (() => {
    function handle(msg) {
        switch (msg.type) {
            // ===================== List =====================
            case 'fileManagerFolderBrowser.list.close.click':
                workflowFileManagerFolderBrowser.closeBrowser();
                break;
            case 'fileManagerFolderBrowser.list.tile.click':
                workflowFileManagerFolderBrowser.applyFolderFromTile(msg.payload.folderId);
                break;
            case 'fileManagerFolderBrowser.list.tile.longpress':
                workflowFileManagerFolderBrowser.openTileActionsMenu(msg.payload.folderId, msg.payload.anchorEl);
                break;
            case 'fileManagerFolderBrowser.list.page.change':
                workflowFileManagerFolderBrowser.setListPage(msg.payload.pageIndex);
                break;
            case 'fileManagerFolderBrowser.list.addTile.click':
                workflowFileManagerFolderBrowser.createFolderInBrowser();
                break;
            case 'fileManagerFolderBrowser.list.rename.commit':
                workflowFileManagerFolderBrowser.commitListRename(msg.payload.folderId, msg.payload.name);
                break;

            // ===================== Dropdown giữ tay =====================
            case 'fileManagerFolderBrowser.tileMenu.rename.click':
                workflowFileManagerFolderBrowser.renameFromTileMenu(msg.payload.folderId);
                break;
            case 'fileManagerFolderBrowser.tileMenu.delete.click':
                workflowFileManagerFolderBrowser.deleteFromTileMenu(msg.payload.folderId);
                break;
            case 'fileManagerFolderBrowser.tileMenu.filter.click':
                workflowFileManagerFolderBrowser.filterFromTileMenu(msg.payload.folderId);
                break;
            case 'fileManagerFolderBrowser.tileMenu.properties.click':
                workflowFileManagerFolderBrowser.propertiesFromTileMenu(msg.payload.folderId);
                break;

            // ===================== Modal đổi tên =====================
            case 'fileManagerFolderBrowser.rename.confirm':
                workflowFileManagerFolderBrowser.confirmRenameFolder(msg.payload.folderId, msg.payload.name);
                break;

            // ===================== Modal Thuộc tính — 3 checkbox =====================
            case 'fileManagerFolderBrowser.properties.readOnly.change': {
                const { folderId, mediaType, enabled } = msg.payload;
                workflowFileManagerFolderBrowser.changeReadOnlyFromProperties(folderId, mediaType, enabled);
                break;
            }
            case 'fileManagerFolderBrowser.properties.hidden.change': {
                const { folderId, mediaType, enabled } = msg.payload;
                workflowFileManagerFolderBrowser.changeHiddenFromProperties(folderId, mediaType, enabled);
                break;
            }
            case 'fileManagerFolderBrowser.properties.applyFilter.change': {
                const { folderId, mediaType, enabled } = msg.payload;
                workflowFileManagerFolderBrowser.changeApplyFilterFromProperties(folderId, mediaType, enabled);
                break;
            }

            // ===================== Filter Edit =====================
            case 'fileManagerFolderBrowser.filterEdit.back.click':
                workflowFileManagerFolderBrowser.backFromFilterEdit();
                break;
            case 'fileManagerFolderBrowser.filterEdit.apply.click':
                workflowFileManagerFolderBrowser.applyFolderFilterEdit();
                break;
            case 'fileManagerFolderBrowser.filterEdit.field.change':
                workflowFileManagerFolderBrowser.setFilterField(msg.payload.field, msg.payload.prop, msg.payload.value);
                break;
            case 'fileManagerFolderBrowser.filterEdit.openTimePicker.click':
                workflowFileManagerFolderBrowser.openFilterTimePicker(msg.payload.field, msg.payload.prop);
                break;

            default:
                console.warn(`[router:fileManagerFolderBrowser] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('fileManagerFolderBrowser', routerFileManagerFolderBrowser);
