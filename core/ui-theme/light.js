/**
 * core/ui-theme/light.js — Bộ theme "Light" — bản GỐC/chuẩn (mọi theme khác soi theo bộ KEY này,
 * xem docstring registry.js). Toàn bộ giá trị lấy TRỰC TIẾP từ styling THẬT đang chạy của Generic
 * Drawer + các tính năng dùng nó làm mẫu chung (Folder Browser, EQ Presets, Custom Effect, Element
 * Style Editor, Settings...) — xem đợt audit + xử lý triệt để dark cũ (09/09/2026) ngay trước đây.
 * KHÔNG bịa màu mới — mỗi key dưới đây trỏ ĐÚNG class đang thấy ở UI thật hôm nay.
 *
 * KHÔNG liên quan `viz.themeMode` ('light'|'dark'|'background'|'gradient', event/workflow/theme.js)
 * — field đó đổi ảnh/màu nền PHÍA SAU Playlist/Visualizer, KHÁC HẲN UI Theme ở đây (màu app THẬT:
 * panel/card/text/nút bấm). 2 domain config riêng, xem DEFAULT_UI_THEME_CONFIG (core/config.js).
 *
 * QUY ƯỚC KEY LIST — mỗi key trỏ 1 CHUỖI class Tailwind (có thể nhiều class cách nhau bằng space,
 * gộp mọi utility cần cho ĐÚNG 1 vai trò UI, vd `btnPrimaryHover` gộp cả `hover:bg-sky-400` lẫn
 * `transition-colors` nếu cả 2 luôn đi cùng nhau). Element dùng key nào gắn `data-uitk="<key>"` —
 * `applyUiThemeToDom()` (core/ui-theme/apply-ui.js) tự đọc key này + gán `className` tương ứng theo
 * theme đang active, xem event/workflow/ui-theme.js::switchUiTheme().
 *
 * PHẠM VI: mọi màn App Panel + UI phía Visualizer (Bottom Player, nút tròn trên cùng, Control Center, HUD) đã gắn
 * `data-uitk`; phần còn class cứng xem "CÒN NỢ" cuối file.
 *
 * Tailwind build sẵn (assets/css/tailwind.css) — tailwind.config.js quét cả file này, nên class viết NGUYÊN VẸN ở đây
 * tự có CSS. Thêm class chưa từng xuất hiện trong project thì build lại Tailwind (readme/tailwind-build.md).
 */
