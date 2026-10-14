/**
 * Component: App View Stack — khung bọc màn Playlist, ngang hàng với Visualizer (`#visualizer-ui`/`#player-container`).
 *
 *   `#app-stack` — giữ toàn bộ vị trí/responsive (mobile: trượt qua lại với Visualizer bằng `transform`, class
 *   `.playlist-hidden`; desktop: cột trái `width: clamp(...)` — assets/css/style.css). `display:flex; flex-direction:column`
 *   (assets/css/layout-nav.css), con theo thứ tự DOM (con sau vẽ đè con trước):
 *     1. `#app-bg` — khung nền, `overflow: hidden`, ANH EM với khung cuộn (không phải con) nên không bị cuộn kéo theo. Bên trong:
 *          a. `#app-bg-video` — video nền (ẩn mặc định), nằm dưới.
 *          b. `#app-bg-image` — ảnh/gradient nền, hoặc chỉ overlay đen khi nền là video.
 *        Cả 2 do core/color-utils.js::updatePlaylistBg() ghi; phát/dừng video: setAppBgVideoPlayback() (chỉ phát ở màn App
 *        Panel khi tab đang hiện — event/workflow/theme.js::syncBackgroundVideoPlayback()).
 *     2. `#side-left-container` — vùng nội dung, chỉ chứa `#playlist-view` (components/playlist-view.js). Settings mở qua
 *        Generic Drawer, không phải trang trong khung này.
 *     3. `#app-bottom-nav` (components/app-bottom-nav.js) — cố định đáy; chèn giữa `TPL_APP_VIEW_STACK_CLOSE_SIDE` và
 *        `TPL_APP_VIEW_STACK_CLOSE_OUTER` lúc components/app-mount.js ghép chuỗi.
 *
 * NẠP SAU: components/playlist-view.js (TPL_PLAYLIST_VIEW — nhét giữa `TPL_APP_VIEW_STACK_OPEN`/`TPL_APP_VIEW_STACK_CLOSE_SIDE`).
 */
const TPL_APP_VIEW_STACK_OPEN = `
    <div id="app-stack" class="fixed inset-0 z-[60]">
        <div id="app-bg" class="pointer-events-none overflow-hidden" data-uitk="appBaseBg">
            <!-- muted + playsinline bắt buộc để iOS cho phát nền -->
            <video id="app-bg-video" muted loop playsinline preload="auto" disablepictureinpicture disableremoteplayback style="display:none;"></video>
            <div id="app-bg-image" class="bg-cover bg-center bg-no-repeat"></div>
        </div>
        <div id="side-left-container">
`;

/** Đóng `#side-left-container`; `#app-bottom-nav` chèn sau (anh em, cố định đáy `#app-stack`), rồi `TPL_APP_VIEW_STACK_CLOSE_OUTER`. */
const TPL_APP_VIEW_STACK_CLOSE_SIDE = `
        </div>
`;

const TPL_APP_VIEW_STACK_CLOSE_OUTER = `
    </div>
`;
