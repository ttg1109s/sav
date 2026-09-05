/**
 * Component: nội dung Generic Drawer cho "Element Style Editor" (công cụ CHUNG dựng CSS box model
 * + text style, xem event/workflow/element-style-editor.js). 2 tab Box/Chữ — chuyển tab RE-RENDER
 * TOÀN BỘ body (cùng cơ chế `_rerenderBody()` của Custom Effect Drawer, components/
 * custom-effect-drawer.js). Bảng màu SÁNG cố định (Generic Drawer loại trừ theme).
 *
 * i18n (MỚI — trước đây hard-code tiếng Việt thẳng, Giang yêu cầu nối vào hệ chung) — namespace
 * `elementStyleEditor.*`, key EN mặc định ở lang/patch/patch-visualizer.js (CÙNG nhà
 * `customEffectDrawer.*`/`eqPresetsDrawer.*`/`visualizerSettingsDrawer.*`, mọi Drawer nội dung
 * visualizer đều gom về đó). CHỈ dịch NHÃN mô tả (tên field/mode/nguồn font...) — KHÔNG dịch giá
 * trị option là keyword CSS thuần (px/em/solid/dashed/left/center...), vì đó là token kỹ thuật
 * quốc tế, không phải văn bản ngôn ngữ (cùng lý do core/custom-effect.js không dịch 'mirror'/
 * 'cascade' RA GIÁ TRỊ lưu — chỉ dịch NHÃN hiển thị của chúng qua CUSTOM_EFFECT_STYLE_LABEL_KEYS,
 * ở đây đơn giản hơn nên không tách bảng label riêng, giữ luôn giá trị CSS làm text hiển thị).
 *
 * QUY ƯỚC data-attribute — Workflow querySelectorAll theo class chung để wire, KHÔNG hard-code
 * từng field 1 (mirror `.ce-field-toggle`/`.ce-field-slider` của Custom Effect Drawer):
 *   - `.ese-enable` (checkbox) — data-section, data-field. Bật/tắt 1 property, ĐỔI thì phải
 *     re-render (hiện/ẩn khối input con), Workflow tự biết qua chính class này.
 *   - `.ese-field` (input/select bất kỳ) — data-section, data-field, data-subkey, data-numeric
 *     ("1" nếu cần parseFloat), data-rerender ("1" nếu đổi field này cũng cần re-render toàn body,
 *     vd đổi `mode` width/height ẩn/hiện khối value+unit). DÙNG CHO field DẠNG OBJECT.
 *   - `.ese-simple-field` (select) — MỚI (15/08/2026) — data-section, data-field. Field
 *     DROPDOWN-THUẦN (string, "None" LÀ 1 option ngay trong list, tự làm công tắc — KHÔNG có
 *     `.ese-enable` riêng cho nhóm field này nữa) — fontWeight/fontStyle/textAlign/
 *     textDecoration/textTransform/whiteSpace.
 *   - `data-cross-target="<id>"` — đồng bộ hiển thị 2 input cùng biểu diễn 1 giá trị (text hex +
 *     color picker), CÙNG pattern `#ce-solid-color-text`/`#ce-solid-color-picker`.
 *
 * NẠP SAU: components/generic-drawer.js, lang/lang.js (cần hàm t()).
 */

const ESE_TOGGLE_MARKUP = `
    <div class="w-9 h-5 bg-slate-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>`;

const ESE_LENGTH_UNITS = ['px', '%', 'em', 'rem', 'vw', 'vh', 'pt', 'cm', 'mm', 'in', 'ch'];

function renderElementStyleEditorHeader(activeTab) {
    const tabBtn = (key, label) => `
        <button data-ese-tab="${key}" class="px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${activeTab === key ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600'}">${label}</button>`;
    return `
        <div class="flex justify-between items-center px-5 pb-3 border-b border-slate-200">
            <div class="flex items-center gap-2">${tabBtn('box', t('elementStyleEditor.tab.box'))}${tabBtn('text', t('elementStyleEditor.tab.text'))}</div>
            <button id="btn-generic-drawer-close" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>`;
}

