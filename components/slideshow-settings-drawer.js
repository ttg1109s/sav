/**
 * Component: Slideshow Settings panel body ("Cài đặt nền Slideshow") — Batch 8 (03/07/2026), VIẾT
 * LẠI Batch 9 (04/07/2026, mục 4 phản hồi Giang):
 *   1. GỘP 2 section cũ ("Album" + "Cách chiếu") thành 1 section DUY NHẤT.
 *   2. Bỏ 2 nút "Chọn Album"/"Tắt" — thay bằng 1 cần gạt DUY NHẤT "#setting-slideshow-enable": gạt
 *      "On" TỰ mở panel chọn Album ngay (giống 3 toggle nền Video/Ảnh đã sửa ở mục 1 — cùng ngày);
 *      huỷ/đóng panel không chọn gì -> tự gạt về "off".
 *   3. VIẾT LẠI LẦN 2 (Giai đoạn 4, rewrite Photo/Album, mục 1, Giang yêu cầu "bỏ modal đi mà áp
 *      dụng gentic drawer") — panel chọn Album ĐỔI HẲN từ "notify center" tĩnh (mount sẵn lúc boot)
 *      sang Generic Drawer ĐỘNG (core/generic-drawer.js) — xem event/workflow/slideshow.js::
 *      openAlbumPicker(). File NÀY (component) không còn markup panel chọn Album nào cả.
 *
 * === Batch D4 (Settings restructure, tiếp D1/D2/D3) ===
 * TRƯỚC ĐÂY `TPL_SLIDESHOW_SETTINGS_DRAWER` gộp CẢ khung `fixed inset-0 drawer-glass z-[90]` LẪN
 * panel chọn Album (2 phần tử ĐỘC LẬP mount ở z-[130]/[131], không lồng trong khung trên — xem
 * comment gốc). Tách làm 2:
 *   - `renderSlideshowPanelBody()` — PUSH ĐỘNG vào Settings Stack (core/settings-panel-stack-ui.js),
 *     giống About/Subtitle/Visualizer.
 *   - Panel chọn Album — ĐÃ ĐỔI SANG Generic Drawer động (Giai đoạn 4, xem mục 3 ngay trên) —
 *     KHÔNG còn `TPL_SLIDESHOW_ALBUM_PICKER` mount tĩnh nào ở file này nữa.
 *
 * === v13 Batch C (plan-v13-visual-background-unification.md mục 2c) — THU GỌN ===
 * "NHÓM 1: ALBUM" (enable/mode/photoPerSong/interval) XOÁ HẲN — 4 input đó không còn ý nghĩa ở đây:
 * `enable` + chọn Album gộp vào panel cha "Visual Background", `mode`/`photoPerSong` thay bằng
 * `nextOrder`/`listPlaybackMode` cũng ở panel cha, riêng `intervalSeconds` DỜI xuống đứng ĐẦU nhóm
 * "Chuyển cảnh". Panel này giờ CHỈ còn 2 nhóm — thuần "chiếu ra sao", không còn "chiếu cái gì".
 *
 * (LỊCH SỬ) TÁI CẤU TRÚC THEO NHÓM (18/07/2026, phản hồi Giang — "thêm thời gian transition giữa 2 ảnh" +
 * "tái cấu trúc lại panel theo nhóm mục") — 10 input trước đây nằm CHUNG 1 danh sách dài, giờ chia
 * 3 NHÓM (`<h3>` + card riêng, CÙNG khuôn hình các section khác trong Settings — vd
 * components/settings/misc.js):
 *   1. "Album" — enable/mode/photoPerSong/interval (4 input) — CHỌN ẢNH NÀO/HIỂN THỊ BAO LÂU.
 *   2. "Chuyển cảnh" — transitionType/transitionDuration/transitionRatio (ẩn động nếu kiểu đang
 *      chọn không hỗ trợ, xem transitionSupportsInOutRatio() core)/transitionEasing (4 input) —
 *      HIỆU ỨNG CROSSFADE lúc đổi ảnh.
 *   3. "Ken Burns" — kenBurnsEnabled/kenBurnsMode (2 input) — HIỆU ỨNG PAN/ZOOM lúc đang hiện ảnh.
 *
 * Logic: event/workflow/slideshow.js (workflowSlideshow); listener/router: cụm "slideshowSettings"
 * (event/listener,router/slideshow.js).
 */
