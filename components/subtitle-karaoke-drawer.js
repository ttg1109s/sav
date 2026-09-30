/**
 * Component: nội dung Generic Drawer cho "Karaoke timing" (event/workflow/subtitle-editor.js mở
 * qua nút "kr" mỗi dòng, xem core/subtitle/subtitles-ui.js::buildLineCard()) — MỚI (17/09/2026,
 * yêu cầu Giang). CÙNG khuôn components/eq-presets-drawer.js (string template, gọi t()/escapeHtml()
 * ngay lúc render — component KHÔNG tự addEventListener, Workflow tự querySelector + wire SAU mỗi
 * lần openGenericDrawer()/updateGenericDrawer(), xem docstring core/generic-drawer.js).
 *
 * Body = 1 khung waveform mini (`#karaoke-mini-waveform`, Workflow tự tạo WaveSurfer + Regions bên
 * trong sau khi HTML này được gán — xem event/workflow/subtitle-editor.js::
 * _initKaraokeMiniWaveform(); SỬA 30/09/2026: waveform mini CÓ audio riêng — đúng đoạn dòng đó — nút
 * ▶ từng từ phát TRÊN chính nó) + danh sách hàng "từ | ô ms | nút ▶ nghe riêng từ đó" + nút "Áp
 * dụng" cuối (MỚI 30/09/2026: kèm nút "Bỏ áp dụng" bên trái nếu dòng đang có karaoke). Dòng CHƯA có chữ (không từ nào) -> chỉ hiện 1 dòng thông báo, không có waveform/nút Áp
 * dụng (Workflow đã chặn từ trước, không mở drawer cho trường hợp này — xem openKaraokeDrawer() —
 * nhánh này chỉ là lưới an toàn thứ 2).
 *
 * NẠP SAU: lang/lang.js (t()), core/modal-choice-ui.js (escapeHtml()), core/subtitle/
 * subtitle-karaoke.js (KARAOKE_MIN_WORD_MS, KARAOKE_MINI_HEIGHT_PX).
 */

function renderKaraokeDrawerHeader() {
    return `
        <div class="flex justify-between items-center px-5 pb-3" data-uitk="headerBorder">
            <h3 class="text-base font-bold" data-uitk="headerTitle">${t('subtitleEditor.karaoke.title')}</h3>
            <button id="btn-generic-drawer-close" class="w-8 h-8 flex items-center justify-center rounded-full transition-colors" data-uitk="headerCloseHover headerCloseIcon" title="${t('common.close')}"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
    `;
}

/** @param {Array<{word: string, ms: number}>} words
 * @param {boolean} isApplied dòng ĐANG có karaoke đã Áp dụng -> hiện thêm nút "Bỏ áp dụng" (MỚI 30/09/2026) */
