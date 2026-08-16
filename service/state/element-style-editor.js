/**
 * service/state/element-style-editor.js — Package STATE domain "element-style-editor" (MỚI —
 * công cụ CHUNG dựng CSS box model + text style qua UI, xuất chuỗi CSS rồi áp inline lên 1 DOM
 * BẤT KỲ được truyền vào lúc mở, xem event/workflow/element-style-editor.js::open(targetEl)).
 *
 * CHỈ runtime (AppState, KHÔNG phải AppConfig/core/config.js) — công cụ này CHƯA gắn với 1 tính
 * năng lưu trữ cụ thể nào, nơi gọi thật (feature nào mở Drawer, có persist lại hay không) để dành
 * quyết định sau (xem ghi chú đầu event/workflow/element-style-editor.js) — draft ở đây chỉ sống
 * trong phiên Drawer đang mở, KHÔNG tự lưu DB.
 *
 * Xem cơ chế package ở service/state.js. PHẢI nạp SAU service/state.js.
 */

/** Khung mặc định 1 field "bật/tắt + giá trị" DÙNG CHUNG cho property CÓ giá trị số/nhiều-phần
 * (padding/margin/border/opacity/fontSize/lineHeight/letterSpacing/fontFamily/color) — mỗi field
 * có `enabled` riêng, buildElementStyleCssString() (core/element-style-editor.js) CHỈ ghép
 * property nào `enabled === true` vào chuỗi CSS cuối cùng.
 *
 * SỬA (15/08/2026, Giang chỉ ra "None là dropdown") — property CHỈ có ĐÚNG 1 dropdown chọn giá
 * trị (fontWeight/fontStyle/textAlign/textDecoration/textTransform/whiteSpace) KHÔNG còn dùng
 * khung {enabled,value} này nữa — chuyển hẳn sang GIÁ TRỊ STRING THUẦN, mặc định `'none'` — bản
 * thân "None" LÀ 1 lựa chọn NGAY TRONG dropdown, không cần toggle bật/tắt riêng nữa (dropdown tự
 * là công tắc). Width/Height CŨNG gộp theo hướng này — `mode` thêm lựa chọn `'none'`, KHÔNG còn
 * `enabled` riêng (mode='none' THAY THẾ enabled=false). */
function cloneElementStyleDraftDefaults() {
    return {
        box: {
            // mode: 'none' (không áp) | 'custom' (dùng value+unit) | 'fit' (fit-content) | 'auto'
            width: { mode: 'none', value: 100, unit: 'px' },
            height: { mode: 'none', value: 100, unit: 'px' },
            // 4 cạnh riêng, DÙNG CHUNG 1 unit (đơn giản hoá — trộn unit khác nhau giữa các cạnh
            // hiếm gặp, không hỗ trợ ở bản đầu).
            padding: { enabled: false, unit: 'px', top: 0, right: 0, bottom: 0, left: 0 },
            margin: { enabled: false, unit: 'px', top: 0, right: 0, bottom: 0, left: 0 },
            // MỚI (16/08/2026, mục 2 — Giang chỉ ra "đang thiếu background cho box") — màu nền
            // thuần (KHÔNG hỗ trợ ảnh nền/gradient bản đầu, giữ đơn giản — CÙNG khung {enabled,value}
            // với text.color bên dưới). CSS xuất `background-color` (KHÔNG dùng shorthand
            // `background`, tránh vô tình xoá mất `background-image`/`background-position`... nếu
            // targetEl từng có sẵn style khác — applyElementStyleToDom() ghi qua setProperty() TỪNG
            // khai báo, xem core/element-style-editor.js).
            background: { enabled: false, value: '#ffffff' },
            border: { enabled: false, width: 1, widthUnit: 'px', style: 'solid', color: '#000000' },
            // MỚI — 0-100 (quy đổi /100 -> 0-1 lúc build CSS, xem buildElementStyleCssString(),
            // core/element-style-editor.js), KHÔNG lưu thẳng 0-1 để tránh người dùng gõ nhầm scale.
            opacity: { enabled: false, value: 100 },
        },
        text: {
            // source: 'system' (font có sẵn máy, gõ tay tên) | 'google' (tải qua loadGoogleFont(),
            // core/element-style-editor.js — CẦN MẠNG, xem docstring hàm đó).
            fontFamily: { enabled: false, source: 'system', value: '', googleWeight: '400' },
            fontSize: { enabled: false, value: 16, unit: 'px' },
            // 6 field DROPDOWN-THUẦN dưới đây — string thuần, 'none' = không áp (xem docstring
            // hàm), KHÔNG còn {enabled,value}.
            fontWeight: 'none',
            fontStyle: 'none',
            lineHeight: { enabled: false, value: 1.5, unit: 'none' }, // unit 'none' = số nhân không đơn vị (line-height: 1.5)
            letterSpacing: { enabled: false, value: 0, unit: 'px' },
            textAlign: 'none',
            textDecoration: 'none',
            textTransform: 'none',
            color: { enabled: false, value: '#000000' },
            whiteSpace: 'none',
            // MỚI (16/08/2026, mục 2 — Giang chỉ ra "chưa có text-shadow cho text") — 4 phần độc
            // lập offsetX/offsetY/blur (LUÔN đơn vị px, KHÔNG thêm dropdown unit — text-shadow thực
            // tế hầu như chỉ dùng px, giữ đơn giản, đỡ 1 lớp UI thừa) + color riêng (KHÔNG dùng
            // chung `color` phía trên — 2 khái niệm khác nhau, màu chữ vs màu đổ bóng).
            textShadow: { enabled: false, offsetX: 0, offsetY: 0, blur: 2, color: '#000000' },
        },
    };
}

AppState.definePackage('element-style-editor', {
    schema: {
        eseActiveTab: 'string', // 'box' | 'text' — tab đang xem trong Drawer
        eseDraft: 'object', // toàn bộ giá trị đang chỉnh, xem cloneElementStyleDraftDefaults()
        eseGeneratedCss: 'string', // chuỗi CSS mới nhất build từ eseDraft lúc bấm Áp dụng (setElementStyleGeneratedCss())
        eseLoadedGoogleFonts: 'array', // family đã inject <link> vào <head> trong phiên này (tránh nạp trùng)
    },
    buildDefaults() {
        return {
            eseActiveTab: 'box',
            eseDraft: cloneElementStyleDraftDefaults(),
            eseGeneratedCss: '',
            eseLoadedGoogleFonts: [],
        };
    },
});
