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
    if (box.background.enabled) parts.push(`background-color: ${box.background.value}`);
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
    if (text.textShadow.enabled) parts.push(`text-shadow: ${text.textShadow.offsetX}px ${text.textShadow.offsetY}px ${text.textShadow.blur}px ${text.textShadow.color}`);

    return parts.join('; ');
}

/** MỚI (16/08/2026, mục 2 — Giang yêu cầu "cung cấp cấu hình mặc định cho subtitles giống như
 * hiện tại khi bật styling editor") — đọc NGƯỢC 1 chuỗi CSS ĐÃ BUILD trước đó (đúng định dạng xuất
 * bởi buildElementStyleCssString(), vd `subtitleBoxCss` đã lưu, core/subtitle/subtitle-style-
 * settings.js) thành PATCH ghi đè lên draft trắng — để Drawer tự nạp khớp giá trị hiện tại thay vì
 * luôn mở trắng mỗi lần (xem docstring open(), event/workflow/element-style-editor.js — hàm ĐÓ đã
 * dự trù đúng điểm mở rộng này: "nơi gọi tự đọc style hiện có + dựng lại draft tương ứng").
 *
 * Thuần tính toán, không đụng appState/DOM (đối xứng buildElementStyleCssString(), CÙNG file, CÙNG
 * Rule 1-5) — mỗi nhánh `if (prop === ...)` CHỈ khớp ĐÚNG 1 khai báo CSS đã biết, không chia sẻ
 * logic chéo nhau, cùng nguyên tắc "mỗi if là 1 guard độc lập" như buildElementStyleCssString()
 * (không phải rẽ nhánh 1 tiến trình chung, không vi phạm Rule 1). `_parseValueUnit()` là hàm con
 * NỘI BỘ (khai báo TRONG chính hàm này, KHÔNG phải hàm core độc lập) — CÙNG lý do `sizeValue()`/
 * `sidesValue()` ở buildElementStyleCssString() là biểu thức inline, tránh vướng Rule 3/3c.
 *
 * Khai báo nào KHÔNG có mặt trong `cssString` thì field tương ứng ĐƠN GIẢN vắng mặt trong patch trả
 * về (nơi gọi tự merge nông lên draft trắng đã reset — field không có patch giữ nguyên mặc định
 * trắng của chính nó, xem applyElementStyleCssStringToDraft() ngay dưới).
 * @param {string} cssString
 * @returns {{box: object, text: object}} - patch THEO ĐÚNG shape draft (chỉ chứa field có mặt).
 */