/** MỚI (16/08/2026 — Giang yêu cầu "ô preview cố định ở trong body drawer") — `_renderEsePreviewBox()`
 * LUÔN đứng ĐẦU body (TRƯỚC nội dung 2 tab), `sticky top-0` — "cố định" theo đúng nghĩa Giang yêu
 * cầu: body Drawer cuộn dọc (`overflow-y-auto`, bodyClass truyền từ Workflow), riêng khối preview
 * PHẢI dính lại đỉnh khi cuộn qua các card field bên dưới, KHÔNG cuộn mất — sticky (KHÔNG phải
 * fixed thật) chính là cách làm ĐÚNG cho 1 phần tử "cố định bên trong 1 vùng cuộn cụ thể" (fixed
 * thật sẽ neo theo viewport, sai ngữ cảnh — trôi ra ngoài Drawer lúc Drawer tự cuộn/đóng).
 * `-mx-4 px-4` — triệt tiêu padding NGANG `px-4` của chính body (bodyClass, truyền từ Workflow) CHỈ
 * cho riêng khối này, để nền trắng (`bg-white`) phủ TRÀN 2 mép khi dính đỉnh (không vậy sẽ hở 2
 * bên, thấy card bên dưới lọt qua viền trái/phải lúc cuộn).
 *
 * SỬA (mục 3, Giang chỉ ra "preview đang có khe hở ở top") — TỪNG dùng THÊM `-mt-3` (bù trừ padding
 * DỌC `py-3` của body, cùng cơ chế với `-mx-4`) NHƯNG margin ÂM không triệt tiêu ĐÁNG TIN CẬY padding-
 * top của vùng cuộn cha khi áp lên 1 phần tử `position: sticky` (khác hẳn phần tử thường) — vài
 * engine (đặc biệt Safari/WebKit, xem lịch sử khó khăn tương tự ở components/generic-drawer.js) tính
 * điểm "dính" của sticky dựa trên mép PADDING của vùng cuộn cha, bỏ qua phần margin âm đã kéo box
 * lên — kết quả: dù vị trí TĨNH (trước khi cuộn) đúng khớp mép trên, lúc đã "dính" lại hở ra ĐÚNG 1
 * khoảng bằng `py-3` gốc của body. SỬA TẬN GỐC — bỏ hẳn cơ chế "trừ đi rồi cộng lại" cho TRỤC DỌC:
 * body (event/workflow/element-style-editor.js::_render()) đổi bodyClass bỏ hẳn `pt-*` (chỉ còn
 * `pb-3`, không đụng gì trục ngang), NHƯỜNG TOÀN BỘ padding-top cho ĐÚNG 1 nơi — `pt-3` của chính
 * khối preview này — không còn gì để "triệt tiêu" nữa nên không còn phụ thuộc hành vi margin âm +
 * sticky của bất kỳ engine nào.
 * Nội dung preview LUÔN hiển thị CHUNG cả Box lẫn Text (KHÔNG đổi theo tab đang xem) — vì Style áp
 * dụng đồng thời cả 2 nhóm property lúc build CSS cuối (buildElementStyleCssString(), core/
 * element-style-editor.js đọc CẢ `draft.box` LẪN `draft.text` cùng lúc, không tách theo tab).
 * `#ese-preview-box` KHỞI TẠO KHÔNG style — Workflow tự áp NGAY sau mỗi lần vẽ/đổi field
 * (`_updatePreview()`, event/workflow/element-style-editor.js) bằng ĐÚNG `applyElementStyleToDom()`
 * + `buildElementStyleCssString()` (core) — TÁI DÙNG y hệt cặp hàm cuối cùng lúc bấm "Áp dụng"
 * thật, đảm bảo preview KHÔNG BAO GIỜ lệch so với kết quả thật sẽ áp lên targetEl. */
function _renderEsePreviewBox() {
    return `
        <div class="sticky top-0 z-10 -mx-4 px-4 pt-3 pb-3 mb-1 bg-white border-b border-slate-200">
            <div class="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">${t('elementStyleEditor.preview.label')}</div>
            <div class="h-20 rounded-xl bg-slate-100 flex items-center justify-center overflow-auto px-2">
                <div id="ese-preview-box" class="max-w-full">${t('elementStyleEditor.preview.sampleText')}</div>
            </div>
        </div>`;
}

