/**
 * components/statis-panel.js — Statistics, ngang cấp Game (bottom nav App Panel). Khung tĩnh `TPL_STATIS_PANEL` (header +
 * nút Close + `#statis-panel-body` rỗng) mount lúc boot; nội dung động dựng bởi các hàm render*() dưới đây, đổ vào body qua
 * core/statis-panel-ui.js (event/workflow/statis-panel.js).
 *
 * NẠP SAU: lang/lang.js (t, tFormat), core/ui-theme/icon-svg-ui.js (iconSvg). Dùng lúc runtime: escapeHtml()
 * (core/modal-choice-ui.js), formatListenTime() (core/listen-stats.js).
 */
const TPL_STATIS_PANEL = `
    <div id="statis-panel" class="hidden flex flex-col" style="z-index: 128;" data-uitk="panelBg">
        <div class="relative shrink-0 flex items-center justify-center px-14 sm:px-16 h-14" data-uitk="headerBorder">
            <h2 class="text-base sm:text-lg truncate text-center" data-uitk="headerTitle" data-i18n="statisPanel.title">${t('statisPanel.title')}</h2>
            <button id="btn-statis-panel-close" class="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full transition-colors shrink-0" data-uitk="headerCloseHover headerCloseIcon">${iconSvg('x', 'h-5 w-5')}</button>
        </div>
        <div id="statis-panel-body" class="flex-1 overflow-y-auto pt-4 px-4 pb-6"></div>
    </div>
`;

const STATIS_TYPE_ICON_NAME = { // tên icon trong assets/icon/icons.js
    song: 'music-notes',
    video: 'video-camera', // máy quay
    photo: 'photograph', // ảnh
};
const STATIS_TYPE_ACCENT = {
    song: 'bg-indigo-500/15 text-indigo-500', // lớp màu trong suốt 15% — không thành mảng pastel chói trên nền Dark
    video: 'bg-rose-500/15 text-rose-500',
    photo: 'bg-amber-500/15 text-amber-500',
};
const STATIS_TYPE_CHART_KEY = { song: 'statTypeSong', video: 'statTypeVideo', photo: 'statTypePhoto' }; // key theme màu lát cắt/chấm chú giải (core/ui-theme/*.js)
const STATIS_SMALL_TEXT_STYLE = 'font-size:11px; line-height:1.3;'; // cỡ chữ phụ inline — class ngoặc vuông `text-[11px]` có thể chưa kịp lên style lần đầu

/** Biểu đồ tròn đặc tỷ trọng Media types (SVG thuần, màu lát theo theme key). Không lát nào -> ''.
 * @param {{slices: Array<{mediaType:string, dashArray:string, dashOffset:string}>, labels: Array<{x:string, y:string, text:string}>}} chart -
 *        computeStatisShareChart() (core/statis-panel.js) @param {string} ariaLabel @returns {string} */
function renderStatisShareChartHtml(chart, ariaLabel) {
    if (chart.slices.length === 0) return '';
    const circlesHtml = chart.slices.map((s) => `<circle cx="50" cy="50" r="24" fill="none" stroke="currentColor" stroke-width="48" pathLength="100" stroke-dasharray="${s.dashArray}" stroke-dashoffset="${s.dashOffset}" transform="rotate(-90 50 50)" data-uitk="${STATIS_TYPE_CHART_KEY[s.mediaType]}"/>`).join('');
    const labelsHtml = chart.labels.map((l) => `<text x="${l.x}" y="${l.y}" text-anchor="middle" dominant-baseline="central" font-size="8" font-weight="700" fill="currentColor" data-uitk="statPieLabelText">${l.text}</text>`).join('');
    return `
        <div class="rounded-2xl p-4 mb-2 flex justify-center" data-uitk="cardBg">
            <svg viewBox="0 0 100 100" role="img" aria-label="${ariaLabel}" style="width:100%; max-width:260px; height:auto; display:block;">${circlesHtml}${labelsHtml}</svg>
        </div>`;
}

/**
 * Nội dung panel Statistics, 3 tầng (mỗi tầng 1 heading, 1 câu hỏi):
 *   1. Overview — 2 KPI (tổng thời gian / tổng lượt phát) + "Library played" (% thư viện đã phát + thanh tiến độ).
 *   2. Media types — biểu đồ tròn + 3 card Song/Video/Photo; chia % theo lượt phát hoặc thời gian (`shareMode`, nút pill
 *      `.statis-share-btn[data-share-mode]` ở phải tiêu đề).
 *   3. Top media — segmented sort `.statis-sort-btn` + chip lọc `.statis-filter-btn` + danh sách (hạng · icon loại · tên ·
 *      chỉ số chính theo sortMode + chỉ số phụ).
 * Số Overview/Media types bọc `data-countup` (Workflow đếm-lên lúc mở); thanh tiến độ `data-countup-fmt="bar"`. Mọi số liệu do
 * Workflow tổng hợp sẵn (core/statis-panel.js) — template chỉ dựng chuỗi. Tên item là dữ liệu người dùng -> escapeHtml().
 * @param {{grandTotal: object, byType: object, topList: object[], sortMode: 'count'|'totalTime', filterType: string,
 *          shareMode: 'count'|'totalTime', rankOffset?: number, rankedTotal?: number, paginationHtml?: string, chart: object}} data
 *        `rankOffset` = view.startIndex của trang Top list; `rankedTotal` = tổng mục đã xếp hạng (chữ "Top N"); `chart` =
 *        computeStatisShareChart().
 * @returns {string}
 */
