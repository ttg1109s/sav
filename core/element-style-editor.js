/**
 * core/element-style-editor.js — Core thuần (tuân Rule 1-5, core-function-conventions.md) cho
 * công cụ CHUNG "dựng CSS box model + text style qua UI" (service/state/element-style-editor.js).
 *
 * Đây là NGHIỆP VỤ THUẦN, KHÔNG biết Drawer nào đang mở/DOM nào là target — Workflow (event/
 * workflow/element-style-editor.js) chịu trách nhiệm đọc appState (Rule 2 — Core không tự
 * appState.get()) rồi truyền vào đúng tham số.
 *
 * `applyElementStyleToDom()`/`buildElementStyleCssString()` KHÔNG đụng appState (không cần Rule 4)
 * — 2 hàm này thuần tính toán/ghi DOM, không phải state của app.
 *
 * NẠP SAU: service/state.js, service/state/element-style-editor.js (cloneElementStyleDraftDefaults()).
 */

/** Đổi tab đang xem ('box' | 'text'). */
function setElementStyleActiveTab(tab) {
    appState.set('eseActiveTab', tab);
    console.log(`writer: "setElementStyleActiveTab", page: "eseActiveTab", content: "${tab}"`);
}

/** Ghi 1 field bất kỳ trong draft (box hoặc text) — `patch` là object PARTIAL, merge NÔNG vào
 * field hiện có (vd chỉ đổi `{ enabled: true }` hoặc `{ value: 20 }`, giữ nguyên các key khác của
 * CHÍNH field đó). `section`/`field` chỉ dùng để LẬP CHỈ MỤC đúng chỗ ghi — không tạo ra 2 tiến
 * trình khác nhau (không có if/else nào rẽ theo section), nên KHÔNG vi phạm Rule 1.
 * CHỈ dùng cho field DẠNG OBJECT ({enabled,...}/{mode,...}) — field dropdown-thuần (string) dùng
 * setElementStyleSimpleField() bên dưới. */
function setElementStyleField(section, key, patch) {
    appState.mutate('eseDraft', (draft) => {
        draft[section][key] = { ...draft[section][key], ...patch };
    });
    console.log(`writer: "setElementStyleField", page: "eseDraft.${section}.${key}", content: "${JSON.stringify(patch)}"`);
}

/** MỚI (15/08/2026, Giang chỉ ra "None là dropdown") — ghi THẲNG giá trị string cho field
 * dropdown-thuần (fontWeight/fontStyle/textAlign/textDecoration/textTransform/whiteSpace,
 * service/state/element-style-editor.js) — KHÔNG merge object như setElementStyleField(), vì bản
 * thân field chỉ là 1 string (`'none'` = không áp, tự thân dropdown làm công tắc, không cần
 * `enabled` riêng nữa). */
function setElementStyleSimpleField(section, key, value) {
    appState.mutate('eseDraft', (draft) => { draft[section][key] = value; });
    console.log(`writer: "setElementStyleSimpleField", page: "eseDraft.${section}.${key}", content: "${value}"`);
}

/** Reset draft về mặc định trắng (mọi field `enabled: false`) — gọi lúc mở Drawer cho 1 target
 * MỚI, tránh còn sót giá trị của lần chỉnh trước. */
function resetElementStyleDraft() {
    appState.set('eseDraft', cloneElementStyleDraftDefaults()); // service/state/element-style-editor.js
    console.log(`writer: "resetElementStyleDraft", page: "eseDraft", content: "reset về mặc định"`);
}

/** Build chuỗi CSS (dạng "prop: value; prop2: value2") từ TOÀN BỘ draft — CHỈ ghép property nào
 * ĐANG BẬT (field object: `enabled === true`; field dropdown-thuần: khác `'none'`; width/height:
 * `mode !== 'none'`). Thuần tính toán, không side-effect, không đụng appState/DOM.
 * Mỗi `if` là GUARD bỏ qua property đó nếu tắt — xoá hết mọi guard thì hàm vẫn còn ĐÚNG 1 kịch
 * bản duy nhất ("ghép mọi property đang có vào chuỗi"), không phải rẽ nhánh 2 tiến trình khác
 * nhau — không vi phạm Rule 1. `sizeValue()`/`sidesValue()` là literal object (KHÔNG phải hàm con
 * độc lập gọi core khác, chỉ 1 biểu thức tra bảng inline) — tránh vướng Rule 3/3c. */
