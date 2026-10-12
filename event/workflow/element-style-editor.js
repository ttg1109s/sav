/**
 * event/workflow/element-style-editor.js — "THẰNG THỰC THI CUỐI" cho công cụ CHUNG "Element Style Editor" (dựng CSS box
 * model + text style qua UI trong Generic Drawer, xuất chuỗi CSS rồi áp inline lên 1 DOM cụ thể).
 *
 * Cửa mở: `workflowElementStyleEditor.open(targetEl, onApply, initialCssString?, onClose?, options?)` — gọi TRỰC TIẾP từ
 * Workflow domain khác (Subtitle "Styling" — event/workflow/subtitle-style-settings.js::openStyling(); layer Text/Shape
 * của trình sửa ảnh Photo — event/workflow/image-edit.js::openLayerStyleEditor()).
 *   - `targetEl` — DOM áp inline style lúc bấm Áp dụng (applyElementStyleToDom(), core). `null` nếu không có DOM sống
 *     (nơi gọi tự lưu + áp qua `onApply` — vd layer Photo là object vẽ lên canvas).
 *   - `onApply(cssString)` (optional) — nơi gọi tự LƯU (config/DB). Công cụ KHÔNG tự lưu gì ngoài `eseGeneratedCss`
 *     (appState runtime) — công cụ chung, không biết nghiệp vụ cụ thể.
 *   - `initialCssString`, `onClose`, `options` — xem docstring open() + các field bên dưới.
 *
 * Nội dung Box/Text: template string tĩnh (components/element-style-editor-drawer.js). Mọi tab/toggle/ô/nút đi Listener
 * ủy quyền (event/listener/element-style-editor.js) -> Router 'elementStyleEditor' (event/router/element-style-editor.js)
 * -> các method "cửa vào từ Router" bên dưới. Ghi DOM tại chỗ (ô màu đối ứng, danh sách font) qua
 * core/element-style-editor-ui.js.
 *
 * NẠP SAU: core/generic-drawer.js, core/element-style-editor.js, core/element-style-editor-ui.js,
 * components/element-style-editor-drawer.js, service/state/element-style-editor.js,
 * event/workflow/generic-drawer-helpers.js (closeFully()), core/dom-refs.js (genericDrawerPanel/Header/Body).
 */

/** Đang ở màn con "Chọn Google Font" hay màn chính Box/Text (object map — event-bus-flow.md §7). */
const ESE_RENDER_BY_FONT_PICKER_OPEN = {
    true: () => workflowElementStyleEditor._renderFontPicker(),
    false: () => workflowElementStyleEditor._renderMain(),
};

/** Sau khi ghi 1 ô `.ese-field`: ô có `data-rerender` (đổi mode width/height, nguồn font...) mới vẽ lại toàn body; còn lại chỉ sơn lại preview
 * (ô tự hiện giá trị mới của chính nó). */
const ESE_AFTER_FIELD_INPUT_BY_RERENDER = {
    true: () => workflowElementStyleEditor._render(),
    false: () => workflowElementStyleEditor._updatePreview(),
};

