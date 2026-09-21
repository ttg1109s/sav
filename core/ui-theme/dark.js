/**
 * core/ui-theme/dark.js — Bộ theme "Dark" — THIẾT KẾ THẬT (21/09/2026, Giang yêu cầu "làm UI dark thay cho
 * bản dark đang clone của light — tham khảo UI dark trên mạng, 3 màu chủ đạo tím, đen xám, trắng nhẹ").
 * THAY bản placeholder (copy nguyên Light). Cùng bộ KEY với `UI_THEME_LIGHT` (core/ui-theme/light.js) — 2
 * file PHẢI luôn cùng 1 bộ khoá, chỉ khác giá trị (registry.js không tự kiểm tra thiếu khoá).
 *
 * NGUYÊN TẮC THIẾT KẾ (đúc kết từ các hướng dẫn dark mode phổ biến — Material Design, Apple HIG, các bài
 * thực hành dark UI):
 *   1. KHÔNG dùng đen tuyền làm nền bề mặt (đen #000 quá gắt, chữ trắng "chói" — halation): dùng xám than
 *      gần đen. Bảng zinc của Tailwind (cùng họ xám trung tính, hơi lạnh): panel `zinc-900` (#18181b, gần
 *      #121212 của Material) — nền gốc phía sau app (body #000) vẫn tối hơn panel 1 bậc nên panel "nổi" lên.
 *   2. ELEVATION = BỀ MẶT SÁNG HƠN, KHÔNG PHẢI BÓNG (bóng gần như vô hình trên nền tối): panel `zinc-900` <
 *      modal `zinc-800` (modal đứng CAO hơn drawer/panel nên sáng hơn 1 bậc); card/hàng/nút trung tính là
 *      LỚP TRẮNG ĐỘ TRONG SUỐT thấp (`white/5`, `white/10`, `white/15`) phủ lên bất kỳ bề mặt nào bên dưới
 *      -> luôn nổi lên đúng 1 bậc bất kể đang nằm trong panel hay modal (card lồng trong modal không bị
 *      "chìm" cùng màu nền như khi dùng màu đặc). Viền/đường kẻ cũng là trắng độ trong suốt thấp
 *      (`white/10`) — mảnh, không chói.
 *   3. CHỮ "TRẮNG NHẸ", KHÔNG trắng tinh #fff: chính `zinc-100` (#f4f4f5), phụ `zinc-400`, mờ `zinc-500`
 *      (đủ tương phản ≥ 4.5:1 trên nền zinc-900). `text-white` CHỈ dành cho chữ nằm trên nền accent đặc.
 *   4. ACCENT TÍM (violet) THAY sky của Light, dùng bậc SÁNG/dịu hơn cho chữ & icon (`violet-400`/`-300` —
 *      giảm bão hoà so với Light để không "rung" trên nền tối), bậc đậm hơn (`violet-600`/`-500`) chỉ cho
 *      NỀN nút đặc (chữ trắng nằm trên vẫn đạt tương phản). Các hue phân nhóm (categoryAccent) đổi từ -600
 *      (tính cho nền trắng) sang -400 để đủ nổi trên nền tối.
 *   5. `overlayBg` GIỮ NGUYÊN `bg-black/50` — cố ý KHÔNG đổi theo theme (xem docstring light.js).
 *
 * HẠN CHẾ HIỆN TẠI: theme chỉ áp cho phần tử đã gắn `data-uitk`. Một số file feature CÒN class màu cứng
 * (slate/sky) chưa migrate — ở Dark các chỗ đó sẽ lẫn màu cũ cho tới khi migrate xong (xem "CÒN NỢ" cuối
 * light.js). Chỉ Light/Dark đang cho chọn (`UI_THEME_SELECTABLE_NAMES`, registry.js).
 *
 * LƯU Ý Tailwind CDN — class MỚI (chưa từng xuất hiện ở đâu trong app) được tiêm CSS BẤT ĐỒNG BỘ, lần đầu
 * chuyển sang Dark có thể thấy 1 khung hình chưa lên màu. Giảm thiểu bằng phần tử ẩn "primer" liệt kê MỌI
 * class của bộ này trong index.html (`#ui-theme-class-primer`) để CDN quét/tiêm sẵn lúc boot — KHI SỬA
 * BỘ MÀU DƯỚI ĐÂY nhớ cập nhật lại danh sách class ở primer đó.
 */