function renderSlideshowPanelBody() {
    return `
                <!-- ===================== NHÓM 1: CHUYỂN CẢNH ===================== -->
                <div>
                    <h3 class="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 ml-2" data-i18n="slideshowSettingsDrawer.groupTransition.title">${t('slideshowSettingsDrawer.groupTransition.title')}</h3>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">

                        <!-- DỜI VÀO ĐÂY (v13 Batch C, yêu cầu Giang "đem Seconds per photo vào mục
                             transition") — đứng ĐẦU nhóm, TRƯỚC transitionType: "ảnh hiện bao lâu"
                             là mốc mà mọi thời lượng chuyển cảnh bên dưới bị kẹp theo. Hàng này
                             LUÔN hiện (không còn ẩn theo photoPerSong — panel này chỉ mở được khi
                             đang ở chế độ Trình chiếu). -->
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <div>
                                <div class="text-sm font-medium" data-i18n="slideshowSettingsDrawer.interval.label">${t('slideshowSettingsDrawer.interval.label')}</div>
                                <div class="text-xs text-slate-400 mt-0.5" data-i18n="slideshowSettingsDrawer.interval.hint">${t('slideshowSettingsDrawer.interval.hint')}</div>
                            </div>
                            <button type="button" id="setting-slideshow-interval" class="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none w-20 text-right shrink-0 hover:bg-white/10 transition-colors">5s</button>
                        </div>
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <span class="text-sm font-medium" data-i18n="slideshowSettingsDrawer.transition.label">${t('slideshowSettingsDrawer.transition.label')}</span>
                            <select id="setting-slideshow-transition" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-40 text-right">
                                <option value="fade" data-i18n="slideshowSettingsDrawer.transition.fade">${t('slideshowSettingsDrawer.transition.fade')}</option>
                                <option value="slideLeft" data-i18n="slideshowSettingsDrawer.transition.slideLeft">${t('slideshowSettingsDrawer.transition.slideLeft')}</option>
                                <option value="slideRight" data-i18n="slideshowSettingsDrawer.transition.slideRight">${t('slideshowSettingsDrawer.transition.slideRight')}</option>
                                <option value="zoomIn" data-i18n="slideshowSettingsDrawer.transition.zoomIn">${t('slideshowSettingsDrawer.transition.zoomIn')}</option>
                                <option value="zoomOut" data-i18n="slideshowSettingsDrawer.transition.zoomOut">${t('slideshowSettingsDrawer.transition.zoomOut')}</option>
                                <option value="wipe" data-i18n="slideshowSettingsDrawer.transition.wipe">${t('slideshowSettingsDrawer.transition.wipe')}</option>
                                <option value="flip" data-i18n="slideshowSettingsDrawer.transition.flip">${t('slideshowSettingsDrawer.transition.flip')}</option>
                                <option value="blur" data-i18n="slideshowSettingsDrawer.transition.blur">${t('slideshowSettingsDrawer.transition.blur')}</option>
                                <option value="rotateFade" data-i18n="slideshowSettingsDrawer.transition.rotateFade">${t('slideshowSettingsDrawer.transition.rotateFade')}</option>
                                <option value="curtain" data-i18n="slideshowSettingsDrawer.transition.curtain">${t('slideshowSettingsDrawer.transition.curtain')}</option>
                                <option value="circleReveal" data-i18n="slideshowSettingsDrawer.transition.circleReveal">${t('slideshowSettingsDrawer.transition.circleReveal')}</option>
                                <option value="glitch" data-i18n="slideshowSettingsDrawer.transition.glitch">${t('slideshowSettingsDrawer.transition.glitch')}</option>
                            </select>
                        </div>
                        <!-- MỚI (18/07/2026, phản hồi Giang — "thêm thời gian transition giữa 2
                             ảnh") — nút mở modal chọn thời gian DÙNG CHUNG, format 's-ms' (giây +
                             phần mười giây — giữ độ chính xác dưới giây). "1.0s" chỉ là placeholder
                             chỉ là placeholder TĨNH — refreshDrawerUI() ghi đè giá trị thật. -->
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <div class="pr-3">
                                <div class="text-sm font-medium" data-i18n="slideshowSettingsDrawer.transitionDuration.label">${t('slideshowSettingsDrawer.transitionDuration.label')}</div>
                                <div class="text-xs text-slate-400 mt-0.5" data-i18n="slideshowSettingsDrawer.transitionDuration.hint">${t('slideshowSettingsDrawer.transitionDuration.hint')}</div>
                            </div>
                            <button type="button" id="setting-slideshow-transition-duration" class="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none w-20 text-right shrink-0 hover:bg-white/10 transition-colors">1.0s</button>
                        </div>
                        <!-- MỚI (18/07/2026) — ẨN ĐỘNG khi transitionType đang chọn KHÔNG hỗ trợ pha
                             "out" độc lập (wipe/curtain/circleReveal — xem transitionSupportsInOutRatio(),
                             core/file-manager/slideshow.js) — refreshDrawerUI()/changeTransitionType()
                             tự toggle class "hidden" trên chính row này. -->
                        <div id="slideshow-transition-ratio-row" class="p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-sm font-medium" data-i18n="slideshowSettingsDrawer.transitionRatio.label">${t('slideshowSettingsDrawer.transitionRatio.label')}</span>
                                <span id="slideshow-transition-ratio-label" class="text-xs text-slate-400 font-mono"></span>
                            </div>
                            <input type="range" id="setting-slideshow-transition-ratio" min="0" max="100" step="5" class="w-full accent-sky-500">
                        </div>
                        <div class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors">
                            <span class="text-sm font-medium" data-i18n="slideshowSettingsDrawer.transitionEasing.label">${t('slideshowSettingsDrawer.transitionEasing.label')}</span>
                            <select id="setting-slideshow-transition-easing" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-36 text-right">
                                <option value="linear" data-i18n="slideshowSettingsDrawer.transitionEasing.linear">${t('slideshowSettingsDrawer.transitionEasing.linear')}</option>
                                <option value="ease" data-i18n="slideshowSettingsDrawer.transitionEasing.ease">${t('slideshowSettingsDrawer.transitionEasing.ease')}</option>
                                <option value="ease-in" data-i18n="slideshowSettingsDrawer.transitionEasing.easeIn">${t('slideshowSettingsDrawer.transitionEasing.easeIn')}</option>
                                <option value="ease-out" data-i18n="slideshowSettingsDrawer.transitionEasing.easeOut">${t('slideshowSettingsDrawer.transitionEasing.easeOut')}</option>
                                <option value="ease-in-out" data-i18n="slideshowSettingsDrawer.transitionEasing.easeInOut">${t('slideshowSettingsDrawer.transitionEasing.easeInOut')}</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- ===================== NHÓM 2: KEN BURNS ===================== -->
                <div>
                    <h3 class="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 ml-2 mt-4" data-i18n="slideshowSettingsDrawer.groupKenBurns.title">${t('slideshowSettingsDrawer.groupKenBurns.title')}</h3>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                        <!-- MỚI (Ken Burns, 18/07/2026, phản hồi Giang) — toggle ĐỘC LẬP, TÁCH khỏi
                             select Transition (trước đây 'kenburns' là 1 option trong đó, chọn nó
                             là khoá cứng transition về fade — giờ Ken Burns dùng ĐƯỢC cùng lúc với
                             BẤT KỲ kiểu transition nào). Mặc định OFF. -->
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <div class="pr-3">
                                <div class="text-sm font-medium" data-i18n="slideshowSettingsDrawer.kenBurns.label">${t('slideshowSettingsDrawer.kenBurns.label')}</div>
                                <div class="text-xs text-slate-400 mt-0.5" data-i18n="slideshowSettingsDrawer.kenBurns.hint">${t('slideshowSettingsDrawer.kenBurns.hint')}</div>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="setting-slideshow-kenburns" class="sr-only peer">
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                            </label>
                        </div>
                        <!-- MỚI ("Nhóm 2", 18/07/2026, phản hồi Giang) — THAY HẲN "Nhóm 1" (8 biến
                             thể random tự động, không ai chọn được) bằng 13 chế độ CÓ TÊN, tự chọn.
                             Ẩn/hiện theo toggle Ken Burns ngay trên — CÙNG KHUÔN #slideshow-interval-row
                             ẩn/hiện theo photoPerSong (xem refreshDrawerUI()/changeKenBurnsEnabled()). -->
                        <div id="slideshow-kenburns-mode-row" class="flex justify-between items-center p-4">
                            <span class="text-sm font-medium" data-i18n="slideshowSettingsDrawer.kenBurnsMode.label">${t('slideshowSettingsDrawer.kenBurnsMode.label')}</span>
                            <select id="setting-slideshow-kenburns-mode" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-40 text-right">
                                <optgroup label="${t('slideshowSettingsDrawer.kenBurnsMode.groupPan')}">
                                    <option value="panLeft" data-i18n="slideshowSettingsDrawer.kenBurnsMode.panLeft">${t('slideshowSettingsDrawer.kenBurnsMode.panLeft')}</option>
                                    <option value="panRight" data-i18n="slideshowSettingsDrawer.kenBurnsMode.panRight">${t('slideshowSettingsDrawer.kenBurnsMode.panRight')}</option>
                                    <option value="panTop" data-i18n="slideshowSettingsDrawer.kenBurnsMode.panTop">${t('slideshowSettingsDrawer.kenBurnsMode.panTop')}</option>
                                    <option value="panBottom" data-i18n="slideshowSettingsDrawer.kenBurnsMode.panBottom">${t('slideshowSettingsDrawer.kenBurnsMode.panBottom')}</option>
                                    <option value="panRandom" data-i18n="slideshowSettingsDrawer.kenBurnsMode.panRandom">${t('slideshowSettingsDrawer.kenBurnsMode.panRandom')}</option>
                                </optgroup>
                                <optgroup label="${t('slideshowSettingsDrawer.kenBurnsMode.groupZoom')}">
                                    <option value="zoomIn" data-i18n="slideshowSettingsDrawer.kenBurnsMode.zoomIn">${t('slideshowSettingsDrawer.kenBurnsMode.zoomIn')}</option>
                                    <option value="zoomOut" data-i18n="slideshowSettingsDrawer.kenBurnsMode.zoomOut">${t('slideshowSettingsDrawer.kenBurnsMode.zoomOut')}</option>
                                    <option value="zoomRandom" data-i18n="slideshowSettingsDrawer.kenBurnsMode.zoomRandom">${t('slideshowSettingsDrawer.kenBurnsMode.zoomRandom')}</option>
                                </optgroup>
                                <optgroup label="${t('slideshowSettingsDrawer.kenBurnsMode.groupZoomPan')}">
                                    <option value="zoomPanLeft" data-i18n="slideshowSettingsDrawer.kenBurnsMode.zoomPanLeft">${t('slideshowSettingsDrawer.kenBurnsMode.zoomPanLeft')}</option>
                                    <option value="zoomPanRight" data-i18n="slideshowSettingsDrawer.kenBurnsMode.zoomPanRight">${t('slideshowSettingsDrawer.kenBurnsMode.zoomPanRight')}</option>
                                    <option value="zoomPanTop" data-i18n="slideshowSettingsDrawer.kenBurnsMode.zoomPanTop">${t('slideshowSettingsDrawer.kenBurnsMode.zoomPanTop')}</option>
                                    <option value="zoomPanBottom" data-i18n="slideshowSettingsDrawer.kenBurnsMode.zoomPanBottom">${t('slideshowSettingsDrawer.kenBurnsMode.zoomPanBottom')}</option>
                                    <option value="zoomPanRandom" data-i18n="slideshowSettingsDrawer.kenBurnsMode.zoomPanRandom">${t('slideshowSettingsDrawer.kenBurnsMode.zoomPanRandom')}</option>
                                </optgroup>
                            </select>
                        </div>
                    </div>
                </div>
`;
}

// ===================== ĐÃ GỠ (Giai đoạn 4, rewrite Photo/Album, mục 1) — Panel chọn Album kiểu
// "notify center" tĩnh =========================================================================
// `TPL_SLIDESHOW_ALBUM_PICKER` (bản trước ở đây, mount tĩnh 1 lần lúc boot) XOÁ HẲN — panel chọn
// Album giờ dùng Generic Drawer ĐỘNG (core/generic-drawer.js), dựng lúc cần qua
// event/workflow/slideshow.js::openAlbumPicker() — KHÔNG còn overlay/panel riêng mount sẵn nữa.
