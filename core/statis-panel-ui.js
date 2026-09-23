/**
 * core/statis-panel-ui.js — MỚI (Giang yêu cầu "tích hợp 1+2+3" cho panel Statis, App Panel tab
 * "Statis" — THAY hẳn placeholder "coming soon" cũ, xem components/statis-panel.js). Core-ui
 * (Rule 5c, hậu tố `-ui`) DÙNG CHUNG, CÙNG khuôn `buildGamePanelListHtml()` (core/gameplay/
 * game-panel-ui.js): hàm CHỈ dựng chuỗi HTML — KHÔNG `addEventListener` (gắn tương tác là việc của
 * Workflow, xem event/workflow/statis-panel.js), KHÔNG `appState.get()` (Rule 2) — mọi số liệu đã
 * TỔNG HỢP SẴN do Workflow tự đọc DB (`workflowPlaylistScope.listMediaRecords()`) + `mediaStatsMap`
 * (core/listen-stats.js) rồi truyền vào tham số dưới dạng object thuần (kể cả các con số PHẦN TRĂM
 * — Workflow tính sẵn, hàm này KHÔNG tự suy ra lại, cùng lý do "Core không tự sort/lọc").
 *
 * [SỬA 21/09/2026 — Giang yêu cầu "toàn bộ mục 4 + cải tiến UI theo khuyến nghị"] Bố cục lại theo
 * ĐÚNG 3 tầng, mỗi tầng có HEADING riêng (chỉ typography, không viền/card bao quanh) và chỉ trả lời
 * ĐÚNG 1 câu hỏi (panel này là stats của app nghe nhạc, KHÔNG phải dashboard doanh nghiệp — không
 * thêm chart/donut):
 *   1. Overview — "Đã dùng bao nhiêu?": 2 KPI card (Tổng thời gian / Tổng lượt phát) + 1 card rộng
 *      "Library played" (% thư viện đã phát + thanh tiến độ mảnh + "841 / 1,024 files" + "183 never
 *      played"). THAY ô "Never played" đơn độc cũ — ô đó vừa khác nghĩa (độ phủ thư viện, không
 *      phải mức dùng) vừa đang hiện `NaN` (đọc field `playedItemCount` Workflow không tạo).
 *   2. Media types — "Dùng loại nào nhiều?": 3 card Song/Video/Photo, mỗi card lấy TỶ TRỌNG % lượt
 *      phát làm số lớn nhất (nhìn 1 giây là thấy phân bổ) + thời gian + lượt phát + số file.
 *   3. Top media — "Cái nào đứng đầu?": segmented control Most played/Most time + chip lọc loại
 *      + Top list. Mỗi hàng: hạng (top 3 tô accent) · icon loại · tên · chỉ số CHÍNH (theo sortMode)
 *      kèm chỉ số PHỤ nhỏ ngay dưới (thêm ngữ cảnh mà không tăng số dòng của tên).
 *
 * Icon loại media (nốt nhạc/máy quay/ảnh) — path SVG outline chuẩn (Heroicons-style, CÙNG bộ path
 * đã dùng rải khắp project cho các icon khác, vd nút X đóng panel `M6 18L18 6M6 6l12 12`) — KHÔNG
 * phải ảnh/thumbnail thật: Giang chốt bỏ qua thumbnail cho Top list (tránh vòng đời Blob URL phải
 * tự quản lý/revoke mỗi lần re-render list — xem cách buildSongNode() làm, core/playlist/render.js
 * — phức tạp không tương xứng lợi ích cho 1 list chỉ cần "xem nhanh xếp hạng").
 *
 * `escapeHtml()` (core/modal-choice-ui.js) cho MỌI `name` — dữ liệu người dùng thật (tên file/tên
 * đã đổi qua "Sửa"), khác `game.id` (data TĨNH dev tự khai) ở game-panel-ui.js không cần escape.
 *
 * [SỬA 21/09/2026] Media types căn GIỮA toàn bộ nội dung card. Mọi con số (Overview, Media types, giá
 * trị Top list) bọc trong `<span data-countup="<số đích>" data-countup-fmt="int|time">` và thanh tiến
 * độ mang `data-countup-fmt="bar"` — Workflow (event/workflow/statis-panel.js) quét các thuộc tính này
 * để chạy animation đếm-lên lúc MỞ panel; hàm này KHÔNG animate gì, text luôn là số cuối.
 *
 * [SỬA 21/09/2026, Giang yêu cầu 2 việc] (1) Top media KHÔNG còn animation đếm-lên: giá trị mỗi hàng là text thường (không bọc
 * `data-countup`) — Overview/Media types vẫn đếm-lên như cũ. (2) Media types: THÊM biểu đồ tròn TO chia theo % lượt phát
 * (`buildStatisPlayShareChartHtml()`, nằm TRÊN 3 card) và BỎ dòng "số file" khỏi 3 card (đếm file là việc của Storage). Biểu đồ vẽ bằng
 * SVG thuần, mỗi lát là 1 `<circle>` stroke dày (`pathLength="100"` -> dasharray tính THẲNG theo %, không cần lượng giác cung tròn) và
 * lấy màu từ theme key `statTypeSong/Video/Photo` (fill/stroke = currentColor). Ghi chú cũ "không thêm chart/donut" ở trên là quyết định
 * trước đó của Giang — NAY ĐƯỢC CHÍNH Giang đổi.
 *
 * [SỬA 21/09/2026, Giang yêu cầu "icon switch ở phải tiêu đề Media types"] Tham số `shareMode` ('count' | 'totalTime'): biểu đồ tròn + % lớn của 3 card chia theo
 * LƯỢT PHÁT hay THỜI GIAN nghe (đọc `playShare*` hoặc `timeShare*` — Workflow tính sẵn cả 2 cặp); nút chuyển là 2 icon (play / đồng hồ) trong 1 pill nhỏ
 * `.statis-share-btn[data-share-mode]` ở phải tiêu đề, bắt bằng delegation ở event/listener/statis-panel.js.
 *
 * Cỡ chữ nhỏ (11px) khai bằng `style` inline, KHÔNG dùng class ngoặc vuông `text-[11px]` — Tailwind
 * Play CDN tiêm CSS cho class ngoặc vuông BẤT ĐỒNG BỘ, lần đầu dùng trong phiên có thể chưa kịp lên
 * style (bug lặp lại đã ghi ở Folder Browser/time-picker). Thanh tiến độ cũng vậy: chiều rộng % là
 * `style="width:..."` động, không thể là class Tailwind tĩnh.
 *
 * @typedef {{itemCount:number, playCount:number, totalTime:number, neverPlayedCount:number, playedItemCount:number, playedPercent:number}} StatisGrandTotal
 * @typedef {{itemCount:number, playCount:number, totalTime:number, playSharePercent:number}} StatisTypeTotal
 * @typedef {{key:string, mediaType:'song'|'video'|'photo', name:string, count:number, totalTime:number}} StatisTopItem
 */
