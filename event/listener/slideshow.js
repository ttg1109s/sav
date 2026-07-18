/**
 * event/listener/slideshow.js — TẤT CẢ listener của cụm "slideshowSettings" (Batch 8, ver 12
 * "Multi Media"; VIẾT LẠI Batch 9, 04/07/2026, mục 4 — toggle DUY NHẤT thay 2 nút Chọn/Tắt cũ +
 * panel chọn Album kiểu "notify center").
 *
 * === Batch D4 (Settings restructure, 06/07/2026) ===
 * 7 input (enable/mode/photoPerSong/interval/transition/kenBurns/kenBurnsMode) sống BÊN TRONG panel Settings
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

// ===================== 7 input BÊN TRONG panel Settings (delegate) =====================
const SLIDESHOW_SETTINGS_INPUT_MAP = {
    'setting-slideshow-enable': { type: 'slideshowSettings.enable.change', event: 'change', checkbox: true },
    'setting-slideshow-mode': { type: 'slideshowSettings.mode.change', event: 'change' },
    'setting-slideshow-photo-per-song': { type: 'slideshowSettings.photoPerSong.change', event: 'change', checkbox: true },
    // SỬA (18/07/2026, phản hồi Giang — "setting chọn thời gian mở modal picker") — input số cũ
    // (<input type="number">, event 'change') ĐỔI thành nút bấm (<button>, event 'click') mở modal
    // "bánh xe cuộn số" dùng chung (core/time-picker-modal.js) — KHÔNG còn đọc .value trực tiếp từ
    // input nữa, xem `openModal: true` bên dưới.
    'setting-slideshow-interval': { type: 'slideshowSettings.interval.openPicker', event: 'click', openModal: true },
    'setting-slideshow-transition': { type: 'slideshowSettings.transitionType.change', event: 'change' },
    'setting-slideshow-kenburns': { type: 'slideshowSettings.kenBurns.change', event: 'change', checkbox: true },
    'setting-slideshow-kenburns-mode': { type: 'slideshowSettings.kenBurnsMode.change', event: 'change' },
};

function handleSlideshowSettingsDelegatedEvent(e) {
    const entry = SLIDESHOW_SETTINGS_INPUT_MAP[e.target.id];
    if (!entry || entry.event !== e.type) return; // không phải input cụm này (hoặc sai loại event)

    const payload = entry.checkbox ? { checked: e.target.checked } : entry.openModal ? {} : { value: e.target.value };
    eventBus.send({ router: 'slideshowSettings', type: entry.type, payload });
}

if (settingsStackBody) {
    settingsStackBody.addEventListener('change', handleSlideshowSettingsDelegatedEvent);
    // MỚI (18/07/2026) — thêm delegation 'click' cho input DẠNG NÚT (hiện chỉ có interval picker).
    settingsStackBody.addEventListener('click', handleSlideshowSettingsDelegatedEvent);
}