function renderElementStyleEditorBody(draft, activeTab, loadedGoogleFonts) {
    const content = activeTab === 'text' ? _renderEseTextTab(draft.text, loadedGoogleFonts) : _renderEseBoxTab(draft.box);
    return `
        <div class="flex flex-col gap-3">
            ${_renderEsePreviewBox()}
            ${content}
            <button id="ese-apply-btn" class="mt-1 w-full py-2.5 rounded-xl bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 transition-colors">${t('elementStyleEditor.apply')}</button>
        </div>`;
}

/** Khung card "toggle + nội dung con (ẩn nếu tắt)" DÙNG CHUNG cho mọi property — mirror pattern
 * blur section của Custom Effect Drawer (`ce-blur-enable`/`ce-blur-intensity-row`). */
function _eseCard(section, field, label, enabled, innerHtml) {
    return `
        <div class="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
            <div class="flex justify-between items-center px-4 py-3 ${enabled ? 'border-b border-slate-200' : ''}">
                <span class="text-sm text-slate-700">${label}</span>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" class="sr-only peer ese-enable" data-section="${section}" data-field="${field}" ${enabled ? 'checked' : ''}>
                    ${ESE_TOGGLE_MARKUP}
                </label>
            </div>
            <div class="${enabled ? 'flex' : 'hidden'} flex-col gap-2 px-4 py-3">${innerHtml}</div>
        </div>`;
}

function _eseSelect(section, field, subkey, options, current, rerender) {
    const opts = options.map((o) => `<option value="${o.value}" ${o.value === current ? 'selected' : ''}>${o.label}</option>`).join('');
    return `<select class="ese-field bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-900 outline-none" data-section="${section}" data-field="${field}" data-subkey="${subkey}" ${rerender ? 'data-rerender="1"' : ''}>${opts}</select>`;
}

/** MỚI (15/08/2026, Giang chỉ ra "None là dropdown") — select cho field DROPDOWN-THUẦN (string,
 * KHÔNG phải object {enabled,value}) — class RIÊNG `.ese-simple-field` (KHÔNG phải `.ese-field`,
 * wiring khác — event/workflow/element-style-editor.js gọi setElementStyleSimpleField() thẳng,
 * không qua cơ chế merge subkey). "None" LUÔN là option ĐẦU (tự làm công tắc tắt/mở, không cần
 * checkbox riêng nữa). */
function _eseSimpleSelect(section, field, options, current) {
    const opts = options.map((o) => `<option value="${o.value}" ${o.value === current ? 'selected' : ''}>${o.label}</option>`).join('');
    return `<select class="ese-simple-field bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-900 outline-none" data-section="${section}" data-field="${field}">${opts}</select>`;
}

/** 1 hàng "nhãn + dropdown (có None đầu list)" — KHÔNG card/toggle (dropdown tự là công tắc). */
function _renderEseSimpleRow(label, section, field, current, values) {
    const options = [{ value: 'none', label: t('elementStyleEditor.mode.none') }, ...values.map((v) => ({ value: v, label: v }))];
    return `
        <div class="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 flex justify-between items-center gap-2">
            <span class="text-sm text-slate-700">${label}</span>
            ${_eseSimpleSelect(section, field, options, current)}
        </div>`;
}

function _eseNumber(section, field, subkey, value, step) {
    return `<input type="number" value="${value}" step="${step || 1}" class="ese-field w-20 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-900 outline-none" data-section="${section}" data-field="${field}" data-subkey="${subkey}" data-numeric="1">`;
}

/** MỚI (16/08/2026, mục 2) — cặp input màu (text hex đồng bộ 2 chiều <-> color picker tròn, CÙNG
 * `data-cross-target`) DÙNG CHUNG cho 4 field màu trong Drawer (text.color/box.border.color/
 * box.background.value/text.textShadow.color, TÁCH từ 2 bản gần giống hệt nhau trước đó —
 * `_renderEseColorField()`/phần màu của `_renderEseBorderField()`). `idPrefix` PHẢI duy nhất/field
 * (id DOM toàn trang, đụng nhau thì `data-cross-target` đồng bộ NHẦM field khác). */
