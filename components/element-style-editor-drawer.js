/**
 * Component: nội dung Generic Drawer cho "Element Style Editor" (công cụ CHUNG dựng CSS box model + text style, xem
 * event/workflow/element-style-editor.js). 2 tab Box/Chữ — chuyển tab RE-RENDER TOÀN BỘ body. Màu qua `data-uitk`.
 *
 * i18n — namespace `elementStyleEditor.*`, key EN mặc định ở lang/patch/patch-visualizer.js. CHỈ dịch NHÃN mô tả (tên
 * field/mode...) — KHÔNG dịch giá trị option là keyword CSS thuần (px/em/solid/dashed/left/center...) — token kỹ thuật,
 * giữ luôn giá trị CSS làm text hiển thị.
 *
 * QUY ƯỚC data-attribute — Listener (event/listener/element-style-editor.js) ủy quyền theo class chung, KHÔNG hard-code
 * từng field 1:
 *   - `.ese-enable` (checkbox) — data-section, data-field. Bật/tắt 1 property, đổi thì re-render (hiện/ẩn khối input con).
 *   - `.ese-field` (input/select) — data-section, data-field, data-subkey, data-numeric ("1" nếu cần parseFloat),
 *     data-rerender ("1" nếu đổi field này cũng cần re-render toàn body, vd đổi `mode` width/height ẩn/hiện khối
 *     value+unit). DÙNG CHO field DẠNG OBJECT.
 *   - `.ese-simple-field` (select) — data-section, data-field. Field DROPDOWN-THUẦN (string, "None" là 1 option tự làm
 *     công tắc) — fontWeight/fontStyle/textAlign/textDecoration/textTransform/whiteSpace.
 *   - `data-cross-target="<id>"` — đồng bộ hiển thị 2 input cùng biểu diễn 1 giá trị (text hex + color picker).
 *   - Nút X header mang `data-ese-close` (id X dùng chung mọi Drawer); tab `data-ese-tab`.
 *
 * NẠP SAU: components/generic-drawer.js, lang/lang.js (cần hàm t()).
 */

const ESE_TOGGLE_MARKUP = `
    <div class="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all" data-uitk="toggleTrackOff toggleTrackOn"></div>`;

const ESE_LENGTH_UNITS = ['px', '%', 'em', 'rem', 'vw', 'vh', 'pt', 'cm', 'mm', 'in', 'ch'];

function renderElementStyleEditorHeader(activeTab) {
    const tabBtn = (key, label) => `
        <button data-ese-tab="${key}" class="px-3 py-1.5 rounded-full text-xs font-medium transition-colors" data-uitk="${activeTab === key ? 'btnPrimaryPillBg textOnAccent' : 'btnNeutralBg btnNeutralText'}">${label}</button>`;
    // components/generic-drawer.js — nút X mang `data-ese-close` cho Listener ủy quyền.
    return buildDrawerHeaderHtml({ leftHtml: `<div class="flex items-center gap-2">${tabBtn('box', t('elementStyleEditor.tab.box'))}${tabBtn('text', t('elementStyleEditor.tab.text'))}</div>`, closeAttrs: 'data-ese-close="1"' });
}

/** Ô preview LUÔN đứng ĐẦU body (TRƯỚC nội dung 2 tab), `sticky top-0` — dính đỉnh vùng cuộn của Drawer khi cuộn qua
 * các card field (sticky, không phải fixed — fixed neo theo viewport, trôi ra ngoài Drawer).
 * `-mx-4 px-4` — triệt tiêu padding NGANG `px-4` của body CHỈ cho khối này, để nền phủ TRÀN 2 mép khi dính đỉnh.
 * Trục DỌC: body KHÔNG có `pt-*` (bodyClass chỉ `pb-3`, xem workflowElementStyleEditor._renderMain()) — padding-top
 * nằm ở `pt-3` của chính khối này. Không dùng margin âm để bù padding-top: WebKit tính điểm "dính" của sticky theo mép
 * PADDING vùng cuộn cha, bỏ qua margin âm -> lúc dính hở 1 khe.
 * Nội dung preview LUÔN hiển thị CHUNG cả Box lẫn Text (KHÔNG đổi theo tab đang xem) — vì Style áp
 * dụng đồng thời cả 2 nhóm property lúc build CSS cuối (buildElementStyleCssString(), core/
 * element-style-editor.js đọc CẢ `draft.box` LẪN `draft.text` cùng lúc, không tách theo tab).
 * `#ese-preview-box` KHỞI TẠO KHÔNG style — Workflow tự áp NGAY sau mỗi lần vẽ/đổi field
 * (`_updatePreview()`, event/workflow/element-style-editor.js) bằng ĐÚNG `applyElementStyleToDom()`
 * + `buildElementStyleCssString()` (core) — TÁI DÙNG y hệt cặp hàm cuối cùng lúc bấm "Áp dụng"
 * thật, đảm bảo preview KHÔNG BAO GIỜ lệch so với kết quả thật sẽ áp lên targetEl. */
