/**
 * patch-app-panel-nav.js — patch default-language keys (tiếng Anh), phần bottom nav App Panel
 * (Media/Folder/Storage/Game/Statis) + panel Game/Statis/Setting. Photo đã hợp nhất vào Playlist
 * làm 1 Source, không còn tab/panel riêng — 'appPanelNav.tab.photo'/'photoPanel.title' đã xoá.
 * Xem lang/patch/patch-common.js cho quy ước chung. Nạp TRƯỚC /lang/lang.js.
 */
const LANG_PATCH_APP_PANEL_NAV = {
    'appPanelNav.tab.media': 'Media',
    'appPanelNav.tab.folder': 'Folder',
    'appPanelNav.tab.storage': 'Storage',
    'appPanelNav.tab.game': 'Game',
    'appPanelNav.tab.statis': 'Statis',
    'appPanelNav.tab.setting': 'Setting',

    'gamePanel.title': 'Game',
    'gamePanel.comingSoon': 'Coming soon',
    'statisPanel.title': 'Statis',
    'statisPanel.comingSoon': 'Coming soon',

    'appSettings.title': 'Setting',
    'appSettings.row.playlist': 'Playlist',
    'appSettings.row.system': 'System',
    'appSettings.row.visualizerScreen': 'Visualizer Screen',
    'appSettings.row.troubleshooting': 'Troubleshooting',
    'appSettings.row.resetApp': 'Reset app',

    'appSettings.system.title': 'System',
    'appSettings.system.theme.label': 'Theme',
    'appSettings.system.theme.hint': 'Light, dark, or transparent glass',
    'appSettings.system.gesture.label': 'Gestures',
    'appSettings.system.gesture.hint': 'Swipe, tap, and Control Center shortcuts',
    // SỬA (29/08/2026, phản hồi Giang — "tránh nhầm giữa tên mục Settings với chế độ Playback
    // 'Slideshow' của VBG") — 'appSettings.system.slideshow.*' đổi thành 'appSettings.system.motion.*'.
    'appSettings.system.motion.label': 'Motion',
    'appSettings.system.motion.hint': 'Transition, Ken Burns, and beat-reactive movement',
    'appSettings.system.language.label': 'Language',
    'appSettings.system.language.hint': 'App display language',

    'appSettings.theme.select.label': 'Theme',
    'appSettings.theme.select.light': 'Light',
    'appSettings.theme.select.dark': 'Dark',
    'appSettings.theme.select.glass': 'Transparent glass',
    'appSettings.theme.glassType.label': 'Background type',
    'appSettings.theme.glassType.solid': 'Solid colour',
    'appSettings.theme.glassType.gradient': 'Gradient',
    'appSettings.theme.glassType.image': 'Image',
    'appSettings.theme.solidColor.label': 'Colour',

    'appSettings.visualizerScreen.title': 'Visualizer Screen',
    'appSettings.visualizerScreen.pendingNote': 'This section is being reorganized — coming soon in the next update.',

    'appSettings.resetApp.title': 'Reset app',
    'appSettings.resetApp.restartApp.label': 'Restart app',
    'appSettings.resetApp.restoreDefaults.label': 'Restore default settings',
    'appSettings.resetApp.clearCache.label': 'Clear app cache',
};
