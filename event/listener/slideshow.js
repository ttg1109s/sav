/**
 * event/listener/slideshow.js — TẤT CẢ listener của cụm "slideshowSettings" (Batch 8, ver 12
 * "Multi Media"; VIẾT LẠI Batch 9, 04/07/2026, mục 4 — toggle DUY NHẤT thay 2 nút Chọn/Tắt cũ +
 * panel chọn Album kiểu "notify center").
 *
 * === Batch D4 (Settings restructure, 06/07/2026) ===
 * 10 input (enable/mode/photoPerSong/interval/transition/kenBurns/kenBurnsMode/transitionDuration/
 * transitionRatio/transitionEasing) sống BÊN TRONG panel Settings (push/pop động, core/settings-
 * panel-stack-ui.js) — ĐỔI sang delegation trên `settingsStackBody`, CHUẨN đã dùng từ Batch D2/D3.
 * `btnBackSlideshowSettings` ĐÃ XOÁ (Back dùng CHUNG `btnSettingsStackBack`). `btnOpenSlideshowSettings`
 * (Main, tĩnh) GIỮ NGUYÊN kiểu listener trực tiếp, KHÔNG cần delegation.
 *
 * SỬA (18/07/2026, phản hồi Giang — mục "thêm thời gian transition") — MAP đổi sang KEY GHÉP
 * `"${id}:${eventType}"` (trước đây key CHỈ là id, 1 entry/id) — cần thiết vì slider Tỉ lệ In/Out
 * cần CẢ 2 event KHÁC NHAU trên CÙNG 1 phần tử (`'input'` lúc đang kéo — chỉ cập nhật nhãn xem
 * trước, KHÔNG persist; `'change'` lúc thả tay — persist thật), 1 id giờ có thể có ≥2 entry.
 *
 * ĐÃ GỠ (Giai đoạn 4, rewrite Photo/Album, mục 1) — listener tĩnh cho `slideshowAlbumPickerOverlay`
 * (panel chọn Album kiểu "notify center", mount sẵn lúc boot) — panel đó giờ là Generic Drawer ĐỘNG,
 * `genericDrawerOverlay` (element DÙNG CHUNG nhiều feature) được wire/gỡ listener ĐÚNG lúc mở/đóng
 * NGAY TRONG event/workflow/slideshow.js::openAlbumPicker()/_closeAlbumPickerDrawer() — KHÔNG thể
 * wire tĩnh 1 lần ở đây nữa (sẽ dính sang mọi Generic Drawer khác, không riêng gì Slideshow).
 */

// XOÁ (v13 Batch A) — listener tĩnh cho `btnOpenSlideshowSettings` (#setting-open-slideshow-settings)
// ĐÃ BỎ HẲN cùng chính nút đó: 3 entry nền cũ trong TPL_SETTINGS_VISUALIZER được thay bằng 1 nút
// "Visual Background" duy nhất. Lối vào panel Slideshow giờ là nút "Tuỳ chỉnh Trình chiếu..." NẰM
// TRONG panel Visual Background (DOM ĐỘNG) — bắn 'visualBg.openSlideshowPanel.click', router cụm
// `visualBg` gọi thẳng `workflowSlideshow.openPanel()` (liên tuyến domain, tái dùng nguyên panel
// đã có). Xem event/listener,router/visual-bg.js.
// (btnBackSlideshowSettings ĐÃ XOÁ — Batch D4: Back dùng CHUNG btnSettingsStackBack.)

// ===================== 10 input BÊN TRONG panel Settings (delegate) =====================
// Key = "id:eventType" (SỬA 18/07/2026 — xem docstring đầu file).
const SLIDESHOW_SETTINGS_INPUT_MAP = {
    // ('setting-slideshow-enable:change' XOÁ — v13 Batch B: toggle bật/tắt + chọn Album đã dời
    //  sang panel Visual Background, xem event/listener/visual-bg.js.)
    // ('setting-slideshow-mode' + 'setting-slideshow-photo-per-song' XOÁ — v13 Batch C: thay bằng
    //  `nextOrder` + `listPlaybackMode` ở panel cha Visual Background.)
    // SỬA (18/07/2026, phản hồi Giang — "setting chọn thời gian mở modal picker") — input số cũ
    // (<input type="number">, event 'change') ĐỔI thành nút bấm (<button>, event 'click') mở modal
    // "bánh xe cuộn số" dùng chung (core/time-picker-modal.js) — KHÔNG còn đọc .value trực tiếp từ
    // input nữa, xem `openModal: true` bên dưới.
    'setting-slideshow-interval:click': { type: 'slideshowSettings.interval.openPicker', openModal: true },
    'setting-slideshow-transition:change': { type: 'slideshowSettings.transitionType.change' },
    'setting-slideshow-kenburns:change': { type: 'slideshowSettings.kenBurns.change', checkbox: true },
    'setting-slideshow-kenburns-mode:change': { type: 'slideshowSettings.kenBurnsMode.change' },
    // MỚI (18/07/2026, mục "thêm thời gian transition") — 3 input mới.
    'setting-slideshow-transition-duration:click': { type: 'slideshowSettings.transitionDuration.openPicker', openModal: true },
    'setting-slideshow-transition-ratio:input': { type: 'slideshowSettings.transitionRatio.preview', numeric: true },
    'setting-slideshow-transition-ratio:change': { type: 'slideshowSettings.transitionRatio.change', numeric: true },
    'setting-slideshow-transition-easing:change': { type: 'slideshowSettings.transitionEasing.change' },
};

function handleSlideshowSettingsDelegatedEvent(e) {
    const entry = SLIDESHOW_SETTINGS_INPUT_MAP[`${e.target.id}:${e.type}`];
    if (!entry) return; // không phải input cụm này (hoặc sai loại event cho đúng id đó)

    const payload = entry.checkbox ? { checked: e.target.checked }
        : entry.openModal ? {}
        : entry.numeric ? { value: Number(e.target.value) }
        : { value: e.target.value };
    eventBus.send({ router: 'slideshowSettings', type: entry.type, payload });
}

if (settingsStackBody) {
    settingsStackBody.addEventListener('change', handleSlideshowSettingsDelegatedEvent);
    // MỚI (18/07/2026) — delegation 'click' cho input DẠNG NÚT (interval/transitionDuration picker).
    settingsStackBody.addEventListener('click', handleSlideshowSettingsDelegatedEvent);
    // MỚI (18/07/2026, mục "thêm thời gian transition") — delegation 'input' CHO RIÊNG slider Tỉ lệ
    // In/Out (xem preview() khác change() ở docstring đầu file).
    settingsStackBody.addEventListener('input', handleSlideshowSettingsDelegatedEvent);
}
