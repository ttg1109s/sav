/**
 * event/listener/visual-bg.js — Listener cụm "visualBg". 3 nguồn trigger: nút mở Settings (DOM
 * tĩnh) + control BÊN TRONG panel (delegation trên `settingsStackBody`, cùng khuôn slideshowSettings)
 * + `bgVideoElement` tự bắn 'ended' nguyên bản (MỚI 08/08/2026 — video cycle mode 'slideshow' đợi
 * hết thật, xem cuối file).
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

/** SỬA (08/08/2026, phản hồi Giang mục "bỏ checkbox") — bỏ hẳn checkbox rời (đã gộp bật/tắt vào
 * công tắc TRONG modal, xem `openVideoAudioVolumeModal()`) — hàng giờ chỉ còn 1 control: nút icon+%
 * mở modal chung (`openSliderInputModal()`, core/slider-input-modal.js). */
function handleVisualBgVideoAudioEvent(e) {
    const el = e.target.closest('[data-visual-bg-video-audio-open-volume]');
    if (!el) return false;
    if (e.type === 'click') {
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

if (settingsStackBody) {
    settingsStackBody.addEventListener('change', handleVisualBgSettingsDelegatedEvent);
    settingsStackBody.addEventListener('click', handleVisualBgSettingsDelegatedEvent);
    // `input` (không phải `change`) cho ô màu + 2 thanh trượt — cập nhật NGAY lúc kéo.
    settingsStackBody.addEventListener('input', handleVisualBgSettingsDelegatedEvent);
}

// MỚI (08/08/2026, phản hồi Giang — mục "video chạy/dừng/lặp/đen màn thất thường") — `bgVideoElement`
// tự bắn 'ended' nguyên bản của trình duyệt. Guard `isVideoPlayerMode` NGƯỢC với listener ở
// event/listener/video-player.js (nơi đó CHỈ xử lý khi player mode TRUE, dispatch playNext()) — ở
// đây CHỈ xử lý khi player mode FALSE (đang dùng bgVideoElement để trang trí VBG), tránh dispatch 2
// message cho cùng 1 sự kiện gốc. Chỉ THẬT SỰ bắn được khi `loop=false` — tức đúng lúc VBG đang
// cycle nhiều video theo mode 'slideshow' (xem `_playVideoKey()`, event/workflow/visual-bg.js) —
// perSong/1 item luôn loop=true nên trình duyệt không bao giờ bắn 'ended' cho 2 case đó, không cần
// lọc thêm ở Listener (Workflow tự guard lại 1 lần nữa trong `_onVideoEnded()`, phòng thủ kép).
if (bgVideoElement) {
    bgVideoElement.addEventListener('ended', () => {
        if (appState.get('isVideoPlayerMode')) return;
        eventBus.send({ router: 'visualBg', type: 'visualBg.video.ended', payload: {} });
    });
}
