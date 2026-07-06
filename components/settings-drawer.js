/**
 * Component: Settings Drawer (ngăn kéo cài đặt hệ thống toàn màn hình) — BỘ ĐIỀU PHỐI, viết
 * theo DẠNG OBJECT-FUNCTION (cùng tinh thần với PlaylistMain ở js/playlist/main.js).
 *
 * === Batch D1 (Settings restructure, phản hồi Giang 06/07/2026 — "làm lại luôn Setting đi") ===
 * SỬA GỐC thiết kế cũ: TRƯỚC ĐÂY 9 "drawer con" (About/Visualizer/Slideshow/Subtitle/Storage/File
 * Manager Song-Photo-Document-FolderDetail) là 9 `<div fixed inset-0 drawer-glass z-[N]>` SIBLING
 * riêng biệt, phân biệt nhau CHỈ bằng số z-index — đây là sai lầm thiết kế Giang chỉ ra (mỗi drawer
 * mới thêm phải tự copy khung + tự chọn z-index không đụng hàng, không có nơi áp dụng chung như
 * "nền chung"). TỪ BATCH NÀY: `#drawer-settings` là DUY NHẤT `fixed inset-0` thật — mọi panel con
 * (About di chuyển ở batch này; Visualizer/Slideshow/.../File Manager sẽ dời dần ở D2-D4, XEM
 * plan-v12-batch-list.md) sống BÊN TRONG nó qua NGĂN XẾP (core/settings-panel-stack.js).
 *
 * Cấu trúc MỚI của `#drawer-settings`:
 *   1. `#settings-bg` — nền chung (mục "hợp nhất nền Playlist" phản hồi Giang) — ĐÃ dựng element,
 *      CHƯA nối logic áp ảnh/blur ở Batch D1 (việc đó cần refactor Rule 0.5 riêng cho 4 hàm core
 *      cũ đang gọi updatePlaylistBg() — xem báo cáo cuối Batch D1, dự kiến làm ở bước kế tiếp).
 *   2. Header DÙNG CHUNG cho MỌI panel — `#settings-stack-title` (đổi text mỗi lần push/pop) +
 *      `#btn-settings-stack-back` (ẩn mặc định, chỉ hiện khi đang ở panel con — xem
 *      core/settings-panel-stack.js) + `#close-drawer` (X, giữ NGUYÊN id/hành vi cũ — chỉ hiện ở
 *      Main, tự ẩn khi vào panel con, xem push/popSettingsPanel()).
 *   3. `#settings-stack-body` — khung neo (`relative overflow-hidden`) mà push/pop thao tác —
 *      chứa `#settings-stack-panel-main` (Main, TĨNH, KHÔNG BAO GIỜ bị push/pop hay xoá — đây là
 *      đáy ngăn xếp) gồm 7 section TPL_SETTINGS_* CŨ, giữ NGUYÊN thứ tự/nội dung như trước.
 *
 * THỨ TỰ NẠP SCRIPT — không đổi so với trước: 7 file trong settings/ PHẢI nạp TRƯỚC file này.
 * MỚI (Batch D1): core/settings-panel-stack.js PHẢI nạp SAU core/dom-refs.js (cần
 * settingsStackTitle/btnSettingsStackBack/settingsStackBody/closeDrawer) — xem index.html.
 */
        const SettingsDrawer = {

            /** Khung ngoài: nền chung + header dùng chung (title + Back/Close) — KHÔNG còn header
             * riêng cho từng panel con (đã gộp về đây, xem docstring đầu file). */
            renderHeader() {
                return `
    <div id="drawer-settings" class="fixed inset-0 drawer-glass z-[80] transform -translate-y-full transition-transform duration-500 ease-in-out flex flex-col">
        <div id="settings-bg" class="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none" style="filter: blur(0px);"></div>
        <div class="relative z-10 flex justify-between items-center px-4 py-3 sm:px-6 border-b border-white/10 shrink-0 bg-black/40">
            <div class="flex items-center gap-2">
                <button id="btn-settings-stack-back" class="hidden w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white" data-i18n-title="settingsDrawer.back.title" title="${t('settingsDrawer.back.title')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h2 id="settings-stack-title" class="text-base sm:text-lg font-bold tracking-wider text-white uppercase" data-i18n="settingsDrawer.title">${t('settingsDrawer.title')}</h2>
            </div>
            <button id="close-drawer" class="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-rose-500 transition-colors text-white"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        `;
            },

            /** Đóng khung stack body + đóng thẻ drawer ngoài cùng. */
            renderFooter() {
                return `
        </div>
    </div>`;
            },

            /**
             * Nối khung ngoài + panel Main (7 section TPL_SETTINGS_* CŨ, GIỮ NGUYÊN thứ tự/nội
             * dung — chỉ đổi nơi chứa từ "div scroll trực tiếp trong drawer" sang "panel tĩnh đáy
             * ngăn xếp", xem docstring đầu file). `#settings-stack-panel-main` dùng CHUNG class
             * định vị `settings-stack-panel` với panel PUSH (core/settings-panel-stack.js) để nằm
             * đúng 1 hệ toạ độ — khác biệt DUY NHẤT: Main không có `left`/`transition` inline (luôn
             * đứng yên `left: 0`, KHÔNG BAO GIỜ bị `.remove()`).
             */
            build() {
                return (
                    this.renderHeader() +
                    `
        <div id="settings-stack-body" class="relative z-10 flex-grow overflow-hidden">
            <div id="settings-stack-panel-main" class="settings-stack-panel absolute top-0 left-0 w-full h-full overflow-y-auto px-4 py-6 sm:px-8 pb-20">
                <div class="max-w-2xl mx-auto space-y-8">
                    ` +
                    TPL_SETTINGS_PLAYLIST_BG +
                    TPL_SETTINGS_FILE_MANAGER +
                    TPL_SETTINGS_VISUALIZER +
                    TPL_SETTINGS_AUDIO_EQ +
                    TPL_SETTINGS_SUBTITLE_STYLE +
                    TPL_SETTINGS_MISC +
                    TPL_SETTINGS_LANGUAGE +
                    `
                </div>
            </div>
        ` +
                    this.renderFooter()
                );
            }
        };

        // Biến toàn cục mà main.js (bootstrap) ghép vào #app-root — GIỮ NGUYÊN TÊN so với mọi
        // bản trước, để main.js không cần sửa gì khi file này được tách lại theo kiến trúc mới.
        const TPL_SETTINGS_DRAWER = SettingsDrawer.build();