function renderStatisPanelBodyHtml({ grandTotal, byType, topList, sortMode, filterType, shareMode, rankOffset, rankedTotal, paginationHtml, chart }) {
    const rankBase = rankOffset || 0;
    if (grandTotal.itemCount === 0) {
        return `<p class="text-sm text-center py-14" data-uitk="textSecondary" data-i18n="statisPanel.comingSoon">${t('statisPanel.comingSoon')}</p>`;
    }

    const fmtNum = (n) => Number(n || 0).toLocaleString(); // 1284 -> "1,284" (theo locale máy)
    // <span data-countup> để Workflow đếm-lên lúc mở panel; text bên trong luôn là số cuối. `fmt`: 'int' | 'time' (giây).
    const num = (value, fmt, text) => `<span data-countup="${value}" data-countup-fmt="${fmt}">${text}</span>`;
    // Heading của 1 khu — chỉ typography; `rightHtml` (tuỳ chọn) căn phải.
    const sectionHeading = (i18nKey, rightHtml) => `
        <div class="flex items-baseline justify-between mb-2">
            <h3 class="text-sm font-semibold" data-uitk="textPrimary" data-i18n="${i18nKey}">${t(i18nKey)}</h3>
            ${rightHtml || ''}
        </div>`;

    // ===== Tầng 1 — Overview =====
    const overview = `
        <section class="mb-6">
            ${sectionHeading('statisPanel.section.overview')}
            <div class="grid grid-cols-2 gap-2 mb-2">
                <div class="rounded-2xl p-3" data-uitk="cardBg">
                    <p style="${STATIS_SMALL_TEXT_STYLE}" data-uitk="textSecondary" data-i18n="statisPanel.overview.totalTime">${t('statisPanel.overview.totalTime')}</p>
                    <p class="text-2xl font-bold leading-tight mt-1" data-uitk="textPrimary">${num(grandTotal.totalTime, 'time', formatListenTime(grandTotal.totalTime))}</p>
                </div>
                <div class="rounded-2xl p-3" data-uitk="cardBg">
                    <p style="${STATIS_SMALL_TEXT_STYLE}" data-uitk="textSecondary" data-i18n="statisPanel.overview.totalPlays">${t('statisPanel.overview.totalPlays')}</p>
                    <p class="text-2xl font-bold leading-tight mt-1" data-uitk="textPrimary">${num(grandTotal.playCount, 'int', fmtNum(grandTotal.playCount))}</p>
                </div>
            </div>
            <div class="rounded-2xl p-3" data-uitk="cardBg">
                <div class="flex items-end justify-between gap-3">
                    <div class="min-w-0">
                        <p style="${STATIS_SMALL_TEXT_STYLE}" data-uitk="textSecondary" data-i18n="statisPanel.overview.libraryPlayed">${t('statisPanel.overview.libraryPlayed')}</p>
                        <p class="text-2xl font-bold leading-tight mt-1" data-uitk="textPrimary">${num(grandTotal.playedPercent, 'int', grandTotal.playedPercent)}<span class="text-base font-semibold">%</span></p>
                    </div>
                    <div class="text-right shrink-0" style="${STATIS_SMALL_TEXT_STYLE}" data-uitk="textSecondary">
                        <p>${tFormat('statisPanel.overview.filesPlayed', { played: num(grandTotal.playedItemCount, 'int', fmtNum(grandTotal.playedItemCount)), total: num(grandTotal.itemCount, 'int', fmtNum(grandTotal.itemCount)) })}</p>
                        <p>${tFormat('statisPanel.overview.neverPlayedCount', { n: num(grandTotal.neverPlayedCount, 'int', fmtNum(grandTotal.neverPlayedCount)) })}</p>
                    </div>
                </div>
                <div class="mt-3 rounded-full overflow-hidden" style="height:6px;" data-uitk="progressTrackBg">
                    <div class="h-full rounded-full" data-uitk="progressFillBg" style="width:${grandTotal.playedPercent}%;" data-countup="${grandTotal.playedPercent}" data-countup-fmt="bar"></div>
                </div>
            </div>
        </section>`;

    // ===== Tầng 2 — Media types =====
    const byTime = shareMode === 'totalTime';
    const sharePercentKey = byTime ? 'timeSharePercent' : 'playSharePercent';
    const shareLabelKey = byTime ? 'statisPanel.compare.shareOfTime' : 'statisPanel.compare.shareOfPlays';
    const compareCards = ['song', 'video', 'photo'].map((mediaType) => {
        const totals = byType[mediaType];
        return `
            <div class="rounded-2xl p-3 flex-1 min-w-0 text-center" data-uitk="cardBg">
                <div class="flex items-center justify-center gap-1.5 mb-2">
                    <span class="w-2 h-2 rounded-full shrink-0 bg-current" data-uitk="${STATIS_TYPE_CHART_KEY[mediaType]}"></span>
                    <span class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${STATIS_TYPE_ACCENT[mediaType]}">${iconSvg(STATIS_TYPE_ICON_NAME[mediaType], 'w-3.5 h-3.5')}</span>
                    <span class="text-xs font-semibold truncate" data-uitk="textPrimary" data-i18n="statisPanel.type.${mediaType}">${t('statisPanel.type.' + mediaType)}</span>
                </div>
                <p class="text-2xl font-bold leading-none" data-uitk="textPrimary">${num(totals[sharePercentKey], 'int', totals[sharePercentKey])}<span class="text-sm font-semibold">%</span></p>
                <p class="mb-2" style="${STATIS_SMALL_TEXT_STYLE}" data-uitk="textSecondary" data-i18n="${shareLabelKey}">${t(shareLabelKey)}</p>
                <p class="text-xs font-semibold" data-uitk="textSecondaryStrong">${num(totals.totalTime, 'time', formatListenTime(totals.totalTime))}</p>
                <p style="${STATIS_SMALL_TEXT_STYLE}" data-uitk="textSecondary">${tFormat('statisPanel.compare.playCount', { n: num(totals.playCount, 'int', fmtNum(totals.playCount)) })}</p>
            </div>`;
    }).join('');

    // Nút chuyển cách chia % — pill 2 icon (play = lượt phát, đồng hồ = thời gian), icon đang chọn tô accent.
    const shareSwitchIcon = { count: 'play', totalTime: 'clock' }; // play (đặc) / đồng hồ (nét)
    const shareSwitchBtn = (mode, titleKey) => {
        const active = mode === shareMode;
        return `<button type="button" class="statis-share-btn w-7 h-6 rounded-md flex items-center justify-center transition-colors" data-uitk="${active ? 'btnPrimaryPillBg textOnAccent' : 'textSecondary'}" data-share-mode="${mode}" aria-pressed="${active}" title="${t(titleKey)}" aria-label="${t(titleKey)}">${iconSvg(shareSwitchIcon[mode], 'w-3.5 h-3.5')}</button>`;
    };
    const shareSwitch = `<div class="flex p-0.5 gap-0.5 rounded-lg" data-uitk="btnNeutralBg">${shareSwitchBtn('count', 'statisPanel.share.byPlays')}${shareSwitchBtn('totalTime', 'statisPanel.share.byTime')}</div>`;

    const mediaTypes = `
        <section class="mb-6">
            ${sectionHeading('statisPanel.section.mediaTypes', shareSwitch)}
            ${renderStatisShareChartHtml(chart, t('statisPanel.section.mediaTypes'))}
            <div class="flex gap-2">${compareCards}</div>
        </section>`;

    // ===== Tầng 3 — Top media (segmented sort + chip lọc + list) =====
    const sortToggle = ['count', 'totalTime'].map((mode) => {
        const active = mode === sortMode;
        const labelKey = mode === 'count' ? 'statisPanel.sort.byCount' : 'statisPanel.sort.byTime';
        return `<button type="button" class="statis-sort-btn flex-1 h-8 rounded-lg text-xs font-semibold transition-colors ${active ? 'shadow-sm' : ''}" data-uitk="${active ? 'btnPrimaryPillBg textOnAccent' : 'textSecondary'}" data-sort-mode="${mode}" data-i18n="${labelKey}">${t(labelKey)}</button>`;
    }).join('');

    const filterChips = ['all', 'song', 'video', 'photo'].map((type) => {
        const active = type === filterType;
        return `<button type="button" class="statis-filter-btn shrink-0 h-8 px-3 rounded-full text-xs font-semibold transition-colors " data-uitk="${active ? 'btnPrimaryPillBg textOnAccent' : 'btnNeutralBg btnNeutralText'}" data-filter-type="${type}" data-i18n="statisPanel.type.${type}">${t('statisPanel.type.' + type)}</button>`;
    }).join('');

    // Empty state theo loại (list chỉ gồm item có dữ liệu ở tiêu chí đang sort).
    const emptyKey = 'statisPanel.topList.empty.' + filterType;
    const listRows = topList.length === 0
        ? `<p class="text-sm text-center py-10" data-uitk="emptyStateText" data-i18n="${emptyKey}">${t(emptyKey)}</p>`
        : topList.map((item, index) => {
            const playsText = tFormat('statisPanel.compare.playCount', { n: fmtNum(item.count) }); // text thường — Top media không đếm-lên
            const timeText = formatListenTime(item.totalTime);
            const primary = sortMode === 'count' ? playsText : timeText; // chỉ số CHÍNH — đúng tiêu chí đang sort
            const secondary = sortMode === 'count' ? timeText : playsText; // chỉ số PHỤ — ngữ cảnh còn thiếu của chỉ số chính
            return `
                <div class="flex items-center gap-2.5 py-2 border-b last:border-b-0" data-uitk="dividerBorder">
                    <span class="text-xs font-bold text-center shrink-0" style="min-width:20px;" data-uitk="${rankBase + index < 3 ? 'accentText' : 'textSecondary'}">${rankBase + index + 1}</span>
                    <span class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${STATIS_TYPE_ACCENT[item.mediaType]}">${iconSvg(STATIS_TYPE_ICON_NAME[item.mediaType], 'w-4 h-4')}</span>
                    <span class="flex-1 min-w-0 text-sm truncate" data-uitk="textPrimary">${escapeHtml(item.name)}</span>
                    <span class="shrink-0 text-right">
                        <span class="block text-xs font-semibold" data-uitk="textPrimary">${primary}</span>
                        <span class="block" style="${STATIS_SMALL_TEXT_STYLE}" data-uitk="textSecondary">${secondary}</span>
                    </span>
                </div>`;
        }).join('');

    const topHint = topList.length === 0 ? '' : `<span style="${STATIS_SMALL_TEXT_STYLE}" data-uitk="textSecondary">${tFormat('statisPanel.topList.hint', { n: rankedTotal == null ? topList.length : rankedTotal })}</span>`;
    const topMedia = `
        <section>
            ${sectionHeading('statisPanel.section.topMedia', topHint)}
            <div class="flex p-1 gap-1 rounded-xl mb-2" data-uitk="btnNeutralBg">${sortToggle}</div>
            <div class="flex gap-1.5 mb-2 overflow-x-auto pb-0.5">${filterChips}</div>
            <div>${listRows}</div>
            ${paginationHtml || ''}
        </section>`;

    return overview + mediaTypes + topMedia;
}

