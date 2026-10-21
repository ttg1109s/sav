/**
 * event/listener/visual-bg.js — Listener cụm "visualBg": control bên trong các màn VBG (ủy quyền 1 lần trên
 * `genericDrawerBody`) + sự kiện gốc 'ended'/'timeupdate' của `bgVideoElement` lúc là nền trang trí. Chỉ gửi bus; lúc
 * Video Player mode, Block gate chặn 2 sự kiện video (event/block.js — Player có Listener riêng, event/listener/video-player.js).
 * NẠP SAU CÙNG (sau bus, core, workflow, router, và core/dom-refs.js).
 */

const VISUAL_BG_SETTINGS_INPUT_MAP = {
    'setting-visual-bg-enabled:change': { type: 'visualBg.enabled.change', checkbox: true }, // toggle tổng
    'setting-visual-bg-list-playback-mode:change': { type: 'visualBg.listPlaybackMode.change' },
    'setting-visual-bg-next-order:change': { type: 'visualBg.nextOrder.change' },
    'setting-visual-bg-duration-mode:change': { type: 'visualBg.durationMode.change' },
    'setting-visual-bg-duration-seconds:click': { type: 'visualBg.durationSeconds.openPicker', bare: true },
    'setting-visual-bg-open-motion-picker:click': { type: 'visualBg.motionPicker.open.click', bare: true }, // mở màn Chọn Motion
    'setting-visual-bg-sync-speed:change': { type: 'visualBg.syncPlaybackSpeed.change', checkbox: true },
    'setting-visual-bg-resolution:change': { type: 'visualBg.resolutionMode.change' }, // Resolution card Media
    'setting-visual-bg-pick-video:click': { type: 'visualBg.pickVideo.click', bare: true },
    'setting-visual-bg-pick-photo:click': { type: 'visualBg.pickPhoto.click', bare: true },
    'setting-visual-bg-pick-folder:click': { type: 'visualBg.pickFolder.click', bare: true },
    'setting-visual-bg-refresh-source:click': { type: 'visualBg.refreshSource.click', bare: true },
    'setting-visual-bg-clear-source:click': { type: 'visualBg.clearSource.click', bare: true },
    'setting-visual-bg-color-mode:change': { type: 'visualBg.colorMode.change' },
    'setting-visual-bg-solid-color:input': { type: 'visualBg.solidColor.input' },
    'setting-visual-bg-gradient-angle:input': { type: 'visualBg.gradientAngle.input' },
    'setting-visual-bg-gradient-add:click': { type: 'visualBg.gradientStop.add.click', bare: true },
    'setting-visual-bg-open-gradient:click': { type: 'visualBg.openGradientPanel.click', bare: true },
    'setting-visual-bg-open-video-audio:click': { type: 'visualBg.openVideoAudioPanel.click', bare: true },
    // 4 ô gõ số dùng 'change' (bắn lúc blur) — tránh commit giá trị dở dang khi đang gõ nhiều chữ số.
    'setting-visual-bg-gradient-movement-enable:change': { type: 'visualBg.gradientMovement.enable.change', checkbox: true },
    'setting-visual-bg-gradient-movement-mode:change': { type: 'visualBg.gradientMovement.mode.change' },
    'setting-visual-bg-gradient-movement-open-duration:click': { type: 'visualBg.gradientMovement.openDurationPicker.click', bare: true },
    'setting-visual-bg-gradient-movement-audio-rotate-from:change': { type: 'visualBg.gradientMovement.audioRotateFrom.change' },
    'setting-visual-bg-gradient-movement-audio-rotate-to:change': { type: 'visualBg.gradientMovement.audioRotateTo.change' },
    'setting-visual-bg-gradient-movement-audio-spread-from:change': { type: 'visualBg.gradientMovement.audioSpreadFrom.change' },
    'setting-visual-bg-gradient-movement-audio-spread-to:change': { type: 'visualBg.gradientMovement.audioSpreadTo.change' },
    'setting-visual-bg-gradient-colorswap-enable:change': { type: 'visualBg.gradientMovement.colorSwapEnable.change', checkbox: true },
    'setting-visual-bg-gradient-colorswap-open-interval:click': { type: 'visualBg.gradientMovement.openColorSwapIntervalPicker.click', bare: true },
    'setting-visual-bg-gradient-colorswap-open-transition:click': { type: 'visualBg.gradientMovement.openColorSwapTransitionPicker.click', bare: true },
};

/** 3 control của mỗi hàng chặng màu gradient (2..7 hàng) — nhận diện bằng `data-*` kèm chỉ số hàng. */
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

/** Màn Âm thanh Video: mỗi hàng có icon loa (bật/tắt ngay) + nút "%" (mở modal chỉnh volume). */
function handleVisualBgVideoAudioEvent(e) {
    const el = e.target.closest('[data-visual-bg-video-audio-toggle], [data-visual-bg-video-audio-open-volume]');
    if (!el) return false;
    if (el.dataset.visualBgVideoAudioToggle !== undefined && e.type === 'click') {
        eventBus.send({ router: 'visualBg', type: 'visualBg.videoAudio.toggle.click', payload: { videoKey: el.dataset.visualBgVideoAudioToggle } });
        return true;
    }
    if (el.dataset.visualBgVideoAudioOpenVolume !== undefined && e.type === 'click') {
        eventBus.send({ router: 'visualBg', type: 'visualBg.videoAudio.openVolumeModal.click', payload: { videoKey: el.dataset.visualBgVideoAudioOpenVolume } });
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

if (genericDrawerBody) {
    genericDrawerBody.addEventListener('change', handleVisualBgSettingsDelegatedEvent);
    genericDrawerBody.addEventListener('click', handleVisualBgSettingsDelegatedEvent);
    // `input` cho ô màu + thanh trượt — cập nhật ngay lúc kéo.
    genericDrawerBody.addEventListener('input', handleVisualBgSettingsDelegatedEvent);
}

// `bgVideoElement` lúc là nền VBG: 'ended' chỉ thật sự bắn khi VBG cycle nhiều video kiểu slideshow (loop=false); 'timeupdate'
// phát hiện video lùi về đầu (loop native không bắn 'ended') để chạy lại Point Move.
if (bgVideoElement) {
    bgVideoElement.addEventListener('ended', () => eventBus.send({ router: 'visualBg', type: 'visualBg.video.ended', payload: {} }));
    bgVideoElement.addEventListener('timeupdate', () => eventBus.send({ router: 'visualBg', type: 'visualBg.video.timeupdate', payload: { currentTime: bgVideoElement.currentTime } }));
}
