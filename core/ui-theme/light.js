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
 * PHẠM VI HIỆN TẠI (09/09/2026) — MỚI áp `data-uitk` cho khung CHUNG Generic Drawer (components/
 * generic-drawer.js: panel/header/handle) làm ví dụ đầu tiên. ~20 file nội dung feature (Folder
 * Browser, EQ Presets, Custom Effect, mọi màn Settings...) HIỆN VẪN hardcode class Tailwind y hệt
 * bộ Light này (KHÔNG có gì đổi màu — đúng chủ đích, migrate xong ĐANG bằng đúng Light) nhưng CHƯA
 * gắn `data-uitk` — nghĩa là chuyển sang Dark/Morphin lúc này CHỈ đổi màu khung Generic Drawer
 * (panel/header), nội dung bên trong (card/nút/text của từng feature) CHƯA đổi theo. Migrate từng
 * file nội dung sang dùng key list này (thay class hardcode bằng `data-uitk`) là việc TIẾP THEO,
 * làm dần từng file — xem "CÒN NỢ" cuối file.
 *
 * LƯU Ý riêng cho lúc viết Dark/Morphin sau này — Tailwind nạp qua CDN (Play CDN) tự tiêm CSS cho
 * class MỚI GẶP LẦN ĐẦU một cách BẤT ĐỒNG BỘ (xem bug đã fix ở Folder Browser, components/items.js::
 * buildFolderGridWrapperHtml()) — nếu Dark/Morphin dùng class CHƯA từng xuất hiện ở bất kỳ đâu
 * trong app (vd `bg-slate-900` có thể đã có sẵn đâu đó, nhưng 1 tổ hợp lạ như `backdrop-blur-xl`
 * cho Morphin thì chưa chắc), LẦN ĐẦU TIÊN switchUiTheme() sang theme đó có thể thấy 1 khung hình
 * chưa kịp lên màu (Tailwind chưa tiêm xong) rồi mới đúng ngay sau — nên cân nhắc "mồi" trước bằng
 * 1 phần tử ẩn tĩnh trong index.html liệt kê đủ mọi class của cả 3 theme, để Tailwind CDN quét/tiêm
 * sẵn lúc boot, không đợi tới lúc người dùng bấm đổi theme.
 */
const UI_THEME_LIGHT = {

    // ===================== Bề mặt (panel/card/overlay) =====================
    // `overlay*` CỐ Ý áp dụng CHUNG, KHÔNG đổi theo theme (Giang chỉ định rõ — lớp phủ mờ phía sau
    // Generic Drawer là "làm tối phần còn lại của app", ý nghĩa đó không đổi dù panel đang theme
    // nào) — vẫn khai ở đây để có 1 nguồn duy nhất, nhưng Dark/Morphin PHẢI copy y hệt giá trị này,
    // không được đổi khác.
    panelBg: 'bg-white',
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

    // ===================== Toggle switch (peer/after markup dùng chung) =====================
    toggleTrackOff: 'bg-slate-300',
    toggleTrackOn: 'bg-sky-500', // gắn qua peer-checked:, xem apply-ui.js cách xử lý riêng

    // ===================== Input / select =====================
    inputBg: 'bg-white',
    inputBorder: 'border border-slate-300',
    inputText: 'text-slate-900',
    inputBorderFocus: 'border-sky-400', // viền input đang active/đang sửa (khác border tĩnh inputBorder)

    // ===================== Trạng thái rỗng =====================
    emptyStateText: 'text-slate-500',

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
};

// CÒN NỢ (09/09/2026) — migrate ~20 file nội dung feature (Folder Browser, Add-to-Folder picker,
// EQ Presets, Custom Effect, Element Style Editor, Storage Management, mọi màn Settings...) từ
// hardcode class Tailwind sang `data-uitk` + key list này, xem docstring đầu file mục "PHẠM VI HIỆN
// TẠI". Làm dần từng file, KHÔNG đổi 1 lần — mỗi file migrate xong vẫn PHẢI trông y hệt bây giờ
// (đang là Light), chỉ khác ở chỗ giờ đổi được sang Dark/Morphin.