function buildElementStyleCssString(draft) {
    const parts = [];
    const box = draft.box;
    const text = draft.text;

    const sizeValue = (field) => (field.mode === 'fit' ? 'fit-content' : field.mode === 'auto' ? 'auto' : `${field.value}${field.unit}`);
    const sidesValue = (field) => `${field.top}${field.unit} ${field.right}${field.unit} ${field.bottom}${field.unit} ${field.left}${field.unit}`;

    if (box.width.mode !== 'none') parts.push(`width: ${sizeValue(box.width)}`);
    if (box.height.mode !== 'none') parts.push(`height: ${sizeValue(box.height)}`);
    if (box.padding.enabled) parts.push(`padding: ${sidesValue(box.padding)}`);
    if (box.margin.enabled) parts.push(`margin: ${sidesValue(box.margin)}`);
    if (box.border.enabled) parts.push(`border: ${box.border.width}${box.border.widthUnit} ${box.border.style} ${box.border.color}`);
    if (box.opacity.enabled) parts.push(`opacity: ${(box.opacity.value / 100).toFixed(2)}`);

    if (text.fontFamily.enabled && text.fontFamily.value) {
        const fallback = text.fontFamily.source === 'google' ? ', sans-serif' : '';
        parts.push(`font-family: '${text.fontFamily.value}'${fallback}`);
    }
    if (text.fontSize.enabled) parts.push(`font-size: ${text.fontSize.value}${text.fontSize.unit}`);
    if (text.fontWeight !== 'none') parts.push(`font-weight: ${text.fontWeight}`);
    if (text.fontStyle !== 'none') parts.push(`font-style: ${text.fontStyle}`);
    if (text.lineHeight.enabled) parts.push(`line-height: ${text.lineHeight.value}${text.lineHeight.unit === 'none' ? '' : text.lineHeight.unit}`);
    if (text.letterSpacing.enabled) parts.push(`letter-spacing: ${text.letterSpacing.value}${text.letterSpacing.unit}`);
    if (text.textAlign !== 'none') parts.push(`text-align: ${text.textAlign}`);
    if (text.textDecoration !== 'none') parts.push(`text-decoration: ${text.textDecoration}`);
    if (text.textTransform !== 'none') parts.push(`text-transform: ${text.textTransform}`);
    if (text.color.enabled) parts.push(`color: ${text.color.value}`);
    if (text.whiteSpace !== 'none') parts.push(`white-space: ${text.whiteSpace}`);

    return parts.join('; ');
}

/** Lưu chuỗi CSS mới nhất (build từ buildElementStyleCssString()) vào state — bước trung gian
 * TRƯỚC khi áp lên DOM, đúng luồng Giang yêu cầu ("tạo chuỗi css lưu vào state -> add vào DOM"). */
function setElementStyleGeneratedCss(cssString) {
    appState.set('eseGeneratedCss', cssString);
    console.log(`writer: "setElementStyleGeneratedCss", page: "eseGeneratedCss", content: "${cssString}"`);
}

/** Áp 1 chuỗi CSS (dạng "prop: value; prop2: value2") làm inline style lên ĐÚNG 1 DOM được truyền
 * vào — ghi qua `style.setProperty()` TỪNG khai báo một (không ghi đè cả `style.cssText`), để
 * KHÔNG xoá mất style inline khác đã có sẵn trên chính targetEl từ trước (nếu có). Guard clause:
 * thiếu targetEl hoặc cssString rỗng -> dừng sớm, KHÔNG phải tiến trình khác. */
function applyElementStyleToDom(targetEl, cssString) {
    if (!targetEl || !cssString) return;
    cssString.split(';').map((s) => s.trim()).filter(Boolean).forEach((decl) => {
        const idx = decl.indexOf(':');
        if (idx === -1) return; // guard: khai báo lỗi định dạng, bỏ qua
        targetEl.style.setProperty(decl.slice(0, idx).trim(), decl.slice(idx + 1).trim());
    });
}

/** Nạp 1 Google Font qua thẻ <link> chèn ĐỘNG vào <head> — CẦN MẠNG ngay lúc gọi (app chạy qua
 * file://, KHÔNG cache offline — quyết định của Giang, xem hội thoại). `alreadyLoaded` (mảng
 * family đã nạp trong phiên) PHẢI do nơi gọi tự `appState.get('eseLoadedGoogleFonts')` rồi truyền
 * vào (Rule 2). Guard clause: family rỗng hoặc ĐÃ có trong alreadyLoaded -> dừng sớm, không tạo
 * <link> trùng (mỗi family chỉ inject 1 lần/phiên, dù đổi weight — trang CSS2 của Google Fonts hỗ
 * trợ liệt kê nhiều weight cùng lúc trong 1 URL nếu cần mở rộng sau).
 *
 * `<link>` KHÔNG phải "dựng UI tương tác" (không addEventListener, người dùng không thao tác trực
 * tiếp lên nó) — KHÔNG thuộc phạm vi Rule 5a/5c, không cần hậu tố `-ui` cho file này. */
function loadGoogleFont(family, weight, alreadyLoaded) {
    if (!family || alreadyLoaded.includes(family)) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.dataset.googleFont = family;
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight || '400'}&display=swap`;
    document.head.appendChild(link);

    appState.mutate('eseLoadedGoogleFonts', (arr) => arr.push(family));
    console.log(`writer: "loadGoogleFont", page: "eseLoadedGoogleFonts", content: "push '${family}' — đã inject <link> Google Font"`);
}
