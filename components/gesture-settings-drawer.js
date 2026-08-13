/**
 * Component: panel body Settings "Cử chỉ" (components/visualizer-settings-drawer.js mở qua
 * #setting-open-gesture-settings — SỬA 12/08/2026, Giang yêu cầu mục 4h: nút này DỜI từ Main
 * (components/settings/visualizer-geometry-color.js) VÀO panel "Customize Visualizer", xem
 * docstring event/listener/gesture-settings.js). CHIA 5 section:
 *   0. Action (MỚI 12/08/2026, Giang yêu cầu) — 3 "Slot" CỐ ĐỊNH (KHÔNG có nút "+" — giới hạn CỨNG
 *      = 3, xem docstring vizConfig.gestureActionSlot1 core/config.js), mỗi Slot 1 dropdown gán 1
 *      nút Control Center bất kỳ (pool controlCenterTargetOptions, key khớp
 *      GESTURE_TRIPLE_TAP_TARGET_ELS, event/workflow/visualizer-gesture.js) — rồi Slot đó XUẤT
 *      HIỆN như 1 lựa chọn thêm ở CẢ 7 dropdown action picker bên dưới (section 1 "Điều hướng" +
 *      section 2 "Tap", xem actionOptions) — cho phép vuốt/tap/tap-3-lần TRỎ TỚI bất kỳ nút Control
 *      Center nào, không chỉ 4 hành động media cơ bản.
 *      SỬA (12/08/2026, Giang yêu cầu "tránh nhãn Action X mà vẫn hiểu ý định") — 3 hàng đổi tên
 *      "Action 1/2/3" -> "Slot 1/2/3" (gestureSettings.action.actionSlot1/2/3, lang) — "Action" lặp
 *      lại vô nghĩa với chính tiêu đề section "Actions" ngay phía trên, không tự nói được BẢN CHẤT
 *      (đây là 1 "ngăn chứa" 1 nút Control Center, KHÔNG phải bản thân 1 hành động) — thêm 1 dòng
 *      hint dưới tiêu đề section (gestureSettings.sectionActions.hint) giải thích CHỨC NĂNG thay vì
 *      cố nhồi hết vào tên 3 hàng: "Gán 1 nút Control Center cho mỗi Slot, rồi chọn Slot đó ở bất kỳ
 *      cử chỉ nào bên dưới".
 *   1. Điều hướng — 4 dropdown action picker (vuốt lên/xuống/trái/phải).
 *   2. Tap — 3 dropdown action picker Y HỆT NHAU (tap đơn/đúp/BA — SỬA 12/08/2026, Giang yêu cầu
 *      "tap 3 dùng chung select giống tap/cử chỉ khác": tap 3 lần TRƯỚC ĐÂY tách riêng, chọn THẲNG
 *      1 nút Control Center qua controlCenterTargetOptions, khác hẳn tap đơn/đúp — nay dùng CHUNG
 *      actionOptions + actionRow(), KHÔNG còn khối hint 2 dòng riêng — muốn tap 3 lần bấm thẳng 1
 *      nút thì gán nút đó cho 1 Action slot ở section 0 rồi chọn slot đó ở đây, CÙNG cách 6 dropdown
 *      kia đã luôn làm). Vuốt cạnh dưới đã bỏ hẳn, thay bằng tap 3 lần.
 *   3. Seek — giữ tay ở nửa trái/phải màn hình để tua lùi/tiến lặp lại (event/workflow/
 *      visualizer-gesture.js) — toggle bật/tắt + 2 hàng mở time-picker RIÊNG (3 khái niệm thời
 *      gian TÁCH BIỆT HOÀN TOÀN — xem docstring event/workflow/visualizer-gesture.js):
 *        - Ngưỡng kích hoạt (2s): CỐ ĐỊNH, không hiện trong panel này.
 *        - "Bước tua" (Time 1, gestureSeekStepMs): đơn vị nhảy mỗi lần seek.
 *        - "Giữ để tua tiếp" (Time 2, gestureSeekHoldIntervalMs): sau khi đã vào seek mode, giữ
 *          thêm bao lâu thì kích hoạt 1 lệnh seek theo Time 1 — lặp lại liên tục.
 *   4. Vuốt cạnh — CHỈ còn rìa TRÊN (mở Control Center) — rìa DƯỚI đã bỏ hẳn, thay bằng tap 3 lần
 *      ở section Tap. KHÔNG có Action (Giang chốt rõ: "trừ seak và vuốt xuống từ rìa trên").
 *
 * 7 dropdown action picker (section 1+2, TẤT CẢ — kể cả tap 3 lần từ 12/08/2026) CÙNG 1 pool DÙNG
 * CHUNG (event/workflow/visualizer-gesture.js): 5 hành động cố định trong GESTURE_ACTIONS (Tiếp
 * theo/Trước đó/Play-Pause/Mở Playlist/Không dùng) + 3 Action slot (actionSlot1/2/3, tra
 * GESTURE_ACTION_SLOT_CONFIG_FIELD). Dropdown gán nút Control Center trực tiếp (CHỈ còn 3 Slot ở
 * section Action) DÙNG 1 pool 7 nút KHÁC (controlCenterTargetOptions, KHÔNG lẫn với pool 5+3 ở
 * trên — 2 tầng lựa chọn khác nhau: "chọn 1 trong 7 nút" vs "chọn 1 trong 5+3 hành động").
 */
