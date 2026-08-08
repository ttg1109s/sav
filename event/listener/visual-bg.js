/**
 * event/listener/visual-bg.js — Listener cụm "visualBg". 2 nguồn trigger: nút mở Settings (DOM
 * tĩnh) + control BÊN TRONG panel (delegation trên `settingsStackBody`, cùng khuôn slideshowSettings).
 * NẠP SAU CÙNG (sau bus, core, workflow, router, và core/dom-refs.js).
 */

if (btnOpenVisualBgSettings) {
    btnOpenVisualBgSettings.addEventListener('click', () => {
        eventBus.send({ router: 'visualBg', type: 'visualBg.openPanel.click', payload: {} });
    });
}

const VISUAL_BG_SETTINGS_INPUT_MAP = {
    'setting-visual-bg-type:change': { type: 'visualBg.type.change' },
    'setting-visual-bg-list-playback-mode:change': { type: 'visualBg.listPlaybackMode.change' },
    'setting-visual-bg-next-order:change': { type: 'visualBg.nextOrder.change' },
    'setting-visual-bg-pick-single:click': { type: 'visualBg.pickSingleSource.click', bare: true },
    'setting-visual-bg-pick-group:click': { type: 'visualBg.pickGroupSource.click', bare: true },
    'setting-visual-bg-refresh-source:click': { type: 'visualBg.refreshSource.click', bare: true },
    'setting-visual-bg-clear-source:click': { type: 'visualBg.clearSource.click', bare: true },
    'setting-visual-bg-color-mode:change': { type: 'visualBg.colorMode.change' },
    'setting-visual-bg-solid-color:input': { type: 'visualBg.solidColor.input' },
    'setting-visual-bg-gradient-angle:input': { type: 'visualBg.gradientAngle.input' },
    'setting-visual-bg-gradient-add:click': { type: 'visualBg.gradientStop.add.click', bare: true },
    'setting-visual-bg-open-gradient:click': { type: 'visualBg.openGradientPanel.click', bare: true },
    'setting-visual-bg-open-slideshow:click': { type: 'visualBg.openSlideshowPanel.click', bare: true },
    'setting-visual-bg-open-video-audio:click': { type: 'visualBg.openVideoAudioPanel.click', bare: true },
};

/** 3 control của MỖI HÀNG chặng màu gradient (số hàng đổi theo 2..7) — nhận diện bằng `data-*` kèm
 * chỉ số hàng, không liệt kê theo `id` như map trên. */
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

/** MỚI (08/08/2026) — 2 control của MỖI HÀNG video trong sub-panel "Âm thanh Video" (số hàng đổi
 * theo `source.list`, key theo videoKey chứ không phải index — cùng khuôn `handleVisualBgGradientStopEvent()`
 * ngay trên, đổi từ số sang chuỗi vì đây là key thật, không phải vị trí mảng). */
function handleVisualBgVideoAudioEvent(e) {
    const el = e.target.closest('[data-visual-bg-video-audio-enable], [data-visual-bg-video-audio-volume]');
    if (!el) return false;
    if (el.dataset.visualBgVideoAudioEnable !== undefined && e.type === 'change') {
        eventBus.send({ router: 'visualBg', type: 'visualBg.videoAudio.enable.change', payload: { videoKey: el.dataset.visualBgVideoAudioEnable, checked: el.checked } });
        return true;
    }
    if (el.dataset.visualBgVideoAudioVolume !== undefined && e.type === 'input') {
        eventBus.send({ router: 'visualBg', type: 'visualBg.videoAudio.volume.input', payload: { videoKey: el.dataset.visualBgVideoAudioVolume, value: el.value } });
        return true;
    }
    return false;
}

function handleVisualBgSettingsDelegatedEvent(e) {
    if (handleVisualBgGradientStopEvent(e)) return;
    if (handleVisualBgVideoAudioEvent(e)) return;
    const hostEl = e.target.closest('[id]'); // closest() vì 1 số entry là nút có phần tử con (svg/div)
    if (!hostEl) return;
    const entry = VISUAL_BG_SETTINGS_INPUT_MAP[`${hostEl.id}:${e.type}`];
    if (!entry) return;

    const payload = entry.checkbox ? { checked: hostEl.checked }
        : entry.bare ? {}
        : { value: hostEl.value };
    eventBus.send({ router: 'visualBg', type: entry.type, payload });
}

if (settingsStackBody) {
    settingsStackBody.addEventListener('change', handleVisualBgSettingsDelegatedEvent);
    settingsStackBody.addEventListener('click', handleVisualBgSettingsDelegatedEvent);
    // `input` (không phải `change`) cho ô màu + 2 thanh trượt — cập nhật NGAY lúc kéo.
    settingsStackBody.addEventListener('input', handleVisualBgSettingsDelegatedEvent);
}
