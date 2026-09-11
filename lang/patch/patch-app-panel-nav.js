/**
 * patch-app-panel-nav.js — patch default-language keys (tiếng Anh), phần bottom nav App Panel
 * (Media/Folder/Storage/Game/Statis) + panel Game/Statis/Setting. Photo đã hợp nhất vào Playlist
 * làm 1 Source, không còn tab/panel riêng — 'appPanelNav.tab.photo'/'photoPanel.title' đã xoá.
 * [SỬA 02/09/2026] Panel Game giờ có nghiệp vụ thật (danh sách card, xem core/gameplay/
 * game-panel-ui.js) — namespace `gamePanel.catalog.*`/`gamePanel.card.*` MỚI thêm cho phần đó.
 * [SỬA — Giang yêu cầu "tích hợp 1+2+3"] Panel Statis CŨNG giờ có nghiệp vụ thật (stat-grid tổng
 * quan + card so sánh Song/Video/Photo + Top list xếp hạng, xem core/statis-panel-ui.js) — namespace
 * `statisPanel.type.*`/`statisPanel.overview.*`/`statisPanel.compare.*`/`statisPanel.sort.*`/
 * `statisPanel.topList.*` MỚI thêm cho phần đó, CÙNG khuôn Game.
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
    // [SỬA — 02/09/2026, Game Panel app-store list] 'gamePanel.comingSoon' đổi Ý NGHĨA — KHÔNG còn
    // hiện tĩnh (panel giờ có nghiệp vụ thật), CHỈ còn là empty-state phòng hờ khi
    // GAMEPLAY_GAMES_CATALOG rỗng (hiện luôn có ít nhất 1 game, xem core/gameplay/catalog.js).
    'gamePanel.comingSoon': 'No games available yet — check back soon.',
    // MỚI — tên/mô tả từng game trong catalog (core/gameplay/catalog.js), namespace
    // 'gamePanel.catalog.<id game>.*' khớp ĐÚNG `id` trong catalog.
    'gamePanel.catalog.circle.name': 'Circle',
    'gamePanel.catalog.circle.description': 'Tap the wave right as it closes in on the center ring — the tighter the timing, the higher the score.',
    // Nhãn/label chung cho MỌI card (core/gameplay/game-panel-ui.js).
    'gamePanel.card.play': 'Play',
    'gamePanel.card.exit': 'Exit',
    'gamePanel.card.live': 'Live',
    'gamePanel.card.armed': 'Armed',
    'gamePanel.card.lockedHint': 'Exit the current game first',
    'statisPanel.title': 'Statis',
    // SỬA (Giang yêu cầu "tích hợp 1+2+3" — stat-grid + so sánh + Top list) — 'statisPanel.
    // comingSoon' đổi Ý NGHĨA, CÙNG khuôn 'gamePanel.comingSoon' — KHÔNG còn hiện tĩnh (panel giờ
    // có nghiệp vụ thật), CHỈ còn là empty-state khi thư viện HOÀN TOÀN rỗng (không có Song/Video/
    // Photo nào), xem core/statis-panel-ui.js.
    'statisPanel.comingSoon': 'No files yet — upload a song, video, or photo to see stats here.',
    // Nhãn LOẠI media — DÙNG CHUNG cho cả tiêu đề card so sánh (nhóm 1+2) VÀ chip lọc Top list
    // (nhóm 3) — CÙNG 1 vị trí màn hình, không cần tách namespace riêng như 'fieldViewDuration' đã
    // làm cho Video/Photo trước đó (đó là DUY NHẤT do khác Song ý nghĩa "Đã nghe" vs "Watch time"
    // của CÙNG field — namespace này chỉ là TÊN loại media, không có biến thể ý nghĩa nào).
    'statisPanel.type.all': 'All',
    'statisPanel.type.song': 'Song',
    'statisPanel.type.video': 'Video',
    'statisPanel.type.photo': 'Photo',
    // Nhóm 1+2 — stat-grid tổng quan + card so sánh Song/Video/Photo.
    'statisPanel.overview.totalTime': 'Total time',
    'statisPanel.overview.totalPlays': 'Total plays',
    'statisPanel.overview.neverPlayed': 'Never played',
    'statisPanel.compare.itemCount': '{n} files',
    'statisPanel.compare.playCount': '{n} plays',
    // Nhóm 3 — toggle sort + Top list xếp hạng.
    'statisPanel.sort.byCount': 'Most played',
    'statisPanel.sort.byTime': 'Most time',
    'statisPanel.topList.empty': 'No plays yet for this filter.',
    // MỚI — placeholder tức thời lúc `openPanel()` đang await đọc DB (3 store Song/Video/Photo qua
    // `workflowPlaylistScope.listMediaRecords()`, xem event/workflow/statis-panel.js) — hiện NGAY
    // lúc bấm tab (tránh cảm giác đứng hình chờ Promise.all xong mới thấy panel mở).
    'statisPanel.loading': 'Loading stats…',

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
