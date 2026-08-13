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
 *     1. `#app-bg` — khung NỀN NGOÀI, `overflow: hidden` (khung "cắt", LUÔN NÉT — bản thân nó
 *        KHÔNG mang `filter` gì nữa) — bên trong có ĐÚNG 2 con, XẾP THEO THỨ TỰ (con sau vẽ đè con
 *        trước — chuẩn DOM thường, không cần z-index riêng):
 *          a. `#app-bg-image` — "CÁI DOM BG IMAGE" thật — mang ảnh THẬT + overlay đen, JS điều
 *             khiển qua updatePlaylistBg() (core/color-utils.js). LUÔN NÉT, KHÔNG BAO GIỜ nhận
 *             `transform`/`filter` gì — đây là ảnh gốc, hiển thị nguyên trạng khi KHÔNG bật "Độ mờ
 *             nền" (bgBlur = 0).
 *          b. `#app-bg-blur-layer` — LỚP PHỦ vẽ ĐÈ lên trên (a), CÙNG 1 ảnh (updatePlaylistBg() gán
 *             y hệt (a) mỗi khi bgBlur > 0) nhưng nhận THÊM `transform: scale(1.1)` + `filter:
 *             blur()` — CHỈ 2 phần tử NÀY (KHÔNG PHẢI (a)) nhận scale/blur. Khi bgBlur = 0, layer
 *             này rỗng (`background-image: none`), để lộ nguyên ảnh nét ở (a) bên dưới.
 *        SỬA (12/08/2026, Giang báo bug "blur ảnh nền làm mất viền panel") — TRƯỚC ĐÂY `filter:
 *        blur()` áp THẲNG lên chính `#app-bg` (khung khớp CHÍNH XÁC viền `#app-stack`, xem
 *        `border-right` desktop, assets/css/style.css) — blur CSS tự "tràn" ra ngoài biên hộp gốc
 *        (không hề bị `overflow` của CHÍNH nó chặn), đè mờ luôn viền `#app-stack` ngay sát cạnh.
 *        SỬA: tách 1 lớp phủ RIÊNG (b) ở TRÊN, `transform: scale(1.1)` (phóng to 110%, tâm giữ
 *        nguyên) + `filter: blur()` áp lên LỚP PHỦ ĐÓ — phần blur "tràn" ra do phóng to bị chính
 *        `overflow: hidden` của `#app-bg` (khung cha, KHÔNG blur) cắt gọn lại đúng khung
 *        `#app-stack`, viền lại NÉT như cũ.
 *        SỬA TIẾP (13/08/2026, Giang chỉ ra "scale 1.1 áp dụng với cái DOM ĐƯỢC BLUR chứ không phải
 *        cả DOM bg image") — bản 12/08 lỡ GỘP CHUNG 2 vai trò "ảnh thật" + "lớp bị blur" vào ĐÚNG 1
 *        phần tử `#app-bg-blur-layer` (tự nó vừa mang `background-image` vừa nhận scale/blur) — vi
 *        phạm đúng yêu cầu GỐC (bug report đầu tiên) "thêm MỘT LỚP PHỦ LÊN TRƯỚC [ảnh gốc]" (tức
 *        phải có 2 phần tử tách biệt). SỬA ĐÚNG: tách hẳn (a) `#app-bg-image` (ảnh gốc, KHÔNG BAO
 *        GIỜ đụng scale/blur) RA KHỎI (b) `#app-bg-blur-layer` (lớp phủ ĐÈ LÊN TRÊN, MỚI nhận
 *        scale/blur) — như mô tả ở trên.
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
        <div id="app-bg" class="bg-black pointer-events-none overflow-hidden">
            <div id="app-bg-image" class="bg-cover bg-center bg-no-repeat"></div>
            <div id="app-bg-blur-layer" class="bg-cover bg-center bg-no-repeat"></div>
        </div>
        <div id="side-left-container">
`;

const TPL_APP_VIEW_STACK_CLOSE = `
        </div>
    </div>
`;