function _eseColorPair(idPrefix, section, field, subkey, value) {
    return `
        <div class="flex items-center gap-2">
            <input type="text" id="ese-${idPrefix}-color-text" data-cross-target="ese-${idPrefix}-color-picker" value="${value}" class="ese-field w-20 bg-transparent border-b border-slate-300 px-1 py-0.5 text-xs text-slate-900 outline-none font-mono text-right uppercase" data-section="${section}" data-field="${field}" data-subkey="${subkey}">
            <div class="w-8 h-8 rounded-full border border-slate-300 overflow-hidden shrink-0"><input type="color" id="ese-${idPrefix}-color-picker" data-cross-target="ese-${idPrefix}-color-text" value="${value}" class="ese-field w-10 h-10 -m-1 cursor-pointer" data-section="${section}" data-field="${field}" data-subkey="${subkey}"></div>
        </div>`;
}

function _eseUnitOptions(units) {
    return units.map((u) => ({ value: u, label: u }));
}

/** 1 hàng "nhãn + input số + select unit" dùng cho font-size/letter-spacing. */
function _eseValueUnitRow(label, section, field, value, unit, units) {
    return `
        <div class="flex justify-between items-center">
            <span class="text-xs text-slate-500">${label}</span>
            <div class="flex items-center gap-1.5">
                ${_eseNumber(section, field, 'value', value, field === 'letterSpacing' ? 0.1 : 1)}
                ${_eseSelect(section, field, 'unit', _eseUnitOptions(units), unit, false)}
            </div>
        </div>`;
}

// ---------------------------------------------------------------------------------------------
// TAB BOX
// ---------------------------------------------------------------------------------------------

function _renderEseBoxTab(box) {
    return `
        ${_renderEseSizeRow(t('elementStyleEditor.box.width'), 'box', 'width', box.width)}
        ${_renderEseSizeRow(t('elementStyleEditor.box.height'), 'box', 'height', box.height)}
        ${_eseCard('box', 'padding', t('elementStyleEditor.box.padding'), box.padding.enabled, _renderEseSidesField('box', 'padding', box.padding))}
        ${_eseCard('box', 'margin', t('elementStyleEditor.box.margin'), box.margin.enabled, _renderEseSidesField('box', 'margin', box.margin))}
        ${_eseCard('box', 'background', t('elementStyleEditor.box.background'), box.background.enabled, _renderEseBackgroundField(box.background))}
        ${_eseCard('box', 'border', t('elementStyleEditor.box.border'), box.border.enabled, _renderEseBorderField(box.border))}
        ${_eseCard('box', 'opacity', t('elementStyleEditor.box.opacity'), box.opacity.enabled, _renderEseOpacityField(box.opacity))}
    `;
}

/** MỚI (15/08/2026) — Width/Height bỏ hẳn card+toggle riêng — `mode` thêm lựa chọn `'none'`
 * (LÀM CÔNG TẮC LUÔN, xem cloneElementStyleDraftDefaults(), service/state/element-style-editor.js)
 * — vẫn dùng `_eseSelect()` thường (KHÔNG phải `_eseSimpleSelect()`) vì `mode` vẫn là SUBKEY của
 * object {mode,value,unit}, không phải field dropdown-thuần. */
function _renderEseSizeRow(label, section, field, f) {
    const modeOptions = [
        { value: 'none', label: t('elementStyleEditor.mode.none') },
        { value: 'custom', label: t('elementStyleEditor.mode.custom') },
        { value: 'fit', label: t('elementStyleEditor.mode.fit') },
        { value: 'auto', label: t('elementStyleEditor.mode.auto') },
    ];
    const valueRow = f.mode === 'custom' ? `
        <div class="flex justify-between items-center px-4 py-3 border-t border-slate-200">
            <span class="text-xs text-slate-500">${t('elementStyleEditor.field.value')}</span>
            <div class="flex items-center gap-1.5">
                ${_eseNumber(section, field, 'value', f.value, 1)}
                ${_eseSelect(section, field, 'unit', _eseUnitOptions(ESE_LENGTH_UNITS), f.unit, false)}
            </div>
        </div>` : '';
    return `
        <div class="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
            <div class="flex justify-between items-center px-4 py-3">
                <span class="text-sm text-slate-700">${label}</span>
                ${_eseSelect(section, field, 'mode', modeOptions, f.mode, true)}
            </div>
            ${valueRow}
        </div>`;
}