function _renderEsePreviewBox() {
    return `
        <div class="sticky top-0 z-10 -mx-4 px-4 pt-3 pb-3 mb-1 border-b" data-uitk="panelFlushBg dividerBorder">
            <div class="text-[10px] font-semibold uppercase tracking-wide mb-2" data-uitk="textMutedIcon">${t('elementStyleEditor.preview.label')}</div>
            <div class="h-20 rounded-xl flex items-center justify-center overflow-auto px-2" data-uitk="insetBg">
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
            <button id="ese-apply-btn" class="mt-1 w-full py-2.5 rounded-xl text-sm font-semibold transition-colors" data-uitk="btnPrimaryPillBg textOnAccent btnPrimaryHoverBg">${t('elementStyleEditor.apply')}</button>
        </div>`;
}

/** Khung card "toggle + nội dung con (ẩn nếu tắt)" DÙNG CHUNG cho mọi property — mirror pattern
 * blur section của Custom Effect Drawer (`ce-blur-enable`/`ce-blur-intensity-row`). */
function _eseCard(section, field, label, enabled, innerHtml) {
    return `
        <div class="rounded-2xl overflow-hidden" data-uitk="cardBg cardBorder">
            <div class="flex justify-between items-center px-4 py-3 ${enabled ? 'border-b' : ''}" data-uitk="dividerBorder">
                <span class="text-sm" data-uitk="textSecondaryStrong">${label}</span>
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
    return `<select class="ese-field rounded-lg px-2 py-1.5 text-xs outline-none" data-uitk="inputBg inputBorder inputText" data-section="${section}" data-field="${field}" data-subkey="${subkey}" ${rerender ? 'data-rerender="1"' : ''}>${opts}</select>`;
}

/** Select cho field DROPDOWN-THUẦN (string, KHÔNG phải object {enabled,value}) — class RIÊNG `.ese-simple-field`
 * (Workflow ghi thẳng qua setElementStyleSimpleField(), không qua cơ chế merge subkey). "None" LUÔN là option ĐẦU (tự
 * làm công tắc tắt/mở). */
function _eseSimpleSelect(section, field, options, current) {
    const opts = options.map((o) => `<option value="${o.value}" ${o.value === current ? 'selected' : ''}>${o.label}</option>`).join('');
    return `<select class="ese-simple-field rounded-lg px-2 py-1.5 text-xs outline-none" data-uitk="inputBg inputBorder inputText" data-section="${section}" data-field="${field}">${opts}</select>`;
}

/** 1 hàng "nhãn + dropdown (có None đầu list)" — KHÔNG card/toggle (dropdown tự là công tắc). */
function _renderEseSimpleRow(label, section, field, current, values) {
    const options = [{ value: 'none', label: t('elementStyleEditor.mode.none') }, ...values.map((v) => ({ value: v, label: v }))];
    return `
        <div class="rounded-2xl px-4 py-3 flex justify-between items-center gap-2" data-uitk="cardBg cardBorder">
            <span class="text-sm" data-uitk="textSecondaryStrong">${label}</span>
            ${_eseSimpleSelect(section, field, options, current)}
        </div>`;
}

function _eseNumber(section, field, subkey, value, step) {
    return `<input type="number" value="${value}" step="${step || 1}" class="ese-field w-20 rounded-lg px-2 py-1.5 text-xs outline-none" data-uitk="inputBg inputBorder inputText" data-section="${section}" data-field="${field}" data-subkey="${subkey}" data-numeric="1">`;
}

/** Cặp input màu (text hex đồng bộ 2 chiều <-> color picker tròn, CÙNG `data-cross-target`) DÙNG CHUNG cho 4 field màu
 * trong Drawer (text.color/box.border.color/box.background.value/text.textShadow.color). `idPrefix` PHẢI duy nhất/field
 * (id DOM toàn trang, đụng nhau thì `data-cross-target` đồng bộ NHẦM field khác). */
function _eseColorPair(idPrefix, section, field, subkey, value) {
    return `
        <div class="flex items-center gap-2">
            <input type="text" id="ese-${idPrefix}-color-text" data-cross-target="ese-${idPrefix}-color-picker" value="${value}" class="ese-field w-20 bg-transparent border-b px-1 py-0.5 text-xs outline-none font-mono text-right uppercase" data-uitk="inputBorderColor textPrimary" data-section="${section}" data-field="${field}" data-subkey="${subkey}">
            <div class="w-8 h-8 rounded-full overflow-hidden shrink-0" data-uitk="inputBorder"><input type="color" id="ese-${idPrefix}-color-picker" data-cross-target="ese-${idPrefix}-color-text" value="${value}" class="ese-field w-10 h-10 -m-1 cursor-pointer" data-section="${section}" data-field="${field}" data-subkey="${subkey}"></div>
        </div>`;
}

function _eseUnitOptions(units) {
    return units.map((u) => ({ value: u, label: u }));
}

/** 1 hàng "nhãn + input số + select unit" dùng cho font-size/letter-spacing. */
function _eseValueUnitRow(label, section, field, value, unit, units) {
    return `
        <div class="flex justify-between items-center">
            <span class="text-xs" data-uitk="textSecondary">${label}</span>
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

/** Width/Height — không có toggle riêng: `mode` có lựa chọn `'none'` làm công tắc (cloneElementStyleDraftDefaults(),
 * service/state/element-style-editor.js). Dùng `_eseSelect()` thường vì `mode` là SUBKEY của object {mode,value,unit}. */
function _renderEseSizeRow(label, section, field, f) {
    const modeOptions = [
        { value: 'none', label: t('elementStyleEditor.mode.none') },
        { value: 'custom', label: t('elementStyleEditor.mode.custom') },
        { value: 'fit', label: t('elementStyleEditor.mode.fit') },
        { value: 'auto', label: t('elementStyleEditor.mode.auto') },
    ];
    const valueRow = f.mode === 'custom' ? `
        <div class="flex justify-between items-center px-4 py-3 border-t" data-uitk="dividerBorder">
            <span class="text-xs" data-uitk="textSecondary">${t('elementStyleEditor.field.value')}</span>
            <div class="flex items-center gap-1.5">
                ${_eseNumber(section, field, 'value', f.value, 1)}
                ${_eseSelect(section, field, 'unit', _eseUnitOptions(ESE_LENGTH_UNITS), f.unit, false)}
            </div>
        </div>` : '';
    return `
        <div class="rounded-2xl overflow-hidden" data-uitk="cardBg cardBorder">
            <div class="flex justify-between items-center px-4 py-3">
                <span class="text-sm" data-uitk="textSecondaryStrong">${label}</span>
                ${_eseSelect(section, field, 'mode', modeOptions, f.mode, true)}
            </div>
            ${valueRow}
        </div>`;
}

/** Hàng 4 input Top/Right/Bottom/Left: `grid grid-cols-4` (4 cột chia đều bề rộng khả dụng — input bề rộng cố định sẽ
 * tràn viewport trên màn hẹp) + input `w-full min-w-0` (`min-w-0` bắt buộc, không thì input giữ sàn bề rộng riêng). */
function _renderEseSidesField(section, field, f) {
    const sideInput = (side, labelKey) => `
        <div class="flex flex-col items-center gap-1 min-w-0">
            <span class="text-[10px]" data-uitk="textMutedIcon">${t(labelKey)}</span>
            <input type="number" value="${f[side]}" step="1" class="ese-field w-full min-w-0 text-center rounded-lg px-1 py-1.5 text-xs outline-none" data-uitk="inputBg inputBorder inputText" data-section="${section}" data-field="${field}" data-subkey="${side}" data-numeric="1">
        </div>`;
    return `
        <div class="flex justify-between items-center">
            <span class="text-xs" data-uitk="textSecondary">${t('elementStyleEditor.field.unit')}</span>
            ${_eseSelect(section, field, 'unit', _eseUnitOptions(ESE_LENGTH_UNITS), f.unit, false)}
        </div>
        <div class="grid grid-cols-4 gap-1.5">
            ${sideInput('top', 'elementStyleEditor.side.top')}${sideInput('right', 'elementStyleEditor.side.right')}${sideInput('bottom', 'elementStyleEditor.side.bottom')}${sideInput('left', 'elementStyleEditor.side.left')}
        </div>`;
}

/** Background của box (1 cặp màu). */
function _renderEseBackgroundField(bg) {
    return `
        <div class="flex justify-between items-center">
            <span class="text-xs" data-uitk="textSecondary">${t('elementStyleEditor.field.value')}</span>
            ${_eseColorPair('background', 'box', 'background', 'value', bg.value)}
        </div>`;
}

function _renderEseBorderField(b) {
    const styleOptions = ['solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset', 'none'].map((v) => ({ value: v, label: v }));
    return `
        <div class="flex justify-between items-center">
            <span class="text-xs" data-uitk="textSecondary">${t('elementStyleEditor.border.width')}</span>
            <div class="flex items-center gap-1.5">
                ${_eseNumber('box', 'border', 'width', b.width, 1)}
                ${_eseSelect('box', 'border', 'widthUnit', _eseUnitOptions(['px', 'em', 'rem']), b.widthUnit, false)}
            </div>
        </div>
        <div class="flex justify-between items-center">
            <span class="text-xs" data-uitk="textSecondary">${t('elementStyleEditor.border.style')}</span>
            ${_eseSelect('box', 'border', 'style', styleOptions, b.style, false)}
        </div>
        <div class="flex justify-between items-center">
            <span class="text-xs" data-uitk="textSecondary">${t('elementStyleEditor.border.color')}</span>
            ${_eseColorPair('border', 'box', 'border', 'color', b.color)}
        </div>`;
}

/** Opacity (0-100, quy đổi sang 0-1 lúc build CSS, xem buildElementStyleCssString(), core/element-style-editor.js).
 * Input số (không slider) — nhất quán các field số khác trong Drawer này (fontSize/letterSpacing...). */
function _renderEseOpacityField(o) {
    return `
        <div class="flex justify-between items-center">
            <span class="text-xs" data-uitk="textSecondary">${t('elementStyleEditor.field.value')} (%)</span>
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

/** Text-shadow — 3 input số (offsetX/
 * offsetY/blur, LUÔN px, xem docstring cloneElementStyleDraftDefaults(), service/state/
 * element-style-editor.js) + 1 cặp màu DÙNG CHUNG (_eseColorPair()). */
function _renderEseTextShadowField(ts) {
    return `
        <div class="flex justify-between items-center">
            <span class="text-xs" data-uitk="textSecondary">${t('elementStyleEditor.textShadow.offsetX')}</span>
            ${_eseNumber('text', 'textShadow', 'offsetX', ts.offsetX, 1)}
        </div>
        <div class="flex justify-between items-center">
            <span class="text-xs" data-uitk="textSecondary">${t('elementStyleEditor.textShadow.offsetY')}</span>
            ${_eseNumber('text', 'textShadow', 'offsetY', ts.offsetY, 1)}
        </div>
        <div class="flex justify-between items-center">
            <span class="text-xs" data-uitk="textSecondary">${t('elementStyleEditor.textShadow.blur')}</span>
            ${_eseNumber('text', 'textShadow', 'blur', ts.blur, 1)}
        </div>
        <div class="flex justify-between items-center">
            <span class="text-xs" data-uitk="textSecondary">${t('elementStyleEditor.textShadow.color')}</span>
            ${_eseColorPair('textshadow', 'text', 'textShadow', 'color', ts.color)}
        </div>`;
}

/** Font family — CHỈ Google Font. 1 nút hiển thị tên đang chọn (`#ese-fontfamily-open-picker`) — bấm vào ĐẨY SANG màn
 * con "Chọn Google Font" TRONG CÙNG Generic Drawer (danh sách cuộn dọc + nút Back ở header; Element Style Editor tự quản
 * lý push/back, xem `workflowElementStyleEditor._fontPickerOpen`/`_renderFontPicker()`). Chọn 1 font tự quay lại màn
 * này, tên mới hiện ngay trên nút.
 * Field `source` vẫn có trong state/CSS (core dùng để thêm fallback `, sans-serif`) — mặc định `'google'`, và Workflow
 * luôn ghi `'google'` mỗi lần chọn font (style lưu từ lúc còn nguồn 'system' tự sửa đúng khi chọn lại). */
function _renderEseFontFamilyField(f, loadedGoogleFonts) {
    return `
        <div class="flex justify-between items-center">
            <span class="text-xs" data-uitk="textSecondary">${t('elementStyleEditor.font.name')}</span>
            <button type="button" id="ese-fontfamily-open-picker" class="w-32 flex items-center justify-between gap-1 rounded-lg px-2 py-1.5 text-xs outline-none transition-colors" data-uitk="inputBg inputBorder inputText cardHoverBg">
                <span class="truncate">${f.value || t('elementStyleEditor.font.namePlaceholder')}</span>
                ${iconSvg('chevron-right', 'h-3.5 w-3.5 shrink-0', 'data-uitk="textMutedIcon"')}
            </button>
        </div>
        <div class="flex justify-between items-center">
            <span class="text-xs" data-uitk="textSecondary">${t('elementStyleEditor.font.weightToLoad')}</span>
            ${_eseSelect('text', 'fontFamily', 'googleWeight', ['100', '300', '400', '500', '700', '900'].map((v) => ({ value: v, label: v })), f.googleWeight, false)}
        </div>
        <button id="ese-fontfamily-load-btn" class="w-full py-1.5 rounded-lg text-xs font-medium transition-colors" data-uitk="btnNeutralBg btnNeutralText btnNeutralHoverBg">${t('elementStyleEditor.font.loadButton')}</button>
        ${loadedGoogleFonts.includes(f.value) ? `<span class="text-[10px]" data-uitk="successText">${t('elementStyleEditor.font.loadedNote')}</span>` : ''}
    `;
}

/** Header màn con "Chọn Google Font" (đẩy sang bởi `#ese-fontfamily-open-picker`) — có nút Back riêng
 * (`#btn-ese-fontpicker-back`), không thuộc ngăn xếp của workflowAppSettings. */
function renderEseFontPickerHeader() {
    // components/generic-drawer.js
    return buildDrawerHeaderHtml({ backId: 'btn-ese-fontpicker-back', title: t('elementStyleEditor.font.name'), close: false });
}

/** Body màn con: 1 ô tìm kiếm tĩnh (KHÔNG sticky — tránh khe hở sticky, xem `_renderEsePreviewBox()`) + danh sách cuộn
 * dọc. `currentValue` để tô đậm + tick dòng đang chọn. */
function renderEseFontPickerBody(currentValue) {
    return `
        <div class="flex flex-col gap-3">
            <input type="text" id="ese-fontpicker-search" autocomplete="off" placeholder="${t('elementStyleEditor.font.searchPlaceholder')}" class="w-full rounded-xl px-3 py-2 text-sm outline-none" data-uitk="inputBg inputBorder inputText">
            <div id="ese-fontpicker-list" class="flex flex-col divide-y rounded-2xl overflow-hidden" data-uitk="cardBorder divideBorder">${_renderEseFontListItems('', currentValue)}</div>
        </div>`;
}

/** Danh sách kết quả lọc trong màn con — gọi lại mỗi lần gõ (workflowElementStyleEditor.filterFontPicker() thay
 * danh sách qua core -ui). Lọc theo tên, KHÔNG phân biệt hoa/
 * thường, so khớp CHỨA. `f.scripts` hiện kèm bên phải mỗi dòng (vd "VI JA"). Dòng TRÙNG
 * `currentValue` tô đậm xanh + tick — người dùng thấy ngay đang chọn font nào lúc mở lại danh sách. */
function _renderEseFontListItems(query, currentValue) {
    const q = (query || '').trim().toLowerCase();
    const source = typeof listGoogleFont !== 'undefined' ? listGoogleFont : []; // core/google-fonts-list.js
    const matches = q ? source.filter((f) => f.name.toLowerCase().includes(q)) : source;
    if (!matches.length) return `<div class="px-3 py-6 text-center text-xs" data-uitk="textMutedIcon">${t('elementStyleEditor.font.noMatch')}</div>`;
    return matches.map((f) => {
        const isSelected = f.name === currentValue;
        return `
        <button type="button" data-font-name="${f.name.replace(/"/g, '&quot;')}" class="ese-font-option w-full text-left px-3 py-3 text-sm ${isSelected ? 'font-semibold' : ''} transition-colors flex items-center justify-between gap-2" data-uitk="${isSelected ? 'accentText rowActiveBg' : 'textSecondaryStrong'} hoverAccentSoftBg">
            <span class="truncate">${f.name}</span>
            <span class="flex items-center gap-2 shrink-0">
                <span class="text-[10px] uppercase tracking-wide" data-uitk="textMutedIcon">${f.scripts.join(' ')}</span>
                ${isSelected ? iconSvg('check', 'h-4 w-4', 'data-uitk="accentText"') : ''}
            </span>
        </button>`;
    }).join('');
}
