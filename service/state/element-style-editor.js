/**
 * service/state/element-style-editor.js — package state runtime của Element Style Editor (event/workflow/
 * element-style-editor.js). Draft chỉ sống trong phiên Drawer đang mở, không tự lưu DB — nơi mở tự lưu qua `onApply`.
 * Cơ chế package: service/state.js (nạp sau file đó).
 */

/** Draft mặc định. Field có giá trị số/nhiều phần dùng khung `{enabled, ...}` — buildElementStyleCssString() chỉ ghép
 * field `enabled`. Field chỉ có 1 dropdown (fontWeight/fontStyle/textAlign/textDecoration/textTransform/whiteSpace) là
 * chuỗi thuần, `'none'` = không áp. Width/Height: `mode: 'none'` = không áp. */
function cloneElementStyleDraftDefaults() {
    return {
        box: {
            // mode: 'none' | 'custom' (value+unit) | 'fit' (fit-content) | 'auto'
            width: { mode: 'none', value: 100, unit: 'px' },
            height: { mode: 'none', value: 100, unit: 'px' },
            // 4 cạnh dùng chung 1 unit
            padding: { enabled: false, unit: 'px', top: 0, right: 0, bottom: 0, left: 0 },
            margin: { enabled: false, unit: 'px', top: 0, right: 0, bottom: 0, left: 0 },
            // xuất `background-color` (không shorthand `background` — giữ background-image... sẵn có của target)
            background: { enabled: false, value: '#ffffff' },
            border: { enabled: false, width: 1, widthUnit: 'px', style: 'solid', color: '#000000' },
            opacity: { enabled: false, value: 100 }, // 0-100, quy đổi /100 lúc build CSS
        },
        text: {
            // UI chỉ chọn 'google'; 'system' vẫn hợp lệ khi nạp lại style đã lưu từ trước
            fontFamily: { enabled: false, source: 'google', value: '', googleWeight: '400' },
            fontSize: { enabled: false, value: 16, unit: 'px' },
            fontWeight: 'none',
            fontStyle: 'none',
            lineHeight: { enabled: false, value: 1.5, unit: 'none' }, // unit 'none' = số nhân không đơn vị (line-height: 1.5)
            letterSpacing: { enabled: false, value: 0, unit: 'px' },
            textAlign: 'none',
            textDecoration: 'none',
            textTransform: 'none',
            color: { enabled: false, value: '#000000' },
            whiteSpace: 'none',
            // offset/blur luôn px; màu bóng tách khỏi `color` (màu chữ)
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