const workflowElementStyleEditor = {
    /** DOM đang được chỉnh trong phiên Drawer hiện tại — chỉ tồn tại trong RAM của Workflow
     * (KHÔNG phải appState, DOM node không phải dữ liệu serializable), reset mỗi lần open(). */
    _targetEl: null,
    /** Callback tuỳ chọn nơi gọi truyền vào — xem docstring đầu file. */
    _onApply: null,
    /** Gọi THAY VÌ `closeFully()` khi đóng Drawer (bấm X HAY vừa Áp dụng xong) — cho nơi gọi SỐNG CHUNG Generic Drawer
     * với công cụ này (Subtitle "Styling") tự mở lại đúng màn của mình thay vì đóng trắng cả Settings. Không truyền ->
     * đóng hẳn. */
    _onClose: null,

    /** z-index truyền riêng khi mở TỪ 1 ngữ cảnh có z-index CAO HƠN mặc định của Generic Drawer (128,
     * GENERIC_DRAWER_DEFAULT_Z_INDEX) — vd modal xem ảnh Photo (Z_INDEX.IMAGE_PREVIEW = 130), không thì Drawer bị đè
     * khuất. Reset mỗi lần open(); không truyền -> mặc định. */
    _zIndex: null,

    /** Cờ đánh dấu đang ở màn con "Chọn Google Font" (true) hay màn chính Box/Text (false, mặc
     * định) — Element Style Editor tự quản lý push/back 1 màn CỦA RIÊNG NÓ (KHÔNG dùng
     * `workflowAppSettings._screenStack`, tool đó thuộc domain Settings khác, xem `_render()`/
     * `_renderFontPicker()` bên dưới). Reset mỗi lần `open()` — phiên mới luôn bắt đầu ở màn chính. */
    _fontPickerOpen: false,
    /** Số phiên mở editor, ghép vào `scrollKey` (event/workflow/generic-drawer-helpers.js) để mỗi lần `open()`
     * là 1 bộ nhớ cuộn MỚI (không kế thừa vị trí của lần mở trước trong CÙNG phiên Drawer, vd mở từ Settings >
     * Subtitle 2 lần liên tiếp); TRONG 1 phiên: vẽ lại cùng tab -> giữ vị trí, đổi tab/quay về từ màn Font -> về
     * đúng vị trí tab đó. */
    _scrollSessionId: 0,

    /** Mở Drawer cho 1 DOM cụ thể — bắt đầu từ draft TRẮNG (mọi property tắt).
     * `initialCssString` (optional) — chuỗi CSS đã lưu (đúng định dạng buildElementStyleCssString(), vd `subtitleBoxCss`):
     * draft nạp lại khớp từng field qua applyElementStyleCssStringToDraft() (core) NGAY SAU khi reset trắng. Không truyền
     * -> mở trắng.
     * `onClose` — xem field `_onClose`. `options` — `{zIndex, startTab}`: xem field `_zIndex`; `startTab` ('box'|'text')
     * mặc định 'box' — layer Text của Photo truyền 'text' (tab Box vô nghĩa với chữ vẽ lên canvas).
     */
    open(targetEl, onApply, initialCssString, onClose, options) {
        options = options || {};
        this._targetEl = targetEl;
        this._onApply = onApply || null;
        this._onClose = onClose || null;
        this._zIndex = options.zIndex || null;
        this._fontPickerOpen = false; // phiên mới luôn bắt đầu ở màn chính, không kẹt ở màn con font còn dở từ lần mở trước
        resetElementStyleDraft(); // core
        if (initialCssString) applyElementStyleCssStringToDraft(initialCssString); // core — nạp khớp style đã lưu
        setElementStyleActiveTab(options.startTab || 'box'); // core
        this._scrollSessionId += 1; // phiên nhớ cuộn mới, xem docstring field
        this._render();
    },

    /** Vẽ (lại) màn hiện tại — màn con "Chọn Google Font" hoặc màn chính (`ESE_RENDER_BY_FONT_PICKER_OPEN`). */
    _render() {
        ESE_RENDER_BY_FONT_PICKER_OPEN[this._fontPickerOpen]();
    },

    /** Màn chính Box/Text. */
    _renderMain() {
        const { eseActiveTab: activeTab, eseDraft: draft, eseLoadedGoogleFonts: loadedFonts } = appState.get(['eseActiveTab', 'eseDraft', 'eseLoadedGoogleFonts']);
        // `height:'auto'` BẮT BUỘC: thiếu thì core/generic-drawer.js rơi về chiều cao cố định 70vh, không co theo nội dung
        // và không tự resize khi đổi tab / bung kết quả tìm font. Trần 80vh.
        const config = {
            scrollKey: `elementStyleEditor#${this._scrollSessionId}:${activeTab}`, // mỗi tab 1 vị trí cuộn riêng, xem `_scrollSessionId`
            height: 'auto',
            maxHeight: '80vh',
            headerHtml: renderElementStyleEditorHeader(activeTab), // components/element-style-editor-drawer.js
            // Không `pt-*`: khối Preview sticky ở đầu body tự cấp `pt-3` (xem `_renderEsePreviewBox()`,
            // components/element-style-editor-drawer.js).
            bodyHtml: renderElementStyleEditorBody(draft, activeTab, loadedFonts),
            bodyClass: 'overflow-y-auto px-4 pb-3',
        };
        if (this._zIndex) config.zIndex = this._zIndex; // xem docstring field `_zIndex` — không set -> mặc định
        if (genericDrawerPanel.classList.contains('hidden')) workflowGenericDrawerHelpers.open(config); // event/workflow/generic-drawer-helpers.js (nhớ cuộn theo scrollKey) -> core/generic-drawer.js
        else workflowGenericDrawerHelpers.update(config);
        this._updatePreview(); // sơn preview NGAY sau mỗi lần vẽ lại body (tab đổi, toggle bật/tắt...)
        workflowGenericDrawerHelpers.restoreScroll(); // event/workflow/generic-drawer-helpers.js — áp lại vị trí cuộn sau khi vẽ (khối input con có thể vừa hiện ra)
    },

    // ===================== Cửa vào từ Router 'elementStyleEditor' =====================
    // Tính toán ở core thuần, ghi DOM tại chỗ ở core -ui, rẽ nhánh bằng object map.

    /** 'elementStyleEditor.tab.click' — đổi tab Box/Text.
     * @param {'box'|'text'} tab */
    selectTab(tab) {
        setElementStyleActiveTab(tab); // core
        this._render();
    },

    /** 'elementStyleEditor.enable.change' — bật/tắt 1 property, LUÔN vẽ lại toàn body (hiện/ẩn khối input con).
     * @param {string} section @param {string} field @param {boolean} checked */
    setFieldEnabled(section, field, checked) {
        setElementStyleField(section, field, { enabled: checked }); // core
        this._render();
    },

    /** 'elementStyleEditor.field.input' — 1 ô `.ese-field` đổi giá trị (`input` với ô nhập, `change` với select — Listener
     * chọn đúng cặp sự kiện). Ghi field -> vẽ lại body (ô `data-rerender`) hoặc chỉ sơn preview -> đồng bộ ô đối ứng của
     * cặp màu (`data-cross-target`).
     * @param {{section: string, field: string, subkey: string, raw: string, isNumeric: boolean, rerender: boolean,
     *          crossTargetId: string|null}} p */
    setFieldValue({ section, field, subkey, raw, isNumeric, rerender, crossTargetId }) {
        setElementStyleField(section, field, { [subkey]: resolveElementStyleFieldValue(raw, isNumeric) }); // core
        ESE_AFTER_FIELD_INPUT_BY_RERENDER[rerender]();
        setEseCrossTargetValue(genericDrawerBody, crossTargetId, raw); // core/element-style-editor-ui.js
    },

    /** 'elementStyleEditor.simpleField.change' — field dropdown-thuần (fontWeight/fontStyle/textAlign/textDecoration/
     * textTransform/whiteSpace): ghi THẲNG chuỗi, không UI con phụ thuộc -> chỉ sơn preview.
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

    /** 'elementStyleEditor.fontPicker.open.click' — nút tên font (nguồn 'google') mở màn con danh sách. */
    openFontPicker() {
        this._fontPickerOpen = true;
        this._render();
    },

    /** 'elementStyleEditor.fontPicker.back.click' — đóng màn con (KHÔNG đóng cả Drawer — "ghi nhớ back lại"). */
    closeFontPicker() {
        this._fontPickerOpen = false;
        this._render();
    },

    /** 'elementStyleEditor.fontPicker.search.input' — lọc lại danh sách TẠI CHỖ (chỉ thay danh sách, không vẽ lại cả màn —
     * ô tìm không mất focus khi gõ), áp theme cho dòng mới. Không cần gắn lại click từng dòng nữa (Listener ủy quyền).
     * @param {string} query */
    filterFontPicker(query) {
        const currentValue = appState.get('eseDraft').text.fontFamily.value;
        const listEl = genericDrawerBody.querySelector('#ese-fontpicker-list');
        setEseFontPickerListHtml(listEl, _renderEseFontListItems(query, currentValue)); // core/element-style-editor-ui.js + components/element-style-editor-drawer.js
        applyUiThemeToDom(listEl, _activeUiThemeKeyList); // core/ui-theme/apply-ui.js — dòng font tô màu qua `data-uitk`, gán lại danh sách phải áp theme lại
    },

    /** 'elementStyleEditor.fontPicker.option.click' — chọn 1 font: ghi state rồi TỰ quay lại màn chính.
     * LUÔN ghi kèm `source:'google'` (không chỉ `value`) — style lưu từ lúc còn nguồn 'system' (parse qua initialCssString)
     * tự sửa đúng khi chọn lại font.
     * @param {string} fontName */
    selectFont(fontName) {
        setElementStyleField('text', 'fontFamily', { value: fontName, source: 'google' }); // core
        this._fontPickerOpen = false; // "ghi nhớ back lại" — tự quay về màn chính, không kẹt ở danh sách
        this._render(); // vẽ lại màn chính, nút font name hiện ĐÚNG tên vừa chọn + preview tự cập nhật
    },

    /** Sơn LẠI `#ese-preview-box` (components/element-style-editor-drawer.js::_renderEsePreviewBox()) khớp ĐÚNG draft
     * HIỆN TẠI — gọi SAU MỌI thao tác đổi field (kể cả field không có `data-rerender`) để preview luôn real-time, không
     * đợi bấm "Áp dụng". TÁI DÙNG ĐÚNG cặp hàm `buildElementStyleCssString()`+`applyElementStyleToDom()`
     * (core) mà `_apply()` dùng để áp thật lên `targetEl` — đảm bảo preview KHÔNG BAO GIỜ lệch so
     * với kết quả thật. `removeAttribute('style')` TRƯỚC khi áp lại — CÙNG lý do
     * `workflowSubtitleDisplay.applyFrameStyle()` (event/workflow/subtitle-display.js): applyElementStyleToDom()
     * chỉ setProperty() TỪNG khai báo, KHÔNG tự xoá property THỪA nếu draft mới bỏ bớt property so
     * với lần sơn trước (vd vừa tắt Border đã bật trước đó). */
    _updatePreview() {
        const previewBox = genericDrawerBody.querySelector('#ese-preview-box');
        if (!previewBox) return; // guard: hiếm khi thiếu (Drawer vừa đóng ngay lúc gọi)
        previewBox.removeAttribute('style');
        applyElementStyleToDom(previewBox, buildElementStyleCssString(appState.get('eseDraft'))); // core
    },

    /** Vẽ màn con "Chọn Google Font": header có nút Back RIÊNG, body là ô tìm kiếm + danh sách cuộn dọc
     * (components/element-style-editor-drawer.js::renderEseFontPickerHeader()/renderEseFontPickerBody()). CÙNG
     * `height`/`maxHeight` với `_renderMain()`. Back / ô tìm / chọn font: closeFontPicker()/filterFontPicker()/selectFont(). */
    _renderFontPicker() {
        const draft = appState.get('eseDraft');
        const currentValue = draft.text.fontFamily.value;
        const config = {
            scrollKey: `elementStyleEditor#${this._scrollSessionId}:fontPicker`, // màn con đi TỚI: luôn từ đầu; vị trí màn chính được nhớ cho lúc Back
            scrollReset: true,
            height: 'auto',
            maxHeight: '80vh',
            headerHtml: renderEseFontPickerHeader(), // components/element-style-editor-drawer.js
            bodyHtml: renderEseFontPickerBody(currentValue),
            bodyClass: 'overflow-y-auto px-4 py-3',
        };
        if (this._zIndex) config.zIndex = this._zIndex;
        if (genericDrawerPanel.classList.contains('hidden')) workflowGenericDrawerHelpers.open(config); // event/workflow/generic-drawer-helpers.js (nhớ cuộn theo scrollKey) -> core/generic-drawer.js
        else workflowGenericDrawerHelpers.update(config);
    },

    /** Build chuỗi CSS -> lưu state -> áp inline lên targetEl (nếu có) -> báo `onApply` (nếu có,
     * để nơi gọi tự persist) -> đóng Drawer. */
    _apply() {
        const draft = appState.get('eseDraft');
        const cssString = buildElementStyleCssString(draft); // core, thuần tính toán
        setElementStyleGeneratedCss(cssString); // core
        if (this._targetEl) applyElementStyleToDom(this._targetEl, cssString); // core
        if (this._onApply) this._onApply(cssString);
        this._close();
    },

    /** Đóng Drawer — ưu tiên `_onClose` nếu nơi mở có truyền (xem docstring field `_onClose` đầu
     * file), mặc định đóng hẳn. Dùng CHUNG cho cả nút X lẫn sau khi Áp dụng xong. */
    _close() {
        if (this._onClose) this._onClose(); else workflowGenericDrawerHelpers.closeFully();
    },
};