/** Skeleton "đang tải" — cùng heading + kích cỡ khối với bố cục thật nên lúc dữ liệu về không nhảy layout. @returns {string} */
function renderStatisPanelSkeletonHtml() {
    const block = (heightPx, extraClass) => `<div class="rounded-2xl ${extraClass || ''}" style="height:${heightPx}px;" data-uitk="cardBg"></div>`;
    const heading = (i18nKey) => `<h3 class="text-sm font-semibold mb-2" data-uitk="textPrimary" data-i18n="${i18nKey}">${t(i18nKey)}</h3>`;
    const rows = [1, 2, 3, 4, 5].map(() => `<div class="flex items-center gap-2.5 py-2"><div class="w-7 h-7 rounded-full shrink-0" data-uitk="cardBg"></div><div class="flex-1 rounded-lg" style="height:14px;" data-uitk="cardBg"></div><div class="rounded-lg shrink-0" style="height:14px; width:56px;" data-uitk="cardBg"></div></div>`).join('');

    return `
        <div class="animate-pulse" aria-busy="true">
            <section class="mb-6">
                ${heading('statisPanel.section.overview')}
                <div class="grid grid-cols-2 gap-2 mb-2">${block(64)}${block(64)}</div>
                ${block(84)}
            </section>
            <section class="mb-6">
                ${heading('statisPanel.section.mediaTypes')}
                <div class="rounded-2xl mb-2 flex justify-center p-4" data-uitk="cardBg"><div class="rounded-full" style="width:100%; max-width:228px; aspect-ratio:1 / 1;" data-uitk="cardBg"></div></div>
                <div class="flex gap-2">${block(112, 'flex-1')}${block(112, 'flex-1')}${block(112, 'flex-1')}</div>
            </section>
            <section>
                ${heading('statisPanel.section.topMedia')}
                ${block(40, 'mb-2')}
                <div class="flex gap-1.5 mb-2">${['w-12', 'w-14', 'w-14', 'w-14'].map((w) => `<div class="h-8 rounded-full ${w}" data-uitk="cardBg"></div>`).join('')}</div>
                ${rows}
            </section>
        </div>`;
}
