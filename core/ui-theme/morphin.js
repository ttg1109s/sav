/**
 * core/ui-theme/morphin.js — Bộ theme "Morphin" (glassmorphism — kính mờ) — THIẾT KẾ THẬT (21/09/2026, Giang yêu cầu
 * "làm luôn theme Morphin — tham khảo trên mạng + css của phần icon Control Center"). THAY bản placeholder (copy Light).
 * Cùng bộ KEY với `UI_THEME_LIGHT` (light.js) — 2 file PHẢI luôn cùng 1 bộ khoá, chỉ khác giá trị.
 *
 * NGUYÊN TẮC (đúc kết từ các hướng dẫn glassmorphism phổ biến + chính `.glass-control-center` đã có của app, assets/css/glass.css):
 *   1. 4 THÀNH PHẦN của kính, thiếu 1 là mất ảo giác: (a) nền trắng/tối độ trong suốt thấp (10-30%), (b) làm mờ nền phía sau
 *      (`backdrop-filter: blur`), (c) viền sáng mảnh 1px, (d) bóng mềm / viền sáng bên trong. Vì (b)/(c)/(d) không diễn tả được
 *      bằng 1 class Tailwind chuẩn (blur 36px + saturate 1.6 của Control Center), 2 bề mặt kính được khai thành 2 CLASS RIÊNG
 *      trong assets/css/glass.css: `.uitk-glass-surface` (panel/drawer — dựa trực tiếp trên `.glass-control-center`, nhạt hơn
 *      một chút vì phủ diện rộng) và `.uitk-glass-elevated` (modal/menu nổi — đậm hơn 1 bậc, bóng lớn như Control Center).
 *   2. CHỮ TRẮNG + text-shadow nhẹ (đã gộp sẵn trong 2 class kính, chữ con thừa kế) để giữ tương phản trên nền ảnh/gradient sáng —
 *      hướng dẫn glassmorphism nhấn mạnh phải TEST chữ trên nền THẬT sau blur, không chỉ tin con số opacity.
 *   3. Card/hàng/nút trung tính BÊN TRONG kính là lớp trắng mờ (`white/10`..`white/25`), KHÔNG blur thêm (blur lồng nhau vô ích
 *      + tốn GPU trên mobile). Chỉ panel/modal (`panelBg`/`modalCardBg`) mới có blur.
 *   4. Accent tím-hồng (violet) ăn với gradient mặc định indigo→pink của app (`gradientFrom/To`, core/config.js), dùng bậc -300
 *      cho chữ/icon (sáng trên kính), bậc -500 độ trong suốt 80-85% cho nền nút đặc.
 *   5. `overlayBg` GIỮ NGUYÊN `bg-black/50` (cố ý không đổi theo theme, xem docstring light.js).
 *
 * NỀN PHÍA SAU (ảnh/gradient) chỉ có nghĩa với Morphin: Settings > System > Theme chỉ hiện phần chọn Solid/Gradient/Image khi
 * Color = Morphin (event/workflow/app-settings.js). Nền được vẽ ở #app-bg-image (core/color-utils.js::updatePlaylistBg) — lớp
 * KÍNH ở trên mới có blur. `appBaseBg` (nền đặc dự phòng của body/#app-bg, hiện khi chưa có ảnh/gradient) là slate-900 đặc —
 * TÁCH khỏi `panelBg` (kính) vì phần tử có `backdrop-filter` tạo containing block cho con `position:fixed` -> gắn kính lên <body>
 * sẽ vỡ layout mọi drawer/menu fixed.
 *
 * HẠN CHẾ: giống Dark — các file feature CÒN class màu cứng chưa migrate sẽ lẫn màu ở Morphin (xem "CÒN NỢ" cuối light.js).
 * Chữ trắng trên kính cần nền ĐỦ TỐI/ĐA SẮC: chọn Solid màu rất sáng (vd trắng) sẽ khó đọc. Class MỚI với Tailwind CDN được tiêm
 * bất đồng bộ — danh sách class của bộ này cũng nằm trong primer `#ui-theme-class-primer` (index.html); sửa bộ màu nhớ cập nhật primer.
 */
