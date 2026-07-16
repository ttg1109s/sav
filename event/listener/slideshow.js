/**
 * event/listener/slideshow.js — TẤT CẢ listener của cụm "slideshowSettings" (Batch 8, ver 12
 * "Multi Media"; VIẾT LẠI Batch 9, 04/07/2026, mục 4 — toggle DUY NHẤT thay 2 nút Chọn/Tắt cũ +
 * panel chọn Album kiểu "notify center").
 *
 * === Batch D4 (Settings restructure, 06/07/2026) ===
 * 6 input (enable/mode/photoPerSong/interval/transition/showCaption) sống BÊN TRONG panel Settings
 * (push/pop động, core/settings-panel-stack.js) — ĐỔI sang delegation trên `settingsStackBody`,
 * CHUẨN đã dùng từ Batch D2/D3. `btnBackSlideshowSettings` ĐÃ XOÁ (Back dùng CHUNG
 * `btnSettingsStackBack`). `btnOpenSlideshowSettings` (Main, tĩnh) GIỮ NGUYÊN kiểu listener trực
 * tiếp, KHÔNG cần delegation.
 *
 * ĐÃ GỠ (Giai đoạn 4, rewrite Photo/Album, mục 1) — listener tĩnh cho `slideshowAlbumPickerOverlay`
 * (panel chọn Album kiểu "notify center", mount sẵn lúc boot) — panel đó giờ là Generic Drawer ĐỘNG,
 * `genericDrawerOverlay` (element DÙNG CHUNG nhiều feature) được wire/gỡ listener ĐÚNG lúc mở/đóng
 * NGAY TRONG event/workflow/slideshow.js::openAlbumPicker()/_closeAlbumPickerDrawer() — KHÔNG thể
 * wire tĩnh 1 lần ở đây nữa (sẽ dính sang mọi Generic Drawer khác, không riêng gì Slideshow).
 */

if (btnOpenSlideshowSettings) {
    btnOpenSlideshowSettings.addEventListener('click', () => {
        eventBus.send({ router: 'slideshowSettings', type: 'slideshowSettings.openPanel.click', payload: {} });
    });
}

// (btnBackSlideshowSettings ĐÃ XOÁ — Batch D4: Back dùng CHUNG btnSettingsStackBack.)

// ===================== 6 input BÊN TRONG panel Settings (delegate) =====================
const SLIDESHOW_SETTINGS_INPUT_MAP = {
    'setting-slideshow-enable': { type: 'slideshowSettings.enable.change', event: 'change', checkbox: true },
    'setting-slideshow-mode': { type: 'slideshowSettings.mode.change', event: 'change' },
    'setting-slideshow-photo-per-song': { type: 'slideshowSettings.photoPerSong.change', event: 'change', checkbox: true },
    'setting-slideshow-interval': { type: 'slideshowSettings.interval.change', event: 'change' },
    'setting-slideshow-transition': { type: 'slideshowSettings.transitionType.change', event: 'change' },
    'setting-slideshow-show-caption': { type: 'slideshowSettings.showCaption.change', event: 'change', checkbox: true },
};

function handleSlideshowSettingsDelegatedChange(e) {
    const entry = SLIDESHOW_SETTINGS_INPUT_MAP[e.target.id];
    if (!entry || entry.event !== e.type) return; // không phải input cụm này

    const payload = entry.checkbox ? { checked: e.target.checked } : { value: e.target.value };
    eventBus.send({ router: 'slideshowSettings', type: entry.type, payload });
}

if (settingsStackBody) {
    settingsStackBody.addEventListener('change', handleSlideshowSettingsDelegatedChange);
}
