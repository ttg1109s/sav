/**
 * Component: nội dung Generic Drawer "Karaoke timing" của subtitle-editor.html (mở qua nút "kr" mỗi dòng —
 * core/subtitle/subtitles-ui.js::buildLineCard()). Chỉ trả chuỗi HTML (t()/escapeHtml() lúc render), KHÔNG gắn sự kiện —
 * mọi thao tác trong drawer đi Listener ủy quyền trên genericDrawerHeader/genericDrawerBody (event/listener/subtitle-editor.js,
 * selector `#karaoke-drawer-*`, `data-karaoke-*`).
 *
 * Body = khung waveform mini (`#karaoke-mini-waveform` — Workflow tự tạo WaveSurfer + Regions bên trong, đúng đoạn audio của
 * dòng; nút ▶ từng từ phát trên chính đoạn đó) + danh sách hàng "từ | ô ms | nút ▶" + nút "Áp dụng" (kèm "Bỏ áp dụng" bên
 * trái nếu dòng đang có karaoke). Dòng chưa có chữ -> 1 dòng thông báo (Workflow đã chặn không mở drawer — đây chỉ là lưới an
 * toàn). Thêm: chữ của vùng TỪ và lớp núm kéo mốc chia trên waveform mini (Workflow chèn qua core/subtitle/
 * subtitle-karaoke-drawer-ui.js).
 *
 * NẠP SAU: lang/lang.js (t()), core/modal-choice-ui.js (escapeHtml()), core/subtitle/subtitle-karaoke.js
 * (KARAOKE_MIN_WORD_MS, KARAOKE_MINI_HEIGHT_PX), components/generic-drawer.js (buildDrawerHeaderHtml).
 */

/** Header dùng chung (nút X `#btn-generic-drawer-close`). */
function renderKaraokeDrawerHeader() {
    return buildDrawerHeaderHtml({ title: t('subtitleEditor.karaoke.title') });
}

/** @param {Array<{word: string, ms: number}>} words
 * @param {boolean} isApplied dòng ĐANG có karaoke đã Áp dụng -> hiện thêm nút "Bỏ áp dụng" */
