/**
 * components/settings/app-settings-main.js — Nội dung màn Main của Setting + helper dùng chung cho
 * mọi màn danh sách row (System, Visualizer Screen...).
 *
 * SỬA (20/09/2026, Giang yêu cầu "thiết kế lại main setting — list sang dạng nằm ngang cuộn, item
 * prev | current | next, current scale lớn, thêm miêu tả") — màn Main KHÔNG còn là danh sách row dọc
 * nữa mà là CAROUSEL ngang (renderAppSettingsMainBody() -> renderAppSettingsCarousel()): mỗi mục 1
 * card lớn (icon lớn + tiêu đề + miêu tả), card ở giữa = "current" (scale 1), 2 card kề bên nhỏ dần
 * (scale/opacity giảm theo khoảng cách tới tâm), cuộn vô hạn (danh sách được lặp SETTINGS_CAROUSEL_SETS
 * lần, core/settings-carousel-ui.js tự nhảy lại về bản giữa khi cuộn dừng). renderAppSettingsRowList()
 * GIỮ NGUYÊN 100% — System/Visualizer Screen/Player vẫn dùng.
 *
 * Mọi kích thước/scroll-snap của carousel viết INLINE `style` (không dùng class Tailwind
 * arbitrary-bracket) — tránh đúng bug Tailwind Play CDN tiêm CSS bất đồng bộ lần đầu (đã dính ở
 * Folder Browser + time-picker): scrollLeft ban đầu được set NGAY lúc mount, cần layout đúng ngay,
 * không đợi CSS tới.
 *
 * SỬA (phản hồi Giang mục 4 — "styling lại toàn bộ generic drawer setting, tham khảo EQ/Custom
 * Effect") — bỏ hẳn bảng màu TỐI (`glass-modal`/`border-white/5`) từng dùng ở đây — ĐÚNG bảng màu
 * SÁNG mà components/eq-presets-drawer.js/custom-effect-drawer.js đã dùng (Generic Drawer thuộc
 * vùng LOẠI TRỪ theme, nền LUÔN TRẮNG — xem docstring components/generic-drawer.js): card
 * `bg-slate-50 border border-slate-200`, text `text-slate-900/500/400`, icon nhấn `text-sky-500`.
 *
 * 5 mục Main: Playlist/System/Visualizer Screen/Troubleshooting/Reset app — mỗi card
 * `data-carousel-key="<key>"` (KEY đích, cùng bộ key với NAV_TARGETS ở event/router/app-settings.js),
 * click do core/app-settings-ui.js::wireAppSettingsMainCarousel() gắn (Rule 5d — hàm ở đây chỉ trả
 * chuỗi HTML thuần, KHÔNG addEventListener).
 */