const UI_THEME_MORPHIN = {

    // ===================== Bề mặt (panel/card/overlay) =====================
    appBaseBg: 'bg-slate-900',  // nền đặc dự phòng của body/#app-bg (KHÔNG có backdrop-filter, xem docstring)
    panelBg: 'uitk-glass-surface', // kính panel/drawer — glass.css
    panelFlushBg: 'uitk-glass-surface uitk-glass-flush', // MỚI 21/09/2026 (Giang báo "lộ viền ở main playlist") — panel TOÀN MÀN sát mép: `.uitk-glass-surface` có viền 1px trắng 22% + bóng trong, ở panel sát mép màn hình viền đó hiện thành đường sáng dọc mép trái/phải/trên và đường kẻ giữa header/list — `.uitk-glass-flush` (glass.css) gỡ viền + bóng, giữ nguyên lớp kính. Panel LƠ LỬNG (drawer/modal/card) vẫn dùng panelBg/modalCardBg có viền
    panelShadow: 'shadow-2xl shadow-black/30',
    dragHandleBg: 'bg-white/40', // thanh nhỏ đầu panel gợi ý kéo
    modalCardBg: 'uitk-glass-elevated', // kính modal/menu nổi — glass.css (đã có viền + bóng, nên modalCardBorder để trống)
    modalCardBorder: '',
    modalTitleText: 'text-white font-bold',
    modalBodyText: 'text-white/90',
    overlayBg: 'bg-black/50', // GIỮ NGUYÊN — không đổi theo theme, xem docstring light.js

    // ===================== Card / hàng nội dung =====================
    cardBg: 'bg-white/10',
    cardBorder: 'border border-white/20',
    cardHoverBg: 'hover:bg-white/20 transition-colors',
    dividerBorder: 'border-white/15',
    dashedBorder: 'border-white/30',

    // ===================== Chữ =====================
    textPrimary: 'text-white',
    textSecondary: 'text-white/70',
    textMutedIcon: 'text-white/50',
    textSecondaryStrong: 'text-white/85',
    textOnAccent: 'text-white',

    // ===================== Header Generic Drawer =====================
    headerBorder: 'border-b border-white/15',
    headerTitle: 'text-white font-bold',
    headerCloseHover: 'hover:bg-white/15 transition-colors',
    headerCloseIcon: 'text-white/70',

    // ===================== Nút bấm =====================
    btnPrimaryBg: 'bg-violet-500/80',
    btnPrimaryHoverBg: 'hover:bg-violet-500 transition-colors',
    btnPrimaryPillBg: 'bg-violet-500/85',
    btnPrimaryPillHoverBg: 'hover:bg-violet-400 transition-colors',
    btnDestructiveBg: 'bg-rose-500/80',
    btnDestructiveHoverBg: 'hover:bg-rose-500 transition-colors',
    btnCautionBg: 'bg-amber-500/80',
    btnCautionHoverBg: 'hover:bg-amber-500 transition-colors',
    btnNeutralBg: 'bg-white/15',
    btnNeutralHoverBg: 'hover:bg-white/25 transition-colors',
    btnNeutralText: 'text-white',
    btnGhostHoverBg: 'hover:bg-white/15 transition-colors',

    // ===================== Nhấn/accent (icon nổi bật, link, viền chọn) =====================
    accentText: 'text-violet-300',
    accentTextSoft: 'text-violet-300',
    accentIconBoxBg: 'bg-white/15',
    accentIconBoxText: 'text-white',
    rowActiveBg: 'bg-white/20',
    rowActiveBorder: 'border border-white/40',
    accentRingSelected: 'ring-2 ring-white/70',
    destructiveText: 'text-rose-300',
    menuDestructiveItem: 'bg-rose-500/80 hover:bg-rose-500 text-white transition-colors', // MỚI 21/09/2026 — hàng "Xoá" trong menu nổi: text-rose-300 cũ gần như biến mất trên kính trắng 16% phủ nền cam (nhìn như nút disabled); giờ là hàng nền rose ĐÚNG khuôn nút huỷ diệt của modal (btnDestructiveBg) + chữ trắng
    statTypeSong: 'text-violet-300', // MỚI 21/09/2026 — xem light.js; tông pastel-300 nổi trên kính trắng phủ nền cam/xanh (cùng họ accentText/destructiveText của Morphin)
    statTypeVideo: 'text-rose-300',
    statTypePhoto: 'text-amber-300',
    statPieLabelText: 'text-slate-900',

    // ===================== Toggle switch (peer/after markup dùng chung) =====================
    toggleTrackOff: 'bg-white/25',
    toggleTrackOn: 'peer-checked:bg-violet-400', // SỬA 21/09/2026 — dạng `peer-checked:` (đi cùng toggleTrackOff trên CÙNG phần tử track): bật -> đổi nền; trước đây 'bg-...' không ai dùng

    // ===================== Input / select =====================
    inputBg: 'bg-black/25',
    inputBorder: 'border border-white/25',
    inputText: 'text-white',
    inputBorderFocus: 'border-white/60',
    searchBoxSurface: 'bg-white/10 border border-white/20', // MỚI 21/09/2026 — khung tìm kiếm Playlist: CÙNG lớp kính trắng mờ với nút Phát/Trộn bài (cardBg+cardBorder), KHÔNG dùng inputBg (black/25 — ám tối thành mảng đỏ sẫm trên nền cam)
    inputPlaceholder: 'placeholder-white/60', // MỚI 21/09/2026 — placeholder trắng mờ (trước là slate-400 cứng -> xanh xám lạc tông trên nền cam)
    navInactiveText: 'text-white/75', // MỚI 21/09/2026 — chữ+icon nút bottom nav KHÔNG active: trắng 75% (textMutedIcon white/50 quá nhạt cho NHÃN 12px trên nền cam — và khi bỏ nút Media, ở Home cả 4 nút đều ở trạng thái này)

    // ===================== Trạng thái rỗng =====================
    emptyStateText: 'text-white/60',

    // ===================== Thanh tiến độ =====================
    progressTrackBg: 'bg-white/20',
    progressFillBg: 'bg-white/90',

    // ===================== Tab pill (segmented) =====================
    segmentTabActive: 'aria-selected:bg-white/30 aria-selected:text-white aria-selected:shadow',

    // ===================== Tương tác/accent mở rộng (MỚI 21/09/2026 — chuẩn hoá drawer Motion/Filter/Storage + hàng Playlist) =====================
    // Mỗi key gộp ĐÚNG chuỗi class Light đang chạy thật ở các drawer/hàng (Light KHÔNG đổi), Dark/Morphin đổi tím/kính. Key dạng nút
    // có hover/nền/chữ đi liền nhau (btnAccentSoft, iconBtn*) gắn MỘT lần `data-uitk="..."`, không rải class màu cứng.
    btnAccentSoft: 'bg-white/15 hover:bg-white/25 transition-colors text-white',
    accentSoftBorder: 'border border-white/30',
    btnCautionSoft: 'bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 transition-colors',
    btnDestructiveSoft: 'bg-rose-400/20 hover:bg-rose-400/30 text-rose-200 transition-colors',
    iconBtnAccent: 'text-white/70 hover:text-white hover:bg-white/20 transition-colors',
    iconBtnDestructive: 'text-white/70 hover:text-rose-200 hover:bg-rose-400/20 transition-colors',
    iconBtnCaution: 'text-white/70 hover:text-amber-200 hover:bg-amber-400/20 transition-colors',
    iconBtnMuted: 'text-white/60 hover:text-white',
    accentControl: 'accent-violet-400',
    inputFocusBorder: 'focus:border-white/60',
    inputFocusWithinBorder: 'focus-within:border-white/60',
    rowPressBg: 'active:bg-white/20',
    eqBarBg: 'bg-white',
    divideBorder: 'divide-white/15',
    hoverAccentText: 'hover:text-violet-300',
    hoverPrimaryText: 'hover:text-white',
    hoverDestructiveBg: 'hover:bg-rose-400/20',
    accentBadge: 'bg-white/20 text-white',
    accentBadgeHover: 'hover:bg-white/30 transition-colors',

    // ===================== Bảng accent theo NHÓM (section title) =====================
    categoryAccent: {
        sky: 'text-sky-300',
        rose: 'text-rose-300',
        amber: 'text-amber-300',
        emerald: 'text-emerald-300',
        violet: 'text-violet-300',
        yellow: 'text-yellow-300',
        fuchsia: 'text-fuchsia-300',
    },

    // ===================== Bổ sung đợt rà soát toàn app (MỚI 23/09/2026) =====================
    // Key thêm khi quét các file feature còn class màu cứng — Light giữ ĐÚNG class đang chạy thật (không đổi gì), Dark/Morphin theo tông riêng.
    inputBorderColor: 'border-white/25', // CHỈ màu viền ô nhập (phần tử tự khai `border-b`/`border` riêng — khác inputBorder đã kèm `border`)
    successText: 'text-emerald-300', // chữ/nhãn mang ý "thành công/đã xong" (vd "đã tải font")
    cautionText: 'text-amber-200', // chữ/tiêu đề mang ý cảnh báo (vd tiêu đề modal lỗi phát, log warn)
    hoverAccentSoftBg: 'hover:bg-white/15 transition-colors', // nền hover nhạt màu accent cho hàng danh sách chọn (font picker...)
    insetBg: 'bg-black/20', // khối "lõm" xem trước/nền phụ bên trong card (preview Element Style...)
    dangerSoftSurface: 'bg-rose-500/20 border border-rose-300/40', // khung nền+viền nhạt cho dòng lỗi (Debug console)
    cautionSoftSurface: 'bg-amber-500/20 border border-amber-300/40', // khung nền+viền nhạt cho dòng cảnh báo (Debug console)
    selectionTintBg: 'bg-white/20', // nền hàng/tile đang được CHỌN trong chế độ chọn nhiều Playlist (core/playlist/selection.js)
    themeVars: 'uitk-vars-morphin', // class khai biến CSS theo theme (assets/css/glass.css) — cho phần CHỈ vẽ được bằng CSS thuần (thumb/track slider, header ngày lưới ảnh/video); gắn 1 lần trên <body>

    // Icon trang trí theo HUE (icon hành động trong menu nổi...) — cùng tinh thần categoryAccent nhưng cho icon nhỏ (Light bậc -500).
    iconHue: {
        sky: 'text-sky-300',
        amber: 'text-amber-300',
        emerald: 'text-emerald-300',
        violet: 'text-violet-300',
        yellow: 'text-yellow-300',
        rose: 'text-rose-300',
        fuchsia: 'text-fuchsia-300',
        indigo: 'text-indigo-300',
        teal: 'text-teal-300',
    },
    // Chip trạng thái có viền (nút độ khó ở Game panel) — chữ + nền + màu viền cùng hue (phần tử tự khai `border`).
    chipTone: {
        emerald: 'text-emerald-100 bg-white/15 border-white/30',
        amber: 'text-amber-100 bg-white/15 border-white/30',
        rose: 'text-rose-100 bg-white/15 border-white/30',
    },
    // Ô icon tròn có nền (hàng thông tin tab Chi tiết...) — nền nhạt + icon cùng hue.
    iconTone: {
        sky: 'bg-white/15 text-sky-200',
        amber: 'bg-white/15 text-amber-200',
        emerald: 'bg-white/15 text-emerald-200',
        violet: 'bg-white/15 text-violet-200',
        yellow: 'bg-white/15 text-yellow-200',
        rose: 'bg-white/15 text-rose-200',
        fuchsia: 'bg-white/15 text-fuchsia-200',
        indigo: 'bg-white/15 text-indigo-200',
        teal: 'bg-white/15 text-teal-200',
    },
};