function renderGestureSettingsPanelBody() {
    // FIX (12/08/2026, Giang yêu cầu "Action") — thêm 3 <option> actionSlot1/2/3 NGOÀI 5 lựa chọn
    // mặc định cũ — CHỈ áp dụng cho 7 dropdown vuốt/tap (KHÔNG áp dụng controlCenterTargetOptions,
    // pool ĐÓ đã tự chọn thẳng 1 nút Control Center rồi, thêm Action vào đó là vòng lặp vô nghĩa).
    const actionOptions = `
        <option value="next" data-i18n="gestureSettings.action.next">${t('gestureSettings.action.next')}</option>
        <option value="prev" data-i18n="gestureSettings.action.prev">${t('gestureSettings.action.prev')}</option>
        <option value="playPause" data-i18n="gestureSettings.action.playPause">${t('gestureSettings.action.playPause')}</option>
        <option value="openPlaylist" data-i18n="gestureSettings.action.openPlaylist">${t('gestureSettings.action.openPlaylist')}</option>
        <option value="actionSlot1" data-i18n="gestureSettings.action.actionSlot1">${t('gestureSettings.action.actionSlot1')}</option>
        <option value="actionSlot2" data-i18n="gestureSettings.action.actionSlot2">${t('gestureSettings.action.actionSlot2')}</option>
        <option value="actionSlot3" data-i18n="gestureSettings.action.actionSlot3">${t('gestureSettings.action.actionSlot3')}</option>
        <option value="none" data-i18n="gestureSettings.action.none">${t('gestureSettings.action.none')}</option>
    `;
    const actionRow = (id, labelKey, lastInGroup) => `
        <div class="flex justify-between items-center p-4${lastInGroup ? '' : ' border-b border-white/5'}">
            <span class="text-sm font-medium" data-i18n="${labelKey}">${t(labelKey)}</span>
            <select id="${id}" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-32 text-right">${actionOptions}</select>
        </div>
    `;
    const sectionTitle = (labelKey, colorClass) => `<h3 class="text-xs font-bold ${colorClass} uppercase tracking-widest mb-2 ml-2" data-i18n="${labelKey}">${t(labelKey)}</h3>`;
    // MỚI (12/08/2026, Giang yêu cầu "tránh nhãn Action X mà vẫn hiểu ý định") — dòng hint NGAY
    // DƯỚI 1 tiêu đề section, CÙNG style .text-xs.text-slate-400 với hint trong row (Seek/Vuốt
    // cạnh) — giải thích chức năng 3 Slot ở ĐÚNG 1 chỗ, khỏi phải nhồi vào tên từng hàng.
    const sectionTitleWithHint = (labelKey, colorClass, hintKey) => `
        ${sectionTitle(labelKey, colorClass)}
        <p class="text-xs text-slate-400 -mt-1.5 mb-2 ml-2" data-i18n="${hintKey}">${t(hintKey)}</p>
    `;
    // FIX (12/08/2026) — bổ sung 3 <option> CÒN THIẾU so với TOÀN BỘ nút Control Center thật sự có
    // (openVolume/cycleEq/editEq — xem GESTURE_TRIPLE_TAP_TARGET_ELS, event/workflow/
    // visualizer-gesture.js), DÙNG cho 3 dropdown section Action (Slot 1/2/3) — TRƯỚC ĐÂY còn dùng
    // chung cho dropdown Tap 3 lần, xem SỬA TIẾP ngay dưới.
    // SỬA TIẾP (cùng ngày, "gộp eq edit vào hold 3s, bỏ icon edit riêng") — <option value="editEq">
    // ĐÃ BỎ cùng lúc xoá hẳn #btn-edit-eq (còn lại đúng 7 option, không phải 8) — mở Edit EQ giờ
    // gộp vào GIỮ 1.5s trên chính `cycleEq`, không còn là 1 "nút bấm hộ được" riêng để gán gesture
    // nữa (xem docstring GESTURE_TRIPLE_TAP_TARGET_ELS, event/workflow/visualizer-gesture.js).
    // Nhãn option `cycleEq` đổi sang key `.label` (MỚI, ngắn gọn) THAY `.title` — `.title` giờ dài
    // hơn (dùng làm tooltip nút thật, mô tả cả 2 hành vi bấm ngắn/giữ 1.5s), không hợp để hiển thị
    // trong 1 <option> dropdown chật hẹp.
    // SỬA TIẾP (cùng ngày, "tap 3 dùng chung select giống tap/cử chỉ khác") — pool này giờ CHỈ còn
    // 3 dropdown Slot (section Action) dùng — dropdown Tap 3 lần đã chuyển hẳn sang actionRow()/
    // actionOptions ở dưới, không còn dùng pool này nữa.
    const controlCenterTargetOptions = `
        <option value="none" data-i18n="gestureSettings.action.none">${t('gestureSettings.action.none')}</option>
        <option value="cycleMode" data-i18n="visualizerOverlay.cycleMode.label">${t('visualizerOverlay.cycleMode.label')}</option>
        <option value="shuffle" data-i18n="visualizerOverlay.shuffle.label">${t('visualizerOverlay.shuffle.label')}</option>
        <option value="repeat" data-i18n="visualizerOverlay.repeat.label">${t('visualizerOverlay.repeat.label')}</option>
        <option value="documentReader" data-i18n="visualizerOverlay.documentReader.label">${t('visualizerOverlay.documentReader.label')}</option>
        <option value="captureFrame" data-i18n="gestureSettings.tripleTapTarget.captureFrameOption">${t('gestureSettings.tripleTapTarget.captureFrameOption')}</option>
        <option value="openVolume" data-i18n="visualizerOverlay.volume.label">${t('visualizerOverlay.volume.label')}</option>
        <option value="cycleEq" data-i18n="visualizerOverlay.cycleEq.label">${t('visualizerOverlay.cycleEq.label')}</option>
    `;
    const actionSlotRow = (id, labelKey) => `
        <div class="flex justify-between items-center p-4 border-b border-white/5 last:border-b-0">
            <span class="text-sm font-medium" data-i18n="${labelKey}">${t(labelKey)}</span>
            <select id="${id}" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-32 text-right">${controlCenterTargetOptions}</select>
        </div>
    `;

    return `
        <div class="flex flex-col gap-5">
            <div>
                ${sectionTitleWithHint('gestureSettings.sectionActions', 'text-violet-400', 'gestureSettings.sectionActions.hint')}
                <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                    ${actionSlotRow('setting-gesture-action-slot-1', 'gestureSettings.action.actionSlot1')}
                    ${actionSlotRow('setting-gesture-action-slot-2', 'gestureSettings.action.actionSlot2')}
                    ${actionSlotRow('setting-gesture-action-slot-3', 'gestureSettings.action.actionSlot3')}
                </div>
            </div>

            <div>
                ${sectionTitle('gestureSettings.sectionNav', 'text-sky-400')}
                <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                    ${actionRow('setting-gesture-action-swipe-up', 'gestureSettings.swipeUp.label')}
                    ${actionRow('setting-gesture-action-swipe-down', 'gestureSettings.swipeDown.label')}
                    ${actionRow('setting-gesture-action-swipe-left', 'gestureSettings.swipeLeft.label')}
                    ${actionRow('setting-gesture-action-swipe-right', 'gestureSettings.swipeRight.label', true)}
                </div>
            </div>

            <div>
                ${sectionTitle('gestureSettings.sectionTap', 'text-emerald-400')}
                <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                    ${actionRow('setting-gesture-action-tap-single', 'gestureSettings.tapSingle.label')}
                    ${actionRow('setting-gesture-action-tap-double', 'gestureSettings.tapDouble.label')}
                    ${actionRow('setting-gesture-triple-tap-target', 'gestureSettings.tripleTapTarget.label', true)}
                </div>
            </div>

            <div>
                ${sectionTitle('gestureSettings.sectionSeek', 'text-amber-400')}
                <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                    <div class="flex justify-between items-center p-4 border-b border-white/5">
                        <div class="pr-3">
                            <div class="text-sm font-medium" data-i18n="gestureSettings.seekHoldEnable.label">${t('gestureSettings.seekHoldEnable.label')}</div>
                            <div class="text-xs text-slate-400 mt-0.5" data-i18n="gestureSettings.seekHoldEnable.hint">${t('gestureSettings.seekHoldEnable.hint')}</div>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer shrink-0">
                            <input type="checkbox" id="setting-gesture-seek-hold-enable" class="sr-only peer">
                            <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                        </label>
                    </div>
                    <button id="setting-gesture-open-seek-step-picker" type="button" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors w-full text-left">
                        <span class="text-sm font-medium" data-i18n="gestureSettings.seekStep.label">${t('gestureSettings.seekStep.label')}</span>
                        <span id="gesture-seek-step-value" class="text-xs text-slate-300 font-mono"></span>
                    </button>
                    <button id="setting-gesture-open-seek-hold-interval-picker" type="button" class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors w-full text-left">
                        <span class="text-sm font-medium" data-i18n="gestureSettings.seekHoldInterval.label">${t('gestureSettings.seekHoldInterval.label')}</span>
                        <span id="gesture-seek-hold-interval-value" class="text-xs text-slate-300 font-mono"></span>
                    </button>
                </div>
            </div>

            <div>
                ${sectionTitle('gestureSettings.sectionEdge', 'text-fuchsia-400')}
                <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                    <div class="flex justify-between items-center p-4">
                        <div class="pr-3">
                            <div class="text-sm font-medium" data-i18n="gestureSettings.edgeTop.label">${t('gestureSettings.edgeTop.label')}</div>
                            <div class="text-xs text-slate-400 mt-0.5" data-i18n="gestureSettings.edgeTop.hint">${t('gestureSettings.edgeTop.hint')}</div>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer shrink-0">
                            <input type="checkbox" id="setting-gesture-edge-top" class="sr-only peer">
                            <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    `;
}
