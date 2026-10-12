/**
 * event/workflow/element-style-editor.js — "THẰNG THỰC THI CUỐI" cho công cụ CHUNG "Element Style
 * Editor" (dựng CSS box model + text style qua UI trong Generic Drawer, xuất chuỗi CSS rồi áp
 * inline lên 1 DOM cụ thể).
 *
 * API CÔNG KHAI DUY NHẤT hiện tại: `workflowElementStyleEditor.open(targetEl, onApply,
 * initialCssString?, onClose?, options?)` — gọi TRỰC TIẾP từ Workflow domain khác (CÙNG tiền lệ gọi
 * chéo Workflow, vd `closeControlCenter()` trong event/workflow/custom-effect.js). `initialCssString`
 * (MỚI 16/08/2026, mục 2) — optional, xem docstring open() bên dưới. `options` (MỚI, Photo Text/
 * Shape layer — event/workflow/image-edit.js::openLayerStyleEditor()) — object tuỳ chọn
 * `{zIndex, startTab}`, xem docstring field `_zIndex` + tham số `open()` bên dưới.
 *   - `targetEl` — DOM áp inline style trực tiếp lúc bấm Áp dụng (applyElementStyleToDom(), core/
 *     element-style-editor.js). Truyền `null` nếu KHÔNG có DOM sống nào cần áp trực tiếp (vd nơi
 *     gọi tự lo lưu + áp qua `onApply` — applyElementStyleToDom() tự guard `!targetEl`, không lỗi;
 *     Photo Text/Shape layer dùng đúng trường hợp này — layer là object vẽ lên canvas, không phải
 *     DOM sống, xem `_applyLayerStyleCssString()`, event/workflow/image-edit.js).
 *   - `onApply(cssString)` (optional) — callback nhận chuỗi CSS vừa build, để nơi gọi tự LƯU lại
 *     (config/DB) nếu cần persist qua reload — Element Style Editor bản thân KHÔNG tự lưu bất cứ
 *     đâu ngoài `eseGeneratedCss` (appState runtime), đúng vai trò "công cụ chung, không biết
 *     nghiệp vụ cụ thể". MỚI (15/08/2026) — dùng LẦN ĐẦU bởi Subtitle "Styling" (mục 4a, xem
 *     event/workflow/subtitle-style-settings.js::openStyling()): `targetEl = subtitleFrame`
 *     (style CHUNG cho khung bao mọi dòng, KHÔNG áp riêng từng dòng phụ đề) + `onApply` ghi
 *     `subtitleBoxCss` (setSubtitleVizField(), core/subtitle/subtitle-style-settings.js) rồi `saveConfig()`.
 *
 * Nội dung Box/Text HOÀN TOÀN template string tĩnh (components/element-style-editor-drawer.js,
 * KHÔNG dùng createElement). SỬA (12/10/2026, plan-event-bus-wiring-07-10-2026 đợt 5) — Workflow KHÔNG còn tự
 * querySelector + addEventListener sau mỗi lần vẽ (`_wire()`/`_wireFontPicker()`/`_wireFontPickerListClicks()` đã xoá):
 * mọi tab/toggle/ô/nút đi Listener ủy quyền (event/listener/element-style-editor.js) -> Router 'elementStyleEditor'
 * (event/router/element-style-editor.js, cụm MỚI) -> các method "cửa vào từ Router" bên dưới — CÙNG khuôn
 * event/listener/custom-effect.js (28/09/2026). Ghi DOM tại chỗ (ô màu đối ứng, danh sách font) qua
 * core/element-style-editor-ui.js.
 *
 * NẠP SAU: core/generic-drawer.js, core/element-style-editor.js, core/element-style-editor-ui.js (MỚI 12/10/2026), components/
 * element-style-editor-drawer.js, service/state/element-style-editor.js, event/workflow/
 * generic-drawer-helpers.js (closeFully()), core/dom-refs.js (genericDrawerPanel/Header/Body).
 */

/** MỚI (12/10/2026, dọn nợ §7 trong method bị đụng `_render()`) — đang ở màn con "Chọn Google Font" hay màn chính
 * Box/Text (trước: `if (this._fontPickerOpen) { this._renderFontPicker(); return; }`). */
const ESE_RENDER_BY_FONT_PICKER_OPEN = {
    true: () => workflowElementStyleEditor._renderFontPicker(),
    false: () => workflowElementStyleEditor._renderMain(),
};

