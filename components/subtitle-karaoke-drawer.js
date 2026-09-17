/**
 * Component: nội dung Generic Drawer cho "Karaoke timing" (event/workflow/subtitle-editor.js mở
 * qua nút "kr" mỗi dòng, xem core/subtitle/subtitles-ui.js::buildLineCard()) — MỚI (17/09/2026,
 * yêu cầu Giang). CÙNG khuôn components/eq-presets-drawer.js (string template, gọi t()/escapeHtml()
 * ngay lúc render — component KHÔNG tự addEventListener, Workflow tự querySelector + wire SAU mỗi
 * lần openGenericDrawer()/updateGenericDrawer(), xem docstring core/generic-drawer.js).
 *
 * Body = 1 khung waveform mini (`#karaoke-mini-waveform`, Workflow tự tạo WaveSurfer + Regions bên
 * trong sau khi HTML này được gán — xem event/workflow/subtitle-editor.js::
 * _initKaraokeMiniWaveform()) + danh sách hàng "từ | ô ms | nút ▶ nghe riêng từ đó" + nút "Áp dụng"
 * cuối. Dòng CHƯA có chữ (không từ nào) -> chỉ hiện 1 dòng thông báo, không có waveform/nút Áp
 * dụng (Workflow đã chặn từ trước, không mở drawer cho trường hợp này — xem openKaraokeDrawer() —
 * nhánh này chỉ là lưới an toàn thứ 2).
 *
 * NẠP SAU: lang/lang.js (t()), core/modal-choice-ui.js (escapeHtml()), core/subtitle/
 * subtitle-karaoke.js (KARAOKE_MIN_WORD_MS).
 */

function renderKaraokeDrawerHeader() {
    return `
        <div class="flex justify-between items-center px-5 pb-3" data-uitk="headerBorder">
            <h3 class="text-base font-bold" data-uitk="headerTitle">${t('subtitleEditor.karaoke.title')}</h3>
            <button id="btn-generic-drawer-close" class="w-8 h-8 flex items-center justify-center rounded-full transition-colors" data-uitk="headerCloseHover headerCloseIcon" title="${t('common.close')}"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
    `;
}

/** @param {Array<{word: string, ms: number}>} words */
function renderKaraokeDrawerBody(words) {
    if (words.length === 0) {
        return `<div class="px-4 py-6 text-sm text-center" data-uitk="textSecondary">${t('subtitleEditor.karaoke.noWords')}</div>`;
    }
    return `
        <div class="px-4 pt-3 pb-4 flex flex-col gap-3">
            <div class="relative w-full" style="height:80px">
                <div id="karaoke-mini-waveform" class="absolute inset-0 rounded-xl overflow-hidden" data-uitk="cardBg cardBorder"></div>
                <div id="karaoke-mini-waveform-error" class="hidden absolute inset-0 rounded-xl flex items-center justify-center text-center text-xs px-3" data-uitk="cardBg cardBorder textSecondary">${t('subtitleEditor.karaoke.waveformError')}</div>
            </div>
            <div class="flex flex-col gap-1.5">
                ${words.map((w, i) => renderKaraokeWordRow(w.word, w.ms, i)).join('')}
            </div>
            <button id="karaoke-drawer-apply" type="button" class="w-full py-2.5 rounded-xl text-sm font-semibold transition-colors" data-uitk="btnPrimaryBg btnPrimaryHoverBg textOnAccent">${t('subtitleEditor.karaoke.apply')}</button>
        </div>
    `;
}

/** 1 hàng "từ | ô ms | nút ▶" — 2 icon play/pause CÙNG khuôn PLAY_ICON_SVG (core/subtitle/
 * subtitles-ui.js) nhưng class RIÊNG (karaoke-word-play-icon/karaoke-word-pause-icon) — subtree
 * body Generic Drawer tách biệt hẳn danh sách dòng chính, không lo trùng querySelector.
 * @param {string} word @param {number} ms @param {number} index */
function renderKaraokeWordRow(word, ms, index) {
    return `
        <div class="flex items-center gap-2 rounded-lg px-2 py-1.5" data-uitk="cardBg cardBorder">
            <span class="flex-1 min-w-0 text-sm truncate" data-uitk="textPrimary">${escapeHtml(word)}</span>
            <input type="number" min="${KARAOKE_MIN_WORD_MS}" step="10" value="${ms}" data-karaoke-word-ms="${index}" class="w-20 text-center text-xs font-mono rounded-lg px-1.5 py-1 outline-none" data-uitk="inputBg inputBorder inputText">
            <button type="button" data-karaoke-word-play="${index}" class="w-7 h-7 flex items-center justify-center rounded-full bg-sky-500/15 hover:bg-sky-500/25 text-sky-500 transition-colors shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" class="karaoke-word-play-icon h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>
                <svg xmlns="http://www.w3.org/2000/svg" class="karaoke-word-pause-icon h-3.5 w-3.5 hidden" fill="currentColor" viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"></path></svg>
            </button>
        </div>
    `;
}