const STATIS_TYPE_ICON_PATH = {
    song: 'M9 19V6l12-3v13M5 21a2 2 0 100-4 2 2 0 000 4zm12-2a2 2 0 100-4 2 2 0 000 4z', // nốt nhạc — CÙNG path fieldPlayCount đã dùng (core/playlist/actions.js)
    video: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', // máy quay
    photo: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', // ảnh
};
const STATIS_TYPE_ACCENT = {
    song: 'bg-indigo-500/15 text-indigo-500', // SỬA 21/09/2026 — nền pastel đặc (-100) -> lớp màu độ trong suốt 15%: gần như y hệt trên nền sáng, và không thành mảng pastel chói trên nền Dark
    video: 'bg-rose-500/15 text-rose-500',
    photo: 'bg-amber-500/15 text-amber-500',
};
const STATIS_TYPE_CHART_KEY = { song: 'statTypeSong', video: 'statTypeVideo', photo: 'statTypePhoto' }; // key theme màu lát cắt/chấm chú giải (core/ui-theme/*.js)
const STATIS_SMALL_TEXT_STYLE = 'font-size:11px; line-height:1.3;'; // cỡ chữ phụ — inline (xem docstring đầu file, lý do tránh `text-[11px]`)

/**
 * MỚI 21/09/2026 (Giang yêu cầu "biểu đồ hình tròn to chia theo % count/play ở Media type") — biểu đồ TRÒN ĐẶC (pie) tỷ trọng lượt phát
 * Song/Video/Photo, chỉ CHUỖI HTML/SVG (Rule 5, không listener, không appState). Kỹ thuật: mỗi lát = 1 `<circle r=24 stroke-width=48>`
 * (nét dày đúng bằng bán kính -> lấp kín thành hình đặc bán kính 48) với `pathLength="100"` nên `stroke-dasharray="<độ dài> <phần còn lại>"`
 * và `stroke-dashoffset="-<điểm bắt đầu>"` tính THẲNG theo % (không cần sin/cos cho cung). Xoay -90° để lát đầu bắt đầu từ 12 giờ, đi thuận
 * chiều kim đồng hồ theo thứ tự Song -> Video -> Photo (KHỚP thứ tự 3 card bên dưới). Có >1 lát thì chừa khe hở nhỏ giữa các lát.
 * Dùng `playShareRaw` (% CHƯA làm tròn, Workflow tính sẵn) chứ không dùng `playSharePercent` (đã làm tròn, tổng có thể 99/101 -> hở/chồng
 * lát); chữ % hiện trên lát (làm tròn để hiển thị) CHỈ khi lát >= 7% (lát mỏng hơn không đủ chỗ chứa chữ).
 * Tổng của chế độ đang chia = 0 -> trả '' (không có gì để chia; 3 card bên dưới vẫn hiện 0%).
 * @param {{song:StatisTypeTotal, video:StatisTypeTotal, photo:StatisTypeTotal}} byType - cần trường % CHƯA làm tròn (0..100) mỗi loại
 * @param {'playShareRaw'|'timeShareRaw'} shareRawKey - trường % dùng để chia (theo lượt phát / theo thời gian — SỬA 21/09/2026)
 * @param {string} ariaLabel - nhãn đọc màn hình (đã dịch)
 * @returns {string}
 */
