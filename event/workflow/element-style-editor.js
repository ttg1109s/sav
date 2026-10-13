/**
 * event/workflow/element-style-editor.js — Workflow của công cụ chung "Element Style Editor" (dựng CSS box model + text
 * style trong Generic Drawer, xuất chuỗi CSS rồi áp inline lên 1 DOM).
 *
 * Cửa mở: `open(targetEl, onApply, initialCssString?, onClose?, options?)` — gọi thẳng từ Workflow khác
 * (workflowSubtitleStyleSettings.openStyling(), workflowImageEdit.openLayerStyleEditor()).
 *   - `targetEl` — DOM áp inline style khi bấm Áp dụng; `null` nếu nơi gọi tự áp qua `onApply` (layer Photo vẽ canvas).
 *   - `onApply(cssString)` — nơi gọi tự lưu (config/DB); công cụ chỉ ghi `eseGeneratedCss`.
 *
 * Nội dung Box/Text: components/element-style-editor-drawer.js. Tương tác: event/listener/element-style-editor.js ->
 * router 'elementStyleEditor' -> các method "cửa vào từ Router". Ghi DOM tại chỗ: core/element-style-editor-ui.js.
 *
 * NẠP SAU: core/element-style-editor.js, core/element-style-editor-ui.js, components/element-style-editor-drawer.js,
 * service/state/element-style-editor.js, event/workflow/generic-drawer-helpers.js, core/dom-refs.js.
 */

/** Đang ở màn con "Chọn Google Font" hay màn chính Box/Text. */
const ESE_RENDER_BY_FONT_PICKER_OPEN = {
    true: () => workflowElementStyleEditor._renderFontPicker(),
    false: () => workflowElementStyleEditor._renderMain(),
};

/** Sau khi ghi 1 ô `.ese-field`: ô `data-rerender` (đổi mode width/height, nguồn font...) vẽ lại body; còn lại chỉ
 * sơn lại preview. */
const ESE_AFTER_FIELD_INPUT_BY_RERENDER = {
    true: () => workflowElementStyleEditor._render(),
    false: () => workflowElementStyleEditor._updatePreview(),
};

/** Drawer đang đóng -> mở mới; đang mở -> thay nội dung (event/workflow/generic-drawer-helpers.js). */
const ESE_DRAWER_BY_CLOSED = {
    true: (config) => workflowGenericDrawerHelpers.open(config),
    false: (config) => workflowGenericDrawerHelpers.update(config),
};

/** Đóng: nơi mở có truyền `onClose` (sống chung Generic Drawer, tự mở lại màn của mình) hay đóng hẳn. */
const ESE_CLOSE_BY_HAS_ON_CLOSE = {
    true: () => workflowElementStyleEditor._onClose(),
    false: () => workflowGenericDrawerHelpers.closeFully(),
};