/** MỚI (12/10/2026, dọn nợ §7 — callback `.ese-field` cũ: `if (rerender) this._render(); else this._updatePreview();`)
 * — ô có `data-rerender` (đổi mode width/height, nguồn font...) mới vẽ lại toàn body; còn lại chỉ sơn lại preview
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
    /** MỚI (phản hồi Giang — sửa lỗ hổng "X đóng luôn cả Setting thay vì quay lại Subtitle") — gọi
     * THAY VÌ `closeFully()` khi đóng Drawer (bấm X HAY vừa Áp dụng xong) — dùng bởi nơi gọi ĐANG
     * SỐNG CHUNG Generic Drawer với công cụ này (Subtitle "Styling", event/workflow/
     * subtitle-style-settings.js::openStyling()) để tự mở lại đúng màn của mình thay vì đóng trắng
     * cả Setting. KHÔNG truyền -> giữ NGUYÊN hành vi cũ (đóng hẳn). */
    _onClose: null,

    /** MỚI (tái dùng cho Photo Text/Shape layer, Giang yêu cầu "styling editor generic drawer đã có
     * sẵn, đừng tự chế riêng") — z-index CẦN tự truyền khi mở TỪ 1 ngữ cảnh đã có z-index CAO HƠN
     * mặc định của Generic Drawer (128, GENERIC_DRAWER_DEFAULT_Z_INDEX — core/generic-drawer.js) —
     * modal xem ảnh Photo (Z_INDEX.IMAGE_PREVIEW = 130, service/z-index.js) CAO HƠN mức đó, không
     * truyền riêng thì Drawer này bị đè khuất phía dưới, bấm không tới. Reset mỗi lần open(), KHÔNG
     * truyền (undefined) -> giữ NGUYÊN hành vi cũ 100% (Subtitle Styling — mặc định 128). */
    _zIndex: null,

    /** MỚI (mục 2, Giang yêu cầu "chuyển dropdown google > dạng drawer generic list (subpanel)") —
     * cờ đánh dấu đang ở màn con "Chọn Google Font" (true) hay màn chính Box/Text (false, mặc
     * định) — Element Style Editor tự quản lý push/back 1 màn CỦA RIÊNG NÓ (KHÔNG dùng
     * `workflowAppSettings._screenStack`, tool đó thuộc domain Settings khác, xem `_render()`/
     * `_renderFontPicker()` bên dưới). Reset mỗi lần `open()` — phiên mới luôn bắt đầu ở màn chính. */
    _fontPickerOpen: false,
    /** MỚI (24/09/2026) — số phiên mở editor, ghép vào `scrollKey` (event/workflow/generic-drawer-helpers.js) để mỗi lần `open()`
     * là 1 bộ nhớ cuộn MỚI (không kế thừa vị trí của lần mở trước trong CÙNG phiên Drawer, vd mở từ Settings >
     * Subtitle 2 lần liên tiếp); TRONG 1 phiên: vẽ lại cùng tab -> giữ vị trí, đổi tab/quay về từ màn Font -> về
     * đúng vị trí tab đó. */
    _scrollSessionId: 0,

    /** Mở Drawer cho 1 DOM cụ thể — mặc định bắt đầu từ draft TRẮNG (mọi property tắt).
     * MỚI (16/08/2026, mục 2 — Giang yêu cầu "cung cấp cấu hình mặc định giống hiện tại") — tham số
     * `initialCssString` (optional) — nếu nơi gọi TRUYỀN VÀO 1 chuỗi CSS đã lưu sẵn trước đó (đúng
     * định dạng buildElementStyleCssString() xuất ra, vd `subtitleBoxCss`), draft sẽ NẠP LẠI khớp
     * đúng field đó qua applyElementStyleCssStringToDraft() (core) NGAY SAU khi reset trắng — đúng
     * điểm mở rộng đã dự trù sẵn ở đây (xem lịch sử docstring này) "nơi gọi tự đọc style hiện có +
     * dựng lại draft tương ứng... truyền thẳng qua appState.set('eseDraft', ...) sau
     * resetElementStyleDraft()". Không truyền (hoặc truyền rỗng) -> hành vi CŨ giữ nguyên 100% (mở
     * trắng), guard nằm NGAY TRONG applyElementStyleCssStringToDraft() (core, guard `!cssString`).
     * `onClose` — MỚI, xem docstring khai báo field `_onClose` ở trên.
     * `options` — MỚI (Photo layer), object tuỳ chọn `{zIndex, startTab}`, xem docstring field
     * `_zIndex` ở trên. `startTab` ('box'|'text') — tab MỞ SẴN, mặc định 'box' (hành vi cũ) nếu
     * không truyền — Photo Text layer truyền 'text' vì tab Box (padding/margin/width/height) không
     * có nghĩa gì với chữ vẽ lên canvas (xem `_applyLayerStyleCssString()`, event/workflow/image-
     * edit.js).
     */
    open(targetEl, onApply, initialCssString, onClose, options) {
        options = options || {};
        this._targetEl = targetEl;
        this._onApply = onApply || null;
        this._onClose = onClose || null;
        this._zIndex = options.zIndex || null;
        this._fontPickerOpen = false; // MỚI (mục 2) — phiên mới luôn bắt đầu ở màn chính, không kẹt ở màn con font còn dở từ lần mở trước
        resetElementStyleDraft(); // core
        if (initialCssString) applyElementStyleCssStringToDraft(initialCssString); // core — MỚI, nạp khớp style đã lưu
        setElementStyleActiveTab(options.startTab || 'box'); // core
        this._scrollSessionId += 1; // MỚI (24/09/2026) — phiên nhớ cuộn mới, xem docstring field
        this._render();
    },

    /** Vẽ (lại) màn hiện tại. SỬA (12/10/2026, method bị đụng -> dọn nợ, Rule 0.5): rẽ màn con font / màn chính qua
     * object map `ESE_RENDER_BY_FONT_PICKER_OPEN` (trước: if-return); thân màn chính tách sang `_renderMain()`. */
    _render() {
        ESE_RENDER_BY_FONT_PICKER_OPEN[this._fontPickerOpen](); // MỚI (mục 2) — đang ở màn con "Chọn Google Font" hay màn chính
    },

    /** Màn chính Box/Text (thân `_render()` cũ). SỬA (12/10/2026) — 3 key đọc gộp 1 lần `appState.get([...])` (§4B). */
    _renderMain() {
        const { eseActiveTab: activeTab, eseDraft: draft, eseLoadedGoogleFonts: loadedFonts } = appState.get(['eseActiveTab', 'eseDraft', 'eseLoadedGoogleFonts']);
        // FIX (Giang chỉ ra — kiểm lại thấy config này CHƯA TỪNG truyền height/maxHeight, kể cả
        // trước đợt sửa z-index/startTab cho Photo layer) — ĐÚNG loại bug đã gặp + fix ở
        // event/workflow/eq-presets.js::openListView()/event/workflow/custom-effect.js (xem comment
        // lịch sử 2 chỗ đó): thiếu `height`/`maxHeight` -> `_resolveGenericDrawerHeightPx()` (core/
        // generic-drawer.js) coi `config.height !== 'auto'` là TRUE (vì `undefined !== 'auto'`) ->
        // rơi về nhánh height CỐ ĐỊNH `_cssLengthToPx(config.height || '70vh')` = luôn đúng 70vh,
        // `_genericDrawerIsAutoMode = false` -> KHÔNG BAO GIỜ co theo nội dung thật, và không tự
        // resize khi đổi tab Box<->Text hay bung kết quả tìm Google Font (MutationObserver auto-
        // resize chỉ chạy lúc `_genericDrawerIsAutoMode === true`). Ảnh hưởng CẢ Subtitle Styling
        // lẫn Photo layer Text/Shape (dùng CHUNG component này). `maxHeight: '80vh'` — cùng trần đã
        // dùng cho Photo layer style editor bản tự chế CŨ (`openPhotoLayerStyleDrawerUi()`, đã xoá).
        const config = {
            scrollKey: `elementStyleEditor#${this._scrollSessionId}:${activeTab}`, // MỚI (24/09/2026) — mỗi tab 1 vị trí cuộn riêng, xem `_scrollSessionId`
            height: 'auto',
            maxHeight: '80vh',
            headerHtml: renderElementStyleEditorHeader(activeTab), // components/element-style-editor-drawer.js
            // SỬA (mục 3, "preview đang có khe hở ở top") — bỏ `pt-3` (KHÔNG còn gì cho khối Preview
            // sticky ở đầu body phải triệt tiêu bằng margin âm nữa — nó tự cấp `pt-3` riêng, xem
            // docstring `_renderEsePreviewBox()`, components/element-style-editor-drawer.js).
            bodyHtml: renderElementStyleEditorBody(draft, activeTab, loadedFonts),
            bodyClass: 'overflow-y-auto px-4 pb-3',
        };
        if (this._zIndex) config.zIndex = this._zIndex; // xem docstring field `_zIndex` — mặc định (không set) giữ NGUYÊN hành vi cũ
        if (genericDrawerPanel.classList.contains('hidden')) workflowGenericDrawerHelpers.open(config); // event/workflow/generic-drawer-helpers.js (nhớ cuộn theo scrollKey) -> core/generic-drawer.js
        else workflowGenericDrawerHelpers.update(config);
        // SỬA (12/10/2026) — `this._wire()` cũ bỏ (sự kiện nay đi Listener -> Router); việc cuối của nó là sơn preview NGAY
        // sau mỗi lần vẽ lại body (tab đổi, toggle bật/tắt...) — giữ nguyên tại đây.
        this._updatePreview();
        workflowGenericDrawerHelpers.restoreScroll(); // event/workflow/generic-drawer-helpers.js (nhớ cuộn theo scrollKey) -> core/generic-drawer.js — MỚI (24/09/2026) áp lại sau khi vẽ (khối input con có thể vừa hiện ra)
    },

    // ===================== Cửa vào từ Router 'elementStyleEditor' — MỚI 12/10/2026 =====================
    // Thân mỗi method = đúng callback mà `_wire()`/`_wireFontPicker()`/`_wireFontPickerListClicks()` cũ tự gắn
    // (plan-event-bus-wiring-07-10-2026 đợt 5, khuôn W1–W3); phần tính toán/ghi DOM/rẽ nhánh trong callback cũ dời về
    // core thuần / core -ui / object map (code mới phải đạt rule).

    /** 'elementStyleEditor.tab.click' — đổi tab Box/Text (trước: callback gọi thẳng core `setElementStyleActiveTab()`).
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
     * giữ đúng cặp sự kiện cũ). Ghi field -> vẽ lại body (ô `data-rerender`) hoặc chỉ sơn preview -> đồng bộ ô đối ứng của
     * cặp màu (`data-cross-target`, trước là 1 listener `input` riêng chạy SAU listener `.ese-field`).
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

    /** 'elementStyleEditor.loadFont.click' — nạp Google Font đang chọn rồi vẽ lại. SỬA (12/10/2026) — 2 key đọc gộp 1 lần. */
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
        applyUiThemeToDom(listEl, _activeUiThemeKeyList); // core/ui-theme/apply-ui.js — SỬA 23/09/2026: dòng font tô màu qua `data-uitk`, gán lại danh sách phải áp theme lại
    },

    /** 'elementStyleEditor.fontPicker.option.click' — chọn 1 font: ghi state rồi TỰ quay lại màn chính.
     * SỬA (mục 1 — "giờ mặc định sẽ chỉ có google font") — LUÔN ghi kèm `source:'google'` (KHÔNG chỉ `value`) — phòng
     * draft đang parse ra `source:'system'` từ 1 style ĐÃ LƯU TỪ TRƯỚC (initialCssString) lúc app còn hỗ trợ nguồn đó.
     * @param {string} fontName */
    selectFont(fontName) {
        setElementStyleField('text', 'fontFamily', { value: fontName, source: 'google' }); // core
        this._fontPickerOpen = false; // "ghi nhớ back lại" — tự quay về màn chính, không kẹt ở danh sách
        this._render(); // vẽ lại màn chính, nút font name hiện ĐÚNG tên vừa chọn + preview tự cập nhật
    },

    /** MỚI (16/08/2026 — Giang yêu cầu "ô preview cố định ở trong body drawer") — sơn LẠI
     * `#ese-preview-box` (components/element-style-editor-drawer.js::_renderEsePreviewBox()) khớp
     * ĐÚNG draft HIỆN TẠI — gọi SAU MỌI thao tác đổi field (kể cả field KHÔNG kích `data-rerender`,
     * xem `.ese-field`/`.ese-simple-field` bên dưới) để preview LUÔN sống động real-time, không đợi
     * bấm "Áp dụng". TÁI DÙNG ĐÚNG cặp hàm `buildElementStyleCssString()`+`applyElementStyleToDom()`
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

    /** MỚI (mục 2, thay `_wireFontFamilyPicker()` cũ — Giang yêu cầu "chuyển dropdown google > dạng
     * drawer generic list (subpanel), nhấn vào để chọn > ghi nhớ back lại") — vẽ màn con "Chọn
     * Google Font": header có nút Back RIÊNG (KHÔNG phải tab Box/Text), body là ô tìm kiếm + danh
     * sách cuộn dọc thật (components/element-style-editor-drawer.js::renderEseFontPickerHeader()/
     * renderEseFontPickerBody()). CÙNG khuôn `height`/`maxHeight` với `_render()` (tránh lặp lại
     * đúng bug "quên height/maxHeight -> kẹt 70vh cố định" đã ghi trong docstring `_render()`). */
    _renderFontPicker() {
        const draft = appState.get('eseDraft');
        const currentValue = draft.text.fontFamily.value;
        const config = {
            scrollKey: `elementStyleEditor#${this._scrollSessionId}:fontPicker`, // MỚI (24/09/2026) — màn con đi TỚI: luôn từ đầu; vị trí màn chính được Workflow nhớ cho lúc Back
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
        // SỬA (12/10/2026) — `this._wireFontPicker()` cũ bỏ: Back / ô tìm / chọn font đi Listener -> Router (xem
        // closeFontPicker()/filterFontPicker()/selectFont()).
    },

    // XOÁ (12/10/2026, plan-event-bus-wiring đợt 5) — `_wireFontPicker()` + `_wireFontPickerListClicks()`: thân dời sang
    // closeFontPicker()/filterFontPicker()/selectFont() ở trên.

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
