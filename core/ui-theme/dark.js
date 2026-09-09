/**
 * core/ui-theme/dark.js — Bộ theme "Dark" — CHƯA LÀM THẬT (placeholder, Giang chốt "trước tiên hãy
 * làm theme light..." — Dark/Morphin làm SAU). Mọi giá trị dưới đây COPY NGUYÊN từ Light
 * (core/ui-theme/light.js) CHỈ để bộ key luôn ĐỦ + switchUiTheme('dark') không vỡ/thiếu key giữa
 * chừng nếu ai đó bấm thử — KHÔNG phải thiết kế Dark thật, chưa đổi màu gì cả.
 *
 * SỬA (09/09/2026) — Giang yêu cầu TẠM BỎ 'dark' khỏi danh sách cho chọn (`UI_THEME_SELECTABLE_NAMES`,
 * core/ui-theme/registry.js) — file này VẪN nạp/đăng ký bình thường trong `UI_THEME_REGISTRY` (code
 * KHÔNG xoá, đúng yêu cầu), chỉ là chưa CHỌN/CHUYỂN được qua `switchUiTheme('dark')` cho tới khi
 * thêm lại 'dark' vào mảng đó. Thêm lại NGAY KHI thiết kế Dark thật xong (gợi ý bên dưới).
 *
 * BẮT BUỘC giữ ĐỦ + ĐÚNG TÊN mọi key so với `UI_THEME_LIGHT` (core/ui-theme/light.js) — 2 file PHẢI
 * cùng 1 bộ khoá, chỉ khác giá trị (registry.js không tự kiểm tra thiếu khoá, xem docstring ở đó).
 *
 * Khi làm Dark thật, tối thiểu cần đổi (gợi ý, KHÔNG PHẢI đã chốt):
 * - panelBg: nền tối thật (vd `bg-slate-900`), overlayBg GIỮ NGUYÊN `bg-black/50` (chủ đích không
 *   đổi theo theme, xem docstring light.js).
 * - textPrimary/textSecondary/textMutedIcon: đảo độ đậm (chữ chính gần trắng, phụ xám sáng).
 * - cardBg/cardBorder/dividerBorder: bề mặt card tối hơn panel 1 bậc, viền sáng hơn card 1 bậc.
 * - toggleTrackOff/inputBg/inputBorder: tối hoá — xem lại đúng cơ chế `.eq-preset-slider`/
 *   input đã fix ở đợt "xử lý triệt để dark cũ" (09/09/2026) làm tham khảo NGƯỢC (từ tối sang sáng)
 *   để suy ra chiều đúng khi làm NGƯỢC LẠI (sáng sang tối).
 * - categoryAccent: các hue -600 hiện tại tính cho NỀN TRẮNG — trên nền tối nhiều khả năng cần đổi
 *   lại về -400 (giống bản dark cũ trước khi bị "xử lý triệt để dark cũ" ép sang sáng) để đủ nổi.
 * - Lưu ý riêng về Tailwind CDN (tiêm CSS bất đồng bộ cho class MỚI) — xem docstring light.js mục
 *   cuối, ĐẶC BIỆT quan trọng khi Dark dùng class chưa từng xuất hiện ở đâu khác trong app.
 */
const UI_THEME_DARK = {

    // ===================== Bề mặt (panel/card/overlay) =====================
    panelBg: 'bg-white',
    panelShadow: 'shadow-2xl',
    dragHandleBg: 'bg-slate-300', // thanh nhỏ đầu panel gợi ý kéo — KHÔNG phải toggle, tách riêng key dù trùng giá trị toggleTrackOff
    modalCardBg: 'bg-white',       // card modalChoice/alertModal + mọi modal tĩnh (song-edit/playback-error/rename-folder...) — MỞ RỘNG 09/09/2026, trước đây các modal này đứng ngoài hệ theme
    modalCardBorder: 'border border-slate-200',
    modalTitleText: 'text-slate-900 font-bold',
    modalBodyText: 'text-slate-900',
    overlayBg: 'bg-black/50', // GIỮ NGUYÊN — không đổi theo theme, xem docstring light.js

    // ===================== Card / hàng nội dung =====================
    cardBg: 'bg-slate-50',
    cardBorder: 'border border-slate-200',
    cardHoverBg: 'hover:bg-slate-100 transition-colors',
    dividerBorder: 'border-slate-200',
    dashedBorder: 'border-slate-300',

    // ===================== Chữ =====================
    textPrimary: 'text-slate-900',
    textSecondary: 'text-slate-500',
    textMutedIcon: 'text-slate-400',
    textSecondaryStrong: 'text-slate-700',
    textOnAccent: 'text-white',

    // ===================== Header Generic Drawer =====================
    headerBorder: 'border-b border-slate-200',
    headerTitle: 'text-slate-900 font-bold',
    headerCloseHover: 'hover:bg-slate-100 transition-colors',
    headerCloseIcon: 'text-slate-500',

    // ===================== Nút bấm =====================
    btnPrimaryBg: 'bg-sky-600',
    btnPrimaryHoverBg: 'hover:bg-sky-500 transition-colors',
    btnPrimaryPillBg: 'bg-sky-500',
    btnPrimaryPillHoverBg: 'hover:bg-sky-400 transition-colors',
    btnDestructiveBg: 'bg-rose-600',
    btnDestructiveHoverBg: 'hover:bg-rose-500 transition-colors',
    btnCautionBg: 'bg-amber-600',
    btnCautionHoverBg: 'hover:bg-amber-500 transition-colors',
    btnNeutralBg: 'bg-slate-100',
    btnNeutralHoverBg: 'hover:bg-slate-200 transition-colors',
    btnNeutralText: 'text-slate-700',
    btnGhostHoverBg: 'hover:bg-slate-100 transition-colors',

    // ===================== Nhấn/accent =====================
    accentText: 'text-sky-600',
    accentTextSoft: 'text-sky-500',
    accentIconBoxBg: 'bg-sky-100',
    accentIconBoxText: 'text-sky-600',
    rowActiveBg: 'bg-sky-50',       // hàng/tile đang được CHỌN LÀM ACTIVE (khác accentRingSelected — đây là NỀN đặc, dùng cho danh sách preset EQ/Motion/Playlist Filter)
    rowActiveBorder: 'border border-sky-300',
    accentRingSelected: 'ring-2 ring-sky-500',
    destructiveText: 'text-rose-500',

    // ===================== Toggle switch =====================
    toggleTrackOff: 'bg-slate-300',
    toggleTrackOn: 'bg-sky-500',

    // ===================== Input / select =====================
    inputBg: 'bg-white',
    inputBorder: 'border border-slate-300',
    inputText: 'text-slate-900',
    inputBorderFocus: 'border-sky-400',

    // ===================== Trạng thái rỗng =====================
    emptyStateText: 'text-slate-500',

    // ===================== Bảng accent theo NHÓM (section title) =====================
    categoryAccent: {
        sky: 'text-sky-600',
        rose: 'text-rose-600',
        amber: 'text-amber-600',
        emerald: 'text-emerald-600',
        violet: 'text-violet-600',
        yellow: 'text-yellow-600',
        fuchsia: 'text-fuchsia-600',
    },
};
