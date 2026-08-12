/**
 * event/listener/gesture-settings.js — TẤT CẢ listener của cụm "gestureSettings".
 *
 * SỬA (12/08/2026, Giang yêu cầu tái cấu trúc Setting Main mục 4h) — #setting-open-gesture-
 * settings TRƯỚC ĐÂY tĩnh (sống ở Main, luôn có trong DOM lúc boot) — giờ DỜI VÀO panel "Customize
 * Visualizer" (components/visualizer-settings-drawer.js), 1 panel push/pop ĐỘNG (core/settings-
 * panel-stack-ui.js, KHÔNG tồn tại trong DOM lúc boot, chỉ tạo ra khi user bấm mở panel đó) — nếu
 * vẫn giữ kiểu "static ref + addEventListener 1 lần lúc boot" NHƯ CŨ, `btnOpenGestureSettings`
 * (dom-refs.js) sẽ LUÔN là `null` lúc boot (panel cha chưa tồn tại), listener KHÔNG BAO GIỜ được
 * gắn — nút bấm sẽ im lặng không phản ứng gì. SỬA: gộp nút này vào CHUNG delegate 'click' trên
 * `settingsStackBody` (khung CHUNG chứa MỌI panel, kể cả panel chưa từng mở) — ĐÚNG khuôn 2 nút mở
 * time-picker Seek ngay bên dưới, không còn cần `btnOpenGestureSettings`/dom-refs.js nữa.
 *
 * Toàn bộ input còn lại SỐNG BÊN TRONG panel push/pop động — CÙNG khuôn Visualizer Settings
 * (event/listener/visualizer-display.js): 2 listener delegate trên `settingsStackBody` — 1 cho
 * 'change' (checkbox/select), 1 cho 'click' (nút mở panel/time-picker, KHÔNG bắn 'change').
 */

const GESTURE_SETTINGS_INPUT_MAP = {
    'setting-gesture-action-swipe-up': { type: 'gestureSettings.swipeUp.change', checkbox: false },
    'setting-gesture-action-swipe-down': { type: 'gestureSettings.swipeDown.change', checkbox: false },
    'setting-gesture-action-swipe-left': { type: 'gestureSettings.swipeLeft.change', checkbox: false },
    'setting-gesture-action-swipe-right': { type: 'gestureSettings.swipeRight.change', checkbox: false },
    'setting-gesture-action-tap-single': { type: 'gestureSettings.tapSingle.change', checkbox: false },
    'setting-gesture-action-tap-double': { type: 'gestureSettings.tapDouble.change', checkbox: false },
    'setting-gesture-triple-tap-target': { type: 'gestureSettings.tripleTapTarget.change', checkbox: false },
    // MỚI (12/08/2026, Giang yêu cầu — "Action") — 3 dropdown section Action, CÙNG cơ chế delegate
    // có sẵn (settingsStackBody 'change'), không cần listener riêng.
    'setting-gesture-action-slot-1': { type: 'gestureSettings.actionSlot1.change', checkbox: false },
    'setting-gesture-action-slot-2': { type: 'gestureSettings.actionSlot2.change', checkbox: false },
    'setting-gesture-action-slot-3': { type: 'gestureSettings.actionSlot3.change', checkbox: false },
    'setting-gesture-seek-hold-enable': { type: 'gestureSettings.seekHoldEnable.change', checkbox: true },
    'setting-gesture-edge-top': { type: 'gestureSettings.edgeTop.change', checkbox: true },
};

if (settingsStackBody) {
    settingsStackBody.addEventListener('change', (e) => {
        const entry = GESTURE_SETTINGS_INPUT_MAP[e.target.id];
        if (!entry) return;
        const payload = entry.checkbox ? { checked: e.target.checked } : { value: e.target.value };
        eventBus.send({ router: 'gestureSettings', type: entry.type, payload });
    });

    settingsStackBody.addEventListener('click', (e) => {
        if (e.target.closest('#setting-open-gesture-settings')) {
            eventBus.send({ router: 'gestureSettings', type: 'gestureSettings.openPanel.click', payload: {} });
        } else if (e.target.closest('#setting-gesture-open-seek-step-picker')) {
            eventBus.send({ router: 'gestureSettings', type: 'gestureSettings.openSeekStepPicker.click', payload: {} });
        } else if (e.target.closest('#setting-gesture-open-seek-hold-interval-picker')) {
            eventBus.send({ router: 'gestureSettings', type: 'gestureSettings.openSeekHoldIntervalPicker.click', payload: {} });
        }
    });
}
