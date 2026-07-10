/**
 * Component: App View Stack — khung BỌC CHUNG Playlist + Settings (MỚI, 07/07/2026, phản hồi
 * Giang mục 2 — "Đưa playlist và setting vào chung một container, ảnh sẽ set chung cho container
 * này. Và khi ấn nút icon setting cũng thực hiện cơ chế trượt sang").
 *
 * VIẾT LẠI HOÀN TOÀN (08/07/2026, HOTFIX 16, Giang chốt sau chuỗi HOTFIX 13-15) — thêm 1 tầng bọc
 * MỚI `#app-stack`, ngang hàng với Visualizer (`#visualizer-ui`/`#player-container`):
 *
 *   `#app-stack` — NHẬN LẠI toàn bộ trách nhiệm VỊ TRÍ/RESPONSIVE mà `#side-left-container` từng tự
 *   làm (mobile: `transform: translateX()` trượt qua lại với Visualizer, class `.playlist-hidden`;
 *   desktop: cột trái cố định `width: clamp(...)` — xem assets/css/style.css, đã đổi hết selector
 *   từ `#side-left-container` sang `#app-stack`). Bên trong nó có ĐÚNG 2 con, xếp theo thứ tự DOM
 *   (con sau vẽ ĐÈ lên con trước, không cần z-index riêng):
 *     1. `#app-bg` — lớp NỀN THUẦN (ảnh + overlay đen, JS điều khiển qua updatePlaylistBg() —
 *        core/color-utils.js) — KHÔNG chứa chữ/nội dung gì, để `filter: blur()` (tính năng "Độ mờ
 *        nền") áp được AN TOÀN, không lem sang chữ.
 *     2. `#side-left-container` — giờ CHỈ còn ĐÚNG 1 việc: khung cuộn NGANG thật giữa 2 "trang"
 *        Playlist/Settings (`overflow-x`, `scroll-behavior: smooth` — xem CSS) — không tự định vị
 *        gì nữa (`position: absolute; inset: 0;` lấp đầy đúng khung `#app-stack`, bất kể mobile hay
 *        desktop).
 *
 *   LÝ DO tách hẳn tầng này (Giang, sau khi HOTFIX 14/15 vẫn không giải quyết được lúc bật "Độ mờ
 *   nền"): `#side-left-container` VỪA là khung cuộn ngang VỪA từng phải tự lo transform — bất kỳ
 *   thứ gì cần "đứng yên, phủ kín, không bị cuộn nội bộ kéo theo" mà lại làm CON (hay pseudo-
 *   element) của nó đều dính đúng bug "bị kéo lệch theo scrollLeft" (dù dùng `absolute` hay
 *   `fixed`, dù filter blur ở đâu) — vì bản chất nó vẫn là 1 box nằm TRONG vùng cuộn của
 *   `#side-left-container`. Tách `#app-bg` ra làm ANH EM với `#side-left-container` (cùng cấp,
 *   dưới `#app-stack`) giải quyết TẬN GỐC: `#app-bg` không còn là hậu duệ của khung cuộn ngang nữa,
 *   không thể nào bị `scrollLeft` của `#side-left-container` ảnh hưởng, và `filter: blur()` áp lên
 *   nó không lem sang `#side-left-container` (2 phần tử độc lập, không lồng nhau).
 *
 *   BÊN TRONG `#side-left-container`: 2 "trang" CẠNH NHAU cuộn qua lại — `#playlist-view` (màn
 *   Playlist thật, components/playlist-view.js — ĐÃ bỏ hết tự định vị/nền riêng) và
 *   `#drawer-settings` (Settings, components/settings-drawer.js — ĐÃ bỏ hết tự định vị/nền riêng).
 *   Chuyển qua lại bằng `sideLeftContainer.scrollTo({left, behavior:'smooth'})` — xem
 *   core/player-controls.js::scrollSideLeftToSettingsSmooth()/scrollSideLeftToPlaylistSmooth().
 *
 * NẠP SAU: components/playlist-view.js (TPL_PLAYLIST_VIEW), components/settings-drawer.js
 * (TPL_SETTINGS_DRAWER) — 2 biến này được NHÉT VÀO GIỮA khi main.js ghép chuỗi (xem main.js).
 */
const TPL_APP_VIEW_STACK_OPEN = `
    <div id="app-stack" class="fixed inset-0 z-[60]">
        <div id="app-bg" class="bg-black bg-cover bg-center bg-no-repeat pointer-events-none"></div>
        <div id="side-left-container">
`;

const TPL_APP_VIEW_STACK_CLOSE = `
        </div>
    </div>
`;