function renderAppSettingsMainBody() {
    const rows = [
        { key: 'playlist', icon: 'M9 19V6l12-2v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z', labelKey: 'appSettings.row.playlist', hintKey: 'appSettings.row.playlist.hint' },
        { key: 'system', icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z', labelKey: 'appSettings.row.system', hintKey: 'appSettings.row.system.hint' },
        { key: 'visualizerScreen', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v10a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM8 21h8m-4-4v4', labelKey: 'appSettings.row.visualizerScreen', hintKey: 'appSettings.row.visualizerScreen.hint' },
        { key: 'troubleshooting', icon: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z', labelKey: 'appSettings.row.troubleshooting', hintKey: 'appSettings.row.troubleshooting.hint' },
        { key: 'resetApp', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', labelKey: 'appSettings.row.resetApp', hintKey: 'appSettings.row.resetApp.hint' },
    ];
    return renderAppSettingsCarousel(rows);
}

/** Số lần LẶP danh sách card để cuộn "vô hạn" — LẺ để có 1 bản chính giữa (bản `floor(SETS/2)`),
 * 5 bản (không phải 3) để 1 cú vuốt mạnh dài vẫn không chạm mép trước khi cuộn dừng và được kéo lại
 * (xem core/settings-carousel-ui.js::settleSettingsCarouselLoop()). 5 mục x 5 bản = 25 node, nhẹ. */
const SETTINGS_CAROUSEL_SETS = 5;

/** Carousel ngang: [prev | CURRENT | next], card chiều rộng 50% khung -> 2 card kề lộ ra ~1/3 mỗi bên.
 * Trạng thái hiển thị ban đầu của MỌI card = "nhỏ + mờ" (scale .8/opacity .5, khớp
 * SETTINGS_CAROUSEL_MIN_SCALE/MIN_OPACITY ở core/settings-carousel-ui.js) — card đầu tiên tự
 * phóng to lên current ở `initSettingsCarousel()` (hiệu ứng mở drawer), không phải do HTML này.
 * `data-gd-ignore-mutation` ở vùng bọc ngoài — báo cho MutationObserver auto-height của
 * core/generic-drawer.js KHÔNG đo lại chiều cao mỗi lần card đổi `style` lúc đang cuộn (60 lần/giây).
 * @param {{key:string, icon:string, labelKey:string, hintKey:string}[]} rows */
function renderAppSettingsCarousel(rows) {
    const cardHtml = (row, index, copy) => `
        <button type="button" data-carousel-card data-carousel-key="${row.key}" data-carousel-index="${index}" data-carousel-copy="${copy}" class="rounded-3xl flex flex-col items-center text-center px-4 py-5" data-uitk="cardBg cardBorder" style="flex:0 0 50%; height:232px; scroll-snap-align:center; transform:scale(0.8); opacity:0.5;">
            <span class="rounded-2xl flex items-center justify-center shrink-0" data-uitk="rowActiveBg" style="width:64px; height:64px;">
                <svg xmlns="http://www.w3.org/2000/svg" class="text-sky-500" style="width:36px; height:36px;" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="${row.icon}" /></svg>
            </span>
            <span class="block text-base font-bold text-slate-800 leading-tight mt-3" style="display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${t(row.labelKey)}</span>
            <span class="block text-xs text-slate-500 leading-snug mt-1.5" style="display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;">${t(row.hintKey)}</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="text-slate-400 shrink-0" style="width:16px; height:16px; margin-top:auto;" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
        </button>
    `;
    let cardsHtml = '';
    for (let copy = 0; copy < SETTINGS_CAROUSEL_SETS; copy++) {
        cardsHtml += rows.map((row, index) => cardHtml(row, index, copy)).join('');
    }
    const dotsHtml = rows.map((row, index) => `<span data-carousel-dot="${index}" class="rounded-full bg-sky-500" style="display:block; height:6px; width:6px; opacity:0.35; transition:width 200ms, opacity 200ms;"></span>`).join('');
    return `
        <div data-gd-ignore-mutation style="margin-left:-16px; margin-right:-16px;">
            <div id="app-settings-carousel" data-carousel-count="${rows.length}" style="position:relative; display:flex; gap:10px; overflow-x:auto; overflow-y:hidden; scroll-snap-type:x mandatory; padding:8px 0; scrollbar-width:none; -ms-overflow-style:none; overscroll-behavior-x:contain; -webkit-overflow-scrolling:touch;">${cardsHtml}</div>
            <div style="display:flex; justify-content:center; align-items:center; gap:6px; margin-top:6px;">${dotsHtml}</div>
        </div>
    `;
}

/** Khuôn row dùng CHUNG cho MỌI màn danh sách của Setting (Main/System/Visualizer Screen...) —
 * ĐÚNG khuôn `renderEqListBody()` (components/eq-presets-drawer.js): mỗi row 1 card
 * `bg-slate-50 border border-slate-200 rounded-2xl`, không còn danh sách "dính liền" bọc trong 1
 * khối lớn như bản glass-modal cũ.
 * @param {{key:string, icon:string, labelKey:string, hintKey?:string}[]} rows */
function renderAppSettingsRowList(rows) {
    return rows.map((row) => `
        <button type="button" data-app-settings-nav="${row.key}" class="w-full text-left px-4 py-3.5 rounded-2xl mb-2 flex items-center justify-between gap-3" data-uitk="cardBg cardBorder cardHoverBg">
            <div class="flex items-center gap-3 min-w-0">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-sky-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${row.icon}" /></svg>
                <div class="min-w-0">
                    <div class="text-sm font-semibold text-slate-700 truncate">${t(row.labelKey)}</div>
                    ${row.hintKey ? `<div class="text-xs text-slate-400 mt-0.5 truncate">${t(row.hintKey)}</div>` : ''}
                </div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
        </button>
    `).join('');
}
