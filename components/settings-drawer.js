/**
 * Component: Settings Drawer (ngăn kéo cài đặt hệ thống toàn màn hình) — BỘ ĐIỀU PHỐI, viết
 * theo DẠNG OBJECT-FUNCTION (cùng tinh thần với PlaylistMain ở js/playlist/main.js).
 *
 * Ver 8: file này (vốn ~28KB HTML dồn hết vào 1 biến TPL_SETTINGS_DRAWER) được tách thành 5
 * "section" nhỏ hơn trong thư mục js/components/settings/ — mỗi file chỉ định nghĩa ĐÚNG 1
 * biến TPL_SETTINGS_* chứa HTML của riêng section đó, không có logic gì khác:
 *
 *   - settings/playlist-background.js       -> TPL_SETTINGS_PLAYLIST_BG     (Danh sách phát & Nền)
 *   - settings/visualizer-geometry-color.js -> TPL_SETTINGS_VISUALIZER      (Hình học + Màu sắc Visualizer)
 *   - settings/audio-eq.js                  -> TPL_SETTINGS_AUDIO_EQ        (Âm thanh & Equalizer)
 *   - settings/subtitle-style.js            -> TPL_SETTINGS_SUBTITLE_STYLE  (Khung & Chữ Phụ đề)
 *   - settings/misc.js                      -> TPL_SETTINGS_MISC            (Khác)
 *
 * Batch i18n: thêm section thứ 6 — settings/language.js -> TPL_SETTINGS_LANGUAGE (Ngôn
 * ngữ). Đặt SAU CÙNG (sau "Khác") vì là tính năng mới thêm, không xáo trộn vị trí 5 section gốc.
 *
 * Ver 12 "Multi Media" (CHỐT 03/07/2026, xem plan-v12-multimedia-decisions.md mục 1a/7): thêm
 * section thứ 7 — settings/file-manager-section.js -> TPL_SETTINGS_FILE_MANAGER (3 hàng Song/
 * Photo & Album/Documents, push thẳng sang drawer con — KHÔNG phải overlay cấp cao riêng như patch
 * 02/07/2026 trước đó). Đặt ngay sau "Hệ thống & Playlist" (liên quan trực tiếp thư viện nhạc).
 *
 * File này (settings-drawer.js) KHÔNG còn chứa HTML trực tiếp — nó chỉ còn vai trò "lắp ráp":
 * object `SettingsDrawer.build()` nối khung ngoài (header + nút đóng + wrapper scroll) với 7
 * biến TPL_SETTINGS_* trên theo ĐÚNG thứ tự xuất hiện gốc, rồi gán kết quả vào biến toàn cục
 * `TPL_SETTINGS_DRAWER` — GIỮ NGUYÊN TÊN BIẾN này vì main.js (bootstrap) ghép thẳng
 * `TPL_SETTINGS_DRAWER` vào innerHTML của #app-root, không hề biết (và không cần biết) gì về
 * việc nó được build từ 7 mảnh nhỏ hơn.
 *
 * THỨ TỰ NẠP SCRIPT — quan trọng: 7 file trong settings/ PHẢI nạp TRƯỚC file này trong
 * index.html (các biến TPL_SETTINGS_* phải tồn tại trước khi SettingsDrawer.build() chạy).
 * SettingsDrawer.build() được gọi NGAY ở cuối file này (đồng bộ) — không phải lúc
 * DOMContentLoaded — vì main.js cần TPL_SETTINGS_DRAWER đã là string hoàn chỉnh ngay khi nó
 * chạy (main.js nạp ngay sau toàn bộ components/*.js, xem index.html).
 */
        const SettingsDrawer = {

            /** Khung ngoài: header "Cài đặt Hệ thống" + nút đóng + phần mở khối scroll. */
            renderHeader() {
                return `
    <div id="drawer-settings" class="fixed inset-0 drawer-glass z-[80] transform -translate-y-full transition-transform duration-500 ease-in-out flex flex-col">
        <div class="flex justify-between items-center px-4 py-3 sm:px-6 border-b border-white/10 shrink-0 bg-black/40">
            <h2 class="text-base sm:text-lg font-bold tracking-wider text-white uppercase" data-i18n="settingsDrawer.title">${t('settingsDrawer.title')}</h2>
            <button id="close-drawer" class="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-rose-500 transition-colors text-white"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        `;
            },

            /** Đóng khối scroll + đóng thẻ drawer ngoài cùng. */
            renderFooter() {
                return `
    </div>`;
            },

            /**
             * Nối khung ngoài + 6 section con theo ĐÚNG thứ tự gốc (Danh sách phát & Nền ->
             * Visualizer -> Audio EQ -> Phụ đề -> Khác -> Ngôn ngữ [mới]). Mỗi section đã tự có
             * thẻ <div> bao ngoài + comment <!-- SECTION: ... --> riêng (xem các file trong
             * settings/), nên ở đây chỉ cần nối chuỗi, không xử lý gì thêm.
             */
            build() {
                return (
                    this.renderHeader() +
                    `
        <div class="flex-grow overflow-y-auto px-4 py-6 sm:px-8 pb-20">
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