function renderKaraokeDrawerBody(words, isApplied) {
    if (words.length === 0) {
        return `<div class="px-4 py-6 text-sm text-center" data-uitk="textSecondary">${t('subtitleEditor.karaoke.noWords')}</div>`;
    }
    // SỬA (30/09/2026, lần 3, Giang) — khối waveform mini:
    //   - Sát mép (không gap/không bo góc) + `sticky top-0` ĐẦU body Drawer: cuộn danh sách từ bên dưới
    //     vẫn luôn thấy waveform (cùng cách preview của Element Style Editor, components/
    //     element-style-editor-drawer.js::_renderEsePreviewBox() — sticky, KHÔNG fixed thật). Body Drawer
    //     không có padding riêng nên dính đúng mép dưới header, không hở.
    //   - Waveform KHÔNG cuộn bằng tay nữa (`touch-action: pan-y` — vuốt ngang không làm gì, không giành
    //     sự kiện với núm kéo mốc); dòng dài/nhiều từ cuộn ẢO qua thanh trượt `#karaoke-mini-scroll` bên
    //     dưới (chỉ hiện khi sóng rộng hơn khung — Workflow tự bật).
    //   - `#karaoke-mini-knobs`: lớp núm kéo mốc chia — NGOÀI khung sóng (khung sóng tự overflow-hidden,
    //     lớp này thì không) nên núm tròn nằm vắt ngang mép dưới, tràn ra ngoài khung. `padding-bottom`
    //     của khối chừa chỗ cho phần núm tràn xuống.
    // Style inline (không thêm class Tailwind mới — tailwind.css build sẵn).
    const h = KARAOKE_MINI_HEIGHT_PX;
    return `
        <div class="flex flex-col">
            <div class="sticky top-0 z-10 border-b" style="padding-bottom:10px" data-uitk="panelFlushBg dividerBorder">
                <div class="relative w-full" style="height:${h}px">
                    <div id="karaoke-mini-waveform" class="absolute overflow-hidden" style="left:0;right:0;top:0;height:${h}px;touch-action:pan-y" data-uitk="cardBg"></div>
                    <div id="karaoke-mini-knobs" style="position:absolute;left:0;right:0;top:0;height:0;overflow:visible;pointer-events:none;z-index:6"></div>
                    <div id="karaoke-mini-waveform-loading" class="absolute flex items-center justify-center text-center text-xs px-3" style="left:0;right:0;top:0;height:${h}px;pointer-events:none" data-uitk="textSecondary">${t('subtitleEditor.karaoke.waveformLoading')}</div>
                    <div id="karaoke-mini-waveform-error" class="hidden absolute flex items-center justify-center text-center text-xs px-3" style="left:0;right:0;top:0;height:${h}px;z-index:7" data-uitk="cardBg textSecondary">${t('subtitleEditor.karaoke.waveformError')}</div>
                </div>
                <div id="karaoke-mini-scroll-row" class="hidden" style="padding:12px 16px 0">
                    <input id="karaoke-mini-scroll" type="range" min="0" max="1000" step="1" value="0" aria-label="${t('subtitleEditor.karaoke.scrollLabel')}" style="width:100%;margin:0;accent-color:#0ea5e9">
                </div>
            </div>
            <div class="px-4 pt-3 pb-4 flex flex-col gap-3">
                <div class="flex flex-col gap-1.5">
                    ${words.map((w, i) => renderKaraokeWordRow(w.word, w.ms, i, words.length === 1)).join('')}
                </div>
                <div class="flex gap-2">
                    ${isApplied ? `<button id="karaoke-drawer-unapply" type="button" class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors" data-uitk="btnNeutralBg btnNeutralHoverBg btnNeutralText">${t('subtitleEditor.karaoke.unapply')}</button>` : ''}
                    <button id="karaoke-drawer-apply" type="button" class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors" data-uitk="btnPrimaryBg btnPrimaryHoverBg textOnAccent">${t('subtitleEditor.karaoke.apply')}</button>
                </div>
            </div>
        </div>
    `;
}

/** 1 hàng "từ | ô ms | nút ▶" — 2 icon play/pause CÙNG khuôn PLAY_ICON_SVG (core/subtitle/
 * subtitles-ui.js) nhưng class RIÊNG (karaoke-word-play-icon/karaoke-word-pause-icon) — subtree
 * body Generic Drawer tách biệt hẳn danh sách dòng chính, không lo trùng querySelector.
 * SỬA (30/09/2026) — nút ▶ phát QUA waveform mini (không còn qua waveform chính của trang) nên dựng
 * sẵn `disabled`, Workflow mở khoá khi waveform mini sẵn sàng (lỗi -> giữ khoá). Dòng CHỈ 1 từ: ô ms
 * `readonly` (không có mốc nào để chỉnh — thời lượng luôn = cả dòng; trước đây gõ được nhưng giá trị
 * gõ không ăn, ô hiện số sai).
 * @param {string} word @param {number} ms @param {number} index @param {boolean} isOnlyWord */
function renderKaraokeWordRow(word, ms, index, isOnlyWord) {
    return `
        <div class="flex items-center gap-2 rounded-lg px-2 py-1.5" data-uitk="cardBg cardBorder">
            <span class="flex-1 min-w-0 text-sm truncate" data-uitk="textPrimary">${escapeHtml(word)}</span>
            <input type="number" inputmode="numeric" min="${KARAOKE_MIN_WORD_MS}" step="10" value="${ms}" data-karaoke-word-ms="${index}"${isOnlyWord ? ' readonly' : ''} class="w-20 text-center text-xs font-mono rounded-lg px-1.5 py-1 outline-none" data-uitk="inputBg inputBorder inputText">
            <button type="button" disabled data-karaoke-word-play="${index}" class="w-7 h-7 flex items-center justify-center rounded-full bg-sky-500/15 hover:bg-sky-500/25 text-sky-500 transition-colors shrink-0 disabled:opacity-40 disabled:pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" class="karaoke-word-play-icon h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>
                <svg xmlns="http://www.w3.org/2000/svg" class="karaoke-word-pause-icon h-3.5 w-3.5 hidden" fill="currentColor" viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"></path></svg>
            </button>
        </div>
    `;
}
