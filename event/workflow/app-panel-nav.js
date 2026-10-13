/**
 * event/workflow/app-panel-nav.js — Workflow của router "appPanelNav". Media = Home Screen (luôn ở dưới cùng);
 * Folder/Storage/Setting = overlay Generic Drawer; Game/Statis = overlay full-screen riêng. Đóng overlay nào cũng gọi
 * lại `activateMedia()`.
 *
 * `setActiveTab()`/`activateMedia()`/`paintActiveTab()` dùng chung cho các cụm khác (workflowAppSettings,
 * workflowPlaceholderPanels, Folder Browser, Storage, workflowUiTheme, workflowAppBoot).
 *
 * NẠP SAU: core/app-panel-nav.js, core/ui-theme/registry.js + apply-ui.js (resolveUiThemeClass, _activeUiThemeKeyList).
 * Các Workflow đích (game-catalog, statis-panel...) nạp sau file này — chỉ gọi lúc runtime nên không cần đúng thứ tự.
 * NẠP TRƯỚC: event/router/app-panel-nav.js.
 */
const workflowAppPanelNav = {

    /** Tô sáng đúng tab + ghi appState — mọi cụm mở overlay gọi hàm này. */
    setActiveTab(tab) {
        this.paintActiveTab(tab);
        appState.set('appPanelActiveTab', tab);
        console.log(`writer: "workflowAppPanelNav.setActiveTab", page: "appPanelActiveTab", content: "${tab}"`);
    },

    /** Chỉ tô màu nút nav theo theme đang chạy (không ghi state) — dùng thêm khi theme đổi/khôi phục và lúc boot. */
    paintActiveTab(tab) {
        const activeCls = resolveUiThemeClass(_activeUiThemeKeyList, 'accentText'); // core/ui-theme/registry.js
        const inactiveCls = resolveUiThemeClass(_activeUiThemeKeyList, 'navInactiveText');
        setAppPanelNavActiveTab(tab, activeCls, inactiveCls); // core/app-panel-nav.js
    },

    /** Về Media (dùng chung bởi mọi cụm đóng overlay). */
    activateMedia() {
        this.setActiveTab('media');
    },

    /** 'appPanelNav.folder.click' */
    openFolder() {
        this.setActiveTab('folder');
        workflowFileManagerFolderBrowser.openList(); // event/workflow/file-manager-folder-browser.js
    },

    /** 'appPanelNav.storage.click' */
    openStorage() {
        this.setActiveTab('storage');
        workflowFileManagerStorage.openPanel(); // event/workflow/file-manager-storage.js
    },

    /** 'appPanelNav.game.click' */
    openGame() {
        this.setActiveTab('game');
        workflowGameCatalog.openPanel(); // event/workflow/game-catalog.js
    },

    /** 'appPanelNav.statis.click' */
    openStatis() {
        this.setActiveTab('statis');
        workflowStatisPanel.openPanel(); // event/workflow/statis-panel.js
    },

};
