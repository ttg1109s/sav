/**
 * event/workflow/app-panel-nav.js — "THẰNG THỰC THI CUỐI" của router "appPanelNav" (MỚI, đợt tái
 * cấu trúc bottom nav App Panel). Model: Media = Home Screen mặc định (đứng dưới CÙNG, LUÔN hiện);
 * Folder/Storage/Setting = overlay Generic Drawer (singleton core/generic-drawer.js) đè lên;
 * Photo/Game/Statis = overlay full-screen RIÊNG (ngang cấp nhau, KHÔNG dùng Generic Drawer).
 * Đóng bất kỳ overlay nào (Folder/Photo/Storage/Game/Statis/Setting) đều gọi lại `activateMedia()`
 * ở đây (liên tuyến domain, TH2 event-bus-flow.md mục 3a — tái dùng THẲNG, mỗi cụm không tự viết
 * lại logic "quay về Media").
 *
 * `setActiveTab(tab)`/`activateMedia()` là 2 method DÙNG CHUNG, public cho MỌI cụm khác gọi tới
 * (workflowAppSettings, workflowPhotoPanel, workflowPlaceholderPanels, event/workflow/
 * file-manager-folder-browser.js, event/workflow/file-manager-storage.js) — KHÔNG phải state
 * nghiệp vụ riêng của appPanelNav, chỉ là 2 hàm điều phối dùng chung.
 *
 * NẠP SAU: core/app-panel-nav.js (setAppPanelNavActiveTab), core/photo-panel.js (showPhotoPanel/
 * hidePhotoPanel), core/placeholder-panel.js (showPlaceholderPanel/hidePlaceholderPanel),
 * core/generic-drawer.js, event/workflow/generic-drawer-helpers.js (closeFully),
 * event/workflow/file-manager-photo.js (openPanel — liên tuyến domain, tái dùng THẲNG),
 * event/workflow/file-manager-folder-browser.js (openList — liên tuyến domain),
 * event/workflow/file-manager-storage.js (openPanel — liên tuyến domain, ĐÃ migrate sang Generic
 * Drawer, xem file đó).
 * NẠP TRƯỚC: event/router/app-panel-nav.js.
 */
const workflowAppPanelNav = {

    /** Tô sáng đúng tab + ghi appState — DÙNG CHUNG, mọi cụm mở overlay gọi hàm này thay vì tự
     * appState.set() lấy lệ (tránh lệch nếu sau này logic tô sáng cần thêm bước). */
    setActiveTab(tab) {
        setAppPanelNavActiveTab(tab); // core/app-panel-nav.js
        appState.set('appPanelActiveTab', tab);
        console.log(`writer: "workflowAppPanelNav.setActiveTab", page: "appPanelActiveTab", content: "${tab}"`);
    },

    /** Đóng MỌI overlay đang mở (Generic Drawer dùng chung cho Folder/Storage/Setting, HOẶC 1
     * trong 3 panel full-screen riêng Photo/Game/Statis) rồi về Media — dùng CHUNG bởi mọi cụm
     * đóng overlay (xem docstring đầu file) VÀ bởi chính `openMedia()` ngay dưới (bấm tab Media
     * trong lúc đang có overlay khác mở). */
    activateMedia() {
        this.setActiveTab('media');
    },

    /** Ứng với 'appPanelNav.media.click' — đóng HẲN mọi overlay đang mở rồi về Media. Khác
     * `activateMedia()` (chỉ tô sáng lại tab, gọi SAU KHI overlay tự đóng xong) — đây là ĐIỂM VÀO
     * khi Giang chủ động bấm tab Media trong lúc còn đang xem Folder/Photo/Storage/Game/Statis/
     * Setting, nên phải tự đóng overlay đang mở TRƯỚC — ≥2 bước phối hợp (đọc trạng thái từng
     * overlay + đóng đúng cái đang mở) -> Workflow, không phải core gọi thẳng. */
    openMedia() {
        if (!genericDrawerPanel.classList.contains('hidden')) workflowGenericDrawerHelpers.closeFully(); // Folder/Storage/Setting dùng chung Generic Drawer
        if (!photoPanel.classList.contains('hidden')) { resetSettingsStackToMain(); hidePhotoPanel(); }
        if (!gamePanel.classList.contains('hidden')) hidePlaceholderPanel(gamePanel);
        if (!statisPanel.classList.contains('hidden')) hidePlaceholderPanel(statisPanel);
        this.activateMedia();
    },

    /** Ứng với 'appPanelNav.folder.click' — liên tuyến domain (TH2), tái dùng THẲNG hàm ĐÃ CÓ,
     * KHÔNG viết lại (Folder browser vốn đã hoạt động đúng, chỉ đổi NƠI GỌI, xem event/workflow/
     * file-manager-storage.js đợt trước làm mẫu cùng kiểu). */
    openFolder() {
        this.setActiveTab('folder');
        workflowFileManagerFolderBrowser.openList(); // event/workflow/file-manager-folder-browser.js
    },

    /** Ứng với 'appPanelNav.photo.click'. */
    openPhoto() {
        this.setActiveTab('photo');
        showPhotoPanel(); // core/photo-panel.js
        workflowFileManagerPhoto.openPanel(); // event/workflow/file-manager-photo.js — liên tuyến domain
    },

    /** Ứng với 'appPanelNav.storage.click' — Storage ĐÃ migrate sang Generic Drawer (xem
     * event/workflow/file-manager-storage.js), gọi THẲNG y hệt Folder. */
    openStorage() {
        this.setActiveTab('storage');
        workflowFileManagerStorage.openPanel(); // event/workflow/file-manager-storage.js
    },

    /** Ứng với 'appPanelNav.game.click' — placeholder, chưa có nghiệp vụ. */
    openGame() {
        this.setActiveTab('game');
        showPlaceholderPanel(gamePanel); // core/placeholder-panel.js
    },

    /** Ứng với 'appPanelNav.statis.click' — placeholder, chưa có nghiệp vụ. */
    openStatis() {
        this.setActiveTab('statis');
        showPlaceholderPanel(statisPanel); // core/placeholder-panel.js
    },

    /** Ứng với 'appPanelNav.setting.click' — liên tuyến domain, tái dùng THẲNG workflowAppSettings
     * (event/workflow/app-settings.js) — hàm đó tự setActiveTab('setting') bên trong, KHÔNG gọi
     * lại ở đây (tránh set 2 lần cùng giá trị). */
    openSetting() {
        workflowAppSettings.open(); // event/workflow/app-settings.js
    },
};
