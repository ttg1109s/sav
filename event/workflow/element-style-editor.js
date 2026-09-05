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
 *     (style CHUNG cho khung bao mọi dòng, KHÔNG áp riêng từng dòng phụ đề) + `onApply` gọi
 *     `setSubtitleBoxCss()` (core/subtitle/subtitle-style-settings.js) rồi `saveConfig()`.
 *
 * Nội dung Box/Text HOÀN TOÀN template string tĩnh (components/element-style-editor-drawer.js,
 * KHÔNG dùng createElement) — Workflow tự querySelector + addEventListener trên genericDrawerBody/
 * Header SAU mỗi lần render (KHÔNG qua eventBus cho các control động trong Drawer), CÙNG pattern
 * event/workflow/custom-effect.js.
 *
 * NẠP SAU: core/generic-drawer.js, core/element-style-editor.js, components/
 * element-style-editor-drawer.js, service/state/element-style-editor.js, event/workflow/
 * generic-drawer-helpers.js (closeFully()), core/dom-refs.js (genericDrawerPanel/Header/Body).
 */

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
        this._render();
    },

    _render() {
        if (this._fontPickerOpen) { this._renderFontPicker(); return; } // MỚI (mục 2) — đang ở màn con "Chọn Google Font"
        const activeTab = appState.get('eseActiveTab');
        const draft = appState.get('eseDraft');
        const loadedFonts = appState.get('eseLoadedGoogleFonts');
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
        if (genericDrawerPanel.classList.contains('hidden')) openGenericDrawer(config); // core/generic-drawer.js
        else updateGenericDrawer(config);
        this._wire();
    },

    _wire() {
        const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
        if (closeBtn) closeBtn.addEventListener('click', () => this._close());

        genericDrawerHeader.querySelectorAll('[data-ese-tab]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                setElementStyleActiveTab(e.currentTarget.dataset.eseTab); // core
                this._render();
            });
        });

        // Toggle bật/tắt property — LUÔN re-render toàn body (hiện/ẩn khối input con).
        genericDrawerBody.querySelectorAll('.ese-enable').forEach((el) => {
            el.addEventListener('change', (e) => {
                const t = e.currentTarget;
                setElementStyleField(t.dataset.section, t.dataset.field, { enabled: t.checked }); // core
                this._render();
            });
        });

        // Mọi input/select giá trị field — data-rerender="1" (vd mode width/height, source font)
        // mới cần vẽ lại toàn body, còn lại chỉ ghi state, giữ nguyên UI (input tự hiện giá trị
        // mới của chính nó, không cần đồng bộ tay).
        genericDrawerBody.querySelectorAll('.ese-field').forEach((el) => {
            const evt = el.tagName === 'SELECT' ? 'change' : 'input';
            el.addEventListener(evt, (e) => {
                const t = e.currentTarget;
                const { section, field, subkey, numeric, rerender } = t.dataset;
                setElementStyleField(section, field, { [subkey]: numeric ? parseFloat(t.value) : t.value }); // core
                if (rerender) this._render();
                else this._updatePreview(); // _render() ở trên ĐÃ tự gọi _updatePreview() ở cuối rồi, tránh gọi 2 lần
            });
        });

        // MỚI (15/08/2026, "None là dropdown") — field dropdown-thuần (fontWeight/fontStyle/
        // textAlign/textDecoration/textTransform/whiteSpace) — ghi THẲNG giá trị string, không qua
        // cơ chế merge subkey của .ese-field (bản thân field không phải object). Không field nào
        // trong nhóm này có UI con phụ thuộc giá trị -> không cần re-render.
        genericDrawerBody.querySelectorAll('.ese-simple-field').forEach((el) => {
            el.addEventListener('change', (e) => {
                const t = e.currentTarget;
                setElementStyleSimpleField(t.dataset.section, t.dataset.field, t.value); // core
                this._updatePreview();
            });
        });

        // Đồng bộ hiển thị 2 input cùng 1 giá trị (text hex <-> color picker) — CÙNG pattern
        // ce-solid-color-text/picker (components/custom-effect-drawer.js).
        genericDrawerBody.querySelectorAll('[data-cross-target]').forEach((el) => {
            el.addEventListener('input', (e) => {
                const target = genericDrawerBody.querySelector(`#${e.currentTarget.dataset.crossTarget}`);
                if (target) target.value = e.currentTarget.value;
            });
        });

        const loadFontBtn = genericDrawerBody.querySelector('#ese-fontfamily-load-btn');
        if (loadFontBtn) {
            loadFontBtn.addEventListener('click', () => {
                const draft = appState.get('eseDraft');
                const loaded = appState.get('eseLoadedGoogleFonts');
                loadGoogleFont(draft.text.fontFamily.value, draft.text.fontFamily.googleWeight, loaded); // core
                this._render();
            });
        }

        // MỚI (mục 2, thay `_wireFontFamilyPicker()` cũ) — nút hiển thị tên font (nguồn 'google')
        // giờ CHỈ mở màn con danh sách, KHÔNG tự gõ/lọc tại chỗ nữa.
        const openFontPickerBtn = genericDrawerBody.querySelector('#ese-fontfamily-open-picker');
        if (openFontPickerBtn) openFontPickerBtn.addEventListener('click', () => { this._fontPickerOpen = true; this._render(); });

        const applyBtn = genericDrawerBody.querySelector('#ese-apply-btn');
        if (applyBtn) applyBtn.addEventListener('click', () => this._apply());

        this._updatePreview(); // MỚI — sơn preview NGAY sau mỗi lần vẽ lại body (tab đổi, toggle bật/tắt...)
    },

    /** MỚI (16/08/2026 — Giang yêu cầu "ô preview cố định ở trong body drawer") — sơn LẠI
     * `#ese-preview-box` (components/element-style-editor-drawer.js::_renderEsePreviewBox()) khớp
     * ĐÚNG draft HIỆN TẠI — gọi SAU MỌI thao tác đổi field (kể cả field KHÔNG kích `data-rerender`,
     * xem `.ese-field`/`.ese-simple-field` bên dưới) để preview LUÔN sống động real-time, không đợi
     * bấm "Áp dụng". TÁI DÙNG ĐÚNG cặp hàm `buildElementStyleCssString()`+`applyElementStyleToDom()`
     * (core) mà `_apply()` dùng để áp thật lên `targetEl` — đảm bảo preview KHÔNG BAO GIỜ lệch so
     * với kết quả thật. `removeAttribute('style')` TRƯỚC khi áp lại — CÙNG lý do
     * `applySubtitleFrameStyle()` (core/subtitle/subtitle-style-settings.js): applyElementStyleToDom()
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
            height: 'auto',
            maxHeight: '80vh',
            headerHtml: renderEseFontPickerHeader(), // components/element-style-editor-drawer.js
            bodyHtml: renderEseFontPickerBody(currentValue),
            bodyClass: 'overflow-y-auto px-4 py-3',
        };
        if (this._zIndex) config.zIndex = this._zIndex;
        if (genericDrawerPanel.classList.contains('hidden')) openGenericDrawer(config); // core/generic-drawer.js
        else updateGenericDrawer(config);
        this._wireFontPicker();
    },

    /** Wire màn con font: nút Back (đóng màn con, KHÔNG đóng cả Drawer — "ghi nhớ back lại" đúng
     * yêu cầu Giang) + ô tìm kiếm (lọc lại danh sách tại chỗ, KHÔNG re-render cả màn — chỉ gán lại
     * `list.innerHTML`, tránh input mất focus giữa chừng lúc gõ, CÙNG lý do bản dropdown cũ) + click
     * 1 dòng font = ghi state rồi TỰ ĐỘNG quay lại màn chính (KHÔNG cần người dùng bấm Back tay). */
    _wireFontPicker() {
        const backBtn = genericDrawerHeader.querySelector('#btn-ese-fontpicker-back');
        if (backBtn) backBtn.addEventListener('click', () => { this._fontPickerOpen = false; this._render(); });

        const searchInput = genericDrawerBody.querySelector('#ese-fontpicker-search');
        const list = genericDrawerBody.querySelector('#ese-fontpicker-list');
        this._wireFontPickerListClicks(list);
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                const currentValue = appState.get('eseDraft').text.fontFamily.value;
                list.innerHTML = _renderEseFontListItems(searchInput.value, currentValue); // components/element-style-editor-drawer.js
                this._wireFontPickerListClicks(list);
            });
        }
    },

    /** Tách riêng khỏi `_wireFontPicker()` — cần gọi LẠI mỗi lần `list.innerHTML` bị gán lại lúc
     * gõ tìm kiếm (nút cũ trong DOM bị thay hẳn, listener cũ mất theo, phải wire lại nút MỚI). */
    _wireFontPickerListClicks(list) {
        if (!list) return;
        list.querySelectorAll('.ese-font-option').forEach((btn) => {
            btn.addEventListener('click', () => {
                setElementStyleField('text', 'fontFamily', { value: btn.dataset.fontName }); // core
                this._fontPickerOpen = false; // "ghi nhớ back lại" — tự quay về màn chính, không kẹt ở danh sách
                this._render(); // vẽ lại màn chính, nút font name giờ hiện ĐÚNG tên vừa chọn + preview tự cập nhật (_wire() cuối _render() gọi _updatePreview())
            });
        });
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