/** SỬA (16/08/2026, Giang phát hiện — "phần rìa input left đang bị ra ngoài") — hàng 4 input Top/
 * Right/Bottom/Left TỪNG dùng `flex justify-between gap-2` + input `w-20` (80px) CỐ ĐỊNH: 4×80px +
 * 3×gap(8px) = 344px, CỘNG padding 2 lớp bao ngoài (body px-4 + card px-4 = 64px) VƯỢT bề rộng màn
 * hình hẹp (iPhone ~375-393px khả dụng ~329px cho riêng hàng này) -> input cuối (Left) bị đẩy tràn
 * ra ngoài viewport (flex item không tự co vì `width` khai báo cứng "thắng" trước khi flex-shrink
 * kịp tính, xem hội thoại). SỬA: đổi `grid grid-cols-4` (4 cột LUÔN chia đều bề rộng khả dụng, tự
 * co giãn theo màn hình, không phụ thuộc bề rộng nội dung input) + input đổi `w-20` cố định ->
 * `w-full min-w-0` (co theo đúng cột grid của nó, `min-w-0` bắt buộc — mặc định input vẫn giữ 1 sàn
 * bề rộng tối thiểu riêng nếu thiếu khai báo này, dù đã nằm trong ô grid hẹp hơn). */
function _renderEseSidesField(section, field, f) {
    const sideInput = (side, labelKey) => `
        <div class="flex flex-col items-center gap-1 min-w-0">
            <span class="text-[10px] text-slate-400">${t(labelKey)}</span>
            <input type="number" value="${f[side]}" step="1" class="ese-field w-full min-w-0 text-center bg-white border border-slate-300 rounded-lg px-1 py-1.5 text-xs text-slate-900 outline-none" data-section="${section}" data-field="${field}" data-subkey="${side}" data-numeric="1">
        </div>`;
    return `
        <div class="flex justify-between items-center">
            <span class="text-xs text-slate-500">${t('elementStyleEditor.field.unit')}</span>
            ${_eseSelect(section, field, 'unit', _eseUnitOptions(ESE_LENGTH_UNITS), f.unit, false)}
        </div>
        <div class="grid grid-cols-4 gap-1.5">
            ${sideInput('top', 'elementStyleEditor.side.top')}${sideInput('right', 'elementStyleEditor.side.right')}${sideInput('bottom', 'elementStyleEditor.side.bottom')}${sideInput('left', 'elementStyleEditor.side.left')}
        </div>`;
}

/** MỚI (16/08/2026, mục 2 — Giang chỉ ra "đang thiếu background cho box"). */
function _renderEseBackgroundField(bg) {
    return `
        <div class="flex justify-between items-center">
            <span class="text-xs text-slate-500">${t('elementStyleEditor.field.value')}</span>
            ${_eseColorPair('background', 'box', 'background', 'value', bg.value)}
        </div>`;
}

function _renderEseBorderField(b) {
    const styleOptions = ['solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset', 'none'].map((v) => ({ value: v, label: v }));
    return `
        <div class="flex justify-between items-center">
            <span class="text-xs text-slate-500">${t('elementStyleEditor.border.width')}</span>
            <div class="flex items-center gap-1.5">
                ${_eseNumber('box', 'border', 'width', b.width, 1)}
                ${_eseSelect('box', 'border', 'widthUnit', _eseUnitOptions(['px', 'em', 'rem']), b.widthUnit, false)}
            </div>
        </div>
        <div class="flex justify-between items-center">
            <span class="text-xs text-slate-500">${t('elementStyleEditor.border.style')}</span>
            ${_eseSelect('box', 'border', 'style', styleOptions, b.style, false)}
        </div>
        <div class="flex justify-between items-center">
            <span class="text-xs text-slate-500">${t('elementStyleEditor.border.color')}</span>
            ${_eseColorPair('border', 'box', 'border', 'color', b.color)}
        </div>`;
}