const workflowElementStyleEditor = {
    /** DOM đang chỉnh trong phiên hiện tại (RAM, reset mỗi lần open()). */
    _targetEl: null,
    _onApply: null,
    /** Gọi thay `closeFully()` khi đóng (bấm X hoặc vừa Áp dụng) — xem ESE_CLOSE_BY_HAS_ON_CLOSE. */
    _onClose: null,
    /** z-index riêng khi mở từ ngữ cảnh cao hơn mặc định Generic Drawer (vd modal xem ảnh Photo); null = mặc định. */
    _zIndex: null,
    /** Đang ở màn con "Chọn Google Font" — editor tự quản push/back 1 màn của riêng nó. */
    _fontPickerOpen: false,
    /** Số phiên mở, ghép vào `scrollKey` — mỗi lần open() là 1 bộ nhớ cuộn mới; trong 1 phiên mỗi tab nhớ vị trí riêng. */
    _scrollSessionId: 0,

    /** Mở Drawer cho 1 DOM — bắt đầu từ draft trắng; có `initialCssString` (chuỗi CSS đã lưu) thì nạp khớp từng field.
     * `options` — `{zIndex, startTab}`; `startTab` ('box'|'text') mặc định 'box' (layer Text của Photo truyền 'text'). */
    open(targetEl, onApply, initialCssString, onClose, options) {
        options = options || {};
        this._targetEl = targetEl;
        this._onApply = onApply || null;
        this._onClose = onClose || null;
        this._zIndex = options.zIndex || null;
        this._fontPickerOpen = false;
        resetElementStyleDraft(); // core
        if (initialCssString) applyElementStyleCssPatchToDraft(parseElementStyleCssString(initialCssString)); // core
        setElementStyleActiveTab(options.startTab || 'box'); // core
        this._scrollSessionId += 1;
        this._render();
    },

    _render() {
        ESE_RENDER_BY_FONT_PICKER_OPEN[this._fontPickerOpen]();
    },

    /** Màn chính Box/Text. */
    _renderMain() {
        const { eseActiveTab: activeTab, eseDraft: draft, eseLoadedGoogleFonts: loadedFonts } = appState.get(['eseActiveTab', 'eseDraft', 'eseLoadedGoogleFonts']);
        // `height:'auto'` bắt buộc: thiếu thì Drawer rơi về 70vh cố định, không co theo nội dung khi đổi tab / bung kết quả tìm font.
        const config = {
            scrollKey: `elementStyleEditor#${this._scrollSessionId}:${activeTab}`,
            height: 'auto',
            maxHeight: '80vh',
            headerHtml: renderElementStyleEditorHeader(activeTab), // components/element-style-editor-drawer.js
            bodyHtml: renderElementStyleEditorBody(draft, activeTab, loadedFonts), // khối Preview sticky tự cấp `pt-3`
            bodyClass: 'overflow-y-auto px-4 pb-3',
        };
        if (this._zIndex) config.zIndex = this._zIndex;
        ESE_DRAWER_BY_CLOSED[genericDrawerPanel.classList.contains('hidden')](config);
        this._updatePreview();
        workflowGenericDrawerHelpers.restoreScroll(); // áp lại vị trí cuộn sau khi vẽ (khối input con có thể vừa hiện ra)
    },

    // ===================== Cửa vào từ Router 'elementStyleEditor' =====================

    /** 'elementStyleEditor.tab.click' @param {'box'|'text'} tab */
    selectTab(tab) {
        setElementStyleActiveTab(tab); // core
        this._render();
    },

    /** 'elementStyleEditor.enable.change' — bật/tắt 1 property, vẽ lại body (hiện/ẩn khối input con).
     * @param {string} section @param {string} field @param {boolean} checked */
    setFieldEnabled(section, field, checked) {
        setElementStyleField(section, field, { enabled: checked }); // core
        this._render();
    },

    /** 'elementStyleEditor.field.input' — 1 ô `.ese-field` đổi giá trị: ghi field -> vẽ lại body hoặc chỉ sơn preview ->
     * đồng bộ ô đối ứng của cặp màu (`data-cross-target`).
     * @param {{section: string, field: string, subkey: string, raw: string, isNumeric: boolean, rerender: boolean,
     *          crossTargetId: string|null}} p */
    setFieldValue({ section, field, subkey, raw, isNumeric, rerender, crossTargetId }) {
        setElementStyleField(section, field, { [subkey]: resolveElementStyleFieldValue(raw, isNumeric) }); // core
        ESE_AFTER_FIELD_INPUT_BY_RERENDER[rerender]();
        setEseCrossTargetValue(genericDrawerBody, crossTargetId, raw); // core/element-style-editor-ui.js
    },

    /** 'elementStyleEditor.simpleField.change' — field dropdown-thuần: ghi chuỗi, chỉ sơn preview.
     * @param {string} section @param {string} field @param {string} value */
    setSimpleField(section, field, value) {
        setElementStyleSimpleField(section, field, value); // core
        this._updatePreview();
    },

    /** 'elementStyleEditor.loadFont.click' — nạp Google Font đang chọn rồi vẽ lại. */
    loadSelectedGoogleFont() {
        const { eseDraft: draft, eseLoadedGoogleFonts: loaded } = appState.get(['eseDraft', 'eseLoadedGoogleFonts']);
        loadGoogleFont(draft.text.fontFamily.value, draft.text.fontFamily.googleWeight, loaded); // core
        this._render();
    },

    /** 'elementStyleEditor.fontPicker.open.click' */
    openFontPicker() {
        this._fontPickerOpen = true;
        this._render();
    },

    /** 'elementStyleEditor.fontPicker.back.click' — đóng màn con, không đóng Drawer. */
    closeFontPicker() {
        this._fontPickerOpen = false;
        this._render();
    },

    /** 'elementStyleEditor.fontPicker.search.input' — chỉ thay danh sách (ô tìm không mất focus), áp theme cho dòng mới.
     * @param {string} query */
    filterFontPicker(query) {
        const currentValue = appState.get('eseDraft').text.fontFamily.value;
        const listEl = genericDrawerBody.querySelector('#ese-fontpicker-list');
        setEseFontPickerListHtml(listEl, _renderEseFontListItems(query, currentValue)); // core/element-style-editor-ui.js + components/element-style-editor-drawer.js
        applyUiThemeToDom(listEl, _activeUiThemeKeyList); // core/ui-theme/apply-ui.js
    },

    /** 'elementStyleEditor.fontPicker.option.click' — chọn font rồi tự về màn chính. Luôn ghi kèm `source:'google'` (style
     * lưu từ lúc nguồn 'system' tự sửa đúng khi chọn lại). @param {string} fontName */
    selectFont(fontName) {
        setElementStyleField('text', 'fontFamily', { value: fontName, source: 'google' }); // core
        this._fontPickerOpen = false;
        this._render();
    },

    /** Sơn lại `#ese-preview-box` khớp draft hiện tại — dùng đúng cặp core mà `_apply()` dùng nên preview không lệch kết
     * quả thật. Xoá inline style trước (property vừa tắt không tự gỡ). */
    _updatePreview() {
        const previewBox = genericDrawerBody.querySelector('#ese-preview-box');
        if (!previewBox) return; // Drawer vừa đóng
        clearEsePreviewStyle(previewBox); // core/element-style-editor-ui.js
        applyElementStyleToDom(previewBox, buildElementStyleCssString(appState.get('eseDraft'))); // core
    },

    /** Màn con "Chọn Google Font" — header có nút Back riêng, body là ô tìm + danh sách; cùng `height`/`maxHeight` màn chính. */
    _renderFontPicker() {
        const currentValue = appState.get('eseDraft').text.fontFamily.value;
        const config = {
            scrollKey: `elementStyleEditor#${this._scrollSessionId}:fontPicker`, // luôn từ đầu; vị trí màn chính được nhớ cho lúc Back
            scrollReset: true,
            height: 'auto',
            maxHeight: '80vh',
            headerHtml: renderEseFontPickerHeader(), // components/element-style-editor-drawer.js
            bodyHtml: renderEseFontPickerBody(currentValue),
            bodyClass: 'overflow-y-auto px-4 py-3',
        };
        if (this._zIndex) config.zIndex = this._zIndex;
        ESE_DRAWER_BY_CLOSED[genericDrawerPanel.classList.contains('hidden')](config);
    },

    /** Build chuỗi CSS -> lưu state -> áp inline lên targetEl (nếu có) -> báo `onApply` (nếu có) -> đóng. */
    _apply() {
        const cssString = buildElementStyleCssString(appState.get('eseDraft')); // core
        setElementStyleGeneratedCss(cssString); // core
        if (this._targetEl) applyElementStyleToDom(this._targetEl, cssString); // core
        if (this._onApply) this._onApply(cssString);
        this._close();
    },

    /** Dùng chung cho nút X lẫn sau khi Áp dụng. */
    _close() {
        ESE_CLOSE_BY_HAS_ON_CLOSE[!!this._onClose]();
    },
};
