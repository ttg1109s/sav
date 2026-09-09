/**
 * core/ui-theme/morphin.js — Bộ theme "Morphin" (glassmorphism — kính mờ, trong suốt) — CHƯA LÀM
 * THẬT, cùng lý do/cùng tình trạng placeholder như core/ui-theme/dark.js (xem docstring ở đó, áp
 * dụng y hệt cho file này — không lặp lại, KỂ CẢ phần "SỬA 09/09/2026 — tạm bỏ khỏi select"). Copy nguyên Light, chỉ để đủ khoá.
 *
 * Gợi ý riêng cho Morphin khi làm thật (KHÁC Dark, KHÔNG PHẢI chỉ đảo sáng/tối) — app đã có sẵn hạ
 * tầng "kính mờ" dùng cho `modalChoice()`/dropdown-menu long-press: `.glass-modal`
 * (assets/css/glass.css — `background: rgba(15,23,42,0.25); backdrop-filter: blur(24px); border:
 * 1px solid rgba(255,255,255,0.15)`). Panel/card của Morphin nhiều khả năng nên THAM KHẢO đúng công
 * thức đó (nền bán trong suốt + blur + viền mờ) thay vì bịa công thức riêng — NHƯNG `.glass-modal`
 * hiện là 1 class CSS thật (không phải chuỗi Tailwind utility) nên KHÔNG gán thẳng vào key list này
 * được (key list chỉ chứa chuỗi class Tailwind, xem docstring light.js) — cần 1 trong 2 hướng: (a)
 * viết Tailwind utility string tương đương (`bg-slate-900/25 backdrop-blur-xl border border-white/
 * 15`), hoặc (b) thêm 1 class CSS MỚI riêng cho Morphin (vd `.uitk-morphin-panel`) rồi để giá trị
 * key trỏ tới class đó thay vì chuỗi Tailwind thuần — apply-ui.js (core/ui-theme/apply-ui.js) không
 * quan tâm class đến từ đâu, chỉ gán `className`, nên cả 2 hướng đều chạy được.
 */
const UI_THEME_MORPHIN = {

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