/** MỚI — Opacity (0-100, quy đổi sang 0-1 lúc build CSS, xem buildElementStyleCssString(),
 * core/element-style-editor.js). Input số thay vì slider — nhất quán các field số khác trong
 * Drawer này (fontSize/letterSpacing...), tránh thêm cơ chế wiring riêng cho live-label của
 * slider (đơn giản hoá, xem hội thoại). */
function _renderEseOpacityField(o) {
    return `
        <div class="flex justify-between items-center">
            <span class="text-xs text-slate-500">${t('elementStyleEditor.field.value')} (%)</span>
            ${_eseNumber('box', 'opacity', 'value', o.value, 1)}
        </div>`;
}

// ---------------------------------------------------------------------------------------------
// TAB TEXT
// ---------------------------------------------------------------------------------------------

function _renderEseTextTab(text, loadedGoogleFonts) {
    return `
        ${_eseCard('text', 'fontFamily', t('elementStyleEditor.text.fontFamily'), text.fontFamily.enabled, _renderEseFontFamilyField(text.fontFamily, loadedGoogleFonts))}
        ${_eseCard('text', 'fontSize', t('elementStyleEditor.text.fontSize'), text.fontSize.enabled, _eseValueUnitRow(t('elementStyleEditor.field.value'), 'text', 'fontSize', text.fontSize.value, text.fontSize.unit, ['px', 'em', 'rem', '%', 'vw']))}
        ${_renderEseSimpleRow(t('elementStyleEditor.text.fontWeight'), 'text', 'fontWeight', text.fontWeight, ['100', '200', '300', '400', '500', '600', '700', '800', '900', 'normal', 'bold'])}
        ${_renderEseSimpleRow(t('elementStyleEditor.text.fontStyle'), 'text', 'fontStyle', text.fontStyle, ['normal', 'italic', 'oblique'])}
        ${_eseCard('text', 'lineHeight', t('elementStyleEditor.text.lineHeight'), text.lineHeight.enabled, _eseValueUnitRow(t('elementStyleEditor.field.value'), 'text', 'lineHeight', text.lineHeight.value, text.lineHeight.unit, ['none', 'px', '%']))}
        ${_eseCard('text', 'letterSpacing', t('elementStyleEditor.text.letterSpacing'), text.letterSpacing.enabled, _eseValueUnitRow(t('elementStyleEditor.field.value'), 'text', 'letterSpacing', text.letterSpacing.value, text.letterSpacing.unit, ['px', 'em', 'rem']))}
        ${_renderEseSimpleRow(t('elementStyleEditor.text.textAlign'), 'text', 'textAlign', text.textAlign, ['left', 'center', 'right', 'justify'])}
        ${_renderEseSimpleRow(t('elementStyleEditor.text.textDecoration'), 'text', 'textDecoration', text.textDecoration, ['underline', 'line-through', 'overline'])}
        ${_renderEseSimpleRow(t('elementStyleEditor.text.textTransform'), 'text', 'textTransform', text.textTransform, ['uppercase', 'lowercase', 'capitalize'])}
        ${_renderEseSimpleRow(t('elementStyleEditor.text.whiteSpace'), 'text', 'whiteSpace', text.whiteSpace, ['nowrap', 'pre-wrap', 'pre'])}
        ${_eseCard('text', 'color', t('elementStyleEditor.text.color'), text.color.enabled, _renderEseColorField(text.color))}
        ${_eseCard('text', 'textShadow', t('elementStyleEditor.text.textShadow'), text.textShadow.enabled, _renderEseTextShadowField(text.textShadow))}
    `;
}


function _renderEseColorField(c) {
    return `
        <div class="flex justify-end items-center gap-2">
            ${_eseColorPair('color', 'text', 'color', 'value', c.value)}
        </div>`;
}

/** MỚI (16/08/2026, mục 2 — Giang chỉ ra "chưa có text-shadow cho text") — 3 input số (offsetX/
 * offsetY/blur, LUÔN px, xem docstring cloneElementStyleDraftDefaults(), service/state/
 * element-style-editor.js) + 1 cặp màu DÙNG CHUNG (_eseColorPair()). */