function parseElementStyleCssString(cssString) {
    const _parseValueUnit = (token) => {
        const m = /^(-?[\d.]+)([a-z%]*)$/i.exec((token || '').trim());
        return m ? { value: parseFloat(m[1]), unit: m[2] } : { value: 0, unit: '' };
    };
    const patch = { box: {}, text: {} };
    if (!cssString) return patch;

    cssString.split(';').map((s) => s.trim()).filter(Boolean).forEach((decl) => {
        const idx = decl.indexOf(':');
        if (idx === -1) return; // guard: khai báo lỗi định dạng, bỏ qua
        const prop = decl.slice(0, idx).trim();
        const value = decl.slice(idx + 1).trim();

        if (prop === 'width' || prop === 'height') {
            if (value === 'fit-content') patch.box[prop] = { mode: 'fit' };
            else if (value === 'auto') patch.box[prop] = { mode: 'auto' };
            else { const vu = _parseValueUnit(value); patch.box[prop] = { mode: 'custom', value: vu.value, unit: vu.unit }; }
        } else if (prop === 'padding' || prop === 'margin') {
            const tk = value.split(/\s+/);
            const top = _parseValueUnit(tk[0]); const right = _parseValueUnit(tk[1] || tk[0]);
            const bottom = _parseValueUnit(tk[2] || tk[0]); const left = _parseValueUnit(tk[3] || tk[1] || tk[0]);
            patch.box[prop] = { enabled: true, unit: top.unit || 'px', top: top.value, right: right.value, bottom: bottom.value, left: left.value };
        } else if (prop === 'background-color') {
            patch.box.background = { enabled: true, value };
        } else if (prop === 'border') {
            const m = /^([\d.]+)([a-z%]*)\s+(\S+)\s+(.+)$/i.exec(value);
            if (m) patch.box.border = { enabled: true, width: parseFloat(m[1]), widthUnit: m[2] || 'px', style: m[3], color: m[4] };
        } else if (prop === 'opacity') {
            patch.box.opacity = { enabled: true, value: Math.round(parseFloat(value) * 100) };
        } else if (prop === 'font-family') {
            const qm = /^'([^']*)'/.exec(value);
            patch.text.fontFamily = { enabled: true, source: /,\s*sans-serif\s*$/.test(value) ? 'google' : 'system', value: qm ? qm[1] : value.split(',')[0].trim(), googleWeight: '400' };
        } else if (prop === 'font-size') {
            const vu = _parseValueUnit(value); patch.text.fontSize = { enabled: true, value: vu.value, unit: vu.unit };
        } else if (prop === 'font-weight') {
            patch.text.fontWeight = value;
        } else if (prop === 'font-style') {
            patch.text.fontStyle = value;
        } else if (prop === 'line-height') {
            const vu = _parseValueUnit(value); patch.text.lineHeight = { enabled: true, value: vu.value, unit: vu.unit || 'none' };
        } else if (prop === 'letter-spacing') {
            const vu = _parseValueUnit(value); patch.text.letterSpacing = { enabled: true, value: vu.value, unit: vu.unit };
        } else if (prop === 'text-align') {
            patch.text.textAlign = value;
        } else if (prop === 'text-decoration') {
            patch.text.textDecoration = value;
        } else if (prop === 'text-transform') {
            patch.text.textTransform = value;
        } else if (prop === 'color') {
            patch.text.color = { enabled: true, value };
        } else if (prop === 'white-space') {
            patch.text.whiteSpace = value;
        } else if (prop === 'text-shadow') {
            const m = /^(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(.+)$/i.exec(value);
            if (m) patch.text.textShadow = { enabled: true, offsetX: parseFloat(m[1]), offsetY: parseFloat(m[2]), blur: parseFloat(m[3]), color: m[4] };
        }
    });

    return patch;
}

/** MỚI (16/08/2026, mục 2) — đọc 1 chuỗi CSS đã lưu (vd `subtitleBoxCss`) rồi GHI ĐÈ đúng field
 * tương ứng lên `eseDraft` HIỆN TẠI trong appState (property nào KHÔNG có mặt trong chuỗi thì GIỮ
 * NGUYÊN mặc định trắng của chính field đó — merge NÔNG, CÙNG cơ chế setElementStyleField()) — gọi
 * NGAY SAU resetElementStyleDraft() lúc open() 1 target ĐÃ CÓ style lưu sẵn (xem event/workflow/
 * element-style-editor.js::open(), tham số `initialCssString`).
 * TÁCH RIÊNG khỏi parseElementStyleCssString() (thuần tính toán, không đụng appState) — hàm NÀY mới
 * là chỗ GHI appState (Rule 2: Core không TỰ appState.get(), nhưng appState.set()/mutate() GHI thì
 * vẫn đúng tiền lệ mọi hàm set* khác trong file này, vd setElementStyleField()). */
function applyElementStyleCssStringToDraft(cssString) {
    const patch = parseElementStyleCssString(cssString); // thuần tính toán, cùng file
    appState.mutate('eseDraft', (draft) => {
        Object.keys(patch.box).forEach((key) => { draft.box[key] = patch.box[key]; });
        Object.keys(patch.text).forEach((key) => { draft.text[key] = patch.text[key]; });
    });
    console.log(`writer: "applyElementStyleCssStringToDraft", page: "eseDraft", content: "nạp lại khớp chuỗi CSS đã lưu"`);
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