const UI_THEME_DARK = {

    // ===================== Bề mặt (panel/card/overlay) =====================
    panelBg: 'bg-zinc-900',
    panelShadow: 'shadow-2xl shadow-black/60', // bóng gần như vô hình trên nền tối — giữ để tách khỏi nền gốc đen khi panel không phủ kín
    dragHandleBg: 'bg-zinc-600', // thanh nhỏ đầu panel gợi ý kéo — KHÔNG phải toggle, tách riêng key dù trùng giá trị toggleTrackOff
    modalCardBg: 'bg-zinc-800',  // modal đứng CAO hơn panel/drawer -> sáng hơn 1 bậc (elevation = bề mặt sáng hơn)
    modalCardBorder: 'border border-white/10',
    modalTitleText: 'text-zinc-50 font-bold',
    modalBodyText: 'text-zinc-200',
    overlayBg: 'bg-black/50', // GIỮ NGUYÊN — không đổi theo theme, xem docstring light.js

    // ===================== Card / hàng nội dung =====================
    cardBg: 'bg-white/5', // lớp trắng độ trong suốt thấp — nổi lên 1 bậc trên MỌI bề mặt bên dưới (panel/modal/card lồng)
    cardBorder: 'border border-white/10',
    cardHoverBg: 'hover:bg-white/10 transition-colors',
    dividerBorder: 'border-white/10', // dùng cho border-b/border-t giữa các hàng trong 1 card
    dashedBorder: 'border-white/20', // viền nét đứt (tile "Tạo mới")

    // ===================== Chữ =====================
    textPrimary: 'text-zinc-100',   // tiêu đề, giá trị chính, số liệu nổi bật — trắng nhẹ, KHÔNG #fff
    textSecondary: 'text-zinc-400', // label phụ, hint, giá trị phụ
    textMutedIcon: 'text-zinc-500', // icon/chevron thuần trang trí (KHÔNG phải văn bản đọc được)
    textSecondaryStrong: 'text-zinc-300', // nhãn phụ nhưng cần NỔI hơn textSecondary (tên tile, tên hàng danh sách)
    textOnAccent: 'text-white',     // chữ/icon nằm TRÊN nền màu đặc (nút chính, badge...)

    // ===================== Header Generic Drawer =====================
    headerBorder: 'border-b border-white/10',
    headerTitle: 'text-zinc-50 font-bold',
    headerCloseHover: 'hover:bg-white/10 transition-colors',
    headerCloseIcon: 'text-zinc-400',

    // ===================== Nút bấm =====================
    // "Primary" (CTA chính) — tím đậm (chữ trắng trên violet-600 ≈ 5.7:1).
    btnPrimaryBg: 'bg-violet-600',
    btnPrimaryHoverBg: 'hover:bg-violet-500 transition-colors',
    // "PrimaryPill" (pill nhỏ, chữ nhỏ text-xs — vd nút Lưu preset, chip đang chọn) — vẫn violet-600 (KHÔNG hạ xuống -500 như
    // Light hạ sky-600 -> sky-500): chữ trắng nhỏ trên violet-500 chỉ ~4.2:1, dưới ngưỡng 4.5:1.
    btnPrimaryPillBg: 'bg-violet-600',
    btnPrimaryPillHoverBg: 'hover:bg-violet-500 transition-colors',
    // "Destructive" (Xoá) / "Caution" — giữ hue ngữ nghĩa (đỏ/cam), không đổi sang tím.
    btnDestructiveBg: 'bg-rose-600',
    btnDestructiveHoverBg: 'hover:bg-rose-500 transition-colors',
    btnCautionBg: 'bg-amber-600',
    btnCautionHoverBg: 'hover:bg-amber-500 transition-colors',
    // "Neutral" (Huỷ/trung tính) — lớp trắng độ trong suốt, giống card nhưng đậm hơn 1 nấc để nhận ra là nút.
    btnNeutralBg: 'bg-white/10',
    btnNeutralHoverBg: 'hover:bg-white/15 transition-colors',
    btnNeutralText: 'text-zinc-200',
    // "Ghost" (nút icon thuần, chỉ hiện nền lúc hover).
    btnGhostHoverBg: 'hover:bg-white/10 transition-colors',

    // ===================== Nhấn/accent (icon nổi bật, link, viền chọn) =====================
    accentText: 'text-violet-400',
    accentTextSoft: 'text-violet-400',
    accentIconBoxBg: 'bg-violet-500/15',
    accentIconBoxText: 'text-violet-300',
    rowActiveBg: 'bg-violet-500/10',       // hàng/tile đang được CHỌN LÀM ACTIVE (NỀN, khác accentRingSelected)
    rowActiveBorder: 'border border-violet-500/40',
    accentRingSelected: 'ring-2 ring-violet-400', // viền tile đang chọn (multi-select)
    destructiveText: 'text-rose-400',      // nhãn/label CHỮ mang ý xoá (không phải nút nền đặc)

    // ===================== Toggle switch (peer/after markup dùng chung) =====================
    toggleTrackOff: 'bg-zinc-600',
    toggleTrackOn: 'bg-violet-500', // gắn qua peer-checked:, xem apply-ui.js cách xử lý riêng

    // ===================== Input / select =====================
    inputBg: 'bg-black/30',           // ô nhập "lõm" xuống dưới bề mặt (tối hơn nền quanh nó)
    inputBorder: 'border border-white/15',
    inputText: 'text-zinc-100',
    inputBorderFocus: 'border-violet-400', // viền input đang active/đang sửa (khác border tĩnh inputBorder)

    // ===================== Trạng thái rỗng =====================
    emptyStateText: 'text-zinc-400', // là VĂN BẢN đọc được (khác textMutedIcon) -> zinc-400 (~6.9:1), không hạ xuống -500 (~3.7:1)

    // ===================== Thanh tiến độ =====================
    progressTrackBg: 'bg-white/10', // nền (track) thanh tiến độ mảnh (card "Library played" panel Statistics)
    progressFillBg: 'bg-violet-500', // phần tô (fill)

    // ===================== Tab pill (segmented) =====================
    // Trạng thái ĐANG CHỌN của tab pill (modal Chi tiết/Sửa, `.song-edit-tab-btn`) — dựa `aria-selected="true"`
    // (xem chú thích cùng key ở light.js). Tím đặc + chữ trắng.
    segmentTabActive: 'aria-selected:bg-violet-600 aria-selected:text-white aria-selected:shadow',

    // ===================== Bảng accent theo NHÓM (section title) =====================
    // Bậc -400 (Light dùng -600 cho nền trắng) — đủ nổi trên nền tối.
    categoryAccent: {
        sky: 'text-sky-400',
        rose: 'text-rose-400',
        amber: 'text-amber-400',
        emerald: 'text-emerald-400',
        violet: 'text-violet-400',
        yellow: 'text-yellow-400',
        fuchsia: 'text-fuchsia-400',
    },
};