function _renderEseTextShadowField(ts) {
    return `
        <div class="flex justify-between items-center">
            <span class="text-xs text-slate-500">${t('elementStyleEditor.textShadow.offsetX')}</span>
            ${_eseNumber('text', 'textShadow', 'offsetX', ts.offsetX, 1)}
        </div>
        <div class="flex justify-between items-center">
            <span class="text-xs text-slate-500">${t('elementStyleEditor.textShadow.offsetY')}</span>
            ${_eseNumber('text', 'textShadow', 'offsetY', ts.offsetY, 1)}
        </div>
        <div class="flex justify-between items-center">
            <span class="text-xs text-slate-500">${t('elementStyleEditor.textShadow.blur')}</span>
            ${_eseNumber('text', 'textShadow', 'blur', ts.blur, 1)}
        </div>
        <div class="flex justify-between items-center">
            <span class="text-xs text-slate-500">${t('elementStyleEditor.textShadow.color')}</span>
            ${_eseColorPair('textshadow', 'text', 'textShadow', 'color', ts.color)}
        </div>`;
}

/** SỬA (mục 2, Giang yêu cầu "chuyển dropdown google > dạng drawer generic list (subpanel), nhấn
 * vào để chọn > ghi nhớ back lại và đưa vào font name, không dùng input hay dropdown nữa") — ô
 * search+dropdown tự chế (`_renderEseGoogleFontPicker()`/`_renderEseFontDropdownItems()` cũ, absolute
 * positioned, ĐÃ XOÁ) THAY bằng 1 nút thuần hiển thị tên đang chọn (`#ese-fontfamily-open-picker`) —
 * bấm vào ĐẨY SANG 1 màn riêng TRONG CÙNG Generic Drawer (danh sách Google Font cuộn dọc thật, có
 * nút Back ở header — CÙNG khuôn "push/back 1 màn" mà `workflowAppSettings._screenStack` dùng cho
 * Settings, xem `workflowElementStyleEditor._fontPickerOpen`/`_renderFontPicker()`, event/workflow/
 * element-style-editor.js) THAY vì dropdown nổi đè lên UI xung quanh. Chọn 1 font trong danh sách đó
 * TỰ ĐỘNG quay lại màn này (Workflow tự nhớ để back, người dùng không cần bấm Back tay) — tên font
 * MỚI hiện NGAY trên nút. Nguồn 'system' GIỮ NGUYÊN input text tự do (KHÔNG thể liệt kê trước font
 * cài sẵn máy người dùng — không có list nào cho trường hợp này, ngoài phạm vi yêu cầu này). */
function _renderEseFontFamilyField(f, loadedGoogleFonts) {
    const sourceOptions = [{ value: 'system', label: t('elementStyleEditor.font.sourceSystem') }, { value: 'google', label: t('elementStyleEditor.font.sourceGoogle') }];
    const isGoogle = f.source === 'google';
    const googleRow = isGoogle ? `
        <div class="flex justify-between items-center">
            <span class="text-xs text-slate-500">${t('elementStyleEditor.font.weightToLoad')}</span>
            ${_eseSelect('text', 'fontFamily', 'googleWeight', ['100', '300', '400', '500', '700', '900'].map((v) => ({ value: v, label: v })), f.googleWeight, false)}
        </div>
        <button id="ese-fontfamily-load-btn" class="w-full py-1.5 rounded-lg bg-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-300 transition-colors">${t('elementStyleEditor.font.loadButton')}</button>
        ${loadedGoogleFonts.includes(f.value) ? `<span class="text-[10px] text-emerald-600">${t('elementStyleEditor.font.loadedNote')}</span>` : ''}` : '';
    const nameField = isGoogle ? `
        <button type="button" id="ese-fontfamily-open-picker" class="w-32 flex items-center justify-between gap-1 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-900 outline-none hover:bg-slate-50 transition-colors">
            <span class="truncate">${f.value || t('elementStyleEditor.font.namePlaceholder')}</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
        </button>` : `
        <input type="text" value="${f.value}" placeholder="${t('elementStyleEditor.font.namePlaceholder')}" class="ese-field w-32 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-900 outline-none" data-section="text" data-field="fontFamily" data-subkey="value">`;
    return `
        <div class="flex justify-between items-center">
            <span class="text-xs text-slate-500">${t('elementStyleEditor.font.source')}</span>
            ${_eseSelect('text', 'fontFamily', 'source', sourceOptions, f.source, true)}
        </div>
        <div class="flex justify-between items-center">
            <span class="text-xs text-slate-500">${t('elementStyleEditor.font.name')}</span>
            ${nameField}
        </div>
        ${googleRow}`;
}