function buildStatisPlayShareChartHtml(byType, shareRawKey, ariaLabel) {
    const TYPES = ['song', 'video', 'photo'];
    const slices = TYPES.map((mediaType) => ({ mediaType, share: Number(byType[mediaType][shareRawKey]) || 0 })).filter((s) => s.share > 0);
    if (slices.length === 0) return '';
    const GAP = slices.length > 1 ? 0.6 : 0; // đơn vị % chu vi — khe hở giữa 2 lát kề nhau
    let cursor = 0;
    let circlesHtml = '';
    let labelsHtml = '';
    for (const { mediaType, share } of slices) {
        const dash = Math.max(share - GAP, 0.01);
        const offset = cursor + GAP / 2;
        circlesHtml += `<circle cx="50" cy="50" r="24" fill="none" stroke="currentColor" stroke-width="48" pathLength="100" stroke-dasharray="${dash.toFixed(3)} ${(100 - dash).toFixed(3)}" stroke-dashoffset="${(-offset).toFixed(3)}" transform="rotate(-90 50 50)" data-uitk="${STATIS_TYPE_CHART_KEY[mediaType]}"/>`;
        if (share >= 7) {
            const angle = ((cursor + share / 2) / 100) * 2 * Math.PI - Math.PI / 2;
            const x = (50 + 30 * Math.cos(angle)).toFixed(2), y = (50 + 30 * Math.sin(angle)).toFixed(2);
            labelsHtml += `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="8" font-weight="700" fill="currentColor" data-uitk="statPieLabelText">${Math.round(share)}%</text>`;
        }
        cursor += share;
    }
    return `
        <div class="rounded-2xl p-4 mb-2 flex justify-center" data-uitk="cardBg">
            <svg viewBox="0 0 100 100" role="img" aria-label="${ariaLabel}" style="width:100%; max-width:260px; height:auto; display:block;">${circlesHtml}${labelsHtml}</svg>
        </div>`;
}

/**
 * @param {StatisGrandTotal} grandTotal - gộp CẢ 3 loại (itemCount = tổng số file toàn thư viện; neverPlayedCount/playedItemCount/playedPercent Workflow tự đếm/tính SẴN — KHÔNG suy ra lại ở đây, cùng lý do "Core không tự sort/lọc" ở tham số `topList` dưới).
 * @param {{song:StatisTypeTotal, video:StatisTypeTotal, photo:StatisTypeTotal}} byType - `playSharePercent` = tỷ trọng % lượt phát của loại đó trên TỔNG lượt phát (Workflow tính sẵn).
 * @param {StatisTopItem[]} topList - Workflow tự sort/filter/cắt TOP N SẴN theo `sortMode`/`filterType` (và CHỈ gồm item có dữ liệu theo tiêu chí đang sort) — hàm này CHỈ vẽ, không tự sort/lọc lại (Rule 3a: Core cấm gọi Core khác, và sort/filter dữ liệu domain-agnostic đã có core/playlist/order.js — không viết trùng ở đây).
 * @param {'count'|'totalTime'} sortMode
 * @param {'all'|'song'|'video'|'photo'} filterType
 * @param {'count'|'totalTime'} shareMode - MỚI 21/09/2026: chia % Media types theo lượt phát ('count') hay thời gian ('totalTime')
 * @param {function} t
 * @param {number} [rankOffset] - MỚI 23/09/2026 (nơi 'statisTopList' của Settings > System > Pagination):
 *        thứ hạng của phần tử ĐẦU `topList` trừ 1 (= view.startIndex) — trang 2 bắt đầu từ #21. Mặc định 0.
 * @param {number} [rankedTotal] - MỚI 23/09/2026: tổng số mục đã xếp hạng (cho chữ "Top N" ở tiêu đề) —
 *        khi phân trang `topList` chỉ là 1 trang nên không đếm được từ nó. Mặc định `topList.length`.
 * @param {string} [paginationHtml] - MỚI 23/09/2026: thanh phân trang Workflow dựng sẵn, đặt dưới danh
 *        sách (listener delegate trên `statisPanelBody` bắt nút). '' khi tắt/1 trang.
 * @returns {string}
 */