function renderKaraokeDrawerBody(words, isApplied) {
    if (words.length === 0) {
        return `<div class="px-4 py-6 text-sm text-center" data-uitk="textSecondary">${t('subtitleEditor.karaoke.noWords')}</div>`;
    }
    // Khối waveform mini:
    //   - Sát mép (không gap/không bo góc) + `sticky top-0` ĐẦU body Drawer: cuộn danh sách từ bên dưới
    //     vẫn luôn thấy waveform (cùng cách preview của Element Style Editor, components/
    //     element-style-editor-drawer.js::_renderEsePreviewBox() — sticky, KHÔNG fixed thật). Body Drawer
    //     không có padding riêng nên dính đúng mép dưới header, không hở.
    //   - Waveform KHÔNG cuộn bằng tay (`touch-action: pan-y` — vuốt ngang không làm gì, không giành
    //     sự kiện với núm kéo mốc); dòng dài/nhiều từ cuộn ẢO qua thanh trượt `#karaoke-mini-scroll` bên
    //     dưới (chỉ hiện khi sóng rộng hơn khung — Workflow tự bật).
    //   - `#karaoke-mini-knobs`: lớp núm kéo mốc chia — NGOÀI khung sóng (khung sóng tự overflow-hidden,
    //     lớp này thì không) nên núm tròn nằm vắt ngang mép dưới, tràn ra ngoài khung. `padding-bottom`
    //     của khối chừa chỗ cho phần núm tràn xuống.
    //   - `user-select: none` cả khối: nhấn giữ/kéo trên sóng, chữ từ, núm, thanh trượt
    //     không bôi chọn chữ / hiện menu copy của iOS (phần bên trong Shadow DOM của WaveSurfer do
    //     Workflow chèn style riêng, xem _setupKaraokeMiniScroll()).
    // Style inline (không thêm class Tailwind mới — tailwind.css build sẵn).
    const h = KARAOKE_MINI_HEIGHT_PX;
    return `
        <div class="flex flex-col">
            <div class="sticky top-0 z-10 border-b" style="padding-bottom:10px;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none" data-uitk="panelFlushBg dividerBorder">
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

/** 1 hàng "từ | ô ms | nút ▶" — 2 icon play/pause class RIÊNG (karaoke-word-play-icon/karaoke-word-pause-icon), không
 * trùng querySelector với danh sách dòng chính. Nút ▶ phát qua waveform mini nên dựng sẵn `disabled`, Workflow mở khoá khi
 * waveform mini sẵn sàng (lỗi -> giữ khoá). Dòng CHỈ 1 từ: ô ms `readonly` (không có mốc nào để chỉnh — thời lượng luôn =
 * cả dòng).
 * @param {string} word @param {number} ms @param {number} index @param {boolean} isOnlyWord */
function renderKaraokeWordRow(word, ms, index, isOnlyWord) {
    return `
        <div class="flex items-center gap-2 rounded-lg px-2 py-1.5" data-uitk="cardBg cardBorder">
            <span class="flex-1 min-w-0 text-sm truncate" data-uitk="textPrimary">${escapeHtml(word)}</span>
            <input type="number" inputmode="numeric" min="${KARAOKE_MIN_WORD_MS}" step="10" value="${ms}" data-karaoke-word-ms="${index}"${isOnlyWord ? ' readonly' : ''} class="w-20 text-center text-xs font-mono rounded-lg px-1.5 py-1 outline-none" data-uitk="inputBg inputBorder inputText">
            <button type="button" disabled data-karaoke-word-play="${index}" class="w-7 h-7 flex items-center justify-center rounded-full bg-sky-500/15 hover:bg-sky-500/25 text-sky-500 transition-colors shrink-0 disabled:opacity-40 disabled:pointer-events-none">
                ${iconSvg('play', 'karaoke-word-play-icon h-3.5 w-3.5')}
                ${iconSvg('pause', 'karaoke-word-pause-icon h-3.5 w-3.5 hidden')}
            </button>
        </div>
    `;
}

/** Chữ của 1 từ, gắn vào vùng TỪ trên waveform mini (core/subtitle/subtitle-karaoke-drawer-ui.js::decorateKaraokeWordRegion()).
 * Style inline — không thêm class Tailwind mới. @param {string} word */
function renderKaraokeWordRegionLabel(word) {
    return `<div style="width:100%;box-sizing:border-box;padding:3px 3px 0;font-size:11px;line-height:13px;font-weight:600;color:#334155;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 0 3px #fff,0 0 3px #fff;pointer-events:none">${escapeHtml(word)}</div>`;
}

/** `count` núm kéo mốc chia cho `#karaoke-mini-knobs` (`data-karaoke-knob` = chỉ số mốc). Núm vắt ngang mép dưới khung
 * sóng, tràn ra ngoài; vùng chạm 28px (chấm tròn thật 12px) cho dễ bắt bằng ngón tay. Chấm tròn là phần tử con ĐẦU TIÊN
 * (core/subtitle/subtitle-karaoke-drawer-ui.js::setKaraokeKnobGrabbed()). Vị trí do Workflow đặt (`_positionKaraokeKnobs()`).
 * @param {number} count */
function renderKaraokeKnobsHtml(count) {
    return Array.from({ length: count }, (_, i) => `<div data-karaoke-knob="${i}" style="position:absolute;left:0;top:0;width:28px;height:28px;margin-left:-14px;margin-top:-14px;display:flex;align-items:center;justify-content:center;touch-action:none;pointer-events:auto;cursor:ew-resize"><div style="width:12px;height:12px;box-sizing:border-box;border-radius:9999px;background:#f59e0b;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35);transition:transform .12s ease"></div></div>`).join('');
}
