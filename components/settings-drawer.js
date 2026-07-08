/**
 * Component: Settings Drawer (ngăn kéo cài đặt hệ thống toàn màn hình) — BỘ ĐIỀU PHỐI, viết
 * theo DẠNG OBJECT-FUNCTION (cùng tinh thần với PlaylistMain ở js/playlist/main.js).
 *
 * === Batch D1 (Settings restructure, 06/07/2026 — "làm lại luôn Setting đi") ===
 * SỬA GỐC thiết kế cũ: TRƯỚC ĐÂY 9 "drawer con" là 9 `<div fixed inset-0 drawer-glass z-[N]>`
 * SIBLING riêng biệt, phân biệt nhau CHỈ bằng số z-index. TỪ BATCH NÀY: `#drawer-settings` là
 * DUY NHẤT `fixed inset-0` thật — mọi panel con sống BÊN TRONG nó qua NGĂN XẾP (core/settings-
 * panel-stack.js).
 *
 * === VIẾT LẠI (06/07/2026, phản hồi Giang sau khi xem UI thật — sửa lại thiết kế Batch D1) ===
 * Header DÙNG CHUNG (1 khối ngoài panel, đổi text tức thì lúc push/pop) ĐÃ BỎ — Giang chỉ ra lệch
 * nhịp với animation kéo panel, UX kém. Header giờ NHÉT VÀO TỪNG PANEL (kể cả Main) — trượt CÙNG
 * NHỊP với nội dung panel đó, xem core/settings-panel-stack.js (docstring đầu file, phần "THIẾT KẾ
 * MỚI — SLIDER THẬT").
 *
 * === VIẾT LẠI TIẾP (07/07/2026, phản hồi Giang mục 2 — gộp Playlist+Settings chung 1 container) ===
 * `#drawer-settings` KHÔNG còn `fixed inset-0`/nền riêng (`#settings-bg` ĐÃ XOÁ) — giờ chỉ là 1
 * "trang" cuộn ngang bên trong `#side-left-container` (components/app-view-stack.js, MỚI), dùng
 * CHUNG `#playlist-bg` với Playlist thật sự (đúng nghĩa "1 ảnh nền, 1 container", không phải 2
 * hàm/2 phần tử riêng áp y hệt nhau như batch "nền chung" 07/07/2026 làm tạm trước đó — xem
 * core/player-controls.js::scrollSideLeftToSettingsSmooth()/scrollSideLeftToPlaylistSmooth()
 * dùng `scrollTo()` thay `classList` cũ (VIẾT LẠI 08/07/2026, HOTFIX 8 — trước đó tên
 * openSettingsDrawer()/closeSettingsDrawer()).
 *
 * Cấu trúc MỚI của `#drawer-settings` — CHỈ 1 con trực tiếp (đúng yêu cầu "chỉ giữ lại body
 * stack"): `#settings-stack-body` — khung neo (`relative overflow-hidden`) mà push/pop thao tác —
 * chứa `#settings-stack-panel-main` (Main, TĨNH, KHÔNG BAO GIỜ bị push/pop hay xoá — đáy ngăn xếp)
 * TỰ MANG header riêng (title + nút Close X, KHÁC panel con — panel con dùng nút Back, xem
 * core/settings-panel-stack.js::_buildPanelInnerHtml()) + body gồm 8 section TPL_SETTINGS_* (TÁI
 * TỔ CHỨC 07/07/2026, phản hồi Giang mục 2/4 — xem ngay dưới).
 *
 * === Tái tổ chức section (07/07/2026, phản hồi Giang) ===
 * Mục 4 — section cũ "Playlist & Background" (1 file, gộp lẫn 2 chủ đề) TÁCH làm 2:
 * `TPL_SETTINGS_PLAYLIST_VIEW` (components/settings/playlist-view.js — Kiểu xem/Sắp xếp) +
 * section "Background" (components/settings/playlist-background.js, TPL_SETTINGS_BACKGROUND —
 * Video/Ảnh nền Visual/Ảnh nền Playlist/Độ mờ).
 * Mục 3 (07/07/2026, MỞ ĐẦU THEME THẬT) — section "Background" ĐỔI HẲN thành section "Theme"
 * (`TPL_SETTINGS_THEME`, components/settings/theme.js) — 3 card LOẠI TRỪ NHAU Sáng/Tối/Background,
 * "Background" TÁI DÙNG nguyên hệ thống bgImage/bgBlur cũ (Video nền + Ảnh nền Visual dời hẳn
 * sang section Visualizer — xem components/settings/visualizer-geometry-color.js). File
 * `components/settings/playlist-background.js` (TPL_SETTINGS_BACKGROUND) KHÔNG còn mount ở đây —
 * ĐỂ LẠI không xoá (tư liệu đối chiếu, giống components/storage-drawer.js cũ).
 * Mục 2 — thứ tự 8 section SẮP LẠI theo nghiên cứu UX settings mobile (mục dùng thường xuyên lên
 * đầu, mục "quản trị/nguy hiểm" — khởi động lại, khôi phục mặc định, thông tin app — xuống CUỐI
 * CÙNG, đúng quy ước phổ biến): Playlist -> Theme -> Visualizer -> Audio & EQ -> Subtitle ->
 * File Manager -> Language -> Misc (TRƯỚC ĐÂY: Playlist & Background -> File Manager ->
 * Visualizer -> Audio & EQ -> Subtitle -> Misc -> Language).
 *
 * THỨ TỰ NẠP SCRIPT — 8 file trong settings/ PHẢI nạp TRƯỚC file này (playlist-view.js/theme.js
 * MỚI THÊM — theme.js THAY playlist-background.js trong danh sách nạp thật, xem index.html).
 * core/settings-panel-stack.js PHẢI nạp SAU core/dom-refs.js (cần settingsStackBody,
 * settingsStackPanelMain) — xem index.html. `closeDrawer`/`settingsStackBody`/
 * `settingsStackPanelMain` (dom-refs.js) vẫn cần — `settingsStackTitle`/`btnSettingsStackBack` CŨ
 * ĐÃ XOÁ (không còn tồn tại tĩnh, mỗi panel tự có nút Back riêng qua class `.settings-panel-back-
 * btn`, xem event/listener/settings-stack-nav.js).
 */
        const SettingsDrawer = {

            /** Khung ngoài: CHỈ mở thẻ #settings-stack-body — KHÔNG còn header dùng chung (đã nhét
             * vào từng panel), KHÔNG còn tự định vị/nền riêng (07/07/2026: #drawer-settings giờ là
             * 1 "trang" bên trong #side-left-container, dùng CHUNG #playlist-bg với Playlist —
             * xem components/app-view-stack.js + docstring đầu file). */
            renderHeader() {
                return `
    <div id="drawer-settings" class="flex flex-col">
        <div id="settings-stack-body" class="relative z-10 flex-grow overflow-hidden">
        `;
            },

            /** Đóng thẻ #settings-stack-body + đóng thẻ drawer ngoài cùng. */
            renderFooter() {
                return `
        </div>
    </div>`;
            },

            /**
             * Panel Main (đáy ngăn xếp, TĨNH — KHÔNG BAO GIỜ bị `.remove()`) — TỰ MANG header
             * riêng (title + nút Close X) NGAY TRONG THÂN panel, giống mọi panel con (xem
             * core/settings-panel-stack.js::_buildPanelInnerHtml()) nhưng KHÁC ở chỗ dùng nút
             * Close (đóng hẳn Settings) thay vì Back (lùi 1 cấp) — Main là đáy, không có gì để
             * lùi về. `style="transition: left ...ms"` gắn INLINE ngay từ đầu (không đợi JS gán
             * lúc push đầu tiên) — cần sẵn để lần push ĐẦU TIÊN trượt Main sang trái mượt mà, khớp
             * đúng SETTINGS_STACK_TRANSITION_MS ở core/settings-panel-stack.js.
             */
            renderMainPanel() {
                return `
            <div id="settings-stack-panel-main" class="settings-stack-panel absolute top-0 left-0 w-full h-full flex flex-col" style="transition: left 500ms ease-in-out;">
                <div class="relative flex items-center justify-center px-14 py-3 sm:px-16 h-14 shrink-0">
                    <h2 class="text-base sm:text-lg font-semibold text-white truncate text-center" data-i18n="settingsDrawer.title">${t('settingsDrawer.title')}</h2>
                    <button id="close-drawer" class="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-rose-500 transition-colors text-white shrink-0"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
                <div class="flex-grow overflow-y-auto px-4 py-4 sm:px-8 pb-20">
                    <div class="max-w-2xl mx-auto space-y-5">
                        ` +
                    TPL_SETTINGS_PLAYLIST_VIEW +
                    TPL_SETTINGS_THEME +
                    TPL_SETTINGS_VISUALIZER +
                    TPL_SETTINGS_AUDIO_EQ +
                    TPL_SETTINGS_SUBTITLE_STYLE +
                    TPL_SETTINGS_FILE_MANAGER +
                    TPL_SETTINGS_LANGUAGE +
                    TPL_SETTINGS_MISC +
                    `
                    </div>
                </div>
            </div>
        `;
            },

            /** Nối khung ngoài + panel Main + đóng khung — 3 mảnh GHÉP THẲNG, không có gì khác
             * chen giữa (đúng yêu cầu "chỉ giữ lại body stack"). */
            build() {
                return this.renderHeader() + this.renderMainPanel() + this.renderFooter();
            }
        };

        // Biến toàn cục mà main.js (bootstrap) ghép vào #app-root — GIỮ NGUYÊN TÊN so với mọi
        // bản trước, để main.js không cần sửa gì khi file này được tách lại theo kiến trúc mới.
        const TPL_SETTINGS_DRAWER = SettingsDrawer.build();
