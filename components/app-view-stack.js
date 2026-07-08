/**
 * Component: App View Stack — khung BỌC CHUNG Playlist + Settings (MỚI, 07/07/2026, phản hồi
 * Giang mục 2 — "Đưa playlist và setting vào chung một container, ảnh sẽ set chung cho container
 * này. Và khi ấn nút icon setting cũng thực hiện cơ chế trượt sang").
 *
 * KIẾN TRÚC (chốt sau khi Giang làm rõ — dùng cuộn ngang NATIVE, KHÔNG tự tay animate `left`):
 *   `#side-left-container` — khung cuộn NGANG thật (`overflow-x`, `scroll-snap`), giữ NGUYÊN VẸN
 *   mọi rule vị trí/responsive mà `#playlist-view` từng có (mobile: transform slide pager với
 *   Visualizer; desktop: cột trái cố định — xem assets/css/style.css) — CHỈ đổi TÊN selector từ
 *   `#playlist-view` sang `#side-left-container`, không đổi HÀNH VI GÌ CẢ. Visualizer/Player
 *   KHÔNG nằm trong khung này (`<visualizer>không đụng</visualizer>` — Giang xác nhận rõ), vẫn là
 *   sibling độc lập như trước.
 *
 *   BÊN TRONG `#side-left-container`: 2 "trang" CẠNH NHAU cuộn qua lại — `#playlist-view` (màn
 *   Playlist thật, components/playlist-view.js — ĐÃ bỏ hết tự định vị/nền riêng) và
 *   `#drawer-settings` (Settings, components/settings-drawer.js — ĐÃ bỏ hết tự định vị/nền riêng).
 *   Chuyển qua lại bằng `side-left-container.scrollTo({left, behavior:'smooth'})` (nhánh "đang ở
 *   Playlist") — xem core/player-controls.js::scrollSideLeftToSettingsSmooth()/
 *   scrollSideLeftToPlaylistSmooth() (VIẾT LẠI 08/07/2026, HOTFIX 8 — trước đó tên
 *   openSettingsDrawer()/closeSettingsDrawer()).
 *
 *   Nền DÙNG CHUNG cho CẢ 2 trang: `#playlist-bg` (ảnh, JS điều khiển qua updatePlaylistBg() —
 *   core/color-utils.js, KHÔNG đổi gì) + 1 lớp phủ đen 40% cố định — CẢ 2 đặt `position: absolute`
 *   NGAY BÊN TRONG `#side-left-container` (KHÔNG phải bên trong 2 trang con) — vì CSS: phần tử
 *   `absolute` bị loại khỏi flex layout của cha (dù cha là `display:flex`), nên KHÔNG cuộn theo 2
 *   trang, đứng yên xuyên suốt lúc chuyển qua lại — đúng yêu cầu "ảnh set chung cho container".
 *   `bg-black` tĩnh trên chính `#side-left-container` làm nền dự phòng LUÔN CÓ (chặn canvas
 *   Visualizer lộ ra phía sau khi chưa cấu hình ảnh nào — giữ đúng hành vi `bg-[#000000]` gốc của
 *   `#playlist-view` cũ, chỉ dời lên 1 cấp).
 *
 * NẠP SAU: components/playlist-view.js (TPL_PLAYLIST_VIEW), components/settings-drawer.js
 * (TPL_SETTINGS_DRAWER) — 2 biến này được NHÉT VÀO GIỮA khi main.js ghép chuỗi (xem main.js).
 */
const TPL_APP_VIEW_STACK_OPEN = `
    <div id="side-left-container" class="fixed inset-0 z-[60] bg-black">
        <!-- HOTFIX 14 (08/07/2026, Giang chỉ đúng hướng) — 'position: absolute' (bản cũ) ĐỔI
             thành 'fixed': '#side-left-container' (cha) là khung CUỘN NGANG thật (overflow-x) giữa
             Playlist/Settings — 1 phần tử con 'absolute' vẫn nằm TRONG vùng nội dung cuộn của cha
             (dù containing block tính theo padding box của cha), nên bị kéo lệch theo đúng
             scrollLeft mỗi lần cuộn sang Settings, để lộ khoảng trống không ảnh — đúng lỗi Giang
             báo ("ảnh nền lỗi khi cuộn sang Settings"). '#side-left-container' đã có sẵn
             'transform' (dùng cho toggle .playlist-hidden, xem assets/css/style.css) — 1 phần tử
             có 'transform' TỰ trở thành containing block cho hậu duệ 'position: fixed', nên
             'fixed inset-0' ở đây vẫn phủ đúng khung '#side-left-container' (không nhảy ra full
             viewport thật) — NHƯNG khác 'absolute', phần tử 'fixed' KHÔNG bị cuộn NỘI BỘ
             (scrollLeft) của cha kéo theo — đứng yên xuyên suốt lúc chuyển trang, đúng ý "1 ảnh
             nền dùng chung cho cả Playlist lẫn Settings". -->
        <div id="playlist-bg" class="fixed inset-0 bg-cover bg-center bg-no-repeat pointer-events-none transition-all duration-300" style="filter: blur(0px); transform: scale(1.1);"></div>
        <div class="fixed inset-0 bg-black/40 pointer-events-none"></div>
`;

const TPL_APP_VIEW_STACK_CLOSE = `
    </div>
`;