function buildStatisPanelBodyHtml(grandTotal, byType, topList, sortMode, filterType, shareMode, t, rankOffset, rankedTotal, paginationHtml) {
    const rankBase = rankOffset || 0;
    if (grandTotal.itemCount === 0) {
        return `<p class="text-sm text-center py-14" data-uitk="textSecondary" data-i18n="statisPanel.comingSoon">${t('statisPanel.comingSoon')}</p>`;
    }

    const fmtNum = (n) => Number(n || 0).toLocaleString(); // 1284 -> "1,284" (theo locale máy)
    // Bọc 1 con số vào <span data-countup> để Workflow đếm-lên lúc MỞ panel (event/workflow/statis-panel.js, dùng
    // core/number-countup.js). Text bên trong LUÔN là số cuối (không animation vẫn đúng); `fmt`: 'int' | 'time' (giây).
    const num = (value, fmt, text) => `<span data-countup="${value}" data-countup-fmt="${fmt}">${text}</span>`;
    // Heading của 1 khu — CHỈ typography (text-sm font-semibold), KHÔNG viền/card bao quanh; `rightHtml` (tuỳ chọn) là chú thích nhỏ căn phải.
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
    const shareRawKey = byTime ? 'timeShareRaw' : 'playShareRaw';
    const shareLabelKey = byTime ? 'statisPanel.compare.shareOfTime' : 'statisPanel.compare.shareOfPlays';
    const compareCards = ['song', 'video', 'photo'].map((mediaType) => {
        const totals = byType[mediaType];
        return `
            <div class="rounded-2xl p-3 flex-1 min-w-0 text-center" data-uitk="cardBg">
                <div class="flex items-center justify-center gap-1.5 mb-2">
                    <span class="w-2 h-2 rounded-full shrink-0 bg-current" data-uitk="${STATIS_TYPE_CHART_KEY[mediaType]}"></span>
                    <span class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${STATIS_TYPE_ACCENT[mediaType]}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="${STATIS_TYPE_ICON_PATH[mediaType]}"/></svg></span>
                    <span class="text-xs font-semibold truncate" data-uitk="textPrimary" data-i18n="statisPanel.type.${mediaType}">${t('statisPanel.type.' + mediaType)}</span>
                </div>
                <p class="text-2xl font-bold leading-none" data-uitk="textPrimary">${num(totals[sharePercentKey], 'int', totals[sharePercentKey])}<span class="text-sm font-semibold">%</span></p>
                <p class="mb-2" style="${STATIS_SMALL_TEXT_STYLE}" data-uitk="textSecondary" data-i18n="${shareLabelKey}">${t(shareLabelKey)}</p>
                <p class="text-xs font-semibold" data-uitk="textSecondaryStrong">${num(totals.totalTime, 'time', formatListenTime(totals.totalTime))}</p>
                <p style="${STATIS_SMALL_TEXT_STYLE}" data-uitk="textSecondary">${tFormat('statisPanel.compare.playCount', { n: num(totals.playCount, 'int', fmtNum(totals.playCount)) })}</p>
            </div>`;
    }).join('');

    // Nút chuyển cách chia % — pill 2 icon (play = theo lượt phát, đồng hồ = theo thời gian), icon đang chọn tô accent (CÙNG cách tô "đang chọn" của segmented sort/chip lọc).
    const shareSwitchIcon = { count: 'M5 3l14 9-14 9V3z', totalTime: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' }; // play (đặc) / đồng hồ (nét)
    const shareSwitchBtn = (mode, titleKey) => {
        const active = mode === shareMode;
        const fillAttrs = mode === 'count' ? 'fill="currentColor" stroke="none"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
        return `<button type="button" class="statis-share-btn w-7 h-6 rounded-md flex items-center justify-center transition-colors" data-uitk="${active ? 'btnPrimaryPillBg textOnAccent' : 'textSecondary'}" data-share-mode="${mode}" aria-pressed="${active}" title="${t(titleKey)}" aria-label="${t(titleKey)}"><svg viewBox="0 0 24 24" class="w-3.5 h-3.5" ${fillAttrs}><path d="${shareSwitchIcon[mode]}"/></svg></button>`;
    };
    const shareSwitch = `<div class="flex p-0.5 gap-0.5 rounded-lg" data-uitk="btnNeutralBg">${shareSwitchBtn('count', 'statisPanel.share.byPlays')}${shareSwitchBtn('totalTime', 'statisPanel.share.byTime')}</div>`;

    const mediaTypes = `
        <section class="mb-6">
            ${sectionHeading('statisPanel.section.mediaTypes', shareSwitch)}
            ${buildStatisPlayShareChartHtml(byType, shareRawKey, t('statisPanel.section.mediaTypes'))}
            <div class="flex gap-2">${compareCards}</div>
        </section>`;

    // ===== Tầng 3 — Top media (segmented sort + chip lọc + list) =====
    // Segmented control: nền track chung (btnNeutralBg), nút đang chọn tô sky đặc — CÙNG cách tô "đang chọn" của chip lọc bên dưới.
    const sortToggle = ['count', 'totalTime'].map((mode) => {
        const active = mode === sortMode;
        const labelKey = mode === 'count' ? 'statisPanel.sort.byCount' : 'statisPanel.sort.byTime';
        return `<button type="button" class="statis-sort-btn flex-1 h-8 rounded-lg text-xs font-semibold transition-colors ${active ? 'shadow-sm' : ''}" data-uitk="${active ? 'btnPrimaryPillBg textOnAccent' : 'textSecondary'}" data-sort-mode="${mode}" data-i18n="${labelKey}">${t(labelKey)}</button>`;
    }).join('');

    const filterChips = ['all', 'song', 'video', 'photo'].map((type) => {
        const active = type === filterType;
        return `<button type="button" class="statis-filter-btn shrink-0 h-8 px-3 rounded-full text-xs font-semibold transition-colors " data-uitk="${active ? 'btnPrimaryPillBg textOnAccent' : 'btnNeutralBg btnNeutralText'}" data-filter-type="${type}" data-i18n="statisPanel.type.${type}">${t('statisPanel.type.' + type)}</button>`;
    }).join('');

    // Empty state THEO LOẠI (Workflow đã lọc bỏ item chưa có dữ liệu ở tiêu chí đang sort -> list rỗng nghĩa là "chưa có gì được phát ở loại này").
    const emptyKey = 'statisPanel.topList.empty.' + filterType;
    const listRows = topList.length === 0
        ? `<p class="text-sm text-center py-10" data-uitk="emptyStateText" data-i18n="${emptyKey}">${t(emptyKey)}</p>`
        : topList.map((item, index) => {
            const playsText = tFormat('statisPanel.compare.playCount', { n: fmtNum(item.count) }); // SỬA 21/09/2026 — text thường, KHÔNG `num()`/data-countup: Top media không còn animation đếm-lên
            const timeText = formatListenTime(item.totalTime);
            const primary = sortMode === 'count' ? playsText : timeText; // chỉ số CHÍNH — đúng tiêu chí đang sort
            const secondary = sortMode === 'count' ? timeText : playsText; // chỉ số PHỤ — ngữ cảnh còn thiếu của chỉ số chính
            return `
                <div class="flex items-center gap-2.5 py-2 border-b last:border-b-0" data-uitk="dividerBorder">
                    <span class="text-xs font-bold text-center shrink-0" style="min-width:20px;" data-uitk="${rankBase + index < 3 ? 'accentText' : 'textSecondary'}">${rankBase + index + 1}</span>
                    <span class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${STATIS_TYPE_ACCENT[item.mediaType]}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="${STATIS_TYPE_ICON_PATH[item.mediaType]}"/></svg></span>
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

/**
 * Skeleton "đang tải" — MỚI 21/09/2026 (Giang yêu cầu "làm nốt"), THAY placeholder chữ "Loading stats…"
 * ở `workflowStatisPanel.openPanel()`. Cùng heading + cùng kích cỡ khối với bố cục thật của
 * `buildStatisPanelBodyHtml()` (Overview 2+1 khối · Media types 3 khối · Top media: segmented + chip +
 * 5 hàng) nên lúc dữ liệu về không bị nhảy layout. Cũng CHỈ dựng chuỗi HTML (Rule 5), không listener,
 * không `appState.get()`. Chiều cao khối khai `style` inline (tránh class ngoặc vuông, xem docstring
 * đầu file); nhấp nháy bằng class chuẩn `animate-pulse`.
 * @param {function} t
 * @returns {string}
 */
function buildStatisPanelSkeletonHtml(t) {
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
