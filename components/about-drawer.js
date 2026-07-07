/**
 * Component: About panel (thống kê, giới thiệu, cảnh báo IndexedDB) — nội dung của "Về trình
 * phát" trong Settings.
 *
 * === Batch D1 (Settings restructure, phản hồi Giang 06/07/2026) ===
 * TRƯỚC ĐÂY đây là 1 biến `TPL_ABOUT_DRAWER` (chuỗi HTML tĩnh, tự có khung `fixed inset-0
 * drawer-glass z-[90]` + header riêng, mount 1 LẦN lúc boot qua main.js). GIỜ ĐÂY về BẢN CHẤT
 * chỉ còn là NỘI DUNG BODY của 1 panel — khung ngoài + header (Back/title) đã chuyển về DÙNG
 * CHUNG ở `#drawer-settings` (xem components/settings-drawer.js + core/settings-panel-stack.js).
 * Đổi từ 1 CONST HTML dựng 1 lần lúc boot sang 1 HÀM `renderAboutPanelBody()` gọi MỖI LẦN About
 * được mở (event/workflow/settings-misc.js::openAbout() gọi hàm này rồi `pushSettingsPanel()`) —
 * lợi ích PHỤ (không phải mục tiêu chính): `t()` bên trong giờ LUÔN lấy đúng ngôn ngữ HIỆN TẠI
 * mỗi lần mở, không còn bị "đông cứng" theo ngôn ngữ lúc boot như mọi TPL_* tĩnh khác.
 *
 * KHÔNG còn `id="drawer-about"`/`fixed inset-0`/header riêng — 3 id thống kê
 * (`stat-about-total-songs`/`-total-duration`/`-listen-seconds`) GIỮ NGUYÊN tên, nhưng KHÔNG còn
 * là DOM tĩnh trong dom-refs.js nữa (panel bị `.remove()` khỏi DOM mỗi lần đóng — xem
 * core/settings-panel-stack.js) — nơi gọi (`openAbout()`) tự `querySelector` bên TRONG panel vừa
 * push để điền giá trị, đúng quy ước Generic Drawer "component tĩnh + dom-refs, nội dung động thì
 * Workflow tự querySelector sau khi gán".
 */
function renderAboutPanelBody() {
    return `
                <!-- SECTION: THỐNG KÊ -->
                <div>
                    <h3 class="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 ml-2" data-i18n="aboutDrawer.statsSectionTitle">${t('aboutDrawer.statsSectionTitle')}</h3>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                        <div class="flex justify-between items-center p-4 border-b border-white/5">
                            <span class="text-sm font-medium text-slate-300" data-i18n="aboutDrawer.statTotalSongs">${t('aboutDrawer.statTotalSongs')}</span>
                            <span id="stat-about-total-songs" class="text-sm font-mono text-sky-300">—</span>
                        </div>
                        <div class="flex justify-between items-center p-4 border-b border-white/5">
                            <span class="text-sm font-medium text-slate-300" data-i18n="aboutDrawer.statTotalDuration">${t('aboutDrawer.statTotalDuration')}</span>
                            <span id="stat-about-total-duration" class="text-sm font-mono text-sky-300">—</span>
                        </div>
                        <div class="flex justify-between items-center p-4">
                            <span class="text-sm font-medium text-slate-300" data-i18n="aboutDrawer.statListenSeconds">${t('aboutDrawer.statListenSeconds')}</span>
                            <span id="stat-about-listen-seconds" class="text-sm font-mono text-sky-300">—</span>
                        </div>
                    </div>
                </div>

                <!-- SECTION: QUẢN LÝ DUNG LƯỢNG — DỜI sang File Manager -> Song (ver 12 "Multi
                     Media", plan-v12-multimedia.md mục 3 "Kéo ra thành mục riêng"). Mục này trước
                     đây mở #drawer-storage (đã ngừng mount, xem main.js) — bỏ hẳn khỏi About. -->

                <!-- SECTION: GIỚI THIỆU -->
                <div>
                    <h3 class="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2 ml-2" data-i18n="aboutDrawer.introSectionTitle">${t('aboutDrawer.introSectionTitle')}</h3>
                    <div class="glass-modal rounded-2xl p-4">
                        <p class="text-sm text-slate-300 leading-relaxed" data-i18n="aboutDrawer.introBody">
                            ${t('aboutDrawer.introBody')}
                        </p>
                    </div>
                </div>

                <!-- SECTION: CẢNH BÁO INDEXEDDB -->
                <div>
                    <h3 class="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2 ml-2" data-i18n="aboutDrawer.warningSectionTitle">${t('aboutDrawer.warningSectionTitle')}</h3>
                    <div class="bg-amber-500/5 rounded-2xl border border-amber-500/20 p-4 flex flex-col gap-3">
                        <p class="text-sm text-slate-300 leading-relaxed" data-i18n="aboutDrawer.warning.deviceBound">
                            ${t('aboutDrawer.warning.deviceBound')}
                        </p>
                        <p class="text-sm text-slate-300 leading-relaxed" data-i18n="aboutDrawer.warning.osCleanup">
                            ${t('aboutDrawer.warning.osCleanup')}
                        </p>
                        <p class="text-sm text-slate-300 leading-relaxed" data-i18n="aboutDrawer.warning.offline">
                            ${t('aboutDrawer.warning.offline')}
                        </p>
                        <p class="text-sm text-slate-300 leading-relaxed" data-i18n="aboutDrawer.warning.recommendation">
                            ${t('aboutDrawer.warning.recommendation')}
                        </p>
                    </div>
                </div>
`;
}
