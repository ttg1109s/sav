/**
 * core/element-style-editor.js — core thuần của công cụ chung "dựng CSS box model + text style qua UI"
 * (state: service/state/element-style-editor.js). Không biết Drawer/DOM nào là target — Workflow
 * (event/workflow/element-style-editor.js) đọc appState rồi truyền vào.
 *
 * NẠP SAU: service/state.js, service/state/element-style-editor.js (cloneElementStyleDraftDefaults()).
 */

/** Đổi tab đang xem ('box' | 'text'). */
function setElementStyleActiveTab(tab) {
    appState.set('eseActiveTab', tab);
    console.log(`writer: "setElementStyleActiveTab", page: "eseActiveTab", content: "${tab}"`);
}

/** Giá trị thô của 1 ô `.ese-field` -> giá trị ghi vào draft: ô `data-numeric` -> số, còn lại giữ chuỗi.
 * @param {string} raw @param {boolean} isNumeric @returns {number|string} */
function resolveElementStyleFieldValue(raw, isNumeric) {
    return isNumeric ? parseFloat(raw) : raw;
}

/** Ghi 1 field DẠNG OBJECT ({enabled,...}/{mode,...}) trong draft — `patch` merge NÔNG vào field hiện có.
 * Field dropdown-thuần (chuỗi) dùng setElementStyleSimpleField(). */
function setElementStyleField(section, key, patch) {
    appState.mutate('eseDraft', (draft) => {
        draft[section][key] = { ...draft[section][key], ...patch };
    });
    console.log(`writer: "setElementStyleField", page: "eseDraft.${section}.${key}", content: "${JSON.stringify(patch)}"`);
}

/** Ghi thẳng chuỗi cho field dropdown-thuần (fontWeight/fontStyle/textAlign/textDecoration/textTransform/
 * whiteSpace) — `'none'` = không áp. */
function setElementStyleSimpleField(section, key, value) {
    appState.mutate('eseDraft', (draft) => { draft[section][key] = value; });
    console.log(`writer: "setElementStyleSimpleField", page: "eseDraft.${section}.${key}", content: "${value}"`);
}

/** Reset draft về mặc định trắng — lúc mở Drawer cho 1 target mới. */
function resetElementStyleDraft() {
    appState.set('eseDraft', cloneElementStyleDraftDefaults()); // service/state/element-style-editor.js
    console.log(`writer: "resetElementStyleDraft", page: "eseDraft", content: "reset về mặc định"`);
}

/** Build chuỗi CSS ("prop: value; prop2: value2") từ draft — chỉ ghép property đang bật (field object:
 * `enabled`; dropdown-thuần: khác `'none'`; width/height: `mode !== 'none'`). Mỗi `if` bật/tắt 1 bước. */
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

/** Đọc ngược chuỗi CSS đã build (buildElementStyleCssString(), vd `subtitleBoxCss` đã lưu) thành PATCH theo
 * đúng shape draft — chỉ chứa field có mặt trong chuỗi. Gom khai báo thành bảng `prop -> value` (khai báo sau
 * đè khai báo trước), rồi mỗi property là 1 bước tuỳ chọn ghi đúng 1 field.
 * @param {string} cssString @returns {{box: object, text: object}} */