const UI_THEME_LIGHT = {

    // ===================== Bề mặt (panel/card/overlay) =====================
    // `overlay*` CỐ Ý áp dụng CHUNG, KHÔNG đổi theo theme (Giang chỉ định rõ — lớp phủ mờ phía sau
    // Generic Drawer là "làm tối phần còn lại của app", ý nghĩa đó không đổi dù panel đang theme
    // nào) — vẫn khai ở đây để có 1 nguồn duy nhất, nhưng Dark/Morphin PHẢI copy y hệt giá trị này,
    // không được đổi khác.
    appBaseBg: 'bg-white', // MỚI 21/09/2026 — nền đặc của body/#app-bg (TÁCH khỏi panelBg: Morphin dùng kính có backdrop-filter cho panelBg, không đặt lên body được)
    panelBg: 'bg-white',
    panelFlushBg: 'bg-white', // MỚI 21/09/2026 — panel TOÀN MÀN (sát mép màn hình, vd Playlist chính) — Light/Dark KHÔNG có viền nên = panelBg; Morphin bỏ viền kính (xem morphin.js)
    panelShadow: 'shadow-2xl',
    dragHandleBg: 'bg-slate-300', // thanh nhỏ đầu panel gợi ý kéo — KHÔNG phải toggle, tách riêng key dù trùng giá trị toggleTrackOff
    modalCardBg: 'bg-white',       // card modalChoice/alertModal + mọi modal tĩnh (song-edit/playback-error/rename-folder...) — MỞ RỘNG 09/09/2026, trước đây các modal này đứng ngoài hệ theme
    modalCardBorder: 'border border-slate-200',
    modalTitleText: 'text-slate-900 font-bold',
    modalBodyText: 'text-slate-900',
    overlayBg: 'bg-black/50',

    // ===================== Card / hàng nội dung =====================
    cardBg: 'bg-slate-50',
    cardBorder: 'border border-slate-200',
    cardHoverBg: 'hover:bg-slate-100 transition-colors',
    dividerBorder: 'border-slate-200', // dùng cho border-b/border-t giữa các hàng trong 1 card
    dashedBorder: 'border-slate-300', // viền nét đứt (tile "Tạo mới")

    // ===================== Chữ =====================
    textPrimary: 'text-slate-900',   // tiêu đề, giá trị chính, số liệu nổi bật
    textSecondary: 'text-slate-500', // label phụ, hint, giá trị phụ
    textMutedIcon: 'text-slate-400', // icon/chevron thuần trang trí (KHÔNG phải văn bản đọc được)
    textSecondaryStrong: 'text-slate-700', // nhãn phụ nhưng cần NỔI hơn textSecondary (tên tile, tên hàng danh sách)
    textOnAccent: 'text-white',      // chữ/icon nằm TRÊN nền màu đặc (nút chính, badge...)

    // ===================== Header Generic Drawer =====================
    headerBorder: 'border-b border-slate-200',
    headerTitle: 'text-slate-900 font-bold',
    headerCloseHover: 'hover:bg-slate-100 transition-colors',
    headerCloseIcon: 'text-slate-500',

    // ===================== Nút bấm =====================
    // "Primary" (CTA chính, rounded-xl, khối to — Storage Thực hiện/Xoá/EQ Download...).
    btnPrimaryBg: 'bg-sky-600',
    btnPrimaryHoverBg: 'hover:bg-sky-500 transition-colors',
    // "PrimaryPill" (pill nhỏ rounded-full, vd nút Lưu preset EQ/Motion — CÙNG vai trò "chính" nhưng
    // 1 bậc sáng hơn, khác ngữ cảnh kích thước — GIỮ 2 biến thể riêng thay vì gộp 1, đúng 2 cách
    // dùng khác nhau đang có thật trong app).
    btnPrimaryPillBg: 'bg-sky-500',
    btnPrimaryPillHoverBg: 'hover:bg-sky-400 transition-colors',
    // "Destructive" (Xoá).
    btnDestructiveBg: 'bg-rose-600',
    btnDestructiveHoverBg: 'hover:bg-rose-500 transition-colors',
    // "Caution" (hành động rủi ro vừa — Format/Thực thi quét).
    btnCautionBg: 'bg-amber-600',
    btnCautionHoverBg: 'hover:bg-amber-500 transition-colors',
    // "Neutral" (Huỷ/trung tính, nền xám nhạt).
    btnNeutralBg: 'bg-slate-100',
    btnNeutralHoverBg: 'hover:bg-slate-200 transition-colors',
    btnNeutralText: 'text-slate-700',
    // "Ghost" (nút icon thuần, không nền lúc nghỉ, chỉ hiện nền lúc hover — nút đóng, 3 chấm...).
    btnGhostHoverBg: 'hover:bg-slate-100 transition-colors',

    // ===================== Nhấn/accent (icon nổi bật, link, viền chọn) =====================
    accentText: 'text-sky-600',
    accentTextSoft: 'text-sky-500',
    accentIconBoxBg: 'bg-sky-100',
    accentIconBoxText: 'text-sky-600',
    rowActiveBg: 'bg-sky-50',       // hàng/tile đang được CHỌN LÀM ACTIVE (khác accentRingSelected — đây là NỀN đặc, dùng cho danh sách preset EQ/Motion/Playlist Filter)
    rowActiveBorder: 'border border-sky-300',
    accentRingSelected: 'ring-2 ring-sky-500', // viền tile đang chọn (multi-select)
    destructiveText: 'text-rose-500',          // nhãn/label CHỮ mang ý xoá (không phải nút nền đặc)
    menuDestructiveItem: 'text-rose-500 hover:bg-rose-50 transition-colors', // MỚI 21/09/2026 — hàng "Xoá" trong menu nổi (chữ + nền hover đi liền, 1 key; = destructiveText + hoverDestructiveBg cũ, Light không đổi)
    statTypeSong: 'text-indigo-500', // MỚI 21/09/2026 — màu Song/Video/Photo cho BIỂU ĐỒ TRÒN + chấm chú giải ở Statistics (fill/bg-current theo color; badge icon của Top list vẫn hardcode — xem STATIS_TYPE_ACCENT)
    statTypeVideo: 'text-rose-500',
    statTypePhoto: 'text-amber-500',
    statPieLabelText: 'text-white', // chữ % đè lên lát cắt biểu đồ tròn

    // ===================== Toggle switch (peer/after markup dùng chung) =====================
    toggleTrackOff: 'bg-slate-300',
    toggleTrackOn: 'peer-checked:bg-sky-500', // SỬA 21/09/2026 — dạng `peer-checked:` (đi cùng toggleTrackOff trên CÙNG phần tử track): bật -> đổi nền; trước đây 'bg-...' không ai dùng

    // ===================== Input / select =====================
    inputBg: 'bg-white',
    inputBorder: 'border border-slate-300',
    inputText: 'text-slate-900',
    inputBorderFocus: 'border-sky-400', // viền input đang active/đang sửa (khác border tĩnh inputBorder)
    searchBoxSurface: 'bg-white border border-slate-300', // MỚI 21/09/2026 — nền+viền khung tìm kiếm Playlist (= inputBg + inputBorder, Light không đổi); Morphin đổi sang kính khớp nút Phát/Trộn bài
    inputPlaceholder: 'placeholder-slate-400', // MỚI 21/09/2026 — màu placeholder của ô nhập (trước là class cứng placeholder-slate-400 trong playlist-view.js)
    navInactiveText: 'text-slate-400', // MỚI 21/09/2026 — chữ+icon nút bottom nav KHÔNG active (= textMutedIcon cũ, Light không đổi); tách key vì nhãn nav là VĂN BẢN đọc được, Morphin cần rõ hơn textMutedIcon (white/50)

    // ===================== Trạng thái rỗng =====================
    emptyStateText: 'text-slate-500',

    // ===================== Thanh tiến độ =====================
    // MỚI 21/09/2026 — nền (track) của thanh tiến độ mảnh (card "Library played" ở panel Statistics, xem core/statis-panel-ui.js). Phần tô (fill) dùng sky đặc trực tiếp, cùng cách tô "đang chọn" của chip lọc trong panel.
    progressTrackBg: 'bg-slate-200',
    progressFillBg: 'bg-sky-500', // phần tô (fill) của thanh tiến độ — MỚI 21/09/2026, đi cùng progressTrackBg (Dark đổi sang tím)

    // ===================== Tab pill (segmented) =====================
    // MỚI 21/09/2026 — trạng thái ĐANG CHỌN của tab pill trong modal Chi tiết/Sửa (components/playlist-view.js,
    // `.song-edit-tab-btn`): dựa vào thuộc tính `aria-selected="true"` (variant `aria-selected:` chuẩn của Tailwind
    // 3.2+, độ ưu tiên CSS cao hơn class thường) thay vì bật/tắt class màu bằng JS — nên KHÔNG còn xung đột với
    // class màu do `data-uitk` áp (nguyên nhân chữ trắng trên nền trắng cũ, xem setSongEditTab() core/playlist/actions.js).
    // Đi CÙNG `textSecondary` (màu chữ lúc KHÔNG chọn) trên cùng phần tử.
    segmentTabActive: 'aria-selected:bg-white aria-selected:text-slate-900 aria-selected:shadow',

    // ===================== Tương tác/accent mở rộng (MỚI 21/09/2026 — chuẩn hoá drawer Motion/Filter/Storage + hàng Playlist) =====================
    // Mỗi key gộp ĐÚNG chuỗi class Light đang chạy thật ở các drawer/hàng (Light KHÔNG đổi), Dark/Morphin đổi tím/kính. Key dạng nút
    // có hover/nền/chữ đi liền nhau (btnAccentSoft, iconBtn*) gắn MỘT lần `data-uitk="..."`, không rải class màu cứng.
    btnAccentSoft: 'bg-sky-50 hover:bg-sky-100 transition-colors text-sky-600',
    accentSoftBorder: 'border border-sky-200',
    btnCautionSoft: 'bg-amber-50 hover:bg-amber-100 text-amber-600 transition-colors',
    btnDestructiveSoft: 'bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors',
    iconBtnAccent: 'text-slate-500 hover:text-sky-500 hover:bg-sky-50 transition-colors',
    iconBtnDestructive: 'text-slate-500 hover:text-rose-500 hover:bg-rose-50 transition-colors',
    iconBtnCaution: 'text-slate-500 hover:text-amber-500 hover:bg-amber-50 transition-colors',
    iconBtnMuted: 'text-slate-400 hover:text-slate-700',
    accentControl: 'accent-sky-500',
    inputFocusBorder: 'focus:border-sky-500',
    inputFocusWithinBorder: 'focus-within:border-sky-500',
    rowPressBg: 'active:bg-slate-100',
    eqBarBg: 'bg-sky-400',
    divideBorder: 'divide-slate-100',
    hoverAccentText: 'hover:text-sky-600',
    hoverPrimaryText: 'hover:text-slate-900',
    hoverDestructiveBg: 'hover:bg-rose-50',
    accentBadge: 'bg-sky-100 text-sky-700',
    accentBadgeHover: 'hover:bg-sky-200 transition-colors',

    // ===================== Bảng accent theo NHÓM (section title) =====================
    // KHÔNG phải 1 key đơn — mỗi tính năng tự chọn ĐÚNG 1 hue trong bảng này cho tiêu đề section
    // của mình (cố ý phân biệt nhanh nhiều nhóm khác nhau, vd 5 section của Cử chỉ — xem docstring
    // components/gesture-settings-drawer.js) — Dark/Morphin có thể cần đổi ĐỘ ĐẬM (không phải đổi
    // hue) cho từng mục dưới đây để đủ tương phản trên nền mới.
    categoryAccent: {
        sky: 'text-sky-600',
        rose: 'text-rose-600',
        amber: 'text-amber-600',
        emerald: 'text-emerald-600',
        violet: 'text-violet-600',
        yellow: 'text-yellow-600',
        fuchsia: 'text-fuchsia-600',
    },

    // ===================== Bổ sung đợt rà soát toàn app (MỚI 23/09/2026) =====================
    // Key thêm khi quét các file feature còn class màu cứng — Light giữ ĐÚNG class đang chạy thật (không đổi gì), Dark/Morphin theo tông riêng.
    inputBorderColor: 'border-slate-300', // CHỈ màu viền ô nhập (phần tử tự khai `border-b`/`border` riêng — khác inputBorder đã kèm `border`)
    successText: 'text-emerald-600', // chữ/nhãn mang ý "thành công/đã xong" (vd "đã tải font")
    cautionText: 'text-amber-600', // chữ/tiêu đề mang ý cảnh báo (vd tiêu đề modal lỗi phát, log warn)
    hoverAccentSoftBg: 'hover:bg-sky-50 transition-colors', // nền hover nhạt màu accent cho hàng danh sách chọn (font picker...)
    insetBg: 'bg-slate-100', // khối "lõm" xem trước/nền phụ bên trong card (preview Element Style...)
    dangerSoftSurface: 'bg-rose-50 border border-rose-200', // khung nền+viền nhạt cho dòng lỗi (Debug console)
    cautionSoftSurface: 'bg-amber-50 border border-amber-200', // khung nền+viền nhạt cho dòng cảnh báo (Debug console)
    glassTunable: '', // MỚI 23/09/2026 — kính chỉnh được độ nhoè/đục (header + danh sách Playlist chính; glass.css). Rỗng: theme này không có kính
    selectionTintBg: 'bg-sky-500/10', // nền hàng/tile đang được CHỌN trong chế độ chọn nhiều Playlist (core/playlist/selection.js)
    themeVars: 'uitk-vars-light', // class khai biến CSS theo theme (assets/css/glass.css) — cho phần CHỈ vẽ được bằng CSS thuần (thumb/track slider, header ngày lưới ảnh/video); gắn 1 lần trên <body>

    // ===================== UI phía Visualizer (MỚI 20/10/2026, Giang: "theme bottom player phải dùng theme key") =====================
    // `viz*`: 2 nút tròn trên cùng (#btn-open-control-center, #btn-back-playlist), panel Control Center, Volume/Speed HUD.
    // `pc*`: chữ/nút của Bottom Player (components/bottom-player.js) + khung xem trước ở Settings > Theme > Player control.
    // Trạng thái bật (Zoom, mốc tốc độ, Shuffle/Repeat) dùng variant `aria-pressed:` — core chỉ ghi `aria-pressed`, không đổi key.
    // Kiểu nền "none" của Bottom Player (chữ nằm thẳng trên Visualizer) dùng variant `group-data-[pc-style=none]:` — bề mặt
    // `.pc-surface` mang class `group` + `data-pc-style`; bộ màu "trên nền media" (trắng) CỐ Ý giống nhau ở 3 theme.
    // CSS của `group-data-*` sinh SAU `aria-pressed:`/`hover:` nên đè chúng — key nào có màu none + màu bật/hover phải khai thêm
    // dạng chồng `group-data-[pc-style=none]:aria-pressed:` / `group-data-[pc-style=none]:hover:`.
    // Màu nhấn của Shuffle/Repeat đang bật + hover Prev/Next = màu effect đang chạy (`--progress-fill`, không thuộc theme).
    // Bề mặt Bottom Player (kiểu nền × độ đục) + track/thumb slider vẫn ở biến CSS `--viz-*` (themeVars) — cần calc()/pseudo-element.
    vizChromeBtn: 'bg-white/80 hover:bg-white text-slate-700 border border-slate-900/10 shadow-lg backdrop-blur-xl transition-colors', // nút tròn trên cùng: nền + viền + bóng + icon + hover
    vizPanelSurface: 'bg-white/90 text-slate-900 border border-slate-900/10 shadow-2xl backdrop-blur-2xl backdrop-saturate-150', // panel Control Center + Volume/Speed HUD (chữ con thừa kế)
    vizCcItem: 'text-slate-500 hover:bg-slate-900/5 aria-pressed:text-sky-600 transition-colors', // ô trong lưới Control Center — chữ/icon mờ, hover, bật (aria-pressed) = màu nhấn
    vizCcLabel: 'text-slate-900', // nhãn nổi trong ô (tên effect đang chạy)
    vizAccentText: 'text-sky-600', // icon nhấn trong Control Center (icon effect)
    vizChip: 'text-slate-500 aria-pressed:bg-sky-100 aria-pressed:text-sky-700 transition-colors', // nút mốc tốc độ ở Speed HUD — bật (aria-pressed) có nền
    pcText: 'text-slate-900 group-data-[pc-style=none]:text-white', // tên bài + giờ đang phát
    pcTextMuted: 'text-slate-500 group-data-[pc-style=none]:text-white/75', // tổng thời lượng
    pcAccentText: 'text-sky-600 group-data-[pc-style=none]:text-white/80', // nghệ sĩ
    pcIconBtn: 'text-slate-700 group-data-[pc-style=none]:text-white hover:text-[color:var(--progress-fill,#38bdf8)] group-data-[pc-style=none]:hover:text-[color:var(--progress-fill,#38bdf8)] transition-colors', // Prev/Next
    pcToggleBtn: 'text-slate-400 group-data-[pc-style=none]:text-white/60 aria-pressed:text-[color:var(--progress-fill,#38bdf8)] group-data-[pc-style=none]:aria-pressed:text-[color:var(--progress-fill,#38bdf8)] transition-colors', // Shuffle/Repeat — bật (aria-pressed) = màu effect + chấm dưới (player-control.css)
    pcPlayBtn: 'bg-slate-900 text-white group-data-[pc-style=none]:bg-white group-data-[pc-style=none]:text-slate-900', // nút Play/Pause tròn (nền + icon; quầng sáng màu effect ở player-control.css)

    // Icon trang trí theo HUE (icon hành động trong menu nổi...) — cùng tinh thần categoryAccent nhưng cho icon nhỏ (Light bậc -500).
    iconHue: {
        sky: 'text-sky-500',
        amber: 'text-amber-500',
        emerald: 'text-emerald-500',
        violet: 'text-violet-500',
        yellow: 'text-yellow-500',
        rose: 'text-rose-500',
        fuchsia: 'text-fuchsia-500',
        indigo: 'text-indigo-500',
        teal: 'text-teal-500',
    },
    // Chip trạng thái có viền (nút độ khó ở Game panel) — chữ + nền + màu viền cùng hue (phần tử tự khai `border`).
    chipTone: {
        emerald: 'text-emerald-600 bg-emerald-100 border-emerald-300',
        amber: 'text-amber-600 bg-amber-100 border-amber-300',
        rose: 'text-rose-600 bg-rose-100 border-rose-300',
    },
    // Ô icon tròn có nền (hàng thông tin tab Chi tiết...) — nền nhạt + icon cùng hue.
    iconTone: {
        sky: 'bg-sky-100 text-sky-600',
        amber: 'bg-amber-100 text-amber-600',
        emerald: 'bg-emerald-100 text-emerald-600',
        violet: 'bg-violet-100 text-violet-600',
        yellow: 'bg-yellow-100 text-yellow-600',
        rose: 'bg-rose-100 text-rose-600',
        fuchsia: 'bg-fuchsia-100 text-fuchsia-600',
        indigo: 'bg-indigo-100 text-indigo-600',
        teal: 'bg-teal-100 text-teal-600',
    },
};

// CÒN NỢ — CỐ Ý GIỮ class cứng: UI phía Visualizer còn lại (overlay Game/Ghi âm, photo editor, effect picker, phụ đề, cụm
// BPM/Pitch/Energy chữ trắng trên Visualizer), subtitle-editor.html, và màu NHẬN DIỆN dữ liệu (thanh/legend Storage, loại media
// Statistics, cover game, nút Áp dụng/Gỡ xanh-đỏ của Motion, chấm cảnh báo kết quả quét Storage).
//
// Lịch sử: 23/09/2026 phần App Panel chuyển hết sang `data-uitk` (thêm inputBorderColor/successText/cautionText/hoverAccentSoftBg/
// insetBg/dangerSoftSurface/cautionSoftSurface/selectionTintBg/themeVars + nhóm iconHue/iconTone/chipTone). 20/10/2026 thêm nhóm
// `viz*`/`pc*` cho UI phía Visualizer (trước đó tạm theo theme bằng biến CSS `--viz-*` — sai quy ước themeVars).
