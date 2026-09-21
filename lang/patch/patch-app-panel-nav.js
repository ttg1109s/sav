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
    'appPanelNav.tab.statis': 'Statistics', // SỬA 21/09/2026 — 'Statis' không phải tên tiếng Anh tự nhiên (bottom nav cuộn ngang, min-width 88px/tab nên nhãn dài hơn vẫn vừa)
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
    'statisPanel.title': 'Statistics', // SỬA 21/09/2026 — cùng lý do 'appPanelNav.tab.statis'
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
    'statisPanel.overview.neverPlayed': 'Never played', // GIỮ lại dù ô cũ đã bỏ (Rule 0.5 — vô hại)
    // MỚI 21/09/2026 — bố cục lại panel theo 3 tầng có heading + card "Library played" thay ô "Never played" đơn độc.
    'statisPanel.section.overview': 'Overview',
    'statisPanel.section.mediaTypes': 'Media types',
    'statisPanel.section.topMedia': 'Top media',
    'statisPanel.overview.libraryPlayed': 'Library played',
    'statisPanel.overview.filesPlayed': '{played} / {total} files',
    'statisPanel.overview.neverPlayedCount': '{n} never played',
    'statisPanel.compare.shareOfPlays': 'of plays',
    'statisPanel.compare.shareOfTime': 'of time',
    'statisPanel.share.byPlays': 'Share by plays',
    'statisPanel.share.byTime': 'Share by time',
    'statisPanel.compare.itemCount': '{n} files',
    'statisPanel.compare.playCount': '{n} plays',
    // Nhóm 3 — toggle sort + Top list xếp hạng.
    'statisPanel.sort.byCount': 'Most played',
    'statisPanel.sort.byTime': 'Most time',
    // SỬA 21/09/2026 — empty state THEO LOẠI đang lọc (key cũ 'statisPanel.topList.empty' thay bằng 4 key dưới; file ngôn ngữ .json tự nhập nếu chưa có key mới sẽ rơi về tiếng Anh này).
    'statisPanel.topList.empty.all': 'Nothing has been played yet.',
    'statisPanel.topList.empty.song': 'No songs played yet.',
    'statisPanel.topList.empty.video': 'No videos played yet.',
    'statisPanel.topList.empty.photo': 'No photos viewed yet.',
    'statisPanel.topList.hint': 'Top {n}',
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
    // MỚI (20/09/2026, Giang yêu cầu thiết kế lại Main Setting dạng carousel, card cần thêm miêu tả).
    // 'appSettings.row.resetApp' (label) GIỮ lại dù card "Reset app" đã bỏ khỏi Main (Rule 0.5 — vô hại).
    'appSettings.row.playlist.hint': 'Media source, view mode, sorting and filters',
    'appSettings.row.system.hint': 'Theme, motion presets and language',
    'appSettings.row.visualizerScreen.hint': 'Display, auto-switch, background, gestures and player',
    'appSettings.row.troubleshooting.hint': 'Debug console, reset options and video thumbnail repair',

    // MỚI (20/09/2026) — màn Troubleshooting: 4 hàng ngang hàng, không chia nhóm
    // (components/settings/troubleshooting.js).
    'appSettings.troubleshooting.debugConsole.hint': 'View, copy or clear the app log lines',
    'appSettings.troubleshooting.videoThumb.label': 'Scan & fix video thumbnails',
    'appSettings.troubleshooting.videoThumb.hint': 'Finds videos with missing, black or unreadable full-res thumbnails and regenerates them',
    'appSettings.troubleshooting.videoThumb.btnFix': 'Fix thumbnails',

    // MỚI (Giang yêu cầu "Player" — Resolution + Motion của Video/Photo lúc phát chính, Settings >
    // Visualizer Screen > Player > Video/Photo, xem core/player-display-settings.js).
    'appSettings.player.label': 'Player',
    'appSettings.player.hint': 'Resolution and Motion for Video/Photo playback',
    'appSettings.player.video.label': 'Video',
    'appSettings.player.video.hint': 'Resolution and Motion for Video playback',
    'appSettings.player.photo.label': 'Photo',
    'appSettings.player.photo.hint': 'Resolution and Motion for Photo playback',

    'appSettings.system.title': 'System',
    'appSettings.system.theme.label': 'Theme',
    'appSettings.system.theme.hint': 'Light, dark, or Morphin glass',
    'appSettings.system.gesture.label': 'Gestures',
    'appSettings.system.gesture.hint': 'Swipe, tap, and Control Center shortcuts',
    // SỬA (29/08/2026, phản hồi Giang — "tránh nhầm giữa tên mục Settings với chế độ Playback
    // 'Slideshow' của VBG") — 'appSettings.system.slideshow.*' đổi thành 'appSettings.system.motion.*'.
    'appSettings.system.motion.label': 'Motion',
    'appSettings.system.motion.hint': 'Transition, Ken Burns, and beat-reactive movement',
    'appSettings.system.language.label': 'Language',
    'appSettings.system.language.hint': 'App display language',

    // SỬA 21/09/2026 — nhãn cũ 'Theme' đổi 'Background' (select này điều khiển NỀN phía sau app: sáng/tối/glass, KHÔNG phải màu giao diện) — tránh nhầm với hàng 'Interface' mới ngay trên nó.
    'appSettings.theme.select.label': 'Background',
    'appSettings.theme.uiTheme.label': 'Color',
    'appSettings.theme.uiTheme.option.light': 'Light',
    'appSettings.theme.uiTheme.option.dark': 'Dark',
    'appSettings.theme.uiTheme.option.morphin': 'Morphin',
    'appSettings.theme.select.light': 'Light',
    'appSettings.theme.select.dark': 'Dark',
    'appSettings.theme.select.glass': 'Transparent glass',
    'appSettings.theme.glassType.label': 'Background type',
    'appSettings.theme.glassType.solid': 'Solid colour',
    'appSettings.theme.glassType.gradient': 'Gradient',
    'appSettings.theme.glassType.image': 'Image',
    'appSettings.theme.solidColor.label': 'Colour',
    // MỚI 21/09/2026 — UI nền Morphin 3 card (core/theme-background-ui.js). 'appSettings.theme.glassType.*' ở trên (dropdown cũ) không còn nơi nào dùng.
    'appSettings.theme.bg.section': 'Background',
    'appSettings.theme.bg.solid': 'Solid',
    'appSettings.theme.bg.gradient': 'Gradient',
    'appSettings.theme.bg.media': 'Background media',
    'appSettings.theme.bg.media.empty': 'Not set',
    'appSettings.theme.bg.media.pickPhoto': 'Photo',
    'appSettings.theme.bg.media.pickVideo': 'Video',

    'appSettings.visualizerScreen.title': 'Visualizer Screen',
    'appSettings.visualizerScreen.pendingNote': 'This section is being reorganized — coming soon in the next update.',

    'appSettings.resetApp.title': 'Reset app',
    'appSettings.resetApp.restartApp.label': 'Restart app',
    'appSettings.resetApp.restoreDefaults.label': 'Restore default settings',
    'appSettings.resetApp.clearCache.label': 'Clear app cache',
    // MỚI (20/09/2026) — hint cho 2 hàng ngang hàng ở Troubleshooting (thay modalChoice cũ).
    'appSettings.resetApp.restoreDefaults.hint': 'Colors, effects and EQ go back to defaults — your library is kept',
    'appSettings.resetApp.clearCache.hint': 'Clear cached JS/CSS if the app looks outdated after an update',
};