function parseElementStyleCssString(cssString) {
    const _parseValueUnit = (token) => {
        const m = /^(-?[\d.]+)([a-z%]*)$/i.exec((token || '').trim());
        return m ? { value: parseFloat(m[1]), unit: m[2] } : { value: 0, unit: '' };
    };
    const patch = { box: {}, text: {} };
    if (!cssString) return patch;

    const decl = Object.create(null);
    cssString.split(';').map((s) => s.trim()).filter(Boolean).forEach((item) => {
        const idx = item.indexOf(':');
        if (idx === -1) return; // khai báo lỗi định dạng, bỏ qua
        decl[item.slice(0, idx).trim()] = item.slice(idx + 1).trim();
    });

    ['width', 'height'].forEach((prop) => {
        if (!(prop in decl)) return;
        const value = decl[prop];
        patch.box[prop] = value === 'fit-content' ? { mode: 'fit' }
            : value === 'auto' ? { mode: 'auto' }
                : { mode: 'custom', ..._parseValueUnit(value) };
    });
    ['padding', 'margin'].forEach((prop) => {
        if (!(prop in decl)) return;
        const tk = decl[prop].split(/\s+/);
        const top = _parseValueUnit(tk[0]); const right = _parseValueUnit(tk[1] || tk[0]);
        const bottom = _parseValueUnit(tk[2] || tk[0]); const left = _parseValueUnit(tk[3] || tk[1] || tk[0]);
        patch.box[prop] = { enabled: true, unit: top.unit || 'px', top: top.value, right: right.value, bottom: bottom.value, left: left.value };
    });
    if ('background-color' in decl) patch.box.background = { enabled: true, value: decl['background-color'] };
    if ('border' in decl) {
        const m = /^([\d.]+)([a-z%]*)\s+(\S+)\s+(.+)$/i.exec(decl.border);
        if (m) patch.box.border = { enabled: true, width: parseFloat(m[1]), widthUnit: m[2] || 'px', style: m[3], color: m[4] };
    }
    if ('opacity' in decl) patch.box.opacity = { enabled: true, value: Math.round(parseFloat(decl.opacity) * 100) };

    if ('font-family' in decl) {
        const value = decl['font-family'];
        const qm = /^'([^']*)'/.exec(value);
        patch.text.fontFamily = { enabled: true, source: /,\s*sans-serif\s*$/.test(value) ? 'google' : 'system', value: qm ? qm[1] : value.split(',')[0].trim(), googleWeight: '400' };
    }
    if ('font-size' in decl) {
        const vu = _parseValueUnit(decl['font-size']);
        patch.text.fontSize = { enabled: true, value: vu.value, unit: vu.unit };
    }
    if ('font-weight' in decl) patch.text.fontWeight = decl['font-weight'];
    if ('font-style' in decl) patch.text.fontStyle = decl['font-style'];
    if ('line-height' in decl) {
        const vu = _parseValueUnit(decl['line-height']);
        patch.text.lineHeight = { enabled: true, value: vu.value, unit: vu.unit || 'none' };
    }
    if ('letter-spacing' in decl) {
        const vu = _parseValueUnit(decl['letter-spacing']);
        patch.text.letterSpacing = { enabled: true, value: vu.value, unit: vu.unit };
    }
    if ('text-align' in decl) patch.text.textAlign = decl['text-align'];
    if ('text-decoration' in decl) patch.text.textDecoration = decl['text-decoration'];
    if ('text-transform' in decl) patch.text.textTransform = decl['text-transform'];
    if ('color' in decl) patch.text.color = { enabled: true, value: decl.color };
    if ('white-space' in decl) patch.text.whiteSpace = decl['white-space'];
    if ('text-shadow' in decl) {
        const m = /^(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(.+)$/i.exec(decl['text-shadow']);
        if (m) patch.text.textShadow = { enabled: true, offsetX: parseFloat(m[1]), offsetY: parseFloat(m[2]), blur: parseFloat(m[3]), color: m[4] };
    }

    return patch;
}

/** Ghi đè lên `eseDraft` đúng các field có trong patch (parseElementStyleCssString(), Workflow gọi trước) —
 * field vắng mặt giữ mặc định trắng. Gọi ngay sau resetElementStyleDraft() khi mở target đã có style lưu.
 * @param {{box: object, text: object}} patch */
function applyElementStyleCssPatchToDraft(patch) {
    appState.mutate('eseDraft', (draft) => {
        Object.keys(patch.box).forEach((key) => { draft.box[key] = patch.box[key]; });
        Object.keys(patch.text).forEach((key) => { draft.text[key] = patch.text[key]; });
    });
    console.log(`writer: "applyElementStyleCssPatchToDraft", page: "eseDraft", content: "nạp lại khớp chuỗi CSS đã lưu"`);
}

/** Lưu chuỗi CSS mới nhất vào state — bước trung gian trước khi áp lên DOM. */
function setElementStyleGeneratedCss(cssString) {
    appState.set('eseGeneratedCss', cssString);
    console.log(`writer: "setElementStyleGeneratedCss", page: "eseGeneratedCss", content: "${cssString}"`);
}

/** Áp chuỗi CSS làm inline style lên `targetEl` — `setProperty()` từng khai báo (không ghi đè `cssText`, giữ
 * style inline khác đã có). Thiếu targetEl hoặc chuỗi rỗng -> bỏ qua. */
function applyElementStyleToDom(targetEl, cssString) {
    if (!targetEl || !cssString) return;
    cssString.split(';').map((s) => s.trim()).filter(Boolean).forEach((decl) => {
        const idx = decl.indexOf(':');
        if (idx === -1) return; // khai báo lỗi định dạng, bỏ qua
        targetEl.style.setProperty(decl.slice(0, idx).trim(), decl.slice(idx + 1).trim());
    });
}

/** Nạp 1 Google Font qua `<link>` chèn vào <head> (cần mạng, không cache offline). `alreadyLoaded` = mảng family
 * đã nạp trong phiên (nơi gọi đọc `eseLoadedGoogleFonts`) — family rỗng/đã nạp -> bỏ qua. `<link>` không phải UI
 * tương tác nên file không cần hậu tố `-ui`. */
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
