/**
 * event/listener/visual-bg.js — TẤT CẢ listener của cụm "visualBg" (v13, plan-v13-visual-
 * background-unification.md).
 *
 * 2 loại nguồn trigger, đúng khuôn đã dùng cho cụm "slideshowSettings":
 *   1. `btnOpenVisualBgSettings` (Main Settings, DOM TĨNH từ core/dom-refs.js) — listener trực tiếp.
 *   2. 6 control BÊN TRONG panel Settings (push/pop ĐỘNG, core/settings-panel-stack-ui.js) —
 *      DELEGATION trên `settingsStackBody` (phần tử ổn định, không bao giờ bị xoá). Key MAP ghép
 *      `"${id}:${eventType}"` — CHUẨN đã dùng ở event/listener/slideshow.js.
 *
 * NẠP SAU CÙNG (sau bus, core, workflow, router, VÀ SAU core/dom-refs.js).
 */

if (btnOpenVisualBgSettings) {
    btnOpenVisualBgSettings.addEventListener('click', () => {
        eventBus.send({ router: 'visualBg', type: 'visualBg.openPanel.click', payload: {} });
    });
}

const VISUAL_BG_SETTINGS_INPUT_MAP = {
    // TÁCH 2 msg.type riêng cho toggle TỔNG (KHÔNG dùng 1 type + payload.checked) — Block gate
    // (event/block.js) CHỈ đọc được state, KHÔNG đọc payload (xem event/bus.js::evalCondition()),
    // nên chiều "bật" phải có msg.type riêng mới đăng ký chặn được. CÙNG KHUÔN
    // `videoEnable.enable.click`/`.disable.click` cũ ở cụm visualizerControlCenter.
    'setting-visual-bg-enable:change': { type: 'visualBg.enable.on.click', controlledToggle: true },
    'setting-visual-bg-media-type:change': { type: 'visualBg.mediaType.change' },
    'setting-visual-bg-source-mode:change': { type: 'visualBg.sourceMode.change', checkbox: true },
    'setting-visual-bg-list-playback-mode:change': { type: 'visualBg.listPlaybackMode.change' },
    'setting-visual-bg-next-order:change': { type: 'visualBg.nextOrder.change' },
    'setting-visual-bg-pick-source:click': { type: 'visualBg.pickSource.click', bare: true },
    'setting-visual-bg-clear-source:click': { type: 'visualBg.clearSource.click', bare: true },
    'setting-visual-bg-color-mode:change': { type: 'visualBg.colorMode.change' },
    'setting-visual-bg-solid-color:input': { type: 'visualBg.solidColor.input' },
    'setting-visual-bg-gradient-angle:input': { type: 'visualBg.gradientAngle.input' },
    'setting-visual-bg-gradient-add:click': { type: 'visualBg.gradientStop.add.click', bare: true },
    'setting-visual-bg-open-gradient:click': { type: 'visualBg.openGradientPanel.click', bare: true },
    'setting-visual-bg-open-slideshow:click': { type: 'visualBg.openSlideshowPanel.click', bare: true },
};

/** 3 control của MỖI HÀNG chặng màu gradient được vẽ ĐỘNG (số hàng đổi theo 2..7) nên không thể
 * liệt kê theo `id` như MAP trên — nhận diện bằng thuộc tính `data-*` kèm CHỈ SỐ hàng. Vẫn dùng
 * chung 2 listener delegation sẵn có, không thêm listener nào. */
function handleVisualBgGradientStopEvent(e) {
    const el = e.target.closest('[data-visual-bg-stop-color], [data-visual-bg-stop-position], [data-visual-bg-stop-remove]');
    if (!el) return false;
    if (el.dataset.visualBgStopRemove !== undefined && e.type === 'click') {
        eventBus.send({ router: 'visualBg', type: 'visualBg.gradientStop.remove.click', payload: { index: Number(el.dataset.visualBgStopRemove) } });
        return true;
    }
    if (el.dataset.visualBgStopColor !== undefined && e.type === 'input') {
        eventBus.send({ router: 'visualBg', type: 'visualBg.gradientStop.change', payload: { index: Number(el.dataset.visualBgStopColor), field: 'color', value: el.value } });
        return true;
    }
    if (el.dataset.visualBgStopPosition !== undefined && e.type === 'input') {
        eventBus.send({ router: 'visualBg', type: 'visualBg.gradientStop.change', payload: { index: Number(el.dataset.visualBgStopPosition), field: 'position', value: el.value } });
        return true;
    }
    return false;
}

function handleVisualBgSettingsDelegatedEvent(e) {
    if (handleVisualBgGradientStopEvent(e)) return; // hàng chặng màu động — xử lý riêng ở trên
    // `closest()` (không phải `e.target.id` thuần) — 2 entry dạng NÚT có phần tử con (svg/div),
    // click thật thường rơi vào con chứ không phải chính <button>.
    const hostEl = e.target.closest('[id]');
    if (!hostEl) return;
    const entry = VISUAL_BG_SETTINGS_INPUT_MAP[`${hostEl.id}:${e.type}`];
    if (!entry) return; // không phải control cụm này (hoặc sai loại event cho đúng id đó)

    // "Controlled toggle" — trả `.checked` về ĐÚNG giá trị thật NGAY tại đây TRƯỚC khi dispatch,
    // tránh nhấp nháy sai nếu Block gate chặn message. Workflow tự vẽ lại toggle khi ghi thật.
    if (entry.controlledToggle) {
        const intendedChecked = hostEl.checked;
        hostEl.checked = appConfigVisualBg.getAll().enabled;
        eventBus.send({ router: 'visualBg', type: intendedChecked ? 'visualBg.enable.on.click' : 'visualBg.enable.off.click', payload: {} });
        return;
    }

    const payload = entry.checkbox ? { checked: hostEl.checked }
        : entry.bare ? {}
        : { value: hostEl.value };
    eventBus.send({ router: 'visualBg', type: entry.type, payload });
}

if (settingsStackBody) {
    settingsStackBody.addEventListener('change', handleVisualBgSettingsDelegatedEvent);
    settingsStackBody.addEventListener('click', handleVisualBgSettingsDelegatedEvent);
    // `input` (không phải `change`) cho ô màu + 2 thanh trượt: cần cập nhật nền NGAY lúc kéo.
    settingsStackBody.addEventListener('input', handleVisualBgSettingsDelegatedEvent);
}