/** MỚI (mục 2) — header màn con "Chọn Google Font" (đẩy sang bởi `#ese-fontfamily-open-picker`) —
 * CÙNG khuôn header có nút Back của `workflowAppSettings._render()` (event/workflow/app-settings.js),
 * viết riêng ở đây vì màn này KHÔNG thuộc ngăn xếp đó (Element Style Editor tự quản lý push/back 1
 * màn của riêng nó, xem `workflowElementStyleEditor._renderFontPicker()`). */
function renderEseFontPickerHeader() {
    return `
        <div class="relative flex items-center justify-center px-14 py-3 border-b border-slate-200">
            <button id="btn-ese-fontpicker-back" class="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h3 class="text-base font-bold text-slate-900 truncate text-center">${t('elementStyleEditor.font.name')}</h3>
        </div>`;
}

/** MỚI (mục 2) — body màn con: 1 ô tìm kiếm tĩnh (KHÔNG sticky — tránh lặp lại đúng bug "khe hở"
 * ở mục 3, xem docstring `_renderEsePreviewBox()`) + danh sách cuộn dọc thật (KHÔNG absolute/nổi
 * đè, đúng yêu cầu "dạng drawer generic list"). `currentValue` để tô đậm + tick dòng đang chọn. */
function renderEseFontPickerBody(currentValue) {
    return `
        <div class="flex flex-col gap-3">
            <input type="text" id="ese-fontpicker-search" autocomplete="off" placeholder="${t('elementStyleEditor.font.searchPlaceholder')}" class="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 outline-none">
            <div id="ese-fontpicker-list" class="flex flex-col divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">${_renderEseFontListItems('', currentValue)}</div>
        </div>`;
}

/** MỚI (mục 2, thay `_renderEseFontDropdownItems()` cũ) — dựng danh sách kết quả lọc TRONG màn con
 * (KHÔNG phải dropdown nổi) — gọi lại mỗi lần gõ (Workflow tự gán `list.innerHTML`, xem
 * `_wireFontPicker()`, event/workflow/element-style-editor.js). Lọc theo tên, KHÔNG phân biệt hoa/
 * thường, so khớp CHỨA. `f.scripts` hiện kèm bên phải mỗi dòng (vd "VI JA"). Dòng TRÙNG
 * `currentValue` tô đậm xanh + tick — người dùng thấy ngay đang chọn font nào lúc mở lại danh sách. */
function _renderEseFontListItems(query, currentValue) {
    const q = (query || '').trim().toLowerCase();
    const source = typeof listGoogleFont !== 'undefined' ? listGoogleFont : []; // core/google-fonts-list.js
    const matches = q ? source.filter((f) => f.name.toLowerCase().includes(q)) : source;
    if (!matches.length) return `<div class="px-3 py-6 text-center text-xs text-slate-400">${t('elementStyleEditor.font.noMatch')}</div>`;
    return matches.map((f) => {
        const isSelected = f.name === currentValue;
        return `
        <button type="button" data-font-name="${f.name.replace(/"/g, '&quot;')}" class="ese-font-option w-full text-left px-3 py-3 text-sm ${isSelected ? 'text-sky-600 font-semibold bg-sky-50' : 'text-slate-700'} hover:bg-sky-50 transition-colors flex items-center justify-between gap-2">
            <span class="truncate">${f.name}</span>
            <span class="flex items-center gap-2 shrink-0">
                <span class="text-[10px] text-slate-400 uppercase tracking-wide">${f.scripts.join(' ')}</span>
                ${isSelected ? '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>' : ''}
            </span>
        </button>`;
    }).join('');
}
