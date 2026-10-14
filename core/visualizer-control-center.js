/**
 * core/visualizer-control-center.js — Control Center của màn Visualizer: panel grid icon phóng ra từ nút mở góc trái;
 * đóng bằng nút mở, overlay mờ, hoặc bấm 1 icon trong grid (data-cc-action). Listener: event/listener/visualizer-control-
 * center.js; Router gọi thẳng các hàm dưới.
 */

/** Mở / đóng theo trạng thái hiện tại (switch A/B trên cùng panel). */
function toggleControlCenter() {
    const willOpen = visualizerControlCenter.classList.contains('scale-0');
    visualizerControlCenter.classList.toggle('scale-0', !willOpen);
    visualizerControlCenter.classList.toggle('opacity-0', !willOpen);
    controlCenterOverlay.classList.toggle('hidden', !willOpen);
    iconControlCenterDown.classList.toggle('rotate-180', willOpen);
}

function closeControlCenter() {
    visualizerControlCenter.classList.add('scale-0', 'opacity-0');
    controlCenterOverlay.classList.add('hidden');
    iconControlCenterDown.classList.remove('rotate-180');
}

/** Bấm hộ 1 nút Control Center (Action slot của cử chỉ). Không có / đang ẩn (vd captureFrame ngoài Video) -> bỏ qua.
 * @param {HTMLElement|null|undefined} buttonEl */
function clickControlCenterButtonIfShown(buttonEl) {
    if (!buttonEl || buttonEl.classList.contains('hidden')) return;
    buttonEl.click();
}

/** Toggle "Hiện Visual" (độc lập video nền). Lưu bền: Workflow gọi saveConfig(). @param {boolean} checked */
function setVisualEnabled(checked) {
    appConfigViz.mutateAll(cfg => { cfg.visualEnabled = checked; });
    console.log(`writer: "setVisualEnabled", page: "vizConfig.visualEnabled", content: "${checked}"`);
}
